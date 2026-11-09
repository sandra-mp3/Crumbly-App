import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Product } from "../types";
interface Line { product: Product; qty: number }
interface Ctx { lines: Line[]; count: number; subtotal: number; add: (p: Product) => void; setQty: (id: string, q: number) => void; clear: () => void }
const C = createContext<Ctx>(null!);
export const useCart = () => useContext(C);
const KEY = "crumbly.cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<Line[]>(() => { try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; } });
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch { /* storage unavailable */ } }, [lines]);
  const add = (p: Product) => setLines((l) => (l.some((x) => x.product.id === p.id) ? l.map((x) => (x.product.id === p.id ? { ...x, qty: x.qty + 1 } : x)) : [...l, { product: p, qty: 1 }]));
  const setQty = (id: string, q: number) => setLines((l) => (q < 1 ? l.filter((x) => x.product.id !== id) : l.map((x) => (x.product.id === id ? { ...x, qty: Math.min(q, 50) } : x))));
  return <C.Provider value={{ lines, count: lines.reduce((a, l) => a + l.qty, 0), subtotal: lines.reduce((a, l) => a + l.qty * l.product.price, 0), add, setQty, clear: () => setLines([]) }}>{children}</C.Provider>;
}
