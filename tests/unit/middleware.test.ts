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

function makeContext(
  pathname: string,
  options: {
    host?: string;
    headers?: HeadersInit;
    nextResponse?: Response;
    locals?: Record<string, unknown>;
  } = {},
) {
  const rewrite = vi.fn((target: string | URL) => {
    const value = typeof target === 'string' ? target : `${target.pathname}${target.search}`;
    return new Response(value, { status: 200 });
  });
  const next = vi.fn(async () => options.nextResponse ?? new Response('ok', {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  }));
  const host = options.host || 'example.com';

  return {
    context: {
      request: new Request(`https://${host}${pathname}`, { headers: options.headers }),
      locals: options.locals || {},
      rewrite,
    },
    next,
  };
}

function expectRewriteTarget(rewrite: ReturnType<typeof vi.fn>, expectedPathname: string, expectedSearch = '') {
  expect(rewrite).toHaveBeenCalledTimes(1);
  const [target] = rewrite.mock.calls[0];
  if (typeof target === 'string') {
    expect(target).toBe(`${expectedPathname}${expectedSearch}`);
    return;
  }

  expect(target.pathname).toBe(expectedPathname);
  expect(target.search).toBe(expectedSearch);
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

    expectRewriteTarget(context.rewrite, '/archives/123/');
    expect(next).not.toHaveBeenCalled();
  });

  it('文章评论片段请求 rewrite 时会保留 c 查询参数', async () => {
    const { onRequest } = await import('@/middleware');
    const { context, next } = makeContext('/123.html?c=a');

    await onRequest(context as any, next as any);

    expectRewriteTarget(context.rewrite, '/archives/123/', '?c=a');
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

    expectRewriteTarget(context.rewrite, '/category/notes/');
    expect(next).not.toHaveBeenCalled();
  });

  it('文件型永久链接的评论分页 rewrite 不会额外补斜杠', async () => {
    const { onRequest } = await import('@/middleware');
    const { context, next } = makeContext('/123.html/comment-page-2/');

    await onRequest(context as any, next as any);

    expectRewriteTarget(context.rewrite, '/123.html', '?commentPage=2');
    expect(next).not.toHaveBeenCalled();
  });

  it('只缓存主域名的匿名整页 HTML 请求', async () => {
    mockInstalledOptions({
      cacheEnabled: true,
      siteUrl: 'https://hupan.li',
    });

    const { onRequest } = await import('@/middleware');
    const { context, next } = makeContext('/', {
      host: 'hupan.li',
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-dest': 'document',
      },
    });

    await onRequest(context as any, next as any);

    const cached = await globalThis.caches.default.match(new Request('https://hupan.li/'));
    expect(next).toHaveBeenCalledOnce();
    expect(cached).toBeDefined();
    expect(await cached?.text()).toBe('ok');
  });

  it('不会缓存 workers.dev 等非主域名入口的页面请求', async () => {
    mockInstalledOptions({
      cacheEnabled: true,
      siteUrl: 'https://hupan.li',
    });

    const { onRequest } = await import('@/middleware');
    const { context, next } = makeContext('/', {
      host: 'typecho-cf.example.workers.dev',
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-dest': 'document',
      },
    });

    await onRequest(context as any, next as any);

    const cached = await globalThis.caches.default.match(
      new Request('https://typecho-cf.example.workers.dev/'),
    );
    expect(next).toHaveBeenCalledOnce();
    expect(cached).toBeUndefined();
  });

  it('不会缓存带 X-Requested-With 的异步请求', async () => {
    mockInstalledOptions({
      cacheEnabled: true,
      siteUrl: 'https://example.com',
    });

    const { onRequest } = await import('@/middleware');
    const { context, next } = makeContext('/', {
      headers: { 'x-requested-with': 'XMLHttpRequest' },
    });

    await onRequest(context as any, next as any);

    const cached = await globalThis.caches.default.match(new Request('https://example.com/'));
    expect(next).toHaveBeenCalledOnce();
    expect(cached).toBeUndefined();
  });

  it('不会缓存带 X-PJAX 的整页抓取请求', async () => {
    mockInstalledOptions({
      cacheEnabled: true,
      siteUrl: 'https://example.com',
    });

    const { onRequest } = await import('@/middleware');
    const { context, next } = makeContext('/', {
      headers: { 'x-pjax': 'true' },
    });

    await onRequest(context as any, next as any);

    const cached = await globalThis.caches.default.match(new Request('https://example.com/'));
    expect(next).toHaveBeenCalledOnce();
    expect(cached).toBeUndefined();
  });

  it('不会缓存带查询参数的页面请求', async () => {
    mockInstalledOptions({
      cacheEnabled: true,
      siteUrl: 'https://example.com',
    });

    const { onRequest } = await import('@/middleware');
    const { context, next } = makeContext('/?password=test', {
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-dest': 'document',
      },
    });

    await onRequest(context as any, next as any);

    const cached = await globalThis.caches.default.match(new Request('https://example.com/?password=test'));
    expect(next).toHaveBeenCalledOnce();
    expect(cached).toBeUndefined();
  });

  it('不会缓存分页 rewrite 后的列表页响应，避免串到第一页', async () => {
    mockInstalledOptions({
      cacheEnabled: true,
      siteUrl: 'https://example.com',
    });

    const { onRequest } = await import('@/middleware');
    const { context, next } = makeContext('/', {
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-dest': 'document',
      },
      locals: { _page: 2 },
    });

    await onRequest(context as any, next as any);

    const cached = await globalThis.caches.default.match(new Request('https://example.com/'));
    expect(next).toHaveBeenCalledOnce();
    expect(cached).toBeUndefined();
  });

  it('不会把非 HTML 响应写入页面缓存', async () => {
    mockInstalledOptions({
      cacheEnabled: true,
      siteUrl: 'https://example.com',
    });

    const { onRequest } = await import('@/middleware');
    const { context, next } = makeContext('/feed', {
      nextResponse: new Response('<rss />', {
        status: 200,
        headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
      }),
    });

    await onRequest(context as any, next as any);

    const cached = await globalThis.caches.default.match(new Request('https://example.com/feed'));
    expect(next).toHaveBeenCalledOnce();
    expect(cached).toBeUndefined();
  });

  it('不会把带 Location 头的响应写入页面缓存', async () => {
    mockInstalledOptions({
      cacheEnabled: true,
      siteUrl: 'https://example.com',
    });

    const { onRequest } = await import('@/middleware');
    const { context, next } = makeContext('/', {
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-dest': 'document',
      },
      nextResponse: new Response('ok', {
        status: 200,
        headers: {
          Location: '/target',
          'Content-Type': 'text/html; charset=utf-8',
        },
      }),
    });

    await onRequest(context as any, next as any);

    const cached = await globalThis.caches.default.match(new Request('https://example.com/'));
    expect(next).toHaveBeenCalledOnce();
    expect(cached).toBeUndefined();
  });
});
