// Content checks (training step 1, 2026-11-06), run by CI before the smoke tests (.github/workflows/deploy.yml) and
// locally with `npm run check-content`. A content mistake stops the deploy, with one line per problem.
// Checks every JSON file in content/:
//   - courses (content/courses): index entries complete, one file per entry, lessonCount = lessons, required fields
//     (lessons with title and text, cheat sheet groups of [syntax, meaning] pairs, exercises with q and answer,
//     interview questions with q and a), skill names known to js/ats.js, path ids known;
//   - French copies (content/courses/fr, content/interview/fr, content/projects/fr): same ids, same array lengths and
//     order, identical code (lesson examples, code answers), and actually translated (why differs);
//   - interview (content/interview): ids unique, model answers present;
//   - portfolio projects (content/projects): 3 per path, required fields, ids "<path>-…", http(s) data links;
//   - AI track (content/ai): index entries, Arabic-letter and 3arbizi files with the same structure and identical code;
//   - runnable SQL exercises (exercise.run, training step 2): the dataset exists, the course answer runs on it with
//     SQLite (sql.js, the same engine as the browser) and returns rows, and the grader (js/sqlgrade.js) accepts it.
// The same rules as scripts/check-fr-content.ps1 (French) and the course smoke test, plus the structure rules above.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { SKILLS } from "../js/ats.js";
import { gradeResult } from "../js/sqlgrade.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const C = (...p) => join(ROOT, "content", ...p);
const PATHS = new Set(["de", "da", "ba", "as", "do"]);
const SKILL_NAMES = new Set(SKILLS.map(([name]) => name));
const problems = [];
const bad = (where, msg) => problems.push(`${where}: ${msg}`);
const load = (file) => {
  try { return JSON.parse(readFileSync(file, "utf8")); } catch (e) { bad(file.replace(ROOT + "/", ""), `cannot read JSON (${e.message})`); return null; }
};
const arr = (x) => (Array.isArray(x) ? x : []);
const str = (x) => typeof x === "string" && x.trim().length > 0;
const isUrl = (u) => /^https?:\/\/[^\s]+$/.test(u || "");

// One course file (English or French, or an AI track script): required fields.
function checkCourse(where, c) {
  if (!str(c.why)) bad(where, "missing why");
  if (!str(c.outcome)) bad(where, "missing outcome");
  if (!arr(c.lessons).length) bad(where, "no lessons");
  arr(c.lessons).forEach((l, i) => {
    if (!str(l.title)) bad(where, `lesson ${i + 1}: no title`);
    if (!arr(l.text).length || !arr(l.text).every(str)) bad(where, `lesson ${i + 1}: text must be a list of paragraphs`);
    if (l.example && !str(l.example.code)) bad(where, `lesson ${i + 1}: example without code`);
  });
  if (!arr(c.cheatsheet).length) bad(where, "no cheat sheet");
  arr(c.cheatsheet).forEach((g, i) => {
    if (!str(g.group)) bad(where, `cheat sheet group ${i + 1}: no name`);
    arr(g.items).forEach((it, j) => { if (!Array.isArray(it) || it.length !== 2 || !it.every(str)) bad(where, `cheat sheet group ${i + 1} item ${j + 1}: must be [syntax, meaning]`); });
  });
  arr(c.exercises).forEach((e, i) => { if (!str(e.q) || !str(e.answer)) bad(where, `exercise ${i + 1}: needs q and answer`); });
  arr(c.interview).forEach((q, i) => { if (!str(q.q) || !str(q.a)) bad(where, `interview question ${i + 1}: needs q and a`); });
}

// Two versions of the same content (EN/FR, Arabic letters/3arbizi): same structure, identical code.
function sameShape(where, a, b, { translated = true } = {}) {
  const len = (k) => [arr(a[k]).length, arr(b[k]).length];
  for (const k of ["lessons", "cheatsheet", "exercises", "pitfalls", "interview"]) {
    const [x, y] = len(k);
    if (x !== y) bad(where, `${k}: ${x} vs ${y}`);
  }
  arr(a.lessons).forEach((l, i) => {
    const m = arr(b.lessons)[i] || {};
    if (arr(l.text).length !== arr(m.text).length) bad(where, `lesson ${i + 1}: paragraph count differs`);
    if (arr(l.points).length !== arr(m.points).length) bad(where, `lesson ${i + 1}: point count differs`);
    if ((l.example?.code || "") !== (m.example?.code || "") || (l.example?.lang || "") !== (m.example?.lang || "")) bad(where, `lesson ${i + 1}: example code differs`);
  });
  arr(a.cheatsheet).forEach((g, i) => { if (arr(g.items).length !== arr(arr(b.cheatsheet)[i]?.items).length) bad(where, `cheat sheet group ${i + 1}: item count differs`); });
  arr(a.exercises).forEach((e, i) => {
    const f = arr(b.exercises)[i] || {};
    if (e.code && (e.answer !== f.answer || e.code !== f.code)) bad(where, `exercise ${i + 1}: code answer differs`);
    if (JSON.stringify(e.run || null) !== JSON.stringify(f.run || null)) bad(where, `exercise ${i + 1}: run settings differ`);
  });
  if (translated && a.why && a.why === b.why) bad(where, "why is not translated");
}

/* ---------- courses ---------- */
const index = load(C("courses", "index.json")) || [];
const ids = new Set();
for (const e of index) {
  const where = `courses/index.json ${e.id}`;
  if (ids.has(e.id)) bad(where, "duplicate id");
  ids.add(e.id);
  for (const k of ["id", "name", "category", "level", "summary"]) if (!str(e[k])) bad(where, `missing ${k}`);
  arr(e.paths).forEach((p) => { if (!PATHS.has(p)) bad(where, `unknown path "${p}"`); });
  if (!arr(e.skills).length) bad(where, "no skills");
  arr(e.skills).forEach((s) => { if (!SKILL_NAMES.has(s)) bad(where, `skill "${s}" is not in js/ats.js (missing skills would not link to this course)`); });
  const file = C("courses", `${e.id}.json`);
  if (!existsSync(file)) { bad(where, "no course file"); continue; }
  const c = load(file);
  if (!c) continue;
  checkCourse(`courses/${e.id}.json`, c);
  if (e.lessonCount !== arr(c.lessons).length) bad(where, `lessonCount ${e.lessonCount} but ${arr(c.lessons).length} lessons (run scripts/course-times.ps1)`);
  const frFile = C("courses", "fr", `${e.id}.json`);
  if (!existsSync(frFile)) { bad(`courses/fr/${e.id}.json`, "missing French copy"); continue; }
  const fr = load(frFile);
  if (fr) { checkCourse(`courses/fr/${e.id}.json`, fr); sameShape(`courses/fr/${e.id}.json`, c, fr); }
}
for (const f of readdirSync(C("courses"))) {
  if (f.endsWith(".json") && f !== "index.json" && !ids.has(f.replace(/\.json$/, ""))) bad(`courses/${f}`, "not listed in index.json");
}
for (const e of load(C("courses", "fr", "index.json")) || []) {
  if (!ids.has(e.id)) bad("courses/fr/index.json", `unknown id ${e.id}`);
  if (!str(e.name) || !str(e.summary)) bad("courses/fr/index.json", `${e.id}: missing name or summary`);
}

/* ---------- interview ---------- */
for (const f of readdirSync(C("interview")).filter((f) => f.endsWith(".json"))) {
  const en = load(C("interview", f)), fr = existsSync(C("interview", "fr", f)) ? load(C("interview", "fr", f)) : null;
  if (!fr) { bad(`interview/fr/${f}`, "missing French copy"); continue; }
  if (!en) continue;
  for (const k of Object.keys(en)) {
    if (Array.isArray(en[k])) {
      if (!Array.isArray(fr[k]) || fr[k].length !== en[k].length) bad(`interview/fr/${f}`, `${k}: ${en[k].length} vs ${arr(fr[k]).length}`);
      const seen = new Set();
      en[k].forEach((q, i) => {
        if (q && q.id) {
          if (seen.has(q.id)) bad(`interview/${f}`, `duplicate id ${q.id}`);
          seen.add(q.id);
          if (arr(fr[k])[i]?.id !== q.id) bad(`interview/fr/${f}`, `${k} ${i + 1}: id ${arr(fr[k])[i]?.id} instead of ${q.id}`);
          if ("q" in q && !str(q.q)) bad(`interview/${f}`, `${q.id}: empty question`);
        }
      });
    }
  }
}

/* ---------- portfolio projects ---------- */
function checkProject(where, p, prefix) {
  for (const k of ["id", "title", "level", "summary", "why"]) if (!str(p[k])) bad(where, `${p.id || "?"}: missing ${k}`);
  if (prefix && !String(p.id).startsWith(`${prefix}-`)) bad(where, `id ${p.id} should start with "${prefix}-"`);
  if (!(Number(p.hours) > 0)) bad(where, `${p.id}: hours`);
  if (!arr(p.steps).length || !arr(p.steps).every((s) => str(s.title) && str(s.text))) bad(where, `${p.id}: steps need title and text`);
  if (!arr(p.deliverables).length || !arr(p.checklist).length) bad(where, `${p.id}: deliverables and checklist needed`);
  if (!str(p.cv?.bullet) || !str(p.cv?.talk)) bad(where, `${p.id}: cv.bullet and cv.talk needed`);
  arr(p.data).forEach((d, i) => { if (!isUrl(d.url)) bad(where, `${p.id}: data link ${i + 1} is not an http(s) URL`); });
}
function sameProjects(where, a, b, { codeOnly = false } = {}) {
  if (a.length !== b.length) { bad(where, `${a.length} vs ${b.length} projects`); return; }
  a.forEach((p, i) => {
    const q = b[i] || {};
    if (p.id !== q.id) bad(where, `project ${i + 1}: id ${q.id} instead of ${p.id}`);
    for (const k of ["steps", "deliverables", "checklist", "data", "stretch"]) if (arr(p[k]).length !== arr(q[k]).length) bad(where, `${p.id}: ${k} count differs`);
    arr(p.data).forEach((d, j) => { if (d.url !== arr(q.data)[j]?.url) bad(where, `${p.id}: data link ${j + 1} differs`); });
    if (!codeOnly && p.summary === q.summary) bad(where, `${p.id}: summary is not translated`);
  });
}
for (const id of PATHS) {
  const en = load(C("projects", `${id}.json`))?.projects || [];
  if (en.length !== 3) bad(`projects/${id}.json`, `${en.length} projects instead of 3`);
  en.forEach((p) => checkProject(`projects/${id}.json`, p, id));
  const fr = existsSync(C("projects", "fr", `${id}.json`)) ? load(C("projects", "fr", `${id}.json`))?.projects || [] : null;
  if (!fr) { bad(`projects/fr/${id}.json`, "missing French copy"); continue; }
  fr.forEach((p) => checkProject(`projects/fr/${id}.json`, p, id));
  sameProjects(`projects/fr/${id}.json`, en, fr);
}

/* ---------- AI track (Tunisian: Arabic letters and 3arbizi) ---------- */
const aiIndex = load(C("ai", "index.json")) || [];
for (const e of aiIndex) {
  if (!String(e.id).startsWith("ai-")) bad("ai/index.json", `id ${e.id} should start with "ai-"`);
  if (e.status !== "ready") continue;
  const ar = existsSync(C("ai", "ar", `${e.id}.json`)) ? load(C("ai", "ar", `${e.id}.json`)) : null;
  const lat = existsSync(C("ai", "lat", `${e.id}.json`)) ? load(C("ai", "lat", `${e.id}.json`)) : null;
  if (!ar || !lat) { bad(`ai/${e.id}`, "missing Arabic-letter or 3arbizi file"); continue; }
  checkCourse(`ai/ar/${e.id}.json`, ar); checkCourse(`ai/lat/${e.id}.json`, lat);
  sameShape(`ai/lat/${e.id}.json`, ar, lat, { translated: false });
  if (e.lessonCount !== arr(ar.lessons).length) bad(`ai/index.json ${e.id}`, `lessonCount ${e.lessonCount} but ${arr(ar.lessons).length} lessons`);
}
const aiAr = load(C("ai", "ar", "projects.json"))?.projects || [], aiLat = load(C("ai", "lat", "projects.json"))?.projects || [];
aiAr.forEach((p) => checkProject("ai/ar/projects.json", p, "ai"));
aiLat.forEach((p) => checkProject("ai/lat/projects.json", p, "ai"));
sameProjects("ai/lat/projects.json", aiAr, aiLat, { codeOnly: true });

/* ---------- runnable SQL exercises ---------- */
const runnable = [];
for (const e of index) {
  const c = existsSync(C("courses", `${e.id}.json`)) ? load(C("courses", `${e.id}.json`)) : null;
  arr(c?.exercises).forEach((x, i) => { if (x.run) runnable.push({ where: `courses/${e.id}.json exercise ${i + 1}`, x }); });
}
if (runnable.length) {
  const initSqlJs = createRequire(import.meta.url)("sql.js");
  const SQL = await initSqlJs();
  const run = (db, sql) => {
    const d = new SQL.Database();
    try { d.exec(readFileSync(C("sql", `${db}.sql`), "utf8")); const r = d.exec(sql).at(-1); return r ? { columns: r.columns, values: r.values } : { columns: [], values: [] }; }
    finally { d.close(); }
  };
  for (const { where, x } of runnable) {
    if (!/^[a-z0-9_-]+$/.test(x.run.db || "") || !existsSync(C("sql", `${x.run.db}.sql`))) { bad(where, `dataset "${x.run.db}" not found in content/sql/`); continue; }
    if (x.code !== "sql") bad(where, "a runnable exercise must have code: \"sql\"");
    let res;
    try { res = run(x.run.db, x.answer); } catch (err) { bad(where, `the answer fails on dataset ${x.run.db}: ${err.message}`); continue; }
    if (!res.values.length) { bad(where, "the answer returns no rows on the dataset (nothing to compare with)"); continue; }
    const g = gradeResult(res, res, x.run);
    if (!g.ok) bad(where, `the grader rejects the course answer (${g.reason})`);
  }
}

/* ---------- result ---------- */
const counted = `${index.length} courses, ${aiIndex.length} AI-track courses, ${PATHS.size * 3} + ${aiAr.length} projects, ${runnable.length} runnable SQL exercises`;
if (problems.length) {
  console.log(`Content check: ${problems.length} problem(s) (${counted})`);
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log(`Content check: ok (${counted})`);
