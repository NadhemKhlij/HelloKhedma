// Duplicate offers in the list (functional audit of 2026-11-23, P2). The job-search function already merges offers
// whose title and company match once accents, "(H/F)" and legal forms are removed, but these slipped through:
// "Collective" / "Collective.work", "Brink's" / "Brinks Careers", and the same "Développeur C++ IT Quant" listed by
// the Free-Work job board (shown as the company) and by INGENIANCE. dedupeJobs() runs on every list the Offers page draws
// (search, companies, remote, and "More offers" pages added later):
// - company: no accents, apostrophes, legal forms, web domains (.work, .com…) or words like "careers", "jobs", "France";
// - a job board shown as the company (Free-Work, HelloWork, Indeed…) matches any company with the same title and city,
//   when the title has at least three words (a bare "Data Engineer" stays separate);
// - the kept copy is the one with a real company, then the longer description.
// fixText() repairs what sources send broken (audit 2026-11-23 P2: « au c?ur »): Unicode NFC, a « ? » that replaced a
// typographic apostrophe after l/d/j/n/m/s/t/c/qu (« l?équipe », « d?un »: 10 of 743 cached offers) or the « œ » of common
// words (« c?ur », « ?uvre », « man?uvre »…). Links (« watch?v= ») are left alone. cleanJob() applies it to an offer once.
// No DOM: checked by the smoke tests ("duplicate offers", "broken characters").
const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export const titleKey = (s) => fold(s).replace(/\(?\b(h\s*\/\s*f|f\s*\/\s*h|m\s*\/\s*w\s*\/\s*d|m\s*\/\s*f|w\s*\/\s*m)\b\)?/g, " ")
  .replace(/[^a-z0-9+#]+/g, " ").trim();
export const companyKey = (s) => fold(s).replace(/['’`]/g, "").replace(/\.(work|com|io|fr|co|net|org|eu|tech|ai)\b/g, " ")
  .replace(/\b(sas|sasu|sa|sarl|ltd|limited|inc|gmbh|llc|plc|group|groupe|careers?|jobs?|recrutement|recruitment|hiring|france|international|europe|consulting)\b\.?/g, " ")
  .replace(/[^a-z0-9]+/g, " ").trim();
const BOARDS = new Set(["free work", "freework", "hellowork", "indeed", "welcome to the jungle", "wttj", "jobijoba", "talent", "jooble",
  "adzuna", "monster", "apec", "linkedin", "glassdoor", "meteojob", "cadremploi", "keljob", "regionsjob", "optioncarriere", "careerjet", "jobteaser"]);
const city = (loc) => fold(String(loc || "").split(",")[0]).replace(/[^a-z]+/g, " ").trim();
const better = (a, b) => (BOARDS.has(companyKey(a.company)) !== BOARDS.has(companyKey(b.company)) ? (BOARDS.has(companyKey(a.company)) ? b : a)
  : ((b.text || b.snippet || "").length > (a.text || a.snippet || "").length ? b : a));

export function dedupeJobs(jobs) {
  const byKey = new Map(), byTitle = new Map(), out = [];
  for (const j of jobs) {
    const tk = titleKey(j.title), ck = companyKey(j.company), key = `${tk}|${ck}`;
    const loose = tk.split(" ").length >= 3 ? `${tk}|${city(j.location)}` : null;
    let i = byKey.get(key);
    // A board as the company, on either side: the same title in the same city is the same offer.
    if (i == null && loose && byTitle.has(loose)) {
      const k = byTitle.get(loose), other = out[k];
      if (BOARDS.has(ck) || BOARDS.has(companyKey(other.company))) i = k;
    }
    if (i == null) {
      byKey.set(key, out.length);
      if (loose && !byTitle.has(loose)) byTitle.set(loose, out.length);
      out.push(j);
    } else out[i] = better(out[i], j);
  }
  return out;
}

const OE = /(^|[^a-z])(c|s|man|v|n|b|r|ranc|)\?(ur|urs|uvre|uvres|uvrer|ud|uds|uf|ufs|il|ill|illet|ux)(?=$|[^a-z])/gi;
export function fixText(s) {
  if (!s || !String(s).includes("?")) return s ? String(s).normalize("NFC") : s;
  return String(s).normalize("NFC").split(/(\s+)/).map((w) => (/[/=&]|https?:/i.test(w) ? w : w
    .replace(OE, (m, pre, stem, end) => `${pre}${stem}${!stem && /^[A-Z]/.test(end) ? "Œ" : "œ"}${end}`) // œ first: « c?ur »
    .replace(/(^|[^a-z])(qu|[ldjnmstc])\?(?=[aeiouyhàâäéèêëîïôöûüœ])/gi, "$1$2’"))).join("");
}
export function cleanJob(j) {
  if (j && !j.cleaned) { for (const k of ["title", "company", "location", "text", "snippet"]) if (typeof j[k] === "string") j[k] = fixText(j[k]); j.cleaned = true; }
  return j;
}
