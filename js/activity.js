// Learning activity, kept in this browser ("hk.activity"): XP points and the days you studied, for the streak and the
// 7-day strip on the Training page and Home. Every learning action calls logActivity(points): lesson done, track step
// done, quiz answer, flashcard, practice exercise. Also remembers the last course opened ("hk.lastCourse") for "Resume".
import { h, ls } from "./lib.js";
import { t, tn, LOCALE } from "./i18n.js";

const KEY = "hk.activity";
const LAST_KEY = "hk.lastCourse";
const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function read() {
  try {
    const a = JSON.parse(ls.get(KEY) || "{}");
    return { xp: Number(a.xp) || 0, days: a.days && typeof a.days === "object" ? a.days : {} };
  } catch { return { xp: 0, days: {} }; }
}

export function logActivity(points = 1) {
  const a = read(), k = dayKey();
  a.xp += points;
  a.days[k] = (a.days[k] || 0) + 1;
  // keep the last 120 days only
  const keys = Object.keys(a.days).sort();
  for (const old of keys.slice(0, Math.max(0, keys.length - 120))) delete a.days[old];
  ls.set(KEY, JSON.stringify(a));
  document.dispatchEvent(new CustomEvent("hk:activity"));
}

// Consecutive study days ending today (or yesterday: the streak is still alive until tonight).
export function streak() {
  const { days } = read();
  const d = new Date();
  if (!days[dayKey(d)]) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
export const xp = () => read().xp;

export const setLastCourse = (id, lesson) => ls.set(LAST_KEY, JSON.stringify({ id, lesson }));
export function lastCourse() { try { return JSON.parse(ls.get(LAST_KEY) || "null"); } catch { return null; } }

// 🔥 streak · ⚡ XP · the last 7 days as dots.
export function activityStrip() {
  const { days } = read(), s = streak();
  const week = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); return d; });
  return h("div", { class: "flex flex-wrap items-center gap-x-6 gap-y-3" },
    h("div", {}, h("span", { class: "eyebrow" }, t("Streak")),
      h("b", { class: "block text-2xl font-semibold" }, `🔥 ${tn(s, "{n} day", "{n} days")}`)),
    h("div", {}, h("span", { class: "eyebrow" }, t("Points")),
      h("b", { class: "block text-2xl font-semibold" }, `⚡ ${read().xp} XP`)),
    h("div", { class: "flex gap-1.5", "aria-label": t("Study days this week") }, week.map((d) => {
      const on = Boolean(days[dayKey(d)]), today = dayKey(d) === dayKey();
      return h("div", { class: "grid justify-items-center gap-1" },
        h("span", { class: "text-[11px] mute" }, d.toLocaleDateString(LOCALE, { weekday: "narrow" })),
        h("span", { class: "w-7 h-7 rounded-full grid place-items-center text-xs", title: d.toLocaleDateString(LOCALE, { weekday: "long", day: "numeric", month: "short" }),
          style: on ? "background:var(--accent);color:#fff" : `background:var(--soft);${today ? "box-shadow:inset 0 0 0 2px var(--accent)" : ""}` }, on ? "✓" : ""));
    })));
}
