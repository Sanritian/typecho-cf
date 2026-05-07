/**
 * iTheme 页面预取判定辅助函数。
 */

const SLOW_CONNECTION_TYPES = new Set(['slow-2g', '2g']);

export function shouldSkipPrefetchByConnection(connection) {
  if (!connection || typeof connection !== 'object') return false;
  if (connection.saveData === true) return true;

  const effectiveType = typeof connection.effectiveType === 'string'
    ? connection.effectiveType.toLowerCase()
    : '';

  return SLOW_CONNECTION_TYPES.has(effectiveType);
}

export function resolvePrefetchUrl(href, origin) {
  if (typeof href !== 'string') return null;
  const normalizedHref = href.trim();
  if (!normalizedHref || normalizedHref.startsWith('#') || normalizedHref.startsWith('javascript:')) {
    return null;
  }

  try {
    const target = new URL(normalizedHref, origin);
    if (target.origin !== origin) return null;
    if (target.pathname.endsWith('.php')) return null;
    target.hash = '';
    return target.href;
  } catch {
    return null;
  }
}
