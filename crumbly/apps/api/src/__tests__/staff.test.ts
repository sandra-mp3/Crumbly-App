import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeDb } from "./helpers/fakeDb.js";

const fake = new FakeDb(), emails: Record<string, string> = { u1: "Sam@Example.com", u2: "other@example.com", u3: "sam@example.com" };
vi.mock("../firebase.js", () => ({ db: fake, auth: { getUser: async (uid: string) => ({ email: emails[uid] }) } }));
const { createInvite, acceptInvite, updateMember } = await import("../staff.js");
beforeEach(() => { fake.reset(); fake.put("bakeryMembers/owner_a", { uid: "owner", bakeryId: "a", role: "BAKER_OWNER", active: true }); });

describe("staff invitations", () => {
  it("lets the invited person join with the invited role", async () => {
    const t = await createInvite("a", "sam@example.com", "BAKER_STAFF", "owner");
    expect(await acceptInvite("u1", t)).toEqual({ bakeryId: "a" });
    expect(fake.raw("bakeryMembers/u1_a")).toMatchObject({ role: "BAKER_STAFF", active: true, bakeryId: "a" });
  });
  it("stores only a hash of the token", async () => {
    const t = await createInvite("a", "sam@example.com", "BAKER_STAFF", "owner");
    expect(JSON.stringify([...fake.store.keys()]).includes(t)).toBe(false);
  });
  it("rejects someone signed in with a different email, even with the token", async () => {
    const t = await createInvite("a", "sam@example.com", "BAKER_MANAGER", "owner");
    await expect(acceptInvite("u2", t)).rejects.toThrow("different email");
    expect(fake.raw("bakeryMembers/u2_a")).toBe(undefined);
  });
  it("cannot be used twice", async () => {
    const t = await createInvite("a", "sam@example.com", "BAKER_STAFF", "owner");
    await acceptInvite("u1", t);
    await expect(acceptInvite("u3", t)).rejects.toThrow("isn't valid");
  });
  it("rejects expired and made-up tokens", async () => {
    const t = await createInvite("a", "sam@example.com", "BAKER_STAFF", "owner");
    for (const [k, v] of fake.store) if (k.startsWith("bakeryInvites/")) fake.put(k, { ...v, expiresAt: new Date(Date.now() - 1000) });
    await expect(acceptInvite("u1", t)).rejects.toThrow("expired");
    await expect(acceptInvite("u1", "x".repeat(32))).rejects.toThrow("isn't valid");
  });
  it("won't add someone who already belongs to a bakery", async () => {
    const t = await createInvite("a", "sam@example.com", "BAKER_STAFF", "owner");
    fake.put("bakeryMembers/u1_b", { uid: "u1", bakeryId: "b", role: "BAKER_OWNER", active: true });
    await expect(acceptInvite("u1", t)).rejects.toThrow("already belong");
  });
});
describe("managing team members", () => {
  beforeEach(() => fake.put("bakeryMembers/m1_a", { uid: "m1", bakeryId: "a", role: "BAKER_STAFF", active: true }));
  it("changes a role and removes access", async () => {
    await updateMember("a", "owner", "m1", { role: "BAKER_MANAGER" }); expect(fake.raw("bakeryMembers/m1_a")!.role).toBe("BAKER_MANAGER");
    await updateMember("a", "owner", "m1", { active: false }); expect(fake.raw("bakeryMembers/m1_a")!.active).toBe(false);
  });
  it("protects the owner and yourself", async () => {
    await expect(updateMember("a", "m1", "owner", { active: false })).rejects.toThrow("owner");
    await expect(updateMember("a", "owner", "owner", { active: false })).rejects.toThrow("your own");
  });
  it("cannot touch another bakery's members", async () => {
    fake.put("bakeryMembers/z1_b", { uid: "z1", bakeryId: "b", role: "BAKER_STAFF", active: true });
    await expect(updateMember("a", "owner", "z1", { active: false })).rejects.toThrow("couldn't find");
    expect(fake.raw("bakeryMembers/z1_b")!.active).toBe(true);
  });
});
