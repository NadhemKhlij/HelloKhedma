// Offers kept in this browser so the CV page can match a CV with an offer without pasting it (#/cv, "Match with a job
// offer" → "Choose an offer"). Offer texts are public job ads; they stay in this browser and are never sent anywhere.
// - rememberOffers(items): called by renderOffers (offers.js) with the offers shown on the Offers page (every tab).
//   Newest first, at most MAX per path ("hk.recentOffers.<path id>"), none older than KEEP_DAYS, text cut to TEXT_MAX.
// - rememberTracked(job): called when an offer is added to the tracker ("Track"): its text is kept under its
//   source:id ("hk.trackedOffers", newest MAX_TRACKED), so a tracker card can be matched later. Cards added by hand
//   or on another device have no text here (the picker says so).
// - recentOffers(pathId) -> [{ key, title, company, location, text, at }]
// - trackedOffer(card) -> { title, company, text } | null   (card: a tracker card, store.js shape)
// - offerAsText(o): the text put in the offer box: title on the first line (cvpage.js reads it as the job title).
import { ls } from "./lib.js";

const MAX = 60, MAX_TRACKED = 200, KEEP_DAYS = 30, TEXT_MAX = 5000, DAY = 86_400_000;
const RECENT = (pathId) => `hk.recentOffers.${pathId}`, TRACKED = "hk.trackedOffers";
const read = (k, empty) => { try { return JSON.parse(ls.get(k) || "null") ?? empty; } catch { return empty; } };
const clip = (s, n) => String(s || "").trim().slice(0, n);
const slim = (j) => ({ title: clip(j.title, 200), company: clip(j.company, 120), location: clip(j.location, 120),
  text: clip(j.text || j.snippet, TEXT_MAX) });
export const trackedKey = (source, id) => `${source || ""}:${id || ""}`;

export function recentOffers(pathId) {
  const since = Date.now() - KEEP_DAYS * DAY;
  return read(RECENT(pathId), []).filter((o) => o.at >= since && o.text);
}

// items: [{ j, key }] as built by renderOffers. Offers already kept move to the top (seen again = still open).
export function rememberOffers(pathId, items) {
  if (!pathId || !items.length) return;
  const now = Date.now(), fresh = items.filter((x) => x.j.title && (x.j.text || x.j.snippet))
    .map((x, i) => ({ key: x.key, ...slim(x.j), at: now - i })); // keeps the results order among equal times
  if (!fresh.length) return;
  const keys = new Set(fresh.map((o) => o.key));
  const next = [...fresh, ...recentOffers(pathId).filter((o) => !keys.has(o.key))].slice(0, MAX);
  ls.set(RECENT(pathId), JSON.stringify(next));
}

export function rememberTracked(job) {
  if (!job?.title || !(job.text || job.snippet)) return;
  const all = read(TRACKED, {}), k = trackedKey(job.source, job.id);
  delete all[k];
  const next = Object.entries({ [k]: { ...slim(job), at: Date.now() }, ...all }).slice(0, MAX_TRACKED);
  ls.set(TRACKED, JSON.stringify(Object.fromEntries(next)));
}

export function trackedOffer(card) {
  if (!card?.external_id) return null;
  const o = read(TRACKED, {})[trackedKey(card.source, card.external_id)];
  return o?.text ? { title: card.title || o.title, company: card.company || o.company, location: o.location, text: o.text } : null;
}

export const offerAsText = (o) => [o.title, [o.company, o.location].filter(Boolean).join(" · "), "", o.text]
  .filter((l, i) => l || i === 2).join("\n").trim();
