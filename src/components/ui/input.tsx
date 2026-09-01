import type { ComponentProps } from 'react'
import { cn } from '~/lib/cn'

export function Input({
  className,
  type = 'text',
  ...props
}: ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700',
        className,
      )}
      type={type}
      {...props}
    />
  )
}
