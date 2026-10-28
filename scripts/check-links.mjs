// Usage: node scripts/check-links.mjs   (Node 18+)
// Checks every https URL in supabase/seed.sql. Some sites block scripts and return 403/429;
// open those by hand before treating them as broken.
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../supabase/seed.sql", import.meta.url), "utf8");
const urls = [...new Set(sql.match(/https?:\/\/[^\s"'\\\]]+/g) || [])].filter((u) => !u.includes("google.com/search"));

let bad = 0;
for (const u of urls) {
  try {
    const r = await fetch(u, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 link-check" }, signal: AbortSignal.timeout(15000) });
    const ok = r.status < 400;
    if (!ok) bad++;
    console.log(`${ok ? "OK " : "BAD"} ${r.status} ${u}`);
  } catch (e) {
    bad++;
    console.log(`ERR     ${u} (${e.message})`);
  }
}
console.log(`\n${urls.length - bad}/${urls.length} links reachable`);
process.exit(bad ? 1 : 0);
