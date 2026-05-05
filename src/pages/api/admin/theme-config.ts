/**
 * Theme Configuration API
 * GET:  Read theme config  → /api/admin/theme-config?id=<themeId>
 * POST: Save theme config  → /api/admin/theme-config  { theme: id, settings: {...} }
 */
import type { APIRoute } from 'astro';
import { getDb } from '@/db';
import { loadOptions, setOption } from '@/lib/options';
import { getAuthCookies, validateAuthToken, hasPermission, requireAdminCSRF } from '@/lib/auth';
import { getTheme, themeHasConfig, loadThemeConfig, getThemeConfigDefaults } from '@/lib/theme';
import { purgeSiteCache } from '@/lib/cache';
import { env } from 'cloudflare:workers';

async function authenticate(request: Request) {
  const db = getDb(env.DB);
  const options = await loadOptions(db);
  const cookieHeader = request.headers.get('cookie');
  const { token } = getAuthCookies(cookieHeader);

  if (!token || !options.secret) return null;

  const result = await validateAuthToken(token, options.secret, db);
  if (!result) return null;
  if (!hasPermission(result.user.group || 'visitor', 'administrator')) return null;

  return { db, user: result.user, options };
}

export const GET: APIRoute = async ({ request, url }) => {
  const auth = await authenticate(request);
  if (!auth) {
    return new Response(JSON.stringify({ error: '权限不足' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const themeId = url.searchParams.get('id') || '';
  const theme = getTheme(themeId);

  if (!theme || !themeHasConfig(themeId)) {
    return new Response(JSON.stringify({ error: '主题不存在或无配置项' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const config = loadThemeConfig(auth.options, themeId);

  return new Response(JSON.stringify({
    theme: themeId,
    name: theme.manifest.name,
    fields: theme.manifest.config,
    values: config,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request }) => {
  const auth = await authenticate(request);
  if (!auth) {
    return new Response(JSON.stringify({ error: '权限不足' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const csrfError = await requireAdminCSRF(request, auth.options.secret as string, auth.user.authCode!, auth.user.uid);
  if (csrfError) return csrfError;

  try {
    const body = await request.json() as { theme?: string; settings?: Record<string, unknown> };
    const themeId = body.theme;
    const settings = body.settings;

    if (!themeId || typeof themeId !== 'string') {
      return new Response(JSON.stringify({ error: '请指定主题标识' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const theme = getTheme(themeId);
    if (!theme || !themeHasConfig(themeId)) {
      return new Response(JSON.stringify({ error: '主题不存在或无配置项' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!settings || typeof settings !== 'object') {
      return new Response(JSON.stringify({ error: '请提供配置数据' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const configDef = theme.manifest.config!;
    const defaults = getThemeConfigDefaults(themeId);
    const sanitized: Record<string, unknown> = {};

    for (const key of Object.keys(configDef)) {
      if (key in settings) {
        sanitized[key] = settings[key];
      } else {
        sanitized[key] = defaults[key];
      }
    }

    await setOption(auth.db, `theme:${themeId}`, JSON.stringify(sanitized));
    await purgeSiteCache(auth.options.siteUrl || '');

    return new Response(JSON.stringify({
      success: true,
      message: '主题设置已经保存',
      theme: themeId,
      settings: sanitized,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: '请求格式错误' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
