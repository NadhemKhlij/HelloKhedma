// CV versions, kept in this browser only (never sent to Supabase or any API, even for signed-in users).
// - "hk.cvs": [{ id, name, text, path_id (career path that uses this version automatically, or null), updated_at }]
// - "hk.cv.active": id of the version that scores offers, the CV match and the study plan.
// - The single CV of earlier versions ("hk.cv.text") is moved into a first version named "My CV" on first load.
// At most one version is linked to a given path; cvpage.js (useCvForPath) activates it when that path is selected.
import { ls } from "./lib.js";
import { t } from "./i18n.js";

const LIST_KEY = "hk.cvs", ACTIVE_KEY = "hk.cv.active", OLD_KEY = "hk.cv.text";
const now = () => new Date().toISOString();

export function loadCvs() {
  let list;
  try { list = JSON.parse(ls.get(LIST_KEY) || "[]"); } catch { list = []; }
  const old = ls.get(OLD_KEY);
  if (!list.length && old?.trim()) {
    list = [{ id: crypto.randomUUID(), name: t("My CV"), text: old, path_id: null, updated_at: now() }];
    saveCvs(list);
    ls.set(ACTIVE_KEY, list[0].id);
  }
  if (old != null) ls.del(OLD_KEY);
  return list;
}
export const saveCvs = (list) => ls.set(LIST_KEY, JSON.stringify(list));

// The active version, falling back to the first one (or null when there is none).
export function activeCv(list = loadCvs()) {
  const id = ls.get(ACTIVE_KEY);
  return list.find((c) => c.id === id) || list[0] || null;
}
export const setActiveCv = (id) => (id ? ls.set(ACTIVE_KEY, id) : ls.del(ACTIVE_KEY));

export function addCv(fields) {
  const list = loadCvs();
  const cv = { id: crypto.randomUUID(), name: t("CV {n}", { n: list.length + 1 }), text: "", path_id: null, updated_at: now(), ...fields };
  saveCvs([...list, cv]);
  setActiveCv(cv.id);
  return cv;
}

export function updateCv(id, patch) {
  saveCvs(loadCvs().map((c) => (c.id === id ? { ...c, ...patch, updated_at: now() } : c)));
}

export function removeCv(id) {
  const list = loadCvs().filter((c) => c.id !== id);
  saveCvs(list);
  if (ls.get(ACTIVE_KEY) === id) setActiveCv(list[0]?.id);
}

// Links a version to a path (or unlinks it with pathId = null); a path keeps a single linked version.
export function linkCvToPath(id, pathId) {
  saveCvs(loadCvs().map((c) => (c.id === id ? { ...c, path_id: pathId }
    : pathId && c.path_id === pathId ? { ...c, path_id: null } : c)));
}

export const cvForPath = (pathId, list = loadCvs()) => list.find((c) => c.path_id === pathId) || null;
