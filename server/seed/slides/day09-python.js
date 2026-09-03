// "Tech Refresher – Python & Automation" (trainer's deck, 16 slides), text carried over slide by
// slide. askAfter on a slide runs that many of the session's questions as a quiz block before the
// next slide: slides 7–11 each ask three, matching "Python & Automation Quiz 1.docx".
export default {
  key: 'day09-python',
  title: 'Tech Refresher – Python & Automation',
  sections: [
    {
      id: 'agenda', title: 'Today',
      slides: [
        {
          title: 'Tech Refresher – Python & Automation',
          bullets: ['Fresher Onboarding Program', 'Python basics to advanced • API, web & file automation', '4-hour session with mini-quizzes after each block'],
          note: 'Set the expectation up front: this is hands-on. After each of the five technical blocks there is a three-question quiz on the interns\' phones; scores and answers are shown at the end.',
        },
        {
          title: 'Agenda',
          bullets: ['Python & Automation – Overview (What / Why / Where it is used)', 'Python Basics – Foundation', 'Advanced Python & Automation – APIs, Playwright, Files', 'Ferguson Context – Where You\'ll Use It', 'AI Leverage & Best Practices', 'Hands-on Exercises & Recap'],
          agenda: [
            { id: 'overview', title: 'Python & Automation – Overview', count: 2, first: ['What / Why / Where it is used'] },
            { id: 'basics', title: 'Python Basics – Foundation', count: 1, first: ['Quiz: 3 questions'] },
            { id: 'advanced', title: 'Advanced Python & Automation', count: 4, first: ['APIs, Playwright, Files', 'Quiz after each block'] },
            { id: 'context', title: 'Ferguson Context', count: 1, first: ['Where you\'ll use it'] },
            { id: 'ai', title: 'AI Leverage & Best Practices', count: 1, first: [] },
            { id: 'recap', title: 'Hands-on Exercises & Recap', count: 3, first: [] },
          ],
          note: 'Six parts. The middle one is the longest and carries three of the five quiz blocks.',
        },
      ],
    },
    {
      id: 'mentors', title: 'Your trainers',
      slides: [
        {
          title: 'Hello, I\'m Subachandran',
          bullets: [
            'Senior QA Engineer | WMS SME | Innovation solution architect | Bengaluru',
            'Electrical & Electronics Engineer by degree, automation addict by diagnosis, QA by profession',
            '98% effort reduction: a 5-day manual grind rebuilt into a 3-hour Python run',
            '40+ custom bots & accelerators built; 50+ associates trained in Python and GenAI prompt engineering',
            'Automated Ferguson\'s "un-automatable" Trilogy; leads within the Ferguson Innovation Council',
          ],
          note: 'Keep this to a minute. The point for the interns: the trainer has done exactly the kind of automation they will be asked to do.',
        },
        {
          title: 'Hello, I\'m Priyadith',
          bullets: [
            'Senior Software Engineer | Python Backend | Cloud & Data Pipelines',
            '99.9% availability on enterprise backend platforms powering Supply Chain & Customer Experience',
            '250k+ product records through the canonical ingestion pipeline on GCP, zero false positives',
            '50% of manual engineering effort automated away; 50%+ regression coverage via Pytest & Playwright',
            'Python, FastAPI, Flask, SQL, Bash; GCP, Azure Databricks, Kafka; Docker, Kubernetes, GitHub Actions',
          ],
          note: 'Same idea: a backend and data-pipeline perspective to balance the QA one.',
        },
      ],
    },
    {
      id: 'overview', title: 'Python & Automation',
      slides: [
        {
          title: 'Python & Automation – At a Glance',
          bullets: [
            'What: high-level, interpreted language; clean, indentation-based syntax; huge standard library + PyPI; runs anywhere, laptop to cloud',
            'Why: easy to learn, fast to build; top choice for automation & AI; massive community & libraries; glues APIs, files, browsers and databases together',
            'Where: automation & scripting; web services & APIs; data engineering & analytics; testing / QA; AI & ML',
          ],
          note: 'Three columns on the original slide: what, why, where. Ask the room where they have already seen Python used.',
        },
        {
          title: 'Session Plan – 4 Hours',
          bullets: [
            'Hour 1 – Python basics: syntax, variables & types; control flow & loops; functions & collections; mini-quiz & Q&A',
            'Hour 2 – Advanced Python: OOP & dataclasses; comprehensions & generators; decorators & error handling; modules, pip & virtual envs',
            'Hours 3–4 – Automation: APIs with requests; web UI with Playwright; files, Excel & pandas; hands-on exercises & recap',
          ],
          note: 'Point out where the quizzes fall: end of basics, end of advanced, and after each of the three automation topics.',
        },
      ],
    },
    {
      id: 'basics', title: 'Python Basics',
      slides: [
        {
          title: 'Python Basics – Language Fundamentals',
          bullets: [
            'Variables & types — int, float, str, bool, None',
            'f-strings — f"Total: {total:.2f}"',
            'Control flow — if / elif / else, for & while',
            'Functions — def, defaults, *args / **kwargs',
            'Collections — list, tuple, set, dict',
            'Indentation is syntax — 4 spaces, no braces',
          ],
          code: { lang: 'python', text: '# basics.py\ndef greet(name):\n    return f"Hello, {name}!"\n\nitems = ["pipe", "valve", "fitting"]\nfor i, item in enumerate(items, 1):\n    print(i, greet(item))\n\nprices = {"pipe": 12.5, "valve": 30.0}\ntotal = sum(prices.values())\nprint(f"Total: {total:.2f}")' },
          askAfter: 3,
          note: 'Walk the code left to right: a function, a loop with enumerate, a dict and an f-string. Then the first quiz: truthiness, list references and the mutable default argument.',
        },
      ],
    },
    {
      id: 'advanced', title: 'Advanced Python & Automation',
      slides: [
        {
          title: 'Advanced Python – Core Concepts',
          bullets: [
            'OOP — classes, inheritance, dunder methods',
            '@dataclass — clean data containers',
            'Comprehensions — one-line transforms',
            'Generators — lazy iteration with yield',
            'Decorators & context managers (with)',
            'Errors — try / except / finally, custom exceptions',
            'venv + pip — isolated project environments',
          ],
          code: { lang: 'python', text: '# advanced.py\nfrom dataclasses import dataclass\n\n@dataclass\nclass Product:\n    sku: str\n    price: float\n    def discounted(self, pct):\n        return self.price * (1 - pct/100)\n\ncheap = [p.sku for p in catalog\n         if p.price < 100]\n\ndef read_lines(path):\n    with open(path) as f:\n        yield from f' },
          askAfter: 3,
          note: 'The quiz after this slide covers dataclass defaults, single-use generators and return inside finally. Make sure generators and finally were actually explained.',
        },
        {
          title: 'API Automation – requests',
          bullets: [
            'HTTP refresher — methods, status codes, JSON',
            'requests — Session, headers, params, timeout',
            'Auth — API keys & Bearer tokens; never hardcode secrets',
            'Validate — raise_for_status(), field assertions',
            'pytest — fixtures & parametrize for API suites',
            'Uses — smoke tests, data pulls, health checks',
          ],
          code: { lang: 'python', text: '# api_check.py\nimport requests\n\ns = requests.Session()\ns.headers["Authorization"] = f"Bearer {tok}"\nr = s.get(f"{BASE}/orders",\n          params={"status": "open"},\n          timeout=10)\nr.raise_for_status()\norders = r.json()\nassert all(o["status"] == "open"\n           for o in orders)' },
          askAfter: 3,
          note: 'Stress timeout=10: requests has no default timeout, which is one of the quiz questions. The pytest question needs stacked parametrize explained.',
        },
        {
          title: 'Web Automation – Playwright',
          bullets: [
            'Cross-browser — Chromium, Firefox, WebKit',
            'Auto-waiting locators — far less flaky than Selenium',
            'Actions — goto, fill, click + expect() assertions',
            'codegen — record clicks, get Python for free',
            'Headless in CI — traces, screenshots, videos',
            'Uses — UI regression, form filling, portals',
          ],
          code: { lang: 'python', text: '# ui_login.py\nfrom playwright.sync_api import sync_playwright\n\nwith sync_playwright() as p:\n    browser = p.chromium.launch()\n    page = browser.new_page()\n    page.goto("https://demo.app/login")\n    page.fill("#user", "trainee")\n    page.fill("#pass", "*****")\n    page.click("text=Sign in")\n    assert "Dashboard" in page.title()' },
          askAfter: 3,
          note: 'If there is time, run playwright codegen live before the quiz: the last question asks what it is for.',
        },
        {
          title: 'File & Data Automation',
          bullets: [
            'pathlib & shutil — create, move, rename, clean up',
            'csv / json built-ins; openpyxl & pandas for Excel',
            'pandas — filter, join, group & aggregate fast',
            're (regex) — parse logs & messy text',
            'Schedule — Task Scheduler, cron, schedule lib',
            'Wins — daily reports, bulk renames, validation',
          ],
          code: { lang: 'python', text: '# daily_report.py\nfrom pathlib import Path\nimport pandas as pd\n\ninbox = Path("reports/inbox")\nframes = [pd.read_csv(f)\n          for f in inbox.glob("*.csv")]\ndf = pd.concat(frames)\nsummary = (df.groupby("branch")["sales"]\n             .sum().sort_values())\nsummary.to_excel("daily_summary.xlsx")' },
          askAfter: 3,
          note: 'Last quiz block: pathlib joining, left joins keeping unmatched rows as NaN, and greedy regex. Mention the non-greedy <.*?> form after the quiz closes.',
        },
      ],
    },
    {
      id: 'context', title: 'Ferguson Context',
      slides: [
        {
          title: 'Ferguson Context – Where You\'ll Use This',
          bullets: [
            'Data pipelines — product data ETL, validation & enrichment',
            'Integrations — internal APIs & vendor systems',
            'QA automation — Playwright UI suites, pytest service tests',
            'Ops automation — file drops, nightly reports, batch jobs',
            'Cloud — Python services & scheduled jobs on GCP',
            'Your first tickets will likely touch code like this',
          ],
          code: { lang: 'text', text: 'Week-1 setup checklist\n• Python 3.12 + VS Code installed\n• Git configured, team repo cloned\n• venv created, requirements installed\n• Playwright browsers installed (playwright install)\n• Team channels & Jira access sorted' },
          note: 'Tie each bullet to a real team or system the interns will meet. The checklist on the right is their homework for week one.',
        },
      ],
    },
    {
      id: 'ai', title: 'AI & Best Practices',
      slides: [
        {
          title: 'AI Leverage & Best Practices',
          bullets: [
            'AI assistants (Copilot, Claude) — draft, explain & refactor code',
            'Treat AI output as a draft — you own what you ship',
            'Good prompts — context + constraints + expected output',
            'Style — PEP 8, small functions, clear names, docstrings',
            'Git everything — branches, PRs, code reviews',
            'Fail loudly — log errors, never swallow exceptions',
          ],
          code: { lang: 'text', text: 'Do\n• Review & test AI-generated code\n• Ask AI to explain unfamiliar code\n• Share useful prompts with the team\n\nDon\'t\n• Paste secrets, keys or credentials\n• Paste customer or internal data\n• Ship code you don\'t understand' },
          note: 'The Don\'t list is the one to slow down on: secrets and customer data never go into a prompt.',
        },
      ],
    },
    {
      id: 'recap', title: 'Recap & Exercises',
      slides: [
        {
          title: 'Recap & Hands-on Exercises',
          bullets: ['Five blocks, five quizzes: basics, advanced, APIs, Playwright, files', 'Scores and the answer review are on your phones now', 'Next: three hands-on exercises'],
          note: 'End the quiz from the host screen before this slide so the interns can see their scores and the answer review while you recap.',
        },
        {
          title: 'Hands-on Exercises',
          bullets: [
            'API automation — GET a public REST API with requests; assert status code & JSON fields; bonus: wrap it as a pytest test',
            'Web UI (Playwright) — automate login on a demo site; assert the dashboard heading; bonus: run headless + screenshot',
            'File automation — merge sample CSVs with pandas; export an Excel summary; bonus: schedule it to run daily',
          ],
          note: 'Pair the interns up. Each exercise mirrors one of the code samples shown earlier.',
        },
        {
          title: 'Thank you!',
          bullets: ['Questions? Let\'s talk!', 'FERGUSON.COM'],
          note: '',
        },
      ],
    },
  ],
};
