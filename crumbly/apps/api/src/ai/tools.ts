import { db } from "../firebase.js";
import type { Actor } from "../types.js";
import type { ToolDecl } from "./provider.js";
import { ordersSince } from "../analytics.js";

export interface ToolDef extends ToolDecl { audience: "public" | "baker"; managerOnly?: boolean; run(args: Record<string, unknown>, actor: Actor): Promise<unknown> }
const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const str = (v: unknown) => (typeof v === "string" ? v.slice(0, 120) : "");

/** Tools receive the Actor from the server. The model can never choose a bakeryId. */
function bakeryOf(actor: Actor): string {
  if (!actor.bakeryId) throw new Error("FORBIDDEN");
  return actor.bakeryId;
}
function managerOf(actor: Actor): string {
  const id = bakeryOf(actor);
  if (!["BAKER_OWNER", "BAKER_MANAGER"].includes(actor.role)) throw new Error("FORBIDDEN"); // staff don't see revenue
  return id;
}

export const tools: ToolDef[] = [
  {
    name: "searchProducts", audience: "public",
    description: "Search published products on Crumbly by keyword, max price (KSh) and dietary tag. Returns real products only.",
    parameters: { type: "object", properties: { query: { type: "string" }, maxPrice: { type: "number" }, diet: { type: "string", description: "vegan, vegetarian, gluten-free or halal" } } },
    async run(a) {
      let q: FirebaseFirestore.Query = db.collection("products").where("status", "==", "published");
      if (num(a.maxPrice, 0) > 0) q = q.where("price", "<=", num(a.maxPrice, 0));
      if (str(a.diet)) q = q.where("dietary", "array-contains", str(a.diet));
      const snap = await q.orderBy("price").limit(60).get();
      const term = str(a.query).toLowerCase();
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Record<string, unknown>)
        .filter((p) => !term || JSON.stringify([p.name, p.category, p.keywords]).toLowerCase().includes(term))
        .slice(0, 5).map((p) => ({ id: p.id, slug: p.slug, name: p.name, bakeryName: p.bakeryName, price: p.price, rating: p.rating, prepMinutes: p.prepMinutes, image: p.image }));
    },
  },
  {
    name: "getRevenue", audience: "baker", managerOnly: true,
    description: "Revenue, order count and average order value for the signed-in baker's bakery over the last N days, compared with the previous N days.",
    parameters: { type: "object", properties: { days: { type: "number" } } },
    async run(a, actor) {
      const days = Math.min(Math.max(num(a.days, 30), 1), 365), bakeryId = managerOf(actor);
      const rows = await ordersSince(bakeryId, days * 2);
      const cutoff = Date.now() - days * 864e5;
      const part = (r: typeof rows) => { const rev = r.reduce((s, o) => s + o.total, 0); return { revenue: rev, orders: r.length, avgOrderValue: r.length ? Math.round(rev / r.length) : 0 }; };
      return { periodDays: days, current: part(rows.filter((o) => o.createdAt.toDate().getTime() >= cutoff)), previous: part(rows.filter((o) => o.createdAt.toDate().getTime() < cutoff)) };
    },
  },
  {
    name: "getTopProducts", audience: "baker", managerOnly: true,
    description: "Best and worst selling products for the signed-in baker's bakery over the last N days.",
    parameters: { type: "object", properties: { days: { type: "number" } } },
    async run(a, actor) {
      const rows = await ordersSince(managerOf(actor), Math.min(Math.max(num(a.days, 30), 1), 365));
      const m = new Map<string, { name: string; units: number; revenue: number }>();
      for (const o of rows) for (const i of o.items) { const x = m.get(i.productId) ?? { name: i.name, units: 0, revenue: 0 }; x.units += i.qty; x.revenue += i.lineTotal; m.set(i.productId, x); }
      const list = [...m.values()].sort((x, y) => y.revenue - x.revenue);
      return { best: list.slice(0, 5), worst: list.slice(-5).reverse() };
    },
  },
  {
    name: "getInventoryStatus", audience: "baker",
    description: "Ingredients that are low or out of stock for the signed-in baker's bakery.",
    async run(_a, actor) {
      const snap = await db.collection("bakeries").doc(bakeryOf(actor)).collection("inventory").limit(300).get();
      return snap.docs.map((d) => d.data() as { name: string; quantity: number; minQuantity: number; unit: string })
        .filter((i) => i.quantity <= i.minQuantity).map((i) => ({ name: i.name, quantity: i.quantity, minimum: i.minQuantity, unit: i.unit }));
    },
  },
];
