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
const favoriteToggleButton = document.querySelector('#toggle-favorite');
const copyWeaknessesButton = document.querySelector('#copy-weaknesses');
const copyPromptButton = document.querySelector('#copy-prompt');
const copyPromptInlineButton = document.querySelector('#copy-prompt-inline');
const llmPromptField = document.querySelector('#llm-prompt');
const toast = document.querySelector('#toast');
const heroRepoImage = document.querySelector('#hero-repo-image');
const heroLanguageImages = document.querySelectorAll('[data-hero-language]');

const historyKey = 'repoScope.history.v2';
const favoritesKey = 'repoScope.favorites.v1';
const themeKey = 'repoScope.theme';
let currentPayload = null;
let authState = { authenticated: false, user: null, oauthConfigured: false, canAnalyze: false, allowedLogin: 'zulut30' };
let profileReposState = { status: 'idle', repositories: [], error: '' };
let profileRepoQuery = '';

const themes = [
  { id: 'light', label: 'Светлая' },
  { id: 'dark', label: 'Тёмная' },
  { id: 'sky', label: 'Синяя' },
  { id: 'graphite', label: 'Графит' }
];

const themeColors = {
  light: '#f4fbfb',
  dark: '#0d1417',
  sky: '#f3f8ff',
  graphite: '#101113'
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
applyTheme(localStorage.getItem(themeKey) || 'light');
renderHeroImages();
renderAllHistory();
renderFavoritesPage();
loadProfile();
syncRoute();
updateAnalyzeAccessUI();

window.addEventListener('popstate', syncRoute);

document.querySelectorAll('[data-route]').forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    navigate(link.getAttribute('data-route') || '/');
  });
});

document.querySelectorAll('[data-example]').forEach((example) => {
  example.addEventListener('click', () => {
    input.value = example.dataset.example || '';
    input.focus();
  });
});

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.dataset.theme || themes[0].id;
  const currentIndex = themes.findIndex((theme) => theme.id === current);
  const next = themes[(currentIndex + 1) % themes.length].id;
  applyTheme(next);
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const repoUrl = input.value.trim();
  if (!repoUrl) return;

  if (!canUseAnalyzer()) {
    showError(accessDeniedMessage());
    navigate('/profile');
    return;
  }

  setLoading(true);
  hideError();
  results.hidden = true;
  setStatus('Готовлю контекст', 'Забираю метаданные, дерево файлов и важные манифесты с GitHub.');

  window.setTimeout(() => {
    if (!button.disabled) return;
    setStatus('Спрашиваю Grok Code Fast', 'Передаю сжатое описание репозитория агенту Timeweb.');
  }, 1800);

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoUrl })
    });

    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || 'Неизвестная ошибка анализа');
    }

    renderResult(payload);
    saveHistory(payload);
  } catch (error) {
    showError(error.message);
  } finally {
    setLoading(false);
  }
});

clearHistory.addEventListener('click', () => {
  localStorage.removeItem(historyKey);
  renderAllHistory();
  renderProfile();
});

historySearch.addEventListener('input', renderHistoryPage);

copyWeaknessesButton.addEventListener('click', () => {
  if (!currentPayload) return;
  copyText(buildWeaknessesText(currentPayload), 'Ошибки скопированы');
});

copyPromptButton.addEventListener('click', copyCurrentPrompt);
copyPromptInlineButton.addEventListener('click', copyCurrentPrompt);
favoriteToggleButton.addEventListener('click', toggleCurrentFavorite);

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
  const activeRoute = path === '/history' || path === '/favorites' || path === '/profile' ? path : '/';

  document.querySelector('#analysis-view').hidden = activeRoute !== '/';
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
}

function applyTheme(theme) {
  const selectedTheme = themes.find((item) => item.id === theme) || themes[0];
  document.documentElement.dataset.theme = selectedTheme.id;
  localStorage.setItem(themeKey, selectedTheme.id);
  themeLabel.textContent = theme === 'dark' ? 'Темная' : 'Светлая';
  themeLabel.textContent = selectedTheme.label;
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) themeColorMeta.setAttribute('content', themeColors[selectedTheme.id] || themeColors.dark);
}

function setLoading(isLoading) {
  button.disabled = isLoading || !canUseAnalyzer();
  button.innerHTML = isLoading
    ? 'Анализирую...'
    : '<span class="button-icon" aria-hidden="true"></span>Анализировать';
  statusPanel.hidden = !isLoading;
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

  if (!accessNote) return;
  accessNote.classList.toggle('is-allowed', allowed);
  accessNote.textContent = allowed
    ? `Доступ открыт для @${authState.user?.login || authState.allowedLogin}.`
    : accessDeniedMessage();
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

  document.querySelector('#repo-link').innerHTML = repo.url
    ? `<a href="${escapeAttr(repo.url)}" target="_blank" rel="noreferrer">${escapeHtml(repo.fullName || repo.url)}</a>`
    : escapeHtml(repo.fullName || '');
  document.querySelector('#analysis-title').textContent = analysis.title || repo.fullName || 'Анализ репозитория';
  document.querySelector('#short-summary').textContent =
    analysis.shortSummary || repo.description || 'Краткое описание не найдено.';
  document.querySelector('#purpose').textContent =
    analysis.purpose || 'Назначение не удалось определить по доступным файлам.';
  document.querySelector('#essence').textContent = analysis.essence || '';
  document.querySelector('#final-takeaway').textContent = analysis.finalTakeaway || analysis.shortSummary || '';
  document.querySelector('#detailed-conclusion').textContent =
    analysis.detailedConclusion || analysis.finalTakeaway || analysis.shortSummary || '';
  document.querySelector('#score-value').textContent = `${score.value}/10`;
  document.querySelector('#score-reason').textContent = score.reason || 'Оценка сформирована по доступным файлам.';
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

  results.hidden = false;
  results.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      payload
    },
    ...current.filter((item) => item.repoUrl !== repo.url)
  ].slice(0, 30);

  localStorage.setItem(historyKey, JSON.stringify(next));
  renderAllHistory();
  renderProfile();
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
      input.value = saved?.repoUrl || '';
      navigate('/');
      input.focus();
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
    payload
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
      payload: currentPayload
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
  try {
    const parsed = JSON.parse(localStorage.getItem(favoritesKey) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveFavorites(items) {
  localStorage.setItem(favoritesKey, JSON.stringify(items));
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
  }

  renderProfile();
  updateAnalyzeAccessUI();
  if (canUseAnalyzer() && profileReposState.status === 'idle') {
    loadProfileRepositories();
  }
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

function renderProfile() {
  if (!profileCard) return;

  const historyCount = readHistory().length;
  const favoritesCount = readFavorites().length;
  const authStatus = new URLSearchParams(window.location.search).get('auth');
  const statusText = profileStatusText(authStatus);

  if (authState.authenticated && authState.user) {
    const user = authState.user;
    profileCard.innerHTML = `
      ${statusText ? `<div class="profile-notice">${escapeHtml(statusText)}</div>` : ''}
      <div class="profile-user">
        <img src="${escapeAttr(user.avatarUrl || getEmojiImageSrc('github'))}" alt="" />
        <div>
          <span>GitHub профиль</span>
          <h2>${escapeHtml(user.name || user.login || 'GitHub user')}</h2>
          ${user.login ? `<a href="${escapeAttr(user.profileUrl || `https://github.com/${user.login}`)}" target="_blank" rel="noreferrer">@${escapeHtml(user.login)}</a>` : ''}
        </div>
      </div>
      <div class="profile-stats">
        <div><span>История</span><strong>${historyCount}</strong></div>
        <div><span>Избранное</span><strong>${favoritesCount}</strong></div>
      </div>
      ${canUseAnalyzer() ? renderProfileRepositories() : renderProfileAccessBlocked()}
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
        <p>История и избранное пока хранятся в этом браузере.</p>
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
