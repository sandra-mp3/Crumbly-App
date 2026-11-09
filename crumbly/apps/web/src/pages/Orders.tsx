import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { payForOrders, payMessage } from "../lib/pay";
import { api } from "../lib/api";
import { useSeo } from "../lib/seo";
import RequireAuth from "./RequireAuth";
import { ksh, type Order, type OrderStatus } from "../types";

const STEPS: [OrderStatus, string][] = [["PAYMENT_CONFIRMED", "Payment confirmed"], ["ORDER_RECEIVED", "Order received"], ["CONFIRMED", "Confirmed"], ["PREPARING", "Preparing"], ["BAKING", "Baking"], ["READY", "Ready"], ["OUT_FOR_DELIVERY", "Out for delivery"], ["DELIVERED", "Delivered"]];

function PayPanel({ id }: { id: string }) {
  const [phone, setPhone] = useState(""), [st, setSt] = useState<"idle" | "sending" | "waiting">("idle"), [err, setErr] = useState(""), qc = useQueryClient();
  async function pay() {
    setErr(""); setSt("sending");
    try { const r = await payForOrders([id], phone, () => setSt("waiting")); if (r === "success") await qc.invalidateQueries({ queryKey: ["order", id] }); else setErr(payMessage[r]); } catch (e) { setErr((e as Error).message); }
    setSt("idle");
  }
  return (<div className="grid gap-2 rounded-2xl bg-white p-4"><label className="text-sm font-medium">M-Pesa phone number<input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="0712 345 678" className="mt-1 w-full rounded-xl border border-line bg-cream p-3" /></label>
    {err && <p role="alert" className="rounded-xl bg-peach p-3 text-sm">{err}</p>}
    <button disabled={st !== "idle" || phone.length < 9} onClick={pay} className="rounded-full bg-leaf py-3 font-bold text-white disabled:opacity-50">{st === "sending" ? "Sending request…" : st === "waiting" ? "Check your phone and enter your PIN…" : "Pay with M-Pesa"}</button></div>);
}
function List() {
  useSeo({ title: "Your orders | Crumbly", noindex: true });
  const q = useQuery({ queryKey: ["orders"], queryFn: () => api<Order[]>("/orders") });
  if (q.isLoading) return <div className="mx-auto h-40 max-w-2xl animate-pulse rounded-3xl bg-peach/60" />;
  if (q.isError) return <p role="alert" className="p-10 text-center">We couldn't load your orders. Please refresh.</p>;
  if (!q.data?.length) return <div className="p-10 text-center"><div className="text-6xl">📦</div><p className="my-3 text-lg">No orders yet. Your first one will show up here.</p><Link to="/" className="font-bold underline">Find something delicious</Link></div>;
  return <div className="mx-auto grid max-w-2xl gap-3 px-4 py-8"><h1 className="font-display text-4xl font-extrabold">Your orders</h1>{q.data.map((o) => <Link key={o.id} to={`/orders/${o.id}`} className="rounded-2xl bg-white p-4"><b>{o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</b><p className="text-sm text-mute">{o.status.replaceAll("_", " ").toLowerCase()} · {ksh(o.total)}</p></Link>)}</div>;
}
function Detail() {
  useSeo({ title: "Your order | Crumbly", noindex: true });
  const { id } = useParams();
  const q = useQuery({ queryKey: ["order", id], queryFn: () => api<Order>(`/orders/${id}`), refetchInterval: 10_000 });
  if (q.isError) return <p role="alert" className="p-10 text-center">We couldn't find that order.</p>;
  const o = q.data; if (!o) return <div className="mx-auto h-60 max-w-xl animate-pulse rounded-3xl bg-peach/60" />;
  const steps = STEPS.filter(([s]) => o.fulfilment === "DELIVERY" || s !== "OUT_FOR_DELIVERY"), at = steps.findIndex(([s]) => s === o.status);
  return (
    <div className="mx-auto grid max-w-xl gap-4 px-4 py-8">
      <h1 className="font-display text-4xl font-extrabold">{o.status === "CANCELLED" ? "Order cancelled" : o.status === "PENDING_PAYMENT" ? "Waiting for payment" : "Your order"}</h1>
      <ol className="grid gap-2">{steps.map(([s, label], i) => <li key={s} className={`flex items-center gap-3 rounded-2xl p-3 ${i <= at ? "bg-leaf text-white" : "bg-white text-mute"}`} aria-current={i === at ? "step" : undefined}><span>{i < at ? "✓" : i === at ? "●" : "○"}</span>{label}</li>)}</ol>
      {o.status === "PENDING_PAYMENT" && <PayPanel id={o.id} />}
      <div className="rounded-2xl bg-white p-4">{o.items.map((i, k) => <p key={k} className="flex justify-between"><span>{i.qty}× {i.name}</span>{ksh(i.lineTotal)}</p>)}<p className="mt-2 flex justify-between font-bold"><span>Total</span>{ksh(o.total)}</p>{o.address && <p className="mt-2 text-sm text-mute">Delivering to {o.address.label}</p>}</div>
    </div>
  );
}
export const OrdersPage = () => <RequireAuth reason="Sign in to see your orders."><List /></RequireAuth>;
export const OrderDetail = () => <RequireAuth reason="Sign in to see this order."><Detail /></RequireAuth>;
