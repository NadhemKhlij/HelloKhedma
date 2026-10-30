// Offer checks, computed in the browser from what the provider returned (ROADMAP 3.1 and 3.8). Nothing is sent anywhere.
// - offerAge(j): days since the offer was posted (j.posted, given by every source), null when unknown or invalid.
// - ageLabel(days): "Today", "3 days ago"…; STALE_DAYS: older offers are often filled already.
// - seniority(j): "Junior" | "Mid" | "Senior" | "Lead" | null, from the title first, then the years of experience asked
//   in the text (EN + FR wording). Most offers state nothing: callers keep those when filtering by level.
// - trustFlags(j, days): reasons to check an offer before applying (messaging-app contact, personal email address,
//   fees or money transfers, easy-money wording, no company name, stale). Signals, not proof: the card says so.
//   Adzuna gives only ~500 characters per offer, so its checks see less of the text.
import { t, tn } from "./i18n.js";
import { norm } from "./ats.js";

const DAY = 86_400_000;
export const STALE_DAYS = 45;

export function offerAge(j) {
  const at = j.posted ? new Date(j.posted).getTime() : NaN;
  if (!Number.isFinite(at) || at > Date.now() + DAY) return null;
  return Math.max(0, Math.floor((Date.now() - at) / DAY));
}

export function ageLabel(days) {
  if (days == null) return "";
  if (days === 0) return t("Posted today");
  if (days === 1) return t("Posted yesterday");
  if (days <= 60) return tn(days, "Posted {n} day ago", "Posted {n} days ago");
  return t("Posted over 2 months ago");
}

// Years of experience asked ("3+ years", "5 ans d'expérience", "minimum 2 ans"): the smallest number found, or null.
function yearsAsked(text) {
  const years = [...text.matchAll(/(\d{1,2})\s*(?:\+|(?:-|a|to)\s*\d{1,2})?\s*(?:years?|yrs|ans|annees)\b[^.\n]{0,25}?\b(?:experience|exp)\b/g)]
    .map((m) => Number(m[1])).filter((n) => n <= 20);
  return years.length ? Math.min(...years) : null;
}

export function seniority(j) {
  const title = norm(j.title), text = norm(`${j.text || j.snippet || ""}`);
  if (/\b(lead|principal|staff|head of|chief|director|directeur|directrice|manager|tech lead|architect|architecte)\b/.test(title)) return "Lead";
  if (/\b(senior|sr\.?|expert|experimente|experimentee)\b/.test(title)) return "Senior";
  if (/\b(junior|jr\.?|graduate|entry[- ]level|debutant|debutante|jeune diplome|jeune diplomee|intern|internship|stage|stagiaire|alternance|alternant|apprenti)\b/.test(title)) return "Junior";
  if (/\b(mid[- ]level|intermediate|confirme|confirmee)\b/.test(title)) return "Mid";
  const years = yearsAsked(text);
  if (years == null) return /\b(entry[- ]level|no experience required|debutant accepte|debutants acceptes|jeune diplome)\b/.test(text) ? "Junior" : null;
  return years >= 5 ? "Senior" : years >= 2 ? "Mid" : "Junior";
}

// Free / personal email providers: a company recruiter normally writes from the company's domain.
const PERSONAL_EMAIL = /[\w.+-]+@(gmail|googlemail|yahoo|ymail|hotmail|outlook|live|msn|icloud|me|aol|gmx|proton|protonmail|yandex|mail|laposte|orange|free|sfr|wanadoo)\.[a-z.]{2,6}\b/;
const MESSAGING = /\b(whatsapp|telegram|signal app|wechat|viber|kik)\b/;
const MONEY = /\b(registration|application|training|starter|onboarding|processing|equipment) (fee|fees|kit)\b|\bpay (for|your) (the )?(training|equipment|kit|registration)|\bfrais (d'inscription|de formation|de dossier|d'equipement)|\bformation payante\b|\bwestern union\b|\bmoneygram\b|\bmoney transfer\b|\bmandat cash\b|\bcheque (to deposit|a encaisser)\b|\bdeposit (a|the) (check|cheque)\b|\bgift cards?\b|\bcartes? cadeaux?\b|\bbitcoin\b|\bcrypto(currency)? (payment|wallet)\b/;
const EASY_MONEY = /\b(easy|quick|fast) money\b|\bargent facile\b|\bearn up to \$?\d|\bgagnez jusqu'?a\b|\bbe your own boss\b|\bsoyez votre propre patron\b/;
const NO_COMPANY = /^(confidential|confidentiel|confidentielle|anonymous|anonyme|n\/?a|-|private|prive|undisclosed)$/;

// [{ text, serious }]: serious ones are classic scam signals; a stale offer is only worth checking.
export function trustFlags(j, days = offerAge(j)) {
  const text = norm(`${j.title} ${j.text || j.snippet || ""}`), company = norm(j.company || "").trim();
  const flags = [];
  if (MESSAGING.test(text)) flags.push({ serious: true, text: t("Asks you to talk on WhatsApp or Telegram: real recruiters rarely start there.") });
  if (PERSONAL_EMAIL.test(text)) flags.push({ serious: true, text: t("Gives a personal email address (Gmail, Outlook…) rather than a company one.") });
  if (MONEY.test(text)) flags.push({ serious: true, text: t("Mentions fees, gift cards, cheques or money transfers: never pay to get a job.") });
  if (EASY_MONEY.test(text)) flags.push({ serious: true, text: t("Promises easy money: real offers describe the work, not the earnings.") });
  if (!company || NO_COMPANY.test(company)) flags.push({ serious: false, text: t("No company name: look the employer up before sending your CV.") });
  if (days != null && days > STALE_DAYS) flags.push({ serious: false, text: t("Posted more than {n} days ago: it may already be filled.", { n: STALE_DAYS }) });
  return flags;
}
