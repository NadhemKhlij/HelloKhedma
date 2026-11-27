// Skill extraction and CV ↔ offer matching. Runs entirely in the browser: CV text never leaves the device.
//
// SKILLS is a dictionary of [canonical name, category, aliases]. Aliases are matched case- and
// accent-insensitively on word boundaries, in English and French. The career-path keywords from the
// database are added at runtime (addKeywords), so every path keyword is detectable too.
// Course index entries (content/courses/index.json) must use these canonical names so missing skills link to a course.
// The French labels of js/fr/skills.js (what a French page shows, i18n.js skillLabel) are matched as aliases too.
//
// CV files: readCvFile() reads PDF (pdf.js 4.4.168 from cdnjs, loaded only when needed; pdfPageText() rebuilds words
// that the PDF splits into pieces) or plain text.
// CV texts are stored by js/cvs.js in localStorage ("hk.cvs") only; never send them anywhere except the
// confirmed "Rewrite with AI" in tailor.js.

import SKILLS_FR from "./fr/skills.js";

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
  ["Microsoft Fabric", "Data & BI", ["microsoft fabric", "fabric lakehouse", "onelake", "dp-700"]],
  ["Snowflake", "Data & BI", ["snowflake"]],
  ["BigQuery", "Data & BI", ["bigquery", "big query"]],
  ["Redshift", "Data & BI", ["redshift", "amazon redshift"]],
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
  // AI engineering (AI engineer track and AI Engineer path, content/ai/)
  ["LLM", "AI & LLM", ["llm", "llms", "large language model", "large language models", "generative ai", "genai", "gen ai", "ia generative", "intelligence artificielle generative"]],
  ["Prompt engineering", "AI & LLM", ["prompt engineering", "prompting", "prompt design"]],
  ["Claude API", "AI & LLM", ["claude api", "anthropic api", "anthropic", "claude sonnet", "claude opus"]],
  ["AI agents", "AI & LLM", ["ai agent", "ai agents", "agentic", "agents ia", "agent ia", "multi-agent"]],
  ["RAG", "AI & LLM", ["rag", "retrieval augmented generation", "retrieval-augmented generation"]],
  ["Vector database", "AI & LLM", ["vector database", "vector db", "pgvector", "pinecone", "qdrant", "weaviate", "chromadb", "embeddings"]],
  ["LLMOps", "AI & LLM", ["llmops", "mlops", "ai observability", "llm evaluation", "llm evals"]],
  ["AI coding tools", "AI & LLM", ["claude code", "github copilot", "copilot", "cursor ai"]],
  ["LangChain", "AI & LLM", ["langchain", "langgraph", "llamaindex"]],
  ["OpenAI API", "AI & LLM", ["openai", "chatgpt api", "gpt-4", "gpt-5"]],
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
  // Capital markets / CIB (2026-11-24, owner preparing application support interviews in investment banks; courses
  // cib-products and cib-trade-lifecycle). No bare "var" (code), "taux" (any rate), "options" or "summit" (common words).
  ["Capital markets", "Capital markets", ["capital markets", "marches de capitaux", "finance de marche", "marches financiers", "cib",
    "corporate and investment banking", "investment banking", "banque de financement et d'investissement", "bfi", "salle de marche", "salles de marche"]],
  ["Derivatives", "Capital markets", ["derivatives", "derivative", "produits derives", "otc derivatives", "derives otc", "interest rate swap", "interest rate swaps",
    "irs", "credit default swap", "credit default swaps", "cds", "futures"]],
  ["Fixed income", "Capital markets", ["fixed income", "bonds", "obligations", "obligataire", "produits de taux", "money market", "marche monetaire", "repo"]],
  ["FX", "Capital markets", ["fx", "forex", "foreign exchange", "marche des changes", "fx swap", "fx swaps", "ndf"]],
  ["Trade lifecycle", "Capital markets", ["trade lifecycle", "trade life cycle", "cycle de vie des operations", "cycle de vie des trades", "front office",
    "middle office", "back office", "front-to-back", "front to back", "trade booking"]],
  ["Murex", "Capital markets", ["murex", "mx.3", "mx3"]],
  ["Calypso", "Capital markets", ["calypso"]],
  ["Trading systems", "Capital markets", ["sophis", "fusion invest", "orchestrade", "kondor", "opics", "summit ft", "finastra summit", "front arena"]],
  ["SWIFT", "Capital markets", ["swift", "mt103", "mt202", "mt300", "mt320", "mt540", "mt541", "mt542", "mt543", "iso 20022"]],
  ["Settlement", "Capital markets", ["settlement", "settlements", "reglement-livraison", "reglement livraison", "dvp", "nostro", "reconciliation", "rapprochement"]],
  ["Market risk", "Capital markets", ["market risk", "risque de marche", "value at risk", "sensitivities", "greeks", "pnl", "p&l explain", "pnl explain"]],
  ["Collateral management", "Capital markets", ["collateral", "collateral management", "margin call", "margin calls", "appel de marge", "appels de marge", "isda", "csa"]],
  ["Regulatory reporting", "Capital markets", ["regulatory reporting", "reporting reglementaire", "emir", "mifid", "mifid ii", "mifir", "sftr", "dodd-frank"]],
  ["Market data", "Capital markets", ["market data", "donnees de marche", "bloomberg", "reuters", "refinitiv", "eikon"]],
  // Software development (audit 2026-11-23: a "Java Fullstack, strong backend" offer only showed Java and Oracle, so a
  // support CV with those two "covered" it 100%). No bare "react" (a common verb) or "spring" (the season).
  ["Backend development", "Software development", ["backend", "back-end", "back end"]],
  ["Frontend development", "Software development", ["frontend", "front-end", "front end"]],
  ["Fullstack development", "Software development", ["fullstack", "full-stack", "full stack"]],
  ["Spring", "Software development", ["spring boot", "spring framework", "spring mvc", "spring cloud", "spring batch", "spring data", "spring security"]],
  ["Angular", "Software development", ["angular", "angularjs"]],
  ["React", "Software development", ["reactjs", "react.js", "react js", "react native", "redux"]],
  ["Vue.js", "Software development", ["vue.js", "vuejs", "nuxt"]],
  ["Microservices", "Software development", ["microservices", "micro-services", "microservice", "micro-service"]],
  ["Hibernate", "Software development", ["hibernate", "jpa"]],
  ["Unit testing", "Software development", ["unit tests", "unit testing", "junit", "jest", "pytest", "tests unitaires"]],
  ["Object-oriented programming", "Software development", ["object-oriented", "object oriented", "oop", "programmation objet", "programmation orientee objet"]],
  ["HTML/CSS", "Software development", ["html", "html5", "css", "css3"]],
  // Cloud & DevOps
  ["AWS", "Cloud & DevOps", ["aws", "amazon web services", "s3", "glue", "lambda"]],
  ["Azure", "Cloud & DevOps", ["azure", "azure data factory", "adf", "synapse"]],
  ["GCP", "Cloud & DevOps", ["gcp", "google cloud", "google cloud platform"]],
  ["Docker", "Cloud & DevOps", ["docker", "conteneurs", "containers"]],
  ["Kubernetes", "Cloud & DevOps", ["kubernetes", "k8s", "openshift"]],
  ["Terraform", "Cloud & DevOps", ["terraform", "opentofu"]],
  ["Ansible", "Cloud & DevOps", ["ansible"]],
  ["Helm", "Cloud & DevOps", ["helm", "helm charts"]],
  ["CI/CD", "Cloud & DevOps", ["ci/cd", "cicd", "ci cd", "jenkins", "github actions", "gitlab ci", "azure devops"]],
  ["Git", "Cloud & DevOps", ["git", "github", "gitlab", "bitbucket"]],
  ["Linux", "Cloud & DevOps", ["linux", "unix", "red hat", "ubuntu"]],
  ["Windows Server", "Cloud & DevOps", ["windows server", "active directory"]],
  ["REST API", "Cloud & DevOps", ["rest api", "rest apis", "api rest", "restful", "apis rest", "web services", "webservices"]],
  ["Postman", "Cloud & DevOps", ["postman"]],
  // Support & IT operations
  ["ITIL", "Support & IT", ["itil"]],
  ["ServiceNow", "Support & IT", ["servicenow", "service now"]],
  ["Jira Service Management", "Support & IT", ["jira service management", "jsm", "jira service desk"]],
  ["Incident management", "Support & IT", ["incident management", "gestion des incidents", "gestion d'incidents", "incidents", "incident"]],
  // French support offers (audit 2026-11-23: most of them named 0 to 2 known skills, so they showed "Fit: n/a").
  ["Application support", "Support & IT", ["application support", "applications support", "production support", "support applicatif", "support applicatifs",
    "support de production", "support n2", "support n3", "support niveau 2", "support niveau 3", "support de niveau 2", "support de niveau 3", "l2 support", "l3 support"]],
  ["User support", "Support & IT", ["user support", "end-user support", "support utilisateurs", "support utilisateur", "assistance utilisateurs", "support fonctionnel", "helpdesk", "help desk", "service desk"]],
  ["Run / MCO", "Support & IT", ["mco", "maintien en condition operationnelle", "maintien en conditions operationnelles", "run informatique", "maintenance applicative", "tma"]],
  ["Ticketing", "Support & IT", ["ticketing", "ticket", "tickets", "gestion des tickets", "gestion de tickets"]],
  ["Troubleshooting", "Support & IT", ["troubleshooting", "diagnostic", "diagnostics", "depannage"]],
  ["Release management", "Support & IT", ["release management", "mise en production", "mises en production", "deploiement", "deploiements", "gestion des releases"]],
  ["Technical documentation", "Support & IT", ["technical documentation", "documentation technique", "knowledge base", "base de connaissance", "base de connaissances", "modes operatoires", "redaction de procedures"]],
  ["Problem management", "Support & IT", ["problem management", "gestion des problemes"]],
  ["Root cause analysis", "Support & IT", ["root cause analysis", "rca", "analyse des causes"]],
  ["Monitoring", "Support & IT", ["monitoring", "supervision", "observability", "observabilite"]],
  ["Grafana", "Support & IT", ["grafana"]],
  ["Prometheus", "Support & IT", ["prometheus", "promql"]],
  ["Kibana", "Support & IT", ["kibana"]],
  ["Splunk", "Support & IT", ["splunk"]],
  ["Dynatrace", "Support & IT", ["dynatrace", "datadog", "nagios", "zabbix", "centreon", "appdynamics"]],
  ["Log analysis", "Support & IT", ["log analysis", "analyse de logs", "analyse des logs", "logs"]],
  ["SLA", "Support & IT", ["sla", "slas"]],
  ["On-call", "Support & IT", ["on-call", "on call", "astreinte", "astreintes"]],
  ["Batch scheduling", "Support & IT", ["control-m", "autosys", "ordonnanceur", "ordonnancement", "vtom", "dollar universe", "$universe"]],
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
  // Product & project (Product Owner "po" and Project Manager "pm" paths, 2026-11-19)
  ["Product management", "Product & project", ["product management", "gestion de produit", "management produit", "product manager"]],
  ["Product discovery", "Product & project", ["product discovery", "discovery produit", "user research", "user interviews", "customer interviews", "entretiens utilisateurs", "recherche utilisateur"]],
  ["Product roadmap", "Product & project", ["product roadmap", "roadmap produit", "roadmapping", "feuille de route produit"]],
  ["Backlog management", "Product & project", ["product backlog", "backlog management", "backlog refinement", "backlog grooming", "gestion du backlog", "affinage du backlog", "backlog produit"]],
  ["Prioritization", "Product & project", ["prioritization", "prioritisation", "priorisation", "moscow", "rice scoring", "rice framework", "wsjf"]],
  ["OKR", "Product & project", ["okr", "okrs", "objectives and key results"]],
  ["Product analytics", "Product & project", ["product analytics", "analytics produit", "mixpanel", "amplitude analytics", "funnel analysis", "retention analysis"]],
  ["PSPO", "Product & project", ["pspo", "cspo", "professional scrum product owner", "certified scrum product owner"]],
  ["Project management", "Product & project", ["project management", "gestion de projet", "gestion de projets", "conduite de projet", "pilotage de projet", "management de projet"]],
  ["Project planning", "Product & project", ["project planning", "planification de projet", "planning projet", "work breakdown structure", "wbs", "gantt", "critical path", "chemin critique", "retroplanning"]],
  ["Risk management", "Product & project", ["risk management", "gestion des risques", "risk register", "registre des risques", "raid log", "management des risques"]],
  ["Change management", "Product & project", ["change management", "conduite du changement", "accompagnement du changement", "gestion du changement"]],
  ["Waterfall", "Product & project", ["waterfall", "cycle en v", "v-model", "methode en cascade"]],
  ["PMP", "Product & project", ["pmp", "pmbok", "capm", "project management professional"]],
  ["PRINCE2", "Product & project", ["prince2", "prince 2"]],
  ["PSM", "Product & project", ["psm i", "psm 1", "professional scrum master", "certified scrummaster", "csm certification"]],
  ["MS Project", "Tools", ["ms project", "microsoft project", "project online", "smartsheet"]],
  ["Trello", "Tools", ["trello", "asana", "monday.com", "clickup"]],
  // Security & compliance (GRC Analyst path "grc", 2026-11-19). No bare "pca" (principal component analysis), "pci",
  // "fair" or "archer": too common elsewhere.
  ["GRC", "Security & compliance", ["grc", "governance risk and compliance", "governance, risk and compliance", "governance, risk & compliance", "gouvernance risques et conformite", "gouvernance, risques et conformite"]],
  ["Information security", "Security & compliance", ["information security", "infosec", "cybersecurity", "cyber security", "cybersecurite", "securite de l'information", "securite des systemes d'information", "ssi"]],
  ["ISO 27001", "Security & compliance", ["iso 27001", "iso/iec 27001", "iso27001", "iso 27002", "isms", "smsi"]],
  ["NIST CSF", "Security & compliance", ["nist csf", "nist cybersecurity framework", "nist 800-53", "nist sp 800-53"]],
  ["IT risk management", "Security & compliance", ["it risk", "it risk management", "cyber risk", "risque cyber", "risques cyber", "risk assessment", "analyse de risques", "analyse des risques", "ebios", "ebios rm", "iso 27005", "iso 31000"]],
  ["Compliance", "Security & compliance", ["compliance", "regulatory compliance", "conformite reglementaire", "mise en conformite"]],
  ["GDPR", "Security & compliance", ["gdpr", "rgpd", "general data protection regulation", "data protection", "protection des donnees", "dpia", "aipd", "privacy impact assessment"]],
  ["NIS2", "Security & compliance", ["nis2", "nis 2", "nis directive", "directive nis"]],
  ["DORA", "Security & compliance", ["dora", "digital operational resilience act"]],
  ["SOC 2", "Security & compliance", ["soc 2", "soc2", "soc 2 type ii", "soc 1"]],
  ["PCI DSS", "Security & compliance", ["pci dss", "pci-dss", "pci compliance"]],
  ["Internal controls", "Security & compliance", ["internal controls", "internal control", "controle interne", "sox", "sarbanes-oxley", "itgc", "it general controls", "cobit"]],
  ["IT audit", "Security & compliance", ["it audit", "audit it", "audit si", "audit des systemes d'information", "internal audit", "audit interne", "security audit", "audit de securite"]],
  ["Security policies", "Security & compliance", ["security policy", "security policies", "information security policy", "politique de securite", "pssi"]],
  ["Third-party risk", "Security & compliance", ["third-party risk", "third party risk", "tprm", "vendor risk", "vendor risk management", "supplier risk", "risque fournisseurs", "evaluation des fournisseurs"]],
  ["Business continuity", "Security & compliance", ["business continuity", "continuite d'activite", "plan de continuite", "bcp", "disaster recovery", "plan de reprise"]],
  ["Vulnerability management", "Security & compliance", ["vulnerability management", "gestion des vulnerabilites", "vulnerability scanning", "vulnerability assessment"]],
  ["Security awareness", "Security & compliance", ["security awareness", "sensibilisation a la securite", "sensibilisation cyber", "phishing simulation"]],
  ["CISA", "Security & compliance", ["cisa", "certified information systems auditor"]],
  ["CRISC", "Security & compliance", ["crisc"]],
  ["CISSP", "Security & compliance", ["cissp", "cism"]],
  ["Security+", "Security & compliance", ["comptia security+", "security+"]],
  ["GRC tools", "Tools", ["servicenow grc", "servicenow irm", "rsa archer", "archer grc", "onetrust", "vanta", "drata", "metricstream"]],
  ["Jira", "Tools", ["jira"]],
  ["Confluence", "Tools", ["confluence"]],
  ["Figma", "Tools", ["figma"]],
  ["Visio", "Tools", ["visio"]],
  ["Miro", "Tools", ["miro"]],
  ["SAP", "Tools", ["sap"]],
  // Marketing (Digital Marketing path "mk", 2026-11-09)
  ["SEO", "Marketing", ["seo", "search engine optimization", "search engine optimisation", "referencement naturel"]],
  ["Google Ads", "Marketing", ["google ads", "google adwords", "adwords", "paid search", "sea", "referencement payant", "search ads"]],
  ["Paid social", "Marketing", ["paid social", "social ads", "meta ads", "facebook ads", "instagram ads", "linkedin ads", "tiktok ads"]],
  ["Social media marketing", "Marketing", ["social media marketing", "social media", "reseaux sociaux", "community management", "community manager"]],
  ["Content marketing", "Marketing", ["content marketing", "marketing de contenu", "content strategy", "strategie de contenu", "inbound marketing"]],
  ["Copywriting", "Marketing", ["copywriting", "redaction web", "ux writing"]],
  ["Email marketing", "Marketing", ["email marketing", "e-mail marketing", "emailing", "e-mailing", "newsletter", "newsletters"]],
  ["Marketing automation", "Marketing", ["marketing automation", "hubspot", "marketo", "brevo", "sendinblue", "mailchimp", "salesforce marketing cloud", "klaviyo"]],
  ["CRM", "Marketing", ["crm", "customer relationship management", "gestion de la relation client"]],
  ["Google Analytics", "Marketing", ["google analytics", "ga4", "universal analytics"]],
  ["Google Tag Manager", "Marketing", ["google tag manager", "tag management", "plan de taggage"]],
  ["Marketing analytics", "Marketing", ["marketing analytics", "web analytics", "digital analytics", "attribution", "marketing mix modeling", "mmm"]],
  ["Growth marketing", "Marketing", ["growth marketing", "growth hacking", "growth marketer", "acquisition marketing"]],
  ["Conversion rate optimization", "Marketing", ["conversion rate optimization", "conversion rate optimisation", "optimisation du taux de conversion", "landing page optimization"]],
  ["Market research", "Marketing", ["market research", "etude de marche", "etudes de marche", "etudes marketing", "charge d'etudes", "questionnaire design", "survey design", "panel"]],
  // Finance (Financial Analyst path "fa", 2026-11-17)
  ["Financial modeling", "Finance", ["financial modeling", "financial modelling", "financial model", "financial models", "modelisation financiere", "three-statement model", "3-statement model", "lbo model"]],
  ["Financial analysis", "Finance", ["financial analysis", "analyse financiere", "ratio analysis", "financial statement analysis", "credit analysis"]],
  ["Financial statements", "Finance", ["financial statements", "income statement", "balance sheet", "cash flow statement", "p&l", "profit and loss", "etats financiers", "compte de resultat", "tableau des flux de tresorerie"]],
  ["Accounting", "Finance", ["accounting", "comptabilite", "general ledger", "grand livre", "bookkeeping", "accruals"]],
  ["FP&A", "Finance", ["fp&a", "financial planning and analysis", "financial planning & analysis", "financial planning"]],
  ["Budgeting", "Finance", ["budgeting", "budget planning", "budget process", "elaboration budgetaire", "processus budgetaire"]],
  ["Forecasting", "Finance", ["forecasting", "financial forecasting", "rolling forecast", "rolling forecasts", "reforecast", "previsions financieres"]],
  ["Variance analysis", "Finance", ["variance analysis", "budget vs actual", "budget vs actuals", "actual vs budget", "analyse des ecarts"]],
  ["Financial reporting", "Finance", ["financial reporting", "reporting financier", "management reporting", "month-end close", "month end close", "cloture mensuelle"]],
  ["Management control", "Finance", ["management control", "controle de gestion", "controleur de gestion", "cost accounting", "comptabilite analytique", "controlling"]],
  ["Valuation", "Finance", ["valuation", "dcf", "discounted cash flow", "company valuation", "valorisation", "evaluation d'entreprise", "comparable companies"]],
  ["Corporate finance", "Finance", ["corporate finance", "finance d'entreprise", "m&a", "mergers and acquisitions", "wacc", "capital budgeting"]],
  ["IFRS", "Finance", ["ifrs", "us gaap", "gaap", "normes ifrs"]],
  ["EPM tools", "Finance", ["epm", "anaplan", "hyperion", "oracle epm", "tagetik", "adaptive insights", "workday adaptive planning", "pigment", "board international"]],
  // Sales (Sales path "sales", 2026-11-19). No bare "closing" (month-end close in finance) or "quota" alone.
  ["Sales prospecting", "Sales", ["prospecting", "prospection", "prospection commerciale", "lead generation", "generation de leads", "cold calling", "cold call", "phoning", "outbound sales"]],
  ["Business development", "Sales", ["business development", "developpement commercial", "business developer", "new business", "biz dev", "bizdev"]],
  ["Account management", "Sales", ["account management", "key account management", "key account manager", "gestion de comptes", "grands comptes", "comptes cles"]],
  ["Customer success", "Sales", ["customer success", "customer success manager", "fidelisation client", "retention client", "upsell", "upselling", "cross-sell", "cross-selling"]],
  ["Negotiation", "Sales", ["negotiation", "negotiating", "negociation", "negociations commerciales"]],
  ["Sales pipeline management", "Sales", ["pipeline management", "sales pipeline", "pipe commercial", "gestion du pipeline", "sales forecast", "sales forecasting", "previsions commerciales"]],
  ["B2B sales", "Sales", ["b2b sales", "vente b2b", "b2b", "btob", "business to business"]],
  ["SaaS sales", "Sales", ["saas sales", "vente saas", "software sales", "vente de logiciels"]],
  ["Solution selling", "Sales", ["solution selling", "consultative selling", "vente consultative", "value selling", "vente de solutions", "vente complexe"]],
  ["Sales methodologies", "Sales", ["meddic", "meddpicc", "bant", "spin selling", "challenger sale", "sandler"]],
  ["Sales engagement tools", "Sales", ["sales navigator", "linkedin sales navigator", "salesloft", "outreach.io", "lemlist", "apollo.io", "la growth machine", "gong.io", "modjo"]],
  ["Social selling", "Sales", ["social selling"]],
  ["Closing", "Sales", ["deal closing", "closing deals", "close deals", "closer", "conclure des ventes", "signature de contrats"]],
  ["Sales targets", "Sales", ["sales targets", "sales quota", "quota attainment", "objectifs commerciaux", "objectifs de vente", "chiffre d'affaires objectif"]],
  ["Salesforce", "Tools", ["salesforce"]],
];

export const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[’`]/g, "'");
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Word boundaries that also respect +, # and . so "C#", ".net" and "node.js" work and "git" does not match "github".
const aliasRe = (aliases) =>
  new RegExp(`(?<![a-z0-9+#])(?:${aliases.map((a) => esc(norm(a))).sort((x, y) => y.length - x.length).join("|")})(?![a-z0-9+#]|\\.[a-z0-9])`, "g");

const withLabel = (name, aliases) => (SKILLS_FR[name] ? [...aliases, SKILLS_FR[name]] : aliases);
let compiled = SKILLS.map(([name, cat, aliases]) => ({ name, cat, re: aliasRe(withLabel(name, aliases)) }));
const known = new Set(SKILLS.flatMap(([name, , aliases]) => [norm(name), ...withLabel(name, aliases).map(norm)]));

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
  for (let p = 1; p <= doc.numPages; p++) pages.push(pdfPageText((await (await doc.getPage(p)).getTextContent()).items));
  return pages.join("\n");
}

// Rebuilds the text of a PDF page from pdf.js items. Many PDFs (Word, Canva exports) split words into small pieces:
// a space is added only where there is a real gap between two pieces on the same line, a line break where the line
// changes. Private-use glyphs (icon fonts, odd bullets or brackets) become spaces.
export function pdfPageText(items) {
  let out = "", prev = null;
  for (const it of items) {
    const [, , c, d, x, y] = it.transform, size = Math.hypot(c, d) || it.height || 10;
    if (prev && out && !/\s$/.test(out)) {
      const sameLine = Math.abs(y - prev.y) < size * 0.5, gap = x - prev.end;
      if (!sameLine) out += "\n";
      else if (gap > size * 0.15 || gap < -size) out += " ";
    }
    out += it.str.replace(/[\uE000-\uF8FF]/g, " ");
    if (it.hasEOL && !out.endsWith("\n")) out += "\n";
    prev = { y, end: x + (it.width || 0) };
  }
  return out;
}
