/**
 * 页面标题拼装规则测试。
 */
import { describe, expect, it } from 'vitest';
import {
  buildDocumentTitle,
  normalizeTitleSegment,
  resolveThemeLayoutTitle,
} from '@/lib/page-title';

describe('normalizeTitleSegment()', () => {
  it('会去掉首尾空白并过滤空字符串', () => {
    expect(normalizeTitleSegment('  湖畔  ')).toBe('湖畔');
    expect(normalizeTitleSegment('   ')).toBeUndefined();
    expect(normalizeTitleSegment(undefined)).toBeUndefined();
  });
});

describe('buildDocumentTitle()', () => {
  it('优先使用完整标题覆盖值', () => {
    expect(buildDocumentTitle({
      title: '文章标题',
      fullTitle: '湖畔 - 生活随笔',
      siteTitle: '湖畔',
    })).toBe('湖畔 - 生活随笔');
  });

  it('普通页面会自动追加站点标题', () => {
    expect(buildDocumentTitle({
      title: '关于',
      siteTitle: '湖畔',
    })).toBe('关于 - 湖畔');
  });

  it('缺少页面标题时回退到站点标题', () => {
    expect(buildDocumentTitle({
      siteTitle: '湖畔',
    })).toBe('湖畔');
  });
});

describe('resolveThemeLayoutTitle()', () => {
  it('首页使用站点标题和站点描述生成完整标题', () => {
    expect(resolveThemeLayoutTitle(undefined, '湖畔', '生活随笔')).toEqual({
      fullTitle: '湖畔 - 生活随笔',
    });
  });

  it('文章页只返回页面标题片段，避免重复拼接站点标题', () => {
    expect(resolveThemeLayoutTitle('文章标题', '湖畔', '生活随笔')).toEqual({
      title: '文章标题',
    });
  });
});
