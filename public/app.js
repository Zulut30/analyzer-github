const form = document.querySelector('#analyze-form');
const input = document.querySelector('#repo-url');
const button = document.querySelector('#analyze-button');
const statusPanel = document.querySelector('#status-panel');
const statusTitle = document.querySelector('#status-title');
const statusCopy = document.querySelector('#status-copy');
const errorPanel = document.querySelector('#error-panel');
const errorCopy = document.querySelector('#error-copy');
const results = document.querySelector('#results');
const accessNote = document.querySelector('#access-note');
const recentList = document.querySelector('#history-list');
const historyPageList = document.querySelector('#history-page-list');
const favoritesPageList = document.querySelector('#favorites-list');
const profileCard = document.querySelector('#profile-card');
const clearHistory = document.querySelector('#clear-history');
const historySearch = document.querySelector('#history-search');
const themeToggle = document.querySelector('#theme-toggle');
const themeLabel = document.querySelector('#theme-label');
const themeMenu = document.querySelector('#theme-menu');
const themeMenuPanel = document.querySelector('#theme-menu-panel');
const themeGrid = document.querySelector('#theme-grid');
const profileMenu = document.querySelector('#profile-menu');
const profileMenuButton = document.querySelector('#profile-menu-button');
const profileMenuPanel = document.querySelector('#profile-menu-panel');
const profileMenuAvatar = document.querySelector('#profile-menu-avatar');
const profileMenuStatus = document.querySelector('#profile-menu-status');
const favoriteToggleButton = document.querySelector('#toggle-favorite');
const copyWeaknessesButton = document.querySelector('#copy-weaknesses');
const copyPromptButton = document.querySelector('#copy-prompt');
const copyPromptInlineButton = document.querySelector('#copy-prompt-inline');
const llmPromptField = document.querySelector('#llm-prompt');
const shareAnalysisButton = document.querySelector('#share-analysis');
const toast = document.querySelector('#toast');
const progressSteps = document.querySelector('#progress-steps');
const resultModeButtons = document.querySelectorAll('[data-result-mode]');
const compareForm = document.querySelector('#compare-form');
const compareRepoA = document.querySelector('#compare-repo-a');
const compareRepoB = document.querySelector('#compare-repo-b');
const compareButton = document.querySelector('#compare-button');
const compareStatus = document.querySelector('#compare-status');
const compareError = document.querySelector('#compare-error');
const compareErrorCopy = document.querySelector('#compare-error-copy');
const compareResults = document.querySelector('#compare-results');
const toolsForm = document.querySelector('#tools-form');
const toolsUrlInput = document.querySelector('#tools-url');
const toolsRunButton = document.querySelector('#tools-run-button');
const toolsAccessNote = document.querySelector('#tools-access-note');
const toolsStatus = document.querySelector('#tools-status');
const toolsStatusTitle = document.querySelector('#tools-status-title');
const toolsStatusCopy = document.querySelector('#tools-status-copy');
const toolsError = document.querySelector('#tools-error');
const toolsErrorCopy = document.querySelector('#tools-error-copy');
const toolsResult = document.querySelector('#tools-result');
const toolsTabButtons = document.querySelectorAll('[data-tools-tab]');
const toolsCheckPanel = document.querySelector('#tools-check-panel');
const toolsMonitorsPanel = document.querySelector('#tools-monitors-panel');
const toolsHistoryPanel = document.querySelector('#tools-history-panel');
const toolsHistoryList = document.querySelector('#tools-history-list');
const monitorForm = document.querySelector('#monitor-form');
const monitorUrlInput = document.querySelector('#monitor-url');
const monitorIntervalInput = document.querySelector('#monitor-interval');
const monitorCreateButton = document.querySelector('#monitor-create-button');
const monitorsList = document.querySelector('#monitors-list');
const incidentsList = document.querySelector('#incidents-list');
const heroRepoImage = document.querySelector('#hero-repo-image');
const heroLanguageImages = document.querySelectorAll('[data-hero-language]');

const historyKey = 'repoScope.history.v2';
const favoritesKey = 'repoScope.favorites.v1';
const themeKey = 'repoScope.theme';
const openMenuClass = 'is-open';
let currentPayload = null;
let authState = { authenticated: false, user: null, oauthConfigured: false, canAnalyze: false, allowedLogin: 'zulut30' };
let profileReposState = { status: 'idle', repositories: [], error: '' };
let profileActivityState = { status: 'idle', user: null, events: [], summary: null, error: '' };
let profileRepoQuery = '';
let profileStateStatus = 'idle';
let profileStateLoadedFor = '';
let profileStateTimer = null;
let progressTimer = null;
let progressStepIndex = 0;
let currentShareId = '';
let toolsState = {
  activeTab: 'check',
  history: [],
  monitors: [],
  incidents: [],
  lastCheck: null,
  loaded: false
};

const themes = [
  { id: 'light', label: 'Светлая' },
  { id: 'dark', label: 'Тёмная' },
  { id: 'graphite', label: 'Сумерки' },
  { id: 'aurora', label: 'Нефрит' },
  { id: 'sky', label: 'Индиго' },
  { id: 'rose', label: 'Розовый' },
  { id: 'ember', label: 'Янтарь' },
  { id: 'frost', label: 'Океан' },
  { id: 'violet', label: 'Фиолетовая' }
];

const themeColors = {
  light: '#f4fbfb',
  dark: '#0d1417',
  sky: '#f3f8ff',
  graphite: '#101113',
  aurora: '#081916',
  frost: '#f8fbff',
  rose: '#fff6f8',
  ember: '#17110c',
  violet: '#110f20',
  mono: '#f6f7f7'
};

const emojiBasePath = '/assets/emoji/';
const emojiAssets = {
  bash: 'bash.png',
  c: 'c.png',
  chatgpt: 'chatgpt.png',
  claude: 'claude.png',
  code: 'coding.png',
  coding: 'coding.png',
  cpp: 'cpp.png',
  csharp: 'csharp.png',
  css: 'css.png',
  debian: 'debian.png',
  docker: 'docker.png',
  gemini: 'gemini.png',
  git: 'git.png',
  github: 'github.png',
  go: 'go.png',
  html: 'html.png',
  java: 'java.png',
  javascript: 'javascript.png',
  kotlin: 'kotlin.png',
  linux: 'linux.png',
  lua: 'lua.png',
  mysql: 'mysql.png',
  nodejs: 'nodejs.png',
  php: 'php.png',
  postgresql: 'postgresql.png',
  powershell: 'powershell.png',
  python: 'python.png',
  react: 'react.png',
  ruby: 'ruby.png',
  shell: 'shell.png',
  sql: 'sql.png',
  swift: 'swift.png',
  terminal: 'terminal.png',
  typescript: 'typescript.png',
  vscode: 'vscode.png',
  vue: 'vue.png',
  xcode: 'xcode.png'
};

const languageAssetMap = {
  JavaScript: 'javascript',
  TypeScript: 'typescript',
  Python: 'python',
  Go: 'go',
  Java: 'java',
  Kotlin: 'kotlin',
  Swift: 'swift',
  PHP: 'php',
  Ruby: 'ruby',
  Lua: 'lua',
  CSS: 'css',
  HTML: 'html',
  Shell: 'shell',
  Bash: 'bash',
  PowerShell: 'powershell',
  Dockerfile: 'docker',
  Code: 'code',
  Vue: 'vue',
  C: 'c',
  'C++': 'cpp',
  CSharp: 'csharp',
  SQL: 'sql',
  MySQL: 'mysql',
  PostgreSQL: 'postgresql',
  React: 'react',
  Node: 'nodejs'
};

const languageMeta = {
  JavaScript: { color: '#f7df1e', accent: '#222222', label: 'JS' },
  TypeScript: { color: '#3178c6', accent: '#ffffff', label: 'TS' },
  Python: { color: '#3776ab', accent: '#ffd343', label: 'PY' },
  Go: { color: '#00add8', accent: '#ffffff', label: 'GO' },
  Rust: { color: '#c45508', accent: '#ffffff', label: 'RS' },
  Java: { color: '#e76f00', accent: '#ffffff', label: 'JV' },
  Kotlin: { color: '#7f52ff', accent: '#ffffff', label: 'KT' },
  Swift: { color: '#fa7343', accent: '#ffffff', label: 'SW' },
  PHP: { color: '#777bb4', accent: '#ffffff', label: 'PHP' },
  Ruby: { color: '#cc342d', accent: '#ffffff', label: 'RB' },
  Dart: { color: '#0175c2', accent: '#ffffff', label: 'Dart' },
  Scala: { color: '#dc322f', accent: '#ffffff', label: 'SCL' },
  Elixir: { color: '#6e4a7e', accent: '#ffffff', label: 'EX' },
  Erlang: { color: '#a90533', accent: '#ffffff', label: 'ERL' },
  Haskell: { color: '#5d4f85', accent: '#ffffff', label: 'HS' },
  Lua: { color: '#000080', accent: '#ffffff', label: 'Lua' },
  R: { color: '#276dc3', accent: '#ffffff', label: 'R' },
  Julia: { color: '#9558b2', accent: '#ffffff', label: 'JL' },
  Perl: { color: '#39457e', accent: '#ffffff', label: 'PL' },
  ObjectiveC: { color: '#438eff', accent: '#ffffff', label: 'ObjC' },
  CSS: { color: '#663399', accent: '#ffffff', label: 'CSS' },
  HTML: { color: '#e34f26', accent: '#ffffff', label: 'HTML' },
  Shell: { color: '#4eaa25', accent: '#ffffff', label: 'SH' },
  PowerShell: { color: '#5391fe', accent: '#ffffff', label: 'PS' },
  Dockerfile: { color: '#2496ed', accent: '#ffffff', label: 'Docker' },
  Jupyter: { color: '#f37626', accent: '#ffffff', label: 'IPYNB' },
  Code: { color: '#0c8f83', accent: '#ffffff', label: '</>' },
  Vue: { color: '#42b883', accent: '#10201f', label: 'Vue' },
  Svelte: { color: '#ff3e00', accent: '#ffffff', label: 'SV' },
  MDX: { color: '#f15bb5', accent: '#ffffff', label: 'MDX' },
  C: { color: '#a8b9cc', accent: '#102033', label: 'C' },
  'C++': { color: '#00599c', accent: '#ffffff', label: 'C++' },
  CSharp: { color: '#68217a', accent: '#ffffff', label: 'C#' }
};

input.value = '';
renderThemeOptions();
applyTheme(localStorage.getItem(themeKey) || 'light');
updateHeaderProfile();
renderHeroImages();
renderAllHistory();
renderFavoritesPage();
loadProfile();
syncRoute();
updateAnalyzeAccessUI();

window.addEventListener('popstate', syncRoute);

document.addEventListener('click', (event) => {
  const routeLink = event.target.closest('[data-route]');
  if (!routeLink) return;
  event.preventDefault();
  closeHeaderMenus();
  navigate(routeLink.getAttribute('data-route') || '/');
});

document.querySelectorAll('[data-example]').forEach((example) => {
  example.addEventListener('click', () => {
    input.value = example.dataset.example || '';
    input.focus();
  });
});

themeToggle.addEventListener('click', (event) => {
  event.stopPropagation();
  toggleThemeMenu();
});

profileMenuButton.addEventListener('click', (event) => {
  event.stopPropagation();
  toggleProfileMenu();
});

document.addEventListener('click', (event) => {
  if (themeMenu?.contains(event.target) || profileMenu?.contains(event.target)) return;
  closeHeaderMenus();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeHeaderMenus();
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  analyzeRepository(input.value.trim());
});

async function analyzeRepository(repoUrl, options = {}) {
  const normalizedUrl = String(repoUrl || '').trim();
  if (!normalizedUrl) return;

  if (!canUseAnalyzer()) {
    showError(accessDeniedMessage());
    navigate('/profile');
    return;
  }

  navigate('/');
  input.value = normalizedUrl;
  setLoading(true);
  hideError();
  results.hidden = true;
  startProgressTimeline();
  setStatus('Готовлю контекст', 'Получаю README, языки, манифесты и структуру файлов.');

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoUrl: normalizedUrl })
    });

    const payload = await readApiResponse(response);
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || 'Неизвестная ошибка анализа');
    }

    renderResult(payload);
    saveHistory(payload);
    if (options.toast) showToast(options.toast);
  } catch (error) {
    showError(error.message);
  } finally {
    setLoading(false);
  }
}

function startProgressTimeline() {
  progressStepIndex = 0;
  updateProgressSteps(0);
  window.clearInterval(progressTimer);
  progressTimer = window.setInterval(() => {
    progressStepIndex = Math.min(progressStepIndex + 1, 3);
    updateProgressSteps(progressStepIndex);

    if (progressStepIndex === 1) {
      setStatus('Смотрю стек', 'Проверяю языки, package-файлы, зависимости и признаки фреймворков.');
    } else if (progressStepIndex === 2) {
      setStatus('Изучаю структуру', 'Сопоставляю директории, ключевые файлы, CI и признаки зрелости проекта.');
    } else if (progressStepIndex === 3) {
      setStatus('Формирую вывод', 'Grok Code Fast собирает краткий итог, риски, оценку и следующие шаги.');
    }
  }, 1600);
}

function stopProgressTimeline() {
  window.clearInterval(progressTimer);
  progressTimer = null;
  updateProgressSteps(-1);
}

function updateProgressSteps(activeIndex) {
  progressSteps?.querySelectorAll('[data-progress-step]').forEach((step, index) => {
    step.classList.toggle('is-done', index < activeIndex);
    step.classList.toggle('is-active', index === activeIndex);
  });
}

async function readApiResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text().catch(() => '');
  const isHtml = /<!doctype html|<html[\s>]/i.test(text);
  const statusText = `${response.status} ${response.statusText || ''}`.trim();

  return {
    ok: false,
    error: isHtml
      ? `API вернул HTML-страницу вместо JSON (${statusText}). Обновите страницу и попробуйте снова.`
      : `API вернул неожиданный ответ (${statusText}). Обновите страницу и попробуйте снова.`
  };
}

clearHistory.addEventListener('click', () => {
  localStorage.removeItem(historyKey);
  renderAllHistory();
  renderProfile();
  scheduleProfileStateSync();
});

historySearch.addEventListener('input', renderHistoryPage);

copyWeaknessesButton.addEventListener('click', () => {
  if (!currentPayload) return;
  copyText(buildWeaknessesText(currentPayload), 'Ошибки скопированы');
});

copyPromptButton.addEventListener('click', copyCurrentPrompt);
copyPromptInlineButton.addEventListener('click', copyCurrentPrompt);
favoriteToggleButton.addEventListener('click', toggleCurrentFavorite);
shareAnalysisButton?.addEventListener('click', shareCurrentAnalysis);
resultModeButtons.forEach((modeButton) => {
  modeButton.addEventListener('click', () => setResultMode(modeButton.dataset.resultMode || 'brief'));
});

compareForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  compareRepositories(compareRepoA?.value || '', compareRepoB?.value || '');
});

toolsForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  runToolsCheck();
});

toolsTabButtons.forEach((tabButton) => {
  tabButton.addEventListener('click', () => setToolsTab(tabButton.dataset.toolsTab || 'check'));
});

monitorForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  createToolMonitor();
});

document.querySelectorAll('[data-export-format]').forEach((exportButton) => {
  exportButton.addEventListener('click', () => exportAnalysis(exportButton.dataset.exportFormat));
});

function renderHeroImages() {
  if (heroRepoImage) {
    heroRepoImage.src = '/assets/brand/repo-analyzer-wide.webp';
    heroRepoImage.alt = 'Брендовая картинка RepoAnalyzer';
    heroRepoImage.decoding = 'async';
  }

  heroLanguageImages.forEach((image) => {
    const language = image.dataset.heroLanguage || 'Code';
    image.src = getLanguageImageSrc(language, getLanguageMeta(language));
    image.decoding = 'async';
  });

  const resultRepoImage = document.querySelector('#repo-art-image');
  if (resultRepoImage && !resultRepoImage.getAttribute('src')) {
    resultRepoImage.src = getEmojiImageSrc('coding');
    resultRepoImage.alt = 'Картинка репозитория GitHub';
  }
}

function navigate(path) {
  if (window.location.pathname !== path) {
    window.history.pushState({}, '', path);
  }
  syncRoute();
}

function syncRoute() {
  const path = window.location.pathname;
  const isShareRoute = path.startsWith('/share/');
  const activeRoute =
    path === '/history' || path === '/favorites' || path === '/profile' || path === '/compare' || path === '/tools' ? path : '/';

  document.querySelector('#analysis-view').hidden = activeRoute !== '/';
  document.querySelector('#compare-view').hidden = activeRoute !== '/compare';
  document.querySelector('#tools-view').hidden = activeRoute !== '/tools';
  document.querySelector('#history-view').hidden = activeRoute !== '/history';
  document.querySelector('#favorites-view').hidden = activeRoute !== '/favorites';
  document.querySelector('#profile-view').hidden = activeRoute !== '/profile';

  document.querySelectorAll('[data-route]').forEach((link) => {
    const active = link.getAttribute('data-route') === activeRoute;
    link.classList.toggle('is-active', active);
  });

  if (activeRoute === '/history') renderHistoryPage();
  if (activeRoute === '/favorites') renderFavoritesPage();
  if (activeRoute === '/profile') renderProfile();
  if (activeRoute === '/tools') {
    renderTools();
    loadToolsData();
  }
  if (isShareRoute) loadSharedAnalysis(path.split('/').filter(Boolean)[1] || '');
  if (!isShareRoute) currentShareId = '';
}

function applyTheme(theme) {
  const selectedTheme = themes.find((item) => item.id === theme) || themes[0];
  document.documentElement.dataset.theme = selectedTheme.id;
  localStorage.setItem(themeKey, selectedTheme.id);
  themeLabel.textContent = theme === 'dark' ? 'Темная' : 'Светлая';
  themeLabel.textContent = 'Тема';
  renderThemeOptions();
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) themeColorMeta.setAttribute('content', themeColors[selectedTheme.id] || themeColors.dark);
}

function renderThemeOptions() {
  if (!themeGrid) return;
  const selectedTheme = document.documentElement.dataset.theme || localStorage.getItem(themeKey) || themes[0].id;
  themeGrid.innerHTML = themes
    .map((theme) => `
      <button class="theme-option ${theme.id === selectedTheme ? 'is-selected' : ''}" type="button" data-theme-option="${escapeAttr(theme.id)}" aria-pressed="${theme.id === selectedTheme}">
        <span class="theme-swatch theme-swatch-${escapeAttr(theme.id)}" aria-hidden="true"></span>
        <span>${escapeHtml(theme.label)}</span>
      </button>
    `)
    .join('');

  themeGrid.querySelectorAll('[data-theme-option]').forEach((option) => {
    option.addEventListener('click', () => {
      applyTheme(option.dataset.themeOption || themes[0].id);
      closeHeaderMenus();
    });
  });
}

function toggleThemeMenu() {
  const nextOpen = !themeMenu?.classList.contains(openMenuClass);
  closeHeaderMenus();
  setMenuOpen(themeMenu, themeMenuPanel, themeToggle, nextOpen);
}

function toggleProfileMenu() {
  const nextOpen = !profileMenu?.classList.contains(openMenuClass);
  closeHeaderMenus();
  updateHeaderProfile();
  setMenuOpen(profileMenu, profileMenuPanel, profileMenuButton, nextOpen);
}

function closeHeaderMenus() {
  setMenuOpen(themeMenu, themeMenuPanel, themeToggle, false);
  setMenuOpen(profileMenu, profileMenuPanel, profileMenuButton, false);
}

function setMenuOpen(menu, panel, trigger, isOpen) {
  if (!menu || !panel || !trigger) return;
  menu.classList.toggle(openMenuClass, isOpen);
  panel.hidden = !isOpen;
  trigger.setAttribute('aria-expanded', String(isOpen));
}

function updateHeaderProfile() {
  if (!profileMenuAvatar || !profileMenuPanel) return;

  const user = getProfileDisplayUser();
  const isSignedIn = Boolean(authState.authenticated && user?.login);
  profileMenuAvatar.src = user.avatarUrl || getEmojiImageSrc('github');
  profileMenuAvatar.alt = isSignedIn ? `@${user.login}` : '';
  profileMenuStatus?.classList.toggle('is-online', Boolean(authState.canAnalyze));

  profileMenuPanel.innerHTML = isSignedIn ? renderSignedInProfileMenu(user) : renderSignedOutProfileMenu();
}

function renderSignedInProfileMenu(user) {
  const profileUrl = user.profileUrl || `https://github.com/${user.login}`;
  const roleText = authState.canAnalyze ? 'Доступ к анализу открыт' : accessDeniedMessage();
  return `
    <div class="profile-menu-user">
      <img src="${escapeAttr(user.avatarUrl || getEmojiImageSrc('github'))}" alt="" />
      <div>
        <span>${escapeHtml(user.name || user.login)}</span>
        <a href="${escapeAttr(profileUrl)}" target="_blank" rel="noreferrer">@${escapeHtml(user.login)}</a>
      </div>
    </div>
    <p class="profile-menu-note">${escapeHtml(roleText)}</p>
    <div class="profile-menu-links">
      <a href="/tools" data-route="/tools">Инструменты</a>
      <a href="/profile" data-route="/profile">Профиль</a>
      <a href="/history" data-route="/history">История</a>
      <a href="/favorites" data-route="/favorites">Избранное</a>
    </div>
    <form class="profile-menu-logout" method="post" action="/auth/logout">
      <button type="submit">Выйти</button>
    </form>
  `;
}

function renderSignedOutProfileMenu() {
  const title = authState.oauthConfigured ? 'GitHub профиль' : 'OAuth не настроен';
  const copy = authState.oauthConfigured
    ? `Войдите как ${authState.allowedLogin || 'Zulut30'}, чтобы открыть анализ и синхронизацию.`
    : 'Сначала подключите GitHub OAuth App на сервере.';

  return `
    <div class="profile-menu-user">
      <img src="${escapeAttr(getEmojiImageSrc('github'))}" alt="" />
      <div>
        <span>${escapeHtml(title)}</span>
        <small>${escapeHtml(copy)}</small>
      </div>
    </div>
    ${authState.oauthConfigured ? '<a class="profile-menu-login" href="/auth/github">Войти через GitHub</a>' : '<span class="profile-menu-login is-disabled">Вход недоступен</span>'}
  `;
}

function setLoading(isLoading) {
  button.disabled = isLoading || !canUseAnalyzer();
  button.innerHTML = isLoading
    ? 'Анализирую...'
    : '<span class="button-icon" aria-hidden="true"></span>Анализировать';
  statusPanel.hidden = !isLoading;
  if (!isLoading) stopProgressTimeline();
}

function setStatus(title, copy) {
  statusTitle.textContent = title;
  statusCopy.textContent = copy;
}

function canUseAnalyzer() {
  return Boolean(authState.canAnalyze);
}

function accessDeniedMessage() {
  const login = authState.allowedLogin || 'Zulut30';
  if (!authState.oauthConfigured) return 'GitHub OAuth ещё не настроен на сервере.';
  if (!authState.authenticated) return `Анализ доступен только GitHub пользователю ${login}. Войдите через GitHub.`;
  return `Этот аккаунт не может анализировать репозитории. Разрешён только GitHub пользователь ${login}.`;
}

function updateAnalyzeAccessUI() {
  const allowed = canUseAnalyzer();
  button.disabled = !allowed;
  input.disabled = false;
  updateToolsAccessUI(allowed);

  if (!accessNote) return;
  accessNote.classList.toggle('is-allowed', allowed);
  accessNote.textContent = allowed
    ? `Доступ открыт для @${authState.user?.login || authState.allowedLogin}.`
    : accessDeniedMessage();
}

function updateToolsAccessUI(allowed = canUseAnalyzer()) {
  if (toolsRunButton) toolsRunButton.disabled = !allowed;
  if (monitorCreateButton) monitorCreateButton.disabled = !allowed;
  if (toolsUrlInput) toolsUrlInput.disabled = false;
  if (monitorUrlInput) monitorUrlInput.disabled = false;
  if (toolsAccessNote) {
    toolsAccessNote.classList.toggle('is-allowed', allowed);
    toolsAccessNote.textContent = allowed
      ? 'Инструменты готовы. Проверки сайтов не используют AI-токены.'
      : accessDeniedMessage();
  }
}

function showError(message) {
  errorCopy.textContent = message;
  errorPanel.hidden = false;
}

function hideError() {
  errorPanel.hidden = true;
  errorCopy.textContent = '';
}

function renderResult(payload) {
  currentPayload = payload;
  const analysis = payload.analysis || {};
  const repo = payload.repo || {};
  const languages = normalizeArray(analysis.languages).length ? analysis.languages : payload.languages;
  const primaryLanguage = normalizeArray(languages)[0]?.name || repo.primaryLanguage || 'Code';
  const score = normalizeScore(analysis.score);
  const shortSummary = cleanResultText(analysis.shortSummary, repo.description || 'Краткое описание не найдено.');
  const purpose = cleanResultText(analysis.purpose, 'Назначение не удалось определить по доступным файлам.');
  const essence = cleanResultText(analysis.essence, '');
  const finalTakeaway = cleanResultText(analysis.finalTakeaway, shortSummary);
  const detailedConclusion = cleanResultText(analysis.detailedConclusion, finalTakeaway);

  document.querySelector('#repo-link').innerHTML = repo.url
    ? `<a href="${escapeAttr(repo.url)}" target="_blank" rel="noreferrer">${escapeHtml(repo.fullName || repo.url)}</a>`
    : escapeHtml(repo.fullName || '');
  document.querySelector('#analysis-title').textContent = analysis.title || repo.fullName || 'Анализ репозитория';
  document.querySelector('#short-summary').textContent = shortSummary;
  document.querySelector('#purpose').textContent = purpose;
  document.querySelector('#essence').textContent = essence;
  document.querySelector('#final-takeaway').textContent = finalTakeaway;
  document.querySelector('#detailed-conclusion').textContent = detailedConclusion;
  document.querySelector('#score-value').textContent = `${score.value}/10`;
  document.querySelector('#score-reason').textContent = score.reason || 'Оценка сформирована по доступным файлам.';
  renderResultOverview(payload, primaryLanguage);
  renderList('#next-steps-list', analysis.nextSteps);
  llmPromptField.value = buildFixPrompt(payload);

  renderRepoArt(repo, primaryLanguage);
  renderTopics(repo.topics);
  renderStats(repo, payload.fileStats, payload.tokenUsage);
  renderLanguages(languages);
  renderLibraries(analysis.libraries);
  renderList('#architecture-list', analysis.architecture);
  renderList('#run-list', analysis.howToRun);
  renderList('#weakness-list', analysis.weaknesses);
  renderKeyFiles(analysis.keyFiles);
  renderList('#audience-list', analysis.audience);
  renderList('#quality-list', analysis.qualitySignals);
  renderQuestions(analysis.questions);
  syncFavoriteButton();
  setResultMode(results.dataset.mode || 'brief');

  results.hidden = false;
  results.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cleanResultText(value, fallback = '') {
  const text = String(value || '').replace(/<eos>\s*$/i, '').trim();
  if (!text || looksLikeRawModelJson(text)) return fallback;
  return text;
}

function looksLikeRawModelJson(text) {
  const compact = String(text || '').trim();
  return (
    /^[{\[]\s*"?(title|shortSummary|purpose|essence|projectType|languages)"?\s*:/i.test(compact) ||
    (compact.includes('"shortSummary"') && compact.includes('"purpose"')) ||
    (compact.includes('"languages"') && compact.includes('"libraries"') && compact.includes('"score"'))
  );
}

function renderResultOverview(payload, primaryLanguage) {
  const analysis = payload.analysis || {};
  const repo = payload.repo || {};
  const libraries = normalizeArray(analysis.libraries);
  const languages = normalizeArray(analysis.languages).length ? analysis.languages : payload.languages;
  const nextSteps = normalizeArray(analysis.nextSteps);
  const projectType = normalizeProjectType(analysis.projectType, payload);
  const stackItems = [
    primaryLanguage,
    ...normalizeArray(languages)
      .map((item) => item.name)
      .filter(Boolean)
      .slice(1, 3),
    ...libraries.map((item) => item.name).filter(Boolean).slice(0, 3)
  ].filter(Boolean);

  document.querySelector('#project-type').textContent = projectType.label;
  document.querySelector('#project-type-reason').textContent = projectType.reason;
  document.querySelector('#stack-summary').textContent = stackItems.slice(0, 4).join(' + ') || repo.primaryLanguage || 'Стек не определён';
  document.querySelector('#stack-detail').textContent =
    libraries.length > 0
      ? `Видимые зависимости: ${libraries.map((item) => item.name).filter(Boolean).slice(0, 5).join(', ')}.`
      : 'Библиотеки будут видны, если они есть в README или manifest-файлах.';
  document.querySelector('#next-step-primary').textContent = nextSteps[0] || 'Изучить ключевые файлы и слабые места';
  document.querySelector('#next-step-detail').textContent =
    nextSteps[1] || analysis.finalTakeaway || 'Начните с README, manifest-файлов и списка рисков в подробном режиме.';
}

function normalizeProjectType(value, payload) {
  if (value && typeof value === 'object') {
    return {
      label: String(value.label || value.type || 'Проект').trim() || 'Проект',
      reason: String(value.reason || value.description || '').trim()
    };
  }

  if (typeof value === 'string' && value.trim()) {
    return { label: value.trim(), reason: 'Тип определён AI по README, manifest-файлам и структуре проекта.' };
  }

  const repo = payload?.repo || {};
  const fileStats = payload?.fileStats || {};
  const paths = normalizeArray(fileStats.topDirectories).map((item) => item.name).join(' ').toLowerCase();
  const language = String(repo.primaryLanguage || normalizeArray(payload?.languages)[0]?.name || '').toLowerCase();
  const topics = normalizeArray(repo.topics).join(' ').toLowerCase();
  const haystack = `${paths} ${language} ${topics}`;

  if (/cli|cmd|bin|shell|powershell/.test(haystack)) return { label: 'CLI / tooling', reason: 'В структуре или темах видны признаки командного инструмента.' };
  if (/bot|telegram|discord|slack/.test(haystack)) return { label: 'Bot / automation', reason: 'Темы или файлы похожи на автоматизацию или бота.' };
  if (/api|server|backend|fastapi|express|django/.test(haystack)) return { label: 'Backend API', reason: 'Есть признаки серверного API или backend-фреймворка.' };
  if (/react|vue|svelte|next|app|pages|frontend/.test(haystack)) return { label: 'Frontend app', reason: 'Есть признаки клиентского приложения или UI-фреймворка.' };
  if (/library|package|sdk|crate|module/.test(haystack)) return { label: 'Library / SDK', reason: 'Репозиторий похож на переиспользуемый пакет или модуль.' };
  if (/docker|infra|helm|terraform|k8s/.test(haystack)) return { label: 'Infrastructure', reason: 'Видны признаки инфраструктурного проекта.' };
  return { label: 'Repository / codebase', reason: 'Тип неочевиден без более глубокого чтения кода.' };
}

function setResultMode(mode) {
  const selectedMode = mode === 'expert' ? 'expert' : 'brief';
  if (results) results.dataset.mode = selectedMode;
  resultModeButtons.forEach((buttonElement) => {
    buttonElement.classList.toggle('is-active', buttonElement.dataset.resultMode === selectedMode);
    buttonElement.setAttribute('aria-pressed', String(buttonElement.dataset.resultMode === selectedMode));
  });
}

function renderRepoArt(repo, language) {
  const meta = getLanguageMeta(language);
  const art = document.querySelector('#repo-art');
  const image = document.querySelector('#repo-art-image');
  const hueShift = hashString(repo.fullName || repo.name || language) % 80;
  art.style.setProperty('--repo-color', meta.color);
  art.style.setProperty('--repo-accent', `hsl(${180 + hueShift} 78% 46%)`);
  image.src = getRepoImageSrc(repo, language, meta);
  image.alt = `Картинка репозитория ${repo.fullName || repo.name || language || 'GitHub'}`;
}

function renderTopics(topics) {
  const items = normalizeArray(topics).slice(0, 8);
  const container = document.querySelector('#topic-list');
  container.innerHTML = items.map((topic) => `<span>${escapeHtml(topic)}</span>`).join('');
}

function renderStats(repo, fileStats, tokenUsage) {
  const stats = [
    ['Stars', formatNumber(repo.stars)],
    ['Forks', formatNumber(repo.forks)],
    ['Issues', formatNumber(repo.openIssues)],
    ['Язык', repo.primaryLanguage || 'не указан'],
    ['Файлов', formatNumber(fileStats?.totalFiles || 0)],
    ['Лицензия', repo.license || 'не указана']
  ];

  if (tokenUsage) {
    stats.push(['AI токены', formatTokenUsage(tokenUsage)]);
  }

  document.querySelector('#repo-stats').innerHTML = stats
    .map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>`)
    .join('');
}

function formatTokenUsage(tokenUsage) {
  const actual = tokenUsage.actual || {};
  const estimated = tokenUsage.estimated || {};
  const actualTotal = actual.total_tokens || actual.totalTokens || actual.total;
  const estimatedTotal = estimated.totalBudgetTokens || estimated.promptTokens;

  if (actualTotal) return formatNumber(actualTotal);
  if (estimatedTotal) return `~${formatNumber(estimatedTotal)}`;
  return 'неизвестно';
}

function renderLanguages(languages) {
  const items = normalizeArray(languages).slice(0, 8);
  const container = document.querySelector('#language-list');

  if (!items.length) {
    container.innerHTML = '<p>Языки не определены.</p>';
    return;
  }

  container.innerHTML = items
    .map((item) => {
      const name = item.name || 'Unknown';
      const percent = clamp(Number(item.percent || 0), 0, 100);
      const meta = getLanguageMeta(name);
      const imageSrc = getLanguageImageSrc(name, meta);
      return `
        <div class="language-card" style="--lang-color: ${escapeAttr(meta.color)}; --lang-accent: ${escapeAttr(meta.accent)}">
          <img class="language-image" src="${escapeAttr(imageSrc)}" alt="Картинка языка ${escapeAttr(name)}" />
          <div class="language-content">
            <div class="language-meta">
              <strong>${escapeHtml(name)}</strong>
              <span>${percent ? `${percent}%` : ''}</span>
            </div>
            <div class="bar" aria-hidden="true"><span style="width: ${percent || 8}%"></span></div>
            ${item.role ? `<p>${escapeHtml(item.role)}</p>` : ''}
          </div>
        </div>
      `;
    })
    .join('');
}

function renderLibraries(libraries) {
  const items = normalizeArray(libraries);
  const container = document.querySelector('#library-list');

  if (!items.length) {
    container.innerHTML = '<p>Библиотеки не найдены в доступных манифестах.</p>';
    return;
  }

  container.innerHTML = items
    .slice(0, 12)
    .map((item) => {
      const title = [item.name, item.ecosystem].filter(Boolean).join(' · ');
      return `<div class="tag"><strong>${escapeHtml(title || 'Библиотека')}</strong><span>${escapeHtml(item.purpose || '')}</span></div>`;
    })
    .join('');
}

function renderList(selector, values) {
  const container = document.querySelector(selector);
  const items = normalizeArray(values).filter(Boolean);

  if (!items.length) {
    container.innerHTML = '<li>Не видно из доступных файлов.</li>';
    return;
  }

  container.innerHTML = items
    .slice(0, 12)
    .map((item) => `<li>${escapeHtml(String(item))}</li>`)
    .join('');
}

function renderKeyFiles(files) {
  const items = normalizeArray(files);
  const container = document.querySelector('#key-files');

  if (!items.length) {
    container.innerHTML = '<p>Ключевые файлы не определены.</p>';
    return;
  }

  container.innerHTML = items
    .slice(0, 10)
    .map((item) => {
      const path = item.path || 'файл';
      return `<div class="file-item"><strong>${escapeHtml(path)}</strong><span>${escapeHtml(item.reason || '')}</span></div>`;
    })
    .join('');
}

function renderQuestions(questions) {
  const items = normalizeArray(questions).filter(Boolean);
  const container = document.querySelector('#questions');

  container.innerHTML = items
    .slice(0, 5)
    .map((item) => `<div class="question">${escapeHtml(String(item))}</div>`)
    .join('');
}

function saveHistory(payload) {
  const repo = payload.repo || {};
  const analysis = payload.analysis || {};
  const score = normalizeScore(analysis.score);
  const current = readHistory();
  const next = [
    {
      repoUrl: repo.url,
      fullName: repo.fullName || repo.url,
      summary: analysis.shortSummary || '',
      primaryLanguage: repo.primaryLanguage || normalizeArray(payload.languages)[0]?.name || '',
      score: score.value,
      createdAt: new Date().toISOString(),
      payload: compactPayload(payload)
    },
    ...current.filter((item) => item.repoUrl !== repo.url)
  ].slice(0, 80);

  localStorage.setItem(historyKey, JSON.stringify(next));
  renderAllHistory();
  renderProfile();
  scheduleProfileStateSync();
}

function renderAllHistory() {
  renderRecentHistory();
  renderHistoryPage();
}

function renderRecentHistory() {
  if (!recentList) return;

  const items = readHistory().slice(0, 5);

  if (!items.length) {
    recentList.innerHTML = '<p class="empty-history">История появится после первого анализа.</p>';
    return;
  }

  recentList.innerHTML = items
    .map((item, index) => {
      const meta = getLanguageMeta(item.primaryLanguage || 'Code');
      const imageSrc = getLanguageImageSrc(item.primaryLanguage || 'Code', meta);
      const favorite = isFavoriteSavedItem(item);
      return `
        <button class="history-item" type="button" data-index="${index}">
          <img class="mini-language" src="${escapeAttr(imageSrc)}" alt="" />
          <span>
            <strong>${escapeHtml(item.fullName || item.repoUrl || 'Репозиторий')}</strong>
            <small>${escapeHtml(item.summary || 'Показать сохраненный анализ')}</small>
          </span>
          <em>${Number(item.score || 0) || '-'}/10</em>
        </button>
      `;
    })
    .join('');

  recentList.querySelectorAll('.history-item').forEach((item) => {
    item.addEventListener('click', () => {
      const saved = readHistory()[Number(item.dataset.index)];
      if (!saved?.payload) return;
      navigate('/');
      renderResult(saved.payload);
    });
  });
}

function renderHistoryPage() {
  const query = (historySearch?.value || '').trim().toLowerCase();
  const items = readHistory().filter((item) => {
    const haystack = [item.fullName, item.repoUrl, item.summary, item.primaryLanguage]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return !query || haystack.includes(query);
  });

  if (!items.length) {
    historyPageList.innerHTML = '<div class="history-empty">Пока нет сохраненных репозиториев.</div>';
    return;
  }

  historyPageList.innerHTML = items
    .map((item, index) => {
      const meta = getLanguageMeta(item.primaryLanguage || 'Code');
      const imageSrc = getLanguageImageSrc(item.primaryLanguage || 'Code', meta);
      const favorite = isFavoriteSavedItem(item);
      return `
        <article class="history-card">
          <img class="history-card-visual" src="${escapeAttr(imageSrc)}" alt="Картинка языка ${escapeAttr(item.primaryLanguage || 'Code')}" />
          <div>
            <div class="history-card-top">
              <h2>${escapeHtml(item.fullName || item.repoUrl || 'Репозиторий')}</h2>
              <strong>${Number(item.score || 0) || '-'}/10</strong>
            </div>
            <p>${escapeHtml(item.summary || 'Краткое описание не сохранено.')}</p>
            <div class="history-card-meta">
              <span>${escapeHtml(item.primaryLanguage || 'язык не указан')}</span>
              <span>${formatDate(item.createdAt)}</span>
            </div>
            <div class="history-actions">
              <button type="button" data-show-history="${index}">Показать анализ</button>
              <button type="button" data-repeat-history="${index}">Повторить</button>
              <button type="button" class="${favorite ? 'is-soft-active' : ''}" data-toggle-history-favorite="${index}">
                ${favorite ? 'В избранном' : 'В избранное'}
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join('');

  historyPageList.querySelectorAll('[data-show-history]').forEach((buttonElement) => {
    buttonElement.addEventListener('click', () => {
      const saved = items[Number(buttonElement.dataset.showHistory)];
      if (!saved?.payload) return;
      navigate('/');
      renderResult(saved.payload);
    });
  });

  historyPageList.querySelectorAll('[data-repeat-history]').forEach((buttonElement) => {
    buttonElement.addEventListener('click', () => {
      const saved = items[Number(buttonElement.dataset.repeatHistory)];
      analyzeRepository(saved?.repoUrl || saved?.payload?.repo?.url || '', { toast: 'Запускаю повторный анализ' });
    });
  });

  historyPageList.querySelectorAll('[data-toggle-history-favorite]').forEach((buttonElement) => {
    buttonElement.addEventListener('click', () => {
      const saved = items[Number(buttonElement.dataset.toggleHistoryFavorite)];
      toggleFavoriteFromSavedItem(saved);
      renderHistoryPage();
      renderFavoritesPage();
      syncFavoriteButton();
      renderProfile();
    });
  });
}

function toggleFavoriteFromSavedItem(item) {
  if (!item) return;
  const key = favoriteKeyForSavedItem(item);
  if (!key) return;

  const favorites = readFavorites();
  const existingIndex = favorites.findIndex((favorite) => favoriteKeyForSavedItem(favorite) === key);

  if (existingIndex >= 0) {
    favorites.splice(existingIndex, 1);
    saveFavorites(favorites);
    showToast('Удалено из избранного');
    return;
  }

  saveFavorites([normalizeFavoriteEntry(item), ...favorites].slice(0, 60));
  showToast('Добавлено в избранное');
}

function normalizeFavoriteEntry(item) {
  const payload = item.payload || {};
  return {
    repoUrl: item.repoUrl || payload.repo?.url || '',
    fullName: item.fullName || payload.repo?.fullName || item.repoUrl || '',
    summary: item.summary || payload.analysis?.shortSummary || payload.repo?.description || '',
    primaryLanguage: item.primaryLanguage || payload.repo?.primaryLanguage || normalizeArray(payload.languages)[0]?.name || '',
    score: Number(item.score || normalizeScore(payload.analysis?.score).value || 0),
    createdAt: item.createdAt || new Date().toISOString(),
    payload: compactPayload(payload)
  };
}

function isFavoriteSavedItem(item) {
  const key = favoriteKeyForSavedItem(item);
  return Boolean(key && readFavorites().some((favorite) => favoriteKeyForSavedItem(favorite) === key));
}

function favoriteKeyForSavedItem(item) {
  return item?.repoUrl || favoriteKeyFor(item?.payload || item) || item?.fullName || '';
}

function toggleCurrentFavorite() {
  if (!currentPayload) return;

  const repo = currentPayload.repo || {};
  const analysis = currentPayload.analysis || {};
  const key = favoriteKeyFor(currentPayload);
  if (!key) return;

  const favorites = readFavorites();
  const existingIndex = favorites.findIndex((item) => favoriteKeyFor(item.payload || item) === key || item.repoUrl === key);

  if (existingIndex >= 0) {
    favorites.splice(existingIndex, 1);
    saveFavorites(favorites);
    showToast('Удалено из избранного');
  } else {
    const score = normalizeScore(analysis.score);
    const nextItem = {
      repoUrl: repo.url || key,
      fullName: repo.fullName || repo.url || key,
      summary: analysis.shortSummary || repo.description || '',
      primaryLanguage: repo.primaryLanguage || normalizeArray(currentPayload.languages)[0]?.name || '',
      score: score.value,
      createdAt: new Date().toISOString(),
      payload: compactPayload(currentPayload)
    };

    saveFavorites([nextItem, ...favorites.filter((item) => item.repoUrl !== nextItem.repoUrl)].slice(0, 60));
    showToast('Добавлено в избранное');
  }

  syncFavoriteButton();
  renderFavoritesPage();
  renderProfile();
}

function syncFavoriteButton() {
  if (!favoriteToggleButton) return;
  const isFavorite = currentPayload ? isFavoritePayload(currentPayload) : false;
  favoriteToggleButton.textContent = isFavorite ? 'В избранном' : 'В избранное';
  favoriteToggleButton.classList.toggle('is-favorite', isFavorite);
}

function isFavoritePayload(payload) {
  const key = favoriteKeyFor(payload);
  return Boolean(key && readFavorites().some((item) => item.repoUrl === key || favoriteKeyFor(item.payload || item) === key));
}

function favoriteKeyFor(payload) {
  const repo = payload?.repo || {};
  return repo.url || repo.fullName || payload?.repoUrl || payload?.fullName || '';
}

function readFavorites() {
  if (!canUseAnalyzer()) return [];

  try {
    const parsed = JSON.parse(localStorage.getItem(favoritesKey) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveFavorites(items) {
  const nextItems = normalizeArray(items).map(compactSavedItem).slice(0, 80);
  localStorage.setItem(favoritesKey, JSON.stringify(nextItems));
  scheduleProfileStateSync();
}

function compactSavedItem(item) {
  if (!item || typeof item !== 'object') return item;
  return {
    ...item,
    payload: item.payload ? compactPayload(item.payload) : item.payload
  };
}

function compactPayload(payload) {
  if (!payload || typeof payload !== 'object') return payload;

  try {
    const copy = JSON.parse(JSON.stringify(payload));
    delete copy.rawAnalysis;
    return copy;
  } catch {
    const { rawAnalysis, ...copy } = payload;
    return copy;
  }
}

function renderFavoritesPage() {
  if (!favoritesPageList) return;
  const items = readFavorites();

  if (!items.length) {
    favoritesPageList.innerHTML = '<div class="history-empty">Пока нет избранных разборов. Откройте анализ и нажмите «В избранное».</div>';
    return;
  }

  favoritesPageList.innerHTML = items
    .map((item, index) => {
      const meta = getLanguageMeta(item.primaryLanguage || 'Code');
      const imageSrc = getLanguageImageSrc(item.primaryLanguage || 'Code', meta);
      return `
        <article class="favorite-card">
          <img class="history-card-visual" src="${escapeAttr(imageSrc)}" alt="Картинка языка ${escapeAttr(item.primaryLanguage || 'Code')}" />
          <div>
            <div class="history-card-top">
              <h2>${escapeHtml(item.fullName || item.repoUrl || 'Репозиторий')}</h2>
              <strong>${Number(item.score || 0) || '-'}/10</strong>
            </div>
            <p>${escapeHtml(item.summary || 'Краткое описание не сохранено.')}</p>
            <div class="history-card-meta">
              <span>${escapeHtml(item.primaryLanguage || 'язык не указан')}</span>
              <span>${formatDate(item.createdAt)}</span>
            </div>
            <div class="history-actions">
              <button type="button" data-show-favorite="${index}">Показать анализ</button>
              <button type="button" data-remove-favorite="${index}">Убрать</button>
            </div>
          </div>
        </article>
      `;
    })
    .join('');

  favoritesPageList.querySelectorAll('[data-show-favorite]').forEach((buttonElement) => {
    buttonElement.addEventListener('click', () => {
      const saved = readFavorites()[Number(buttonElement.dataset.showFavorite)];
      if (!saved?.payload) return;
      navigate('/');
      renderResult(saved.payload);
    });
  });

  favoritesPageList.querySelectorAll('[data-remove-favorite]').forEach((buttonElement) => {
    buttonElement.addEventListener('click', () => {
      const index = Number(buttonElement.dataset.removeFavorite);
      const favorites = readFavorites();
      favorites.splice(index, 1);
      saveFavorites(favorites);
      renderFavoritesPage();
      syncFavoriteButton();
      renderProfile();
      showToast('Удалено из избранного');
    });
  });
}

function setToolsTab(tab) {
  toolsState.activeTab = ['check', 'monitors', 'history'].includes(tab) ? tab : 'check';
  toolsTabButtons.forEach((buttonElement) => {
    const active = buttonElement.dataset.toolsTab === toolsState.activeTab;
    buttonElement.classList.toggle('is-active', active);
    buttonElement.setAttribute('aria-selected', String(active));
  });
  if (toolsCheckPanel) toolsCheckPanel.hidden = toolsState.activeTab !== 'check';
  if (toolsMonitorsPanel) toolsMonitorsPanel.hidden = toolsState.activeTab !== 'monitors';
  if (toolsHistoryPanel) toolsHistoryPanel.hidden = toolsState.activeTab !== 'history';
  renderTools();
  if (toolsState.activeTab !== 'check') loadToolsData();
}

async function loadToolsData(force = false) {
  if (!canUseAnalyzer()) {
    toolsState = { ...toolsState, history: [], monitors: [], incidents: [], loaded: false };
    renderTools();
    return;
  }

  if (toolsState.loaded && !force) return;

  try {
    const [historyResponse, monitorsResponse] = await Promise.all([
      fetch('/api/tools/history', { headers: { Accept: 'application/json' } }),
      fetch('/api/tools/monitors', { headers: { Accept: 'application/json' } })
    ]);
    const historyPayload = await readApiResponse(historyResponse);
    const monitorsPayload = await readApiResponse(monitorsResponse);

    if (!historyResponse.ok || !historyPayload.ok) throw new Error(historyPayload.error || 'Не удалось загрузить историю инструментов');
    if (!monitorsResponse.ok || !monitorsPayload.ok) throw new Error(monitorsPayload.error || 'Не удалось загрузить мониторы');

    toolsState.history = normalizeArray(historyPayload.checks);
    toolsState.monitors = normalizeArray(monitorsPayload.monitors);
    toolsState.incidents = normalizeArray(monitorsPayload.incidents);
    toolsState.loaded = true;
    renderTools();
  } catch (error) {
    showToolsError(error.message);
  }
}

async function runToolsCheck() {
  const url = String(toolsUrlInput?.value || '').trim();
  if (!url) return;
  if (!canUseAnalyzer()) {
    showToolsError(accessDeniedMessage());
    navigate('/profile');
    return;
  }

  const checks = getSelectedToolChecks();
  if (!checks.length) {
    showToolsError('Выберите хотя бы одну проверку.');
    return;
  }

  setToolsTab('check');
  setToolsLoading(true, 'Проверяю сайт', 'Доступность, SSL, DNS и HTML-аудит выполняются без AI-запросов.');
  hideToolsError();

  try {
    const response = await fetch('/api/tools/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, checks })
    });
    const payload = await readApiResponse(response);
    if (!response.ok || !payload.ok) throw new Error(payload.error || 'Не удалось выполнить проверку сайта');

    toolsState.lastCheck = payload.check;
    toolsState.history = [payload.check, ...toolsState.history.filter((item) => item.id !== payload.check.id)].slice(0, 220);
    toolsState.loaded = false;
    renderTools();
    showToast('Проверка сайта готова');
  } catch (error) {
    showToolsError(error.message);
  } finally {
    setToolsLoading(false);
  }
}

async function createToolMonitor() {
  const url = String(monitorUrlInput?.value || '').trim();
  const intervalMinutes = Number(monitorIntervalInput?.value || 5);
  if (!url) return;
  if (!canUseAnalyzer()) {
    showToolsError(accessDeniedMessage());
    navigate('/profile');
    return;
  }

  setToolsLoading(true, 'Создаю монитор', 'Сохраняю URL и расписание легкой uptime-проверки.');
  hideToolsError();

  try {
    const response = await fetch('/api/tools/monitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, intervalMinutes })
    });
    const payload = await readApiResponse(response);
    if (!response.ok || !payload.ok) throw new Error(payload.error || 'Не удалось создать монитор');

    monitorUrlInput.value = '';
    toolsState.loaded = false;
    await loadToolsData(true);
    setToolsTab('monitors');
    showToast('Монитор создан');
  } catch (error) {
    showToolsError(error.message);
  } finally {
    setToolsLoading(false);
  }
}

async function runToolMonitor(monitorId) {
  if (!monitorId) return;
  setToolsLoading(true, 'Проверяю монитор', 'Запускаю быстрый uptime-прогон: доступность, порт и SSL.');
  hideToolsError();

  try {
    const response = await fetch(`/api/tools/monitors/${encodeURIComponent(monitorId)}/run`, {
      method: 'POST',
      headers: { Accept: 'application/json' }
    });
    const payload = await readApiResponse(response);
    if (!response.ok || !payload.ok) throw new Error(payload.error || 'Не удалось запустить монитор');

    toolsState.lastCheck = payload.check;
    toolsState.loaded = false;
    await loadToolsData(true);
    renderTools();
    showToast('Монитор проверен');
  } catch (error) {
    showToolsError(error.message);
  } finally {
    setToolsLoading(false);
  }
}

async function toggleToolMonitor(monitorId, active) {
  if (!monitorId) return;

  try {
    const response = await fetch(`/api/tools/monitors/${encodeURIComponent(monitorId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active })
    });
    const payload = await readApiResponse(response);
    if (!response.ok || !payload.ok) throw new Error(payload.error || 'Не удалось обновить монитор');

    toolsState.loaded = false;
    await loadToolsData(true);
    showToast(active ? 'Монитор включен' : 'Монитор остановлен');
  } catch (error) {
    showToolsError(error.message);
  }
}

async function deleteToolMonitor(monitorId) {
  if (!monitorId) return;

  try {
    const response = await fetch(`/api/tools/monitors/${encodeURIComponent(monitorId)}`, {
      method: 'DELETE',
      headers: { Accept: 'application/json' }
    });
    const payload = await readApiResponse(response);
    if (!response.ok || !payload.ok) throw new Error(payload.error || 'Не удалось удалить монитор');

    toolsState.loaded = false;
    await loadToolsData(true);
    showToast('Монитор удален');
  } catch (error) {
    showToolsError(error.message);
  }
}

function getSelectedToolChecks() {
  return [...document.querySelectorAll('input[name="tool-check"]:checked')]
    .map((inputElement) => inputElement.value)
    .filter(Boolean);
}

function setToolsLoading(isLoading, title = 'Проверяю сайт', copy = 'Запускаю сетевые проверки без AI-запросов.') {
  if (toolsRunButton) toolsRunButton.disabled = isLoading || !canUseAnalyzer();
  if (monitorCreateButton) monitorCreateButton.disabled = isLoading || !canUseAnalyzer();
  if (toolsStatus) toolsStatus.hidden = !isLoading;
  if (toolsStatusTitle) toolsStatusTitle.textContent = title;
  if (toolsStatusCopy) toolsStatusCopy.textContent = copy;
}

function showToolsError(message) {
  if (!toolsError || !toolsErrorCopy) return;
  toolsErrorCopy.textContent = message;
  toolsError.hidden = false;
}

function hideToolsError() {
  if (!toolsError || !toolsErrorCopy) return;
  toolsError.hidden = true;
  toolsErrorCopy.textContent = '';
}

function renderTools() {
  updateToolsAccessUI();
  renderToolsResult();
  renderToolsHistory();
  renderToolMonitors();
}

function renderToolsResult() {
  if (!toolsResult) return;
  const check = toolsState.lastCheck;

  if (!check) {
    toolsResult.innerHTML = `
      <div class="tools-empty">
        <strong>Проверка сайта появится здесь</strong>
        <p>Введите публичный URL, выберите нужные модули и запустите аудит. Grok не вызывается, AI-токены остаются на нуле.</p>
      </div>
    `;
    return;
  }

  const summary = check.summary || {};
  toolsResult.innerHTML = `
    <div class="tools-summary">
      <div>
        <span class="tool-status ${toolStatusClass(summary.status)}">${escapeHtml(toolStatusLabel(summary.status))}</span>
        <h2>${escapeHtml(check.hostname || check.url)}</h2>
        <p>${escapeHtml(summary.label || 'Проверка выполнена')}</p>
      </div>
      <div class="tools-summary-metrics">
        ${renderToolMetric('HTTP', summary.statusCode || '-')}
        ${renderToolMetric('Время', summary.responseTimeMs ? `${summary.responseTimeMs} мс` : '-')}
        ${renderToolMetric('Длительность', check.durationMs ? `${check.durationMs} мс` : '-')}
        ${renderToolMetric('AI токены', '0')}
      </div>
    </div>
    <div class="tools-result-grid">
      ${renderAvailabilityCard(check.availability)}
      ${renderPortCard(check.port)}
      ${renderSslCard(check.ssl)}
      ${renderDnsCard(check.dns)}
      ${renderSeoCard(check.seo)}
      ${renderSecurityCard(check.security)}
      ${renderWordPressCard(check.wordpress)}
      ${renderPageSpeedCard(check.pagespeed)}
    </div>
  `;
}

function renderAvailabilityCard(data) {
  if (!data) return '';
  return renderToolCard('Доступность', data.error ? 'down' : data.reachable ? 'ok' : 'warning', [
    ['Статус', data.statusCode || data.error || '-'],
    ['Ответ', data.responseTimeMs ? `${data.responseTimeMs} мс` : '-'],
    ['Редиректы', data.redirectCount ?? 0],
    ['Финальный URL', data.finalUrl || '-']
  ], data.redirects?.length ? data.redirects.map((item) => `${item.statusCode}: ${item.from} -> ${item.to}`).slice(0, 4) : []);
}

function renderPortCard(data) {
  if (!data) return '';
  return renderToolCard('Порт', data.open ? 'ok' : 'down', [
    ['Порт', data.port || '-'],
    ['Протокол', data.protocol || '-'],
    ['Ответ', data.responseTimeMs ? `${data.responseTimeMs} мс` : '-'],
    ['Ошибка', data.error || '-']
  ]);
}

function renderSslCard(data) {
  if (!data) return '';
  const status = data.ok ? (Number(data.daysLeft) < 14 ? 'warning' : 'ok') : 'warning';
  return renderToolCard('SSL', status, [
    ['Авторизация', data.authorized ? 'да' : data.available === false ? 'нет HTTPS' : 'нет'],
    ['До окончания', data.daysLeft ?? '-'],
    ['Issuer', data.issuer || '-'],
    ['SAN', normalizeArray(data.san).slice(0, 3).join(', ') || '-']
  ], [data.warning, data.authorizationError, data.error].filter(Boolean));
}

function renderDnsCard(data) {
  if (!data) return '';
  const records = data.records || {};
  const lines = [
    ['A', summarizeDnsValues(records.A)],
    ['AAAA', summarizeDnsValues(records.AAAA)],
    ['NS', summarizeDnsValues(records.NS)],
    ['MX', summarizeDnsValues(records.MX)],
    ['TXT', normalizeArray(records.TXT).length],
    ['CAA', normalizeArray(records.CAA).length]
  ];
  return renderToolCard('DNS', data.ok ? 'ok' : 'warning', [['Latency', data.latencyMs ? `${data.latencyMs} мс` : '-'], ...lines]);
}

function renderSeoCard(data) {
  if (!data) return '';
  return renderToolCard('SEO', data.ok ? 'ok' : 'warning', [
    ['Title', data.title || '-'],
    ['Description', data.description ? truncateText(data.description, 90) : '-'],
    ['H1', normalizeArray(data.h1).length],
    ['Indexable', data.indexable ? 'да' : 'нет'],
    ['Sitemap', data.sitemap?.found ? `${data.sitemap.urlCount || data.sitemap.sitemapCount || 0} URL` : 'не найден']
  ], data.error ? [data.error] : normalizeArray(data.warnings));
}

function renderSecurityCard(data) {
  if (!data) return '';
  return renderToolCard('Security', data.ok ? 'ok' : 'warning', [
    ['Нет headers', normalizeArray(data.missingHeaders).length],
    ['Mixed content', normalizeArray(data.mixedContent).length],
    ['Exposed paths', normalizeArray(data.exposed).length],
    ['Directory listing', data.directoryListing ? 'да' : 'нет']
  ], data.error ? [data.error] : normalizeArray(data.warnings));
}

function renderWordPressCard(data) {
  if (!data) return '';
  return renderToolCard('WordPress', data.detected ? 'ok' : 'neutral', [
    ['Обнаружен', data.detected ? 'да' : 'нет'],
    ['Темы', normalizeArray(data.themeCandidates).slice(0, 3).join(', ') || '-'],
    ['Плагины', normalizeArray(data.pluginCandidates).slice(0, 4).join(', ') || '-'],
    ['REST API', data.endpoints?.['/wp-json/'] || '-']
  ], data.error ? [data.error] : normalizeArray(data.warnings));
}

function renderPageSpeedCard(data) {
  if (!data) return '';
  if (!data.available) {
    return renderToolCard('PageSpeed', 'neutral', [['Статус', 'API key не настроен']], [data.message]);
  }

  const mobile = data.results?.mobile || {};
  const desktop = data.results?.desktop || {};
  const notes = [
    data.note,
    mobile.error ? `Mobile: ${mobile.error}` : '',
    desktop.error ? `Desktop: ${desktop.error}` : '',
    ...normalizeArray(mobile.runWarnings).map((item) => `Mobile warning: ${item}`),
    ...normalizeArray(desktop.runWarnings).map((item) => `Desktop warning: ${item}`)
  ].filter(Boolean);

  return renderToolCard('PageSpeed', data.ok ? 'ok' : 'warning', [
    ['Mobile perf', formatScorePercent(mobile.performanceScore)],
    ['Desktop perf', formatScorePercent(desktop.performanceScore)],
    ['SEO mobile', formatScorePercent(mobile.seoScore)],
    ['Best practices', formatScorePercent(mobile.bestPracticesScore)],
    ['Accessibility', formatScorePercent(mobile.accessibilityScore)],
    ['LCP mobile', mobile.metrics?.largestContentfulPaint || '-'],
    ['Speed Index', mobile.metrics?.speedIndex || '-'],
    ['TBT mobile', mobile.metrics?.totalBlockingTime || '-']
  ], notes);
}

function formatScorePercent(value) {
  return value === 0 || value ? `${value}/100` : '-';
}

function renderToolCard(title, status, metrics, notes = []) {
  return `
    <article class="tool-card">
      <div class="tool-card-top">
        <h3>${escapeHtml(title)}</h3>
        <span class="tool-status ${toolStatusClass(status)}">${escapeHtml(toolStatusLabel(status))}</span>
      </div>
      <dl>
        ${metrics
          .map(([label, value]) => `
            <div>
              <dt>${escapeHtml(label)}</dt>
              <dd>${escapeHtml(String(value ?? '-'))}</dd>
            </div>
          `)
          .join('')}
      </dl>
      ${normalizeArray(notes).length ? `<ul>${normalizeArray(notes).slice(0, 6).map((note) => `<li>${escapeHtml(note)}</li>`).join('')}</ul>` : ''}
    </article>
  `;
}

function renderToolMetric(label, value) {
  return `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>`;
}

function renderToolsHistory() {
  if (!toolsHistoryList) return;
  const items = normalizeArray(toolsState.history);

  if (!items.length) {
    toolsHistoryList.innerHTML = '<div class="history-empty">История проверок пока пустая.</div>';
    return;
  }

  toolsHistoryList.innerHTML = items
    .slice(0, 80)
    .map((item, index) => `
      <article class="tool-history-item">
        <div>
          <span class="tool-status ${toolStatusClass(item.summary?.status)}">${escapeHtml(toolStatusLabel(item.summary?.status))}</span>
          <h3>${escapeHtml(item.hostname || item.url)}</h3>
          <p>${escapeHtml(item.summary?.label || 'Проверка выполнена')}</p>
          <small>${escapeHtml(formatDate(item.checkedAt))} · ${escapeHtml(item.mode || 'manual')} · AI токены: 0</small>
        </div>
        <button type="button" data-show-tool-history="${index}">Открыть</button>
      </article>
    `)
    .join('');

  toolsHistoryList.querySelectorAll('[data-show-tool-history]').forEach((buttonElement) => {
    buttonElement.addEventListener('click', () => {
      const check = items[Number(buttonElement.dataset.showToolHistory)];
      if (!check) return;
      toolsState.lastCheck = check;
      setToolsTab('check');
      renderTools();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

function renderToolMonitors() {
  if (!monitorsList || !incidentsList) return;
  const monitors = normalizeArray(toolsState.monitors);
  const incidents = normalizeArray(toolsState.incidents);

  if (!monitors.length) {
    monitorsList.innerHTML = '<div class="history-empty">Мониторов пока нет. Создайте первый, чтобы сайт проверялся по расписанию.</div>';
  } else {
    monitorsList.innerHTML = monitors
      .map((monitor) => `
        <article class="monitor-card">
          <div>
            <span class="tool-status ${toolStatusClass(monitor.lastStatus)}">${escapeHtml(toolStatusLabel(monitor.lastStatus))}</span>
            <h3>${escapeHtml(monitor.hostname || monitor.url)}</h3>
            <p>${escapeHtml(monitor.lastSummary || 'Ожидает проверки')}</p>
            <small>Каждые ${escapeHtml(String(monitor.intervalMinutes || 5))} мин · последняя: ${escapeHtml(monitor.lastCheckedAt ? formatDate(monitor.lastCheckedAt) : 'нет')}</small>
          </div>
          <div class="monitor-actions">
            <button type="button" data-run-monitor="${escapeAttr(monitor.id)}">Проверить</button>
            <button type="button" data-toggle-monitor="${escapeAttr(monitor.id)}" data-active="${monitor.active ? '0' : '1'}">${monitor.active ? 'Пауза' : 'Включить'}</button>
            <button type="button" data-delete-monitor="${escapeAttr(monitor.id)}">Удалить</button>
          </div>
        </article>
      `)
      .join('');
  }

  incidentsList.innerHTML = `
    <h2>Инциденты</h2>
    ${
      incidents.length
        ? incidents
            .slice(0, 30)
            .map((incident) => `
              <article class="incident-card ${incident.status === 'open' ? 'is-open' : ''}">
                <div>
                  <strong>${escapeHtml(incident.status === 'open' ? 'Открыт' : 'Закрыт')}</strong>
                  <span>${escapeHtml(incident.url || '')}</span>
                  <p>${escapeHtml(incident.message || incident.recoveryMessage || '')}</p>
                  <small>${escapeHtml(formatDate(incident.openedAt))}${incident.closedAt ? ` -> ${escapeHtml(formatDate(incident.closedAt))}` : ''}</small>
                </div>
              </article>
            `)
            .join('')
        : '<div class="history-empty">Инцидентов нет.</div>'
    }
  `;

  monitorsList.querySelectorAll('[data-run-monitor]').forEach((buttonElement) => {
    buttonElement.addEventListener('click', () => runToolMonitor(buttonElement.dataset.runMonitor));
  });
  monitorsList.querySelectorAll('[data-toggle-monitor]').forEach((buttonElement) => {
    buttonElement.addEventListener('click', () => toggleToolMonitor(buttonElement.dataset.toggleMonitor, buttonElement.dataset.active === '1'));
  });
  monitorsList.querySelectorAll('[data-delete-monitor]').forEach((buttonElement) => {
    buttonElement.addEventListener('click', () => deleteToolMonitor(buttonElement.dataset.deleteMonitor));
  });
}

function summarizeDnsValues(values) {
  const items = normalizeArray(values);
  if (!items.length) return '-';
  if (typeof items[0] === 'object') return items.map((item) => item.address || item.exchange || item.value || JSON.stringify(item)).slice(0, 3).join(', ');
  return items.slice(0, 3).join(', ');
}

function toolStatusClass(status) {
  if (status === 'ok') return 'is-ok';
  if (status === 'down') return 'is-down';
  if (status === 'warning') return 'is-warning';
  return 'is-neutral';
}

function toolStatusLabel(status) {
  if (status === 'ok') return 'OK';
  if (status === 'down') return 'Down';
  if (status === 'warning') return 'Warning';
  if (status === 'pending') return 'Pending';
  return 'Info';
}

async function compareRepositories(repoA, repoB) {
  const firstRepo = String(repoA || '').trim();
  const secondRepo = String(repoB || '').trim();

  if (!firstRepo || !secondRepo) return;

  if (!canUseAnalyzer()) {
    showCompareError(accessDeniedMessage());
    navigate('/profile');
    return;
  }

  compareButton.disabled = true;
  compareButton.textContent = 'Сравниваю...';
  compareStatus.hidden = false;
  compareError.hidden = true;
  compareResults.hidden = true;

  try {
    const response = await fetch('/api/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoA: firstRepo, repoB: secondRepo })
    });
    const payload = await readApiResponse(response);
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || 'Не удалось сравнить репозитории');
    }

    renderComparison(payload);
  } catch (error) {
    showCompareError(error.message);
  } finally {
    compareButton.disabled = false;
    compareButton.textContent = 'Сравнить';
    compareStatus.hidden = true;
  }
}

function showCompareError(message) {
  if (!compareError || !compareErrorCopy) return;
  compareErrorCopy.textContent = message;
  compareError.hidden = false;
}

function renderComparison(payload) {
  if (!compareResults) return;

  const comparison = payload.comparison || {};
  const repos = payload.repos || [];
  const winner = comparison.recommendation || {};
  const dimensions = normalizeArray(comparison.dimensions);
  const shared = normalizeArray(comparison.sharedStrengths);
  const tradeoffs = normalizeArray(comparison.tradeoffs);

  compareResults.innerHTML = `
    <div class="compare-summary">
      ${repos
        .map((repo, index) => `
          <article>
            <span>${index === 0 ? 'Первый' : 'Второй'} репозиторий</span>
            <strong>${escapeHtml(repo.fullName || repo.url || 'Репозиторий')}</strong>
            <p>${escapeHtml(repo.description || repo.primaryLanguage || 'Описание не найдено')}</p>
          </article>
        `)
        .join('')}
      <article>
        <span>Рекомендация</span>
        <strong>${escapeHtml(winner.choice || 'Зависит от задачи')}</strong>
        <p>${escapeHtml(winner.reason || comparison.summary || 'Сравнение готово.')}</p>
      </article>
    </div>

    <div class="compare-grid">
      <article class="result-card span-2">
        <h3>Главный вывод</h3>
        <p>${escapeHtml(comparison.summary || 'Репозитории отличаются стеком, зрелостью и назначением.')}</p>
      </article>
      ${dimensions
        .slice(0, 8)
        .map((item) => `
          <article class="result-card compare-dimension">
            <h3>${escapeHtml(item.name || 'Критерий')}</h3>
            <div>
              <strong>${escapeHtml(repos[0]?.fullName || 'Первый')}</strong>
              <p>${escapeHtml(item.repoA || item.first || '')}</p>
            </div>
            <div>
              <strong>${escapeHtml(repos[1]?.fullName || 'Второй')}</strong>
              <p>${escapeHtml(item.repoB || item.second || '')}</p>
            </div>
          </article>
        `)
        .join('')}
      <article class="result-card">
        <h3>Общие сильные стороны</h3>
        <ul>${(shared.length ? shared : ['Не выделены']).map((item) => `<li>${escapeHtml(String(item))}</li>`).join('')}</ul>
      </article>
      <article class="result-card">
        <h3>Компромиссы</h3>
        <ul>${(tradeoffs.length ? tradeoffs : ['Не выделены']).map((item) => `<li>${escapeHtml(String(item))}</li>`).join('')}</ul>
      </article>
    </div>
  `;

  compareResults.hidden = false;
  compareResults.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function loadProfile() {
  try {
    const response = await fetch('/api/me', { headers: { Accept: 'application/json' } });
    const payload = await response.json();
    authState = {
      authenticated: Boolean(payload.authenticated),
      user: payload.user || null,
      canAnalyze: Boolean(payload.canAnalyze),
      allowedLogin: payload.allowedLogin || 'Zulut30',
      oauthConfigured: Boolean(payload.oauthConfigured)
    };
  } catch {
    authState = { authenticated: false, user: null, canAnalyze: false, allowedLogin: 'Zulut30', oauthConfigured: false, error: true };
  }

  if (!authState.authenticated) {
    profileReposState = { status: 'idle', repositories: [], error: '' };
    profileActivityState = { status: 'idle', user: null, events: [], summary: null, error: '' };
    profileStateStatus = 'idle';
    profileStateLoadedFor = '';
  }

  renderProfile();
  updateHeaderProfile();
  updateAnalyzeAccessUI();
  if (canUseAnalyzer()) {
    const loginKey = String(authState.user?.login || '').toLowerCase();
    if (profileStateLoadedFor !== loginKey && profileStateStatus !== 'loading') {
      loadProfileState();
    }
    if (profileReposState.status === 'idle') {
      loadProfileRepositories();
    }
    if (profileActivityState.status === 'idle') {
      loadProfileActivity();
    }
  }
}

async function loadProfileActivity() {
  if (!canUseAnalyzer()) return;

  profileActivityState = { status: 'loading', user: profileActivityState.user, events: [], summary: null, error: '' };
  renderProfile();

  try {
    const response = await fetch('/api/profile/activity', { headers: { Accept: 'application/json' } });
    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || 'Не удалось загрузить активность GitHub');
    }

    profileActivityState = {
      status: 'ready',
      user: payload.user || null,
      events: Array.isArray(payload.events) ? payload.events : [],
      summary: payload.summary || null,
      error: ''
    };

    if (payload.user) {
      authState = {
        ...authState,
        user: {
          ...(authState.user || {}),
          ...payload.user
        }
      };
      updateHeaderProfile();
    }
  } catch (error) {
    profileActivityState = {
      status: 'error',
      user: profileActivityState.user,
      events: [],
      summary: null,
      error: error.message || 'Не удалось загрузить активность GitHub'
    };
  }

  renderProfile();
}

async function loadProfileRepositories() {
  profileReposState = { status: 'loading', repositories: [], error: '' };
  renderProfile();

  try {
    const response = await fetch('/api/profile/repos', { headers: { Accept: 'application/json' } });
    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || 'Не удалось загрузить репозитории');
    }

    profileReposState = {
      status: 'ready',
      repositories: Array.isArray(payload.repositories) ? payload.repositories : [],
      error: ''
    };
  } catch (error) {
    profileReposState = {
      status: 'error',
      repositories: [],
      error: error.message || 'Не удалось загрузить репозитории'
    };
  }

  renderProfile();
}

async function loadProfileState() {
  if (!canUseAnalyzer()) return;

  const loginKey = String(authState.user?.login || authState.allowedLogin || '').toLowerCase();
  profileStateStatus = 'loading';
  renderProfile();

  try {
    const localHistory = readHistory();
    const localFavorites = readFavorites();
    const response = await fetch('/api/profile/state', { headers: { Accept: 'application/json' } });
    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || 'Не удалось загрузить историю профиля');
    }

    const remoteState = payload.state || {};
    const history = mergeStoredItems(remoteState.history, localHistory).map(compactSavedItem).slice(0, 80);
    const favorites = mergeStoredItems(remoteState.favorites, localFavorites).map(compactSavedItem).slice(0, 80);
    const changed =
      history.length !== normalizeArray(remoteState.history).length ||
      favorites.length !== normalizeArray(remoteState.favorites).length;

    localStorage.setItem(historyKey, JSON.stringify(history));
    localStorage.setItem(favoritesKey, JSON.stringify(favorites));
    profileStateStatus = 'ready';
    profileStateLoadedFor = loginKey;

    renderAllHistory();
    renderFavoritesPage();
    syncFavoriteButton();
    renderProfile();

    if (changed) scheduleProfileStateSync();
  } catch (error) {
    profileStateStatus = 'error';
    profileStateLoadedFor = loginKey;
    showToast(error.message || 'Не удалось загрузить историю профиля');
    renderProfile();
  }
}

function scheduleProfileStateSync() {
  if (!canUseAnalyzer()) return;
  window.clearTimeout(profileStateTimer);
  profileStateTimer = window.setTimeout(syncProfileState, 350);
}

async function syncProfileState() {
  if (!canUseAnalyzer()) return;

  try {
    const response = await fetch('/api/profile/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        state: {
          history: readHistory().map(compactSavedItem).slice(0, 80),
          favorites: readFavorites().map(compactSavedItem).slice(0, 80)
        }
      })
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || 'Не удалось сохранить историю профиля');
    }

    profileStateStatus = 'ready';
  } catch (error) {
    profileStateStatus = 'error';
    showToast(error.message || 'Не удалось сохранить историю профиля');
  } finally {
    renderProfile();
  }
}

function mergeStoredItems(primary, secondary) {
  const merged = [];
  const seen = new Set();

  for (const item of [...normalizeArray(primary), ...normalizeArray(secondary)]) {
    const compactItem = compactSavedItem(item);
    const key = favoriteKeyForSavedItem(compactItem) || JSON.stringify(compactItem);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(compactItem);
  }

  return merged;
}

function renderProfileStateNotice() {
  if (!canUseAnalyzer()) return '';

  const login = authState.user?.login || authState.allowedLogin || 'Zulut30';
  const messages = {
    loading: `История и избранное загружаются из профиля @${login}.`,
    ready: `История и избранное привязаны к профилю @${login}.`,
    error: `Не удалось синхронизировать историю профиля @${login}. Локальная копия останется доступной.`
  };

  const text = messages[profileStateStatus] || messages.ready;
  return `<div class="profile-sync">${escapeHtml(text)}</div>`;
}

function getProfileDisplayUser() {
  return {
    ...(authState.user || {}),
    ...(profileActivityState.user || {})
  };
}

function calculateProfileRepoSummary(repositories) {
  const summary = {
    total: repositories.length,
    privateCount: 0,
    publicCount: 0,
    forkCount: 0,
    archivedCount: 0,
    stars: 0,
    forks: 0,
    languages: []
  };
  const languages = new Map();

  repositories.forEach((repo) => {
    if (repo.private) summary.privateCount += 1;
    else summary.publicCount += 1;
    if (repo.fork) summary.forkCount += 1;
    if (repo.archived) summary.archivedCount += 1;
    summary.stars += Number(repo.stars || 0);
    summary.forks += Number(repo.forks || 0);

    const language = repo.primaryLanguage || 'Не указан';
    const current = languages.get(language) || { name: language, count: 0, stars: 0 };
    current.count += 1;
    current.stars += Number(repo.stars || 0);
    languages.set(language, current);
  });

  summary.languages = [...languages.values()].sort((a, b) => b.count - a.count || b.stars - a.stars).slice(0, 6);
  return summary;
}

function renderProfileHero(user) {
  const profileUrl = user.profileUrl || (user.login ? `https://github.com/${user.login}` : '');
  const badges = [
    user.company ? `Компания: ${escapeHtml(user.company)}` : '',
    user.location ? `Локация: ${escapeHtml(user.location)}` : '',
    user.blog ? `<a href="${escapeAttr(normalizeProfileLink(user.blog))}" target="_blank" rel="noreferrer">${escapeHtml(cleanProfileLinkLabel(user.blog))}</a>` : '',
    user.createdAt ? `С GitHub с ${escapeHtml(formatMonthYear(user.createdAt))}` : ''
  ].filter(Boolean);
  const activityTotal = profileActivityState.status === 'loading'
    ? '...'
    : formatNumber(profileActivityState.summary?.total || profileActivityState.events.length || 0);

  return `
    <div class="profile-hero">
      <div class="profile-avatar-wrap">
        <img src="${escapeAttr(user.avatarUrl || getEmojiImageSrc('github'))}" alt="" />
      </div>
      <div class="profile-identity">
        <span>GitHub профиль</span>
        <h2>${escapeHtml(user.name || user.login || 'GitHub user')}</h2>
        ${user.login ? `<a class="profile-login" href="${escapeAttr(profileUrl)}" target="_blank" rel="noreferrer">@${escapeHtml(user.login)}</a>` : ''}
        <p>${escapeHtml(user.bio || 'Личный профиль RepoScope для анализа репозиториев, истории, избранного и быстрой работы с GitHub.')}</p>
        ${badges.length ? `<div class="profile-badges">${badges.map((badge) => `<span>${badge}</span>`).join('')}</div>` : ''}
      </div>
      <div class="profile-highlight-card">
        <span>Недавняя активность</span>
        <strong>${activityTotal}</strong>
        <small>событий GitHub</small>
      </div>
    </div>
  `;
}

function renderProfileStats(historyCount, favoritesCount, repoSummary, user) {
  const repoTotal = profileReposState.status === 'loading' && !repoSummary.total ? '...' : formatNumber(repoSummary.total);
  const followers = user.followers || user.followers === 0 ? formatNumber(user.followers) : '-';

  return `
    <div class="profile-stats">
      <div><span>История</span><strong>${formatNumber(historyCount)}</strong></div>
      <div><span>Избранное</span><strong>${formatNumber(favoritesCount)}</strong></div>
      <div><span>Репозитории</span><strong>${repoTotal}</strong></div>
      <div><span>Приватные</span><strong>${formatNumber(repoSummary.privateCount)}</strong></div>
      <div><span>Stars</span><strong>${formatNumber(repoSummary.stars)}</strong></div>
      <div><span>Followers</span><strong>${followers}</strong></div>
    </div>
  `;
}

function renderProfileShowcase(repoSummary) {
  if (!canUseAnalyzer()) return '';

  const activitySummary = profileActivityState.summary || {};
  const languageRows = repoSummary.languages.length
    ? repoSummary.languages.map((language) => {
        const meta = getLanguageMeta(language.name);
        const percent = repoSummary.total ? Math.max(8, Math.round((language.count / repoSummary.total) * 100)) : 8;
        return `
          <div class="profile-language-row">
            <span>${escapeHtml(language.name)}</span>
            <div><i style="--language-color: ${escapeAttr(meta.color)}; width: ${percent}%"></i></div>
            <strong>${formatNumber(language.count)}</strong>
          </div>
        `;
      }).join('')
    : `<div class="profile-empty-inline">${profileReposState.status === 'loading' ? 'Загружаю языки репозиториев...' : 'Языки появятся после загрузки репозиториев.'}</div>`;

  return `
    <section class="profile-showcase">
      <div class="profile-section-heading">
        <div>
          <h3>Портфель разработчика</h3>
          <p>Сводка считается локально из GitHub-репозиториев и не расходует токены AI.</p>
        </div>
      </div>
      <div class="profile-showcase-grid">
        <div class="profile-mini-panel">
          <span>Репозитории</span>
          <strong>${profileReposState.status === 'loading' && !repoSummary.total ? '...' : formatNumber(repoSummary.total)}</strong>
          <small>${formatNumber(repoSummary.publicCount)} публичных / ${formatNumber(repoSummary.privateCount)} приватных</small>
        </div>
        <div class="profile-mini-panel">
          <span>Кодовая база</span>
          <strong>${formatNumber(repoSummary.stars)}</strong>
          <small>${formatNumber(repoSummary.forks)} forks, ${formatNumber(repoSummary.archivedCount)} архивных</small>
        </div>
        <div class="profile-mini-panel">
          <span>Лента</span>
          <strong>${profileActivityState.status === 'loading' ? '...' : formatNumber(activitySummary.total || 0)}</strong>
          <small>${formatNumber(activitySummary.repositoriesTouched || 0)} репозиториев затронуто</small>
        </div>
      </div>
      <div class="profile-language-list">${languageRows}</div>
    </section>
  `;
}

function renderProfileActivity() {
  if (!canUseAnalyzer()) return '';

  if (profileActivityState.status === 'loading') {
    return `
      <section class="profile-activity">
        <div class="profile-section-heading">
          <div>
            <h3>Активность GitHub</h3>
            <p>Загружаю свежие события профиля.</p>
          </div>
        </div>
        <div class="profile-repo-empty">Загрузка активности...</div>
      </section>
    `;
  }

  if (profileActivityState.status === 'error') {
    return `
      <section class="profile-activity">
        <div class="profile-section-heading">
          <div>
            <h3>Активность GitHub</h3>
            <p>GitHub Events API сейчас не отдал ленту.</p>
          </div>
          <button type="button" class="secondary-button" id="refresh-profile-activity">Повторить</button>
        </div>
        <div class="profile-repo-empty">${escapeHtml(profileActivityState.error)}</div>
      </section>
    `;
  }

  const events = profileActivityState.events.slice(0, 12);
  const content = events.length
    ? `<div class="activity-list">${events.map(renderActivityItem).join('')}</div>`
    : '<div class="profile-repo-empty">GitHub не вернул недавнюю публичную активность за последние дни.</div>';

  return `
    <section class="profile-activity">
      <div class="profile-section-heading">
        <div>
          <h3>Активность GitHub</h3>
          <p>Недавние события из GitHub Events API. Лента может обновляться с задержкой.</p>
        </div>
        <button type="button" class="secondary-button" id="refresh-profile-activity">Обновить</button>
      </div>
      ${content}
    </section>
  `;
}

function renderActivityItem(event) {
  return `
    <article class="activity-item">
      <span class="activity-icon">${escapeHtml(eventTypeLabel(event.type))}</span>
      <div class="activity-content">
        <div class="activity-title">
          <a href="${escapeAttr(event.url || event.repoUrl || '#')}" target="_blank" rel="noreferrer">${escapeHtml(event.title || event.repoName || 'GitHub event')}</a>
          <time datetime="${escapeAttr(event.createdAt || '')}">${escapeHtml(formatRelativeTime(event.createdAt))}</time>
        </div>
        <p>${escapeHtml(event.detail || 'Событие GitHub')}</p>
        ${event.repoName ? `<a class="activity-repo" href="${escapeAttr(event.repoUrl)}" target="_blank" rel="noreferrer">${escapeHtml(event.repoName)}</a>` : ''}
      </div>
    </article>
  `;
}

function eventTypeLabel(type) {
  const labels = {
    PushEvent: 'Push',
    PullRequestEvent: 'PR',
    IssuesEvent: 'Issue',
    IssueCommentEvent: 'Comment',
    CreateEvent: 'Create',
    ForkEvent: 'Fork',
    WatchEvent: 'Star'
  };
  return labels[type] || String(type || 'Event').replace(/Event$/, '') || 'Event';
}

function formatRelativeTime(value) {
  if (!value) return 'дата не указана';
  const date = new Date(value);
  const diffMs = date.getTime() - Date.now();
  const absMs = Math.abs(diffMs);
  const divisions = [
    { amount: 60 * 1000, unit: 'second' },
    { amount: 60 * 60 * 1000, unit: 'minute' },
    { amount: 24 * 60 * 60 * 1000, unit: 'hour' },
    { amount: 7 * 24 * 60 * 60 * 1000, unit: 'day' },
    { amount: 30 * 24 * 60 * 60 * 1000, unit: 'week' }
  ];
  const formatter = new Intl.RelativeTimeFormat('ru-RU', { numeric: 'auto' });

  if (absMs < divisions[0].amount) return formatter.format(Math.round(diffMs / 1000), 'second');
  if (absMs < divisions[1].amount) return formatter.format(Math.round(diffMs / divisions[0].amount), 'minute');
  if (absMs < divisions[2].amount) return formatter.format(Math.round(diffMs / divisions[1].amount), 'hour');
  if (absMs < divisions[3].amount) return formatter.format(Math.round(diffMs / divisions[2].amount), 'day');
  if (absMs < divisions[4].amount) return formatter.format(Math.round(diffMs / divisions[3].amount), 'week');
  return formatDate(value);
}

function formatMonthYear(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('ru-RU', {
    month: 'long',
    year: 'numeric'
  }).format(new Date(value));
}

function normalizeProfileLink(value) {
  const text = String(value || '').trim();
  if (!text) return '#';
  return /^https?:\/\//i.test(text) ? text : `https://${text}`;
}

function cleanProfileLinkLabel(value) {
  return String(value || '').replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

function renderProfile() {
  if (!profileCard) return;

  const historyCount = readHistory().length;
  const favoritesCount = readFavorites().length;
  const authStatus = new URLSearchParams(window.location.search).get('auth');
  const statusText = profileStatusText(authStatus);

  if (authState.authenticated && authState.user) {
    const user = getProfileDisplayUser();
    const repoSummary = calculateProfileRepoSummary(profileReposState.repositories);
    profileCard.innerHTML = `
      ${statusText ? `<div class="profile-notice">${escapeHtml(statusText)}</div>` : ''}
      ${renderProfileHero(user)}
      ${renderProfileStats(historyCount, favoritesCount, repoSummary, user)}
      ${renderProfileStateNotice()}
      ${canUseAnalyzer() ? `${renderProfileShowcase(repoSummary)}${renderProfileActivity()}${renderProfileRepositories()}` : renderProfileAccessBlocked()}
      <form class="profile-actions" method="post" action="/auth/logout">
        <button type="submit">Выйти</button>
      </form>
    `;
    attachProfileRepoEvents();
    return;
  }

  if (!authState.oauthConfigured) {
    profileCard.innerHTML = `
      ${statusText ? `<div class="profile-notice">${escapeHtml(statusText)}</div>` : ''}
      <div class="profile-user">
        <img src="${escapeAttr(getEmojiImageSrc('github'))}" alt="" />
        <div>
          <span>GitHub OAuth</span>
          <h2>Нужно подключить OAuth App</h2>
          <p>Callback URL: <code>https://github.blizzcore.ru/auth/github/callback</code></p>
        </div>
      </div>
      <div class="profile-stats">
        <div><span>История</span><strong>${historyCount}</strong></div>
        <div><span>Избранное</span><strong>${favoritesCount}</strong></div>
      </div>
      <span class="auth-button is-disabled">Вход появится после настройки</span>
    `;
    return;
  }

  profileCard.innerHTML = `
    ${statusText ? `<div class="profile-notice">${escapeHtml(statusText)}</div>` : ''}
    <div class="profile-user">
      <img src="${escapeAttr(getEmojiImageSrc('github'))}" alt="" />
      <div>
        <span>GitHub профиль</span>
        <h2>Войдите, чтобы связать рабочее пространство</h2>
        <p>Войдите разрешённым GitHub-профилем, чтобы история и избранное синхронизировались с аккаунтом.</p>
      </div>
    </div>
    <div class="profile-stats">
      <div><span>История</span><strong>${historyCount}</strong></div>
      <div><span>Избранное</span><strong>${favoritesCount}</strong></div>
    </div>
    <a class="auth-button" href="/auth/github">Войти через GitHub</a>
  `;
}

function renderProfileRepositories() {
  if (profileReposState.status === 'idle' || profileReposState.status === 'loading') {
    return `
      <section class="profile-repositories">
        <div class="profile-repo-heading">
          <div>
            <h3>Ваши репозитории</h3>
            <p>Загружаю публичные и приватные репозитории из GitHub.</p>
          </div>
        </div>
        <div class="profile-repo-empty">Загрузка...</div>
      </section>
    `;
  }

  if (profileReposState.status === 'error') {
    return `
      <section class="profile-repositories">
        <div class="profile-repo-heading">
          <div>
            <h3>Ваши репозитории</h3>
            <p>Для приватных репозиториев нужен вход с доступом repo.</p>
          </div>
          <a class="auth-button compact" href="/auth/github">Войти заново</a>
        </div>
        <div class="profile-repo-empty">${escapeHtml(profileReposState.error)}</div>
      </section>
    `;
  }

  const query = profileRepoQuery.trim().toLowerCase();
  const repositories = profileReposState.repositories.filter((repo) => {
    const haystack = [repo.fullName, repo.description, repo.primaryLanguage, repo.private ? 'private приватный' : 'public публичный']
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return !query || haystack.includes(query);
  });

  const cards = repositories.length
    ? repositories.map(renderProfileRepositoryCard).join('')
    : '<div class="profile-repo-empty">Ничего не найдено по этому запросу.</div>';

  return `
    <section class="profile-repositories">
      <div class="profile-repo-heading">
        <div>
          <h3>Ваши репозитории</h3>
          <p>Показываются публичные и приватные репозитории, доступные вашему GitHub аккаунту.</p>
        </div>
        <button type="button" class="secondary-button" id="refresh-profile-repos">Обновить</button>
      </div>
      <div class="profile-repo-toolbar">
        <input id="profile-repo-search" type="search" value="${escapeAttr(profileRepoQuery)}" placeholder="Найти репозиторий" />
        <span>${repositories.length}/${profileReposState.repositories.length}</span>
      </div>
      <div class="profile-repo-list">${cards}</div>
    </section>
  `;
}

function renderProfileAccessBlocked() {
  return `
    <section class="profile-repositories">
      <div class="profile-repo-heading">
        <div>
          <h3>Доступ ограничен</h3>
          <p>${escapeHtml(accessDeniedMessage())}</p>
        </div>
        <a class="auth-button compact" href="/auth/github">Войти как ${escapeHtml(authState.allowedLogin || 'Zulut30')}</a>
      </div>
    </section>
  `;
}

function renderProfileRepositoryCard(repo) {
  const meta = getLanguageMeta(repo.primaryLanguage || 'Code');
  const imageSrc = getLanguageImageSrc(repo.primaryLanguage || 'Code', meta);
  const visibility = repo.private ? 'Приватный' : 'Публичный';
  const forkLabel = repo.fork ? '<span>Fork</span>' : '';
  const archivedLabel = repo.archived ? '<span>Архив</span>' : '';

  return `
    <article class="profile-repo-card">
      <img class="mini-language" src="${escapeAttr(imageSrc)}" alt="" />
      <div class="profile-repo-body">
        <div class="profile-repo-title">
          <h4>${escapeHtml(repo.fullName || repo.url || 'Репозиторий')}</h4>
          <span class="repo-visibility ${repo.private ? 'is-private' : ''}">${visibility}</span>
        </div>
        <p>${escapeHtml(repo.description || 'Описание не указано.')}</p>
        <div class="profile-repo-meta">
          <span>${escapeHtml(repo.primaryLanguage || 'язык не указан')}</span>
          <span>★ ${formatNumber(repo.stars)}</span>
          <span>Forks ${formatNumber(repo.forks)}</span>
          <span>${formatDate(repo.updatedAt)}</span>
          ${forkLabel}
          ${archivedLabel}
        </div>
      </div>
      <div class="profile-repo-actions">
        <button type="button" data-profile-analyze="${escapeAttr(repo.url)}">Анализ</button>
        <a href="${escapeAttr(repo.url)}" target="_blank" rel="noreferrer">GitHub</a>
      </div>
    </article>
  `;
}

function attachProfileRepoEvents() {
  const search = document.querySelector('#profile-repo-search');
  if (search) {
    search.addEventListener('input', () => {
      profileRepoQuery = search.value;
      renderProfile();
    });
  }

  const refresh = document.querySelector('#refresh-profile-repos');
  if (refresh) {
    refresh.addEventListener('click', () => {
      profileReposState = { status: 'idle', repositories: [], error: '' };
      loadProfileRepositories();
    });
  }

  const refreshActivity = document.querySelector('#refresh-profile-activity');
  if (refreshActivity) {
    refreshActivity.addEventListener('click', () => {
      profileActivityState = { status: 'idle', user: profileActivityState.user, events: [], summary: null, error: '' };
      loadProfileActivity();
    });
  }

  document.querySelectorAll('[data-profile-analyze]').forEach((buttonElement) => {
    buttonElement.addEventListener('click', () => {
      const repoUrl = buttonElement.dataset.profileAnalyze || '';
      input.value = repoUrl;
      navigate('/');
      window.setTimeout(() => form.requestSubmit(), 0);
    });
  });
}

function profileStatusText(status) {
  const messages = {
    success: 'Вы вошли через GitHub.',
    failed: 'GitHub не подтвердил вход. Попробуйте ещё раз.',
    'missing-config': 'На сервере ещё не указаны client id и secret для GitHub OAuth.',
    logout: 'Вы вышли из профиля.'
  };

  return messages[status] || '';
}

async function exportAnalysis(format) {
  if (!currentPayload) {
    showToast('Сначала выполните анализ репозитория');
    return;
  }

  const exportButton = document.querySelector(`[data-export-format="${format}"]`);
  const previousLabel = exportButton?.textContent;
  if (exportButton) {
    exportButton.disabled = true;
    exportButton.textContent = '...';
  }

  try {
    const response = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format, payload: currentPayload })
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(errorPayload.error || 'Не удалось скачать файл');
    }

    const blob = await response.blob();
    const fileName = fileNameFromDisposition(response.headers.get('Content-Disposition')) ||
      `${safeFileBase(currentPayload.repo?.fullName || 'repo-analysis')}.${format}`;
    downloadBlob(blob, fileName);
    showToast(`Файл ${format.toUpperCase()} готов`);
  } catch (error) {
    showToast(error.message || 'Не удалось скачать файл');
  } finally {
    if (exportButton) {
      exportButton.disabled = false;
      exportButton.textContent = previousLabel;
    }
  }
}

async function shareCurrentAnalysis() {
  if (!currentPayload || !shareAnalysisButton) return;

  const originalText = shareAnalysisButton.textContent;
  shareAnalysisButton.disabled = true;
  shareAnalysisButton.textContent = 'Готовлю ссылку...';

  try {
    const response = await fetch('/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: currentPayload })
    });
    const payload = await readApiResponse(response);
    if (!response.ok || !payload.ok || !payload.url) {
      throw new Error(payload.error || 'Не удалось создать ссылку');
    }

    await copyText(payload.url, 'Ссылка на анализ скопирована');
  } catch (error) {
    showError(error.message);
  } finally {
    shareAnalysisButton.disabled = false;
    shareAnalysisButton.textContent = originalText || 'Поделиться ссылкой';
  }
}

async function loadSharedAnalysis(id) {
  const shareId = String(id || '').trim();
  if (!shareId || currentShareId === shareId) return;

  currentShareId = shareId;
  setLoading(true);
  hideError();
  results.hidden = true;
  setStatus('Открываю общий анализ', 'Загружаю сохранённый отчёт по ссылке.');

  try {
    const response = await fetch(`/api/share/${encodeURIComponent(shareId)}`, {
      headers: { Accept: 'application/json' }
    });
    const payload = await readApiResponse(response);
    if (!response.ok || !payload.ok || !payload.analysis) {
      throw new Error(payload.error || 'Общий анализ не найден');
    }

    renderResult(payload.analysis);
    showToast('Анализ открыт по ссылке');
  } catch (error) {
    showError(error.message);
  } finally {
    setLoading(false);
  }
}

function copyCurrentPrompt() {
  if (!currentPayload) return;
  copyText(buildFixPrompt(currentPayload), 'Промпт скопирован');
}

function buildWeaknessesText(payload) {
  const analysis = payload.analysis || {};
  const repo = payload.repo || {};
  const weaknesses = normalizeArray(analysis.weaknesses);
  const questions = normalizeArray(analysis.questions);

  return [
    `Репозиторий: ${repo.fullName || repo.url || 'не указан'}`,
    repo.url ? `URL: ${repo.url}` : '',
    '',
    'Слабые места / ошибки:',
    ...(weaknesses.length ? weaknesses.map((item, index) => `${index + 1}. ${item}`) : ['1. Слабые места не указаны.']),
    '',
    questions.length ? 'Вопросы и ограничения анализа:' : '',
    ...questions.map((item, index) => `${index + 1}. ${item}`)
  ].filter((line) => line !== '').join('\n');
}

function buildFixPrompt(payload) {
  const repo = payload.repo || {};
  const analysis = payload.analysis || {};
  const score = normalizeScore(analysis.score);
  const weaknesses = normalizeArray(analysis.weaknesses);
  const qualitySignals = normalizeArray(analysis.qualitySignals);
  const architecture = normalizeArray(analysis.architecture);
  const runSteps = normalizeArray(analysis.howToRun);

  return [
    'Ты senior software engineer и code reviewer. Помоги профессионально улучшить GitHub репозиторий по анализу ниже.',
    '',
    `Репозиторий: ${repo.fullName || repo.url || 'не указан'}`,
    repo.url ? `URL: ${repo.url}` : '',
    `Краткая суть: ${analysis.shortSummary || analysis.purpose || 'не указана'}`,
    `Текущая оценка: ${score.value}/10${score.reason ? ` - ${score.reason}` : ''}`,
    `Основные языки: ${formatLanguagePrompt(analysis.languages, payload.languages) || repo.primaryLanguage || 'не указаны'}`,
    '',
    'Слабые места / ошибки, которые нужно исправить:',
    ...(weaknesses.length
      ? weaknesses.map((item, index) => `${index + 1}. ${item}`)
      : ['1. Слабые места не указаны. Сначала проведи аудит README, тестов, CI, зависимостей и структуры.']),
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

function formatLanguagePrompt(aiLanguages, githubLanguages) {
  const source = normalizeArray(aiLanguages).length ? aiLanguages : githubLanguages;
  return normalizeArray(source)
    .map((item) => {
      const percent = item.percent || item.percent === 0 ? ` ${item.percent}%` : '';
      return `${item.name || 'Unknown'}${percent}`.trim();
    })
    .join('; ');
}

async function copyText(text, successMessage) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const copyArea = document.createElement('textarea');
      copyArea.value = text;
      copyArea.style.position = 'fixed';
      copyArea.style.left = '-9999px';
      document.body.appendChild(copyArea);
      copyArea.focus();
      copyArea.select();
      document.execCommand('copy');
      copyArea.remove();
    }
    showToast(successMessage);
  } catch {
    showToast('Не удалось скопировать');
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.hidden = true;
  }, 2600);
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function fileNameFromDisposition(disposition) {
  const match = String(disposition || '').match(/filename="([^"]+)"/i);
  return match ? match[1] : '';
}

function safeFileBase(value) {
  return String(value || 'repo-analysis')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'repo-analysis';
}

function readHistory() {
  if (!canUseAnalyzer()) return [];

  try {
    const parsed = JSON.parse(localStorage.getItem(historyKey) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeScore(score) {
  if (typeof score === 'number') {
    return { value: clamp(Math.round(score), 0, 10), reason: '' };
  }

  const value = clamp(Math.round(Number(score?.value || 0)), 0, 10);
  return {
    value,
    reason: score?.reason || score?.label || ''
  };
}

function getLanguageMeta(name) {
  const normalized = String(name || '').trim();
  const aliases = {
    'C#': 'CSharp',
    'Objective-C': 'ObjectiveC',
    'Jupyter Notebook': 'Jupyter',
    'Vue.js': 'Vue',
    SvelteKit: 'Svelte'
  };
  if (aliases[normalized]) return languageMeta[aliases[normalized]];
  if (languageMeta[normalized]) return languageMeta[normalized];

  const hash = hashString(normalized || 'Code');
  const hue = hash % 360;
  const label = makeLanguageLabel(normalized || 'Code');
  return {
    color: `hsl(${hue} 78% 48%)`,
    accent: '#ffffff',
    label
  };
}

function getRepoImageSrc(repo, language, meta) {
  const fullName = String(repo.fullName || repo.name || '').toLowerCase();
  if (fullName.includes('github')) return getEmojiImageSrc('github');
  return getLanguageImageSrc(language, meta);
}

function getLanguageImageSrc(name, meta) {
  return getEmojiImageSrc(getLanguageAssetKey(name, meta));
}

function getLanguageAssetKey(name, meta) {
  const normalized = String(name || '').trim();
  const aliases = {
    'C#': 'CSharp',
    'Objective-C': 'Swift',
    'Jupyter Notebook': 'Python',
    'Vue.js': 'Vue',
    SvelteKit: 'Svelte',
    Docker: 'Dockerfile',
    'Node.js': 'Node'
  };
  const canonical = aliases[normalized] || normalized;
  if (languageAssetMap[canonical]) return languageAssetMap[canonical];

  const lower = canonical.toLowerCase();
  if (lower.includes('typescript')) return 'typescript';
  if (lower.includes('javascript')) return 'javascript';
  if (lower.includes('python')) return 'python';
  if (lower.includes('docker')) return 'docker';
  if (lower.includes('shell')) return 'shell';
  if (lower.includes('bash')) return 'bash';
  if (lower.includes('sql')) return 'sql';
  if (lower.includes('react')) return 'react';
  if (lower.includes('vue')) return 'vue';
  if (lower.includes('node')) return 'nodejs';
  if (lower.includes('git')) return 'git';
  if (lower.includes('html')) return 'html';
  if (lower.includes('css')) return 'css';

  if (meta?.label === 'C#') return 'csharp';
  if (meta?.label === 'C++') return 'cpp';
  return 'coding';
}

function getEmojiImageSrc(key) {
  const fileName = emojiAssets[key] || emojiAssets.code;
  return `${emojiBasePath}${fileName}`;
}

function truncateText(value, length) {
  const text = String(value || '');
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

function makeLanguageLabel(name) {
  const compact = String(name)
    .replace(/[^A-Za-z0-9+#]/g, ' ')
    .trim();
  if (!compact) return '</>';

  const parts = compact.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return parts.map((part) => part[0]).join('').slice(0, 4).toUpperCase();
  }

  return compact.slice(0, 4).toUpperCase();
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatNumber(value) {
  return new Intl.NumberFormat('ru-RU').format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return 'дата не сохранена';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function clamp(value, min, max) {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function hashString(value) {
  return String(value)
    .split('')
    .reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll('`', '&#096;');
}
