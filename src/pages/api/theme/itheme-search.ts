import type { APIRoute } from 'astro';
import { getDb, schema } from '@/db';
import { loadOptions } from '@/lib/options';
import { buildPermalink, buildCategoryLink, buildTagLink } from '@/lib/content';
import { eq, and } from 'drizzle-orm';
import { env } from 'cloudflare:workers';

function sanitizeSearchText(input: string): string {
  return input
    .replace(/\[|\{|\]|\}|<|>|\r\n|\r|\n|-|'|"|`| |:|;|\\/g, '')
    .replace(/<!--markdown-->/g, '');
}

export const GET: APIRoute = async () => {
  const db = getDb(env.DB);
  const options = await loadOptions(db);
  const siteUrl = options.siteUrl || '';

  const posts = await db.select().from(schema.contents).where(
    and(eq(schema.contents.type, 'post'), eq(schema.contents.status, 'publish')),
  );
  const pages = await db.select().from(schema.contents).where(
    and(eq(schema.contents.type, 'page'), eq(schema.contents.status, 'publish')),
  );
  const tags = await db.select().from(schema.metas).where(eq(schema.metas.type, 'tag'));
  const categories = await db.select().from(schema.metas).where(eq(schema.metas.type, 'category'));

  const items: Array<Record<string, string>> = [];

  for (const post of posts) {
    items.push({
      this: 'post',
      link: buildPermalink(
        { cid: post.cid, slug: post.slug, type: post.type, created: post.created },
        siteUrl,
        options.permalinkPattern as string | undefined,
        options.pagePattern as string | undefined,
      ),
      title: post.title || '无标题',
      comments: String(post.commentsNum || 0),
      text: sanitizeSearchText(post.text || ''),
    });
  }

  for (const page of pages) {
    items.push({
      this: 'page',
      link: buildPermalink(
        { cid: page.cid, slug: page.slug, type: page.type, created: page.created },
        siteUrl,
        options.permalinkPattern as string | undefined,
        options.pagePattern as string | undefined,
      ),
      title: page.title || '无标题',
      comments: String(page.commentsNum || 0),
      text: sanitizeSearchText(page.text || ''),
    });
  }

  for (const tag of tags) {
    items.push({
      this: 'tag',
      link: buildTagLink(tag.slug || '', siteUrl),
      title: tag.name || '',
      comments: '0',
      text: sanitizeSearchText(tag.description || ''),
    });
  }

  for (const category of categories) {
    items.push({
      this: 'category',
      link: buildCategoryLink(category.slug || '', siteUrl, options.categoryPattern as string | undefined),
      title: category.name || '',
      comments: '0',
      text: sanitizeSearchText(category.description || ''),
    });
  }

  return new Response(JSON.stringify(items), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=600',
    },
  });
};
