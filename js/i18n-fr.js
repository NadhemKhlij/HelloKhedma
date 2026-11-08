// French translations, keyed by the English text exactly as written in the code or in index.html (whitespace
// collapsed). See js/i18n.js. A missing key shows in English, so add the French when you add a text.
// Keep "{placeholders}" unchanged. "stage|…" keys are tracker column names.
// The texts are split by area in js/fr/ (2026-11-08) so that sessions working on different pages do not edit the
// same file: add a text to the file of the page it belongs to (a new area may get its own file, imported below).
// A key must exist in one file only: scripts/check-i18n.pl reports a key found twice.
import shell from "./fr/shell.js";
import offers from "./fr/offers.js";
import learning from "./fr/learning.js";
import exercises from "./fr/exercises.js";
import cv from "./fr/cv.js";
import tracker from "./fr/tracker.js";
import interview from "./fr/interview.js";

export default { ...shell, ...offers, ...learning, ...exercises, ...cv, ...tracker, ...interview };
