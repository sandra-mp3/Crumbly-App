import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AddressPicker } from "../components/AddressPicker";
import { api } from "../lib/api";
import { useSeo } from "../lib/seo";
import { useCart } from "../cart/CartProvider";
import RequireAuth from "./RequireAuth";
import type { Account } from "./Account";
import { payForOrders, payMessage } from "../lib/pay";
import { ksh, type Order, type Place, type Quote } from "../types";


function CheckoutInner() {
  useSeo({ title: "Checkout | Crumbly", noindex: true });
  const { lines, subtotal, setQty, clear } = useCart(), nav = useNavigate();
  const [mode, setMode] = useState<"PICKUP" | "DELIVERY">("PICKUP"), [place, setPlace] = useState<Place | null>(null), [phone, setPhone] = useState(""), [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [state, setState] = useState<"idle" | "sending" | "waiting">("idle"), [err, setErr] = useState(""), [code, setCode] = useState(""), [promo, setPromo] = useState<{ name: string; saving: number } | null>(null), [promoErr, setPromoErr] = useState("");
  // Same cart contents => same key, so a retry after a failed payment reuses the same orders instead of duplicating them.
  const acct = useQuery({ queryKey: ["account"], queryFn: () => api<Account>("/account") }), [pickerKey, setPickerKey] = useState(0);
  const sig = lines.map((l) => `${l.product.id}x${l.qty}`).join(",") + mode + date;
  const key = useMemo(() => crypto.randomUUID(), [sig]); // eslint-disable-line react-hooks/exhaustive-deps
  const ids = [...new Set(lines.map((l) => l.product.bakeryId))], bakeries = ids.length;
  const quotes = useQuery({ queryKey: ["quotes", ids.join(), place?.lat, place?.lng], enabled: mode === "DELIVERY" && !!place, queryFn: () => api<Record<string, Quote>>("/delivery/quotes", { method: "POST", body: { bakeryIds: ids, lat: place!.lat, lng: place!.lng } }) });
  const unavailable = ids.filter((id) => quotes.data && !quotes.data[id]?.available);
  const qs: Record<string, Quote> = quotes.data ?? {}, fee = mode === "DELIVERY" ? Object.values(qs).reduce((a, q) => a + q.fee, 0) : 0;
  const eta = Math.max(0, ...Object.values(qs).map((q) => q.minutes));

  useEffect(() => { setPromo(null); }, [sig, place?.lat, place?.lng]); // a cart, date or address change means the discount must be re-checked
  async function applyCode() {
    setPromoErr("");
    try { const r = await api<{ name: string; totalSaving: number }>("/promotions/preview", { method: "POST", body: { code, items: lines.map((l) => ({ productId: l.product.id, qty: l.qty })), fulfilment: mode, address: mode === "DELIVERY" ? place : undefined } }); setPromo({ name: r.name, saving: r.totalSaving }); }
    catch (e) { setPromo(null); setPromoErr((e as Error).message); }
  }
  async function pay() {
    setErr(""); setState("sending");
    try {
      const orders = await api<Order[]>("/orders", { method: "POST", headers: { "Idempotency-Key": key }, body: { items: lines.map((l) => ({ productId: l.product.id, qty: l.qty })), fulfilment: mode, neededBy: date, promoCode: promo ? code : undefined, address: mode === "DELIVERY" ? place! : undefined } });
      const r = await payForOrders(orders.map((o) => o.id), phone, () => setState("waiting"));
      if (r === "success") { clear(); return nav(orders.length === 1 ? `/orders/${orders[0]!.id}` : "/orders"); }
      setErr(payMessage[r]); setState("idle");
    } catch (e) { setErr((e as Error).message); setState("idle"); }
  }

  if (!lines.length) return <div className="mx-auto max-w-md p-10 text-center"><div className="text-6xl">🧺</div><p className="my-3 text-lg">Your cart is empty. Add something warm from the oven.</p><Link to="/" className="font-bold underline">Browse pastries</Link></div>;
  const busy = state !== "idle", ok = phone.length >= 9 && (mode === "PICKUP" || (!!place && !!quotes.data && unavailable.length === 0));
  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 md:grid-cols-[1.2fr_.8fr]">
      <div className="grid content-start gap-4">
        <h1 className="font-display text-4xl font-extrabold">Checkout</h1>
        {lines.map(({ product: p, qty }) => (
          <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-white p-3"><div className="flex-1"><b>{p.name}</b><p className="text-sm text-mute">{p.bakeryName} · {ksh(p.price * qty)}</p></div>
            <button aria-label={`Less ${p.name}`} onClick={() => setQty(p.id, qty - 1)} className="h-8 w-8 rounded-full bg-cream font-bold">−</button><span>{qty}</span><button aria-label={`More ${p.name}`} onClick={() => setQty(p.id, qty + 1)} className="h-8 w-8 rounded-full bg-cream font-bold">+</button></div>))}
        {bakeries > 1 && <p className="text-sm text-mute">Items from {bakeries} bakeries are prepared and delivered separately.</p>}
        <fieldset className="flex gap-2"><legend className="sr-only">Fulfilment</legend>{(["PICKUP", "DELIVERY"] as const).map((m) => <button key={m} aria-pressed={mode === m} onClick={() => setMode(m)} className={`rounded-full px-5 py-2 font-bold ${mode === m ? "bg-ink text-cream" : "bg-white"}`}>{m === "PICKUP" ? "Pickup" : "Delivery"}</button>)}</fieldset>
        {mode === "DELIVERY" && <div className="grid gap-2">{!!acct.data?.addresses.length && <label className="text-sm font-medium">Use a saved address<select value="" onChange={(e) => { const a = acct.data!.addresses.find((x) => x.id === e.target.value); if (a) { setPlace({ label: a.label, lat: a.lat, lng: a.lng }); setPickerKey((k) => k + 1); } }} className="mt-1 w-full rounded-xl border border-line bg-white p-3"><option value="">Choose…</option>{acct.data.addresses.map((a) => <option key={a.id} value={a.id}>{a.name}: {a.label}</option>)}</select></label>}
          <AddressPicker key={pickerKey} value={place} onPick={setPlace} />
          {quotes.isLoading && <p className="text-sm text-mute">Checking delivery…</p>}{quotes.isError && <p role="alert" className="text-sm text-coral">{(quotes.error as Error).message}</p>}
          {unavailable.length > 0 && <p role="alert" className="rounded-xl bg-peach p-3 text-sm">Some bakeries in your cart don't deliver to that address. Choose pickup or another address.</p>}
          {quotes.data && unavailable.length === 0 && <p className="text-sm text-mute">Estimated delivery in about {eta} minutes.</p>}</div>}
        <label className="text-sm font-medium">When do you need it?<input type="date" min={new Date().toISOString().slice(0, 10)} max={new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10)} value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-xl border border-line bg-white p-3" /></label>
        <label className="text-sm font-medium">M-Pesa phone number<input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className="mt-1 w-full rounded-xl border border-line bg-white p-3" placeholder="0712 345 678" /></label>
      </div>
      <aside className="h-fit rounded-3xl bg-white p-5"><p className="flex justify-between"><span>Subtotal</span>{ksh(subtotal)}</p><p className="flex justify-between"><span>Delivery</span>{fee ? ksh(fee) : "Free"}</p>
        <div className="my-2 grid gap-1"><div className="flex gap-2"><input value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setPromo(null); }} aria-label="Promo code" placeholder="Promo code" maxLength={20} className="min-w-0 flex-1 rounded-xl border border-line bg-cream p-2" /><button type="button" disabled={code.trim().length < 3} onClick={applyCode} className="rounded-full border border-ink px-4 py-2 font-bold disabled:opacity-50">Apply</button></div>
          {promoErr && <p role="alert" className="text-sm text-coral">{promoErr}</p>}{promo && <p className="flex justify-between text-sm text-leaf"><span>✓ {promo.name}</span><span>−{ksh(promo.saving)}</span></p>}</div>
        <p className="my-3 flex justify-between font-display text-2xl font-extrabold"><span>Total</span>{ksh(Math.max(0, subtotal + fee - (promo?.saving ?? 0)))}</p>
        {err && <p role="alert" className="mb-3 rounded-xl bg-peach p-3 text-sm">{err}</p>}
        <button disabled={busy || !ok} onClick={pay} className="w-full rounded-full bg-leaf py-3 text-lg font-bold text-white disabled:opacity-50">{state === "sending" ? "Sending request…" : state === "waiting" ? "Check your phone and enter your PIN…" : "Pay with M-Pesa"}</button>
        <p className="mt-2 text-xs text-mute">The final price is confirmed by our server. You'll get an M-Pesa prompt on your phone.</p></aside>
    </div>
  );
}
export default function Checkout() { return <RequireAuth reason="Sign in to check out."><CheckoutInner /></RequireAuth>; }
