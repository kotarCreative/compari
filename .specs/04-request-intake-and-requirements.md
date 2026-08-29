# Spec 04 — Request intake and editable requirements

## Outcome

A signed-in user describes an outcome in natural language, sees a structured
interpretation appear in realtime, and can correct it while autonomous research
begins from the best available information.

## Dependencies

Specs 00–03. Upgrade Convex to a version compatible with the selected
`@convex-dev/agent` and Convex AI Gateway packages before implementation.

## Architecture

Use `@convex-dev/agent` for the in-app request conversation and durable message
history. Use a `ReasoningPort` adapter backed by the Convex AI Gateway. Keep the
requirement extraction policy in a versioned prompt/schema module and validate model
output before writing it.

Do not create a second home-grown chat message table. External provider email remains
in `providerMessages` from Spec 03.

## Extraction contract

Input:

- Original user prompt, preserved verbatim.
- Known user corrections for this request.
- Current date/timezone when deadlines use relative language.

Output:

```ts
{
  title: string,
  location?: string,
  requirements: Array<{
    key: string,
    label: string,
    value: JsonValue,
    kind: "hard_constraint" | "preference" | "information",
    importance?: number,
    confidence: number,
  }>,
  clarifyingQuestions: Array<{ question: string; importance: "required" | "useful" }>,
}
```

Keys are request-local and stable across a re-extraction. The model may propose but
must not silently overwrite fields the user corrected.

## Workflow

1. `requests.create` stores the original prompt and schedules an extraction job.
2. The internal action calls `ReasoningPort.extractRequirements`.
3. An internal mutation atomically writes title/location, inferred requirements,
   questions, and an activity event if the request version still matches the job.
4. If the request has enough information to form a useful search, the same workflow
   transitions to `researching` and schedules Spec 05 automatically.
5. User edits call explicit create/update/delete requirement mutations, mark
   `source: "user"`, increment the request version, and cause stale downstream work
   to be discarded or refreshed.
6. Missing information becomes an open question. It does not block research unless
   no safe/useful search can be formed; the rest of the workflow continues.

## Backend contracts

- `requirements.list({ requestId })`.
- `requirements.upsert({ requestId, key, label, value, kind, importance? })`.
- `requirements.remove({ requirementId })`.
- `questions.answerForRequest({ questionId, answer })` for user-facing intake
  questions.
- `requests.pauseAutomation({ requestId })` and `requests.resumeAutomation(...)`.

Every function validates request ownership and record membership.

## UX

- Chat-style composer creates the request.
- Interpreted summary separates hard constraints from preferences.
- Each requirement is editable and visibly labeled as user-provided or inferred.
- Low-confidence fields and required questions are prominent.
- Research progress starts automatically and can be paused by the user.
- Open questions remain visible while the agent gathers everything else it can.
- The original prompt remains inspectable.

## Acceptance criteria

- A demo printing prompt yields quantity, deadline, stock preference, budget, and
  location/question fields without category-specific code.
- User corrections survive subsequent model runs.
- Invalid model output fails the job safely and can be retried.
- Creating the request is the standing authorization for bounded information
  gathering; research begins without a second confirmation.
- Another user cannot view or edit the request/thread/requirements.

## Tests

- Fake reasoning adapter fixtures for complete, ambiguous, malformed, and timeout
  outputs.
- Unit tests for merge precedence: user correction > user prompt > inference.
- Convex tests for request version races and ownership.
- Component test for editing requirements while research is in progress.

## Non-goals

Voice input, attachments, provider discovery, or recommendation generation.
