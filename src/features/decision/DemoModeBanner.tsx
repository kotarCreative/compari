import { useAction, useMutation } from 'convex/react'
import { useEffect, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { FunctionReference } from 'convex/server'

const demoApi = api as unknown as {
  demoActions: {
    mode: FunctionReference<'action', 'public', Record<string, never>, boolean>
  }
  demo: {
    start: FunctionReference<'mutation', 'public', Record<string, never>, null>
  }
}
export function DemoModeBanner() {
  const mode = useAction(demoApi.demoActions.mode)
  const start = useMutation(demoApi.demo.start)
  const [enabled, setEnabled] = useState(false)
  const [started, setStarted] = useState(false)
  useEffect(() => {
    void mode({})
      .then(setEnabled)
      .catch(() => setEnabled(false))
  }, [mode])
  if (!enabled) return null
  return (
    <aside className="mt-4 rounded border border-sky-300 bg-sky-50 p-3 text-sm text-sky-950">
      <strong>Demo mode</strong> — deterministic fixtures only; no real provider
      is contacted.{' '}
      <button
        className="ml-2 underline"
        disabled={started}
        onClick={() => void start({}).then(() => setStarted(true))}
        type="button"
      >
        {started ? 'Starting demo…' : 'Run printing demo'}
      </button>
    </aside>
  )
}
