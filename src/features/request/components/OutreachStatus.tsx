import { useState } from 'react'
import type { RequestDetailValue } from '../contracts'
import { Button } from '~/components/ui'
import { errorMessage } from '~/lib/errors'

const states: Record<
  string,
  { label: string; note: string; mark: string; tone: string }
> = {
  pending: {
    label: 'Queued up',
    note: 'Ready to send when the agents pick it up.',
    mark: '…',
    tone: 'bg-slate-100 text-slate-600',
  },
  running: {
    label: 'On its way',
    note: 'We’re sending your note to this vendor.',
    mark: '↗',
    tone: 'bg-sky-100 text-sky-800',
  },
  succeeded: {
    label: 'Sent',
    note: 'Your note was sent successfully.',
    mark: '✓',
    tone: 'bg-emerald-100/70 text-emerald-800',
  },
  retryable_failure: {
    label: 'Needs another try',
    note: 'We couldn’t send this note. You can try again below.',
    mark: '!',
    tone: 'bg-amber-100 text-amber-900',
  },
  permanent_failure: {
    label: 'Couldn’t send',
    note: 'This contact attempt could not be completed.',
    mark: '!',
    tone: 'bg-rose-100/70 text-rose-800',
  },
  needs_user: {
    label: 'Needs your attention',
    note: 'Review the contact details before continuing.',
    mark: '!',
    tone: 'bg-amber-100 text-amber-900',
  },
}

export function OutreachStatus({
  detail,
  compact = false,
  onError,
  retryFailed,
}: {
  compact?: boolean
  detail: RequestDetailValue
  onError: (value: string | null) => void
  retryFailed: (args: { attemptId: string }) => Promise<unknown>
}) {
  const [retryingIds, setRetryingIds] = useState<Array<string>>([])
  if (!detail.outreach.length) return null
  const sent = detail.outreach.filter(
    (attempt) => attempt.status === 'succeeded',
  ).length
  const pending = detail.outreach.filter((attempt) =>
    ['pending', 'running'].includes(attempt.status),
  ).length
  const attention = detail.outreach.filter((attempt) =>
    ['retryable_failure', 'permanent_failure', 'needs_user'].includes(
      attempt.status,
    ),
  ).length

  async function retry(attemptId: string) {
    onError(null)
    setRetryingIds((current) => [...current, attemptId])
    try {
      await retryFailed({ attemptId })
    } catch (reason) {
      onError(errorMessage(reason, 'Could not retry outreach.'))
    } finally {
      setRetryingIds((current) => current.filter((id) => id !== attemptId))
    }
  }

  return (
    <section
      className={compact ? 'mt-4 space-y-3' : 'mt-10 space-y-6'}
      aria-label="Outreach status"
    >
      {!compact ? (
        <header className="flex items-start gap-3">
          <svg
            aria-hidden="true"
            className="mt-1 size-10 shrink-0 text-sky-700"
            viewBox="0 0 40 40"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m4 11 31-2 2 23-31 1zM5 12l16 12L35 10M7 31l9-11m19 10-10-9" />
          </svg>
          <div>
            <h3 className="text-3xl font-bold">Notes to your vendors</h3>
            <p
              className="mt-1 text-sm leading-6 text-slate-600"
              aria-live="polite"
            >
              {sent} sent · {pending} in progress
              {attention ? ` · ${attention} need attention` : ''}
            </p>
          </div>
        </header>
      ) : null}
      <ul className="space-y-6">
        {detail.outreach.map((attempt) => {
          const candidate = detail.candidates.find(
            (item) => item._id === attempt.candidateId,
          )
          const state = states[attempt.status] ?? {
            label: 'Update pending',
            note: 'We’re waiting for the latest contact status.',
            mark: '…',
            tone: 'bg-slate-100 text-slate-600',
          }
          const retryable =
            attempt.status === 'retryable_failure' ||
            (attempt.status === 'needs_user' &&
              attempt.safeError?.includes('Idempotency-Key') === true &&
              attempt.safeError.includes('invalid_format'))
          const retrying = retryingIds.includes(attempt._id)
          return (
            <li key={attempt._id} className="flex items-start gap-3 sm:gap-4">
              <span
                aria-hidden="true"
                className={`inline-grid size-9 shrink-0 place-items-center rounded-[45%_52%_43%_49%] font-hand text-2xl font-bold ${state.tone}`}
              >
                {state.mark}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h4 className="font-semibold text-slate-800 [overflow-wrap:anywhere]">
                    {candidate?.name ?? 'Vendor'}
                  </h4>
                  <span className="font-hand text-xl font-semibold text-slate-600">
                    {state.label}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {state.note}
                </p>
                {attempt.contentSummary || attempt.safeError ? (
                  <details className="mt-2 text-sm text-slate-500">
                    <summary className="w-fit cursor-pointer rounded-sm py-1 focus-visible:outline-sky-700">
                      {attempt.safeError
                        ? 'What happened'
                        : 'View note details'}
                    </summary>
                    {attempt.contentSummary ? (
                      <p className="mt-2 leading-6">{attempt.contentSummary}</p>
                    ) : null}
                    {attempt.safeError ? (
                      <p className="mt-2 leading-6 text-red-700">
                        {attempt.safeError}
                      </p>
                    ) : null}
                  </details>
                ) : null}
                {retryable ? (
                  <Button
                    className="mt-2"
                    disabled={retrying}
                    onClick={() => void retry(attempt._id)}
                    size="sm"
                  >
                    {retrying ? 'Trying again…' : 'Try sending again'}{' '}
                    <span aria-hidden="true">↗</span>
                  </Button>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
