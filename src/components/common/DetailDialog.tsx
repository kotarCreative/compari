import { useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { Button } from '~/components/ui'

export function DetailDialog({
  label,
  title = label,
  children,
}: {
  label: string
  title?: string
  children: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  return (
    <>
      <Button
        aria-haspopup="dialog"
        onClick={() => dialog.current?.showModal()}
        size="sm"
        variant="outline"
      >
        {label}
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="m-auto max-h-[85dvh] w-[min(42rem,calc(100%-2rem))] overflow-y-auto rounded-xl border border-slate-300 bg-[#fffdf7] p-5 text-slate-800 shadow-xl backdrop:bg-slate-900/40 sm:p-7"
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 id={titleId} className="text-xl font-bold">
            {title}
          </h2>
          <Button
            autoFocus
            onClick={() => dialog.current?.close()}
            size="sm"
            variant="ghost"
          >
            Close
          </Button>
        </div>
        {children}
      </dialog>
    </>
  )
}
