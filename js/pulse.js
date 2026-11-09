// Path market pulse (ROADMAP 3.9): what the market asks for the selected path, built from the offers the user has
// looked at on the Offers page. Kept in this browser only ("hk.pulse.<path id>"); nothing is sent anywhere.
// - recordOffers(items): called by renderOffers (offers.js) with every offer of the current results. Only offers
//   whose title matches the path (titleMatcher, companies.js) are kept, so a broad company list does not skew it.
//   One small entry per offer (skills, remote, yearly salary in euros, level), at most MAX, none older than KEEP_DAYS.
// - renderPulse(root): the Home card. Typical salary (middle half of the euro salaries given by employers; provider
//   estimates are left out), share of remote / hybrid offers, share of offers that state a salary, the most requested
//   skills (✓ in your CV, 📘 course link otherwise) and the levels asked. Below MIN_OFFERS, an empty state.
// - Advertised salaries (both states): Adzuna's statistics for the path's main job title in the Offers country (all of
//   Adzuna's offers, not only the ones seen here): median, middle half, trend over 12 months and the distribution.
//   Through the job-search function (jobs.js salaryStats), cached 24 h there and in this browser ("hk.salstats");
//   sends only the job title and the country. Not fetched on a local / test server (no quota spent by CI).
// - Who's hiring (same Adzuna call and cache): the companies with the most offers for that title (offers, average
//   salary), the regions with the most offers (share of all) and the offers posted in the last 7 days.
// - marketSkills(pathId): { n, skills: top TOP [{ name, c, p }] } from the same offers, or null below MIN_OFFERS
//   ("Your CV vs the market" on the CV page, cvpage.js); skillRow() draws one of them.
// - marketPay(): the same figures as a pay reference for the offer coach (offercoach.js): Adzuna's quartiles when there
//   are enough offers, otherwise the euro salaries of the offers seen here.
import { $, h, ls } from "./lib.js";
import { t, tn } from "./i18n.js";
import { state, path, skillChip } from "./state.js";
import { titleMatcher } from "./companies.js";
import { formatSalary } from "./salary.js";
import { salaryStats } from "./jobs.js";
import { sb, CONFIG } from "./supabase.js";

const MAX = 400, KEEP_DAYS = 60, MIN_OFFERS = 5, TOP = 10;
const DAY = 86_400_000;
const key = (pathId) => `hk.pulse.${pathId}`;

function load(pathId) {
  let rows;
  try { rows = JSON.parse(ls.get(key(pathId)) || "[]"); } catch { rows = []; }
  const since = Date.now() - KEEP_DAYS * DAY;
  return rows.filter((r) => r.at >= since);
}

// items: [{ j, key, skills, tags, salary, level }] as built by renderOffers.
export function recordOffers(items) {
  const p = path();
  if (!p || !items.length) return;
  const rows = load(p.id), known = new Set(rows.map((r) => r.k)), matches = titleMatcher(p);
  const fresh = items.filter((x) => !known.has(x.key) && matches(x.j.title)).map((x) => ({
    k: x.key, at: Date.now(), s: x.skills.slice(0, 30), r: x.tags.remote || null, l: x.level || null,
    // Salary: whether one is stated at all, and the yearly middle in euros when the employer gave it.
    p: x.salary ? 1 : 0,
    e: x.salary && !x.salary.estimated && x.salary.currency === "EUR" ? Math.round((x.salary.yearMin + x.salary.yearMax) / 2) : null,
  }));
  if (!fresh.length) return;
  ls.set(key(p.id), JSON.stringify([...rows, ...fresh].slice(-MAX)));
}

export function marketSkills(pathId) {
  const s = summarize(load(pathId));
  return s.n >= MIN_OFFERS && s.skills.length ? { n: s.n, skills: s.skills } : null;
}

const pct = (n, of) => (of ? Math.round((n / of) * 100) : 0);
const quantile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))];

export function summarize(rows) {
  const n = rows.length, count = new Map();
  for (const r of rows) for (const s of new Set(r.s)) count.set(s, (count.get(s) || 0) + 1);
  const pay = rows.map((r) => r.e).filter((x) => x > 0).sort((a, b) => a - b);
  const levels = ["Junior", "Mid", "Senior", "Lead"].map((l) => [l, rows.filter((r) => r.l === l).length]);
  return {
    n,
    skills: [...count].sort((a, b) => b[1] - a[1]).slice(0, TOP).map(([name, c]) => ({ name, c, p: pct(c, n) })),
    pay: pay.length >= 3 ? { low: quantile(pay, 0.25), median: quantile(pay, 0.5), high: quantile(pay, 0.75), n: pay.length } : null,
    payN: pay.length,
    remote: pct(rows.filter((r) => r.r === "Remote").length, n),
    hybrid: pct(rows.filter((r) => r.r === "Hybrid").length, n),
    shown: pct(rows.filter((r) => r.p).length, n),
    levels, levelN: levels.reduce((a, [, c]) => a + c, 0),
  };
}

const tile = (label, value, sub) => h("div", { class: "rounded-lg p-3", style: "background:var(--bg);border:1px solid var(--line)" },
  h("span", { class: "mute text-xs" }, label), h("b", { class: "block text-xl font-semibold" }, value), h("span", { class: "mute text-xs" }, sub));

// One skill: chip (✓ / 📘 link), a thin bar for its share of offers, the share as text.
export const skillRow = ({ name, c, p }, n) => h("li", { class: "grid grid-cols-[minmax(0,9rem)_1fr_2.75rem] items-center gap-2 text-sm",
  title: t("{name}: named in {c} of {n} offers", { name, c, n }) },
  h("span", { class: "truncate" }, skillChip(name, state.cv.names.has(name))),
  h("span", { class: "h-1.5 rounded-full", style: "background:var(--line)", "aria-hidden": "true" },
    h("span", { class: "block h-1.5 rounded-full", style: `width:${Math.max(2, p)}%;background:var(--accent)` })),
  h("span", { class: "text-right tabular-nums mute" }, t("{n}%", { n: p })));

/* ---------- advertised salaries (Adzuna statistics) ---------- */
const SAL_KEY = "hk.salstats", SAL_TTL = DAY;
const LOCAL = /^(localhost|127\.|\[?::1\]?$|0\.0\.0\.0)/;
// Value at quantile q of a histogram [[from, count]..], interpolated inside its band (last band: width of the one before).
function histQuantile(hist, q) {
  const total = hist.reduce((a, [, c]) => a + c, 0);
  let seen = 0;
  for (let i = 0; i < hist.length; i++) {
    const [from, c] = hist[i], width = (hist[i + 1]?.[0] ?? from + (from - (hist[i - 1]?.[0] ?? from - 10000))) - from;
    if (seen + c >= q * total) return from + width * ((q * total - seen) / c);
    seen += c;
  }
  return hist.at(-1)?.[0] ?? 0;
}
async function loadSalary(title, country) {
  const k = `v2|${country}|${title}`; // v2: with companies, regions and the week's count
  try { const c = JSON.parse(ls.get(SAL_KEY) || "null"); if (c?.k === k && Date.now() - c.at < SAL_TTL) return c.d; } catch { /* refetch */ }
  const d = await salaryStats({ query: title, country });
  ls.set(SAL_KEY, JSON.stringify({ k, at: Date.now(), d }));
  return d;
}
// Pay reference for the selected path: { low, median, high (yearly), currency, n, source: "adzuna" | "seen", title }
// or null when there is not enough data.
export async function marketPay(p = path()) {
  if (!p) return null;
  const title = p.job_titles?.[0] || p.name, country = $("#country")?.value || CONFIG.DEFAULT_COUNTRY || "fr";
  if (sb && !LOCAL.test(location.hostname)) {
    try {
      const d = await loadSalary(title, country);
      const hist = (d.histogram || []).filter(([, c]) => c > 0), n = hist.reduce((a, [, c]) => a + c, 0);
      if (n >= 20 && d.currency) return { low: histQuantile(hist, 0.25), median: histQuantile(hist, 0.5), high: histQuantile(hist, 0.75), currency: d.currency, n, source: "adzuna", title };
    } catch { /* fall back to the offers seen here */ }
  }
  const s = summarize(load(p.id));
  return s.pay ? { ...s.pay, currency: "EUR", source: "seen", title } : null;
}

function salaryBlock(p) {
  const box = h("div", { class: "mt-4", hidden: true });
  const title = p.job_titles?.[0] || p.name;
  const country = $("#country")?.value || CONFIG.DEFAULT_COUNTRY || "fr";
  if (!sb || LOCAL.test(location.hostname)) return box;
  loadSalary(title, country).then((d) => {
    const hist = (d.histogram || []).filter(([, c]) => c > 0), n = hist.reduce((a, [, c]) => a + c, 0);
    if (n < 20 || !d.currency) return; // too few offers to say anything
    const money = (min, max = min) => formatSalary({ min: Math.round(min / 1000) * 1000, max: Math.round(max / 1000) * 1000, currency: d.currency, period: "year", estimated: false });
    const hs = d.history || [];
    const trend = hs.length >= 10 ? Math.round(((hs.at(-1)[1] - hs[0][1]) / hs[0][1]) * 100) : null;
    const max = Math.max(...hist.map(([, c]) => c));
    box.hidden = false;
    box.replaceChildren(
      h("div", { class: "flex flex-wrap items-baseline justify-between gap-2 mb-2" },
        h("p", { class: "text-sm font-medium" }, t("Advertised salaries · {title}", { title })),
        h("span", { class: "mute text-xs" }, tn(n, "Adzuna, {n} offer with a salary", "Adzuna, {n} offers with a salary"))),
      h("div", { class: "grid gap-2 sm:grid-cols-3" },
        tile(t("Median"), money(histQuantile(hist, 0.5)), t("half of the offers pay more")),
        tile(t("Middle half"), money(histQuantile(hist, 0.25), histQuantile(hist, 0.75)), t("from the 25th to the 75th percentile")),
        tile(t("Over 12 months"), trend == null ? "–" : `${trend > 0 ? "+" : ""}${trend}%`, t("average advertised salary"))),
      h("div", { class: "flex items-end gap-0.5 h-12 mt-2", "aria-hidden": "true" }, hist.map(([from, c]) =>
        h("span", { class: "flex-1 rounded-t", style: `height:${Math.max(4, (100 * c) / max)}%;background:var(--accent);opacity:.8`,
          title: t("{from}+: {n} offers", { from: money(from), n: c }) }))),
      h("p", { class: "mute text-xs mt-1" }, t("All of Adzuna's offers for this title in this country, not only the ones you looked at.")));
  }).catch(() => { /* no statistics: the block stays hidden */ });
  return box;
}

// Who's hiring: Adzuna's top companies and regions for the path's main title, and the offers of the last 7 days.
function hiringBlock(p) {
  const box = h("div", { class: "mt-4", hidden: true });
  const title = p.job_titles?.[0] || p.name;
  const country = $("#country")?.value || CONFIG.DEFAULT_COUNTRY || "fr";
  if (!sb || LOCAL.test(location.hostname)) return box;
  loadSalary(title, country).then((d) => fillHiring(box, d, title)).catch(() => {});
  return box;
}
export function fillHiring(box, d, title) {
  const companies = d.companies || [], regions = d.regions || [], total = d.regionTotal || 0;
  if (!companies.length && !regions.length) return;
  const money = (n) => formatSalary({ min: Math.round(n / 1000) * 1000, max: Math.round(n / 1000) * 1000, currency: d.currency, period: "year", estimated: false });
  const top = Math.max(...regions.map((r) => r.count), 1);
  box.hidden = false;
  box.replaceChildren(
    h("div", { class: "flex flex-wrap items-baseline justify-between gap-2 mb-2" },
      h("p", { class: "text-sm font-medium" }, t("Who's hiring · {title}", { title })),
      d.week != null ? h("span", { class: "mute text-xs" }, tn(d.week, "Adzuna, {n} new offer in the last 7 days", "Adzuna, {n} new offers in the last 7 days")) : null),
    h("div", { class: "grid gap-x-6 gap-y-3 md:grid-cols-2" },
      companies.length ? h("div", {},
        h("p", { class: "mute text-xs mb-1" }, t("Companies with the most offers")),
        h("ol", { class: "grid gap-1.5" }, companies.map((c, i) => h("li", { class: "flex items-baseline gap-2 text-sm" },
          h("span", { class: "mute tabular-nums w-4 shrink-0" }, String(i + 1)),
          h("span", { class: "font-medium truncate min-w-0" }, c.name),
          h("span", { class: "mute text-xs ml-auto shrink-0 text-right" }, tn(c.count, "{n} offer", "{n} offers"),
            c.salary > 0 && d.currency ? ` · ${t("avg. {pay}", { pay: money(c.salary) })}` : ""))))) : null,
      regions.length ? h("div", {},
        h("p", { class: "mute text-xs mb-1" }, t("Where the offers are")),
        h("ul", { class: "grid gap-1.5" }, regions.slice(0, 5).map((r) => h("li", { class: "grid grid-cols-[minmax(0,9rem)_1fr_2.75rem] items-center gap-2 text-sm",
          title: tn(r.count, "{n} offer", "{n} offers") },
          h("span", { class: "truncate" }, r.name),
          h("span", { class: "h-1.5 rounded-full", style: "background:var(--line)", "aria-hidden": "true" },
            h("span", { class: "block h-1.5 rounded-full", style: `width:${Math.max(2, (100 * r.count) / top)}%;background:var(--accent)` })),
          h("span", { class: "text-right tabular-nums mute" }, t("{n}%", { n: pct(r.count, total) })))))) : null));
}

export function renderPulse(root = $("#homePulse")) {
  const p = path();
  if (!root || !p) return;
  const m = summarize(load(p.id));
  const head = h("div", { class: "flex flex-wrap items-baseline justify-between gap-2 mb-3" },
    h("span", { class: "eyebrow" }, t("Your market · {path}", { path: p.name })),
    m.n >= MIN_OFFERS ? h("span", { class: "mute text-xs" }, tn(m.n, "From {n} offer you looked at, last {d} days", "From {n} offers you looked at, last {d} days", { d: KEEP_DAYS })) : null);
  if (m.n < MIN_OFFERS) {
    root.replaceChildren(h("div", { class: "panel" }, head,
      h("div", { class: "flex flex-wrap items-end justify-between gap-3" },
        h("p", { class: "mute text-sm max-w-prose" }, t("Run a few searches on the Offers page: the typical salary, the most requested skills and the share of remote jobs for your path will show up here."),
          m.n ? ` ${tn(m.n, "({n} offer so far)", "({n} offers so far)")}` : ""),
        h("a", { href: "#/offers", class: "btn-ghost" }, t("Find offers"))), salaryBlock(p), hiringBlock(p)));
    return;
  }
  const covered = m.skills.filter((s) => state.cv.names.has(s.name)).length;
  const half = Math.ceil(m.skills.length / 2);
  root.replaceChildren(h("div", { class: "panel" }, head,
    h("div", { class: "grid gap-2 sm:grid-cols-3" },
      tile(t("Typical salary"), m.pay ? formatSalary({ min: m.pay.low, max: m.pay.high, currency: "EUR", period: "year", estimated: false }) : "–",
        m.pay ? tn(m.pay.n, "middle half of {n} salary given in euros", "middle half of {n} salaries given in euros")
          : t("not enough salaries yet ({n})", { n: m.payN })),
      tile(t("Remote"), t("{n}%", { n: m.remote + m.hybrid }), t("{full}% full remote · {hybrid}% hybrid", { full: m.remote, hybrid: m.hybrid })),
      tile(t("Salary shown"), t("{n}%", { n: m.shown }), t("of offers state a pay range"))),
    h("div", { class: "flex flex-wrap items-baseline justify-between gap-2 mt-4 mb-2" },
      h("p", { class: "text-sm font-medium" }, t("Most requested skills")),
      state.cv.skills.length ? h("span", { class: "mute text-xs" }, t("Your CV covers {k} of these {n}", { k: covered, n: m.skills.length }))
        : h("a", { href: "#/cv", class: "text-xs underline", style: "color:var(--accent-ink)" }, t("Add your CV to see your gaps"))),
    m.skills.length ? h("div", { class: "grid gap-x-6 gap-y-1.5 md:grid-cols-2" },
      h("ul", { class: "grid gap-1.5" }, m.skills.slice(0, half).map((s) => skillRow(s, m.n))),
      h("ul", { class: "grid gap-1.5" }, m.skills.slice(half).map((s) => skillRow(s, m.n))))
      : h("p", { class: "mute text-sm" }, t("No known skills found in these offers yet.")),
    m.levelN ? h("p", { class: "mute text-xs mt-3" }, t("Levels asked: "),
      m.levels.filter(([, c]) => c).map(([l, c]) => `${t(`level|${l}`)} ${t("{n}%", { n: pct(c, m.levelN) })}`).join(" · "),
      tn(m.levelN, " (in the {n} offer that states one)", " (in the {n} offers that state one)")) : null, salaryBlock(p), hiringBlock(p)));
}
