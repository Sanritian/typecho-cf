import type { APIRoute } from 'astro';
import { getDb, schema } from '@/db';
import { eq } from 'drizzle-orm';
import { env } from 'cloudflare:workers';

export const GET: APIRoute = async ({ params }) => {
  const cidNum = parseInt(params.cid || '0', 10);
  if (!cidNum) {
    return new Response('Not Found', { status: 404 });
  }

  const db = getDb(env.DB);
  const content = await db.query.contents.findFirst({
    where: eq(schema.contents.cid, cidNum),
  });

  if (!content) {
    return new Response('Not Found', { status: 404 });
  }

  const raw = (content.text || '').replace('<!--markdown-->', '');
  const body = `<h3>${content.title || '无标题'}</h3><pre style="word-wrap: break-word; white-space: pre-wrap;">${escapeHtml(raw)}</pre>`;

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
};

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
