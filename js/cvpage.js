// CV check page (#/cv), three panels:
// 1. "Your CV": CV versions (stored by cvs.js, in this browser only; synced only if the user opted in, cvsync.js),
//    upload / paste, "Save and score my CV" (an "unsaved changes" hint while the text differs from the saved one);
// 2. "Your CV score": computed as soon as a CV is saved, no offer needed: ATS score (atsscore.js) against the path's
//    keywords and job titles, fixes sorted by the points they add, the change since the last score of this version
//    for this path ("hk.cvscore", this browser only), path keywords found / missing + "Close the gaps", skills found;
// 3. "Match with a job offer" (optional): the offer compared with every version; runs when an offer is pasted, or
//    chosen in "Choose an offer" (no pasting): offers seen on the Offers page (best fit first) and tracker cards whose
//    text was kept when tracked (offerpick.js, this browser only), or "The market": the CV against the skills asked
//    most often in the offers seen for the path (pulse.js marketSkills), with course links for the missing ones.
// The active version (state.cv) also scores offers (offers.js), feeds the study plan (training.js) and is recorded
// as "CV sent" on new applications (cvUsed). A version linked to a path becomes active when that path is selected.
// After a match with a pasted offer, "✍ Tailor my CV for this offer" opens tailor.js and "✉ Cover letter" letters.js.
// Under the missing skills, "Close the gaps" (gaps.js) lists the HelloKhedma courses, roadmap steps and projects for them.
// The offer's own ATS report is under "Full ATS report for this offer". Two tabs: this CV check
// (#/cv) and the CV maker (#/cv/maker, cvmaker.js), whose "Use as a CV version" refreshes this page.
import { $, h, ls, toast, safeUrl } from "./lib.js";
import { t, tn } from "./i18n.js";
import { state, path, pathName, byKind, fitColor, skillChip } from "./state.js";
import { extractSkills, matchSkills, readCvFile } from "./ats.js";
import { loadCvs, activeCv, setActiveCv, addCv, updateCv, removeCv, linkCvToPath, cvForPath } from "./cvs.js";
import { renderOffers } from "./offers.js";
import { renderStudyPlan } from "./training.js";
import { openTailor } from "./tailor.js";
import { openCoverLetter } from "./letters.js";
import { atsReport, atsView } from "./atsscore.js";
import { initCvMaker, renderCvMaker } from "./cvmaker.js";
import { gapTrainings } from "./gaps.js";
import { logInsight, insightsAsk } from "./insights.js";
import { recentOffers, trackedOffer, offerAsText, rememberTracked } from "./offerpick.js";
import { marketSkills, skillRow } from "./pulse.js";
import { STAGES } from "./store.js";
import { countFeature } from "./usage.js";

// Loads the active CV version into state.cv. Skills are re-extracted each time: path keywords may have changed.
export function loadActiveCv() {
  const cv = activeCv(), text = cv?.text || "", skills = extractSkills(text);
  state.cv = { id: cv?.id || null, name: cv?.name || "", text, skills, names: new Set(skills.map((s) => s.name)) };
}
// Redraws everything that depends on the active CV; fillEditor also puts its text in the CV box.
function refreshCv({ fillEditor = false } = {}) {
  loadActiveCv();
  if (fillEditor) { $("#cv").value = state.cv.text; $("#atsOut").replaceChildren(); $("#cvFileMsg").textContent = ""; }
  renderCvVersions(); renderCvSkills(); renderOffers(); renderStudyPlan(); markDirty(); renderOfferPick();
  if (picked?.market) showMarket();
  else if ($("#jd").value.trim()) onAts({ quiet: true }); // keep the offer match in step with the CV shown
}
function switchCv(id) { setActiveCv(id); refreshCv({ fillEditor: true }); }
// CVs merged from another device ("Save my CVs to my account", cvsync.js).
window.addEventListener("hk:cvs-synced", () => refreshCv({ fillEditor: true }));
// Name of the active CV version, recorded on new applications ("" when no CV is saved).
export const cvUsed = () => (state.cv.text.trim() ? state.cv.name : "");

// After a path change (or at start-up): the version linked to the path becomes active. Callers redraw the page.
export function useCvForPath(pathId) {
  const linked = cvForPath(pathId);
  if (linked) setActiveCv(linked.id);
  loadActiveCv();
  $("#cv").value = state.cv.text;
  $("#atsOut").replaceChildren();
  if (picked?.market) picked = null;
  markDirty();
  renderOfferPick();
}
// "Unsaved changes" while the CV box differs from the saved version.
function markDirty() { $("#cvDirty").hidden = $("#cv").value.trim() === state.cv.text.trim(); }

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
  // Bring the new score into view (on a phone it is below the CV box).
  const panel = $("#cvScorePanel");
  if (panel.getBoundingClientRect().top > window.innerHeight * 0.6) panel.scrollIntoView({ behavior: "smooth", block: "start" });
  logInsight("gaps", state.pathId, pathReport()?.match.missing || []); // anonymous statistics, only if opted in
}

// The path's keywords, through the extractor so aliases map to the same names as in the CV.
const pathSkills = () => extractSkills(byKind("keyword").map((k) => k.title).join(" ; ")).map((s) => s.name);
// ATS report of the active CV for the selected path (no offer needed), or null without a CV.
function pathReport() {
  if (!state.cv.text.trim()) return null;
  return atsReport(state.cv.text, { required: pathSkills(), jobTitles: path()?.job_titles || [], source: "path" });
}
// Last score per CV version and path, to show the change after an edit (this browser only, a number per key).
const SCORES = "hk.cvscore";
function scoreChange(score) {
  let all = {};
  try { all = JSON.parse(ls.get(SCORES) || "{}"); } catch { /* start again */ }
  const key = `${state.cv.id}:${state.pathId}`, before = all[key];
  if (before !== score) { all[key] = score; ls.set(SCORES, JSON.stringify(all)); }
  return typeof before === "number" && before !== score ? score - before : 0;
}

// Panel 2: score, fixes, path keywords and skills of the active CV.
function renderCvScore() {
  const r = pathReport();
  $("#cvScoreSub").textContent = r
    ? t("Scored for the {path} path: its keywords and job titles. Fix the points below, save, and watch it go up.", { path: path()?.name || "" })
    : "";
  if (!r) {
    const step = (n, title, text) => h("li", { class: "flex gap-3" },
      h("span", { class: "w-7 h-7 shrink-0 rounded-full grid place-items-center text-xs font-semibold", style: "background:var(--soft)" }, String(n)),
      h("span", { class: "text-sm" }, h("b", {}, title), h("span", { class: "mute block" }, text)));
    $("#cvScore").replaceChildren(h("ol", { class: "grid gap-3" },
      step(1, t("Add your CV"), t("Upload a PDF, paste the text, or build one in the CV maker.")),
      step(2, t("Get your score at once"), t("Out of 100, with the fixes that add the most points first.")),
      step(3, t("Match it with an offer (optional)"), t("Choose an offer you have seen or paste one, to see what that job asks for and you lack."))));
    return;
  }
  const change = scoreChange(r.score), m = r.match;
  $("#cvScore").replaceChildren(...[
    change ? h("p", { class: "text-sm font-medium mb-2", style: `color:${change > 0 ? "var(--ok)" : "var(--bad)"}` },
      change > 0 ? t("↑ +{n} points since your last save", { n: change }) : t("↓ {n} points since your last save", { n: change })) : null,
    atsView(r),
    m.total ? h("div", { class: "mt-4 grid gap-2" },
      h("p", { class: "font-semibold text-sm" }, t("Keywords of your path: {matched} of {total} in your CV", { matched: m.matched.length, total: m.total })),
      h("div", { class: "flex flex-wrap gap-2" }, m.matched.map((n) => skillChip(n, true)), m.missing.map((n) => skillChip(n, false))),
      m.missing.length ? h("p", { class: "mute text-xs" }, t("Without ✓ = missing: add the ones you genuinely have · 📘 = open the HelloKhedma course")) : null,
      // Folded here (the fixes come first); the offer match below shows its own gaps open.
      m.missing.length ? h("details", { class: "mt-1" }, h("summary", { class: "cursor-pointer text-sm font-medium", style: "color:var(--accent-ink)" },
        tn(m.missing.length, "📘 How to learn the missing keyword", "📘 How to learn the {n} missing keywords")), gapTrainings(m.missing)) : null) : null,
  ].filter(Boolean));
}

export function renderCvSkills() {
  renderCvScore();
  const { text, skills } = state.cv;
  if (!text.trim()) { $("#cvSkills").replaceChildren(); return; }
  const cats = [...new Set(skills.map((s) => s.cat))];
  $("#cvSkills").replaceChildren(h("details", { class: "rounded-xl p-3", style: "background:var(--soft)" }, ...[
    h("summary", { class: "cursor-pointer font-semibold text-sm" }, tn(skills.length, "{n} skill found in your CV", "{n} skills found in your CV"),
      h("span", { class: "mute font-normal" }, t(" · used to score offers"))),
    skills.length ? null : h("p", { class: "mute text-sm" }, t("No known skills detected. Check the text is readable, or paste it instead.")),
    ...cats.map((c) => h("div", { class: "mt-2" },
      h("p", { class: "mute text-xs mb-1" }, t(c)), // skill categories from ats.js
      h("div", { class: "flex flex-wrap gap-1.5" }, skills.filter((s) => s.cat === c)
        .map((s) => h("span", { class: "chip chip-ok text-xs" }, s.count > 1 ? `${s.name} ×${s.count}` : s.name))))),
  ].filter(Boolean)));
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

// Panel 3: the CV against one pasted offer. quiet: started by typing / pasting or a CV change.
// Anonymous statistics (insights.js, only if the user opted in: skill names, never the CV or offer text) are sent once
// per offer text, when the button is pressed or the offer box is left, not while typing.
let loggedJd = "", jdTimer = null, lastMatch = null;
function logOffer() {
  if (!lastMatch || lastMatch.jd !== $("#jd").value || loggedJd === lastMatch.jd) return;
  loggedJd = lastMatch.jd;
  logInsight("offer_skills", state.pathId, lastMatch.required); logInsight("gaps", state.pathId, lastMatch.missing);
}
function onAts({ quiet = false } = {}) {
  if (!quiet) countFeature("cv_check");
  const jd = $("#jd").value, out = $("#atsOut");
  $("#jdClear").hidden = !jd.trim();
  lastMatch = null;
  if (!jd.trim()) {
    out.replaceChildren(quiet ? "" : h("p", { class: "mute text-sm" }, t("Paste a job description first. Your CV's own score is shown above.")));
    if (!quiet) $("#jd").focus();
    return;
  }
  if (!state.cv.text.trim()) { out.replaceChildren(h("p", { class: "text-sm", style: "color:var(--warn)" }, t("Add your CV first (upload or paste it above)."))); return; }
  const required = extractSkills(jd).map((s) => s.name);
  const r = matchSkills(required, state.cv.names);
  // Job titles to look for: the path titles named in the offer, else its first short line (usually the title).
  const titles = path()?.job_titles || [], first = jd.split(/\r?\n/).map((l) => l.trim()).find(Boolean) || "";
  const shortFirst = first.split(/\s+/).length <= 8 ? first : "";
  const jobTitles = [...new Set(titles.filter((x) => jd.toLowerCase().includes(x.toLowerCase())).slice(0, 1).concat(shortFirst ? [shortFirst] : []))].filter(Boolean);
  const report = atsReport(state.cv.text, { required, jobTitles });
  const chosen = picked && picked.jd === jd ? picked : null;
  // Text pasted for a tracked offer that had none: kept for next time (this browser only).
  if (chosen?.paste && chosen.card?.external_id && jd.trim().length > 80) {
    rememberTracked({ source: chosen.card.source, id: chosen.card.external_id, title: chosen.title, company: chosen.company, text: jd });
  }
  const offer = chosen ? { title: chosen.title, company: chosen.company, text: jd } : { title: shortFirst || t("Pasted job description"), company: "", text: jd };
  const fullReport = h("details", { class: "rounded-xl p-3 mt-4", style: "background:var(--soft)" },
    h("summary", { class: "cursor-pointer text-sm font-semibold" }, t("Full ATS report for this offer: {score}/100", { score: report.score })),
    h("div", { class: "mt-3" }, atsView(report)));
  if (!r.total) { out.replaceChildren(h("p", { class: "mute text-sm" }, t("No known skills found in this job description.")), fullReport); return; }
  const chips = (list, inCv) => list.map((n) => skillChip(n, inCv));
  // Same comparison for every CV version, best first; clicking one makes it the active version.
  const versions = loadCvs().filter((c) => c.text.trim())
    .map((c) => ({ c, score: matchSkills(required, new Set(extractSkills(c.text).map((s) => s.name))).score }))
    .sort((a, b) => b.score - a.score);
  out.replaceChildren(...[
    h("div", { class: "flex flex-wrap items-baseline gap-x-3 gap-y-1" },
      h("p", { class: "text-2xl font-bold serif", style: `color:${fitColor(r.score)}` }, t("{score}% match", { score: r.score })),
      h("p", { class: "mute text-sm" }, shortFirst ? t("with “{title}” · ", { title: shortFirst }) : "",
        t("{matched} of {total} skills from the offer are in your CV", { matched: r.matched.length, total: r.total }))),
    versions.length > 1 ? h("p", { class: "text-sm mt-1" }, h("span", { class: "mute" }, t("Your CV versions: ")),
      ...versions.flatMap(({ c, score }, i) => [i ? " · " : "", c.id === state.cv.id
        ? h("b", { style: `color:${fitColor(score)}` }, t("{name} {score}%", { name: c.name, score }))
        : h("button", { type: "button", class: "underline", style: `color:${fitColor(score)}`, title: t("Use this version"),
            onClick: () => switchCv(c.id) }, t("{name} {score}%", { name: c.name, score }))])) : null,
    h("div", { class: "flex flex-wrap gap-2 mt-3" },
      h("button", { type: "button", class: "btn", onClick: () => openTailor(offer) }, t("✍ Tailor my CV for this offer")),
      h("button", { type: "button", class: "btn-ghost", onClick: () => openCoverLetter(offer) }, t("✉ Cover letter"))),
    h("p", { class: "mute text-sm mt-4 mb-1" }, t("In your CV")),
    h("div", { class: "flex flex-wrap gap-2" }, r.matched.length ? chips(r.matched, true) : h("span", { class: "mute text-sm" }, t("None yet."))),
    h("p", { class: "mute text-sm mt-3 mb-1" }, t("Missing: add the ones you genuinely have · 📘 = open the HelloKhedma course")),
    h("div", { class: "flex flex-wrap gap-2" }, r.missing.length ? chips(r.missing, false) : h("span", { class: "mute text-sm" }, t("Nothing missing."))),
    gapTrainings(r.missing),
    fullReport,
    insightsAsk(),
  ].filter(Boolean));
  lastMatch = { jd, required, missing: r.missing };
  if (!quiet) logOffer();
}

// "Choose an offer": the market, offers seen on the Offers page (best fit first) and tracked offers with a kept text.
// picked: { jd, title, company } of the chosen offer (its text is put in the offer box), or { market: true }.
let picked = null;
const fitOf = (text) => (state.cv.text.trim() ? matchSkills(extractSkills(text).map((s) => s.name), state.cv.names) : null);
const cut = (s, n = 70) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
// Also called by refreshTracker (applications.js): the tracker cards load after this page is first drawn.
export function renderOfferPick() {
  const sel = $("#jdPick");
  if (!sel || !state.pathId) return;
  const market = marketSkills(state.pathId);
  const recent = recentOffers(state.pathId).map((o) => ({ o, fit: fitOf(`${o.title} ${o.text}`) }))
    .sort((a, b) => (b.fit?.total >= 2 ? b.fit.score : -1) - (a.fit?.total >= 2 ? a.fit.score : -1)).slice(0, 40);
  const stageName = (id) => STAGES.find((s) => s.id === id)?.label || id;
  const cards = (state.cards || []).filter((c) => !c.path_id || c.path_id === state.pathId)
    .map((c) => ({ c, o: trackedOffer(c) })).sort((a, b) => Boolean(b.o) - Boolean(a.o)).slice(0, 40);
  const name = (o) => cut([o.title, o.company].filter(Boolean).join(" · "));
  const value = picked?.market ? "market" : picked?.value || "";
  sel.replaceChildren(...[
    h("option", { value: "" }, recent.length || cards.length || market ? t("Choose an offer…") : t("No offers yet: search on the Offers page, or paste one below")),
    h("option", { value: "market", disabled: !market },
      market ? t("📊 The market: the {n} offers you've seen", { n: market.n })
        : t("📊 The market (search offers for your path first)")),
    recent.length ? h("optgroup", { label: t("Offers you've seen, best fit first") }, recent.map(({ o, fit }) =>
      h("option", { value: `r:${o.key}` }, fit?.total >= 2 ? t("{score}% · {offer}", { score: fit.score, offer: name(o) }) : name(o)))) : null,
    cards.length ? h("optgroup", { label: t("In your tracker") }, cards.map(({ c, o }) =>
      h("option", { value: `t:${c.id}` }, o ? t("{stage} · {offer}", { stage: stageName(c.stage), offer: name(c) })
        : t("{offer} (paste its text)", { offer: name(c) })))) : null,
  ].filter(Boolean));
  sel.value = [...sel.options].some((op) => op.value === value && !op.disabled) ? value : "";
}
function onOfferPick(e) {
  const v = e.target.value;
  if (!v) return;
  if (v === "market") { picked = { market: true }; $("#jd").value = ""; $("#jdClear").hidden = true; lastMatch = null; showMarket(); return; }
  const card = v.startsWith("t:") ? (state.cards || []).find((c) => `t:${c.id}` === v) : null;
  const o = card ? trackedOffer(card) : recentOffers(state.pathId).find((x) => `r:${x.key}` === v);
  if (card && !o) { // tracked before its text was kept, by hand or on another device: paste it once, kept from then on
    picked = { value: v, jd: "", title: card.title, company: card.company, card, paste: true };
    $("#jd").value = ""; $("#jdClear").hidden = true; lastMatch = null;
    const url = safeUrl(card.url);
    $("#atsOut").replaceChildren(h("p", { class: "text-sm" }, t("No text was kept for this offer (tracked before this update, by hand or on another device). Open it, copy its description and paste it in the box above: it is kept for next time."),
      url ? h("a", { href: url, target: "_blank", rel: "noopener noreferrer", class: "btn-ghost mt-2 inline-flex" }, t("Open the offer ↗")) : null));
    $("#jd").focus();
    return;
  }
  if (!o) { renderOfferPick(); return; }
  const jd = offerAsText(o);
  picked = { value: v, jd, title: o.title, company: o.company, card };
  $("#jd").value = jd;
  onAts();
}
// "The market": the CV against the skills asked most often in the offers seen for this path.
function showMarket() {
  const out = $("#atsOut"), m = marketSkills(state.pathId);
  if (!m) { picked = null; out.replaceChildren(); renderOfferPick(); return; }
  if (!state.cv.text.trim()) { out.replaceChildren(h("p", { class: "text-sm", style: "color:var(--warn)" }, t("Add your CV first (upload or paste it above)."))); return; }
  const have = m.skills.filter((s) => state.cv.names.has(s.name)), missing = m.skills.filter((s) => !state.cv.names.has(s.name));
  const score = Math.round((100 * have.length) / m.skills.length);
  out.replaceChildren(...[
    h("div", { class: "flex flex-wrap items-baseline gap-x-3 gap-y-1" },
      h("p", { class: "text-2xl font-bold serif", style: `color:${fitColor(score)}` },
        t("{matched} of {total}", { matched: have.length, total: m.skills.length })),
      h("p", { class: "mute text-sm" }, t("of the skills asked most in {path} offers are in your CV", { path: path()?.name || "" }))),
    h("p", { class: "mute text-xs mt-1" }, tn(m.n, "From the {n} offer you've seen on the Offers page (this browser, last 60 days). The % is the share of offers asking for the skill.",
      "From the {n} offers you've seen on the Offers page (this browser, last 60 days). The % is the share of offers asking for the skill.")),
    h("ul", { class: "grid gap-1.5 mt-3" }, m.skills.map((s) => skillRow(s, m.n))),
    missing.length ? h("p", { class: "mute text-sm mt-4 mb-1" }, t("Missing: add the ones you genuinely have · 📘 = open the HelloKhedma course")) : null,
    missing.length ? gapTrainings(missing.map((s) => s.name)) : h("p", { class: "text-sm mt-3" }, t("Your CV names every one of them. Choose an offer to check a specific job.")),
  ].filter(Boolean));
}

// Tabs: "maker" shows the CV maker, anything else the CV check (router.js passes the #/cv/<param>).
export function showCvTab(param) {
  const maker = param === "maker";
  $("#cvCheckTab").hidden = maker; $("#cvMakerTab").hidden = !maker;
  for (const [id, on] of [["#cvTabCheck", !maker], ["#cvTabMaker", maker]]) {
    $(id).className = on ? "btn" : "btn-ghost"; $(id).setAttribute("aria-selected", String(on));
  }
  if (maker) renderCvMaker(); else renderOfferPick();
}

export function initCvPage() {
  $("#cvTabCheck").addEventListener("click", () => { location.hash = "#/cv"; });
  $("#cvTabMaker").addEventListener("click", () => { location.hash = "#/cv/maker"; });
  initCvMaker({ onSaved: () => refreshCv({ fillEditor: true }) });
  showCvTab((location.hash.match(/^#\/cv\/([a-z0-9-]+)/) || [])[1]); // the router ran before the path content loaded
  $("#atsBtn").addEventListener("click", () => (picked?.market ? showMarket() : onAts()));
  // The match updates by itself shortly after an offer is pasted or typed.
  $("#jd").addEventListener("input", () => {
    if (picked?.paste) picked.jd = $("#jd").value; // the text of the chosen tracked offer being pasted
    else if (picked && picked.jd !== $("#jd").value) { picked = null; $("#jdPick").value = ""; } // edited: a pasted offer now
    clearTimeout(jdTimer); jdTimer = setTimeout(() => onAts({ quiet: true }), 600);
  });
  $("#jdPick").addEventListener("change", onOfferPick);
  // Leaving the box: match now if the text changed since the last match (never redraw an up-to-date result, or the
  // click that moved the focus, e.g. on "Tailor my CV", would land on a replaced button), then send the statistics.
  $("#jd").addEventListener("change", () => {
    clearTimeout(jdTimer);
    if ((lastMatch?.jd ?? "") !== $("#jd").value) onAts({ quiet: true });
    logOffer();
  });
  $("#jdClear").addEventListener("click", () => { $("#jd").value = ""; picked = null; $("#jdPick").value = ""; onAts({ quiet: true }); $("#jd").focus(); });
  $("#cv").addEventListener("input", markDirty);
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
