// Interface language (French / English). English is the source language: the code and index.html are written
// in English and js/i18n-fr.js maps each English text to its French translation.
// - lang: saved choice ("hk.lang"), otherwise the browser language (fr → French, anything else → English).
// - t(text, vars): translated text, "{name}" placeholders filled from vars. A key may carry a context prefix
//   ("stage|Interview") when one English word needs two French translations; English shows the part after "|".
//   A text missing from the dictionary shows in English, so a forgotten key never breaks the page.
// - tn(n, one, many, vars): plural (French: 0 and 1 are singular). {n} is filled automatically.
// - Static HTML is translated once at load (text nodes + placeholder / aria-label / title), before the page modules render.
//   Elements with data-lang="en" / "fr" are shown only in that language (legal notice, privacy policy) and skipped.
// - Switching language reloads the page (setLang), so every module renders again in the new language.
// Course, interview and career-path content (content/, supabase/seed.sql) is English only for now.
import { ls } from "./lib.js";
import FR from "./i18n-fr.js";

const LANG_KEY = "hk.lang";
const detect = () => {
  const saved = ls.get(LANG_KEY);
  if (saved === "fr" || saved === "en") return saved;
  return /^fr\b/i.test(navigator.language || "") ? "fr" : "en";
};

export const lang = detect();
export const LOCALE = lang === "fr" ? "fr-FR" : "en-GB";

export function t(key, vars) {
  let s = lang === "fr" && FR[key] != null ? FR[key] : key.slice(key.indexOf("|") + 1);
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  return s;
}
export const tn = (n, one, many, vars) => t((lang === "fr" ? n <= 1 : n === 1) ? one : many, { n, ...vars });

export function setLang(next) {
  ls.set(LANG_KEY, next);
  location.reload();
}

const norm = (s) => s.replace(/\s+/g, " ").trim();
const ATTRS = ["placeholder", "aria-label", "title"];
const SKIP = new Set(["SCRIPT", "STYLE", "CODE", "PRE", "TEXTAREA"]);

// Translates the static page once. Remote data is never in the page at this point (the page modules render it later).
function translateStatic(root) {
  root.querySelectorAll("[data-lang]").forEach((el) => { el.hidden = el.dataset.lang !== lang; });
  if (lang === "en") return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: (n) => (n.nodeType === 1
      ? (SKIP.has(n.tagName) || n.hasAttribute("data-lang") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP)
      : NodeFilter.FILTER_ACCEPT),
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const key = norm(n.nodeValue);
    if (key && FR[key] != null) n.nodeValue = n.nodeValue.replace(/^(\s*)[\s\S]*?(\s*)$/, `$1${FR[key]}$2`);
  }
  root.querySelectorAll(ATTRS.map((a) => `[${a}]`).join(",")).forEach((el) => {
    for (const a of ATTRS) {
      const key = el.hasAttribute(a) && norm(el.getAttribute(a));
      if (key && FR[key] != null) el.setAttribute(a, FR[key]);
    }
  });
}

document.documentElement.lang = lang;
translateStatic(document.body);
document.documentElement.style.visibility = ""; // hidden by the inline script in index.html while French loads
