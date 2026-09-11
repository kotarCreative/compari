import { useId } from 'react'
import type { RequestDetailValue } from '../contracts'

const stages = [
  { status: 'draft', label: 'Getting to know your request' },
  { status: 'researching', label: 'Finding your options' },
  { status: 'contacting', label: 'Reaching out to vendors' },
  { status: 'collecting_responses', label: 'Waiting for replies' },
  { status: 'evaluating', label: 'Comparing the details' },
  { status: 'awaiting_selection', label: 'Ready for your choice' },
  { status: 'completed', label: 'Your comparison is complete' },
]

export function AgentProgress({ detail }: { detail: RequestDetailValue }) {
  const headingId = useId()
  const summaryId = useId()
  const { request } = detail
  const counts = request.candidateCounts
  const stage = stages.findIndex(({ status }) => status === request.status)
  const cancelled = request.status === 'cancelled'
  const completed = request.status === 'completed'
  const paused = request.automationPaused && !completed && !cancelled
  const needsAnswer = detail.questions.some(
    (question) => question.status === 'open',
  )
  const empty =
    request.researchStatus === 'empty' && request.status === 'researching'
  const readyToContact =
    request.status === 'researching' &&
    request.rankingStatus === 'ready' &&
    !empty
  const title = cancelled
    ? 'Comparison cancelled'
    : completed
      ? 'Your comparison is complete'
      : paused
        ? 'Taking a little pause'
        : needsAnswer
          ? 'A quick detail from you'
          : empty
            ? 'No matching options yet'
            : readyToContact
              ? 'Your shortlist is ready'
              : (stages[stage]?.label ?? 'Waiting for an update')
  const summary = cancelled
    ? 'You can still review your options.'
    : completed
      ? 'Your choice is saved.'
      : paused
        ? 'Resume from Request details.'
        : needsAnswer
          ? 'Answer below to continue.'
          : empty
            ? 'No suitable providers found.'
            : readyToContact
              ? `${counts.discovered} found · follow up to confirm missing details.`
              : request.status === 'researching'
                ? `${counts.discovered} providers found so far.`
                : request.status === 'contacting' ||
                    request.status === 'collecting_responses'
                  ? `${counts.contacted} contacted · ${counts.responded} replied.`
                  : request.status === 'evaluating'
                    ? 'Reviewing prices, scope and availability.'
                    : request.status === 'awaiting_selection'
                      ? 'Review the quotes and choose an option.'
                      : 'Reading your request.'

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 id={headingId} className="text-2xl font-bold" aria-live="polite">
          {title}
        </h3>
        <span className="text-xs text-slate-500">
          {cancelled
            ? 'Stopped'
            : completed
              ? 'All done'
              : paused
                ? 'Paused'
                : 'Comparison progress'}
        </span>
      </div>
      <div
        role="progressbar"
        aria-labelledby={headingId}
        aria-describedby={summaryId}
        aria-valuemin={0}
        aria-valuemax={stages.length - 1}
        aria-valuenow={stage >= 0 ? stage : undefined}
        aria-valuetext={`${title}. Progress follows workflow stages, not elapsed time.`}
        className="h-3 overflow-hidden rounded-[5px_8px_6px_4px] bg-slate-200/70"
      >
        <div
          className={`h-full rounded-[4px_6px_3px_5px] transition-[width] duration-500 motion-reduce:transition-none ${paused || cancelled ? 'bg-slate-400' : completed ? 'bg-emerald-600' : 'bg-sky-400'}`}
          style={{
            width: `${(Math.max(stage, 0) / (stages.length - 1)) * 100}%`,
          }}
        />
      </div>
      <p id={summaryId} className="text-sm leading-6 text-slate-600">
        {summary}
      </p>
    </section>
  )
}
