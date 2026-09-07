// Quiz sessions taken from the training schedule (weeks 3–4). Flex Fridays, the capstone
// week and the assessment day have no quiz, so they are not listed. Dates are 2026.
//
// A day with two or three trainers is split into one session per trainer ("part"), so each
// trainer owns their unit: their slides, their questions, their join code and their quiz.
// `owner` is the trainer account that manages the session (co-trainers, slides, deletion);
// days led jointly have no owner and stay admin-managed.
export default [
  {
    key: 'day09-python', dayNo: 9, date: '2026-09-03', week: 'Week-3',
    module: 'Programming', title: 'Python',
    subtopics: 'Syntax, OOP, File Handling, API Calls, Automation Scripts, JSON Processing',
    trainers: ['Subachandran G', 'Priyadith'],
    slidesKey: 'day09-python',
  },
  {
    key: 'day11-spring-boot', dayNo: 11, date: '2026-09-07', week: 'Week-3',
    module: 'Backend', title: 'Spring Boot',
    subtopics: 'Dependency Injection, Controllers, Services, API Gateway, Resilience',
    trainers: ['Syed Suhail', 'Saurav Sanyal'],
    trainerEmails: ['syed.suhail@ferguson.com', 'saurav.sanyal@ferguson.com', 'mahesh.j@ferguson.com'],
    slidesKey: 'day11-spring-boot',
  },
  {
    key: 'day12-sql', dayNo: 12, date: '2026-09-08', week: 'Week-3', part: 1, parts: 2,
    module: 'Database', title: 'SQL (Azure SQL)',
    subtopics: 'SQL, Joins, Stored Procedures, Subqueries, Window Functions',
    trainers: ['Dushanth'],
    trainerEmails: ['dushantha.sb@ferguson.com', 'mahesh.j@ferguson.com'],
    owner: 'dushantha.sb@ferguson.com',
    slidesKey: 'day12-sql',
  },
  {
    key: 'day12-mongodb', dayNo: 12, date: '2026-09-08', week: 'Week-3', part: 2, parts: 2,
    module: 'Database', title: 'MongoDB',
    subtopics: 'NoSQL Concepts, Collections, CRUD, Query Operators, Aggregation',
    trainers: ['Vishnu C'],
    trainerEmails: ['vishnu.chaturvedi@ferguson.com', 'mahesh.j@ferguson.com'],
    owner: 'vishnu.chaturvedi@ferguson.com',
    slidesKey: 'day12-mongodb',
  },
  {
    key: 'day13-javascript', dayNo: 13, date: '2026-09-09', week: 'Week-3', part: 1, parts: 2,
    module: 'Frontend', title: 'JavaScript',
    subtopics: 'JavaScript Basics, DOM Events, Fetch, Promises, Async/Await',
    trainers: ['Kaushik C'],
    trainerEmails: ['kaushik.kaushik@ferguson.com'],
    owner: 'kaushik.kaushik@ferguson.com',
    slidesKey: 'day13-javascript',
  },
  {
    key: 'day13-react', dayNo: 13, date: '2026-09-09', week: 'Week-3', part: 2, parts: 2,
    module: 'Frontend', title: 'HTML, CSS & React',
    subtopics: 'HTML, CSS, TypeScript, Components, State, Props, Hooks, Routing',
    trainers: ['Prakash'],
    trainerEmails: ['prakash.ubs@ferguson.com'],
    owner: 'prakash.ubs@ferguson.com',
    slidesKey: 'day13-react',
  },
  {
    key: 'day14-devops', dayNo: 14, date: '2026-09-10', week: 'Week-3', part: 1, parts: 2,
    module: 'DevOps & ETL', title: 'DevOps (Git, Docker, Kubernetes, CI/CD)',
    subtopics: 'Git, Jenkins, Docker, Kubernetes, CI/CD Pipeline',
    trainers: ['Ravi Chabria'],
    trainerEmails: ['ravi.chabria@ferguson.com'],
    owner: 'ravi.chabria@ferguson.com',
    slidesKey: 'day14-devops',
  },
  {
    key: 'day14-etl', dayNo: 14, date: '2026-09-10', week: 'Week-3', part: 2, parts: 2,
    module: 'DevOps & ETL', title: 'ETL (Azure & Databricks)',
    subtopics: 'Azure Data Factory, Blob Storage, Databricks, Delta Lake, Spark DataFrames',
    trainers: ['Santoshini'],
    trainerEmails: ['santoshini.panda@ferguson.com'],
    owner: 'santoshini.panda@ferguson.com',
    slidesKey: 'day14-etl',
  },
  {
    key: 'day16-cloud', dayNo: 16, date: '2026-09-15', week: 'Week-4',
    module: 'Cloud', title: 'Cloud Fundamentals',
    subtopics: 'Azure Cloud Overview, Compute, Storage, Networking',
    trainers: ['Ashutosh Singh'],
    trainerEmails: ['ashutosh.singh@ferguson.com'],
    owner: 'ashutosh.singh@ferguson.com',
  },
  {
    key: 'day17-trilogie', dayNo: 17, date: '2026-09-16', week: 'Week-4', part: 1, parts: 3,
    module: 'Domain / ERP', title: 'Trilogie (ERP)',
    subtopics: 'Order-to-Cash, Procure-to-Pay, Branch Operations, Pricing',
    trainers: ['Vidisha / Tejas'],
    trainerEmails: ['vidisha.bhat@ferguson.com'],
    owner: 'vidisha.bhat@ferguson.com',
  },
  {
    key: 'day17-supply-chain', dayNo: 17, date: '2026-09-16', week: 'Week-4', part: 2, parts: 3,
    module: 'Domain / ERP', title: 'Supply Chain (Logility, HighJump)',
    subtopics: 'Demand Planning, Replenishment, Warehouse Management, Inventory',
    trainers: ['Savitha'],
    trainerEmails: ['savita.dodamani@ferguson.com'],
    owner: 'savita.dodamani@ferguson.com',
  },
  {
    key: 'day17-salesforce', dayNo: 17, date: '2026-09-16', week: 'Week-4', part: 3, parts: 3,
    module: 'Domain / ERP', title: 'Salesforce',
    subtopics: 'Sales Cloud, Service Cloud, Commerce Cloud, Objects, Flows',
    trainers: ['Arpitha'],
    trainerEmails: ['arpitha.jh@ferguson.com'],
    owner: 'arpitha.jh@ferguson.com',
  },
  {
    key: 'day18-integration', dayNo: 18, date: '2026-09-17', week: 'Week-4', part: 1, parts: 2,
    module: 'Integration / AI', title: 'Enterprise Integration',
    subtopics: 'REST, SOAP, APIGEE, Kafka, OAuth/JWT',
    trainers: ['Kranthi Kumar'],
    trainerEmails: ['kranthi.kumar@ferguson.com'],
    owner: 'kranthi.kumar@ferguson.com',
    slidesKey: 'day18-integration',
  },
  {
    key: 'day18-ai', dayNo: 18, date: '2026-09-17', week: 'Week-4', part: 2, parts: 2,
    module: 'Integration / AI', title: 'AI Assistance',
    subtopics: 'GitHub Copilot, Gemini, Prompt Engineering',
    trainers: ['Tharun Kumar'],
    trainerEmails: ['tharunkumar.kumart@ferguson.com'],
    owner: 'tharunkumar.kumart@ferguson.com',
    slidesKey: 'day18-ai',
  },
];

/**
 * Keys of the earlier one-session-per-day entries these parts replace. On startup the app
 * removes them from the database when nobody has joined them; a retired session that already
 * holds participants and scores is left alone.
 */
export const retired = ['day12-sql-mongodb', 'day13-frontend', 'day14-devops-etl', 'day17-domain-erp', 'day18-integration-ai'];
