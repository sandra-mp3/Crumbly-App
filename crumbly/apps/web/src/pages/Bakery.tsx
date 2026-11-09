import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { ProductCard, Skeletons } from "../components/ProductCard";
import type { Bakery, Product } from "../types";

import { useSeo } from "../lib/seo";
import { ShareButton } from "../components/ShareButton";

export default function BakeryPage() {
  const { slug } = useParams();
  const b = useQuery({ queryKey: ["bakery", slug], queryFn: () => api<Bakery>(`/bakeries/${slug}`) });
  const p = useQuery({ queryKey: ["bakery-products", b.data?.id], enabled: !!b.data, queryFn: () => api<Product[]>(`/products?bakeryId=${b.data!.id}&limit=50`) });
  const x = b.data;
  useSeo(x ? { title: `${x.name} in ${x.area} | Crumbly`, description: `Order fresh bakes from ${x.name} in ${x.area}. Pay with M-Pesa.`, path: `/bakeries/${x.slug}`,
    jsonLd: { "@context": "https://schema.org", "@type": "Bakery", name: x.name, address: { "@type": "PostalAddress", addressLocality: x.area, addressCountry: "KE" }, ...(x.location ? { geo: { "@type": "GeoCoordinates", latitude: x.location.lat, longitude: x.location.lng } } : {}) } } : { title: "Crumbly" });
  if (b.isError) return <p role="alert" className="mx-auto max-w-xl p-10 text-center">We couldn't find that bakery. It may be unavailable right now.</p>;
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="rounded-[2rem] bg-peach p-8"><h1 className="font-display text-5xl font-extrabold">{b.data?.name ?? "…"}</h1><p className="mt-2 text-mute">{b.data && `⭐ ${b.data.rating} · ${b.data.area} · about ${b.data.deliveryMinutes} min delivery`}</p>{b.data?.location && <a className="mt-3 inline-block rounded-full bg-white px-4 py-2 font-bold" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${b.data.location.lat},${b.data.location.lng}`}>📍 Open in Google Maps</a>}{x && <div className="mt-3"><ShareButton path={`/bakeries/${x.slug}`} title={x.name} /></div>}</div>
      <h2 className="mb-4 mt-8 font-display text-3xl font-extrabold">Menu</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{p.isLoading ? <Skeletons n={4} /> : p.data?.map((x) => <ProductCard key={x.id} p={x} />)}</div>
    </div>
  );
}
