// Skill extraction and CV ↔ offer matching. Runs entirely in the browser: CV text never leaves the device.
//
// SKILLS is a dictionary of [canonical name, category, aliases]. Aliases are matched case- and
// accent-insensitively on word boundaries, in English and French. The career-path keywords from the
// database are added at runtime (addKeywords), so every path keyword is detectable too.
// Course index entries (content/courses/index.json) must use these canonical names so missing skills link to a course.
//
// CV files: readCvFile() reads PDF (pdf.js 4.4.168 from cdnjs, loaded only when needed) or plain text.
// The CV text is stored by app.js in localStorage ("hk.cv.text") only; never send it to Supabase or any API.

export const SKILLS = [
  // Languages
  ["SQL", "Languages", ["sql", "t-sql", "pl/sql", "plsql", "tsql"]],
  ["Python", "Languages", ["python"]],
  ["Java", "Languages", ["java"]],
  ["Scala", "Languages", ["scala"]],
  ["JavaScript", "Languages", ["javascript", "js", "typescript", "node.js", "nodejs"]],
  ["C#", "Languages", ["c#", ".net", "dotnet"]],
  ["Bash", "Languages", ["bash", "shell", "shell scripting", "scripting shell"]],
  ["PowerShell", "Languages", ["powershell"]],
  ["Golang", "Languages", ["golang"]],
  ["VBA", "Languages", ["vba"]],
  ["DAX", "Languages", ["dax"]],
  // Data & BI
  ["ETL", "Data & BI", ["etl"]],
  ["ELT", "Data & BI", ["elt"]],
  ["Spark", "Data & BI", ["spark", "pyspark", "apache spark"]],
  ["Airflow", "Data & BI", ["airflow", "apache airflow"]],
  ["dbt", "Data & BI", ["dbt"]],
  ["Kafka", "Data & BI", ["kafka"]],
  ["Databricks", "Data & BI", ["databricks"]],
  ["Snowflake", "Data & BI", ["snowflake"]],
  ["BigQuery", "Data & BI", ["bigquery", "big query"]],
  ["Hadoop", "Data & BI", ["hadoop", "hive", "hdfs"]],
  ["Talend", "Data & BI", ["talend"]],
  ["Informatica", "Data & BI", ["informatica"]],
  ["Data modeling", "Data & BI", ["data modeling", "data modelling", "modelisation de donnees", "modelisation des donnees", "star schema", "schema en etoile"]],
  ["Data warehouse", "Data & BI", ["data warehouse", "datawarehouse", "entrepot de donnees", "dwh"]],
  ["Data lake", "Data & BI", ["data lake", "datalake", "lakehouse"]],
  ["Data quality", "Data & BI", ["data quality", "qualite des donnees", "qualite de donnees"]],
  ["Data cleaning", "Data & BI", ["data cleaning", "data cleansing", "nettoyage des donnees", "nettoyage de donnees"]],
  ["Power BI", "Data & BI", ["power bi", "powerbi"]],
  ["Tableau", "Data & BI", ["tableau software", "tableau desktop", "tableau"]],
  ["Looker", "Data & BI", ["looker", "looker studio", "data studio"]],
  ["Qlik", "Data & BI", ["qlik", "qlikview", "qlik sense"]],
  ["Excel", "Data & BI", ["excel", "pivot tables", "pivot table"]],
  ["Pandas", "Data & BI", ["pandas"]],
  ["NumPy", "Data & BI", ["numpy"]],
  ["Scikit-learn", "Data & BI", ["scikit-learn", "sklearn", "scikit learn"]],
  ["Machine learning", "Data & BI", ["machine learning", "apprentissage automatique", "ml"]],
  ["Statistics", "Data & BI", ["statistics", "statistiques", "statistical", "statistique"]],
  ["A/B testing", "Data & BI", ["a/b testing", "ab testing", "a/b test", "tests a/b"]],
  ["Data visualization", "Data & BI", ["data visualization", "data visualisation", "dataviz", "visualisation de donnees"]],
  ["KPI", "Data & BI", ["kpi", "kpis", "indicateurs de performance"]],
  // Plain "SAS" is also a French company form (e.g. "Acme SAS"), so only specific forms count.
  ["SAS", "Data & BI", ["sas base", "sas enterprise", "sas viya", "sas programming", "langage sas", "sas/stat"]],
  // Databases
  ["PostgreSQL", "Databases", ["postgresql", "postgres"]],
  ["MySQL", "Databases", ["mysql"]],
  ["SQL Server", "Databases", ["sql server", "mssql", "ssis", "ssrs"]],
  ["Oracle", "Databases", ["oracle"]],
  ["MongoDB", "Databases", ["mongodb", "mongo"]],
  ["NoSQL", "Databases", ["nosql"]],
  ["Elasticsearch", "Databases", ["elasticsearch", "elastic search", "elk"]],
  // Cloud & DevOps
  ["AWS", "Cloud & DevOps", ["aws", "amazon web services", "s3", "redshift", "glue", "lambda"]],
  ["Azure", "Cloud & DevOps", ["azure", "azure data factory", "adf", "synapse"]],
  ["GCP", "Cloud & DevOps", ["gcp", "google cloud", "google cloud platform"]],
  ["Docker", "Cloud & DevOps", ["docker", "conteneurs", "containers"]],
  ["Kubernetes", "Cloud & DevOps", ["kubernetes", "k8s", "openshift"]],
  ["Terraform", "Cloud & DevOps", ["terraform"]],
  ["CI/CD", "Cloud & DevOps", ["ci/cd", "cicd", "ci cd", "jenkins", "github actions", "gitlab ci", "azure devops"]],
  ["Git", "Cloud & DevOps", ["git", "github", "gitlab", "bitbucket"]],
  ["Linux", "Cloud & DevOps", ["linux", "unix", "red hat", "ubuntu"]],
  ["Windows Server", "Cloud & DevOps", ["windows server", "active directory"]],
  ["REST API", "Cloud & DevOps", ["rest api", "api rest", "restful", "apis rest", "web services", "webservices"]],
  ["Postman", "Cloud & DevOps", ["postman"]],
  // Support & IT operations
  ["ITIL", "Support & IT", ["itil"]],
  ["ServiceNow", "Support & IT", ["servicenow", "service now"]],
  ["Jira Service Management", "Support & IT", ["jira service management", "jsm", "jira service desk"]],
  ["Incident management", "Support & IT", ["incident management", "gestion des incidents", "gestion d'incidents", "incidents"]],
  ["Problem management", "Support & IT", ["problem management", "gestion des problemes"]],
  ["Root cause analysis", "Support & IT", ["root cause analysis", "rca", "analyse des causes"]],
  ["Monitoring", "Support & IT", ["monitoring", "supervision", "observability", "observabilite"]],
  ["Grafana", "Support & IT", ["grafana"]],
  ["Kibana", "Support & IT", ["kibana"]],
  ["Splunk", "Support & IT", ["splunk"]],
  ["Dynatrace", "Support & IT", ["dynatrace", "datadog", "nagios", "zabbix"]],
  ["Log analysis", "Support & IT", ["log analysis", "analyse de logs", "analyse des logs", "logs"]],
  ["SLA", "Support & IT", ["sla", "slas"]],
  ["On-call", "Support & IT", ["on-call", "on call", "astreinte", "astreintes"]],
  ["Batch scheduling", "Support & IT", ["control-m", "autosys", "ordonnanceur", "ordonnancement"]],
  // Methods & business
  ["Agile", "Methods", ["agile", "agilite", "methodes agiles"]],
  ["Scrum", "Methods", ["scrum"]],
  ["Kanban", "Methods", ["kanban"]],
  ["SAFe", "Methods", ["safe agile", "scaled agile", "framework safe", "methode safe"]],
  ["User stories", "Methods", ["user stories", "user story", "recits utilisateurs"]],
  ["Requirements gathering", "Methods", ["requirements gathering", "recueil des besoins", "expression de besoins", "expression des besoins", "specifications fonctionnelles", "functional specifications", "business requirements"]],
  ["BPMN", "Methods", ["bpmn"]],
  ["UML", "Methods", ["uml"]],
  ["Process mapping", "Methods", ["process mapping", "cartographie des processus", "modelisation des processus"]],
  ["Gap analysis", "Methods", ["gap analysis", "analyse des ecarts"]],
  ["UAT", "Methods", ["uat", "user acceptance", "recette", "tests d'acceptation"]],
  ["Stakeholder management", "Methods", ["stakeholder management", "stakeholders", "parties prenantes"]],
  ["Data storytelling", "Methods", ["data storytelling", "storytelling"]],
  ["Jira", "Tools", ["jira"]],
  ["Confluence", "Tools", ["confluence"]],
  ["Figma", "Tools", ["figma"]],
  ["Visio", "Tools", ["visio"]],
  ["Miro", "Tools", ["miro"]],
  ["SAP", "Tools", ["sap"]],
  ["Salesforce", "Tools", ["salesforce"]],
];

export const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[’`]/g, "'");
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Word boundaries that also respect +, # and . so "C#", ".net" and "node.js" work and "git" does not match "github".
const aliasRe = (aliases) =>
  new RegExp(`(?<![a-z0-9+#])(?:${aliases.map((a) => esc(norm(a))).sort((x, y) => y.length - x.length).join("|")})(?![a-z0-9+#]|\\.[a-z0-9])`, "g");

let compiled = SKILLS.map(([name, cat, aliases]) => ({ name, cat, re: aliasRe(aliases) }));
const known = new Set(SKILLS.flatMap(([name, , aliases]) => [norm(name), ...aliases.map(norm)]));

// Adds path keywords from the database that the dictionary does not already cover.
export function addKeywords(names) {
  for (const n of names) {
    const k = norm(n);
    if (!k || known.has(k)) continue;
    known.add(k);
    compiled.push({ name: n, cat: "Path keywords", re: aliasRe([n]) });
  }
}

// Returns the skills found in a text, most mentioned first: [{ name, cat, count }].
export function extractSkills(text) {
  // French "tableau de bord" (dashboard) and "tableau croisé" (pivot table) are not the Tableau product.
  const t = norm(text).replace(/tableaux? de bord/g, "dashboard").replace(/tableaux? croises?( dynamiques?)?/g, "pivot tables");
  if (!t.trim()) return [];
  return compiled
    .map((s, i) => ({ name: s.name, cat: s.cat, count: (t.match(s.re) || []).length, i }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count || a.i - b.i)
    .map(({ name, cat, count }) => ({ name, cat, count }));
}

// How well a CV covers the skills an offer asks for.
// required: skill names from the offer. cvNames: Set of skill names found in the CV.
export function matchSkills(required, cvNames) {
  const matched = required.filter((n) => cvNames.has(n));
  const missing = required.filter((n) => !cvNames.has(n));
  return { matched, missing, total: required.length, score: required.length ? Math.round((matched.length / required.length) * 100) : null };
}

// Text extraction from an uploaded CV (PDF or plain text). pdf.js is loaded only when needed.
const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs";
const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";

export async function readCvFile(file) {
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (!isPdf) return file.text();
  const pdfjs = await import(PDFJS);
  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const content = await (await doc.getPage(p)).getTextContent();
    pages.push(content.items.map((it) => it.str + (it.hasEOL ? "\n" : " ")).join(""));
  }
  return pages.join("\n");
}
