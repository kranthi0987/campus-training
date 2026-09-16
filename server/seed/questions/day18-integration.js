// Day 18 · Enterprise Integration, Kranthi Kumar. A tough, scenario-based bank: every question
// describes a situation an integration engineer meets and asks what happens or what to do.
// REST 5 · SOAP 3 · Apigee 4 · Kafka 5 · OAuth 2.0 / JWT 4. Complexity drives the timer
// (easy 20 s, medium 40 s, hard 60 s); the "easy" ones here are the least hard, not trivial.
// Run `node scripts/validate-questions.mjs` after editing, then
// `node scripts/reload-session.mjs day18-integration` to push it into the existing session.
export default [
  // ---- REST ---------------------------------------------------------------------------------
  {
    text: "A client sends PUT /orders/42 with the header If-Match: \"v7\" and receives 412 Precondition Failed. What happened?",
    options: [
      "The order no longer exists",
      "The request body failed schema validation",
      "The bearer token has expired",
      "The order changed since the client read it, so its ETag is no longer v7",
    ],
    answer: 3,
    complexity: "hard",
    explanation: "If-Match makes the update conditional on the version the client last saw. 412 means someone else changed the order in between, so the client must re-read and retry.",
  },
  {
    text: "A partner's nightly job pages through GET /orders?offset=5000&limit=100 while new orders keep being inserted and sorted by date. What goes wrong?",
    options: [
      "Rows shift between pages, so some orders are skipped and others returned twice",
      "The API starts returning 429 Too Many Requests",
      "Nothing: offsets are stable for the life of the job",
      "The offset overflows once it passes 65535",
    ],
    answer: 0,
    complexity: "hard",
    explanation: "Offset paging counts rows from the start, and inserts move every later row. Cursor paging (a token for the last row seen) survives inserts.",
  },
  {
    text: "The first request below created order 1042. What should the server do with the second one?",
    code: "POST /orders\nIdempotency-Key: k-771\n{ \"sku\": \"CU-ELB-075\", \"qty\": 10 }\n\nPOST /orders\nIdempotency-Key: k-771\n{ \"sku\": \"CU-ELB-075\", \"qty\": 20 }",
    options: [
      "Create a second order with qty 20",
      "Update order 1042 to qty 20",
      "Reject it, because the same key arrived with a different payload",
      "Return the saved 201 for order 1042 and ignore the new body",
    ],
    answer: 2,
    complexity: "hard",
    explanation: "An idempotency key promises a retry of the same request. A different body under the same key is a client bug, so answer with a 409 or 422 rather than guess.",
  },
  {
    text: "Thirty partner apps consume /v1/orders. Which change can ship without a new version?",
    options: [
      "Renaming qty to quantity in every order line",
      "Adding an optional warehouse field to each order",
      "Changing total from a number to a formatted string",
      "Dropping status from the list endpoint but keeping it on the detail endpoint",
    ],
    answer: 1,
    complexity: "easy",
    explanation: "Adding a field is additive: old clients ignore what they do not know. Renaming, retyping or removing a field breaks somebody and belongs in /v2.",
  },
  {
    text: "A client sends PATCH /orders/42 with the JSON Merge Patch body { \"promoCode\": null }. What does the server do with promoCode?",
    options: [
      "Removes the field from the order",
      "Stores the literal value null",
      "Leaves the field unchanged, because null means no value was supplied",
      "Rejects the request, because null is not allowed in a patch",
    ],
    answer: 0,
    complexity: "hard",
    explanation: "In JSON Merge Patch (RFC 7386) null means delete. That is why a merge patch cannot set a field to null, and why JSON Patch exists for finer control.",
  },
  // ---- SOAP ---------------------------------------------------------------------------------
  {
    text: "An ERP SOAP service rejects an order because the customer is over their credit limit. How does that error reach the caller?",
    options: [
      "As an HTTP 404 with an empty body",
      "As a custom X-Error header on the response",
      "As a <soap:Fault> element inside the Body",
      "As an entry in the WSDL",
    ],
    answer: 2,
    complexity: "easy",
    explanation: "SOAP carries errors inside the message as a Fault in the Body, with a code and reason. The HTTP status is often still 500 or even 200, so clients must read the Fault.",
  },
  {
    text: "The ERP team adds a new optional element to a SOAP response. Your client, generated from the old WSDL, immediately starts throwing unmarshalling errors. Why?",
    options: [
      "The generated client validates responses strictly against the old schema and rejects the unknown element",
      "SOAP responses must be byte-identical to the WSDL example",
      "The new element changed the endpoint URL",
      "Optional elements require a WS-Security header",
    ],
    answer: 0,
    complexity: "hard",
    explanation: "Contract-first tooling can be strict: the client's schema has no place for the new element. Regenerate from the new WSDL, or relax validation, and agree change rules with the provider.",
  },
  {
    text: "A signed SOAP message travels over TLS through a partner's routing intermediary. What does the WS-Security signature give you that TLS alone does not?",
    options: [
      "Faster transfer through compression",
      "Encryption of the network connection",
      "Authentication of the intermediary's server certificate",
      "Integrity and proof of origin that survive the intermediary and can be verified later",
    ],
    answer: 3,
    complexity: "hard",
    explanation: "TLS protects one hop and ends at the intermediary, which can then read or alter the message. A message signature is checked end to end and can be kept as evidence.",
  },
  // ---- Apigee ----------------------------------------------------------------------------------
  {
    text: "A partner app has a quota of 1000 calls per hour. At 09:00 it fires 800 calls in one second and the backend falls over. Which Apigee policy was missing, and why was quota not enough?",
    options: [
      "VerifyAPIKey, because keys are rate limited by default",
      "SpikeArrest, because quota only counts the hour's total and says nothing about bursts",
      "Quota with a smaller number, because 1000 was too generous",
      "ResponseCache, because repeated calls would then never reach the backend",
    ],
    answer: 1,
    complexity: "medium",
    explanation: "Quota is a commercial limit over a window; spike arrest smooths the rate per second or minute to protect the backend. A partner can be inside quota and still flood you.",
  },
  {
    text: "An admin revokes a developer app in the Apigee console. The app's next call still carries its API key, which has no expiry. What happens?",
    options: [
      "The call succeeds until the key is rotated",
      "The backend must look up the revocation itself",
      "VerifyAPIKey fails at the proxy, so the backend never sees the call",
      "The call succeeds but is excluded from analytics",
    ],
    answer: 2,
    complexity: "hard",
    explanation: "Key verification checks the app's status on every call, so revoking the app cuts it off at the gateway with no backend change or deploy.",
  },
  {
    text: "You must route /v2/orders to a new backend while /v1/orders keeps calling the old one, and existing API products should cover both. What is the cleanest Apigee design?",
    options: [
      "Two proxies with different base paths, each with its own target endpoint, both added to the products",
      "One proxy with a JavaScript policy that rewrites the target host from the path",
      "A second Apigee organisation for v2",
      "One proxy that asks partners to send an X-Version header",
    ],
    answer: 0,
    complexity: "hard",
    explanation: "A proxy owns a base path and a target. Versioning by base path keeps each version independently deployable and lets a product bundle both without custom code.",
  },
  {
    text: "Apigee analytics shows one partner app's error rate jumping from 0.1% to 40% at 09:00 with latency unchanged, while every other app on the same proxy is fine. Most likely cause?",
    options: [
      "The backend service is down",
      "The gateway's TLS certificate expired",
      "The quota policy was removed from the proxy",
      "That partner deployed a change to its own client",
    ],
    answer: 3,
    complexity: "hard",
    explanation: "A backend or gateway fault would hit every app. Errors isolated to one app with normal latency point at that caller's requests, typically a client release.",
  },
  // ---- Kafka -----------------------------------------------------------------------------------
  {
    text: "The topic orders.created has 6 partitions and the inventory consumer group runs 8 consumers. What happens?",
    options: [
      "All 8 consumers share the records evenly",
      "2 consumers sit idle, because a partition goes to at most one consumer in a group",
      "Kafka raises the partition count to 8 automatically",
      "The group fails to start until 2 consumers are removed",
    ],
    answer: 1,
    complexity: "medium",
    explanation: "Partitions are the unit of parallelism. To scale a group beyond 6 you must add partitions, and adding partitions changes which partition each key maps to.",
  },
  {
    text: "A consumer runs the loop below and crashes inside process() on offset 41. What delivery semantics does it get for record 41?",
    code: "for (const record of consumer.poll()) {\n  await consumer.commit(record.offset + 1);\n  await process(record);\n}",
    options: [
      "At-least-once: the record is delivered again after restart",
      "Exactly-once: Kafka rolls the commit back",
      "At-most-once: the offset was committed before the work, so the record is lost",
      "Ordered replay from the start of the partition",
    ],
    answer: 2,
    complexity: "hard",
    explanation: "Committing before processing means a crash loses the record. Commit after processing for at-least-once, then make the processing idempotent to cope with duplicates.",
  },
  {
    text: "You key orders.created by country code. Ninety percent of Ferguson orders come from one country. What is the effect?",
    options: [
      "Kafka spreads the hot key across partitions automatically",
      "The topic switches to log compaction",
      "Nothing: the hash spreads records evenly regardless of key values",
      "One partition takes almost all the traffic, so one consumer does almost all the work",
    ],
    answer: 3,
    complexity: "hard",
    explanation: "Equal keys always land on the same partition. A coarse key creates a hot partition and caps throughput at one consumer. Key by something fine-grained such as order or customer id.",
  },
  {
    text: "A brand new consumer group starts on a topic that keeps 7 days of records, with auto.offset.reset=earliest. What does it read first?",
    options: [
      "Only records produced after it started",
      "Everything still retained, from the oldest record onwards",
      "The last 1000 records of each partition",
      "Nothing until the producer sends a new record",
    ],
    answer: 1,
    complexity: "medium",
    explanation: "A group with no committed offset starts where the reset policy says. earliest replays retained history, which is how a new service can catch up on a week of events.",
  },
  {
    text: "After a rebalance the inventory consumer receives event E1 (reserve 4 units for order 9001) a second time. Stock must not be reserved twice. What is the right fix?",
    options: [
      "Make the reservation idempotent: record processed event ids and skip, or upsert keyed on the event",
      "Ask the producer team to guarantee each event is sent exactly once",
      "Set the topic retention to zero so records cannot be redelivered",
      "Add more partitions so redeliveries land on another consumer",
    ],
    answer: 0,
    complexity: "hard",
    explanation: "Default delivery is at-least-once, so duplicates are normal after retries and rebalances. Only the consumer can make the effect happen once.",
  },
  // ---- OAuth 2.0 / JWT -------------------------------------------------------------------------
  {
    text: "An API configured with the issuer's RS256 public key accepted a forged token whose header said \"alg\": \"none\". What was the flaw?",
    options: [
      "The audience claim was not checked",
      "The expiry claim was missing",
      "The public key had been rotated",
      "The verifier trusted the algorithm named in the token instead of pinning the one it expects",
    ],
    answer: 3,
    complexity: "hard",
    explanation: "Letting the token choose the algorithm lets an attacker choose none or swap to HMAC with the public key. Always verify with a fixed, expected algorithm.",
  },
  {
    text: "A mobile app uses the authorization code flow with PKCE. Which attack does PKCE specifically defeat?",
    options: [
      "Guessing the user's password",
      "Forging the JWT signature",
      "Redeeming an intercepted authorization code without the code_verifier",
      "Replaying an access token after it expired",
    ],
    answer: 2,
    complexity: "hard",
    explanation: "A mobile app cannot hold a client secret, so a stolen code could be exchanged by anyone. PKCE ties the code to a one-time verifier only the real app knows.",
  },
  {
    text: "The token below has a valid signature and is presented to orders-api. Should orders-api accept it?",
    code: "{\n  \"iss\": \"https://auth.distributor.example\",\n  \"sub\": \"svc-supplier-feed\",\n  \"aud\": \"inventory-api\",\n  \"scope\": \"orders.read\",\n  \"exp\": 1789450000\n}",
    options: [
      "Yes: the signature is valid and orders.read is the right scope",
      "No: aud names a different API, so this token was not issued for orders-api",
      "No: the subject is a service account, not a user",
      "Yes, provided iss is a trusted issuer",
    ],
    answer: 1,
    complexity: "medium",
    explanation: "A valid signature only proves who issued the token. The audience says who it is for; accepting a token minted for another API lets one leaked token open every service.",
  },
  {
    text: "Access tokens expire after 15 minutes. What does a client use to get a new one without sending the user back through login?",
    options: [
      "The ID token",
      "The client secret on its own",
      "The original authorization code, sent again",
      "The refresh token, exchanged at the token endpoint",
    ],
    answer: 3,
    complexity: "easy",
    explanation: "Short-lived access tokens limit the damage of a leak. The refresh token is the longer-lived credential that quietly obtains the next access token.",
  },
];
