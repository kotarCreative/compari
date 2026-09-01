import { useAuthActions } from '@convex-dev/auth/react'
import { useState } from 'react'
import { pendingFirstRequestKey, requestPromptPlaceholder } from './constants'
import type { FormEvent } from 'react'
import { Button, Label, Textarea } from '~/components/ui'

export function FirstSearch() {
  const { signIn } = useAuthActions()
  const [prompt, setPrompt] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsStarting(true)
    try {
      window.sessionStorage.setItem(pendingFirstRequestKey, prompt.trim())
      const result = await signIn('anonymous')
      if (!result.signingIn)
        throw new Error('Anonymous sign-in did not establish a session.')
    } catch {
      setError('We could not create your private workspace. Please try again.')
    } finally {
      setIsStarting(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-8 p-8">
      <p className="text-sm font-semibold tracking-[0.22em] text-sky-600">
        COMPARI
      </p>
      <div className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">
          Procurement research, with you in control.
        </h1>
        <p className="max-w-xl text-lg text-slate-600 dark:text-slate-300">
          Describe what you need. Your first search creates a private workspace
          that stays on this device.
        </p>
      </div>
      <form className="space-y-3" onSubmit={(event) => void submit(event)}>
        <Label htmlFor="first-request-prompt">What are you looking for?</Label>
        <Textarea
          className="min-h-32"
          id="first-request-prompt"
          minLength={12}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder={requestPromptPlaceholder}
          required
          value={prompt}
        />
        <Button
          disabled={isStarting || prompt.trim().length < 12}
          size="lg"
          type="submit"
        >
          {isStarting ? 'Creating your workspace…' : 'Start comparison'}
        </Button>
        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : null}
      </form>
    </main>
  )
}
