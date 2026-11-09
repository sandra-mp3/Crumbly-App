import { describe, expect, it } from "vitest";
import { missingForPublish } from "../readiness.js";
const full = { name: "Test Bakes", about: "Fresh cakes and bread baked every morning.", area: "Westlands", phone: "0712345678", location: { lat: -1.2, lng: 36.8 }, hours: { mon: { open: "08:00", close: "18:00" } }, offersPickup: true, payoutPhone: "254712345678", logo: "l", cover: "c" };
describe("publish readiness", () => {
  it("passes a complete bakery", () => expect(missingForPublish(full, 1)).toEqual([]));
  it("lists what's missing", () => { const m = missingForPublish({ name: "X" }, 0).map((x) => x.key); expect(m).toEqual(expect.arrayContaining(["info", "location", "hours", "fulfilment", "payout", "images", "products"])); });
  it("needs a product", () => expect(missingForPublish(full, 0).map((x) => x.key)).toEqual(["products"]));
});
