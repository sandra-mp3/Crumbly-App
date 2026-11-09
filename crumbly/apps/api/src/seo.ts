export const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
export const sitemapXml = (urls: string[]) => `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${escapeHtml(u)}</loc></url>`).join("\n")}\n</urlset>\n`;

/** A tiny page for link previews (WhatsApp, Facebook, X...). Crawlers read the tags; people are redirected to the real page. */
export function shareHtml(p: { title: string; description: string; url: string; image?: string }) {
  const t = escapeHtml(p.title), d = escapeHtml(p.description), u = escapeHtml(p.url);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${t}</title><meta name="description" content="${d}">
<link rel="canonical" href="${u}"><meta property="og:site_name" content="Crumbly"><meta property="og:type" content="website"><meta property="og:title" content="${t}"><meta property="og:description" content="${d}"><meta property="og:url" content="${u}">
${p.image ? `<meta property="og:image" content="${escapeHtml(p.image)}"><meta name="twitter:card" content="summary_large_image">` : `<meta name="twitter:card" content="summary">`}
<meta http-equiv="refresh" content="0;url=${u}"></head><body><p><a href="${u}">${t}</a></p></body></html>`;
}
