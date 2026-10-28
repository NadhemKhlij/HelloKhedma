// Client-side keyword matching. If a job description is given, only the path keywords
// that appear in it are required; otherwise all path keywords are used.
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const has = (text, kw) => new RegExp(`(^|[^a-z0-9+#])${esc(kw.toLowerCase())}($|[^a-z0-9+#])`, "i").test(text);

export function analyze(cv, jd, keywords) {
  const target = jd.trim() ? keywords.filter((k) => has(jd, k)) : keywords;
  const found = target.filter((k) => has(cv, k));
  const missing = target.filter((k) => !has(cv, k));
  return { found, missing, total: target.length, score: target.length ? Math.round((found.length / target.length) * 100) : 0, usedJd: Boolean(jd.trim()) };
}
