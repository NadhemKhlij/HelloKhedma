// Path market pulse (ROADMAP 3.9): what the market asks for the selected path, built from the offers the user has
// looked at on the Offers page. Kept in this browser only ("hk.pulse.<path id>"); nothing is sent anywhere.
// - recordOffers(items): called by renderOffers (offers.js) with every offer of the current results. Only offers
//   whose title matches the path (titleMatcher, companies.js) are kept, so a broad company list does not skew it.
//   One small entry per offer (skills, remote, yearly salary in euros, level), at most MAX, none older than KEEP_DAYS.
// - renderPulse(root): the Home card. Typical salary (middle half of the euro salaries given by employers; provider
//   estimates are left out), share of remote / hybrid offers, share of offers that state a salary, the most requested
//   skills (✓ in your CV, 📘 course link otherwise) and the levels asked. Below MIN_OFFERS, an empty state.
import { $, h, ls } from "./lib.js";
import { t, tn } from "./i18n.js";
import { state, path, skillChip } from "./state.js";
import { titleMatcher } from "./companies.js";
import { formatSalary } from "./salary.js";

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
    pay: pay.length >= 3 ? { low: quantile(pay, 0.25), high: quantile(pay, 0.75), n: pay.length } : null,
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
const skillRow = ({ name, c, p }, n) => h("li", { class: "grid grid-cols-[minmax(0,9rem)_1fr_2.75rem] items-center gap-2 text-sm",
  title: t("{name}: named in {c} of {n} offers", { name, c, n }) },
  h("span", { class: "truncate" }, skillChip(name, state.cv.names.has(name))),
  h("span", { class: "h-1.5 rounded-full", style: "background:var(--line)", "aria-hidden": "true" },
    h("span", { class: "block h-1.5 rounded-full", style: `width:${Math.max(2, p)}%;background:var(--accent)` })),
  h("span", { class: "text-right tabular-nums mute" }, t("{n}%", { n: p })));

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
        h("a", { href: "#/offers", class: "btn-ghost" }, t("Find offers")))));
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
        : h("a", { href: "#/cv", class: "text-xs underline", style: "color:var(--accent)" }, t("Add your CV to see your gaps"))),
    m.skills.length ? h("div", { class: "grid gap-x-6 gap-y-1.5 md:grid-cols-2" },
      h("ul", { class: "grid gap-1.5" }, m.skills.slice(0, half).map((s) => skillRow(s, m.n))),
      h("ul", { class: "grid gap-1.5" }, m.skills.slice(half).map((s) => skillRow(s, m.n))))
      : h("p", { class: "mute text-sm" }, t("No known skills found in these offers yet.")),
    m.levelN ? h("p", { class: "mute text-xs mt-3" }, t("Levels asked: "),
      m.levels.filter(([, c]) => c).map(([l, c]) => `${t(`level|${l}`)} ${t("{n}%", { n: pct(c, m.levelN) })}`).join(" · "),
      tn(m.levelN, " (in the {n} offer that states one)", " (in the {n} offers that state one)")) : null));
}
