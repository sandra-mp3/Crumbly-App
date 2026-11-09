export interface CalOrder { id: string; status: string; fulfilment: string; neededBy?: string; createdDay: string; items: { name: string; qty: number; notes?: string }[] }
/** Orders still to be baked (before READY). READY and later are shown on the calendar but not on the bake list. */
export const BAKE_STATUSES = ["PAYMENT_CONFIRMED", "ORDER_RECEIVED", "CONFIRMED", "PREPARING", "BAKING"];
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

/** Groups open orders by the day they're needed. Orders needed before `from` that are still open show up on the first day as overdue. */
export function buildCalendar(orders: CalOrder[], from: string, days: number) {
  const out = Array.from({ length: days }, (_, i) => ({ date: addDays(from, i), orders: [] as (CalOrder & { overdue: boolean })[], bakeList: [] as { name: string; qty: number }[] }));
  const last = addDays(from, days - 1);
  for (const o of orders) {
    const d = o.neededBy ?? o.createdDay, overdue = d < from;
    if (d > last) continue;
    out.find((x) => x.date === (overdue ? from : d))?.orders.push({ ...o, overdue });
  }
  for (const day of out) {
    const tally = new Map<string, number>();
    for (const o of day.orders) if (BAKE_STATUSES.includes(o.status)) for (const i of o.items) tally.set(i.name, (tally.get(i.name) ?? 0) + i.qty);
    day.bakeList = [...tally].map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty);
  }
  return out;
}
