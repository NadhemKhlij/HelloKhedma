// Two stores with the same interface: LocalStore (guests) and CloudStore (signed in).
import { ls } from "./lib.js";

export const STAGES = [
  { id: "saved", label: "Saved" },
  { id: "applied", label: "Applied" },
  { id: "interview", label: "Interview" },
  { id: "offer", label: "Offer" },
  { id: "rejected", label: "Rejected" },
];

const FIELDS = ["path_id", "title", "company", "location", "url", "source", "external_id", "stage"];
const pick = (o) => Object.fromEntries(FIELDS.filter((k) => o[k] !== undefined && o[k] !== "").map((k) => [k, o[k]]));
const dup = () => Object.assign(new Error("Already in your tracker"), { code: "DUPLICATE" });

const LOCAL_KEY = "hk.applications.v1";

export class LocalStore {
  async list() {
    try { return JSON.parse(ls.get(LOCAL_KEY) || "[]"); } catch { return []; }
  }
  async #save(rows) { ls.set(LOCAL_KEY, JSON.stringify(rows)); }
  async add(a) {
    const rows = await this.list();
    if (a.external_id && rows.some((r) => r.source === a.source && r.external_id === a.external_id)) throw dup();
    const row = { stage: "saved", company: "", location: "", ...pick(a), id: crypto.randomUUID(), created_at: new Date().toISOString() };
    rows.unshift(row);
    await this.#save(rows);
    return row;
  }
  async move(id, stage) {
    const rows = await this.list();
    const r = rows.find((x) => x.id === id);
    if (r) r.stage = stage;
    await this.#save(rows);
  }
  async remove(id) { await this.#save((await this.list()).filter((x) => x.id !== id)); }
  clear() { ls.del(LOCAL_KEY); }
}

export class CloudStore {
  constructor(sb) { this.sb = sb; }
  async list() {
    const { data, error } = await this.sb.from("applications").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  }
  async add(a) {
    const { data, error } = await this.sb.from("applications").insert(pick(a)).select().single();
    if (error) throw error.code === "23505" ? dup() : error;
    return data;
  }
  async move(id, stage) {
    const { error } = await this.sb.from("applications").update({ stage }).eq("id", id);
    if (error) throw error;
  }
  async remove(id) {
    const { error } = await this.sb.from("applications").delete().eq("id", id);
    if (error) throw error;
  }
}

// Called once after sign-in: moves guest cards into the user's account.
export async function importLocalToCloud(sb) {
  const local = new LocalStore();
  const rows = await local.list();
  if (!rows.length) return 0;
  const cloud = new CloudStore(sb);
  let n = 0;
  for (const r of [...rows].reverse()) {
    try { await cloud.add(r); n++; } catch (e) { if (e.code !== "DUPLICATE") throw e; }
  }
  local.clear();
  return n;
}
