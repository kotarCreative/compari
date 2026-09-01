import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { decisionApi } from './contracts'
import { ViewRenderer } from './ViewRenderer'
import type {
  DecisionProposal as Proposal,
  DecisionProvider as Provider,
} from './contracts'
import { Alert, Button, Input } from '~/components/ui'

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
  const diagnostics = useQuery(decisionApi.diagnostics.getRequest, {
    requestId,
  })
  const proposals = useQuery(decisionApi.proposals.list, { requestId })
  const reconfigure = useMutation(decisionApi.evaluations.reconfigure)
  const confirmChoice = useMutation(decisionApi.selections.confirmChoice)
  const [instruction, setInstruction] = useState('')
  const [error, setError] = useState<string | null>(null)
  if (!data)
    return (
      <p className="mt-3 text-sm text-slate-500">Loading decision state…</p>
    )
  const received =
    proposals?.filter((proposal) => proposal.status === 'received') ?? []
  return (
    <section className="mt-4 space-y-3 border-t border-slate-200 pt-4 dark:border-slate-700">
      <div>
        <h4 className="font-semibold">Decision workspace</h4>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {data.evaluation?.recommendation ??
            'Collecting comparable provider evidence. No provider is selected automatically.'}
        </p>
      </div>
      <ViewRenderer views={data.views} />
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          setError(null)
          void reconfigure({ requestId, instruction })
            .then(() => setInstruction(''))
            .catch(() => setError('Could not update comparison preferences.'))
        }}
      >
        <Input
          className="min-w-0 flex-1"
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          placeholder="e.g. ignore price and show delivery timing"
          maxLength={500}
        />
        <Button
          disabled={!instruction.trim()}
          size="sm"
          type="submit"
          variant="outline"
        >
          Update lenses
        </Button>
      </form>
      {status === 'awaiting_selection' ? (
        <div className="space-y-3 rounded border border-sky-300 p-3 text-sm">
          <strong>Final confirmation</strong>
          <p>
            Confirmation records your decision only. It will not accept a quote,
            book, pay, or contact a provider.
          </p>
          {received.length ? (
            received.map((proposal) => (
              <ConfirmationCard
                confirmChoice={confirmChoice}
                key={proposal._id}
                onError={setError}
                proposal={proposal}
                provider={providers.find(
                  (item) => item.id === proposal.candidateId,
                )}
                requestId={requestId}
              />
            ))
          ) : (
            <p className="text-slate-500">
              No current received proposal is available to confirm.
            </p>
          )}
        </div>
      ) : null}
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      <details className="text-xs text-slate-500">
        <summary>Request diagnostics ({status})</summary>
        <ul className="mt-2 list-disc pl-4">
          {diagnostics?.jobs.map((job) => (
            <li key={job._id}>
              {job.kind}: {job.status}
              {job.lastErrorSummary ? ` — ${job.lastErrorSummary}` : ''}
            </li>
          )) ?? <li>Loading operational state…</li>}
        </ul>
      </details>
    </section>
  )
}

function ConfirmationCard({
  requestId,
  proposal,
  provider,
  confirmChoice,
  onError,
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
  onError: (value: string) => void
}) {
  const attributes = record(proposal.attributes.value)
  const term = (key: string) =>
    typeof attributes[key] === 'string' || typeof attributes[key] === 'number'
      ? String(attributes[key])
      : 'Not supplied'
  return (
    <article className="rounded border border-slate-200 p-3 dark:border-slate-700">
      <h5 className="font-semibold">
        {provider?.name ?? 'Provider'} · current proposal v{proposal.version}
      </h5>
      <p className="mt-1 text-xs text-slate-500">
        {Math.round(proposal.confidence * 100)}% extraction confidence
      </p>
      <p className="mt-2 text-sm">{proposal.summary}</p>
      <dl className="mt-3 grid gap-1 text-xs sm:grid-cols-3">
        <div>
          <dt className="font-semibold">Price</dt>
          <dd>{term('price')}</dd>
        </div>
        <div>
          <dt className="font-semibold">Scope</dt>
          <dd>{term('scope')}</dd>
        </div>
        <div>
          <dt className="font-semibold">Timing</dt>
          <dd>
            {term('availability') !== 'Not supplied'
              ? term('availability')
              : term('timing')}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-amber-800 dark:text-amber-200">
        Caveat: confirm exclusions, scope, and availability directly against the
        retained evidence.{' '}
        {provider?.factLabels.length
          ? `Evidence on file: ${provider.factLabels.join(', ')}.`
          : 'No linked website fact is available yet.'}
      </p>
      <Button
        className="mt-3"
        onClick={() =>
          void confirmChoice({
            requestId,
            candidateId: proposal.candidateId,
            proposalId: proposal._id,
            proposalVersion: proposal.version,
          }).catch(() =>
            onError('This option changed; review the latest proposal.'),
          )
        }
        size="sm"
        variant="outline"
      >
        Confirm this current proposal
      </Button>
    </article>
  )
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}
