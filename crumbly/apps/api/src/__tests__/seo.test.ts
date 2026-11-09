import { describe, expect, it } from "vitest";
import { escapeHtml, shareHtml, sitemapXml } from "../seo.js";

describe("seo helpers", () => {
  it("escapes everything that could break out of HTML", () => expect(escapeHtml(`<script>"x"&'y'</script>`)).toBe("&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;"));
  it("builds a sitemap with escaped URLs", () => { const x = sitemapXml(["https://c.test/", "https://c.test/a?b=1&c=2"]); expect(x).toContain("<loc>https://c.test/</loc>"); expect(x).toContain("a?b=1&amp;c=2"); });
  it("share pages carry Open Graph tags and can't be injected through names", () => {
    const h = shareHtml({ title: `Evil "><script>alert(1)</script>`, description: "d", url: "https://c.test/p", image: "https://img/x.jpg" });
    expect(h.includes("<script>")).toBe(false); expect(h).toContain('property="og:title"'); expect(h).toContain('property="og:image" content="https://img/x.jpg"'); expect(h).toContain('rel="canonical" href="https://c.test/p"');
  });
  it("falls back to a plain card without an image", () => expect(shareHtml({ title: "t", description: "d", url: "https://c.test" })).toContain('twitter:card" content="summary"'));
});
