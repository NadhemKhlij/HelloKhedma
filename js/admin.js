// Admin page (#/admin, 2026-11-06): the site's main statistics for the owner. Data from one Supabase call,
// admin_stats() (migration 20261106000200): totals only, no e-mail, name or CV text. The database refuses anyone who
// is not in the admins table (error 42501), so hiding the link is not the protection. Visitors who never sign in are
// not counted here: they are in Cloudflare Web Analytics (link at the top) when CONFIG.CF_ANALYTICS_TOKEN is set.
//   renderAdmin()  draws the page (stat tiles, sign-ups per week, daily searches / AI calls, applications by stage,
//                  chosen paths, anonymous statistics, open problem reports with Done / Ignore)
//   checkAdmin()   true when the signed-in user is an admin (is_admin()); account.js shows the Admin link with it
// Charts: one series each, in the path color (--accent), a tooltip (title) on every bar; the numbers are also written
// out, so nothing relies on the bars alone.
import { $, h } from "./lib.js";
import { t, LOCALE } from "./i18n.js";
import { sb } from "./supabase.js";
import { state } from "./state.js";
import { STAGES } from "./store.js";
import { courseMeta } from "./courses.js";

const num = (n) => Number(n || 0).toLocaleString(LOCALE);
const day = (d) => new Date(`${d}T00:00:00`).toLocaleDateString(LOCALE, { day: "numeric", month: "short" });

export async function checkAdmin() {
  if (!sb || !state.user) return false;
  const { data, error } = await sb.rpc("is_admin");
  return !error && data === true;
}

function tile(label, value, sub) {
  return h("div", { class: "panel !p-4 grid gap-0.5" },
    h("span", { class: "mute text-xs" }, label),
    h("span", { class: "serif text-2xl font-semibold" }, value),
    sub ? h("span", { class: "mute text-xs" }, sub) : null);
}

// Horizontal bars for a ranked list: [{ label, n, href? }].
function bars(rows, empty) {
  if (!rows.length) return h("p", { class: "mute text-sm" }, empty);
  const max = Math.max(...rows.map((r) => r.n), 1);
  return h("ul", { class: "grid gap-1.5" }, rows.map((r) => h("li", { class: "grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-2 text-sm", title: `${r.label}: ${num(r.n)}` },
    r.href ? h("a", { href: r.href, class: "truncate underline" }, r.label) : h("span", { class: "truncate" }, r.label),
    h("span", { class: "h-2.5 rounded-full", style: `background:var(--soft)` },
      h("span", { class: "block h-full rounded-full", style: `width:${Math.max(2, (100 * r.n) / max)}%;background:var(--accent)` })),
    h("span", { class: "tabular-nums font-medium" }, num(r.n)))));
}

// Vertical bars over time: [{ label, n }] (oldest first), with the total and the peak written below.
function columns(points, caption) {
  const W = 300, H = 90, gap = 2, n = points.length, max = Math.max(...points.map((p) => p.n), 1);
  const w = (W - gap * (n - 1)) / n;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H + 1}`);
  svg.setAttribute("preserveAspectRatio", "none"); // stretch to the card width
  svg.setAttribute("class", "w-full h-28");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", caption);
  points.forEach((p, i) => {
    const bh = p.n ? Math.max(2, (H * p.n) / max) : 0;
    const g = document.createElementNS(svg.namespaceURI, "g");
    // Hit target: the whole column, so the tooltip works on small bars too.
    const hit = document.createElementNS(svg.namespaceURI, "rect");
    Object.entries({ x: i * (w + gap), y: 0, width: w, height: H, fill: "transparent" }).forEach(([k, v]) => hit.setAttribute(k, v));
    const bar = document.createElementNS(svg.namespaceURI, "rect");
    Object.entries({ x: i * (w + gap), y: H - bh, width: w, height: bh, rx: Math.min(2, w / 2), fill: "var(--accent)" }).forEach(([k, v]) => bar.setAttribute(k, v));
    const title = document.createElementNS(svg.namespaceURI, "title");
    title.textContent = `${p.label}: ${num(p.n)}`;
    g.append(title, hit, bar);
    svg.append(g);
  });
  const base = document.createElementNS(svg.namespaceURI, "line");
  Object.entries({ x1: 0, x2: W, y1: H + 0.5, y2: H + 0.5, stroke: "var(--line, currentColor)", "stroke-opacity": 0.3 }).forEach(([k, v]) => base.setAttribute(k, v));
  svg.append(base);
  const total = points.reduce((a, p) => a + p.n, 0);
  const peak = points.reduce((a, p) => (p.n > a.n ? p : a), points[0] || { n: 0, label: "" });
  return h("figure", { class: "grid gap-1" }, svg,
    h("div", { class: "flex justify-between mute text-xs" }, h("span", {}, points[0]?.label || ""), h("span", {}, points.at(-1)?.label || "")),
    h("figcaption", { class: "text-xs" }, t("Total {total} · peak {peak} ({when})", { total: num(total), peak: num(peak.n), when: peak.label })));
}

// Last `days` days (oldest first), zeros filled in, from [{ day, kind, n }].
function daily(rows, kind, days = 30) {
  const by = new Map(rows.filter((r) => r.kind === kind).map((r) => [r.day, r.n]));
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    out.push({ label: day(k), n: by.get(k) || 0 });
  }
  return out;
}
// Last 12 weeks (Monday start, oldest first), zeros filled in, from [{ week, n }].
function weekly(rows) {
  const by = new Map(rows.map((r) => [r.week, r.n]));
  const monday = new Date(); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const out = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(monday); d.setDate(d.getDate() - 7 * i);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    out.push({ label: day(k), n: by.get(k) || 0 });
  }
  return out;
}

const section = (title, ...kids) => h("section", { class: "panel grid gap-3 content-start" }, h("h2", { class: "font-semibold" }, title), ...kids);

export async function renderAdmin() {
  const root = $("#adminRoot");
  if (!root) return;
  const say = (text) => root.replaceChildren(h("p", { class: "panel text-sm" }, text));
  if (!sb) return say(t("Supabase is not configured."));
  if (!state.user) return say(t("Sign in with an administrator account to see the statistics."));
  root.replaceChildren(h("p", { class: "mute text-sm" }, t("Loading…")));
  const { data: s, error } = await sb.rpc("admin_stats");
  if (error) {
    return say(error.code === "42501" ? t("This page is for administrators only.")
      : error.code === "PGRST202" || /admin_stats/.test(error.message || "") ? t("The admin statistics are not installed yet (run the migration 20261106000200_admin_stats.sql).")
      : t("Could not load the statistics: {msg}", { msg: error.message }));
  }
  const a = s.accounts || {}, apps = s.applications || {}, ins = s.insights || {}, rep = s.reports || {};
  const stamp = new Date(s.generated_at).toLocaleString(LOCALE, { dateStyle: "medium", timeStyle: "short" });

  const reports = rep.items?.length
    ? h("ul", { class: "grid gap-2" }, rep.items.map((r) => {
      const act = (status) => async (ev) => {
        ev.currentTarget.disabled = true;
        const { error: e } = await sb.rpc("admin_report_status", { p_id: r.id, p_status: status });
        if (e) { ev.currentTarget.disabled = false; return; }
        renderAdmin();
      };
      return h("li", { class: "rounded-xl p-3 grid gap-1.5 text-sm", style: "background:var(--soft)" },
        h("div", { class: "flex flex-wrap gap-x-2 gap-y-1 items-center mute text-xs" },
          h("a", { href: r.part === "project" ? `#/project/${r.course_id}` : `#/course/${r.course_id}`, class: "underline font-medium" }, r.course_id),
          h("span", {}, `${r.part}${r.position != null ? ` #${r.position + 1}` : ""}`), r.lang ? h("span", {}, r.lang) : null,
          h("span", {}, new Date(r.created_at).toLocaleDateString(LOCALE))),
        h("p", { class: "[overflow-wrap:anywhere]" }, r.message),
        h("div", { class: "flex gap-2" },
          h("button", { type: "button", class: "btn !py-1 !px-3 !text-xs", onClick: act("done") }, t("✓ Done")),
          h("button", { type: "button", class: "btn-ghost !py-1 !px-3 !text-xs", onClick: act("ignored") }, t("Ignore"))));
    }))
    : h("p", { class: "mute text-sm" }, t("No open report."));

  root.replaceChildren(
    h("div", { class: "flex flex-wrap items-center gap-2 text-sm" },
      h("span", { class: "mute" }, t("Updated {when}", { when: stamp })),
      h("button", { type: "button", class: "btn-ghost !py-1 !px-3 !text-xs", onClick: () => renderAdmin() }, t("↻ Refresh")),
      h("a", { href: "https://dash.cloudflare.com/?to=/:account/web-analytics", target: "_blank", rel: "noopener", class: "btn-ghost !py-1 !px-3 !text-xs" }, t("Visitors (Cloudflare) ↗"))),
    h("div", { class: "grid grid-cols-2 sm:grid-cols-4 gap-3" },
      tile(t("Accounts"), num(a.total), t("{n} confirmed", { n: num(a.confirmed) })),
      tile(t("New accounts"), num(a.new_7d), t("7 days · {n} in 30 days", { n: num(a.new_30d) })),
      tile(t("Active accounts"), num(a.active_7d), t("signed in, 7 days · {n} in 30 days", { n: num(a.active_30d) })),
      tile(t("Applications tracked"), num(apps.total), t("by {n} accounts", { n: num(apps.accounts) })),
      tile(t("CVs saved to an account"), num(s.cv_sync_accounts), t("accounts with the option on")),
      tile(t("Learning synced"), num(s.learning_sync_accounts), t("accounts")),
      tile(t("Job searches"), num(daily(s.usage_daily || [], "job_search").reduce((x, p) => x + p.n, 0)), t("last 30 days")),
      tile(t("AI CV calls"), num(daily(s.usage_daily || [], "cv_tailor").reduce((x, p) => x + p.n, 0)), t("last 30 days"))),
    h("div", { class: "grid gap-4 md:grid-cols-2" },
      section(t("Sign-ups per week"), columns(weekly(s.signups_weekly || []), t("Sign-ups per week"))),
      section(t("Job searches per day"), columns(daily(s.usage_daily || [], "job_search"), t("Job searches per day"))),
      section(t("AI CV calls per day"), columns(daily(s.usage_daily || [], "cv_tailor"), t("AI CV calls per day"))),
      section(t("Applications by stage"), bars(STAGES.map((st) => ({ label: st.label, n: apps.by_stage?.[st.id] || 0 })), t("No application yet."))),
      section(t("Paths chosen (accounts)"), bars((s.paths || []).map((p) => ({ label: state.paths.find((x) => x.id === p.path_id)?.name || p.path_id, n: p.n })), t("No data yet."))),
      section(t("Courses finished (90 days)"), bars((ins.courses_done || []).map((c) => ({ label: courseMeta(c.course_id)?.name || c.course_id, n: c.n, href: `#/course/${c.course_id}` })), t("No data yet."))),
      section(t("Skills missing from CVs (90 days)"), bars((ins.gaps || []).map((g) => ({ label: g.skill, n: g.n })), t("No data yet."))),
      section(t("Skills asked in offers (90 days)"), bars((ins.offer_skills || []).map((g) => ({ label: g.skill, n: g.n })), t("No data yet.")))),
    h("p", { class: "mute text-xs" }, t("Courses, skills and offers come from the anonymous statistics of visitors who said yes ({n} events in 90 days). Job searches and AI calls are counted from the day this page was installed.", { n: num(ins.events_90d) })),
    section(t("Open problem reports ({n})", { n: num(rep.open) }), reports));
}
