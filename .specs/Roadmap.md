# Compari MVP roadmap

## Required endstate

Compari is a generic buyer-side procurement agent, not a marketplace. A new user can
sign in, receive a stable agent email identity, describe a real-world need, watch
providers appear from the open web, let the agent autonomously gather responses
through email/forms, compare evidence-backed offers through request-specific views,
and confirm the final choice.

The MVP is complete only when all of the following are true:

- Convex Auth protects every request and all child data.
- Each user has exactly one readable AgentMail inbox provisioned automatically.
- The original request intent and user corrections are preserved.
- Firecrawl is used for provider search, research, evidence, and form contact.
- Creating a request authorizes bounded research, provider contact, and factual
  follow-ups without per-company or per-message approval.
- AgentMail replies route into the right provider conversation exactly once.
- Provider facts, unresolved questions, and proposals update in realtime.
- Automatic replies are limited to known facts and never make commitments.
- At least 2–4 trusted, AI-configured comparison lenses render collected data.
- Recommendations explain their reasoning and link important claims to evidence.
- The user explicitly confirms the final provider choice; automation never selects,
  accepts, books, pays, signs, or commits on the user's behalf.
- The canonical printing demo runs end-to-end without hidden database edits.

## Build principles

### Authoritative autonomy amendment

These specs intentionally supersede the source brief's shortlist/outreach approval
step. Creating a request is the user's standing authorization for bounded research,
provider contact, and factual follow-up. The workflow should remain transparent and
pausable, but must not stop for routine company-by-company or message-by-message
approval. The only mandatory confirmation is the final provider choice.

All work follows [Spec 00](./00-engineering-standards.md): narrow ports/adapters,
lazy stateless SDK singletons, explicit state machines, internal orchestration,
idempotent side-effect jobs, typed vendor boundaries, indexed ownership checks, and
fake adapters for deterministic tests.

The three external systems remain replaceable behind product-language ports:

```text
Authenticated UI
      ↓
Convex public API + realtime queries
      ↓
Domain policies and durable workflows
      ├── ReasoningPort ─── Convex AI Gateway / OpenAI
      ├── WebResearchPort ─ Firecrawl
      └── AgentMailPort ─── AgentMail
```

Convex is the source of truth. Vendor systems perform external work; their responses
are reconciled into durable Convex state before the UI treats them as complete.

## Execution order

| Phase | Spec                                                                           | Depends on | Delivery gate                                                             |
| ----- | ------------------------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------- |
| 0     | [Engineering standards](./00-engineering-standards.md)                         | —          | Conventions accepted and applied to every PR/commit                       |
| 1     | [Authentication and user bootstrap](./01-authentication-and-user-bootstrap.md) | 00         | Real passkey round-trip; isolated user row                                |
| 2     | [Per-user AgentMail inbox](./02-agentmail-user-inbox.md)                       | 01         | New user automatically reaches one stable inbox in `ready` state          |
| 3     | [Procurement domain model](./03-procurement-domain-model.md)                   | 01–02      | Typed schema, transitions, ownership tests, starter domain removed        |
| 4     | [Request intake and requirements](./04-request-intake-and-requirements.md)     | 03         | Prompt becomes editable requirements; research starts automatically       |
| 5     | [Provider discovery and research](./05-provider-discovery-and-research.md)     | 04         | Qualified candidates, endpoints, and web evidence stream live             |
| 6     | [Autonomous outreach and contact](./06-autonomous-outreach-and-contact.md)     | 05         | Bounded mixed email/form outreach runs automatically and exactly once     |
| 7     | [Inbound email and conversations](./07-agentmail-inbound-and-conversations.md) | 06         | Verified reply appears in the correct conversation exactly once           |
| 8     | [Reasoning and proposals](./08-conversation-reasoning-and-proposals.md)        | 07         | Reply produces evidence-backed facts/proposal and safe follow-up behavior |
| 9     | [Evaluation and dynamic UI](./09-evaluation-and-dynamic-ui.md)                 | 08         | Trusted lenses, recommendation, and final-choice confirmation             |
| 10    | [Integration and demo certification](./10-mvp-integration-and-demo.md)         | 01–09      | Canonical demo and security/reliability gates pass                        |

## Flow through the product

```text
Passkey sign-in
  → user bootstrap
  → AgentMail inbox provisioning
  → natural-language request
  → editable requirements
  → Firecrawl discovery/research
  → automatic qualified shortlist
  → autonomous AgentMail email / Firecrawl form
  → verified AgentMail reply
  → autonomous factual follow-ups
  → facts + questions + proposal
  → evaluation + trusted lenses
  → recommendation with evidence
  → user confirms final choice
```

## Increment strategy

Complete and verify one spec before starting its dependent spec. Each increment must
leave the main branch runnable and should end in a focused Conventional Commit.

Suggested vertical checkpoints:

1. **Identity checkpoint (Specs 01–02):** a new user signs in and sees their agent
   email address become ready in realtime.
2. **Research checkpoint (Specs 03–05):** a request becomes structured, editable
   requirements and a live, evidence-backed shortlist.
3. **Real-world contact checkpoint (Specs 06–08):** qualified providers are contacted
   automatically, replies/follow-ups run within scope, and proposals normalize
   safely.
4. **Decision checkpoint (Specs 09–10):** the user compares, reconfigures, and
   understands the recommendation, then confirms one choice.

Specs 06 and 07 should be developed with fake adapters/webhooks first. Live AgentMail
and Firecrawl smoke tests are final contract checks, not the default development loop.

## Cross-cutting release gates

Every phase must preserve:

- Ownership isolation with a negative two-user test.
- No unbounded Convex reads.
- No secrets in source, logs, errors, model context, or email.
- No external side effect initiated by a query or directly by the browser.
- Realtime progress and recoverable failure state.
- Idempotency and reconciliation for external operations.
- Provenance for facts and separation of facts from evaluation.
- Bounded autonomous information gathering with no per-interaction approval gate.
- Authenticated user confirmation as the only path to final provider selection.
- No automated commitments, payments, bookings, signatures, or scope expansion.

## Explicitly outside the initial MVP

Payments, deposits, bookings, signatures, contracts, provider accounts, marketplace
features, phone calls, SMS, supplier dashboards, universal reputation scores,
sophisticated CRM integrations, and monetization.

The architecture may leave extension points for those capabilities, but no MVP spec
should implement them.
