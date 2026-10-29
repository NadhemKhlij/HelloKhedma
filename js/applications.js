// Applications page (#/applications): connects the tracker UI (tracker.js) to the store (state.store, store.js).
// refreshTracker() reloads the cards and redraws everything that shows them: board, stats, Home, the "Tracked"
// markers on Offers and the upcoming interviews. Also the "Add application" form and CSV export / import.
// New applications record the active CV version as "CV sent" (cvUsed, cvpage.js).
import { $, safeUrl, ls, toast, download } from "./lib.js";
import { t, tn } from "./i18n.js";
import { state, fail } from "./state.js";
import { STAGES } from "./store.js";
import { renderBoard, renderStats, openDetails, toCsv, parseCsv } from "./tracker.js";
import { loadCvs } from "./cvs.js";
import { renderHome } from "./home.js";
import { renderOffers } from "./offers.js";
import { cvUsed } from "./cvpage.js";
import { refreshInterview } from "./router.js";

const GOAL_KEY = "hk.weeklyGoal";
const weeklyGoal = () => Number(ls.get(GOAL_KEY)) || 5;

export async function refreshTracker() {
  try { state.cards = await state.store.list(); } catch (e) { fail(e); state.cards = []; }
  const [detailsOk, cvOk] = await Promise.all([state.store.detailsSupported(), state.store.cvSupported()]);
  $("#detailsNotice").hidden = detailsOk;
  // Run a store action, then redraw everything that depends on the cards.
  const act = (fn) => async (...args) => { try { await fn(...args); await refreshTracker(); } catch (e) { fail(e); } };
  renderBoard($("#board"), state.cards, {
    colorOf: (id) => state.paths.find((p) => p.id === id)?.color,
    onMove: act((id, stage) => state.store.move(id, stage)),
    onOpen: (c) => openDetails(c, {
      detailsOk, cvOk, cvNames: loadCvs().map((v) => v.name),
      onSave: act((patch) => state.store.update(c.id, patch)),
      onRemove: act(() => state.store.remove(c.id)),
    }),
  });
  const drawStats = () => renderStats($("#appStats"), state.cards, weeklyGoal(), (g) => { ls.set(GOAL_KEY, String(g)); drawStats(); });
  drawStats();
  renderHome();
  if (state.jobs.length) renderOffers(); // refresh the "Tracked" markers
  refreshInterview();
}

function onCsvExport() {
  if (!state.cards.length) { toast(t("No applications to export yet.")); return; }
  // The BOM makes Excel open accents correctly.
  download(`hellokhedma-applications-${new Date().toISOString().slice(0, 10)}.csv`, `﻿${toCsv(state.cards)}`, "text/csv");
}

async function onCsvImport(e) {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return;
  const isoOrUndef = (v) => { const d = new Date(v); return v && !Number.isNaN(d.getTime()) ? d.toISOString() : undefined; };
  try {
    const rows = parseCsv(await file.text()).filter((r) => r.title);
    if (!rows.length) { toast(t("No rows found. The file needs a 'title' column (see Export CSV for the format).")); return; }
    for (const r of rows) {
      await state.store.add({
        ...r, path_id: state.pathId,
        stage: STAGES.some((s) => s.id === r.stage) ? r.stage : "saved",
        url: safeUrl(r.url) || undefined,
        follow_up_on: /^\d{4}-\d{2}-\d{2}$/.test(r.follow_up_on || "") ? r.follow_up_on : undefined,
        interview_at: isoOrUndef(r.interview_at),
      });
    }
    toast(tn(rows.length, "Imported {n} application.", "Imported {n} applications."));
    await refreshTracker();
  } catch (err) { fail(err); }
}

async function onAdd(e) {
  e.preventDefault();
  const url = $("#cUrl").value.trim();
  if (url && !safeUrl(url)) { toast(t("The offer link must start with http:// or https://")); return; }
  try {
    await state.store.add({ path_id: state.pathId, title: $("#cTitle").value.trim(), company: $("#cCo").value.trim(), url: url || undefined, stage: "saved", cv_version: cvUsed() });
    e.target.reset();
    await refreshTracker();
  } catch (err) { fail(err); }
}

export function initApplications() {
  $("#csvExport").addEventListener("click", onCsvExport);
  $("#csvImport").addEventListener("change", onCsvImport);
  $("#addForm").addEventListener("submit", onAdd);
}
