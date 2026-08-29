# Hackathon log

- **Project:** compari
- **Event:** Convex All Gas Hackathon
- **What it does:** A buyer-side procurement agent in development; the current Convex + TanStack Start prototype persists demo data and uses a server-side Firecrawl action to extract public web pages.
- **Live app:** not deployed
- **Repo:** none
- **Frontend:** not deployed
- **Convex deployment:** not deployed
- **Components:** none
- **Convex features:** schema, tables, queries, mutations, actions
- **Auth:** none
- **AI models:** none
- **Started:** 2026-08-29T03:16:06Z
- **Last updated:** 2026-08-29T03:47:44Z

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
