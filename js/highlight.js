// Syntax colours for the code of the course pages (lesson examples, exercise answers: courses.js codeBlock) and code
// words in lesson text (courses.js). No DOM at import time, so scripts/check-content.mjs can import it:
// - tokens(code, lang) -> [[class | null, text]]: pure; joined back, the pieces are always exactly the code (CI checks it
//   on every lesson example and code answer). Classes: kw (keyword), fn (function, command), str (string), num (number,
//   flag, duration), com (comment), key (YAML / JSON / HCL / INI key, [column], variable), id (other identifier, plain).
// - highlight(code, lang) -> nodes: <span class="tok-…"> with textContent (never innerHTML). Colours: .tok-* in
//   css/input.css, WCAG AA on --code in both themes.
// - codeWords(course) + inlineCode(text, words): in lesson text, words that are keywords, functions or identifiers of the
//   course's own code (SELECT, GROUP BY, CALCULATE, read_csv, df.groupby()…) are shown as inline code. Only "code-looking"
//   words (ALL CAPS, snake_case, dotted, camelCase, name()), so plain English or French words never change.
// Languages: the "lang" / "code" values of the course content: sql, python, bash, yaml, json, js, dax, excel, m (Power
// Query), hcl, dockerfile, promql, toml, ini, html, gherkin, markdown, diff. Anything else ("text") stays plain.
const ALIAS = { sh: "bash", shell: "bash", py: "python", javascript: "js", ts: "js", yml: "yaml", terraform: "hcl", powerquery: "m", jq: "json" };
const set = (s) => new Set(s.split(" "));
const DQ = String.raw`"(?:[^"\\\n]|\\.)*"`, SQ = String.raw`'(?:[^'\\\n]|\\.)*'`, BQ = String.raw`\x60(?:[^\x60\\]|\\.)*\x60`;
const NUM = String.raw`\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b`;
const ID = "[A-Za-z_][A-Za-z0-9_]*", DOTTED = "[A-Za-z_][A-Za-z0-9_]*(?:\\.[A-Za-z_][A-Za-z0-9_]*)*";
const C_BLOCK = String.raw`/\*[\s\S]*?\*/`;

// Each language: ordered rules [class, regex source without capturing groups]; "id" words are looked up in kw (ci: case
// insensitive) and become "fn" when "(" follows (fn: false turns that off); "cmd" (first word of a shell line) is kw or fn.
const L = {
  sql: { ci: true, rules: [["com", "--[^\\n]*"], ["com", C_BLOCK], ["str", SQ], ["str", DQ], ["num", NUM], ["id", ID]],
    kw: set("select from where and or not in is null as on join left right inner outer full cross natural group by order having limit offset with recursive union intersect except all distinct case when then else end insert into values update set delete create replace table view index unique drop alter add primary foreign references begin commit rollback transaction over partition rows range between unbounded preceding following current row asc desc exists like ilike merge using matched returning conflict do nothing qualify lateral true false default if temporary materialized grant revoke to cast interval filter within top explain analyze") },
  python: { rules: [["com", "#[^\\n]*"], ["str", `[rRbBfFuU]{0,2}(?:"""[\\s\\S]*?"""|'''[\\s\\S]*?''')`], ["str", `[rRbBfFuU]{0,2}(?:${DQ}|${SQ})`],
    ["fn", "@[A-Za-z_][\\w.]*"], ["num", NUM], ["id", ID]],
    kw: set("def return if elif else for while in not and or is None True False import from as class with try except finally raise yield lambda pass break continue global nonlocal async await assert del") },
  js: { rules: [["com", "//[^\\n]*"], ["com", C_BLOCK], ["str", DQ], ["str", SQ], ["str", BQ], ["num", NUM], ["id", ID]],
    kw: set("const let var function return if else for while of in new class import from export default async await try catch finally throw true false null undefined typeof instanceof this") },
  bash: { rules: [["com", "(?:^|[ \\t])#[^\\n]*"], ["str", DQ], ["str", SQ], ["key", "\\$\\{[^}\\n]*\\}|\\$[A-Za-z_]\\w*|\\$[0-9#?@*]"],
    ["cmd", "^[ \\t]*(?:\\$ )?[A-Za-z_][\\w.\\-]*"], ["num", "[ \\t]--?[A-Za-z][\\w\\-]*"], ["num", NUM], ["id", ID]],
    kw: set("if then else elif fi for in do done while until case esac function return export local set unset source exit sudo"), fn: false },
  yaml: { rules: [["com", "(?:^|[ \\t])#[^\\n]*"], ["key", "^[ \\t]*(?:- )?[\\w.\\-/]+(?=:(?:[ \\t]|$))"], ["fn", "\\$\\{\\{[^}\\n]*\\}\\}"],
    ["str", DQ], ["str", SQ], ["kw", "\\b(?:true|false|null|yes|no)\\b"], ["num", NUM]] },
  json: { rules: [["key", `${DQ}(?=\\s*:)`], ["str", DQ], ["kw", "\\b(?:true|false|null)\\b"], ["num", "-?" + NUM]] },
  dax: { ci: true, rules: [["com", "--[^\\n]*|//[^\\n]*"], ["com", C_BLOCK], ["str", DQ], ["str", SQ], ["key", "\\[[^\\]\\n]*\\]"], ["num", NUM], ["id", DOTTED]],
    kw: set("var return evaluate define measure column table order by asc desc start at true false in not and or") },
  excel: { rules: [["str", DQ], ["key", "\\$?[A-Z]{1,3}\\$?\\d+(?::\\$?[A-Z]{1,3}\\$?\\d+)?\\b"], ["key", "\\[@?[^\\]\\n]*\\]"], ["num", NUM], ["id", DOTTED]],
    kw: set("TRUE FALSE") },
  m: { rules: [["com", "//[^\\n]*"], ["com", C_BLOCK], ["key", `#${DQ}`], ["str", DQ], ["key", "\\[[^\\]\\n]*\\]"], ["num", NUM], ["id", DOTTED]],
    kw: set("let in each if then else true false null type and or not try otherwise meta as is") },
  hcl: { rules: [["com", "#[^\\n]*|//[^\\n]*"], ["com", C_BLOCK], ["kw", "^[ \\t]*(?:resource|data|variable|output|module|provider|locals|terraform|backend|required_providers|dynamic|lifecycle|moved|import)\\b"],
    ["key", "^[ \\t]*[A-Za-z_][\\w\\-]*(?=[ \\t]*=(?!=))"], ["str", DQ], ["num", NUM], ["id", ID]],
    kw: set("true false null for in if each var local module data count for_each self") },
  dockerfile: { rules: [["com", "^[ \\t]*#[^\\n]*"], ["kw", "^[ \\t]*(?:FROM|RUN|COPY|ADD|CMD|ENTRYPOINT|ENV|ARG|WORKDIR|EXPOSE|USER|LABEL|HEALTHCHECK|VOLUME|SHELL|ONBUILD|STOPSIGNAL)\\b|\\bAS\\b"],
    ["num", "[ \\t]--?[A-Za-z][\\w\\-]*"], ["key", "\\$\\{[^}\\n]*\\}|\\$[A-Za-z_]\\w*"], ["str", DQ], ["str", SQ]] },
  promql: { rules: [["com", "#[^\\n]*"], ["key", "[A-Za-z_]\\w*(?=[ \\t]*(?:=~|!~|!=|=)[ \\t]*\")"], ["str", DQ], ["num", "\\[\\d+[smhdwy]\\]"], ["num", NUM], ["id", ID]],
    kw: set("by without on ignoring group_left group_right offset bool and or unless") },
  toml: { rules: [["com", "(?:^|[ \\t])#[^\\n]*"], ["kw", "^[ \\t]*\\[[^\\]\\n]+\\]"], ["key", "^[ \\t]*[\\w.\\-]+(?=[ \\t]*=)"], ["str", DQ], ["str", SQ],
    ["kw", "\\b(?:true|false)\\b"], ["num", NUM]] },
  ini: { rules: [["com", "^[ \\t]*[#;][^\\n]*"], ["kw", "^[ \\t]*\\[[^\\]\\n]+\\]"], ["key", "^[ \\t]*[\\w.\\-]+(?=[ \\t]*=)"], ["str", DQ]] },
  html: { rules: [["com", "<!--[\\s\\S]*?-->"], ["kw", "</?[A-Za-z][\\w\\-]*|/?>"], ["key", "[A-Za-z_:][\\w:.\\-]*(?==)"], ["str", DQ], ["str", SQ]] },
  gherkin: { rules: [["com", "^[ \\t]*#[^\\n]*"], ["kw", "^[ \\t]*(?:Feature|Story|Scenario Outline|Scenario|Background|Examples|Rule|Given|When|Then|And|But)\\b:?"],
    ["str", DQ], ["key", "<[\\w ]+>"]] },
  markdown: { rules: [["kw", "^#{1,6} [^\\n]*"], ["str", "\\x60[^\\x60\\n]+\\x60"], ["key", "\\*\\*[^*\\n]+\\*\\*"], ["num", "^[ \\t]*(?:[-*+]|\\d+\\.)(?= )"]] },
  diff: { rules: [["com", "^(?:diff|index|---|\\+\\+\\+)[^\\n]*"], ["fn", "^@@[^\\n]*"], ["str", "^\\+[^\\n]*"], ["key", "^-[^\\n]*"]] },
};
for (const x of Object.values(L)) x.re = new RegExp(x.rules.map(([, s]) => `(${s})`).join("|"), "gm");

export function tokens(code, lang) {
  code = String(code ?? "");
  const x = L[ALIAS[lang] || lang];
  if (!x) return code ? [[null, code]] : [];
  const out = [], push = (cls, s) => {
    if (!s) return;
    const prev = out[out.length - 1];
    if (prev && prev[0] === cls && (cls === null || cls === "id")) prev[1] += s; else out.push([cls, s]);
  };
  const re = new RegExp(x.re);
  let last = 0, m;
  while ((m = re.exec(code))) {
    if (!m[0]) { re.lastIndex++; continue; }
    let cls = x.rules[m.findIndex((g, i) => i > 0 && g !== undefined) - 1][0];
    if (cls === "id" || cls === "cmd") {
      const w = m[0].trim().replace(/^\$ /, "");
      cls = x.kw?.has(x.ci ? w.toLowerCase() : w) ? "kw"
        : cls === "cmd" || (x.fn !== false && /^[ \t]*\(/.test(code.slice(re.lastIndex))) ? "fn" : "id";
    }
    push(null, code.slice(last, m.index));
    push(cls, m[0]);
    last = re.lastIndex;
  }
  push(null, code.slice(last));
  return out;
}

export function highlight(code, lang) {
  return tokens(code, lang).map(([cls, s]) => {
    if (!cls || cls === "id") return document.createTextNode(s);
    const e = document.createElement("span");
    e.className = `tok-${cls}`;
    e.textContent = s;
    return e;
  });
}

/* ---------- code words in lesson text ---------- */
const WORD = /[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*(?:\(\))?/g;
const looksLikeCode = (w) => /\(\)$/.test(w) || /[_.]/.test(w) || /^[A-Z][A-Z0-9]+$/.test(w) || /^[a-z]+[A-Z]\w*$/.test(w);

// Keywords, functions and identifiers of the course's lesson examples and code answers (comments and strings excluded).
const wordCache = new WeakMap();
export function codeWords(course) {
  if (wordCache.has(course)) return wordCache.get(course);
  const words = new Set();
  const add = (code, lang) => { for (const [cls, s] of tokens(code, lang)) if (cls === "kw" || cls === "fn" || cls === "id") words.add(s.trim()); };
  for (const l of course.lessons || []) if (l.example?.code) add(l.example.code, l.example.lang);
  for (const e of course.exercises || []) if (e.code && typeof e.answer === "string") add(e.answer, e.code);
  wordCache.set(course, words);
  return words;
}

// Text -> nodes, with the course's code words in <code class="inline-code"> (neighbours joined: "GROUP BY").
export function inlineCode(text, words) {
  text = String(text ?? "");
  if (!words?.size) return [text];
  const hits = [];
  for (const m of text.matchAll(WORD)) {
    const w = m[0], bare = w.replace(/\(\)$/, ""), last = bare.split(".").pop();
    if (!looksLikeCode(w) || !(words.has(bare) || (bare.includes(".") && last.length > 1 && words.has(last)))) continue;
    const prev = hits[hits.length - 1];
    if (prev && text.slice(prev.end, m.index) === " ") prev.end = m.index + w.length;
    else hits.push({ start: m.index, end: m.index + w.length });
  }
  if (!hits.length) return [text];
  const out = [];
  let at = 0;
  for (const { start, end } of hits) {
    if (start > at) out.push(text.slice(at, start));
    const c = document.createElement("code");
    c.className = "inline-code";
    c.textContent = text.slice(start, end);
    out.push(c);
    at = end;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
}
