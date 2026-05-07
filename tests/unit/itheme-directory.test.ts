/**
 * iTheme 分类目录渲染测试。
 */
import { describe, expect, it } from 'vitest';
import { getDirectoryHtml, getNavHtml, parseDirectoryConfig } from '@/themes/iTheme/components/shared';

describe('parseDirectoryConfig()', () => {
  it('同时兼容中英文逗号和分号', () => {
    expect(parseDirectoryConfig('1,默认分类;2，技术')).toEqual([
      { id: 1, labelHtml: '默认分类' },
      { id: 2, labelHtml: '技术' },
    ]);
  });
});

describe('getDirectoryHtml()', () => {
  it('按原主题风格从指定父分类递归输出子分类', () => {
    const html = getDirectoryHtml({
      themeConfig: { fl: '1，默认分类' },
      allCategories: [
        { mid: 1, parent: 0, name: '默认分类', slug: 'default', count: 0, permalink: '/default/' },
        { mid: 3, parent: 2, name: '子分类 B', slug: 'child-b', count: 0, permalink: '/child-b/' },
        { mid: 2, parent: 1, name: '子分类 A', slug: 'child-a', count: 0, permalink: '/child-a/' },
        { mid: 4, parent: 1, name: '子分类 C', slug: 'child-c', count: 0, permalink: '/child-c/' },
      ],
    } as any);

    expect(html).toBe('<div><ul><li id="nav"><a href="javascript:void(0)" class="item directory-label">分类</a><em></em><ul><li><a href="/default/" class="item directory-label">默认分类</a><em></em><ul><li><a href="/child-a/" class="item">子分类 A</a><em></em><ul><li><a href="/child-b/" class="item">子分类 B</a></li></ul></li><li><a href="/child-c/" class="item">子分类 C</a></li></ul></li></ul></li></ul></div>');
  });

  it('保留手写 HTML 目录标题不额外包裹', () => {
    const html = getDirectoryHtml({
      themeConfig: { fl: '1，<a href="/tutorial/">教程</a>' },
      allCategories: [
        { mid: 1, parent: 0, name: '教程', slug: 'tutorial', count: 0, permalink: '/tutorial/' },
      ],
    } as any);

    expect(html).toBe('<div><ul><li id="nav"><a href="javascript:void(0)" class="item directory-label">分类</a><em></em><ul><li><a href="/tutorial/">教程</a></li></ul></li></ul></div>');
  });

  it('纯文本目录标题会自动链接到对应分类页', () => {
    const html = getDirectoryHtml({
      themeConfig: { fl: '3，项目' },
      allCategories: [
        { mid: 3, parent: 0, name: '项目', slug: 'project', count: 1, permalink: '/project/' },
      ],
    } as any);

    expect(html).toContain('<a href="/project/" class="item directory-label">项目</a>');
  });

  it('多个配置项会统一挂在伪父分类下并默认折叠子项', () => {
    const html = getDirectoryHtml({
      themeConfig: { fl: '1，教程；2，笔记；3，项目' },
      allCategories: [
        { mid: 1, parent: 0, name: '教程', slug: 'tutorial', count: 11, permalink: '/tutorial/' },
        { mid: 2, parent: 0, name: '笔记', slug: 'notes', count: 0, permalink: '/notes/' },
        { mid: 3, parent: 0, name: '项目', slug: 'project', count: 1, permalink: '/project/' },
      ],
    } as any);

    expect(html).toContain('<a href="javascript:void(0)" class="item directory-label">分类</a><em></em><ul>');
    expect(html).toContain('<a href="/tutorial/" class="item directory-label">教程</a>');
    expect(html).toContain('<a href="/notes/" class="item directory-label">笔记</a>');
    expect(html).toContain('<a href="/project/" class="item directory-label">项目</a>');
  });
});

describe('getNavHtml()', () => {
  it('将分类目录追加到夜间切换项后面', () => {
    const html = getNavHtml({
      urls: { siteUrl: '/' },
      themeConfig: {
        dh: '<ul class="menu"><li><a href="/">主页<strong>HOME</strong></a></li></ul>',
        fl: '1，默认分类',
      },
      allCategories: [
        { mid: 1, parent: 0, name: '默认分类', slug: 'default', count: 0, permalink: '/default/' },
      ],
    } as any);

    expect(html).toContain('<li><a id="theme-toggle" class="theme-toggle-link" href="javascript:void(0)">夜间<strong>NIGHT</strong></a></li><li id="nav"><a href="javascript:void(0)" class="item directory-label">分类</a>');
  });
});
