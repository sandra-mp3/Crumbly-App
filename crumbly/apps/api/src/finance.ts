export interface FinOrder { subtotal?: number; discount?: number; deliveryFee?: number; deliveryDiscount?: number; total: number; createdAt: Date }
export interface FinExpense { date: string; category: string; amount: number }
export const EXPENSE_CATEGORIES = ["Ingredients", "Packaging", "Wages", "Rent", "Utilities", "Delivery", "Marketing", "Other"] as const;
const nairobiDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

/** Money summary for [from, from+days). Profit is an estimate: net revenue minus recorded expenses (ingredients stand in for cost of goods). */
export function financeSummary(orders: FinOrder[], expenses: FinExpense[], from: string, days: number, bucket: "day" | "month") {
  const last = addDays(from, days - 1), inRange = (d: string) => d >= from && d <= last;
  const os = orders.filter((o) => inRange(nairobiDay(o.createdAt))), es = expenses.filter((e) => inRange(e.date));
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const grossSales = sum(os.map((o) => o.subtotal ?? o.total - (o.deliveryFee ?? 0) + (o.deliveryDiscount ?? 0) + (o.discount ?? 0)));
  const discounts = sum(os.map((o) => (o.discount ?? 0) + (o.deliveryDiscount ?? 0)));
  const deliveryRevenue = sum(os.map((o) => o.deliveryFee ?? 0));
  const netRevenue = sum(os.map((o) => o.total)), expenseTotal = sum(es.map((e) => e.amount));
  const byCategory: Record<string, number> = {};
  for (const e of es) byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
  const key = (d: string) => (bucket === "month" ? d.slice(0, 7) : d), series = new Map<string, { key: string; revenue: number; expenses: number }>();
  for (let i = 0; i < days; i++) { const k = key(addDays(from, i)); if (!series.has(k)) series.set(k, { key: k, revenue: 0, expenses: 0 }); }
  for (const o of os) series.get(key(nairobiDay(o.createdAt)))!.revenue += o.total;
  for (const e of es) series.get(key(e.date))!.expenses += e.amount;
  const profit = netRevenue - expenseTotal;
  return { from, to: last, orders: os.length, grossSales, discounts, deliveryRevenue, netRevenue, expenses: expenseTotal, expensesByCategory: byCategory, estimatedProfit: profit, marginPercent: netRevenue ? Math.round((profit / netRevenue) * 100) : null, series: [...series.values()] };
}
