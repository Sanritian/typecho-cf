/**
 * iTheme 页面缓存辅助函数。
 *
 * 缓存命中时不仅要恢复正文，还要恢复当时的页面标题；
 * 否则异步切页会出现“内容已经切过去了，但 document.title 还停留在上一页”的错位。
 */

const PAGE_CACHE_VERSION = 1;

export function createPageCache(mainHtml, title) {
  return JSON.stringify({
    v: PAGE_CACHE_VERSION,
    mainHtml: typeof mainHtml === 'string' ? mainHtml : '',
    title: typeof title === 'string' ? title : '',
  });
}

export function parsePageCache(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    const mainHtml = typeof parsed.mainHtml === 'string' ? parsed.mainHtml : '';
    const title = typeof parsed.title === 'string' ? parsed.title : '';
    if (!mainHtml) return null;

    return {
      mainHtml,
      title,
      legacy: false,
    };
  } catch {
    return {
      mainHtml: raw,
      title: '',
      legacy: true,
    };
  }
}

export function updatePageCacheCommentCount(raw, count) {
  const cached = parsePageCache(raw);
  if (!cached) return raw;

  const nextMainHtml = cached.mainHtml.replace(
    /(<span id="pls">)\d+(<\/span>)/,
    `$1${count}$2`,
  );

  if (nextMainHtml === cached.mainHtml) return raw;
  if (cached.legacy) return nextMainHtml;

  return createPageCache(nextMainHtml, cached.title);
}
