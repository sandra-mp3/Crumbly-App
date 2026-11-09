import { db } from "./firebase.js";
import { env } from "./env.js";
import { HttpError } from "./types.js";
import { feeForKm, haversineKm, isDeliverable, type LatLng } from "./delivery-utils.js";

export interface Quote { distanceKm: number; minutes: number; fee: number; available: boolean }

/** Server-authoritative delivery quote. Uses Google Routes when a key is set, else straight-line distance. */
export async function quoteDelivery(bakeryId: string, to: LatLng): Promise<Quote> {
  const bk = (await db.collection("bakeries").doc(bakeryId).get()).data(), loc = bk?.location as LatLng | undefined;
  if (!loc) throw new HttpError(409, "This bakery hasn't set its location yet.");
  if (bk?.offersDelivery === false) return { distanceKm: 0, minutes: 0, fee: 0, available: false };
  let km = haversineKm(loc, to) * 1.3, minutes = Math.round(km * 3.5 + 10); // rough road factor for the fallback
  if (env.GOOGLE_MAPS_SERVER_KEY) {
    try {
      const r = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": env.GOOGLE_MAPS_SERVER_KEY, "X-Goog-FieldMask": "routes.distanceMeters,routes.duration" },
        body: JSON.stringify({ origin: { location: { latLng: { latitude: loc.lat, longitude: loc.lng } } }, destination: { location: { latLng: { latitude: to.lat, longitude: to.lng } } }, travelMode: "DRIVE", routingPreference: "TRAFFIC_AWARE" }),
      });
      const route = ((await r.json()) as { routes?: { distanceMeters?: number; duration?: string }[] }).routes?.[0];
      if (r.ok && route?.distanceMeters) { km = route.distanceMeters / 1000; minutes = Math.round(parseInt(route.duration ?? "0", 10) / 60) + 10; }
    } catch { /* keep the fallback estimate */ }
  }
  return { distanceKm: Math.round(km * 10) / 10, minutes, fee: feeForKm(km), available: isDeliverable(km) };
}
