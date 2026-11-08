// AI engineer track (first written as "Tunisian AI Teacher"): a learning track to become an AI engineer (build apps
// with Claude and other AI tools, run them in production, maintain and improve them), in four languages: English,
// French, and Tunisian Derja in Arabic letters or in Latin letters ("3arbizi"). Its courses are also the courses of the
// AI Engineer career path (path id "ai": Training lists them, Interview prep asks their questions).
// Content: content/ai/index.json → [{ id ("ai-…"), status ("ready" | "soon"), level, minutes, lessonCount, skills,
//   name: { en, fr, ar, lat }, summary: { en, fr, ar, lat } }]; course files content/ai/<language>/<id>.json with
//   language en | fr | ar | lat, same format and structure as content/courses/ (identical code in every language).
// - Language: English or French follow the interface language (FR/EN button) by default; "hk.aiScript" = "ar" | "lat"
//   switches the track to Derja (Arabic letters or 3arbizi). Shared by the track page, its course pages and its projects.
// - renderAiTrack(): the track page (#/ai), with its portfolio projects below the courses (projects.js, "ai" catalog). Courses open in the normal course player (#/course/ai-…, courses.js),
//   which asks this module for the file, the metadata and the text direction (RTL for Arabic letters).
// Progress is stored by course id and lesson index, so it is the same in every language.
import { $, h, ls } from "./lib.js";
import { t, lang } from "./i18n.js";
import { formatMinutes } from "./coursetime.js";
import { renderProjectList } from "./projects.js";

const BASE = "content/ai/", SCRIPT_KEY = "hk.aiScript";
const DERJA = new Set(["ar", "lat"]);
export const isAiCourse = (id) => String(id).startsWith("ai-");
// Language of the track content: "ar" | "lat" when Derja was chosen, otherwise the interface language ("en" | "fr").
export const aiScript = () => { const s = ls.get(SCRIPT_KEY); return DERJA.has(s) ? s : (lang === "fr" ? "fr" : "en"); };
export const isDerja = (s = aiScript()) => DERJA.has(s);
export const setAiScript = (s) => (DERJA.has(s) ? ls.set(SCRIPT_KEY, s) : ls.del(SCRIPT_KEY));
// Attributes for a block of track content: Arabic letters read right to left (code blocks stay left to right, CSS).
export const aiDir = (s = aiScript()) => (s === "ar" ? { dir: "rtl", lang: "aeb-Arab" } : s === "lat" ? { dir: "ltr", lang: "aeb-Latn" } : { dir: "ltr", lang: s });

let index = null;
export async function loadAiIndex() {
  if (!index) index = fetch(`${BASE}index.json`).then((r) => (r.ok ? r.json() : [])).catch(() => []);
  return index;
}
// A name or summary in the current language (English when a language is missing).
export const aiText = (field, s = aiScript()) => (field && (field[s] || field.en)) || "";
// Course metadata in the current language (name, summary), as the course player expects it.
export async function aiMeta(id, s = aiScript()) {
  const c = (await loadAiIndex()).find((x) => x.id === id);
  return c ? { ...c, name: aiText(c.name, s), summary: aiText(c.summary, s), category: "AI" } : null;
}
export async function loadAiCourse(id, s = aiScript()) {
  const res = await fetch(`${BASE}${s}/${encodeURIComponent(id)}.json`);
  if (!res.ok) throw new Error(t("This course does not exist (yet)."));
  return res.json();
}

// Language switch: the interface language (English or Français), عربي, 3arbizi. onChange re-renders the caller.
export function scriptSwitch(onChange) {
  const s = aiScript(), site = lang === "fr" ? "fr" : "en";
  const b = (id, label) => h("button", { type: "button", role: "tab", class: s === id ? "btn" : "btn-ghost", "aria-selected": String(s === id),
    lang: id === "ar" ? "aeb-Arab" : id === "lat" ? "aeb-Latn" : id, onClick: () => { if (s !== id) { setAiScript(id); onChange(); } } }, label);
  return h("div", { role: "tablist", "aria-label": t("Language of the course") },
    b(site, site === "fr" ? "Français" : "English"), b("ar", "عربي"), b("lat", "3arbizi"));
}

// Track page texts: English and French go through t() (French in i18n-fr.js); Derja is written here.
const DERJA_TEXT = {
  ar: { title: "ولّي AI engineer، بالتونسي",
    intro: "كورسات بالدارجة باش تتعلّم تبني applications بالـ AI (Claude و غيرو)، تحطّها في الـ production، تحافظ عليها و تحسّنها ديما.",
    soon: "قريب", start: "ابدا", lessons: "دروس",
    projects: "مشاريع للـ portfolio", projectsIntro: "بعد الكورسات، ابني مشروع حقيقي و حطّو على GitHub: هذا اللي يحب يشوفو الـ recruiter." },
  lat: { title: "Walli AI engineer, bel tounsi",
    intro: "Courset bel derja bech tet3allem tabni applications bel AI (Claude w 8irou), t7ottha fel production, t7afedh 3liha w t7assenha dima.",
    soon: "9rib", start: "Ebda", lessons: "drous",
    projects: "Machari3 lel portfolio", projectsIntro: "Ba3d el courset, ebni machrou3 7a9i9i w 7ottou 3la GitHub: hedha elli y7eb ychoufou el recruiter." },
};
const trackText = (s) => DERJA_TEXT[s] || {
  title: t("Become an AI engineer"),
  intro: t("Courses to learn to build applications with AI (Claude and others), put them in production, maintain them and keep improving them."),
  soon: t("Soon"), start: t("Start"), lessons: t("lessons"),
  projects: t("Portfolio projects"),
  projectsIntro: t("After the courses, build a real project and put it on GitHub: that is what recruiters want to see."),
};

export async function renderAiTrack() {
  const root = $("#aiBody"), s = aiScript(), tx = trackText(s);
  const projects = h("div", { id: "aiProjects" }); // portfolio projects of the track (projects.js), in the same language
  const list = await loadAiIndex();
  const done = (() => { try { return new Set(JSON.parse(ls.get("hk.lessons") || "[]")); } catch { return new Set(); } })();
  const card = (c, i) => {
    const ready = c.status === "ready";
    const d = [...done].filter((k) => k.startsWith(`${c.id}:`)).length;
    const inner = [
      h("div", { class: "flex items-center gap-2 text-xs" },
        h("span", { class: "chip !py-0" }, String(i + 1)),
        ready ? h("span", { class: "mute" }, `${c.lessonCount} ${tx.lessons} · ≈ ${formatMinutes(c.minutes)}`) : h("span", { class: "chip !py-0 mute" }, tx.soon)),
      h("b", { class: "block" }, aiText(c.name, s)),
      h("p", { class: "mute text-sm flex-1" }, aiText(c.summary, s)),
      ready && c.lessonCount ? h("div", { class: "h-1.5 rounded-full", style: "background:var(--line)" },
        h("div", { class: "h-1.5 rounded-full", style: `width:${Math.round((d / c.lessonCount) * 100)}%;background:var(--accent)` })) : null,
      ready ? h("span", { class: "text-xs font-medium", style: "color:var(--accent)" }, d ? `${d}/${c.lessonCount}` : `${tx.start} →`) : null,
    ];
    return ready ? h("a", { href: `#/course/${c.id}`, class: "panel flex flex-col gap-2 !p-4" }, ...inner)
      : h("div", { class: "panel flex flex-col gap-2 !p-4", style: "opacity:.6" }, ...inner);
  };
  root.replaceChildren(
    h("div", { class: "flex flex-wrap items-end justify-between gap-3 pt-2" },
      h("div", aiDir(s),
        h("h1", { id: "h-ai", tabindex: "-1", class: "page-title !mb-1" }, tx.title),
        h("p", { class: "mute max-w-prose" }, tx.intro)),
      scriptSwitch(renderAiTrack)),
    list.length ? h("div", { class: "grid gap-3 sm:grid-cols-2 lg:grid-cols-3", ...aiDir(s) }, list.map(card))
      : h("p", { class: "mute" }, t("Courses could not be loaded.")),
    h("section", { class: "grid gap-3 mt-2" }, // cards keep the interface direction; their Derja text is RTL (projects.js)
      h("h2", { class: "!mb-0", ...aiDir(s) }, tx.projects), h("p", { class: "mute text-sm", ...aiDir(s) }, tx.projectsIntro), projects),
  );
  renderProjectList(projects, "ai");
}
