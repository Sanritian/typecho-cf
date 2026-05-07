/**
 * 页面标题拼装工具。
 */

export function normalizeTitleSegment(value: string | null | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function buildDocumentTitle(params: {
  title?: string | null;
  fullTitle?: string | null;
  siteTitle: string;
}): string {
  const fullTitle = normalizeTitleSegment(params.fullTitle);
  if (fullTitle) return fullTitle;

  const title = normalizeTitleSegment(params.title);
  if (title) return `${title} - ${params.siteTitle}`;

  return params.siteTitle;
}

export function resolveThemeLayoutTitle(
  pageTitle: string | null | undefined,
  siteTitle: string,
  siteDescription: string | null | undefined,
): { title?: string; fullTitle?: string } {
  const title = normalizeTitleSegment(pageTitle);
  if (title) return { title };

  const description = normalizeTitleSegment(siteDescription);
  return {
    fullTitle: description ? `${siteTitle} - ${description}` : siteTitle,
  };
}
