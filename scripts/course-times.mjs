// Updates "minutes" and "lessonCount" of every course in content/courses/index.json (or content/ai/index.json with
// --ai, times from the Arabic-letter files) with courseTime() from js/coursetime.js: the same as
// scripts/course-times.ps1, for machines with Node. Run after adding lessons or exercises: node scripts/course-times.mjs
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { courseTime } from "../js/coursetime.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ai = process.argv.includes("--ai");
const dir = join(ROOT, "content", ai ? "ai" : "courses");
const file = join(dir, "index.json");
const values = new Map();
for (const e of JSON.parse(readFileSync(file, "utf8"))) {
  const f = join(dir, ai ? "ar" : "", `${e.id}.json`);
  if (!existsSync(f)) continue;
  const c = JSON.parse(readFileSync(f, "utf8"));
  values.set(e.id, [courseTime(c).total, c.lessons.length]);
}
// Edit the numbers in place, line by line, to keep the hand-written layout of index.json.
let id = null, changed = 0;
const out = readFileSync(file, "utf8").split("\n").map((line) => {
  id = line.match(/"id": "([^"]+)"/)?.[1] || id;
  if (!id || !values.has(id) || !/"minutes": \d+/.test(line)) return line;
  const [m, n] = values.get(id);
  const next = line.replace(/"minutes": \d+/, `"minutes": ${m}`).replace(/"lessonCount": \d+/, `"lessonCount": ${n}`);
  if (next !== line) { changed++; console.log(`  ${id} -> ${m} min, ${n} lessons`); }
  return next;
});
if (changed) writeFileSync(file, out.join("\n"));
console.log(`${file.replace(ROOT + "/", "")}: ${changed} course(s) updated`);
