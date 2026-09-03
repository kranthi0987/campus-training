// Session: Python & Automation (Day 09, 2026-09-03)
// Source: "Python & Automation Quiz 1.docx" (trainer's document). Questions, options, correct
// answers and explanations are reproduced as written. The deck (slides/day09-python.js) asks
// them in blocks of three after slides 7–11, so the order here follows the slides:
//   1–3  Python basics        (after slide 7)
//   4–6  Advanced Python      (after slide 8)
//   7–9  APIs & requests      (after slide 9)
//  10–12 Playwright           (after slide 10)  = document Q13–Q15
//  13–15 File & data          (after slide 11)  = document Q10–Q12
export default [
  // ---- Section 1: Python basics ----
  {
    text: 'What does print(bool("False")) output?',
    options: ['False', 'True', 'Error', 'None'],
    answer: 1, complexity: 'easy',
    explanation: 'Any non-empty string is truthy; the word "False" doesn\'t matter.',
  },
  {
    text: 'What does this print?',
    code: 'a = [1, 2, 3]\nb = a\nb.append(4)\nprint(a)',
    options: ['[1, 2, 3]', '[1, 2, 3, 4]', 'Error', '[4]'],
    answer: 1, complexity: 'medium',
    explanation: 'b = a copies the reference, not the list. Both names point to the same object.',
  },
  {
    text: 'What does this print?',
    code: 'def add(x, items=[]):\n    items.append(x)\n    return items\nprint(add(1))\nprint(add(2))',
    options: ['[1] then [2]', '[1] then [1, 2]', '[1, 2] then [1, 2]', 'Error'],
    answer: 1, complexity: 'hard',
    explanation: 'The default list is created once at function definition, so it\'s shared across calls. Classic Python gotcha.',
  },
  // ---- Section 2: Advanced Python ----
  {
    text: 'Which methods does @dataclass generate for you by default?',
    options: ['Only __init__', '__init__, __repr__, __eq__', '__init__ and __str__', 'Every dunder method including __hash__'],
    answer: 1, complexity: 'easy',
    explanation: 'That\'s the whole point: no boilerplate constructor, readable repr, and value-based equality.',
  },
  {
    text: 'What does this print?',
    code: 'g = (x * x for x in range(3))\nprint(sum(g))\nprint(sum(g))',
    options: ['5 then 5', '5 then 0', '14 then 14', 'Error on the second sum'],
    answer: 1, complexity: 'medium',
    explanation: 'Generators are single-use. The first sum exhausts it (0+1+4=5); the second gets an empty iterator, and sum of nothing is 0.',
  },
  {
    text: 'What does f() return?',
    code: 'def f():\n    try:\n        return 1\n    finally:\n        return 2',
    options: ['1', '2', 'Error', '1, then 2'],
    answer: 1, complexity: 'hard',
    explanation: 'finally always runs, and a return inside it overrides the try block\'s return (it would even swallow an exception).',
  },
  // ---- Section 3: APIs & requests ----
  {
    text: 'What does response.raise_for_status() do for a 200 response?',
    options: ['Raises an exception because status was checked manually', 'Nothing — it only raises for 4xx/5xx codes', 'Returns the status code', 'Retries the request'],
    answer: 1, complexity: 'easy',
    explanation: 'It\'s a no-op on success, raises HTTPError on 4xx/5xx.',
  },
  {
    text: 'If you call requests.get(url) without a timeout argument, what\'s the default timeout?',
    options: ['30 seconds', '60 seconds', '5 seconds', 'None — it can hang forever'],
    answer: 3, complexity: 'medium',
    explanation: 'requests has no default timeout. This is why production code (and your smoke tests) must always pass one explicitly.',
  },
  {
    text: 'How many test cases run here?',
    code: '@pytest.mark.parametrize("user", ["admin", "guest", "anon"])\n@pytest.mark.parametrize("method", ["GET", "POST"])\ndef test_endpoint(user, method): ...',
    options: ['3', '5', '6', '2'],
    answer: 2, complexity: 'hard',
    explanation: 'Stacked parametrize decorators multiply: 3 users × 2 methods = 6 combinations.',
  },
  // ---- Section 5 in the document: Playwright (asked after the Playwright slide) ----
  {
    text: 'What does Playwright\'s "auto-waiting" mean?',
    options: ['It adds a fixed 5-second sleep before every action', 'It automatically waits for an element to be visible/actionable before clicking, so you rarely need manual sleeps', 'It waits for the user to press Enter', 'It only works in headless mode'],
    answer: 1, complexity: 'easy',
    explanation: 'Locators wait for the element to be attached, visible and enabled before acting.',
  },
  {
    text: 'What does running the browser in "headless" mode mean?',
    options: ['The browser runs without a visible UI window', 'The browser runs without JavaScript', 'The browser skips loading images only', 'The test runs without assertions'],
    answer: 0, complexity: 'medium',
    explanation: 'Same browser engine, no visible window; standard for CI pipelines.',
  },
  {
    text: 'What is playwright codegen used for?',
    options: ['Generating unit tests for your Python functions', 'Recording your clicks/typing in a browser and generating the automation script for you', 'Compiling Playwright scripts to run faster', 'Generating fake test data'],
    answer: 1, complexity: 'medium',
    explanation: 'Great live demo moment: run it on stage and let the code write itself.',
  },
  // ---- Section 4 in the document: File & data automation (asked after the Files slide) ----
  {
    text: 'With pathlib, what does Path("data") / "reports" / "out.csv" do?',
    options: ['Divides the path — error', 'Joins them into a path with the correct OS separator', 'Creates the folders on disk', 'Only works on Linux'],
    answer: 1, complexity: 'easy',
    explanation: '/ is overloaded for path joining; nothing touches the disk until you read/write.',
  },
  {
    text: 'After pd.merge(df_left, df_right, on="id", how="left"), what happens to rows in df_left with no matching id in df_right?',
    options: ['They are dropped', 'They are kept, with NaN in the right-side columns', 'They raise a KeyError', 'They are duplicated'],
    answer: 1, complexity: 'medium',
    explanation: 'A left join keeps every left row; unmatched right-side columns become NaN.',
  },
  {
    text: 'What does re.findall(r"<.*>", "<a><b>") return?',
    options: ["['<a>', '<b>']", "['<a><b>']", "['a', 'b']", '[]'],
    answer: 1, complexity: 'hard',
    explanation: '.* is greedy: it grabs the longest match, from the first < to the last >. You\'d need <.*?> (non-greedy) to get A.',
  },
];
