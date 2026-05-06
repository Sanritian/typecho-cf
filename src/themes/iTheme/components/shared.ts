import type {
  ThemeBaseProps,
  CommentNode,
} from '@/lib/theme-props';
import { formatDate } from '@/lib/content';

export function getThemeText(config: Record<string, unknown>, key: string, fallback = ''): string {
  const value = config[key];
  return typeof value === 'string' && value.trim() ? value : fallback;
}

export function stripHtml(input: string): string {
  return input.replace(/<[^>]+>/g, '');
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatTimeAgo(timestamp: number): string {
  const delta = Math.max(1, Math.floor(Date.now() / 1000) - timestamp);
  const chunks: Array<[number, string]> = [
    [86400, '天'],
    [3600, '小时'],
    [60, '分钟'],
    [1, '秒'],
  ];

  for (const [unit, label] of chunks) {
    const count = Math.floor(delta / unit);
    if (count > 0) return `${count}${label}前`;
  }

  return '1秒前';
}

export function buildArchiveTitle(text: string | undefined): string {
  return text || '';
}

export function getHeaderTitle(props: ThemeBaseProps): string {
  return props.options.title || 'iTheme';
}

export function getHeaderSubtitle(props: ThemeBaseProps): string {
  return props.options.description || '';
}

export function getNavHtml(props: ThemeBaseProps): string {
  const fallback = `<ul class="menu"><li><a href="${props.urls.siteUrl || '/'}">主页<strong>HOME</strong></a></li><li><a id="s">搜索<strong>SEARCH</strong></a></li></ul>`;
  const navHtml = getThemeText(props.themeConfig, 'dh', fallback);
  const toggleItem = `<li><a id="theme-toggle" class="theme-toggle-link" href="javascript:void(0)">夜间<strong>NIGHT</strong></a></li>`;
  if (navHtml.includes('</ul>')) {
    return navHtml.replace('</ul>', `${toggleItem}</ul>`);
  }
  return `${navHtml}${toggleItem}`;
}

export interface ThemeCategoryNode {
  mid: number;
  parent: number;
  name: string;
  slug: string;
  count: number;
  permalink: string;
  children: ThemeCategoryNode[];
}

export function parseDirectoryConfig(raw: unknown): Array<{ id: number; labelHtml: string }> {
  if (typeof raw !== 'string' || !raw.trim()) return [];

  return raw
    .split(/[；;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.split(/[，,]/);
      const id = parseInt(parts[0] || '0', 10);
      const labelHtml = parts.slice(1).join('，').trim();
      return { id, labelHtml };
    })
    .filter((item) => item.id > 0 && item.labelHtml);
}

export function buildCategoryTree(
  allCategories: ThemeBaseProps['allCategories'],
): ThemeCategoryNode[] {
  const map = new Map<number, ThemeCategoryNode>();
  const roots: ThemeCategoryNode[] = [];

  for (const item of allCategories) {
    map.set(item.mid, { ...item, children: [] });
  }

  for (const node of map.values()) {
    if (node.parent && map.has(node.parent)) {
      map.get(node.parent)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export function findCategoryNode(nodes: ThemeCategoryNode[], mid: number): ThemeCategoryNode | null {
  for (const node of nodes) {
    if (node.mid === mid) return node;
    const child = findCategoryNode(node.children, mid);
    if (child) return child;
  }
  return null;
}

function renderCategoryChildrenFlat(
  categories: ThemeBaseProps['allCategories'],
  parentId: number,
): string {
  let html = '';

  for (const category of categories) {
    if ((category.parent || 0) !== parentId) continue;
    html += `<li><a href="${category.permalink}" class="item">${category.name}</a>`;
    html += renderCategoryChildrenFlat(categories, category.mid);
    html += '</li>';
  }

  return html ? `<em></em><ul>${html}</ul>` : '';
}

function normalizeDirectoryLabelHtml(labelHtml: string, fallbackHref: string): string {
  if (/<[a-z][\s\S]*>/i.test(labelHtml)) {
    return labelHtml;
  }

  return `<a href="${fallbackHref}" class="item directory-label">${escapeHtml(labelHtml)}</a>`;
}

function renderDirectoryEntry(
  categories: ThemeBaseProps['allCategories'],
  entry: { id: number; labelHtml: string },
): string {
  const currentCategory = categories.find((category) => category.mid === entry.id);
  const labelHref = currentCategory?.permalink || 'javascript:void(0)';
  return `<li>${normalizeDirectoryLabelHtml(entry.labelHtml, labelHref)}${renderCategoryChildrenFlat(categories, entry.id)}</li>`;
}

export function getDirectoryHtml(props: ThemeBaseProps): string {
  const config = parseDirectoryConfig(props.themeConfig.fl);
  if (config.length === 0) return '';

  // 对齐原主题 getTree()：直接在扁平分类表上按 parent 递归，
  // 并按 mid 升序遍历，避免被当前系统的分类排序字段影响显示顺序。
  const categories = [...props.allCategories].sort((left, right) => left.mid - right.mid);
  const entriesHtml = config.map((entry) => renderDirectoryEntry(categories, entry)).join('');
  return `<div><ul><li><a href="javascript:void(0)" class="item directory-label">分类</a><em></em><ul>${entriesHtml}</ul></li></ul></div>`;
}

export function getCommentCount(nodes: CommentNode[]): number {
  let total = 0;
  for (const node of nodes) {
    total += 1 + getCommentCount(node.children);
  }
  return total;
}

export function getCommentCountLabel(total: number): string {
  if (total <= 0) return '0';
  return String(total);
}

export function getSearchDatasetJson(props: ThemeBaseProps & { posts?: Array<{ permalink: string; title: string; commentsNum: number; excerpt: string }> }) {
  const posts = (props as any).posts || [];
  const pages = props.pages || [];
  const categories = props.allCategories || [];
  const tags = props.sidebarData?.categories || [];

  const sanitize = (input: string) => stripHtml(input)
    .replace(/[\[\]{}<>`"'\\:\-;\r\n\t ]+/g, '');

  const result: Array<Record<string, string>> = [];

  for (const post of posts) {
    result.push({
      this: 'post',
      link: post.permalink,
      title: post.title,
      comments: String(post.commentsNum || 0),
      text: sanitize(post.excerpt || ''),
    });
  }

  for (const page of pages) {
    result.push({
      this: 'page',
      link: page.permalink,
      title: page.title,
      comments: '0',
      text: '',
    });
  }

  for (const category of categories) {
    result.push({
      this: 'category',
      link: category.permalink,
      title: category.name,
      comments: '0',
      text: '',
    });
  }

  for (const tag of tags) {
    result.push({
      this: 'category',
      link: tag.permalink,
      title: tag.name,
      comments: String(tag.count || 0),
      text: '',
    });
  }

  return JSON.stringify(result);
}

export function getPageTitleSuffix(props: { archiveTitle?: string; options: ThemeBaseProps['options'] }): string {
  if (props.archiveTitle) return `${props.archiveTitle} - ${props.options.title}`;
  return props.options.title;
}

export function formatCommentDate(timestamp: number, timezone: number): string {
  return formatDate(timestamp, 'Y-m-d', timezone);
}
