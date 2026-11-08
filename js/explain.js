// "Explain my mistake" (training step 4, ROADMAP Phase 4b): after a wrong answer on a course exercise, a signed-in
// learner can ask Claude why the attempt is wrong. practice.js creates one box per exercise and calls offer(attempt,
// verdict) after a wrong check: runnable SQL (sqlRunner), the auto-graded formats (drills.js onWrong) and written
// answers once "Reveal the answer" is open (the scratch box, when the learner typed something).
// - The exercise (question, material, expected answer, the course's explanation), the attempt and the in-browser check's
//   verdict go to the explain-mistake Edge Function (Claude Sonnet 5.5, daily limit per account), which stores nothing.
//   Only on that click; a notice is shown before the first send on this device ("hk.explainOk"). Privacy policy: FR + EN.
// - Guests see the button too, and are asked to sign in.
// - The answer comes in the course's language: the interface language, or for the AI track its own language (English,
//   French, Derja in Arabic letters, right to left, or 3arbizi). It is plain text, shown with textContent.
// - Saved answers (ROADMAP 4b row 4c): every explanation received is kept on this device ("hk.explainSaved", the
//   newest 150, never synced), keyed by course, exercise, attempt, check verdict and language: the same mistake shows
//   it again at once, with no AI call. For fixed-choice formats the function also shares saved answers between learners
//   (no account id; "saved": true, not counted in the daily limit). "Ask the AI again" skips both (fresh: true).
import { $, h, ls } from "./lib.js";
import { t, lang } from "./i18n.js";
import { sb } from "./supabase.js";
import { state } from "./state.js";
import { isAiCourse, aiScript, aiDir } from "./aitrack.js";

const NOTICE_KEY = "hk.explainOk", SAVED_KEY = "hk.explainSaved", KEEP = 150, LIMIT = 30;
const ERRORS = {
  signed_out: "Sign in to get AI explanations.",
  limit: "Daily limit reached ({n} explanations a day). Try again tomorrow.",
  not_configured: "AI explanations are not set up yet.",
  unreachable: "The AI service can't be reached (no connection, or not set up yet).",
  refusal: "The AI declined this request.",
  too_long: "This answer is too long to explain.",
  busy: "The AI service is busy. Try again in a minute.",
};

// The expected answer as text for the AI (the worked answer of the auto-graded formats, then the course's text).
const first = (list) => (list || []).find((a) => !/^\/.+\/[a-z]*$/s.test(a)) ?? list?.[0] ?? "";
function expectedOf(e) {
  const tail = e.answer ? `\n${e.answer}` : "";
  switch (e.type) {
    case "choice": return `Right option: ${e.options[e.correct]}${tail}`;
    case "fill": return `${e.blanks.map((b, k) => `Blank ${k + 1}: ${first(b)}`).join("\n")}${tail}`;
    case "order": return `${e.steps.map((s, k) => `${k + 1}. ${s}`).join("\n")}${tail}`;
    case "match": return `${e.pairs.map(([a, b]) => `${a} → ${b}`).join("\n")}${tail}`;
    case "groups": return `${e.groups.map((g) => `${g.name}: ${g.items.join(", ")}`).join("\n")}${tail}`;
    case "bug": return `The bug is on line ${e.line}: ${e.snippet.split("\n")[e.line - 1]}${e.fix ? `\nFixed version:\n${e.fix}` : ""}${tail}`;
    case "logs": return `${e.fields.map((f) => `${f.label}: ${first(f.accept)}`).join("\n")}${tail}`;
    default: return String(e.answer || "");
  }
}
const kindOf = (e) => e.type || (e.run ? "sql" : e.code ? `code:${e.code}` : "written");
const material = (e) => e.snippet || e.start || e.text || (e.file ? `(file ${e.file})` : "");

// Explanations saved on this device: { key: { text, truncated, at } }.
function readSaved() { try { return JSON.parse(ls.get(SAVED_KEY) || "{}") || {}; } catch { return {}; } }
function save(k, entry) {
  const all = { ...readSaved(), [k]: { ...entry, at: Date.now() } };
  const keep = Object.entries(all).sort((a, b) => b[1].at - a[1].at).slice(0, KEEP);
  ls.set(SAVED_KEY, JSON.stringify(Object.fromEntries(keep)));
}
// cyrb53: short, stable hash of a text (not for security; the device's own key only).
function hash(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

// One box per exercise. Returns { el, offer(attempt, verdict), reset() }.
export function explainBox(course, e) {
  const ai = isAiCourse(course.id);
  const target = ai ? aiScript() : lang === "fr" ? "fr" : "en";
  let last = null;
  const out = h("div", { class: "grid gap-2", "aria-live": "polite" });
  const btn = h("button", { type: "button", class: "btn-ghost justify-self-start", onClick: () => ask() }, t("🤖 Explain my mistake"));
  const el = h("div", { class: "grid gap-2", hidden: true, "data-explain": "" }, btn, out);

  function offer(attempt, verdict = "") {
    last = { attempt: String(attempt ?? "").slice(0, 6000), verdict: String(verdict ?? "").slice(0, 800) };
    el.hidden = false; btn.disabled = false;
  }
  function reset() { last = null; el.hidden = true; out.replaceChildren(); }

  const savedKey = () => hash(JSON.stringify([course.id, e.q, last.attempt, last.verdict, target]));

  function show({ text, truncated }, note) {
    out.replaceChildren(...[
      h("div", { class: "rounded-lg p-3 text-sm whitespace-pre-wrap", style: "background:var(--soft)", ...(ai ? aiDir(target) : {}) }, text),
      truncated ? h("p", { class: "mute text-xs" }, t("The explanation was cut short.")) : null,
      h("p", { class: "mute text-xs" }, t("Written by AI: it can be wrong. Compare with the answer of the course.")),
      note ? h("p", { class: "mute text-xs flex flex-wrap items-center gap-2" }, note,
        h("button", { type: "button", class: "underline", onClick: () => ask(true) }, t("Ask the AI again"))) : null,
    ].filter(Boolean));
  }

  function ask(fresh = false) {
    if (!last) return;
    const mine = !fresh && readSaved()[savedKey()];
    if (mine) { show(mine, t("Saved on this device: shown again without asking the AI.")); return; }
    if (!state.user) {
      out.replaceChildren(h("div", { class: "rounded-lg p-3 text-sm grid gap-2", style: "background:var(--soft)" },
        h("p", {}, t("Sign in to get an AI explanation of your mistake (up to {n} a day).", { n: LIMIT })),
        h("button", { type: "button", class: "btn-ghost justify-self-start", onClick: () => $("#authOpen").click() }, t("Sign in"))));
      return;
    }
    if (ls.get(NOTICE_KEY) === "1") { send(fresh); return; }
    out.replaceChildren(h("div", { class: "rounded-lg p-3 text-sm grid gap-2", style: "background:var(--bg);border:1px solid var(--accent)" },
      h("p", {}, t("Your answer and this exercise will be sent to Claude, Anthropic's AI, to write the explanation. HelloKhedma keeps nothing linked to you; explanations of multiple-choice answers are saved without your account, to answer the same mistake again. Up to {n} explanations a day.", { n: LIMIT })),
      h("div", { class: "flex flex-wrap gap-2" },
        h("button", { type: "button", class: "btn", onClick: () => { ls.set(NOTICE_KEY, "1"); send(fresh); } }, t("Send and explain")),
        h("button", { type: "button", class: "btn-ghost", onClick: () => out.replaceChildren() }, t("Cancel")))));
  }

  async function send(fresh = false) {
    if (!last) return;
    const k = savedKey();
    btn.disabled = true;
    out.replaceChildren(h("p", { class: "mute text-sm" }, t("Looking at your answer…")));
    try {
      const { data, error } = await sb.functions.invoke("explain-mistake", { body: {
        course: String(course.name || course.id).slice(0, 160), question: String(e.q || "").slice(0, 3000),
        snippet: String(material(e)).slice(0, 4000), expected: expectedOf(e).slice(0, 6000), explain: String(e.explain || "").slice(0, 3000),
        kind: kindOf(e), attempt: last.attempt, verdict: last.verdict, lang: target, ...(fresh ? { fresh: true } : {}),
      } });
      if (error) {
        let msg = error.message, code;
        try { const j = await error.context.json(); msg = j.error || msg; code = j.code; } catch { /* keep the message */ }
        if (error.context?.status === 404) code = "not_configured"; // function not deployed yet
        if (error.name === "FunctionsFetchError") code = "unreachable";
        throw Object.assign(new Error(msg), { code });
      }
      const entry = { text: String(data.text), truncated: !!data.truncated };
      if (!entry.truncated) save(k, entry);
      show(entry, data.saved ? t("Saved from an earlier identical answer: not counted in your daily limit.") : null);
    } catch (err) {
      out.replaceChildren(h("p", { class: "text-sm", style: "color:#e0508b" },
        ERRORS[err.code] ? t(ERRORS[err.code], { n: LIMIT }) : t("The explanation failed: {msg}", { msg: err.message })));
    } finally { btn.disabled = false; }
  }
  return { el, offer, reset };
}
