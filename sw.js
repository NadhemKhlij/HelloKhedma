// HelloKhedma service worker: makes the app installable and usable offline.
// - App files (same origin): network first, revalidated with the server (not the browser's 10-minute HTTP cache),
//   cache as fallback, so a deploy shows up at once when online and never mixes old and new files.
// - Public Supabase content (paths, resources, tracks): network first, cached for offline use.
// - Google Fonts: cache first.
// - Everything else (sign-in, account data, job searches, Edge Functions): not touched, never cached.
// Bump VERSION to drop old caches after a big change.
// New JS files: add them to SHELL. New top-level files (like this one): add them to the "Assemble site" step of
// .github/workflows/deploy.yml, or they are not published.
const VERSION = "hk-v16";
const SHELL = [
  "./", "index.html", "css/app.css", "manifest.json", "icons/icon-192.png",
  "js/app.js", "js/lib.js", "js/supabase.js", "js/config.js", "js/store.js", "js/jobs.js", "js/tracker.js", "js/ats.js",
  "js/auth.js", "js/courses.js", "js/interview.js", "js/companies.js", "js/remote.js", "js/i18n.js", "js/i18n-fr.js", "js/cvs.js",
  "js/state.js", "js/router.js", "js/home.js", "js/training.js", "js/offers.js", "js/cvpage.js", "js/applications.js", "js/account.js", "js/salary.js", "js/tailor.js", "js/letters.js", "js/offercheck.js", "js/pulse.js", "js/projects.js", "js/coursetime.js", "js/icons.js", "js/activity.js", "js/practice.js",
  "content/courses/index.json", "content/interview/common.json", "content/courses/fr/index.json", "content/interview/fr/common.json",
];
const PUBLIC_CONTENT = /\/rest\/v1\/(career_paths|path_resources|training_tracks)\b/;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) =>
    Promise.all(SHELL.map((url) => c.add(url).catch(() => { /* a missing file must not block install */ })))));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// revalidate: ask the server whether the file changed (a tiny 304 when not) instead of trusting the browser's HTTP
// cache (GitHub Pages: 10 minutes), so a deploy never mixes old and new app files.
async function networkFirst(req, revalidate = false) {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(revalidate ? new Request(req.url, { cache: "no-cache", credentials: "same-origin" }) : req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: req.mode === "navigate" });
    if (hit) return hit;
    if (req.mode === "navigate") return (await cache.match("index.html")) || Response.error();
    throw err;
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === "opaque") cache.put(req, res.clone());
  return res;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) e.respondWith(networkFirst(req, true));
  else if (PUBLIC_CONTENT.test(url.pathname)) e.respondWith(networkFirst(req));
  else if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) e.respondWith(cacheFirst(req));
});
