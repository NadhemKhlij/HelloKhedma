// Two stores with the same interface: LocalStore (guests) and CloudStore (signed in).
// Interface: list(), add(app), update(id, patch), move(id, stage), remove(id), detailsSupported(), cvSupported().
// - LocalStore keeps applications in localStorage ("hk.applications.v1").
// - CloudStore uses the RLS-protected `applications` table (rows scoped to auth.uid()).
// - importLocalToCloud() runs once after sign-in: copies guest cards into the account, then clears them locally.
// Detail columns (salary, contact, next_action, follow_up_on, interview_at, history) come from migration
// 20261029000000_application_details.sql. CloudStore.detailsSupported() checks the column exists and only sends
// those fields once it does, so signed-in users keep working before the owner runs the migration (CHECKLIST O6).
// cv_version (name of the CV version sent) works the same way with migration 20261029000100_application_cv.sql
// and cvSupported() (CHECKLIST O13).
import { ls } from "./lib.js";
import { t } from "./i18n.js";

// Stage ids are stored; labels are translated ("stage|" keys: the nav's "Interview" is translated differently).
export const STAGES = [
  { id: "saved", label: t("stage|Saved") },
  { id: "applied", label: t("stage|Applied") },
  { id: "interview", label: t("stage|Interview") },
  { id: "offer", label: t("stage|Offer") },
  { id: "rejected", label: t("stage|Rejected") },
];

const BASE_FIELDS = ["path_id", "title", "company", "location", "url", "source", "external_id", "stage", "notes"];
// Added by migration 20261029000000_application_details.sql. CloudStore only sends them once that migration has run.
const DETAIL_FIELDS = ["salary", "contact", "next_action", "follow_up_on", "interview_at", "history"];
// Name of the CV version sent (js/cvs.js; the CV text itself stays in the browser). Migration 20261029000100_application_cv.sql.
const CV_FIELDS = ["cv_version"];
const NULLABLE = new Set(["follow_up_on", "interview_at", "url"]);

// For inserts: drop empty values. For updates: keep "" (clears a field) but turn empty dates into null.
const pick = (o, fields, { keepEmpty = false } = {}) => Object.fromEntries(fields
  .filter((k) => o[k] !== undefined && (keepEmpty || o[k] !== ""))
  .map((k) => [k, NULLABLE.has(k) && o[k] === "" ? null : o[k]]));
const dup = () => Object.assign(new Error(t("Already in your tracker")), { code: "DUPLICATE" });
const now = () => new Date().toISOString();

// A stage change appends to the history (used for the timeline and the stats).
export const withStage = (card, stage) => ({ stage, history: [...(card?.history || []), { stage, at: now() }] });

const LOCAL_KEY = "hk.applications.v1";

export class LocalStore {
  detailsSupported() { return true; }
  cvSupported() { return true; }
  async list() {
    try { return JSON.parse(ls.get(LOCAL_KEY) || "[]"); } catch { return []; }
  }
  async #save(rows) { ls.set(LOCAL_KEY, JSON.stringify(rows)); }
  async add(a) {
    const rows = await this.list();
    if (a.external_id && rows.some((r) => r.source === a.source && r.external_id === a.external_id)) throw dup();
    const stage = a.stage || "saved";
    const row = { stage, company: "", location: "", history: [{ stage, at: now() }],
      ...pick(a, [...BASE_FIELDS, ...DETAIL_FIELDS, ...CV_FIELDS]), id: crypto.randomUUID(), created_at: now() };
    rows.unshift(row);
    await this.#save(rows);
    return row;
  }
  async update(id, patch) {
    const rows = await this.list();
    const r = rows.find((x) => x.id === id);
    if (r) Object.assign(r, pick(patch, [...BASE_FIELDS, ...DETAIL_FIELDS, ...CV_FIELDS], { keepEmpty: true }), { updated_at: now() });
    await this.#save(rows);
  }
  async move(id, stage) {
    const r = (await this.list()).find((x) => x.id === id);
    await this.update(id, withStage(r, stage));
  }
  async remove(id) { await this.#save((await this.list()).filter((x) => x.id !== id)); }
  clear() { ls.del(LOCAL_KEY); }
}

export class CloudStore {
  constructor(sb) { this.sb = sb; this.columns = {}; }
  // True once the migration adding `column` has run (checked once per column).
  async #has(column) {
    if (!(column in this.columns)) {
      const { error } = await this.sb.from("applications").select(column).limit(1);
      this.columns[column] = !error;
    }
    return this.columns[column];
  }
  detailsSupported() { return this.#has("history"); }
  cvSupported() { return this.#has("cv_version"); }
  async #fields() {
    const [details, cv] = await Promise.all([this.detailsSupported(), this.cvSupported()]);
    return [...BASE_FIELDS, ...(details ? DETAIL_FIELDS : []), ...(cv ? CV_FIELDS : [])];
  }
  async list() {
    const { data, error } = await this.sb.from("applications").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  }
  async add(a) {
    const stage = a.stage || "saved";
    const row = pick({ history: [{ stage, at: now() }], ...a, stage }, await this.#fields());
    const { data, error } = await this.sb.from("applications").insert(row).select().single();
    if (error) throw error.code === "23505" ? dup() : error;
    return data;
  }
  async update(id, patch) {
    const { error } = await this.sb.from("applications").update(pick(patch, await this.#fields(), { keepEmpty: true })).eq("id", id);
    if (error) throw error;
  }
  async move(id, stage) {
    const { data, error } = await this.sb.from("applications").select("*").eq("id", id).single();
    if (error) throw error;
    await this.update(id, withStage(data, stage));
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
