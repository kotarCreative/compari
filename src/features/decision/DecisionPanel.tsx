import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { decisionApi } from './contracts'
import { ViewRenderer } from './ViewRenderer'
import type {
  DecisionProposal as Proposal,
  DecisionProvider as Provider,
} from './contracts'
import { Alert, Badge, Button } from '~/components/ui'
import { errorMessage } from '~/lib/errors'
import { DetailDialog } from '~/components/common/DetailDialog'

export function DecisionPanel({
  requestId,
  status,
  providers = [],
}: {
  requestId: string
  status: string
  providers?: Array<Provider>
}) {
  const data = useQuery(decisionApi.evaluations.list, { requestId })
  const proposals = useQuery(decisionApi.proposals.list, { requestId })
  const confirmChoice = useMutation(decisionApi.selections.confirmChoice)
  const [error, setError] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  if (!data)
    return (
      <p className="mt-3 text-sm text-slate-500">Loading decision state…</p>
    )
  const providerOrder = new Map(
    providers.map((provider, index) => [provider.id, index]),
  )
  const received = (
    proposals?.filter((proposal) => proposal.status === 'received') ?? []
  ).sort(
    (left, right) =>
      (providerOrder.get(left.candidateId) ?? Number.MAX_SAFE_INTEGER) -
      (providerOrder.get(right.candidateId) ?? Number.MAX_SAFE_INTEGER),
  )
  const visibleIndex = received.length
    ? Math.min(activeIndex, received.length - 1)
    : 0
  const activeProposal = received.at(visibleIndex)
  const showPrevious = () =>
    setActiveIndex((current) =>
      current <= 0 ? received.length - 1 : current - 1,
    )
  const showNext = () =>
    setActiveIndex((current) => (current + 1) % received.length)
  if (!received.length && !data.evaluation) return null
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-lg font-semibold">Compare your options</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {data.evaluation?.recommendation ??
            'The comparison agent is preparing a side-by-side view.'}
        </p>
      </div>
      {data.views.length ? (
        <DetailDialog label="Comparison notes">
          <ViewRenderer views={data.views} />
        </DetailDialog>
      ) : null}
      {received.length ? (
        <div
          aria-label="Provider options"
          aria-roledescription="carousel"
          className="space-y-4 py-4 text-sm"
          role="region"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="font-hand text-2xl font-bold">
                {status === 'awaiting_selection'
                  ? 'Your quotes'
                  : 'Quotes found online'}
              </h4>
              {received.length ? (
                <p className="text-xs text-slate-500" aria-live="polite">
                  Option {visibleIndex + 1} of {received.length}
                </p>
              ) : null}
            </div>
            {received.length > 1 ? (
              <div
                className="flex items-center gap-1"
                aria-label="Choose an option to view"
              >
                <Button
                  aria-label="Show previous option"
                  onClick={showPrevious}
                  size="icon"
                  variant="ghost"
                >
                  <span aria-hidden="true">←</span>
                </Button>
                <Button
                  aria-label="Show next option"
                  onClick={showNext}
                  size="icon"
                  variant="ghost"
                >
                  <span aria-hidden="true">→</span>
                </Button>
              </div>
            ) : null}
          </div>
          {activeProposal ? (
            <div aria-live="polite">
              <ConfirmationCard
                confirmChoice={confirmChoice}
                key={activeProposal._id}
                onError={setError}
                proposal={activeProposal}
                provider={providers.find(
                  (item) => item.id === activeProposal.candidateId,
                )}
                requestId={requestId}
                selectable={status === 'awaiting_selection'}
                finished={status === 'completed' || status === 'cancelled'}
              />
            </div>
          ) : (
            <p className="text-slate-500">
              No current received proposal is available to confirm.
            </p>
          )}
          {received.length > 1 ? (
            <div className="flex justify-center gap-2">
              {received.map((proposal, index) => (
                <button
                  aria-label={`Show option ${index + 1}`}
                  aria-current={index === visibleIndex ? 'true' : undefined}
                  className="size-2.5 rounded-full border border-slate-500 bg-transparent transition-transform aria-current:scale-125 aria-current:bg-sky-600"
                  key={proposal._id}
                  onClick={() => setActiveIndex(index)}
                  type="button"
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {error ? <Alert variant="destructive">{error}</Alert> : null}
    </section>
  )
}

function ConfirmationCard({
  requestId,
  proposal,
  provider,
  confirmChoice,
  onError,
  selectable,
  finished,
}: {
  requestId: string
  proposal: Proposal
  provider?: Provider
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
  const attributes = record(proposal.attributes.value)
  const [isSelecting, setIsSelecting] = useState(false)
  const term = (key: string) =>
    typeof attributes[key] === 'string' || typeof attributes[key] === 'number'
      ? String(attributes[key])
      : 'Not supplied'
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
            {isWebsiteQuote ? 'Published website quote' : 'Provider option'}
          </p>
          <h5 className="mt-1 font-hand text-3xl font-bold leading-tight">
            {provider?.name ?? 'Provider'}
          </h5>
        </div>
        <Badge variant="outline">
          {Math.round(proposal.confidence * 100)}% confidence
        </Badge>
      </div>

      <dl className="mt-5 grid gap-3 sm:grid-cols-3">
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
              <dt className="font-semibold text-slate-600">{humanize(key)}</dt>
              <dd className="mt-0.5 text-slate-800">{String(value)}</dd>
            </div>
          ))}
        </dl>
      </details>
      {missingInformation.length ? (
        <div className="mt-5 rounded-lg bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
          <strong>Still to confirm:</strong> {missingInformation.join(', ')}
        </div>
      ) : null}
      {selectable ? (
        <Button
          className="mt-6"
          disabled={isSelecting}
          onClick={() => void selectOption()}
          size="sm"
        >
          {isSelecting ? 'Selecting…' : 'Choose this option'}
        </Button>
      ) : !finished ? (
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

function humanize(value: string) {
  const words = value.replace(/[_-]/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}
