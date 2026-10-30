// Offers page (#/offers): three tabs feeding one results list (state.jobs), each keeping its own results and
// message (state.<mode>Jobs / state.<mode>Msg, mode "company" for the companies tab):
// - Job search: jobs.js → job-search Edge Function (France Travail, Adzuna, JSearch); job-board links as fallback.
// - Companies I follow: companies.js (career-page APIs, watchlist in this browser, "New since last visit").
// - Remote jobs: remote.js (Jobicy, Remotive; titles filtered to the path).
// Every offer gets its skills, contract / remote tags (from the text), a fit score against the active CV and its salary
// (salary.js: provider field or description; the "≥ N k€" filter and the salary sort use the yearly amount, euros only).
// offercheck.js adds its age ("Posted 3 days ago", date filter, "Most recent" sort), its level (Junior…Lead, level
// filter) and the "⚠ Check this offer" warnings (scam signals, stale offer, no company; filter to hide them).
// Every result is also summarized for the market pulse on Home (pulse.js, this browser only).
// "✍ Tailor my CV" on each offer opens tailor.js (gaps + prompt to copy; nothing is sent); "✉ Cover letter" opens
// letters.js (prompt to copy).
// Kept in this browser: hidden and seen offers, saved searches, last location ("hk.location"), last tab ("hk.offerMode").
// Source credits required by the providers' terms: CREDITS.
import { $, h, safeUrl, ls, toast } from "./lib.js";
import { t, tn, LOCALE } from "./i18n.js";
import { CONFIG } from "./supabase.js";
import { offerAge, ageLabel, seniority, trustFlags, STALE_DAYS } from "./offercheck.js";
import { recordOffers } from "./pulse.js";
import { state, path, fitColor, skillChip } from "./state.js";
import { searchJobs, boardLinks } from "./jobs.js";
import { extractSkills, matchSkills, norm } from "./ats.js";
import { offerSalary, formatSalary } from "./salary.js";
import { searchRemote } from "./remote.js";
import {
  loadWatchlist, saveWatchlist, entryKey, PROVIDER_NAMES, SUGGESTED, titleMatcher, findCompany, fetchCompanyJobs, clearCompanyCache,
} from "./companies.js";
import { cvSwitcher, cvUsed } from "./cvpage.js";
import { openTailor } from "./tailor.js";
import { openCoverLetter } from "./letters.js";
import { refreshTracker } from "./applications.js";

const COUNTRIES = ["fr", "gb", "us", "de", "nl", "ca", "au", "be", "ch", "es", "it"];
export const LOC_KEY = "hk.location";
const HIDDEN_KEY = "hk.offers.hidden", SEEN_KEY = "hk.offers.seen", SAVED_KEY = "hk.savedSearches", MODE_KEY = "hk.offerMode";
const loadList = (k) => { try { return JSON.parse(ls.get(k) || "[]"); } catch { return []; } };
const saveSet = (k, s) => ls.set(k, JSON.stringify([...s].slice(-500)));
state.hidden = new Set(loadList(HIDDEN_KEY));
state.seen = new Set(loadList(SEEN_KEY));

/* ---------- search controls ---------- */
export function renderSearchControls() {
  const p = path();
  $("#role").replaceChildren(...(p?.job_titles || []).map((x) => h("option", { value: x }, x)));
  renderRemoteRoles();
  if (!$("#country").children.length) {
    $("#country").replaceChildren(...COUNTRIES.map((c) => h("option", { value: c, selected: c === (CONFIG.DEFAULT_COUNTRY || "fr") }, c.toUpperCase())));
  }
  renderBoards();
}
function renderBoards() {
  $("#boards").replaceChildren(...boardLinks($("#role").value, $("#loc").value.trim()).map(([name, href]) =>
    h("a", { href, target: "_blank", rel: "noopener noreferrer", class: "btn-ghost" }, name)));
}

// A new path empties every tab (results depend on the path); the caller redraws.
export function resetOffers() {
  state.jobs = []; state.searchJobs = []; state.companyJobs = []; state.companyLoaded = false; state.skillFilter = null;
  state.searchMsg = state.companyMsg = state.remoteMsg = ""; state.remoteJobs = [];
  $("#searchMsg").textContent = "";
}

/* ---------- offers: skills per offer + CV fit ---------- */
// `text` is the fuller description from the job-search function; older cached results only have `snippet`.
const jobText = (j) => `${j.title} ${j.text || j.snippet || ""}`;
// Below this many detected skills a percentage says more about the short summary than about the fit.
const MIN_SKILLS_FOR_FIT = 2;

const offerKey = (j) => `${j.source}:${j.id}`;

// Contract type and remote policy, detected from the offer text (EN + FR wording). null when not stated.
function offerTags(j) {
  const text = norm(`${j.title} ${j.text || j.snippet || ""}`), title = norm(j.title);
  const contract =
    /alternance|apprenti|apprentissage|work[- ]study/.test(text) ? "Apprenticeship"
    : /\bstage\b|stagiaire|internship|\bintern\b/.test(title) || /stagiaire|internship/.test(text) ? "Internship"
    : /\bcdi\b|permanent contract|contrat a duree indeterminee/.test(text) ? "CDI"
    : /\bcdd\b|fixed[- ]term|contrat a duree determinee/.test(text) ? "CDD"
    : /freelance|independant|contractor|portage salarial|\btjm\b/.test(text) ? "Freelance" : null;
  const remote =
    /full remote|fully remote|100 ?% remote|100 ?% teletravail|teletravail complet|remote first/.test(text) ? "Remote"
    : /hybride|hybrid|teletravail|remote|a distance/.test(text) ? "Hybrid" : null;
  return { contract, remote };
}

function toggleHidden(key) {
  state.hidden.has(key) ? state.hidden.delete(key) : state.hidden.add(key);
  saveSet(HIDDEN_KEY, state.hidden);
  renderOffers();
}
function markSeen(key) {
  if (state.seen.has(key)) return;
  state.seen.add(key);
  saveSet(SEEN_KEY, state.seen);
  setTimeout(renderOffers, 300); // after the new tab opened
}

async function track(job, btn) {
  try {
    await state.store.add({ path_id: state.pathId, title: job.title, company: job.company, location: job.location,
      url: job.url, source: job.source, external_id: job.id, stage: "saved", cv_version: cvUsed(),
      salary: job.salaryInfo ? formatSalary(job.salaryInfo) : undefined }); // shown on the tracker card
    btn.disabled = true; btn.textContent = t("Tracked");
    toast(t("Added to Saved"));
    await refreshTracker();
  } catch (e) { toast(e.code === "DUPLICATE" ? t("Already in your tracker") : e.message); }
}

// "⚠ Check this offer" (serious signals) or "🕒 Worth checking" (stale / no company): a folded list of the reasons.
function trustPanel(flags) {
  if (!flags.length) return null;
  const serious = flags.some((f) => f.serious), color = serious ? "#e0508b" : "#f08a24";
  return h("details", { class: "mt-2 text-xs" },
    h("summary", { class: "chip !py-0 text-xs font-medium cursor-pointer w-fit", style: `border-color:${color};color:${color}` },
      serious ? t("⚠ Check this offer") : t("🕒 Worth checking")),
    h("ul", { class: "grid gap-1 mt-2 pl-4 list-disc" }, flags.map((f) => h("li", {}, f.text))),
    h("p", { class: "mute mt-1" }, serious
      ? t("These are warning signs, not proof. Look the company up on its own website, and never pay or share bank details to apply.")
      : t("Look the company up and check the offer is still open on its website before applying.")));
}

function renderJob({ j, skills, fit, tags, key, salary, days, level, flags }) {
  const url = safeUrl(j.url);
  const tracked = state.cards.some((c) => c.external_id === j.id && c.source === j.source);
  const hidden = state.hidden.has(key), seen = state.seen.has(key);
  const btn = tracked
    ? h("button", { type: "button", class: "btn-ghost", disabled: true }, t("Tracked ✓"))
    : h("button", { type: "button", class: "btn-ghost", onClick: (e) => track(j, e.currentTarget) }, t("Track"));
  const hideBtn = h("button", { type: "button", class: "btn-ghost !px-2", title: hidden ? t("Show this offer again") : t("Hide this offer from future results"),
    onClick: () => toggleHidden(key) }, hidden ? t("Unhide") : t("Not interested"));
  const tag = (text) => h("span", { class: "chip !py-0 text-xs" }, text);
  const badge = fit?.score != null
    ? h("span", { class: "chip text-xs font-bold shrink-0 ml-auto whitespace-nowrap", style: `border-color:${fitColor(fit.score)};color:${fitColor(fit.score)}`,
        title: t("{matched} of {total} skills from this offer are in your CV", { matched: fit.matched.length, total: fit.total }) },
        t("{score}% fit · {matched}/{total}", { score: fit.score, matched: fit.matched.length, total: fit.total }))
    : fit ? h("span", { class: "mute text-xs shrink-0 ml-auto whitespace-nowrap", title: t("The offer summary names too few skills to score it.") }, t("Fit: n/a"))
    : null;
  return h("li", { class: "rounded-lg p-3", style: `background:var(--bg);border:1px solid var(--line);${hidden || seen ? "opacity:.7" : ""}` },
    h("div", { class: "flex items-start gap-2" },
      h("div", { class: "min-w-0" },
        h("b", { class: "block" }, j.title),
        h("span", { class: "mute text-sm block" }, [j.company, j.location].filter(Boolean).join(" · "))),
      badge),
    salary || tags.contract || tags.remote || seen || hidden || j.isNew || days != null || level ? h("div", { class: "flex flex-wrap gap-1.5 mt-2" },
      days != null ? h("span", { class: "chip !py-0 text-xs", style: days > STALE_DAYS ? "border-color:#f08a24;color:#f08a24" : "",
        title: new Date(j.posted).toLocaleDateString(LOCALE) }, ageLabel(days)) : null,
      level ? tag(t(`level|${level}`)) : null,
      salary ? h("span", { class: "chip chip-ok !py-0 text-xs font-medium",
        title: salary.estimated ? t("Estimated by the job site, not given by the employer") : t("Salary given in the offer") },
        `💶 ${formatSalary(salary)}`) : null,
      j.isNew ? h("span", { class: "chip chip-ok !py-0 text-xs font-bold", style: "color:var(--accent)" }, t("New")) : null,
      tags.contract ? tag(t(tags.contract)) : null,
      tags.remote ? tag(tags.remote === "Remote" ? t("Full remote") : t("Hybrid / remote")) : null,
      seen ? h("span", { class: "mute text-xs" }, t("Seen")) : null,
      hidden ? h("span", { class: "mute text-xs" }, t("Hidden")) : null) : null,
    skills.length
      ? h("div", { class: "flex flex-wrap gap-1.5 mt-2", "aria-label": t("Skills in this offer") }, skills.slice(0, 8).map((s) => skillChip(s, state.cv.names.has(s))))
      : h("p", { class: "mute text-xs mt-2" }, t("No specific skills detected in the offer summary.")),
    h("p", { class: "text-sm mt-2 mute" }, j.snippet),
    trustPanel(flags),
    h("div", { class: "flex flex-wrap items-center gap-2 mt-2" },
      url ? h("a", { href: url, target: "_blank", rel: "noopener noreferrer", class: "btn", onClick: () => markSeen(key) }, t("View offer")) : null,
      btn, hideBtn,
      h("button", { type: "button", class: "btn-ghost !px-2", title: t("Gaps and a ready-made prompt to adapt your CV to this offer"),
        onClick: () => openTailor({ title: j.title, company: j.company, text: jobText(j) }) }, t("✍ Tailor my CV")),
      h("button", { type: "button", class: "btn-ghost !px-2", title: t("A ready-made prompt to write a cover letter for this offer"),
        onClick: () => openCoverLetter({ title: j.title, company: j.company, text: jobText(j) }) }, t("✉ Cover letter")),
      h("span", { class: "mute text-xs ml-auto" },
        SOURCE_NAMES[j.source] || (PROVIDER_NAMES[j.source] ? t("Careers page") : j.source))));
}
const SOURCE_NAMES = { francetravail: "France Travail", adzuna: "Adzuna", jsearch: "JSearch", remotive: "Remotive", jobicy: "Jobicy" };

export function renderOffers() {
  const hasCv = state.cv.skills.length > 0;
  if (!state.jobs.length) { $("#offerTools").hidden = true; $("#results").replaceChildren(); $("#sourceCredits").replaceChildren(); return; }
  let list = state.jobs.map((j) => {
    const skills = extractSkills(jobText(j)).map((s) => s.name);
    let fit = hasCv ? matchSkills(skills, state.cv.names) : null;
    if (fit && fit.total < MIN_SKILLS_FOR_FIT) fit = { ...fit, score: null };
    const salary = offerSalary(j);
    j.salaryInfo = salary; // kept for Track, which copies it into the application
    const days = offerAge(j);
    return { j, skills, fit, tags: offerTags(j), key: offerKey(j), salary, days, level: seniority(j), flags: trustFlags(j, days) };
  });
  recordOffers(list); // market pulse on Home (pulse.js): every result counts, hidden ones too
  const total = list.length, showHidden = $("#fHidden").checked;
  const hiddenCount = list.filter((x) => state.hidden.has(x.key)).length;
  if (!showHidden) list = list.filter((x) => !state.hidden.has(x.key));

  // Skills most requested across these offers; clicking one filters the list.
  const freq = new Map();
  list.forEach((x) => x.skills.forEach((s) => freq.set(s, (freq.get(s) || 0) + 1)));
  if (state.skillFilter && !freq.has(state.skillFilter)) state.skillFilter = null;
  $("#offerSkills").replaceChildren(...[...freq].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([name, n]) => {
    const on = state.skillFilter === name, inCv = state.cv.names.has(name);
    return h("button", { type: "button", class: `chip text-xs ${inCv ? "chip-ok" : ""}`, "aria-pressed": String(on),
      style: on ? "background:var(--accent);color:#fff" : "",
      onClick: () => { state.skillFilter = on ? null : name; renderOffers(); } }, `${inCv ? "✓ " : ""}${name} · ${n}`);
  }));

  const scored = list.filter((x) => x.fit?.score != null);
  const avg = scored.length ? Math.round(scored.reduce((a, x) => a + x.fit.score, 0) / scored.length) : null;
  $("#fitNote").replaceChildren(hasCv
    ? h("span", {}, t("Average CV fit: "), h("b", { style: avg == null ? "" : `color:${fitColor(avg)}` }, avg == null ? t("n/a") : t("{n}%", { n: avg })),
        cvSwitcher(), h("span", { class: "mute" }, t(" · ✓ = skill found in your CV")))
    : h("span", { class: "mute" }, t("Add your CV on the "),
        h("a", { href: "#/cv", class: "underline", style: "color:var(--accent)" }, t("CV check")), t(" page to see how well you fit each offer."),
        cvSwitcher()));

  $("#fFit").disabled = !hasCv;
  const contract = $("#fContract").value, remote = $("#fRemote").value, minFit = hasCv ? Number($("#fFit").value) : 0;
  const salaryFilter = $("#fSalary").value, withSalary = list.filter((x) => x.salary).length;
  // "≥ N k€" compares yearly amounts in euros: offers in another currency are not converted, so they are left out.
  const salaryOk = (x) => !salaryFilter || (salaryFilter === "shown" ? Boolean(x.salary)
    : x.salary?.currency === "EUR" && x.salary.yearMax >= Number(salaryFilter));
  // Date: offers without a date are left out (their age can't be checked). Level: offers that state no level stay in.
  const maxDays = Number($("#fDate").value), level = $("#fLevel").value, hideFlagged = $("#fTrust").checked;
  const flaggedCount = list.filter((x) => x.flags.some((f) => f.serious)).length;
  list = list.filter((x) =>
    (!state.skillFilter || x.skills.includes(state.skillFilter))
    && (!contract || x.tags.contract === contract)
    && (!remote || (remote === "Remote" ? x.tags.remote === "Remote" : Boolean(x.tags.remote)))
    && (!minFit || (x.fit?.score ?? -1) >= minFit)
    && salaryOk(x)
    && (!maxDays || (x.days != null && x.days <= maxDays))
    && (!level || !x.level || x.level === level)
    && (!hideFlagged || !x.flags.some((f) => f.serious)));
  const sort = $("#sortBy").value;
  if (hasCv && sort === "fit") list = [...list].sort((a, b) => (b.fit?.score ?? -1) - (a.fit?.score ?? -1));
  if (sort === "salary") list = [...list].sort((a, b) => (b.salary?.yearMax ?? -1) - (a.salary?.yearMax ?? -1));
  if (sort === "recent") list = [...list].sort((a, b) => (a.days ?? 1e9) - (b.days ?? 1e9));
  $("#fitNote").append(h("span", { class: "mute" }, t(" · Showing {shown} of {total}", { shown: list.length, total })
    + (hiddenCount ? t(" ({n} hidden)", { n: hiddenCount }) : "")),
    h("span", { class: "mute", title: t("An EU directive will require a pay range in every job ad; France plans to apply it in 2027.") },
      t(" · {n} with a salary", { n: withSalary })),
    flaggedCount ? h("span", { style: "color:#e0508b" }, t(" · ⚠ {n} to check", { n: flaggedCount })) : "");
  $("#offerTools").hidden = false;
  $("#results").replaceChildren(...(list.length ? list.map(renderJob)
    : [h("li", { class: "mute text-sm" }, t("No offer matches these filters. Loosen a filter to see more."))]));
  renderSourceCredits();
}

// Attribution required by the job providers' terms, for the sources present in the results.
const CREDITS = {
  remotive: ["Remotive", "https://remotive.com"],
  jobicy: ["Jobicy", "https://jobicy.com"],
  adzuna: ["Jobs by Adzuna", "https://www.adzuna.fr"], // provider's required wording: not translated
  jsearch: ["JSearch by OpenWeb Ninja", "https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch"],
  francetravail: ["France Travail", "https://www.francetravail.fr"],
};
function renderSourceCredits() {
  const used = [...new Set(state.jobs.map((j) => j.source))].filter((s) => CREDITS[s]);
  $("#sourceCredits").replaceChildren(...(used.length ? [t("Job offers: "), ...used.flatMap((s, i) => [
    i ? " · " : "", h("a", { href: CREDITS[s][1], target: "_blank", rel: "noopener noreferrer", class: "underline" }, CREDITS[s][0])])] : []));
}

/* ---------- saved searches (this browser) ---------- */
const currentSearch = () => ({ query: $("#role").value, location: $("#loc").value.trim(), provider: $("#provider").value, country: $("#country").value });
const sameSearch = (a, b) => ["query", "location", "provider", "country"].every((k) => a[k] === b[k]);

function renderSavedSearches() {
  const saved = loadList(SAVED_KEY);
  $("#savedSearches").replaceChildren(...saved.map((s, i) => h("span", { class: "chip text-xs flex items-center gap-2" },
    h("button", { type: "button", class: "hover:underline", title: t("Run this search"), onClick: () => runSavedSearch(s) },
      `☆ ${s.query}${s.location ? ` · ${s.location}` : ""} · ${s.country.toUpperCase()}`),
    h("button", { type: "button", class: "mute", "aria-label": t("Remove saved search {query}", { query: s.query }), onClick: () => {
      const list = loadList(SAVED_KEY); list.splice(i, 1); ls.set(SAVED_KEY, JSON.stringify(list)); renderSavedSearches();
    } }, "×"))));
}
function onSaveSearch() {
  const s = currentSearch();
  ls.set(SAVED_KEY, JSON.stringify([s, ...loadList(SAVED_KEY).filter((x) => !sameSearch(x, s))].slice(0, 8)));
  renderSavedSearches();
  toast(t("Search saved. Click it any time to run it again."));
}
function runSavedSearch(s) {
  // A search saved on another path may use a job title that is not in the current list.
  if (![...$("#role").options].some((o) => o.value === s.query)) $("#role").append(h("option", { value: s.query }, s.query));
  $("#role").value = s.query; $("#loc").value = s.location; $("#country").value = s.country; $("#provider").value = s.provider;
  renderBoards();
  $("#searchForm").requestSubmit();
}

async function onSearch(e) {
  e.preventDefault();
  const btn = $("#searchBtn"), msg = $("#searchMsg");
  const params = currentSearch();
  ls.set(LOC_KEY, params.location);
  btn.disabled = true; msg.textContent = t("Searching…");
  state.jobs = []; state.skillFilter = null; renderOffers();
  try {
    const { jobs, warnings } = await searchJobs(params);
    msg.textContent = jobs.length ? tn(jobs.length, "{n} offer.", "{n} offers.") + (warnings.length ? " " + warnings.join(" ") : "")
      : t("No offers found. Try another title, city or country.");
    state.jobs = jobs;
  } catch (err) {
    msg.textContent = t("Live search is unavailable ({msg}). Use the job board links below.", { msg: err.message });
  } finally { btn.disabled = false; }
  state.searchJobs = state.jobs; state.searchMsg = msg.textContent; // kept while switching to "Companies I follow"
  renderOffers();
}

/* ---------- tabs: "Job search", "Companies I follow", "Remote jobs" (all feed the same results list) ---------- */
const OFFER_MODES = { search: ["#tabSearch", "#searchPanel"], companies: ["#tabCompanies", "#companiesPanel"], remote: ["#tabRemote", "#remotePanel"] };
function setOfferMode(mode) {
  state.offerMode = mode in OFFER_MODES ? mode : "search";
  ls.set(MODE_KEY, state.offerMode);
  for (const [m, [tab, panel]] of Object.entries(OFFER_MODES)) {
    const on = m === state.offerMode;
    $(panel).hidden = !on;
    $(tab).className = on ? "btn" : "btn-ghost";
    $(tab).setAttribute("aria-selected", String(on));
  }
  $("#boardsBlock").hidden = state.offerMode !== "search";
  state.skillFilter = null;
  state.jobs = state[`${state.offerMode === "companies" ? "company" : state.offerMode}Jobs`] || [];
  $("#searchMsg").textContent = state[`${state.offerMode === "companies" ? "company" : state.offerMode}Msg`] || "";
  renderOffers();
  if (state.offerMode === "companies") { renderWatchlist(); if (!state.companyLoaded) loadCompanyJobs(); }
}

/* ---------- remote jobs (Remotive + Jobicy, browser-side, cached 6 h) ---------- */
function renderRemoteRoles() {
  $("#remoteBtn").textContent = t("Find remote {path} jobs", { path: path()?.name || "" });
}
async function onRemoteSearch(e) {
  e.preventDefault();
  const btn = $("#remoteBtn"), msg = $("#searchMsg");
  btn.disabled = true; msg.textContent = t("Searching remote job boards…");
  try {
    const { jobs, warnings, cached } = await searchRemote(state.pathId, $("#remoteRegion").value);
    // The boards' keyword search is loose: keep titles that match the path (as for "Companies I follow").
    const matches = titleMatcher(path()), relevant = jobs.filter((j) => matches(j.title));
    const name = path()?.name || "", left = jobs.length - relevant.length;
    state.remoteJobs = relevant;
    state.remoteMsg = (relevant.length
      ? tn(relevant.length, "{n} remote {path} offer", "{n} remote {path} offers", { path: name })
        + (left ? t(" ({n} unrelated titles left out)", { n: left }) : "") + (cached ? t(" · from the last 6 hours") : "") + "."
      : $("#remoteRegion").value ? t("No remote {path} offers right now for this region: try 'Anywhere'.", { path: name })
      : t("No remote {path} offers right now: these boards list few roles for this path, check back in a few days.", { path: name }))
      + (warnings.length ? ` ${warnings.join(" ")}` : "");
  } catch (err) {
    state.remoteJobs = []; state.remoteMsg = t("Remote job boards are unavailable ({msg}).", { msg: err.message });
  } finally { btn.disabled = false; }
  if (state.offerMode === "remote") { state.jobs = state.remoteJobs; msg.textContent = state.remoteMsg; state.skillFilter = null; renderOffers(); }
}

/* ---------- companies I follow ---------- */
function renderWatchlist() {
  const list = loadWatchlist();
  $("#tabCompanies").textContent = t("Companies I follow") + (list.length ? ` (${list.length})` : "");
  $("#companyList").replaceChildren(...(list.length ? list.map((e) => h("span", { class: "chip text-xs flex items-center gap-2" },
    h("span", {}, e.name, h("span", { class: "mute" }, ` · ${PROVIDER_NAMES[e.provider]}${e.count ? ` · ${tn(e.count, "{n} job", "{n} jobs")}` : ""}`)),
    h("button", { type: "button", class: "mute", "aria-label": t("Stop following {name}", { name: e.name }), title: t("Stop following"), onClick: () => unfollow(e) }, "×")))
    : [h("p", { class: "mute text-sm" }, t("You don't follow any company yet. Add one above or pick a suggestion."))]));
  const followed = new Set(list.map(entryKey));
  const sugg = SUGGESTED.filter((s) => !followed.has(entryKey(s)));
  $("#companySuggest").replaceChildren(...(sugg.length ? [
    h("p", { class: "mute text-xs mb-1" }, t("Popular in France, one click to follow:")),
    h("div", { class: "flex flex-wrap gap-1.5" }, sugg.map((s) =>
      h("button", { type: "button", class: "chip text-xs hover:opacity-80", onClick: () => follow(s) }, `+ ${s.name}`)))] : []));
}

function follow(e) {
  const list = loadWatchlist();
  if (!list.some((x) => entryKey(x) === entryKey(e))) {
    list.push({ provider: e.provider, slug: e.slug, name: e.name, count: e.count ?? null, added: new Date().toISOString() });
    saveWatchlist(list);
  }
  renderWatchlist();
  loadCompanyJobs();
}
function unfollow(e) {
  saveWatchlist(loadWatchlist().filter((x) => entryKey(x) !== entryKey(e)));
  renderWatchlist();
  loadCompanyJobs();
}

async function onCompanyFind(ev) {
  ev.preventDefault();
  const input = $("#companyInput").value.trim(), btn = $("#companyFind"), msg = $("#companyMsg");
  if (!input) return;
  btn.disabled = true; msg.textContent = t("Looking for {name}'s careers page…", { name: input });
  try {
    const found = (await findCompany(input)).sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
    if (!found.length) {
      msg.textContent = t("No careers page found for \"{name}\" on Greenhouse, Lever, Ashby, Workable or SmartRecruiters. Try the exact company name, or paste the link of a job on their careers site.", { name: input });
      return;
    }
    const best = found[0]; // a company present on two systems (during a migration) keeps the one with most jobs
    follow(best);
    msg.textContent = t("Following {name} ({provider}{count}).", { name: best.name, provider: PROVIDER_NAMES[best.provider],
      count: best.count ? tn(best.count, ", {n} open job in total", ", {n} open jobs in total") : "" });
    $("#companyInput").value = "";
  } catch (e) { msg.textContent = e.message; } finally { btn.disabled = false; }
}

// Loads every followed company's jobs into the shared results list. "New" = published since the previous session.
export async function loadCompanyJobs({ force = false } = {}) {
  const list = loadWatchlist();
  const run = (state.companyRun = (state.companyRun || 0) + 1); // only the latest load may update the screen
  if (force) clearCompanyCache();
  state.companyLoaded = true;
  state.prevChecked ??= Object.fromEntries(list.map((e) => [entryKey(e), e.lastChecked]));
  const pathOnly = $("#companyPathOnly").checked, p = path();
  const show = (m) => { state.companyMsg = m; if (state.offerMode === "companies") { state.jobs = state.companyJobs; $("#searchMsg").textContent = m; renderOffers(); } };
  if (!list.length) { state.companyJobs = []; show(""); return; }
  if (state.offerMode === "companies") $("#searchMsg").textContent = tn(list.length, "Loading jobs from {n} company…", "Loading jobs from {n} companies…");
  const results = await Promise.allSettled(list.map((e) =>
    fetchCompanyJobs(e, pathOnly ? titleMatcher(p) : () => true, pathOnly ? state.pathId : "all")));
  const jobs = [], errors = [];
  results.forEach((r, i) => {
    const prev = state.prevChecked[entryKey(list[i])];
    if (r.status === "fulfilled") {
      jobs.push(...r.value.map((j) => ({ ...j, isNew: Boolean(prev && j.posted && new Date(j.posted) > new Date(prev)) })));
    } else errors.push(r.reason?.message || list[i].name);
  });
  // Re-read the watchlist: companies may have been followed / unfollowed while this load was running.
  const checked = new Set(list.filter((_, i) => results[i].status === "fulfilled").map(entryKey)), now = new Date().toISOString();
  saveWatchlist(loadWatchlist().map((e) => (checked.has(entryKey(e)) ? { ...e, lastChecked: now } : e)));
  if (run !== state.companyRun) return;
  state.companyJobs = jobs.sort((a, b) => new Date(b.posted || 0) - new Date(a.posted || 0));
  const fresh = jobs.filter((j) => j.isNew).length, where = tn(list.length, "at {n} company", "at {n} companies");
  show((jobs.length
    ? tn(jobs.length, "{n} open role", "{n} open roles") + (pathOnly ? t(" for {path}", { path: p?.name }) : "") + ` ${where}`
      + (fresh ? t(" · {n} new since your last visit", { n: fresh }) : "") + "."
    : pathOnly ? t("No open {path} roles {where} right now. Untick \"Only roles for my path\" to see every job.", { path: p?.name, where })
    : t("No open roles {where} right now.", { where }))
    + (errors.length ? t(" Could not load: {list}.", { list: errors.join("; ") }) : ""));
}

export function initOffers() {
  $("#loc").value = ls.get(LOC_KEY) || "";
  $("#role").addEventListener("change", renderBoards);
  $("#loc").addEventListener("input", renderBoards);
  $("#searchForm").addEventListener("submit", onSearch);
  for (const id of ["#sortBy", "#fContract", "#fRemote", "#fFit", "#fSalary", "#fDate", "#fLevel", "#fTrust", "#fHidden"]) $(id).addEventListener("change", renderOffers);
  $("#saveSearch").addEventListener("click", onSaveSearch);
  renderSavedSearches();
  $("#tabSearch").addEventListener("click", () => setOfferMode("search"));
  $("#tabCompanies").addEventListener("click", () => setOfferMode("companies"));
  $("#tabRemote").addEventListener("click", () => setOfferMode("remote"));
  $("#remoteForm").addEventListener("submit", onRemoteSearch);
  $("#companyForm").addEventListener("submit", onCompanyFind);
  $("#companyPathOnly").addEventListener("change", () => loadCompanyJobs());
  $("#companyRefresh").addEventListener("click", () => loadCompanyJobs({ force: true }));
  renderWatchlist();
  setOfferMode(ls.get(MODE_KEY));
}
