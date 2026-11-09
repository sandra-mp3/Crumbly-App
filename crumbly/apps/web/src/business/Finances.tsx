import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { BarChart } from "../components/BarChart";
import { Metric } from "./Dashboard";
import { ksh } from "../types";

interface Fin { period: string; from: string; to: string; orders: number; grossSales: number; discounts: number; deliveryRevenue: number; netRevenue: number; expenses: number; expensesByCategory: Record<string, number>; estimatedProfit: number; marginPercent: number | null; series: { key: string; revenue: number; expenses: number }[]; recentExpenses: { id: string; date: string; category: string; amount: number; note?: string }[] }
const CATS = ["Ingredients", "Packaging", "Wages", "Rent", "Utilities", "Delivery", "Marketing", "Other"], PERIODS = [["week", "7 days"], ["month", "30 days"], ["year", "12 months"]] as const;

export default function Finances() {
  const [period, setPeriod] = useState("month"), qc = useQueryClient(), q = useQuery({ queryKey: ["biz-fin", period], queryFn: () => api<Fin>(`/business/finances?period=${period}`) });
  const [f, setF] = useState({ date: new Date().toISOString().slice(0, 10), category: "Ingredients", amount: "", note: "" });
  const refresh = () => qc.invalidateQueries({ queryKey: ["biz-fin"] });
  const add = useMutation({ mutationFn: () => api("/business/expenses", { method: "POST", body: { ...f, amount: Number(f.amount) } }), onSuccess: () => { setF({ ...f, amount: "", note: "" }); refresh(); } });
  const del = useMutation({ mutationFn: (id: string) => api(`/business/expenses/${id}`, { method: "DELETE" }), onSettled: refresh });
  const s = q.data;
  return (
    <div className="grid gap-5"><div className="flex flex-wrap items-center justify-between gap-2"><h1 className="font-display text-4xl font-extrabold">Finances</h1>
      <div className="flex gap-2" role="group" aria-label="Period">{PERIODS.map(([k, t]) => <button key={k} aria-pressed={period === k} onClick={() => setPeriod(k)} className={`rounded-full px-4 py-2 font-bold ${period === k ? "bg-ink text-cream" : "bg-white"}`}>{t}</button>)}</div></div>
      {q.isError ? <p role="alert" className="rounded-3xl bg-white p-6">We couldn't load your finances. <button className="font-bold underline" onClick={() => q.refetch()}>Try again</button></p> : !s ? <div className="h-60 animate-pulse rounded-3xl bg-peach/60" /> : <>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Revenue" value={ksh(s.netRevenue)} sub={`${s.orders} paid orders`} /><Metric label="Expenses" value={ksh(s.expenses)} /><Metric label="Estimated profit" value={ksh(s.estimatedProfit)} sub={s.marginPercent === null ? "" : `${s.marginPercent}% margin`} /><Metric label="Discounts given" value={ksh(s.discounts)} sub={`Delivery fees ${ksh(s.deliveryRevenue)}`} /></div>
        <section className="rounded-3xl bg-white p-5"><h2 className="mb-2 font-display text-2xl font-extrabold">Revenue</h2>{s.orders ? <BarChart label="Revenue over time" data={s.series.map((x) => ({ label: x.key.slice(period === "year" ? 0 : 5), value: x.revenue }))} format={ksh} /> : <p className="py-6 text-center text-mute">No paid orders in this period yet.</p>}
          <p className="mt-2 text-xs text-mute">Profit is an estimate: revenue minus the expenses you record below. Refunds aren't tracked yet.</p></section>
        <section className="rounded-3xl bg-white p-5"><h2 className="mb-2 font-display text-2xl font-extrabold">Expenses</h2>
          <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} className="mb-3 grid gap-2 sm:grid-cols-[auto_auto_auto_1fr_auto]">
            <input type="date" required max={new Date().toISOString().slice(0, 10)} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} aria-label="Date" className="rounded-xl border border-line bg-cream p-2" />
            <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} aria-label="Category" className="rounded-xl border border-line bg-cream p-2">{CATS.map((c) => <option key={c}>{c}</option>)}</select>
            <input type="number" required min={1} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} aria-label="Amount in KSh" placeholder="KSh" className="w-28 rounded-xl border border-line bg-cream p-2" />
            <input value={f.note} maxLength={120} onChange={(e) => setF({ ...f, note: e.target.value })} aria-label="Note" placeholder="Note (optional)" className="rounded-xl border border-line bg-cream p-2" />
            <button disabled={add.isPending} className="rounded-full bg-leaf px-4 py-2 font-bold text-white">Add</button></form>
          {(add.isError || del.isError) && <p role="alert" className="mb-2 text-sm text-coral">{((add.error ?? del.error) as Error).message}</p>}
          {!s.recentExpenses.length ? <p className="text-mute">🧾 No expenses recorded in this period.</p> : <ul className="grid gap-1">{s.recentExpenses.map((e) => <li key={e.id} className="flex items-center justify-between gap-2 rounded-xl bg-cream p-2"><span>{e.date} · <b>{e.category}</b>{e.note && ` · ${e.note}`}</span><span className="flex items-center gap-2">{ksh(e.amount)}<button onClick={() => confirm("Delete this expense?") && del.mutate(e.id)} aria-label="Delete expense" className="text-mute">✕</button></span></li>)}</ul>}</section></>}
    </div>
  );
}
