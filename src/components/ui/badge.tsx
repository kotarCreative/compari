import type { ComponentProps } from 'react'
import { cn } from '~/lib/cn'

type BadgeVariant =
  'default' | 'success' | 'warning' | 'destructive' | 'outline'

const variants: Record<BadgeVariant, string> = {
  default: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
  success:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  destructive: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
  outline: 'border border-slate-300 dark:border-slate-700',
}

export function Badge({
  className,
  variant = 'default',
  ...props
}: ComponentProps<'span'> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}
