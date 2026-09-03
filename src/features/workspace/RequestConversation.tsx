import { useEffect, useRef } from 'react'
import {
  RotatingProgressText,
  interpretationProgressMessages,
  vendorSearchProgressMessages,
} from './OnboardingTransition'
import type { FormEvent } from 'react'
import { Button, Label, Textarea } from '~/components/ui'

export function RequestConversation({
  prompt,
  history = [],
  question,
  answer = '',
  error,
  isAnswering = false,
  loaderPhase,
  onAnswerChange,
  onAnswerSubmit,
}: {
  prompt: string
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
}) {
  const answerInput = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!question) return
    answerInput.current?.focus()
  }, [question?._id])

  return (
    <section className="mx-auto w-full max-w-2xl space-y-4">
      <div className="flex justify-end">
        <p className="max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-sky-600 px-4 py-3 text-sm leading-6 text-white shadow-sm">
          {prompt}
        </p>
      </div>

      {history.map((item) => (
        <div className="space-y-3" key={item.id}>
          <QuestionBubble question={item} />
          <div className="flex justify-end">
            <p className="max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-sky-600 px-4 py-3 text-sm leading-6 text-white shadow-sm">
              {item.answer}
            </p>
          </div>
        </div>
      ))}

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
        <div className="space-y-3">
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
          <Label className="sr-only" htmlFor="request-conversation-answer">
            Follow-up answer
          </Label>
          <Textarea
            className="min-h-24"
            disabled
            id="request-conversation-answer"
            placeholder={
              loaderPhase === 'interpreting'
                ? 'Any questions about your request will appear here…'
                : 'Compari is searching with the details above…'
            }
          />
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
      <div className="max-w-[88%] rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
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
