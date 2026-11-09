// Dev only. Usage: npm run seed  (needs .env loaded, e.g. `node --env-file=../../.env --import tsx scripts/seed.ts`)
import { auth, db } from "../src/firebase.js";

if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed demo accounts in production.");
const DEMO_PASSWORD = "CrumblyDemo#2026"; // dev seed only; never use in production
const bakeries = [
  { id: "sweet-crumbs", name: "Sweet Crumbs Bakery", area: "Westlands", rating: 4.9, lat: -1.2676, lng: 36.8108 },
  { id: "honey-and-dough", name: "Honey & Dough", area: "Kilimani", rating: 4.7, lat: -1.2921, lng: 36.7872 },
  { id: "the-pink-oven", name: "The Pink Oven", area: "Lavington", rating: 4.8, lat: -1.2833, lng: 36.7667 },
  { id: "nairobi-bake-house", name: "Nairobi Bake House", area: "Karen", rating: 4.6, lat: -1.3197, lng: 36.7085 },
  { id: "butter-and-bloom", name: "Butter & Bloom", area: "Westlands", rating: 4.8, lat: -1.2650, lng: 36.8030 },
  { id: "sunrise-bakes", name: "Sunrise Bakes", area: "Kilimani", rating: 4.5, lat: -1.2890, lng: 36.7900 },
];
const products: [string, string, string, number, string, string[], number][] = [
  ["Strawberry Celebration Cake", "sweet-crumbs", "Cakes", 3200, "strawberry birthday pink", [], 240],
  ["Chocolate Fudge Cake", "the-pink-oven", "Cakes", 2800, "chocolate birthday", [], 240],
  ["Pistachio Croissant", "nairobi-bake-house", "Croissants", 450, "pistachio breakfast", [], 30],
  ["Salted Caramel Cupcake", "butter-and-bloom", "Cupcakes", 350, "caramel sweet", [], 60],
  ["Cinnamon Roll", "honey-and-dough", "Breakfast", 380, "cinnamon breakfast", ["vegan"], 45],
  ["Red Velvet Cupcake", "sweet-crumbs", "Cupcakes", 320, "red velvet", [], 60],
  ["Mango Passion Tart", "sunrise-bakes", "Tarts", 520, "mango fruit", ["vegan"], 90],
  ["Chocolate Chip Cookie Box", "butter-and-bloom", "Cookies", 900, "cookies gift", [], 60],
  ["Mini Doughnut Box", "the-pink-oven", "Doughnuts", 750, "doughnut", [], 60],
];
const slug = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function demoUser(email: string, name: string, role: string, bakeryId?: string) {
  const u = await auth.getUserByEmail(email).catch(() => auth.createUser({ email, password: DEMO_PASSWORD, displayName: name }));
  await auth.setCustomUserClaims(u.uid, { role });
  if (bakeryId) await db.collection("bakeryMembers").doc(`${u.uid}_${bakeryId}`).set({ uid: u.uid, bakeryId, role, active: true });
  return u.uid;
}

const bakeryName = new Map(bakeries.map((b) => [b.id, b.name]));
for (const b of bakeries) await db.collection("bakeries").doc(b.id).set({ slug: b.id, name: b.name, area: b.area, rating: b.rating, location: { lat: b.lat, lng: b.lng }, status: "active", deliveryMinutes: 25 + Math.round(b.rating * 0) });
for (const [name, bakeryId, category, price, keywords, dietary, prepMinutes] of products)
  await db.collection("products").doc(slug(name)).set({ slug: slug(name), name, bakeryId, bakeryName: bakeryName.get(bakeryId), category, price, keywords, dietary, prepMinutes, rating: 4.5 + Math.random() * 0.5, status: "published" });
const stock: [string, string, number, number][] = [["Flour", "kg", 40, 25], ["Sugar", "kg", 12, 15], ["Butter", "kg", 6, 8], ["Eggs", "tray", 20, 10], ["Chocolate", "kg", 4, 5]];
for (const [name, unit, quantity, minQuantity] of stock) await db.collection("bakeries").doc("sweet-crumbs").collection("inventory").doc(slug(name)).set({ name, unit, quantity, minQuantity });

// 60 days of paid demo orders for Sweet Crumbs so analytics and Crumbly Bot have real data to work with
const sc = products.filter((p) => p[1] === "sweet-crumbs");
for (let i = 0; i < 120; i++) {
  const [name, , , price] = sc[i % sc.length]!, qty = 1 + (i % 3);
  await db.collection("orders").doc(`seed-${i}`).set({ customerId: "seed-customer", bakeryId: "sweet-crumbs", items: [{ productId: slug(name), name, qty, unitPrice: price, lineTotal: price * qty }],
    fulfilment: "PICKUP", subtotal: price * qty, deliveryFee: 0, total: price * qty, status: "DELIVERED", paymentStatus: "success", createdAt: new Date(Date.now() - (i % 60) * 864e5 - i * 36e5) });
}
await demoUser("customer@demo.crumbly.test", "Demo Customer", "CUSTOMER");
await demoUser("owner@demo.crumbly.test", "Demo Owner", "BAKER_OWNER", "sweet-crumbs");
await demoUser("manager@demo.crumbly.test", "Demo Manager", "BAKER_MANAGER", "sweet-crumbs");
await demoUser("staff@demo.crumbly.test", "Demo Staff", "BAKER_STAFF", "sweet-crumbs");
await demoUser("admin@demo.crumbly.test", "Demo Admin", "ADMIN");
console.log("Seeded. Demo logins: *@demo.crumbly.test /", DEMO_PASSWORD);
