import { useState } from 'react'
import { displayEvidenceValue, safeEvidenceUrl } from './evidencePolicy'

export type EvidenceItem = {
  label: string
  sourceType: string
  value: unknown
  excerpt?: string
  sourceUrl?: string
  observedAt?: number
  confidence?: number
}

export function EvidenceDrawer({
  evidence,
}: {
  evidence: EvidenceItem | null
}) {
  const [open, setOpen] = useState(false)
  if (!evidence) return null
  const url = safeEvidenceUrl(evidence.sourceUrl)
  return (
    <aside className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-slate-900 dark:border-sky-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="font-semibold">Evidence: {evidence.label}</h4>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            {evidence.sourceType}
            {evidence.confidence !== undefined
              ? ` · ${Math.round(evidence.confidence * 100)}% confidence`
              : ''}
          </p>
        </div>
        <button
          className="rounded border border-sky-300 px-2 py-1 text-xs"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          {open ? 'Close' : 'Inspect'}
        </button>
      </div>
      {open ? (
        <div className="mt-3 space-y-2">
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded bg-white p-2 text-xs dark:bg-slate-900">
            {displayEvidenceValue(evidence.value)}
          </pre>
          {evidence.excerpt ? (
            <p className="rounded border-l-2 border-sky-400 pl-2 text-xs">
              {evidence.excerpt}
            </p>
          ) : (
            <p className="text-xs text-slate-500">
              No excerpt was retained for this evidence.
            </p>
          )}
          {url ? (
            <a
              className="text-xs underline"
              href={url}
              rel="noreferrer"
              target="_blank"
            >
              Open source page
            </a>
          ) : null}
          {evidence.observedAt ? (
            <p className="text-xs text-slate-500">
              Observed {new Date(evidence.observedAt).toLocaleString()}
            </p>
          ) : null}
        </div>
      ) : null}
    </aside>
  )
}
