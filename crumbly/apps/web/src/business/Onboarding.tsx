import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AddressPicker } from "../components/AddressPicker";
import { api } from "../lib/api";
import { uploadImage } from "../lib/upload";
import RequireAuth from "../pages/RequireAuth";
import type { Place } from "../types";

const DAYS = [["mon", "Monday"], ["tue", "Tuesday"], ["wed", "Wednesday"], ["thu", "Thursday"], ["fri", "Friday"], ["sat", "Saturday"], ["sun", "Sunday"]] as const;
type Day = (typeof DAYS)[number][0];
type Hours = Record<Day, { open: string; close: string } | null>;
interface Bakery { id: string; name?: string; about?: string; area?: string; phone?: string; addressLabel?: string; location?: { lat: number; lng: number }; hours?: Partial<Hours>; offersDelivery?: boolean; offersPickup?: boolean; payoutPhone?: string; logo?: string; cover?: string; status: string }
interface State { id: string; bakery: Bakery; missing: { key: string; label: string }[] }
const STEPS = ["Your bakery", "Location", "Opening hours", "Delivery & payouts", "Photos", "Products", "Publish"];
const input = "mt-1 w-full rounded-xl border border-line bg-white p-3";
const CATS = ["Cakes", "Cupcakes", "Cookies", "Bread", "Croissants", "Doughnuts", "Pastries", "Tarts", "Desserts", "Breakfast", "Custom Cakes"];

function Wizard() {
  const qc = useQueryClient(), nav = useNavigate(), [step, setStep] = useState(0), [err, setErr] = useState("");
  const q = useQuery({ queryKey: ["onboarding"], retry: false, queryFn: () => api<State>("/business/bakery").catch(() => null) });
  const refresh = async () => { await Promise.all([qc.invalidateQueries({ queryKey: ["onboarding"] }), qc.invalidateQueries({ queryKey: ["me"] })]); };
  const run = async (fn: () => Promise<unknown>, next = true) => { setErr(""); try { await fn(); await refresh(); if (next) setStep((s) => s + 1); } catch (e) { setErr((e as Error).message); } };
  const save = (patch: object) => run(() => api("/business/bakery", { method: "PATCH", body: patch }));
  if (q.isLoading) return <div className="mx-auto mt-10 h-40 max-w-xl animate-pulse rounded-3xl bg-peach/60" />;
  const s = q.data, b = s?.bakery;
  if (b && b.status !== "draft") return <div className="mx-auto max-w-md p-10 text-center"><div className="text-6xl">🎉</div><p className="my-3 text-lg">{b.status === "active" ? "Your bakery is live on Crumbly." : "Your bakery is waiting for approval."}</p><Link to="/business" className="font-bold underline">Go to your dashboard</Link></div>;

  const renderBody = (): ReactNode => {
    if (step === 0) return <InfoStep b={b} onNext={(v) => (b ? save(v) : run(() => api("/bakeries", { method: "POST", body: { name: v.name, area: v.area } }).then(() => api("/business/bakery", { method: "PATCH", body: { about: v.about, phone: v.phone } }))))} />;
    if (!b) return <p>Start with your bakery's details first.</p>;
    if (step === 1) return <LocationStep b={b} onNext={(address) => save({ address })} />;
    if (step === 2) return <HoursStep b={b} onNext={(hours) => save({ hours })} />;
    if (step === 3) return <FulfilStep b={b} onNext={(v) => save(v)} />;
    if (step === 4) return <PhotosStep b={b} onNext={(v) => save(v)} setErr={setErr} />;
    if (step === 5) return <ProductsStep onNext={() => setStep(6)} refresh={refresh} />;
    return (<div className="grid gap-3"><h2 className="font-display text-3xl font-extrabold">Ready to publish?</h2>
      {s!.missing.length ? <><p>Still needed:</p><ul className="list-disc pl-6">{s!.missing.map((m) => <li key={m.key}>{m.label}</li>)}</ul></> : <p>Everything looks good. Customers will be able to find and order from you.</p>}
      <button disabled={!!s!.missing.length} onClick={() => run(async () => { await api("/business/bakery/publish", { method: "POST" }); nav("/business"); }, false)} className="rounded-full bg-leaf py-3 text-lg font-bold text-white disabled:opacity-50">Publish my bakery</button></div>);
  };
  return (
    <div className="mx-auto grid max-w-2xl gap-5 px-4 py-8">
      <div><h1 className="font-display text-4xl font-extrabold">Open your bakery on Crumbly</h1>
        <ol className="mt-3 flex gap-1" aria-label="Progress">{STEPS.map((t, i) => <li key={t} aria-current={i === step ? "step" : undefined} className={`h-2 flex-1 rounded-full ${i <= step ? "bg-leaf" : "bg-line"}`} title={t} />)}</ol>
        <p className="mt-2 text-sm text-mute">Step {step + 1} of {STEPS.length}: {STEPS[step]}</p></div>
      <div className="grid gap-4 rounded-3xl bg-white p-5">{renderBody()}{err && <p role="alert" className="rounded-xl bg-peach p-3 text-sm">{err}</p>}</div>
      {step > 0 && <button onClick={() => setStep(step - 1)} className="w-fit font-bold underline">← Back</button>}
    </div>
  );
}

function InfoStep({ b, onNext }: { b?: Bakery; onNext: (v: { name: string; area: string; about: string; phone: string }) => void }) {
  const [v, setV] = useState({ name: b?.name ?? "", area: b?.area ?? "", about: b?.about ?? "", phone: b?.phone ?? "" });
  return (<form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); onNext(v); }}>
    <label className="text-sm font-medium">Bakery name<input required minLength={2} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} className={input} /></label>
    <label className="text-sm font-medium">Area<input required value={v.area} placeholder="Westlands" onChange={(e) => setV({ ...v, area: e.target.value })} className={input} /></label>
    <label className="text-sm font-medium">Phone<input required inputMode="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} className={input} /></label>
    <label className="text-sm font-medium">About your bakery<textarea required minLength={20} maxLength={600} rows={3} value={v.about} onChange={(e) => setV({ ...v, about: e.target.value })} placeholder="What you bake, what makes it special…" className={input} /></label>
    <button className="rounded-full bg-ink py-3 font-bold text-cream">Continue</button></form>);
}
function LocationStep({ b, onNext }: { b: Bakery; onNext: (p: Place) => void }) {
  const [p, setP] = useState<Place | null>(b.location && b.addressLabel ? { label: b.addressLabel, ...b.location } : null);
  return (<div className="grid gap-3"><AddressPicker value={p} onPick={setP} /><p className="text-sm text-mute">This is where customers collect pickups and where delivery distance is measured from.</p>
    <button disabled={!p} onClick={() => onNext(p!)} className="rounded-full bg-ink py-3 font-bold text-cream disabled:opacity-50">Continue</button></div>);
}
function HoursStep({ b, onNext }: { b: Bakery; onNext: (h: Hours) => void }) {
  const [h, setH] = useState<Hours>(() => Object.fromEntries(DAYS.map(([d]) => [d, b.hours?.[d] ?? (b.hours ? null : d === "sun" ? null : { open: "08:00", close: "18:00" })])) as Hours);
  return (<div className="grid gap-2">{DAYS.map(([d, label]) => (
    <div key={d} className="flex flex-wrap items-center gap-2"><label className="flex w-32 items-center gap-2 font-medium"><input type="checkbox" checked={!!h[d]} onChange={(e) => setH({ ...h, [d]: e.target.checked ? { open: "08:00", close: "18:00" } : null })} />{label}</label>
      {h[d] ? <><input type="time" aria-label={`${label} opens`} value={h[d]!.open} onChange={(e) => setH({ ...h, [d]: { ...h[d]!, open: e.target.value } })} className="rounded-xl border border-line p-2" /><span>to</span><input type="time" aria-label={`${label} closes`} value={h[d]!.close} onChange={(e) => setH({ ...h, [d]: { ...h[d]!, close: e.target.value } })} className="rounded-xl border border-line p-2" /></> : <span className="text-mute">Closed</span>}</div>))}
    <button onClick={() => onNext(h)} className="mt-2 rounded-full bg-ink py-3 font-bold text-cream">Continue</button></div>);
}
function FulfilStep({ b, onNext }: { b: Bakery; onNext: (v: { offersDelivery: boolean; offersPickup: boolean; payoutPhone: string }) => void }) {
  const [v, setV] = useState({ offersDelivery: b.offersDelivery ?? false, offersPickup: b.offersPickup ?? true, payoutPhone: "" });
  return (<form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); onNext({ ...v, payoutPhone: v.payoutPhone || b.payoutPhone || "" }); }}>
    <label className="flex items-center gap-2 font-medium"><input type="checkbox" checked={v.offersPickup} onChange={(e) => setV({ ...v, offersPickup: e.target.checked })} />Customers can pick up</label>
    <label className="flex items-center gap-2 font-medium"><input type="checkbox" checked={v.offersDelivery} onChange={(e) => setV({ ...v, offersDelivery: e.target.checked })} />I deliver (up to 15 km, priced by distance)</label>
    <label className="text-sm font-medium">M-Pesa number for payouts<input required={!b.payoutPhone} inputMode="tel" placeholder={b.payoutPhone ? "Saved. Enter a new number to change it" : "0712 345 678"} value={v.payoutPhone} onChange={(e) => setV({ ...v, payoutPhone: e.target.value })} className={input} /></label>
    <button disabled={!v.offersDelivery && !v.offersPickup} className="rounded-full bg-ink py-3 font-bold text-cream disabled:opacity-50">Continue</button></form>);
}
function PhotosStep({ b, onNext, setErr }: { b: Bakery; onNext: (v: { logo?: string; cover?: string }) => void; setErr: (s: string) => void }) {
  const [u, setU] = useState({ logo: b.logo, cover: b.cover }), [busy, setBusy] = useState(false);
  async function pick(k: "logo" | "cover", f?: File) { if (!f) return; setErr(""); setBusy(true); try { setU({ ...u, [k]: await uploadImage(`bakeries/${b.id}/${k}-${Date.now()}`, f) }); } catch (e) { setErr((e as Error).message); } setBusy(false); }
  return (<div className="grid gap-3">{(["logo", "cover"] as const).map((k) => (
    <div key={k} className="flex items-center gap-3">{u[k] ? <img src={u[k]} alt={`Your ${k}`} className={`object-cover ${k === "logo" ? "h-16 w-16 rounded-full" : "h-16 w-32 rounded-xl"}`} /> : <div className="grid h-16 w-16 place-items-center rounded-xl bg-peach">🖼️</div>}
      <label className="cursor-pointer rounded-full border border-line px-4 py-2 font-bold">{u[k] ? `Change ${k}` : `Upload ${k}`}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => pick(k, e.target.files?.[0])} /></label></div>))}
    <button disabled={busy || !u.logo || !u.cover} onClick={() => onNext(u)} className="rounded-full bg-ink py-3 font-bold text-cream disabled:opacity-50">{busy ? "Uploading…" : "Continue"}</button></div>);
}
function ProductsStep({ onNext, refresh }: { onNext: () => void; refresh: () => Promise<void> }) {
  const [f, setF] = useState({ name: "", category: "Cakes", price: "" }), [added, setAdded] = useState<string[]>([]);
  const add = useMutation({ mutationFn: () => api("/business/products", { method: "POST", body: { name: f.name, category: f.category, price: Number(f.price), status: "published" } }), onSuccess: async () => { setAdded((a) => [...a, f.name]); setF({ ...f, name: "", price: "" }); await refresh(); } });
  return (<div className="grid gap-3"><p>Add at least one product. You can add photos, details and more later in Products.</p>
    {added.map((n) => <p key={n} className="rounded-xl bg-cream p-2">✓ {n}</p>)}
    <form className="grid gap-2 sm:grid-cols-[1fr_auto_auto]" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
      <input required minLength={2} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} aria-label="Product name" placeholder="Product name" className="rounded-xl border border-line p-3" />
      <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} aria-label="Category" className="rounded-xl border border-line p-3">{CATS.map((c) => <option key={c}>{c}</option>)}</select>
      <input required type="number" min={1} value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} aria-label="Price in KSh" placeholder="KSh" className="rounded-xl border border-line p-3 sm:w-28" />
      <button disabled={add.isPending} className="rounded-full bg-leaf py-2.5 font-bold text-white sm:col-span-3">Add product</button></form>
    {add.isError && <p role="alert" className="text-sm text-coral">{(add.error as Error).message}</p>}
    <button disabled={!added.length} onClick={onNext} className="rounded-full bg-ink py-3 font-bold text-cream disabled:opacity-50">Continue</button></div>);
}
export default function Onboarding() { return <RequireAuth reason="Sign in to open your bakery on Crumbly."><Wizard /></RequireAuth>; }
