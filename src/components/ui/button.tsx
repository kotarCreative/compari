import type { ComponentProps } from 'react'
import { cn } from '~/lib/cn'

type ButtonVariant =
  'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
type ButtonSize = 'default' | 'sm' | 'lg' | 'icon'

const variants: Record<ButtonVariant, string> = {
  default:
    'border-transparent bg-slate-900 text-white shadow-sm hover:bg-slate-700',
  destructive: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
  outline:
    'border-slate-200 bg-white/70 text-slate-700 hover:border-slate-300 hover:bg-white',
  secondary:
    'border-transparent bg-slate-100 text-slate-800 hover:bg-slate-200',
  ghost: 'border-transparent bg-transparent text-slate-600 hover:bg-slate-100',
  link: 'border-transparent bg-transparent text-sky-800 underline-offset-4 hover:underline',
}

const sizes: Record<ButtonSize, string> = {
  default: 'min-h-12 px-5 py-2.5 text-sm',
  sm: 'min-h-11 px-3.5 py-2 text-xs',
  lg: 'min-h-14 px-6 py-3 text-base',
  icon: 'size-12 text-lg',
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
        'inline-flex items-center justify-center gap-2.5 rounded-xl border font-sans font-semibold leading-tight transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-700 disabled:cursor-not-allowed disabled:opacity-45',
        variants[variant],
        sizes[size],
        className,
      )}
      type={type}
      {...props}
    />
  )
}
