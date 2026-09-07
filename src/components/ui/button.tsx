import type { ComponentProps } from 'react'
import { cn } from '~/lib/cn'

type ButtonVariant =
  'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
type ButtonSize = 'default' | 'sm' | 'lg' | 'icon'

const variants: Record<ButtonVariant, string> = {
  default: 'text-slate-900',
  destructive: 'text-red-700 [--button-highlight:var(--color-red-100)]',
  outline: 'text-slate-700',
  secondary: 'text-slate-700',
  ghost: 'text-slate-600',
  link: 'text-sky-800',
}

const sizes: Record<ButtonSize, string> = {
  default: 'min-h-12 px-3 py-2 text-2xl',
  sm: 'min-h-11 px-2.5 py-1.5 text-xl',
  lg: 'min-h-14 px-4 py-2 text-3xl',
  icon: 'size-12 text-2xl',
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
        'marker-button inline-flex items-center justify-center gap-2.5 border-0 bg-transparent font-hand font-bold leading-tight shadow-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-700 disabled:cursor-not-allowed disabled:opacity-45',
        variants[variant],
        sizes[size],
        className,
      )}
      type={type}
      {...props}
    />
  )
}
