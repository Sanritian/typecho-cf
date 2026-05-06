/**
 * 中间件永久链接 rewrite 回归测试。
 *
 * 重点覆盖单段 .html 文章路径与页面内建路由的冲突场景，
 * 避免用户把文章永久链接改成 /{cid}.html 后访问直接 404。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockLoadOptions,
  mockContentsFindFirst,
  mockMetasFindFirst,
  mockTableCheckFirst,
} = vi.hoisted(() => ({
  mockLoadOptions: vi.fn(),
  mockContentsFindFirst: vi.fn(),
  mockMetasFindFirst: vi.fn(),
  mockTableCheckFirst: vi.fn(),
}));

vi.mock('@/db', async () => {
  const actual = await vi.importActual<typeof import('@/db')>('@/db');
  return {
    ...actual,
    getDb: () => ({
      query: {
        contents: { findFirst: mockContentsFindFirst },
        metas: { findFirst: mockMetasFindFirst },
      },
    }),
    schema: actual.schema,
  };
});

vi.mock('@/lib/options', () => ({
  loadOptions: mockLoadOptions,
}));

vi.mock('astro:middleware', () => ({
  defineMiddleware: (handler: unknown) => handler,
}));

vi.mock('cloudflare:workers', () => ({
  env: {
    DB: {
      prepare: () => ({
        first: mockTableCheckFirst,
      }),
    },
  },
}));

function makeContext(pathname: string) {
  const rewrite = vi.fn((target: string | URL) => {
    const value = typeof target === 'string' ? target : `${target.pathname}${target.search}`;
    return new Response(value, { status: 200 });
  });
  const next = vi.fn(async () => new Response('ok', { status: 200 }));

  return {
    context: {
      request: new Request(`https://example.com${pathname}`),
      locals: {},
      rewrite,
    },
    next,
  };
}

function mockInstalledOptions(overrides: Record<string, unknown> = {}) {
  mockLoadOptions.mockResolvedValue({
    installed: true,
    cacheEnabled: false,
    permalinkPattern: '/{cid}.html',
    pagePattern: '/{slug}.html',
    categoryPattern: '/{slug}/',
    ...overrides,
  });
}

describe('middleware permalink rewrite', () => {
  beforeEach(() => {
    vi.resetModules();
    mockLoadOptions.mockReset();
    mockContentsFindFirst.mockReset();
    mockMetasFindFirst.mockReset();
    mockTableCheckFirst.mockReset();

    mockTableCheckFirst.mockResolvedValue({ name: 'typecho_options' });
    mockInstalledOptions();
  });

  it('会把 /{cid}.html 文章路径重写到内建文章路由', async () => {
    const { onRequest } = await import('@/middleware');
    const { context, next } = makeContext('/123.html');

    await onRequest(context as any, next as any);

    expect(context.rewrite).toHaveBeenCalledWith('/archives/123/');
    expect(next).not.toHaveBeenCalled();
  });

  it('不会把普通 /{slug}.html 页面误判成文章路径', async () => {
    const { onRequest } = await import('@/middleware');
    const { context, next } = makeContext('/about.html');

    await onRequest(context as any, next as any);

    expect(context.rewrite).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });

  it('仍然支持把 /{slug}/ 分类路径重写到内建分类路由', async () => {
    const { onRequest } = await import('@/middleware');
    const { context, next } = makeContext('/notes/');

    await onRequest(context as any, next as any);

    expect(context.rewrite).toHaveBeenCalledWith('/category/notes/');
    expect(next).not.toHaveBeenCalled();
  });
});
