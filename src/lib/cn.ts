import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { ClassValue } from 'clsx'

export type { ClassValue }

export function cn(...inputs: Array<ClassValue>): string {
  return twMerge(clsx(...inputs))
}
