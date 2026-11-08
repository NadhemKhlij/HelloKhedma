// "Ask about this lesson" (ROADMAP 4b step 4): under each lesson, a signed-in learner can ask Claude a question about
// it. courses.js creates one box per lesson shown (askBox(course, lesson, index)).
// - The lesson (title, text, key points, example) and the question go to the explain-mistake Edge Function, mode "ask"
//   (Claude Sonnet 5.5, ASK_DAILY_LIMIT a day per account), which stores nothing. Only on "Ask"; a notice is shown before
//   the first question on this device ("hk.askOk"). Privacy policy: FR + EN.
// - Guests see the box too, and are asked to sign in.
// - The answer comes in the course's language (interface language; AI track: its own language, Derja included), as
//   plain text shown with textContent. Answers are kept on this device ("hk.askSaved", newest 100, never synced): the
//   same question on the same lesson shows the saved answer at once, with "Ask the AI again".
import { $, h, ls } from "./lib.js";
import { t, lang } from "./i18n.js";
import { sb } from "./supabase.js";
import { state } from "./state.js";
import { isAiCourse, aiScript, aiDir } from "./aitrack.js";

const NOTICE_KEY = "hk.askOk", SAVED_KEY = "hk.askSaved", KEEP = 100, LIMIT = 20, MAX_Q = 600;
const ERRORS = {
  signed_out: "Sign in to ask questions about lessons.",
  limit: "Daily limit reached ({n} questions a day). Try again tomorrow.",
  not_configured: "AI answers are not set up yet.",
  unreachable: "The AI service can't be reached (no connection, or not set up yet).",
  refusal: "The AI declined this request.",
  too_long: "This question is too long.",
  busy: "The AI service is busy. Try again in a minute.",
};

function readSaved() { try { return JSON.parse(ls.get(SAVED_KEY) || "{}") || {}; } catch { return {}; } }
function save(k, entry) {
  const keep = Object.entries({ ...readSaved(), [k]: { ...entry, at: Date.now() } }).sort((a, b) => b[1].at - a[1].at).slice(0, KEEP);
  ls.set(SAVED_KEY, JSON.stringify(Object.fromEntries(keep)));
}
const norm = (q) => q.trim().replace(/\s+/g, " ").toLowerCase();

// The lesson as text for the AI: title, paragraphs, key points, example.
export function lessonText(l) {
  return [l.title, ...(l.text || []), ...(l.points?.length ? ["Key points:", ...l.points.map((p) => `- ${p}`)] : []),
    ...(l.example ? [`Example (${l.example.lang || "code"}):`, l.example.code, l.example.note || ""] : [])].join("\n").slice(0, 8000);
}

export function askBox(course, lesson, index) {
  const ai = isAiCourse(course.id);
  const target = ai ? aiScript() : lang === "fr" ? "fr" : "en";
  const dir = ai ? aiDir(target) : {};
  const out = h("div", { class: "grid gap-2", "aria-live": "polite" });
  const input = h("textarea", { class: "input w-full", rows: 2, maxlength: MAX_Q, ...dir,
    placeholder: t("e.g. Why is this better than…? Can you give another example?"), "aria-label": t("Your question about this lesson") });
  const askBtn = h("button", { type: "button", class: "btn", onClick: () => ask() }, t("Ask"));
  const form = h("div", { class: "grid gap-2", hidden: true }, input, h("div", { class: "flex flex-wrap items-center gap-2" }, askBtn,
    h("span", { class: "mute text-xs" }, t("Answered by AI from this lesson · up to {n} questions a day", { n: LIMIT }))), out);
  const open = h("button", { type: "button", class: "btn-ghost justify-self-start", "aria-expanded": "false",
    onClick: () => { form.hidden = !form.hidden; open.setAttribute("aria-expanded", String(!form.hidden)); if (!form.hidden) input.focus(); } },
    t("💬 Ask about this lesson"));
  const keyOf = (q) => JSON.stringify([course.id, index, norm(q), target]);

  function show({ text, truncated }, saved) {
    out.replaceChildren(...[
      h("div", { class: "rounded-lg p-3 text-sm whitespace-pre-wrap", style: "background:var(--soft)", ...dir }, text),
      truncated ? h("p", { class: "mute text-xs" }, t("The answer was cut short.")) : null,
      h("p", { class: "mute text-xs" }, t("Written by AI: it can be wrong. Check against the lesson.")),
      saved ? h("p", { class: "mute text-xs flex flex-wrap items-center gap-2" }, t("Saved on this device: shown again without asking the AI."),
        h("button", { type: "button", class: "underline", onClick: () => ask(true) }, t("Ask the AI again"))) : null,
    ].filter(Boolean));
  }

  function ask(fresh = false) {
    const q = input.value.trim();
    if (!q) { input.focus(); return; }
    const mine = !fresh && readSaved()[keyOf(q)];
    if (mine) { show(mine, true); return; }
    if (!state.user) {
      out.replaceChildren(h("div", { class: "rounded-lg p-3 text-sm grid gap-2", style: "background:var(--soft)" },
        h("p", {}, t("Sign in to ask the AI about this lesson (up to {n} questions a day).", { n: LIMIT })),
        h("button", { type: "button", class: "btn-ghost justify-self-start", onClick: () => $("#authOpen").click() }, t("Sign in"))));
      return;
    }
    if (ls.get(NOTICE_KEY) === "1") { send(q); return; }
    out.replaceChildren(h("div", { class: "rounded-lg p-3 text-sm grid gap-2", style: "background:var(--bg);border:1px solid var(--accent)" },
      h("p", {}, t("Your question and this lesson will be sent to Claude, Anthropic's AI, to write the answer. HelloKhedma does not store them. Do not write personal data in your question. Up to {n} questions a day.", { n: LIMIT })),
      h("div", { class: "flex flex-wrap gap-2" },
        h("button", { type: "button", class: "btn", onClick: () => { ls.set(NOTICE_KEY, "1"); send(q); } }, t("Send my question")),
        h("button", { type: "button", class: "btn-ghost", onClick: () => out.replaceChildren() }, t("Cancel")))));
  }

  async function send(q) {
    askBtn.disabled = true;
    out.replaceChildren(h("p", { class: "mute text-sm" }, t("Reading the lesson…")));
    try {
      const { data, error } = await sb.functions.invoke("explain-mistake", { body: {
        mode: "ask", course: String(course.name || course.id).slice(0, 160), lesson: lessonText(lesson), question: q.slice(0, MAX_Q), lang: target,
      } });
      if (error) {
        let msg = error.message, code;
        try { const j = await error.context.json(); msg = j.error || msg; code = j.code; } catch { /* keep the message */ }
        if (error.context?.status === 404) code = "not_configured"; // function not deployed yet
        if (error.name === "FunctionsFetchError") code = "unreachable";
        throw Object.assign(new Error(msg), { code });
      }
      const entry = { text: String(data.text), truncated: !!data.truncated };
      if (!entry.truncated) save(keyOf(q), entry);
      show(entry, false);
    } catch (err) {
      out.replaceChildren(h("p", { class: "text-sm", style: "color:#e0508b" },
        ERRORS[err.code] ? t(ERRORS[err.code], { n: LIMIT }) : t("The answer failed: {msg}", { msg: err.message })));
    } finally { askBtn.disabled = false; }
  }
  return h("div", { class: "grid gap-2 pt-3", style: "border-top:1px solid var(--line)", "data-ask": "" }, open, form);
}
