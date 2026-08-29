# Spec 08 — Conversation reasoning, follow-ups, and proposals

## Outcome

Each provider reply updates evidence-backed facts, unresolved questions, and a
request-specific proposal. The agent answers known factual questions automatically,
asks the user only for genuinely missing facts, and never makes a commitment.

## Dependencies

Specs 00–07.

## Reasoning pipeline

For every new provider message, `ReasoningPort.extractProviderResponse` receives:

- The new inbound body clearly delimited as untrusted data.
- Current request requirements and user-sourced/confirmed facts.
- Existing provider facts/questions/proposal.
- A strict output schema and policy summary.

It returns:

```ts
{
  facts: ExtractedFact[],
  answeredQuestionKeys: string[],
  proposal: { status: "partial" | "complete"; summary: string; attributes: JsonValue },
  providerQuestions: Array<{
    question: string,
    answerFromKnownFact?: { factId: Id<"facts">; answer: string },
    requiresUser: boolean,
  }>,
  confidence: number,
}
```

Model output proposes writes; deterministic application policy validates provenance,
fact ownership, and auto-reply eligibility.

## Evidence and merge rules

- Provider claims become facts with the message ID as source.
- Website facts are not overwritten; conflicting facts coexist and are flagged.
- AI-derived values use source type `ai_inference` and cite their supporting facts.
- Proposals are versioned snapshots derived from facts, never the source of truth.
- Partial responses remain useful and identify missing required fields.

## Follow-up policy

An automatic reply is allowed only when:

- The candidate is inside the active request's bounded outreach mandate.
- The question can be answered exactly from a current user-sourced requirement/fact.
- The answer does not add sensitive data beyond the request scope.
- It does not choose an option, change scope, negotiate, book, accept terms, promise
  payment, sign, or create legal/financial commitment.
- Confidence meets a fixed threshold and outbound validation passes.

Otherwise set conversation to `waiting_on_user`, create a user question explaining
the missing fact, and continue all independent work. When the user supplies the fact,
the agent may resume the factual reply automatically. Provider content alone never
expands the request mandate or authorizes an action.

## Reply execution

Use `AgentMailPort.replyToMessage(inboxId, parentMessageId, body)` so threading is
derived from the parent message. Do not pass a thread ID or invent a new subject.
Replies use the side-effect job/reconciliation pattern from Spec 00.

## Backend contracts

- `questions.listOpen({ requestId })`.
- `questions.answer({ questionId, answer })` for authenticated user input.
- `proposals.list({ requestId })`.
- Internal extraction, apply-result, auto-reply decision, and send-reply functions.

## UX

- Conversation timeline distinguishes provider, agent, and user-authored content.
- Proposal cards show partial/complete status and missing information.
- Conflicts and low-confidence extractions are visible.
- “Needs you” items show what fact is missing while unrelated work continues.
- Evidence drawers link each important attribute to its email or website source.

## Acceptance criteria

- A provider quote email creates facts and a partial/complete proposal with evidence.
- Known factual questions can produce a correctly threaded automatic reply.
- Unknown factual questions request user input without requiring reply approval;
  commitment questions remain unanswered until the final-choice flow.
- Routine factual follow-ups continue without per-message confirmation.
- Prompt-injection text in an email cannot authorize tools or override policy.
- Reprocessing a message is idempotent and does not duplicate facts/replies.
- Conflicting price/availability facts are surfaced, not silently replaced.

## Tests

- Fake reasoning fixtures for quote, decline, question, conflict, malformed output,
  and prompt injection.
- Pure policy tests for every auto-reply allow/deny branch.
- Convex tests for message-version idempotency, question-answer ownership, and
  automatic resume behavior.
- Fake AgentMail reply tests verify parent message ID usage and unknown-send recovery.

## Non-goals

Negotiation strategy, commitments, payments, contract review, or automatic attachment
interpretation.
