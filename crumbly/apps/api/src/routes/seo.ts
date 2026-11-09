import { Router } from "express";
import { db } from "../firebase.js";
import { env } from "../env.js";
import { escapeHtml, shareHtml, sitemapXml } from "../seo.js";

/** Mounted at the site root (not /api). Point your web host's /sitemap.xml and /share/* at the API. */
export const seo = Router();
const cache = (res: { set(k: string, v: string): void }) => res.set("Cache-Control", "public, max-age=3600");

seo.get("/sitemap.xml", async (_req, res, next) => {
  try {
    const [b, p] = await Promise.all([db.collection("bakeries").where("status", "==", "active").limit(1000).get(), db.collection("products").where("status", "==", "published").limit(2000).get()]);
    const urls = [env.WEB_URL + "/", ...b.docs.map((d) => `${env.WEB_URL}/bakeries/${d.data().slug as string}`), ...p.docs.map((d) => `${env.WEB_URL}/products/${d.data().slug as string}`)];
    cache(res); res.type("application/xml").send(sitemapXml(urls));
  } catch (e) { next(e); }
});
seo.get("/share/products/:slug", async (req, res, next) => {
  try {
    const s = await db.collection("products").where("slug", "==", String(req.params.slug)).where("status", "==", "published").limit(1).get(), p = s.docs[0]?.data();
    if (!p) return void res.status(404).type("html").send(`<p>${escapeHtml("That product isn't available right now.")}</p>`);
    cache(res); res.type("html").send(shareHtml({ title: `${p.name} from ${p.bakeryName} | Crumbly`, description: `${p.category}, KSh ${(p.price as number).toLocaleString("en-US")}. Order fresh from a local bakery and pay with M-Pesa.`, url: `${env.WEB_URL}/products/${p.slug}`, image: p.image as string | undefined }));
  } catch (e) { next(e); }
});
seo.get("/share/bakeries/:slug", async (req, res, next) => {
  try {
    const s = await db.collection("bakeries").where("slug", "==", String(req.params.slug)).where("status", "==", "active").limit(1).get(), b = s.docs[0]?.data();
    if (!b) return void res.status(404).type("html").send(`<p>${escapeHtml("That bakery isn't available right now.")}</p>`);
    cache(res); res.type("html").send(shareHtml({ title: `${b.name} in ${b.area} | Crumbly`, description: (b.about as string | undefined)?.slice(0, 160) || `Order fresh bakes from ${b.name} in ${b.area}. Pay with M-Pesa.`, url: `${env.WEB_URL}/bakeries/${b.slug}`, image: (b.cover ?? b.logo) as string | undefined }));
  } catch (e) { next(e); }
});
