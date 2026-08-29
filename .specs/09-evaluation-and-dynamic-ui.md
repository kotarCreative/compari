# Spec 09 — Evaluations and trusted dynamic decision UI

## Outcome

The user sees current options through 2–4 request-specific comparison lenses, can
ask the agent to reconfigure those lenses, and can inspect the evidence behind every
important claim and recommendation.

## Dependencies

Specs 00–08 and at least one partial proposal.

## Separation of concerns

- Facts are evidence-backed observations/provider claims.
- Proposals are normalized request-specific offers derived from facts.
- Evaluations interpret proposals against current requirements.
- UI views configure trusted components that render evaluations/facts.

Never store an evaluation as a fact. Never let the model generate JSX, HTML, code,
SQL, Convex function names, or arbitrary component props.

## Trusted view schema

MVP supports:

- `recommendation`.
- `provider_cards`.
- `comparison_matrix`.
- `ranking`.
- `bar` for a validated numeric metric.
- `timeline` for validated dates/ranges.
- `difference`.
- `missing_information`.

Each view type has a strict discriminated-union validator. Field references must be
resolved against an allow-listed, server-generated metric catalog for the current
evaluation. Labels and explanatory text have length limits.

## Evaluation workflow

1. A material requirement/fact/proposal change increments request input version.
2. A debounced idempotent job generates a fresh evaluation from complete current
   inputs.
3. The reasoning adapter returns criteria, per-candidate results, recommendation,
   caveats, and 2–4 validated view configs.
4. An internal mutation writes only if the input version is still current.
5. The UI subscribes to the latest matching evaluation/views.

Recommendations must explain which hard constraints are met, which preferences drive
the ordering, missing information, and confidence. Avoid meaningless universal
scores.

## Conversational reconfiguration

Use the existing request agent thread. A user command such as “ignore price and show
who can deliver soonest” produces a proposed evaluation preference update and new
view configuration. It does not mutate underlying facts or requirements unless the
user explicitly asks to change them.

Invalid/unsupported view requests fall back to a safe provider or matrix view with a
plain-language explanation.

## Frontend structure

- `ViewRenderer` exhaustively maps trusted view types to local components.
- Each component receives a normalized view model, not raw AI JSON.
- Evidence references open a shared `EvidenceDrawer`.
- Unknown view types render an error boundary, never execute content.
- Responsive layouts remain usable during partial proposal collection.

## Acceptance criteria

- A request with comparable offers generates at least 2 and at most 4 useful lenses.
- A natural-language command changes ordering/view configuration, not just chat text.
- Every recommendation reason and important displayed metric links to evidence.
- Stale evaluation jobs cannot overwrite newer user requirements/proposals.
- Invalid model configs are rejected and safely replaced.
- Partial/missing data is shown explicitly instead of coerced to zero/false.

## Tests

- Schema fixtures for every view type plus malicious/unknown configs.
- Unit tests for metric catalog resolution and stale-version protection.
- Component tests for each renderer and evidence drawer.
- End-to-end test reconfigures a lens and verifies facts remain unchanged.

## Non-goals

Arbitrary dashboards, user-authored formulas, generated frontend code, universal
provider reputation, or pixel-perfect chart customization.
