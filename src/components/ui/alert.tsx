import type { ComponentProps } from 'react'
import { cn } from '~/lib/cn'

type AlertVariant = 'default' | 'warning' | 'destructive'

const variants: Record<AlertVariant, string> = {
  default:
    'border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-100',
  warning:
    'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100',
  destructive:
    'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-100',
}

export function Alert({
  className,
  variant = 'default',
  ...props
}: ComponentProps<'div'> & { variant?: AlertVariant }) {
  return (
    <div
      className={cn(
        'rounded-lg border p-3 text-sm',
        variants[variant],
        className,
      )}
      role="alert"
      {...props}
    />
  )
}

export function AlertTitle({ className, ...props }: ComponentProps<'h4'>) {
  return <h4 className={cn('font-semibold', className)} {...props} />
}

export function AlertDescription({
  className,
  ...props
}: ComponentProps<'div'>) {
  return <div className={cn('mt-1 text-sm', className)} {...props} />
}
