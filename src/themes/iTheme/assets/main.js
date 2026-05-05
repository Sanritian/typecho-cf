const state = {
  pageHtml: '',
  pageTitle: document.title,
  pageUrl: window.location.href,
  searchOpen: false,
  searchIndex: -1,
  tocOpen: false,
  colorTheme: 'light',
  cache: new Map(),
  pending: null,
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

function byId(id) {
  return document.getElementById(id);
}

function qs(selector, root = document) {
  return root.querySelector(selector);
}

function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
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

function parseHTML(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return tpl.content;
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

function updateCommentTips() {
  const tips = byId('tips');
  const pls = byId('pls');
  if (!tips || !pls) return;
  const count = pls.textContent?.trim() || '0';
  if (count === '0') {
    tips.style.display = 'none';
  } else {
    tips.textContent = count;
    tips.style.display = '';
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
  try {
    sessionStorage.setItem(normalizeUrl(window.location.href), state.pageHtml);
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
  const data = { title, url, html };
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
      <div class="TOCLevel${level}">
        <a class="TOCEntry" nohover onclick="scrollt('${anchorId}'); return false;" href="#${anchorId}">
          <span class="TOCSectNum">${sect}</span>${escapeHtml(heading.textContent || '')}
        </a>
      </div>
    `;
  }).join('');

  host.innerHTML = html;
  toc.appendChild(host);
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

function clearTOC() {
  const toc = byId('TOC');
  if (!toc) return;
  toc.className = '';
  toc.style.display = 'none';
  toc.innerHTML = '';
  state.tocOpen = false;
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
  bindCommentPager();
  bindComments();
  ensureSmileBox();
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
  const previousHtml = state.pageHtml;
  const previousTitle = state.pageTitle;
  const previousUrl = state.pageUrl;
  main.innerHTML = mainHtml;
  setSearchMode(false);
  document.title = extractTitle(html);
  state.pageUrl = previousUrl;
  state.pageHtml = previousHtml;
  state.pageTitle = previousTitle;
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

  event.preventDefault();
  navigate(target.href);
}

function bindLinks() {
  qsa('a[href]').forEach((link) => {
    if (link.closest('#comments') && link.closest('#comment-page-nav')) return;
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
    commentsButton.onclick = async () => {
      const comments = byId('comments');
      if (comments) {
        comments.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (qs('#post, #page')) {
        await loadCommentFragment(window.location.href.split('#')[0]);
        const nextComments = byId('comments');
        if (nextComments) nextComments.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        return false;
      }
      return false;
    };
  }

  const closeButton = byId('Tclose');
  if (closeButton) {
    closeButton.onclick = () => {
      const main = byId('main');
      if (main && state.pageHtml) {
        main.innerHTML = state.pageHtml;
        document.title = state.pageTitle;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        bindAll();
        history.pushState({ title: state.pageTitle, url: state.pageUrl, html: state.pageHtml }, state.pageTitle, state.pageUrl);
        history.replaceState({ title: state.pageTitle, url: state.pageUrl, html: state.pageHtml }, state.pageTitle, state.pageUrl);
      }
      return false;
    };
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
  toggle.onclick = () => {
    toggleColorTheme();
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

function bindPopState() {
  window.onpopstate = (event) => {
    if (event.state?.html) {
      const main = byId('main');
      if (!main) return;
      state.pageHtml = event.state.html;
      state.pageTitle = event.state.title || document.title;
      state.pageUrl = event.state.url || window.location.href;
      main.innerHTML = event.state.html;
      document.title = event.state.title || document.title;
      bindAll();
    } else {
      window.location.reload();
    }
  };
}

function bindAll() {
  setSearchMode(false);
  updateCommentTips();
  bindLinks();
  bindSearch();
  bindSidebar();
  bindToolButtons();
  bindDirectory();
  bindComments();
  bindThemeToggle();
  clearTOC();
  if (byId('post') || byId('page')) {
    createTOC();
    const closeButton = byId('Tclose');
    if (closeButton) closeButton.classList.remove('close');
  } else {
    const closeButton = byId('Tclose');
    if (closeButton) closeButton.classList.add('close');
  }
  const commentsButton = byId('Tcomments');
  if (commentsButton) {
    commentsButton.classList.toggle('close', !(byId('post') && byId('response') && byId('pls')));
  }
  lazyLoadImages();
  enhanceArticleContent();
}

window.TypechoComment = {
  reply: commentReply,
  cancelReply: commentCancelReply,
};

window.commentlist = function commentlist() {
  const comments = byId('comments');
  if (comments) {
    comments.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

window.scrollt = scrollt;

window.addEventListener('DOMContentLoaded', () => {
  rememberPage();
  bindAll();
  bindPopState();
  history.replaceState({ title: state.pageTitle, url: state.pageUrl, html: state.pageHtml }, state.pageTitle, state.pageUrl);
});
