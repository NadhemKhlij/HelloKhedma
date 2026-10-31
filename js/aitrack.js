// "Tunisian AI Teacher": a learning track to become an AI engineer (build apps with Claude and other AI tools, run
// them in production, maintain and improve them), taught only in Tunisian Derja, in two scripts.
// Content: content/ai/index.json → [{ id ("ai-…"), status ("ready" | "soon"), level, minutes, lessonCount, skills,
//   name: { ar, lat }, summary: { ar, lat } }]; course files content/ai/ar/<id>.json (Arabic letters) and
//   content/ai/lat/<id>.json (Latin letters, "3arbizi"), same format and structure as content/courses/.
// - Script choice ("hk.aiScript": "ar" | "lat", Arabic by default) is shared by the track page and its course pages.
// - renderAiTrack(): the track page (#/ai). Courses open in the normal course player (#/course/ai-…, courses.js),
//   which asks this module for the file, the metadata and the text direction (RTL for Arabic letters).
// Progress is stored by course id and lesson index, so it is the same in both scripts.
import { $, h, ls } from "./lib.js";
import { t } from "./i18n.js";
import { formatMinutes } from "./coursetime.js";

const BASE = "content/ai/", SCRIPT_KEY = "hk.aiScript";
export const isAiCourse = (id) => String(id).startsWith("ai-");
export const aiScript = () => (ls.get(SCRIPT_KEY) === "lat" ? "lat" : "ar");
export const setAiScript = (s) => ls.set(SCRIPT_KEY, s === "lat" ? "lat" : "ar");
// Attributes for a block of Tunisian content: Arabic letters read right to left (code blocks stay left to right, CSS).
export const aiDir = (s = aiScript()) => (s === "ar" ? { dir: "rtl", lang: "aeb-Arab" } : { dir: "ltr", lang: "aeb-Latn" });

let index = null;
export async function loadAiIndex() {
  if (!index) index = fetch(`${BASE}index.json`).then((r) => (r.ok ? r.json() : [])).catch(() => []);
  return index;
}
// Course metadata in the current script (name, summary), as the course player expects it.
export async function aiMeta(id, s = aiScript()) {
  const c = (await loadAiIndex()).find((x) => x.id === id);
  return c ? { ...c, name: c.name[s], summary: c.summary[s], category: "AI" } : null;
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
  return h("div", { role: "tablist", "aria-label": t("Script") }, b("ar", "عربي"), b("lat", "3arbizi"));
}

const TEXT = {
  ar: { title: "ولّي AI engineer، بالتونسي",
    intro: "كورسات بالدارجة باش تتعلّم تبني applications بالـ AI (Claude و غيرو)، تحطّها في الـ production، تحافظ عليها و تحسّنها ديما.",
    soon: "قريب", start: "ابدا", lessons: "دروس" },
  lat: { title: "Walli AI engineer, bel tounsi",
    intro: "Courset bel derja bech tet3allem tabni applications bel AI (Claude w 8irou), t7ottha fel production, t7afedh 3liha w t7assenha dima.",
    soon: "9rib", start: "Ebda", lessons: "drous" },
};

export async function renderAiTrack() {
  const root = $("#aiBody"), s = aiScript(), tx = TEXT[s];
  const list = await loadAiIndex();
  const done = (() => { try { return new Set(JSON.parse(ls.get("hk.lessons") || "[]")); } catch { return new Set(); } })();
  const card = (c, i) => {
    const ready = c.status === "ready";
    const d = [...done].filter((k) => k.startsWith(`${c.id}:`)).length;
    const inner = [
      h("div", { class: "flex items-center gap-2 text-xs" },
        h("span", { class: "chip !py-0" }, String(i + 1)),
        ready ? h("span", { class: "mute" }, `${c.lessonCount} ${tx.lessons} · ≈ ${formatMinutes(c.minutes)}`) : h("span", { class: "chip !py-0 mute" }, tx.soon)),
      h("b", { class: "block" }, c.name[s]),
      h("p", { class: "mute text-sm flex-1" }, c.summary[s]),
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
  );
}
