import { Router } from "express";
import { z } from "zod";
import { env } from "../env.js";
import { HttpError } from "../types.js";
import { quoteDelivery, type Quote } from "../delivery.js";

export const maps = Router();
const NAIROBI = { latitude: -1.2921, longitude: 36.8219 };
const key = () => { if (!env.GOOGLE_MAPS_SERVER_KEY) throw new HttpError(503, "Address search isn't set up yet."); return env.GOOGLE_MAPS_SERVER_KEY; };

// The Maps key never reaches the browser: autocomplete and place lookups are proxied here.
maps.get("/maps/autocomplete", async (req, res, next) => {
  try {
    const input = z.string().trim().min(3).max(120).parse(req.query.input);
    const r = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST", headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key() },
      body: JSON.stringify({ input, includedRegionCodes: ["ke"], locationBias: { circle: { center: NAIROBI, radius: 30000 } } }),
    });
    if (!r.ok) throw new HttpError(502, "Address search is unavailable right now.");
    const j = (await r.json()) as { suggestions?: { placePrediction?: { placeId: string; text: { text: string } } }[] };
    res.json({ ok: true, data: (j.suggestions ?? []).flatMap((s) => (s.placePrediction ? [{ placeId: s.placePrediction.placeId, label: s.placePrediction.text.text }] : [])).slice(0, 5) });
  } catch (e) { next(e); }
});
maps.get("/maps/place/:id", async (req, res, next) => {
  try {
    const id = z.string().regex(/^[\w-]{10,200}$/).parse(req.params.id);
    const r = await fetch(`https://places.googleapis.com/v1/places/${id}`, { headers: { "X-Goog-Api-Key": key(), "X-Goog-FieldMask": "location,formattedAddress" } });
    const j = (await r.json()) as { location?: { latitude: number; longitude: number }; formattedAddress?: string };
    if (!r.ok || !j.location) throw new HttpError(404, "We couldn't find that address.");
    res.json({ ok: true, data: { label: j.formattedAddress ?? "", lat: j.location.latitude, lng: j.location.longitude } });
  } catch (e) { next(e); }
});
maps.post("/delivery/quotes", async (req, res, next) => {
  try {
    const b = z.object({ bakeryIds: z.array(z.string().min(1)).min(1).max(10), lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).parse(req.body);
    const out: Record<string, Quote> = {};
    await Promise.all(b.bakeryIds.map(async (id) => { out[id] = await quoteDelivery(id, { lat: b.lat, lng: b.lng }); }));
    res.json({ ok: true, data: out });
  } catch (e) { next(e); }
});
