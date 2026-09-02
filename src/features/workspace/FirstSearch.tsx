import { useAuthActions } from '@convex-dev/auth/react'
import { useState } from 'react'
import {
  pendingFirstNameKey,
  pendingFirstRequestKey,
  pendingLastNameKey,
  requestPromptPlaceholder,
  splitFullName,
} from './constants'
import { OnboardingTransition } from './OnboardingTransition'
import type { FormEvent } from 'react'
import { Button, Input, Label, Textarea } from '~/components/ui'

export function FirstSearch() {
  const { signIn } = useAuthActions()
  const [fullName, setFullName] = useState('')
  const [step, setStep] = useState<'name' | 'request'>('name')
  const [prompt, setPrompt] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)

  function acceptName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (!splitFullName(fullName)) {
      setError('Enter your first and last name, separated by a space.')
      return
    }
    setStep('request')
  }

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const name = splitFullName(fullName)
    if (!name) {
      setStep('name')
      setError('Enter your first and last name, separated by a space.')
      return
    }
    setIsStarting(true)
    try {
      window.sessionStorage.setItem(pendingFirstRequestKey, prompt.trim())
      window.sessionStorage.setItem(pendingFirstNameKey, name.firstName)
      window.sessionStorage.setItem(pendingLastNameKey, name.lastName)
      const result = await signIn('anonymous')
      if (!result.signingIn)
        throw new Error('Anonymous sign-in did not establish a session.')
    } catch {
      setError('We could not create your private workspace. Please try again.')
    } finally {
      setIsStarting(false)
    }
  }

  const parsedName = splitFullName(fullName)

  if (isStarting) {
    return (
      <OnboardingTransition
        firstName={parsedName?.firstName}
        title="Creating your workspace"
      />
    )
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center p-8">
      <p className="text-sm font-semibold tracking-[0.22em] text-sky-600">
        COMPARI
      </p>
      {step === 'name' ? (
        <section className="mt-10 space-y-6">
          <div className="space-y-3">
            <h1 className="text-4xl font-bold tracking-tight">
              Let’s start with your name.
            </h1>
            <p className="max-w-xl text-slate-600 dark:text-slate-300">
              Compari uses it for your buyer inbox and signs vendor outreach so
              businesses know who they are responding to.
            </p>
          </div>
          <form className="space-y-3" onSubmit={acceptName}>
            <Label htmlFor="profile-full-name">First and last name</Label>
            <Input
              autoComplete="name"
              autoFocus
              id="profile-full-name"
              maxLength={60}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Jane Smith"
              required
              value={fullName}
            />
            <p className="text-xs text-slate-500">Press Enter to continue.</p>
            {error ? (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            ) : null}
          </form>
        </section>
      ) : (
        <section className="mt-10 space-y-8">
          <div className="animate-onboarding-welcome space-y-2">
            <p className="text-sm text-slate-500">Nice to meet you.</p>
            <h1 className="text-4xl font-bold tracking-tight">
              Welcome, {parsedName?.firstName}.
            </h1>
          </div>
          <form
            className="animate-onboarding-request space-y-3"
            onSubmit={(event) => void submitRequest(event)}
          >
            <Label htmlFor="first-request-prompt">
              What would you like to compare?
            </Label>
            <Textarea
              autoFocus
              className="min-h-32"
              id="first-request-prompt"
              minLength={12}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={requestPromptPlaceholder}
              required
              value={prompt}
            />
            <div className="flex flex-wrap gap-3">
              <Button
                disabled={prompt.trim().length < 12}
                size="lg"
                type="submit"
              >
                Start comparison
              </Button>
              <Button
                onClick={() => {
                  setError(null)
                  setStep('name')
                }}
                type="button"
                variant="outline"
              >
                Change name
              </Button>
            </div>
            {error ? (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            ) : null}
          </form>
        </section>
      )}
    </main>
  )
}
