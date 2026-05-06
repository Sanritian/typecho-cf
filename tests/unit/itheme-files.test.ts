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

    expect(postSource).toContain('convertImageToAvif');
    expect(postSource).toContain("image/avif");
    expect(pageSource).toContain('convertImageToAvif');
    expect(pageSource).toContain("image/avif");
  });
});
