# Spec 03 — Procurement domain model and workflow state

## Outcome

The starter `numbers` demo is replaced by an authenticated, ownership-safe Convex
domain model that can represent a generic procurement request, candidates, evidence,
outreach, conversations, proposals, evaluations, and realtime progress.

## Dependencies

Specs 00–02.

## Tables

Implement the following strongly typed tables. Flexible fields use bounded JSON
with an explicit schema/version and are validated again at AI/vendor boundaries.

- `procurementRequests`: `userId`, original `prompt`, `title`, optional location,
  status, version, optional selected candidate/proposal and selection timestamp,
  timestamps.
- `requirements`: request, key, label, value, kind, source, importance, confidence,
  timestamps.
- `businesses`: canonical provider name, normalized domain, website, location,
  timestamps.
- `requestCandidates`: request, business, status, qualification/rejection summary,
  timestamps.
- `contactEndpoints`: business, type, value, verification state, bounded metadata,
  discovery evidence, timestamps.
- `facts`: request, optional candidate/business, key, label, bounded value,
  source type/reference, confidence, observed time.
- `questions`: request, optional candidate, text, importance, status, answer and
  supporting fact IDs.
- `outreachAttempts`: request, candidate, endpoint, method, job/status, vendor IDs,
  timestamps and safe error.
- `conversations`: request, candidate, inbox ID, AgentMail thread ID, status and
  last-message time.
- `providerMessages`: conversation, direction, participants, subject, sanitized
  body, AgentMail message ID, attachments metadata, received/sent time.
- `proposals`: request, candidate, status, summary, versioned bounded attributes,
  confidence and timestamps.
- `evaluations`: request, input version, versioned criteria/results,
  recommendation and generated time.
- `uiViews`: request, label, trusted view type, versioned configuration, input
  version, generated time.
- `activityEvents`: request, optional candidate, event type, safe message,
  correlation ID and timestamp.
- `sideEffectJobs`: common durable job envelope from Spec 00.
- `webhookEvents`: provider, external event ID, status and timestamps for replay
  protection.

Do not create a generic `entities` table. Do not duplicate in-app AI thread/message
storage owned by `@convex-dev/agent`; `providerMessages` is specifically external
provider communication.

## Required indexes

At minimum:

- Every user-owned root lookup: `procurementRequests.by_user_id_and_updated_at`.
- Every child table: `by_request_id` or `by_request_id_and_status`.
- Candidates: `by_request_id_and_business_id` and
  `by_request_id_and_status`.
- Businesses: `by_domain`.
- Endpoints: `by_business_id_and_type`.
- Conversations: `by_agent_mail_thread_id` and `by_request_id_and_candidate_id`.
- Provider messages: `by_external_message_id` and
  `by_conversation_id_and_created_at`.
- Jobs: `by_idempotency_key`, `by_status_and_created_at`.
- Webhooks: `by_provider_and_external_event_id`.

All list queries use an index plus pagination or an explicit bounded `take`.

## State machines

Request states:

```text
draft → researching → contacting → collecting_responses
      → evaluating → awaiting_selection → completed
any active state → cancelled
```

Candidate states:

```text
discovered → researching → qualified | rejected
qualified → queued_for_contact → contacted → responded
responded → proposal_received | declined
```

Conversation states are `active`, `waiting_on_provider`, `waiting_on_user`, and
`completed`. Implement pure transition functions and reject invalid transitions.

## Public API baseline

- `requests.create({ prompt })` returns request ID in `draft`.
- `requests.get({ requestId })` returns an ownership-filtered aggregate summary.
- `requests.list({ paginationOpts })` returns current user's requests.
- `requests.cancel({ requestId })` rejects completed/cancelled requests.
- `requests.pauseAutomation({ requestId })` and `requests.resumeAutomation(...)`
  give the owner control without introducing per-provider approval gates.
- `requests.activity({ requestId, paginationOpts })` powers live progress.

Public APIs never accept a user ID. Cross-request child IDs must be checked against
the owned root before use.

## Acceptance criteria

- The schema deploys and generated types update without hand edits.
- Two users have fully isolated requests and child records.
- Invalid status transitions fail before writes occur.
- Only an authenticated final-choice command can transition
  `awaiting_selection → completed` and record the selected proposal.
- Duplicate business domains and candidate membership reconcile predictably.
- All realtime screens can be driven from bounded indexed queries.
- The old numbers table/functions/routes are removed once replacement screens land.

## Tests

- Unit tests for every transition map.
- Convex tests for create/list/get/cancel and negative ownership cases.
- Index-backed pagination tests with more rows than one page.
- Invariant tests for candidate/business/request relationship mismatches.

## Non-goals

Provider accounts, universal provider ratings, payment/booking records, and a generic
CRM.
