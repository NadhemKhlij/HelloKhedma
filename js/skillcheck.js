// Skill check (#/skillcheck; training step 3, ROADMAP 4.7): a placement test for the selected path. The learner picks
// the skills (courses of the path) they think they know (the ones on their CV are ticked first), answers PER_COURSE
// questions per course built from its cheat sheet (practice.js makeQuestions), and a course with 3 of 4 right is
// passed (srs.js saveCheck / passed): the study plan and "Close the gaps" then skip it, and its course card says so.
// Guessing passes a course about 5 % of the time. Results stay in this browser (synced when signed in). XP via activity.js.
import { $, h } from "./lib.js";
import { t, tn } from "./i18n.js";
import { state, path } from "./state.js";
import { loadCourseIndex, loadCourse } from "./courses.js";
import { makeQuestions } from "./practice.js";
import { saveCheck, checkResult, passed } from "./srs.js";
import { logActivity } from "./activity.js";

const PER_COURSE = 4, SECONDS_PER_QUESTION = 20;
const code = (s) => h("code", { class: "inline-code !text-[.85rem]" }, s);
const bar = (pct) => h("div", { class: "h-1.5 rounded-full", style: "background:var(--line)" },
  h("div", { class: "h-1.5 rounded-full", style: `width:${pct}%;background:var(--accent);transition:width .3s ease` }));
const head = (sub) => h("div", { class: "grid gap-1" },
  h("a", { href: "#/training", class: "mute text-sm underline justify-self-start" }, t("← Training")),
  h("h1", { id: "h-skillcheck", tabindex: "-1", class: "page-title !mb-0" }, t("Skill check")),
  h("p", { class: "mute text-sm max-w-2xl" }, sub));
const badge = (r) => (r ? h("span", { class: "chip !py-0 text-xs", style: passed(r) ? "color:#18a999" : "" },
  passed(r) ? t("✓ Passed {got}/{of}", r) : t("Last try {got}/{of}", r)) : null);

export async function renderSkillCheck() {
  const root = $("#skillcheckBody");
  const all = (await loadCourseIndex()).filter((c) => c.paths.includes(state.pathId));
  const sub = t("Pick the skills of the {path} path you think you already know. {n} questions each: with 3 right, the course is marked as known and your study plan skips it.",
    { path: path()?.name || "", n: PER_COURSE });
  if (!all.length) { root.replaceChildren(head(sub), h("p", { class: "mute" }, t("Courses could not be loaded."))); return; }

  // 1. Choose: the skills on the CV that are not passed yet are ticked.
  const cvHas = (c) => c.skills.some((s) => state.cv.names.has(s));
  const boxes = all.map((c) => {
    const r = checkResult(c.id);
    const input = h("input", { type: "checkbox", value: c.id, checked: cvHas(c) && !passed(r) });
    return { c, input, row: h("label", { class: "flex items-center gap-3 rounded-xl p-3 cursor-pointer", style: "background:var(--bg);border:1px solid var(--line)" },
      input, h("span", { class: "flex-1 min-w-0" }, h("b", { class: "block text-sm" }, c.name),
        h("span", { class: "mute text-xs" }, c.skills.slice(0, 4).join(" · "))),
      cvHas(c) ? h("span", { class: "mute text-xs" }, t("on your CV")) : null, badge(r)) };
  });
  const estimate = h("span", { class: "mute text-sm" });
  const start = h("button", { type: "button", class: "btn", onClick: () => run(boxes.filter((b) => b.input.checked).map((b) => b.c)) });
  const upd = () => {
    const n = boxes.filter((b) => b.input.checked).length;
    start.disabled = !n;
    start.textContent = n ? tn(n, "Start the check ({n} skill)", "Start the check ({n} skills)") : t("Pick at least one skill");
    estimate.textContent = n ? t("≈ {m} min", { m: Math.max(1, Math.round((n * PER_COURSE * SECONDS_PER_QUESTION) / 60)) }) : "";
  };
  boxes.forEach((b) => b.input.addEventListener("change", upd));
  upd();
  root.replaceChildren(head(sub), h("div", { class: "panel grid gap-3" },
    h("div", { class: "flex flex-wrap gap-3 text-sm" },
      h("button", { type: "button", class: "underline", onClick: () => { boxes.forEach((b) => { b.input.checked = true; }); upd(); } }, t("Select all")),
      h("button", { type: "button", class: "underline", onClick: () => { boxes.forEach((b) => { b.input.checked = false; }); upd(); } }, t("Clear"))),
    h("div", { class: "grid gap-2 sm:grid-cols-2" }, boxes.map((b) => b.row)),
    // Kept in view while scrolling a long list (above the phone tab bar).
    h("div", { class: "sticky bottom-20 sm:bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-xl p-3 -mx-1 shadow-sm",
      style: "background:var(--panel);border:1px solid var(--line)" }, start, estimate)));

  // 2. The questions, course after course.
  async function run(chosen) {
    root.replaceChildren(head(sub), h("p", { class: "mute" }, t("Preparing the questions…")));
    const loaded = (await Promise.all(chosen.map((c) => loadCourse(c.id).then((x) => ({ c, x })).catch(() => null)))).filter(Boolean);
    const qs = loaded.flatMap(({ c, x }) => makeQuestions(x, PER_COURSE).map((q) => ({ ...q, c })));
    const got = new Map(loaded.map(({ c }) => [c.id, 0])), of = new Map();
    qs.forEach((q) => of.set(q.c.id, (of.get(q.c.id) || 0) + 1));
    let i = 0;
    const draw = () => {
      if (i >= qs.length) return results(loaded.map(({ c }) => c), got, of);
      const { it, toMeaning, options, c } = qs[i];
      const feedback = h("p", { class: "text-sm min-h-[1.5rem]", "aria-live": "polite" });
      const next = h("button", { type: "button", class: "btn", hidden: true, onClick: () => { i++; draw(); } },
        i + 1 < qs.length ? t("Next question →") : t("See my results"));
      const opts = options.map((o) => h("button", { type: "button", class: "opt", onClick: (e) => answer(o, e.currentTarget) },
        toMeaning ? o.back : code(o.front)));
      function answer(o, btn) {
        const ok = o.key === it.key;
        opts.forEach((b, k) => { b.disabled = true; if (options[k].key === it.key) b.classList.add("opt-ok"); });
        if (!ok) btn.classList.add("opt-bad");
        if (ok) got.set(c.id, got.get(c.id) + 1);
        feedback.replaceChildren(ok ? h("span", { style: "color:#18a999" }, t("✓ Correct!")) : h("span", { style: "color:#e0508b" }, t("✗ Not quite.")));
        next.hidden = false; next.focus();
      }
      root.replaceChildren(head(sub), h("div", { class: "panel grid gap-4 max-w-2xl" },
        h("div", { class: "grid gap-2" },
          h("div", { class: "flex justify-between text-sm mute" }, h("span", {}, t("Question {n} of {all}", { n: i + 1, all: qs.length })), h("span", {}, c.name)),
          bar((i / qs.length) * 100)),
        h("div", {},
          h("p", { class: "eyebrow mb-2" }, toMeaning ? t("What does this do?") : t("Which one does this?")),
          h("p", { class: "text-lg font-medium" }, toMeaning ? code(it.front) : it.back)),
        h("div", { class: "grid gap-2 sm:grid-cols-2" }, opts),
        h("div", { class: "flex flex-wrap items-center justify-between gap-3" }, feedback, next)));
      opts[0]?.focus({ preventScroll: true });
    };
    draw();
  }

  // 3. Results: saved per course; known courses leave the study plan.
  function results(courses, got, of) {
    courses.forEach((c) => saveCheck(c.id, got.get(c.id), of.get(c.id) || PER_COURSE));
    logActivity(5);
    const known = courses.filter((c) => passed(checkResult(c.id)));
    root.replaceChildren(head(sub), h("div", { class: "panel grid gap-4" },
      h("b", { class: "serif text-2xl" }, known.length
        ? tn(known.length, "{n} skill you already know 🎉", "{n} skills you already know 🎉") : t("Nothing to skip yet")),
      h("p", { class: "mute text-sm" }, known.length
        ? t("Your study plan and “Close the gaps” now skip these courses. Make sure these skills are on your CV.")
        : t("The courses below are worth your time: start with the lessons, then try the check again.")),
      h("ul", { class: "grid gap-2" }, courses.map((c) => {
        const r = checkResult(c.id), ok = passed(r);
        return h("li", { class: "flex flex-wrap items-center gap-3 rounded-xl p-3", style: "background:var(--bg);border:1px solid var(--line)" },
          h("span", { style: `color:${ok ? "#18a999" : "#e0508b"}`, "aria-hidden": "true" }, ok ? "✓" : "✗"),
          h("b", { class: "text-sm flex-1 min-w-[10rem]" }, c.name),
          h("span", { class: "mute text-sm" }, t("{got} of {of} right", r)),
          ok ? h("span", { class: "text-sm", style: "color:#18a999" }, t("Known: skipped"))
            : h("a", { href: `#/course/${c.id}`, class: "text-sm underline", style: "color:var(--accent)" }, t("Open the course →")));
      })),
      h("div", { class: "flex flex-wrap gap-2" },
        h("a", { href: "#/training", class: "btn" }, t("See my study plan")),
        h("button", { type: "button", class: "btn-ghost", onClick: () => renderSkillCheck() }, t("Check other skills")))));
    $("#h-skillcheck")?.focus({ preventScroll: true });
  }
}
