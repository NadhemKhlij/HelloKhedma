// AI Engineer track: learn to become an AI engineer (build apps with Claude and other AI tools, run them in production,
// maintain and improve them). Born as "Tunisian AI Teacher" in Tunisian Derja (Arabic letters and 3arbizi); English and
// French versions added 2026-11-08, when AI Engineer also became a job path ("ai", seed.sql).
// Content: content/ai/index.json → [{ id ("ai-…"), status ("ready" | "soon"), level, minutes, lessonCount, skills,
//   name: { ar, lat, en, fr }, summary: { ar, lat, en, fr } }]; course files content/ai/<language>/<id>.json:
//   ar (Arabic letters), lat (Latin letters, "3arbizi"), en, fr; same format and structure as content/courses/.
// - Language choice ("hk.aiScript": "en" | "fr" | "ar" | "lat") is shared by the track page and its course pages; until
//   the visitor picks one, it follows the interface language (English or French).
// - renderAiTrack(): the track page (#/ai), with its portfolio projects below the courses (projects.js, "ai" catalog). Courses open in the normal course player (#/course/ai-…, courses.js),
//   which asks this module for the file, the metadata and the text direction (RTL for Arabic letters).
// Progress is stored by course id and lesson index, so it is the same in both scripts.
import { $, h, ls } from "./lib.js";
import { t, lang } from "./i18n.js";
import { formatMinutes } from "./coursetime.js";
import { renderProjectList } from "./projects.js";

const BASE = "content/ai/", SCRIPT_KEY = "hk.aiScript";
export const isAiCourse = (id) => String(id).startsWith("ai-");
const SCRIPTS = ["en", "fr", "ar", "lat"];
export const aiScript = () => { const v = ls.get(SCRIPT_KEY); return SCRIPTS.includes(v) ? v : lang === "fr" ? "fr" : "en"; };
export const setAiScript = (s) => ls.set(SCRIPT_KEY, SCRIPTS.includes(s) ? s : "en");
// Attributes for a block of track content: Arabic letters read right to left (code blocks stay left to right, CSS).
const DIRS = { ar: { dir: "rtl", lang: "aeb-Arab" }, lat: { dir: "ltr", lang: "aeb-Latn" }, en: { dir: "ltr", lang: "en" }, fr: { dir: "ltr", lang: "fr" } };
export const aiDir = (s = aiScript()) => DIRS[s] || DIRS.en;

let index = null;
export async function loadAiIndex() {
  if (!index) index = fetch(`${BASE}index.json`).then((r) => (r.ok ? r.json() : [])).catch(() => []);
  return index;
}
// Course metadata in the current script (name, summary), as the course player expects it.
export async function aiMeta(id, s = aiScript()) {
  const c = (await loadAiIndex()).find((x) => x.id === id);
  return c ? { ...c, name: c.name[s] || c.name.lat, summary: c.summary[s] || c.summary.lat, category: "AI" } : null;
}
export async function loadAiCourse(id, s = aiScript()) {
  const res = await fetch(`${BASE}${s}/${encodeURIComponent(id)}.json`);
  if (!res.ok) throw new Error(t("This course does not exist (yet)."));
  return res.json();
}

// Arabic / 3arbizi switch. onChange re-renders the caller.
export function scriptSwitch(onChange) {
  const s = aiScript();
  const b = (id, label) => h("button", { type: "button", role: "tab", class: s === id ? "btn" : "btn-ghost", "aria-selected": String(s === id),
    onClick: () => { if (s !== id) { setAiScript(id); onChange(); } } }, label);
  return h("div", { role: "tablist", "aria-label": t("Course language"), class: "flex flex-wrap gap-1" },
    b("en", "English"), b("fr", "Français"), b("ar", "عربي"), b("lat", "3arbizi"));
}

const TEXT = {
  en: { title: "Become an AI engineer",
    intro: "Courses to learn to build applications with AI (Claude and others), put them in production, keep them running and keep improving them. Also in French, Tunisian Arabic and 3arbizi.",
    soon: "Soon", start: "Start", lessons: "lessons",
    projects: "Portfolio projects", projectsIntro: "After the courses, build a real project and put it on GitHub: that is what recruiters want to see." },
  fr: { title: "Devenir AI engineer",
    intro: "Des cours pour apprendre à construire des applications avec l’IA (Claude et d’autres), les mettre en production, les maintenir et les améliorer en continu. Aussi en anglais, en tunisien et en 3arbizi.",
    soon: "Bientôt", start: "Commencer", lessons: "leçons",
    projects: "Projets pour le portfolio", projectsIntro: "Après les cours, construisez un vrai projet et publiez-le sur GitHub : c’est ce que les recruteurs veulent voir." },
  ar: { title: "ولّي AI engineer، بالتونسي",
    intro: "كورسات بالدارجة باش تتعلّم تبني applications بالـ AI (Claude و غيرو)، تحطّها في الـ production، تحافظ عليها و تحسّنها ديما.",
    soon: "قريب", start: "ابدا", lessons: "دروس",
    projects: "مشاريع للـ portfolio", projectsIntro: "بعد الكورسات، ابني مشروع حقيقي و حطّو على GitHub: هذا اللي يحب يشوفو الـ recruiter." },
  lat: { title: "Walli AI engineer, bel tounsi",
    intro: "Courset bel derja bech tet3allem tabni applications bel AI (Claude w 8irou), t7ottha fel production, t7afedh 3liha w t7assenha dima.",
    soon: "9rib", start: "Ebda", lessons: "drous",
    projects: "Machari3 lel portfolio", projectsIntro: "Ba3d el courset, ebni machrou3 7a9i9i w 7ottou 3la GitHub: hedha elli y7eb ychoufou el recruiter." },
};

export async function renderAiTrack() {
  const root = $("#aiBody"), s = aiScript(), tx = TEXT[s];
  const projects = h("div", { id: "aiProjects" }); // portfolio projects of the track (projects.js), in the same script
  const list = await loadAiIndex();
  const done = (() => { try { return new Set(JSON.parse(ls.get("hk.lessons") || "[]")); } catch { return new Set(); } })();
  const card = (c, i) => {
    const ready = c.status === "ready";
    const d = [...done].filter((k) => k.startsWith(`${c.id}:`)).length;
    const inner = [
      h("div", { class: "flex items-center gap-2 text-xs" },
        h("span", { class: "chip !py-0" }, String(i + 1)),
        ready ? h("span", { class: "mute" }, `${c.lessonCount} ${tx.lessons} · ≈ ${formatMinutes(c.minutes)}`) : h("span", { class: "chip !py-0 mute" }, tx.soon)),
      h("b", { class: "block" }, c.name[s] || c.name.lat),
      h("p", { class: "mute text-sm flex-1" }, c.summary[s] || c.summary.lat),
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
