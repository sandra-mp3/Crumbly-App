import { describe, expect, it } from "vitest";
import { financeSummary } from "../finance.js";

const at = (iso: string) => new Date(`${iso}T09:00:00+03:00`);
const orders = [{ subtotal: 3000, discount: 600, deliveryFee: 250, deliveryDiscount: 0, total: 2650, createdAt: at("2026-10-05") }, { subtotal: 1000, discount: 0, deliveryFee: 0, total: 1000, createdAt: at("2026-10-06") }, { total: 800, createdAt: at("2026-10-06") }, { total: 99999, createdAt: at("2026-09-01") }];
const expenses = [{ date: "2026-10-05", category: "Ingredients", amount: 900 }, { date: "2026-10-06", category: "Packaging", amount: 150 }, { date: "2026-08-01", category: "Rent", amount: 50000 }];

describe("finance summary", () => {
  const s = financeSummary(orders, expenses, "2026-10-01", 7, "day");
  it("adds up revenue, discounts and delivery for the period only", () => { expect(s).toMatchObject({ orders: 3, netRevenue: 4450, discounts: 600, deliveryRevenue: 250 }); expect(s.grossSales).toBe(3000 + 1000 + 800); });
  it("estimates profit from recorded expenses", () => { expect(s.expenses).toBe(1050); expect(s.estimatedProfit).toBe(3400); expect(s.marginPercent).toBe(76); expect(s.expensesByCategory).toEqual({ Ingredients: 900, Packaging: 150 }); });
  it("returns a zero-filled daily series", () => { expect(s.series.length).toBe(7); expect(s.series.find((x) => x.key === "2026-10-06")).toEqual({ key: "2026-10-06", revenue: 1800, expenses: 150 }); expect(s.series.find((x) => x.key === "2026-10-02")!.revenue).toBe(0); });
  it("buckets by month for the yearly view", () => { const y = financeSummary(orders, expenses, "2026-01-01", 365, "month"); expect(y.series.length).toBe(12); expect(y.series.find((x) => x.key === "2026-10")!.revenue).toBe(4450); expect(y.series.find((x) => x.key === "2026-09")!.revenue).toBe(99999); });
  it("has no margin when there is no revenue", () => expect(financeSummary([], [], "2026-10-01", 7, "day").marginPercent).toBe(null));
});
