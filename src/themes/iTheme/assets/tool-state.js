/**
 * iTheme 前端状态辅助函数。
 *
 * 这些函数保持纯净，方便给工具条和 TOC 的状态逻辑补单测，
 * 避免后续前端交互回归时只能靠手工点页面排查。
 */

export function parseCommentCountText(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return null;

  const matched = normalized.match(/\d+/);
  if (!matched) return null;

  const count = Number.parseInt(matched[0], 10);
  return Number.isFinite(count) ? count : null;
}

export function findActiveTocIndex(markerTops, scrollY, offset = 300) {
  if (!markerTops.length) return -1;

  const current = Math.max(0, scrollY) + offset;
  if (current <= markerTops[0]) return 0;
  let activeIndex = -1;

  for (let index = 0; index < markerTops.length; index += 1) {
    if (markerTops[index] <= current) {
      activeIndex = index;
    } else {
      break;
    }
  }

  return activeIndex;
}
