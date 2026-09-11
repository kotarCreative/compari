import { useEffect, useRef } from 'react'
import {
  RotatingProgressText,
  interpretationProgressMessages,
  vendorSearchProgressMessages,
} from './OnboardingTransition'
import { LocationPill } from './LocationPill'
import type { FormEvent } from 'react'
import { ResearchLoader } from '~/components/common/ResearchLoader'
import { Button, Label, Textarea } from '~/components/ui'

export function RequestConversation({
  prompt,
  collapseHistory = false,
  history = [],
  question,
  answer = '',
  error,
  isAnswering = false,
  loaderPhase,
  onAnswerChange,
  onAnswerSubmit,
  location,
  canEditLocation = false,
}: {
  prompt: string
  collapseHistory?: boolean
  history?: Array<{
    id: string
    text: string
    importance: string
    answer: string
  }>
  question?: { _id?: string; text: string; importance: string }
  answer?: string
  error?: string | null
  isAnswering?: boolean
  loaderPhase?: 'interpreting' | 'vendors'
  onAnswerChange?: (value: string) => void
  onAnswerSubmit?: (event: FormEvent<HTMLFormElement>) => void
  location?: string
  canEditLocation?: boolean
}) {
  const answerInput = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!question) return
    answerInput.current?.focus()
  }, [question?._id])

  const previousMessages = (
    <>
      <div className="flex justify-end">
        <p className="max-w-[88%] whitespace-pre-wrap bg-sky-100/40 px-4 py-3 text-sm leading-6 text-slate-800">
          {prompt}
        </p>
      </div>
      {history.map((item) => (
        <div className="space-y-3" key={item.id}>
          <QuestionBubble question={item} />
          <div className="flex justify-end">
            <p className="max-w-[88%] whitespace-pre-wrap bg-sky-100/40 px-4 py-3 text-sm leading-6 text-slate-800">
              {item.answer}
            </p>
          </div>
        </div>
      ))}
    </>
  )
  return (
    <section className="mx-auto w-full max-w-2xl space-y-4">
      {collapseHistory ? (
        <details className="text-sm">
          <summary className="cursor-pointer py-2 font-semibold">
            Request & previous answers
          </summary>
          <div className="space-y-3">{previousMessages}</div>
        </details>
      ) : (
        previousMessages
      )}

      {question ? (
        <div className="space-y-3">
          <QuestionBubble question={question} />
          <form className="space-y-2" onSubmit={onAnswerSubmit}>
            <Label className="sr-only" htmlFor="request-conversation-answer">
              Your answer
            </Label>
            <Textarea
              autoFocus
              className="min-h-24"
              disabled={isAnswering}
              id="request-conversation-answer"
              ref={answerInput}
              onChange={(event) => onAnswerChange?.(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault()
                  event.currentTarget.form?.requestSubmit()
                }
              }}
              placeholder="Type your answer here…"
              required
              value={answer}
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                Press <kbd className="font-sans">⌘/Ctrl</kbd> +{' '}
                <kbd className="font-sans">Enter</kbd> to answer.
              </p>
              <Button
                disabled={isAnswering || !answer.trim()}
                size="sm"
                type="submit"
              >
                {isAnswering ? 'Saving…' : 'Answer'}
              </Button>
            </div>
          </form>
        </div>
      ) : loaderPhase ? (
        <div className="animate-onboarding-welcome pl-5 py-2">
          <ResearchLoader />
          <div
            aria-live="polite"
            className="space-y-1 pl-1 text-sm text-slate-600 dark:text-slate-300"
            role="status"
          >
            <p className="font-medium text-slate-900 dark:text-slate-100">
              {loaderPhase === 'interpreting'
                ? 'Interpreting your request…'
                : 'Looking for vendors…'}
            </p>
            <RotatingProgressText
              messages={
                loaderPhase === 'interpreting'
                  ? interpretationProgressMessages
                  : vendorSearchProgressMessages
              }
            />
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">
            Your results and any follow-up questions will appear here.
          </p>
        </div>
      ) : (
        <p
          aria-live="polite"
          className="pl-1 text-sm text-slate-600 dark:text-slate-300"
          role="status"
        >
          Thanks — Compari is continuing the vendor search with these details.
        </p>
      )}

      {canEditLocation ? <LocationPill location={location} /> : null}

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  )
}

function QuestionBubble({
  question,
}: {
  question: { text: string; importance: string }
}) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[88%] px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
          {question.importance === 'required'
            ? 'One detail needed'
            : 'One helpful detail'}
        </p>
        <p className="mt-1 text-sm leading-6">{question.text}</p>
      </div>
    </div>
  )
}
