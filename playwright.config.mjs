// Smoke tests (tests/smoke.spec.mjs) run by .github/workflows/deploy.yml on the assembled site (_site) before it is
// published. Locally: `npm run build`, copy the site files into _site (see the "Assemble site" step), then `npm test`.
// The site is served by Python's static server, as GitHub Pages would serve it. The service worker is blocked so a
// cached copy never hides a broken file. Results show as annotations on the GitHub run (github reporter).
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0, // one retry for network hiccups (Supabase, CDNs); a real break fails twice
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: "http://localhost:4173",
    locale: "en-GB",
    serviceWorkers: "block",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "python3 -m http.server 4173 --directory _site",
    url: "http://localhost:4173/index.html",
    reuseExistingServer: !process.env.CI,
  },
});
