import { Link, NavLink, Outlet } from "react-router-dom";
import RequireAuth from "../pages/RequireAuth";
import { isBaker, useMe } from "../lib/useMe";
import { useSeo } from "../lib/seo";

const LINKS = [["/business", "Dashboard", "📊"], ["/business/calendar", "Bake list", "📅"], ["/business/orders", "Orders", "🧾"], ["/business/products", "Products", "🥐"], ["/business/custom-orders", "Custom orders", "🎂"], ["/business/inventory", "Inventory", "📦"], ["/business/customers", "Customers", "👥"], ["/business/promotions", "Promotions", "🏷️"], ["/business/finances", "Finances", "💰"], ["/business/analytics", "Analytics", "📈"], ["/business/staff", "Team", "🧑‍🍳"]] as const;
const openBot = () => window.dispatchEvent(new Event("crumbly:bot"));

function Shell() {
  useSeo({ title: "My bakery | Crumbly", noindex: true });
  const me = useMe();
  if (me.isLoading) return <div className="mx-auto mt-10 h-40 max-w-xl animate-pulse rounded-3xl bg-peach/60" />;
  if (!isBaker(me.data)) return <div className="mx-auto max-w-md p-10 text-center"><div className="text-6xl">🏪</div><p className="my-3 text-lg">Want to sell on Crumbly? Set up your bakery in a few minutes.</p><Link to="/business/onboarding" className="rounded-full bg-leaf px-6 py-3 font-bold text-white">Open your bakery</Link></div>;
  const role = me.data?.role, STAFF_OK = ["/business/orders", "/business/calendar", "/business/custom-orders", "/business/inventory"], links: readonly (typeof LINKS)[number][] = role === "BAKER_STAFF" ? LINKS.filter(([to]) => STAFF_OK.includes(to)) : role === "BAKER_MANAGER" ? LINKS.filter(([to]) => to !== "/business/staff") : LINKS;
  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 md:grid-cols-[200px_1fr]">
      <nav aria-label="Business" className="hidden content-start gap-1 md:grid">
        {links.map(([to, t, e]) => <NavLink key={to} to={to} end={to === "/business"} className={({ isActive }) => `rounded-2xl px-4 py-2.5 font-bold ${isActive ? "bg-ink text-cream" : "hover:bg-white"}`}>{e} {t}</NavLink>)}
        <button onClick={openBot} className="mt-2 rounded-2xl bg-leaf px-4 py-2.5 text-left font-bold text-white">🧁 Crumbly Bot</button>
      </nav>
      <nav aria-label="Business" className="flex gap-2 overflow-x-auto md:hidden">{links.map(([to, t]) => <NavLink key={to} to={to} end={to === "/business"} className={({ isActive }) => `shrink-0 rounded-full px-4 py-2 font-bold ${isActive ? "bg-ink text-cream" : "bg-white"}`}>{t}</NavLink>)}</nav>
      <div className="min-w-0"><Outlet /></div>
    </div>
  );
}
export default function BusinessLayout() { return <RequireAuth reason="Sign in to manage your bakery."><Shell /></RequireAuth>; }
