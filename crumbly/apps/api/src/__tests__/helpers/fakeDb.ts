/* eslint-disable @typescript-eslint/no-explicit-any */
// Minimal in-memory stand-in for the slice of the Firestore Admin API that Crumbly uses. For unit tests only.
type Data = Record<string, any>;
const num = (x: any) => (x instanceof Date ? x.getTime() : x);
const view = (v: any): any => (v instanceof Date ? { toDate: () => v, __d: true } : Array.isArray(v) ? v.map(view) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, view(x)])) : v);
const parentOf = (p: string) => p.slice(0, p.lastIndexOf("/"));
let n = 0;

class Snap {
  id: string; ref: DocRef; exists: boolean; private d: Data | undefined;
  constructor(ref: DocRef, d: Data | undefined) { this.ref = ref; this.id = ref.id; this.d = d; this.exists = d !== undefined; }
  data() { return this.d ? view(structuredClone(this.d)) : undefined; }
}
export class DocRef {
  db: FakeDb; path: string; id: string;
  constructor(db: FakeDb, path: string) { this.db = db; this.path = path; this.id = path.slice(path.lastIndexOf("/") + 1); }
  async get() { return new Snap(this, this.db.store.get(this.path)); }
  async set(d: Data) { this.db.store.set(this.path, structuredClone(d)); }
  async create(d: Data) { if (this.db.store.has(this.path)) throw Object.assign(new Error("ALREADY_EXISTS"), { code: 6 }); this.db.store.set(this.path, structuredClone(d)); }
  async update(p: Data) { const c = this.db.store.get(this.path); if (!c) throw new Error("NOT_FOUND"); this.db.store.set(this.path, { ...c, ...structuredClone(p) }); }
  async delete() { this.db.store.delete(this.path); }
  collection(name: string) { return new Query(this.db, `${this.path}/${name}`); }
}
export class Query {
  db: FakeDb; col: string; filters: [string, string, any][]; order: [string, "asc" | "desc"] | null; lim: number;
  constructor(db: FakeDb, col: string, filters: [string, string, any][] = [], order: [string, "asc" | "desc"] | null = null, lim = Infinity) { this.db = db; this.col = col; this.filters = filters; this.order = order; this.lim = lim; }
  where(f: string, op: string, v: any) { return new Query(this.db, this.col, [...this.filters, [f, op, v]], this.order, this.lim); }
  orderBy(f: string, dir: "asc" | "desc" = "asc") { return new Query(this.db, this.col, this.filters, [f, dir], this.lim); }
  limit(l: number) { return new Query(this.db, this.col, this.filters, this.order, l); }
  doc(id?: string) { return new DocRef(this.db, `${this.col}/${id ?? `auto${++n}`}`); }
  async get() {
    let rows = [...this.db.store].filter(([p]) => parentOf(p) === this.col);
    for (const [f, op, v] of this.filters) rows = rows.filter(([, d]) => {
      const x = num(d[f]), y = num(v);
      return op === "==" ? x === y : op === "<=" ? x <= y : op === ">=" ? x >= y : op === "<" ? x < y : op === ">" ? x > y : op === "in" ? (v as any[]).includes(d[f]) : op === "array-contains" ? Array.isArray(d[f]) && d[f].includes(v) : false;
    });
    if (this.order) { const [f, dir] = this.order; rows.sort(([, a], [, b]) => (num(a[f]) > num(b[f]) ? 1 : -1) * (dir === "asc" ? 1 : -1)); }
    const docs = rows.slice(0, this.lim).map(([p, d]) => new Snap(new DocRef(this.db, p), d));
    return { docs, size: docs.length, empty: docs.length === 0 };
  }
}
export class FakeDb {
  store = new Map<string, Data>();
  collection(name: string) { return new Query(this, name); }
  async getAll(...refs: DocRef[]) { return Promise.all(refs.map((r) => r.get())); }
  put(path: string, d: Data) { this.store.set(path, structuredClone(d)); }
  raw(path: string) { return this.store.get(path); }
  reset() { this.store.clear(); }
  async runTransaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    const writes: (() => Promise<void>)[] = [];
    const tx = { get: (r: DocRef | Query) => r.get(), set: (r: DocRef, d: Data) => writes.push(() => r.set(d)), update: (r: DocRef, d: Data) => writes.push(() => r.update(d)), create: (r: DocRef, d: Data) => writes.push(() => r.create(d)), delete: (r: DocRef) => writes.push(() => r.delete()) };
    const out = await fn(tx);
    for (const w of writes) await w(); // nothing is applied if fn throws
    return out;
  }
}
