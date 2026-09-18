# Hackathon log

- **Project:** Compari
- **Event:** Convex All Gas Hackathon
- **What it does:** A buyer-side procurement workflow in development that turns requests and approximate buyer location into relevant, evidence-backed provider comparisons, with bounded automated research/outreach and an explicit final-choice gate.
- **Live app:** https://enduring-husky-65.convex.site/
- **Repo:** https://github.com/kotarCreative/compari
- **Frontend:** Convex static hosting (TanStack Start)
- **Convex deployment:** not deployed
- **Components:** @convex-dev/static-hosting
- **Convex features:** schema, tables, indexes, queries, mutations, actions, HTTP actions, scheduled functions, realtime queries
- **Auth:** Convex Auth
- **AI models:** gpt-4.1-mini, gpt-5.6-luna
- **Started:** 2026-08-29T03:16:06Z
- **Last updated:** 2026-09-16T03:17:13Z

## Log

### 2026-08-28 - working tree

Initialized the hackathon build log. No existing Git history or application source was available to backfill.

### 2026-08-28 - working tree

Selected Convex static hosting for the frontend. The hosting component is deferred until a Convex application exists.

### 2026-08-28 - working tree

Scaffolded a Convex + TanStack Start app that reads the `numbers` table, adds random numbers through a mutation, and demonstrates an action from a second route. Added the schema, table, and public functions (`convex/schema.ts`, `convex/myFunctions.ts`, `src/routes/index.tsx`, `src/routes/anotherPage.tsx`). No deployment, registered components, or auth configuration is present yet.

### 2026-08-28 - 6b9277c

Committed the initial Convex + TanStack Start scaffold: persisted numbers can be read and added from the home page, with a second route that invokes a Convex action. Convex features: schema, table, query, mutation, action, and realtime client queries (`convex/schema.ts`, `convex/myFunctions.ts`, `src/router.tsx`, `src/routes/index.tsx`, `src/routes/anotherPage.tsx`).

### 2026-08-28 - 0b498ad

Added a server-side Firecrawl page-scraping action and a home-page URL form that displays returned markdown. The integration validates web URLs, reads its API credential only from the Convex environment, and keeps the secret out of the browser (`convex/myFunctions.ts`, `src/routes/index.tsx`).

### 2026-08-28 - 77c5aa8

Defined an executable MVP roadmap covering passkey authentication, automatic per-user AgentMail inboxes, the procurement data model, Firecrawl research, provider conversations, evidence-backed proposals, and trusted comparison views. Added shared build standards for ports and adapters, stateless SDK singletons, explicit state machines, idempotent side-effect jobs, and deterministic test fakes (`.specs/`). These capabilities are specified but not yet implemented.

### 2026-08-28 - 344d172

Refined the planned agent workflow so creating a request authorizes bounded autonomous provider research, outreach, and factual follow-ups. The only mandatory confirmation gate is the user's final provider choice; automated booking, payment, signing, acceptance, and scope expansion remain prohibited (`.specs/Roadmap.md`, `.specs/06-autonomous-outreach-and-contact.md`, `.specs/09-evaluation-and-dynamic-ui.md`).

### 2026-08-30 - 1230c93

Replaced the starter demo with an authenticated procurement workspace: user bootstrap and inbox jobs, owned requests and requirements, candidate research/outreach, conversations, evidence-backed proposals, trusted comparison views, diagnostics, and an explicit final-choice mutation (`convex/`, `src/features/`). Added leased side-effect jobs, bounded indexed reads, state policies, and server-gated deterministic demo adapters; local typecheck, lint, build, and 14 deterministic tests pass.

### 2026-08-31 - 47d186c

Completed production-shaped provider boundaries for AgentMail, Firecrawl, and OpenAI reasoning/ranking, including pod-scoped inbox provisioning, verified inbound webhook routing, durable extraction/ranking/outreach jobs, and evidence-backed proposal updates (`convex/adapters/`, `convex/webhookProcessor.ts`, `convex/reasoningWorkflow.ts`, `convex/rankingState.ts`). Refactored the frontend into feature contracts and centralized shadcn-style UI primitives; the route now focuses on authentication/bootstrap while workspace and request behavior live in deep feature modules (`src/components/`, `src/features/`, `src/routes/index.tsx`). Local tests, typecheck, lint, and production build pass; live-provider and deployment-backed verification remain pending.

### 2026-09-02 - 969cabb

Made MVP runs repeatable with resettable demo jobs and stable synthetic message
IDs (`convex/demoJobs.ts`, `convex/domain/demo.ts`). Moved OpenAI reasoning and
ranking to the AI SDK with strict output and explicit failure mapping
(`convex/adapters/openai.ts`). Added collision-safe numbered AgentMail inboxes
and name-first onboarding with signed outreach and a five-second progress flow
(`convex/users.ts`, `src/features/workspace/`). All 43 tests and checks pass.

The app is not publicly deployed. Deployment-backed verification of AgentMail,
Firecrawl, inbound webhooks, and OpenAI remains pending.

### 2026-09-04 - 006ad4e

Turned first-run request intake into a conversation that records buyer answers,
reinterprets requirements, and avoids repeating resolved questions
(`src/features/workspace/`, `convex/questions.ts`, `convex/workflowState.ts`).
Added intent-aware provider research: an OpenAI planning step creates multiple
bounded vendor queries from the original prompt, location, requirements, and
answered questions; Firecrawl deduplicates the results, finds relevant pages on
each vendor site, and scrapes up to five pages (`convex/adapters/reasoning.ts`,
`convex/adapters/firecrawl.ts`, `convex/workflows.ts`). Local tests, typecheck,
lint, and the production build pass.

### 2026-09-05 - 6f6a849

Improved provider discovery reliability by supporting Firecrawl's current v2
result envelope and excluding source repositories, package registries,
developer documentation, and configuration files from vendor candidates
(`convex/adapters/firecrawl.ts`, `convex/adapters/reasoning.ts`). Requests now
use rounded browser coordinates when permitted; otherwise intake asks where to
search and waits for the answer before discovery (`src/features/workspace/`,
`convex/requests.ts`, `convex/workflowState.ts`). Also streamlined the request
and decision views and added a deployment-guarded development reset helper.
The test suite, typecheck, lint, production build, and Convex development
validation pass.

### 2026-09-06 - 5a78384

Made first-request onboarding recover from deleted or stale session request IDs,
restored users after development data resets, and added clearer onboarding and
research progress states (`convex/users.ts`, `convex/requests.ts`,
`src/features/workspace/`). Provider discovery now waits until buyer questions
are answered, ignores stale request versions, searches sequentially, staggers
candidate research, honors Firecrawl retry timing, settles terminal failures,
and offers a manual research retry (`convex/workflowState.ts`,
`convex/workflows.ts`, `convex/adapters/firecrawl.ts`). A live development run
answered all three intake questions, completed discovery and ranking, and
qualified 7 of 10 candidates without Firecrawl rate-limit failures. All 56
tests, typecheck, lint, production build, and Convex development validation
pass.

### 2026-09-06 - 166df20

Improved provider discovery with requirement-aware commercial searches, relevance
ranking, directory/listicle filtering, and bounded same-site service and contact
research. Outreach now generates provider-specific, human-readable emails from
structured requirements, persists drafts for idempotent retries, normalizes
AgentMail send keys, and exposes retry status in the request view
(`convex/adapters/firecrawl.ts`, `convex/adapters/reasoning.ts`,
`convex/outreachWorkflow.ts`, `src/features/request/RequestDetail.tsx`).
Tests, typecheck, lint, and Convex development validation pass.

### 2026-09-07 - b0896a9

Added saved, editable buyer locations and gave the workspace a notebook-style
interface with a dedicated new-request route, clearer comparison progress, and
readable outreach status (`convex/users.ts`, `src/features/workspace/`,
`src/features/request/`). Vendor email extraction now uses GPT-5.6 Luna with
strict structured output for canonical price and availability fields, including
compatibility for existing responses (`convex/adapters/`, `convex/proposals.ts`).
Tests, typecheck, lint, production build, and Convex development validation pass.

### 2026-09-10 - 57dd100

Registered Convex static hosting and added a Compari logo, matching favicons,
social preview, canonical metadata, structured data, and a public-page sitemap
(`87e4666`, `61e86f9`; `convex/convex.config.ts`, `vite.config.ts`, `public/`,
`src/routes/`). Prerendered homepage HTML now includes the introduction; the
new-request page is marked noindex. Added a responsive animated raccoon mascot
with a reduced-motion still, keyboard-accessible request cards, and validated
links to original vendor websites (`src/components/common/ChairMascot.tsx`,
`src/features/`, `src/styles/app.css`, `docs/mascot-artwork.md`). Typecheck, lint,
the evidence-link test, and the production build pass; generated SEO output was
checked and the local dev server returned HTTP 200. The public app address was
supplied by the builder; these latest changes have not been deployed.

### 2026-09-10 - ffa3cde

Made comparison results more evidence-backed: research now extracts relevant
prices from cited provider pages, rejects unsupported amounts, accepts equivalent
price formatting, and ranks proposals with flexible attributes (`convex/adapters/`,
`convex/domain/websitePricing.ts`, `convex/evaluations.ts`, `convex/rankingState.ts`).
Selection errors now preserve useful server messages (`src/features/decision/`).

### 2026-09-11 - 3c4b2ff

Unified live quotes with individual vendor contact in the request and comparison
views, while keeping the buyer's intake in one continuous conversation. Added a
focused comparison flow with collapsible supporting details and clearer loading,
outreach, and onboarding states (`src/features/decision/`, `src/features/request/`,
`src/features/workspace/`, `src/components/common/ResearchLoader.tsx`).

### 2026-09-15 - 7e2eacb

Added an animated typing companion to the provider-finding state and moved all
workspace session persistence behind SSR-safe storage helpers (`src/components/common/TypingBuddy.tsx`,
`src/features/request/components/AgentProgress.tsx`, `src/lib/storage.ts`). Also
continued the Convex cleanup by calling generated internal functions directly.
