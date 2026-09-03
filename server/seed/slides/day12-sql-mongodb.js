// "Ferguson_SQL_Tech_Refresher_Dushanth_V1.pptx" (Dushanth, 31 slides; the MongoDB half of the session has no deck yet)
// Text carried over slide by slide from the trainer's deck; the slides themselves are the exported
// pictures under public/decks/day12-sql-mongodb/ (31 slides), so these bullets are talking points.
export default {
  key: "day12-sql-mongodb",
  title: "Tech Refresher – SQL",
  sections: [
    {
      id: "agenda",
      title: "Today",
      slides: [
        {
          title: "Tech Refresher – SQL",
          bullets: [
            "SQL Fundamentals for Application Development | Trainer: Dushanth | Enterprise Data Tower"
          ],
          note: "WELCOME (2 min) Say: 'Good morning everyone, and a very warm welcome to Ferguson! Today we are going to spend two hours together on one of the most useful skills you will ever learn in IT - SQL. No matter which team you finally land in - development, testing, data, or support - you WILL use SQL. My promise: by the end of this session you will be able to read and write real queries confidently.' Tip: Keep this slide on screen while people settle in. Smile, make eye contact, ask 'How many of you have written at least one SQL query in college?' - a show of hands instantly makes the room interactive."
        },
        {
          title: "Agenda",
          bullets: [
            "Why SQL? Databases & Relational Basics (20 min)",
            "SQL Fundamentals – Commands, SELECT & Filtering (20 min)",
            "Sorting, Grouping & Aggregate Functions (20 min)",
            "Joins, Subqueries & Set Operations (25 min)",
            "Must-Know Concepts, Best Practices & Mistakes (15 min)",
            "Quick Quiz + Hands-on Exercises (20 min)"
          ],
          note: "AGENDA (1 min) Say: 'Here is our 2-hour journey. We start with WHY databases and SQL exist, then learn to ask questions to a database with SELECT, then summarising data with grouping, then the most important skill - combining tables with JOINS. We close with best practices, a fun quiz, and hands-on exercises where YOU write queries.' Tip: Tell them - 'Please stop me anytime, this is a conversation, not a lecture. There are no silly questions today.'",
          agenda: [
            {
              id: "mentors",
              title: "Your trainer",
              count: 1,
              first: [
                "Trainer Quick Intro"
              ]
            },
            {
              id: "basics",
              title: "Why SQL & relational basics",
              count: 3,
              first: [
                "Why Do We Need SQL?",
                "Database Basics – From Data to RDBMS",
                "Relational Concepts – Tables, Keys & Relationships"
              ]
            },
            {
              id: "fundamentals",
              title: "SQL fundamentals",
              count: 5,
              first: [
                "SQL Command Families – The 5 Groups",
                "SELECT & WHERE – Asking Questions to Data",
                "ORDER BY vs GROUP BY – Sorting ≠ Grouping"
              ]
            },
            {
              id: "joins",
              title: "Joins",
              count: 4,
              first: [
                "Joins – Combining Tables (The Superpower!)",
                "INNER JOIN – Only Matching Rows",
                "LEFT JOIN & RIGHT JOIN – Keep One Side Fully"
              ]
            },
            {
              id: "advanced",
              title: "Subqueries, sets & functions",
              count: 6,
              first: [
                "Subqueries – A Query Inside a Query",
                "UNION vs UNION ALL – Stacking Results",
                "COALESCE vs ISNULL – Replacing NULLs"
              ]
            },
            {
              id: "practice",
              title: "SQL in real applications",
              count: 3,
              first: [
                "SQL in Real Application Development",
                "Best Practices – Write SQL Like a Pro",
                "Common Mistakes – Learn From Others' Pain"
              ]
            },
            {
              id: "quiz",
              title: "Quick quiz & toolbox",
              count: 2,
              first: [
                "Quick Quiz – Let's Play! 🎯",
                "The Journey So Far – Your SQL Toolbox"
              ]
            },
            {
              id: "exercises",
              title: "Hands-on exercises",
              count: 3,
              first: [
                "Hands-on Exercises – Your Turn! 💪",
                "Exercises – Level 1: Warm-up 🔥",
                "Exercises – Level 2: Challenge 🚀"
              ]
            },
            {
              id: "recap",
              title: "Recap",
              count: 2,
              first: [
                "Recap – 8 Lines to Remember Forever",
                "Thank you!"
              ]
            }
          ]
        }
      ]
    },
    {
      id: "mentors",
      title: "Your trainer",
      slides: [
        {
          title: "Trainer Quick Intro",
          bullets: [
            "👋 Dushanth Your trainer for today",
            "🏢 Ferguson GCC Joined 1 year ago — proud to be the 6th employee of Ferguson GCC!",
            "💼 8 Years in IT Across data-driven application Testing & enterprise systems",
            "📊 Enterprise Data Tower Currently working Enterprise data and Analystics at Ferguson"
          ],
          note: "TRAINER INTRO (2 min) Say: 'Quick intro about me - I am Dushanth. I joined Ferguson GCC a year ago, and I am happy and proud to say I was the 6th employee of Ferguson GCC - so I have literally watched this office grow from a handful of people to what you see today! I carry 8 years of experience in the IT industry, and right now I work in the Enterprise Data Tower here at Ferguson, where data and SQL are my daily bread and butter.' Tip: Add one personal line (hobby / hometown) - it makes freshers comfortable. Then ask each fresher to say their name + college in 10 seconds. This 'warm-up' makes them far more likely to answer questions later."
        }
      ]
    },
    {
      id: "basics",
      title: "Why SQL & relational basics",
      slides: [
        {
          title: "Why Do We Need SQL?",
          bullets: [
            "Every application you have ever used stores data. SQL is the language we use to talk to that data.",
            "👤 User",
            "clicks 'My Orders'",
            "📱 Application",
            "Java / .NET / Web",
            "📝 SQL Query",
            "SELECT * FROM Orders...",
            "🗄️ Database",
            "rows come back!",
            "Where will YOU meet SQL at Ferguson?"
          ],
          note: "WHY SQL (5 min) Explain the flow diagram left to right: 'Imagine you open the Ferguson app and click My Orders. The app itself does not remember your orders - it sends an SQL query to the database, the database finds your rows and sends them back, and the app just displays them. So the application is the FACE, the database is the MEMORY, and SQL is the LANGUAGE between them.' Then the 4 cards: as a developer you write SQL inside your code; when debugging you query the DB directly; reports are just big SELECT statements; and interviews love SQL because it never goes out of fashion. Interactive: Ask 'When you check your bank balance on your phone, where is that balance actually stored?' Answer: in the bank's database - the app just runs a query. This one example makes SQL feel real."
        },
        {
          title: "Database Basics – From Data to RDBMS",
          bullets: [
            "Data",
            "Raw facts & figures",
            "'Ravi', 25, 'Bengaluru' — just values with no organisation",
            "Database",
            "Organised collection of data",
            "Data stored in a structured, searchable way (like a digital filing cabinet)",
            "DBMS",
            "Software that manages a database",
            "Lets you store, retrieve & secure data (the librarian of the cabinet)",
            "RDBMS"
          ],
          note: "DATABASE BASICS (4 min) Walk the 4 boxes: 'Data alone is just values - Ravi, 25, Bengaluru. Put it in an organised, searchable structure and you get a Database. The software that manages that database - handles saving, searching, security - is a DBMS. And when the DBMS stores everything in TABLES that can be RELATED to each other, it becomes an RDBMS - Relational DBMS. That is what SQL Server, Oracle, MySQL and PostgreSQL are.' Analogy that always works: Database = a library. DBMS = the librarian. Tables = the shelves. SQL = the language you use to ask the librarian for a book. Interactive: Ask 'Why not just store everything in one big Excel sheet?' Let them think, then answer: Excel breaks at a few lakh rows, has no rules to stop wrong data, and two people cannot safely update it at once. Databases solve exactly these problems."
        },
        {
          title: "Relational Concepts – Tables, Keys & Relationships",
          bullets: [
            "Employees table",
            "Departments table",
            "related!",
            "Table",
            "Data organised in rows × columns (like one sheet)",
            "Row / Record",
            "One entity — e.g. employee 101 'Ravi'",
            "Column / Field",
            "One attribute — e.g. Salary",
            "Primary Key (PK)"
          ],
          note: "RELATIONAL CONCEPTS (5 min) - This slide is the FOUNDATION for joins later, so go slow. Point at the Employees table: 'Each ROW is one employee, each COLUMN is one piece of information about them. EmpID is the PRIMARY KEY - like your Aadhaar number, it uniquely identifies you; it can never repeat and can never be empty.' Now the magic: 'See DeptID in Employees? It is a FOREIGN KEY - it points to the Primary Key of the Departments table. Instead of writing the department name again and again for every employee, we just store the number 10, and the Departments table tells us 10 = IT. This LINK between tables is what makes the database RELATIONAL.' Point at Sneha's NULL: 'Sneha has no department yet - so DeptID is NULL. NULL means unknown/no value. It is NOT zero and NOT blank text. Remember NULL - it will come back when we learn joins and COALESCE.' Interactive: Ask 'Why not store DeptName directly inside Employees?' Answer: if the department is renamed, you would have to update thousands of rows - with a FK you update ONE row in Departments. This is called avoiding redundancy."
        }
      ]
    },
    {
      id: "fundamentals",
      title: "SQL fundamentals",
      slides: [
        {
          title: "SQL Command Families – The 5 Groups",
          bullets: [
            "Every SQL statement you will ever write belongs to one of these five families.",
            "DDL",
            "Data Definition",
            "Defines structure of tables",
            "CREATE · ALTER · DROP · TRUNCATE",
            "DML",
            "Data Manipulation",
            "Changes the data inside tables",
            "INSERT · UPDATE · DELETE",
            "DQL"
          ],
          note: "COMMAND FAMILIES (4 min) Say: 'Think of it this way - DDL builds the house (the table structure), DML moves the furniture (the data inside), DQL looks through the window (reading data), DCL decides who gets a key to the house (permissions), and TCL is the undo/save button (transactions).' Emphasise: 'As application developers, 90% of your day is DQL - SELECT. Another 9% is DML - INSERT, UPDATE, DELETE. The rest you will use occasionally. That is why today we focus mostly on SELECT and reading data.' Walk the code box quickly - one real statement per family, no need to deep-dive yet. Interactive: quick rapid-fire - shout a command (UPDATE! CREATE! SELECT!) and let them shout back the family. 30 seconds, great energy booster."
        },
        {
          title: "SELECT & WHERE – Asking Questions to Data",
          bullets: [
            "-- Basic shape of every query you will write:",
            "SELECT column1, column2 -- WHAT you want",
            "FROM table_name -- WHERE it lives",
            "WHERE condition; -- WHICH rows",
            "SELECT Name, Salary",
            "FROM Employees",
            "WHERE Salary > 52000;",
            "Result",
            "Filtering operators for WHERE",
            "= > < >= <= <> Compare values (<> means 'not equal')"
          ],
          note: "SELECT & WHERE (5 min) Say: 'Every query is just three questions - WHAT columns do I want (SELECT), from WHERE (FROM), and WHICH rows (WHERE). Read the example aloud like English: Select the name and salary from employees where salary is greater than 52000. SQL is designed to read like English - that is its superpower.' Mention: SELECT * means all columns - fine for exploring, avoid in real application code (we will see why in best practices). Operators: focus on IN (cleaner than many ORs), BETWEEN (inclusive!), LIKE with % wildcard ('R%' = starts with R, '%a%' = contains a), and the golden rule: NULL is never tested with = NULL, always IS NULL, because NULL is unknown and unknown never equals anything - not even another unknown. Interactive: 'Write in your head: find all employees whose name starts with P.' Answer together: SELECT * FROM Employees WHERE Name LIKE 'P%'."
        },
        {
          title: "ORDER BY vs GROUP BY – Sorting ≠ Grouping",
          bullets: [
            "ORDER BY → SORTS rows",
            "Same number of rows, just re-arranged",
            "GROUP BY → COLLAPSES rows",
            "One row PER GROUP — used with aggregates",
            "SELECT Name, Salary",
            "FROM Employees",
            "-- ASC = ascending (default)",
            "SELECT DeptID, COUNT(*) AS EmpCount",
            "-- every non-aggregated column",
            "-- MUST appear in GROUP BY"
          ],
          note: "ORDER BY vs GROUP BY (4 min) - a classic interview question! Left side: 'ORDER BY simply sorts. 4 employees in, 4 employees out - just arranged by salary, highest first because of DESC. Default is ASC.' Right side: 'GROUP BY is different - it COLLAPSES rows. All employees of dept 10 become ONE row, dept 20 becomes ONE row. Once collapsed, you can only show two kinds of things: the grouping column itself (DeptID) or an aggregate over the group (COUNT, SUM...). That is why the rule says: every column in SELECT that is not aggregated MUST be in GROUP BY.' Analogy: ORDER BY = arranging students in a line by height. GROUP BY = splitting students into sections A, B, C and reporting one number per section. Interactive: Ask 'If Employees has 1000 rows across 5 departments, how many rows does GROUP BY DeptID return?' Answer: 5 (one per department)."
        },
        {
          title: "Aggregate Functions – Summarising Data",
          bullets: [
            "COUNT()",
            "How many rows?",
            "SUM()",
            "Total of a column",
            "AVG()",
            "Average value",
            "MIN()",
            "Smallest value",
            "MAX()",
            "Largest value"
          ],
          note: "AGGREGATE FUNCTIONS (4 min) Say: 'Aggregates take MANY rows and give you ONE answer. COUNT - how many, SUM - total, AVG - average, MIN/MAX - smallest and largest. These five power every dashboard you have ever seen.' Walk the query: point at each line and its answer in the comment. The tricky one: COUNT(*) vs COUNT(column). COUNT(*) counts rows. COUNT(DeptID) counts only non-NULL values - Sneha's NULL department is skipped, so 3 not 4. This is a favourite interview trap! Also: aggregates usually appear WITH GROUP BY - 'average salary PER department' = AVG + GROUP BY DeptID. Interactive: 'Swiggy shows you - Your total orders: 132, Total spent: 45,000. Which aggregates are these?' (COUNT and SUM.)"
        },
        {
          title: "WHERE vs HAVING – Filter Rows vs Filter Groups",
          bullets: [
            "-- Depts with avg salary > 52,000 (only active emps)",
            "SELECT DeptID, AVG(Salary) AS AvgSal",
            "FROM Employees",
            "WHERE Status = 'Active' -- 1) filter ROWS",
            "GROUP BY DeptID -- 2) make GROUPS",
            "HAVING AVG(Salary) > 52000 -- 3) filter GROUPS",
            "🔄 Logical order SQL runs in:",
            "FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY",
            "That's why WHERE can't see aggregates — they don't exist yet when WHERE runs!"
          ],
          note: "WHERE vs HAVING (4 min) - top-3 interview question! Core line to say: 'WHERE filters ROWS before grouping. HAVING filters GROUPS after grouping. That is the whole difference.' Use the code: 'First WHERE throws away inactive employees - row by row. Then GROUP BY makes one group per department. Then HAVING throws away whole GROUPS whose average is too low. Then ORDER BY sorts what is left.' The killer explanation is the execution order box: SQL runs FROM, then WHERE, then GROUP BY, then HAVING, then SELECT, then ORDER BY. When WHERE runs, no groups exist yet - so asking WHERE AVG(Salary) > 52000 is like asking the class average before the exam is conducted. Impossible - hence the error. Interactive: 'I want departments having MORE THAN 50 employees - WHERE or HAVING?' Answer: HAVING COUNT(*) > 50, because counting happens per group."
        }
      ]
    },
    {
      id: "joins",
      title: "Joins",
      slides: [
        {
          title: "Joins – Combining Tables (The Superpower!)",
          bullets: [
            "Real data is split across tables. Joins stitch related tables back together using keys.",
            "INNER JOIN",
            "Only matches in BOTH",
            "LEFT JOIN",
            "All of LEFT + matches",
            "RIGHT JOIN",
            "All of RIGHT + matches",
            "FULL JOIN",
            "Everything from both",
            "Join syntax skeleton"
          ],
          note: "JOINS OVERVIEW (4 min) - announce this as THE most important slide of the day. Say: 'Remember we split data into Employees and Departments to avoid duplication? Joins are how we put them back together for display. The ON clause tells SQL which columns link the tables - almost always FK = PK.' Walk the Venn diagrams: 'Think of two circles - left circle is Employees, right is Departments. INNER JOIN = only the overlap - rows that match on both sides. LEFT JOIN = the whole left circle - every employee, even Sneha who has no department (her dept shows NULL). RIGHT JOIN = mirror image - every department even if it has no employees. FULL JOIN = both circles - everything, with NULLs filling the gaps.' Show the syntax: FROM = left table, JOIN = right table, ON = the link. Aliases e and d are just nicknames to type less. Interactive: 'If I want to list ALL departments including empty ones with employee count - which join keeps all departments?' Answer: RIGHT JOIN from Employees, or better, LEFT JOIN from Departments."
        },
        {
          title: "INNER JOIN – Only Matching Rows",
          bullets: [
            "Employees",
            "Departments",
            "SELECT e.Name,",
            "d.DeptName",
            "FROM Employees e",
            "INNER JOIN",
            "Departments d",
            "ON e.DeptID",
            "= d.DeptID;",
            "Result — only rows that matched on both sides"
          ],
          note: "INNER JOIN (4 min) Walk it visually: 'SQL takes each employee, looks at their DeptID, and searches Departments for the same DeptID. Ravi has 10 → 10 is IT → Ravi-IT goes to the result. Same for Arun. Priya has 20 → Finance. Sneha has NULL → NULL matches nothing → she is dropped. And HR - department 30 - no employee references it, so it is also dropped.' Key sentence: 'INNER JOIN is a strict matchmaker - if you do not have a partner on the other side, you are out.' Real-time example: order details page - Orders INNER JOIN Customers - you only want orders that genuinely belong to a customer. Note: writing just JOIN means INNER JOIN - it is the default."
        },
        {
          title: "LEFT JOIN & RIGHT JOIN – Keep One Side Fully",
          bullets: [
            "-- LEFT: ALL employees, dept if exists",
            "SELECT e.Name, d.DeptName",
            "FROM Employees e",
            "LEFT JOIN Departments d",
            "ON e.DeptID = d.DeptID;",
            "-- RIGHT: ALL departments, emp if exists",
            "RIGHT JOIN Departments d",
            "💡 The unmatched side is filled with NULL — that's your clue a LEFT/RIGHT join happened.",
            "Real-time use: 'Show ALL customers and their orders — including customers who never ordered' → Customers LEFT JOIN Orders. Finding customers with NO orders?…"
          ],
          note: "LEFT & RIGHT JOIN (4 min) Left panel: 'LEFT JOIN keeps EVERY row of the left table - Employees. Sneha has no department, but she is NOT dropped - the department column simply shows NULL. Compare with INNER JOIN where she vanished.' Right panel: 'RIGHT JOIN is the mirror - every department survives, even HR which has no employees, and the employee side shows NULL.' Pro tip to share: most teams write everything as LEFT JOIN (just swap table order) - it reads more naturally. RIGHT JOIN is rare in real codebases. The POWER pattern: LEFT JOIN + WHERE right-side IS NULL = 'find rows WITHOUT a match'. Customers with no orders, products never sold, employees with no assigned project - this pattern appears everywhere including interviews. Interactive: 'How do I find departments with ZERO employees?' Answer: Departments LEFT JOIN Employees ON ... WHERE e.EmpID IS NULL."
        },
        {
          title: "FULL, CROSS & SELF Joins – The Special Trio",
          bullets: [
            "FULL OUTER JOIN",
            "Everything from BOTH sides",
            "SELECT e.Name, d.DeptName",
            "FROM Employees e",
            "FULL JOIN Departments d",
            "ON e.DeptID = d.DeptID;",
            "Result: matched rows + Sneha (NULL dept) + HR (NULL emp). Great for data reconciliation — 'what exists only on one side?'",
            "CROSS JOIN",
            "Every row × every row (no ON!)",
            "SELECT s.Size, c.Colour"
          ],
          note: "FULL / CROSS / SELF (4 min) FULL JOIN: 'LEFT + RIGHT together - nobody is dropped. Sneha appears with NULL department AND HR appears with NULL employee. Perfect for reconciliation - comparing two systems and finding what exists only in one.' CROSS JOIN: 'No ON condition - it pairs EVERY row with EVERY row. 3 sizes and 4 colours gives 12 combinations - great for generating product variants. But warn them: cross joining two big tables can explode into millions of rows. If you ever see a crazy huge result, check whether you forgot the ON condition - a missing ON accidentally creates a cross join!' SELF JOIN: 'The mind-bender. The Employees table has a ManagerID column - the manager is ALSO an employee in the same table. So we open the same table twice with two nicknames: e for the employee, m for the manager, and join e.ManagerID = m.EmpID. LEFT JOIN so the CEO (no manager) still appears.' Interactive: 'Why LEFT join in the self-join example instead of INNER?' Answer: the top boss has ManagerID NULL - INNER would drop him."
        }
      ]
    },
    {
      id: "advanced",
      title: "Subqueries, sets & functions",
      slides: [
        {
          title: "Subqueries – A Query Inside a Query",
          bullets: [
            "-- Who earns MORE than the average salary?",
            "SELECT Name, Salary",
            "FROM Employees",
            "WHERE Salary > (SELECT AVG(Salary)",
            "FROM Employees);",
            "-- Inner query runs first → 60000",
            "-- Outer query becomes: WHERE Salary > 60000",
            ">> Priya 65000, Sneha 70000",
            "How SQL thinks:",
            "1️⃣ Run the INNER query → one value (60000)"
          ],
          note: "SUBQUERIES (4 min) Say: 'A subquery is simply a query inside brackets that runs FIRST, and its answer is used by the outer query. Exactly like maths - solve the bracket first.' Walk the example: 'I cannot write WHERE Salary > average - SQL needs a number. So the inner query computes the average - 60000 - and the outer query becomes WHERE Salary > 60000. Priya and Sneha qualify.' Three homes for subqueries: inside WHERE (compare to a value), inside FROM (use a result as a temp table - must give it an alias), and with IN (match a list, e.g. employees in departments located in Bengaluru). Keep it simple for freshers - just mention that correlated subqueries (inner query referring to outer row) exist and are slower; they will meet them later. Interactive: 'Find employees earning the MAXIMUM salary - how?' Answer: WHERE Salary = (SELECT MAX(Salary) FROM Employees)."
        },
        {
          title: "UNION vs UNION ALL – Stacking Results",
          bullets: [
            "Joins combine tables SIDE-BY-SIDE (columns). UNION stacks results TOP-TO-BOTTOM (rows).",
            "SELECT City FROM Customers2024",
            "UNION",
            ">> Bengaluru, Chennai, Delhi",
            "-- duplicates REMOVED, sorted-ish",
            "UNION ALL",
            ">> Bengaluru, Chennai, Bengaluru, Delhi",
            "-- duplicates KEPT, faster!",
            "📏 Rules for both: same number of columns, compatible data types, same column order. Column names come from the FIRST query.",
            "⚡ Default to UNION ALL unless you truly need duplicates removed — free performance!"
          ],
          note: "UNION vs UNION ALL (3 min) First clarify the direction: 'Joins glue tables sideways - more COLUMNS. UNION glues results vertically - more ROWS. Example: customers from the 2024 table and the 2025 table stacked into one list.' The difference is one word: 'UNION quietly removes duplicate rows - Bengaluru appearing in both years shows once. UNION ALL keeps everything - Bengaluru shows twice. And because UNION must compare every row to find duplicates, it is SLOWER.' Practical advice: if you know duplicates cannot exist, or duplicates are meaningful (log entries, transactions), use UNION ALL - it is faster and safer for counts. Interactive: 'I am merging error logs from two servers to count total errors - UNION or UNION ALL?' Answer: UNION ALL - removing duplicates would corrupt the count."
        },
        {
          title: "COALESCE vs ISNULL – Replacing NULLs",
          bullets: [
            "-- ISNULL(value, replacement) [SQL Server]",
            "SELECT Name,",
            "ISNULL(Phone, 'No Phone') AS Contact",
            "FROM Employees;",
            "-- Sneha's NULL phone becomes:",
            ">> Sneha | No Phone",
            "-- COALESCE(v1, v2, ..., vN) → first NOT NULL",
            "COALESCE(Mobile, HomePhone,",
            "'No Contact') AS Reach",
            ">> tries Mobile → HomePhone → default"
          ],
          note: "COALESCE vs ISNULL (4 min) Setup: 'NULLs look ugly on screen - you never want a customer seeing the word NULL. These two functions replace NULL with something sensible.' ISNULL: exactly two arguments - the value and its backup. SQL Server specific. COALESCE: the smarter sibling - takes MANY arguments and returns the FIRST non-NULL, left to right. Try Mobile; if NULL try HomePhone; if that's NULL too, show 'No Contact'. It is ANSI standard - the same line works in SQL Server, Oracle, MySQL, PostgreSQL. Mention the data-type row briefly: ISNULL forces the type of the first argument (can silently truncate longer strings!), COALESCE picks the highest-precedence type - one more reason COALESCE is safer. Interactive: 'COALESCE(NULL, NULL, 5, 10) returns what?' Answer: 5 - the FIRST non-NULL, and it stops there."
        },
        {
          title: "DELETE vs TRUNCATE vs DROP",
          bullets: [
            "DELETE",
            "Removes ROWS (can pick which)",
            "DELETE FROM Employees",
            "WHERE DeptID = 30;",
            "🧹 Erasing some pencil lines",
            "TRUNCATE",
            "Removes ALL rows, keeps table",
            "TRUNCATE TABLE Employees;",
            "📄 Tearing out the whole page",
            "DROP"
          ],
          note: "DELETE vs TRUNCATE vs DROP (4 min) - guaranteed interview question! The notebook analogy carries this slide: 'DELETE erases some pencil lines - you choose which rows with WHERE, and each erased line is logged so you can undo. TRUNCATE tears out the entire page - all rows gone instantly, but the page (table structure) still exists and you can write again. DROP burns the whole notebook - table, structure, indexes, everything is gone.' Key differences to stress: 1) Only DELETE can have WHERE. 2) DELETE is row-by-row and logged (slow but safe); TRUNCATE deallocates pages (very fast, minimal logging). 3) After TRUNCATE, identity/auto-increment restarts from 1; after DELETE it continues. 4) In SQL Server all three CAN be rolled back if wrapped in a transaction - but TRUNCATE/DROP outside a transaction are effectively goodbye. Safety habit to teach: ALWAYS write and run the SELECT first - SELECT * FROM Employees WHERE DeptID=30 - check the rows, THEN change SELECT * to DELETE. This habit prevents production disasters. Interactive: 'I want to empty a 10-million-row staging table before tomorrow's load - which one?' Answer: TRUNCATE - fastest, keeps structure."
        },
        {
          title: "ROW_NUMBER vs RANK vs DENSE_RANK",
          bullets: [
            "SELECT Name, Salary,",
            "ROW_NUMBER() OVER(ORDER BY Salary DESC) AS RowNo,",
            "RANK() OVER(ORDER BY Salary DESC) AS Rnk,",
            "DENSE_RANK() OVER(ORDER BY Salary DESC) AS DRnk",
            "FROM Employees;",
            "Window functions: rank every row without collapsing them (unlike GROUP BY).",
            "OVER(ORDER BY ...) defines the ranking order. Add PARTITION BY dept for per-group ranking.",
            "Watch the TIE (Priya & Arun both earn 65,000)",
            "🧠 Remember",
            "ROW_NUMBER: always unique 1,2,3,4"
          ],
          note: "RANKING FUNCTIONS (5 min) Setup: 'These are window functions - they add a calculated column to every row WITHOUT collapsing rows like GROUP BY does. OVER(ORDER BY Salary DESC) says: rank by salary, highest first.' The tie is everything - point at Priya and Arun, both 65,000: - ROW_NUMBER does not care about ties - it just numbers 1,2,3,4. Priya gets 2 and Arun gets 3 arbitrarily. - RANK gives both position 2, but then SKIPS 3 - Ravi is 4th. Like the Olympics: two silver medals means no bronze - next is 4th place. - DENSE_RANK gives both 2, and Ravi gets 3 - no gaps. 'Dense' = tightly packed. Memory line: ROW_NUMBER = roll numbers (always unique). RANK = Olympic ranking (skips). DENSE_RANK = dense, no gaps. Mention PARTITION BY: adding PARTITION BY DeptID restarts ranking inside each department - that is how you get top-3 per category. Interactive: 'Scores 100, 90, 90, 80 - what does each function give the last row?' Answer: ROW_NUMBER 4, RANK 4, DENSE_RANK 3."
        },
        {
          title: "Handling Duplicates – Find & Remove",
          bullets: [
            "1) FIND duplicates — GROUP BY + HAVING",
            "SELECT Email, COUNT(*) AS Cnt",
            "FROM Customers",
            "GROUP BY Email",
            "HAVING COUNT(*) > 1;",
            ">> ravi@x.com | 3 -- appears thrice!",
            "2) VIEW unique rows — DISTINCT",
            "SELECT DISTINCT Email",
            "FROM Customers;",
            "-- shows each email once"
          ],
          note: "DUPLICATES (4 min) - a real production skill AND an interview favourite. Story to tell: 'A user clicks Submit twice, or a data load runs twice - now customer ravi@x.com exists 3 times. This genuinely happens in production. Three tools:' 1) FIND: group identical emails together and keep only groups having more than one member - classic GROUP BY + HAVING from earlier slides. See how concepts stack! 2) DISTINCT: only affects the DISPLAY - shows unique values but changes nothing in the table. 3) DELETE-but-keep-one: the star pattern. ROW_NUMBER with PARTITION BY Email numbers each email's copies 1,2,3 ordered by CreatedDate. The oldest gets rn=1. Delete everything with rn>1 - each email keeps exactly one row. The WITH block is a CTE - think of it as naming an intermediate result so the DELETE can use it. Safety reminder: run the SELECT version first, count the rows, then delete. Interactive: 'What changes if I ORDER BY CreatedDate DESC?' Answer: the NEWEST copy gets rn=1 and is kept instead."
        }
      ]
    },
    {
      id: "practice",
      title: "SQL in real applications",
      slides: [
        {
          title: "SQL in Real Application Development",
          bullets: [
            "Every feature you will build maps to SQL. Here is a mini e-commerce flow you all know:",
            "🔐 Login screen",
            "App checks your credentials",
            "SELECT UserID FROM Users",
            "WHERE Email = @email",
            "AND PasswordHash = @hash;",
            "0 rows = wrong login. Apps pass values as @parameters — never paste user input into SQL (security!).",
            "🛒 'My Orders' page",
            "Join orders with product info",
            "SELECT o.OrderID, o.OrderDate,"
          ],
          note: "REAL-TIME EXAMPLES (5 min) - this is where it all clicks for freshers. Say: 'Let us connect today's learning to an app you use daily - any shopping app.' Login: 'When you tap Sign In, the app runs a SELECT with your email and password hash. One row back = welcome; zero rows = invalid credentials. Notice @email and @hash - these are PARAMETERS. The app never glues user input directly into the SQL string, because a hacker could type SQL into the login box and hijack the query - that attack is called SQL Injection. Parameters make it impossible.' My Orders: 'One simple screen needs THREE tables - Orders for the header, OrderItems for quantities, Products for names. Joined on their keys, filtered to you, newest first. Now you see why we spent 25 minutes on joins!' Dashboard: 'Management wants revenue per category above 1 lakh, biggest first. Look - JOIN, GROUP BY, SUM, HAVING, ORDER BY - literally every concept from today in one real query. You can already read this. That is your progress in 90 minutes!'"
        },
        {
          title: "Best Practices – Write SQL Like a Pro",
          bullets: [
            "✅ Name only the columns you need.",
            "SELECT * drags every column across the network, breaks apps when columns change, and can't use covering indexes.",
            "✅ Always pair DELETE / UPDATE with WHERE.",
            "Run it as a SELECT first to preview affected rows. No WHERE = every row changes!",
            "✅ Use parameters, never string-concatenation.",
            "WHERE Email = @email — prevents SQL Injection, the #1 web attack.",
            "✅ Filter early, filter smart.",
            "✅ Use readable formatting & aliases.",
            "Keywords on new lines, meaningful aliases (e, d), comments for tricky logic — your teammates will thank you.",
            "✅ Test on small data, mind the indexes."
          ],
          note: "BEST PRACTICES (3 min) Walk quickly - one line each: 1) SELECT * is lazy - name your columns. Apps break when someone adds a column and position-based code shifts. 2) The scariest moment in any developer's life is running DELETE without WHERE. Habit: write SELECT first, verify the rows, then change to DELETE. Say it twice - it will save someone's job someday. 3) Parameters (@email) instead of gluing strings - stops SQL Injection completely. Non-negotiable in application code. 4) Filter in the database, not in the application - fetching a million rows to keep a hundred wastes everything. And functions around indexed columns (YEAR(OrderDate)=2026) stop the index from being used - use date ranges instead. 5) Format for humans - SQL ignores whitespace, teammates do not. 6) While practising, add TOP 100 so mistakes are cheap; learn what indexes exist on your tables. Tip: share a 30-second story of a real (anonymised) production incident - freshers remember stories, not rules."
        },
        {
          title: "Common Mistakes – Learn From Others' Pain",
          bullets: [
            "❌ = NULL instead of IS NULL.",
            "WHERE Phone = NULL returns NOTHING — NULL never equals anything. Use IS NULL / IS NOT NULL.",
            "❌ Forgetting the ON in a join.",
            "Accidental CROSS JOIN — 10K × 10K = 100M rows, server crawls. Always write ON right after JOIN.",
            "❌ Aggregates inside WHERE.",
            "WHERE COUNT(*) > 5 → error! Groups don't exist yet. Move it to HAVING.",
            "❌ Non-grouped column in SELECT.",
            "SELECT Name, DeptID ... GROUP BY DeptID → error. Every non-aggregated column must be in GROUP BY.",
            "❌ UPDATE / DELETE without WHERE.",
            "The classic career-limiting move — every row updated. Preview with SELECT first!"
          ],
          note: "COMMON MISTAKES (3 min) Frame it: 'Every senior engineer has made at least three of these. Make them here in training, not in production!' 1) = NULL: the query runs fine but returns nothing - the worst kind of bug, no error, just silence. NULL is unknown; unknown = unknown is still unknown. IS NULL only. 2) Missing ON: the join becomes a cross join and multiplies the tables. If a query suddenly returns crores of rows or hangs - check your ONs first. 3) Aggregates in WHERE: remember the execution order slide - WHERE runs before groups exist. HAVING is the place. 4) The GROUP BY rule: every SELECTed column is either grouped or aggregated - no exceptions. 5) UPDATE without WHERE - tell them about transactions: BEGIN TRAN, run it, check, COMMIT or ROLLBACK - a seatbelt while learning. 6) UNION dropping duplicates silently corrupts sums and counts - UNION ALL for merges. Interactive: read each card and ask 'What is wrong here?' before revealing - freshers love spotting mistakes."
        }
      ]
    },
    {
      id: "quiz",
      title: "Quick quiz & toolbox",
      slides: [
        {
          title: "Quick Quiz – Let's Play! 🎯",
          bullets: [
            "Shout your answers! First correct answer gets bragging rights (and maybe chocolate 🍫)",
            "Q1",
            "Employees has 1,000 rows in 8 departments.",
            "How many rows does GROUP BY DeptID return?",
            "Q2",
            "Which query finds employees WITHOUT a department —",
            "INNER JOIN or LEFT JOIN ... WHERE d.DeptID IS NULL?",
            "Q3",
            "Scores: 95, 88, 88, 76.",
            "What does DENSE_RANK give the last student?"
          ],
          note: "QUIZ (7-8 min) - run it with energy; give 20-30 seconds per question. A1: 8 rows - one per department. (If some employees have NULL DeptID, NULL forms its own group → 9.) A2: LEFT JOIN ... WHERE d.DeptID IS NULL. INNER JOIN drops non-matches entirely, so it can never find them. This pattern = 'find rows without a match'. A3: DENSE_RANK: 95→1, 88→2, 88→2, 76→3. No gaps. (RANK would give 4; ROW_NUMBER also 4.) A4: DELETE. TRUNCATE is all-or-nothing DDL - no WHERE allowed. A5: 'A' - the FIRST non-NULL from the left, then it stops (B is never reached). A6: True - UNION ALL just appends; UNION must find and remove duplicates first. Wrap: 'If you got 4+, you are genuinely ready for the hands-on. Let's write some SQL ourselves!'"
        },
        {
          title: "The Journey So Far – Your SQL Toolbox",
          bullets: [
            "In 100 minutes you went from 'what is a database?' to reading production-grade queries:",
            "🗄️ Foundations",
            "Tables · PK/FK · NULL · RDBMS",
            "🔍 Reading data",
            "SELECT · WHERE · LIKE · IN · BETWEEN",
            "📊 Summarising",
            "GROUP BY · HAVING · COUNT/SUM/AVG",
            "🔗 Combining",
            "INNER/LEFT/RIGHT/FULL/SELF joins · UNION",
            "🛠️ Power tools"
          ],
          note: "RECAP OF JOURNEY (2 min) Say: 'Look how far you came in under two hours - foundations, reading data, summarising, combining tables, power tools, and professional discipline. You will NOT remember everything - that is normal and expected. What matters is you now know what exists and where to look.' Growth path: 'Fifteen minutes of practice a day beats five hours once a month. Start with HackerRank SQL easy problems - they mirror exactly what we did today. And the best trick: open any query in our repositories, read it line by line, and explain it to yourself - within a month these will look like plain English.' Transition: 'But first - nothing beats writing SQL with your own hands. Hands-on time!'"
        }
      ]
    },
    {
      id: "exercises",
      title: "Hands-on exercises",
      slides: [
        {
          title: "Hands-on Exercises – Your Turn! 💪",
          bullets: [],
          note: "TRANSITION (30 sec) Say: 'The next 15-20 minutes are yours. Open the practice database (or paper if systems are not ready). Work in pairs - discussing queries out loud is the fastest way to learn. I will walk around and help. Solutions are with me - try honestly before asking!' Setup tip: have the two practice tables (Employees, Departments from the slides) pre-created in a shared dev DB, or share a printout of the table data so everyone works on the same rows."
        },
        {
          title: "Exercises – Level 1: Warm-up 🔥",
          bullets: [
            "Use the Employees & Departments tables from today. Write, run, and verify each query. (~8 min)",
            "Ex 1 SELECT + WHERE",
            "List Name and Salary of all employees earning more than 52,000.",
            "Ex 2 LIKE",
            "Find all employees whose name starts with the letter 'P'.",
            "Ex 3 ORDER BY",
            "Show all employees sorted by Salary — highest first.",
            "Ex 4 Aggregates",
            "Show the total, average, minimum and maximum salary of the company in one query.",
            "Ex 5 GROUP BY"
          ],
          note: "LEVEL 1 SOLUTIONS (walk around, reveal after ~8 min): Ex1: SELECT Name, Salary FROM Employees WHERE Salary > 52000; Ex2: SELECT * FROM Employees WHERE Name LIKE 'P%'; Ex3: SELECT * FROM Employees ORDER BY Salary DESC; Ex4: SELECT SUM(Salary) AS Total, AVG(Salary) AS Avg, MIN(Salary) AS Min, MAX(Salary) AS Max FROM Employees; Ex5: SELECT DeptID, COUNT(*) AS EmpCount FROM Employees GROUP BY DeptID; Ex6: SELECT DeptID, COUNT(*) AS EmpCount FROM Employees GROUP BY DeptID HAVING COUNT(*) > 1; Coaching notes: In Ex2 someone will write LIKE '%P%' - discuss the difference (contains vs starts-with). In Ex6 someone will try WHERE COUNT(*)>1 - perfect teaching moment to reinforce WHERE vs HAVING."
        },
        {
          title: "Exercises – Level 2: Challenge 🚀",
          bullets: [
            "Now combine concepts — exactly like real project work. Pair up if stuck! (~10 min)",
            "Ex 7 INNER JOIN",
            "Show each employee's Name with their DeptName. Who is missing from the result, and why?",
            "Ex 8 LEFT JOIN + IS NULL",
            "List employees who have NO department assigned.",
            "Ex 9 JOIN + GROUP BY",
            "Show each DeptName with its average salary, highest average first.",
            "Ex 10 Subquery",
            "List employees earning more than the company's average salary.",
            "Ex 11 COALESCE"
          ],
          note: "LEVEL 2 SOLUTIONS: Ex7: SELECT e.Name, d.DeptName FROM Employees e INNER JOIN Departments d ON e.DeptID = d.DeptID; → Sneha is missing (NULL DeptID never matches). Ex8: SELECT e.Name FROM Employees e LEFT JOIN Departments d ON e.DeptID = d.DeptID WHERE d.DeptID IS NULL; (or simply WHERE e.DeptID IS NULL on the single table - accept both, discuss the pattern.) Ex9: SELECT d.DeptName, AVG(e.Salary) AS AvgSal FROM Employees e JOIN Departments d ON e.DeptID = d.DeptID GROUP BY d.DeptName ORDER BY AvgSal DESC; Ex10: SELECT Name, Salary FROM Employees WHERE Salary > (SELECT AVG(Salary) FROM Employees); Ex11: SELECT Name, COALESCE(CAST(DeptID AS VARCHAR(10)), 'Not Assigned') AS Dept FROM Employees; → teaching point: COALESCE arguments must be type-compatible, hence the CAST. Ex12: DENSE_RANK() OVER(ORDER BY Salary DESC) - 'no gaps for ties' is the keyword pointing to DENSE_RANK. Close the exercise block by asking one volunteer to explain their Ex9 query aloud - explaining is the deepest form of learning."
        }
      ]
    },
    {
      id: "recap",
      title: "Recap",
      slides: [
        {
          title: "Recap – 8 Lines to Remember Forever",
          bullets: [
            "1. SQL = the language between your app and its data",
            "2. PK / FK = identity of a row / the link between tables",
            "3. WHERE vs HAVING = filter rows vs filter groups",
            "4. ORDER BY vs GROUP BY = sort rows vs collapse rows",
            "6. UNION ALL = stack rows (keep duplicates, faster)",
            "7. COALESCE = first non-NULL value (portable everywhere)",
            "8. DELETE / TRUNCATE / DROP = rows / all rows / whole table",
            "Questions? Doubts? Nothing is silly — ask now or ping me anytime on Teams. 💬"
          ],
          note: "FINAL RECAP (3 min) Read the 8 lines slowly - these are the one-line answers to the 8 most common SQL interview questions. Suggest they photograph this slide. Say: 'If you remember only these eight lines, you can already hold a five-minute SQL conversation in any interview or standup. Everything else grows from practice.' Open the floor for questions (keep ~5 min). If silent, seed one: 'A common doubt is when to use a subquery versus a join - anyone want to guess?' (Answer: compare-against-one-value → subquery; need columns from both tables → join.) Close by pointing to the exercises: 'Re-do all 12 exercises tomorrow WITHOUT looking at solutions - that is your homework, and I will ask two of you to demo one query each in our next catch-up!'"
        },
        {
          title: "Thank you!",
          bullets: [],
          note: "CLOSING (1 min) Say: 'Thank you all for the energy today! Welcome once again to Ferguson - you are joining a company where data truly matters, and today you took your first real step into it. My door - and my Teams chat - is always open. Happy querying!' Practical closers: share the deck + practice scripts on the team channel, share your Teams/email, and schedule a 30-min doubt-clearing session for next week while the material is fresh."
        }
      ]
    }
  ]
};
