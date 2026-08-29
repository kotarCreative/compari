# Spec 10 — MVP integration, hardening, and demo certification

## Outcome

The full workflow operates as one coherent product for a controlled printing-services
demo and is resilient enough to demonstrate live without hidden manual database edits.

## Dependencies

Specs 00–09.

## Required end-to-end scenario

Use this canonical prompt without hardcoding its fields:

> I need 500 full-color brochures printed by next Friday. I'd prefer matte paper
> and want to stay under $700.

The certified flow must:

1. Sign in a new user and automatically provision their stable agent inbox.
2. Create a request and show editable extracted requirements.
3. Start research automatically and stream discovered/researched providers.
4. Show a qualified shortlist with website evidence and mixed contact methods.
5. Automatically contact 3–5 qualified providers without an approval interruption.
6. Send at least one AgentMail email and submit at least one Firecrawl form, or use
   a deterministic demo provider/form when live public targets are inappropriate.
7. Ingest at least one verified AgentMail reply.
8. Extract evidence-backed facts and a proposal.
9. Render multiple comparison lenses.
10. Reconfigure a lens from a natural-language instruction.
11. Show why the recommendation was made and open its evidence.
12. Require the user to confirm the final provider choice and record it without
    making a booking/payment/acceptance.

## Demo mode

Provide an explicit environment-gated demo adapter set for deterministic hackathon
runs. Demo adapters implement the same ports and fixture contracts as production;
they are not conditional branches scattered through domain code.

- Production mode is the default for deployed builds.
- Demo mode is visibly labeled in the UI.
- Demo fixtures contain no real personal data and never contact real providers.
- Switching modes requires server configuration, not a browser query parameter.

## Operational readiness

Add an authenticated request diagnostics view showing:

- Current request/candidate/conversation states.
- Pending/running/failed jobs and safe error categories.
- Last successful Firecrawl, AgentMail, and reasoning events.
- Retry actions only where policy allows.

Add correlation IDs from request creation through jobs and activity events. No secret
or full private content appears in diagnostics/logs.

## Security certification

- All public Convex functions pass two-user authorization tests.
- Webhook signature and replay tests pass.
- Autonomous outreach/follow-up stays within the user-created request mandate and
  configured provider cap.
- Only an authenticated user can confirm the final provider choice.
- Email/web content cannot trigger consequential actions.
- Secrets exist only in Convex environment variables.
- Outbound messages are checked for recipients, disclosure, scope, and secret-like
  strings.
- CAPTCHA, payment, booking, contract, signature, and low-confidence cases pause for
  the user.

## Reliability certification

- Repeat clicks/webhooks/jobs do not duplicate inboxes, requests, candidates,
  messages, outreach, facts, or replies.
- Rate limits and transient failures surface and retry within bounds.
- Unknown email-send outcomes reconcile before retry.
- Stale AI/research results cannot overwrite newer request state.
- Every long-running screen has empty, progress, partial, error, and recovery states.

## Verification commands

At minimum:

```text
npm run typecheck
npm run lint
npm run build
npm run test:run
```

Add `test:run` if it does not yet exist. Also run one deployment-backed smoke test
for passkey auth, one sandbox AgentMail reply, and one Firecrawl request before the
demo. Never point automated tests at production providers.

## Acceptance criteria

- A fresh account completes the canonical flow without database-console edits.
- Realtime updates are visible at each workflow phase.
- Both production and demo adapters satisfy the same contract suite.
- The demo can recover from one simulated external failure.
- The final screen meets every required endstate item in `Roadmap.md`.
- The hackathon log is refreshed from committed evidence after certification.

## Non-goals

Payments, bookings, contracts, provider accounts, phone/SMS, supplier dashboards,
monetization, or production-scale abuse prevention beyond conservative caps and
the final-choice confirmation gate.
