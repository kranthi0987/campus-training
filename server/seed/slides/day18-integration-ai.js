export default {
  key: "day18-integration-ai",
  title: "Enterprise Integration / AI Assistance",
  sections: [
    {
      id: "rest",
      title: "REST",
      slides: [
        {
          title: "What REST is",
          bullets: [
            "An architectural style, not a protocol: resources get URLs and HTTP verbs act on them.",
            "URLs name nouns: /orders/42 or /branches/17/inventory, never /getOrderById?id=42.",
            "Stateless: each request carries its own auth and context, so any instance can serve it.",
            "JSON is the usual representation, but the same resource may also be returned as CSV or XML."
          ],
          code: {
            lang: "http",
            text: "GET /orders/42 HTTP/1.1\nHost: api.distributor.example\nAccept: application/json\nAuthorization: Bearer eyJhbGciOi..."
          },
          note: "Everyone here has called a REST API, but few can say what makes one RESTful. Anchor it on two ideas: resources have addresses, and the set of verbs is fixed and small. Point at the request on screen and note there is no session on the server - the token in the header is the only thing identifying the caller."
        },
        {
          title: "Methods, status codes and idempotency",
          bullets: [
            "GET reads, POST creates, PUT replaces, PATCH updates part of it, DELETE removes.",
            "GET, PUT and DELETE are idempotent: repeating one lands in the same state. POST is not.",
            "2xx worked, 3xx go elsewhere, 4xx the caller is wrong, 5xx we are wrong.",
            "This matters because networks retry: resending a PUT is safe, resending a POST duplicates.",
            "Give unsafe POSTs an idempotency key so a retried create is recognised, not repeated."
          ],
          code: {
            lang: "http",
            text: "POST /orders HTTP/1.1\nIdempotency-Key: br17-po-9931\n\nHTTP/1.1 201 Created\nLocation: /orders/1042"
          },
          note: "Spend most of this slide on idempotency, because it is the part interns have never had to think about. Ask what happens if the branch app times out after the order was actually created and the user hits submit again. The idempotency key is how you get exactly-once behaviour on top of an unreliable network."
        },
        {
          title: "Versioning, pagination and error shape",
          bullets: [
            "Version in the path (/v1/orders) or a media type; never break a live partner silently.",
            "Adding a field is safe; removing or renaming one is breaking and needs a new version.",
            "Page big collections with a limit plus a cursor - offset paging drifts as rows are inserted.",
            "Return one error shape everywhere: a machine code, a human message and a request id.",
            "The request id is what a partner quotes when they ring support, so log it on both sides."
          ],
          code: {
            lang: "json",
            text: "{\n  \"code\": \"INVENTORY_INSUFFICIENT\",\n  \"message\": \"Only 4 of 10 units available at branch 17\",\n  \"requestId\": \"b7c1a9e4\",\n  \"details\": [{ \"sku\": \"CU-ELB-075\", \"available\": 4 }]\n}"
          },
          note: "Frame all three as promises you make to someone else's code. A supplier integration written two years ago is still calling v1, so v1 has to keep working. Show the error body and stress that a machine-readable code lets the caller branch on it, while the free-text message is only for humans."
        }
      ]
    },
    {
      id: "soap",
      title: "SOAP",
      slides: [
        {
          title: "The SOAP envelope and WSDL",
          bullets: [
            "SOAP is a protocol: every message is an XML Envelope with an optional Header and a Body.",
            "The WSDL document describes operations, message types and endpoints - contract first.",
            "Tooling generates client stubs from the WSDL, so a remote call looks like a local method.",
            "The WS-Security family layers signing, reliable messaging and transactions on top.",
            "Errors come back as a SOAP Fault inside the Body, not as an HTTP status code."
          ],
          code: {
            lang: "xml",
            text: "<soap:Envelope xmlns:soap=\"http://www.w3.org/2003/05/soap-envelope\">\n  <soap:Header/>\n  <soap:Body>\n    <GetOrder xmlns=\"urn:distributor:orders\">\n      <OrderId>42</OrderId>\n    </GetOrder>\n  </soap:Body>\n</soap:Envelope>"
          },
          note: "Compare this envelope directly with the REST request from a few slides ago - same intent, far more ceremony. What you buy with the ceremony is a strict, generated contract: the WSDL tells your tooling every operation and every field type up front. That is genuinely useful when two companies must agree on a message format and then not talk for a year."
        },
        {
          title: "Where SOAP still shows up",
          bullets: [
            "ERP suites, banking and payment rails, EDI gateways and older shipping carrier services.",
            "Regulated integrations that need message signing or encryption via WS-Security headers.",
            "Long-lived partner contracts: the WSDL was agreed years ago and both sides build against it.",
            "You will consume a SOAP service far more often than you will ever build a new one."
          ],
          note: "The point of this slide is that SOAP is not a history lesson - it is Tuesday. A distributor pulling stock levels, pricing or credit checks from an ERP or a bank very often finds SOAP at the far end. Reassure them that the usual job is writing a thin adapter around it, not learning the whole WS-Security stack."
        },
        {
          title: "SOAP or REST: how to choose",
          bullets: [
            "For anything new, internal or partner facing, default to REST; use SOAP only if forced.",
            "SOAP gives a strict machine-readable contract; REST gives simpler clients and HTTP caching.",
            "Common pattern: leave the legacy SOAP backend alone and expose a REST facade at the gateway.",
            "Either way the contract - WSDL or OpenAPI - is the real thing partners integrate against."
          ],
          note: "Make the decision rule blunt: you choose SOAP when the other side already speaks SOAP, and almost never otherwise. Then show the facade pattern, because that is what they will actually be asked to build - a REST proxy in front of an ERP web service. Close by noting that whichever style wins, the published contract is the thing you cannot casually change."
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
            "A gateway sits in front of your backends and owns the concerns you should not code twice.",
            "Authentication, rate limiting, routing, caching, logging, transformation and versioning.",
            "Apigee is Google Cloud's API management platform: gateway, developer portal and analytics.",
            "Backends stay focused on business logic; partner-facing policy lives in one place."
          ],
          note: "Ask what happens if every one of forty services implements its own rate limiting - you get forty subtly different bugs. That is the argument for a gateway in one sentence. Position Apigee as one product in a category that also includes Kong, AWS API Gateway and Azure API Management, so the concepts transfer wherever they end up working."
        },
        {
          title: "Proxies, policies, products and apps",
          bullets: [
            "An API proxy is the public endpoint you publish; it maps to a target backend URL.",
            "Policies attach to the request or response flow: verify API key, OAuth check, quota, spike arrest.",
            "Quota caps calls per app per window; spike arrest smooths sudden bursts to protect backends.",
            "An API product bundles proxies and limits; developers register an app and get a key and secret.",
            "Revoking one partner app is then a click in the console, not a backend deploy."
          ],
          code: {
            lang: "xml",
            text: "<SpikeArrest name=\"SA-Protect-Inventory\">\n  <Rate>30ps</Rate>\n</SpikeArrest>\n\n<Quota name=\"Q-Partner-Tier\">\n  <Interval>1</Interval>\n  <TimeUnit>hour</TimeUnit>\n  <Allow count=\"1000\"/>\n</Quota>"
          },
          note: "Walk the four nouns in order, because they nest: policies live on proxies, proxies are bundled into products, and apps subscribe to products. Use the two policies on screen to draw the distinction between quota, which is a commercial limit, and spike arrest, which is a protective one. A partner on a thousand calls an hour can still take a backend down by sending all thousand in one second."
        },
        {
          title: "Analytics and why partners care",
          bullets: [
            "The gateway records every call: latency, error rate and traffic by app, proxy and region.",
            "It answers the real questions - which supplier integration is failing, which branch feed is slow.",
            "It feeds capacity planning and partner SLAs, so you can show a 99.9% target was met.",
            "An error spike on one app usually means that partner shipped a change; you see it before they ring."
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
            "Kafka is a durable, replayable log - not a queue that deletes a message once it is read.",
            "A topic such as orders.created is split into partitions; each is an ordered, append-only log.",
            "Every record has an offset, its position in that partition, and consumers track their own.",
            "Retention is by time or size, so a brand new consumer can replay history from the beginning."
          ],
          code: {
            lang: "text",
            text: "topic: orders.created\n  partition 0 | 0 1 2 3 4 5 -> append here\n  partition 1 | 0 1 2 3\n  partition 2 | 0 1 2 3 4 5 6 7\n\ngroup inventory-svc: committed offset p0=4"
          },
          note: "The single mental shift here is log, not queue. Because records are not destroyed on read, ten different services can consume the same order event independently, and a service that was down all afternoon can catch up by replaying. Partitions are how Kafka scales that log horizontally, and an offset is just a bookmark each consumer keeps for itself."
        },
        {
          title: "Producers, consumer groups, keys and ordering",
          bullets: [
            "The record key picks the partition, so every event for order 42 lands in the same partition.",
            "Ordering is guaranteed within a partition only, never across a whole topic.",
            "A consumer group shares out the partitions; extra consumers beyond the partition count idle.",
            "Rebalancing reassigns partitions when a consumer joins, leaves or dies - expect it in production.",
            "Choose keys carefully: a coarse key such as country skews all traffic onto one partition."
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
            "Order placed publishes orders.created; pricing, stock reservation and fulfilment each react.",
            "Branches publish inventory.updated, feeding the catalogue, the web store and replenishment.",
            "Default delivery is at-least-once, so duplicates are normal on retries and rebalances.",
            "Make consumers idempotent: dedupe on the event id, or use upserts so a replay changes nothing.",
            "Do not treat a duplicate as an upstream bug to fix - design for it in the consumer."
          ],
          note: "Draw the fan-out on the board: one order event, three independent consumers, no service calling another directly. That decoupling is the whole reason to reach for Kafka rather than more REST calls. Then land the hard rule - at-least-once means duplicates will happen, so an idempotent consumer is not optional, and an upsert keyed on the event id is usually the cheapest way to get one."
        }
      ]
    },
    {
      id: "oauth-jwt",
      title: "OAuth 2.0 & JWT",
      slides: [
        {
          title: "OAuth 2.0 roles and the grants you need",
          bullets: [
            "Four roles: resource owner (the user), client (the app), authorization server, resource server.",
            "OAuth is delegated authorization: the app gets a scoped token and never sees the password.",
            "Authorization code with PKCE is the grant for any user-facing app, web, mobile or desktop.",
            "Client credentials is machine to machine - a nightly supplier feed with no user present.",
            "PKCE stops a stolen code being redeemed, since only the real client knows the verifier."
          ],
          code: {
            lang: "http",
            text: "GET /authorize?response_type=code&client_id=branch-app\n  &redirect_uri=https://branch.example/cb&scope=orders.read\n  &code_challenge=XU3s...&code_challenge_method=S256\n\nPOST /token\n  grant_type=authorization_code&code=...&code_verifier=..."
          },
          note: "Keep the roles concrete: the branch app is the client, the ordering API is the resource server, and the identity provider is the authorization server. Then say only two grants matter today - authorization code with PKCE for humans, client credentials for machines. Everything else in older tutorials, especially the implicit and password grants, is deprecated and should not appear in new code."
        },
        {
          title: "Inside a JWT",
          bullets: [
            "Three base64url parts joined by dots: header, payload, signature. It is signed, not encrypted.",
            "Anyone holding the token can read the claims, so never put a secret in the payload.",
            "Standard claims: iss, sub, aud, exp and iat, plus the scopes or roles the API enforces.",
            "The signature, typically RS256 or ES256, proves the issuer signed it; verify with its public key.",
            "Keep expiry short and use a refresh token to get a new access token without re-prompting."
          ],
          code: {
            lang: "json",
            text: "{\n  \"iss\": \"https://auth.distributor.example\",\n  \"sub\": \"svc-supplier-feed\",\n  \"aud\": \"orders-api\",\n  \"scope\": \"orders.read inventory.write\",\n  \"iat\": 1789446400,\n  \"exp\": 1789450000\n}"
          },
          note: "Decode a real token on the projector if you have one handy - watching the payload appear in plain text kills the idea that a JWT is encrypted. The value of a JWT is that an API can validate it locally with a public key instead of calling the auth server on every request. The cost is that you cannot easily un-issue one, which is exactly why expiry is kept short."
        },
        {
          title: "Validating tokens and common mistakes",
          bullets: [
            "Validate at the gateway: signature, issuer, audience and expiry, then the scope for that route.",
            "Fetch signing keys from the issuer's JWKS endpoint and cache them, because keys rotate.",
            "Keep scopes narrow: orders.read for a lookup, orders.write only where orders are created.",
            "Classic mistakes: trusting alg from the header, skipping aud, no expiry check, tokens in URLs.",
            "Never log a raw token - a log line is a working credential until it expires."
          ],
          note: "Validating at the gateway means each backend service can trust the identity it is handed rather than reimplementing crypto five times. Walk the mistake list slowly; the alg one is the classic attack, where a forged token claims no signature and a lazy library accepts it. Finish on scopes, because over-broad scopes are the quiet failure nobody notices until there is an incident."
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
