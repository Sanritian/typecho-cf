import { describe, it, expect } from 'vitest';
import {
  registerTheme,
  themeHasConfig,
  getThemeConfigDefaults,
  loadThemeConfig,
} from '@/lib/theme';

describe('theme config helpers', () => {
  const themeId = 'test-theme-config';

  registerTheme('test-theme-config', {
    id: themeId,
    name: 'Test Theme',
    stylesheet: 'style.css',
    config: {
      t: { type: 'text', label: '标题', default: 'iTheme' },
      flags: { type: 'checkbox', label: '标记', options: { a: 'A', b: 'B' } },
    },
  }, '/themes/test-theme-config/style.css');

  it('detects theme config presence', () => {
    expect(themeHasConfig(themeId)).toBe(true);
  });

  it('returns defaults from manifest config', () => {
    expect(getThemeConfigDefaults(themeId)).toEqual({
      t: 'iTheme',
      flags: [],
    });
  });

  it('merges saved values over defaults', () => {
    const values = loadThemeConfig({
      [`theme:${themeId}`]: JSON.stringify({ t: 'Custom', flags: ['a'] }),
    }, themeId);

    expect(values).toEqual({
      t: 'Custom',
      flags: ['a'],
    });
  });
});
