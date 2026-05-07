/**
 * iTheme 页面缓存逻辑测试。
 */
import { describe, expect, it } from 'vitest';
import {
  createPageCache,
  parsePageCache,
  updatePageCacheCommentCount,
} from '@/themes/iTheme/assets/page-cache.js';

describe('createPageCache() / parsePageCache()', () => {
  it('会同时保存正文和标题，供异步切页恢复 document.title', () => {
    const raw = createPageCache('<h1 id="post">文章</h1>', '文章 - 湖畔');

    expect(parsePageCache(raw)).toEqual({
      mainHtml: '<h1 id="post">文章</h1>',
      title: '文章 - 湖畔',
      legacy: false,
    });
  });

  it('会把旧版纯 HTML 缓存识别成 legacy，提醒调用方回源', () => {
    expect(parsePageCache('<h1 id="post">旧缓存</h1>')).toEqual({
      mainHtml: '<h1 id="post">旧缓存</h1>',
      title: '',
      legacy: true,
    });
  });
});

describe('updatePageCacheCommentCount()', () => {
  it('更新评论数时会保留结构化缓存里的标题', () => {
    const raw = createPageCache('<span id="pls">2</span>', '文章 - 湖畔');
    const updated = updatePageCacheCommentCount(raw, '5');

    expect(parsePageCache(updated)).toEqual({
      mainHtml: '<span id="pls">5</span>',
      title: '文章 - 湖畔',
      legacy: false,
    });
  });

  it('旧版缓存也能只更新正文里的评论数', () => {
    expect(updatePageCacheCommentCount('<span id="pls">2</span>', '5')).toBe('<span id="pls">5</span>');
  });
});
