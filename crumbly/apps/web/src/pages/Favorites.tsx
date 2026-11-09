import { Link } from "react-router-dom";
import { ProductCard, Skeletons } from "../components/ProductCard";
import { useFavorites } from "../lib/useFavorites";
import RequireAuth from "./RequireAuth";

function Inner() {
  const f = useFavorites();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8"><h1 className="mb-4 font-display text-4xl font-extrabold">Favourites</h1>
      {f.loading ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Skeletons n={3} /></div> : !f.list?.length ? <div className="p-10 text-center"><div className="text-6xl">🤍</div><p className="my-3 text-lg">No favourites yet. Tap the heart on anything you love.</p><Link to="/" className="font-bold underline">Find something delicious</Link></div>
        : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{f.list.map((p) => <ProductCard key={p.id} p={p} />)}</div>}</div>
  );
}
export default function Favorites() { return <RequireAuth reason="Sign in to see your favourites."><Inner /></RequireAuth>; }
