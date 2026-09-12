import { useAuthActions } from '@convex-dev/auth/react'
import { useState } from 'react'
import {
  onboardingStartedAtKey,
  pendingFirstNameKey,
  pendingFirstRequestKey,
  pendingLastNameKey,
  requestPromptPlaceholder,
  splitFullName,
} from './constants'
import { RequestConversation } from './RequestConversation'
import type { FormEvent } from 'react'
import { BrandLogo } from '~/components/common/BrandLogo'
import { Button, Input, Label, Textarea } from '~/components/ui'

export function FirstSearch({
  isSessionLoading = false,
}: {
  isSessionLoading?: boolean
}) {
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
      window.sessionStorage.setItem(onboardingStartedAtKey, String(Date.now()))
      window.sessionStorage.setItem(pendingFirstRequestKey, prompt.trim())
      window.sessionStorage.setItem(pendingFirstNameKey, name.firstName)
      window.sessionStorage.setItem(pendingLastNameKey, name.lastName)
      const result = await signIn('anonymous')
      if (!result.signingIn)
        throw new Error('Anonymous sign-in did not establish a session.')
    } catch {
      setError('We could not create your private workspace. Please try again.')
      setIsStarting(false)
      window.sessionStorage.removeItem(onboardingStartedAtKey)
    }
  }

  const parsedName = splitFullName(fullName)

  if (isStarting) {
    return (
      <main className="welcome-shell mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-12">
        <BrandLogo className="mb-10" />
        <RequestConversation
          loaderPhase="interpreting"
          prompt={prompt.trim()}
        />
      </main>
    )
  }

  return (
    <main className="welcome-shell mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-12">
      <header className="welcome-brand-row">
        <BrandLogo />
        <span className="welcome-tagline">
          Your personal research companion
        </span>
      </header>
      <div
        className="welcome-steps mt-8 flex items-center gap-3 text-xs font-medium text-slate-500"
        aria-label={`Step ${step === 'name' ? '1' : '2'} of 2`}
      >
        <span className="step-pill" data-active={step === 'name'}>
          1 · Say hello
        </span>
        <span aria-hidden="true">→</span>
        <span className="step-pill" data-active={step === 'request'}>
          2 · Make a wish
        </span>
      </div>
      {step === 'name' ? (
        <section className="welcome-page animate-onboarding-welcome mt-6 space-y-8">
          <div className="flex items-center justify-center gap-3 text-center">
            <div className="space-y-3">
              <p className="welcome-eyebrow">LESS SEARCHING. MORE CERTAINTY.</p>
              <h1 className="welcome-heading text-5xl sm:text-6xl">
                Big decisions.
                <br />
                <span className="text-sky-700 dark:text-sky-300">
                  A little less work.
                </span>
              </h1>
              <p className="mx-auto max-w-md text-base leading-7 text-slate-600 dark:text-slate-300">
                Meet your new research buddy. Tell us what you need, and we’ll
                help you find and compare the right vendors.
              </p>
            </div>
          </div>
          <form
            className="welcome-form notebook-form space-y-3"
            onSubmit={acceptName}
          >
            <div className="mb-5">
              <h2 className="text-lg font-semibold">
                First, a quick introduction.
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Let’s make this a little more personal.
              </p>
            </div>
            <Label htmlFor="profile-full-name">First and last name</Label>
            <Input
              autoComplete="name"
              className="text-2xl"
              autoFocus
              id="profile-full-name"
              maxLength={60}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Jane Smith"
              required
              value={fullName}
            />
            <p className="text-xs leading-5 text-slate-500">
              We use your name for your buyer inbox and to sign vendor outreach.
            </p>
            <Button
              className="mt-3 w-full"
              size="lg"
              type="submit"
              disabled={isSessionLoading}
            >
              Let’s get started <span aria-hidden="true">→</span>
            </Button>
            {error ? (
              <p
                role="alert"
                className="text-sm text-red-600 dark:text-red-400"
              >
                {error}
              </p>
            ) : null}
          </form>
        </section>
      ) : (
        <section className="welcome-page mt-6 space-y-8">
          <div className="animate-onboarding-welcome space-y-2 text-center">
            <p className="text-sm text-slate-500">Nice to meet you.</p>
            <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
              Welcome, {parsedName?.firstName}.
            </h1>
          </div>
          <form
            className="welcome-form notebook-form animate-onboarding-request space-y-4"
            onSubmit={(event) => void submitRequest(event)}
          >
            <div className="space-y-3">
              <Label className="block" htmlFor="first-request-prompt">
                What can we help you find?
              </Label>
              <Textarea
                autoFocus
                className="min-h-32 text-2xl"
                id="first-request-prompt"
                minLength={12}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === 'Enter' &&
                    (event.metaKey || event.ctrlKey)
                  ) {
                    event.preventDefault()
                    event.currentTarget.form?.requestSubmit()
                  }
                }}
                placeholder={requestPromptPlaceholder}
                required
                value={prompt}
              />
            </div>
            <div
              className="flex flex-col items-start gap-1"
              aria-label="Example requests"
            >
              {[
                'Find a wedding photographer in Calgary',
                'Compare office cleaning services for a small team',
                'Find a caterer for a 30-person birthday party',
              ].map((example) => (
                <button
                  className="suggestion-chip"
                  key={example}
                  onClick={() => setPrompt(example)}
                  type="button"
                >
                  {example}
                </button>
              ))}
            </div>
            <Button
              className="mt-2"
              disabled={prompt.trim().length < 12}
              size="lg"
              type="submit"
            >
              Find my options <span aria-hidden="true">↗</span>
            </Button>
            <button
              className="block min-h-11 marker-button font-hand text-2xl font-bold text-slate-600 px-2"
              onClick={() => setStep('name')}
              type="button"
            >
              Edit your name
            </button>
            <p className="text-xs text-slate-500">
              Press <kbd className="font-sans">⌘/Ctrl</kbd> +{' '}
              <kbd className="font-sans">Enter</kbd> to start searching for
              vendors.
            </p>
            {error ? (
              <p
                role="alert"
                className="text-sm text-red-600 dark:text-red-400"
              >
                {error}
              </p>
            ) : null}
          </form>
        </section>
      )}
      <footer className="welcome-footer">
        <span>
          01 <span>Tell us what you need</span>
        </span>
        <span>
          02 <span>We do the research</span>
        </span>
        <span>
          03 <span>You make the call</span>
        </span>
      </footer>
    </main>
  )
}
