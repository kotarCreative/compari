import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { OutreachStatus } from '../request/components/OutreachStatus'
import {
  displayEvidenceValue,
  safeEvidenceUrl,
} from '../request/evidencePolicy'
import { decisionApi } from './contracts'
import { ViewRenderer } from './ViewRenderer'
import type { ReactNode } from 'react'
import type { RequestDetailValue } from '../request/contracts'
import type { DecisionProposal as Proposal } from './contracts'
import { Alert, Badge, Button } from '~/components/ui'
import { errorMessage } from '~/lib/errors'
import { humanize } from '~/lib/format'
import { DetailDialog } from '~/components/common/DetailDialog'

type Provider = RequestDetailValue['candidates'][number]

export function DecisionPanel({
  detail,
  onError,
  retryFailed,
  selectCandidates,
}: {
  detail: RequestDetailValue
  onError: (value: string | null) => void
  retryFailed: (args: { attemptId: string }) => Promise<unknown>
  selectCandidates: (args: {
    requestId: string
    candidateIds: Array<string>
  }) => Promise<unknown>
}) {
  const { _id: requestId, status } = detail.request
  const data = useQuery(decisionApi.evaluations.list, { requestId })
  const proposals = useQuery(decisionApi.proposals.list, { requestId })
  const confirmChoice = useMutation(decisionApi.selections.confirmChoice)
  const [error, setError] = useState<string | null>(null)
  const [contacting, setContacting] = useState<Array<string>>([])
  const received = new Map<string, Proposal>()
  for (const proposal of proposals ?? []) {
    if (proposal.status !== 'received') continue
    const previous = received.get(proposal.candidateId)
    if (!previous || proposal.version > previous.version)
      received.set(proposal.candidateId, proposal)
  }
  const providers = detail.candidates.filter(
    (candidate) =>
      ['recommended', 'selected'].includes(
        candidate.recommendationStatus ?? '',
      ) || received.has(candidate._id),
  )
  const canContact =
    [
      'researching',
      'contacting',
      'collecting_responses',
      'awaiting_selection',
    ].includes(status) &&
    !detail.request.automationPaused &&
    detail.request.rankingStatus === 'ready' &&
    detail.request.rankingVersion === detail.request.version

  async function contact(candidateId: string) {
    onError(null)
    setContacting((current) => [...current, candidateId])
    try {
      await selectCandidates({ requestId, candidateIds: [candidateId] })
    } catch (reason) {
      onError(errorMessage(reason, 'Could not contact this vendor.'))
    } finally {
      setContacting((current) => current.filter((id) => id !== candidateId))
    }
  }

  return (
    <section className="space-y-5" aria-labelledby="quotes-heading">
      <div>
        <h3 id="quotes-heading" className="text-lg font-semibold">
          Your options & quotes
        </h3>
        <p className="text-sm text-slate-600">
          Prices update as we find them. Contact any vendor to confirm missing
          details.
        </p>
        {data?.evaluation ? (
          <p className="mt-2 text-sm">{data.evaluation.recommendation}</p>
        ) : null}
      </div>
      {data?.views.length ? (
        <DetailDialog label="Comparison notes">
          <ViewRenderer views={data.views} />
        </DetailDialog>
      ) : null}
      <div className="grid gap-5">
        {providers.map((provider) => {
          const proposal = received.get(provider._id)
          const website = safeEvidenceUrl(provider.website)
          const hasEmail = provider.endpoints.some(
            (endpoint) =>
              endpoint.type === 'email' &&
              ['public', 'verified'].includes(endpoint.verificationState),
          )
          const attempts = detail.outreach.filter(
            (attempt) => attempt.candidateId === provider._id,
          )
          const selected =
            provider.recommendationStatus === 'selected' || attempts.length > 0
          const busy = contacting.includes(provider._id)
          return (
            <ConfirmationCard
              key={provider._id}
              provider={provider}
              proposal={proposal}
              requestId={requestId}
              confirmChoice={confirmChoice}
              onError={setError}
              selectable={status === 'awaiting_selection'}
              finished={status === 'completed' || status === 'cancelled'}
            >
              <div className="mt-5 flex flex-wrap items-center gap-3">
                {!selected && !['completed', 'cancelled'].includes(status) ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      busy ||
                      !canContact ||
                      !hasEmail ||
                      provider.status !== 'qualified' ||
                      provider.recommendationStatus !== 'recommended'
                    }
                    onClick={() => void contact(provider._id)}
                    aria-label={`Contact ${provider.name}`}
                  >
                    {busy ? 'Starting follow-up…' : 'Contact vendor'}
                  </Button>
                ) : null}
                {website ? (
                  <a
                    className="text-sm text-sky-700 underline underline-offset-2"
                    href={website}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View website ↗
                  </a>
                ) : null}
              </div>
              {!selected && !hasEmail ? (
                <p className="mt-2 text-xs text-slate-500">
                  No verified email available for follow-up.
                </p>
              ) : null}
              {!selected &&
              hasEmail &&
              !canContact &&
              !['completed', 'cancelled'].includes(status) ? (
                <p className="mt-2 text-xs text-slate-500">
                  {detail.request.automationPaused
                    ? 'Resume agents to contact this vendor.'
                    : 'Contact will be available when the current ranking and comparison are ready.'}
                </p>
              ) : null}
              {attempts.length ? (
                <OutreachStatus
                  compact
                  detail={{ ...detail, outreach: attempts }}
                  onError={onError}
                  retryFailed={retryFailed}
                />
              ) : selected ? (
                <p className="mt-3 text-sm text-slate-500">
                  Follow-up requested
                </p>
              ) : null}
            </ConfirmationCard>
          )
        })}
      </div>
      {!providers.length ? (
        <p className="py-8 text-center text-sm text-slate-500">
          {detail.request.rankingStatus === 'ready'
            ? 'No suitable options yet.'
            : 'Options are on the way. Cards will appear here as results become available.'}
        </p>
      ) : null}
      {error ? <Alert variant="destructive">{error}</Alert> : null}
    </section>
  )
}

function ConfirmationCard({
  requestId,
  proposal,
  provider,
  children,
  confirmChoice,
  onError,
  selectable,
  finished,
}: {
  requestId: string
  proposal?: Proposal
  provider: Provider
  children: ReactNode
  confirmChoice: (args: {
    requestId: string
    candidateId: string
    proposalId: string
    proposalVersion: number
  }) => Promise<unknown>
  onError: (value: string | null) => void
  finished: boolean
  selectable: boolean
}) {
  const attributes = record(proposal?.attributes.value)
  const [isSelecting, setIsSelecting] = useState(false)
  const term = (key: string) => {
    const value = attributes[key]
    if (typeof value === 'string' || typeof value === 'number')
      return String(value)
    const fact = [...provider.facts]
      .filter(
        (item) =>
          item.key === key && ['website', 'provider'].includes(item.sourceType),
      )
      .sort((left, right) => right.observedAt - left.observedAt)
      .at(0)
    if (!fact) return key === 'price' ? 'Price not found yet' : 'Not supplied'
    return typeof fact.value.value === 'string'
      ? fact.value.value
      : displayEvidenceValue(fact.value.value)
  }
  const details = Object.entries(attributes)
    .filter(
      ([key, value]) =>
        ![
          'price',
          'scope',
          'availability',
          'timing',
          'missingInformation',
        ].includes(key) &&
        (typeof value === 'string' || typeof value === 'number'),
    )
    .slice(0, 6)
  const missingInformation = Array.isArray(attributes.missingInformation)
    ? attributes.missingInformation.filter(
        (value): value is string => typeof value === 'string',
      )
    : []
  const isWebsiteQuote = attributes.evidence_source === 'Public website'
  const selectOption = async () => {
    if (!proposal) return
    onError(null)
    setIsSelecting(true)
    try {
      await confirmChoice({
        requestId,
        candidateId: proposal.candidateId,
        proposalId: proposal._id,
        proposalVersion: proposal.version,
      })
    } catch (reason) {
      onError(errorMessage(reason, 'This option could not be selected.'))
    } finally {
      setIsSelecting(false)
    }
  }
  return (
    <article className="decision-option-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-800">
            {proposal
              ? isWebsiteQuote
                ? 'Published website quote'
                : 'Provider quote'
              : 'Vendor option'}
          </p>
          <h5 className="mt-1 font-hand text-3xl font-bold leading-tight">
            {provider.name}
          </h5>
        </div>
        {provider.recommendationScore !== undefined ? (
          <Badge variant="outline">
            {Math.round(provider.recommendationScore)}/100 match
          </Badge>
        ) : null}
        {proposal ? (
          <Badge variant="outline">
            {Math.round(proposal.confidence * 100)}% confidence
          </Badge>
        ) : null}
      </div>

      {provider.recommendationReason ? (
        <p className="mt-3 text-sm text-slate-600">
          {provider.recommendationReason}
        </p>
      ) : null}
      <dl aria-live="polite" className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="decision-term">
          <dt>Price</dt>
          <dd>{term('price')}</dd>
        </div>
        <div className="decision-term">
          <dt>Scope</dt>
          <dd>{term('scope')}</dd>
        </div>
        <div className="decision-term">
          <dt>Availability</dt>
          <dd>
            {term('availability') !== 'Not supplied'
              ? term('availability')
              : term('timing')}
          </dd>
        </div>
      </dl>
      {proposal ? (
        <details className="mt-5 border-t border-dashed border-slate-300 pt-4">
          <summary className="cursor-pointer text-sm font-semibold">
            Quote details
          </summary>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            {proposal.summary}
          </p>
          <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            {details.map(([key, value]) => (
              <div key={key}>
                <dt className="font-semibold text-slate-600">
                  {humanize(key)}
                </dt>
                <dd className="mt-0.5 text-slate-800">{String(value)}</dd>
              </div>
            ))}
          </dl>
        </details>
      ) : null}
      {missingInformation.length ? (
        <div className="mt-5 rounded-lg bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
          <strong>Still to confirm:</strong> {missingInformation.join(', ')}
        </div>
      ) : null}
      {children}
      {selectable && proposal ? (
        <Button
          className="mt-6"
          disabled={isSelecting}
          onClick={() => void selectOption()}
          size="sm"
        >
          {isSelecting ? 'Selecting…' : 'Choose this option'}
        </Button>
      ) : !finished && proposal ? (
        <p className="mt-5 text-xs text-slate-500">
          {isWebsiteQuote
            ? 'Website price · comparison in progress.'
            : 'Available to choose when comparison finishes.'}
        </p>
      ) : null}
    </article>
  )
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}
