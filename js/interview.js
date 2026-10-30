// Interview prep page (#/interview): practice decks, STAR stories, checklist, upcoming interviews.
// Content: content/interview/common.json (behavioral questions, themes, checklist, questions to ask, salary tips)
// and content/interview/<path id>.json (role questions). Technical questions come from the path's courses.
// Practice ratings, stories and checklist ticks are kept in this browser ("hk.iv.ratings", "hk.iv.stories",
// "hk.iv.checklist", "hk.iv.tab"). A new career path (e.g. "do", DevOps) needs content/interview/<path id>.json ({ role: [{ id, q, why, model }] });
// behavioral questions carry a `theme` from common.json "themes", which links them to STAR stories.
// French: same files under content/interview/fr/ (keep ids, themes and list lengths: ratings and ticks use them).
import { $, h, ls, toast } from "./lib.js";
import { t, LOCALE, fetchContent } from "./i18n.js";
import { courseInterviewQuestions } from "./courses.js";

const RATINGS_KEY = "hk.iv.ratings", STORIES_KEY = "hk.iv.stories", CHECK_KEY = "hk.iv.checklist", TAB_KEY = "hk.iv.tab";
const load = (k, d) => { try { return JSON.parse(ls.get(k) || "null") ?? d; } catch { return d; } };
const save = (k, v) => ls.set(k, JSON.stringify(v));

const ui = { tab: ls.get(TAB_KEY) || "practice", deck: "all", index: 0, timer: null, editing: null };
let common = null;
const roleCache = new Map(), techCache = new Map();

// French copies in content/interview/fr/ (same ids, themes and list lengths), English when missing.
const getJson = (file) => fetchContent("content/interview/", file)
  .catch(() => { throw new Error(t("Could not load {url}", { url: `content/interview/${file}` })); });
async function loadContent(pathId) {
  common ??= await getJson("common.json");
  if (!roleCache.has(pathId)) roleCache.set(pathId, await getJson(`${pathId}.json`).catch(() => ({ role: [] })));
  if (!techCache.has(pathId)) techCache.set(pathId, await courseInterviewQuestions(pathId).catch(() => []));
  return { common, role: roleCache.get(pathId).role, tech: techCache.get(pathId) };
}

/* ---------- entry point ---------- */
// ctx: { path, cards } — re-rendered when the page is shown, the path changes or the tracker changes.
export async function renderInterview(ctx) {
  const root = $("#ivBody");
  if (!ctx.path) return;
  let content;
  try { content = await loadContent(ctx.path.id); } catch (e) { root.replaceChildren(h("p", { class: "panel" }, e.message)); return; }
  renderUpcoming(ctx.cards);
  for (const t of ["practice", "stories", "checklist"]) {
    const b = $(`#ivTab-${t}`);
    b.className = ui.tab === t ? "btn" : "btn-ghost";
    b.setAttribute("aria-selected", String(ui.tab === t));
    b.onclick = () => { ui.tab = t; ls.set(TAB_KEY, t); renderInterview(ctx); };
  }
  if (ui.tab === "stories") renderStories(root, content, ctx);
  else if (ui.tab === "checklist") renderChecklist(root, content);
  else renderPractice(root, content, ctx);
}

/* ---------- upcoming interviews (from the tracker) ---------- */
function renderUpcoming(cards) {
  const soon = cards
    .filter((c) => c.stage === "interview" || (c.interview_at && new Date(c.interview_at).getTime() > Date.now() - 3 * 3600_000))
    .filter((c) => !["offer", "rejected"].includes(c.stage))
    .sort((a, b) => new Date(a.interview_at || 8.64e15) - new Date(b.interview_at || 8.64e15));
  $("#ivUpcoming").replaceChildren(...(soon.length ? [h("div", { class: "panel" },
    h("h2", { class: "!mb-2" }, t("Your interviews")),
    h("ul", { class: "grid gap-2 text-sm" }, soon.map((c) => h("li", { class: "flex flex-wrap items-baseline gap-2" },
      h("b", {}, [c.title, c.company].filter(Boolean).join(" · ")),
      h("span", { class: "mute" }, c.interview_at
        ? new Date(c.interview_at).toLocaleString(LOCALE, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
        : t("date not set")),
      h("a", { href: "#/applications", class: "underline mute text-xs" }, t("Open in tracker"))))),
    h("p", { class: "mute text-xs mt-2" }, t("Tip: research the company and go through the checklist the day before.")))] : []));
}

/* ---------- practice ---------- */
function deckQuestions(content, path) {
  const behavioral = content.common.behavioral.map((x) => ({ ...x, kind: t("Behavioral") }));
  const role = content.role.map((x) => ({ ...x, kind: path.name }));
  const tech = content.tech.map((x) => ({ ...x, kind: t("Technical") }));
  const ratings = load(RATINGS_KEY, {});
  const all = [...behavioral, ...role, ...tech];
  return {
    all, behavioral, role, tech,
    review: all.filter((x) => ratings[x.id] === "again"),
    fresh: all.filter((x) => !ratings[x.id]),
  };
}

function renderPractice(root, content, ctx) {
  const decks = deckQuestions(content, ctx.path);
  const ratings = load(RATINGS_KEY, {});
  const list = decks[ui.deck] || decks.all;
  if (ui.index >= list.length) ui.index = 0;
  const q = list[ui.index];
  const practised = decks.all.filter((x) => ratings[x.id]).length;

  const deckSelect = h("select", { class: "input !py-1", "aria-label": t("Question deck"), onChange: (e) => { ui.deck = e.target.value; ui.index = 0; renderPractice(root, content, ctx); } },
    [["all", t("All questions ({n})", { n: decks.all.length })], ["behavioral", t("Behavioral ({n})", { n: decks.behavioral.length })],
      ["role", t("{path} role ({n})", { path: ctx.path.name, n: decks.role.length })], ["tech", t("Technical, from your courses ({n})", { n: decks.tech.length })],
      ["fresh", t("Not practised yet ({n})", { n: decks.fresh.length })], ["review", t("To review ({n})", { n: decks.review.length })]]
      .map(([v, label]) => h("option", { value: v, selected: v === ui.deck }, label)));

  const head = h("div", { class: "flex flex-wrap items-center gap-2 mb-3" }, deckSelect,
    h("span", { class: "mute text-sm" }, t("{done}/{all} practised · {review} to review", { done: practised, all: decks.all.length, review: decks.review.length })),
    h("button", { type: "button", class: "btn-ghost !py-1 ml-auto", onClick: () => { ui.index = Math.floor(Math.random() * Math.max(1, list.length)); renderPractice(root, content, ctx); } }, t("🔀 Random")));

  if (!q) {
    root.replaceChildren(h("div", { class: "panel" }, head, h("p", { class: "mute" },
      ui.deck === "review" ? t("Nothing to review: every question you practised is marked 'Got it'.") : t("No questions in this deck yet."))));
    return;
  }

  const answer = h("div", { class: "grid gap-2 text-sm", hidden: true },
    q.tips?.length ? h("div", {}, h("p", { class: "font-medium" }, t("How to answer")),
      h("ul", { class: "list-disc pl-5 mute grid gap-0.5" }, q.tips.map((t) => h("li", {}, t)))) : null,
    h("div", {}, h("p", { class: "font-medium" }, t("Example answer")), h("p", { class: "mute" }, q.model || q.a)),
    q.course ? h("a", { href: `#/course/${q.course.id}`, class: "underline text-xs", style: "color:var(--accent)" }, `📘 ${t("Revise with the {name} course", { name: q.course.name })}`) : null);

  const stories = q.theme ? load(STORIES_KEY, []).filter((s) => (s.themes || []).includes(q.theme)) : [];
  const storyBox = q.theme ? h("div", { class: "rounded-lg p-3 text-sm", style: "background:var(--bg);border:1px solid var(--line)" },
    h("p", { class: "font-medium" }, t("Your STAR stories for \"{theme}\"", { theme: content.common.themes[q.theme] })),
    stories.length
      ? h("ul", { class: "grid gap-1 mt-1" }, stories.map((s) => h("li", {}, h("details", {},
          h("summary", { class: "cursor-pointer" }, s.title),
          h("p", { class: "mute mt-1" }, h("b", {}, "S: "), s.situation), h("p", { class: "mute" }, h("b", {}, "T: "), s.task),
          h("p", { class: "mute" }, h("b", {}, "A: "), s.action), h("p", { class: "mute" }, h("b", {}, "R: "), s.result)))))
      : h("p", { class: "mute mt-1" }, t("None yet. "),
          h("button", { type: "button", class: "underline", style: "color:var(--accent)", onClick: () => { ui.tab = "stories"; ui.editing = { themes: [q.theme] }; renderInterview(ctx); } }, t("Write one now")),
          t(" so you are ready for this question."))) : null;

  const timerOut = h("span", { class: "mute text-sm tabular-nums" });
  const timerBtn = h("button", { type: "button", class: "btn-ghost !py-1", onClick: () => startTimer(timerOut, timerBtn) }, t("⏱ 2-minute answer"));
  const rate = (r) => { const all = load(RATINGS_KEY, {}); all[q.id] = r; save(RATINGS_KEY, all); next(); };
  const next = () => { stopTimer(); ui.index = (ui.index + 1) % list.length; renderPractice(root, content, ctx); };
  const prev = () => { stopTimer(); ui.index = (ui.index - 1 + list.length) % list.length; renderPractice(root, content, ctx); };
  const revealBtn = h("button", { type: "button", class: "btn-ghost !py-1", onClick: () => { answer.hidden = !answer.hidden; revealBtn.textContent = answer.hidden ? t("Show answer") : t("Hide answer"); } }, t("Show answer"));

  root.replaceChildren(h("div", { class: "panel grid gap-3" }, head,
    h("div", { class: "flex flex-wrap items-center gap-2" },
      h("span", { class: "chip chip-ok !py-0 text-xs" }, q.kind),
      q.theme ? h("span", { class: "chip !py-0 text-xs" }, content.common.themes[q.theme]) : null,
      q.course ? h("span", { class: "chip !py-0 text-xs" }, q.course.name) : null,
      h("span", { class: "mute text-xs ml-auto" }, `${ui.index + 1} / ${list.length}`),
      ratings[q.id] ? h("span", { class: "text-xs", style: `color:${ratings[q.id] === "good" ? "#18a999" : "#f08a24"}` }, ratings[q.id] === "good" ? t("✓ Got it") : t("↻ To review")) : null),
    h("p", { class: "text-xl font-bold" }, q.q),
    q.why ? h("p", { class: "mute text-sm" }, t("Why they ask: {why}", { why: q.why })) : null,
    h("p", { class: "mute text-sm" }, t("Answer out loud first (record yourself if you can), then compare with the example.")),
    h("div", { class: "flex flex-wrap items-center gap-2" }, timerBtn, timerOut, revealBtn),
    answer, storyBox,
    h("div", { class: "flex flex-wrap gap-2 pt-1", style: "border-top:1px solid var(--line)" },
      h("button", { type: "button", class: "btn-ghost !py-1", onClick: prev }, t("← Previous")),
      h("button", { type: "button", class: "btn-ghost !py-1", style: "color:#f08a24", onClick: () => rate("again") }, t("↻ Needs more practice")),
      h("button", { type: "button", class: "btn !py-1", style: "background:#18a999", onClick: () => rate("good") }, t("✓ Got it")),
      h("button", { type: "button", class: "btn-ghost !py-1 ml-auto", onClick: next }, t("Skip →")))));
}

function stopTimer() { clearInterval(ui.timer); ui.timer = null; }
function startTimer(out, btn) {
  stopTimer();
  const end = Date.now() + 120_000;
  btn.textContent = t("⏱ Restart");
  const tick = () => {
    const left = Math.max(0, Math.round((end - Date.now()) / 1000));
    out.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
    out.style.color = left <= 15 ? "#e0508b" : "";
    if (!left) { stopTimer(); out.textContent = t("Time! Wrap up in one sentence."); }
  };
  tick();
  ui.timer = setInterval(tick, 1000);
}

/* ---------- STAR stories ---------- */
function renderStories(root, content, ctx) {
  const stories = load(STORIES_KEY, []), themes = content.common.themes;
  const covered = new Set(stories.flatMap((s) => s.themes || []));
  const missing = Object.keys(themes).filter((t) => t !== "intro" && !covered.has(t));
  const editing = ui.editing;

  const form = editing ? storyForm(editing, themes, (s) => {
    const list = load(STORIES_KEY, []);
    const i = list.findIndex((x) => x.id === s.id);
    if (i >= 0) list[i] = s; else list.unshift(s);
    save(STORIES_KEY, list);
    ui.editing = null;
    toast(t("Story saved."));
    renderStories(root, content, ctx);
  }, () => { ui.editing = null; renderStories(root, content, ctx); }) : null;

  root.replaceChildren(h("div", { class: "grid gap-4" },
    h("div", { class: "panel grid gap-2" },
      h("div", { class: "flex flex-wrap items-center gap-2" },
        h("h2", { class: "!mb-0" }, t("My STAR stories")),
        editing ? null : h("button", { type: "button", class: "btn !py-1 ml-auto", onClick: () => { ui.editing = { themes: [] }; renderStories(root, content, ctx); } }, t("+ New story"))),
      h("p", { class: "mute text-sm" }, t("Most behavioral questions can be answered with 5 to 8 good stories. Write each once: "),
        h("b", {}, "S"), t("ituation (context), "), h("b", {}, "T"), t("ask (your goal), "), h("b", {}, "A"), t("ction (what you did, say \"I\"), "),
        h("b", {}, "R"), t("esult (with a number). Tag the themes it answers; it will show next to matching questions.")),
      h("p", { class: "text-sm" }, missing.length
        ? h("span", {}, t("Themes without a story yet: "), ...missing.flatMap((t, i) => [i ? ", " : "", h("span", { style: "color:#f08a24" }, themes[t])]))
        : h("span", { style: "color:#18a999" }, t("✓ Every theme has at least one story.")))),
    form,
    ...stories.map((s) => h("div", { class: "panel !p-4 text-sm grid gap-1" },
      h("div", { class: "flex flex-wrap items-center gap-2" },
        h("b", { class: "text-base" }, s.title),
        ...(s.themes || []).map((t) => h("span", { class: "chip !py-0 text-xs" }, themes[t] || t)),
        h("span", { class: "ml-auto flex gap-2" },
          h("button", { type: "button", class: "btn-ghost !py-0 !px-2", onClick: () => { ui.editing = { ...s }; renderStories(root, content, ctx); } }, t("Edit")),
          h("button", { type: "button", class: "btn-ghost !py-0 !px-2", style: "color:#e0508b", onClick: () => {
            if (!confirm(t("Delete \"{title}\"?", { title: s.title }))) return;
            save(STORIES_KEY, load(STORIES_KEY, []).filter((x) => x.id !== s.id)); renderStories(root, content, ctx);
          } }, t("Delete")))),
      h("p", { class: "mute" }, h("b", {}, t("Situation: ")), s.situation), h("p", { class: "mute" }, h("b", {}, t("Task: ")), s.task),
      h("p", { class: "mute" }, h("b", {}, t("Action: ")), s.action), h("p", { class: "mute" }, h("b", {}, t("Result: ")), s.result))),
    !stories.length && !editing ? h("p", { class: "mute text-sm" }, t("No story yet. Start with your proudest achievement.")) : null,
  ));
}

function storyForm(s, themes, onSave, onCancel) {
  const field = (name, label, placeholder, rows = 2) => h("label", { class: "grid gap-1 text-sm" }, h("span", { class: "mute" }, t(label)),
    h("textarea", { name, rows: String(rows), class: "input", placeholder: t(placeholder) }, s[name] || ""));
  const form = h("form", { class: "panel grid gap-3" },
    h("h3", { class: "font-bold" }, s.id ? t("Edit story") : t("New story")),
    h("label", { class: "grid gap-1 text-sm" }, h("span", { class: "mute" }, t("Short title")),
      h("input", { name: "title", class: "input", required: true, value: s.title || "", placeholder: t("e.g. Automated the monthly sales report") })),
    field("situation", "Situation: where, when, what was the problem?", "Our monthly report took 8 days because three teams fed it by hand."),
    field("task", "Task: what was your goal or responsibility?", "I was asked to automate it with an engineer and a finance analyst."),
    field("action", "Action: what did you do? (the longest part, say \"I\")", "I mapped each manual step, wrote the SQL transformations…", 3),
    field("result", "Result: what changed? Use numbers.", "Delivered on day 2 instead of day 8; no more errors found after release."),
    h("fieldset", { class: "text-sm" }, h("legend", { class: "mute mb-1" }, t("Themes this story can answer")),
      h("div", { class: "flex flex-wrap gap-x-4 gap-y-1" }, Object.entries(themes).map(([id, label]) =>
        h("label", { class: "flex items-center gap-1" }, h("input", { type: "checkbox", name: "themes", value: id, checked: (s.themes || []).includes(id) }), label)))),
    h("div", { class: "flex gap-2" }, h("button", { type: "submit", class: "btn" }, t("Save story")),
      h("button", { type: "button", class: "btn-ghost", onClick: onCancel }, t("Cancel"))));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = form.elements, txt = (n) => f.namedItem(n).value.trim();
    onSave({ id: s.id || crypto.randomUUID(), title: txt("title"), situation: txt("situation"), task: txt("task"),
      action: txt("action"), result: txt("result"), themes: [...form.querySelectorAll("input[name=themes]:checked")].map((x) => x.value),
      updated_at: new Date().toISOString() });
  });
  setTimeout(() => form.elements.namedItem("title").focus(), 0);
  return form;
}

/* ---------- checklist, questions to ask, salary ---------- */
function renderChecklist(root, content) {
  const ticked = new Set(load(CHECK_KEY, []));
  const group = (key, title) => h("div", {},
    h("h3", { class: "font-bold mb-1" }, title),
    h("ul", { class: "grid gap-1.5 text-sm" }, content.common.checklist[key].map((item, i) => {
      const id = `${key}:${i}`;
      return h("li", {}, h("label", { class: "flex items-start gap-2" },
        h("input", { type: "checkbox", class: "mt-1", checked: ticked.has(id), onChange: (e) => {
          const s = new Set(load(CHECK_KEY, [])); e.target.checked ? s.add(id) : s.delete(id); save(CHECK_KEY, [...s]);
        } }), h("span", {}, item)));
    })));
  root.replaceChildren(h("div", { class: "grid gap-4" },
    h("div", { class: "panel grid gap-4 md:grid-cols-3" }, group("before", t("Before")), group("during", t("During")), group("after", t("After")),
      h("div", { class: "md:col-span-3" }, h("button", { type: "button", class: "btn-ghost !py-1", onClick: () => { save(CHECK_KEY, []); renderChecklist(root, content); } }, t("Untick everything (next interview)")))),
    h("div", { class: "panel grid gap-4 md:grid-cols-2" },
      h("div", {}, h("h3", { class: "font-bold mb-1" }, t("Questions to ask them")),
        h("ul", { class: "list-disc pl-5 grid gap-1 text-sm" }, content.common.ask.map((q) => h("li", {}, q)))),
      h("div", {}, h("h3", { class: "font-bold mb-1" }, t("Salary negotiation")),
        h("ul", { class: "list-disc pl-5 grid gap-1 text-sm" }, content.common.salary.map((q) => h("li", {}, q)))))));
}
