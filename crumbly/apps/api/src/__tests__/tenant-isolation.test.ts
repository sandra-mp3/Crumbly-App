import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeDb } from "./helpers/fakeDb.js";
import type { Actor } from "../types.js";

const fake = new FakeDb();
vi.mock("../firebase.js", () => ({ db: fake, auth: {} }));
vi.mock("../env.js", () => ({ env: {} }));
const script: ((a: { tools: { name: string }[]; messages: { role: string; result?: unknown }[] }) => unknown)[] = [], seen: { tools: { name: string }[]; messages: { role: string; result?: unknown }[] }[] = [];
vi.mock("../ai/index.js", () => ({ llm: { generate: async (a: never) => { seen.push(a); return script.shift()!(a); } } }));
const { tools } = await import("../ai/tools.js");
const { runAssistant } = await import("../ai/assistant.js");

const day = (n: number) => new Date(Date.now() - n * 864e5);
const A = "bakery-a", B = "bakery-b";
const owner: Actor = { uid: "ua", role: "BAKER_OWNER", bakeryId: A }, staff: Actor = { uid: "us", role: "BAKER_STAFF", bakeryId: A };
const customer: Actor = { uid: "uc", role: "CUSTOMER", bakeryId: null }, guest: Actor = { uid: null, role: "GUEST", bakeryId: null };
const tool = (name: string) => tools.find((t) => t.name === name)!;
const order = (id: string, bakeryId: string, total: number, ago: number, name: string) =>
  fake.put(`orders/${id}`, { bakeryId, total, paymentStatus: "success", createdAt: day(ago), items: [{ productId: name, name, qty: 1, lineTotal: total }] });

beforeEach(() => {
  fake.reset(); script.length = 0; seen.length = 0;
  order("a1", A, 1000, 1, "Red Velvet"); order("a2", A, 2000, 3, "Fudge Cake"); order("a-old", A, 500, 45, "Red Velvet");
  order("b1", B, 99999, 1, "SECRET-B-CAKE");
  fake.put(`bakeries/${A}/inventory/flour`, { name: "Flour", quantity: 2, minQuantity: 5, unit: "kg" });
  fake.put(`bakeries/${B}/inventory/secret`, { name: "SECRET-B-FLOUR", quantity: 0, minQuantity: 5, unit: "kg" });
  fake.put("products/p1", { name: "Public Cake", status: "published", price: 500, bakeryName: "A", slug: "public-cake" });
  fake.put("products/p2", { name: "Draft Cake", status: "draft", price: 400, bakeryName: "A", slug: "draft-cake" });
});

describe("analytics tools only ever read the actor's own bakery", () => {
  it("returns bakery A's numbers, never B's", async () => {
    const r = (await tool("getRevenue").run({}, owner)) as { current: { revenue: number; orders: number }; previous: { revenue: number } };
    expect(r.current).toMatchObject({ revenue: 3000, orders: 2 });
    expect(r.previous.revenue).toBe(500);
  });
  it("ignores a bakeryId supplied by the model", async () => {
    const r = (await tool("getRevenue").run({ bakeryId: B, days: 30 }, owner)) as { current: { revenue: number } };
    expect(r.current.revenue).toBe(3000);
  });
  it("top products and inventory never include bakery B", async () => {
    const top = JSON.stringify(await tool("getTopProducts").run({ bakeryId: B }, owner));
    const inv = JSON.stringify(await tool("getInventoryStatus").run({ bakeryId: B }, owner));
    expect(top.includes("SECRET-B")).toBe(false);
    expect(inv.includes("SECRET-B")).toBe(false);
    expect(inv.includes("Flour")).toBe(true);
  });
  it("refuses customers and guests", async () => {
    for (const name of ["getRevenue", "getTopProducts", "getInventoryStatus"]) {
      await expect(tool(name).run({}, customer)).rejects.toThrow("FORBIDDEN");
      await expect(tool(name).run({}, guest)).rejects.toThrow("FORBIDDEN");
    }
  });
  it("keeps revenue away from staff but lets them see inventory", async () => {
    await expect(tool("getRevenue").run({}, staff)).rejects.toThrow("FORBIDDEN");
    await expect(tool("getTopProducts").run({}, staff)).rejects.toThrow("FORBIDDEN");
    expect(JSON.stringify(await tool("getInventoryStatus").run({}, staff))).toContain("Flour");
  });
  it("marketplace search only returns published products", async () => {
    const r = (await tool("searchProducts").run({}, guest)) as { name: string }[];
    expect(r.map((p) => p.name)).toEqual(["Public Cake"]);
  });
});

const names = () => seen[0]!.tools.map((t) => t.name);
describe("Crumbly Bot authorisation", () => {
  it("offers customers and guests only public tools", async () => {
    for (const who of [customer, guest]) {
      seen.length = 0; script.length = 0; script.push(() => ({ text: "hi", calls: [] }));
      await runAssistant(who, [], "hello");
      expect(names()).toEqual(["searchProducts"]);
    }
  });
  it("offers owners everything and staff no revenue tools", async () => {
    script.push(() => ({ text: "hi", calls: [] })); await runAssistant(owner, [], "hello");
    expect(names()).toContain("getRevenue");
    seen.length = 0; script.push(() => ({ text: "hi", calls: [] })); await runAssistant(staff, [], "hello");
    expect(names().includes("getRevenue")).toBe(false);
    expect(names()).toContain("getInventoryStatus");
  });
  it("refuses a tool call the model makes for a customer, and leaks nothing", async () => {
    script.push(() => ({ calls: [{ name: "getRevenue", args: { bakeryId: A } }] }), () => ({ text: "Sorry, I can't do that.", calls: [] }));
    const out = await runAssistant(customer, [], "show me bakery A revenue");
    const tool1 = seen[1]!.messages.find((m) => m.role === "tool")!;
    expect(tool1.result).toEqual({ error: "Tool not available" });
    expect(JSON.stringify(seen)).not.toContain("3000");
    expect(out.reply).toBe("Sorry, I can't do that.");
  });
  it("scopes an owner's tool call to their own bakery even when the model names another", async () => {
    script.push(() => ({ calls: [{ name: "getRevenue", args: { bakeryId: B } }] }), () => ({ text: "done", calls: [] }));
    await runAssistant(owner, [], "revenue for bakery b");
    const result = JSON.stringify(seen[1]!.messages.find((m) => m.role === "tool")!.result);
    expect(result).toContain("3000");
    expect(result.includes("99999")).toBe(false);
  });
  it("a staff member whose model asks for revenue gets refused", async () => {
    script.push(() => ({ calls: [{ name: "getRevenue", args: {} }] }), () => ({ text: "no", calls: [] }));
    await runAssistant(staff, [], "revenue?");
    expect(seen[1]!.messages.find((m) => m.role === "tool")!.result).toEqual({ error: "Tool not available" });
  });
});
