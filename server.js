const express = require('express');
const compression = require('compression');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun
} = require('docx');
const { createToolsService } = require('./tools-service');
require('dotenv').config();

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

const DEFAULT_AGENT_ACCESS_ID = '0695d2c3-2cb8-4be7-9f59-b1a930e4ed0e';
const AGENT_ACCESS_ID = process.env.TIMEWEB_AGENT_ACCESS_ID || DEFAULT_AGENT_ACCESS_ID;
const TIMEWEB_OPENAI_BASE_URL = stripTrailingSlash(
  process.env.TIMEWEB_OPENAI_BASE_URL ||
    `https://agent.timeweb.cloud/api/v1/cloud-ai/agents/${AGENT_ACCESS_ID}/v1`
);
const TIMEWEB_NATIVE_CALL_URL =
  process.env.TIMEWEB_NATIVE_CALL_URL ||
  `https://agent.timeweb.cloud/api/v1/cloud-ai/agents/${AGENT_ACCESS_ID}/call`;
const TIMEWEB_MODEL = process.env.TIMEWEB_MODEL || 'grok-code-fast-1';
const TIMEWEB_API_TOKEN = process.env.TIMEWEB_API_TOKEN || process.env.OPENAI_API_KEY || '';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_OAUTH_CLIENT_ID = process.env.GITHUB_OAUTH_CLIENT_ID || process.env.GITHUB_CLIENT_ID || '';
const GITHUB_OAUTH_CLIENT_SECRET = process.env.GITHUB_OAUTH_CLIENT_SECRET || process.env.GITHUB_CLIENT_SECRET || '';
const SESSION_SECRET = process.env.SESSION_SECRET || process.env.TIMEWEB_API_TOKEN || 'repo-scope-dev-session-secret';
const ALLOWED_GITHUB_LOGIN = (process.env.ALLOWED_GITHUB_LOGIN || 'Zulut30').toLowerCase();
const PORT = Number(process.env.PORT || 3000);
const MODEL_MAX_OUTPUT_TOKENS = Number(process.env.TIMEWEB_MAX_OUTPUT_TOKENS || 3000);
const AI_CONTEXT_CHAR_LIMIT = Number(process.env.AI_CONTEXT_CHAR_LIMIT || 24000);
const AI_MAX_SELECTED_FILES = Number(process.env.AI_MAX_SELECTED_FILES || 12);
const AI_MAX_LISTED_FILES = Number(process.env.AI_MAX_LISTED_FILES || 160);
const AI_MAX_FILE_CHARS = Number(process.env.AI_MAX_FILE_CHARS || 7000);
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const USER_STATE_FILE = path.join(DATA_DIR, 'user-state.json');
const SESSION_FILE = path.join(DATA_DIR, 'sessions.json');
const SHARED_ANALYSES_FILE = path.join(DATA_DIR, 'shared-analyses.json');
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 14;
const sessions = loadSessionStore();
const toolsService = createToolsService({
  dataDir: DATA_DIR,
  pagespeedApiKey: process.env.GOOGLE_PAGESPEED_API_KEY || ''
});

app.use(compression({ threshold: 1024 }));
app.use(express.json({ limit: '5mb' }));
app.use((error, req, res, next) => {
  if (!error) return next();

  const isJsonParseError = error.type === 'entity.parse.failed' || error instanceof SyntaxError;
  if (isJsonParseError && req.path.startsWith('/api/')) {
    return res.status(400).json({
      ok: false,
      error: 'Некорректный JSON в запросе. Обновите страницу и попробуйте снова.'
    });
  }

  return next(error);
});
app.use(
  '/assets',
  express.static(path.join(PUBLIC_DIR, 'assets'), {
    immutable: true,
    maxAge: '30d'
  })
);
app.use(
  express.static(PUBLIC_DIR, {
    index: false,
    maxAge: '1d',
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    }
  })
);

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'github-repo-analyzer' });
});

app.get('/api/me', (req, res) => {
  const session = readSession(req);
  const canAnalyze = canUsePrivateAnalyzer(session);
  res.json({
    ok: true,
    authenticated: Boolean(session?.user),
    user: session?.user || null,
    canAnalyze,
    allowedLogin: ALLOWED_GITHUB_LOGIN,
    oauthConfigured: Boolean(GITHUB_OAUTH_CLIENT_ID && GITHUB_OAUTH_CLIENT_SECRET)
  });
});

app.get('/auth/github', (req, res) => {
  if (!GITHUB_OAUTH_CLIENT_ID || !GITHUB_OAUTH_CLIENT_SECRET) {
    return res.redirect('/profile?auth=missing-config');
  }

  const state = crypto.randomBytes(24).toString('hex');
  const redirectUri = `${getBaseUrl(req)}/auth/github/callback`;
  const params = new URLSearchParams({
    client_id: GITHUB_OAUTH_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: 'read:user repo',
    state
  });

  setSignedCookie(res, 'repo_scope_oauth_state', state, {
    maxAge: 10 * 60,
    sameSite: 'Lax',
    httpOnly: true,
    secure: isSecureRequest(req)
  });

  return res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
});

app.get('/auth/github/callback', async (req, res) => {
  try {
    const code = String(req.query.code || '');
    const state = String(req.query.state || '');
    const expectedState = verifySignedValue(parseCookies(req).repo_scope_oauth_state || '');

    if (!code || !state || !expectedState || state !== expectedState) {
      return res.redirect('/profile?auth=failed');
    }

    const redirectUri = `${getBaseUrl(req)}/auth/github/callback`;
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'repo-scope-oauth'
      },
      body: JSON.stringify({
        client_id: GITHUB_OAUTH_CLIENT_ID,
        client_secret: GITHUB_OAUTH_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri
      }),
      signal: AbortSignal.timeout(15000)
    });

    const tokenPayload = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !tokenPayload.access_token) {
      return res.redirect('/profile?auth=failed');
    }

    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${tokenPayload.access_token}`,
        'User-Agent': 'repo-scope-oauth'
      },
      signal: AbortSignal.timeout(15000)
    });

    if (!userResponse.ok) {
      return res.redirect('/profile?auth=failed');
    }

    const githubUser = await userResponse.json();
    const sid = crypto.randomBytes(32).toString('hex');
    sessions.set(sid, {
      createdAt: Date.now(),
      accessToken: tokenPayload.access_token,
      tokenScope: tokenPayload.scope || '',
      user: {
        login: githubUser.login || '',
        name: githubUser.name || '',
        avatarUrl: githubUser.avatar_url || '',
        profileUrl: githubUser.html_url || '',
        bio: githubUser.bio || '',
        company: githubUser.company || '',
        location: githubUser.location || '',
        blog: githubUser.blog || '',
        publicRepos: githubUser.public_repos || 0,
        followers: githubUser.followers || 0,
        following: githubUser.following || 0,
        createdAt: githubUser.created_at || ''
      }
    });

    await writeSessionStore();
    setSessionCookie(res, req, sid);
    clearCookie(res, 'repo_scope_oauth_state', { secure: isSecureRequest(req) });
    pruneSessions();
    return res.redirect('/profile?auth=success');
  } catch {
    return res.redirect('/profile?auth=failed');
  }
});

app.post('/auth/logout', async (req, res) => {
  const sid = verifySignedValue(parseCookies(req).repo_scope_session || '');
  if (sid) sessions.delete(sid);
  await writeSessionStore().catch(() => {});
  clearSessionCookie(res, req);
  res.redirect('/profile?auth=logout');
});

app.get('/auth/logout', async (req, res) => {
  const sid = verifySignedValue(parseCookies(req).repo_scope_session || '');
  if (sid) sessions.delete(sid);
  await writeSessionStore().catch(() => {});
  clearSessionCookie(res, req);
  res.redirect('/profile?auth=logout');
});

app.get('/api/profile/repos', async (req, res) => {
  try {
    const session = readSession(req);
    if (!session?.user || !session.accessToken) {
      return res.status(401).json({
        ok: false,
        error: 'Нужно войти через GitHub заново, чтобы получить список репозиториев.',
        reauthRequired: true
      });
    }

    if (!canUsePrivateAnalyzer(session)) {
      return res.status(403).json({
        ok: false,
        error: 'Доступ к репозиториям и анализу разрешён только GitHub пользователю Zulut30.',
        forbidden: true
      });
    }

    const repositories = await loadProfileRepositories(session.accessToken);
    res.json({
      ok: true,
      repositories,
      count: repositories.length
    });
  } catch (error) {
    res.status(error.status || 502).json({
      ok: false,
      error: error.publicMessage || error.message || 'Не удалось загрузить репозитории GitHub'
    });
  }
});

app.get('/api/profile/activity', async (req, res) => {
  try {
    const session = requireAllowedProfileSession(req, res);
    if (!session) return;

    const activity = await loadProfileActivity(session.accessToken, session.user.login);
    session.user = {
      ...session.user,
      ...activity.user
    };
    await writeSessionStore();

    res.json({
      ok: true,
      ...activity
    });
  } catch (error) {
    res.status(error.status || 502).json({
      ok: false,
      error: error.publicMessage || error.message || 'Не удалось загрузить активность GitHub'
    });
  }
});

app.get('/api/profile/state', async (req, res) => {
  try {
    const session = requireAllowedProfileSession(req, res);
    if (!session) return;

    const state = await readProfileState(session.user.login);
    res.json({ ok: true, state });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message || 'Не удалось загрузить профильную историю'
    });
  }
});

app.put('/api/profile/state', async (req, res) => {
  try {
    const session = requireAllowedProfileSession(req, res);
    if (!session) return;

    const state = normalizeProfileState(req.body?.state || req.body || {});
    await writeProfileState(session.user.login, state);
    res.json({ ok: true, state });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message || 'Не удалось сохранить профильную историю'
    });
  }
});

app.post('/api/analyze', async (req, res) => {
  try {
    const repoInput = String(req.body?.repoUrl || '').trim();
    const parsedRepo = parseGitHubRepo(repoInput);
    const session = readSession(req);

    if (!canUsePrivateAnalyzer(session)) {
      return res.status(403).json({
        ok: false,
        error: 'Анализ репозиториев разрешён только GitHub пользователю Zulut30. Войдите через нужный аккаунт.'
      });
    }

    if (!parsedRepo) {
      return res.status(400).json({
        ok: false,
        error: 'Введите ссылку на GitHub репозиторий, например https://github.com/vercel/next.js'
      });
    }

    const repository = await loadRepositoryContext(parsedRepo.owner, parsedRepo.repo, session?.accessToken || '');
    const prompt = buildAnalysisPrompt(repository);
    const tokenUsage = buildTokenUsageEstimate(repository, prompt);
    const aiResult = await callTimewebAgent(prompt);
    const parsedAnalysis = parseJsonFromModel(aiResult.text, { kind: 'analysis', context: repository });

    res.json({
      ok: true,
      provider: aiResult.provider,
      repo: repository.repo,
      languages: repository.languages,
      fileStats: repository.fileStats,
      tokenUsage: {
        provider: aiResult.provider,
        actual: aiResult.usage || null,
        estimated: tokenUsage
      },
      analysis: parsedAnalysis.data,
      rawAnalysis: aiResult.text
    });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({
      ok: false,
      error: error.publicMessage || error.message || 'Не удалось проанализировать репозиторий'
    });
  }
});

app.post('/api/share', async (req, res) => {
  try {
    const session = readSession(req);
    if (!canUsePrivateAnalyzer(session)) {
      return res.status(403).json({
        ok: false,
        error: 'Создавать публичные ссылки может только GitHub пользователь Zulut30.'
      });
    }

    const payload = normalizeSharePayload(req.body?.payload);
    if (!payload) {
      return res.status(400).json({ ok: false, error: 'Нет анализа для публикации' });
    }

    const id = await saveSharedAnalysis(payload);
    res.json({
      ok: true,
      id,
      url: `${getBaseUrl(req)}/share/${id}`
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message || 'Не удалось создать публичную ссылку'
    });
  }
});

app.get('/api/share/:id', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    const analysis = await readSharedAnalysis(id);
    if (!analysis) {
      return res.status(404).json({ ok: false, error: 'Общий анализ не найден или ссылка устарела' });
    }

    res.json({ ok: true, id, analysis });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message || 'Не удалось открыть общий анализ'
    });
  }
});

app.post('/api/compare', async (req, res) => {
  try {
    const session = readSession(req);
    if (!canUsePrivateAnalyzer(session)) {
      return res.status(403).json({
        ok: false,
        error: 'Сравнение репозиториев разрешено только GitHub пользователю Zulut30.'
      });
    }

    const firstRepo = parseGitHubRepo(String(req.body?.repoA || '').trim());
    const secondRepo = parseGitHubRepo(String(req.body?.repoB || '').trim());
    if (!firstRepo || !secondRepo) {
      return res.status(400).json({
        ok: false,
        error: 'Введите две ссылки на GitHub репозитории'
      });
    }

    const [firstContext, secondContext] = await Promise.all([
      loadRepositoryContext(firstRepo.owner, firstRepo.repo, session?.accessToken || ''),
      loadRepositoryContext(secondRepo.owner, secondRepo.repo, session?.accessToken || '')
    ]);
    const prompt = buildComparisonPrompt(firstContext, secondContext);
    const tokenUsage = {
      promptTokens: estimateTokens(prompt),
      completionBudgetTokens: MODEL_MAX_OUTPUT_TOKENS,
      totalBudgetTokens: estimateTokens(prompt) + MODEL_MAX_OUTPUT_TOKENS
    };
    const aiResult = await callTimewebAgent(prompt);
    const parsedComparison = parseJsonFromModel(aiResult.text, { kind: 'comparison' });

    res.json({
      ok: true,
      provider: aiResult.provider,
      repos: [firstContext.repo, secondContext.repo],
      tokenUsage: {
        provider: aiResult.provider,
        actual: aiResult.usage || null,
        estimated: tokenUsage
      },
      comparison: parsedComparison.data,
      rawComparison: aiResult.text
    });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({
      ok: false,
      error: error.publicMessage || error.message || 'Не удалось сравнить репозитории'
    });
  }
});

app.post('/api/tools/run', async (req, res) => {
  try {
    const session = requireAllowedProfileSession(req, res);
    if (!session) return;

    const check = await toolsService.runManualCheck(session.user.login, req.body?.url, req.body?.checks);
    res.json({ ok: true, check });
  } catch (error) {
    res.status(error.status || 500).json({
      ok: false,
      error: error.publicMessage || error.message || 'Не удалось выполнить проверку сайта'
    });
  }
});

app.get('/api/tools/history', async (req, res) => {
  try {
    const session = requireAllowedProfileSession(req, res);
    if (!session) return;

    const checks = await toolsService.getHistory(session.user.login);
    res.json({ ok: true, checks });
  } catch (error) {
    res.status(error.status || 500).json({
      ok: false,
      error: error.publicMessage || error.message || 'Не удалось загрузить историю инструментов'
    });
  }
});

app.get('/api/tools/monitors', async (req, res) => {
  try {
    const session = requireAllowedProfileSession(req, res);
    if (!session) return;

    const payload = await toolsService.getMonitors(session.user.login);
    res.json({ ok: true, ...payload });
  } catch (error) {
    res.status(error.status || 500).json({
      ok: false,
      error: error.publicMessage || error.message || 'Не удалось загрузить мониторы'
    });
  }
});

app.post('/api/tools/monitors', async (req, res) => {
  try {
    const session = requireAllowedProfileSession(req, res);
    if (!session) return;

    const monitor = await toolsService.createMonitor(session.user.login, req.body || {});
    res.json({ ok: true, monitor });
  } catch (error) {
    res.status(error.status || 500).json({
      ok: false,
      error: error.publicMessage || error.message || 'Не удалось создать монитор'
    });
  }
});

app.patch('/api/tools/monitors/:id', async (req, res) => {
  try {
    const session = requireAllowedProfileSession(req, res);
    if (!session) return;

    const monitor = await toolsService.updateMonitor(session.user.login, String(req.params.id || ''), req.body || {});
    res.json({ ok: true, monitor });
  } catch (error) {
    res.status(error.status || 500).json({
      ok: false,
      error: error.publicMessage || error.message || 'Не удалось обновить монитор'
    });
  }
});

app.delete('/api/tools/monitors/:id', async (req, res) => {
  try {
    const session = requireAllowedProfileSession(req, res);
    if (!session) return;

    const result = await toolsService.deleteMonitor(session.user.login, String(req.params.id || ''));
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(error.status || 500).json({
      ok: false,
      error: error.publicMessage || error.message || 'Не удалось удалить монитор'
    });
  }
});

app.post('/api/tools/monitors/:id/run', async (req, res) => {
  try {
    const session = requireAllowedProfileSession(req, res);
    if (!session) return;

    const result = await toolsService.runMonitor(session.user.login, String(req.params.id || ''));
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(error.status || 500).json({
      ok: false,
      error: error.publicMessage || error.message || 'Не удалось запустить монитор'
    });
  }
});

app.post('/api/export', async (req, res) => {
  try {
    const format = String(req.body?.format || '').toLowerCase();
    const payload = req.body?.payload || {};
    const normalized = normalizeExportPayload(payload);
    const baseName = safeFileBase(normalized.repo.fullName || normalized.analysis.title || 'repo-analysis');

    if (!['txt', 'md', 'pdf', 'docx'].includes(format)) {
      return res.status(400).json({ ok: false, error: 'Неподдерживаемый формат экспорта' });
    }

    if (format === 'txt') {
      const content = analysisToPlainText(normalized);
      return sendBuffer(res, Buffer.from(content, 'utf8'), `${baseName}.txt`, 'text/plain; charset=utf-8');
    }

    if (format === 'md') {
      const content = analysisToMarkdown(normalized);
      return sendBuffer(res, Buffer.from(content, 'utf8'), `${baseName}.md`, 'text/markdown; charset=utf-8');
    }

    if (format === 'pdf') {
      const pdf = await analysisToPdf(normalized);
      return sendBuffer(res, pdf, `${baseName}.pdf`, 'application/pdf');
    }

    const docx = await analysisToDocx(normalized);
    return sendBuffer(
      res,
      docx,
      `${baseName}.docx`,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message || 'Не удалось подготовить файл'
    });
  }
});

app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  toolsService.startScheduler();
  console.log(`GitHub analyzer is running on http://0.0.0.0:${PORT}`);
});

function parseCookies(req) {
  return String(req.headers.cookie || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const index = part.indexOf('=');
      if (index === -1) return cookies;
      const key = safeDecodeURIComponent(part.slice(0, index));
      const value = safeDecodeURIComponent(part.slice(index + 1));
      cookies[key] = value;
      return cookies;
    }, {});
}

function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return String(value || '');
  }
}

function loadSessionStore() {
  try {
    const raw = fs.readFileSync(SESSION_FILE, 'utf8');
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, ''));
    const entries = parsed && typeof parsed === 'object' ? Object.entries(parsed.sessions || parsed) : [];
    const now = Date.now();
    const store = new Map();

    for (const [sid, session] of entries) {
      const normalized = normalizeStoredSession(session);
      if (!sid || !normalized) continue;
      if (now - normalized.createdAt > SESSION_MAX_AGE_MS) continue;
      store.set(sid, normalized);
    }

    return store;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn('Could not load persisted sessions:', error.message);
    }
    return new Map();
  }
}

function normalizeStoredSession(session) {
  if (!session || typeof session !== 'object') return null;
  const createdAt = Number(session.createdAt || 0);
  const login = String(session.user?.login || '').trim();
  const accessToken = String(session.accessToken || '');

  if (!Number.isFinite(createdAt) || createdAt <= 0 || !login || !accessToken) return null;

  return {
    createdAt,
    accessToken,
    tokenScope: String(session.tokenScope || ''),
    user: {
      login,
      name: String(session.user?.name || ''),
      avatarUrl: String(session.user?.avatarUrl || ''),
      profileUrl: String(session.user?.profileUrl || ''),
      bio: String(session.user?.bio || ''),
      company: String(session.user?.company || ''),
      location: String(session.user?.location || ''),
      blog: String(session.user?.blog || ''),
      publicRepos: Number(session.user?.publicRepos || 0),
      followers: Number(session.user?.followers || 0),
      following: Number(session.user?.following || 0),
      createdAt: String(session.user?.createdAt || '')
    }
  };
}

async function writeSessionStore() {
  await fs.promises.mkdir(DATA_DIR, { recursive: true });
  const payload = {
    updatedAt: new Date().toISOString(),
    sessions: Object.fromEntries(sessions)
  };
  const tempFile = `${SESSION_FILE}.tmp`;
  await fs.promises.writeFile(tempFile, `${JSON.stringify(payload, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  await fs.promises.rename(tempFile, SESSION_FILE);
}

function signValue(value) {
  const raw = String(value || '');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(raw).digest('base64url');
  return `${raw}.${signature}`;
}

function verifySignedValue(signed) {
  const value = String(signed || '');
  const separator = value.lastIndexOf('.');
  if (separator <= 0) return '';

  const raw = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(raw).digest('base64url');
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (actualBuffer.length !== expectedBuffer.length) return '';
  return crypto.timingSafeEqual(actualBuffer, expectedBuffer) ? raw : '';
}

function readSession(req) {
  const sid = verifySignedValue(parseCookies(req).repo_scope_session || '');
  if (!sid) return null;

  const session = sessions.get(sid);
  if (!session) return null;

  if (Date.now() - session.createdAt > SESSION_MAX_AGE_MS) {
    sessions.delete(sid);
    writeSessionStore().catch(() => {});
    return null;
  }

  return session;
}

function canUsePrivateAnalyzer(session) {
  const login = String(session?.user?.login || '').toLowerCase();
  return Boolean(login && login === ALLOWED_GITHUB_LOGIN);
}

function requireAllowedProfileSession(req, res) {
  const session = readSession(req);
  if (!session?.user || !session.accessToken) {
    res.status(401).json({
      ok: false,
      error: 'Нужно войти через GitHub, чтобы загрузить профильные данные.',
      reauthRequired: true
    });
    return null;
  }

  if (!canUsePrivateAnalyzer(session)) {
    res.status(403).json({
      ok: false,
      error: 'Доступ к истории и избранному разрешён только GitHub пользователю Zulut30.',
      forbidden: true
    });
    return null;
  }

  return session;
}

async function readProfileState(login) {
  const store = await readUserStateStore();
  return normalizeProfileState(store[profileStateKey(login)] || {});
}

async function writeProfileState(login, state) {
  const store = await readUserStateStore();
  const normalized = normalizeProfileState(state);
  store[profileStateKey(login)] = normalized;
  await writeUserStateStore(store);
  return normalized;
}

async function saveSharedAnalysis(payload) {
  const store = await readSharedAnalysisStore();
  const id = crypto.randomBytes(9).toString('base64url');
  store[id] = {
    createdAt: new Date().toISOString(),
    analysis: payload
  };

  const entries = Object.entries(store)
    .sort((a, b) => new Date(b[1]?.createdAt || 0) - new Date(a[1]?.createdAt || 0))
    .slice(0, 200);
  await writeSharedAnalysisStore(Object.fromEntries(entries));
  return id;
}

async function readSharedAnalysis(id) {
  if (!/^[a-zA-Z0-9_-]{8,32}$/.test(id)) return null;
  const store = await readSharedAnalysisStore();
  return store[id]?.analysis || null;
}

async function readSharedAnalysisStore() {
  try {
    const raw = await fs.promises.readFile(SHARED_ANALYSES_FILE, 'utf8');
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, ''));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

async function writeSharedAnalysisStore(store) {
  await fs.promises.mkdir(DATA_DIR, { recursive: true });
  const tempFile = `${SHARED_ANALYSES_FILE}.tmp`;
  await fs.promises.writeFile(tempFile, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
  await fs.promises.rename(tempFile, SHARED_ANALYSES_FILE);
}

function normalizeSharePayload(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const repo = payload.repo || {};
  const analysis = payload.analysis || {};
  if (!repo.url && !repo.fullName && !analysis.shortSummary) return null;

  return compactSharedPayload({
    provider: typeof payload.provider === 'string' ? payload.provider : '',
    repo,
    languages: Array.isArray(payload.languages) ? payload.languages.slice(0, 12) : [],
    fileStats: payload.fileStats || {},
    tokenUsage: payload.tokenUsage || null,
    analysis
  });
}

async function readUserStateStore() {
  try {
    const raw = await fs.promises.readFile(USER_STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

async function writeUserStateStore(store) {
  await fs.promises.mkdir(DATA_DIR, { recursive: true });
  const tempFile = `${USER_STATE_FILE}.tmp`;
  await fs.promises.writeFile(tempFile, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
  await fs.promises.rename(tempFile, USER_STATE_FILE);
}

function normalizeProfileState(value) {
  return {
    history: normalizeStoredItems(value?.history, 80),
    favorites: normalizeStoredItems(value?.favorites, 80),
    updatedAt: new Date().toISOString()
  };
}

function normalizeStoredItems(value, maxItems) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === 'object').slice(0, maxItems);
}

function profileStateKey(login) {
  return String(login || '').trim().toLowerCase();
}

function setSessionCookie(res, req, sid) {
  setSignedCookie(res, 'repo_scope_session', sid, {
    maxAge: 60 * 60 * 24 * 14,
    sameSite: 'Lax',
    httpOnly: true,
    secure: isSecureRequest(req)
  });
}

function clearSessionCookie(res, req) {
  clearCookie(res, 'repo_scope_session', { secure: isSecureRequest(req) });
}

function setSignedCookie(res, name, value, options = {}) {
  const signed = signValue(value);
  const attributes = [
    `${encodeURIComponent(name)}=${encodeURIComponent(signed)}`,
    'Path=/',
    'HttpOnly',
    `SameSite=${options.sameSite || 'Lax'}`
  ];

  if (options.maxAge) attributes.push(`Max-Age=${options.maxAge}`);
  if (options.secure) attributes.push('Secure');

  res.append('Set-Cookie', attributes.join('; '));
}

function clearCookie(res, name, options = {}) {
  const attributes = [
    `${encodeURIComponent(name)}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0'
  ];

  if (options.secure) attributes.push('Secure');
  res.append('Set-Cookie', attributes.join('; '));
}

function isSecureRequest(req) {
  const explicit = process.env.APP_BASE_URL || process.env.PUBLIC_BASE_URL;
  if (explicit && /^https:\/\//i.test(explicit)) return true;

  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const forwardedSsl = String(req.headers['x-forwarded-ssl'] || '').toLowerCase();
  const urlScheme = String(req.headers['x-url-scheme'] || '').toLowerCase();
  const cfVisitor = String(req.headers['cf-visitor'] || '');

  return (
    req.secure ||
    forwardedProto === 'https' ||
    forwardedSsl === 'on' ||
    urlScheme === 'https' ||
    cfVisitor.includes('"scheme":"https"')
  );
}

function getBaseUrl(req) {
  const explicit = process.env.APP_BASE_URL || process.env.PUBLIC_BASE_URL;
  if (explicit) return stripTrailingSlash(explicit);

  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim();
  const host = req.get('host');
  return `${proto}://${host}`;
}

function pruneSessions() {
  const now = Date.now();
  let changed = false;
  for (const [sid, session] of sessions.entries()) {
    if (now - session.createdAt > SESSION_MAX_AGE_MS) {
      sessions.delete(sid);
      changed = true;
    }
  }
  if (changed) writeSessionStore().catch(() => {});
}

function sendBuffer(res, buffer, fileName, contentType) {
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Length', buffer.length);
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(buffer);
}

function normalizeExportPayload(payload) {
  return {
    repo: payload.repo || {},
    languages: Array.isArray(payload.languages) ? payload.languages : [],
    fileStats: payload.fileStats || {},
    analysis: payload.analysis || {}
  };
}

function analysisToPlainText(payload) {
  return markdownToText(analysisToMarkdown(payload));
}

function analysisToMarkdown(payload) {
  const { repo, analysis, languages, fileStats } = payload;
  const score = normalizeScoreForExport(analysis.score);
  const projectType = formatProjectTypeForExport(analysis.projectType);
  const title = cleanText(analysis.title || repo.fullName || 'Анализ репозитория');
  const lines = [];

  lines.push(`# ${title}`);
  if (repo.url) lines.push('', `Репозиторий: ${repo.url}`);
  if (analysis.shortSummary) lines.push('', cleanText(analysis.shortSummary));

  lines.push('', '## Оценка');
  lines.push(`${score.value}/10${score.reason ? ` - ${cleanText(score.reason)}` : ''}`);
  if (projectType) lines.push('', '## Тип проекта', projectType);

  addSection(lines, 'Суть репозитория', [analysis.purpose, analysis.essence]);
  addSection(lines, 'Следующие шаги', normalizeArrayForExport(analysis.nextSteps), true);
  addSection(lines, 'Слабые места', normalizeArrayForExport(analysis.weaknesses), true);
  addSection(lines, 'Языки', formatLanguageLines(analysis.languages, languages), true);
  addSection(lines, 'Библиотеки', formatLibraryLines(analysis.libraries), true);
  addSection(lines, 'Архитектура', normalizeArrayForExport(analysis.architecture), true);
  addSection(lines, 'Как запустить', normalizeArrayForExport(analysis.howToRun), true);
  addSection(lines, 'Ключевые файлы', formatKeyFileLines(analysis.keyFiles), true);
  addSection(lines, 'Для кого полезен', normalizeArrayForExport(analysis.audience), true);
  addSection(lines, 'Сигналы качества', normalizeArrayForExport(analysis.qualitySignals), true);
  addSection(lines, 'Подробный итог', [analysis.detailedConclusion || analysis.finalTakeaway]);
  addSection(lines, 'Вопросы и ограничения анализа', normalizeArrayForExport(analysis.questions), true);

  lines.push('', '## Метаданные');
  lines.push(`- Stars: ${repo.stars ?? 0}`);
  lines.push(`- Forks: ${repo.forks ?? 0}`);
  lines.push(`- Issues: ${repo.openIssues ?? 0}`);
  lines.push(`- Основной язык: ${repo.primaryLanguage || 'не указан'}`);
  lines.push(`- Лицензия: ${repo.license || 'не указана'}`);
  lines.push(`- Файлов в дереве: ${fileStats.totalFiles ?? 0}`);

  lines.push('', '## Профессиональный промпт для LLM');
  lines.push('```text');
  lines.push(buildFixPrompt(payload));
  lines.push('```');

  return `${lines.join('\n')}\n`;
}

function addSection(lines, title, values, asList = false) {
  const items = normalizeArrayForExport(values).map(cleanText).filter(Boolean);
  if (!items.length) return;

  lines.push('', `## ${title}`);
  if (asList) {
    for (const item of items) lines.push(`- ${item}`);
  } else {
    lines.push(items.join('\n\n'));
  }
}

function formatLanguageLines(aiLanguages, githubLanguages) {
  const source = normalizeArrayForExport(aiLanguages).length ? aiLanguages : githubLanguages;
  return normalizeArrayForExport(source).map((item) => {
    const percent = item.percent || item.percent === 0 ? ` (${item.percent}%)` : '';
    const role = item.role ? ` - ${item.role}` : '';
    return `${item.name || 'Unknown'}${percent}${role}`;
  });
}

function formatLibraryLines(libraries) {
  return normalizeArrayForExport(libraries).map((item) => {
    const name = [item.name, item.ecosystem].filter(Boolean).join(' / ') || 'Библиотека';
    return `${name}${item.purpose ? ` - ${item.purpose}` : ''}`;
  });
}

function formatKeyFileLines(files) {
  return normalizeArrayForExport(files).map((item) => {
    return `${item.path || 'файл'}${item.reason ? ` - ${item.reason}` : ''}`;
  });
}

function buildFixPrompt(payload) {
  const { repo, analysis, languages } = payload;
  const score = normalizeScoreForExport(analysis.score);
  const projectType = formatProjectTypeForExport(analysis.projectType);
  const weaknesses = normalizeArrayForExport(analysis.weaknesses);
  const nextSteps = normalizeArrayForExport(analysis.nextSteps);
  const qualitySignals = normalizeArrayForExport(analysis.qualitySignals);
  const architecture = normalizeArrayForExport(analysis.architecture);
  const runSteps = normalizeArrayForExport(analysis.howToRun);

  return [
    'Ты senior software engineer и code reviewer. Помоги профессионально улучшить GitHub репозиторий по анализу ниже.',
    '',
    `Репозиторий: ${repo.fullName || repo.url || 'не указан'}`,
    repo.url ? `URL: ${repo.url}` : '',
    `Краткая суть: ${analysis.shortSummary || analysis.purpose || 'не указана'}`,
    projectType ? `Тип проекта: ${projectType}` : '',
    `Текущая оценка: ${score.value}/10${score.reason ? ` - ${score.reason}` : ''}`,
    `Основные языки: ${formatLanguageLines(analysis.languages, languages).join('; ') || repo.primaryLanguage || 'не указаны'}`,
    nextSteps.length ? `AI-рекомендации следующего шага: ${nextSteps.join('; ')}` : '',
    '',
    'Слабые места / ошибки, которые нужно исправить:',
    ...(weaknesses.length ? weaknesses.map((item, index) => `${index + 1}. ${item}`) : ['1. Слабые места не указаны. Сначала проведи аудит README, тестов, CI, зависимостей и структуры.']),
    '',
    'Архитектура и контекст:',
    ...(architecture.length ? architecture.map((item) => `- ${item}`) : ['- Архитектура не определена из доступных файлов.']),
    '',
    'Сигналы качества:',
    ...(qualitySignals.length ? qualitySignals.map((item) => `- ${item}`) : ['- Не указаны.']),
    '',
    'Как запускать проект, если это видно:',
    ...(runSteps.length ? runSteps.map((item) => `- ${item}`) : ['- Команды запуска не определены. Не выдумывай их, сначала проверь манифесты.']),
    '',
    'Задача:',
    '1. Проведи аудит репозитория и подтверди каждую проблему фактами из кода, README, CI или манифестов.',
    '2. Предложи план исправления с приоритетами P0/P1/P2.',
    '3. Внеси минимальные безопасные изменения, не ломая публичный API и существующее поведение.',
    '4. Добавь или обнови тесты для измененного поведения.',
    '5. Обнови документацию запуска, если она неполная или устаревшая.',
    '6. В конце дай краткий changelog, список проверок и остаточные риски.',
    '',
    'Ограничения:',
    '- Не выдумывай зависимости, команды, файлы и архитектуру.',
    '- Не делай крупный рефакторинг без необходимости.',
    '- Если информации не хватает, явно напиши, какие файлы нужно открыть.'
  ].filter(Boolean).join('\n');
}

function markdownToText(markdown) {
  return String(markdown)
    .replace(/```text\n?/g, '')
    .replace(/```/g, '')
    .replace(/^#\s+/gm, '')
    .replace(/^##\s+/gm, '\n')
    .replace(/^- /gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim() + '\n';
}

async function analysisToPdf(payload) {
  const pdfFont = findReadableFont();
  const doc = new PDFDocument({ margin: 46, size: 'A4', bufferPages: true });
  const chunks = [];

  return new Promise((resolve, reject) => {
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    if (pdfFont) doc.font(pdfFont);

    const markdown = analysisToMarkdown(payload);
    const lines = markdown.split('\n');
    for (const line of lines) {
      if (line.startsWith('# ')) {
        doc.moveDown(0.6).fontSize(20).fillColor('#10201f').text(line.slice(2), { lineGap: 3 });
        if (pdfFont) doc.font(pdfFont);
      } else if (line.startsWith('## ')) {
        doc.moveDown(0.8).fontSize(14).fillColor('#0c8f83').text(line.slice(3), { lineGap: 2 });
        if (pdfFont) doc.font(pdfFont);
      } else if (line.startsWith('- ')) {
        doc.fontSize(10.5).fillColor('#263938').text(`• ${line.slice(2)}`, {
          indent: 12,
          lineGap: 2
        });
      } else if (line === '```text' || line === '```') {
        doc.moveDown(0.2);
      } else if (line.trim()) {
        doc.fontSize(10.5).fillColor('#263938').text(line, { lineGap: 2 });
      } else {
        doc.moveDown(0.35);
      }
    }

    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i += 1) {
      doc.switchToPage(i);
      doc.fontSize(8).fillColor('#7a8c8a').text(`RepoScope • ${i + 1}`, 46, 810, {
        align: 'right',
        width: 500
      });
    }

    doc.end();
  });
}

async function analysisToDocx(payload) {
  const paragraphs = [];
  const markdown = analysisToMarkdown(payload);

  for (const line of markdown.split('\n')) {
    if (line.startsWith('# ')) {
      paragraphs.push(new Paragraph({ text: line.slice(2), heading: HeadingLevel.TITLE }));
    } else if (line.startsWith('## ')) {
      paragraphs.push(new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_1 }));
    } else if (line.startsWith('- ')) {
      paragraphs.push(new Paragraph({ text: line.slice(2), bullet: { level: 0 } }));
    } else if (line === '```text' || line === '```') {
      paragraphs.push(new Paragraph({ text: '' }));
    } else if (line.trim()) {
      paragraphs.push(new Paragraph({ children: [new TextRun(line)] }));
    } else {
      paragraphs.push(new Paragraph({ text: '' }));
    }
  }

  const document = new Document({
    creator: 'RepoScope',
    title: payload.analysis.title || payload.repo.fullName || 'Анализ репозитория',
    sections: [{ children: paragraphs }]
  });

  return Packer.toBuffer(document);
}

function findReadableFont() {
  const candidates = [
    'C:\\Windows\\Fonts\\arial.ttf',
    'C:\\Windows\\Fonts\\segoeui.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf',
    '/usr/share/fonts/truetype/freefont/FreeSans.ttf'
  ];

  return candidates.find((fontPath) => fs.existsSync(fontPath));
}

function normalizeArrayForExport(value) {
  if (Array.isArray(value)) return value.filter((item) => item !== null && item !== undefined);
  if (value) return [value];
  return [];
}

function normalizeScoreForExport(score) {
  if (typeof score === 'number') return { value: Math.max(0, Math.min(10, Math.round(score))), reason: '' };
  return {
    value: Math.max(0, Math.min(10, Math.round(Number(score?.value || 0)))),
    reason: cleanText(score?.reason || score?.label || '')
  };
}

function formatProjectTypeForExport(projectType) {
  if (!projectType) return '';
  if (typeof projectType === 'string') return cleanText(projectType);
  if (typeof projectType !== 'object') return '';

  const label = cleanText(projectType.label || projectType.type || '');
  const reason = cleanText(projectType.reason || projectType.description || '');
  return [label, reason].filter(Boolean).join(' - ');
}

function compactSharedPayload(value, depth = 0) {
  if (depth > 6) return null;
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') {
    return value.length > 12000 ? `${value.slice(0, 12000)}\n[truncated]` : value;
  }

  if (typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    return value.slice(0, 80).map((item) => compactSharedPayload(item, depth + 1));
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== 'rawAnalysis' && key !== 'rawComparison')
      .map(([key, item]) => [key, compactSharedPayload(item, depth + 1)])
  );
}

function cleanText(value) {
  return String(value ?? '')
    .replace(/\r/g, '')
    .replace(/\u0000/g, '')
    .trim();
}

function safeFileBase(value) {
  const cleaned = String(value || 'repo-analysis')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

  return cleaned || 'repo-analysis';
}

function stripTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

async function loadProfileRepositories(accessToken) {
  const repositories = [];

  for (let page = 1; page <= 4; page += 1) {
    const url = new URL('https://api.github.com/user/repos');
    url.searchParams.set('per_page', '100');
    url.searchParams.set('page', String(page));
    url.searchParams.set('sort', 'updated');
    url.searchParams.set('direction', 'desc');
    url.searchParams.set('affiliation', 'owner,collaborator,organization_member');

    const batch = await githubJson(url.toString(), accessToken);
    if (!Array.isArray(batch) || !batch.length) break;

    repositories.push(...batch.map(normalizeProfileRepository));
    if (batch.length < 100) break;
  }

  return repositories;
}

function normalizeProfileRepository(repo) {
  return {
    id: repo.id,
    name: repo.name || '',
    fullName: repo.full_name || '',
    owner: repo.owner?.login || '',
    url: repo.html_url || '',
    description: repo.description || '',
    private: Boolean(repo.private),
    fork: Boolean(repo.fork),
    archived: Boolean(repo.archived),
    primaryLanguage: repo.language || '',
    stars: repo.stargazers_count || 0,
    forks: repo.forks_count || 0,
    openIssues: repo.open_issues_count || 0,
    defaultBranch: repo.default_branch || '',
    updatedAt: repo.updated_at || ''
  };
}

async function loadProfileActivity(accessToken, login) {
  const safeLogin = encodeURIComponent(String(login || '').trim());
  const [user, eventsResult] = await Promise.all([
    githubJson('https://api.github.com/user', accessToken),
    safeLogin
      ? githubJson(`https://api.github.com/users/${safeLogin}/events?per_page=30`, accessToken).catch(() => [])
      : Promise.resolve([])
  ]);
  const events = Array.isArray(eventsResult) ? eventsResult.map(normalizeGitHubEvent).filter(Boolean) : [];

  return {
    user: normalizeGitHubProfile(user),
    events,
    summary: summarizeGitHubEvents(events)
  };
}

function normalizeGitHubProfile(user) {
  return {
    login: user.login || '',
    name: user.name || '',
    avatarUrl: user.avatar_url || '',
    profileUrl: user.html_url || '',
    bio: user.bio || '',
    company: user.company || '',
    location: user.location || '',
    blog: user.blog || '',
    publicRepos: user.public_repos || 0,
    followers: user.followers || 0,
    following: user.following || 0,
    createdAt: user.created_at || ''
  };
}

function normalizeGitHubEvent(event) {
  if (!event || typeof event !== 'object') return null;

  const repoName = event.repo?.name || '';
  const payload = event.payload || {};
  const base = {
    id: String(event.id || crypto.randomUUID()),
    type: event.type || 'Event',
    repoName,
    repoUrl: repoName ? `https://github.com/${repoName}` : '',
    createdAt: event.created_at || '',
    action: payload.action || '',
    title: repoName || 'GitHub',
    detail: '',
    url: repoName ? `https://github.com/${repoName}` : ''
  };

  if (event.type === 'PushEvent') {
    const commits = Array.isArray(payload.commits) ? payload.commits : [];
    const branch = String(payload.ref || '').replace('refs/heads/', '');
    return {
      ...base,
      action: 'push',
      title: `Пуш в ${repoName || 'репозиторий'}`,
      detail: `${commits.length || payload.size || 0} commit${commits.length === 1 ? '' : 's'}${branch ? ` в ${branch}` : ''}`,
      branch,
      commitCount: commits.length || payload.size || 0
    };
  }

  if (event.type === 'PullRequestEvent') {
    const pullRequest = payload.pull_request || {};
    return {
      ...base,
      action: payload.action || 'pull_request',
      title: `Pull request: ${pullRequest.title || repoName || 'GitHub'}`,
      detail: payload.action ? `Действие: ${payload.action}` : 'Работа с pull request',
      url: pullRequest.html_url || base.url
    };
  }

  if (event.type === 'IssuesEvent') {
    const issue = payload.issue || {};
    return {
      ...base,
      action: payload.action || 'issue',
      title: `Issue: ${issue.title || repoName || 'GitHub'}`,
      detail: payload.action ? `Действие: ${payload.action}` : 'Работа с issue',
      url: issue.html_url || base.url
    };
  }

  if (event.type === 'IssueCommentEvent') {
    const issue = payload.issue || {};
    return {
      ...base,
      action: payload.action || 'comment',
      title: `Комментарий: ${issue.title || repoName || 'GitHub'}`,
      detail: 'Обсуждение в issue или pull request',
      url: payload.comment?.html_url || issue.html_url || base.url
    };
  }

  if (event.type === 'CreateEvent') {
    const ref = [payload.ref_type, payload.ref].filter(Boolean).join(' ');
    return {
      ...base,
      action: 'create',
      title: `Создано в ${repoName || 'GitHub'}`,
      detail: ref || 'Создан новый объект'
    };
  }

  if (event.type === 'ForkEvent') {
    return {
      ...base,
      action: 'fork',
      title: `Fork ${repoName || 'репозитория'}`,
      detail: payload.forkee?.full_name ? `Новый fork: ${payload.forkee.full_name}` : 'Создан fork',
      url: payload.forkee?.html_url || base.url
    };
  }

  if (event.type === 'WatchEvent') {
    return {
      ...base,
      action: 'star',
      title: `Star ${repoName || 'репозитория'}`,
      detail: 'Репозиторий добавлен в избранные на GitHub'
    };
  }

  return {
    ...base,
    title: event.type ? event.type.replace(/Event$/, '') : base.title,
    detail: payload.action ? `Действие: ${payload.action}` : 'Событие GitHub'
  };
}

function summarizeGitHubEvents(events) {
  const byType = {};
  let commits = 0;
  const repos = new Set();

  for (const event of events) {
    const type = event.type || 'Event';
    byType[type] = (byType[type] || 0) + 1;
    if (event.repoName) repos.add(event.repoName);
    commits += Number(event.commitCount || 0);
  }

  return {
    total: events.length,
    commits,
    repositoriesTouched: repos.size,
    byType
  };
}

function parseGitHubRepo(input) {
  if (!input) return null;

  const shorthand = input.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/);
  if (shorthand) {
    return { owner: shorthand[1], repo: shorthand[2].replace(/\.git$/, '') };
  }

  try {
    const url = new URL(input);
    if (!/github\.com$/i.test(url.hostname)) return null;
    const [owner, repoPart] = url.pathname.split('/').filter(Boolean);
    if (!owner || !repoPart) return null;
    const repo = repoPart.replace(/\.git$/, '');
    if (!isSafeGitHubPart(owner) || !isSafeGitHubPart(repo)) return null;
    return { owner, repo };
  } catch {
    return null;
  }
}

function isSafeGitHubPart(value) {
  return /^[A-Za-z0-9_.-]+$/.test(value);
}

async function loadRepositoryContext(owner, repoName, accessToken = '') {
  const repoUrl = `https://api.github.com/repos/${owner}/${repoName}`;
  const repo = await githubJson(repoUrl, accessToken);
  const branch = repo.default_branch || 'main';

  const [languages, treeResult] = await Promise.all([
    githubJson(repo.languages_url, accessToken).catch(() => ({})),
    githubJson(
      `https://api.github.com/repos/${owner}/${repoName}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
      accessToken
    ).catch(() => null)
  ]);

  const tree = Array.isArray(treeResult?.tree) ? treeResult.tree : [];
  const filePaths = tree
    .filter((item) => item.type === 'blob')
    .map((item) => ({ path: item.path, size: item.size || 0 }))
    .sort((a, b) => a.path.localeCompare(b.path));

  const selectedFiles = selectImportantFiles(filePaths);
  const fileContents = await fetchImportantFiles(owner, repoName, branch, selectedFiles, accessToken);

  return {
    repo: {
      owner,
      name: repo.name,
      fullName: repo.full_name,
      url: repo.html_url,
      description: repo.description || '',
      homepage: repo.homepage || '',
      defaultBranch: branch,
      primaryLanguage: repo.language || '',
      stars: repo.stargazers_count || 0,
      forks: repo.forks_count || 0,
      openIssues: repo.open_issues_count || 0,
      license: repo.license?.spdx_id || repo.license?.name || '',
      topics: repo.topics || [],
      updatedAt: repo.updated_at,
      sizeKb: repo.size || 0
    },
    languages: formatLanguages(languages),
    fileStats: summarizeFiles(filePaths, treeResult?.truncated),
    filePaths: filePaths.slice(0, AI_MAX_LISTED_FILES).map((file) => file.path),
    fileContents
  };
}

async function githubJson(url, accessToken = '') {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'repo-analyzer-timeweb'
  };

  const token = accessToken || GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(20000)
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    const error = new Error(`GitHub API returned ${response.status}`);
    error.status = response.status === 404 ? 404 : 502;
    error.publicMessage =
      response.status === 404
        ? 'Репозиторий не найден или он приватный'
        : `GitHub API вернул ошибку ${response.status}. ${details.slice(0, 180)}`;
    throw error;
  }

  return response.json();
}

function selectImportantFiles(files) {
  const byLowerPath = new Map(files.map((file) => [file.path.toLowerCase(), file]));
  const picks = [];
  const exactNames = [
    'readme.md',
    'readme.ru.md',
    'package.json',
    'requirements.txt',
    'pyproject.toml',
    'pipfile',
    'setup.py',
    'go.mod',
    'cargo.toml',
    'gemfile',
    'composer.json',
    'pom.xml',
    'build.gradle',
    'build.gradle.kts',
    'dockerfile',
    'docker-compose.yml',
    'compose.yml',
    'tsconfig.json',
    'vite.config.js',
    'vite.config.ts',
    'next.config.js',
    'next.config.mjs',
    'nuxt.config.ts',
    'astro.config.mjs'
  ];

  for (const name of exactNames) {
    const found = byLowerPath.get(name);
    if (found) picks.push(found);
  }

  const additionalPatterns = [
    /^\.github\/workflows\/[^/]+\.ya?ml$/i,
    /^src\/main\.[tj]sx?$/i,
    /^app\/page\.[tj]sx?$/i,
    /^pages\/index\.[tj]sx?$/i,
    /^server\.[cm]?[jt]s$/i,
    /^index\.[cm]?[jt]s$/i,
    /^main\.py$/i,
    /^app\.py$/i,
    /^manage\.py$/i,
    /^cmd\/[^/]+\/main\.go$/i
  ];

  for (const pattern of additionalPatterns) {
    const found = files.find((file) => pattern.test(file.path));
    if (found) picks.push(found);
  }

  const unique = Array.from(new Map(picks.map((file) => [file.path, file])).values());
  return unique.filter((file) => file.size <= 220000).slice(0, AI_MAX_SELECTED_FILES);
}

async function fetchImportantFiles(owner, repoName, branch, files, accessToken = '') {
  const results = [];
  const totalLimit = AI_CONTEXT_CHAR_LIMIT;
  let totalChars = 0;

  for (const file of files) {
    if (totalChars >= totalLimit) break;

    try {
      const encodedPath = file.path.split('/').map(encodeURIComponent).join('/');
      const url = `https://api.github.com/repos/${owner}/${repoName}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`;
      const payload = await githubJson(url, accessToken);
      if (payload.type !== 'file' || !payload.content) continue;

      let text = Buffer.from(payload.content, payload.encoding || 'base64').toString('utf8');
      const lowerPath = file.path.toLowerCase();
      const remainingChars = totalLimit - totalChars;
      const maxForFile = Math.min(remainingChars, lowerPath.includes('lock') ? 1800 : AI_MAX_FILE_CHARS);
      if (maxForFile <= 0) break;
      if (text.length > maxForFile) {
        text = `${text.slice(0, maxForFile)}\n\n[truncated: ${text.length - maxForFile} chars omitted]`;
      }

      totalChars += text.length;
      results.push({ path: file.path, size: file.size, content: text });
    } catch {
      results.push({ path: file.path, size: file.size, content: '[failed to fetch file content]' });
    }
  }

  return results;
}

function formatLanguages(languages) {
  const entries = Object.entries(languages || {});
  const total = entries.reduce((sum, [, bytes]) => sum + Number(bytes || 0), 0);

  return entries
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .map(([name, bytes]) => ({
      name,
      bytes,
      percent: total ? Math.round((Number(bytes) / total) * 1000) / 10 : 0
    }));
}

function summarizeFiles(files, truncated) {
  const extensions = new Map();
  const topDirs = new Map();

  for (const file of files) {
    const extension = extensionOf(file.path);
    extensions.set(extension, (extensions.get(extension) || 0) + 1);

    const topDir = file.path.includes('/') ? file.path.split('/')[0] : '(root)';
    topDirs.set(topDir, (topDirs.get(topDir) || 0) + 1);
  }

  return {
    totalFiles: files.length,
    treeTruncated: Boolean(truncated),
    topExtensions: sortCountMap(extensions).slice(0, 12),
    topDirectories: sortCountMap(topDirs).slice(0, 12)
  };
}

function extensionOf(filePath) {
  const fileName = filePath.split('/').pop() || '';
  const index = fileName.lastIndexOf('.');
  if (index <= 0) return '(no extension)';
  return fileName.slice(index).toLowerCase();
}

function sortCountMap(map) {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, count }));
}

function buildAnalysisPrompt(context) {
  const files = context.fileContents
    .map((file) => {
      return `--- FILE: ${file.path} (${file.size} bytes) ---\n${file.content}`;
    })
    .join('\n\n');

  return `Проанализируй GitHub репозиторий по данным ниже и объясни его простым русским языком.

Верни строго JSON без markdown-блока и без текста вокруг:
{
  "title": "короткое имя/название проекта",
  "shortSummary": "1-2 предложения, зачем нужен репозиторий",
  "score": {"value": 0, "label": "оценка по 10-балльной шкале", "reason": "почему такая оценка"},
  "purpose": "какую проблему решает и для кого",
  "essence": "главная идея и что происходит внутри",
  "projectType": {"label": "SaaS/CLI/library/backend API/frontend app/bot/AI-agent/template/infra/tooling/etc", "reason": "почему выбран этот тип"},
  "languages": [{"name": "язык", "percent": 0, "role": "роль в проекте"}],
  "libraries": [{"name": "библиотека или фреймворк", "ecosystem": "npm/pip/go/etc", "purpose": "зачем используется"}],
  "weaknesses": ["слабое место, риск или ограничение проекта"],
  "nextSteps": ["что сделать первым", "что проверить перед деплоем", "какие файлы открыть в первую очередь"],
  "architecture": ["ключевая часть архитектуры или папка"],
  "howToRun": ["практический шаг запуска, если он виден из файлов"],
  "keyFiles": [{"path": "путь", "reason": "почему важен"}],
  "audience": ["кому полезен проект"],
  "qualitySignals": ["что говорит о зрелости/рисках проекта"],
  "detailedConclusion": "итог в 1-2 коротких абзаца: что это за проект, насколько он зрелый, стоит ли его использовать/изучать и с чего начать",
  "questions": ["что осталось неясным без глубокого чтения кода"],
  "finalTakeaway": "самая короткая суть репозитория"
}

Правила:
- Пиши только по фактам из контекста. Если факт не виден, так и напиши.
- Не выдумывай библиотеки, команды запуска или архитектуру.
- Если README нет или он неполный, опирайся на манифесты и дерево файлов.
- Оценка score.value должна быть числом от 1 до 10. Оцени понятность, полноту документации, структуру, признаки поддержки, тесты/CI и риски.
- В weaknesses пиши конкретные слабости. Если слабости не видны, напиши ограничения анализа: например мало файлов, нет README, не видны тесты.
- Объясняй для пользователя, который хочет быстро понять репозиторий перед чтением кода.
- Ответ должен быть компактным и обязательно завершаться закрывающей фигурной скобкой.
- Ограничь массивы: languages до 6, libraries до 8, architecture/howToRun/keyFiles/weaknesses/nextSteps до 6 элементов.
- Не пиши длинные абзацы внутри JSON: одно поле - максимум 2 коротких предложения.

Метаданные:
${JSON.stringify(context.repo, null, 2)}

Языки GitHub:
${JSON.stringify(context.languages, null, 2)}

Статистика файлов:
${JSON.stringify(context.fileStats, null, 2)}

Первые файлы дерева:
${context.filePaths.join('\n')}

Содержимое важных файлов:
${files || '[important files were not available]'}`;
}

function buildComparisonPrompt(firstContext, secondContext) {
  const first = compactContextForComparison(firstContext);
  const second = compactContextForComparison(secondContext);

  return `Сравни два GitHub репозитория на русском языке. Верни строго JSON без markdown-блока и без текста вокруг:
{
  "summary": "главный вывод сравнения в 2-3 предложениях",
  "dimensions": [
    {"name": "Назначение", "repoA": "чем отличается первый", "repoB": "чем отличается второй"},
    {"name": "Стек", "repoA": "стек первого", "repoB": "стек второго"},
    {"name": "Зрелость", "repoA": "сильные/слабые признаки первого", "repoB": "сильные/слабые признаки второго"},
    {"name": "Риски", "repoA": "риски первого", "repoB": "риски второго"}
  ],
  "sharedStrengths": ["что у них общего хорошего"],
  "tradeoffs": ["какие компромиссы при выборе"],
  "recommendation": {"choice": "какой выбрать и для какого случая", "reason": "почему"}
}

Правила:
- Пиши только по фактам из контекста.
- Если данных мало, прямо называй ограничение.
- Не выдумывай зависимости, команды и назначение.
- Сравнение должно помогать быстро решить, какой репозиторий смотреть первым.

Первый репозиторий:
${JSON.stringify(first, null, 2)}

Второй репозиторий:
${JSON.stringify(second, null, 2)}`;
}

function compactContextForComparison(context) {
  return {
    repo: context.repo,
    languages: context.languages,
    fileStats: context.fileStats,
    filePaths: context.filePaths.slice(0, 80),
    importantFiles: context.fileContents.slice(0, 7).map((file) => ({
      path: file.path,
      size: file.size,
      content: String(file.content || '').slice(0, 1800)
    }))
  };
}

function buildTokenUsageEstimate(context, prompt) {
  const fileContentCharacters = context.fileContents.reduce((sum, file) => {
    return sum + String(file.content || '').length;
  }, 0);
  const promptTokens = estimateTokens(prompt);

  return {
    promptTokens,
    completionBudgetTokens: MODEL_MAX_OUTPUT_TOKENS,
    totalBudgetTokens: promptTokens + MODEL_MAX_OUTPUT_TOKENS,
    promptCharacters: String(prompt || '').length,
    fileContentCharacters,
    selectedFiles: context.fileContents.length,
    listedFiles: context.filePaths.length
  };
}

function estimateTokens(value) {
  const text = String(value || '');
  if (!text) return 0;

  // Mixed Russian prose, JSON and code usually lands around 3-4 chars per token.
  return Math.ceil(text.length / 3.6);
}

function normalizeAiUsage(usage) {
  if (!usage || typeof usage !== 'object') return null;

  const normalized = {
    prompt_tokens: usage.prompt_tokens ?? usage.input_tokens ?? usage.promptTokens ?? usage.inputTokens ?? null,
    completion_tokens:
      usage.completion_tokens ?? usage.output_tokens ?? usage.completionTokens ?? usage.outputTokens ?? null,
    total_tokens: usage.total_tokens ?? usage.totalTokens ?? usage.total ?? null
  };

  return Object.values(normalized).some((value) => value !== null && value !== undefined) ? normalized : null;
}

async function callTimewebAgent(prompt) {
  const systemMessage =
    'Ты senior software analyst. Твоя задача - быстро и точно объяснять GitHub репозитории на русском языке, отделяя факты от предположений.';

  if (!TIMEWEB_API_TOKEN) {
    const error = new Error('Timeweb API token is missing');
    error.status = 500;
    error.publicMessage =
      'Timeweb требует Bearer-токен для вызова агента. Добавьте TIMEWEB_API_TOKEN на сервере и перезапустите приложение.';
    throw error;
  }

  try {
    const result = await callOpenAiCompatible(systemMessage, prompt);
    return { text: result.text, usage: result.usage, provider: 'timeweb-openai-compatible' };
  } catch (openAiError) {
    const result = await callNativeAgent(`${systemMessage}\n\n${prompt}`, openAiError);
    return { text: result.text, usage: result.usage, provider: 'timeweb-native-call' };
  }
}

async function callOpenAiCompatible(systemMessage, prompt) {
  const headers = { 'Content-Type': 'application/json', 'x-proxy-source': 'github-repo-analyzer' };
  if (TIMEWEB_API_TOKEN) headers.Authorization = `Bearer ${TIMEWEB_API_TOKEN}`;

  const response = await fetch(`${TIMEWEB_OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: TIMEWEB_MODEL,
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: MODEL_MAX_OUTPUT_TOKENS,
      response_format: { type: 'json_object' }
    }),
    signal: AbortSignal.timeout(90000)
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    const error = new Error(`Timeweb OpenAI-compatible API returned ${response.status}: ${details.slice(0, 300)}`);
    error.status = 502;
    throw error;
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content || payload.choices?.[0]?.text;

  if (!content) {
    throw new Error('Timeweb OpenAI-compatible API returned an empty response');
  }

  return { text: content, usage: normalizeAiUsage(payload.usage) };
}

async function callNativeAgent(message, previousError) {
  const headers = { 'Content-Type': 'application/json', 'x-proxy-source': 'github-repo-analyzer' };
  if (TIMEWEB_API_TOKEN) headers.Authorization = `Bearer ${TIMEWEB_API_TOKEN}`;

  const response = await fetch(TIMEWEB_NATIVE_CALL_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message }),
    signal: AbortSignal.timeout(90000)
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    const error = new Error(`Timeweb native API returned ${response.status}: ${details.slice(0, 300)}`);
    error.status = 502;
    error.publicMessage = `Timeweb API недоступен или требует токен. OpenAI-compatible ошибка: ${previousError.message}. Native ошибка: ${details.slice(0, 220)}`;
    throw error;
  }

  const responseText = await response.text();
  let payload = responseText;
  try {
    payload = JSON.parse(responseText);
  } catch {
    payload = responseText;
  }
  const content =
    typeof payload === 'string'
      ? payload
      : payload.message ||
        payload.content ||
        payload.response ||
        payload.result ||
        payload.output ||
        payload.data?.message ||
        payload.data?.content ||
        payload.choices?.[0]?.message?.content;

  if (!content) {
    return { text: JSON.stringify(payload), usage: normalizeAiUsage(payload.usage || payload.data?.usage) };
  }

  return { text: content, usage: normalizeAiUsage(payload.usage || payload.data?.usage) };
}

function parseJsonFromModel(text, options = {}) {
  const kind = options.kind || 'analysis';
  const cleaned = cleanModelResponse(text);
  const parsed = tryParseModelJson(cleaned);

  if (parsed) {
    return {
      provider: 'timeweb',
      data: kind === 'comparison' ? normalizeComparisonShape(parsed) : normalizeAnalysisShape(parsed, options.context)
    };
  }

  return {
    provider: 'timeweb',
    data:
      kind === 'comparison'
        ? extractPartialComparison(cleaned)
        : extractPartialAnalysis(cleaned, options.context)
  };
}

function cleanModelResponse(text) {
  return String(text || '')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .replace(/<eos>\s*$/i, '')
    .replace(/<\|end[^>]*\|>\s*$/i, '')
    .trim();
}

function tryParseModelJson(cleaned) {
  const candidates = [cleaned];
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(cleaned.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      // Try the next candidate.
    }
  }

  return null;
}

function extractPartialAnalysis(cleaned, context) {
  const data = {
    title: extractJsonValue(cleaned, 'title'),
    shortSummary: extractJsonValue(cleaned, 'shortSummary'),
    purpose: extractJsonValue(cleaned, 'purpose'),
    essence: extractJsonValue(cleaned, 'essence'),
    projectType: extractJsonValue(cleaned, 'projectType'),
    languages: extractJsonValue(cleaned, 'languages'),
    libraries: extractJsonValue(cleaned, 'libraries'),
    architecture: extractJsonValue(cleaned, 'architecture'),
    howToRun: extractJsonValue(cleaned, 'howToRun'),
    keyFiles: extractJsonValue(cleaned, 'keyFiles'),
    audience: extractJsonValue(cleaned, 'audience'),
    qualitySignals: extractJsonValue(cleaned, 'qualitySignals'),
    score: extractJsonValue(cleaned, 'score'),
    weaknesses: extractJsonValue(cleaned, 'weaknesses'),
    nextSteps: extractJsonValue(cleaned, 'nextSteps'),
    detailedConclusion: extractJsonValue(cleaned, 'detailedConclusion'),
    questions: extractJsonValue(cleaned, 'questions'),
    finalTakeaway: extractJsonValue(cleaned, 'finalTakeaway')
  };

  return normalizeAnalysisShape(
    data,
    context,
    'Ответ модели был частично обрезан. RepoScope восстановил доступные поля из JSON; повторите анализ, если нужен полный отчёт.'
  );
}

function extractPartialComparison(cleaned) {
  return normalizeComparisonShape({
    summary: extractJsonValue(cleaned, 'summary'),
    dimensions: extractJsonValue(cleaned, 'dimensions'),
    sharedStrengths: extractJsonValue(cleaned, 'sharedStrengths'),
    tradeoffs: extractJsonValue(cleaned, 'tradeoffs'),
    recommendation: extractJsonValue(cleaned, 'recommendation')
  });
}

function extractJsonValue(source, key) {
  const match = new RegExp(`"${escapeRegExp(key)}"\\s*:`, 'i').exec(source);
  if (!match) return undefined;

  let index = match.index + match[0].length;
  while (/\s/.test(source[index] || '')) index += 1;

  const end = findJsonValueEnd(source, index);
  if (end <= index) return undefined;

  try {
    return JSON.parse(source.slice(index, end));
  } catch {
    return undefined;
  }
}

function findJsonValueEnd(source, start) {
  const first = source[start];
  if (!first) return -1;

  if (first === '"') {
    let escaped = false;
    for (let index = start + 1; index < source.length; index += 1) {
      const char = source[index];
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        return index + 1;
      }
    }
    return -1;
  }

  if (first === '{' || first === '[') {
    const stack = [first === '{' ? '}' : ']'];
    let inString = false;
    let escaped = false;

    for (let index = start + 1; index < source.length; index += 1) {
      const char = source[index];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === '\\') {
          escaped = true;
        } else if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
      } else if (char === '{') {
        stack.push('}');
      } else if (char === '[') {
        stack.push(']');
      } else if (char === stack[stack.length - 1]) {
        stack.pop();
        if (!stack.length) return index + 1;
      }
    }
    return -1;
  }

  const primitiveEnd = source.slice(start).search(/[\s,}\]]/);
  return primitiveEnd === -1 ? source.length : start + primitiveEnd;
}

function normalizeAnalysisShape(data, context, parseWarning = '') {
  const repo = context?.repo || {};
  const fallbackSummary = repo.description || 'Краткое описание не найдено.';
  const questions = normalizeArrayForModel(data.questions);
  if (parseWarning) questions.unshift(parseWarning);

  return {
    title: cleanModelField(data.title) || repo.fullName || 'Анализ репозитория',
    shortSummary: cleanModelField(data.shortSummary) || cleanModelField(data.summary) || fallbackSummary,
    purpose: cleanModelField(data.purpose) || 'Назначение не удалось определить по доступным файлам.',
    essence: cleanModelField(data.essence) || cleanModelField(data.finalTakeaway) || '',
    projectType: normalizeProjectTypeShape(data.projectType),
    languages: normalizeModelObjectArray(data.languages).slice(0, 8),
    libraries: normalizeModelObjectArray(data.libraries).slice(0, 12),
    architecture: normalizeArrayForModel(data.architecture).slice(0, 10),
    howToRun: normalizeArrayForModel(data.howToRun).slice(0, 8),
    keyFiles: normalizeModelObjectArray(data.keyFiles).slice(0, 10),
    audience: normalizeArrayForModel(data.audience).slice(0, 8),
    qualitySignals: normalizeArrayForModel(data.qualitySignals).slice(0, 8),
    score: normalizeModelScore(data.score, context, Boolean(parseWarning)),
    weaknesses: normalizeArrayForModel(data.weaknesses).slice(0, 8),
    nextSteps: normalizeArrayForModel(data.nextSteps).slice(0, 6),
    detailedConclusion: cleanModelField(data.detailedConclusion) || cleanModelField(data.finalTakeaway) || '',
    questions: questions.slice(0, 8),
    finalTakeaway: cleanModelField(data.finalTakeaway) || cleanModelField(data.shortSummary) || '',
    parseWarning
  };
}

function normalizeComparisonShape(data) {
  return {
    summary: cleanModelField(data.summary) || 'Сравнение сформировано по доступному контексту.',
    dimensions: normalizeModelObjectArray(data.dimensions).slice(0, 8),
    sharedStrengths: normalizeArrayForModel(data.sharedStrengths).slice(0, 8),
    tradeoffs: normalizeArrayForModel(data.tradeoffs).slice(0, 8),
    recommendation:
      data.recommendation && typeof data.recommendation === 'object'
        ? data.recommendation
        : { choice: 'Зависит от задачи', reason: '' }
  };
}

function cleanModelField(value) {
  if (value === null || value === undefined || typeof value === 'object') return '';
  return cleanText(value).replace(/<eos>\s*$/i, '');
}

function normalizeArrayForModel(value) {
  if (!Array.isArray(value)) return typeof value === 'string' && value.trim() ? [value.trim()] : [];
  return value
    .map((item) => (typeof item === 'object' ? cleanModelField(item?.text || item?.name || item?.reason) : cleanModelField(item)))
    .filter(Boolean);
}

function normalizeModelObjectArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === 'object');
}

function normalizeProjectTypeShape(value) {
  if (value && typeof value === 'object') {
    return {
      label: cleanModelField(value.label || value.type) || 'Repository / codebase',
      reason: cleanModelField(value.reason || value.description)
    };
  }

  if (typeof value === 'string' && value.trim()) {
    return { label: value.trim(), reason: 'Тип определён по ответу модели.' };
  }

  return { label: 'Repository / codebase', reason: 'Тип не был явно указан в ответе модели.' };
}

function normalizeModelScore(score, context, approximate) {
  const rawValue = typeof score === 'number' ? score : score?.value;
  const numeric = Math.round(Number(rawValue));
  if (Number.isFinite(numeric) && numeric >= 1 && numeric <= 10) {
    return {
      value: numeric,
      label: cleanModelField(score?.label || 'Оценка'),
      reason: cleanModelField(score?.reason || score?.label || 'Оценка сформирована по доступным файлам.')
    };
  }

  return {
    value: estimateFallbackScore(context),
    label: approximate ? 'Предварительная оценка' : 'Оценка',
    reason: approximate
      ? 'Ответ модели оборвался до поля оценки, поэтому показана предварительная оценка по структуре репозитория. Повторите анализ для точного результата.'
      : 'Модель не вернула числовую оценку, поэтому показана предварительная оценка по структуре репозитория.'
  };
}

function estimateFallbackScore(context) {
  const repo = context?.repo || {};
  const paths = (context?.filePaths || []).map((item) => String(item).toLowerCase());
  let score = 5;

  if (paths.some((item) => /(^|\/)readme\./.test(item))) score += 1;
  if (paths.some((item) => /package\.json|requirements\.txt|pyproject\.toml|go\.mod|cargo\.toml|composer\.json/.test(item))) score += 1;
  if (paths.some((item) => /(^|\/)(test|tests|__tests__)\//.test(item) || /\.test\.|\.spec\./.test(item))) score += 1;
  if (paths.some((item) => item.startsWith('.github/workflows/'))) score += 1;
  if (!repo.license) score -= 1;

  return Math.max(3, Math.min(8, score));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
