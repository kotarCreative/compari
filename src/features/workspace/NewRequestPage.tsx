import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { FirstRequestOnboarding } from './FirstRequestOnboarding'
import { LocationPill } from './LocationPill'
import { requestPromptPlaceholder } from './constants'
import type { Profile } from './contracts'
import { BrandLogo } from '~/components/common/BrandLogo'
import { Button, Label, Textarea } from '~/components/ui'

export function NewRequestPage({ profile }: { profile: Profile }) {
  const navigate = useNavigate()
  const [prompt, setPrompt] = useState('')
  const [startedPrompt, setStartedPrompt] = useState<string | null>(null)

  if (startedPrompt)
    return (
      <FirstRequestOnboarding
        location={profile.location}
        onComplete={() => void navigate({ to: '/' })}
        prompt={startedPrompt}
      />
    )

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-10 sm:px-8 sm:py-16">
      <div className="flex items-center justify-between gap-4">
        <BrandLogo />
        <Link
          className="marker-button font-hand text-xl font-bold text-slate-700"
          to="/"
        >
          Back to requests
        </Link>
      </div>
      <section className="mt-16 space-y-8">
        <div className="space-y-2">
          <p className="text-sm text-slate-500">A fresh page, a fresh wish.</p>
          <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
            What are you looking for?
          </h1>
          <p className="max-w-xl text-slate-600">
            Tell us what you need. Compari will ask a few follow-up questions
            before it starts researching options.
          </p>
        </div>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            const nextPrompt = prompt.trim()
            if (nextPrompt.length >= 12) setStartedPrompt(nextPrompt)
          }}
        >
          <Label htmlFor="new-request-prompt">Your request</Label>
          <Textarea
            autoFocus
            className="min-h-32"
            id="new-request-prompt"
            minLength={12}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={requestPromptPlaceholder}
            required
            value={prompt}
          />
          <LocationPill location={profile.location} />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Press <kbd className="font-sans">⌘/Ctrl</kbd> +{' '}
              <kbd className="font-sans">Enter</kbd> to begin.
            </p>
            <Button disabled={prompt.trim().length < 12} type="submit">
              Start chat <span aria-hidden="true">→</span>
            </Button>
          </div>
        </form>
      </section>
    </main>
  )
}
