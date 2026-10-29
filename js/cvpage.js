// CV check page (#/cv): CV versions (stored by cvs.js, in this browser only, never sent to Supabase or any API),
// skill extraction (ats.js) and "Match with an offer" (compares the offer, or the path keywords, with every version).
// The active version (state.cv) also scores offers (offers.js), feeds the study plan (training.js) and is recorded
// as "CV sent" on new applications (cvUsed). A version linked to a path becomes active when that path is selected.
import { $, h, toast } from "./lib.js";
import { t, tn } from "./i18n.js";
import { state, path, pathName, byKind, fitColor, skillChip } from "./state.js";
import { extractSkills, matchSkills, readCvFile } from "./ats.js";
import { loadCvs, activeCv, setActiveCv, addCv, updateCv, removeCv, linkCvToPath, cvForPath } from "./cvs.js";
import { renderOffers } from "./offers.js";
import { renderStudyPlan } from "./training.js";

// Loads the active CV version into state.cv. Skills are re-extracted each time: path keywords may have changed.
export function loadActiveCv() {
  const cv = activeCv(), text = cv?.text || "", skills = extractSkills(text);
  state.cv = { id: cv?.id || null, name: cv?.name || "", text, skills, names: new Set(skills.map((s) => s.name)) };
}
// Redraws everything that depends on the active CV; fillEditor also puts its text in the CV box.
function refreshCv({ fillEditor = false } = {}) {
  loadActiveCv();
  if (fillEditor) { $("#cv").value = state.cv.text; $("#atsOut").replaceChildren(); $("#cvFileMsg").textContent = ""; }
  renderCvVersions(); renderCvSkills(); renderOffers(); renderStudyPlan();
}
function switchCv(id) { setActiveCv(id); refreshCv({ fillEditor: true }); }
// Name of the active CV version, recorded on new applications ("" when no CV is saved).
export const cvUsed = () => (state.cv.text.trim() ? state.cv.name : "");

// After a path change (or at start-up): the version linked to the path becomes active. Callers redraw the page.
export function useCvForPath(pathId) {
  const linked = cvForPath(pathId);
  if (linked) setActiveCv(linked.id);
  loadActiveCv();
  $("#cv").value = state.cv.text;
  $("#atsOut").replaceChildren();
}

export function renderCvVersions() {
  const list = loadCvs(), cur = list.find((c) => c.id === state.cv.id);
  $("#cvVersions").hidden = !list.length;
  $("#cvPick").replaceChildren(...list.map((c) => h("option", { value: c.id, selected: c.id === state.cv.id },
    c.path_id ? `${c.name} · ${pathName(c.path_id)}` : c.name)));
  // Keep what is being typed, unless another version became active (path switch) while the field had focus.
  const nameField = $("#cvName");
  if (document.activeElement !== nameField || nameField.dataset.id !== state.cv.id) {
    nameField.value = state.cv.name; nameField.dataset.id = state.cv.id || "";
  }
  $("#cvForPath").checked = Boolean(cur && cur.path_id === state.pathId);
  $("#cvForPathLabel").textContent = t("Use this version automatically for the {path} path", { path: path()?.name || "" });
}

// A select to change the CV that scores offers (only when there are several versions).
export function cvSwitcher() {
  const list = loadCvs();
  if (list.length < 2) return null;
  return h("label", { class: "mute" }, t(" · scored with "),
    h("select", { class: "input !py-0 !px-1 text-sm", "aria-label": t("CV version"), onChange: (e) => switchCv(e.target.value) },
      list.map((c) => h("option", { value: c.id, selected: c.id === state.cv.id }, c.name))));
}

function saveCv(text) {
  if (state.cv.id) updateCv(state.cv.id, { text }); else addCv({ name: t("My CV"), text });
  refreshCv();
}

export function renderCvSkills() {
  const { text, skills } = state.cv;
  if (!text.trim()) { $("#cvSkills").replaceChildren(h("p", { class: "mute text-sm" }, t("No CV saved yet."))); return; }
  const cats = [...new Set(skills.map((s) => s.cat))];
  $("#cvSkills").replaceChildren(...[
    h("p", { class: "font-bold" }, tn(skills.length, "{n} skill found in your CV", "{n} skills found in your CV"),
      h("span", { class: "mute text-sm font-normal" }, t(" · saved on this device and used to score offers"))),
    skills.length ? null : h("p", { class: "mute text-sm" }, t("No known skills detected. Check the text is readable, or paste it instead.")),
    ...cats.map((c) => h("div", { class: "mt-2" },
      h("p", { class: "mute text-xs mb-1" }, t(c)), // skill categories from ats.js
      h("div", { class: "flex flex-wrap gap-1.5" }, skills.filter((s) => s.cat === c)
        .map((s) => h("span", { class: "chip chip-ok text-xs" }, s.count > 1 ? `${s.name} ×${s.count}` : s.name))))),
  ].filter(Boolean));
}

async function onCvFile(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const msg = $("#cvFileMsg");
  msg.textContent = t("Reading {file}…", { file: file.name });
  try {
    const text = (await readCvFile(file)).trim();
    if (!text) throw new Error(t("no text found. If it is a scanned PDF, paste the text instead."));
    $("#cv").value = text;
    saveCv(text);
    msg.textContent = t("{file} read.", { file: file.name });
  } catch (err) { msg.textContent = t("Could not read {file}: {msg}", { file: file.name, msg: err.message }); }
  e.target.value = "";
}

function onCvSave() {
  const text = $("#cv").value;
  if (!text.trim()) { toast(t("Upload or paste your CV first.")); return; }
  saveCv(text);
}

function onCvClear() {
  if (!state.cv.id) { $("#cv").value = ""; return; }
  if (state.cv.text.trim() && !confirm(t("Delete the CV \"{name}\" from this device?", { name: state.cv.name }))) return;
  removeCv(state.cv.id);
  refreshCv({ fillEditor: true });
  toast(t("CV deleted from this device."));
}

// A new version starts as a copy of the current one, ready to be tailored.
function onCvNew() {
  addCv(state.cv.id ? { name: t("{name} (copy)", { name: state.cv.name }), text: state.cv.text } : {});
  refreshCv({ fillEditor: true });
  $("#cvName").focus(); $("#cvName").select();
  toast(t("New version created from a copy. Rename it and edit the text."));
}
function onCvRename(e) {
  if (!state.cv.id) return;
  updateCv(state.cv.id, { name: e.target.value.trim() || t("Untitled CV") });
  loadActiveCv(); renderCvVersions();
}
function onCvForPath(e) {
  if (!state.cv.id) return;
  linkCvToPath(state.cv.id, e.target.checked ? state.pathId : null);
  renderCvVersions();
}

function onAts() {
  if (!state.cv.text.trim()) { toast(t("Add your CV first (upload or paste it above).")); return; }
  const jd = $("#jd").value, usedJd = Boolean(jd.trim());
  // Path keywords go through the extractor too, so aliases map to the same names as in the CV.
  const required = extractSkills(usedJd ? jd : byKind("keyword").map((k) => k.title).join(" ; ")).map((s) => s.name);
  const r = matchSkills(required, state.cv.names);
  if (!r.total) { $("#atsOut").replaceChildren(h("p", { class: "mute text-sm" }, t("No known skills found in this job description."))); return; }
  const chips = (list, inCv) => list.map((n) => skillChip(n, inCv));
  const vars = { matched: r.matched.length, total: r.total };
  // Same comparison for every CV version, best first; clicking one makes it the active version.
  const versions = loadCvs().filter((c) => c.text.trim())
    .map((c) => ({ c, score: matchSkills(required, new Set(extractSkills(c.text).map((s) => s.name))).score }))
    .sort((a, b) => b.score - a.score);
  $("#atsOut").replaceChildren(...[
    h("p", { class: "text-lg font-bold", style: `color:${fitColor(r.score)}` }, t("{score}% match", { score: r.score }),
      h("span", { class: "mute text-sm font-normal" }, usedJd
        ? t(" · {matched} of {total} skills from the offer are in your CV", vars)
        : t(" · {matched} of {total} path keywords are in your CV", vars))),
    versions.length > 1 ? h("p", { class: "text-sm mt-1" }, h("span", { class: "mute" }, t("Your CV versions: ")),
      ...versions.flatMap(({ c, score }, i) => [i ? " · " : "", c.id === state.cv.id
        ? h("b", { style: `color:${fitColor(score)}` }, t("{name} {score}%", { name: c.name, score }))
        : h("button", { type: "button", class: "underline", style: `color:${fitColor(score)}`, title: t("Use this version"),
            onClick: () => { switchCv(c.id); onAts(); } }, t("{name} {score}%", { name: c.name, score }))])) : null,
    h("p", { class: "mute text-sm mt-3 mb-1" }, t("In your CV")),
    h("div", { class: "flex flex-wrap gap-2" }, r.matched.length ? chips(r.matched, true) : h("span", { class: "mute text-sm" }, t("None yet."))),
    h("p", { class: "mute text-sm mt-3 mb-1" }, t("Missing: add the ones you genuinely have · 📘 = open the HelloKhedma course")),
    h("div", { class: "flex flex-wrap gap-2" }, r.missing.length ? chips(r.missing, false) : h("span", { class: "mute text-sm" }, t("Nothing missing."))),
  ].filter(Boolean));
}

export function initCvPage() {
  $("#atsBtn").addEventListener("click", onAts);
  $("#cvFile").addEventListener("change", onCvFile);
  $("#cvSave").addEventListener("click", onCvSave);
  $("#cvClear").addEventListener("click", onCvClear);
  $("#cvNew").addEventListener("click", onCvNew);
  $("#cvPick").addEventListener("change", (e) => switchCv(e.target.value));
  $("#cvName").addEventListener("input", onCvRename);
  $("#cvForPath").addEventListener("change", onCvForPath);
  useCvForPath(state.pathId); // e.g. the path came back from another device's profile
  renderCvSkills();
}
