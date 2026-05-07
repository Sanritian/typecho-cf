/**
 * Unit tests for src/lib/upload.ts
 *
 * Tests MIME type validation from extension (not client-provided type),
 * dangerous extension rejection, filename sanitization, and upload path generation.
 */
import { describe, it, expect } from 'vitest';
import {
  convertUploadFileToAvif,
  getMimeTypeFromExtension,
  isAllowedType,
  generateUploadPath,
  uploadToR2,
} from '@/lib/upload';

// ---------------------------------------------------------------------------
// getMimeTypeFromExtension — MIME derived from extension, not client
// ---------------------------------------------------------------------------
describe('getMimeTypeFromExtension()', () => {
  it('returns image/jpeg for .jpg', () => {
    expect(getMimeTypeFromExtension('photo.jpg')).toBe('image/jpeg');
  });

  it('returns image/jpeg for .jpeg', () => {
    expect(getMimeTypeFromExtension('photo.jpeg')).toBe('image/jpeg');
  });

  it('returns image/png for .png', () => {
    expect(getMimeTypeFromExtension('screenshot.png')).toBe('image/png');
  });

  it('returns image/gif for .gif', () => {
    expect(getMimeTypeFromExtension('animation.gif')).toBe('image/gif');
  });

  it('returns image/webp for .webp', () => {
    expect(getMimeTypeFromExtension('photo.webp')).toBe('image/webp');
  });

  it('returns image/svg+xml for .svg', () => {
    expect(getMimeTypeFromExtension('icon.svg')).toBe('image/svg+xml');
  });

  it('returns application/pdf for .pdf', () => {
    expect(getMimeTypeFromExtension('doc.pdf')).toBe('application/pdf');
  });

  it('returns application/zip for .zip', () => {
    expect(getMimeTypeFromExtension('archive.zip')).toBe('application/zip');
  });

  it('is case-insensitive for extensions', () => {
    expect(getMimeTypeFromExtension('PHOTO.JPG')).toBe('image/jpeg');
    expect(getMimeTypeFromExtension('Doc.PDF')).toBe('application/pdf');
    expect(getMimeTypeFromExtension('file.PNG')).toBe('image/png');
  });

  it('returns undefined for unknown extensions', () => {
    expect(getMimeTypeFromExtension('file.unknown')).toBeUndefined();
    expect(getMimeTypeFromExtension('file.xyz')).toBeUndefined();
  });

  it('returns undefined for files with no extension', () => {
    expect(getMimeTypeFromExtension('noextension')).toBeUndefined();
  });

  it('returns undefined for dangerous extensions like .html', () => {
    // .html is not in EXTENSION_TO_MIME even though it could be
    expect(getMimeTypeFromExtension('page.html')).toBeUndefined();
  });

  it('returns undefined for .js files', () => {
    expect(getMimeTypeFromExtension('script.js')).toBeUndefined();
  });

  it('returns undefined for .php files', () => {
    expect(getMimeTypeFromExtension('index.php')).toBeUndefined();
  });

  it('returns undefined for .exe files', () => {
    expect(getMimeTypeFromExtension('virus.exe')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// isAllowedType
// ---------------------------------------------------------------------------
describe('isAllowedType()', () => {
  it('allows image/jpeg when attachmentTypes includes @image@', () => {
    expect(isAllowedType('image/jpeg', '@image@')).toBe(true);
  });

  it('allows image/png when attachmentTypes includes @image@', () => {
    expect(isAllowedType('image/png', '@image@')).toBe(true);
  });

  it('allows application/pdf when attachmentTypes includes @file@', () => {
    expect(isAllowedType('application/pdf', '@file@')).toBe(true);
  });

  it('rejects application/pdf when only @image@ is allowed', () => {
    expect(isAllowedType('application/pdf', '@image@')).toBe(false);
  });

  it('allows both images and files when @image@file@ is set', () => {
    expect(isAllowedType('image/jpeg', '@image@file@')).toBe(true);
    expect(isAllowedType('application/pdf', '@image@file@')).toBe(true);
  });

  it('rejects unknown MIME types', () => {
    expect(isAllowedType('application/x-custom', '@image@file@')).toBe(false);
  });

  it('rejects text/html always', () => {
    expect(isAllowedType('text/html', '@image@file@')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// generateUploadPath — sanitizeFilename is tested indirectly
// ---------------------------------------------------------------------------
describe('generateUploadPath()', () => {
  it('generates path in year/month format', () => {
    const date = new Date('2026-03-15');
    const path = generateUploadPath('photo.jpg', date);
    expect(path).toMatch(/^usr\/uploads\/2026\/03\//);
    expect(path).toContain('.jpg');
  });

  it('sanitizes filename (removes special chars)', () => {
    const date = new Date('2026-01-01');
    const path = generateUploadPath('hello world!@#$%.jpg', date);
    expect(path).toMatch(/^usr\/uploads\/2026\/01\//);
    expect(path).toContain('.jpg');
    // Should not contain special characters (only alnum, _, -, Chinese)
    const filename = path.split('/').pop()!;
    expect(filename).toMatch(/^[a-zA-Z0-9_\-\u4e00-\u9fff]+_[a-z0-9]+\.jpg$/);
  });

  it('preserves Chinese characters in filename', () => {
    const date = new Date('2026-01-01');
    const path = generateUploadPath('你好世界.png', date);
    expect(path).toContain('你好世界');
    expect(path).toContain('.png');
  });

  it('throws for empty filename', () => {
    expect(() => generateUploadPath('')).toThrow();
  });

  it('throws for extension-only filename', () => {
    expect(() => generateUploadPath('.jpg')).toThrow();
  });

  it('throws for dangerous extensions like .html', () => {
    expect(() => generateUploadPath('evil.html')).toThrow('扩展名');
  });

  it('throws for .js extension', () => {
    expect(() => generateUploadPath('script.js')).toThrow('扩展名');
  });

  it('throws for .php extension', () => {
    expect(() => generateUploadPath('index.php')).toThrow('扩展名');
  });

  it('throws for .exe extension', () => {
    expect(() => generateUploadPath('virus.exe')).toThrow('扩展名');
  });

  it('throws for unknown extensions', () => {
    expect(() => generateUploadPath('file.xyz')).toThrow('扩展名');
  });

  it('adds timestamp suffix to avoid collisions', () => {
    const date = new Date('2026-01-01');
    const path1 = generateUploadPath('test.jpg', date);
    const path2 = generateUploadPath('test.jpg', date);
    // Filenames should contain a timestamp and may differ
    expect(path1).toMatch(/test_[a-z0-9]+\.jpg$/);
    expect(path2).toMatch(/test_[a-z0-9]+\.jpg$/);
  });

  it('lowercases the extension', () => {
    const date = new Date('2026-01-01');
    const path = generateUploadPath('PHOTO.JPG', date);
    expect(path).toMatch(/\.jpg$/);
  });
});

// ---------------------------------------------------------------------------
// Server-side AVIF conversion
// ---------------------------------------------------------------------------
describe('convertUploadFileToAvif()', () => {
  it('returns the original file when Images binding is unavailable', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'photo.jpg', { type: 'image/jpeg' });

    const converted = await convertUploadFileToAvif(file, null);

    expect(converted).toBe(file);
    expect(converted.name).toBe('photo.jpg');
  });

  it('converts supported raster images to avif when Images binding is available', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'photo.png', { type: 'image/png' });
    const images = {
      input() {
        return {
          output() {
            return {
              response() {
                return new Response(new Uint8Array([8, 6, 4, 2]), {
                  headers: { 'Content-Type': 'image/avif' },
                });
              },
            };
          },
        };
      },
    };

    const converted = await convertUploadFileToAvif(file, images as any);

    expect(converted).not.toBe(file);
    expect(converted.name).toBe('photo.avif');
    expect(converted.type).toBe('image/avif');
    expect(converted.size).toBe(4);
  });
});

describe('uploadToR2()', () => {
  it('stores server-converted avif files in R2', async () => {
    const puts: Array<{ path: string; metadata: Record<string, unknown> | undefined }> = [];
    const bucket = {
      async put(path: string, _body: ArrayBuffer, options?: { httpMetadata?: Record<string, unknown> }) {
        puts.push({ path, metadata: options?.httpMetadata });
      },
    };
    const images = {
      input() {
        return {
          output() {
            return {
              response() {
                return new Response(new Uint8Array([1, 1, 2, 3]), {
                  headers: { 'Content-Type': 'image/avif' },
                });
              },
            };
          },
        };
      },
    };
    const file = new File([new Uint8Array([9, 9, 9])], 'cover.jpg', { type: 'image/jpeg' });

    const result = await uploadToR2(bucket as any, file, 'https://example.com', '@image@', images as any);

    expect(result.name).toBe('cover.avif');
    expect(result.type).toBe('image/avif');
    expect(result.path).toMatch(/\.avif$/);
    expect(result.url).toMatch(/\/usr\/uploads\/.+\.avif$/);
    expect(puts).toHaveLength(1);
    expect(puts[0]?.path).toMatch(/\.avif$/);
    expect(puts[0]?.metadata?.contentType).toBe('image/avif');
  });
});
