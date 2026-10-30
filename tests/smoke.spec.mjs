// Smoke tests: the built site starts, every page renders, and the main guest flows work (tracker, CV, letters,
// offer checks, courses, FR/EN). Run before each deploy (see playwright.config.mjs). They use the live Supabase
// project for public content (paths, tracks) like a real visitor, but never sign in and never run a job search:
// offers are injected into the page state instead. Each test starts with an empty browser (guest, no localStorage).
import { test, expect } from "@playwright/test";

// Uncaught errors fail the test. Console errors too, except failed network loads (a third-party hiccup is not a bug).
let errors = [];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|net::ERR_/.test(m.text())) errors.push(`console: ${m.text()}`); });
});
test.afterEach(async () => {
  expect(errors, "errors in the page").toEqual([]);
});

// Opens a route and waits until the career paths came from Supabase (the app is fully started).
async function open(page, hash = "#/") {
  await page.goto(`/index.html${hash}`);
  await expect(page.locator("#paths button").first()).toBeVisible({ timeout: 15_000 });
}

test("home shows the career paths and a path can be selected", async ({ page }) => {
  await open(page);
  await expect(page.locator("#h-home")).toHaveText(/Good (morning|afternoon|evening)/);
  const paths = page.locator("#paths button");
  expect(await paths.count()).toBeGreaterThanOrEqual(4);
  await paths.nth(1).click();
  await expect(paths.nth(1)).toHaveAttribute("aria-pressed", "true");
});

for (const route of ["offers", "training", "cv", "interview", "applications", "account", "legal", "privacy"]) {
  test(`page #/${route} renders`, async ({ page }) => {
    await open(page, `#/${route}`);
    const section = page.locator(`section[data-page="${route}"]`);
    await expect(section).toBeVisible();
    await expect(section.locator("h1").first()).not.toBeEmpty();
  });
}

test("tracker: a guest application survives a reload and gets a follow-up email", async ({ page }) => {
  await open(page, "#/applications");
  await page.fill("#cTitle", "Smoke Test Engineer");
  await page.fill("#cCo", "Acme");
  await page.click("#addForm button[type=submit]");
  const card = page.locator("#board div[draggable]").filter({ hasText: "Smoke Test Engineer" });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Move forward" }).click(); // Saved → Applied
  await page.reload();
  await expect(page.locator("#paths button").first()).toBeAttached({ timeout: 15_000 });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "✉ Email" }).click();
  await expect(page.locator("#letterDialog")).toBeVisible();
  await expect(page.locator("#letterBody textarea")).toHaveValue(/Smoke Test Engineer position at Acme/);
});

test("CV: skills are extracted, matched with an offer, and the cover letter prompt contains the CV", async ({ page }) => {
  await open(page, "#/cv");
  await page.fill("#cv", "Data Engineer\nBuilt Python and SQL pipelines on Airflow\nDocker and Git every day");
  await page.click("#cvSave");
  await expect(page.locator("#cvSkills")).toContainText("Python");
  await page.fill("#jd", "Data Engineer: Python, SQL, Spark and AWS. 3 years of experience.");
  await page.click("#atsBtn");
  await expect(page.locator("#atsOut")).toContainText("Spark");
  await page.locator("#atsOut").getByRole("button", { name: "✉ Cover letter" }).click();
  await expect(page.locator("#letterBody textarea")).toHaveValue(/Built Python and SQL pipelines on Airflow/);
  await page.locator("#letterBody").getByRole("button", { name: "Close" }).click();
  await page.locator("#atsOut").getByRole("button", { name: /Tailor my CV/ }).click();
  await expect(page.locator("#tailorDialog")).toBeVisible();
});

test("offers: age, level and trust warnings, and their filters", async ({ page }) => {
  await open(page, "#/offers");
  // No job search in tests: put two offers in the page state, as a search would.
  await page.evaluate(async () => {
    const { state } = await import("/js/state.js");
    const { renderOffers } = await import("/js/offers.js");
    const day = (n) => new Date(Date.now() - n * 86_400_000).toISOString();
    state.jobs = [
      { id: "ok", source: "jsearch", title: "Senior Data Engineer", company: "Acme", url: "https://example.com/1", posted: day(2),
        snippet: "", text: "Python, SQL and Airflow. Apply at jobs@acme.com" },
      { id: "scam", source: "jsearch", title: "Data Engineer", company: "", url: "https://example.com/2", posted: day(1),
        snippet: "", text: "Earn up to $500 a day. Contact us on WhatsApp. Registration fee for training." },
    ];
    renderOffers();
  });
  const cards = page.locator("#results > li");
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0)).toContainText("Posted 2 days ago");
  await expect(cards.nth(0)).toContainText("Senior");
  await expect(cards.nth(0).locator("details")).toHaveCount(0);
  await expect(cards.nth(1).locator("summary")).toHaveText("⚠ Check this offer");
  await page.check("#fTrust");
  await expect(cards).toHaveCount(1);
  await page.uncheck("#fTrust");
  await page.selectOption("#fLevel", "Junior"); // the senior offer goes, the one with no level stays
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText("Data Engineer");
});

test("a course opens with its tabs and the quiz", async ({ page }) => {
  await open(page, "#/course/sql");
  const tabs = page.locator('section[data-page="course"] [role=tablist] [role=tab]');
  await expect(tabs.first()).toBeVisible();
  await tabs.filter({ hasText: "Quiz" }).click();
  await expect(page.locator('section[data-page="course"] [role=tabpanel]')).not.toBeEmpty();
});

test("French interface and back to English", async ({ page }) => {
  await open(page);
  await page.click("#langToggle");
  await expect(page.locator('#nav a[data-route="home"]')).toContainText("Accueil", { timeout: 15_000 });
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await page.click("#langToggle");
  await expect(page.locator('#nav a[data-route="home"]')).toContainText("Home", { timeout: 15_000 });
});

test("phone width: no page scrolls sideways", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const route of ["", "offers", "training", "cv", "interview", "applications"]) {
    await open(page, `#/${route}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `#/${route} is wider than the screen`).toBeLessThanOrEqual(0);
  }
});
