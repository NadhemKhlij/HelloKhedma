// Static pages for search engines (owner request 2026-11-23: "make the site findable on Google").
// The app lives behind hash routes (#/course/…), which search engines treat as a single page. This script writes one
// plain HTML page per course and per career path, in English and French, plus the hub pages and a full sitemap:
//   /learn/                     /fr/formation/                  all courses, grouped by career path
//   /learn/<course id>/         /fr/formation/<course id>/      a course: summary, lessons and key points, interview Q&A
//   /careers/<path id>/         /fr/metiers/<path id>/          a career path: job titles, courses, interview questions
//                                                               with model answers, portfolio projects
//   /sitemap.xml                every page above, with hreflang alternates
//   /content/paths.json         the career paths as career_paths rows, drawn on Home before Supabase answers
//                               (js/app.js; audit 2026-11-23 P3: the path cards stayed empty while loading)
// Each page links into the app ("/?lang=fr&path=grc#/course/grc-risk": js/i18n.js reads lang, js/app.js reads path).
// Content comes from the same files the app reads (content/courses, content/interview, content/projects, content/ai)
// and, for path names, blurbs and job titles, from supabase/seed.sql (no network: the build stays reproducible).
// No script, no tracker, no cookie on these pages; text is HTML-escaped. Run by deploy.yml after "Assemble site":
//   node scripts/gen-pages.mjs _site
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { courseTime, formatMinutes } from "../js/coursetime.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.argv[2] || join(ROOT, "_site");
const SITE = "https://hellokhedma.io";
const read = (...p) => JSON.parse(readFileSync(join(ROOT, ...p), "utf8"));
const maybe = (...p) => (existsSync(join(ROOT, ...p)) ? read(...p) : null);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const clip = (s, n = 155) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s; };

/* ---------- words of the two languages ---------- */
const W = {
  en: {
    learn: "/learn/", course: (id) => `/learn/${id}/`, career: (id) => `/careers/${id}/`, other: "fr", switchLabel: "Français",
    coursesTitle: "Free courses for your job hunt", coursesIntro: "Short, practical courses with exercises, quizzes and interview questions, written for people preparing a job in data, IT, product, project management, GRC, marketing, finance or sales. Free, in English and French.",
    free: "Free", lessons: (n) => `${n} lessons`, start: "Start this course, free", openApp: "Open HelloKhedma",
    why: "Why this course", outcome: "What you will be able to do", lessonList: "Lessons", practice: "Practice",
    practiceText: (e, a) => `${e} exercises (${a} checked automatically), a quiz and flashcards built from the cheat sheet, and a placement test to skip what you already know.`,
    interview: "Interview questions", usedBy: "Career paths that use this course", skills: "Skills",
    careerTitle: (n) => `${n}: free roadmap, courses and interview prep`, careerIntro: (n) => `Everything HelloKhedma offers for a ${n} job hunt: live offers, a learning roadmap, CV keywords and interview preparation, free.`,
    titles: "Job titles to search", pathCourses: "Courses", roleQuestions: "Interview questions with model answers", projects: "Portfolio projects",
    openPath: (n) => `Open the ${n} path`, allCourses: "All courses", careers: "Career paths", hours: (h) => `about ${h} h`,
    privacy: "Privacy", legal: "Legal notice", tagline: "Job offers, CV score, free courses and interview prep.", answer: "Model answer",
    titleSuffix: "free course", aiTrack: "AI engineer track",
  },
  fr: {
    learn: "/fr/formation/", course: (id) => `/fr/formation/${id}/`, career: (id) => `/fr/metiers/${id}/`, other: "en", switchLabel: "English",
    coursesTitle: "Des cours gratuits pour votre recherche d’emploi", coursesIntro: "Des cours courts et concrets, avec exercices, quiz et questions d’entretien, écrits pour préparer un poste dans la data, l’IT, le produit, la gestion de projet, la GRC, le marketing, la finance ou la vente. Gratuits, en français et en anglais.",
    free: "Gratuit", lessons: (n) => `${n} leçons`, start: "Commencer ce cours, gratuitement", openApp: "Ouvrir HelloKhedma",
    why: "Pourquoi ce cours", outcome: "Ce que vous saurez faire", lessonList: "Leçons", practice: "Pratique",
    practiceText: (e, a) => `${e} exercices (${a} corrigés automatiquement), un quiz et des cartes mémoire tirés de la fiche, et un test de positionnement pour passer ce que vous savez déjà.`,
    interview: "Questions d’entretien", usedBy: "Métiers qui utilisent ce cours", skills: "Compétences",
    careerTitle: (n) => `${n} : parcours, cours gratuits et préparation aux entretiens`, careerIntro: (n) => `Tout ce que HelloKhedma propose pour le métier ${n} : offres en direct, parcours de formation, mots-clés pour le CV et préparation aux entretiens, gratuitement.`,
    titles: "Intitulés de poste à chercher", pathCourses: "Cours", roleQuestions: "Questions d’entretien et réponses modèles", projects: "Projets de portfolio",
    openPath: (n) => `Ouvrir le parcours ${n}`, allCourses: "Tous les cours", careers: "Métiers", hours: (h) => `environ ${h} h`,
    privacy: "Confidentialité", legal: "Mentions légales", tagline: "Offres d’emploi, score de CV, cours gratuits et préparation aux entretiens.", answer: "Réponse modèle",
    titleSuffix: "cours gratuit", aiTrack: "Parcours AI engineer",
  },
};
const LEVEL_FR = { "Beginner": "Débutant", "Intermediate": "Intermédiaire", "Advanced": "Avancé", "Beginner → Intermediate": "Débutant → Intermédiaire", "Intermediate → Advanced": "Intermédiaire → Avancé" };
const level = (l, lang) => (lang === "fr" ? LEVEL_FR[l] || l : l);

/* ---------- career paths from supabase/seed.sql ---------- */
function readPaths() {
  const sql = readFileSync(join(ROOT, "supabase", "seed.sql"), "utf8");
  const ins = sql.slice(sql.indexOf("insert into public.career_paths"), sql.indexOf("on conflict (id)", sql.indexOf("insert into public.career_paths")));
  const paths = [];
  for (const m of ins.matchAll(/\('([a-z]+)','([^']*)','([^']*)','(#[0-9a-f]{6})',\s*array\[([^\]]*)\],\s*(\d+)\)/g)) {
    paths.push({ id: m[1], name: { en: m[2] }, blurb: { en: m[3] }, color: m[4], titles: { en: [...m[5].matchAll(/'([^']*)'/g)].map((x) => x[1]) }, sort: +m[6] });
  }
  const byId = Object.fromEntries(paths.map((p) => [p.id, p]));
  const frT = sql.slice(sql.indexOf("update public.career_paths set job_titles_fr"));
  for (const m of frT.slice(0, frT.indexOf(") as v(")).matchAll(/\('([a-z]+)', array\[([^\]]*)\]\)/g)) {
    if (byId[m[1]]) byId[m[1]].titles.fr = [...new Set([...m[2].matchAll(/'([^']*)'/g)].map((x) => x[1]))];
  }
  for (const m of sql.matchAll(/^\s+\('([a-z]+)', '([^']*)', '([^']*)'\)/gm)) {
    if (byId[m[1]] && !byId[m[1]].name.fr) { byId[m[1]].name.fr = m[2]; byId[m[1]].blurb.fr = m[3]; }
  }
  for (const p of paths) { p.name.fr ||= p.name.en; p.blurb.fr ||= p.blurb.en; p.titles.fr ||= p.titles.en; }
  if (paths.length < 5) throw new Error(`gen-pages: only ${paths.length} career paths read from seed.sql`);
  return paths.sort((a, b) => a.sort - b.sort);
}

/* ---------- content ---------- */
const PATHS = readPaths();
const pathById = Object.fromEntries(PATHS.map((p) => [p.id, p]));
const INDEX = read("content", "courses", "index.json");
const INDEX_FR = Object.fromEntries((maybe("content", "courses", "fr", "index.json") || []).map((c) => [c.id, c]));
const AI_INDEX = (maybe("content", "ai", "index.json") || []).filter((c) => c.status !== "draft");

// One record per course, both languages: { id, paths, skills, level, lessonCount, minutes, en: {name, summary, file}, fr: {…} }
const COURSES = [
  ...INDEX.map((c) => ({
    id: c.id, paths: c.paths || [], skills: c.skills || [], level: c.level, category: c.category,
    en: { name: c.name, summary: c.summary, file: read("content", "courses", `${c.id}.json`) },
    fr: { name: INDEX_FR[c.id]?.name || c.name, summary: INDEX_FR[c.id]?.summary || c.summary,
      file: maybe("content", "courses", "fr", `${c.id}.json`) || read("content", "courses", `${c.id}.json`) },
  })),
  ...AI_INDEX.filter((c) => existsSync(join(ROOT, "content", "ai", "en", `${c.id}.json`))).map((c) => ({
    id: c.id, paths: ["ai"], skills: c.skills || [], level: c.level, category: "AI",
    en: { name: c.name.en, summary: c.summary.en, file: read("content", "ai", "en", `${c.id}.json`) },
    fr: { name: c.name.fr || c.name.en, summary: c.summary.fr || c.summary.en,
      file: maybe("content", "ai", "fr", `${c.id}.json`) || read("content", "ai", "en", `${c.id}.json`) },
  })),
];
const coursesOf = (pid) => COURSES.filter((c) => c.paths.includes(pid));
const projectsOf = (pid, lang) => {
  if (pid === "ai") return maybe("content", "ai", lang, "projects.json")?.projects || [];
  return (lang === "fr" ? maybe("content", "projects", "fr", `${pid}.json`) : null)?.projects
    || maybe("content", "projects", `${pid}.json`)?.projects || [];
};
const interviewOf = (pid, lang) => (lang === "fr" ? maybe("content", "interview", "fr", `${pid}.json`) : null)?.role
  || maybe("content", "interview", `${pid}.json`)?.role || [];

/* ---------- page shell ---------- */
const CSS = `
@font-face{font-family:Inter;font-weight:400;font-display:swap;src:url(/fonts/inter-latin-400-normal.woff2) format('woff2')}
@font-face{font-family:Inter;font-weight:600;font-display:swap;src:url(/fonts/inter-latin-600-normal.woff2) format('woff2')}
@font-face{font-family:'Source Serif 4';font-weight:500;font-display:swap;src:url(/fonts/source-serif-4-latin-500-normal.woff2) format('woff2')}
:root{--bg:#faf8f3;--panel:#fff;--ink:#1f1d1a;--mute:#5c5852;--line:#e6e1d6;--chip:#f0ece3;--link:#4f3fd1;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#1b1a18;--panel:#24221f;--ink:#f2efe8;--mute:#b5afa4;--line:#3a3732;--chip:#302d29;--link:#b7adff;color-scheme:dark}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 Inter,system-ui,sans-serif}
a{color:var(--link)}main,header .in,footer .in{max-width:760px;margin:0 auto;padding:0 16px}
header{border-bottom:1px solid var(--line)}header .in{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-top:12px;padding-bottom:12px}
.logo{display:flex;align-items:center;gap:8px;color:var(--ink);text-decoration:none;font:500 1.25rem 'Source Serif 4',Georgia,serif}
.logo b{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:8px;background:var(--ink);color:var(--bg);font:600 1rem Inter,sans-serif}
h1,h2{font-family:'Source Serif 4',Georgia,serif;font-weight:500;line-height:1.25}h1{font-size:2rem;margin:28px 0 8px}h2{font-size:1.35rem;margin:32px 0 10px}
h3{font-size:1rem;margin:18px 0 4px}.mute{color:var(--mute)}.stripe{height:6px;border-radius:3px;margin-top:24px}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}.chip{background:var(--chip);border-radius:999px;padding:2px 10px;font-size:.85rem}
.btn{display:inline-block;background:var(--ink);color:var(--bg);text-decoration:none;font-weight:600;padding:10px 18px;border-radius:10px;margin:14px 0}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:4px 18px 14px;margin:12px 0}
ul.cards{list-style:none;padding:0}ul.cards li{margin:0 0 8px}details{border-top:1px solid var(--line);padding:8px 0}summary{cursor:pointer;font-weight:600}
ol li{margin:6px 0}footer{border-top:1px solid var(--line);margin-top:40px}footer .in{padding-top:16px;padding-bottom:28px;font-size:.9rem}
footer a{margin-right:14px}`;

function page({ lang, path, alt, title, description, body, jsonld }) {
  const w = W[lang], altLang = w.other;
  const href = (l, p) => `${SITE}${p}`;
  const ld = jsonld ? `\n<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, "\\u003c")}</script>` : "";
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${href(lang, path)}">
<link rel="alternate" hreflang="${lang}" href="${href(lang, path)}">
<link rel="alternate" hreflang="${altLang}" href="${href(altLang, alt)}">
<link rel="alternate" hreflang="x-default" href="${href("en", lang === "en" ? path : alt)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${href(lang, path)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${SITE}/icons/icon-512.png">
<meta property="og:site_name" content="HelloKhedma">
<meta property="og:locale" content="${lang === "fr" ? "fr_FR" : "en_GB"}">
<meta name="twitter:card" content="summary">
<link rel="icon" href="/icons/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/icons/favicon-32.png" sizes="32x32">
<style>${CSS}</style>${ld}
</head>
<body>
<header><div class="in"><a class="logo" href="/?lang=${lang}"><b>h</b>HelloKhedma</a><a href="${alt}" hreflang="${altLang}" lang="${altLang}">${w.switchLabel}</a></div></header>
<main>
${body}
</main>
<footer><div class="in"><p class="mute">HelloKhedma · ${esc(w.tagline)}</p><a href="${w.learn}">${w.allCourses}</a><a href="/?lang=${lang}#/privacy">${w.privacy}</a><a href="/?lang=${lang}#/legal">${w.legal}</a></div></footer>
</body>
</html>
`;
}

const appLink = (lang, hash, pid) => `/?lang=${lang}${pid ? `&path=${pid}` : ""}#/${hash}`;
const ORG = { "@type": "Organization", name: "HelloKhedma", url: SITE };

/* ---------- course page ---------- */
function coursePage(c, lang) {
  const w = W[lang], d = c[lang], f = d.file, other = W[w.other];
  const t = courseTime(f), lessons = f.lessons || [], ex = f.exercises || [];
  const auto = ex.filter((e) => e.type || e.run).length;
  const firstPath = c.paths.find((p) => pathById[p]);
  const color = pathById[firstPath]?.color || "#7c5cff";
  const body = `<div class="stripe" style="background:${color}"></div>
<h1>${esc(d.name)}</h1>
<p>${esc(d.summary)}</p>
<div class="chips"><span class="chip">${esc(level(c.level, lang))}</span><span class="chip">${esc(formatMinutes(t.total))}</span><span class="chip">${esc(w.lessons(lessons.length))}</span><span class="chip">${w.free}</span></div>
<a class="btn" href="${c.id.startsWith("ai-") ? appLink(lang, `course/${c.id}`, "ai") : appLink(lang, `course/${c.id}`, firstPath)}">${w.start}</a>
${f.why ? `<h2>${w.why}</h2>\n<p>${esc(f.why)}</p>` : ""}
${f.outcome ? `<h2>${w.outcome}</h2>\n<p>${esc(f.outcome.charAt(0).toUpperCase() + f.outcome.slice(1))}</p>` : ""}
<h2>${w.lessonList}</h2>
<ol>
${lessons.map((l) => `<li><h3>${esc(l.title)}</h3>${(l.points || []).length ? `<ul>${l.points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>` : ""}</li>`).join("\n")}
</ol>
<h2>${w.practice}</h2>
<p>${esc(w.practiceText(ex.length, auto))}</p>
${c.skills.length ? `<h2>${w.skills}</h2>\n<div class="chips">${c.skills.map((s) => `<span class="chip">${esc(s)}</span>`).join("")}</div>` : ""}
${(f.interview || []).length ? `<h2>${w.interview}</h2>\n${f.interview.map((q) => `<details><summary>${esc(q.q)}</summary><p>${esc(q.a)}</p></details>`).join("\n")}` : ""}
${c.paths.filter((p) => pathById[p]).length ? `<h2>${w.usedBy}</h2>\n<div class="chips">${c.paths.filter((p) => pathById[p]).map((p) => `<a class="chip" href="${w.career(p)}">${esc(pathById[p].name[lang])}</a>`).join("")}</div>` : ""}
<a class="btn" href="${appLink(lang, `course/${c.id}`, c.id.startsWith("ai-") ? "ai" : firstPath)}">${w.start}</a>`;
  return page({
    lang, path: w.course(c.id), alt: other.course(c.id), body,
    title: `${d.name}: ${w.titleSuffix} | HelloKhedma`, description: clip(d.summary),
    jsonld: { "@context": "https://schema.org", "@type": "Course", name: d.name, description: d.summary, inLanguage: lang,
      isAccessibleForFree: true, provider: ORG, url: `${SITE}${w.course(c.id)}`, educationalLevel: c.level,
      teaches: c.skills, timeRequired: `PT${t.total}M` },
  });
}

/* ---------- career path page ---------- */
function careerPage(p, lang) {
  const w = W[lang], other = W[w.other], name = p.name[lang];
  const courses = coursesOf(p.id), qs = interviewOf(p.id, lang), projects = projectsOf(p.id, lang);
  const body = `<div class="stripe" style="background:${p.color}"></div>
<h1>${esc(w.careerTitle(name))}</h1>
<p>${esc(w.careerIntro(name))}</p>
<p class="mute">${esc(p.blurb[lang])}</p>
<a class="btn" href="${appLink(lang, "", p.id)}">${esc(w.openPath(name))}</a>
<h2>${w.titles}</h2>
<div class="chips">${[...new Set([...p.titles[lang], ...p.titles.en])].map((t) => `<span class="chip">${esc(t)}</span>`).join("")}</div>
${courses.length ? `<h2>${w.pathCourses}</h2>\n<ul class="cards">${courses.map((c) => `<li class="panel"><h3><a href="${w.course(c.id)}">${esc(c[lang].name)}</a></h3><p class="mute">${esc(c[lang].summary)}</p></li>`).join("\n")}</ul>` : ""}
${qs.length ? `<h2>${w.roleQuestions}</h2>\n${qs.map((q) => `<details><summary>${esc(q.q)}</summary>${q.why ? `<p class="mute">${esc(q.why)}</p>` : ""}<p><strong>${w.answer}:</strong> ${esc(q.model || q.a || "")}</p></details>`).join("\n")}` : ""}
${projects.length ? `<h2>${w.projects}</h2>\n<ul class="cards">${projects.map((pr) => `<li class="panel"><h3><a href="${appLink(lang, `project/${pr.id}`, p.id)}">${esc(pr.title)}</a></h3><p class="mute">${esc(pr.summary)}</p></li>`).join("\n")}</ul>` : ""}
<a class="btn" href="${appLink(lang, "", p.id)}">${esc(w.openPath(name))}</a>`;
  return page({
    lang, path: w.career(p.id), alt: other.career(p.id), body,
    title: `${w.careerTitle(name)} | HelloKhedma`, description: clip(`${name} : ${p.blurb[lang]}. ${w.careerIntro(name)}`.replace(" : ", lang === "fr" ? " : " : ": ")),
    jsonld: qs.length ? { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: qs.map((q) => ({
      "@type": "Question", name: q.q, acceptedAnswer: { "@type": "Answer", text: q.model || q.a || "" } })) } : null,
  });
}

/* ---------- hub page ---------- */
function hubPage(lang) {
  const w = W[lang], other = W[w.other];
  const body = `<h1>${esc(w.coursesTitle)}</h1>
<p>${esc(w.coursesIntro)}</p>
<a class="btn" href="/?lang=${lang}">${w.openApp}</a>
<h2>${w.careers}</h2>
<div class="chips">${PATHS.map((p) => `<a class="chip" href="${w.career(p.id)}">${esc(p.name[lang])}</a>`).join("")}</div>
${PATHS.map((p) => {
    const cs = coursesOf(p.id); if (!cs.length) return "";
    return `<h2><a href="${w.career(p.id)}">${esc(p.name[lang])}</a></h2>\n<ul class="cards">${cs.map((c) => `<li><a href="${w.course(c.id)}">${esc(c[lang].name)}</a> <span class="mute">· ${esc(level(c.level, lang))}</span></li>`).join("")}</ul>`;
  }).join("\n")}`;
  return page({ lang, path: w.learn, alt: other.learn, body, title: `${w.coursesTitle} | HelloKhedma`, description: clip(w.coursesIntro) });
}

/* ---------- write everything ---------- */
const urls = []; // [en path, fr path]
const write = (urlPath, html) => { const dir = join(OUT, urlPath); mkdirSync(dir, { recursive: true }); writeFileSync(join(dir, "index.html"), html); };
for (const lang of ["en", "fr"]) {
  write(W[lang].learn, hubPage(lang));
  for (const c of COURSES) write(W[lang].course(c.id), coursePage(c, lang));
  for (const p of PATHS) write(W[lang].career(p.id), careerPage(p, lang));
}
urls.push(["/", "/"], [W.en.learn, W.fr.learn]);
for (const p of PATHS) urls.push([W.en.career(p.id), W.fr.career(p.id)]);
for (const c of COURSES) urls.push([W.en.course(c.id), W.fr.course(c.id)]);

const today = new Date().toISOString().slice(0, 10);
const entry = (loc, en, fr) => `  <url><loc>${SITE}${loc}</loc><lastmod>${today}</lastmod>${en === fr ? "" : `
    <xhtml:link rel="alternate" hreflang="en" href="${SITE}${en}"/>
    <xhtml:link rel="alternate" hreflang="fr" href="${SITE}${fr}"/>`}</url>`;
writeFileSync(join(OUT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<!-- Written by scripts/gen-pages.mjs at deploy time: the app (hash routes) plus one static page per course and career path. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.flatMap(([en, fr]) => (en === fr ? [entry(en, en, fr)] : [entry(en, en, fr), entry(fr, en, fr)])).join("\n")}
</urlset>
`);
// Career paths for Home's first paint, in the shape of the career_paths rows (Supabase replaces them once loaded).
mkdirSync(join(OUT, "content"), { recursive: true });
writeFileSync(join(OUT, "content", "paths.json"), JSON.stringify(PATHS.map((p) => ({
  id: p.id, name: p.name.en, blurb: p.blurb.en, name_fr: p.name.fr, blurb_fr: p.blurb.fr, color: p.color,
  job_titles: p.titles.en, job_titles_fr: p.titles.fr, sort_order: p.sort,
}))));
console.log(`gen-pages: ${COURSES.length} courses and ${PATHS.length} career paths, ${(COURSES.length + PATHS.length + 1) * 2} pages, ${urls.length * 2 - 1} sitemap URLs in ${OUT}`);
