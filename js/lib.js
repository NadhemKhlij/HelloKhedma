// Tiny DOM helpers and the localStorage wrapper (ls, with onStore() change watchers). Always build DOM with h()
// (textContent) rather than innerHTML.
export const $ = (sel, root = document) => root.querySelector(sel);

export function h(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k === "class") n.className = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) n.setAttribute(k, "");
    else if (v !== false && v != null) n.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return n;
}

export const safeUrl = (u) => {
  try {
    const x = new URL(u);
    return x.protocol === "http:" || x.protocol === "https:" ? x.href : null;
  } catch { return null; }
};

export const safeColor = (c) => (/^#[0-9a-f]{6}$/i.test(c || "") ? c : "#7c5cff");

// Accessibility (WCAG AA, 4.5:1 for normal text): the path colour mixed with black (light theme) or white (dark theme),
// as little as needed, so text in that colour stays readable on every surface of the theme. inkFor(hex, "light" | "dark"
// | "fill"): "fill" is a background that white text can sit on. Used for --accent-ink / --accent-fill (app.js).
const rgb = (hx) => [1, 3, 5].map((i) => parseInt(hx.slice(i, i + 2), 16));
const lum = (c) => { const l = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2]; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const SURFACES = { light: ["#ffffff", "#faf9f5", "#f0eee6"], dark: ["#262624", "#1f1e1d", "#33322f"], fill: ["#ffffff"] };
export function inkFor(hex, mode) {
  const c = rgb(safeColor(hex)), toward = mode === "dark" ? [255, 255, 255] : [0, 0, 0];
  for (let p = 100; p >= 10; p--) {
    const m = c.map((v, i) => v * (p / 100) + toward[i] * (1 - p / 100));
    if (SURFACES[mode].every((bg) => ratio(m, rgb(bg)) >= 4.6)) return `#${m.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
  }
  return mode === "dark" ? "#ffffff" : "#000000";
}

// Preview builds are served under preview/<branch>/ next to the live site (same origin, see deploy.yml). They keep
// their own browser data, stored as "preview:hk.…", so testing never touches the live site's data. Theme and language
// stay shared (index.html reads them before the app loads).
export const PREVIEW = (location.pathname.match(/\/preview\/([^/]+)\//) || [])[1] || null;
const NS = PREVIEW ? "preview:" : "", SHARED = new Set(["hk.theme", "hk.lang"]);
const key = (k) => (NS && !SHARED.has(k) ? NS + k : k);

// onStore(fn): fn(key) runs after every ls.set / ls.del (learnsync.js uses it to sync learning progress).
const storeWatchers = new Set();
export const onStore = (fn) => storeWatchers.add(fn);
const changed = (k) => storeWatchers.forEach((fn) => { try { fn(k); } catch { /* a watcher never breaks a save */ } });
export const ls = {
  get(k) { try { return localStorage.getItem(key(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(key(k), v); } catch { /* storage unavailable */ } changed(k); },
  del(k) { try { localStorage.removeItem(key(k)); } catch { /* ignore */ } changed(k); },
  // App keys ("hk.…") of this build, without the preview prefix (export and delete on the Account page).
  keys() { try { return Object.keys(localStorage).filter((k) => k.startsWith(`${NS}hk.`)).map((k) => k.slice(NS.length)); } catch { return []; } },
};

// Offer a text file (JSON, CSV, .ics) to the user as a download.
export function download(filename, text, type = "text/plain") {
  const a = h("a", { href: URL.createObjectURL(new Blob([text], { type })), download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

let toastTimer;
export function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
}

// Copy a text to the clipboard (selecting `area` as a fallback where the clipboard API is refused), then a toast.
export async function copyText(text, area, message) {
  try { await navigator.clipboard.writeText(text); } catch {
    const fold = area?.closest("details"); if (fold) fold.open = true; // a folded text must be visible to be selected
    area?.select(); document.execCommand("copy");
  }
  toast(message);
}

// SVG version of h() (icons, progress ring): attributes only, children are SVG nodes.
export function svg(tag, attrs = {}, ...kids) {
  const n = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  n.append(...kids.flat().filter(Boolean));
  return n;
}
