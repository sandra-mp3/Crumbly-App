import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { ProductCard, Skeletons } from "../components/ProductCard";
import type { Bakery, Product } from "../types";

const CATS = ["Cakes", "Cupcakes", "Cookies", "Bread", "Croissants", "Doughnuts", "Pastries", "Tarts", "Desserts", "Breakfast", "Custom Cakes"];

import { useSeo } from "../lib/seo";

export default function Home() {
  useSeo({ title: "Crumbly – Freshly baked. Made for you.", description: "Discover local bakeries and order cakes, croissants, cookies and custom cakes. Pay with M-Pesa." });
  const [sp, setSp] = useSearchParams(), cat = sp.get("cat") ?? "", [q, setQ] = useState(sp.get("q") ?? ""), [vegan, setVegan] = useState(false), [u1k, setU1k] = useState(false);
  const bakeries = useQuery({ queryKey: ["bakeries"], queryFn: () => api<Bakery[]>("/bakeries?limit=12") });
  const products = useQuery({ queryKey: ["products", cat, vegan, u1k], queryFn: () => api<Product[]>(`/products?limit=50${cat ? `&category=${encodeURIComponent(cat)}` : ""}${vegan ? "&diet=vegan" : ""}${u1k ? "&maxPrice=999" : ""}`) });
  const shown = useMemo(() => { const t = q.trim().toLowerCase(); return (products.data ?? []).filter((p) => !t || `${p.name} ${p.category} ${p.bakeryName}`.toLowerCase().includes(t)); }, [products.data, q]);
  const toggle = (on: boolean, set: (v: boolean) => void) => ({ "aria-pressed": on, onClick: () => set(!on), className: `rounded-full px-4 py-2 font-bold ${on ? "bg-ink text-cream" : "bg-white"}` });

  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="grid items-center gap-8 py-10 md:grid-cols-[1.15fr_.85fr] md:py-16">
        <div className="grid gap-5">
          <h1 className="font-display text-6xl font-extrabold leading-[.95] tracking-tight md:text-8xl">Freshly baked.<span className="block text-coral">Made for you.</span></h1>
          <p className="max-w-md text-lg text-mute">Discover local bakeries and order cakes, croissants and cookies. Pay with M-Pesa. No account needed to browse.</p>
          <div role="search" className="flex max-w-xl gap-2 rounded-3xl bg-white p-2 shadow-lg">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="What are you craving?" aria-label="Search pastries and bakeries" className="flex-1 rounded-2xl bg-transparent px-4 py-3" />
            <a href="#pastries" className="rounded-full bg-sun px-5 py-3 font-bold">Find something delicious</a>
          </div>
        </div>
        <div aria-hidden className="grid min-h-64 place-items-center rounded-[2.5rem] bg-sun text-9xl md:min-h-96">🥐</div>
      </section>

      <div className="flex gap-2 overflow-x-auto pb-2" role="group" aria-label="Categories">
        {["", ...CATS].map((c) => <button key={c} aria-pressed={cat === c} onClick={() => setSp(c ? { cat: c } : {})} className={`shrink-0 rounded-full px-4 py-2 font-bold ${cat === c ? "bg-ink text-cream" : "bg-white"}`}>{c || "All"}</button>)}
      </div>

      <section className="py-8">
        <h2 className="mb-4 font-display text-3xl font-extrabold">Bakeries near you</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {bakeries.isLoading ? <Skeletons n={6} /> : bakeries.data?.map((b) => (
            <Link key={b.id} to={`/bakeries/${b.slug}`} className="rounded-3xl border border-line bg-white p-4 transition hover:-translate-y-1 hover:shadow-lg">
              <div className="mb-2 grid h-16 place-items-center rounded-2xl bg-peach text-3xl">🧁</div><b className="font-display leading-tight">{b.name}{b.featured && " ⭐"}</b><p className="text-sm text-mute">⭐ {b.rating} · {b.area}</p>
            </Link>))}
        </div>
      </section>

      <section id="pastries" className="pb-16">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-3xl font-extrabold">{cat || "Popular pastries"}</h2>
          <div className="flex gap-2"><button {...toggle(vegan, setVegan)}>🌱 Vegan</button><button {...toggle(u1k, setU1k)}>Under KSh 1,000</button></div></div>
        {products.isError ? <p role="alert" className="rounded-3xl bg-white p-6">The oven needs a minute. We couldn't load pastries. <button className="font-bold underline" onClick={() => products.refetch()}>Try again</button></p>
          : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.isLoading ? <Skeletons /> : shown.length ? shown.map((p) => <ProductCard key={p.id} p={p} />) : <p className="col-span-full rounded-3xl bg-white p-8 text-center text-mute">🥣 No pastries match that yet. Try another word or clear the filters.</p>}
            </div>}
      </section>
    </div>
  );
}
