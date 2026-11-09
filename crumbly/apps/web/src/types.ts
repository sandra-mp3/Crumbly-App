export interface Bakery { id: string; slug: string; name: string; area: string; rating: number; deliveryMinutes: number; featured?: boolean; location?: { lat: number; lng: number } }
export interface Place { label: string; lat: number; lng: number }
export interface Quote { distanceKm: number; minutes: number; fee: number; available: boolean }
export interface Product { id: string; slug: string; name: string; bakeryId: string; bakeryName: string; category: string; price: number; rating: number; prepMinutes: number; dietary: string[]; image?: string; ratingCount?: number }
export type OrderStatus = "PENDING_PAYMENT" | "PAYMENT_CONFIRMED" | "ORDER_RECEIVED" | "CONFIRMED" | "PREPARING" | "BAKING" | "READY" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED";
export interface Order { id: string; bakeryId: string; items: { name: string; qty: number; lineTotal: number }[]; fulfilment: "PICKUP" | "DELIVERY"; total: number; deliveryFee: number; status: OrderStatus; paymentStatus: string; address: { label: string } | null }
export const EMOJI: Record<string, string> = { Cakes: "🎂", Cupcakes: "🧁", Cookies: "🍪", Bread: "🍞", Croissants: "🥐", Doughnuts: "🍩", Pastries: "🥧", Tarts: "🥭", Desserts: "🍮", Breakfast: "🌀", "Custom Cakes": "🎂" };
export const ksh = (n: number) => "KSh " + n.toLocaleString();
