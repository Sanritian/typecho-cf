import sanitizeHtml from 'sanitize-html';

const DESCRIPTION_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['a', 'code', 'strong', 'em', 'br'],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    a: (_tagName, attribs) => {
      const href = typeof attribs.href === 'string' ? attribs.href : '';
      const target = attribs.target === '_blank' ? '_blank' : undefined;
      return {
        tagName: 'a',
        attribs: {
          href,
          ...(target ? { target } : {}),
          rel: 'noopener noreferrer',
        },
      };
    },
  },
};

export function sanitizeAdminConfigDescription(input: string): string {
  return sanitizeHtml(input, DESCRIPTION_SANITIZE_OPTIONS);
}
