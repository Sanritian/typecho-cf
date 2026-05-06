import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { applyFilter } from '@/lib/plugin';

// ─── HTML escape helper ─────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Shared sanitize config ──────────────────────────────────────────────────

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat([
    'img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'pre', 'code', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'del', 'ins', 'details', 'summary', 'figure', 'figcaption',
    'video', 'audio', 'source', 'iframe',
  ]),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    a: ['href', 'title', 'target', 'rel'],
    code: ['class'],
    pre: ['class'],
    td: ['align', 'valign'],
    th: ['align', 'valign'],
    iframe: ['src', 'width', 'height', 'frameborder', 'allowfullscreen'],
    video: ['src', 'controls', 'width', 'height'],
    audio: ['src', 'controls'],
    source: ['src', 'type'],
  },
  allowedIframeHostnames: ['www.youtube.com', 'player.bilibili.com', 'player.vimeo.com'],
};

/**
 * Unique placeholder used to survive markdown rendering + sanitization.
 * Marked wraps a standalone line of plain text in <p>…</p>, so after
 * rendering the placeholder appears as <p>TYPECHO_MORE_0</p> which we
 * can reliably split on.
 */
const MORE_PLACEHOLDER = 'TYPECHO_MORE_0';
const MORE_PLACEHOLDER_RE = /<p>\s*TYPECHO_MORE_0\s*<\/p>/;

// ─── Strip <!--markdown--> prefix ────────────────────────────────────────────

function stripMarkdownPrefix(text: string): string {
  return text.startsWith('<!--markdown-->') ? text.slice('<!--markdown-->'.length) : text;
}

function insertSpacingInText(text: string): string {
  return text
    .replace(/([\u4e00-\u9fa5]+)([A-Za-z0-9_]+)/gu, '$1 $2')
    .replace(/([A-Za-z0-9_]+)([\u4e00-\u9fa5]+)/gu, '$1 $2');
}

function insertSpacingInHtml(html: string): string {
  const skipTags = new Set(['pre', 'code', 'script', 'style', 'textarea']);
  const parts = html.split(/(<[^>]+>)/g);
  const stack: string[] = [];

  return parts.map((part) => {
    if (!part) return part;

    if (part.startsWith('<')) {
      const tagMatch = part.match(/^<\s*(\/)?\s*([a-zA-Z0-9-]+)/);
      if (!tagMatch) return part;

      const isClosing = !!tagMatch[1];
      const tagName = tagMatch[2].toLowerCase();
      const isSelfClosing = /\/\s*>$/.test(part) || /^<\s*!(?:--|doctype|\[CDATA\[)/i.test(part);

      if (skipTags.has(tagName)) {
        if (isClosing) {
          for (let idx = stack.length - 1; idx >= 0; idx -= 1) {
            if (stack[idx] === tagName) {
              stack.splice(idx, 1);
              break;
            }
          }
        } else if (!isSelfClosing) {
          stack.push(tagName);
        }
      }

      return part;
    }

    if (stack.length > 0) {
      return part;
    }

    return insertSpacingInText(part);
  }).join('');
}

function rewriteContentHtml(html: string): string {
  let output = html;

  output = output.replace(/<a([^>]*?)href="([^"]+)"([^>]*)>/g, (match, before, href, after) => {
    if (!/^https?:\/\//i.test(href)) return match;

    let attrs = `${before}${after}`;
    if (/target="/i.test(attrs)) return `<a href="${href}"${attrs}>`;

    if (/rel="/i.test(attrs)) {
      attrs = attrs.replace(/rel="([^"]*)"/i, (_m, rel) => `rel="${rel} noopener noreferrer"`);
    } else {
      attrs += ' rel="noopener noreferrer"';
    }

    return `<a href="${href}"${attrs} target="_blank">`;
  });

  output = output.replace(/<img([^>]*?)src="([^"]+)"([^>]*)>/g, (_match, before, src, after) => {
    let attrs = `${before}${after}`;
    attrs = attrs.replace(/\s*\/\s*$/, '');
    if (/class="/i.test(attrs)) {
      attrs = attrs.replace(/class="([^"]*)"/i, (_m, value) => `class="${value} ani"`);
    } else {
      attrs = ` class="ani"${attrs}`;
    }

    return `<div style="max-width:100%;display:inline-block;background:rgb(181, 191, 194) none repeat scroll 0% 0%;border-radius:5px"><img data-src="${src}"${attrs}></div>`;
  });

  output = output.replace(/<p>\s*(<div style="max-width:100%;display:inline-block;background:rgb\(181, 191, 194\) none repeat scroll 0% 0%;border-radius:5px">[\s\S]*?<\/div>)\s*<\/p>/g, '$1');

  return output;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Render markdown to HTML (synchronous, no plugin hooks)
 */
export function renderMarkdown(text: string): string {
  if (!text) return '';
  const content = stripMarkdownPrefix(text).replace(/<!--more-->/g, '');
  const html = marked.parse(content, { async: false }) as string;
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}

/**
 * Render markdown to HTML with plugin filter hooks (async)
 * Use this for content display where plugins should be able to intercept
 */
export async function renderMarkdownFiltered(text: string): Promise<string> {
  if (!text) return '';

  let content = stripMarkdownPrefix(text);
  // Remove <!--more--> from full-content renders — it is only meaningful
  // for list/excerpt views where renderContentExcerpt() is used instead.
  content = content.replace(/<!--more-->/g, '');

  // Apply content:markdown filter — plugins can modify the raw markdown
  content = await applyFilter('content:markdown', content);

  const html = marked.parse(content, { async: false }) as string;
  let sanitized = sanitizeHtml(html, SANITIZE_OPTIONS);

  // Apply content:content filter — plugins can modify the rendered HTML
  sanitized = await applyFilter('content:content', sanitized);

  sanitized = rewriteContentHtml(sanitized);

  return insertSpacingInHtml(sanitized);
}

/**
 * Render content with <!--more--> support.
 *
 * The full markdown source is rendered first so that reference-style links,
 * footnotes, and other constructs that span the <!--more--> boundary are
 * resolved correctly.  Only after a complete render is the output split at
 * the <!--more--> marker to produce the excerpt.
 */
export function renderContentExcerpt(
  text: string,
  moreText = '- 阅读剩余部分 -',
  permalink = '#'
): string {
  if (!text) return '';

  const content = stripMarkdownPrefix(text);

  if (!content.includes('<!--more-->')) {
    return renderMarkdown(text);
  }

  // Surround the marker with blank lines before substituting the placeholder.
  // This guarantees that marked wraps the placeholder in its own <p> block
  // regardless of whether the author placed <!--more--> inline or between
  // paragraphs — enabling a clean split on the rendered output.
  const withPlaceholder = content.replace(/<!--more-->/g, '\n\n' + MORE_PLACEHOLDER + '\n\n');
  const html = marked.parse(withPlaceholder, { async: false }) as string;
  const sanitized = sanitizeHtml(html, SANITIZE_OPTIONS);

  // Split on the rendered placeholder and keep only the excerpt (part before it).
  const excerptHtml = sanitized.split(MORE_PLACEHOLDER_RE)[0];
  return `${excerptHtml}<p class="more"><a href="${escapeHtml(permalink)}" title="${escapeHtml(moreText)}">${escapeHtml(moreText)}</a></p>`;
}

/**
 * Generate plain text excerpt from content
 */
export function generateExcerpt(text: string, maxLength = 200): string {
  if (!text) return '';

  const html = renderMarkdown(text);
  const plain = html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  if (plain.length <= maxLength) return plain;
  return plain.substring(0, maxLength) + '...';
}

/**
 * Simple autop (auto paragraph) - converts line breaks to <p> tags
 * Used for non-markdown content
 */
export function autop(text: string): string {
  if (!text) return '';
  text = text.replace(/\r\n|\r/g, '\n');
  text = text.replace(/\n\n+/g, '\n\n');
  const paragraphs = text.split('\n\n');
  return paragraphs
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p.replace(/\n/g, '<br />')}</p>`)
    .join('\n');
}
