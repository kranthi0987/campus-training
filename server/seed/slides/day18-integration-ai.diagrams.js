// Animated diagrams attached to slides of the day18-integration-ai deck, keyed
// "<section id>/<slide index>". Types are drawn by public/diagrams.js:
//   sequence  nodes are lifelines left to right; steps play in order (from === to is a note)
//   flow      nodes are boxes; edges (default: consecutive) carry a travelling packet
//   log       partitions of records, then a consumer bookmark moving along one of them
//   token     a JWT decoded part by part
//   timeline  milestones reached one by one
// Colours by `kind`: request (blue, default), response (green), event (amber), error (red).
import { TRAINER } from './day18-integration-ai.js';

// The order's journey across every topic of the session; shown at the start and at the end.
const orderJourney = {
  type: 'flow',
  caption: 'One order, five topics: the token proves who is calling, the gateway checks it, the API does the work, the event tells everyone else.',
  nodes: [
    { label: 'Branch app', sub: 'OAuth token in hand' },
    { label: 'Apigee gateway', sub: 'checks, counts, forwards' },
    { label: 'Orders API', sub: 'REST · POST /orders' },
    { label: 'Kafka', sub: 'topic orders.created' },
    { label: 'Inventory service', sub: 'consumer group' },
  ],
  edges: [
    { from: 0, to: 1, label: 'HTTPS + Bearer JWT' },
    { from: 1, to: 2, label: 'key, quota and token verified' },
    { from: 2, to: 3, label: 'publishes orders.created', kind: 'event' },
    { from: 3, to: 4, label: 'reserves stock', kind: 'event' },
    { from: 2, to: 0, label: '201 Created · Location: /orders/1042', kind: 'response' },
  ],
};

export default {
  'about/0': {
    type: 'timeline',
    caption: `${TRAINER.name}'s journey so far.`,
    items: TRAINER.journey,
  },
  'big-picture/0': {
    type: 'sequence',
    caption: 'Ask and wait: the app needs the answer now. Announce and move on: whoever cares reads it later.',
    nodes: [{ label: 'Branch app' }, { label: 'Orders API' }, { label: 'Kafka topic' }, { label: 'Inventory' }, { label: 'Email' }],
    steps: [
      { from: 0, to: 1, label: 'POST /orders (ask and wait)' },
      { from: 1, to: 0, label: '201 Created · order 1042', kind: 'response' },
      { from: 1, to: 2, label: 'orders.created (announce and move on)', kind: 'event' },
      { from: 2, to: 3, label: 'reads it when ready', kind: 'event' },
      { from: 2, to: 4, label: 'reads it too', kind: 'event' },
      { from: 3, to: 3, label: 'stock reserved · nobody waited for this' },
    ],
  },
  'big-picture/1': orderJourney,
  'rest/0': {
    type: 'sequence',
    caption: 'One order, fetched then updated. The same PUT twice gives the same result.',
    nodes: [{ label: 'Branch app' }, { label: 'Orders API' }, { label: 'Database' }],
    steps: [
      { from: 0, to: 1, label: 'GET /orders/42 · Accept: application/json' },
      { from: 1, to: 2, label: 'SELECT … WHERE id = 42' },
      { from: 2, to: 1, label: 'one row', kind: 'response' },
      { from: 1, to: 0, label: '200 OK · { "id": 42, "status": "shipped" }', kind: 'response' },
      { from: 0, to: 1, label: 'PUT /orders/42 · full body' },
      { from: 1, to: 0, label: '200 OK · repeat the PUT, nothing changes (idempotent)', kind: 'response' },
    ],
  },
  'rest/2': {
    type: 'sequence',
    caption: 'The reply is lost, the user presses submit again. The key turns a duplicate into a repeat of the first answer.',
    nodes: [{ label: 'Branch app' }, { label: 'Orders API' }, { label: 'Database' }],
    steps: [
      { from: 0, to: 1, label: 'POST /orders · Idempotency-Key: br17-9931' },
      { from: 1, to: 2, label: 'INSERT order 1042 · remember key br17-9931' },
      { from: 1, to: 0, label: '201 Created … lost in the network', kind: 'error' },
      { from: 0, to: 0, label: 'timeout · user clicks submit again' },
      { from: 0, to: 1, label: 'same POST · same Idempotency-Key' },
      { from: 1, to: 1, label: 'key seen before → reuse the saved reply' },
      { from: 1, to: 0, label: '201 Created · /orders/1042 · no second order', kind: 'response' },
    ],
  },
  'soap/1': {
    type: 'sequence',
    caption: 'The adapter speaks SOAP to the old systems so the app never has to.',
    nodes: [{ label: 'Branch app' }, { label: 'SOAP adapter' }, { label: 'ERP' }, { label: 'Bank' }],
    steps: [
      { from: 0, to: 1, label: 'checkStock("CU-ELB-075")' },
      { from: 1, to: 2, label: '<soap:Envelope> built from the WSDL' },
      { from: 2, to: 1, label: '<Envelope> qtyOnHand = 120', kind: 'response' },
      { from: 1, to: 0, label: '{ "qty": 120 }', kind: 'response' },
      { from: 0, to: 1, label: 'creditCheck(customer 17)' },
      { from: 1, to: 3, label: 'signed envelope (WS-Security header)' },
      { from: 3, to: 1, label: 'approved', kind: 'response' },
    ],
  },
  'soap/2': {
    type: 'flow',
    caption: 'The facade pattern: a REST front door, the SOAP backend untouched behind it.',
    nodes: [
      { label: 'Branch app', sub: 'speaks JSON' },
      { label: 'REST facade', sub: 'on the gateway' },
      { label: 'SOAP adapter', sub: 'client generated from the WSDL' },
      { label: 'ERP web service', sub: 'agreed years ago' },
    ],
    edges: [
      { from: 0, to: 1, label: 'GET /stock/CU-ELB-075' },
      { from: 1, to: 2, label: 'checkStock(sku)' },
      { from: 2, to: 3, label: '<soap:Envelope>' },
      { from: 3, to: 0, label: '{ "qty": 120 } · the app never saw an envelope', kind: 'response' },
    ],
  },
  'apigee/0': {
    type: 'sequence',
    caption: 'The gateway checks, counts and forwards. The backend only sees trusted traffic.',
    nodes: [{ label: 'Partner app' }, { label: 'Apigee proxy' }, { label: 'Order service' }],
    steps: [
      { from: 0, to: 1, label: 'GET /v1/orders · x-api-key: …' },
      { from: 1, to: 1, label: 'verify key · spike arrest · quota 1000/day' },
      { from: 1, to: 2, label: 'forward + trusted headers' },
      { from: 2, to: 1, label: '200 · orders', kind: 'response' },
      { from: 1, to: 0, label: '200 · call recorded in analytics', kind: 'response' },
      { from: 0, to: 1, label: 'call number 1001 today' },
      { from: 1, to: 0, label: '429 Quota exceeded (backend never called)', kind: 'error' },
    ],
  },
  'apigee/1': {
    type: 'flow',
    caption: 'The four nouns nest: an app subscribes to a product, a product bundles proxies, policies run on each proxy.',
    nodes: [
      { label: 'Partner app', sub: 'key + secret' },
      { label: 'API product', sub: 'Partner tier · 1000/hour' },
      { label: 'API proxy', sub: '/v1/orders' },
      { label: 'Policies', sub: 'verify key · quota · spike arrest' },
      { label: 'Order service', sub: 'the target backend' },
    ],
    edges: [
      { from: 0, to: 1, label: 'registers, subscribes' },
      { from: 1, to: 2, label: 'unlocks these proxies' },
      { from: 2, to: 3, label: 'every request runs the rules' },
      { from: 3, to: 4, label: 'forwarded only if all pass' },
      { from: 3, to: 0, label: '429 · over quota, backend never called', kind: 'error' },
    ],
  },
  'kafka/0': {
    type: 'log',
    title: 'topic: orders.created · 3 partitions',
    caption: 'Records only ever append at the end. The consumer keeps a bookmark (its offset) and moves it as it reads.',
    partitions: [
      { label: 'partition 0', records: [{ key: 'o-42' }, { key: 'o-42' }, { key: 'o-17' }, { key: 'o-42' }, { key: 'o-17' }, { key: 'o-90' }] },
      { label: 'partition 1', records: [{ key: 'o-8' }, { key: 'o-8' }, { key: 'o-55' }, { key: 'o-8' }] },
      { label: 'partition 2', records: [{ key: 'o-31' }, { key: 'o-64' }, { key: 'o-31' }, { key: 'o-64' }, { key: 'o-31' }] },
    ],
    cursor: { partition: 0, label: 'group inventory-svc reads here', at: 4 },
  },
  'kafka/2': {
    type: 'sequence',
    caption: 'Same event, two consumer groups. A crash before commit means a redelivery, so consumers must be idempotent.',
    nodes: [{ label: 'Order service' }, { label: 'orders.created', sub: '3 partitions' }, { label: 'Inventory', sub: 'group: inventory' }, { label: 'Email', sub: 'group: notify' }],
    steps: [
      { from: 0, to: 1, label: 'key = order-42 → partition 2', kind: 'event' },
      { from: 1, to: 2, label: 'offset 41', kind: 'event' },
      { from: 1, to: 3, label: 'offset 41', kind: 'event' },
      { from: 2, to: 2, label: 'reserve stock · crash before committing offset 41', kind: 'error' },
      { from: 1, to: 2, label: 'offset 41 delivered again', kind: 'event' },
      { from: 2, to: 2, label: 'already reserved for order 42 → skip, commit' },
    ],
  },
  'oauth-jwt/0': {
    type: 'sequence',
    caption: 'Authorization code with PKCE for the app, then a bearer JWT on every API call.',
    nodes: [{ label: 'Mobile app' }, { label: 'Auth server' }, { label: 'Orders API' }],
    steps: [
      { from: 0, to: 1, label: '/authorize + code_challenge (PKCE)' },
      { from: 1, to: 0, label: 'authorization code', kind: 'response' },
      { from: 0, to: 1, label: '/token · code + code_verifier' },
      { from: 1, to: 0, label: 'access token (JWT) + refresh token', kind: 'response' },
      { from: 0, to: 2, label: 'GET /orders · Authorization: Bearer eyJ…' },
      { from: 2, to: 2, label: 'verify signature · exp · aud · scope orders.read' },
      { from: 2, to: 0, label: '200 · orders', kind: 'response' },
    ],
  },
  'oauth-jwt/1': {
    type: 'token',
    caption: 'header.payload.signature: two readable parts and one proof. Anyone can read the claims; only the issuer could have signed them.',
    parts: [
      { label: 'Header', kind: 'request', weight: 2.5, raw: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9', lines: ['"alg": "RS256"', '"typ": "JWT"', '"kid": "2026-09"'] },
      { label: 'Payload (claims)', kind: 'event', weight: 6, raw: 'eyJpc3MiOiJodHRwczovL2F1dGguZGlzdHJpYnV0b3IuZXhhbXBsZSIsInN1YiI6…', lines: ['"iss": "https://auth.distributor.example"', '"sub": "svc-supplier-feed"', '"aud": "orders-api"', '"scope": "orders.read inventory.write"', '"exp": 1789450000  (in 1 hour)'] },
      { label: 'Signature', kind: 'response', weight: 4, raw: 'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c', lines: ['RS256(header.payload,', '      issuer private key)', 'verified with public key'] },
    ],
    verdict: 'Signature checks out with the issuer\'s public key, exp is still in the future: the API can trust the claims.',
  },
  'oauth-jwt/2': {
    type: 'flow',
    caption: 'The checks the gateway runs on every call, in order. Fail any one and the request never reaches a backend.',
    nodes: [
      { label: 'Bearer token', sub: 'from the header' },
      { label: 'Signature', sub: 'JWKS public key' },
      { label: 'Issuer', sub: 'iss is ours' },
      { label: 'Audience', sub: 'aud = this API' },
      { label: 'Expiry', sub: 'exp still ahead' },
      { label: 'Scope', sub: 'orders.read' },
      { label: 'Allowed', sub: 'on to the backend' },
    ],
    edges: [
      { from: 0, to: 1, label: 'decode' },
      { from: 1, to: 2, label: 'valid' },
      { from: 2, to: 3, label: 'known' },
      { from: 3, to: 4, label: 'for us' },
      { from: 4, to: 5, label: 'not expired' },
      { from: 5, to: 6, label: 'permitted', kind: 'response' },
      { from: 4, to: 0, label: '401 · expired, ask for a new token', kind: 'error' },
    ],
  },
  'wrap/1': orderJourney,
  'github-copilot/1': {
    type: 'sequence',
    caption: 'Copilot drafts, you review, the tests decide.',
    nodes: [{ label: 'You' }, { label: 'Copilot' }, { label: 'Tests' }],
    steps: [
      { from: 0, to: 1, label: '// parse an ASN CSV into line items' },
      { from: 1, to: 0, label: 'suggested parseAsn() function', kind: 'response' },
      { from: 0, to: 0, label: 'read it: what about a blank quantity?' },
      { from: 0, to: 2, label: 'run unit tests' },
      { from: 2, to: 0, label: '1 failing: empty qty → NaN', kind: 'error' },
      { from: 0, to: 1, label: 'refine: treat blank qty as 0' },
      { from: 1, to: 0, label: 'updated code', kind: 'response' },
      { from: 0, to: 2, label: 'run again' },
      { from: 2, to: 0, label: 'all green', kind: 'response' },
    ],
  },
  'gemini/0': {
    type: 'sequence',
    caption: 'Text and an image in, structured JSON out, and the app still validates.',
    nodes: [{ label: 'Your app' }, { label: 'Gemini API' }, { label: 'Model' }],
    steps: [
      { from: 0, to: 1, label: 'generateContent · system instruction + question + photo of a fitting' },
      { from: 1, to: 2, label: 'multimodal prompt' },
      { from: 2, to: 1, label: '{ "sku": "CU-ELB-075", "confidence": 0.86 }', kind: 'response' },
      { from: 1, to: 0, label: 'response + token usage', kind: 'response' },
      { from: 0, to: 0, label: 'parse JSON · low confidence → ask a human' },
    ],
  },
  'prompt-engineering/1': {
    type: 'sequence',
    caption: 'Prompting is a loop: draft, check, tighten, repeat.',
    nodes: [{ label: 'Prompt' }, { label: 'Model' }, { label: 'Check' }],
    steps: [
      { from: 0, to: 1, label: 'role + task + 2 examples (few-shot)' },
      { from: 1, to: 2, label: 'draft answer' },
      { from: 2, to: 2, label: 'facts grounded? format right? anything invented?' },
      { from: 2, to: 0, label: 'add a constraint and a counter-example', kind: 'error' },
      { from: 0, to: 1, label: 'revised prompt' },
      { from: 1, to: 2, label: 'final answer', kind: 'response' },
    ],
  },
};
