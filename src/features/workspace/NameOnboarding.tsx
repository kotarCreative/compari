import { useMutation } from 'convex/react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import {
  minimumOnboardingDurationMs,
  onboardingStartedAtKey,
  pendingFirstNameKey,
  pendingFirstRequestKey,
  pendingLastNameKey,
  splitFullName,
} from './constants'
import { OnboardingTransition } from './OnboardingTransition'
import { RequestConversation } from './RequestConversation'
import type { Profile } from './contracts'
import { Button, Input, Label } from '~/components/ui'

export function NameOnboarding({ profile }: { profile: Profile }) {
  const completeProfile = useMutation(api.users.completeMyProfile)
  const [fullName, setFullName] = useState(profile.name ?? '')
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<'checking' | 'saving' | 'ready'>(
    'checking',
  )
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null)
  const didAutoComplete = useRef(false)

  useEffect(() => {
    setPendingPrompt(sessionStorage.getItem(pendingFirstRequestKey))
    const firstName = sessionStorage.getItem(pendingFirstNameKey)
    const lastName = sessionStorage.getItem(pendingLastNameKey)

    if (!firstName || !lastName) {
      didAutoComplete.current = true
      setPhase('ready')
      return
    }

    setFullName(`${firstName} ${lastName}`)
    setPhase('saving')

    const storedStartedAt = sessionStorage.getItem(onboardingStartedAtKey)
    const startedAt =
      storedStartedAt === null ? Number.NaN : Number(storedStartedAt)
    const elapsed = Number.isFinite(startedAt) ? Date.now() - startedAt : 0
    const remaining = Math.max(0, minimumOnboardingDurationMs - elapsed)
    const timeout = window.setTimeout(() => {
      if (didAutoComplete.current) return
      didAutoComplete.current = true
      void completeProfile({ firstName, lastName })
        .then(() => {
          sessionStorage.removeItem(pendingFirstNameKey)
          sessionStorage.removeItem(pendingLastNameKey)
          sessionStorage.removeItem(onboardingStartedAtKey)
        })
        .catch((reason: unknown) => {
          sessionStorage.removeItem(onboardingStartedAtKey)
          setError(
            reason instanceof Error
              ? reason.message
              : 'We could not save your name. Please try again.',
          )
          setPhase('ready')
        })
    }, remaining)

    return () => window.clearTimeout(timeout)
  }, [completeProfile])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = splitFullName(fullName)

    if (!name) {
      setError('Enter your first and last name, separated by a space.')
      return
    }

    setError(null)
    setPhase('saving')

    try {
      await completeProfile(name)
      sessionStorage.removeItem(pendingFirstNameKey)
      sessionStorage.removeItem(pendingLastNameKey)
      sessionStorage.removeItem(onboardingStartedAtKey)
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'We could not save your name. Please try again.',
      )
      setPhase('ready')
    }
  }

  if (phase !== 'ready') {
    if (pendingPrompt)
      return (
        <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center p-8">
          <p className="mb-10 text-sm font-semibold tracking-[0.22em] text-sky-600">
            COMPARI
          </p>
          <RequestConversation
            loaderPhase="interpreting"
            prompt={pendingPrompt}
          />
        </main>
      )
    return (
      <OnboardingTransition
        firstName={splitFullName(fullName)?.firstName}
        title={phase === 'checking' ? 'Continuing your setup' : 'Almost ready'}
      />
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <section className="w-full max-w-md space-y-8 text-center">
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">
            One quick introduction
          </p>
          <h1 className="text-4xl font-semibold tracking-tight">
            What should we call you?
          </h1>
          <p className="text-muted-foreground">
            Compari uses your name when contacting vendors on your behalf, so
            they know who they are helping.
          </p>
        </div>

        <form className="space-y-4 text-left" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="full-name">First and last name</Label>
            <Input
              id="full-name"
              autoComplete="name"
              autoFocus
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Jane Smith"
              value={fullName}
            />
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <Button className="w-full" type="submit">
            Continue
          </Button>
        </form>
      </section>
    </main>
  )
}
