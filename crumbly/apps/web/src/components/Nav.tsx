import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useCart } from "../cart/CartProvider";
import { isBaker, useMe } from "../lib/useMe";
import { useNotifications } from "../pages/Notifications";

export function Nav({ openBot }: { openBot: () => void }) {
  const { user, requireAuth } = useAuth(), { count } = useCart(), me = useMe(), notifs = useNotifications(!!user), unread = notifs.data?.unread ?? 0;
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-cream/95 backdrop-blur" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-5 px-4">
          <Link to="/" className="font-display text-2xl font-extrabold text-coral">crumbly</Link>
          <nav className="hidden flex-1 gap-5 font-medium md:flex">
            <NavLink to="/">Explore</NavLink><NavLink to="/?cat=Cakes">Cakes</NavLink><NavLink to="/custom-cake">Custom Cakes</NavLink><NavLink to="/favorites">Favourites</NavLink><NavLink to="/orders">Orders</NavLink>{me.data?.role === "ADMIN" && <NavLink to="/admin" className="font-bold text-coral">Admin</NavLink>}{isBaker(me.data) ? <NavLink to="/business" className="font-bold text-leaf">My bakery</NavLink> : <NavLink to="/business/onboarding" className="font-bold text-leaf">Sell on Crumbly</NavLink>}
          </nav>
          <div className="flex-1 md:hidden" />
          <button onClick={openBot} className="hidden rounded-full bg-leaf px-4 py-2 font-bold text-white md:block">🧁 Crumbly Bot</button>
          <Link to="/checkout" className="relative rounded-full border border-line bg-white px-4 py-2 font-bold">🛒<span className="sr-only">Cart</span>{count > 0 && <span key={count} className="absolute -right-1 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-berry text-xs text-white">{count}</span>}</Link>
          {user && <Link to="/notifications" className="relative rounded-full border border-line bg-white px-3 py-2" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>🔔{unread > 0 && <span className="absolute -right-1 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-coral text-xs text-white">{unread}</span>}</Link>}
          {user ? <Link to="/account" className="rounded-full bg-ink px-4 py-2 font-bold text-cream">Account</Link> : <button onClick={() => requireAuth("Sign in or create your Crumbly account.")} className="rounded-full bg-ink px-4 py-2 font-bold text-cream">Sign in</button>}
        </div>
      </header>
      <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-line bg-white py-2 text-xs md:hidden" style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}>
        <Link to="/" className="grid place-items-center">🏠Home</Link><Link to="/?focus=search" className="grid place-items-center">🔍Explore</Link><Link to="/orders" className="grid place-items-center">📦Orders</Link>
        <button onClick={openBot} className="grid place-items-center">🧁Crumbly Bot</button>{user ? <Link to="/account" className="grid place-items-center">👤Account</Link> : <button onClick={() => requireAuth("Sign in or create your Crumbly account.")} className="grid place-items-center">👤Sign in</button>}
      </nav>
    </>
  );
}
