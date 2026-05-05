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
  return getThemeText(props.themeConfig, 't', props.options.title || 'iTheme');
}

export function getHeaderSubtitle(props: ThemeBaseProps): string {
  return getThemeText(props.themeConfig, 's', props.options.description || '');
}

export function getNavHtml(props: ThemeBaseProps): string {
  const fallback = `<ul class="menu"><li><a href="${props.urls.siteUrl || '/'}">主页<strong>HOME</strong></a></li><li><a id="s">搜索<strong>SEARCH</strong></a></li></ul>`;
  return getThemeText(props.themeConfig, 'dh', fallback);
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
    .split('；')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.split('，');
      const id = parseInt(parts[0] || '0', 10);
      const labelHtml = (parts[1] || '').trim();
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

function renderCategoryChildren(nodes: ThemeCategoryNode[]): string {
  if (nodes.length === 0) return '';
  const html = nodes.map((node) => (
    `<li><a href="${node.permalink}" class="item">${node.name}</a>${renderCategoryChildren(node.children)}</li>`
  )).join('');
  return `<em></em><ul>${html}</ul>`;
}

export function getDirectoryHtml(props: ThemeBaseProps): string {
  const config = parseDirectoryConfig(props.themeConfig.fl);
  if (config.length === 0) return '';

  const tree = buildCategoryTree(props.allCategories);
  return config.map((entry) => {
    const node = findCategoryNode(tree, entry.id);
    if (!node) return '';
    return `<div><ul><li>${entry.labelHtml}${renderCategoryChildren(node.children)}</li></ul></div>`;
  }).join('');
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
  return formatDate(timestamp, 'M d,Y', timezone);
}
