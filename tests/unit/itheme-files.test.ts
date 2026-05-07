import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('iTheme files', () => {
  it('declares theme config in manifest', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/themes/iTheme/theme.json'),
      'utf-8',
    );

    expect(source).toContain('"id": "iTheme"');
    expect(source).toContain('"config"');
    expect(source).toContain('"dh"');
    expect(source).toContain('"fl"');
    expect(source).not.toContain('"t"');
    expect(source).not.toContain('"s"');
  });

  it('supports links page rendering in page component', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/themes/iTheme/components/Page.astro'),
      'utf-8',
    );

    expect(source).toContain("props.page.template === 'links'");
    expect(source).toContain('links-page');
  });

  it('ships a dedicated client script', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/themes/iTheme/assets/main.js'),
      'utf-8',
    );

    expect(source).toContain('window.TypechoComment');
    expect(source).toContain('loadCommentFragment');
    expect(source).toContain('navigate(');
    expect(source).toContain('buildSearchResults');
    expect(source).toContain('await renderPage(');
    expect(source).toContain('scrollTop = true');
    expect(source).toContain('replaceHistory: true, scrollTop: false');
    expect(source).toContain('const restoreScrollY = state.returnScrollY || 0');
    expect(source).toContain("import { createPageCache, parsePageCache, updatePageCacheCommentCount } from './page-cache.js';");
    expect(source).toContain('createPageCache(');
    expect(source).toContain('extractTitle(html)');
    expect(source).toContain('history.replaceState({');
    expect(source).not.toContain('history.pushState({ title: state.returnTitle');
    expect(source).not.toContain('<section id="main">${cached}</section><title>${document.title}</title>');
  });

  it('converts uploaded images to avif in admin editors when supported', () => {
    const postSource = readFileSync(
      join(process.cwd(), 'src/pages/admin/write-post.astro'),
      'utf-8',
    );
    const pageSource = readFileSync(
      join(process.cwd(), 'src/pages/admin/write-page.astro'),
      'utf-8',
    );

    expect(postSource).toContain('/js/admin-attachment-upload.js');
    expect(pageSource).toContain('/js/admin-attachment-upload.js');
    expect(postSource).toContain('TypechoAdmin.createAttachmentUploader');
    expect(pageSource).toContain('TypechoAdmin.createAttachmentUploader');
    expect(postSource).toContain("uploadPanelSelector: '#upload-panel'");
    expect(pageSource).toContain("uploadPanelSelector: '#upload-panel'");
    expect(postSource).not.toContain("url: '/api/admin/upload'");
    expect(pageSource).not.toContain("url: '/api/admin/upload'");
  });
});
