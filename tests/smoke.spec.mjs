// Smoke tests: the built site starts, every page renders, and the main guest flows work (tracker, CV, letters,
// offer checks, courses, FR/EN). Run before each deploy (see playwright.config.mjs). They use the live Supabase
// project for public content (paths, tracks) like a real visitor, but never sign in and never run a job search:
// offers are injected into the page state instead. Each test starts with an empty browser (guest, no localStorage).
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

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

// Opens a route and waits until the career paths came from Supabase (the app is fully started). The path cards are
// on Home only, so they are checked as present, not visible.
async function open(page, hash = "#/") {
  await page.goto(`/index.html${hash}`);
  await expect(page.locator("#paths button").first()).toBeAttached({ timeout: 15_000 });
}

// Logo (scripts/gen-icons.mjs, top bar in index.html): the mark is drawn, its icons are served, and the browser bar
// colour follows the theme.
test("logo in the top bar, icons served, browser bar colour follows the theme", async ({ page, request }) => {
  await open(page);
  await expect(page.locator("header svg .logo-dot")).toBeAttached();
  for (const f of ["icons/favicon.svg", "icons/favicon-32.png", "icons/icon-192.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png"]) {
    expect((await request.get(`/${f}`)).status(), f).toBe(200);
  }
  const bar = () => page.locator('meta[name="theme-color"]').getAttribute("content");
  const before = await bar();
  await page.locator("#themeToggle").click();
  expect(await bar()).not.toBe(before);
  expect(["#faf9f5", "#1f1e1d"]).toContain(await bar());
});

// Accessibility (2026-11-09): no serious or critical WCAG 2.1 A/AA problem (axe-core) on the main pages, in both themes
// and with a path colour that is hard to read on white (Application Support, orange); and the keyboard basics.
for (const theme of ["light", "dark"]) {
  test(`accessibility: main pages pass axe in the ${theme} theme`, async ({ page }) => {
    // Lessons open whole ("hk.lessonView"), so the coloured code and the quick check are checked too.
    await page.addInitScript((th) => { localStorage.setItem("hk.theme", th); localStorage.setItem("hk.path", "as"); localStorage.setItem("hk.lessonView", "all"); }, theme);
    const problems = [];
    for (const route of ["#/", "#/offers", "#/training", "#/course/sql", "#/cv", "#/cv/maker", "#/interview", "#/applications", "#/account", "#/ai", "#/privacy"]) {
      await open(page, route);
      await page.waitForTimeout(400);
      const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      for (const v of r.violations.filter((x) => ["serious", "critical"].includes(x.impact))) {
        problems.push(`${route} ${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
      }
    }
    expect(problems).toEqual([]);
  });
}
test("accessibility: skip link and arrow keys in tab bars", async ({ page }) => {
  await open(page, "#/cv");
  await page.keyboard.press("Tab");
  await expect(page.locator("#skipLink")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#h-cv")).toBeFocused();
  await page.locator("#cvTabCheck").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#cvTabMaker")).toBeFocused();
  await expect(page).toHaveURL(/#\/cv\/maker$/);
});

// Guided first visit (guide.js): a newcomer gets three steps on Home that tick themselves off; an existing user never
// sees it; "Skip the guide" hides it for good.
test("guided first visit: role, CV, first search, then closed", async ({ page }) => {
  await page.route("**/functions/v1/job-search", (r) => r.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({ warnings: [], jobs: [] }) }));
  await open(page, "#/");
  const guide = page.locator("#homeGuide");
  await expect(guide).toContainText("Get started in 3 steps");
  await expect(guide).toContainText("0 of 3 done");
  await expect(page.locator("#homeQuick")).toBeHidden();
  await guide.getByRole("button").nth(1).click(); // the second career path
  await expect(guide).toContainText("1 of 3 done");
  await guide.getByRole("link", { name: "Upload or paste my CV" }).click();
  await expect(page.locator("#guideBar")).toContainText("Step 2 of 3");
  await page.fill("#cv", "Business Analyst\nRequirements, SQL, Jira");
  await page.click("#cvSave");
  await expect(page.locator("#guideBar")).toContainText("Last step");
  await page.locator("#guideBar").getByRole("link", { name: "Find offers →" }).click();
  await expect(page.locator("#guideBar")).toContainText("Step 3 of 3");
  await page.locator("#searchForm").evaluate((f) => f.requestSubmit());
  await expect(page.locator("#guideBar")).toContainText("All three steps done");
  await page.goto("/index.html#/");
  await expect(guide).toContainText("You're all set");
  await guide.getByRole("button", { name: "Close the guide" }).click();
  await expect(guide).toBeEmpty();
  await expect(page.locator("#homeQuick")).toBeVisible();
  await page.reload();
  await expect(page.locator("#paths button").first()).toBeAttached({ timeout: 15_000 });
  await expect(guide).toBeEmpty();
});
test("guided first visit: not shown to someone who already used the site, and can be skipped", async ({ page }) => {
  await page.addInitScript(() => { if (!sessionStorage.getItem("s")) { sessionStorage.setItem("s", "1"); localStorage.setItem("hk.path", "da"); } });
  await open(page, "#/");
  await expect(page.locator("#homeGuide")).toBeEmpty();
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload();
  await expect(page.locator("#homeGuide")).toContainText("Get started");
  await page.locator("#homeGuide").getByRole("button", { name: "Skip the guide" }).click();
  await expect(page.locator("#homeGuide")).toBeEmpty();
});

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
  await card.getByRole("button", { name: "Write a follow-up email" }).click(); // card buttons are named by their title
  await expect(page.locator("#letterDialog")).toBeVisible();
  await expect(page.locator("#letterBody textarea")).toHaveValue(/Smoke Test Engineer position at Acme/);
});

test("CV: scored without an offer, then matched with an offer, and the cover letter prompt contains the CV", async ({ page }) => {
  await open(page, "#/cv");
  await expect(page.locator("#cvScore")).toContainText("Add your CV"); // empty state: the three steps
  await page.fill("#cv", "Data Engineer\nBuilt Python and SQL pipelines on Airflow\nDocker and Git every day");
  await expect(page.locator("#cvDirty")).toBeVisible();
  await page.click("#cvSave");
  await expect(page.locator("#cvDirty")).toBeHidden();
  // The CV gets its score at once, with no offer: fixes with the points they add, and the skills found.
  const score = page.locator("#cvScore");
  await expect(score).toContainText("ATS score");
  await expect(score).toContainText("Missing sections");
  await expect(score.locator(".badge", { hasText: /^\+\d+ pts$/ }).first()).toBeVisible();
  await expect(page.locator("#cvSkills")).toContainText("Python");
  // Fixing a point and saving again shows the gain.
  await page.fill("#cv", "Data Engineer\nlea@example.com · +33 6 12 34 56 78 · linkedin.com/in/lea\nSummary\nData engineer, 3 years.\nExperience\n- Built 12 Python and SQL pipelines on Airflow (2022-2025)\nSkills\nDocker, Git\nEducation\nMSc Data, 2022");
  await page.click("#cvSave");
  await expect(score).toContainText("points since your last save");
  // Pasting an offer is enough: the match runs by itself.
  await page.fill("#jd", "Data Engineer: Python, SQL, Spark and AWS. 3 years of experience.");
  await expect(page.locator("#atsOut")).toContainText("Spark");
  await expect(page.locator("#atsOut")).toContainText("% match");
  // Anonymous statistics are asked once, off until the user says yes; "No thanks" is remembered.
  const ask = page.locator("[data-insights-ask]");
  await expect(ask).toBeVisible();
  await ask.getByRole("button", { name: "No thanks" }).click();
  await expect(ask).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("hk.insights"))).toBe("no");
  await page.locator("#atsOut").getByRole("button", { name: "✉ Cover letter" }).click();
  await expect(page.locator("#letterBody textarea")).toHaveValue(/Built 12 Python and SQL pipelines on Airflow/);
  await page.locator("#letterBody").getByRole("button", { name: "Close" }).click();
  await page.locator("#atsOut").getByRole("button", { name: /Tailor my CV/ }).click();
  await expect(page.locator("#tailorDialog")).toBeVisible();
});

// "Choose an offer" on the CV page (offerpick.js): offers seen on the Offers page, a tracked one, and the market.
test("CV: match with an offer seen or tracked, or with the market, without pasting", async ({ page }) => {
  await open(page, "#/offers");
  await page.evaluate(async () => {
    const { state } = await import("/js/state.js");
    const { renderOffers } = await import("/js/offers.js");
    const p = state.paths.find((x) => x.id === state.pathId);
    const title = p.job_titles?.[0] || "Data Engineer";
    state.jobs = ["Spark and Kafka", "Python and Spark", "Python, SQL and Airflow", "SQL and dbt", "Python and Docker"]
      .map((skills, i) => ({ id: `o${i}`, source: "adzuna", title, company: `Company ${i}`, location: "Paris",
        url: `https://example.com/${i}`, posted: null, snippet: "", text: `We use ${skills}. Git.` }));
    renderOffers();
  });
  await page.locator("#results > li").filter({ hasText: "Company 3" }).getByRole("button", { name: "Track" }).click();
  await expect(page.locator("#results > li").filter({ hasText: "Company 3" })).toContainText("Tracked");
  await page.goto("/index.html#/cv");
  await page.fill("#cv", "Data Engineer\nPython and SQL pipelines on Airflow, Git");
  await page.click("#cvSave");
  const pick = page.locator("#jdPick");
  // Best fit first: the Python, SQL and Airflow offer.
  await expect(pick.locator("optgroup").first().locator("option").first()).toContainText("Company 2");
  await pick.selectOption({ index: 2 });
  await expect(page.locator("#jd")).toHaveValue(/Company 2[\s\S]*Airflow/);
  await expect(page.locator("#atsOut")).toContainText("% match");
  await page.locator("#atsOut").getByRole("button", { name: /Tailor my CV/ }).click();
  await expect(page.locator("#tailorDialog")).toContainText("Company 2");
  await page.keyboard.press("Escape");
  // The tracked offer kept its text.
  const tracked = pick.locator('optgroup[label="In your tracker"] option').first();
  await expect(tracked).toContainText("Company 3");
  await pick.selectOption(await tracked.getAttribute("value"));
  await expect(page.locator("#jd")).toHaveValue(/dbt/);
  // The market: the CV against the skills asked most in the offers seen.
  await pick.selectOption("market");
  await expect(page.locator("#jd")).toHaveValue("");
  await expect(page.locator("#atsOut")).toContainText("of the skills asked most");
  await expect(page.locator("#atsOut")).toContainText("Spark");
});

// A card tracked before offer texts were kept: listed (the tracker loads after the CV page), its text pasted once is kept.
test("CV: a tracked offer with no kept text can be pasted once, then is kept", async ({ page }) => {
  await page.addInitScript(() => { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1");
    localStorage.setItem("hk.applications.v1", JSON.stringify([{ id: "a1", title: "Data Engineer", company: "Acme", source: "adzuna",
      external_id: "9", stage: "applied", url: "https://example.com/9", created_at: new Date().toISOString() }])); } });
  await open(page, "#/cv");
  await page.fill("#cv", "Data Engineer\nPython and SQL pipelines on Airflow, Git");
  await page.click("#cvSave");
  const opt = page.locator('#jdPick optgroup[label="In your tracker"] option').first();
  await expect(opt).toContainText("Acme (paste its text)");
  await page.locator("#jdPick").selectOption(await opt.getAttribute("value"));
  await expect(page.locator("#atsOut")).toContainText("No text was kept for this offer");
  await page.fill("#jd", "We are hiring a Data Engineer to build pipelines with Python, SQL, Spark and Airflow on AWS. Git and Docker.");
  await expect(page.locator("#atsOut")).toContainText("% match");
  await page.locator("#jd").blur();
  await page.reload();
  await expect(page.locator("#paths button").first()).toBeAttached({ timeout: 15_000 });
  await expect(page.locator('#jdPick optgroup[label="In your tracker"] option').first()).toContainText("Applied · Data Engineer · Acme");
});

// Offer alerts (alerts.js): a guest is asked to sign in; signed in (account calls answered by the test), 🔔 saves the
// search to the account after the notice, and pressing it again deletes it.
test("offers: an alert on a saved search, guest then signed in", async ({ page }) => {
  const calls = [];
  await page.route("**/rest/v1/search_alerts**", async (route) => {
    const r = route.request(); calls.push(r.method());
    if (r.method() === "GET") return route.fulfill(fake([]));
    if (r.method() === "POST") { const b = r.postDataJSON(); return route.fulfill(fake({ id: "al1", label: b.label, params: b.params, lang: b.lang, last_sent_on: null })); }
    return route.fulfill({ status: 204, headers: { "Access-Control-Allow-Origin": "*" }, body: "" });
  });
  await open(page, "#/offers");
  await page.locator("#saveSearch").click();
  const bell = page.locator("#savedSearches button[aria-pressed]").first();
  await expect(bell).toHaveText("🔕");
  await bell.click();
  await expect(page.locator("#toast")).toContainText("Sign in to get the new offers");
  await page.keyboard.press("Escape");
  await page.evaluate(async () => {
    const { state } = await import("/js/state.js"); const { renderSavedSearches } = await import("/js/offers.js");
    state.user = { id: "00000000-0000-0000-0000-000000000001", email: "lea@example.com" }; state.alerts = undefined; renderSavedSearches();
  });
  await expect.poll(() => calls.includes("GET")).toBe(true);
  page.once("dialog", (d) => { expect(d.message()).toContain("lea@example.com"); d.accept(); });
  await page.locator("#savedSearches button[aria-pressed]").first().click();
  await expect(page.locator("#savedSearches button[aria-pressed]").first()).toHaveText("🔔");
  expect(calls).toContain("POST");
  await page.locator("#savedSearches button[aria-pressed]").first().click();
  await expect(page.locator("#savedSearches button[aria-pressed]").first()).toHaveText("🔕");
  expect(calls).toContain("DELETE");
});

// Roadmap steps with a HelloKhedma course (training_steps.course_id): the step opens our course, the outside resource
// stays as an extra, and "Next up" starts the course.
test("training: roadmap steps open our own courses", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("hk.path", "da"));
  await page.route("**/rest/v1/training_tracks**", (r) => r.fulfill(fake([{ id: "da-viz", path_id: "da", title: "Python, BI and visual storytelling",
    summary: "", outcome: "", level: "intermediate", sort_order: 2, training_steps: [
      { id: "11111111-1111-1111-1111-111111111111", title: "DAX: measures, CALCULATE and time intelligence", description: "The formulas behind every report.",
        kind: "learn", provider: "HelloKhedma", url: null, est_hours: 5, is_free: true, sort_order: 1, course_id: "dax" },
      { id: "22222222-2222-2222-2222-222222222222", title: "Power BI", description: "Documentation and training.",
        kind: "learn", provider: "Microsoft Learn", url: "https://learn.microsoft.com/power-bi/", est_hours: 8, is_free: true, sort_order: 2, course_id: "power-bi" },
      { id: "33333333-3333-3333-3333-333333333333", title: "Tableau free training", description: "",
        kind: "learn", provider: "Tableau", url: "https://www.tableau.com/learn/training", est_hours: 8, is_free: true, sort_order: 3 }] }])));
  await open(page, "#/training");
  const dax = page.locator("#tracks a", { hasText: "DAX: measures" });
  await expect(dax).toHaveAttribute("href", "#/course/dax");
  await expect(page.locator("#tracks")).toContainText("HelloKhedma course: lessons, exercises and quiz here");
  await expect(page.locator("#tracks a", { hasText: "also: Microsoft Learn" })).toHaveAttribute("href", "https://learn.microsoft.com/power-bi/");
  await expect(page.locator("#tracks a", { hasText: "Tableau free training" })).toHaveAttribute("target", "_blank");
  await expect(page.locator("#nextUp").getByRole("link", { name: "Start the course" })).toHaveAttribute("href", "#/course/dax");
});

// Who's hiring on Home (pulse.js): Adzuna isn't called from tests, so the block is filled with a function answer.
test("home: who's hiring, from Adzuna's top companies and regions", async ({ page }) => {
  await open(page, "#/");
  await page.evaluate(async () => {
    const { fillHiring } = await import("/js/pulse.js");
    const box = document.createElement("div"); box.id = "hiringTest"; box.hidden = true;
    document.querySelector("#homePulse").append(box);
    fillHiring(box, { currency: "EUR", week: 214, regionTotal: 1000,
      companies: [{ name: "Capgemini", count: 41, salary: 52000 }, { name: "Doctolib", count: 12, salary: 0 }],
      regions: [{ name: "Ile-de-France", count: 610 }, { name: "Auvergne-Rhône-Alpes", count: 140 }] }, "Data Engineer");
  });
  const box = page.locator("#hiringTest");
  await expect(box).toBeVisible();
  await expect(box).toContainText("214 new offers in the last 7 days");
  await expect(box).toContainText("Capgemini");
  await expect(box).toContainText("41 offers");
  await expect(box).toContainText("61%");
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

// More job sources (2026-11-09). No real provider is called: every source is answered by the test.
const fake = (body, type = "application/json") => ({ status: 200, contentType: type, headers: { "Access-Control-Allow-Origin": "*" },
  body: typeof body === "string" ? body : JSON.stringify(body) });
test("job search: Himalayas and Arbeitnow results, visa badge, credits and More offers", async ({ page }) => {
  const pages = [];
  const day = (n) => new Date(Date.now() - n * 86_400_000).toISOString();
  await page.route("**/functions/v1/job-search", async (route) => {
    const b = route.request().postDataJSON(); pages.push(b.page);
    const jobs = b.page === 1 ? [
      { id: "h1", source: "himalayas", title: "Data Engineer", company: "Mutt Data", location: "Remote (worldwide)", url: "https://himalayas.app/companies/x/jobs/y?utm_source=api",
        posted: day(1), snippet: "Python and SQL.", text: "full remote Python SQL Airflow", salary: "" },
      { id: "a1", source: "arbeitnow", title: "Data Engineer (m/w/d)", company: "Flaconi", location: "Berlin", url: "https://www.arbeitnow.com/jobs/companies/x/y",
        posted: day(2), snippet: "Spark.", text: "visa sponsorship Spark Python", salary: "" },
      { id: "l1", source: "lba", title: "Alternance Data Engineer", company: "Banque X", location: "75008 Paris", url: "https://labonnealternance.apprentissage.beta.gouv.fr/x",
        posted: day(3), snippet: "", text: "alternance apprenticeship Python SQL", salary: "" },
      { id: "c1", source: "careerjet", title: "Data Engineer", company: "Cora", location: "Lyon", url: "https://jobviewtrack.com/x",
        posted: day(4), snippet: "", text: "Python", salary: "" },
    ] : b.page === 2 ? [{ id: "h2", source: "himalayas", title: "Senior Data Engineer", company: "Other", location: "Remote (Europe)", url: "https://himalayas.app/companies/z/jobs/w",
        posted: day(3), snippet: "", text: "full remote dbt", salary: "" }] : [];
    await route.fulfill(fake({ jobs, warnings: [] }));
  });
  await open(page, "#/offers");
  await page.locator("#searchForm").evaluate((f) => f.requestSubmit());
  const cards = page.locator("#results > li");
  await expect(cards).toHaveCount(4);
  await expect(cards.filter({ hasText: "Flaconi" })).toContainText("Visa sponsorship");
  await expect(page.locator("#sourceCredits")).toContainText("La bonne alternance");
  await expect(page.locator("#sourceCredits")).toContainText("Careerjet");
  await expect(cards.filter({ hasText: "Mutt Data" })).not.toContainText("Visa sponsorship");
  await expect(page.locator("#sourceCredits")).toContainText("Himalayas");
  await expect(page.locator("#sourceCredits")).toContainText("Arbeitnow");
  await page.locator("#moreBtn").click();
  await expect(cards).toHaveCount(5);
  expect(pages).toEqual([1, 2]);
  await page.locator("#moreBtn").click();
  await expect(page.locator("#searchMsg")).toContainText("No more offers");
  await expect(page.locator("#moreBtn")).toBeHidden();
});

test("job search in France: French titles with their English pair, both sent; titles outside the path hidden", async ({ page }) => {
  const sent = [];
  await page.route("**/functions/v1/job-search", async (route) => {
    sent.push(route.request().postDataJSON());
    await route.fulfill(fake({ warnings: [], jobs: [
      { id: "1", source: "adzuna", title: "Ingénieur Data H/F", company: "Acme", location: "Paris", url: "https://example.com/1", posted: null, snippet: "", text: "Python SQL", salary: "" },
      { id: "2", source: "adzuna", title: "Comptable", company: "Beta", location: "Paris", url: "https://example.com/2", posted: null, snippet: "", text: "data", salary: "" },
    ] }));
  });
  await open(page, "#/offers");
  await page.evaluate(async () => {
    const { path } = await import("/js/state.js");
    const p = path(); p.job_titles = ["Data Engineer", "Ingénieur Data", "Analytics Engineer"]; p.job_titles_fr = ["Ingénieur Data", "Ingénieur Data", "Analytics Engineer"];
    const c = document.querySelector("#country"); c.value = "fr"; c.dispatchEvent(new Event("change"));
  });
  await expect(page.locator("#role option")).toHaveText(["Ingénieur Data · Data Engineer", "Analytics Engineer"]);
  await page.locator("#searchForm").evaluate((f) => f.requestSubmit());
  await expect(page.locator("#results > li")).toHaveCount(1); // "Comptable" is not a title of the path
  expect(sent[0]).toMatchObject({ query: "Ingénieur Data", alt: "Data Engineer", country: "fr" });
  await page.uncheck("#fTitle");
  await expect(page.locator("#results > li")).toHaveCount(2);
  await page.evaluate(() => { const c = document.querySelector("#country"); c.value = "gb"; c.dispatchEvent(new Event("change")); });
  await expect(page.locator("#role option").first()).toHaveText("Data Engineer");
});

test("remote jobs: Remote OK offers are listed, credited by name and linked with the referrer kept", async ({ page }) => {
  await page.route("https://remotive.com/**", (r) => r.fulfill(fake({ jobs: [] })));
  await page.route("https://jobicy.com/**", (r) => r.fulfill(fake({ jobs: [] })));
  await page.route("https://remoteok.com/**", (r) => r.fulfill(fake([{ legal: "API Terms of Service" },
    { id: "77", position: "Data Engineer", company: "Nomad Co", location: "", url: "https://remoteOK.com/remote-jobs/77",
      date: new Date().toISOString(), tags: ["data"], description: "<p>Python, SQL</p>", salary_min: 60000, salary_max: 80000 }])));
  await open(page, "#/offers");
  await page.evaluate(() => localStorage.removeItem("hk.remoteCache"));
  await page.locator("#tabRemote").click();
  await page.locator("#remoteBtn").click();
  const card = page.locator("#results > li").filter({ hasText: "Nomad Co" });
  await expect(card).toContainText("Remote OK");
  await expect(card.getByRole("link", { name: "View offer" })).toHaveAttribute("rel", "noopener");
  await expect(page.locator("#sourceCredits").getByRole("link", { name: "Remote OK" })).toHaveAttribute("href", "https://remoteok.com");
});

test("companies: Recruitee and Personio careers feeds are read", async ({ page }) => {
  await page.route("https://acme.recruitee.com/api/offers/", (r) => r.fulfill(fake({ offers: [{ id: 5, title: "Data Analyst", company_name: "Acme",
    careers_url: "https://acme.recruitee.com/o/data-analyst", published_at: "2026-11-01 10:00:00 UTC", location: "Amsterdam",
    description: "<p>SQL and Power BI</p>", requirements: "", remote: true }] })));
  await page.route("https://beta.jobs.personio.de/xml?language=en", (r) => r.fulfill(fake(`<?xml version="1.0" encoding="UTF-8"?><workzag-jobs>
    <position><id>42</id><subcompany>Beta GmbH</subcompany><office>Berlin</office><name>DevOps Engineer</name>
    <jobDescriptions><jobDescription><name>Tasks</name><value><![CDATA[<p>Kubernetes and Terraform</p>]]></value></jobDescription></jobDescriptions>
    <employmentType>permanent</employmentType><schedule>full-time</schedule><createdAt>2026-11-02T09:00:00+00:00</createdAt></position></workzag-jobs>`, "text/xml")));
  await open(page, "#/offers");
  const got = await page.evaluate(async () => {
    const { fetchCompanyJobs, parseCareersLink } = await import("/js/companies.js");
    const all = () => true;
    const r = await fetchCompanyJobs({ provider: "recruitee", slug: "acme", name: "Acme" }, all, "t");
    const p = await fetchCompanyJobs({ provider: "personio", slug: "beta", name: "Beta" }, all, "t");
    return { r: r.map((j) => [j.title, j.url, j.text.includes("Power BI")]), p: p.map((j) => [j.title, j.url, j.text.includes("Kubernetes")]),
      links: [parseCareersLink("https://acme.recruitee.com/o/x"), parseCareersLink("https://beta.jobs.personio.com/job/1")] };
  });
  expect(got.r).toEqual([["Data Analyst", "https://acme.recruitee.com/o/data-analyst", true]]);
  expect(got.p).toEqual([["DevOps Engineer", "https://beta.jobs.personio.de/job/42", true]]);
  expect(got.links).toEqual([{ provider: "recruitee", slug: "acme" }, { provider: "personio", slug: "beta" }]);
});

test("market pulse: offers seen on the Offers page feed the Home card", async ({ page }) => {
  await open(page, "#/offers");
  await expect(page.locator("#homePulse")).toContainText("Run a few searches"); // empty state (Home is hidden: text only)
  await page.evaluate(async () => {
    const { state, path } = await import("/js/state.js");
    const { renderOffers } = await import("/js/offers.js");
    const title = path().job_titles[0]; // offers must match the path to count
    state.jobs = Array.from({ length: 6 }, (_, i) => ({ id: `m${i}`, source: "jsearch", title, company: `Co${i}`,
      url: `https://example.com/${i}`, posted: new Date().toISOString(), snippet: "",
      text: i % 2 ? "Python and SQL. Full remote. 50 000 - 60 000 € par an." : "SQL and Excel. On site." }));
    renderOffers();
  });
  await page.click('#nav a[data-route="home"]');
  const card = page.locator("#homePulse");
  await expect(card).toContainText("From 6 offers you looked at");
  await expect(card).toContainText("50% full remote");
  await expect(card.locator("li").first()).toContainText("SQL");
  await expect(card.locator("li").first()).toContainText("100%");
});

test("course index matches the course files (time, lesson count, French copy)", async ({ page }) => {
  await page.goto("/index.html");
  const problems = await page.evaluate(async () => {
    const { courseTime } = await import("/js/coursetime.js");
    const get = (u) => fetch(u).then((r) => (r.ok ? r.json() : null));
    const index = await get("/content/courses/index.json"), out = [];
    for (const c of index) {
      const [en, fr] = await Promise.all([get(`/content/courses/${c.id}.json`), get(`/content/courses/fr/${c.id}.json`)]);
      if (!en) { out.push(`${c.id}: file missing`); continue; }
      const m = courseTime(en).total;
      if (c.minutes !== m) out.push(`${c.id}: index minutes ${c.minutes}, content gives ${m}`);
      if (c.lessonCount !== en.lessons.length) out.push(`${c.id}: lessonCount ${c.lessonCount}, lessons ${en.lessons.length}`);
      if (!fr || fr.lessons.length !== en.lessons.length) out.push(`${c.id}: French copy missing or with another lesson count`);
    }
    return out;
  });
  expect(problems).toEqual([]);
});

test("portfolio projects: every path has projects and a project page works", async ({ page }) => {
  await open(page, "#/training");
  const cards = page.locator("#projectList a");
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeGreaterThanOrEqual(3);
  await cards.first().click();
  const project = page.locator('section[data-page="project"]');
  await expect(project.locator("h1")).not.toBeEmpty();
  const box = project.locator("ol input[type=checkbox]").first();
  await box.check();
  await expect(project).toContainText("1/");
  for (const p of ["de", "da", "ba", "as", "do", "mk"]) { // the AI Engineer path ("ai") has its projects in content/ai
    const n = await page.evaluate(async (id) => (await (await fetch(`/content/projects/${id}.json`)).json()).projects.length, p);
    expect(n, `projects for ${p}`).toBeGreaterThanOrEqual(3);
  }
});

test("AI track: the four languages match, the page and a course work", async ({ page }) => {
  await open(page, "#/ai");
  const problems = await page.evaluate(async () => {
    const { courseTime } = await import("/js/coursetime.js");
    const get = (u) => fetch(u).then((r) => (r.ok ? r.json() : null));
    const len = (x) => (x ? x.length : 0), out = [], LANGS = ["lat", "en", "fr"];
    for (const c of (await get("/content/ai/index.json")).filter((x) => x.status === "ready")) {
      for (const l of ["ar", ...LANGS]) if (!c.name?.[l] || !c.summary?.[l]) out.push(`${c.id}: no ${l} name or summary in the index`);
      const ar = await get(`/content/ai/ar/${c.id}.json`);
      if (!ar) { out.push(`${c.id}: the Arabic-letter file is missing`); continue; }
      if (c.minutes !== courseTime(ar).total || c.lessonCount !== ar.lessons.length) out.push(`${c.id}: index minutes / lessonCount out of date`);
      for (const l of LANGS) {
        const x = await get(`/content/ai/${l}/${c.id}.json`);
        if (!x) { out.push(`${c.id}: the ${l} file is missing`); continue; }
        for (const k of ["lessons", "cheatsheet", "exercises", "pitfalls", "interview"]) if (len(ar[k]) !== len(x[k])) out.push(`${c.id} ${l}: ${k} count differs`);
        ar.lessons.forEach((les, i) => { if ((les.example?.code || "") !== (x.lessons[i]?.example?.code || "")) out.push(`${c.id} ${l}: lesson ${i} code differs`); });
        if (/[\u0600-\u06FF]/.test(JSON.stringify(x))) out.push(`${c.id}: Arabic letters in the ${l} file`);
      }
    }
    return out;
  });
  expect(problems).toEqual([]);
  // English by default (the interface language), then Derja in Arabic letters (right to left) and 3arbizi.
  await expect(page.locator("#h-ai")).toHaveText("Become an AI engineer");
  const first = page.locator('#aiBody a[href^="#/course/ai-"]').first();
  await expect(first).toBeVisible();
  await first.click();
  const panel = page.locator("#courseBody [role=tabpanel]");
  await expect(panel).toHaveAttribute("dir", "ltr");
  await expect(panel).toHaveAttribute("lang", "en");
  await expect(panel.locator("article")).not.toBeEmpty();
  await page.locator("#courseBody").getByRole("tab", { name: "عربي" }).click();
  await expect(page.locator("#courseBody [role=tabpanel]")).toHaveAttribute("dir", "rtl");
  await page.locator("#courseBody").getByRole("tab", { name: "3arbizi" }).click();
  await expect(page.locator("#courseBody [role=tabpanel]")).toHaveAttribute("lang", "aeb-Latn");
  await page.locator("#courseBody").getByRole("tab", { name: "English" }).click();
  await expect(page.locator("#courseBody [role=tabpanel]")).toHaveAttribute("lang", "en");
});

test("AI track in French: the track follows the interface language", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("hk.lang", "fr"));
  await open(page, "#/ai");
  await expect(page.locator("#h-ai")).toHaveText("Devenez AI engineer");
  await expect(page.locator("#aiBody")).toContainText("Le métier d’AI engineer");
  await expect(page.locator("#aiBody").getByRole("tab", { name: "Français" })).toHaveAttribute("aria-selected", "true");
});

test("AI Engineer path: its courses and projects are on Training", async ({ page }) => {
  await open(page, "#/training");
  // Every path can find the AI courses (under "Other courses" when another path is selected).
  await expect(page.locator('#courseList a[href="#/course/ai-engineer-basics"]')).toBeAttached();
  if (!(await page.locator('#pathSelect option[value="ai"]').count())) {
    test.skip(true, "the AI Engineer path is not in the database yet: run supabase/seed.sql");
  }
  await page.locator("#pathSelect").selectOption("ai");
  await expect(page.locator('#courseList > div a[href="#/course/ai-engineer-basics"]')).toBeVisible();
  await expect(page.locator('#projectList a[href^="#/project/ai-"]').first()).toBeVisible();
});

test("CV maker: the form fills the preview, saves a CV version, and the ATS score shows", async ({ page }) => {
  await open(page, "#/cv/maker");
  const form = page.locator("#cvmForm");
  await form.getByLabel("Full name").fill("Test Person");
  await form.getByLabel("Email").fill("test@example.com");
  await form.getByLabel("Job title", { exact: true }).first().fill("Data Engineer");
  await form.getByLabel("Company").first().fill("Acme");
  await form.getByLabel("Achievements").first().fill("Built 12 pipelines in Python and SQL\nReduced report time by 80%");
  await expect(page.locator("#cvPreview")).toContainText("Test Person");
  await expect(page.locator("#cvPreview")).toContainText("Reduced report time by 80%");
  await expect(page.locator("#cvmScore")).toContainText("ATS score");
  // "Download PDF" builds a real PDF in the browser (js/cvpdf.js + js/vendor/pdf-lib).
  const [pdf] = await Promise.all([page.waitForEvent("download"), page.locator("#cvmActions").getByRole("button", { name: "Download PDF" }).click()]);
  expect(pdf.suggestedFilename()).toBe("Test-Person-CV.pdf");
  const bytes = await (await import("node:fs/promises")).readFile(await pdf.path());
  // A complete PDF: header and end-of-file marker (standard fonts are not embedded, so even a full CV is small).
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  expect(bytes.subarray(-8).toString()).toContain("%%EOF");
  expect(bytes.length).toBeGreaterThan(800);
  await page.locator("#cvmActions").getByRole("button", { name: "Use as a CV version" }).click();
  await page.locator("#cvTabCheck").click();
  await expect(page.locator("#cv")).toHaveValue(/Test Person/);
  await page.fill("#jd", "Data Engineer\nSQL, Python, Airflow and dbt.");
  await page.click("#atsBtn");
  await expect(page.locator("#atsOut")).toContainText("ATS score");
  await expect(page.locator("#atsOut")).toContainText("Standard sections");
  // "Close the gaps": the offer asks for Airflow and dbt, the CV has neither: their HelloKhedma courses are proposed.
  await expect(page.locator("#atsOut")).toContainText("Close the gaps with HelloKhedma");
  const gaps = page.locator("#atsOut [data-gaps]");
  await expect(gaps.locator('a[href="#/course/airflow"]')).toBeVisible();
  await expect(gaps.locator('a[href="#/course/dbt"]')).toBeVisible();
});

// "Correct, tailor and create my CV" needs sign-in and the Claude API, so the function's answer is fed to the CV maker directly.
test("CV for an offer: an AI CV fills the CV maker with its notes and saves as a version named after the offer", async ({ page }) => {
  await open(page, "#/cv/maker");
  await page.evaluate(async () => {
    const { loadAiCv, renderCvMaker } = await import("./js/cvmaker.js");
    loadAiCv({ lang: "fr", name: "Test Person", headline: "Application Support Engineer", email: "test@example.com", phone: "", location: "Paris",
      links: "", summary: "Support L2/L3 en production.", skills: "SQL, Linux, Control-M",
      experience: [{ role: "Support Engineer", company: "Acme", location: "Paris", start: "06/2024", end: "",
        bullets: "Gestion des incidents via SQL et ELK ([number?] incidents par semaine)\nAutomatisation en Python" }],
      education: [{ degree: "Diplôme d'ingénieur", school: "EFREI", location: "", start: "", end: "2020", details: "" }],
      projects: [], certifications: "", languages: "Français, Anglais",
      changes: ["Fixed 2 spelling mistakes", "Moved incident bullets first"],
      notes: ["AWS: not shown in your CV.", "How many incidents a week?"], unknown: "ignored" }, "Support Engineer · LSEG");
    renderCvMaker();
  });
  await expect(page.locator("#cvmForm")).toContainText("Written by AI for: Support Engineer · LSEG");
  await expect(page.locator("#cvmForm")).toContainText("AWS: not shown in your CV.");
  await expect(page.locator("#cvmForm")).toContainText("What was corrected and tailored");
  await expect(page.locator("#cvmForm")).toContainText("Fixed 2 spelling mistakes");
  await expect(page.locator("#cvmForm")).toContainText("[number?]");
  await expect(page.locator("#cvPreview")).toContainText("Expérience professionnelle");
  await expect(page.locator("#cvPreview")).toContainText("Gestion des incidents via SQL et ELK");
  await page.locator("#cvmActions").getByRole("button", { name: "Use as a CV version" }).click();
  await page.locator("#cvTabCheck").click();
  await expect(page.locator("#cvVersions")).toContainText("CV · Support Engineer · LSEG");
});

test("AI track projects: the four languages match and a project page works", async ({ page }) => {
  await open(page, "#/ai");
  const problems = await page.evaluate(async () => {
    const get = (u) => fetch(u).then((r) => (r.ok ? r.json() : null));
    const ar = await get("/content/ai/ar/projects.json");
    if (!ar || ar.projects.length < 3) return ["the Arabic-letter projects are missing"];
    const out = [], len = (x) => (x ? x.length : 0);
    for (const l of ["lat", "en", "fr"]) {
      const x = await get(`/content/ai/${l}/projects.json`);
      if (!x || x.projects.length !== ar.projects.length) { out.push(`${l}: project count`); continue; }
      ar.projects.forEach((p, i) => {
        const q = x.projects[i] || {};
        if (p.id !== q.id || !p.id.startsWith("ai-")) out.push(`${l} project ${i} id`);
        for (const k of ["data", "steps", "deliverables", "checklist", "stretch"]) if (len(p[k]) !== len(q[k])) out.push(`${l} ${p.id}: ${k} count differs`);
        p.data.forEach((d, j) => { if (d.url !== q.data?.[j]?.url) out.push(`${l} ${p.id}: link ${j} differs`); });
      });
      if (/[\u0600-\u06FF]/.test(JSON.stringify(x))) out.push(`Arabic letters in the ${l} projects`);
    }
    return out;
  });
  expect(problems).toEqual([]);
  const card = page.locator('#aiProjects a[href^="#/project/ai-"]').first();
  await expect(card).toBeVisible();
  await card.click();
  const project = page.locator('section[data-page="project"]');
  await expect(project.locator("h1")).toHaveAttribute("dir", "ltr");
  await project.locator("ol input[type=checkbox]").first().check();
  await expect(project).toContainText("1/");
  await project.getByRole("tab", { name: "عربي" }).click();
  await expect(page.locator('section[data-page="project"] h1')).toHaveAttribute("dir", "rtl");
  await expect(page.locator('section[data-page="project"]')).toContainText("1/"); // progress is shared by every language
});

test("account: CV sync needs an account, anonymous statistics can be turned on and off", async ({ page }) => {
  await open(page, "#/account");
  await expect(page.locator("#cvSyncPanel")).toContainText("Sign in to keep them in your account");
  const stats = page.locator("#insightsPanel");
  await expect(stats).toContainText("off by default");
  await stats.getByRole("button", { name: "Share anonymous statistics" }).click();
  await expect(stats).toContainText("You share anonymous statistics");
  await stats.getByRole("button", { name: "Stop sharing" }).click();
  await expect(stats).toContainText("off by default");
});

// Lessons (2026-11-09): read step by step (paragraphs, example, key points), coloured code that stays the same code,
// code words in the text, a quick check from the cheat sheet that schedules reviews, a celebration when the lesson is
// done, then the next lesson; "Show the whole lesson" is remembered.
test("a lesson is read step by step, with a quick check and a celebration", async ({ page }) => {
  await open(page, "#/course/sql");
  const lesson = page.locator('section[data-page="course"] article');
  const course = await page.evaluate(async () => (await fetch("content/courses/sql.json")).json());
  await expect(lesson.locator("[data-step]")).toHaveCount(1);
  await expect(lesson.locator(".lesson-p code.inline-code").first()).toBeVisible();
  const steps = await lesson.locator(".lseg > span").count();
  for (let i = 1; i < steps; i++) await lesson.locator("[data-continue]").click();
  await expect(lesson.locator("[data-step]")).toHaveCount(steps);
  await expect(lesson.locator("[data-continue]")).toHaveCount(0);
  await expect(lesson.locator("pre .tok-kw").first()).toHaveText("SELECT");
  expect(await lesson.locator("pre code").textContent()).toBe(course.lessons[0].example.code);
  // Quick check: every answer right, found in the cheat sheet.
  const pairs = course.cheatsheet.flatMap((g) => g.items), check = lesson.locator("[data-quick-check]");
  await expect(check).toBeVisible();
  for (let i = 0; await check.locator("[data-q]").nth(i).count(); i++) {
    const q = check.locator("[data-q]").nth(i), prompt = q.locator("[data-prompt]");
    const side = await prompt.getAttribute("data-prompt"), text = (await prompt.textContent()).trim();
    const pair = pairs.find((p) => (side === "front" ? p[0] : p[1]) === text);
    await q.getByRole("button", { name: side === "front" ? pair[1] : pair[0], exact: true }).click();
    await expect(q).toContainText("Correct");
  }
  const n = await check.locator("[data-q]").count();
  await expect(check).toContainText(`${n}/${n} right`);
  expect(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("hk.srs") || "{}").sql || {}).length)).toBe(n);
  // Done: the celebration, the lesson saved, then the next lesson from the start.
  await lesson.getByRole("button", { name: "✓ Complete lesson" }).click();
  await expect(lesson.locator(".celebrate")).toContainText("Lesson complete!");
  await expect(lesson.locator(".celebrate")).toContainText(`Quick check ${n}/${n}`);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("hk.lessons") || "[]"))).toContain("sql:0");
  await lesson.getByRole("button", { name: "Next lesson →" }).click();
  await expect(lesson.locator(".eyebrow").first()).toContainText("Lesson 2 of");
  await expect(lesson.locator("[data-step]")).toHaveCount(1);
  // The whole lesson at once, still so after a reload.
  await lesson.getByRole("button", { name: "Show the whole lesson" }).click();
  await expect(lesson.locator("[data-continue]")).toHaveCount(0);
  await page.reload();
  await expect(lesson.getByRole("button", { name: "Read step by step" })).toBeVisible();
  await expect(lesson.locator("[data-continue]")).toHaveCount(0);
});

test("a course opens with its tabs and the quiz", async ({ page }) => {
  await open(page, "#/course/sql");
  const tabs = page.locator('section[data-page="course"] [role=tablist] [role=tab]');
  await expect(tabs.first()).toBeVisible();
  await tabs.filter({ hasText: "Quiz" }).click();
  await expect(page.locator('section[data-page="course"] [role=tabpanel]')).not.toBeEmpty();
  // "Report a problem" opens preset to where the user is (the Quiz tab here).
  const report = page.locator('section[data-page="course"] [data-report]');
  await report.locator("summary").click();
  await expect(report.locator("select")).toHaveValue("quiz");
  await expect(report.getByRole("button", { name: "Send" })).toBeVisible();
});

test("runnable SQL exercise: a correct query written differently is accepted, a wrong one explained", async ({ page }) => {
  await open(page, "#/course/sql");
  await page.locator('section[data-page="course"] [role=tab]').filter({ hasText: "Practice" }).click();
  const runner = page.locator("[data-sql-runner]").first();
  await runner.locator("textarea").fill("select city, count(*) from customers group by city order by 2 desc limit 4");
  await runner.getByRole("button", { name: /Check my answer/ }).click();
  await expect(runner).toContainText("the expected result has 5", { timeout: 15_000 });
  await runner.locator("textarea").fill("select count(*) as n, city from customers group by city order by n desc limit 5");
  await runner.getByRole("button", { name: /Check my answer/ }).click();
  await expect(runner).toContainText("Correct!", { timeout: 15_000 });
  await expect(runner.locator("table")).toContainText("Paris");
});

// "Explain my mistake" (explain.js): the button appears after a wrong answer and goes away once solved; a guest is asked
// to sign in, so nothing is sent to the AI in this test.
test("explain my mistake: offered after a wrong answer, sign-in asked for guests, gone once solved", async ({ page }) => {
  await open(page, "#/course/sql");
  await page.locator('section[data-page="course"] [role=tab]').filter({ hasText: "Practice" }).click();
  const item = page.locator("li").filter({ has: page.locator("[data-sql-runner]") }).first();
  const help = item.locator("[data-explain]");
  await expect(help).toBeHidden();
  await item.locator("textarea").fill("select city, count(*) from customers group by city order by 2 desc limit 4");
  await item.getByRole("button", { name: /Check my answer/ }).click();
  await expect(help.getByRole("button", { name: /Explain my mistake/ })).toBeVisible({ timeout: 15_000 });
  await help.getByRole("button", { name: /Explain my mistake/ }).click();
  await expect(help).toContainText("Sign in to get an AI explanation");
  await item.locator("textarea").fill("select count(*) as n, city from customers group by city order by n desc limit 5");
  await item.getByRole("button", { name: /Check my answer/ }).click();
  await expect(item).toContainText("Correct!", { timeout: 15_000 });
  await expect(help).toBeHidden();
  // An auto-graded format reports its wrong answers too: pick a wrong option of the first "choice" exercise of Python.
  const pick = await page.evaluate(async () => {
    const c = await (await fetch("/content/courses/python.json")).json();
    const i = c.exercises.findIndex((x) => x.type === "choice");
    return { i, wrong: (c.exercises[i].correct + 1) % c.exercises[i].options.length };
  });
  await open(page, "#/course/python");
  await page.locator('section[data-page="course"] [role=tab]').filter({ hasText: "Practice" }).click();
  const drill = page.locator('section[data-page="course"] [role=tabpanel] ol.grid > li').nth(pick.i);
  await drill.locator("[data-drill] .opt").nth(pick.wrong).click();
  await expect(drill.locator("[data-explain]").getByRole("button", { name: /Explain my mistake/ })).toBeVisible();
});

// Saved explanations (explain.js, ROADMAP 4b row 4c): a signed-in learner (simulated; the explain-mistake function is
// answered by the test, nothing reaches Claude) gets the notice, then the answer; the same mistake later shows the copy
// saved on this device without a new call; "Ask the AI again" calls again with fresh: true.
test("explain my mistake: the answer is saved on the device and reused for the same mistake", async ({ page }) => {
  const calls = [];
  await page.route("**/functions/v1/explain-mistake", async (route) => {
    calls.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ text: `Explanation number ${calls.length}.`, model: "test", truncated: false, saved: false }) });
  });
  const pick = await (async () => {
    await open(page, "#/");
    return page.evaluate(async () => {
      const c = await (await fetch("/content/courses/python.json")).json();
      const i = c.exercises.findIndex((x) => x.type === "choice");
      return { i, wrong: (c.exercises[i].correct + 1) % c.exercises[i].options.length };
    });
  })();
  await open(page, "#/course/python");
  await page.evaluate(async () => { (await import("/js/state.js")).state.user = { id: "test-user" }; });
  await page.locator('section[data-page="course"] [role=tab]').filter({ hasText: "Practice" }).click();
  const drill = page.locator('section[data-page="course"] [role=tabpanel] ol.grid > li').nth(pick.i);
  const help = drill.locator("[data-explain]");
  await drill.locator("[data-drill] .opt").nth(pick.wrong).click();
  await help.getByRole("button", { name: /Explain my mistake/ }).click();
  await help.getByRole("button", { name: "Send and explain" }).click();
  await expect(help).toContainText("Explanation number 1.");
  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatchObject({ kind: "choice", lang: "en" });
  expect(calls[0].fresh).toBeUndefined();
  // Same mistake on a fresh page: shown from this device, no new call.
  await page.reload();
  await expect(page.locator("#paths button").first()).toBeAttached({ timeout: 15_000 });
  await page.evaluate(async () => { (await import("/js/state.js")).state.user = { id: "test-user" }; });
  await page.locator('section[data-page="course"] [role=tab]').filter({ hasText: "Practice" }).click();
  await drill.locator("[data-drill] .opt").nth(pick.wrong).click();
  await help.getByRole("button", { name: /Explain my mistake/ }).click();
  await expect(help).toContainText("Explanation number 1.");
  await expect(help).toContainText("Saved on this device");
  expect(calls).toHaveLength(1);
  await help.getByRole("button", { name: "Ask the AI again" }).click();
  await expect(help).toContainText("Explanation number 2.");
  expect(calls).toHaveLength(2);
  expect(calls[1].fresh).toBe(true);
});

// "Ask about this lesson" (asklesson.js): a guest is asked to sign in; a signed-in learner (simulated; the function is
// answered by the test, nothing reaches Claude) gets the notice, then the answer; the same question is answered from
// this device without a new call.
test("ask about this lesson: sign-in for guests, answer for signed-in learners, saved on the device", async ({ page }) => {
  const calls = [];
  await page.route("**/functions/v1/explain-mistake", async (route) => {
    calls.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ text: `Answer number ${calls.length}.`, model: "test", truncated: false }) });
  });
  await open(page, "#/course/sql");
  const box = page.locator("[data-ask]");
  await box.getByRole("button", { name: /Ask about this lesson/ }).click();
  await box.locator("textarea").fill("Why use WHERE before GROUP BY?");
  await box.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(box).toContainText("Sign in to ask the AI about this lesson");
  expect(calls).toHaveLength(0);
  await page.evaluate(async () => { (await import("/js/state.js")).state.user = { id: "test-user" }; });
  await box.getByRole("button", { name: "Ask", exact: true }).click();
  await box.getByRole("button", { name: "Send my question" }).click();
  await expect(box).toContainText("Answer number 1.");
  expect(calls[0]).toMatchObject({ mode: "ask", lang: "en", question: "Why use WHERE before GROUP BY?" });
  expect(calls[0].lesson.length).toBeGreaterThan(100);
  await box.locator("textarea").fill("  why use where before group by? ");
  await box.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(box).toContainText("Saved on this device");
  expect(calls).toHaveLength(1);
});

// Runnable Python (training step 5, pyrun.js + pyworker.js, Pyodide built into js/vendor/pyodide): a wrong function
// fails a hidden test and offers "Explain my mistake", the right one passes; ▶ Run shows what the code prints.
test("runnable Python: hidden tests reject a wrong answer and accept the right one", async ({ page }) => {
  test.setTimeout(120_000);
  await open(page, "#/course/python");
  await page.locator('section[data-page="course"] [role=tab]').filter({ hasText: "Practice" }).click();
  const item = page.locator('section[data-page="course"] [role=tabpanel] ol.grid > li').filter({ has: page.locator("[data-py-runner]") }).first();
  const box = item.locator("textarea");
  await box.fill("def average_salary(jobs):\n    return sum(j['salary'] for j in jobs) / len(jobs)\n\nprint(average_salary([{'salary': 10}, {'salary': 20}]))");
  await item.getByRole("button", { name: "▶ Run" }).click();
  await expect(item.locator("pre").first()).toContainText("15.0", { timeout: 90_000 });
  await item.getByRole("button", { name: /Check my answer/ }).click();
  await expect(item).toContainText("Not yet: a test fails", { timeout: 30_000 });
  await expect(item.locator("[data-explain]").getByRole("button", { name: /Explain my mistake/ })).toBeVisible();
  await box.fill("def average_salary(jobs):\n    if not jobs:\n        return 0\n    return round(sum(j['salary'] for j in jobs) / len(jobs))");
  await item.getByRole("button", { name: /Check my answer/ }).click();
  await expect(item).toContainText("Correct! Your code passes every test.", { timeout: 30_000 });
});

// Excel formula exercises (drills.js "sheet", excelcheck.js): a typed result is refused, a wrong formula shows its value,
// the right formula passes.
test("excel formulas: a typed number is refused, the right formula passes", async ({ page }) => {
  await open(page, "#/course/excel");
  await page.locator('section[data-page="course"] [role=tab]').filter({ hasText: "Practice" }).click();
  const item = page.locator('section[data-page="course"] [role=tabpanel] ol.grid > li').filter({ has: page.locator('[data-drill="sheet"]') }).nth(1);
  const input = item.locator('[data-drill="sheet"] input');
  const check = item.getByRole("button", { name: /Check my answer/ });
  await input.fill("=99000"); await check.click();
  await expect(item).toContainText("Use the cells of the sheet");
  await input.fill('=SUMIFS(D2:D7,E2:E7,"Paris")'); await check.click();
  await expect(item).toContainText("not the expected result yet");
  await input.fill('=SUMIFS(D2:D7,D2:D7,">=47000",E2:E7,"paris")'); await check.click();
  await expect(item).toContainText("Correct! Your formula returns 99000");
});

// pandas in the browser (copy-pyodide.mjs downloads its files at build time; CI must have them, a local build without
// network skips this test): a pandas exercise passes its hidden tests.
test("runnable pandas: a pandas answer passes its hidden tests", async ({ page, request }) => {
  test.setTimeout(180_000);
  const lock = await (await request.get("/js/vendor/pyodide/pyodide-lock.json")).json();
  const wheel = (await request.get(`/js/vendor/pyodide/${lock.packages.pandas.file_name}`)).status();
  if (!process.env.CI) test.skip(wheel !== 200, "pandas files not downloaded in this local build");
  expect(wheel, "pandas file served by the site").toBe(200);
  await open(page, "#/course/pandas");
  await page.locator('section[data-page="course"] [role=tab]').filter({ hasText: "Practice" }).click();
  const item = page.locator('section[data-page="course"] [role=tabpanel] ol.grid > li').filter({ hasText: "top_companies" }).first();
  await item.locator("textarea").fill('import pandas as pd\n\ndef top_companies(df, n=3):\n    return df["company"].value_counts().head(n).index.tolist()');
  await item.getByRole("button", { name: /Check my answer/ }).click();
  await expect(item).toContainText("Correct! Your code passes every test.", { timeout: 150_000 });
});

// Password reset (js/auth.js): no e-mail is sent here (Supabase rate-limits them); the checks before sending and the
// new-password form are tested.
test("forgot password asks for the e-mail first; the new-password form checks length and match", async ({ page }) => {
  await open(page, "#/");
  await page.locator("#authOpen").click();
  await page.locator("#doForgot").click();
  await expect(page.locator("#authMsg")).toContainText("Enter your email address above first");
  await page.locator("#authClose").click();
  await open(page, "#/account");
  await expect(page.locator("#changePassword")).toBeHidden();
  await page.evaluate(() => document.querySelector("#pwDialog").showModal());
  await page.locator("#newPassword").fill("short");
  await page.locator("#newPassword2").fill("short");
  await page.locator("#pwSave").click();
  await expect(page.locator("#pwMsg")).toContainText("at least 8 characters");
  await page.locator("#newPassword").fill("long enough 1");
  await page.locator("#newPassword2").fill("long enough 2");
  await page.locator("#pwSave").click();
  await expect(page.locator("#pwMsg")).toContainText("two passwords are different");
});

// Admin page (js/admin.js): a guest gets the sign-in message, no statistics, and no Admin link on the Account page.
test("admin page: guests see no statistics and no admin link", async ({ page }) => {
  await open(page, "#/admin");
  await expect(page.locator("#h-admin")).toBeVisible();
  await expect(page.locator("#adminRoot")).toContainText("Sign in with an administrator account");
  await open(page, "#/account");
  await expect(page.locator("#adminLink")).toBeHidden();
});

// Training step 2e: "fix this query" opens on the broken query; a query plan exercise checks the index is used.
test("SQL practice: fix this query (NOT IN with NULL) and a query plan that must use an index", async ({ page }) => {
  await open(page, "#/course/sql");
  await page.locator('section[data-page="course"] [role=tab]').filter({ hasText: "Practice" }).click();
  const fix = page.locator("[data-sql-runner]").filter({ has: page.getByRole("button", { name: /Start again/ }) }).nth(2);
  await expect(fix.locator("textarea")).toHaveValue(/NOT IN/);
  await fix.getByRole("button", { name: /Check my answer/ }).click();
  await expect(fix).toContainText("your query returns no rows", { timeout: 15_000 });
  await fix.locator("textarea").fill("SELECT c.customer_id FROM dim_customer c WHERE c.is_current = 1 AND NOT EXISTS (SELECT 1 FROM fact_sales f WHERE f.customer_key = c.customer_key AND f.date_key >= 20250501)");
  await fix.getByRole("button", { name: /Check my answer/ }).click();
  await expect(fix).toContainText("Correct!", { timeout: 15_000 });
  await fix.getByRole("button", { name: /Start again/ }).click();
  await expect(fix.locator("textarea")).toHaveValue(/NOT IN/);

  const plan = page.locator("[data-sql-runner]").filter({ has: page.getByRole("button", { name: /Start again/ }) }).nth(3);
  await plan.getByRole("button", { name: /Check my answer/ }).click();
  await expect(plan).toContainText("does not use the index", { timeout: 15_000 });
  await plan.locator("textarea").fill("EXPLAIN QUERY PLAN SELECT SUM(amount) FROM fact_sales WHERE date_key BETWEEN 20250301 AND 20250331");
  await plan.getByRole("button", { name: /Check my answer/ }).click();
  await expect(plan).toContainText("Correct!", { timeout: 15_000 });
});

// Auto-graded formats (training steps 2b + 2c, js/drills.js): a wrong answer is explained, a right one marks the
// exercise solved.
const practice = async (page, id) => {
  await open(page, `#/course/${id}`);
  await page.locator('section[data-page="course"] [role=tab]').filter({ hasText: "Practice" }).click();
};
const solvedBadge = (drill) => drill.locator("xpath=ancestor::li[1]").locator(".badge", { hasText: "Solved" });

test("practice formats for support and DevOps: regex, cron, log analysis, jq", async ({ page }) => {
  await practice(page, "linux-bash");
  const rx = page.locator('[data-drill="regex"]').first();
  await rx.getByLabel("Your regular expression").fill("5\\d\\d");
  await rx.getByRole("button", { name: /Check my answer/ }).click();
  await expect(rx).toContainText("should not be", { timeout: 10_000 });
  await rx.getByLabel("Your regular expression").fill('" 5\\d{2} ');
  await rx.getByRole("button", { name: /Check my answer/ }).click();
  await expect(rx).toContainText("Correct!", { timeout: 10_000 });
  await expect(solvedBadge(rx)).toBeVisible();

  const cron = page.locator('[data-drill="cron"]').first();
  await cron.getByLabel("Your cron expression").fill("*/15 8-17 * * *");
  await cron.getByRole("button", { name: /Check my answer/ }).click();
  await expect(cron).toContainText("other times");
  await cron.getByLabel("Your cron expression").fill("0,15,30,45 8-17 * * mon-fri");
  await cron.getByRole("button", { name: /Check my answer/ }).click();
  await expect(cron).toContainText("Same schedule");

  const logs = page.locator('[data-drill="logs"]').first();
  await logs.getByLabel("Filter the lines").fill("accepted");
  await expect(logs).toContainText("1 of 65 lines");
  await logs.getByLabel(/most failed logins/).fill("203.0.113.45");
  await logs.getByLabel(/in total/).fill("62");
  await logs.getByLabel(/logged in successfully/).fill("Deploy");
  await logs.getByRole("button", { name: /Check my answer/ }).click();
  await expect(logs).toContainText("1 answer is not right yet");
  await logs.getByLabel(/in total/).fill("63");
  await logs.getByRole("button", { name: /Check my answer/ }).click();
  await expect(logs).toContainText("Correct!");

  await practice(page, "kubernetes");
  const jq = page.locator('[data-drill="json"]').first();
  await jq.getByLabel("Your jq filter").fill(".items[] | .metadata.name");
  await jq.getByRole("button", { name: /Check my answer/ }).click();
  await expect(jq).toContainText("returns 8 value(s), the expected answer returns 2");
  await jq.getByLabel("Your jq filter").fill('[.items[] | select(.status.phase == "Running" | not)]');
  await jq.getByRole("button", { name: /Check my answer/ }).click();
  await expect(jq).toContainText("could not read this filter");
  await jq.getByLabel("Your jq filter").fill('.items[] | select(.status.phase != "Running") | .metadata.name');
  await jq.getByRole("button", { name: /Check my answer/ }).click();
  await expect(jq).toContainText("Same output");
});

// "Fix this file" (training step 2d, js/filecheck.js): the starting file fails its checks, the fixed one passes.
test("practice: fix a Dockerfile and a Kubernetes manifest", async ({ page }) => {
  await practice(page, "docker");
  const df = page.locator('[data-drill="fixfile"]').first();
  await expect(df).toContainText("The final image does not run as root");
  await df.getByRole("button", { name: /Check my file/ }).click();
  await expect(df).toContainText("4 checks still fail", { timeout: 10_000 });
  await expect(df).toContainText("CMD in shell form");
  await df.getByLabel("The file to fix").fill(["FROM node:22-alpine", "WORKDIR /app", "COPY package*.json ./", "RUN npm ci --omit=dev",
    "COPY . .", "USER node", "EXPOSE 3000", 'CMD ["node", "server.js"]'].join("\n"));
  await df.getByRole("button", { name: /Check my file/ }).click();
  await expect(df).toContainText("Every check passes");
  await expect(solvedBadge(df)).toBeVisible();

  await practice(page, "kubernetes");
  const k8s = page.locator('[data-drill="fixfile"]').first();
  await k8s.getByLabel("The file to fix").fill("kind: Deployment\nmetadata:\n\tname: api");
  await k8s.getByRole("button", { name: /Check my file/ }).click();
  await expect(k8s).toContainText("Line 3: the file cannot be read", { timeout: 10_000 });
  await k8s.getByRole("button", { name: /Start again/ }).click();
  await expect(k8s.getByLabel("The file to fix")).toHaveValue(/orders-api:latest/);
});

test("practice formats: order, match, spot the bug, scenario, fill in", async ({ page }) => {
  await practice(page, "terraform");
  const ord = page.locator('[data-drill="order"]').first();
  const want = ["Write the configuration in .tf files", "terraform init", "terraform validate", "terraform plan", "terraform apply"];
  for (let pos = 0; pos < want.length; pos++) { // move the right step up to each position
    const texts = await ord.locator("li").allInnerTexts();
    let from = texts.findIndex((x) => x.includes(want[pos]));
    while (from > pos) { await ord.locator("li").nth(from).getByRole("button", { name: "Move up" }).click(); from--; }
  }
  await ord.getByRole("button", { name: /Check my answer/ }).click();
  await expect(ord).toContainText("right order");
  const fill = page.locator('[data-drill="fill"]').first();
  await fill.getByLabel("Blank 1").fill(" Resource ");
  await fill.getByLabel("Blank 2").fill("aws_s3_bucket.logs.id");
  await fill.getByRole("button", { name: /Check my answer/ }).click();
  await expect(fill).toContainText("Correct!");

  await practice(page, "git");
  const m = page.locator('[data-drill="match"]').first();
  await m.getByLabel("git status").selectOption("Show what is staged, modified or untracked");
  await m.getByLabel("git diff").selectOption("Show the changes not staged yet, line by line");
  await m.getByLabel("git log --oneline").selectOption("Show the history, one commit per line");
  await m.getByLabel("git restore app.py").selectOption("Put uncommitted changes aside to get a clean working tree");
  await m.getByLabel("git stash").selectOption("Throw away the unstaged changes in app.py");
  await m.getByRole("button", { name: /Check my answer/ }).click();
  await expect(m).toContainText("3 of 5 right");
  await m.getByLabel("git restore app.py").selectOption("Throw away the unstaged changes in app.py");
  await m.getByLabel("git stash").selectOption("Put uncommitted changes aside to get a clean working tree");
  await m.getByRole("button", { name: /Check my answer/ }).click();
  await expect(m).toContainText("Every pair matches");

  await practice(page, "docker");
  const bug = page.locator('[data-drill="bug"]').first();
  await bug.getByRole("button", { name: "Line 2", exact: true }).click();
  await expect(bug).toContainText("Line 2 is fine");
  await bug.getByRole("button", { name: "Line 3", exact: true }).click();
  await expect(bug).toContainText("Found it");
  const li = bug.locator("xpath=ancestor::li[1]");
  await li.getByRole("button", { name: "Reveal the answer" }).click();
  await expect(li).toContainText("WORKDIR /app");

  await practice(page, "agile-scrum");
  const sc = page.locator('[data-drill="scenario"]').first();
  await sc.getByRole("button", { name: /starts on it right away/ }).click();
  await expect(sc).toContainText("Risky.");
  await sc.getByRole("button", { name: /Send the request to the Product Owner/ }).click();
  await sc.getByRole("button", { name: "Next →" }).click();
  await sc.getByRole("button", { name: /Add it to the Product Backlog/ }).click();
  await sc.getByRole("button", { name: "Next →" }).click();
  await sc.getByRole("button", { name: /Show the Increment/ }).click();
  await sc.getByRole("button", { name: "Finish" }).click();
  await expect(sc).toContainText("2 of 3 decisions right the first time");
});

// Learn smarter (training step 3): spaced-repetition reviews and the skill check (js/srs.js, review.js, skillcheck.js).
test("reviews: flashcards are scheduled, due cards show on Home and come back in a review session", async ({ page }) => {
  // Grading a card in a course's Flashcards schedules it.
  await open(page, "#/course/git");
  await page.locator('section[data-page="course"] [role=tab]').filter({ hasText: "Flashcards" }).click();
  await page.locator(".flip").first().click();
  await page.getByRole("button", { name: "✓ I knew it" }).click();
  const srs = await page.evaluate(() => JSON.parse(localStorage.getItem("hk.srs") || "{}"));
  expect(Object.values(srs.git || {})[0]).toMatchObject({ box: 2 });
  // Two SQL cards overdue: Home lists them, the review session asks them, "Again" brings one back once more.
  await page.evaluate(() => localStorage.setItem("hk.srs", JSON.stringify({ sql: { "0:0": { box: 2, due: 0, at: 1 }, "0:1": { box: 2, due: 0, at: 1 } } })));
  await open(page, "#/");
  await expect(page.locator("[data-review-due]")).toContainText("2 flashcards to review today");
  await page.locator("[data-review-due]").getByRole("link", { name: /Review now/ }).click();
  const body = page.locator("#reviewBody");
  await expect(body).toContainText("Card 1 of 2");
  await body.locator(".flip").click();
  await body.getByRole("button", { name: "↻ Again" }).click();
  await body.locator(".flip").click();
  await body.getByRole("button", { name: "✓ I knew it" }).click();
  await expect(body).toContainText("Once more");
  await body.locator(".flip").click();
  await body.getByRole("button", { name: "✓ I knew it" }).click();
  await expect(body).toContainText("Review done");
  await expect(body).toContainText("1 of 2 cards known the first time");
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("hk.srs")).sql);
  expect(Object.values(after).map((x) => x.box).sort()).toEqual([1, 3]); // missed → box 1, known → box 3
  await body.getByRole("link", { name: "Back home" }).click();
  await expect(page.locator("[data-review-due]")).toHaveCount(0);
  await page.evaluate(() => { location.hash = "#/review"; });
  await expect(page.locator("#reviewBody")).toContainText("Nothing to review today");
  await expect(page.locator("#reviewBody")).toContainText("come back tomorrow");
});

test("skill check: a skill proved with 3 of 4 right is marked known and skipped", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("hk.path", "de"));
  await open(page, "#/skillcheck");
  const body = page.locator("#skillcheckBody");
  await body.getByRole("button", { name: "Clear" }).click();
  await expect(body.getByRole("button", { name: "Pick at least one skill" })).toBeDisabled();
  await body.locator('input[type=checkbox][value="sql"]').check();
  await body.getByRole("button", { name: "Start the check (1 skill)" }).click();
  // Answer from the course's cheat sheet (the right answer every time).
  const pairs = await page.evaluate(async () => (await (await fetch("content/courses/sql.json")).json()).cheatsheet.flatMap((g) => g.items));
  for (let i = 0; i < 4; i++) {
    await expect(body).toContainText(`Question ${i + 1} of 4`);
    const toMeaning = (await body.locator(".eyebrow").innerText()).includes("What does this do");
    const prompt = (await body.locator("p.text-lg").innerText()).trim();
    const want = toMeaning ? pairs.find(([f]) => f === prompt)[1] : pairs.find(([, b]) => b === prompt)[0];
    await body.locator("button.opt", { hasText: want }).filter({ hasText: new RegExp(`^${want.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) }).first().click();
    await body.getByRole("button", { name: i < 3 ? "Next question →" : "See my results" }).click();
  }
  await expect(body).toContainText("1 skill you already know");
  await expect(body).toContainText("4 of 4 right");
  await open(page, "#/training");
  await expect(page.locator('#courseList a[href="#/course/sql"]')).toContainText("Known");
});

// Offer coach (ROADMAP 2.8) and e-mail reminders (2.2): an offer in the tracker is compared with the market.
test("offer coach: an offer is placed on the market range, and the negotiation prompt is ready", async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem("seeded")) return;
    localStorage.setItem("seeded", "1");
    localStorage.setItem("hk.path", "de");
    const now = new Date().toISOString();
    localStorage.setItem("hk.applications.v1", JSON.stringify([{ id: "a1", path_id: "de", title: "Data Engineer", company: "Acme", stage: "offer",
      salary: "", history: [{ stage: "applied", at: now }, { stage: "offer", at: now }], created_at: now }]));
    // Salaries seen on the Offers page for the path (the coach's reference on a test server): 40 to 60 k€.
    const rows = [40, 44, 48, 50, 52, 56, 60].map((k, i) => ({ k: `o${i}`, at: Date.now(), s: [], r: null, l: null, p: 1, e: k * 1000 }));
    localStorage.setItem("hk.pulse.de", JSON.stringify(rows));
  });
  await open(page, "#/");
  const action = page.locator("#homeActions li", { hasText: "Offer received" });
  await expect(action).toBeVisible();
  await action.getByRole("button", { name: "Negotiate →" }).click();
  const coach = page.locator("#coachDialog");
  await expect(coach).toContainText("Market for");
  await coach.getByLabel("Salary offered").fill("49k €"); // market: middle half 48–56 k€, median 50 k€
  await expect(coach.locator("[data-verdict]")).toHaveAttribute("data-verdict", "lower");
  await coach.getByLabel("Salary offered").fill("3 000 € brut mensuel");
  await expect(coach).toContainText("Below the market");
  await expect(coach.getByLabel("Prompt")).toHaveValue(/Data Engineer at Acme[\s\S]*3 000 € brut mensuel/);
  await coach.getByRole("button", { name: "Save to the application" }).click();
  await expect(coach.getByRole("button", { name: "Save to the application" })).toBeHidden();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("hk.applications.v1"))[0].salary)).toBe("3 000 € brut mensuel");
  await coach.getByRole("button", { name: "Close" }).click();
  // The tracker card has the coach too; e-mail reminders need an account.
  await page.evaluate(() => { location.hash = "#/applications"; });
  await expect(page.locator("#board button", { hasText: "💼 Negotiate" })).toBeVisible();
  await page.evaluate(() => { location.hash = "#/account"; });
  await expect(page.locator("#remindersPanel")).toContainText("Sign in to get them");
});

test("French interface and back to English", async ({ page }) => {
  await open(page);
  await page.click("#langToggle");
  await expect(page.locator('#nav a[data-route="home"]')).toContainText("Accueil", { timeout: 15_000 });
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await page.click("#langToggle");
  await expect(page.locator('#nav a[data-route="home"]')).toContainText("Home", { timeout: 15_000 });
});

// In English and in French (longer words: "Connexion", "Aucun parcours pour l’instant" once made Home 50 px too wide).
for (const lang of ["en", "fr"]) {
  test(`phone width (${lang}): no page scrolls sideways`, async ({ page }) => {
    await page.addInitScript((l) => localStorage.setItem("hk.lang", l), lang);
    await page.setViewportSize({ width: 375, height: 812 });
    for (const route of ["", "offers", "training", "ai", "cv", "interview", "applications", "skillcheck", "review"]) {
      await open(page, `#/${route}`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `#/${route} is wider than the screen (${lang})`).toBeLessThanOrEqual(0);
    }
  });
}
