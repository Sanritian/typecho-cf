import { existsSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const LOCAL_DEP_PREFIXES = ['file:', 'link:'] as const;
const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies'] as const;

function parseJsonFile(filePath: string): Record<string, unknown> | null {
  if (!existsSync(filePath)) return null;

  try {
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function getLocalDependencyPath(specifier: unknown): string | null {
  if (typeof specifier !== 'string') return null;

  for (const prefix of LOCAL_DEP_PREFIXES) {
    if (specifier.startsWith(prefix)) {
      return specifier.slice(prefix.length);
    }
  }

  return null;
}

function readPackageName(packageDir: string): string | null {
  const packageJson = parseJsonFile(join(packageDir, 'package.json'));
  const packageName = packageJson?.name;
  return typeof packageName === 'string' && packageName !== '' ? packageName : null;
}

export function discoverLocalPackageSources(rootDir: string): Map<string, string> {
  const sources = new Map<string, string>();
  const rootPackageJson = parseJsonFile(join(rootDir, 'package.json'));

  if (!rootPackageJson) return sources;

  for (const field of DEPENDENCY_FIELDS) {
    const dependencies = rootPackageJson[field];
    if (!dependencies || typeof dependencies !== 'object') continue;

    for (const [declaredName, specifier] of Object.entries(dependencies as Record<string, unknown>)) {
      const localPath = getLocalDependencyPath(specifier);
      if (!localPath) continue;

      const packageDir = resolve(rootDir, localPath);
      if (!existsSync(packageDir)) continue;

      const packageName = readPackageName(packageDir) || declaredName;
      if (!sources.has(packageName)) {
        sources.set(packageName, packageDir);
      }
    }
  }

  return sources;
}

export function toProjectImportPath(rootDir: string, filePath: string): string {
  const relativePath = relative(rootDir, filePath).replace(/\\/g, '/');

  // 本地 file:/link: 包优先走源码路径，避免 pnpm 在 node_modules 中使用旧快照。
  if (relativePath !== '' && !relativePath.startsWith('..') && !relativePath.startsWith('/')) {
    return `/${relativePath}`;
  }

  return `/@fs/${filePath.replace(/\\/g, '/')}`;
}
