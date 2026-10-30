// Letters pack (#letterDialog, ROADMAP 5.1): the messages a job hunter sends around an application.
// - openCoverLetter(offer): from an offer card (offers.js) or the CV match (cvpage.js). A ready-made prompt for the
//   user's own AI assistant (CV + offer + skills found / missing + honesty rules). Copied to the clipboard only:
//   nothing is sent by HelloKhedma, like the Tailor prompt (tailor.js).
// - openCardLetter(card, kind): from a tracker card (tracker.js) or Home "Next actions" (home.js). A thank-you email
//   after an interview, or a follow-up email (after applying / after an interview), filled from the card (role,
//   company, contact, dates). Editable, then copied or opened in the user's email app (mailto:). No AI needed.
// - The letter language (EN / FR) is chosen in the dialog, separately from the interface language: the default is
//   the offer's language for a cover letter, the interface language otherwise. Templates are content, written in
//   both languages like PROMPTS in tailor.js; [brackets] are for the user to fill in.
import { $, h, toast, copyText } from "./lib.js";
import { t, lang } from "./i18n.js";
import { state, path, skillChip } from "./state.js";
import { extractSkills, matchSkills } from "./ats.js";

const COVER = {
  en: ({ role, matched, missing, title, company, offer, cv, me }) => `You are an experienced recruiter for ${role} roles. Write a cover letter for the job offer below, using my CV, honestly.

Rules (very important):
- Never invent experience, employers, dates, degrees, skills, tools or numbers. Use only what is in my CV.
- 250 to 350 words, in English. Plain and specific: no clichés ("I am passionate…", "dynamic team player").
- Structure: 1) why this company and this role (use what the offer says about them); 2) two or three proofs from my CV that match the main requirements, with results when my CV gives them; 3) a short, confident closing that asks for an interview.
- For a requirement I do not meet, do not claim it: if it matters, mention a related experience I really have, or say briefly that I am learning it.
- Where a detail is missing (name of the recruiter, a number, why I like the company), write it in [brackets] so I can fill it in.
- Sign with: ${me}

Skills from the offer found in my CV: ${matched || "none detected"}
Skills from the offer missing from my CV: ${missing || "none detected"}

=== JOB OFFER: ${title}${company ? ` at ${company}` : ""} ===
${offer}

=== MY CV ===
${cv}`,
  fr: ({ role, matched, missing, title, company, offer, cv, me }) => `Tu es un recruteur expérimenté pour les postes de ${role}. Rédige une lettre de motivation pour l’offre d’emploi ci-dessous, à partir de mon CV, honnêtement.

Règles (très important) :
- N’invente jamais d’expérience, d’employeur, de date, de diplôme, de compétence, d’outil ou de chiffre. Utilise uniquement ce qui figure dans mon CV.
- 250 à 350 mots, en français, vouvoiement. Simple et précis : pas de formules toutes faites (« passionné », « dynamique et motivé »).
- Structure : 1) vous : pourquoi cette entreprise et ce poste (à partir de ce que dit l’offre) ; 2) moi : deux ou trois preuves tirées de mon CV qui répondent aux principales exigences, avec des résultats quand mon CV en donne ; 3) nous : ce que je peux apporter, et une demande d’entretien. Formule de politesse courte.
- Pour une exigence que je ne remplis pas, ne prétends pas l’avoir : si elle compte, cite une expérience proche que j’ai vraiment, ou dis brièvement que je suis en train de l’apprendre.
- Quand un détail manque (nom du recruteur, chiffre, raison de mon intérêt pour l’entreprise), écris-le entre [crochets] pour que je le complète.
- Signe avec : ${me}

Compétences de l’offre présentes dans mon CV : ${matched || "aucune détectée"}
Compétences de l’offre absentes de mon CV : ${missing || "aucune détectée"}

=== OFFRE D’EMPLOI : ${title}${company ? ` chez ${company}` : ""} ===
${offer}

=== MON CV ===
${cv}`,
};

// Email templates for a tracker card. v: { hello, role, at, when, applied, me } already in the letter language.
const EMAILS = {
  en: {
    thanks: (v) => ({
      subject: `Thank you for the interview – ${v.role}`,
      body: `${v.hello}

Thank you for taking the time to meet with me ${v.when} about the ${v.role} position${v.at}. I enjoyed learning more about [a topic you discussed], and our conversation confirmed my interest in the role.

[One sentence linking a point from the interview to your experience.]

Please let me know if you need anything else from me. I look forward to hearing about the next steps.

Best regards,
${v.me}`,
    }),
    followApplied: (v) => ({
      subject: `Following up on my application – ${v.role}`,
      body: `${v.hello}

I applied for the ${v.role} position${v.at} ${v.applied} and wanted to check on the status of my application. I am still very interested in the role and would be glad to share more about how my experience with [a key skill from the offer] could help your team.

Thank you for your time,
${v.me}`,
    }),
    followInterview: (v) => ({
      subject: `Next steps – ${v.role}`,
      body: `${v.hello}

I hope you are well. I am following up on our interview${v.whenOf} for the ${v.role} position${v.at}. I remain very interested in the role and would be glad to know if there is any news on the next steps, or anything else I can provide.

Best regards,
${v.me}`,
    }),
  },
  fr: {
    thanks: (v) => ({
      subject: `Merci pour l’entretien – ${v.role}`,
      body: `${v.hello}

Je vous remercie pour le temps que vous m’avez accordé ${v.when} lors de notre entretien pour le poste ${v.deRole}${v.at}. J’ai apprécié d’en apprendre davantage sur [un sujet abordé], et cet échange a confirmé mon intérêt pour le poste.

[Une phrase qui relie un point de l’entretien à votre expérience.]

Je reste à votre disposition pour tout complément d’information et serais ravi(e) de connaître la suite du processus.

Bien cordialement,
${v.me}`,
    }),
    followApplied: (v) => ({
      subject: `Suivi de ma candidature – ${v.role}`,
      body: `${v.hello}

J’ai postulé ${v.applied} au poste ${v.deRole}${v.at} et je me permets de revenir vers vous pour connaître l’état de ma candidature. Ce poste m’intéresse toujours beaucoup, et je serais heureux(se) de vous présenter plus en détail ce que mon expérience en [une compétence clé de l’offre] pourrait apporter à votre équipe.

Je vous remercie pour votre retour,
${v.me}`,
    }),
    followInterview: (v) => ({
      subject: `Suite de notre entretien – ${v.role}`,
      body: `${v.hello}

J’espère que vous allez bien. Je reviens vers vous à la suite de notre entretien${v.whenOf} pour le poste ${v.deRole}${v.at}. Ce poste m’intéresse toujours vivement, et je souhaiterais savoir si vous avez des nouvelles concernant les prochaines étapes, ou si je peux vous transmettre d’autres éléments.

Bien cordialement,
${v.me}`,
    }),
  },
};

// Rough language of a text, from frequent short words (for the default letter language of an offer).
function textLang(text) {
  const count = (re) => (` ${text} `.toLowerCase().match(re) || []).length;
  return count(/\s(et|les|des|pour|vous|nous|une|avec|sur|dans)\s/g) > count(/\s(and|the|for|you|with|our|we|are|this|of)\s/g) ? "fr" : "en";
}

// Sender name from the account when the provider gave one, otherwise a placeholder to fill in.
const myName = (l) => {
  const m = state.user?.user_metadata || {};
  return (m.full_name || m.name || "").trim() || (l === "fr" ? "[Votre nom]" : "[Your name]");
};

// Contact field of a card ("Marie Dupont, marie@acme.com, recruiter"): first email address and the name before it.
export function parseContact(contact = "") {
  const email = (contact.match(/[^\s,;<>()]+@[^\s,;<>()]+\.[a-z]{2,}/i) || [""])[0];
  const name = contact.replace(email, "").split(/[,;(<\n]/)[0].replace(/[-–:|]+$/, "").trim();
  return { email, name: /^[\p{L}][\p{L} .'’-]{1,40}$/u.test(name) ? name : "" };
}

const dateIn = (l, d) => new Date(d).toLocaleDateString(l === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "long" });
const appliedAt = (c) => (c.history || []).find((x) => x.stage === "applied")?.at || (c.stage === "applied" ? c.created_at : null);

function emailFor(c, kind, l) {
  const { name } = parseContact(c.contact);
  const fr = l === "fr";
  const past = c.interview_at && new Date(c.interview_at).getTime() < Date.now();
  const v = {
    hello: fr ? `Bonjour${name ? ` ${name}` : ""},` : name ? `Dear ${name},` : "Hello,",
    role: c.title || (fr ? "[intitulé du poste]" : "[job title]"),
    deRole: c.title ? (/^[aeiouyéèêh]/i.test(c.title) ? `d’${c.title}` : `de ${c.title}`) : "de [intitulé du poste]", // French elision
    at: c.company ? (fr ? ` chez ${c.company}` : ` at ${c.company}`) : "",
    when: past ? (fr ? `le ${dateIn(l, c.interview_at)}` : `on ${dateIn(l, c.interview_at)}`) : fr ? "aujourd’hui" : "today",
    whenOf: past ? (fr ? ` du ${dateIn(l, c.interview_at)}` : ` on ${dateIn(l, c.interview_at)}`) : "", // "our interview[ on 29 October]"
    applied: appliedAt(c) ? (fr ? `le ${dateIn(l, appliedAt(c))}` : `on ${dateIn(l, appliedAt(c))}`) : fr ? "récemment" : "recently",
    me: myName(l),
  };
  const set = EMAILS[fr ? "fr" : "en"];
  if (kind === "thanks") return set.thanks(v);
  // After an interview (done, or with no date recorded); an interview still to come gets the after-applying email.
  return past || (c.stage === "interview" && !c.interview_at) ? set.followInterview(v) : set.followApplied(v);
}

/* ---------- dialog ---------- */
const ext = (href, label) => h("a", { href, target: "_blank", rel: "noopener noreferrer", class: "btn-ghost" }, label);
const tabs = (label, items, current, onPick) => h("div", { role: "tablist", "aria-label": label },
  items.map(([id, text]) => h("button", { type: "button", role: "tab", class: id === current ? "btn" : "btn-ghost",
    "aria-selected": String(id === current), onClick: () => id !== current && onPick(id) }, text)));
const langTabs = (current, onPick) => h("div", { class: "flex flex-wrap items-center gap-2" },
  h("span", { class: "mute text-sm" }, t("Letter language")),
  tabs(t("Letter language"), [["en", "English"], ["fr", "Français"]], current, onPick));

function show(heading, ...parts) {
  const dlg = $("#letterDialog");
  $("#letterBody").replaceChildren(heading, ...parts.filter(Boolean), // replaceChildren would print null
    h("div", { class: "flex justify-end" }, h("button", { type: "button", class: "btn-ghost", onClick: () => dlg.close() }, t("Close"))));
  if (!dlg.open) dlg.showModal();
  $("#letterBody").scrollTop = 0;
}
const title = (text, sub) => h("h2", { class: "!mb-0" }, text, h("span", { class: "block text-sm font-normal mute mt-1" }, sub));

// offer: { title, company, text }
export function openCoverLetter(offer, l = textLang(`${offer.title} ${offer.text}`)) {
  const heading = title(t("Cover letter"), [offer.title, offer.company].filter(Boolean).join(" · "));
  if (!state.cv.text.trim()) {
    show(heading, h("p", { class: "text-sm" }, t("Add your CV first on the "),
      h("a", { href: "#/cv", class: "underline", style: "color:var(--accent)", onClick: () => $("#letterDialog").close() }, t("CV check")), t(" page.")));
    return;
  }
  const r = matchSkills(extractSkills(`${offer.title} ${offer.text}`).map((s) => s.name), state.cv.names);
  const prompt = COVER[l]({
    role: path()?.name || offer.title, matched: r.matched.join(", "), missing: r.missing.join(", "),
    title: offer.title, company: offer.company, offer: String(offer.text || "").slice(0, 6000), cv: state.cv.text.slice(0, 12000), me: myName(l),
  });
  const area = h("textarea", { class: "input w-full text-xs font-mono", rows: "8", readonly: true, "aria-label": t("Prompt for your AI assistant") }, prompt);
  show(heading,
    h("p", { class: "text-sm" }, t("A ready-made prompt for your own AI assistant: it writes a first draft from your CV and this offer, without inventing anything.")),
    langTabs(l, (next) => openCoverLetter(offer, next)),
    r.total ? h("div", { class: "grid gap-1" },
      h("p", { class: "text-sm font-medium" }, t("The letter will put forward")),
      r.matched.length ? h("div", { class: "flex flex-wrap gap-1.5" }, r.matched.map((s) => skillChip(s, true)))
        : h("p", { class: "mute text-sm" }, t("No skill of this offer was found in your CV: the letter will lean on related experience."))) : null,
    h("p", { class: "mute text-xs" }, t("This prompt contains your CV and the offer. It only leaves this device if you paste it somewhere. Read the letter and fill in the [brackets] before sending it.")),
    area,
    h("div", { class: "flex flex-wrap gap-2" },
      h("button", { type: "button", class: "btn", onClick: () => copyText(prompt, area, t("Prompt copied. Paste it into your AI assistant.")) }, t("📋 Copy the prompt")),
      ext("https://claude.ai/new", t("Open Claude ↗")), ext("https://chatgpt.com/", t("Open ChatGPT ↗"))));
}

// kind: "thanks" | "followup". A thank-you only makes sense once the card reached the interview stage.
export function openCardLetter(c, kind = defaultKind(c), l = lang === "fr" ? "fr" : "en") {
  if (c.stage !== "interview") kind = "followup";
  const { email } = parseContact(c.contact);
  const mail = emailFor(c, kind, l);
  const subject = h("input", { class: "input w-full", value: mail.subject, "aria-label": t("Subject") });
  const body = h("textarea", { class: "input w-full text-sm", rows: "12", "aria-label": t("Email") }, mail.body);
  const full = () => `${subject.value}\n\n${body.value}`;
  const reopen = (k, lg) => openCardLetter(c, k, lg);
  show(title(kind === "thanks" ? t("Thank-you email") : t("Follow-up email"), [c.title, c.company].filter(Boolean).join(" · ")),
    c.stage === "interview" ? tabs(t("Email type"), [["thanks", t("Thank-you")], ["followup", t("Follow-up")]], kind, (k) => reopen(k, l)) : null,
    h("p", { class: "text-sm mute" }, kind === "thanks"
      ? t("Send it within 24 hours of the interview. Make it personal: replace the [brackets] with what you really talked about.")
      : t("Short and polite works best. Wait about a week after applying or after the interview before following up.")),
    langTabs(l, (next) => reopen(kind, next)),
    h("label", { class: "grid gap-1 text-sm" }, t("Subject"), subject),
    h("label", { class: "grid gap-1 text-sm" }, t("Email"), body),
    email ? null : h("p", { class: "mute text-xs" }, t("Tip: add the recruiter's email address in the Contact field of the application to open it ready to send.")),
    h("div", { class: "flex flex-wrap gap-2" },
      h("button", { type: "button", class: "btn", onClick: () => copyText(full(), body, t("Email copied.")) }, t("📋 Copy the email")),
      h("button", { type: "button", class: "btn-ghost", onClick: () => {
        if (/\[[^\]]+\]/.test(body.value)) toast(t("Fill in the [brackets] before sending."));
        location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject.value)}&body=${encodeURIComponent(body.value)}`;
      } }, t("✉ Open in my email app"))));
}

// Thank-you when the interview is today or done (or has no date), follow-up otherwise.
function defaultKind(c) {
  if (c.stage !== "interview") return "followup";
  if (!c.interview_at) return "thanks";
  const ago = Date.now() - new Date(c.interview_at).getTime();
  return ago > -2 * 3600_000 && ago < 4 * 86_400_000 ? "thanks" : "followup";
}
