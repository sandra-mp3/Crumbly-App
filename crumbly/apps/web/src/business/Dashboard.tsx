import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";
import { useMe } from "../lib/useMe";
import { api } from "../lib/api";
import { BarChart } from "../components/BarChart";
import { ksh } from "../types";

export interface Summary { days: number; totals: { revenue: number; orders: number; avgOrderValue: number }; previous: { revenue: number; orders: number; avgOrderValue: number }; today: { revenue: number; orders: number }; pendingOrders: number; lowStock: number;
  byDay: { date: string; revenue: number; orders: number }[]; byHour: { hour: number; revenue: number; orders: number }[]; best: { name: string; units: number; revenue: number }[]; worst: { name: string; units: number; revenue: number }[] }
export const useSummary = (days: number, enabled = true) => useQuery({ queryKey: ["summary", days], enabled, queryFn: () => api<Summary>(`/business/summary?days=${days}`) });
export const Delta = ({ a, b }: { a: number; b: number }) => !b ? null : <span className={a >= b ? "text-leaf" : "text-coral"}>{a >= b ? "▲" : "▼"} {Math.abs(Math.round(((a - b) / b) * 100))}% vs previous</span>;
export const Metric = ({ label, value, sub }: { label: string; value: string; sub?: ReactNode }) => <div className="rounded-3xl bg-white p-4"><p className="text-sm text-mute">{label}</p><p className="font-display text-3xl font-extrabold">{value}</p><p className="text-xs">{sub}</p></div>;

export default function Dashboard() {
  const me = useMe(), staff = me.data?.role === "BAKER_STAFF", q = useSummary(30, !!me.data && !staff);
  if (staff) return <Navigate to="/business/orders" replace />; // staff don't see revenue
  if (q.isError) return <p role="alert" className="rounded-3xl bg-white p-6">We couldn't load your dashboard. <button className="font-bold underline" onClick={() => q.refetch()}>Try again</button></p>;
  const s = q.data;
  if (!s) return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-3xl bg-peach/60" />)}</div>;
  return (
    <div className="grid gap-5">
      <h1 className="font-display text-4xl font-extrabold">Dashboard</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Today's revenue" value={ksh(s.today.revenue)} /><Metric label="Today's orders" value={String(s.today.orders)} />
        <Metric label="Orders to bake" value={String(s.pendingOrders)} sub={<Link to="/business/orders" className="underline">Open order board</Link>} />
        <Metric label="Low-stock items" value={String(s.lowStock)} sub={<Link to="/business/inventory" className="underline">Check inventory</Link>} />
      </div>
      <section className="rounded-3xl bg-white p-5"><div className="mb-2 flex justify-between"><h2 className="font-display text-2xl font-extrabold">Revenue, last 30 days</h2><span className="text-sm"><Delta a={s.totals.revenue} b={s.previous.revenue} /></span></div>
        {s.totals.orders ? <BarChart label="Revenue by day" data={s.byDay.map((d) => ({ label: d.date.slice(5), value: d.revenue }))} format={ksh} /> : <p className="py-8 text-center text-mute">No paid orders in this period yet.</p>}</section>
      <section className="rounded-3xl bg-white p-5"><h2 className="mb-2 font-display text-2xl font-extrabold">Best sellers</h2>
        {s.best.length ? <ol className="grid gap-1">{s.best.map((p, i) => <li key={p.name} className="flex justify-between"><span>{i + 1}. {p.name} <span className="text-mute">({p.units} sold)</span></span><b>{ksh(p.revenue)}</b></li>)}</ol> : <p className="text-mute">Your best sellers will show up here.</p>}</section>
    </div>
  );
}
