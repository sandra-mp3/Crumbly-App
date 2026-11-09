import { useEffect } from "react";

export interface Seo { title: string; description?: string; image?: string; path?: string; jsonLd?: object; noindex?: boolean }
const DEFAULT_TITLE = "Crumbly – Freshly baked. Made for you.";
function meta(attr: "name" | "property", key: string, content?: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!content) return void el?.remove();
  if (!el) { el = document.createElement("meta"); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.content = content;
}
/** Per-page title, description, Open Graph, canonical link and structured data. Cleans up when the page unmounts. */
export function useSeo(s: Seo) {
  const key = JSON.stringify(s);
  useEffect(() => {
    const url = location.origin + (s.path ?? location.pathname);
    document.title = s.title;
    meta("name", "description", s.description); meta("property", "og:title", s.title); meta("property", "og:description", s.description); meta("property", "og:url", url); meta("property", "og:image", s.image);
    meta("property", "og:type", "website"); meta("name", "twitter:card", s.image ? "summary_large_image" : "summary"); meta("name", "robots", s.noindex ? "noindex, nofollow" : undefined);
    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) { link = document.createElement("link"); link.rel = "canonical"; document.head.appendChild(link); }
    link.href = url;
    let ld = document.getElementById("seo-jsonld");
    if (s.jsonLd) { if (!ld) { ld = document.createElement("script"); ld.id = "seo-jsonld"; (ld as HTMLScriptElement).type = "application/ld+json"; document.head.appendChild(ld); } ld.textContent = JSON.stringify(s.jsonLd).replace(/</g, "\\u003c"); } else ld?.remove();
    return () => { document.title = DEFAULT_TITLE; ["description", "twitter:card", "robots"].forEach((k) => meta("name", k)); ["og:title", "og:description", "og:url", "og:image", "og:type"].forEach((k) => meta("property", k)); document.getElementById("seo-jsonld")?.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
