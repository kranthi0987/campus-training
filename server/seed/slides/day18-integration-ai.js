// Day 18 deck. The first eight sections are Kranthi Kumar's Enterprise Integration half (see
// day18-integration.js), the last three are Tharun Kumar's AI Assistance half (day18-ai.js).
// Diagrams for these slides live in day18-integration-ai.diagrams.js, keyed "<section>/<slide>".

/**
 * The trainer introduction slide is built from this block, so it is edited in one place.
 * Fill in the values marked "edit me" before the session; `journey` becomes the animated
 * timeline on the slide (oldest first).
 */
export const TRAINER = {
  name: 'Kranthi Kumar',
  role: 'Integration trainer for this session',                     // what to call you today
  experience: '10 + years',   // e.g. "9 years building APIs and event pipelines"
  lastCompany: 'Tech Lead at Hudson Bay Company',        // e.g. "Senior integration engineer at ..."
  technologies: ['REST', 'SOAP', 'Apigee', 'Kafka', 'OAuth 2.0 / JWT', 'Python','Java','mobile development','Block chain'],
  journey: [
    { when: '2025', title: 'Hudson Bay Company', sub: 'As lead integrations for the company, I was responsible for designing and implementing integration solutions across various systems.' },
    { when: 'Now', title: 'Ferguson', sub: 'building and teaching enterprise integration' },
  ],
};

export default {
  key: "day18-integration-ai",
  title: "Enterprise Integration / AI Assistance",
  sections: [
    {
      id: "about",
      title: "Your trainer",
      slides: [
        {
          title: `Hello, I'm ${TRAINER.name}`,
          bullets: [
            `Today: ${TRAINER.role}.`,
            `Experience: ${TRAINER.experience}.`,
            `Last company: ${TRAINER.lastCompany}.`,
            `Tech I work with: ${TRAINER.technologies.join(', ')}.`,
            "Ask me anything: interrupt whenever something is unclear, that is what today is for."
          ],
          note: "Keep this to two minutes. Say who you are, where you have worked and what you build day to day, then point at the timeline and tell the story from the first milestone to Ferguson. The aim is that the interns see someone who started where they are now. End by inviting questions at any point."
        }
      ]
    },
    {
      id: "big-picture",
      title: "The big picture",
      slides: [
        {
          title: "Why systems need to talk to each other",
          bullets: [
            "Integration: getting separate systems to share data reliably, even when one of them is slow, down or old.",
            "At Ferguson: the branch app, the web store, the ERP, suppliers and carriers all need the same order and stock facts.",
            "Two ways to talk: ask and wait for an answer (an API call), or announce it and move on (an event).",
            "The hard part is not sending data. It is what happens when a call fails, repeats or arrives late.",
            "Today's five topics are the tools teams use for exactly that."
          ],
          note: "Open with the room's own experience: everyone has placed an order online and then got a shipping email. Ask how many systems had to agree for that to happen. Then point at the diagram and name the two conversation styles, ask-and-wait and announce-and-move-on, because everything today is one or the other."
        },
        {
          title: "Today's map: where each topic sits",
          bullets: [
            "REST: the everyday way one system asks another for something over HTTP.",
            "SOAP: the older, stricter style you still meet at the ERP and the bank.",
            "Apigee: the front desk that checks every caller before a backend hears about it.",
            "Kafka: the notice board where an event is posted once and many teams read it.",
            "OAuth 2.0 and JWT: how a caller proves who it is and what it is allowed to do."
          ],
          note: "Walk the packet across the diagram once, left to right, saying which topic each hop belongs to. The interns should leave this slide able to place any later slide on this map. We will come back to the same picture at the end."
        }
      ]
    },
    {
      id: "rest",
      title: "REST",
      slides: [
        {
          title: "What REST is",
          bullets: [
            "Resource: a thing with an address, such as /orders/42. Nouns in the URL, never verbs.",
            "Verb: what you do to it. HTTP already gives you GET, POST, PUT, PATCH and DELETE.",
            "Stateless: every request carries everything needed, so any server can answer it.",
            "Representation: usually JSON, but the same order could come back as XML or CSV.",
            "Think of a library: the catalogue number is the address, borrowing and returning are the verbs."
          ],
          note: "Everyone here has called a REST API, but few can say what makes one RESTful. Anchor it on two ideas: things have addresses, and the set of verbs is fixed and small. Watch the diagram with them: there is no session on the server, the token in the header is the only thing that says who is calling."
        },
        {
          title: "Verbs and status codes",
          bullets: [
            "GET reads, POST creates, PUT replaces, PATCH changes part of it, DELETE removes.",
            "2xx it worked · 3xx look elsewhere · 4xx the caller got it wrong · 5xx we got it wrong.",
            "Use the right verb and code and a caller can react without reading your docs.",
            "A 404 for a missing order and a 403 for one you may not see are different answers on purpose."
          ],
          code: {
            lang: "http",
            text: "GET    /orders/42      ->  200 OK\nPOST   /orders         ->  201 Created + Location: /orders/1042\nPUT    /orders/42      ->  200 OK      (whole order replaced)\nPATCH  /orders/42      ->  200 OK      (only the fields sent)\nDELETE /orders/42      ->  204 No Content\nGET    /orders/99999   ->  404 Not Found"
          },
          note: "Read the table line by line and ask the room what each code tells the caller. Land on the 4xx versus 5xx split: a 4xx says fix your request, a 5xx says wait and try again. That single distinction drives how every client retries."
        },
        {
          title: "Idempotency: safe to press the button twice",
          bullets: [
            "Idempotent: doing it again leaves things the same. GET, PUT and DELETE are; POST is not.",
            "Networks retry: a timeout does not mean the request failed, only that the reply got lost.",
            "Resend a PUT and nothing changes. Resend a POST and you have two orders.",
            "Fix: send an Idempotency-Key with the POST so the server recognises the repeat.",
            "Ask on every write: what happens if this arrives twice?"
          ],
          note: "This is the slide interns have never had to think about, so slow down. Follow the diagram: the order is created, the reply is lost, the user presses submit again. Without the key there are two orders; with it the server finds the first one and returns the saved reply. That is how you get exactly-once behaviour on top of an unreliable network."
        },
        {
          title: "Versioning, paging and errors: promises to other people's code",
          bullets: [
            "Version: put it in the path, /v1/orders. Adding a field is safe; renaming or removing one needs a /v2.",
            "Paging: return a limit plus a cursor. Offset paging skips or repeats rows while data is being inserted.",
            "Errors: one shape everywhere, with a machine code, a human message and a request id.",
            "Request id: what a partner quotes when they call support, so log it on both sides."
          ],
          code: {
            lang: "json",
            text: "{\n  \"code\": \"INVENTORY_INSUFFICIENT\",\n  \"message\": \"Only 4 of 10 units available at branch 17\",\n  \"requestId\": \"b7c1a9e4\",\n  \"details\": [{ \"sku\": \"CU-ELB-075\", \"available\": 4 }]\n}"
          },
          note: "Frame all three as promises you make to someone else's code. A supplier integration written two years ago still calls v1, so v1 has to keep working. Show the error body and stress that the machine-readable code lets the caller branch on it, while the free-text message is only for humans."
        }
      ]
    },
    {
      id: "soap",
      title: "SOAP",
      slides: [
        {
          title: "SOAP: the formal letter",
          bullets: [
            "SOAP is a protocol: every message is an XML Envelope with a Header and a Body.",
            "WSDL: the contract file that lists every operation and every field type in advance.",
            "Tooling: generate code from the WSDL and the remote call looks like a local method.",
            "Faults: errors arrive as a SOAP Fault inside the body, not as an HTTP status.",
            "Compared with REST: the same question with far more ceremony, but a very strict agreement."
          ],
          code: {
            lang: "xml",
            text: "<soap:Envelope xmlns:soap=\"http://www.w3.org/2003/05/soap-envelope\">\n  <soap:Header/>\n  <soap:Body>\n    <GetOrder xmlns=\"urn:distributor:orders\">\n      <OrderId>42</OrderId>\n    </GetOrder>\n  </soap:Body>\n</soap:Envelope>"
          },
          note: "Compare this envelope directly with the REST request from a few slides ago: same intent, far more ceremony. What you buy with the ceremony is a strict, generated contract, which is genuinely useful when two companies must agree on a message format and then not talk for a year."
        },
        {
          title: "Where you will still meet SOAP",
          bullets: [
            "ERP suites, banks and payment rails, EDI gateways and older carrier services.",
            "Regulated links that need message signing or encryption through WS-Security headers.",
            "Long-lived partner contracts: the WSDL was agreed years ago and both sides build against it.",
            "Your usual job: write a thin adapter around it, not learn the whole WS-* stack."
          ],
          note: "The point of this slide is that SOAP is not a history lesson, it is Tuesday. A distributor pulling stock levels, pricing or credit checks from an ERP or a bank very often finds SOAP at the far end. Reassure them: the adapter in the diagram is the usual job, and the app behind it never sees an envelope."
        },
        {
          title: "SOAP or REST: how to choose",
          bullets: [
            "Rule of thumb: choose SOAP only when the other side already speaks SOAP.",
            "REST for anything new, internal or partner facing: simpler clients, HTTP caching, easy testing.",
            "Facade pattern: leave the SOAP backend alone and expose a REST front door at the gateway.",
            "Either way the published contract, WSDL or OpenAPI, is the part you cannot casually change."
          ],
          note: "Make the decision rule blunt, then show the facade pattern in the diagram, because that is what they will actually be asked to build: a REST proxy in front of an ERP web service. Close by noting that whichever style wins, the published contract is the thing you cannot casually change."
        }
      ]
    },
    {
      id: "apigee",
      title: "Apigee",
      slides: [
        {
          title: "What an API gateway does",
          bullets: [
            "Gateway: one front door in front of all your backends. Every outside call passes through it.",
            "It owns the jobs you should not code forty times: auth, rate limits, routing, caching, logging.",
            "Apigee: Google Cloud's gateway product, with a developer portal and analytics built in.",
            "Backends keep the business logic; the rules for partners live in one place.",
            "Like a reception desk: badge check, sign-in book, then directions to the right room."
          ],
          note: "Ask what happens if every one of forty services implements its own rate limiting: forty subtly different bugs. That is the argument for a gateway in one sentence. Position Apigee as one product in a category that also includes Kong, AWS API Gateway and Azure API Management, so the concepts transfer wherever they end up working."
        },
        {
          title: "Proxies, policies, products and apps",
          bullets: [
            "Proxy: the public URL you publish, mapped to a backend target.",
            "Policy: a rule on the request or response: verify key, check token, quota, spike arrest.",
            "Product: a bundle of proxies plus limits that a partner can subscribe to.",
            "App: a partner's registration. It gets a key and secret, and can be revoked with one click.",
            "Quota is a commercial limit per day; spike arrest is a safety limit per second."
          ],
          note: "Walk the four nouns in the order the diagram shows them, because they nest: an app subscribes to a product, a product bundles proxies, and policies run on each proxy. Then draw the line between quota and spike arrest: a partner allowed a thousand calls an hour can still take a backend down by sending all thousand in one second."
        },
        {
          title: "Analytics: why the business pays for a gateway",
          bullets: [
            "Every call is recorded: latency, errors and traffic per app, proxy and region.",
            "It answers real questions: which supplier feed is failing, which branch call is slow.",
            "It proves an SLA: show a partner the 99.9% they were promised.",
            "An error spike on one app usually means that partner shipped a change; you see it before they call."
          ],
          note: "This is the slide that explains why a business pays for a gateway rather than writing an nginx config. For a distributor, partner APIs are revenue: suppliers pushing price files, contractors placing orders, branches syncing stock. Analytics turns all of that into a dashboard you can act on, and into evidence when an SLA is disputed."
        }
      ]
    },
    {
      id: "kafka",
      title: "Kafka",
      slides: [
        {
          title: "Topics, partitions and offsets",
          bullets: [
            "Kafka is a log, not a queue: records stay after they are read, for days or longer.",
            "Topic: a named stream such as orders.created. Partition: one ordered, append-only slice of it.",
            "Offset: a record's position in its partition. Each consumer keeps its own bookmark.",
            "Because nothing is deleted on read, ten services can read the same event, and a late one can catch up.",
            "Picture a notebook per partition: new lines only ever go at the bottom."
          ],
          note: "The single mental shift here is log, not queue. Watch the rows fill up in the diagram, then the bookmark move: the consumer's offset is just where it has read up to, and it can be moved back to replay. Partitions are how Kafka scales that log sideways."
        },
        {
          title: "Keys, consumer groups and ordering",
          bullets: [
            "Key: chooses the partition. Every event for order 42 lands in the same partition, in order.",
            "Ordering is guaranteed inside a partition only, never across the whole topic.",
            "Consumer group: a team of consumers that share the partitions out between them.",
            "Extra consumers beyond the partition count sit idle, so partitions cap your scale-out.",
            "Choose keys with care: keying by country pushes all traffic onto one partition."
          ],
          code: {
            lang: "js",
            text: "await producer.send({\n  topic: \"orders.created\",\n  messages: [\n    { key: \"order-42\", value: JSON.stringify(orderEvent) }\n  ]\n});"
          },
          note: "Keys are where interns usually go wrong, so dwell here. Keying by order id means the created, amended and cancelled events for one order stay in sequence, while different orders still spread across partitions for throughput. Then note the consequence of the group model: your partition count is the ceiling on how far that consumer can scale out."
        },
        {
          title: "Event flows and at-least-once delivery",
          bullets: [
            "One event, many readers: pricing, stock reservation and fulfilment all react to orders.created.",
            "No service calls another directly. That decoupling is what Kafka buys you.",
            "At-least-once: on a retry or a rebalance the same event can arrive twice. That is normal.",
            "Make consumers idempotent: dedupe on the event id, or upsert so a replay changes nothing.",
            "Do not report a duplicate as an upstream bug. Design the consumer for it."
          ],
          note: "Follow the diagram: one order event, two consumer groups, no service calling another. Then the crash before the offset is committed and the redelivery. Land the hard rule: at-least-once means duplicates will happen, so an idempotent consumer is not optional, and an upsert keyed on the event id is usually the cheapest way to get one."
        }
      ]
    },
    {
      id: "oauth-jwt",
      title: "OAuth 2.0 & JWT",
      slides: [
        {
          title: "OAuth 2.0: borrowing a key, not the password",
          bullets: [
            "Four roles: the user, the app (client), the authorization server, and the API (resource server).",
            "The app never sees the password. It gets a scoped token from the authorization server instead.",
            "Authorization code with PKCE: the flow for any app with a human in front of it.",
            "Client credentials: machine to machine, like a nightly supplier feed with nobody logged in.",
            "Like a valet key: it starts the car but not the glove box, and you can take it back."
          ],
          note: "Keep the roles concrete: the branch app is the client, the ordering API is the resource server, and the identity provider is the authorization server. Then say only two grants matter today: authorization code with PKCE for humans, client credentials for machines. The implicit and password grants in older tutorials are deprecated and should not appear in new code."
        },
        {
          title: "Inside a JWT",
          bullets: [
            "Three parts joined by dots: header.payload.signature, each base64url encoded.",
            "Signed, not encrypted: anyone can read the claims, so never put a secret in one.",
            "Standard claims: iss (who issued it), sub (who it is about), aud (which API), exp and iat (when).",
            "The signature proves the issuer made it. An API checks it locally with the issuer's public key.",
            "Keep expiry short and use a refresh token to get a new one quietly."
          ],
          note: "Let the diagram decode the token part by part; watching the payload appear in plain text kills the idea that a JWT is encrypted. The value of a JWT is that an API can validate it locally with a public key instead of calling the auth server on every request. The cost is that you cannot easily un-issue one, which is exactly why expiry is kept short."
        },
        {
          title: "Validating tokens, and the classic mistakes",
          bullets: [
            "Check in this order: signature, issuer, audience, expiry, then the scope for that route.",
            "Keys: fetch them from the issuer's JWKS endpoint and cache them, because keys rotate.",
            "Scopes stay narrow: orders.read for a lookup, orders.write only where orders are created.",
            "Mistakes: trusting alg from the header, skipping aud, no expiry check, tokens in URLs or logs."
          ],
          note: "Validating at the gateway means each backend service can trust the identity it is handed rather than reimplementing crypto five times. Walk the checks in the diagram in order, then the mistake list slowly; the alg one is the classic attack, where a forged token claims no signature and a lazy library accepts it. Finish on scopes, because over-broad scopes are the quiet failure nobody notices until there is an incident."
        }
      ]
    },
    {
      id: "wrap",
      title: "Wrap-up",
      slides: [
        {
          title: "Recap: five ideas to keep",
          bullets: [
            "REST: things have addresses, the verbs are fixed, and every write should be safe to retry.",
            "SOAP: a strict XML contract. Still real at the ERP and the bank, usually behind an adapter.",
            "Apigee: the gateway checks, counts and records every call so backends do not have to.",
            "Kafka: a replayable log. Keys give ordering, and consumers must cope with duplicates.",
            "OAuth and JWT: short-lived, scoped tokens, validated at the gateway on every call."
          ],
          note: "Read one line per section and pause for questions after each. The thread through all five is contracts and failure: what you promise callers, and what happens when the network misbehaves."
        },
        {
          title: "What you can do now",
          bullets: [
            "Call a REST API and explain the status code you got back.",
            "Read a WSDL and say which operation a SOAP call is using.",
            "Explain what the gateway would block before a backend ever saw the request.",
            "Follow one order event from producer to two consumers, including a redelivery.",
            "Decode a JWT and list the checks an API must make before trusting it.",
            "Questions? Then the quiz."
          ],
          note: "The diagram is the same map as the start of the session. Trace the packet once more and let the interns name each hop this time. Then open the quiz from the host screen."
        }
      ]
    },
    {
      id: "github-copilot",
      title: "GitHub Copilot",
      slides: [
        {
          title: "Copilot in the editor",
          bullets: [
            "Inline completions propose the next line or a whole function body as you type; Tab accepts.",
            "Chat answers questions about the selected code, explains it, and proposes edits in place.",
            "It drafts the boring things well: unit tests, doc comments, regexes, commit messages.",
            "It predicts plausible code from surrounding context - it is not running or verifying anything."
          ],
          code: {
            lang: "js",
            text: "// Return branches within radiusKm of a postcode that\n// currently hold stock of the given SKU.\nfunction findStockingBranches(postcode, sku, radiusKm) {\n  // Copilot drafts the body from the comment and signature\n}"
          },
          note: "Show completion, chat and explain as three different tools rather than one blurry feature. Explain is the one interns underuse and benefit from most - point it at an unfamiliar legacy file and it will summarise the intent in seconds. Say plainly that it is a very good autocomplete with taste, not a compiler and not a reviewer."
        },
        {
          title: "How to get good results",
          bullets: [
            "Write the intent first: a clear comment or a well-named signature is your prompt.",
            "Keep functions small - suggestion quality falls off as the surrounding function grows.",
            "Open the files that matter; types, models and neighbouring code become the context it sees.",
            "If a suggestion is wrong, reject and rephrase rather than editing it into shape.",
            "Show it your conventions: an existing handler nearby beats a paragraph of description."
          ],
          note: "The theme is that Copilot is only as good as the context you leave open around it. Naming a function findStockingBranches gets far better output than calling it helper2. Encourage the habit of steering by rewriting the comment, because repairing a bad suggestion by hand usually costs more than asking again with a clearer prompt."
        },
        {
          title: "Limits, review and hygiene",
          bullets: [
            "You own every line you accept; review it as if a stranger had sent you a pull request.",
            "It confidently invents APIs, flags and config options that do not exist - check the real docs.",
            "Never paste secrets, credentials or customer data into a prompt or a file it can read.",
            "Suggestions can resemble public code; follow your organisation's policy on filters and licensing.",
            "Tests and code review still apply, unchanged - AI-written code is not pre-approved code."
          ],
          note: "This is the slide the interns need to remember once they are on a real team. Accepting a suggestion is the same act as writing the line yourself, including owning the bug. Cover the practical hygiene too: no secrets in prompts, and check what your employer's policy says about duplicate-detection filters before you turn anything on."
        }
      ]
    },
    {
      id: "gemini",
      title: "Google Gemini",
      slides: [
        {
          title: "The Gemini family and multimodal input",
          bullets: [
            "A family of Google models: Pro tiers for harder reasoning, Flash tiers for cheap, fast work.",
            "Multimodal input: text, images, PDFs, audio and video can go into the same request.",
            "Large context windows let you pass long documents such as a supplier catalogue or spec sheet.",
            "Concrete use: read a scanned purchase order and return structured line items for review."
          ],
          note: "Frame the family as a cost and latency dial rather than a quality ladder - most production traffic belongs on a Flash tier, with a Pro tier kept for the hard cases. Multimodality is the part worth highlighting for a distributor, since so much supplier input arrives as PDFs and photographs. Keep specific model names loose, because the line-up moves quickly."
        },
        {
          title: "Calling generateContent",
          bullets: [
            "One main entry point: generateContent, taking a model id, contents and a system instruction.",
            "The system instruction sets role and rules; contents carries the turn-by-turn conversation.",
            "Call it from a server and keep the API key there - never ship a key in browser or mobile code.",
            "Use the streaming variant for chat UIs so text appears while the rest is still generating.",
            "Official SDKs cover Python, Node, Go and Java; the REST shape underneath is the same."
          ],
          code: {
            lang: "http",
            text: "POST /v1beta/models/gemini-2.5-flash:generateContent\nx-goog-api-key: SERVER_SIDE_KEY\n\n{\n  \"systemInstruction\": {\n    \"parts\": [{ \"text\": \"You are a parts assistant. Use only the catalog.\" }]\n  },\n  \"contents\": [\n    { \"role\": \"user\", \"parts\": [{ \"text\": \"What fits part CU-ELB-075?\" }] }\n  ]\n}"
          },
          note: "Read the request out loud field by field, because this shape is the same idea inside every SDK wrapper they will meet. Stress the split between the system instruction, which is stable policy, and contents, which is the moving conversation. Then hammer the key: it belongs in a server-side header or a secret manager, never in a repo and never in client code."
        },
        {
          title: "Grounding, JSON output, safety and cost",
          bullets: [
            "Grounding ties answers to a source - web search or your own documents - instead of memory.",
            "Ask for structured output with a response schema and you get parseable JSON, not prose.",
            "Retrieval over your own catalogue and price files is what makes answers trustworthy internally.",
            "Safety filters can block or flag a response, so handle a blocked result as a real code path.",
            "Cost and latency track tokens: trim context, cache what repeats, prefer a Flash tier when you can."
          ],
          code: {
            lang: "json",
            text: "\"generationConfig\": {\n  \"responseMimeType\": \"application/json\",\n  \"responseSchema\": {\n    \"type\": \"OBJECT\",\n    \"properties\": {\n      \"sku\": { \"type\": \"STRING\" },\n      \"quantity\": { \"type\": \"INTEGER\" }\n    }\n  }\n}"
          },
          note: "Structured output is the feature that turns a model from a demo into a component you can drop into a pipeline, so show the schema and note that it removes all the fragile string parsing. Grounding is the practical answer to hallucination: if the answer must come from our catalogue, supply the catalogue. Close on the engineering realities - blocked responses, token cost and latency budgets all need handling before this goes live."
        }
      ]
    },
    {
      id: "prompt-engineering",
      title: "Prompt engineering",
      slides: [
        {
          title: "Anatomy of a good prompt",
          bullets: [
            "Role: who the model is acting as. Task: the single thing you want done.",
            "Context: the data, code or documents it must use, clearly delimited from your instructions.",
            "Format: exactly what comes back - JSON keys, table columns, a bullet count, a word limit.",
            "Constraints: what to avoid, which values are allowed, what to do when information is missing.",
            "If you cannot describe the output precisely, the model cannot produce it reliably."
          ],
          code: {
            lang: "text",
            text: "Role: You are a support triage assistant for a plumbing distributor.\nTask: Classify the customer email below.\nContext: <email>...</email>\nFormat: JSON with keys category, urgency, branch, summary.\nConstraints: category is one of order, delivery, returns, billing.\nIf the branch is not stated use null. Do not invent order numbers."
          },
          note: "Give them the five-part checklist as something to physically run through before sending a prompt. The example on screen is deliberately dull, because dull and explicit is what survives in production. Point at the last constraint especially - telling the model what to do when data is missing is the difference between a null and an invented order number."
        },
        {
          title: "Few-shot and step-by-step reasoning",
          bullets: [
            "Few-shot: show two or three worked pairs of input and the exact output you want back.",
            "Examples teach format and edge cases far better than another paragraph of instructions.",
            "Include one awkward example - a missing field, a mixed case - so the pattern covers reality.",
            "For multi-step work, ask for a short plan or reasoning before the answer, then the result.",
            "Chain prompts for hard jobs: extract, then validate, then summarise, each step checkable."
          ],
          note: "Few-shot is the highest-return technique on this slide, and the trick is that the awkward example does most of the work. Then explain step-by-step reasoning as giving the model room to work rather than forcing an answer in a single jump. Chaining is the professional version: small verifiable steps you can test, instead of one enormous prompt nobody can debug."
        },
        {
          title: "Checking, iterating, before and after",
          bullets: [
            "Hallucination check: can every fact be traced to context you supplied? If not, supply it.",
            "Test on several real inputs, including messy ones, not just the example that worked first.",
            "Change one thing at a time, and keep versions - prompts are code and belong in the repo.",
            "Compare the before and after: same task, but the second is testable and hard to misread."
          ],
          code: {
            lang: "text",
            text: "Before: Summarise this order issue.\n\nAfter:  You are a support agent for a plumbing distributor.\n        Summarise the order issue below in three bullets, then\n        state the next action. Use only the email text. If the\n        order number is missing, write \"not stated\".\n        Email: <email>...</email>"
          },
          note: "Put the before and after side by side and ask the room what changed - role, format, source restriction and a rule for missing data. Make the point that the second prompt can be tested, because you know what a correct answer looks like. Finish by insisting prompts live in version control next to the code that calls them, not pasted into a chat window and lost."
        },
        {
          title: "Recap",
          bullets: [
            "REST: resources plus fixed verbs, idempotency, and one consistent error shape.",
            "SOAP: XML envelope and a WSDL contract - still real in ERP, banking and EDI.",
            "Apigee: the gateway owns auth, quota, spike arrest and partner analytics.",
            "Kafka: a replayable partitioned log; keys give ordering, consumers must be idempotent.",
            "OAuth and JWT: short-lived scoped tokens, validated at the gateway on every call.",
            "Copilot: fast drafts from clear intent, but you own and review every line.",
            "Gemini: multimodal generateContent, grounded answers and schema-shaped JSON.",
            "Prompts: role, task, context, format, constraints - then test and iterate."
          ],
          note: "Use this as the wrap-up and read one line per section, pausing for questions. The integration half is about contracts and failure: what you promise callers, and what happens when the network misbehaves. The AI half is about context and responsibility: give the tool what it needs, and check what it hands back."
        }
      ]
    }
  ]
};
