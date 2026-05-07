import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('admin config rendering', () => {
  it('sanitizes theme config descriptions before rendering HTML', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/pages/admin/theme-config.astro'),
      'utf-8',
    );

    expect(source).toContain('sanitizeAdminConfigDescription');
    expect(source).toContain('set:html={sanitizeAdminConfigDescription(field.description)}');
    expect(source).not.toContain('set:html={field.description}');
  });

  it('sanitizes plugin config descriptions before rendering HTML', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/pages/admin/plugin-config.astro'),
      'utf-8',
    );

    expect(source).toContain('sanitizeAdminConfigDescription');
    expect(source).toContain('set:html={sanitizeAdminConfigDescription(field.description)}');
    expect(source).not.toContain('set:html={field.description}');
  });
});
