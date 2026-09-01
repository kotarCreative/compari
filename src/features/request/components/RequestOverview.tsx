import type { RequestDetailValue, RequestDiagnostics } from '../contracts'
import { StatusBadge } from '~/components/common/StatusBadge'
import { Alert, Button } from '~/components/ui'

export function WorkflowNotice({
  diagnostics,
  isRetrying,
  onRetry,
}: {
  diagnostics: RequestDiagnostics | undefined
  isRetrying: boolean
  onRetry: () => void
}) {
  const failedIntake = diagnostics?.jobs.find(
    (job) =>
      job.kind === 'extract_requirements' &&
      (job.status === 'permanent_failure' || job.status === 'needs_user'),
  )
  if (!failedIntake) return null
  return (
    <Alert aria-live="polite" className="p-4" variant="warning">
      <h3 className="font-semibold">Request interpretation needs attention</h3>
      <p className="mt-1 text-sm">
        {failedIntake.lastErrorSummary ??
          'Compari could not interpret this request.'}
      </p>
      <Button
        className="mt-3 border-amber-500"
        disabled={isRetrying}
        onClick={onRetry}
        size="sm"
        variant="outline"
      >
        {isRetrying ? 'Retrying interpretation…' : 'Retry interpretation'}
      </Button>
    </Alert>
  )
}

export function ResearchSummary({ detail }: { detail: RequestDetailValue }) {
  const counts = detail.request.candidateCounts
  const stages = [
    { key: 'draft', label: 'Interpret' },
    { key: 'researching', label: 'Research' },
    { key: 'contacting', label: 'Contact' },
    { key: 'collecting_responses', label: 'Responses' },
    { key: 'evaluating', label: 'Compare' },
    { key: 'awaiting_selection', label: 'Choose' },
    { key: 'completed', label: 'Complete' },
  ]
  const activeStage = stages.findIndex(
    (stage) => stage.key === detail.request.status,
  )
  const message =
    detail.request.researchStatus === 'empty'
      ? 'No viable providers yet. Edit the request details or resume automation to recover.'
      : detail.request.automationPaused
        ? 'Automation is paused; inbound messages remain visible.'
        : 'Research and contact progress updates here in realtime.'

  return (
    <section className="rounded-lg bg-slate-50 p-4 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Live comparison progress</h3>
        <StatusBadge status={detail.request.status} />
      </div>
      <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {stages.map((stage, index) => {
          const reached = activeStage >= index
          return (
            <li
              className={
                reached
                  ? 'rounded-md bg-sky-100 px-2 py-2 text-center text-xs font-medium text-sky-900 dark:bg-sky-950 dark:text-sky-100'
                  : 'rounded-md bg-slate-200 px-2 py-2 text-center text-xs text-slate-500 dark:bg-slate-800'
              }
              key={stage.key}
            >
              {stage.label}
            </li>
          )
        })}
      </ol>
      <p className="mt-1 text-sm">
        {counts.discovered} discovered · {counts.researching} researching ·{' '}
        {counts.qualified} qualified · {counts.rejected} rejected ·{' '}
        {counts.queuedForContact} queued · {counts.contacted} contacted ·{' '}
        {counts.responded} responded
      </p>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        {message}
      </p>
    </section>
  )
}
