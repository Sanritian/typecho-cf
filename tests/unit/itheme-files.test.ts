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
});
