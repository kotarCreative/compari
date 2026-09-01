import { useAction, useMutation } from 'convex/react'
import { useEffect, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { FunctionReference } from 'convex/server'
import { Alert, Button } from '~/components/ui'

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
    <Alert className="mt-4">
      <strong>Demo mode</strong> — deterministic fixtures only; no real provider
      is contacted.{' '}
      <Button
        className="ml-2 h-auto p-0"
        disabled={started}
        onClick={() => void start({}).then(() => setStarted(true))}
        variant="link"
      >
        {started ? 'Starting demo…' : 'Run printing demo'}
      </Button>
    </Alert>
  )
}
