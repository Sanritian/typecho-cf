/**
 * iTheme 工具条 / TOC 纯状态逻辑测试。
 */
import { describe, expect, it } from 'vitest';
import { findActiveTocIndex, parseCommentCountText } from '@/themes/iTheme/assets/tool-state.js';

describe('parseCommentCountText()', () => {
  it('能解析纯数字评论数', () => {
    expect(parseCommentCountText('12')).toBe(12);
  });

  it('能从评论标签文本中提取数字', () => {
    expect(parseCommentCountText('12 条评论')).toBe(12);
  });

  it('空值或无数字文本返回 null', () => {
    expect(parseCommentCountText('')).toBeNull();
    expect(parseCommentCountText('暂无评论')).toBeNull();
    expect(parseCommentCountText(undefined)).toBeNull();
  });
});

describe('findActiveTocIndex()', () => {
  it('没有目录锚点时返回 -1', () => {
    expect(findActiveTocIndex([], 0)).toBe(-1);
  });

  it('会根据滚动位置定位当前目录项', () => {
    const markerTops = [320, 640, 980];

    expect(findActiveTocIndex(markerTops, 0)).toBe(0);
    expect(findActiveTocIndex(markerTops, 30)).toBe(0);
    expect(findActiveTocIndex(markerTops, 350)).toBe(1);
    expect(findActiveTocIndex(markerTops, 800)).toBe(2);
  });

  it('允许自定义偏移量', () => {
    const markerTops = [120, 360, 640];
    expect(findActiveTocIndex(markerTops, 0, 100)).toBe(0);
    expect(findActiveTocIndex(markerTops, 30, 100)).toBe(0);
  });
});
