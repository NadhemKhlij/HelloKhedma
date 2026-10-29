// Shared app state and the small helpers several pages use. No DOM work at import time.
// - state: career paths and the selected one, path resources and tracks, training progress, the signed-in user and
//   the application store (LocalStore for guests, CloudStore when signed in), tracker cards, the active CV (state.cv,
//   see cvpage.js) and the Offers results (state.jobs, see offers.js).
// - Page modules (home, training, offers, cvpage, applications, account, router) import each other's functions where
//   needed; those imports are only called after start-up, so the import cycles between them are harmless.
import { h, toast } from "./lib.js";
import { t } from "./i18n.js";
import { LocalStore } from "./store.js";
import { courseForSkill } from "./courses.js";

export const state = {
  paths: [], pathId: null, resources: [], tracks: [], open: new Set(), openInit: false, done: new Set(),
  user: null, store: new LocalStore(), cards: [],
  cv: { id: null, name: "", text: "", skills: [], names: new Set() }, jobs: [], skillFilter: null,
};

export const path = () => state.paths.find((p) => p.id === state.pathId);
export const pathName = (id) => state.paths.find((p) => p.id === id)?.name || id;
export const byKind = (k) => state.resources.filter((r) => r.kind === k);
export const fail = (e) => toast(e?.message || t("Something went wrong."));

export const fitColor = (score) => (score >= 70 ? "#18a999" : score >= 40 ? "#f08a24" : "#e0508b");
// A skill you have shows ✓; a missing skill with a HelloKhedma course links to it (📘).
export const skillChip = (name, inCv) => {
  const course = inCv ? null : courseForSkill(name);
  return course
    ? h("a", { href: `#/course/${course}`, class: "chip text-xs mute hover:opacity-80", title: t("Learn {name}: HelloKhedma course", { name }) }, `📘 ${name}`)
    : h("span", { class: `chip text-xs ${inCv ? "chip-ok" : "mute"}` }, inCv ? `✓ ${name}` : name);
};
