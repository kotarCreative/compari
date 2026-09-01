export type ClassValue = string | false | null | undefined

export function cn(...values: Array<ClassValue>): string {
  return values.filter(Boolean).join(' ')
}
