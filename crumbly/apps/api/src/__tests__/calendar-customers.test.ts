import { describe, expect, it } from "vitest";
import { buildCalendar, type CalOrder } from "../calendar.js";
import { customerStats } from "../customers.js";

const o = (id: string, status: string, neededBy: string | undefined, items: [string, number][], createdDay = "2026-10-01"): CalOrder => ({ id, status, fulfilment: "PICKUP", neededBy, createdDay, items: items.map(([name, qty]) => ({ name, qty })) });
describe("production calendar", () => {
  const cal = buildCalendar([o("1", "CONFIRMED", "2026-10-07", [["Croissant", 6]]), o("2", "BAKING", "2026-10-07", [["Croissant", 4], ["Cupcake", 12]]), o("3", "READY", "2026-10-07", [["Cake", 1]]), o("4", "CONFIRMED", "2026-10-08", [["Cake", 2]]), o("5", "CONFIRMED", "2026-10-05", [["Bread", 3]]), o("6", "CONFIRMED", "2026-12-01", [["Far", 1]])], "2026-10-07", 3);
  it("tells the baker what to bake today, totalled across orders", () => expect(cal[0]!.bakeList).toEqual([{ name: "Cupcake", qty: 12 }, { name: "Croissant", qty: 10 }, { name: "Bread", qty: 3 }]));
  it("keeps ready orders on the calendar but off the bake list", () => { expect(cal[0]!.orders.map((x) => x.id)).toContain("3"); expect(JSON.stringify(cal[0]!.bakeList).includes("Cake")).toBe(false); });
  it("shows late open orders on the first day, flagged", () => expect(cal[0]!.orders.find((x) => x.id === "5")!.overdue).toBe(true));
  it("schedules tomorrow's orders tomorrow and ignores dates outside the window", () => { expect(cal[1]!.bakeList).toEqual([{ name: "Cake", qty: 2 }]); expect(cal.flatMap((d) => d.orders.map((x) => x.id)).includes("6")).toBe(false); });
  it("falls back to the day the order was placed", () => expect(buildCalendar([o("7", "CONFIRMED", undefined, [["Roll", 1]], "2026-10-07")], "2026-10-07", 1)[0]!.orders.length).toBe(1));
});
const NOW = Date.parse("2026-10-07T12:00:00Z"), ago = (d: number) => new Date(NOW - d * 864e5);
describe("customer segments", () => {
  const stats = customerStats([
    { customerId: "new", total: 800, createdAt: ago(5), items: [{ name: "Cake", qty: 1 }] },
    { customerId: "regular", total: 500, createdAt: ago(40), items: [{ name: "Roll", qty: 2 }] }, { customerId: "regular", total: 600, createdAt: ago(10), items: [{ name: "Roll", qty: 3 }, { name: "Cake", qty: 1 }] },
    { customerId: "gone", total: 700, createdAt: ago(90), items: [{ name: "Bread", qty: 1 }] }, { customerId: "gone", total: 700, createdAt: ago(100), items: [{ name: "Bread", qty: 1 }] },
    { customerId: "big", total: 12000, createdAt: ago(3), items: [{ name: "Wedding cake", qty: 1 }] },
    { total: 1, createdAt: ago(1), items: [] },
  ], NOW);
  const tags = (id: string) => stats.find((s) => s.customerId === id)!.tags;
  it("tags new, returning, inactive and VIP customers", () => { expect(tags("new")).toEqual(["New"]); expect(tags("regular")).toEqual(["Returning"]); expect(tags("gone")).toEqual(["Inactive", "Returning"]); expect(tags("big")).toEqual(["New", "VIP", "High value"]); });
  it("computes spend, average and favourite product", () => { const r = stats.find((s) => s.customerId === "regular")!; expect(r).toMatchObject({ orders: 2, spend: 1100, avgOrder: 550, favourite: "Roll" }); });
  it("sorts by spend and skips orders without a customer", () => { expect(stats[0]!.customerId).toBe("big"); expect(stats.length).toBe(4); });
});
