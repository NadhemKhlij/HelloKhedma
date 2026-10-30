// Line-art illustrations for the career path cards on Home (one per path id, a generic one otherwise) and the
// progress ring of the Training card. Drawn in ink on the path color, so they read the same in both themes.
import { svg } from "./lib.js";

const INK = "#1f1e1d";
const line = (d) => svg("path", { d, fill: "none", stroke: INK, "stroke-width": 2.2, "stroke-linecap": "round", "stroke-linejoin": "round" });
const dot = (cx, cy, r = 3.2, fill = INK) => svg("circle", { cx, cy, r, fill });
const ring = (cx, cy, r = 3.6) => svg("circle", { cx, cy, r, fill: "#fff", stroke: INK, "stroke-width": 2 });

const DRAW = {
  // Data Engineer: a database feeding a pipeline
  de: () => [
    line("M22 20c0-4 9-6 16-6s16 2 16 6-9 6-16 6-16-2-16-6z"), line("M22 20v22c0 4 9 6 16 6s16-2 16-6V20"),
    line("M22 31c0 4 9 6 16 6s16-2 16-6"), line("M54 34h8c4 0 6 2 6 6v6"), line("M64 42l4 5 4-5"),
    dot(68, 54), ring(14, 30), line("M17.6 30h4.4")],
  // Business Analyst: a small process flow with a decision
  ba: () => [
    line("M12 16h18v12H12z"), line("M30 22h10"), line("M48 12l10 10-10 10-10-10z"), line("M58 22h8"),
    line("M48 32v10"), line("M38 42h20v12H38z"), ring(70, 22), dot(21, 22, 2.6), dot(48, 22, 2.6)],
  // Application Support: a heartbeat on a monitor
  as: () => [
    line("M12 14h56v34H12z"), line("M18 32h10l5-10 7 20 6-14 4 4h12"), line("M32 56h16"), line("M40 48v8"),
    ring(64, 14), dot(18, 32, 2.6)],
  // Data Analyst: bars and a trend line
  da: () => [
    line("M12 56h58"), line("M18 56V40"), line("M30 56V32"), line("M42 56V36"), line("M54 56V24"),
    line("M16 30l14-10 12 6 18-14"), ring(16, 30), ring(30, 20), ring(42, 26), dot(60, 12)],
  // DevOps: the build → deploy loop
  do: () => [
    line("M14 34c0-7 5-12 11-12 9 0 21 24 30 24 6 0 11-5 11-12s-5-12-11-12c-9 0-21 24-30 24-6 0-11-5-11-12z"),
    line("M50 18l5 4-5 4"), line("M30 42l-5 4 5 4"), ring(25, 22), dot(55, 46), ring(66, 34, 3), dot(14, 34, 2.6)],
};
const GENERIC = () => [line("M40 14v40M20 24l40 20M60 24L20 44"), ring(40, 14), ring(20, 24), dot(60, 44), ring(40, 54), dot(60, 24), ring(20, 44)];

export const pathArt = (id) => svg("svg", { viewBox: "0 0 80 68", width: 88, height: 75, "aria-hidden": "true" }, (DRAW[id] || GENERIC)());

// Circular progress (0..1), like a usage meter.
export function progressRing(value, size = 64) {
  const r = (size - 8) / 2, c = 2 * Math.PI * r, v = Math.max(0, Math.min(1, value || 0));
  return svg("svg", { width: size, height: size, viewBox: `0 0 ${size} ${size}`, "aria-hidden": "true", class: "shrink-0" },
    svg("circle", { cx: size / 2, cy: size / 2, r, fill: "none", stroke: "var(--line)", "stroke-width": 6 }),
    svg("circle", { cx: size / 2, cy: size / 2, r, fill: "none", stroke: "var(--accent)", "stroke-width": 6, "stroke-linecap": "round",
      "stroke-dasharray": `${c * v} ${c}`, transform: `rotate(-90 ${size / 2} ${size / 2})`, style: "transition:stroke-dasharray .6s ease" }));
}
