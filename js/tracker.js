// Application tracker UI: Kanban board, details dialog, stats, follow-ups, CSV and calendar files.
// - Board: drag and drop + arrow buttons; "Details" opens #appDialog (fields read via form.elements, since
//   form.title is the form's own attribute). Interview-stage cards get a "Prepare" link to #/interview.
// - Stage changes append to `history` (timeline, stats). nextActions() feeds Home: due follow-ups, interviews in 7 days.
// - Stats + weekly goal ("hk.weeklyGoal"), CSV export/import (accepts "," or ";"), .ics file for interviews.
// - Detail fields need migration 20261029000000 for signed-in users; keep the detailsSupported() fallback in store.js
//   (the dialog shows a notice when details are not synced).
// - Texts go through t() (i18n.js). The .ics file and CSV columns stay in English (machine-readable / shared files).
import { $, h, safeUrl, safeColor, download } from "./lib.js";
import { t, LOCALE } from "./i18n.js";
import { STAGES } from "./store.js";

const DAY = 86_400_000;
const stageLabel = (id) => STAGES.find((s) => s.id === id)?.label || id;
const fmtDate = (d) => new Date(d).toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
const fmtDateTime = (d) => new Date(d).toLocaleString(LOCALE, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
const reached = (c, stage) => c.stage === stage || (c.history || []).some((x) => x.stage === stage);
const ACTIVE = new Set(["saved", "applied", "interview"]); // follow-ups only matter while the application is open

// "overdue" | "today" | "soon" (within 3 days) | null
export function followUpState(c) {
  if (!c.follow_up_on || !ACTIVE.has(c.stage)) return null;
  const due = new Date(`${c.follow_up_on}T00:00:00`).getTime(), today = startOfToday();
  if (due < today) return "overdue";
  if (due < today + DAY) return "today";
  if (due < today + 4 * DAY) return "soon";
  return null;
}
const FOLLOW = { overdue: [t("Follow-up overdue"), "#e0508b"], today: [t("Follow up today"), "#f08a24"], soon: [t("Follow up soon"), "var(--accent)"] };

// Things to do: follow-ups due soon and interviews in the next 7 days, soonest first.
export function nextActions(cards) {
  const now = Date.now(), items = [];
  for (const c of cards) {
    const f = followUpState(c);
    if (f) items.push({ c, at: new Date(`${c.follow_up_on}T00:00:00`).getTime(), kind: f, text: c.next_action || t("Follow up") });
    if (c.interview_at && ACTIVE.has(c.stage)) {
      const at = new Date(c.interview_at).getTime();
      if (at > now - 2 * 3600_000 && at < now + 7 * DAY) items.push({ c, at, kind: "interview", text: t("Interview {date}", { date: fmtDateTime(at) }) });
    }
  }
  return items.sort((a, b) => a.at - b.at);
}

/* ---------- board ---------- */
export function renderBoard(root, cards, { onMove, onOpen, colorOf }) {
  root.replaceChildren(...STAGES.map((st, i) => {
    const items = cards.filter((c) => c.stage === st.id);
    const col = h("div", { class: "rounded-lg p-2 min-h-[140px]", style: "background:var(--bg);border:1px solid var(--line)" },
      h("h3", { class: "flex justify-between px-1 pb-2 text-sm font-medium" }, st.label, h("span", { class: "mute" }, items.length)),
      items.length ? items.map((c) => card(c, i, { onMove, onOpen, colorOf })) : h("p", { class: "mute text-sm px-1" }, t("Drop a card here.")),
    );
    col.addEventListener("dragover", (e) => { e.preventDefault(); col.style.outline = "2px dashed var(--accent)"; });
    col.addEventListener("dragleave", () => { col.style.outline = ""; });
    col.addEventListener("drop", (e) => {
      e.preventDefault();
      col.style.outline = "";
      const id = e.dataTransfer.getData("text/plain");
      if (id) onMove(id, st.id);
    });
    return col;
  }));
}

function card(c, stageIndex, { onMove, onOpen, colorOf }) {
  const url = safeUrl(c.url), f = followUpState(c);
  const move = (delta) => onMove(c.id, STAGES[stageIndex + delta].id);
  const btn = (label, title, disabled, fn) =>
    h("button", { class: "btn-ghost !px-2 !py-0", type: "button", title, "aria-label": title, disabled, onClick: fn }, label);
  const badge = (text, color) => h("span", { class: "chip !py-0 !px-2 text-xs", style: color ? `border-color:${color};color:${color}` : "" }, text);
  const el = h("div", {
    class: "rounded-lg p-2 mb-2 text-sm cursor-grab",
    draggable: "true",
    style: `background:var(--panel);border:1px solid ${f === "overdue" ? "#e0508b" : "var(--line)"};border-left:3px solid ${safeColor(colorOf(c.path_id))}`,
  },
    h("button", { type: "button", class: "block text-left font-bold hover:underline", onClick: () => onOpen(c) }, c.title),
    h("span", { class: "mute" }, c.company || t("No company")),
    h("div", { class: "flex flex-wrap gap-1 mt-1" },
      c.salary ? badge(c.salary) : null,
      c.interview_at && new Date(c.interview_at).getTime() > Date.now() - 2 * 3600_000 ? badge(`📅 ${fmtDateTime(c.interview_at)}`, "var(--accent)") : null,
      f ? badge(`⏰ ${FOLLOW[f][0]}`, FOLLOW[f][1]) : null),
    c.next_action ? h("p", { class: "mute text-xs mt-1" }, t("Next: {action}", { action: c.next_action })) : null,
    url ? h("a", { href: url, target: "_blank", rel: "noopener noreferrer", class: "block underline text-xs mt-1", style: "color:var(--accent)" }, t("Open offer")) : null,
    h("div", { class: "flex gap-1 mt-2" },
      btn("←", t("Move back"), stageIndex === 0, () => move(-1)),
      btn("→", t("Move forward"), stageIndex === STAGES.length - 1, () => move(1)),
      btn(t("Details"), t("Edit details, notes, follow-up and interview"), false, () => onOpen(c)),
      c.stage === "interview" ? h("a", { href: "#/interview", class: "btn-ghost !px-2 !py-0", title: t("Practise for this interview") }, t("Prepare")) : null,
    ),
  );
  el.addEventListener("dragstart", (e) => e.dataTransfer.setData("text/plain", c.id));
  return el;
}

/* ---------- stats & weekly goal ---------- */
export function renderStats(root, cards, goal, onGoal) {
  const applied = cards.filter((c) => c.stage !== "saved" || reached(c, "applied"));
  const responses = cards.filter((c) => reached(c, "interview") || reached(c, "offer"));
  const weekAgo = Date.now() - 7 * DAY;
  const appliedAt = (c) => (c.history || []).find((x) => x.stage === "applied")?.at || (c.stage === "applied" ? c.created_at : null);
  const thisWeek = cards.filter((c) => { const at = appliedAt(c); return at && new Date(at).getTime() >= weekAgo; }).length;
  const rate = applied.length ? Math.round((responses.length / applied.length) * 100) : 0;
  const tile = (label, value, sub) => h("div", { class: "rounded-lg p-3", style: "background:var(--bg);border:1px solid var(--line)" },
    h("span", { class: "mute text-xs" }, label), h("b", { class: "block text-xl" }, value), sub ? h("span", { class: "mute text-xs" }, sub) : null);
  const pct = Math.min(100, Math.round((thisWeek / Math.max(1, goal)) * 100));
  const goalInput = h("input", { type: "number", min: "1", max: "50", value: String(goal), class: "input !w-16 !py-0.5", "aria-label": t("Weekly goal"),
    onChange: (e) => onGoal(Math.max(1, Math.min(50, Number(e.target.value) || 5))) });
  root.replaceChildren(
    h("div", { class: "grid gap-2 grid-cols-2 md:grid-cols-5" },
      tile(t("Applications"), String(cards.length), t("{n} saved, not sent", { n: cards.filter((c) => c.stage === "saved").length })),
      tile(t("Sent"), String(applied.length), t("{n} in the last 7 days", { n: thisWeek })),
      tile(t("Response rate"), applied.length ? `${rate}%` : "–", t("interview or offer / sent")),
      tile(t("Interviews"), String(cards.filter((c) => reached(c, "interview")).length)),
      tile(t("Offers"), String(cards.filter((c) => reached(c, "offer")).length))),
    h("div", { class: "mt-3 text-sm" },
      h("div", { class: "flex flex-wrap items-center gap-2 mb-1" },
        h("span", {}, t("Weekly goal: {n} / ", { n: thisWeek })), goalInput, h("span", { class: "mute" }, t("applications sent in the last 7 days"))),
      h("div", { class: "h-2 rounded-full", style: "background:var(--line)" },
        h("div", { class: "h-2 rounded-full", style: `width:${pct}%;background:${pct >= 100 ? "#18a999" : "var(--accent)"}` }))),
  );
}

/* ---------- details dialog ---------- */
const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso), p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

// opts: { detailsOk, onSave(patch), onRemove(), colorOf }
export function openDetails(c, { detailsOk, onSave, onRemove }) {
  const dlg = $("#appDialog"), form = $("#appForm");
  form.reset();
  const fe = form.elements; // not form.title: that is the form's own title attribute
  fe.stage.replaceChildren(...STAGES.map((s) => h("option", { value: s.id, selected: s.id === c.stage }, s.label)));
  for (const k of ["title", "company", "location", "url", "salary", "contact", "next_action", "notes"]) fe[k].value = c[k] || "";
  fe.follow_up_on.value = c.follow_up_on || "";
  fe.interview_at.value = toLocalInput(c.interview_at);
  $("#appDetailsNote").hidden = detailsOk;
  $("#appTimeline").replaceChildren(...((c.history || []).length ? [
    h("p", { class: "mute text-xs mb-1" }, t("Timeline")),
    h("ol", { class: "text-xs grid gap-0.5" }, [...c.history].reverse().map((x) => h("li", {}, `${fmtDate(x.at)} · ${stageLabel(x.stage)}`)))] : []));

  const icsBtn = $("#appIcs");
  const syncIcs = () => { icsBtn.disabled = !fe.interview_at.value; };
  fe.interview_at.oninput = syncIcs; syncIcs();
  icsBtn.onclick = () => download(`interview-${(fe.company.value || fe.title.value).replace(/\W+/g, "-")}.ics`,
    icsFor({ ...c, title: fe.title.value, company: fe.company.value, url: fe.url.value, contact: fe.contact.value,
      interview_at: new Date(fe.interview_at.value).toISOString() }), "text/calendar");
  $("#appDelete").onclick = () => { if (confirm(t("Delete \"{title}\"?", { title: c.title }))) { dlg.close(); onRemove(); } };
  $("#appCancel").onclick = () => dlg.close();
  form.onsubmit = (e) => {
    e.preventDefault();
    const url = fe.url.value.trim();
    if (url && !safeUrl(url)) { fe.url.setCustomValidity(t("Use a link starting with http:// or https://")); fe.url.reportValidity(); return; }
    fe.url.setCustomValidity("");
    const patch = {
      title: fe.title.value.trim(), company: fe.company.value.trim(), location: fe.location.value.trim(), url,
      salary: fe.salary.value.trim(), contact: fe.contact.value.trim(), next_action: fe.next_action.value.trim(),
      notes: fe.notes.value, follow_up_on: fe.follow_up_on.value,
      interview_at: fe.interview_at.value ? new Date(fe.interview_at.value).toISOString() : "",
    };
    if (fe.stage.value !== c.stage) {
      patch.stage = fe.stage.value;
      patch.history = [...(c.history || []), { stage: fe.stage.value, at: new Date().toISOString() }];
    }
    dlg.close();
    onSave(patch);
  };
  dlg.showModal();
}

/* ---------- calendar file ---------- */
const icsText = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\r?\n/g, "\\n");
const icsDate = (d) => new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
export function icsFor(c) {
  const start = new Date(c.interview_at), end = new Date(start.getTime() + 3600_000);
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//HelloKhedma//Tracker//EN", "BEGIN:VEVENT",
    `UID:${c.id || crypto.randomUUID()}@hellokhedma`, `DTSTAMP:${icsDate(Date.now())}`,
    `DTSTART:${icsDate(start)}`, `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsText(`Interview: ${c.title}${c.company ? ` at ${c.company}` : ""}`)}`,
    `DESCRIPTION:${icsText([c.contact && `Contact: ${c.contact}`, c.url && `Offer: ${c.url}`, "Added from HelloKhedma"].filter(Boolean).join("\n"))}`,
    "BEGIN:VALARM", "TRIGGER:-PT1H", "ACTION:DISPLAY", "DESCRIPTION:Interview in 1 hour", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR", "",
  ].join("\r\n");
}

/* ---------- CSV ---------- */
export const CSV_COLUMNS = ["title", "company", "location", "url", "stage", "salary", "contact", "next_action", "follow_up_on", "interview_at", "notes", "created_at"];
const csvCell = (v) => { const s = String(v ?? ""); return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export const toCsv = (cards) => [CSV_COLUMNS.join(","), ...cards.map((c) => CSV_COLUMNS.map((k) => csvCell(c[k])).join(","))].join("\n");

// Small RFC 4180 parser; accepts "," or ";" (French Excel) as separator.
export function parseCsv(text) {
  const first = text.split(/\r?\n/, 1)[0] || "";
  const sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ";" : ",";
  const rows = []; let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false; else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [header = [], ...body] = rows.filter((r) => r.some((x) => x.trim()));
  const keys = header.map((k) => k.trim().toLowerCase().replace(/\s+/g, "_"));
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}
