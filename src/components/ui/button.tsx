import type { ComponentProps } from 'react'
import { cn } from '~/lib/cn'

type ButtonVariant =
  'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
type ButtonSize = 'default' | 'sm' | 'lg' | 'icon'

const variants: Record<ButtonVariant, string> = {
  default:
    'border-2 border-slate-800 bg-sky-200 text-slate-950 shadow-[3px_3px_0_var(--color-slate-800)] hover:bg-sky-300',
  destructive:
    'bg-red-600 text-white shadow-sm hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600',
  outline:
    'border-2 border-slate-700 bg-white/60 shadow-[2px_2px_0_var(--color-slate-200)] hover:bg-slate-100',
  secondary:
    'bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
  ghost: 'hover:bg-slate-100 dark:hover:bg-slate-800',
  link: 'text-sky-700 underline-offset-4 hover:underline dark:text-sky-300',
}

const sizes: Record<ButtonSize, string> = {
  default: 'h-11 px-5 py-2',
  sm: 'h-9 rounded-xl px-3 text-xs',
  lg: 'h-12 rounded-xl px-8',
  icon: 'size-10',
}

export type ButtonProps = ComponentProps<'button'> & {
  variant?: ButtonVariant
  size?: ButtonSize
}

export function Button({
  className,
  variant = 'default',
  size = 'default',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-[transform,background-color,box-shadow] duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      type={type}
      {...props}
    />
  )
}
