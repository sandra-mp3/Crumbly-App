import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import { useCart } from "../cart/CartProvider";
import { Reviews } from "../components/Reviews";
import { useSeo } from "../lib/seo";
import { ShareButton } from "../components/ShareButton";
import { EMOJI, ksh, type Product } from "../types";

export default function ProductPage() {
  const { slug } = useParams(), { requireAuth } = useAuth(), { add } = useCart();
  const q = useQuery({ queryKey: ["product", slug], queryFn: () => api<Product>(`/products/${slug}`) });
  const d = q.data;
  useSeo(d ? { title: `${d.name} from ${d.bakeryName} | Crumbly`, description: `${d.category}, ${ksh(d.price)}. Order fresh from a local bakery and pay with M-Pesa.`, image: d.image, path: `/products/${d.slug}`,
    jsonLd: { "@context": "https://schema.org", "@type": "Product", name: d.name, image: d.image, description: `${d.category} from ${d.bakeryName}`, brand: { "@type": "Organization", name: d.bakeryName },
      offers: { "@type": "Offer", price: d.price, priceCurrency: "KES", availability: "https://schema.org/InStock", url: `${location.origin}/products/${d.slug}` },
      ...(d.ratingCount ? { aggregateRating: { "@type": "AggregateRating", ratingValue: d.rating, reviewCount: d.ratingCount } } : {}) } } : { title: "Crumbly" });
  if (q.isError) return <p role="alert" className="mx-auto max-w-xl p-10 text-center">That product isn't available right now. <Link to="/" className="font-bold underline">Back to pastries</Link></p>;
  const p = q.data;
  return (
    <>
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 md:grid-cols-2">
      <div className="grid h-72 place-items-center overflow-hidden rounded-[2rem] bg-peach text-9xl md:h-96">{p?.image ? <img src={p.image} alt={p.name} className="h-full w-full object-cover" /> : p ? EMOJI[p.category] ?? "🥐" : ""}</div>
      <div className="grid content-start gap-3">
        <h1 className="font-display text-5xl font-extrabold leading-none">{p?.name ?? "…"}</h1>
        {p && <><Link to="/" className="text-mute underline">{p.bakeryName}</Link><p>⭐ {p.rating.toFixed(1)} · {p.prepMinutes} min preparation</p>{p.dietary.map((d) => <span key={d} className="w-fit rounded-full bg-peach px-3 py-1 text-sm font-bold">{d}</span>)}
          <p className="font-display text-4xl font-extrabold">{ksh(p.price)}</p>
          <button onClick={() => requireAuth("Sign in to add this to your cart. We'll add it for you right after.", () => add(p))} className="rounded-full bg-leaf py-3 text-lg font-bold text-white">Add to cart</button><ShareButton path={`/products/${p.slug}`} title={p.name} /></>}
      </div>
    </div>
      {p && <Reviews productId={p.id} />}
    </>
  );
}
