/**
 * Theme template Props interfaces
 *
 * These interfaces define the data contract between page routes and theme components.
 * Theme authors implement Astro components that receive these Props.
 * Only frontend (blog) pages are covered — admin pages are not part of the theme system.
 */
import type { SiteOptions, computeUrls } from '@/lib/options';
import type { SidebarData } from '@/lib/sidebar';
import type { PaginationInfo } from '@/lib/pagination';
import type { UserRow } from '@/lib/context';

// ─── Base Props (shared by all theme components) ────────────────────────

export interface ThemeBaseProps {
  /** Site configuration */
  options: SiteOptions;
  /** Computed URL set (siteUrl, adminUrl, feedUrl, etc.) */
  urls: ReturnType<typeof computeUrls>;
  /** Currently logged-in user (null = anonymous) */
  user: UserRow | null;
  /** Whether a user is logged in */
  isLoggedIn: boolean;
  /** Navigation pages (published pages shown in header nav) */
  pages: Array<{ title: string; slug: string; permalink: string }>;
  /** Sidebar widget data */
  sidebarData: SidebarData;
  /** 全量分类数据，供主题自行组织树结构或目录导航 */
  allCategories: Array<{ mid: number; parent: number; name: string; slug: string; count: number; permalink: string }>;
  /** Current request path */
  currentPath: string;
  /** 当前主题标识 */
  activeThemeId: string;
  /** 当前主题配置，来自 options 表中的 `theme:<themeId>` */
  themeConfig: Record<string, unknown>;
  /** 是否为异步片段请求（如 PJAX / AJAX 局部刷新） */
  isAjaxRequest: boolean;
  /** 主题可识别的渲染模式，例如 `comment` */
  renderMode?: string;
}

// ─── Post list item (used by Index & Archive) ───────────────────────────

export interface PostListItem {
  cid: number;
  title: string;
  permalink: string;
  /** Rendered HTML excerpt (with <!--more--> support) */
  excerpt: string;
  created: number;
  commentsNum: number;
  author: { uid: number; name: string; screenName: string } | null;
  categories: Array<{ name: string; slug: string; permalink: string }>;
}

// ─── Index (home page) ──────────────────────────────────────────────────

export interface ThemeIndexProps extends ThemeBaseProps {
  posts: PostListItem[];
  pagination: PaginationInfo;
  archiveTitle?: string;
  archiveType?: string;
}

// ─── Post detail ────────────────────────────────────────────────────────

export interface ThemePostProps extends ThemeBaseProps {
  post: {
    cid: number;
    title: string;
    permalink: string;
    /** Rendered HTML content */
    content: string;
    created: number;
    modified: number | null;
    commentsNum: number;
    allowComment: boolean;
    /** Whether the post is password-protected */
    hasPassword: boolean;
    /** Whether the user has supplied the correct password */
    passwordVerified: boolean;
  };
  author: { uid: number; name: string; screenName: string } | null;
  categories: Array<{ name: string; slug: string; permalink: string }>;
  tags: Array<{ name: string; slug: string; permalink: string }>;
  comments: CommentNode[];
  commentOptions: CommentOptions;
  prevPost: { title: string; permalink: string } | null;
  nextPost: { title: string; permalink: string } | null;
  gravatarMap: Record<number, string>;
}

// ─── Independent page ───────────────────────────────────────────────────

export interface ThemePageProps extends ThemeBaseProps {
  page: {
    cid: number;
    title: string;
    slug: string;
    permalink: string;
    /** Rendered HTML content */
    content: string;
    created: number;
    allowComment: boolean;
    hasPassword: boolean;
    passwordVerified: boolean;
  };
  comments: CommentNode[];
  commentOptions: CommentOptions;
  gravatarMap: Record<number, string>;
}

// ─── Archive (category / tag / author / search) ─────────────────────────

export interface ThemeArchiveProps extends ThemeBaseProps {
  /** Display title, e.g. "分类 技术 下的文章" */
  archiveTitle: string;
  archiveType: 'category' | 'tag' | 'author' | 'search' | 'index';
  posts: PostListItem[];
  pagination: PaginationInfo;
}

// ─── Shared sub-types ───────────────────────────────────────────────────

export interface CommentNode {
  coid: number;
  author: string;
  mail: string;
  url: string;
  /** Rendered HTML */
  text: string;
  created: number;
  parent: number;
  authorId: number;
  ownerId: number;
  replyToAuthor?: string;
  children: CommentNode[];
}

export interface CommentOptions {
  allowComment: boolean;
  requireMail: boolean;
  showUrl: boolean;
  showAvatar: boolean;
  avatarRating: string;
  order: 'ASC' | 'DESC';
  /** Date format string for comments */
  dateFormat: string;
  /** Timezone offset in seconds */
  timezone: number;
  /**
   * CSRF token for the comment form `<input name="_">`.
   * Empty string when anti-spam is disabled (commentsAntiSpam = 0).
   */
  securityToken: string;

  // ─── Display Settings ────────────────────────
  /** Only show comments, not pingback/trackback */
  showCommentOnly: boolean;
  /** Support Markdown syntax in comments */
  markdown: boolean;
  /** Add nofollow attribute to comment author URLs */
  urlNofollow: boolean;

  // ─── Threading & Pagination ─────────────────
  /** Enable nested comments (replies) */
  threaded: boolean;
  /** Maximum nesting level for comment replies */
  maxNestingLevels: number;
  /** Enable comment pagination */
  pageBreak: boolean;
  /** Comments per page when pagination enabled */
  pageSize: number;
  /** Default page to show: 'first' or 'last' */
  pageDisplay: 'first' | 'last';

  // ─── HTML Filtering ─────────────────────────
  /** Allowed HTML tags/attributes in comments (semicolon-separated) */
  htmlTagAllowed: string;
  /** 当前评论分页页码，1-based */
  currentPage: number;
  /** 评论总页数 */
  totalPages: number;
  /** 评论总数量（当前文章/页面下，审核通过） */
  totalItems: number;
  /** 评论分页跳转链接 */
  pageLinks: Array<{ page: number; url: string; current: boolean }>;
  /** 上一页链接 */
  prevUrl: string | null;
  /** 下一页链接 */
  nextUrl: string | null;
}

// ─── 404 Not Found ──────────────────────────────────────────────────────

export interface ThemeNotFoundProps extends ThemeBaseProps {
  /** HTTP status code (404) */
  statusCode: number;
  /** Error title for display */
  errorTitle: string;
}

// ─── Theme template component map ───────────────────────────────────────

export interface ThemeTemplateMap {
  Index?: (_props: ThemeIndexProps) => any;
  Post?: (_props: ThemePostProps) => any;
  Page?: (_props: ThemePageProps) => any;
  Archive?: (_props: ThemeArchiveProps) => any;
  NotFound?: (_props: ThemeNotFoundProps) => any;
}
