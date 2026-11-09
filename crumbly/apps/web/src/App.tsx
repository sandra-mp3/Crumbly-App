import { lazy, Suspense, useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { Nav } from "./components/Nav";
import { CrumblyBot } from "./components/CrumblyBot";
import Home from "./pages/Home";
const BakeryPage = lazy(() => import("./pages/Bakery")), ProductPage = lazy(() => import("./pages/Product")), Checkout = lazy(() => import("./pages/Checkout"));
const OrdersPage = lazy(() => import("./pages/Orders").then((m) => ({ default: m.OrdersPage }))), OrderDetail = lazy(() => import("./pages/Orders").then((m) => ({ default: m.OrderDetail })));

const Favs = lazy(() => import("./pages/Favorites")), Cake = lazy(() => import("./pages/CustomCake")), CakeReqs = lazy(() => import("./pages/CustomRequests")), BizCustom = lazy(() => import("./business/CustomOrders"));
const Onboard = lazy(() => import("./business/Onboarding"));
const AdminL = lazy(() => import("./admin/Layout")), AdminO = lazy(() => import("./admin/Overview")), AdminB = lazy(() => import("./admin/Bakeries")), AdminOrd = lazy(() => import("./admin/Lists").then((m) => ({ default: m.AdminOrders }))), AdminUs = lazy(() => import("./admin/Lists").then((m) => ({ default: m.AdminUsers }))), AdminRep = lazy(() => import("./admin/Lists").then((m) => ({ default: m.AdminReports })));
const Cal = lazy(() => import("./business/Calendar")), Cust = lazy(() => import("./business/Customers")), TeamP = lazy(() => import("./business/Staff")), Join = lazy(() => import("./pages/Join"));
const Promos = lazy(() => import("./business/Promotions")), Fin = lazy(() => import("./business/Finances"));
const Notif = lazy(() => import("./pages/Notifications")), AccountP = lazy(() => import("./pages/Account"));
const Biz = lazy(() => import("./business/Layout")), Dash = lazy(() => import("./business/Dashboard")), Board = lazy(() => import("./business/OrderBoard")), Prods = lazy(() => import("./business/Products")), Inv = lazy(() => import("./business/Inventory")), Ana = lazy(() => import("./business/Analytics"));

export default function App() {
  const [bot, setBot] = useState(false);
  useEffect(() => { const o = () => setBot(true); addEventListener("crumbly:bot", o); return () => removeEventListener("crumbly:bot", o); }, []);
  return (
    <>
      <Nav openBot={() => setBot(true)} />
      <main><Suspense fallback={<div className="mx-auto mt-10 h-40 max-w-xl animate-pulse rounded-3xl bg-peach/60" />}>
        <Routes><Route path="/" element={<Home />} /><Route path="/explore" element={<Home />} /><Route path="/bakeries/:slug" element={<BakeryPage />} /><Route path="/products/:slug" element={<ProductPage />} />
          <Route path="/checkout" element={<Checkout />} /><Route path="/cart" element={<Checkout />} /><Route path="/orders" element={<OrdersPage />} /><Route path="/orders/:id" element={<OrderDetail />} />
          <Route path="/join/:token" element={<Join />} /><Route path="/notifications" element={<Notif />} /><Route path="/account" element={<AccountP />} /><Route path="/favorites" element={<Favs />} /><Route path="/custom-cake" element={<Cake />} /><Route path="/custom-cake/requests" element={<CakeReqs />} />
          <Route path="/business/onboarding" element={<Onboard />} />
          <Route path="/business" element={<Biz />}><Route index element={<Dash />} /><Route path="orders" element={<Board />} /><Route path="products" element={<Prods />} /><Route path="custom-orders" element={<BizCustom />} /><Route path="calendar" element={<Cal />} /><Route path="customers" element={<Cust />} /><Route path="promotions" element={<Promos />} /><Route path="finances" element={<Fin />} /><Route path="staff" element={<TeamP />} /><Route path="inventory" element={<Inv />} /><Route path="analytics" element={<Ana />} /></Route>
          <Route path="/admin" element={<AdminL />}><Route index element={<AdminO />} /><Route path="bakeries" element={<AdminB />} /><Route path="orders" element={<AdminOrd />} /><Route path="users" element={<AdminUs />} /><Route path="reports" element={<AdminRep />} /></Route>
          <Route path="*" element={<p className="p-10 text-center">That page isn't on the menu.</p>} /></Routes></Suspense></main>
      <button onClick={() => setBot(true)} className="fixed bottom-24 right-4 z-20 rounded-full bg-leaf px-5 py-3 font-bold text-white shadow-lg md:bottom-6 md:hidden">🧁</button>
      <CrumblyBot open={bot} onClose={() => setBot(false)} />
    </>
  );
}
