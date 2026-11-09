import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { AddressPicker } from "../components/AddressPicker";
import { useAuth } from "../auth/AuthProvider";
import { api } from "../lib/api";
import { storage } from "../lib/firebase";
import type { Bakery, Place } from "../types";

const TYPES = ["Round", "Tiered", "Sheet", "Cupcake set"], FLAVOURS = ["Vanilla", "Chocolate", "Red velvet", "Strawberry", "Lemon", "Carrot", "Coffee", "Vanilla strawberry"], FROSTINGS = ["Buttercream", "Cream cheese", "Fondant", "Whipped cream", "Ganache"];
const sizeFor = (n: number) => (n <= 8 ? "6 inch" : n <= 15 ? "8 inch" : n <= 25 ? "10 inch or 2 tiers" : "Multi-tier or sheet");
const minDate = () => new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
const empty = { cakeType: "Round", servings: 12, flavour: "Vanilla", filling: "", frosting: "Buttercream", colours: "", theme: "", event: "", message: "", description: "" };
const field = "mt-1 w-full rounded-xl border border-line bg-white p-3";

export default function CustomCake() {
  const { user, requireAuth } = useAuth(), nav = useNavigate();
  const bakeries = useQuery({ queryKey: ["bakeries"], queryFn: () => api<Bakery[]>("/bakeries?limit=12") });
  const [bakeryId, setBakeryId] = useState(""), [s, setS] = useState(empty), [idea, setIdea] = useState(""), [date, setDate] = useState(minDate()), [mode, setMode] = useState<"PICKUP" | "DELIVERY">("PICKUP");
  const [place, setPlace] = useState<Place | null>(null), [images, setImages] = useState<string[]>([]), [err, setErr] = useState("");
  const set = <K extends keyof typeof empty>(k: K, v: (typeof empty)[K]) => setS((x) => ({ ...x, [k]: v }));

  const brief = useMutation({ mutationFn: () => api<Partial<typeof empty>>("/crumbly-bot/cake-brief", { method: "POST", body: { idea } }), onSuccess: (d) => setS((x) => ({ ...x, ...d })), onError: (e) => setErr((e as Error).message) });
  const submit = useMutation({
    mutationFn: () => api<{ id: string }>("/custom-orders", { method: "POST", body: { bakeryId, spec: { ...s, servings: Number(s.servings) }, fulfilment: mode, address: mode === "DELIVERY" ? place : undefined, neededBy: date, images } }),
    onSuccess: () => nav("/custom-cake/requests"), onError: (e) => setErr((e as Error).message),
  });
  async function addPhoto(f?: File) {
    setErr(""); if (!f || !user) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type) || f.size > 5 * 1024 * 1024) return setErr("Choose a JPG, PNG or WebP photo under 5 MB.");
    try { const r = ref(storage, `inspiration/${user.uid}/${Date.now()}`); await uploadBytes(r, f, { contentType: f.type }); const url = await getDownloadURL(r); setImages((x) => [...x, url].slice(0, 3)); } catch { setErr("The photo didn't upload. Please try again."); }
  }
  const ready = !!bakeryId && s.flavour.trim() && (mode === "PICKUP" || place);
  return (
    <div className="mx-auto grid max-w-3xl gap-5 px-4 py-8">
      <div><h1 className="font-display text-5xl font-extrabold">Custom cake</h1><p className="text-mute">Describe your dream cake and send it to a bakery. They'll reply with a price. <Link to="/custom-cake/requests" className="font-bold underline">Your requests</Link></p></div>
      <section className="grid gap-2 rounded-3xl bg-sun p-5"><label className="font-bold">Describe what you want<textarea value={idea} onChange={(e) => setIdea(e.target.value)} rows={3} maxLength={800} placeholder="A pink birthday cake for a 10-year-old girl who loves strawberries and doesn't like chocolate." className="mt-1 w-full rounded-xl border-0 bg-white p-3 font-normal" /></label>
        <button type="button" disabled={brief.isPending || idea.trim().length < 5} onClick={() => { setErr(""); brief.mutate(); }} className="w-fit rounded-full bg-ink px-5 py-2 font-bold text-cream disabled:opacity-50">{brief.isPending ? "Crumbly Bot is thinking…" : "🧁 Let Crumbly Bot fill this in"}</button></section>
      <form onSubmit={(e) => { e.preventDefault(); setErr(""); requireAuth("Sign in to send your cake request.", () => submit.mutate()); }} className="grid gap-4 rounded-3xl bg-cream">
        <label className="text-sm font-medium">Bakery<select required value={bakeryId} onChange={(e) => setBakeryId(e.target.value)} className={field}><option value="">Choose a bakery</option>{bakeries.data?.map((b) => <option key={b.id} value={b.id}>{b.name} · {b.area}</option>)}</select></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">Cake type<select value={s.cakeType} onChange={(e) => set("cakeType", e.target.value)} className={field}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label className="text-sm font-medium">Guests<input type="number" min={1} max={300} value={s.servings} onChange={(e) => set("servings", Number(e.target.value))} className={field} /><span className="text-xs text-mute">Suggested size: {sizeFor(Number(s.servings))}</span></label>
          <label className="text-sm font-medium">Flavour<input list="fl" value={s.flavour} onChange={(e) => set("flavour", e.target.value)} className={field} /><datalist id="fl">{FLAVOURS.map((f) => <option key={f} value={f} />)}</datalist></label>
          <label className="text-sm font-medium">Filling<input value={s.filling} onChange={(e) => set("filling", e.target.value)} placeholder="Strawberry jam, custard…" className={field} /></label>
          <label className="text-sm font-medium">Frosting<select value={s.frosting} onChange={(e) => set("frosting", e.target.value)} className={field}>{FROSTINGS.map((f) => <option key={f}>{f}</option>)}</select></label>
          <label className="text-sm font-medium">Colours<input value={s.colours} onChange={(e) => set("colours", e.target.value)} placeholder="Pink and cream" className={field} /></label>
          <label className="text-sm font-medium">Theme<input value={s.theme} onChange={(e) => set("theme", e.target.value)} placeholder="Strawberry Garden" className={field} /></label>
          <label className="text-sm font-medium">Event<input value={s.event} onChange={(e) => set("event", e.target.value)} placeholder="Birthday, baby shower…" className={field} /></label>
          <label className="text-sm font-medium sm:col-span-2">Message on the cake<input value={s.message} maxLength={60} onChange={(e) => set("message", e.target.value)} className={field} /></label>
          <label className="text-sm font-medium sm:col-span-2">Anything else the baker should know<textarea value={s.description} maxLength={800} onChange={(e) => set("description", e.target.value)} rows={3} className={field} /></label>
        </div>
        <div className="grid gap-2"><span className="text-sm font-medium">Inspiration photos (up to 3)</span>
          <div className="flex flex-wrap items-center gap-2">{images.map((u) => <img key={u} src={u} alt="Inspiration" className="h-16 w-16 rounded-xl object-cover" />)}
            {images.length < 3 && <label className="cursor-pointer rounded-full border border-line bg-white px-4 py-2 text-sm font-bold">Add photo<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => user ? addPhoto(e.target.files?.[0]) : requireAuth("Sign in to upload photos.")} /></label>}</div></div>
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">Needed by<input type="date" min={minDate()} required value={date} onChange={(e) => setDate(e.target.value)} className={field} /></label>
          <fieldset className="text-sm font-medium"><legend>Pickup or delivery</legend><div className="mt-1 flex gap-2">{(["PICKUP", "DELIVERY"] as const).map((m) => <button type="button" key={m} aria-pressed={mode === m} onClick={() => setMode(m)} className={`rounded-full px-4 py-2 font-bold ${mode === m ? "bg-ink text-cream" : "bg-white"}`}>{m === "PICKUP" ? "Pickup" : "Delivery"}</button>)}</div></fieldset></div>
        {mode === "DELIVERY" && <AddressPicker value={place} onPick={setPlace} />}
        {err && <p role="alert" className="rounded-xl bg-peach p-3 text-sm">{err}</p>}
        <button disabled={!ready || submit.isPending} className="rounded-full bg-leaf py-3 text-lg font-bold text-white disabled:opacity-50">{submit.isPending ? "Sending…" : "Send request to bakery"}</button>
      </form>
    </div>
  );
}
