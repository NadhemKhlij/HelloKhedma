// CV maker (CV page, "CV maker" tab, #/cv/maker): a form that builds an ATS-friendly CV with a live preview, a live ATS
// score (atsscore.js) against the path keywords and a real text PDF (cvpdf.js).
// One layout model (cvModel) feeds the preview, the PDF and the plain text, so the three always match. Layout, from the
// owner's CV framework and the usual ATS guidance: one column; centered name, headline and plain contact line (no
// icons); standard section titles in capitals over a rule, in this order: Summary, Skills (grouped, one "Group: a, b"
// per line), Experience, Education, Certifications, Projects, Involvement, Languages; each entry = bold title with the
// dates on the right, organisation and place below, an optional context line, bullets. Arial / Helvetica only.
// - The draft is kept in this browser only ("hk.cvmaker"), like every CV text (never sent to Supabase or any API).
// - CV language (EN / FR) is separate from the interface language: it sets the headings and date words.
// - "Download PDF" builds the PDF in the browser (cvpdf.js; falls back to printing the page if it cannot load).
//   "Use as a CV version" saves the plain text as a CV version (cvs.js), linked to the draft so later saves update it;
//   it then scores offers like any CV. "Download .txt" gives the same plain text.
// - loadAiCv() fills the form with a CV corrected and tailored by AI for one offer ("Correct, tailor and create my CV" in
//   tailor.js, via the cv-tailor function): what was changed and the AI's notes (gaps, [number?] to fill in) are shown
//   above the form until hidden, and "Use as a CV version" then saves it as a new version named after the offer.
import { $, h, ls, toast, download } from "./lib.js";
import { t } from "./i18n.js";
import { path, byKind } from "./state.js";
import { extractSkills } from "./ats.js";
import { atsReport, atsView } from "./atsscore.js";
import { loadCvs, addCv, updateCv, setActiveCv } from "./cvs.js";
import { cvPdf } from "./cvpdf.js";

const KEY = "hk.cvmaker";
const HEAD = {
  en: { summary: "Summary", skills: "Skills", experience: "Experience", education: "Education", projects: "Projects",
    certifications: "Certifications", languages: "Languages", involvement: "Involvement", present: "Present" },
  fr: { summary: "Profil", skills: "Compétences", experience: "Expérience professionnelle", education: "Formation", projects: "Projets",
    certifications: "Certifications", languages: "Langues", involvement: "Engagements", present: "Aujourd’hui" },
};
const EMPTY = { experience: { role: "", company: "", location: "", start: "", end: "", context: "", bullets: "" },
  education: { degree: "", school: "", location: "", start: "", end: "", details: "" },
  projects: { name: "", link: "", bullets: "" },
  involvement: { org: "", role: "", start: "", end: "" } };
const blank = () => ({ lang: "en", name: "", headline: "", email: "", phone: "", location: "", links: "", summary: "", skills: "",
  experience: [{ ...EMPTY.experience }], education: [{ ...EMPTY.education }], projects: [], involvement: [], certifications: "", languages: "", cvId: null,
  aiFor: "", aiChanges: [], aiNotes: [] });

let cv = load(), onSaved = () => {}, timer = 0;
function load() {
  try {
    const c = { ...blank(), ...JSON.parse(ls.get(KEY) || "{}") };
    for (const k of Object.keys(EMPTY)) c[k] = (Array.isArray(c[k]) ? c[k] : []).map((x) => ({ ...EMPTY[k], ...x }));
    return c;
  } catch { return blank(); }
}
const save = () => ls.set(KEY, JSON.stringify(cv));
const lines = (s) => (s || "").split(/\r?\n/).map((x) => x.replace(/^\s*[-•*]\s*/, "").trim()).filter(Boolean);
const skillsOf = (s) => (s || "").split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);
const dates = (e, H) => [e.start, e.end || (e.start ? H.present : "")].filter(Boolean).join(" – ");
const join = (...xs) => xs.filter(Boolean).join(", ");
// Skills: grouped ("Databases: SQL, Oracle", one group per line) or a plain comma-separated list.
const skillLines = (s) => (s || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
const grouped = (s) => skillLines(s).some((l) => /^[^:,]{2,40}:\s*\S/.test(l));

// Fills the form with a CV from the cv-tailor function (mode "cv"). Only known fields are kept, as plain strings.
// Asks first when the form holds a CV that is not saved as a version. Returns false if the user cancels.
export function loadAiCv(data, forOffer) {
  const hasDraft = cv.name.trim() || cv.experience.some((e) => e.role || e.company);
  const saved = cv.cvId && loadCvs().some((c) => c.id === cv.cvId);
  if (hasDraft && !saved && !confirm(t("Replace the CV maker form with the CV for this offer? The current form is not saved as a CV version."))) return false;
  const text = (v, max = 4000) => String(v ?? "").slice(0, max);
  const pick = (kind, arr) => (Array.isArray(arr) ? arr.slice(0, 20) : [])
    .map((x) => Object.fromEntries(Object.keys(EMPTY[kind]).map((k) => [k, text(x?.[k])])));
  const next = blank();
  for (const k of ["name", "headline", "email", "phone", "location", "links", "summary", "skills", "certifications", "languages"]) next[k] = text(data?.[k]);
  next.lang = data?.lang === "fr" ? "fr" : "en";
  next.experience = pick("experience", data?.experience);
  next.education = pick("education", data?.education);
  next.projects = pick("projects", data?.projects);
  next.involvement = pick("involvement", data?.involvement);
  if (!next.experience.length) next.experience = [{ ...EMPTY.experience }];
  if (!next.education.length) next.education = [{ ...EMPTY.education }];
  next.aiFor = text(forOffer, 200);
  const notes = (a) => (Array.isArray(a) ? a : []).slice(0, 20).map((n) => text(n, 600)).filter(Boolean);
  next.aiChanges = notes(data?.changes);
  next.aiNotes = notes(data?.notes);
  cv = next; save();
  return true;
}

// The CV as a layout model: { lang, name, headline, contact[], sections: [{ title, blocks }] }. Blocks: { type: "p", text },
// { type: "label", label, text } (a skill group), { type: "bullets", items }, { type: "entry", title, right, org, place,
// context[], bullets[] } (org in bold under the title, place after it). Used by the preview, the PDF (cvpdf.js) and the plain text (what ATS read).
export function cvModel(c = cv) {
  const H = HEAD[c.lang] || HEAD.en, sections = [];
  const add = (title, blocks) => { if (blocks.length) sections.push({ title, blocks }); };
  const entry = (title, right, org, place, context, bullets) => ({ type: "entry", title, right, org, place, context, bullets });
  add(H.summary, lines(c.summary).map((text) => ({ type: "p", text })));
  add(H.skills, grouped(c.skills)
    ? skillLines(c.skills).map((l) => { const i = l.indexOf(":"); return i > 0 ? { type: "label", label: l.slice(0, i).trim(), text: l.slice(i + 1).trim() } : { type: "p", text: l }; })
    : skillsOf(c.skills).length ? [{ type: "p", text: skillsOf(c.skills).join(", ") }] : []);
  add(H.experience, c.experience.filter((e) => e.role || e.company).map((e) =>
    entry(e.role || e.company, dates(e, H), e.role ? e.company : "", e.location, lines(e.context), lines(e.bullets))));
  add(H.education, c.education.filter((e) => e.degree || e.school).map((e) =>
    entry(e.degree || e.school, dates(e, H), e.degree ? e.school : "", e.location, [], lines(e.details))));
  add(H.certifications, lines(c.certifications).length ? [{ type: "bullets", items: lines(c.certifications) }] : []);
  add(H.projects, c.projects.filter((p) => p.name).map((p) => entry(p.name, "", "", p.link, [], lines(p.bullets))));
  add(H.involvement, c.involvement.filter((v) => v.org || v.role).map((v) => entry([v.org, v.role].filter(Boolean).join(" – "), dates(v, H), "", "", [], [])));
  add(H.languages, lines(c.languages).length ? [{ type: "p", text: lines(c.languages).join(", ") }] : []);
  return { lang: c.lang, name: c.name.trim() || t("Your name"), headline: c.headline.trim(),
    contact: [c.location, c.phone, c.email, ...lines(c.links)].map((x) => x.trim()).filter(Boolean), sections };
}

// Plain text of the CV: what an ATS reads, what is saved as a CV version and downloaded. Same order as the page.
export function cvText(c = cv) {
  const m = cvModel(c), out = [c.name.trim(), m.headline, m.contact.join(" | ")];
  for (const sec of m.sections) {
    out.push("", sec.title.toUpperCase());
    for (const b of sec.blocks) {
      if (b.type === "p") out.push(b.text);
      else if (b.type === "label") out.push(`${b.label}: ${b.text}`);
      else if (b.type === "bullets") out.push(...b.items.map((x) => `• ${x}`));
      else out.push([b.title, b.right].filter(Boolean).join(" | "), ...(b.org || b.place ? [join(b.org, b.place)] : []), ...b.context, ...b.bullets.map((x) => `• ${x}`));
    }
  }
  return out.filter((l, i) => l !== "" || out[i - 1] !== "").join("\n").replace(/^\n+/, "").trim();
}

/* ---------- preview: a white page, the same layout as the PDF ---------- */
function preview() {
  const m = cvModel();
  const ul = (items) => (items.length ? h("ul", {}, items.map((x) => h("li", {}, x))) : null);
  const block = (b) => {
    if (b.type === "p") return h("p", {}, b.text);
    if (b.type === "label") return h("p", {}, h("b", {}, `${b.label}: `), b.text);
    if (b.type === "bullets") return ul(b.items);
    return h("div", { class: "cvp-entry" },
      h("div", { class: "cvp-row" }, h("span", { class: "cvp-title" }, b.title), b.right ? h("span", { class: "cvp-when" }, b.right) : null),
      b.org || b.place ? h("div", { class: "cvp-sub" }, b.org ? h("b", {}, b.org) : null, b.org && b.place ? ", " : "", b.place ? h("span", { class: "cvp-place" }, b.place) : null) : null,
      ...b.context.map((x) => h("p", { class: "cvp-context" }, x)), ul(b.bullets));
  };
  return h("article", { id: "cvPreview", class: "cvp", lang: m.lang },
    h("header", {}, h("h1", {}, m.name), m.headline ? h("p", { class: "cvp-head" }, m.headline) : null,
      m.contact.length ? h("p", { class: "cvp-contact" }, m.contact.flatMap((x, i) => [i ? "  |  " : "", h("span", {}, x)])) : null),
    ...m.sections.map((sec) => h("section", { class: "cvp-sec" }, h("h2", {}, sec.title), ...sec.blocks.map(block))));
}

// Live score against the path keywords and job titles.
function score() {
  const required = extractSkills(byKind("keyword").map((k) => k.title).join(" ; ")).map((s) => s.name);
  return atsReport(cvText(), { required, jobTitles: path()?.job_titles || [] });
}
function redraw() {
  $("#cvmPreview").replaceChildren(preview());
  $("#cvmScore").replaceChildren(atsView(score(), { compact: true }),
    h("p", { class: "mute text-xs" }, t("Scored against the {path} keywords. Paste an offer in the CV check tab for a score against it.", { path: path()?.name || "" })));
}
const later = () => { save(); clearTimeout(timer); timer = setTimeout(redraw, 150); };

/* ---------- form ---------- */
const field = (label, key, obj = cv, opts = {}) => {
  const tag = opts.rows ? "textarea" : "input";
  const el = h(tag, { class: "input w-full", value: opts.rows ? null : obj[key] || "", rows: opts.rows || null, placeholder: opts.ph || "",
    type: opts.type || null, maxlength: opts.max || null, onInput: (e) => { obj[key] = e.target.value; later(); } });
  if (opts.rows) el.value = obj[key] || "";
  return h("label", { class: `grid gap-1 text-sm ${opts.wide ? "sm:col-span-2" : ""}` }, h("span", { class: "mute" }, label), el, opts.hint ? h("span", { class: "mute text-xs" }, opts.hint) : null);
};
const group = (title, ...kids) => h("fieldset", { class: "grid gap-3 sm:grid-cols-2 rounded-xl p-4", style: "border:1px solid var(--line)" },
  h("legend", { class: "px-1 font-semibold text-sm" }, title), ...kids);

function list(kind, title, render) {
  const items = cv[kind];
  return group(title,
    ...items.map((it, i) => h("div", { class: "sm:col-span-2 grid gap-3 sm:grid-cols-2 rounded-xl p-3", style: "background:var(--soft)" },
      ...render(it),
      h("div", { class: "sm:col-span-2 flex gap-2 justify-end text-xs" },
        i ? h("button", { type: "button", class: "btn-ghost !py-1", onClick: () => { [items[i - 1], items[i]] = [items[i], items[i - 1]]; save(); drawForm(); redraw(); } }, t("↑ Move up")) : null,
        h("button", { type: "button", class: "btn-ghost !py-1", onClick: () => { items.splice(i, 1); save(); drawForm(); redraw(); } }, t("Remove"))))),
    h("button", { type: "button", class: "btn-ghost sm:col-span-2 justify-self-start", onClick: () => { items.push({ ...EMPTY[kind] }); save(); drawForm(); redraw(); } }, t("+ Add")));
}

function skillSuggestions() {
  const have = new Set(extractSkills(cv.skills).map((s) => s.name));
  const ideas = [...new Set(extractSkills(byKind("keyword").map((k) => k.title).join(" ; ")).map((s) => s.name))].filter((n) => !have.has(n));
  if (!ideas.length) return null;
  return h("div", { class: "sm:col-span-2 grid gap-1" },
    h("span", { class: "mute text-xs" }, t("Keywords for {path}: click the ones you genuinely have", { path: path()?.name || "" })),
    h("div", { class: "flex flex-wrap gap-1.5" }, ideas.map((n) => h("button", { type: "button", class: "chip text-xs hover:opacity-80",
      onClick: () => { cv.skills = cv.skills.trim() ? `${cv.skills.trim()}, ${n}` : n; save(); drawForm(); redraw(); } }, `+ ${n}`))));
}

function drawForm() {
  const bulletHint = t("One achievement per line. Start with a verb, add a number: \"Automated the monthly report, from 2 days to 2 hours\".");
  $("#cvmForm").replaceChildren(...[ // filter: replaceChildren() would print null as text
    aiPanel(),
    h("div", { class: "flex flex-wrap items-center gap-2" },
      h("label", { class: "text-sm mute flex items-center gap-2" }, t("CV language"),
        h("select", { class: "input !py-1", onChange: (e) => { cv.lang = e.target.value; save(); redraw(); } },
          h("option", { value: "en", selected: cv.lang === "en" }, "English"), h("option", { value: "fr", selected: cv.lang === "fr" }, "Français")))),
    group(t("Contact"),
      field(t("Full name"), "name"), field(t("Headline (target job title)"), "headline", cv, { ph: path()?.job_titles?.[0] || "" }),
      field(t("Email"), "email", cv, { type: "email" }), field(t("Phone"), "phone", cv, { type: "tel" }),
      field(t("City, country"), "location"), field(t("Links (one per line): LinkedIn, GitHub, portfolio"), "links", cv, { rows: 2 })),
    group(t("Summary"), field(t("2 or 3 lines: who you are, what you bring, what you look for"), "summary", cv, { rows: 3, wide: true })),
    group(t("Skills"), field(t("One group per line (\"Databases: SQL, Oracle\") or a comma-separated list, with the exact words recruiters use"), "skills", cv, { rows: 4, wide: true }), skillSuggestions()),
    list("experience", t("Experience"), (e) => [field(t("Job title"), "role", e), field(t("Company"), "company", e), field(t("City"), "location", e),
      h("div", { class: "grid grid-cols-2 gap-2" }, field(t("Start"), "start", e, { ph: "03/2023" }), field(t("End"), "end", e, { ph: t("empty = present") })),
      field(t("Context (optional): team, product, scope"), "context", e, { rows: 2, wide: true }),
      field(t("Achievements"), "bullets", e, { rows: 4, wide: true, hint: bulletHint })]),
    list("education", t("Education"), (e) => [field(t("Degree"), "degree", e), field(t("School"), "school", e), field(t("City"), "location", e),
      h("div", { class: "grid grid-cols-2 gap-2" }, field(t("Start"), "start", e, { ph: "2019" }), field(t("End"), "end", e, { ph: "2022" })),
      field(t("Details (optional, one per line)"), "details", e, { rows: 2, wide: true })]),
    list("projects", t("Projects"), (p) => [field(t("Project name"), "name", p), field(t("Link (GitHub, demo)"), "link", p),
      field(t("What you built and the result"), "bullets", p, { rows: 3, wide: true })]),
    list("involvement", t("Involvement"), (v) => [field(t("Organisation"), "org", v), field(t("Role"), "role", v),
      h("div", { class: "grid grid-cols-2 gap-2 sm:col-span-2" }, field(t("Start"), "start", v, { ph: "2017" }), field(t("End"), "end", v, { ph: "2018" }))]),
    group(t("Certifications and languages"), field(t("Certifications (one per line)"), "certifications", cv, { rows: 2 }),
      field(t("Languages (e.g. French: native, English: C1)"), "languages", cv, { rows: 2 })),
  ].filter(Boolean));
}

// Shown after "Create my CV for this offer": what to check before using the CV.
function aiPanel() {
  if (!cv.aiFor && !cv.aiNotes?.length && !cv.aiChanges?.length) return null;
  const list = (title, items) => (items?.length ? h("div", {}, h("p", { class: "font-medium" }, title),
    h("ul", { class: "grid gap-1 list-disc pl-5" }, items.map((n) => h("li", {}, n)))) : null);
  const todo = cvText().includes("[number?]");
  return h("div", { class: "rounded-xl p-4 grid gap-2 text-sm", style: "border:1px solid var(--accent);background:var(--soft)" },
    h("p", { class: "font-semibold" }, t("✨ Written by AI for: {offer}", { offer: cv.aiFor || t("this offer") })),
    h("p", { class: "text-xs", style: "color:#f08a24" }, t("Check every line before using it: the AI can make mistakes, and only you know what is true.")),
    todo ? h("p", { class: "text-xs font-medium" }, t("Replace each [number?] with a real number, or delete it, before printing.")) : null,
    list(t("What was corrected and tailored"), cv.aiChanges),
    list(t("Gaps and questions"), cv.aiNotes),
    h("button", { type: "button", class: "btn-ghost justify-self-start !py-1 text-xs",
      onClick: () => { cv.aiFor = ""; cv.aiChanges = []; cv.aiNotes = []; save(); drawForm(); } }, t("Hide these notes")));
}

/* ---------- actions ---------- */
function useAsVersion() {
  const text = cvText();
  if (!cv.name.trim() || (!cv.experience.some((e) => e.role || e.company) && !cv.education.some((e) => e.degree || e.school))) {
    toast(t("Fill in your name and at least one job or degree first.")); return;
  }
  const existing = cv.cvId && loadCvs().find((c) => c.id === cv.cvId);
  if (existing) { updateCv(existing.id, { text }); setActiveCv(existing.id); toast(t("CV version \"{name}\" updated.", { name: existing.name })); }
  else { const c = addCv({ name: cv.aiFor ? t("CV · {title}", { title: cv.aiFor }) : t("CV maker · {title}", { title: cv.headline.trim() || path()?.name || "" }), text }); cv.cvId = c.id; save(); toast(t("Saved as a new CV version. It now scores offers.")); }
  onSaved();
}
// "Download PDF": a real text PDF built in the browser (cvpdf.js). If the PDF library cannot load (offline on first use),
// the browser prints a copy of the CV page alone instead (#cvPrint; everything else is display:none in print).
async function downloadPdf(btn) {
  btn.disabled = true;
  try {
    const bytes = await cvPdf(cvModel());
    const name = (cv.name.trim() || "cv").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
    download(`${name || "cv"}-CV.pdf`, bytes, "application/pdf");
  } catch (e) {
    console.warn("CV PDF:", e);
    toast(t("The PDF could not be built here: the print window opens instead (choose \"Save as PDF\")."));
    printCv();
  } finally { btn.disabled = false; }
}
function printCv() {
  const page = preview(); page.removeAttribute("id");
  const box = h("div", { id: "cvPrint" }, page);
  document.body.append(box);
  document.documentElement.classList.add("print-cv");
  window.addEventListener("afterprint", () => { document.documentElement.classList.remove("print-cv"); box.remove(); }, { once: true });
  window.print();
}
function reset() {
  if (!confirm(t("Clear the CV maker form? Your saved CV versions are kept."))) return;
  cv = blank(); save(); drawForm(); redraw();
}

export function renderCvMaker() { drawForm(); redraw(); }
export function initCvMaker(opts = {}) {
  onSaved = opts.onSaved || onSaved;
  $("#cvmActions").replaceChildren(
    h("button", { type: "button", class: "btn", onClick: (e) => downloadPdf(e.currentTarget) }, t("⬇ Download PDF")),
    h("button", { type: "button", class: "btn-ghost", onClick: useAsVersion }, t("Use as a CV version")),
    h("button", { type: "button", class: "btn-ghost", onClick: () => download(`${(cv.name || "cv").replace(/\W+/g, "-").toLowerCase()}.txt`, cvText()) }, t("Download .txt")),
    h("button", { type: "button", class: "btn-ghost", onClick: reset }, t("Clear the form")));
}
