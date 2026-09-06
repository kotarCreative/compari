import { useEffect, useState } from 'react'
import { ResearchLoader } from '~/components/common/ResearchLoader'

export const progressMessages = [
  'Saving your details securely.',
  'Creating your private buyer workspace.',
  'Preparing your first comparison.',
  'Getting everything ready for review.',
]

export const interpretationProgressMessages = [
  'Reading the details you shared.',
  'Organizing your requirements.',
  'Checking for important missing details.',
  'Preparing any follow-up questions.',
]

export const vendorSearchProgressMessages = [
  'Searching for matching vendors.',
  'Checking which vendors fit your requirements.',
  'Reviewing services and availability.',
  'Preparing the strongest matches for you.',
]

export function RotatingProgressText({
  messages = progressMessages,
}: {
  messages?: ReadonlyArray<string>
}) {
  const [messageIndex, setMessageIndex] = useState(0)

  useEffect(() => {
    setMessageIndex(0)
    const interval = window.setInterval(
      () => setMessageIndex((current) => (current + 1) % messages.length),
      4_000,
    )
    return () => window.clearInterval(interval)
  }, [messages])

  return (
    <p key={messageIndex} className="animate-onboarding-welcome min-h-6">
      {messages[messageIndex]}
    </p>
  )
}

export function OnboardingTransition({
  firstName,
  title = 'Preparing your comparison…',
}: {
  firstName?: string
  title?: string
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center p-8 text-center">
      <ResearchLoader />
      <div aria-live="polite" role="status">
        <p className="brand-wordmark">compari</p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">
          {firstName ? `${title}, ${firstName}` : title}
        </h1>
        <div className="mt-3 text-slate-600 dark:text-slate-300">
          <RotatingProgressText />
        </div>
        <div className="mt-6 flex justify-center gap-2" aria-hidden="true">
          <span className="animate-onboarding-dot h-2 w-2 rounded-full bg-sky-600" />
          <span className="animate-onboarding-dot h-2 w-2 rounded-full bg-sky-600 [animation-delay:140ms]" />
          <span className="animate-onboarding-dot h-2 w-2 rounded-full bg-sky-600 [animation-delay:280ms]" />
        </div>
      </div>
    </main>
  )
}
