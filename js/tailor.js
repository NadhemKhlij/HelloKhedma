// "Tailor my CV" dialog (#tailorDialog), opened from an offer card (offers.js) or the CV match (cvpage.js).
// - Honest gap analysis, computed in the browser (ats.js): skills of the offer found in the active CV, the lines of
//   the CV that mention them (to put forward) and the missing skills (with course links).
// - A ready-made prompt for the user's own AI assistant (Claude, ChatGPT…): CV + offer + skills + strict honesty
//   rules (never invent experience, skills or numbers). It is copied to the clipboard only.
//   The prompt templates (PROMPTS) are content, written in English and French like the interface.
// - "Rewrite with AI" (aiSection): signed-in users only. After a notice shown before every send, the CV and the offer
//   go to the cv-tailor Edge Function (Claude API, daily limit per account), which stores nothing. This is the only
//   place where the CV text leaves the browser, and only on that explicit click.
import { $, h, copyText } from "./lib.js";
import { t, lang } from "./i18n.js";
import { sb } from "./supabase.js";
import { state, path, fitColor, skillChip } from "./state.js";
import { extractSkills, matchSkills } from "./ats.js";

const PROMPTS = {
  en: ({ role, matched, missing, title, company, offer, cv }) => `You are an experienced recruiter and CV coach for ${role} roles. Help me tailor my CV to the job offer below, honestly.

Rules (very important):
- Never invent experience, employers, dates, degrees, skills, tools or numbers. Use only what is in my CV.
- Rewrite and reorder my existing bullet points so the ones that match the offer come first, using the offer's wording when it is true for me.
- If a bullet would be stronger with a number I did not give (volume, time saved, %), do not make one up: write [number?] and ask me.
- Do not add a skill the offer asks for that my CV does not show: list it under "Gaps" with an honest way to address it (a related experience I really have, a course to take, or how to talk about it in the interview).
- Write in the same language as my CV, and keep it concise.

Answer with:
1. A 2–3 line profile summary for this offer.
2. My rewritten bullet points, grouped by job, most relevant first.
3. Gaps: requirements I do not meet, and how to address each one honestly.
4. Questions for me: missing numbers or details that would make the CV stronger.

Skills from the offer found in my CV: ${matched || "none detected"}
Skills from the offer missing from my CV: ${missing || "none detected"}

=== JOB OFFER: ${title}${company ? ` at ${company}` : ""} ===
${offer}

=== MY CV ===
${cv}`,
  fr: ({ role, matched, missing, title, company, offer, cv }) => `Tu es un recruteur expérimenté et un coach CV pour les postes de ${role}. Aide-moi à adapter mon CV à l’offre d’emploi ci-dessous, honnêtement.

Règles (très important) :
- N’invente jamais d’expérience, d’employeur, de date, de diplôme, de compétence, d’outil ou de chiffre. Utilise uniquement ce qui figure dans mon CV.
- Réécris et réordonne mes puces existantes pour que celles qui correspondent à l’offre passent en premier, en reprenant le vocabulaire de l’offre quand il est vrai pour moi.
- Si une puce serait plus forte avec un chiffre que je n’ai pas donné (volume, temps gagné, %), n’en invente pas : écris [chiffre ?] et pose-moi la question.
- N’ajoute pas une compétence demandée par l’offre que mon CV ne montre pas : liste-la dans « Écarts » avec une façon honnête d’y répondre (une expérience proche que j’ai vraiment, une formation à suivre, ou comment en parler en entretien).
- Écris dans la même langue que mon CV, et reste concis.

Réponds avec :
1. Un résumé de profil de 2 à 3 lignes pour cette offre.
2. Mes puces réécrites, regroupées par poste, les plus pertinentes d’abord.
3. Écarts : les exigences que je ne remplis pas, et comment répondre honnêtement à chacune.
4. Questions pour moi : les chiffres ou détails manquants qui rendraient le CV plus fort.

Compétences de l’offre présentes dans mon CV : ${matched || "aucune détectée"}
Compétences de l’offre absentes de mon CV : ${missing || "aucune détectée"}

=== OFFRE D’EMPLOI : ${title}${company ? ` chez ${company}` : ""} ===
${offer}

=== MON CV ===
${cv}`,
};

// Lines of the CV that mention at least one skill of the offer, with those skills (most skills first).
function linesToPutForward(cvText, wanted) {
  const want = new Set(wanted);
  return cvText.split(/\n+/).map((line) => line.replace(/^[\s•\-–*·]+/, "").trim()).filter((line) => line.length > 15)
    .map((line) => ({ line, skills: extractSkills(line).map((s) => s.name).filter((n) => want.has(n)) }))
    .filter((x) => x.skills.length)
    .sort((a, b) => b.skills.length - a.skills.length)
    .slice(0, 6);
}

const copy = (text, area, message = t("Prompt copied. Paste it into your AI assistant.")) => copyText(text, area, message);

// Messages for the error codes of the cv-tailor function.
const AI_ERRORS = {
  signed_out: "Sign in to use AI rewriting.",
  limit: "Daily limit reached (5 AI rewrites a day). Use the prompt to copy, or try again tomorrow.",
  not_configured: "AI rewriting is not set up yet. Use the prompt to copy meanwhile.",
  refusal: "The AI declined this request. Use the prompt to copy instead.",
  too_long: "Your CV or the offer is too long for AI rewriting. Use the prompt to copy.",
  busy: "The AI service is busy. Try again in a minute.",
  unreachable: "The AI service can't be reached (no connection, or not set up yet). Use the prompt to copy meanwhile.",
};

// "Rewrite with AI": signed-in users only, a notice before every send, then the answer with a copy button.
// The CV and the offer go to the cv-tailor function (Claude API) only when the user confirms the notice.
function aiSection({ offer, r }) {
  const box = h("div", { class: "grid gap-2 pt-3", style: "border-top:1px solid var(--line)" },
    h("p", { class: "text-sm font-medium" }, t("✨ Rewrite with AI in HelloKhedma")));
  if (!state.user) {
    box.append(h("p", { class: "mute text-xs" }, t("For signed-in users: up to 5 rewrites a day.")),
      h("button", { type: "button", class: "btn-ghost justify-self-start",
        onClick: () => { $("#tailorDialog").close(); $("#authOpen").click(); } }, t("Sign in to use it")));
    return box;
  }
  const out = h("div", { class: "grid gap-2", "aria-live": "polite" });
  const start = h("button", { type: "button", class: "btn justify-self-start", onClick: () => showNotice() }, t("✨ Rewrite with AI"));

  function showNotice() {
    out.replaceChildren(h("div", { class: "rounded-lg p-3 text-sm grid gap-2", style: "background:var(--bg);border:1px solid var(--accent)" },
      h("p", {}, t("Your CV and this offer will be sent to Claude, Anthropic's AI, to write the suggestions. HelloKhedma does not store them. Up to 5 rewrites a day.")),
      h("div", { class: "flex flex-wrap gap-2" },
        h("button", { type: "button", class: "btn", onClick: run }, t("Send and rewrite")),
        h("button", { type: "button", class: "btn-ghost", onClick: () => out.replaceChildren() }, t("Cancel")))));
  }

  async function run() {
    start.disabled = true;
    out.replaceChildren(h("p", { class: "mute text-sm" }, t("Rewriting… this can take up to a minute.")));
    try {
      const { data, error } = await sb.functions.invoke("cv-tailor", { body: {
        cv: state.cv.text.slice(0, 12000), offer: { title: offer.title, company: offer.company, text: String(offer.text || "").slice(0, 6000) },
        matched: r.matched, missing: r.missing, role: path()?.name || offer.title, lang,
      } });
      if (error) {
        let msg = error.message, code;
        try { const j = await error.context.json(); msg = j.error || msg; code = j.code; } catch { /* keep message */ }
        if (error.context?.status === 404) code = "not_configured"; // function not deployed yet
        if (error.name === "FunctionsFetchError") code = "unreachable"; // no connection, or not deployed (no CORS answer)
        throw Object.assign(new Error(msg), { code });
      }
      const result = h("div", { class: "rounded-lg p-3 text-sm whitespace-pre-wrap", style: "background:var(--bg);border:1px solid var(--line)" }, data.text);
      out.replaceChildren(
        h("p", { class: "text-xs", style: "color:#f08a24" }, t("Check every line before using it: the AI can make mistakes, and only you know what is true.")),
        data.truncated ? h("p", { class: "mute text-xs" }, t("The answer was cut short: try again with a shorter offer.")) : null,
        result,
        h("button", { type: "button", class: "btn-ghost justify-self-start", onClick: () => copy(data.text, null, t("Rewrite copied.")) }, t("📋 Copy the rewrite")));
    } catch (e) {
      out.replaceChildren(h("p", { class: "text-sm", style: "color:#e0508b" },
        AI_ERRORS[e.code] ? t(AI_ERRORS[e.code]) : t("AI rewriting failed: {msg}", { msg: e.message })));
    } finally { start.disabled = false; }
  }

  box.append(h("p", { class: "mute text-xs" }, t("Claude rewrites your bullet points for this offer, with the same honesty rules.")), start, out);
  return box;
}

// offer: { title, company, text }
export function openTailor(offer) {
  const dlg = $("#tailorDialog"), body = $("#tailorBody");
  const close = h("button", { type: "button", class: "btn-ghost", onClick: () => dlg.close() }, t("Close"));
  const heading = h("h2", { class: "!mb-0" }, t("Tailor my CV"),
    h("span", { class: "block text-sm font-normal mute mt-1" }, [offer.title, offer.company].filter(Boolean).join(" · ")));

  if (!state.cv.text.trim()) {
    body.replaceChildren(heading, h("p", { class: "text-sm" }, t("Add your CV first on the "),
      h("a", { href: "#/cv", class: "underline", style: "color:var(--accent)", onClick: () => dlg.close() }, t("CV check")), t(" page.")), close);
    dlg.showModal();
    return;
  }

  const required = extractSkills(`${offer.title} ${offer.text}`).map((s) => s.name);
  const r = matchSkills(required, state.cv.names);
  const forward = linesToPutForward(state.cv.text, r.matched);
  const prompt = PROMPTS[lang === "fr" ? "fr" : "en"]({
    role: path()?.name || offer.title, matched: r.matched.join(", "), missing: r.missing.join(", "),
    title: offer.title, company: offer.company, offer: String(offer.text || "").slice(0, 6000), cv: state.cv.text.slice(0, 12000),
  });
  const area = h("textarea", { class: "input w-full text-xs font-mono", rows: "7", readonly: true, "aria-label": t("Prompt for your AI assistant") }, prompt);
  const ext = (href, label) => h("a", { href, target: "_blank", rel: "noopener noreferrer", class: "btn-ghost" }, label);

  body.replaceChildren(
    heading,
    r.total ? h("p", { class: "font-bold", style: `color:${fitColor(r.score)}` }, t("{score}% match", { score: r.score }),
      h("span", { class: "mute text-sm font-normal" }, t(" · {matched} of {total} skills from the offer are in your CV", { matched: r.matched.length, total: r.total }),
        state.cv.name ? ` · ${state.cv.name}` : ""))
      : h("p", { class: "mute text-sm" }, t("No known skills found in this job description.")),
    h("div", {},
      h("p", { class: "text-sm font-medium mb-1" }, t("Put forward: lines of your CV that match the offer")),
      forward.length ? h("ul", { class: "grid gap-1.5 text-sm" }, forward.map((x) => h("li", { class: "rounded-lg p-2", style: "background:var(--bg);border:1px solid var(--line)" },
        h("span", {}, x.line.length > 160 ? `${x.line.slice(0, 160)}…` : x.line),
        h("span", { class: "flex flex-wrap gap-1 mt-1" }, x.skills.map((s) => skillChip(s, true))))))
        : h("p", { class: "mute text-sm" }, t("No line of your CV names a skill of this offer yet: say it explicitly where it is true."))),
    h("div", {},
      h("p", { class: "text-sm font-medium mb-1" }, t("Gaps: don't add them unless they are true · 📘 = HelloKhedma course")),
      r.missing.length ? h("div", { class: "flex flex-wrap gap-1.5" }, r.missing.map((s) => skillChip(s, false)))
        : h("p", { class: "mute text-sm" }, t("Nothing missing."))),
    h("div", { class: "grid gap-2" },
      h("p", { class: "text-sm font-medium" }, t("Rewrite it with your AI assistant")),
      h("p", { class: "mute text-xs" }, t("This prompt contains your CV and the offer, with strict honesty rules. It only leaves this device if you paste it somewhere. Check every line the AI writes before using it.")),
      area,
      h("div", { class: "flex flex-wrap gap-2" },
        h("button", { type: "button", class: "btn", onClick: () => copy(prompt, area) }, t("📋 Copy the prompt")),
        ext("https://claude.ai/new", t("Open Claude ↗")), ext("https://chatgpt.com/", t("Open ChatGPT ↗")))),
    aiSection({ offer, r }),
    h("div", { class: "flex justify-end" }, close),
  );
  dlg.showModal();
  body.scrollTop = 0;
}
