// Portfolio projects (ROADMAP 4.5): guided projects a junior builds to prove a skill, then shows on a CV or in an interview.
// Content: content/projects/<path id>.json → { projects: [{ id ("<path>-<slug>"), title, level, hours, skills, summary,
//   why, data: [{ name, url, note }], steps: [{ title, text }], deliverables, checklist, cv: { bullet, talk }, stretch }] }
//   French copy in content/projects/fr/ (same ids, same array lengths: progress is stored by index).
// - renderProjectList(root, pathId): the "Portfolio projects" panel of the Training page (cards with step progress).
// - renderProject(id): the project page (#/project/<id>): data links, steps to tick, deliverables, self-check, the CV
//   bullet to copy and how to talk about it, stretch ideas.
// Progress is kept in this browser ("hk.projects": "<id>:s<i>" for steps, "<id>:c<i>" for checklist items). XP via activity.js.
import { $, h, ls, safeUrl, copyText } from "./lib.js";
import { t, fetchContent } from "./i18n.js";
import { state, skillChip } from "./state.js";
import { logActivity } from "./activity.js";

const BASE = "content/projects/", KEY = "hk.projects";
const cache = new Map();
const marks = () => { try { return new Set(JSON.parse(ls.get(KEY) || "[]")); } catch { return new Set(); } };
const saveMarks = (s) => ls.set(KEY, JSON.stringify([...s]));
const pathOf = (id) => String(id).split("-")[0];

export async function loadProjects(pathId) {
  if (!pathId) return [];
  if (!cache.has(pathId)) cache.set(pathId, fetchContent(BASE, `${pathId}.json`).then((d) => d.projects || []).catch(() => []));
  return cache.get(pathId);
}

const stepsDone = (p, s = marks()) => p.steps.filter((_, i) => s.has(`${p.id}:s${i}`)).length;
const bar = (done, all) => h("div", { class: "h-1.5 rounded-full", style: "background:var(--line)" },
  h("div", { class: "h-1.5 rounded-full", style: `width:${all ? Math.round((done / all) * 100) : 0}%;background:${done && done === all ? "#18a999" : "var(--accent)"}` }));

export async function renderProjectList(root, pathId) {
  if (!root) return;
  const list = await loadProjects(pathId);
  if (!list.length) { root.replaceChildren(h("p", { class: "mute text-sm" }, t("No projects for this path yet."))); return; }
  const s = marks();
  root.replaceChildren(h("div", { class: "grid gap-3 md:grid-cols-3" }, list.map((p) => {
    const d = stepsDone(p, s), n = p.steps.length;
    return h("a", { href: `#/project/${p.id}`, class: "panel flex flex-col gap-2 !p-4" },
      h("div", { class: "flex items-center gap-2" },
        h("span", { class: "chip !py-0 text-xs" }, p.level), h("span", { class: "mute text-xs ml-auto" }, t("≈ {n} h hands-on", { n: p.hours }))),
      h("b", {}, p.title),
      h("p", { class: "mute text-sm flex-1" }, p.summary),
      h("div", { class: "flex flex-wrap gap-1" }, p.skills.slice(0, 5).map((x) => h("span", { class: `chip !py-0 text-xs ${state.cv.names.has(x) ? "chip-ok" : "mute"}` }, x))),
      bar(d, n),
      h("span", { class: "text-xs font-medium", style: d === n ? "color:#18a999" : d ? "color:var(--accent)" : "" },
        d === n ? t("✓ All steps done") : d ? t("{d}/{n} steps", { d, n }) : t("Start →")));
  })));
}

const section = (title, ...kids) => h("section", { class: "panel grid gap-3" }, h("h2", { class: "!mb-0" }, title), ...kids);

export async function renderProject(id) {
  const root = $("#projectBody");
  const p = (await loadProjects(pathOf(id))).find((x) => x.id === id);
  const back = h("a", { href: "#/training", class: "mute text-sm underline" }, t("← Learning tracks"));
  if (!p) { root.replaceChildren(back, h("p", { class: "panel" }, t("This project could not be found."))); return; }

  const progress = h("div", { class: "grid gap-1" });
  const drawProgress = () => {
    const d = stepsDone(p), n = p.steps.length;
    progress.replaceChildren(h("span", { class: "mute text-sm" }, t("{d}/{n} steps done", { d, n })), bar(d, n));
  };
  // A checkbox row stored under "<id>:<key>"; ticking adds XP once.
  const tick = (key, label, extra) => {
    const k = `${p.id}:${key}`;
    const box = h("input", { type: "checkbox", class: "mt-1 shrink-0", checked: marks().has(k), onChange: (e) => {
      const s = marks();
      if (e.target.checked) { s.add(k); logActivity(key.startsWith("s") ? 15 : 5); } else s.delete(k);
      saveMarks(s); drawProgress();
    } });
    return h("li", {}, h("label", { class: "flex gap-3 items-start cursor-pointer" }, box, h("span", { class: "grid gap-1" }, label, extra)));
  };

  const cvArea = h("p", { class: "rounded-xl p-3 text-sm", style: "background:var(--soft)" }, p.cv.bullet);
  root.replaceChildren(...[ // filter: replaceChildren would print null
    back,
    h("header", { class: "panel grid gap-2" },
      h("div", { class: "flex flex-wrap items-center gap-2" },
        h("span", { class: "chip !py-0 text-xs" }, p.level), h("span", { class: "mute text-sm" }, t("≈ {n} h hands-on", { n: p.hours }))),
      h("h1", { id: "h-project", tabindex: "-1", class: "page-title !mb-0" }, p.title),
      h("p", { class: "mute" }, p.summary),
      h("p", { class: "text-sm" }, h("b", {}, t("What it proves: ")), p.why),
      h("div", { class: "flex flex-wrap gap-1.5" }, p.skills.map((x) => skillChip(x, state.cv.names.has(x)))),
      progress),
    p.data?.length ? section(t("Data and tools"),
      h("ul", { class: "grid gap-2 text-sm" }, p.data.map((d) => {
        const url = safeUrl(d.url);
        return h("li", {}, url ? h("a", { href: url, target: "_blank", rel: "noopener noreferrer", class: "underline font-medium", style: "color:var(--accent)" }, `${d.name} ↗`)
          : h("b", {}, d.name), d.note ? h("span", { class: "mute" }, ` · ${d.note}`) : null);
      }))) : null,
    section(t("Steps"), h("ol", { class: "grid gap-3" }, p.steps.map((s, i) =>
      tick(`s${i}`, h("b", {}, `${i + 1}. ${s.title}`), h("span", { class: "text-sm leading-relaxed" }, s.text))))),
    section(t("What to publish"), h("ul", { class: "grid gap-1.5 text-sm list-disc pl-5" }, p.deliverables.map((x) => h("li", {}, x)))),
    section(t("Check your work"), h("p", { class: "mute text-sm" }, t("Answer honestly, as a reviewer would. Fix what is not a clear yes before you publish.")),
      h("ul", { class: "grid gap-2 text-sm" }, p.checklist.map((x, i) => tick(`c${i}`, h("span", {}, x))))),
    section(t("Put it on your CV"),
      h("p", { class: "mute text-sm" }, t("Replace the [brackets] with your real numbers. Present it as a personal project: that is what it is, and recruiters value it.")),
      cvArea,
      h("button", { type: "button", class: "btn-ghost justify-self-start", onClick: () => copyText(p.cv.bullet, null, t("CV line copied.")) }, t("📋 Copy the CV line")),
      h("p", { class: "text-sm" }, h("b", {}, t("In the interview: ")), p.cv.talk)),
    p.stretch?.length ? section(t("Go further"), h("ul", { class: "grid gap-1.5 text-sm list-disc pl-5" }, p.stretch.map((x) => h("li", {}, x)))) : null,
  ].filter(Boolean));
  drawProgress();
}
