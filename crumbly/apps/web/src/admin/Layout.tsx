import { NavLink, Outlet } from "react-router-dom";
import RequireAuth from "../pages/RequireAuth";
import { useMe } from "../lib/useMe";
import { useSeo } from "../lib/seo";

const LINKS = [["/admin", "Overview"], ["/admin/bakeries", "Bakeries"], ["/admin/orders", "Orders"], ["/admin/reports", "Reports"], ["/admin/users", "Users"]] as const;
function Shell() {
  useSeo({ title: "Admin | Crumbly", noindex: true });
  const me = useMe();
  if (me.isLoading) return <div className="mx-auto mt-10 h-40 max-w-xl animate-pulse rounded-3xl bg-peach/60" />;
  if (me.data?.role !== "ADMIN") return <p className="p-10 text-center">You don't have access to this area.</p>;
  return (
    <div className="mx-auto max-w-6xl px-4 py-6"><nav aria-label="Admin" className="mb-5 flex gap-2 overflow-x-auto">{LINKS.map(([to, t]) => <NavLink key={to} to={to} end={to === "/admin"} className={({ isActive }) => `shrink-0 rounded-full px-4 py-2 font-bold ${isActive ? "bg-ink text-cream" : "bg-white"}`}>{t}</NavLink>)}</nav><Outlet /></div>
  );
}
export default function AdminLayout() { return <RequireAuth reason="Sign in with your admin account."><Shell /></RequireAuth>; }
