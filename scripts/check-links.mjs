// Usage: node scripts/check-links.mjs [filter]   (Node 18+)
// Checks every https URL in supabase/seed.sql and in the portfolio projects (content/projects/*.json, content/ai/en/projects.json).
// With a filter, only the URLs containing it (e.g. "sec.gov"). Some sites block scripts and return 403/429;
// open those by hand before treating them as broken. CI runs it as a report only (deploy.yml "Check links"): a broken
// link shows as a warning on the run and never stops the deploy.
import { readFileSync, readdirSync, existsSync } from "node:fs";

const root = new URL("../", import.meta.url);
const files = ["supabase/seed.sql",
  ...readdirSync(new URL("content/projects/", root)).filter((f) => f.endsWith(".json")).map((f) => `content/projects/${f}`),
  "content/ai/en/projects.json"].filter((f) => existsSync(new URL(f, root)));
const text = files.map((f) => readFileSync(new URL(f, root), "utf8")).join("\n");
const filter = process.argv[2] || "";
const urls = [...new Set(text.match(/https?:\/\/[^\s"'\\\]]+/g) || [])]
  .filter((u) => !u.includes("google.com/search") && u.includes(filter));
const ci = !!process.env.GITHUB_ACTIONS;

let bad = 0;
await Promise.all(urls.map(async (u, i) => {
  await new Promise((r) => setTimeout(r, i * 150)); // a gentle pace
  let line;
  try {
    const r = await fetch(u, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) link-check" }, signal: AbortSignal.timeout(20000) });
    const ok = r.status < 400 || r.status === 403 || r.status === 429; // blocked by the site, not missing
    if (!ok) bad++;
    line = `${ok ? (r.status < 400 ? "OK " : "?? ") : "BAD"} ${r.status} ${u}`;
    if (!ok && ci) line += `\n::warning title=Broken link::${r.status} ${u}`;
  } catch (e) {
    bad++;
    line = `ERR     ${u} (${e.message})`;
    if (ci) line += `\n::warning title=Unreachable link::${u} (${e.message})`;
  }
  console.log(line);
}));
console.log(`\n${urls.length - bad}/${urls.length} links reachable (?? = the site refused a script; check by hand)`);
process.exit(bad ? 1 : 0);
