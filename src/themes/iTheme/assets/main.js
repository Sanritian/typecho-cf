import { findActiveTocIndex, parseCommentCountText } from './tool-state.js';

const state = {
  pageHtml: '',
  pageTitle: document.title,
  pageUrl: window.location.href,
  pageScrollY: 0,
  returnHtml: '',
  returnTitle: '',
  returnUrl: '',
  returnScrollY: 0,
  searchOpen: false,
  searchIndex: -1,
  tocOpen: false,
  colorTheme: 'light',
  activeNavHref: '',
  cache: new Map(),
  pending: null,
  tocEntries: [],
  tocMarkers: [],
  tocActiveIndex: -1,
  tocScrollHandler: null,
  tocScrollFrame: 0,
};

const SMILES = [
  'ฅ(๑˙˙๑)ฅ',
  '(╯°Д°)╯',
  '(๑•̀ㅁ•́ฅ)',
  '( •́ㅿ•̀ )',
  '(๑￫ܫ￩)',
  '_(:3」∠)_',
  '( ´◔ ‸◔` )',
  '（￣▽￣）',
  '(=・ω・=)',
  '(｀・ω・´)',
  '(〜￣△￣)〜',
  '(･∀･)',
  '(°∀°)ﾉ',
  '╮(￣▽￣)╭',
  '( ´_ゝ｀)',
  '(￣□￣)/',
  '(ﾟдﾟ;)',
  '（/TДT)/',
  '(｡･ω･｡)',
  '(ノ≧∇≦)ノ',
  '(´･_･`)',
  '(-_-#)',
  '（￣へ￣）',
  'ヽ(｀Д´)ﾉ',
  '(╯°口°)╯(┴—┴',
  '٩͡[๏̯͡๏]۶',
  '٩(×̯×)۶',
  '´_ゝ｀',
];

const CODE_LANGUAGE_ALIASES = {
  javascript: 'js',
  js: 'js',
  typescript: 'ts',
  ts: 'ts',
  jsx: 'jsx',
  tsx: 'tsx',
  json: 'json',
  bash: 'bash',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  html: 'html',
  xml: 'html',
  markup: 'html',
  css: 'css',
  scss: 'css',
  less: 'css',
  php: 'php',
  yaml: 'yaml',
  yml: 'yaml',
  diff: 'diff',
  plaintext: 'text',
  text: 'text',
};

const CODE_LANGUAGE_LABELS = {
  js: 'JS',
  ts: 'TS',
  jsx: 'JSX',
  tsx: 'TSX',
  json: 'JSON',
  bash: 'BASH',
  html: 'HTML',
  css: 'CSS',
  php: 'PHP',
  yaml: 'YAML',
  diff: 'DIFF',
  text: 'TEXT',
};

function byId(id) {
  return document.getElementById(id);
}

function qs(selector, root = document) {
  return root.querySelector(selector);
}

function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

function isDetailPage(root = document) {
  return !!(root.getElementById('post') || root.getElementById('page'));
}

function isAjaxRequest() {
  return window.__ITHEME_AJAX__ === true;
}

function stripScripts(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, '');
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function decodeHtml(text) {
  const div = document.createElement('div');
  div.innerHTML = text;
  return div.textContent || '';
}

function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }

  return new Promise((resolve, reject) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'readonly');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      resolve();
    } catch (error) {
      reject(error);
    } finally {
      document.body.removeChild(textarea);
    }
  });
}

function parseHTML(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return tpl.content;
}

function normalizeCodeLanguage(name) {
  if (!name) return '';
  const normalized = name.toLowerCase().replace(/^language-/, '').replace(/^lang-/, '');
  return CODE_LANGUAGE_ALIASES[normalized] || normalized;
}

function getCodeLanguage(code) {
  const classes = code.className.split(/\s+/).filter(Boolean);
  for (const className of classes) {
    const normalized = normalizeCodeLanguage(className);
    if (normalized) return normalized;
  }
  return '';
}

function getCodeLanguageLabel(language) {
  return CODE_LANGUAGE_LABELS[language] || language.toUpperCase();
}

function applyTokenRules(raw, registerRules) {
  let source = raw;
  const tokens = [];

  const stash = (pattern, className, formatter) => {
    source = source.replace(pattern, (...args) => {
      const match = args[0];
      const tokenHtml = formatter
        ? formatter(...args)
        : `<span class="code-${className}">${escapeHtml(match)}</span>`;
      const placeholder = `%%CODETOKEN${tokens.length}%%`;
      tokens.push(tokenHtml);
      return placeholder;
    });
  };

  registerRules(stash);

  return escapeHtml(source).replace(/%%CODETOKEN(\d+)%%/g, (_, index) => tokens[Number(index)] || '');
}

function highlightMarkup(raw) {
  let escaped = escapeHtml(raw);
  escaped = escaped.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="code-comment">$1</span>');
  escaped = escaped.replace(/(&lt;\/?)([\w:-]+)/g, '$1<span class="code-tag">$2</span>');
  escaped = escaped.replace(/([\w:-]+)(=)(&quot;.*?&quot;|&#39;.*?&#39;)/g, '<span class="code-attr">$1</span><span class="code-punctuation">$2</span><span class="code-string">$3</span>');
  return escaped;
}

function highlightCss(raw) {
  return applyTokenRules(raw, (stash) => {
    stash(/\/\*[\s\S]*?\*\//g, 'comment');
    stash(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, 'string');
    stash(/(^|[\s{;])(@[\w-]+)/gm, 'keyword', (_, prefix, atRule) => `${escapeHtml(prefix)}<span class="code-keyword">${escapeHtml(atRule)}</span>`);
    stash(/(^|[;{]\s*)([\w-]+)(?=\s*:)/gm, 'property', (_, prefix, prop) => `${escapeHtml(prefix)}<span class="code-property">${escapeHtml(prop)}</span>`);
    stash(/#[\da-fA-F]{3,8}\b/g, 'number');
    stash(/\b\d+(?:\.\d+)?(?:px|em|rem|vh|vw|%|ms|s|deg)?\b/g, 'number');
  });
}

function highlightJson(raw) {
  return applyTokenRules(raw, (stash) => {
    stash(/"(?:\\.|[^"\\])*"(?=\s*:)/g, 'property');
    stash(/"(?:\\.|[^"\\])*"/g, 'string');
    stash(/\b(?:true|false|null)\b/g, 'keyword');
    stash(/\b-?\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/gi, 'number');
  });
}

function highlightDiff(raw) {
  return applyTokenRules(raw, (stash) => {
    stash(/^\+.*$/gm, 'string');
    stash(/^-.*$/gm, 'comment');
    stash(/^@@.*$/gm, 'keyword');
  });
}

function highlightScriptLike(raw, options = {}) {
  const {
    keywords = [],
    builtins = [],
    variables = false,
  } = options;

  const keywordPattern = keywords.length > 0
    ? new RegExp(`\\b(?:${keywords.join('|')})\\b`, 'g')
    : null;
  const builtinPattern = builtins.length > 0
    ? new RegExp(`\\b(?:${builtins.join('|')})\\b`, 'g')
    : null;

  return applyTokenRules(raw, (stash) => {
    stash(/`(?:\\[\s\S]|[^`])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, 'string');
    stash(/\/\*[\s\S]*?\*\/|\/\/[^\n\r]*/g, 'comment');
    if (variables) {
      stash(/\$[A-Za-z_][\w]*/g, 'builtin');
    }
    stash(/\b(?:0x[\da-fA-F]+|\d+(?:\.\d+)?)\b/g, 'number');
    if (keywordPattern) stash(keywordPattern, 'keyword');
    if (builtinPattern) stash(builtinPattern, 'builtin');
  });
}

function highlightCode(raw, language) {
  switch (language) {
    case 'html':
      return highlightMarkup(raw);
    case 'css':
      return highlightCss(raw);
    case 'json':
      return highlightJson(raw);
    case 'diff':
      return highlightDiff(raw);
    case 'bash':
      return highlightScriptLike(raw, {
        keywords: ['if', 'then', 'else', 'fi', 'for', 'in', 'do', 'done', 'case', 'esac', 'while', 'function', 'echo', 'export', 'local', 'return', 'cd', 'ls', 'cat', 'grep', 'sed', 'awk', 'find', 'xargs', 'git', 'pnpm', 'npm'],
        variables: true,
      });
    case 'php':
      return highlightScriptLike(raw, {
        keywords: ['function', 'return', 'if', 'else', 'elseif', 'foreach', 'for', 'while', 'switch', 'case', 'break', 'continue', 'try', 'catch', 'finally', 'throw', 'new', 'class', 'extends', 'public', 'protected', 'private', 'static', 'echo', 'null', 'true', 'false'],
        builtins: ['array', 'json_encode', 'json_decode', 'count', 'isset', 'empty', 'require', 'include'],
        variables: true,
      });
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
      return highlightScriptLike(raw, {
        keywords: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'switch', 'case', 'break', 'continue', 'try', 'catch', 'finally', 'throw', 'new', 'class', 'extends', 'import', 'from', 'export', 'default', 'await', 'async', 'null', 'true', 'false', 'undefined', 'typeof', 'instanceof', 'in', 'of'],
        builtins: ['console', 'window', 'document', 'Math', 'JSON', 'Array', 'Object', 'Promise', 'Set', 'Map', 'Date', 'RegExp'],
      });
    case 'yaml':
      return applyTokenRules(raw, (stash) => {
        stash(/#.*$/gm, 'comment');
        stash(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, 'string');
        stash(/(^|\s)([\w-]+)(?=:\s)/gm, 'property', (_, prefix, prop) => `${escapeHtml(prefix)}<span class="code-property">${escapeHtml(prop)}</span>`);
        stash(/\b(?:true|false|null)\b/g, 'keyword');
        stash(/\b-?\d+(?:\.\d+)?\b/g, 'number');
      });
    default:
      return escapeHtml(raw);
  }
}

function enhanceCodeBlocks() {
  qsa('pre > code').forEach((code) => {
    const pre = code.parentElement;
    if (!pre || pre.dataset.codeEnhanced === '1') return;

    const language = getCodeLanguage(code);
    const raw = code.textContent || '';

    pre.dataset.codeEnhanced = '1';
    const wrapper = document.createElement('div');
    wrapper.className = 'code-block-wrap';
    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(pre);
    pre.classList.add('code-block');
    if (language) {
      pre.dataset.language = language;
    }

    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'code-copy';
    copy.setAttribute('aria-label', '复制代码');
    copy.setAttribute('title', '复制代码');
    copy.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9h9v11H9z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"></path><path d="M6 4h9v2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path><path d="M6 4v11h2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>';

    const feedback = document.createElement('span');
    feedback.className = 'code-copy-feedback';
    feedback.setAttribute('aria-hidden', 'true');

    copy.onclick = async () => {
      try {
        await copyText(raw);
        copy.classList.remove('is-failed');
        copy.classList.add('is-copied');
        copy.setAttribute('title', '已复制');
        copy.setAttribute('aria-label', '已复制');
        feedback.textContent = '已复制';
        feedback.classList.add('is-visible');
        window.setTimeout(() => {
          copy.setAttribute('title', '复制代码');
          copy.setAttribute('aria-label', '复制代码');
          copy.classList.remove('is-copied');
          feedback.classList.remove('is-visible');
        }, 1600);
      } catch {
        copy.classList.remove('is-copied');
        copy.classList.add('is-failed');
        copy.setAttribute('title', '复制失败');
        copy.setAttribute('aria-label', '复制失败');
        feedback.textContent = '复制失败';
        feedback.classList.add('is-visible');
        window.setTimeout(() => {
          copy.setAttribute('title', '复制代码');
          copy.setAttribute('aria-label', '复制代码');
          copy.classList.remove('is-failed');
          feedback.classList.remove('is-visible');
        }, 1600);
      }
    };

    wrapper.appendChild(copy);
    wrapper.appendChild(feedback);
    code.innerHTML = highlightCode(raw, language);
  });
}

function scrollt(id) {
  const target = byId(id);
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showTip(message, success) {
  const tipHost = byId('tip');
  if (!tipHost) return;

  const old = byId('Tip');
  if (old) old.remove();

  const wrapper = document.createElement('div');
  wrapper.id = 'Tip';
  wrapper.innerHTML = `
    <div class="tip ${success ? 'gray' : 'red'}">
      <div class="tip-box">
        <div class="tip-icon"><i ${success ? 'correct' : 'error'}></i></div>
        <div class="tip-message">${escapeHtml(message)}</div>
      </div>
    </div>
  `;
  tipHost.appendChild(wrapper);

  window.clearTimeout(showTip._timer);
  showTip._timer = window.setTimeout(() => wrapper.remove(), 3000);
}
showTip._timer = 0;

function getCurrentScrollY() {
  return window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
}

function isCommentToolAvailable() {
  const hasDetail = !!qs('#post, #page');
  if (!hasDetail) return false;

  return !!(byId('response') || byId('pls') || byId('comment-form') || qs('#comments .time'));
}

function getCommentCountText() {
  const visibleCount = parseCommentCountText(byId('pls')?.textContent);
  if (visibleCount !== null) return String(visibleCount);

  const commentsLabel = parseCommentCountText(qs('#comments .time')?.textContent);
  if (commentsLabel !== null) return String(commentsLabel);

  return '0';
}

function updateDetailCacheCommentCount() {
  const count = getCommentCountText();
  const cacheKey = normalizeUrl(window.location.href.split('#')[0]);
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (!cached) return;
    const next = cached.replace(/(<span id="pls">)\d+(<\/span>)/, `$1${count}$2`);
    sessionStorage.setItem(cacheKey, next);
  } catch {}
}

function updateCommentTips() {
  const tips = byId('tips');
  if (!tips) return;

  if (!isCommentToolAvailable()) {
    tips.textContent = '0';
    tips.style.display = 'none';
    return;
  }

  const count = getCommentCountText();
  if (count === '0') {
    tips.style.display = 'none';
  } else {
    tips.textContent = count;
    tips.style.display = 'block';
  }
}

function normalizeUrl(url) {
  return url.replace(/[~`!@#$%^&*()\-+=|\\[\]{};:'",<.>/? ]/g, '');
}

function rememberPage() {
  const main = byId('main');
  if (!main) return;
  state.pageHtml = main.innerHTML;
  state.pageTitle = document.title;
  state.pageUrl = window.location.href;
  state.pageScrollY = getCurrentScrollY();
  if (!isDetailPage()) {
    state.returnHtml = state.pageHtml;
    state.returnTitle = state.pageTitle;
    state.returnUrl = state.pageUrl;
    state.returnScrollY = state.pageScrollY;
  }
  try {
    // 对齐原主题：评论异步加载后的 DOM 不写回页面缓存，避免切文章后仍保持“已加载评论”状态。
    if (!byId('comments')) {
      sessionStorage.setItem(normalizeUrl(window.location.href), state.pageHtml);
    }
  } catch {}
}

function loadFromCache(url) {
  try {
    return sessionStorage.getItem(normalizeUrl(url));
  } catch {
    return null;
  }
}

async function fetchText(url, options = {}) {
  if (state.pending?.abort) {
    state.pending.abort.abort();
  }

  const abort = new AbortController();
  state.pending = { abort };
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      'X-PJAX': 'true',
    },
    signal: abort.signal,
    ...options,
  });

  if (!response.ok) {
    throw new Error(`请求失败: ${response.status}`);
  }

  return response.text();
}

function extractMainHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const main = doc.querySelector('#main');
  if (main) return main.innerHTML;
  return html;
}

function extractTitle(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const title = doc.querySelector('title');
  if (!title) return document.title;
  return decodeHtml((title.textContent || '').replace(/<!--.*?-->/g, ''));
}

function updateHistory(url, title, html, replace = false) {
  const data = {
    title,
    url,
    html,
    scrollY: getCurrentScrollY(),
  };
  if (replace) {
    history.replaceState(data, title, url);
  } else {
    history.pushState(data, title, url);
  }
}

function getPreferredTheme() {
  try {
    const stored = localStorage.getItem('itheme-color-scheme');
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {}
  const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  return systemDark ? 'dark' : 'light';
}

function normalizeHrefForCompare(href) {
  try {
    const url = new URL(href, window.location.origin);
    const normalizedPath = url.pathname.replace(/\/$/, '') || '/';
    return `${url.origin}${normalizedPath}`;
  } catch {
    return href || '';
  }
}

function getStoredActiveNavHref() {
  try {
    return localStorage.getItem('itheme-active-nav') || '';
  } catch {
    return '';
  }
}

function setStoredActiveNavHref(href) {
  state.activeNavHref = href;
  try {
    localStorage.setItem('itheme-active-nav', href);
  } catch {}
}

function updateNavActiveState() {
  const current = state.activeNavHref || getStoredActiveNavHref();
  const links = qsa('ul.menu a');
  links.forEach((link) => {
    const id = link.getAttribute('id') || '';
    if (id === 'theme-toggle') {
      link.classList.remove('current');
      return;
    }
    if (id === 's') {
      link.classList.toggle('current', current === 'SEARCH');
      return;
    }

    const href = link.getAttribute('href') || '';
    link.classList.toggle('current', current !== '' && normalizeHrefForCompare(href) === current);
  });
}

function applyColorTheme(theme) {
  state.colorTheme = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.classList.toggle('theme-dark', state.colorTheme === 'dark');
  document.documentElement.style.colorScheme = state.colorTheme === 'dark' ? 'dark' : 'light';
  const toggle = byId('theme-toggle');
  if (toggle) {
    toggle.innerHTML = state.colorTheme === 'dark'
      ? '日间<strong>DAY</strong>'
      : '夜间<strong>NIGHT</strong>';
  }
}

function toggleColorTheme() {
  const next = state.colorTheme === 'dark' ? 'light' : 'dark';
  applyColorTheme(next);
  try {
    localStorage.setItem('itheme-color-scheme', next);
  } catch {}
}

function setSearchMode(open) {
  state.searchOpen = open;
  state.searchIndex = -1;
  const main = byId('main');
  const search = byId('search');
  if (!main || !search) return;

  if (open) {
    main.style.display = 'none';
    search.style.display = 'block';
    const input = byId('search-input');
    if (input) {
      window.setTimeout(() => input.focus(), 0);
    }
  } else {
    main.style.display = 'block';
    search.style.display = 'none';
  }
}

function getSearchItems() {
  return qsa('#search-result .ins-search-item');
}

function updateSearchSelection(nextIndex) {
  const items = getSearchItems();
  if (!items.length) {
    state.searchIndex = -1;
    return;
  }

  const max = items.length - 1;
  const normalized = nextIndex < 0 ? max : nextIndex > max ? 0 : nextIndex;
  state.searchIndex = normalized;

  items.forEach((item, index) => {
    item.classList.toggle('active', index === normalized);
  });

  const current = items[normalized];
  if (current) {
    current.scrollIntoView({ block: 'nearest' });
  }
}

function buildSearchResults(data, keywords) {
  const resultHost = byId('search-result');
  if (!resultHost) return;

  const input = (keywords || '').trim().toLowerCase();
  if (!input) {
    resultHost.innerHTML = '';
    return;
  }

  const matched = data.filter((item) => (
    `${item.title || ''}${item.text || ''}`.toLowerCase().includes(input)
  ));

  const groups = {
    post: [],
    page: [],
    category: [],
    tag: [],
  };

  matched.forEach((item) => {
    if (item.this === 'post') groups.post.push(item);
    else if (item.this === 'page') groups.page.push(item);
    else if (item.this === 'tag') groups.tag.push(item);
    else groups.category.push(item);
  });

  const renderGroup = (title, items, showPreview) => {
    if (!items.length) return '';
    return `
      <section class="ins-section">
        <header class="ins-section-header">${title}</header>
        ${items.map((item) => `
          <a class="ins-search-item ins-search-${item.this} ins-selectable" href="${item.link}">
            <header>${escapeHtml(item.title)}</header>
            ${showPreview ? `<p class="ins-search-preview">${escapeHtml(item.text || '')}</p>` : ''}
          </a>
        `).join('')}
      </section>
    `;
  };

  resultHost.innerHTML = [
    renderGroup('文章', groups.post, true),
    renderGroup('页面', groups.page, true),
    renderGroup('分类', groups.category, false),
    renderGroup('标签', groups.tag, false),
  ].join('');

  qsa('a', resultHost).forEach((link) => {
    link.addEventListener('click', handleNavClick);
  });
  state.searchIndex = -1;
}

function getSearchData() {
  if (Array.isArray(window.__ITHEME_SEARCH_DATA__)) return window.__ITHEME_SEARCH_DATA__;
  return [];
}

async function ensureSearchData() {
  const current = getSearchData();
  if (current.length > 0) return current;

  const endpoint = window.__ITHEME_SEARCH_API__ || '/api/theme/itheme-search';
  const response = await fetch(endpoint, {
    credentials: 'same-origin',
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
    },
  });
  if (!response.ok) {
    throw new Error(`搜索索引加载失败: ${response.status}`);
  }
  const data = await response.json();
  if (Array.isArray(data)) {
    window.__ITHEME_SEARCH_DATA__ = data;
    return data;
  }
  return [];
}

function createTOC() {
  const article = qs('#main article');
  const toc = byId('TOC');
  if (!article || !toc) return;

  const headings = qsa('h2, h3, h4', article);
  if (!headings.length) {
    toc.innerHTML = '';
    return;
  }

  toc.style.display = 'none';
  toc.innerHTML = '<span id="TOC-close"></span><h2 style="text-align:center">文章目录</h2>';
  const host = document.createElement('div');
  host.id = 'TOC-list';

  let counters = [0, 0, 0];
  const html = headings.map((heading) => {
    const level = Number.parseInt(heading.tagName.substring(1), 10) - 1;
    if (level < 1 || level > 3) return '';
    counters[level - 1] += 1;
    for (let idx = level; idx < 3; idx += 1) counters[idx] = 0;
    const sect = counters.slice(0, level).join('.');
    const anchorId = `TOC${sect}`;
    const marker = document.createElement('a');
    marker.id = anchorId;
    marker.setAttribute('class', 'Toclist');
    heading.parentNode?.insertBefore(marker, heading);
    marker.appendChild(heading);
    return `
      <div class="TOCEntry TOCLevel${level}">
        <a nohover onclick="scrollt('${anchorId}'); return false;" href="#${anchorId}">
          <span class="TOCSectNum">${sect}</span>${escapeHtml(heading.textContent || '')}
        </a>
      </div>
    `;
  }).join('');

  host.innerHTML = html;
  toc.appendChild(host);
  state.tocMarkers = qsa('.Toclist', byId('main') || document);
  state.tocEntries = qsa('.TOCEntry', host);
  state.tocActiveIndex = -1;
  state.tocScrollHandler = () => {
    if (state.tocScrollFrame) return;
    state.tocScrollFrame = window.requestAnimationFrame(() => {
      state.tocScrollFrame = 0;
      syncTocActiveEntry();
    });
  };
  window.addEventListener('scroll', state.tocScrollHandler, { passive: true });
  syncTocActiveEntry();
  window.setTimeout(() => {
    if (!byId('TOC')) return;
    toc.style.display = 'block';
    const tocClose = byId('TOC-close');
    const sidebar = byId('Tsidebar');
    if (tocClose && sidebar?.children[0]) {
      tocClose.innerHTML = sidebar.children[0].innerHTML;
      tocClose.onclick = () => {
        toggleTOC();
        return false;
      };
    }
  }, 500);
}

function clearTocTracking() {
  if (state.tocScrollHandler) {
    window.removeEventListener('scroll', state.tocScrollHandler);
  }
  if (state.tocScrollFrame) {
    window.cancelAnimationFrame(state.tocScrollFrame);
  }
  state.tocEntries = [];
  state.tocMarkers = [];
  state.tocActiveIndex = -1;
  state.tocScrollHandler = null;
  state.tocScrollFrame = 0;
}

function setActiveTocEntry(nextIndex) {
  if (state.tocActiveIndex === nextIndex) return;
  state.tocActiveIndex = nextIndex;
  state.tocEntries.forEach((entry, index) => {
    entry.classList.toggle('is-active', index === nextIndex);
  });

  if (nextIndex >= 0 && state.tocOpen && state.tocEntries[nextIndex]) {
    state.tocEntries[nextIndex].scrollIntoView({ block: 'nearest' });
  }
}

function syncTocActiveEntry() {
  if (!state.tocMarkers.length || !state.tocEntries.length) {
    setActiveTocEntry(-1);
    return;
  }

  const markerTops = state.tocMarkers.map((marker) => marker.getBoundingClientRect().top + getCurrentScrollY());
  const activeIndex = findActiveTocIndex(markerTops, getCurrentScrollY());
  setActiveTocEntry(activeIndex);
}

function clearTOC() {
  clearTocTracking();
  const toc = byId('TOC');
  state.tocOpen = false;
  if (!toc) return;
  toc.className = '';
  toc.style.display = 'none';
  toc.innerHTML = '';
}

function toggleTOC(force) {
  const toc = byId('TOC');
  if (!toc) return;
  const next = typeof force === 'boolean' ? force : !state.tocOpen;
  state.tocOpen = next;
  toc.classList.toggle('TOCOpen', next);
  const tocClose = byId('TOC-close');
  const sidebar = byId('Tsidebar');
  const closeButton = byId('Tclose');
  if (tocClose && sidebar?.children[0] && closeButton?.children[0]) {
    tocClose.innerHTML = next ? closeButton.children[0].innerHTML : sidebar.children[0].innerHTML;
  }
  if (next) {
    syncTocActiveEntry();
  }
}

function openSidebar(open) {
  const bar = byId('bar');
  const backdrop = byId('backdrop');
  const sidebarButton = byId('Tsidebar');
  const closeButton = byId('Tclose');
  if (!bar || !backdrop || !sidebarButton || !closeButton) return;

  bar.classList.toggle('hidden', !open);
  backdrop.classList.toggle('open', open);
  sidebarButton.classList.toggle('close', open);
  closeButton.classList.toggle('close', true);
}

function closeTransientUi() {
  setSearchMode(false);
  openSidebar(false);
  clearTOC();
}

function lazyLoadImages() {
  const images = qsa('img[data-src]');
  if (!images.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const img = entry.target;
      const src = img.getAttribute('data-src');
      if (src) {
        img.src = src;
        img.onload = () => img.classList.add('loaded');
        img.removeAttribute('data-src');
      }
      observer.unobserve(img);
    });
  });

  images.forEach((img) => observer.observe(img));
}

function enhanceArticleContent() {
  qsa('article a[href]').forEach((link) => {
    const href = link.getAttribute('href') || '';
    if (href.startsWith('#')) return;
    if (/^https?:\/\//i.test(href) && !href.startsWith(location.origin)) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
  });
}

function commentReply(commentId, coid, replyText) {
  const comment = byId(commentId);
  const respond = byId('respond');
  const cancel = byId('cancel-comment-reply-link');
  const parentInput = byId('comment-parent');
  const replyName = qs('.reply-name');
  if (!comment || !respond || !parentInput) return false;

  parentInput.value = String(coid);
  comment.appendChild(respond);
  if (replyName) replyName.textContent = replyText || '';
  if (cancel) cancel.parentElement.style.display = '';
  const textarea = byId('textarea');
  if (textarea) textarea.focus();
  return false;
}

function commentCancelReply() {
  const comments = byId('comments');
  const respond = byId('respond');
  const parentInput = byId('comment-parent');
  const cancel = byId('cancel-comment-reply-link');
  if (!comments || !respond || !parentInput) return false;

  parentInput.value = '0';
  comments.appendChild(respond);
  if (cancel) cancel.parentElement.style.display = 'none';
  return false;
}

function ensureSmileBox() {
  const form = byId('comment-form');
  if (!form || qs('.smile', form)) return;

  const list = document.createElement('ul');
  list.className = 'smile';
  SMILES.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    li.addEventListener('click', () => {
      const textarea = byId('textarea');
      if (!textarea) return;
      textarea.value += item;
      textarea.focus();
    });
    list.appendChild(li);
  });

  const inputGroup = qs('.comment-input', form);
  if (inputGroup) {
    form.insertBefore(list, inputGroup);
  } else {
    form.appendChild(list);
  }
}

function removeCommentLoading() {
  qsa('.center', byId('main') || document).forEach((node) => node.remove());
}

function showCommentLoading() {
  const main = byId('main');
  if (!main || qs('.center', main) || byId('comments')) return;
  const loading = document.createElement('h2');
  loading.className = 'center';
  loading.textContent = '评论加载中···';
  main.appendChild(loading);
  showTip('评论加载中···', true);
}

async function loadCommentFragment(url) {
  const hadComments = !!byId('comments');
  showCommentLoading();
  const html = await fetchText(url.includes('?') ? `${url}&c=a` : `${url}?c=a`);
  const fragment = parseHTML(html);
  const next = fragment.querySelector('#comments');
  const comments = byId('comments');
  if (next && comments) {
    comments.replaceWith(next);
  } else if (next) {
    const main = byId('main');
    if (main) main.appendChild(next);
  } else if (comments) {
    comments.innerHTML = html;
  }
  removeCommentLoading();
  updateCommentTips();
  updateDetailCacheCommentCount();
  bindCommentPager();
  bindComments();
  ensureSmileBox();
  if (!hadComments && byId('comments')) {
    showTip('评论加载完成', true);
  }
}

async function submitComment(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = byId('submit');
  if (!(form instanceof HTMLFormElement)) return;

  const text = byId('textarea');
  if (text && !text.value.trim()) {
    showTip('请填写评论内容！', false);
    return;
  }

  submit.textContent = '寄出中···';
  submit.style.pointerEvents = 'none';

  try {
    const body = new URLSearchParams(new FormData(form));
    const response = await fetch(form.action, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body,
      credentials: 'same-origin',
      redirect: 'manual',
    });

    if (response.status >= 400) {
      const message = await response.text();
      showTip(message || '提交失败', false);
      return;
    }

    const redirect = response.headers.get('Location') || response.headers.get('location') || window.location.href;
    await loadCommentFragment(redirect.split('#')[0]);

    form.reset();
    commentCancelReply();
    const pls = byId('pls');
    if (pls) {
      const count = Number.parseInt(pls.textContent || '0', 10) + 1;
      pls.textContent = String(count);
    }
    updateCommentTips();
    updateDetailCacheCommentCount();
    showTip('寄出成功！', true);
  } catch (error) {
    showTip(error instanceof Error ? error.message : '提交失败', false);
  } finally {
    submit.textContent = '发射';
    submit.style.pointerEvents = '';
  }
}

function bindCommentPager() {
  qsa('#comment-page-nav a').forEach((link) => {
    link.addEventListener('click', async (event) => {
      event.preventDefault();
      const href = link.getAttribute('href');
      if (!href) return;
      try {
        await loadCommentFragment(href.split('#')[0]);
      } catch (error) {
        showTip(error instanceof Error ? error.message : '评论加载失败', false);
      }
    });
  });
}

async function renderPage(url, html, { replaceHistory = false } = {}) {
  const main = byId('main');
  if (!main) return;

  const mainHtml = extractMainHtml(html);
  main.innerHTML = mainHtml;
  setSearchMode(false);
  document.title = extractTitle(html);
  if (replaceHistory) {
    updateHistory(url, document.title, main.innerHTML, true);
  } else {
    updateHistory(url, document.title, main.innerHTML, false);
  }
  bindAll();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function navigate(url, { replace = false } = {}) {
  const target = new URL(url, window.location.origin);
  if (target.origin !== window.location.origin) {
    window.location.href = target.href;
    return;
  }

  const pathname = target.pathname;
  if (pathname.endsWith('.php')) {
    window.location.href = target.href;
    return;
  }

  try {
    rememberPage();
    const cached = loadFromCache(target.href);
    if (cached) {
      await renderPage(target.href, `<section id="main">${cached}</section><title>${document.title}</title>`, { replaceHistory: replace });
      return;
    }

    const html = await fetchText(target.href);
    try {
      sessionStorage.setItem(normalizeUrl(target.href), extractMainHtml(html));
    } catch {}
    await renderPage(target.href, html, { replaceHistory: replace });
  } catch (error) {
    showTip(error instanceof Error ? error.message : '请求失败', false);
  }
}

function handleNavClick(event) {
  const link = event.currentTarget;
  if (!(link instanceof HTMLAnchorElement)) return;
  const href = link.getAttribute('href') || '';
  if (!href || href.startsWith('#') || link.target === '_blank' || link.hasAttribute('download')) return;
  if (href.startsWith('javascript:')) return;

  const target = new URL(href, window.location.origin);
  if (target.origin !== window.location.origin) return;
  const id = link.getAttribute('id') || '';
  if (link.closest('ul.menu') && id !== 'theme-toggle') {
    setStoredActiveNavHref(id === 's' ? 'SEARCH' : normalizeHrefForCompare(target.href));
  }

  event.preventDefault();
  navigate(target.href);
}

function bindLinks() {
  qsa('a[href]').forEach((link) => {
    if (link.closest('#comments') && link.closest('#comment-page-nav')) return;
    if (link.closest('#bar h1')) {
      link.onclick = (event) => {
        const href = link.getAttribute('href') || window.location.origin;
        setStoredActiveNavHref(normalizeHrefForCompare(href));
        updateNavActiveState();
        event.preventDefault();
        navigate(href);
      };
      return;
    }
    link.removeEventListener('click', handleNavClick);
    link.addEventListener('click', handleNavClick);
  });
}

function bindSearch() {
  const openButton = byId('s');
  const closeButton = byId('search-close');
  const input = byId('search-input');
  const form = byId('search-form');

  if (openButton) {
    openButton.onclick = () => {
      setStoredActiveNavHref('SEARCH');
      updateNavActiveState();
      setSearchMode(true);
      if (input) input.focus();
      return false;
    };
  }

  if (closeButton) {
    closeButton.onclick = () => {
      setSearchMode(false);
    };
  }

  if (input) {
    input.oninput = async () => {
      const data = await ensureSearchData();
      buildSearchResults(data, input.value);
    };
    input.onkeydown = async (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setSearchMode(false);
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        updateSearchSelection(state.searchIndex + 1);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        updateSearchSelection(state.searchIndex - 1);
        return;
      }

      if (event.key === 'Enter') {
        const items = getSearchItems();
        if (state.searchIndex >= 0 && items[state.searchIndex]) {
          event.preventDefault();
          items[state.searchIndex].click();
          return;
        }
      }

      if (event.key === 'Enter' && input.value.trim()) {
        event.preventDefault();
        setStoredActiveNavHref('SEARCH');
        await navigate(`/search/${encodeURIComponent(input.value.trim())}/`);
      }
    };
  }

  if (form) {
    form.onsubmit = async (event) => {
      event.preventDefault();
      const keywords = (input?.value || '').trim();
      if (!keywords) {
        showTip('请输入搜索内容!', false);
        return false;
      }
      setStoredActiveNavHref('SEARCH');
      await navigate(`/search/${encodeURIComponent(keywords)}/`);
      return false;
    };
  }

  document.onkeydown = (event) => {
    const current = event || window.event;
    const active = document.activeElement;
    if (current.key === 'Escape' && state.searchOpen) {
      setSearchMode(false);
      if (active && active.blur) active.blur();
    }
  };
}

function bindSidebar() {
  const sidebarButton = byId('Tsidebar');
  const backdrop = byId('backdrop');
  if (sidebarButton) sidebarButton.onclick = () => openSidebar(true);
  if (backdrop) backdrop.onclick = () => openSidebar(false);
}

function bindToolButtons() {
  const topButton = byId('Ttop');
  if (topButton) {
    topButton.onclick = () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
  }

  const commentsButton = byId('Tcomments');
  if (commentsButton) {
    commentsButton.onclick = () => {
      window.commentlist();
      return false;
    };
  }

  const closeButton = byId('Tclose');
  if (closeButton) {
    closeButton.onclick = () => {
      const main = byId('main');
      if (main && state.returnHtml) {
        main.innerHTML = state.returnHtml;
        document.title = state.returnTitle;
        window.scrollTo(0, state.returnScrollY || 0);
        bindAll();
        history.pushState({ title: state.returnTitle, url: state.returnUrl, html: state.returnHtml, scrollY: state.returnScrollY || 0 }, state.returnTitle, state.returnUrl);
        history.replaceState({ title: state.returnTitle, url: state.returnUrl, html: state.returnHtml, scrollY: state.returnScrollY || 0 }, state.returnTitle, state.returnUrl);
      }
      return false;
    };
  }
}

function syncToolButtons() {
  const closeButton = byId('Tclose');
  if (closeButton) {
    closeButton.classList.toggle('close', !state.returnHtml || !isDetailPage());
  }

  const commentsButton = byId('Tcomments');
  if (commentsButton) {
    commentsButton.classList.toggle('close', !isCommentToolAvailable());
  }
}

function bindDirectory() {
  qsa('#nav em').forEach((em) => {
    em.onclick = () => {
      const ul = em.parentElement?.querySelector('ul');
      if (!ul) return;
      ul.classList.toggle('off');
      em.classList.toggle('off');
    };
  });
}

function bindThemeToggle() {
  applyColorTheme(getPreferredTheme());
  const toggle = byId('theme-toggle');
  if (!toggle) return;
  toggle.onclick = (event) => {
    toggleColorTheme();
    if (event && event.currentTarget && event.currentTarget.blur) {
      event.currentTarget.blur();
    }
    return false;
  };
}

function bindComments() {
  const form = byId('comment-form');
  if (form) {
    form.removeEventListener('submit', submitComment);
    form.addEventListener('submit', submitComment);
  }
  bindCommentPager();
  ensureSmileBox();
}

function getLastByClass(className) {
  const items = qsa(`.${className}`);
  return items.length > 0 ? items[items.length - 1] : null;
}

function updateMoreTime() {
  const more = byId('more');
  const lastTime = getLastByClass('time');
  const loadmore = getLastByClass('loadmore');
  if (more && lastTime && loadmore) {
    more.textContent = lastTime.textContent || '';
    loadmore.style.pointerEvents = '';
  }
}

function updateMoreState(hasNext) {
  const loadmore = getLastByClass('loadmore');
  if (!loadmore) return;
  if (!hasNext) {
    loadmore.innerHTML = '<span>已经到底啦~</span>';
    loadmore.style.pointerEvents = 'none';
  }
}

async function appendMorePosts(trigger) {
  const nextLinks = qsa('.next');
  const nextLink = nextLinks.length > 0 ? nextLinks[nextLinks.length - 1] : null;
  if (!(nextLink instanceof HTMLAnchorElement)) return;

  trigger.style.pointerEvents = 'none';
  trigger.textContent = '加载中~';

  try {
    const html = await fetchText(nextLink.href);
    const fragment = parseHTML(html);
    const nextBox = fragment.querySelector('#box');
    const currentBox = byId('box');
    if (!nextBox || !currentBox) return;

    const rows = Array.from(nextBox.childNodes);
    rows.forEach((row) => {
      if (row.nodeType === 1) {
        currentBox.appendChild(row);
      }
    });

    trigger.innerHTML = '加载<span id="more"></span>的文章';
    updateMoreTime();
    updateMoreState(html.indexOf('class="next') > -1);
    bindAll();
  } catch (error) {
    trigger.textContent = '加载失败，重试';
    trigger.style.pointerEvents = '';
    showTip(error instanceof Error ? error.message : '请求失败', false);
  }
}

function bindLoadMorePosts() {
  const more = byId('more');
  if (!more) return;
  const loadmore = getLastByClass('loadmore');
  const lastTime = getLastByClass('time');
  if (!loadmore || !lastTime) return;

  loadmore.onclick = () => appendMorePosts(loadmore);
  updateMoreTime();
  updateMoreState(qsa('.next').length > 0);
}

function bindPopState() {
  window.onpopstate = (event) => {
    if (event.state?.html) {
      const main = byId('main');
      if (!main) return;
      state.pageHtml = event.state.html;
      state.pageTitle = event.state.title || document.title;
      state.pageUrl = event.state.url || window.location.href;
      state.pageScrollY = event.state.scrollY || 0;
      main.innerHTML = event.state.html;
      document.title = event.state.title || document.title;
      bindAll();
      window.scrollTo(0, state.pageScrollY || 0);
    } else {
      window.location.reload();
    }
  };
}

function bindAll() {
  closeTransientUi();
  updateCommentTips();
  bindLinks();
  bindSearch();
  bindSidebar();
  bindToolButtons();
  bindDirectory();
  bindComments();
  bindThemeToggle();
  updateNavActiveState();
  if (byId('post') || byId('page')) {
    createTOC();
  } else {
    rememberPage();
  }
  syncToolButtons();
  bindLoadMorePosts();
  lazyLoadImages();
  enhanceArticleContent();
  enhanceCodeBlocks();
}

window.TypechoComment = {
  reply: commentReply,
  cancelReply: commentCancelReply,
};

window.commentlist = function commentlist() {
  const comments = byId('comments');
  if (comments) {
    comments.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  if (qs('#post, #page')) {
    loadCommentFragment(window.location.href.split('#')[0]).then(() => {
      const nextComments = byId('comments');
      if (nextComments) {
        nextComments.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }).catch((error) => {
      showTip(error instanceof Error ? error.message : '评论加载失败', false);
    });
  }
};

window.scrollt = scrollt;

window.addEventListener('DOMContentLoaded', () => {
  rememberPage();
  bindAll();
  bindPopState();
  history.replaceState({ title: state.pageTitle, url: state.pageUrl, html: state.pageHtml, scrollY: state.pageScrollY || 0 }, state.pageTitle, state.pageUrl);
});
