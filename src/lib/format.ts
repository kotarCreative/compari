/** Turn a snake_case or kebab-case key into a display label. */
export function humanize(value: string): string {
  const words = value.replace(/[_-]/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}
