// Web Worker for the regex exercises (regexrun.js): runs the learner's pattern on the sample text away from the page,
// so a pattern that backtracks forever is stopped by a timeout instead of freezing the app. Module worker.
import { regexRun } from "./drillcheck.js";
self.onmessage = (e) => {
  const { id, source, flags, text, mode } = e.data || {};
  try { self.postMessage({ id, result: regexRun(source, flags, text, mode) }); }
  catch (err) { self.postMessage({ id, error: err.message || String(err) }); }
};
