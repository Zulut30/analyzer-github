const dns = require('dns').promises;
const fs = require('fs');
const net = require('net');
const path = require('path');
const tls = require('tls');
const { performance } = require('perf_hooks');
const cheerio = require('cheerio');
const { XMLParser } = require('fast-xml-parser');

const DEFAULT_TIMEOUT_MS = 10000;
const PAGESPEED_TIMEOUT_MS = Number(process.env.PAGESPEED_TIMEOUT_MS || 28000);
const MAX_REDIRECTS = 5;
const MAX_HTML_CHARS = 700000;
const MAX_PROBE_CHARS = 160000;
const MAX_HISTORY_ITEMS = 220;
const MAX_MONITORS = 60;
const DEFAULT_MONITOR_INTERVAL_MINUTES = 5;
const MIN_MONITOR_INTERVAL_MINUTES = 1;
const MAX_MONITOR_INTERVAL_MINUTES = 1440;

function createToolsService({ dataDir, pagespeedApiKey = '', logger = console } = {}) {
  const stateFile = path.join(dataDir || path.join(__dirname, 'data'), 'tools-state.json');
  let stateQueue = Promise.resolve();
  let schedulerTimer = null;
  let schedulerRunning = false;

  async function runManualCheck(login, inputUrl, requestedChecks = []) {
    const check = await runToolsCheck(inputUrl, {
      mode: 'manual',
      requestedChecks,
      pagespeedApiKey
    });

    await mutateState((store) => {
      const userState = getUserState(store, login);
      userState.checks = [check, ...normalizeArray(userState.checks)].slice(0, MAX_HISTORY_ITEMS);
      return check;
    });

    return check;
  }

  async function getHistory(login) {
    const store = await readState();
    return normalizeArray(getUserState(store, login).checks).slice(0, MAX_HISTORY_ITEMS);
  }

  async function getMonitors(login) {
    const store = await readState();
    const userState = getUserState(store, login);
    return {
      monitors: normalizeArray(userState.monitors),
      incidents: normalizeArray(userState.incidents)
    };
  }

  async function createMonitor(login, input) {
    const normalized = await normalizePublicUrl(input?.url || input);
    const intervalMinutes = normalizeMonitorInterval(input?.intervalMinutes);
    const now = new Date().toISOString();
    const monitor = {
      id: cryptoId(),
      url: normalized.url,
      hostname: normalized.hostname,
      intervalMinutes,
      active: true,
      createdAt: now,
      updatedAt: now,
      lastCheckedAt: '',
      lastStatus: 'pending',
      lastStatusCode: null,
      lastResponseTimeMs: null,
      lastSummary: 'Ожидает первой проверки',
      nextRunAt: now
    };

    await mutateState((store) => {
      const userState = getUserState(store, login);
      const existing = normalizeArray(userState.monitors).filter((item) => item.url !== monitor.url);
      userState.monitors = [monitor, ...existing].slice(0, MAX_MONITORS);
      return monitor;
    });

    return monitor;
  }

  async function updateMonitor(login, monitorId, patch) {
    return mutateState((store) => {
      const userState = getUserState(store, login);
      const monitors = normalizeArray(userState.monitors);
      const monitor = monitors.find((item) => item.id === monitorId);
      if (!monitor) throw publicError('Монитор не найден', 404);

      if (Object.prototype.hasOwnProperty.call(patch || {}, 'active')) {
        monitor.active = Boolean(patch.active);
      }
      if (Object.prototype.hasOwnProperty.call(patch || {}, 'intervalMinutes')) {
        monitor.intervalMinutes = normalizeMonitorInterval(patch.intervalMinutes);
      }

      monitor.updatedAt = new Date().toISOString();
      if (monitor.active && !monitor.nextRunAt) monitor.nextRunAt = new Date().toISOString();
      userState.monitors = monitors;
      return monitor;
    });
  }

  async function deleteMonitor(login, monitorId) {
    return mutateState((store) => {
      const userState = getUserState(store, login);
      const monitors = normalizeArray(userState.monitors);
      const nextMonitors = monitors.filter((item) => item.id !== monitorId);
      if (nextMonitors.length === monitors.length) throw publicError('Монитор не найден', 404);
      userState.monitors = nextMonitors;
      userState.incidents = normalizeArray(userState.incidents).filter((item) => item.monitorId !== monitorId);
      return { id: monitorId };
    });
  }

  async function runMonitor(login, monitorId, options = {}) {
    const monitor = await getMonitor(login, monitorId);
    const check = await runToolsCheck(monitor.url, {
      mode: options.scheduled ? 'scheduled-monitor' : 'monitor',
      requestedChecks: ['availability', 'port', 'ssl'],
      pagespeedApiKey: ''
    });

    return mutateState((store) => {
      const userState = getUserState(store, login);
      const monitors = normalizeArray(userState.monitors);
      const currentMonitor = monitors.find((item) => item.id === monitorId);
      if (!currentMonitor) throw publicError('Монитор не найден', 404);

      userState.checks = [check, ...normalizeArray(userState.checks)].slice(0, MAX_HISTORY_ITEMS);
      updateMonitorStatus(userState, currentMonitor, check);
      userState.monitors = monitors;
      return { monitor: currentMonitor, check, incidents: normalizeArray(userState.incidents) };
    });
  }

  function startScheduler() {
    if (schedulerTimer) return;
    schedulerTimer = setInterval(() => {
      runDueMonitors().catch((error) => logger.warn?.('Tools scheduler failed:', error.message));
    }, 60000);
    schedulerTimer.unref?.();
  }

  async function runDueMonitors() {
    if (schedulerRunning) return;
    schedulerRunning = true;
    try {
      const store = await readState();
      const now = Date.now();
      const jobs = [];

      for (const [login, userState] of Object.entries(store || {})) {
        for (const monitor of normalizeArray(userState?.monitors)) {
          if (!monitor?.active) continue;
          const dueAt = new Date(monitor.nextRunAt || monitor.createdAt || 0).getTime();
          if (!Number.isFinite(dueAt) || dueAt > now) continue;
          jobs.push({ login, monitorId: monitor.id });
        }
      }

      for (const job of jobs.slice(0, 20)) {
        await runMonitor(job.login, job.monitorId, { scheduled: true }).catch((error) => {
          logger.warn?.(`Monitor ${job.monitorId} failed:`, error.message);
        });
      }
    } finally {
      schedulerRunning = false;
    }
  }

  async function getMonitor(login, monitorId) {
    const store = await readState();
    const monitor = normalizeArray(getUserState(store, login).monitors).find((item) => item.id === monitorId);
    if (!monitor) throw publicError('Монитор не найден', 404);
    return monitor;
  }

  function mutateState(mutator) {
    const run = stateQueue.then(async () => {
      const store = await readState();
      const result = await mutator(store);
      await writeState(store);
      return result;
    });

    stateQueue = run.catch(() => {});
    return run;
  }

  async function readState() {
    try {
      const raw = await fs.promises.readFile(stateFile, 'utf8');
      const parsed = JSON.parse(raw.replace(/^\uFEFF/, ''));
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      if (error.code === 'ENOENT') return {};
      throw error;
    }
  }

  async function writeState(store) {
    await fs.promises.mkdir(path.dirname(stateFile), { recursive: true });
    const tempFile = `${stateFile}.tmp`;
    await fs.promises.writeFile(tempFile, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
    await fs.promises.rename(tempFile, stateFile);
  }

  return {
    runManualCheck,
    getHistory,
    getMonitors,
    createMonitor,
    updateMonitor,
    deleteMonitor,
    runMonitor,
    startScheduler
  };
}

async function runToolsCheck(inputUrl, options = {}) {
  const started = performance.now();
  const requested = normalizeRequestedChecks(options.requestedChecks);
  const baseRequested = requested.includes('pagespeed') && !requested.includes('availability')
    ? ['availability', ...requested]
    : requested;
  const target = await normalizePublicUrl(inputUrl);
  const check = {
    id: cryptoId(),
    mode: options.mode || 'manual',
    url: target.url,
    hostname: target.hostname,
    checkedAt: new Date().toISOString(),
    requestedChecks: requested,
    summary: {
      status: 'pending',
      label: 'Проверка выполняется',
      aiTokens: 0
    },
    availability: null,
    port: null,
    ssl: null,
    dns: null,
    seo: null,
    security: null,
    wordpress: null,
    pagespeed: null
  };
  const pageSpeedPromise = requested.includes('pagespeed')
    ? checkPageSpeed(target, options.pagespeedApiKey || '')
    : null;

  const baseChecks = await Promise.allSettled([
    baseRequested.includes('availability') ? checkAvailability(target.url) : null,
    baseRequested.includes('port') ? checkPort(target) : null,
    baseRequested.includes('ssl') ? checkSsl(target) : null,
    baseRequested.includes('dns') ? checkDns(target) : null
  ]);

  check.availability = settledValue(baseChecks[0]);
  check.port = settledValue(baseChecks[1]);
  check.ssl = settledValue(baseChecks[2]);
  check.dns = settledValue(baseChecks[3]);

  const needsHtml =
    requested.includes('seo') || requested.includes('security') || requested.includes('wordpress');
  const htmlSnapshot = needsHtml ? await fetchHtmlSnapshot(target.url).catch((error) => ({ error: publicMessage(error) })) : null;

  if (requested.includes('seo')) check.seo = await checkSeo(target, htmlSnapshot);
  if (requested.includes('security')) check.security = await checkSecurity(target, htmlSnapshot);
  if (requested.includes('wordpress')) check.wordpress = await checkWordPress(target, htmlSnapshot);
  if (pageSpeedPromise) check.pagespeed = await pageSpeedPromise;

  check.durationMs = Math.round(performance.now() - started);
  check.summary = summarizeCheck(check);
  return check;
}

function normalizeRequestedChecks(value) {
  const allowed = ['availability', 'port', 'ssl', 'dns', 'seo', 'security', 'wordpress', 'pagespeed'];
  const input = Array.isArray(value) ? value : [];
  const selected = input.map((item) => String(item || '').toLowerCase()).filter((item) => allowed.includes(item));
  return selected.length ? [...new Set(selected)] : allowed;
}

async function normalizePublicUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) throw publicError('Введите URL сайта для проверки', 400);

  let parsed;
  try {
    parsed = new URL(raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`);
  } catch {
    throw publicError('Введите корректный http/https URL', 400);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw publicError('Проверять можно только http/https адреса', 400);
  }
  if (parsed.username || parsed.password) {
    throw publicError('URL с логином или паролем не принимаются', 400);
  }

  parsed.hash = '';
  const hostname = parsed.hostname.toLowerCase();
  if (isBlockedHostname(hostname)) {
    throw publicError('Внутренние, localhost и private адреса нельзя проверять этим инструментом', 400);
  }

  const lookupAddresses = net.isIP(hostname)
    ? [{ address: hostname }]
    : await dns.lookup(hostname, { all: true, verbatim: true }).catch((error) => {
        throw publicError(`DNS не смог определить адрес сайта: ${error.message}`, 400);
      });

  if (!lookupAddresses.length) {
    throw publicError('DNS не вернул IP-адрес для сайта', 400);
  }
  if (lookupAddresses.some((item) => isPrivateIp(item.address))) {
    throw publicError('Домен указывает на private/internal IP, проверка заблокирована', 400);
  }

  return {
    url: parsed.toString(),
    origin: parsed.origin,
    hostname,
    protocol: parsed.protocol,
    port: parsed.port ? Number(parsed.port) : parsed.protocol === 'https:' ? 443 : 80
  };
}

async function checkAvailability(url) {
  const first = await requestWithRedirects(url, { method: 'HEAD' }).catch((error) => ({ error }));
  const shouldFallback =
    first?.error || [403, 405, 501].includes(Number(first?.response?.status || 0));
  const result = shouldFallback ? await requestWithRedirects(url, { method: 'GET' }) : first;

  if (result.error) throw result.error;
  const status = result.response.status;
  return {
    statusCode: status,
    ok: status >= 200 && status < 500,
    reachable: status >= 200 && status < 500,
    finalUrl: result.finalUrl,
    responseTimeMs: result.responseTimeMs,
    redirectCount: result.redirects.length,
    redirects: result.redirects,
    contentType: result.response.headers.get('content-type') || '',
    server: result.response.headers.get('server') || ''
  };
}

function checkPort(target) {
  return new Promise((resolve) => {
    const started = performance.now();
    const socket = net.connect({ host: target.hostname, port: target.port });
    let resolved = false;

    const done = (payload) => {
      if (resolved) return;
      resolved = true;
      socket.destroy();
      resolve({
        port: target.port,
        protocol: target.protocol.replace(':', ''),
        responseTimeMs: Math.round(performance.now() - started),
        ...payload
      });
    };

    socket.setTimeout(DEFAULT_TIMEOUT_MS);
    socket.once('connect', () => done({ open: true, error: '' }));
    socket.once('timeout', () => done({ open: false, error: 'timeout' }));
    socket.once('error', (error) => done({ open: false, error: error.code || error.message }));
  });
}

function checkSsl(target) {
  if (target.protocol !== 'https:') {
    return {
      available: false,
      ok: false,
      warning: 'SSL проверка доступна только для HTTPS'
    };
  }

  return new Promise((resolve) => {
    const socket = tls.connect({
      host: target.hostname,
      port: target.port || 443,
      servername: target.hostname,
      rejectUnauthorized: false,
      timeout: DEFAULT_TIMEOUT_MS
    });

    const done = (payload) => {
      socket.destroy();
      resolve(payload);
    };

    socket.once('secureConnect', () => {
      const cert = socket.getPeerCertificate();
      const validTo = cert?.valid_to || '';
      const expiresAt = validTo ? new Date(validTo) : null;
      const daysLeft = expiresAt ? Math.ceil((expiresAt.getTime() - Date.now()) / 86400000) : null;
      done({
        available: true,
        ok: Boolean(socket.authorized && daysLeft !== null && daysLeft >= 0),
        authorized: Boolean(socket.authorized),
        authorizationError: socket.authorizationError || '',
        subject: cert?.subject?.CN || '',
        issuer: cert?.issuer?.CN || cert?.issuer?.O || '',
        validFrom: cert?.valid_from || '',
        validTo,
        expiresAt: expiresAt ? expiresAt.toISOString() : '',
        daysLeft,
        serialNumber: cert?.serialNumber || '',
        fingerprint: cert?.fingerprint256 || cert?.fingerprint || '',
        san: parseSubjectAltNames(cert?.subjectaltname || '')
      });
    });

    socket.once('timeout', () => done({ available: false, ok: false, error: 'timeout' }));
    socket.once('error', (error) => done({ available: false, ok: false, error: error.message }));
  });
}

async function checkDns(target) {
  const started = performance.now();
  const records = {};
  const errors = {};
  const resolvers = {
    A: () => dns.resolve4(target.hostname, { ttl: true }),
    AAAA: () => dns.resolve6(target.hostname, { ttl: true }),
    CNAME: () => dns.resolveCname(target.hostname),
    NS: () => dns.resolveNs(target.hostname),
    MX: () => dns.resolveMx(target.hostname),
    TXT: () => dns.resolveTxt(target.hostname),
    CAA: () => dns.resolve(target.hostname, 'CAA')
  };

  for (const [type, resolver] of Object.entries(resolvers)) {
    try {
      records[type] = normalizeDnsRecord(type, await resolver());
    } catch (error) {
      errors[type] = error.code || error.message;
      records[type] = [];
    }
  }

  return {
    ok: Boolean(records.A.length || records.AAAA.length || records.CNAME.length),
    hostname: target.hostname,
    latencyMs: Math.round(performance.now() - started),
    records,
    errors
  };
}

async function checkSeo(target, htmlSnapshot) {
  if (htmlSnapshot?.error) return { ok: false, error: htmlSnapshot.error };
  const $ = cheerio.load(htmlSnapshot?.html || '');
  const title = cleanWhitespace($('title').first().text());
  const description = cleanWhitespace($('meta[name="description"]').attr('content') || '');
  const h1 = $('h1').map((_, element) => cleanWhitespace($(element).text())).get().filter(Boolean);
  const h2 = $('h2').map((_, element) => cleanWhitespace($(element).text())).get().filter(Boolean);
  const canonical = $('link[rel="canonical"]').attr('href') || '';
  const robots = $('meta[name="robots"]').attr('content') || '';
  const xRobotsTag = htmlSnapshot.headers?.['x-robots-tag'] || '';
  const ogCount = $('meta[property^="og:"]').length;
  const twitterCount = $('meta[name^="twitter:"]').length;
  const jsonLdCount = $('script[type="application/ld+json"]').length;
  const images = $('img');
  const imagesWithoutAlt = images.filter((_, element) => !$(element).attr('alt')).length;
  const robotsTxt = await fetchProbe(target.origin, '/robots.txt', { text: true });
  const sitemap = await fetchSitemapSummary(target.origin);
  const noindex = /noindex/i.test(`${robots} ${xRobotsTag}`);
  const warnings = [];

  if (!title) warnings.push('Нет title');
  if (!description) warnings.push('Нет meta description');
  if (h1.length !== 1) warnings.push(h1.length ? 'На странице больше одного H1' : 'Нет H1');
  if (!canonical) warnings.push('Нет canonical');
  if (images.length && imagesWithoutAlt) warnings.push(`Изображения без alt: ${imagesWithoutAlt}`);
  if (noindex) warnings.push('Страница закрыта от индексации');

  return {
    ok: warnings.length === 0,
    indexable: !noindex && Number(htmlSnapshot.statusCode || 0) >= 200 && Number(htmlSnapshot.statusCode || 0) < 400,
    title,
    description,
    h1: h1.slice(0, 8),
    h2: h2.slice(0, 12),
    canonical,
    robots,
    xRobotsTag,
    openGraphTags: ogCount,
    twitterTags: twitterCount,
    jsonLdBlocks: jsonLdCount,
    images: images.length,
    imagesWithoutAlt,
    robotsTxt: {
      statusCode: robotsTxt.statusCode || null,
      found: robotsTxt.statusCode === 200
    },
    sitemap,
    warnings
  };
}

async function checkSecurity(target, htmlSnapshot) {
  if (htmlSnapshot?.error) return { ok: false, error: htmlSnapshot.error };
  const headers = htmlSnapshot.headers || {};
  const missingHeaders = [
    ['Strict-Transport-Security', 'strict-transport-security'],
    ['Content-Security-Policy', 'content-security-policy'],
    ['X-Frame-Options', 'x-frame-options'],
    ['X-Content-Type-Options', 'x-content-type-options'],
    ['Referrer-Policy', 'referrer-policy'],
    ['Permissions-Policy', 'permissions-policy']
  ].filter(([, key]) => !headers[key]).map(([label]) => label);
  const mixedContent = findMixedContent(htmlSnapshot.html || '');
  const probes = await Promise.all([
    fetchProbe(target.origin, '/.env', { text: true }),
    fetchProbe(target.origin, '/wp-content/debug.log', { text: true }),
    fetchProbe(target.origin, '/readme.html', { text: true })
  ]);
  const exposed = [];

  if (probes[0].statusCode === 200 && /[A-Z0-9_]{3,}\s*=\s*.+/i.test(probes[0].text || '')) {
    exposed.push({ path: '/.env', risk: 'critical', statusCode: 200 });
  }
  if (probes[1].statusCode === 200 && cleanWhitespace(probes[1].text || '')) {
    exposed.push({ path: '/wp-content/debug.log', risk: 'high', statusCode: 200 });
  }
  if (probes[2].statusCode === 200 && /wordpress/i.test(probes[2].text || '')) {
    exposed.push({ path: '/readme.html', risk: 'medium', statusCode: 200 });
  }

  const directoryListing = /<title>\s*Index of\s*\/?/i.test(htmlSnapshot.html || '') || /Index of \//i.test(htmlSnapshot.html || '');
  const serverExposure = {
    server: headers.server || '',
    poweredBy: headers['x-powered-by'] || ''
  };
  const warnings = [
    ...missingHeaders.map((item) => `Нет ${item}`),
    ...mixedContent.map((item) => `Mixed content: ${item}`),
    ...exposed.map((item) => `Публичный ${item.path}`),
    ...(directoryListing ? ['Похоже на directory listing'] : []),
    ...(serverExposure.server ? [`Server header: ${serverExposure.server}`] : []),
    ...(serverExposure.poweredBy ? [`X-Powered-By: ${serverExposure.poweredBy}`] : [])
  ];

  return {
    ok: !exposed.some((item) => item.risk === 'critical' || item.risk === 'high') && missingHeaders.length <= 2,
    missingHeaders,
    mixedContent,
    exposed,
    directoryListing,
    serverExposure,
    warnings: warnings.slice(0, 16)
  };
}

async function checkWordPress(target, htmlSnapshot) {
  if (htmlSnapshot?.error) return { ok: false, error: htmlSnapshot.error };
  const paths = [
    '/wp-json/',
    '/wp-login.php',
    '/wp-admin/',
    '/wp-cron.php',
    '/xmlrpc.php',
    '/feed/',
    '/wp-sitemap.xml',
    '/sitemap_index.xml',
    '/wp-content/debug.log',
    '/readme.html'
  ];
  const probes = await Promise.all(paths.map((probePath) => fetchProbe(target.origin, probePath)));
  const endpoints = Object.fromEntries(paths.map((probePath, index) => [probePath, probes[index].statusCode || null]));
  const html = htmlSnapshot.html || '';
  const themes = uniqueMatches(html, /\/wp-content\/themes\/([^\/"'?#\s]+)/gi).slice(0, 8);
  const plugins = uniqueMatches(html, /\/wp-content\/plugins\/([^\/"'?#\s]+)/gi).slice(0, 16);
  const isWordPress =
    endpoints['/wp-json/'] === 200 ||
    /wp-content|wp-includes|wordpress/i.test(html) ||
    themes.length > 0 ||
    plugins.length > 0;

  return {
    ok: isWordPress,
    detected: isWordPress,
    endpoints,
    themeCandidates: themes,
    pluginCandidates: plugins,
    cacheHeaders: {
      cacheControl: htmlSnapshot.headers?.['cache-control'] || '',
      xCache: htmlSnapshot.headers?.['x-cache'] || '',
      cfCacheStatus: htmlSnapshot.headers?.['cf-cache-status'] || ''
    },
    warnings: [
      endpoints['/xmlrpc.php'] === 200 ? 'XML-RPC доступен публично' : '',
      endpoints['/wp-content/debug.log'] === 200 ? 'debug.log доступен публично' : '',
      endpoints['/readme.html'] === 200 ? 'readme.html доступен публично' : ''
    ].filter(Boolean)
  };
}

async function checkPageSpeed(target, apiKey) {
  if (!apiKey) {
    return {
      available: false,
      ok: false,
      message: 'Нужен GOOGLE_PAGESPEED_API_KEY на сервере'
    };
  }

  const strategies = ['mobile', 'desktop'];
  const results = Object.fromEntries(
    await Promise.all(strategies.map(async (strategy) => {
    const endpoint = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
    endpoint.searchParams.set('url', target.url);
    endpoint.searchParams.set('strategy', strategy);
    endpoint.searchParams.set('locale', 'ru');
    for (const category of ['performance', 'accessibility', 'best-practices', 'seo']) {
      endpoint.searchParams.append('category', category);
    }
    endpoint.searchParams.set('key', apiKey);

    try {
      const response = await fetch(endpoint, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(PAGESPEED_TIMEOUT_MS)
      });
      const payload = await response.json().catch(() => ({}));
      const lighthouse = payload.lighthouseResult || {};
      const categories = lighthouse.categories || {};
      const runtimeError = lighthouse.runtimeError || null;
      const apiError = payload.error || null;
      const error = runtimeError?.message || apiError?.message || (response.ok ? '' : response.statusText);

      return [strategy, {
        ok: response.ok,
        statusCode: response.status,
        performanceScore: toPercent(categories.performance?.score),
        accessibilityScore: toPercent(categories.accessibility?.score),
        bestPracticesScore: toPercent(categories['best-practices']?.score),
        seoScore: toPercent(categories.seo?.score),
        metrics: extractLighthouseMetrics(lighthouse.audits || {}),
        runtimeErrorCode: runtimeError?.code || '',
        runWarnings: normalizeArray(lighthouse.runWarnings).slice(0, 8),
        finalUrl: lighthouse.finalUrl || '',
        error: error ? explainPageSpeedError(error, runtimeError?.code || apiError?.code || '') : ''
      }];
    } catch (error) {
      return [strategy, { ok: false, error: explainPageSpeedError(error.message, error.name || '') }];
    }
    }))
  );

  return {
    available: true,
    ok: Object.values(results).every((item) => item.ok),
    partial: Object.values(results).some((item) => item.ok),
    results,
    note: Object.values(results).some((item) => item.error)
      ? 'PageSpeed запускает Lighthouse на стороне Google. Если наш HTTP-чек отвечает 200, но PageSpeed пишет timeout, сайт может блокировать Google Lighthouse, headless Chrome, зарубежные IP или слишком долго отдавать документ.'
      : ''
  };
}

function extractLighthouseMetrics(audits) {
  return {
    firstContentfulPaint: audits['first-contentful-paint']?.displayValue || '',
    largestContentfulPaint: audits['largest-contentful-paint']?.displayValue || '',
    speedIndex: audits['speed-index']?.displayValue || '',
    totalBlockingTime: audits['total-blocking-time']?.displayValue || '',
    cumulativeLayoutShift: audits['cumulative-layout-shift']?.displayValue || ''
  };
}

function explainPageSpeedError(message, code) {
  const text = String(message || '').trim();
  const marker = String(code || '').trim();
  if (/ERR_TIMED_OUT|FAILED_DOCUMENT_REQUEST|PROTOCOL_TIMEOUT|AbortError|aborted|timeout/i.test(`${marker} ${text}`)) {
    return 'Google Lighthouse не успел надежно загрузить страницу за лимит проверки. Проверьте, не блокирует ли сайт Google/PageSpeed, headless Chrome, зарубежные IP, anti-bot/WAF или долгую загрузку главного HTML.';
  }
  if (/API key not valid|keyInvalid|PERMISSION_DENIED/i.test(text)) {
    return 'PageSpeed API key не принят Google. Проверьте ключ и ограничения API в Google Cloud.';
  }
  if (/quota|rateLimit|RESOURCE_EXHAUSTED/i.test(`${marker} ${text}`)) {
    return 'Google PageSpeed ограничил запросы по квоте или rate limit. Повторите позже или проверьте квоты API.';
  }
  return text || 'PageSpeed не вернул результат.';
}

async function fetchHtmlSnapshot(url) {
  const result = await requestWithRedirects(url, { method: 'GET' });
  const html = await readLimitedText(result.response, MAX_HTML_CHARS);
  return {
    statusCode: result.response.status,
    finalUrl: result.finalUrl,
    responseTimeMs: result.responseTimeMs,
    headers: headersToObject(result.response.headers),
    html
  };
}

async function fetchSitemapSummary(origin) {
  const candidates = ['/sitemap.xml', '/sitemap_index.xml', '/wp-sitemap.xml'];
  for (const candidate of candidates) {
    const probe = await fetchProbe(origin, candidate, { text: true });
    if (probe.statusCode !== 200 || !probe.text) continue;
    const parser = new XMLParser({
      ignoreAttributes: false,
      processEntities: false,
      htmlEntities: false
    });
    try {
      const parsed = parser.parse(stripDoctype(probe.text));
      return {
        found: true,
        path: candidate,
        statusCode: 200,
        urlCount: countXmlEntries(parsed, 'url'),
        sitemapCount: countXmlEntries(parsed, 'sitemap')
      };
    } catch (error) {
      return {
        found: true,
        path: candidate,
        statusCode: 200,
        error: error.message
      };
    }
  }

  return { found: false, statusCode: null, urlCount: 0, sitemapCount: 0 };
}

async function fetchProbe(origin, probePath, options = {}) {
  try {
    const probeUrl = new URL(probePath, origin).toString();
    await normalizePublicUrl(probeUrl);
    const result = await requestWithRedirects(probeUrl, { method: 'GET', maxRedirects: 2 });
    const contentType = result.response.headers.get('content-type') || '';
    const shouldRead = Boolean(options.text) || /html|text|json|xml|javascript/i.test(contentType);
    const text = shouldRead ? await readLimitedText(result.response, MAX_PROBE_CHARS) : '';
    return {
      statusCode: result.response.status,
      finalUrl: result.finalUrl,
      contentType,
      text
    };
  } catch (error) {
    return {
      statusCode: null,
      error: publicMessage(error)
    };
  }
}

async function requestWithRedirects(url, options = {}) {
  let currentUrl = url;
  const redirects = [];
  const maxRedirects = Number.isFinite(options.maxRedirects) ? options.maxRedirects : MAX_REDIRECTS;
  const started = performance.now();

  for (let index = 0; index <= maxRedirects; index += 1) {
    const target = await normalizePublicUrl(currentUrl);
    const response = await fetch(target.url, {
      method: options.method || 'GET',
      redirect: 'manual',
      headers: {
        Accept: options.method === 'HEAD' ? '*/*' : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'RepoScopeTools/1.0 defensive-check'
      },
      signal: AbortSignal.timeout(options.timeoutMs || DEFAULT_TIMEOUT_MS)
    });

    const location = response.headers.get('location');
    if (isRedirectStatus(response.status) && location) {
      const nextUrl = new URL(location, target.url).toString();
      redirects.push({
        statusCode: response.status,
        from: target.url,
        to: nextUrl
      });
      currentUrl = nextUrl;
      continue;
    }

    return {
      response,
      finalUrl: target.url,
      redirects,
      responseTimeMs: Math.round(performance.now() - started)
    };
  }

  throw publicError('Слишком длинная цепочка редиректов', 400);
}

function summarizeCheck(check) {
  const availability = check.availability || {};
  const warnings = [];
  const down =
    availability.error ||
    availability.reachable === false ||
    Number(availability.statusCode || 0) >= 500 ||
    check.port?.open === false;

  if (check.ssl?.daysLeft !== null && check.ssl?.daysLeft !== undefined && check.ssl.daysLeft < 14) {
    warnings.push(check.ssl.daysLeft < 0 ? 'SSL истек' : 'SSL скоро истечет');
  }
  if (check.seo?.warnings?.length) warnings.push(`SEO: ${check.seo.warnings[0]}`);
  if (check.security?.warnings?.length) warnings.push(`Security: ${check.security.warnings[0]}`);
  if (check.wordpress?.warnings?.length) warnings.push(`WordPress: ${check.wordpress.warnings[0]}`);
  if (check.pagespeed && check.pagespeed.available && !check.pagespeed.ok) {
    warnings.push('PageSpeed: Google Lighthouse не смог получить полный отчет');
  }
  if (check.pagespeed?.note) warnings.push(check.pagespeed.note);

  if (down) {
    return {
      status: 'down',
      label: availability.error || check.port?.error || 'Сайт недоступен или отвечает 5xx',
      statusCode: availability.statusCode || null,
      responseTimeMs: availability.responseTimeMs || null,
      aiTokens: 0
    };
  }

  return {
    status: warnings.length ? 'warning' : 'ok',
    label: warnings[0] || 'Сайт отвечает, критичных проблем не найдено',
    statusCode: availability.statusCode || null,
    responseTimeMs: availability.responseTimeMs || null,
    aiTokens: 0
  };
}

function updateMonitorStatus(userState, monitor, check) {
  const now = new Date().toISOString();
  const status = check.summary?.status || 'unknown';
  const isDown = status === 'down';
  monitor.lastCheckedAt = check.checkedAt || now;
  monitor.lastStatus = status;
  monitor.lastStatusCode = check.summary?.statusCode || null;
  monitor.lastResponseTimeMs = check.summary?.responseTimeMs || null;
  monitor.lastSummary = check.summary?.label || '';
  monitor.nextRunAt = new Date(Date.now() + normalizeMonitorInterval(monitor.intervalMinutes) * 60000).toISOString();
  monitor.updatedAt = now;

  userState.incidents = normalizeArray(userState.incidents);
  const openIncident = userState.incidents.find((item) => item.monitorId === monitor.id && item.status === 'open');

  if (isDown) {
    if (openIncident) {
      openIncident.lastSeenAt = now;
      openIncident.checkCount = Number(openIncident.checkCount || 1) + 1;
      openIncident.message = monitor.lastSummary;
    } else {
      userState.incidents.unshift({
        id: cryptoId(),
        monitorId: monitor.id,
        url: monitor.url,
        status: 'open',
        type: 'availability',
        openedAt: now,
        lastSeenAt: now,
        closedAt: '',
        message: monitor.lastSummary,
        checkCount: 1
      });
    }
  } else if (openIncident) {
    openIncident.status = 'closed';
    openIncident.closedAt = now;
    openIncident.lastSeenAt = now;
    openIncident.recoveryMessage = monitor.lastSummary || 'Сайт восстановился';
  }

  userState.incidents = userState.incidents.slice(0, 120);
}

function getUserState(store, login) {
  const key = String(login || 'anonymous').trim().toLowerCase();
  if (!store[key] || typeof store[key] !== 'object') {
    store[key] = { checks: [], monitors: [], incidents: [] };
  }
  store[key].checks = normalizeArray(store[key].checks);
  store[key].monitors = normalizeArray(store[key].monitors);
  store[key].incidents = normalizeArray(store[key].incidents);
  return store[key];
}

function normalizeMonitorInterval(value) {
  const interval = Math.round(Number(value || DEFAULT_MONITOR_INTERVAL_MINUTES));
  if (!Number.isFinite(interval)) return DEFAULT_MONITOR_INTERVAL_MINUTES;
  return Math.max(MIN_MONITOR_INTERVAL_MINUTES, Math.min(MAX_MONITOR_INTERVAL_MINUTES, interval));
}

function headersToObject(headers) {
  const result = {};
  for (const [key, value] of headers.entries()) result[key.toLowerCase()] = value;
  return result;
}

function settledValue(value) {
  if (!value || value.value === null) return null;
  if (value.status === 'fulfilled') return value.value;
  return { ok: false, error: publicMessage(value.reason) };
}

function publicError(message, status = 500) {
  const error = new Error(message);
  error.publicMessage = message;
  error.status = status;
  return error;
}

function publicMessage(error) {
  return error?.publicMessage || error?.message || 'Неизвестная ошибка';
}

function parseSubjectAltNames(value) {
  return String(value || '')
    .split(/,\s*/)
    .map((item) => item.replace(/^DNS:/i, '').trim())
    .filter(Boolean)
    .slice(0, 24);
}

function normalizeDnsRecord(type, value) {
  if (!Array.isArray(value)) return [];
  if (type === 'TXT') return value.map((item) => (Array.isArray(item) ? item.join('') : String(item)));
  return value;
}

function isRedirectStatus(status) {
  return [301, 302, 303, 307, 308].includes(Number(status));
}

async function readLimitedText(response, limit) {
  const text = await response.text();
  return String(text || '').slice(0, limit);
}

function cleanWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function uniqueMatches(text, pattern) {
  const result = new Set();
  let match;
  while ((match = pattern.exec(text || ''))) {
    if (match[1]) result.add(match[1]);
  }
  return [...result];
}

function findMixedContent(html) {
  const result = new Set();
  const pattern = /\b(?:src|href)=["'](http:\/\/[^"']+)["']/gi;
  let match;
  while ((match = pattern.exec(html || ''))) {
    result.add(match[1]);
    if (result.size >= 12) break;
  }
  return [...result];
}

function stripDoctype(xml) {
  return String(xml || '').replace(/<!DOCTYPE[\s\S]*?>/gi, '');
}

function countXmlEntries(value, key) {
  if (!value || typeof value !== 'object') return 0;
  let count = 0;

  function walk(node) {
    if (!node || typeof node !== 'object') return;
    for (const [nodeKey, child] of Object.entries(node)) {
      if (nodeKey === key) count += Array.isArray(child) ? child.length : 1;
      if (child && typeof child === 'object') walk(child);
    }
  }

  walk(value);
  return count;
}

function toPercent(value) {
  if (typeof value !== 'number') return null;
  return Math.round(value * 100);
}

function cryptoId() {
  return require('crypto').randomBytes(9).toString('base64url');
}

function isBlockedHostname(hostname) {
  const lower = String(hostname || '').toLowerCase();
  return (
    lower === 'localhost' ||
    lower.endsWith('.localhost') ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal') ||
    lower.endsWith('.test') ||
    lower === 'metadata.google.internal'
  );
}

function isPrivateIp(address) {
  const ipType = net.isIP(address);
  if (ipType === 4) return isPrivateIpv4(address);
  if (ipType === 6) return isPrivateIpv6(address);
  return false;
}

function isPrivateIpv4(address) {
  const parts = String(address).split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224 ||
    address === '255.255.255.255'
  );
}

function isPrivateIpv6(address) {
  const lower = String(address || '').toLowerCase();
  return (
    lower === '::1' ||
    lower === '::' ||
    lower.startsWith('fc') ||
    lower.startsWith('fd') ||
    lower.startsWith('fe80') ||
    lower.startsWith('::ffff:10.') ||
    lower.startsWith('::ffff:127.') ||
    lower.startsWith('::ffff:192.168.') ||
    lower.includes(':0:0:0:0:0:0:1')
  );
}

function normalizeArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

module.exports = {
  createToolsService,
  normalizePublicUrl,
  runToolsCheck
};
