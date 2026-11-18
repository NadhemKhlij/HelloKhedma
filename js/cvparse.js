// "Fill the form from my CV" (CV maker, 2026-11-18): turns a CV's plain text (pasted, or read from a PDF / .txt by ats.js)
// into the CV maker's fields, in the browser, with no AI and nothing sent anywhere. No DOM: tested on sample CVs.
// parseCv(text) → { lang, name, headline, email, phone, location, links, summary, skills, experience: [{ role, company,
//   location, start, end, context, bullets }], education: [{ degree, school, location, start, end, details }], projects:
//   [{ name, link, bullets }], involvement: [{ org, role, start, end }], certifications, languages }
// How: contact details by pattern (e-mail, phone, links); the name and headline from the first lines; sections by their
// headings (English and French); in Experience / Education, an entry starts at a line with a date range ("2021 – 2024",
// "03/2021 - Present", "janv. 2020 – aujourd’hui"), whose other text and the line before give the title and the company;
// lines starting with a bullet (or long sentences) are the achievements. A best effort: the user checks every field.

const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
// Section headings, matched on short lines (no sentence), with or without a final colon.
const SECTIONS = [
  ["summary", /^(professional )?(summary|profile)|^about( me)?$|^profil|^resume$|^a propos|^objecti(f|ve)/],
  ["experience", /^(professional |work )?experiences?|^work history|^employment|^experiences? professionnelles?|^parcours professionnel|^career/],
  ["education", /^education|^formations?|^diplomes?|^etudes|^academic|^cursus/],
  ["skills", /^(technical |key |core )?skills|^competences|^savoir-faire|^outils|^technologies|^tech stack/],
  ["projects", /^(personal |key )?projects?|^projets?/],
  ["certifications", /^certifications?|^certificats?|^licen[cs]es/],
  ["languages", /^languages?|^langues?/],
  ["involvement", /^volunteer|^benevolat|^associati|^engagements?|^activites extra|^extracurricular/],
  ["other", /^interests|^hobbies|^centres? d.interets?|^loisirs|^references/],
];
const sectionOf = (line) => {
  const l = norm(line).replace(/[:\s]+$/, "").trim();
  if (!l || l.split(/\s+/).length > 4 || /\d/.test(l) || /:\s*\S|,/.test(line)) return null; // "Languages: Python, SQL" is a skill line
  return SECTIONS.find(([, re]) => re.test(l))?.[0] || null;
};

const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/;
const PHONE = /(\+\d{1,3}[\s.-]?)?(\(?\d{1,4}\)?[\s.-]?){2,5}\d{2,4}/;
const URL = /\b((https?:\/\/)?(www\.)?(linkedin\.com|github\.com|gitlab\.com|[\w-]+\.(dev|io|me|com|fr|net|org))\/[^\s,;|]*)/gi;
const BULLET = /^\s*[-•*▪‣◦●–—>·]\s*/;

// Months, English and French (also abbreviated), to MM.
const MONTHS = { jan: 1, janv: 1, january: 1, janvier: 1, feb: 2, fev: 2, fevr: 2, february: 2, fevrier: 2, mar: 3, march: 3, mars: 3,
  apr: 4, avr: 4, april: 4, avril: 4, may: 5, mai: 5, jun: 6, june: 6, juin: 6, jul: 7, juil: 7, july: 7, juillet: 7, aug: 8, aout: 8,
  august: 8, sep: 9, sept: 9, september: 9, septembre: 9, oct: 10, october: 10, octobre: 10, nov: 11, november: 11, novembre: 11,
  dec: 12, december: 12, decembre: 12 };
const NOW = /^(present|now|current|today|ongoing|aujourd.?hui|actuel(le)?|en cours|ce jour|maintenant)$/;
const MONTH_RE = "(?:[A-Za-zÀ-ÿ]{3,9}\\.?)";
const POINT = `(?:(?:\\d{1,2}[/.-])?(?:19|20)\\d{2}|${MONTH_RE}\\s+(?:19|20)\\d{2})`;
const RANGE = new RegExp(`(${POINT})\\s*(?:[-–—]|to|à|au|until|jusqu.?à)\\s*(${POINT}|present|now|current|today|ongoing|aujourd.?hui|actuel(?:le)?|en cours|ce jour|maintenant)`, "i");
const SINGLE_YEAR = /\b((?:\d{1,2}\/)?(?:19|20)\d{2})\b/;

// "03/2021", "2021", "March 2021", "janv. 2021" → "03/2021" or "2021"; "Present" → "" (current job).
function oneDate(s) {
  const x = norm(String(s || "").trim()).replace(/\.$/, "");
  if (!x || NOW.test(x)) return "";
  let m = x.match(/^(\d{1,2})[/.-]((?:19|20)\d{2})$/);
  if (m) return `${m[1].padStart(2, "0")}/${m[2]}`;
  m = x.match(/^([a-z]{3,9})\.?\s+((?:19|20)\d{2})$/);
  if (m && MONTHS[m[1]]) return `${String(MONTHS[m[1]]).padStart(2, "0")}/${m[2]}`;
  m = x.match(/(?:19|20)\d{2}/);
  return m ? m[0] : "";
}
// The date range of a line, and the line without it.
function datesOf(line) {
  const m = line.match(RANGE);
  if (m) return { start: oneDate(m[1]), end: oneDate(m[2]), rest: (line.slice(0, m.index) + line.slice(m.index + m[0].length)).trim() };
  const y = line.match(SINGLE_YEAR);
  if (y && line.replace(y[0], "").replace(/[\s()|,·–—-]/g, "").length < 50) return { start: "", end: oneDate(y[1]), rest: line.replace(y[0], "").trim(), single: true };
  return null;
}
const clean = (s) => s.replace(/^[\s|,·–—:()-]+|[\s|,·–—:(-]+$/g, "").replace(/\(\s*\)/g, "").replace(/\s{2,}/g, " ").trim();
// "Data Engineer — Acme, Paris" → ["Data Engineer", "Acme", "Paris"]
const parts = (s) => clean(s).split(/\s+[|–—]\s+|\s+-\s+|\s*\|\s*|,\s+|\s+(?:at|chez|@)\s+/i).map(clean).filter(Boolean);

// Splits a section into entries: a header (title / company / dates, one or two lines) and its bullets.
function entries(lines) {
  const out = [];
  let cur = null;
  const isBullet = (l) => BULLET.test(l) || l.split(/\s+/).length > 14;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (isBullet(l)) {
      if (!cur) cur = { head: [], bullets: [] }, out.push(cur);
      cur.bullets.push(l.replace(BULLET, "").trim());
      continue;
    }
    // A header line: a new entry, unless the current entry only has its header so far (a 2nd header line), and no
    // date was found yet or this line carries no date (title on one line, company and dates on the next).
    const hasDate = Boolean(datesOf(l));
    const curHasDate = cur && cur.head.some((x) => datesOf(x));
    if (cur && !cur.bullets.length && cur.head.length < 3 && !(curHasDate && hasDate)) cur.head.push(l);
    else { cur = { head: [l], bullets: [] }; out.push(cur); }
  }
  return out;
}

function experienceOf(lines) {
  return entries(lines).map(({ head, bullets }) => {
    const e = { role: "", company: "", location: "", start: "", end: "", context: "", bullets: bullets.join("\n") };
    const bits = [];
    for (const l of head) {
      const d = datesOf(l);
      if (d && !e.start && !e.end) { e.start = d.single ? d.end : d.start; e.end = d.end; bits.push(...parts(d.rest)); } // a single year: start = end
      else bits.push(...parts(l));
    }
    [e.role = "", e.company = "", e.location = ""] = bits;
    if (bits.length > 3) e.context = bits.slice(3).join(", ");
    return e;
  }).filter((e) => e.role || e.company || e.bullets);
}

function educationOf(lines) {
  return entries(lines).map(({ head, bullets }) => {
    const e = { degree: "", school: "", location: "", start: "", end: "", details: bullets.join("\n") };
    const bits = [];
    for (const l of head) {
      const d = datesOf(l);
      if (d && !e.start && !e.end) { e.start = d.single ? "" : d.start; e.end = d.end; bits.push(...parts(d.rest)); }
      else bits.push(...parts(l));
    }
    [e.degree = "", e.school = "", e.location = ""] = bits;
    return e;
  }).filter((e) => e.degree || e.school);
}

function projectsOf(lines) {
  return entries(lines).map(({ head, bullets }) => {
    const text = head.join(" ");
    const link = (text.match(URL) || [])[0] || "";
    return { name: clean(text.replace(link, "")), link, bullets: bullets.join("\n") };
  }).filter((p) => p.name || p.bullets);
}

function involvementOf(lines) {
  return entries(lines).map(({ head }) => {
    const e = { org: "", role: "", start: "", end: "" };
    const bits = [];
    for (const l of head) {
      const d = datesOf(l);
      if (d && !e.start && !e.end) { e.start = d.single ? d.end : d.start; e.end = d.end; bits.push(...parts(d.rest)); } else bits.push(...parts(l));
    }
    [e.role = "", e.org = ""] = bits;
    return e;
  }).filter((e) => e.org || e.role);
}

export function parseCv(text) {
  const all = String(text || "").replace(/\r/g, "").split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const cv = { lang: "en", name: "", headline: "", email: "", phone: "", location: "", links: "", summary: "", skills: "",
    experience: [], education: [], projects: [], involvement: [], certifications: "", languages: "" };
  if (!all.length) return cv;
  const fr = /\b(exp[eé]rience professionnelle|comp[eé]tences|formation|langues|aujourd.?hui|janvier|f[eé]vrier|mars|avril|stage|ing[eé]nieur)\b/i;
  cv.lang = fr.test(all.join(" ")) ? "fr" : "en";

  // Contact details anywhere in the first lines (before the first section) or the whole CV for e-mail / links.
  const whole = all.join("\n");
  cv.email = (whole.match(EMAIL) || [""])[0];
  const firstSection = all.findIndex((l) => sectionOf(l));
  const top = all.slice(0, firstSection < 0 ? Math.min(all.length, 6) : firstSection);
  // Profile links: those of the header, and a LinkedIn link anywhere (project links stay with their project).
  const links = [...new Set([...(top.join("\n").match(URL) || []), ...(whole.match(URL) || []).filter((u) => /linkedin\.com/i.test(u))]
    .filter((u) => !u.includes("@")))];
  URL.lastIndex = 0;
  cv.links = links.join("\n");
  for (const l of top) {
    if (!cv.phone) { const p = l.replace(EMAIL, " ").match(PHONE); if (p && p[0].replace(/\D/g, "").length >= 8) cv.phone = p[0].trim(); }
  }
  // Name: the first short line that is not contact; headline: the next short line that is not contact either.
  const isContact = (l) => EMAIL.test(l) || /linkedin|github|https?:/i.test(l) || (PHONE.test(l) && l.replace(/\D/g, "").length >= 8 && l.split(/\s+/).length <= 6);
  const plain = top.filter((l) => !isContact(l));
  const short = (l) => l.split(/\s+/).length <= 6 && !/[.!?]$/.test(l);
  // A short line with a comma or a well-known place near the top: the location (found before the headline).
  const PLACE = /,|\b(france|tunisi[ae]|uk|usa|paris|lyon|lille|marseille|toulouse|bordeaux|nantes|tunis|sfax|sousse|london|remote|t[eé]l[eé]travail)\b/i;
  const looksPlace = (l) => l.split(/\s+/).length <= 5 && PLACE.test(l);
  if (plain[0] && short(plain[0])) cv.name = plain[0] === plain[0].toUpperCase() ? plain[0].toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()) : plain[0]; // JOHN DOE → John Doe
  const loc = plain.slice(cv.name ? 1 : 0).find(looksPlace);
  const rest = plain.slice(cv.name ? 1 : 0).filter((l) => l !== loc);
  if (rest[0] && rest[0].split(/\s+/).length <= 10 && !/[.!?]$/.test(rest[0])) cv.headline = rest.shift();
  if (loc) cv.location = loc;
  else {
    const contactLine = top.find((l) => EMAIL.test(l) || PHONE.test(l));
    const piece = contactLine?.split(/\s*[|·•]\s*/).find((x) => x && !EMAIL.test(x) && !URL.test(x) && x.replace(/\D/g, "").length < 6 && x.split(/\s+/).length <= 4);
    URL.lastIndex = 0;
    if (piece) cv.location = piece.trim();
  }
  // Lines between the header and the first section with no heading: a summary.
  const intro = rest.filter((l) => l !== cv.location && !short(l));

  // Sections.
  const bySection = {};
  let curName = null;
  for (const l of all.slice(firstSection < 0 ? all.length : firstSection)) {
    const s = sectionOf(l);
    if (s) { curName = s; bySection[s] ||= []; continue; }
    if (curName) bySection[curName].push(l);
  }
  cv.summary = (bySection.summary || intro).join(" ").trim();
  // Skills: keep "Group: a, b" lines; plain lines become one comma-separated list.
  const sk = (bySection.skills || []).map((l) => l.replace(BULLET, "").trim());
  cv.skills = sk.some((l) => /^[^:,]{2,40}:\s*\S/.test(l)) ? sk.join("\n") : sk.join(", ").replace(/\s*,\s*,/g, ",");
  cv.experience = experienceOf(bySection.experience || []);
  cv.education = educationOf(bySection.education || []);
  cv.projects = projectsOf(bySection.projects || []);
  cv.involvement = involvementOf(bySection.involvement || []);
  cv.certifications = (bySection.certifications || []).map((l) => l.replace(BULLET, "").trim()).join("\n");
  cv.languages = (bySection.languages || []).map((l) => l.replace(BULLET, "").trim()).join("\n");
  return cv;
}
