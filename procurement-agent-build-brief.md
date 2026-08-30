# Generic Procurement Agent — Build Brief

## 1. Product Summary

Build a generic AI-powered procurement coordinator that helps a user get real-world options for almost any service or purchase without relying on a closed marketplace.

The user describes an outcome in natural language, for example:

- "Find someone to replace my backyard fence before October."
- "Get me a caterer for 60 people under $4,000."
- "Find a printer that can make 500 brochures by Friday."
- "Find a dog sitter for next weekend."
- "Get quotes to move a piano across town."

The system then:

1. Understands the user's requirements and constraints.
2. Searches the open web for relevant providers.
3. Crawls provider websites and extracts useful information.
4. Identifies missing information that matters to the user's decision.
5. Contacts providers through email or website forms.
6. Continues follow-up conversations as needed.
7. Extracts facts, offers, pricing, availability, exclusions, and conditions from responses.
8. Presents the results through a dynamic interface tailored to that specific procurement task.
9. Recommends options while preserving source evidence so the user can understand why.

The product should not be modeled as a contractor marketplace or quote-comparison website. It is a general-purpose buyer-side agent that can procure across arbitrary categories.

---

## 2. Core Product Principle

The core workflow is:

```text
Discover → Research → Resolve Missing Information → Contact → Converse → Normalize → Decide
```

Each technology has a distinct role:

```text
Firecrawl  = web discovery + website research + web-form interaction
OpenAI     = reasoning + extraction + planning + dynamic UI configuration
AgentMail  = email identity + outbound outreach + inbound replies + follow-up conversations
Convex     = realtime state + workflow orchestration + persistence + subscriptions
```

The important product insight is that the system should not require suppliers to register before they can participate.

The open web is the initial supply side.

---

## 3. Hackathon Technology Requirements

### Convex

Convex is the application's backend and realtime state layer.

Use it for:

- authentication
- users
- procurement requests
- candidate providers
- requirements
- facts and evidence
- provider outreach state
- conversations and messages
- normalized proposals/offers
- AI-generated evaluations
- workflow/status transitions
- realtime UI updates

The frontend should subscribe directly to Convex data so provider discovery, outreach, replies, and extracted offers appear live.

### Firecrawl

Firecrawl should be a core execution tool, not just a search API.

Use it for:

- searching for providers
- crawling provider websites
- extracting services, locations, pricing, policies, and other relevant information
- identifying contact pages and quote forms
- locating public email addresses
- interacting with web forms where email is not available
- optionally maintaining browser sessions for multi-step quote/contact flows

If a provider has no public email address but exposes a contact or quote form, Firecrawl should fill the form using a trusted AgentMail address as the reply email.

Example:

```text
Provider has email
    → AgentMail sends outreach

Provider only has quote/contact form
    → Firecrawl fills form
    → form uses user's AgentMail identity
    → provider reply arrives through AgentMail
```

### AgentMail

AgentMail is the communication layer between the buyer-side agent and providers.

Use it for:

- creating a stable, human-readable email identity for the user/agent
- sending initial outreach when provider email is available
- receiving replies from provider website forms
- managing threaded conversations
- asking follow-up questions
- receiving quotes, attachments, and additional details

Avoid exposing random-looking hashes in email addresses.

Prefer a stable identity such as:

```text
alex@<product-domain>
```

or another readable, trustworthy format.

One user should generally have one stable agent email identity. Conversation routing should happen internally using sender, thread IDs, metadata, and Convex state rather than putting routing IDs into the visible email address.

The agent should clearly disclose that it is coordinating the request on behalf of the user rather than pretending to be the user.

### OpenAI

OpenAI powers the reasoning layer.

Use it for:

- converting the user's natural-language goal into requirements
- distinguishing hard constraints from preferences
- determining what provider information matters for this request
- ranking/filtering candidate providers
- identifying missing information
- generating outreach messages
- answering provider follow-up questions when the answer is already known
- deciding when user input is required
- extracting facts from websites and email replies
- normalizing arbitrary provider responses into comparable offers
- generating request-specific evaluation criteria
- generating dynamic UI "lenses"
- explaining recommendations

---

## 4. UX Philosophy

Do not design the application as a traditional dashboard where the user must understand internal entities like providers, messages, documents, and quotes.

The core user question is:

> "Help me make this decision."

The product should present the procurement request as the primary object.

Example:

```text
Replace backyard fence

~180 ft cedar privacy fence
Preferred before Oct 1
Target budget around $15,000

4 viable options
2 providers still responding
```

The interface should evolve as the procurement process progresses.

---

## 5. Core User Flow

### Step 1 — User creates a request

Input can initially be a simple chat-style composer.

Example:

```text
I need someone to replace about 180 feet of my backyard fence.
I'd prefer cedar, want it done before October, and would like to stay under $15k.
```

OpenAI extracts initial requirements.

The UI shows the interpreted request and allows the user to correct it.

### Step 2 — Provider discovery

Firecrawl searches for relevant providers.

Convex receives candidates as they are discovered.

The UI updates live:

```text
Finding providers...
12 discovered
8 appear relevant
5 being researched
```

### Step 3 — Research

Firecrawl crawls candidate websites.

OpenAI extracts request-relevant facts, such as:

- services offered
- service area
- available contact method
- published pricing
- minimum job size
- warranty
- turnaround/availability language
- exclusions
- credentials

The exact fields are dynamic and depend on the request.

### Step 4 — User approves outreach

Do not immediately contact businesses without user authorization.

Show a shortlist and an action such as:

```text
Request responses from these 5 providers
```

Once approved, the system can contact providers autonomously within the scope of the request.

### Step 5 — Outreach

For each provider:

```text
Email available
    → AgentMail sends initial request

Quote/contact form available
    → Firecrawl submits the form
    → AgentMail identity used as reply email

Unsupported contact path
    → mark as manual / skipped
```

The user sees realtime state:

```text
ABC Fencing
✓ Website researched
✓ Service area confirmed
✓ Request sent
○ Waiting for response

FenceCo
✓ Website researched
● Submitting quote form...
```

### Step 6 — Provider conversations

When AgentMail receives a reply:

1. store the raw message
2. map it to the appropriate conversation
3. run extraction/reasoning
4. update facts
5. determine whether required information is still missing
6. reply automatically if the necessary answer is already known
7. ask the user if new personal/project information is needed

Example:

```text
Provider:
"Do you want the existing fence hauled away?"

Known requirement:
removalRequired = true

Agent:
"Yes, please include removal and disposal of the existing fence."
```

### Step 7 — Offer normalization

Provider replies are arbitrary and should not be forced into a universal quote schema.

OpenAI should turn each provider's offer into a normalized, request-specific representation.

Example:

```json
{
  "price": {
    "amount": 12800,
    "currency": "CAD",
    "taxIncluded": false
  },
  "availability": {
    "start": "2026-09-08"
  },
  "scope": [
    "demolition",
    "disposal",
    "cedar boards",
    "installation",
    "one gate"
  ],
  "warranty": "5 years"
}
```

Another procurement category can produce a completely different shape.

### Step 8 — Dynamic decision UI

OpenAI generates a set of useful views/lenses for the specific request.

Do not generate arbitrary HTML from the model.

Instead, define a small library of trusted UI primitives and let the model return structured configuration.

Possible primitives:

- recommendation card
- provider cards
- comparison matrix
- sorted ranking
- bar chart
- scatter plot
- timeline
- difference-only view
- missing-information view

Example AI output:

```json
{
  "views": [
    {
      "type": "recommendation",
      "label": "Best fit"
    },
    {
      "type": "bar",
      "label": "Price",
      "metric": "totalPrice",
      "sort": "ascending"
    },
    {
      "type": "timeline",
      "label": "Availability",
      "metric": "availability"
    },
    {
      "type": "matrix",
      "label": "What's included",
      "fields": ["demolition", "disposal", "gate", "warranty"]
    }
  ]
}
```

The frontend renders those configurations with trusted components.

### Step 9 — Conversational UI manipulation

The user should be able to ask questions that reconfigure the decision interface.

Examples:

```text
Ignore price and show me who has the best warranty.
```

```text
Show only the differences between the top three.
```

```text
Assume getting this completed before September 15 matters most.
```

```text
Which options still have unanswered questions?
```

The AI should update the relevant lens/configuration rather than merely returning a chat paragraph.

---

## 6. Data Model

Keep workflow entities strongly typed while allowing the facts/content inside them to remain flexible.

Do not use one generic `entities` table for everything.

### `users`

Basic authenticated user data.

Recommended additional field:

```ts
agentMailInboxId?: string
agentEmailAddress?: string
```

### `procurementRequests`

Root object for a user's desired outcome.

```ts
{
  userId,
  title,
  prompt,
  status,
  location?,
  createdAt,
  updatedAt
}
```

Suggested statuses:

```text
draft
researching
awaiting_approval
contacting
collecting_responses
evaluating
completed
cancelled
```

Preserve the original user prompt as the ultimate source of intent.

### `requirements`

Dynamic facts/constraints describing what the user wants.

```ts
{
  requestId,
  key,
  label,
  value,
  kind: "hard_constraint" | "preference" | "information",
  source: "user" | "inferred" | "conversation",
  importance?,
  confidence?
}
```

Store requirements individually rather than as one opaque JSON object so they can change independently.

### `businesses`

Canonical provider identity that can be reused across requests.

```ts
{
  name,
  website?,
  domain?,
  location?,
  createdAt
}
```

### `requestCandidates`

A provider's participation in a particular procurement request.

```ts
{
  requestId,
  businessId,
  status,
  qualificationSummary?,
  rejectionReason?,
  createdAt
}
```

Suggested statuses:

```text
discovered
researching
qualified
rejected
approved_for_contact
contacted
responded
declined
proposal_received
```

Avoid permanent universal provider scores. A provider can be a strong fit for one request and a poor fit for another.

### `contactEndpoints`

Ways a provider can be contacted.

```ts
{
  businessId,
  type: "email" | "contact_form" | "quote_form" | "booking_page" | "phone" | "other",
  value,
  verified?,
  metadata?,
  discoveredAt
}
```

Form metadata can include requirements such as:

```json
{
  "requiresPhone": true,
  "requiresAddress": true,
  "hasCaptcha": false
}
```

### `facts`

Evidence-backed information learned about providers and offers.

```ts
{
  requestId,
  candidateId?,
  businessId?,
  key,
  label,
  value,
  sourceType: "website" | "email" | "user" | "ai_inference",
  sourceUrl?,
  messageId?,
  confidence,
  observedAt
}
```

Facts must preserve provenance.

Example:

```text
warranty = "5 years"
source = provider email received Aug 29
```

The user should be able to inspect the evidence supporting important claims.

### `questions`

Explicitly model unresolved information.

```ts
{
  requestId,
  candidateId?,
  question,
  importance: "required" | "useful" | "optional",
  status: "unanswered" | "asked" | "answered" | "not_applicable",
  answer?,
  sourceFactIds?
}
```

This enables the core autonomous loop:

```text
Missing information
    ↓
Can website research answer it?
    ↓ no
Ask provider
    ↓
Receive reply
    ↓
Extract fact
    ↓
Resolve question
```

### `outreachAttempts`

Track the act of contacting a provider separately from the conversation itself.

```ts
{
  requestId,
  candidateId,
  endpointId,
  method: "agentmail" | "firecrawl_form",
  status: "queued" | "attempting" | "sent" | "submitted" | "failed",
  externalMessageId?,
  submittedAt?,
  error?
}
```

This lets the system fall back cleanly if one contact path fails.

### `conversations`

```ts
{
  requestId,
  candidateId,
  status: "active" | "waiting_on_provider" | "waiting_on_user" | "completed",
  agentMailThreadId?,
  lastMessageAt?
}
```

### `messages`

Persist all communication in normalized form.

```ts
{
  conversationId,
  direction: "inbound" | "outbound",
  sender,
  recipient,
  subject?,
  body,
  source: "agentmail" | "system" | "user",
  externalMessageId?,
  createdAt
}
```

### `proposals`

A normalized interpretation of what a provider is offering.

```ts
{
  requestId,
  candidateId,
  status: "partial" | "complete" | "withdrawn",
  summary,
  attributes,
  confidence,
  createdAt,
  updatedAt
}
```

`attributes` is intentionally flexible because the product is generic.

### `evaluations`

Contextual interpretation of the available options.

```ts
{
  requestId,
  generatedAt,
  criteria,
  results,
  recommendation?
}
```

Keep facts and evaluations separate.

Example:

```text
Fact:
ABC quoted $4,600.

Evaluation:
ABC is the cheapest complete option that meets the user's timeline.
```

### `uiViews`

Optional persisted AI-generated lens configuration.

```ts
{
  ;(requestId, label, type, config, generatedAt, generatedFromVersion)
}
```

Do not necessarily persist every transient view. Persist only if useful for stable request state or caching.

---

## 7. Suggested Relationship Model

```text
users
  │
  └── procurementRequests
        │
        ├── requirements
        ├── questions
        ├── uiViews
        │
        ├── requestCandidates
        │      │
        │      ├── business
        │      │      └── contactEndpoints
        │      │
        │      ├── facts
        │      ├── outreachAttempts
        │      ├── conversations
        │      │      └── messages
        │      └── proposals
        │
        └── evaluations
```

---

## 8. Dynamic UI Design

The AI should not own the rendering layer.

Create a trusted component library and let the AI choose/configure components.

Recommended initial primitives:

### `RecommendationView`

Shows the current recommendation, supporting reasons, and caveats.

### `ProviderCardView`

Good for narrative summaries of several candidates.

### `ComparisonMatrixView`

AI selects which request-specific fields deserve rows.

### `RankingView`

Shows ordinal ordering when a ranking is meaningful.

Avoid meaningless universal scores unless clearly justified.

### `BarComparisonView`

Useful for numeric dimensions such as price, distance, duration, or quantity.

### `TimelineView`

Useful for availability, lead time, completion windows, delivery dates, etc.

### `ScatterView`

Useful when two competing dimensions explain the decision.

Example:

```text
X = total price
Y = earliest availability
```

### `DifferenceView`

Summarizes only meaningful differences.

Example:

```text
All three include removal, disposal, and installation.

Meaningful differences:
ABC       cheapest
FenceCo   earliest availability
Evergreen longest warranty
```

### `MissingInformationView`

Shows unresolved questions by provider.

This reinforces that the system is actively gathering information rather than merely displaying static search results.

---

## 9. Evidence and Trust

Important claims should be inspectable.

Example:

```text
5-year warranty
```

Clicking/tapping it should show:

```text
Evidence

"Our workmanship warranty covers installation for five years..."

Source: email from ABC Fencing
Received Aug 29, 2:14 PM
```

Website-derived facts should similarly link back to their source URLs/snapshots where possible.

The product should distinguish:

- observed fact
- provider claim
- AI inference
- recommendation/evaluation

---

## 10. Agent Behavior Rules

### User authorization

Do not contact providers until the user has explicitly approved outreach for the current request.

### Transparency

The agent should say it is helping the user collect information/options rather than pretending to be the user.

### Automatic replies

The agent can automatically reply when the provider asks for information already captured in the request.

Example:

```text
Provider: "What postal code is the job in?"

Known requirement: T6X 1A2

→ agent may reply automatically
```

### Escalation

Ask the user when:

- provider requests information not already known
- provider asks for a decision or commitment
- scope changes materially
- payment, legal acceptance, booking, or signature is required
- the system has low confidence in the answer

### No fabricated information

Never invent a user fact merely to keep a conversation moving.

### Contact limits

Use a conservative default number of contacted providers for MVP, such as 3–5 per request, to avoid spam behavior.

---

## 11. Realtime Workflow

Convex should make the process feel alive.

Example UI state:

```text
Finding providers                  ✓
12 candidates discovered           ✓
Researching candidates             ✓

ABC Fencing
  ✓ Service fit confirmed
  ✓ Contact method found
  ✓ Email sent
  ○ Waiting for response

FenceCo
  ✓ Service fit confirmed
  ✓ Quote form found
  ● Submitting form

Evergreen
  ✓ Response received
  ● Extracting offer
```

When an AgentMail webhook arrives:

```text
AgentMail inbound message
    ↓
Convex action/webhook handler
    ↓
store raw message
    ↓
OpenAI extraction/reasoning
    ↓
write/update facts
    ↓
resolve questions
    ↓
update proposal
    ↓
regenerate evaluation if needed
    ↓
Convex subscriptions update UI
```

---

## 12. MVP Scope

Keep the hackathon MVP narrow enough to complete but architect it generically.

### MVP must support

1. User authentication.
2. Create a procurement request from natural language.
3. Extract editable requirements.
4. Search the web for providers using Firecrawl.
5. Crawl provider websites.
6. Extract provider facts and contact endpoints.
7. Show a shortlist and require outreach approval.
8. Contact providers through:
   - AgentMail email
   - Firecrawl contact/quote forms
9. Receive email replies through AgentMail.
10. Store conversations in Convex.
11. Extract facts and partial/complete proposals from replies.
12. Show realtime workflow state.
13. Generate at least 2–4 dynamic comparison lenses based on the collected data.
14. Allow user prompts to reconfigure the comparison view.
15. Show source/evidence for important facts.

### Do not prioritize for MVP

- payment processing
- provider accounts
- supplier SaaS dashboard
- phone calling
- SMS
- booking/payment commitments
- contract signing
- sophisticated CRM integration
- universal provider reputation scoring
- complex marketplace features

---

## 13. Recommended Initial Demo Category

The architecture must remain generic, but the demo should use a category that is easy for the agent to handle end-to-end.

Good candidates:

- event catering
- printing
- movers
- photographers
- landscaping
- fencing
- cleaning services

Avoid demo categories that require extensive regulated information, complicated onsite inspection, or immediate payments.

The product should not hardcode category-specific fields even if one category is used for the demo.

---

## 14. Suggested Demo Flow

A strong 3-minute demo could be:

### 0:00 — Create request

```text
I need 500 full-color brochures printed by next Friday.
I'd prefer matte paper and want to stay under $700.
```

### 0:20 — AI interprets request

Show extracted requirements.

### 0:35 — Firecrawl discovery

Providers appear in realtime.

### 0:55 — Research completes

Show extracted provider information and contact methods.

### 1:10 — Approve outreach

User clicks:

```text
Request options from 4 providers
```

### 1:20 — Mixed contact channels

Show:

```text
Provider A → AgentMail email sent
Provider B → Firecrawl form submitted
Provider C → AgentMail email sent
Provider D → Firecrawl form submitted
```

### 1:45 — Simulated/real reply arrives

AgentMail receives a provider reply.

Convex UI updates automatically.

### 2:00 — Offer extracted

Example:

```text
$612
ready Thursday
matte 100lb stock
pickup included
```

### 2:15 — Dynamic comparison

Show AI-generated lenses such as:

```text
Best fit | Price | Ready date | What's included
```

### 2:35 — Natural-language UI change

User asks:

```text
Ignore price and show me who can deliver soonest.
```

The frontend changes lens/order rather than just printing a chat answer.

### 2:50 — Recommendation + evidence

Show the recommended provider and allow the user to open the evidence backing its price and delivery date.

---

## 15. Technical Architecture

Suggested high-level architecture:

```text
Frontend
  │
  │ Convex queries/mutations/subscriptions
  ▼
Convex
  │
  ├── request state
  ├── provider state
  ├── facts/evidence
  ├── conversations
  ├── proposals
  └── UI configurations
  │
  ├───────────────┐
  │               │
  ▼               ▼
OpenAI          Firecrawl
reasoning       search/crawl/interact
  │               │
  │               └── provider websites/forms
  │
  ▼
AgentMail
send/receive email
  │
  ▼
Provider
```

Prefer background Convex actions/workflows for long-running Firecrawl/OpenAI/AgentMail operations, with state transitions persisted so the frontend always reflects current progress.

---

## 16. Important Product Decisions

### Do not build a marketplace first

Providers should not need an account.

### Do not hardcode quote schemas

The model should infer what is relevant to each procurement task.

### Do not let the model generate arbitrary frontend code

Use structured UI configuration and trusted components.

### Keep facts separate from evaluation

A provider's price or warranty is evidence-backed information.

Whether it is a good choice is request-specific reasoning.

### Preserve provenance

Every important extracted fact should be traceable to:

- a crawled website
- an email message
- the user
- an explicit AI inference

### Use stable agent email identities

Avoid random/hash-heavy public email addresses that look disposable or spammy.

### Require approval before initial outreach

After approval, follow-up can be autonomous within the request's known scope.

---

## 17. Future Monetization Direction

Do not build monetization into the hackathon MVP, but preserve room for it.

Potential progression:

### Stage 1 — Buyer-paid

- per procurement request
- consumer subscription
- business procurement subscription

### Stage 2 — Supplier SaaS

Providers can optionally claim their profile and pay for:

- preferred structured response mechanisms
- CRM/calendar integrations
- automated quote handling
- analytics
- availability syncing

Payment should not influence recommendation ranking.

### Stage 3 — Transaction layer

Later the platform could handle:

- booking
- deposits
- payments
- agreements

and charge a transaction fee.

The important strategic advantage is that the marketplace does not need supplier adoption before it becomes useful because Firecrawl + AgentMail bootstrap supplier participation from the existing web.

---

## 18. Success Criteria for Initial Build

The MVP is successful when a new user can:

1. Describe a real-world procurement need in plain language.
2. Watch suitable providers appear from the open web.
3. Approve a shortlist for contact.
4. Watch the system contact providers through both email and website forms.
5. Receive at least one provider response into the application.
6. See the response converted into structured, evidence-backed information.
7. View the available options through multiple dynamically generated UI lenses.
8. Ask the AI to change how those options are presented.
9. Understand why the system recommends one option over another.

The central experience should feel like:

> **Tell the agent what outcome you want. It goes out into the real world, gets the information, and builds the interface you need to make the decision.**
