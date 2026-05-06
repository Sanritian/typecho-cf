import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { discoverLocalPackageSources, toProjectImportPath } from '@/integrations/local-package-source';

describe('local package source helpers', () => {
  it('discovers local file dependencies from root package.json', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'typecho-local-packages-'));
    const themeDir = join(rootDir, 'src', 'themes', 'iTheme');
    const pluginDir = join(rootDir, 'src', 'plugins', 'sample-plugin');

    mkdirSync(themeDir, { recursive: true });
    mkdirSync(pluginDir, { recursive: true });

    writeFileSync(join(rootDir, 'package.json'), JSON.stringify({
      dependencies: {
        itheme: 'file:src/themes/iTheme',
      },
      devDependencies: {
        'typecho-plugin-sample': 'link:src/plugins/sample-plugin',
      },
    }));

    writeFileSync(join(themeDir, 'package.json'), JSON.stringify({ name: 'itheme' }));
    writeFileSync(join(pluginDir, 'package.json'), JSON.stringify({ name: 'typecho-plugin-sample' }));

    const sources = discoverLocalPackageSources(rootDir);

    expect(sources.get('itheme')).toBe(themeDir);
    expect(sources.get('typecho-plugin-sample')).toBe(pluginDir);
  });

  it('prefers declared dependency name when local package.json has no name', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'typecho-local-packages-'));
    const themeDir = join(rootDir, 'src', 'themes', 'iTheme');

    mkdirSync(themeDir, { recursive: true });

    writeFileSync(join(rootDir, 'package.json'), JSON.stringify({
      dependencies: {
        itheme: 'file:src/themes/iTheme',
      },
    }));

    writeFileSync(join(themeDir, 'package.json'), JSON.stringify({ version: '1.0.0' }));

    const sources = discoverLocalPackageSources(rootDir);

    expect(sources.get('itheme')).toBe(themeDir);
  });

  it('converts in-project file paths to source import paths', () => {
    const rootDir = 'C:/workspace/typecho-cf';
    const filePath = 'C:/workspace/typecho-cf/src/themes/iTheme/components/Index.astro';

    expect(toProjectImportPath(rootDir, filePath)).toBe('/src/themes/iTheme/components/Index.astro');
  });
});
