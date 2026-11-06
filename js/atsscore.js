// ATS score (CV page: "Your CV score" for the path and "Match with a job offer", and the live score of the CV maker): an estimate out of 100 of how
// well a CV text passes an applicant tracking system and a recruiter's 10-second scan. There is no single ATS; this
// checks what most of them parse and what recruiters look for, and lists the fixes. Runs in the browser only.
// atsView(report, { compact }): the score ring, one bar per part and the checks (fixes first); compact = top 3 fixes.
// atsReport(text, { required, jobTitles, source }) → { score, parts: [{ key, label, got, max }],
//   checks: [{ ok, text, fix, gain }], match } · required: canonical skill names (offer or path keywords, from ats.js)
//   · jobTitles: titles to look for · source: "offer" (default) or "path" (wording of the skills and title checks)
//   · gain: points out of 100 the score would gain once that check is fixed (fixes are listed biggest gain first).
// Weights: skills 40, job title 5, sections 15, contact 10, impact 15, length 10, layout 5; skills and title only count
// when there is something to compare with. Section names, action verbs and dates are recognised in English and French.
import { h } from "./lib.js";
import { t } from "./i18n.js";
import { extractSkills, matchSkills } from "./ats.js";
import { progressRing } from "./icons.js";
import { fitColor } from "./state.js";

const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
// Section headings, matched on short lines (a heading, not a sentence).
const SECTIONS = [
  ["experience", "Experience", /^(professional |work )?experiences?|^work history|^employment|^experiences? professionnelles?|^parcours professionnel/],
  ["education", "Education", /^education|^formations?|^diplomes?|^etudes|^academic/],
  ["skills", "Skills", /^(technical |key |core )?skills|^competences|^savoir-faire|^outils/],
  ["summary", "Summary", /^(professional )?summary|^profile|^about( me)?|^profil|^resume|^a propos|^objecti(f|ve)/],
];
const VERBS = ["led", "built", "designed", "developed", "created", "improved", "reduced", "increased", "automated", "managed",
  "launched", "delivered", "analysed", "analyzed", "implemented", "migrated", "optimised", "optimized", "deployed", "maintained",
  "wrote", "trained", "resolved", "supported", "coordinated", "organised", "organized", "achieved", "cut", "saved", "grew",
  "drove", "owned", "set", "monitored", "documented", "tested", "defined", "mentored", "configured", "integrated", "modelled", "modeled",
  "concu", "developpe", "cree", "ameliore", "reduit", "augmente", "automatise", "gere", "lance", "livre", "analyse", "mis",
  "migre", "optimise", "deploye", "maintenu", "redige", "forme", "resolu", "accompagne", "coordonne", "organise", "pilote",
  "encadre", "supervise", "realise", "documente", "teste", "defini", "construit", "configure", "integre", "modelise", "assure"];
const BULLET = /^\s*([-•*▪●–◦]|\d+[.)])\s+/;

export function atsReport(text, { required = [], jobTitles = [], source = "offer" } = {}) {
  const fromPath = source === "path";
  const raw = text || "", lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const words = raw.split(/\s+/).filter(Boolean).length;
  const parts = [], checks = [];
  const part = (key, label, got, max) => parts.push({ key, label, got: Math.round(got * 10) / 10, max });
  const check = (ok, text, fix, lost = 0) => checks.push({ ok, text, fix, lost }); // lost: points missing (before scaling)

  // 1. Skills (40): the offer's skills, or the path keywords, found in the CV.
  const match = matchSkills(required, new Set(extractSkills(raw).map((s) => s.name)));
  const skillPts = match.total ? (40 * match.matched.length) / match.total : 0;
  if (match.total) part("skills", fromPath ? t("Keywords of your path") : t("Skills from the offer"), skillPts, 40);
  if (match.total) check(match.score >= 60, fromPath ? t("{matched} of {total} path keywords found", { matched: match.matched.length, total: match.total })
    : t("{matched} of {total} skills found", { matched: match.matched.length, total: match.total }),
  fromPath ? t("Add the keywords you genuinely have, with the usual spelling (in Skills and in your bullets). Missing ones are listed below.")
    : t("Add the missing skills you genuinely have, with the exact words of the offer (in Skills and in your bullets)."), 40 - skillPts);

  // 2. Job title (5): ATS and recruiters search by title.
  const n = norm(raw), title = jobTitles.find((x) => x && n.includes(norm(x)));
  if (jobTitles.length) part("title", t("Job title"), title ? 5 : 0, 5);
  if (jobTitles.length) check(Boolean(title), title ? t("The job title \"{title}\" appears", { title })
    : fromPath ? t("No target job title in your CV") : t("The job title of the offer does not appear"),
  t("Put the target title in your headline, under your name (for example \"{title}\").", { title: jobTitles[0] }), title ? 0 : 5);

  // 3. Sections (15): standard headings are how an ATS splits a CV.
  const short = lines.filter((l) => l.split(/\s+/).length <= 5).map((l) => norm(l).replace(/[:\s]+$/, ""));
  const found = SECTIONS.filter(([, , re]) => short.some((l) => re.test(l)));
  part("sections", t("Standard sections"), (15 * found.length) / SECTIONS.length, 15);
  const missing = SECTIONS.filter((s) => !found.includes(s)).map(([, label]) => t(label));
  check(!missing.length, missing.length ? t("Missing sections: {list}", { list: missing.join(", ") }) : t("Experience, Education, Skills and Summary sections found"),
    t("Use plain headings an ATS knows: Summary, Experience, Education, Skills (or Profil, Expérience, Formation, Compétences)."), (15 * missing.length) / SECTIONS.length);

  // 4. Contact (10): email 4, phone 3, LinkedIn 3.
  const email = /[\w.+-]+@[\w-]+\.[\w.-]+/.test(raw), phone = /(\+?\d[\d .()-]{7,}\d)/.test(raw), linkedin = /linkedin\.com\/in\//i.test(raw);
  part("contact", t("Contact details"), (email ? 4 : 0) + (phone ? 3 : 0) + (linkedin ? 3 : 0), 10);
  check(email && phone, email && phone ? t("Email and phone found") : t("Email or phone missing"), t("Write your email and phone as plain text at the top, not in an image or a header box."), (email ? 0 : 4) + (phone ? 0 : 3));
  check(linkedin, linkedin ? t("LinkedIn profile found") : t("No LinkedIn profile link"), t("Add your LinkedIn URL (linkedin.com/in/…); recruiters open it."), linkedin ? 0 : 3);

  // 5. Impact (15): achievement lines with numbers (10) and starting with an action verb (5).
  let bullets = lines.filter((l) => BULLET.test(l)).map((l) => l.replace(BULLET, ""));
  if (bullets.length < 3) bullets = lines.filter((l) => { const w = l.split(/\s+/).length; return w >= 6 && w <= 45; });
  const withNum = bullets.filter((b) => /\d/.test(b)).length;
  const withVerb = bullets.filter((b) => VERBS.includes(norm(b).split(/[\s,]+/)[0])).length;
  const share = (x) => (bullets.length ? Math.min(1, x / bullets.length / 0.6) : 0); // 60% of the lines is full marks
  part("impact", t("Impact"), 10 * share(withNum) + 5 * share(withVerb), 15);
  check(bullets.length && withNum / bullets.length >= 0.4, t("{n} of {all} achievement lines have a number", { n: withNum, all: bullets.length }),
    t("Quantify: how much, how many, how fast (\"cut report time from 2 days to 2 hours\", \"20 dashboards\")."), 10 - 10 * share(withNum));
  check(bullets.length && withVerb / bullets.length >= 0.5, t("{n} of {all} lines start with an action verb", { n: withVerb, all: bullets.length }),
    t("Start each bullet with what you did: Built, Automated, Reduced, Led… (Conçu, Automatisé, Réduit, Piloté…)."), 5 - 5 * share(withVerb));

  // 6. Length (10): one or two pages of text.
  const len = words < 150 ? 0 : words < 300 ? (words - 150) / 15 : words <= 900 ? 10 : words <= 1300 ? 10 - (words - 900) / 40 : 0;
  part("length", t("Length"), len, 10);
  check(words >= 300 && words <= 900, t("{n} words", { n: words }),
    words < 300 ? t("Too short to show your experience: aim for 300 to 900 words (one or two pages).")
      : t("Long: keep the last 10 years and what matters for this job, 900 words at most."), 10 - len);

  // 7. Layout (5): tables, columns and icons are often lost by ATS parsers; dates help them build your history.
  const tableLike = lines.filter((l) => (l.match(/\||\t/g) || []).length >= 2).length;
  const icons = (raw.match(/[\u{1F300}-\u{1FAFF}☀-➿]/gu) || []).length;
  const years = (raw.match(/\b(19|20)\d{2}\b/g) || []).length;
  part("layout", t("ATS-friendly layout"), (tableLike < 3 ? 2 : 0) + (icons < 3 ? 1.5 : 0) + (years >= 2 ? 1.5 : 0), 5);
  check(tableLike < 3 && icons < 3, tableLike >= 3 || icons >= 3 ? t("Tables, columns or icons found") : t("No tables, columns or icons"),
    t("Use one column and plain text: ATS often scramble tables, text boxes and icons."), (tableLike < 3 ? 0 : 2) + (icons < 3 ? 0 : 1.5));
  check(years >= 2, years >= 2 ? t("Dates found") : t("Few or no dates"), t("Add start and end dates (month and year) to each job and degree."), years >= 2 ? 0 : 1.5);

  // Parts without something to compare with (no offer skills, no job title) are left out and the rest scaled to 100.
  const max = parts.reduce((a, p) => a + p.max, 0);
  const score = Math.round((100 * parts.reduce((a, p) => a + p.got, 0)) / max);
  for (const c of checks) { c.gain = c.ok ? 0 : Math.max(0, Math.round((100 * c.lost) / max)); delete c.lost; }
  return { score, parts, checks, match };
}

// Score ring + parts + checks. compact (CV maker sidebar): no bars, only the 3 first fixes.
export function atsView(r, { compact = false } = {}) {
  const color = fitColor(r.score), done = r.checks.filter((c) => c.ok);
  const todo = r.checks.filter((c) => !c.ok).sort((a, b) => (b.gain || 0) - (a.gain || 0)); // biggest gain first
  const ring = h("div", { class: "relative grid place-items-center shrink-0" }, progressRing(r.score / 100, compact ? 64 : 84),
    h("b", { class: "absolute text-lg", style: `color:${color}` }, String(r.score)));
  const verdict = r.score >= 80 ? t("Strong: ready to send") : r.score >= 60 ? t("Good, a few fixes will help") : r.score >= 40 ? t("Needs work before you send it") : t("Weak: fix the points below first");
  const item = (c) => h("li", { class: "flex gap-2 text-sm" }, h("span", { style: `color:${c.ok ? "#18a999" : "#e0508b"}`, "aria-hidden": "true" }, c.ok ? "✓" : "✗"),
    h("span", { class: "flex-1" }, h("span", { class: c.ok ? "mute" : "font-medium" }, c.text), c.ok ? null : h("span", { class: "mute block" }, c.fix)),
    !c.ok && c.gain > 0 ? h("span", { class: "badge shrink-0 self-start", title: t("Points this fix can add to the score") }, t("+{n} pts", { n: c.gain })) : null);
  return h("div", { class: "grid gap-3" },
    h("div", { class: "flex items-center gap-4" }, ring,
      h("div", {}, h("p", { class: "eyebrow" }, t("ATS score")), h("p", { class: "font-semibold", style: `color:${color}` }, verdict),
        compact ? null : h("p", { class: "mute text-xs" }, t("An estimate: every ATS is different. It checks what most of them read and what recruiters look for.")))),
    compact ? null : h("div", { class: "grid gap-2 sm:grid-cols-2" }, r.parts.map((p) => h("div", { class: "grid gap-1" },
      h("div", { class: "flex justify-between text-xs" }, h("span", {}, p.label), h("span", { class: "mute" }, `${Math.round(p.got)}/${p.max}`)),
      h("div", { class: "h-1.5 rounded-full", style: "background:var(--line)" },
        h("div", { class: "h-1.5 rounded-full", style: `width:${Math.round((100 * p.got) / p.max)}%;background:${fitColor((100 * p.got) / p.max)}` }))))),
    todo.length ? h("ul", { class: "grid gap-2" }, (compact ? todo.slice(0, 3) : todo).map(item))
      : h("p", { class: "text-sm", style: "color:#18a999" }, t("✓ Nothing to fix.")),
    compact || !done.length ? null : h("details", {}, h("summary", { class: "cursor-pointer mute text-sm" }, t("Passed checks ({n})", { n: done.length })),
      h("ul", { class: "grid gap-1 mt-2" }, done.map(item))));
}
