export const MAX_DELIVERY_KM = 15;
export interface LatLng { lat: number; lng: number }
export function haversineKm(a: LatLng, b: LatLng): number {
  const r = (d: number) => (d * Math.PI) / 180, dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}
/** KSh 100 base + KSh 30/km, rounded to the nearest 10, never below 150. */
export const feeForKm = (km: number) => Math.max(150, Math.round((100 + 30 * km) / 10) * 10);
export const isDeliverable = (km: number) => km <= MAX_DELIVERY_KM;
