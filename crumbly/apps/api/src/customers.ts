export interface CustOrder { customerId?: string; total: number; createdAt: Date; items: { name: string; qty: number }[] }
export interface CustomerStat { customerId: string; orders: number; spend: number; avgOrder: number; firstOrderAt: string; lastOrderAt: string; favourite: string | null; tags: string[] }

/** Per-customer stats for one bakery, with segments. A customer can be in several (e.g. VIP and High value). */
export function customerStats(orders: CustOrder[], now = Date.now()): CustomerStat[] {
  const by = new Map<string, CustOrder[]>();
  for (const o of orders) if (o.customerId) by.set(o.customerId, [...(by.get(o.customerId) ?? []), o]);
  return [...by].map(([customerId, os]) => {
    const times = os.map((o) => o.createdAt.getTime()), spend = os.reduce((s, o) => s + o.total, 0), avg = Math.round(spend / os.length);
    const first = Math.min(...times), last = Math.max(...times), tally = new Map<string, number>();
    for (const o of os) for (const i of o.items) tally.set(i.name, (tally.get(i.name) ?? 0) + i.qty);
    const tags: string[] = [];
    if (now - last > 60 * 864e5) tags.push("Inactive");
    if (os.length === 1 && now - first <= 30 * 864e5) tags.push("New");
    if (os.length >= 2) tags.push("Returning");
    if (os.length >= 5 || spend >= 10000) tags.push("VIP");
    if (avg >= 2000) tags.push("High value");
    return { customerId, orders: os.length, spend, avgOrder: avg, firstOrderAt: new Date(first).toISOString(), lastOrderAt: new Date(last).toISOString(), favourite: [...tally].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null, tags };
  }).sort((a, b) => b.spend - a.spend);
}
