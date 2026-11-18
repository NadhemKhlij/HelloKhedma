// Job board links for the Offers page (offers.js renderBoards, through jobs.js): the same search opened directly on the
// country's boards. No DOM and no import, so scripts/check-links.mjs can build sample links and check them from CI.
// Job boards by country (2026-11-18): LinkedIn and Google Jobs everywhere, the country's Indeed, and the main local boards.
// Search link formats are checked from GitHub's servers by scripts/check-links.mjs (a sample search per country).
const INDEED = { fr: "fr", gb: "uk", us: "www", de: "de", nl: "nl", ca: "ca", au: "au", be: "be", ch: "ch", es: "es", it: "it" };
const slug = (s) => String(s || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export function boardLinks(q, loc, country = "fr") {
  const e = encodeURIComponent;
  const local = {
    fr: [["Welcome to the Jungle", `https://www.welcometothejungle.com/fr/jobs?query=${e(q)}`],
      ["France Travail", `https://candidat.francetravail.fr/offres/recherche?motsCles=${e(q)}&lieux=${e(loc)}`]],
    es: [["InfoJobs", `https://www.infojobs.net/jobsearch/search-results/list.xhtml?keyword=${e(q)}`],
      ["Tecnoempleo", `https://www.tecnoempleo.com/ofertas-trabajo/?te=${e(q)}`]],
    gb: [["Reed", `https://www.reed.co.uk/jobs?keywords=${e(q)}&location=${e(loc)}`]],
    us: [["Dice", `https://www.dice.com/jobs?q=${e(q)}&location=${e(loc)}`]],
    de: [["StepStone", `https://www.stepstone.de/jobs/${slug(q)}${loc ? `/in-${slug(loc)}` : ""}`]],
    ch: [["jobs.ch", `https://www.jobs.ch/en/vacancies/?term=${e(q)}${loc ? `&location=${e(loc)}` : ""}`]],
    ca: [["Job Bank", `https://www.jobbank.gc.ca/jobsearch/jobsearch?searchstring=${e(q)}&locationstring=${e(loc)}`]],
    au: [["SEEK", `https://www.seek.com.au/${slug(q)}-jobs${loc ? `/in-${slug(loc)}` : ""}`]],
  };
  return [
    ["LinkedIn", `https://www.linkedin.com/jobs/search/?keywords=${e(q)}&location=${e(loc)}`],
    ["Indeed", `https://${INDEED[country] || "www"}.indeed.com/jobs?q=${e(q)}&l=${e(loc)}`],
    ...(local[country] || []),
    ["Google Jobs", `https://www.google.com/search?q=${e(`${q} jobs ${loc}`)}&ibp=htl;jobs`],
  ];
}
