// "Tech Refresher - JavaScript.pptx" (Kaushik C, slides 1–39) followed by "React_HTML_CSS.pptx" (Prakash U B S, slides 40–72)
// Text carried over slide by slide from the trainer's deck; the slides themselves are the exported
// pictures under public/decks/day13-frontend/ (72 slides), so these bullets are talking points.
export default {
  key: "day13-frontend",
  title: "Tech Refresher – JavaScript, HTML, CSS & React",
  sections: [
    {
      id: "agenda",
      title: "Today",
      slides: [
        {
          title: "Tech Refresher - JavaScript",
          bullets: [
            "09th September, 2026",
            "Kaushik C Lead Data Engineer",
            "Basics Core Concepts Hands-on"
          ],
          note: ""
        },
        {
          title: "Agenda",
          bullets: [
            "Foundation",
            "Technology / Domain / Topic Overview",
            "What is JavaScript?",
            "Why and where JavaScript is used",
            "JavaScript in HTML",
            "Basic elements & output",
            "Refresh",
            "Core language concepts",
            "Functions, objects and modern syntax",
            "DOM and events"
          ],
          note: "",
          agenda: [
            {
              id: "mentors",
              title: "Your trainer (JavaScript)",
              count: 1,
              first: [
                "Trainer"
              ]
            },
            {
              id: "js-basics",
              title: "The basics of JavaScript",
              count: 6,
              first: [
                "The Basics of JavaScript",
                "What’s JavaScript???",
                "Why & where Javascript?"
              ]
            },
            {
              id: "js-core",
              title: "Core concepts",
              count: 12,
              first: [
                "Core Concepts",
                "Variables & scope",
                "Conditions"
              ]
            },
            {
              id: "js-context",
              title: "Ferguson context, AI & takeaways",
              count: 5,
              first: [
                "Ferguson Contexts",
                "JavaScript in Enterprise Applications",
                "AI Leverage & Best Practices"
              ]
            },
            {
              id: "js-handson",
              title: "JavaScript hands-on",
              count: 12,
              first: [
                "Hands-on 1: Variables",
                "Hands-on 2: Data Types",
                "Hands-on 3: Operators"
              ]
            },
            {
              id: "js-close",
              title: "JavaScript wrap-up",
              count: 1,
              first: [
                "Thank you!"
              ]
            },
            {
              id: "ui-intro",
              title: "Frontend/UI: intro & roadmap",
              count: 7,
              first: [
                "Tech Refresher – Frontend/UI",
                "Agenda",
                "Trainer Quick Intro"
              ]
            },
            {
              id: "html",
              title: "HTML",
              count: 5,
              first: [
                "HTML: structure",
                "Semantic tags: give the page meaning",
                "Block vs Inline + Attributes"
              ]
            },
            {
              id: "css",
              title: "CSS",
              count: 5,
              first: [
                "Next stop: CSS",
                "The Box Model",
                "Display + Flexbox"
              ]
            },
            {
              id: "typescript",
              title: "TypeScript",
              count: 2,
              first: [
                "Next stop: TypeScript",
                "TypeScript for React"
              ]
            },
            {
              id: "react",
              title: "React",
              count: 10,
              first: [
                "Next stop: React",
                "JSX: markup meets JavaScript",
                "Props vs State"
              ]
            },
            {
              id: "ecosystem",
              title: "Ecosystem & recap",
              count: 2,
              first: [
                "CSS frameworks & icons",
                "Put the pieces together"
              ]
            },
            {
              id: "build",
              title: "Build an app",
              count: 2,
              first: [
                "Build an app",
                "Thank you!"
              ]
            }
          ]
        }
      ]
    },
    {
      id: "mentors",
      title: "Your trainer (JavaScript)",
      slides: [
        {
          title: "Trainer",
          bullets: [
            "Tata Consultancy Services (TCS) – Developer (3.5 years, Chennai)",
            "Stibo Systems India Pvt. Ltd. – Solution Consultant (1.5 years, WFH)",
            "Bosch Global Software Solutions – Developer/Functional Consultant (2.3 years, Coimbatore)",
            "Ferguson Global India – Lead Data Engineer (1.2+ years)",
            "From Coimbatore (Tiruppur), Tamil Nadu",
            "Love to play sports, roam around & be with friends",
            "Kaushik C – Lead Data Engineer (8.5+ years)"
          ],
          note: ""
        }
      ]
    },
    {
      id: "js-basics",
      title: "The basics of JavaScript",
      slides: [
        {
          title: "The Basics of JavaScript",
          bullets: [
            "What it is, why it exists, where it runs"
          ],
          note: ""
        },
        {
          title: "What’s JavaScript???",
          bullets: [
            "JavaScript is a scripting language most often used for client-side web development",
            "JavaScript is an implementation of the ECMAScript Standard",
            "EMCAScript defines the syntax/characteristics of the language",
            "Basic set of commonly used objects such as Numbers, Date, Regular Expression, etc",
            "The JavaScript-supported browsers typically support additional objects",
            "e.g. Windows, Frame, Form, DOM, etc",
            "Different types of versions are available",
            "e.g. JScript is the Microsoft version of JavaScript, ActionScript for Adobe, etc,"
          ],
          note: ""
        },
        {
          title: "Why & where Javascript?",
          bullets: [
            "Interactive user interfaces",
            "Form validation",
            "Dynamic page content",
            "Browser events and user actions",
            "API calls and asynchronous data",
            "Automation and tooling",
            "Web browsers",
            "Frontend frameworks",
            "Backend services with Node.js",
            "Build / test tooling"
          ],
          note: ""
        },
        {
          title: "Simple JavaScript",
          bullets: [],
          note: ""
        },
        {
          title: "Where does JavaScript?",
          bullets: [
            "<script> inside the HTML",
            "Useful for small demonstrations",
            "Can be placed in <head> or <body>",
            "Internal",
            "<script src=\"app.js\"></script>",
            "Preferred for maintainability",
            "Separates HTML and JS",
            "Supports reusable modules",
            "External"
          ],
          note: ""
        },
        {
          title: "Output",
          bullets: [
            "textContent / innerHTML",
            "alert()",
            "console.log()",
            "window.print()",
            "Prefer DOM updates for user-facing output",
            "document.write() is mainly useful for demos/testing and should not be used for normal application UI"
          ],
          note: ""
        }
      ]
    },
    {
      id: "js-core",
      title: "Core concepts",
      slides: [
        {
          title: "Core Concepts",
          bullets: [
            "Functionalities & Fundamentals"
          ],
          note: ""
        },
        {
          title: "Variables & scope",
          bullets: [
            "Variables",
            "let & var — binding can be reassigned",
            "var – function-scoped (legacy)",
            "let & const- block-scoped",
            "Data types",
            "Primitive values: string, number, bigint, boolean, undefined, null, symbol",
            "typeof",
            "Operators",
            "Arithmetic: + - * / % **",
            "Comparison: === !== > < >= <="
          ],
          note: ""
        },
        {
          title: "Conditions",
          bullets: [
            "if / else for branching",
            "switch??",
            "ternary",
            "Loops & Iterations",
            "for, while, break (do while??)",
            "forEach()",
            "map/filter/reduce — transform data",
            "Functions",
            "Global scope",
            "Function scope"
          ],
          note: ""
        },
        {
          title: "Objects & References",
          bullets: [
            "Arrays & value methods",
            "map() — transform",
            "filter() — keep matches",
            "reduce() — accumulate",
            "find() — first match",
            "some()",
            "every()",
            "includes()",
            "Class & prototyes"
          ],
          note: ""
        },
        {
          title: "Exercise 1 — Employee Search",
          bullets: [
            "Given an array of employee objects, search by name",
            "Filter only active employees",
            "Return names sorted alphabetically",
            "Render the result into the DOM",
            "Bonus: show a 'No results' message"
          ],
          note: ""
        },
        {
          title: "Exercise 1 — Requirements",
          bullets: [
            "Maintain information for 3 employees:",
            "Employee Name",
            "Salary",
            "Performance Score",
            "Calculate a 10% bonus for each employee",
            "Calculate the total salary:",
            "Total Salary = Salary + Bonus",
            "Determine the employee's performance category based on their performance score: 80-100 -> Excellent 60-79 -> Good 40-59 -> Average 0-49 -> Needs Improvement",
            "Process all employees using a loop",
            "Display the final results directly on the webpage, not only in the browser console"
          ],
          note: ""
        },
        {
          title: "Fun time",
          bullets: [
            "Using GPT frequently?? Type “Roast me with my chat history” & share the funny ones. "
          ],
          note: ""
        },
        {
          title: "Modules",
          bullets: [
            "DOM Manipulation",
            "class EmployquerySelector() uses CSS selectors",
            "textContent is appropriate when inserting text",
            "classList is useful for UI state changes",
            "Modules make dependencies explicit",
            "Keep modules focused & expose only what other modules need"
          ],
          note: ""
        },
        {
          title: "Events & Event Bubbling",
          bullets: [
            "Event propagation",
            "click",
            "input",
            "change",
            "submit",
            "keydown",
            "DOMContentLoaded",
            "Capture phase",
            "Target phase",
            "Bubble phase"
          ],
          note: ""
        },
        {
          title: "Asynchronous JavaScript",
          bullets: [
            "Common async work",
            "Key concepts",
            "Timers",
            "DOM events",
            "Network requests",
            "File / browser APIs",
            "API responses",
            "Call stack",
            "Web APIs",
            "Task queue"
          ],
          note: ""
        },
        {
          title: "Promises",
          bullets: [
            "Promises states",
            "Why use them?",
            "Timers",
            "DOM events",
            "Network requests",
            "File / browser APIs",
            "API responses",
            "Represent future results",
            "Chain asynchronous work",
            "Centralize error handling"
          ],
          note: ""
        },
        {
          title: "async / await",
          bullets: [
            "APIs, JSON & fetch()",
            "Typical flow",
            "Create HTTP request",
            "Check response status",
            "Parse JSON",
            "Transform data",
            "Update application state / UI",
            "Important detail",
            "fetch() rejects for network-level failures",
            "HTTP 404/500 does not automatically reject"
          ],
          note: ""
        }
      ]
    },
    {
      id: "js-context",
      title: "Ferguson context, AI & takeaways",
      slides: [
        {
          title: "Ferguson Contexts",
          bullets: [],
          note: ""
        },
        {
          title: "JavaScript in Enterprise Applications",
          bullets: [
            "Typical responsibilities",
            "UI interactions",
            "Form validation",
            "API integration",
            "Data transformation",
            "State / UI updates",
            "Error presentation",
            "Engineering expectations",
            "Readable code",
            "Reusable functions"
          ],
          note: ""
        },
        {
          title: "AI Leverage & Best Practices",
          bullets: [
            "Good uses of AI",
            "Explain unfamiliar JavaScript",
            "Generate small examples",
            "Suggest refactoring options",
            "Create test cases",
            "Help diagnose error messages",
            "Summarize API behavior",
            "Engineer remains responsible",
            "Review generated code",
            "Verify syntax and runtime behavior"
          ],
          note: ""
        },
        {
          title: "Technical Checkpoint",
          bullets: [
            "2. What is the difference between == and ===?",
            "3. Explain lexical scope",
            "4. What is a closure?",
            "6. What is event bubbling?",
            "7. Why does fetch() not reject on HTTP 404 by default?",
            "8. Why can Promise.all() be faster than sequential await calls?"
          ],
          note: ""
        },
        {
          title: "Key Takeaways",
          bullets: [
            "JavaScript fundamentals are still critical: types, scope, functions, objects and control flow",
            "Modern syntax improves readability, but the underlying language model still matters",
            "DOM + events explain browser interaction",
            "Promises + async/await explain most application-level asynchronous work",
            "fetch() connects JavaScript to APIs and real data",
            "DevTools should be part of everyday debugging",
            "Use AI as an accelerator — not a replacement for engineering judgment"
          ],
          note: ""
        }
      ]
    },
    {
      id: "js-handson",
      title: "JavaScript hands-on",
      slides: [
        {
          title: "Hands-on 1: Variables",
          bullets: [
            "Simple exercise — let / const",
            "YOUR TASK",
            "Create variables for name, age and isActive",
            "Print all three values",
            "EXPECTED OUTCOME",
            "Console should show the three values. Change age",
            "and observe the output",
            "Tip: run the code, change one value, and observe the result"
          ],
          note: ""
        },
        {
          title: "Hands-on 2: Data Types",
          bullets: [
            "Simple exercise — typeof",
            "YOUR TASK",
            "Create one string, number, boolean and undefined value",
            "Use typeof on each",
            "EXPECTED OUTCOME",
            "You should see string, number, boolean and undefined",
            "Tip: run the code, change one value, and observe the result"
          ],
          note: ""
        },
        {
          title: "Hands-on 3: Operators",
          bullets: [
            "Simple exercise — arithmetic + comparison",
            "YOUR TASK",
            "Calculate total price for 3 items",
            "Check whether the total is greater than 100",
            "EXPECTED OUTCOME",
            "The total is 105, so the comparison should be true",
            "Tip: run the code, change one value, and observe the result"
          ],
          note: ""
        },
        {
          title: "Hands-on 4: Conditions",
          bullets: [
            "Simple exercise — if / else",
            "YOUR TASK",
            "Create a score variable",
            "Print Pass when score >= 50, otherwise Fail",
            "EXPECTED OUTCOME",
            "Change the score to 40 and verify that the result changes",
            "Tip: run the code, change one value, and observe the result"
          ],
          note: ""
        },
        {
          title: "Hands-on 5: Loops",
          bullets: [
            "Simple exercise — for loop",
            "YOUR TASK",
            "Print numbers 1 to 10",
            "Then change the loop to print only even numbers",
            "EXPECTED OUTCOME",
            "First see 1–10. Then use a condition such as i % 2 === 0",
            "Tip: run the code, change one value, and observe the result"
          ],
          note: ""
        },
        {
          title: "Hands-on 6: Functions",
          bullets: [
            "Simple exercise — parameters + return",
            "YOUR TASK",
            "Create add(a, b)",
            "Return the sum and print add(10, 20)",
            "EXPECTED OUTCOME",
            "The output should be 30. Try add(5, 7) next",
            "Tip: run the code, change one value, and observe the result"
          ],
          note: ""
        },
        {
          title: "Hands-on 7: Arrow Functions",
          bullets: [
            "Simple exercise — arrow syntax",
            "YOUR TASK",
            "Create square(n) too",
            "EXPECTED OUTCOME",
            "You should be able to call add(2,3) and square(5)",
            "Tip: run the code, change one value, and observe the result"
          ],
          note: ""
        },
        {
          title: "Hands-on 8: Arrays",
          bullets: [
            "Simple exercise — map()",
            "YOUR TASK",
            "Given prices, create a new array with 10% tax added",
            "Do not change the original array",
            "EXPECTED OUTCOME",
            "Expected result: [110, 220, 330]",
            "Tip: run the code, change one value, and observe the result"
          ],
          note: ""
        },
        {
          title: "Hands-on 9: Arrays",
          bullets: [
            "Simple exercise — filter()",
            "YOUR TASK",
            "From the numbers array, keep only numbers greater than 50",
            "EXPECTED OUTCOME",
            "Expected result: [75, 90, 60]",
            "Tip: run the code, change one value, and observe the result"
          ],
          note: ""
        },
        {
          title: "Hands-on 10: Arrays",
          bullets: [
            "Simple exercise — reduce()",
            "YOUR TASK",
            "Calculate the total of all prices",
            "Start with an accumulator of 0",
            "EXPECTED OUTCOME",
            "Expected total: 350",
            "Tip: run the code, change one value, and observe the result"
          ],
          note: ""
        },
        {
          title: "Hands-on 11: Objects",
          bullets: [
            "Simple exercise — property access + update",
            "YOUR TASK",
            "Create an employee object with name and role",
            "Update the role",
            "EXPECTED OUTCOME",
            "Reading employee.role after the update should return Lead",
            "Tip: run the code, change one value, and observe the result"
          ],
          note: ""
        },
        {
          title: "Hands-on 12: Destructuring",
          bullets: [
            "Simple exercise — object destructuring",
            "YOUR TASK",
            "Extract name and role from employee",
            "Print both values",
            "EXPECTED OUTCOME",
            "You should have two local variables: name and role",
            "Tip: run the code, change one value, and observe the result"
          ],
          note: ""
        }
      ]
    },
    {
      id: "js-close",
      title: "JavaScript wrap-up",
      slides: [
        {
          title: "Thank you!",
          bullets: [
            "FERGUSON.COM"
          ],
          note: ""
        }
      ]
    },
    {
      id: "ui-intro",
      title: "Frontend/UI: intro & roadmap",
      slides: [
        {
          title: "Tech Refresher – Frontend/UI",
          bullets: [
            "Prakash U B S"
          ],
          note: ""
        },
        {
          title: "Agenda",
          bullets: [
            "Technology / Domian / Topic Overview (What/Why/Where it is used)",
            "Basics / Foundation",
            "Core Concepts",
            "Ferguson Context",
            "AI Leverage & Best Practises",
            "Hands-on Exercises"
          ],
          note: ""
        },
        {
          title: "Trainer Quick Intro",
          bullets: [],
          note: ""
        },
        {
          title: "U B S Prakash",
          bullets: [
            "Lead Software Engineer | Salesforce & React Engineer",
            "🚀 11+ Years in Software Engineering",
            "My Journey",
            "💻 Web Development — 11+ years building enterprise applications",
            "⚛️ Frontend Engineering — Strong experience with Angular, React & TypeScript",
            "🏦 Banking Domain — Built and worked on large-scale banking applications",
            "☁️ Salesforce — Currently working extensively with Salesforce development",
            "🏢 Ferguson — 1.5+ years as a Lead Salesforce & React Engineer"
          ],
          note: ""
        },
        {
          title: "Tech Refresher – Frontend/UI",
          bullets: [
            "HTML CSS TypeScript React",
            "A practical bridge from knowing concepts → building software",
            "STRUCTURE",
            "STYLE",
            "Model"
          ],
          note: ""
        },
        {
          title: "The bridge: from college to a real team",
          bullets: [
            "The syntax is only the starting point",
            "College",
            "Solve the problem",
            "Make it work",
            "Individual ownership",
            "Corporate",
            "Understanding the business requirement",
            "Make it maintainable and scalable",
            "Team Collaboration"
          ],
          note: ""
        },
        {
          title: "Roadmap: the frontend stack",
          bullets: [
            "HTML",
            "Structure",
            "CSS",
            "Presentation",
            "TS",
            "Model",
            "React",
            "Behaviour",
            "Debug",
            "RCA"
          ],
          note: ""
        }
      ]
    },
    {
      id: "html",
      title: "HTML",
      slides: [
        {
          title: "HTML: structure",
          bullets: [
            "<main>",
            "<header>",
            "content",
            "<section>",
            "<footer>",
            "HTML = structure",
            "CSS = appearance JS / React = behaviour"
          ],
          note: ""
        },
        {
          title: "Semantic tags: give the page meaning",
          bullets: [
            "Good HTML helps humans, browsers, search engines and assistive tech",
            "<header>",
            "Page / section header",
            "<nav>",
            "Navigation",
            "<main>",
            "Primary content",
            "<section>",
            "Grouped topic",
            "<article>"
          ],
          note: ""
        },
        {
          title: "Block vs Inline + Attributes",
          bullets: [
            "Know what the browser does before CSS changes it",
            "BLOCK",
            "div p h1 section",
            "Starts on a new line Takes available width by default",
            "INLINE",
            "span a strong img",
            "Flows within surrounding content Size follows its content",
            "<button id=\"save\" aria-label=\"Save\">Save</button>"
          ],
          note: ""
        },
        {
          title: "Accessibility in Design Implementation",
          bullets: [
            "Build UI that people can actually use",
            "Label inputs",
            "CODE",
            "<label htmlFor=\"email\">",
            "Alt images",
            "alt=\"Product image\"",
            "Use buttons",
            "<button> over clickable <div>",
            "Headings",
            "h1 → h2 → h3"
          ],
          note: ""
        },
        {
          title: "DOM Tree: the bridge to browser behaviour",
          bullets: [
            "document",
            "body",
            "header",
            "main",
            "footer",
            "button",
            "card",
            "Inspect → understand → debug"
          ],
          note: ""
        }
      ]
    },
    {
      id: "css",
      title: "CSS",
      slides: [
        {
          title: "Next stop: CSS",
          bullets: [
            "Layout, spacing, positioning and responsive thinking"
          ],
          note: ""
        },
        {
          title: "The Box Model",
          bullets: [
            "Every element is a box. Learn to see the invisible space",
            "MARGIN",
            "BORDER",
            "PADDING",
            "CONTENT",
            "Remember",
            "width / height apply to the content box by default",
            "box-sizing: border-box makes sizing predictable",
            "margin = outside space padding = inside space",
            "CODE"
          ],
          note: ""
        },
        {
          title: "Display + Flexbox",
          bullets: [
            "Most everyday UI layout problems can be solved with a small set of flex concepts",
            "DISPLAY",
            "block",
            "inline",
            "inline-block",
            "none",
            "FLEX MODEL",
            "main axis",
            "justify-content",
            "align-items"
          ],
          note: ""
        },
        {
          title: "Positioning: know what you are positioning against",
          bullets: [
            "Relative, absolute, fixed and sticky solve different problems",
            "relative",
            "moves from its normal position",
            "absolute",
            "positioned relative to a containing block",
            "fixed",
            "anchored to the viewport",
            "sticky",
            "switches between normal + stuck"
          ],
          note: ""
        },
        {
          title: "Responsive design: mobile-first",
          bullets: [
            "MOBILE",
            "TABLET",
            "DESKTOP",
            "CODE",
            "Think: content → layout → breakpoint"
          ],
          note: ""
        }
      ]
    },
    {
      id: "typescript",
      title: "TypeScript",
      slides: [
        {
          title: "Next stop: TypeScript",
          bullets: [
            "Just enough type safety to make React easier to reason about"
          ],
          note: ""
        },
        {
          title: "TypeScript for React",
          bullets: [
            "Types are contracts between your data and your UI",
            "CODE",
            "Types Interfaces Enums Unions Functions null/undefined optional chaining"
          ],
          note: ""
        }
      ]
    },
    {
      id: "react",
      title: "React",
      slides: [
        {
          title: "Next stop: React",
          bullets: [
            "Components + state + events + data flow"
          ],
          note: ""
        },
        {
          title: "JSX: markup meets JavaScript",
          bullets: [
            "The goal isn't “HTML inside JS” — it's a declarative description of UI",
            "CODE",
            "className",
            "JSX attribute",
            "{name}",
            "JavaScript expression",
            "onClick",
            "event handler",
            "<section>",
            "semantic HTML"
          ],
          note: ""
        },
        {
          title: "Props vs State",
          bullets: [
            "One flows in. The other is owned and can change",
            "PROPS",
            "Passed from parent to child",
            "Read-only from the child's point of view",
            "Use for configuration / data / callbacks",
            "STATE",
            "Component memory",
            "Changes over time",
            "Updating state requests a re-render",
            "When two components need to coordinate → lift state to their closest common parent"
          ],
          note: ""
        },
        {
          title: "Rendering & re-rendering",
          bullets: [
            "Think in snapshots: state changes → React renders again",
            "USER",
            "click / type",
            "EVENT",
            "handler runs",
            "STATE",
            "setState(...)",
            "RENDER",
            "component runs",
            "UI"
          ],
          note: ""
        },
        {
          title: "Virtual DOM: understanding the idea",
          bullets: [
            "COMPONENTS",
            "state + props ↓ JSX / UI tree",
            "REACT TREE",
            "new output ↕ compare / reconcile",
            "BROWSER DOM",
            "actual elements ↓ pixels on screen"
          ],
          note: ""
        },
        {
          title: "Hooks: when do I use what?",
          bullets: [
            "Learn the problem each Hook solves",
            "useState",
            "component memory",
            "useEffect",
            "sync with external systems",
            "useRef",
            "persist a value / DOM reference",
            "useContext",
            "read shared context",
            "Rule: Hooks live at the top level of React components / custom Hooks"
          ],
          note: ""
        },
        {
          title: "Lists + conditional rendering",
          bullets: [
            "Most product UIs are “data → list → conditions”",
            "CODE",
            "KEYS",
            "Stable identity helps React track list items. Avoid array index when order can change"
          ],
          note: ""
        },
        {
          title: "API integration + async flow",
          bullets: [
            "A real UI is a state machine around data",
            "IDLE",
            "screen opens",
            "LOADING",
            "request",
            "SUCCESS",
            "data arrives",
            "ERROR",
            "request fails",
            "CODE"
          ],
          note: ""
        },
        {
          title: "Error handling: “works on my machine” is not a feature",
          bullets: [
            "Good frontend code anticipates failure",
            "Loading",
            "Give feedback",
            "Error",
            "Explain + retry",
            "Empty",
            "Tell the user what happened",
            "Invalid input",
            "Prevent bad requests",
            "DEBUG CHECKLIST"
          ],
          note: ""
        },
        {
          title: "Routing, navigation & debugging",
          bullets: [
            "A corporate app is more than one screen — and debugging is part of development",
            "ROUTING",
            "/",
            "Home",
            "/users",
            "Users",
            "/users/:id",
            "User Details",
            "/settings",
            "Settings"
          ],
          note: ""
        }
      ]
    },
    {
      id: "ecosystem",
      title: "Ecosystem & recap",
      slides: [
        {
          title: "CSS frameworks & icons",
          bullets: [
            "Corporate work often means using an ecosystem — not reinventing every button",
            "CSS",
            "Foundation",
            "Write your own styles",
            "Framework",
            "Bootstrap / Tailwind",
            "Speed + consistency",
            "Component UI",
            "MUI / similar",
            "Reusable building blocks"
          ],
          note: ""
        },
        {
          title: "Put the pieces together",
          bullets: [
            "A corporate frontend developer connects all of these layers",
            "HTML",
            "Structure",
            "CSS",
            "Layout + visual system",
            "TypeScript",
            "Contracts + Model",
            "React",
            "Behaviour + composition",
            "Tools / AI"
          ],
          note: ""
        }
      ]
    },
    {
      id: "build",
      title: "Build an app",
      slides: [
        {
          title: "Build an app",
          bullets: [],
          note: ""
        },
        {
          title: "Thank you!",
          bullets: [
            "Prakash U B S",
            "Prakash.ubs@ferguson.com"
          ],
          note: ""
        }
      ]
    }
  ]
};
