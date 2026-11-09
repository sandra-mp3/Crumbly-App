import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useCart } from "../cart/CartProvider";
import { useFavorites } from "../lib/useFavorites";
import { EMOJI, ksh, type Product } from "../types";

export function ProductCard({ p }: { p: Product }) {
  const { requireAuth } = useAuth(), { add } = useCart(), fav = useFavorites(), saved = fav.has(p.id);
  return (
    <article className="flex flex-col overflow-hidden rounded-3xl border border-line bg-white transition hover:-translate-y-1 hover:shadow-lg">
      <Link to={`/products/${p.slug}`} className="grid h-36 place-items-center overflow-hidden bg-peach text-7xl" aria-label={p.name}>{p.image ? <img src={p.image} alt={p.name} loading="lazy" className="h-full w-full object-cover" /> : EMOJI[p.category] ?? "🥐"}</Link>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <div className="flex items-start justify-between gap-2"><Link to={`/products/${p.slug}`} className="font-display text-lg font-bold leading-tight">{p.name}</Link><button onClick={() => fav.toggle(p.id)} aria-pressed={saved} aria-label={saved ? `Remove ${p.name} from favourites` : `Save ${p.name} to favourites`} className="text-xl">{saved ? "💖" : "🤍"}</button></div>
        <p className="text-sm text-mute">{p.bakeryName}</p>
        <p className="text-sm text-mute">⭐ {p.rating.toFixed(1)} · {p.prepMinutes} min prep</p>
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="font-display text-xl font-extrabold">{ksh(p.price)}</span>
          <button onClick={() => requireAuth("Sign in to add this to your cart. We'll add it for you right after.", () => add(p))} className="rounded-full bg-leaf px-4 py-2 font-bold text-white">Add to cart</button>
        </div>
      </div>
    </article>
  );
}
export const Skeletons = ({ n = 6 }: { n?: number }) => <>{Array.from({ length: n }, (_, i) => <div key={i} className="h-72 animate-pulse rounded-3xl bg-peach/60" />)}</>;
