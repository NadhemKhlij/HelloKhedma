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

// Opens a route and waits until the career paths came from Supabase (the app is fully started). The path cards are
// on Home only, so they are checked as present, not visible.
async function open(page, hash = "#/") {
  await page.goto(`/index.html${hash}`);
  await expect(page.locator("#paths button").first()).toBeAttached({ timeout: 15_000 });
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
  for (const p of ["de", "da", "ba", "as", "do"]) {
    const n = await page.evaluate(async (id) => (await (await fetch(`/content/projects/${id}.json`)).json()).projects.length, p);
    expect(n, `projects for ${p}`).toBeGreaterThanOrEqual(3);
  }
});

test("AI track in Tunisian: both scripts match, the page and a course work", async ({ page }) => {
  await open(page, "#/ai");
  const problems = await page.evaluate(async () => {
    const { courseTime } = await import("/js/coursetime.js");
    const get = (u) => fetch(u).then((r) => (r.ok ? r.json() : null));
    const len = (x) => (x ? x.length : 0), out = [];
    for (const c of (await get("/content/ai/index.json")).filter((x) => x.status === "ready")) {
      const [ar, lat] = await Promise.all([get(`/content/ai/ar/${c.id}.json`), get(`/content/ai/lat/${c.id}.json`)]);
      if (!ar || !lat) { out.push(`${c.id}: a script file is missing`); continue; }
      if (c.minutes !== courseTime(ar).total || c.lessonCount !== ar.lessons.length) out.push(`${c.id}: index minutes / lessonCount out of date`);
      for (const k of ["lessons", "cheatsheet", "exercises", "pitfalls", "interview"]) if (len(ar[k]) !== len(lat[k])) out.push(`${c.id}: ${k} count differs`);
      ar.lessons.forEach((l, i) => { if ((l.example?.code || "") !== (lat.lessons[i]?.example?.code || "")) out.push(`${c.id}: lesson ${i} code differs`); });
      if (/[؀-ۿ]/.test(JSON.stringify(lat))) out.push(`${c.id}: Arabic letters in the 3arbizi file`);
    }
    return out;
  });
  expect(problems).toEqual([]);
  const first = page.locator('#aiBody a[href^="#/course/ai-"]').first();
  await expect(first).toBeVisible();
  await first.click();
  const panel = page.locator('#courseBody [role=tabpanel]');
  await expect(panel).toHaveAttribute("dir", "rtl");
  await expect(panel.locator("article")).not.toBeEmpty();
  await page.locator("#courseBody").getByRole("tab", { name: "3arbizi" }).click();
  await expect(page.locator('#courseBody [role=tabpanel]')).toHaveAttribute("dir", "ltr");
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

test("AI track projects: both scripts match and a project page works", async ({ page }) => {
  await open(page, "#/ai");
  const problems = await page.evaluate(async () => {
    const get = (u) => fetch(u).then((r) => (r.ok ? r.json() : null));
    const [ar, lat] = await Promise.all([get("/content/ai/ar/projects.json"), get("/content/ai/lat/projects.json")]);
    if (!ar || !lat) return ["a projects file is missing"];
    const out = [], len = (x) => (x ? x.length : 0);
    if (ar.projects.length < 3 || ar.projects.length !== lat.projects.length) out.push("project count");
    ar.projects.forEach((p, i) => {
      const q = lat.projects[i] || {};
      if (p.id !== q.id || !p.id.startsWith("ai-")) out.push(`project ${i} id`);
      for (const k of ["data", "steps", "deliverables", "checklist", "stretch"]) if (len(p[k]) !== len(q[k])) out.push(`${p.id}: ${k} count differs`);
      p.data.forEach((d, j) => { if (d.url !== q.data?.[j]?.url) out.push(`${p.id}: link ${j} differs`); });
    });
    if (/[؀-ۿ]/.test(JSON.stringify(lat))) out.push("Arabic letters in the 3arbizi projects");
    return out;
  });
  expect(problems).toEqual([]);
  const card = page.locator('#aiProjects a[href^="#/project/ai-"]').first();
  await expect(card).toBeVisible();
  await card.click();
  const project = page.locator('section[data-page="project"]');
  await expect(project.locator("h1")).toHaveAttribute("dir", "rtl");
  await project.locator("ol input[type=checkbox]").first().check();
  await expect(project).toContainText("1/");
  await project.getByRole("tab", { name: "3arbizi" }).click();
  await expect(page.locator('section[data-page="project"] h1')).toHaveAttribute("dir", "ltr");
  await expect(page.locator('section[data-page="project"]')).toContainText("1/"); // progress is shared by both scripts
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
