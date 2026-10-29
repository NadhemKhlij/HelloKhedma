// Salary of a job offer, read from the provider's salary field (job.salary, when the source has one) or from the
// description text, in French and English wording: "45-55 k€", "entre 45 000 € et 55 000 € brut annuel",
// "2 500 € brut mensuel", "TJM 450 €", "$120,000–$150,000 a year", "£40k". Company figures ("au capital de 50 000 €",
// "chiffre d'affaires", "levée de 10 M€") are ignored. Returns null when no plausible salary is found.
// Result: { min, max, currency, period ("year" | "month" | "day" | "hour"), yearMin, yearMax, estimated }.
// yearMin / yearMax convert to a yearly amount (12 months, 218 working days, 1,607 hours: the French references)
// so offers can be filtered and sorted; the chip shows the amount as written, with its period.
import { t, LOCALE } from "./i18n.js";

const CUR = [[/€|eur(?:os?)?\b/i, "EUR"], [/\$|usd\b|dollars?/i, "USD"], [/£|gbp\b/i, "GBP"], [/chf\b/i, "CHF"]];
const curOf = (s) => (CUR.find(([re]) => re.test(s || "")) || [null, null])[1];
const PER_YEAR = { year: 1, month: 12, day: 218, hour: 1607 };
const PERIODS = [
  ["hour", /\b(?:heure|horaire|hour|hourly|hr|\/h)\b|\/h\b/i],
  ["day", /\b(?:jour|journalier|tjm|day|daily|per diem)\b/i],
  ["month", /\b(?:mois|mensuel(?:le)?|month|monthly|mo)\b/i],
  ["year", /\b(?:an|ans|année|annuel(?:le)?|year|yearly|yr|annual|annum|pa|p\.a)\b/i],
];
// Words that announce a company figure, not a pay: within the few words before the amount.
const NOT_PAY = /prime|bonus|indemnit|ticket|mutuelle|capital|chiffre d.affaires|\bca\b|lev[ée]e|fonds|budget|valoris|millions?|milliards?|\bm€|revenue|turnover|funding|raised|series [a-e]/i;
const PAY_WORD = /salaire|r[ée]mun[ée]ration|brut|gross|salary|compensation|pay\b|package|tjm|daily rate|fixe|variable|k€|ote|base/i;

// Money amount: optional currency before, number (with thousands separators or decimals), optional k, currency after.
const NUM = String.raw`(\d{1,3}(?:[ .,  ]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?)`;
const AMOUNT = String.raw`([€$£])?\s?${NUM}\s?([kK])?\s?(€|eur(?:os?)?\b|\$|usd\b|£|gbp\b|chf\b)?`;
const RANGE = new RegExp(`${AMOUNT}\\s?(?:-|–|—|à|to|et|and)\\s?${AMOUNT}`, "gi");
const SINGLE = new RegExp(AMOUNT, "gi");

const toNumber = (s) => {
  const x = s.replace(/[   ]/g, "");
  // "45.000" / "45,000" are thousands; "2,5" / "2.5" are decimals.
  if (/^\d{1,3}([.,]\d{3})+$/.test(x)) return Number(x.replace(/[.,]/g, ""));
  return Number(x.replace(",", "."));
};

// Period written closest to the amount ("Annuel de 40000 Euros … sur 12 mois" is yearly), otherwise guessed from
// the size of the figure.
function periodOf(after, before, value) {
  let best = null;
  for (const [name, re] of PERIODS) {
    const g = new RegExp(re.source, "gi");
    const win = before.slice(-30).split(/[.;!?\n]/).pop(); // same sentence only
    for (const m of win.matchAll(g)) { const d = win.length - m.index; if (!best || d < best.d) best = { name, d }; }
    const m = after.slice(0, 40).match(re);
    if (m && (!best || m.index < best.d)) best = { name, d: m.index };
  }
  if (best) return best.name;
  if (value >= 12000) return "year";
  if (value >= 1000) return "month";
  if (value >= 100) return "day";
  return "hour";
}

function candidate(text, m, isRange) {
  const [whole] = m, at = m.index, before = text.slice(Math.max(0, at - 60), at), after = text.slice(at + whole.length);
  const parts = isRange ? [m.slice(1, 5), m.slice(5, 9)] : [m.slice(1, 5)];
  // A currency right after the amount ("45 000 Euros"), not one further on ("38-42 k€" must not make "38" a salary).
  const currency = curOf(whole) || curOf((after.match(/^\s?(?:€|eur(?:os?)?\b|\$|usd\b|£|gbp\b|chf\b)/i) || [""])[0]);
  const kAny = parts.some((p) => p[2]);
  let values = parts.map(([, num, k]) => toNumber(num) * (k || (kAny && isRange) ? 1000 : 1));
  if (values.some((v) => !Number.isFinite(v) || v <= 0)) return null;
  if (!currency && !kAny) return null; // a bare number is not a salary
  // Company figures and benefits, in the same sentence just before the amount.
  if (NOT_PAY.test(before.slice(-35).split(/[.;!?\n]/).pop()) || /^\s?(?:m€|m\b|millions?|milliards?|bn)/i.test(after)) return null;
  const period = periodOf(after, before, values[0]);
  values = values.sort((a, b) => a - b);
  const [min, max] = [values[0], values[values.length - 1]];
  const yearMin = min * PER_YEAR[period], yearMax = max * PER_YEAR[period];
  if (yearMin < 8000 || yearMax > 600000 || max > min * 3) return null; // implausible for a salary
  // A salary word just before the amount counts more than one just after ("prime de 1 000 €, salaire 42 k€").
  const score = (PAY_WORD.test(before.slice(-40)) ? 2 : PAY_WORD.test(after.slice(0, 25)) ? 1 : 0) + (isRange ? 1 : 0) + (currency ? 1 : 0);
  return { min, max, currency: currency || "EUR", period, yearMin, yearMax, score };
}

// trusted: the text is the provider's salary field, so no salary word is needed around the amount.
export function parseSalary(text, { trusted = false } = {}) {
  if (!text) return null;
  const s = String(text);
  const found = [];
  for (const m of s.matchAll(RANGE)) { const c = candidate(s, m, true); if (c) found.push(c); }
  if (!found.length) for (const m of s.matchAll(SINGLE)) { const c = candidate(s, m, false); if (c) found.push(c); }
  if (!found.length) return null;
  const best = found.sort((a, b) => b.score - a.score)[0];
  return best.score >= (trusted ? 1 : 2) ? best : null; // needs a salary word, or a range with a currency
}

// Salary of an offer: the provider's own field first (job.salary), then the description.
export function offerSalary(j) {
  const own = parseSalary(j.salary, { trusted: true });
  if (own) return { ...own, estimated: Boolean(j.salaryEstimated) };
  const fromText = parseSalary(j.text || j.snippet);
  return fromText ? { ...fromText, estimated: false } : null;
}

// "45–55 k€ /an", "2 500–3 000 € /mois", "450 € /jour" (fr) · "€45–55k /yr" (en). "≈" marks a provider estimate.
export function formatSalary(x) {
  const fmt = new Intl.NumberFormat(LOCALE, { style: "currency", currency: x.currency, maximumFractionDigits: x.min < 100 ? 2 : 0,
    ...(x.period === "year" ? { notation: "compact", maximumFractionDigits: 0 } : {}) }); // whole thousands: "64–85 k€"
  const amount = x.min === x.max ? fmt.format(x.min) : fmt.formatRange ? fmt.formatRange(x.min, x.max) : `${fmt.format(x.min)} – ${fmt.format(x.max)}`;
  return `${x.estimated ? "≈ " : ""}${amount} ${t(`salary|/${x.period}`)}`;
}
