export type ResearchPageInput = { url: string; markdown: string }
export type PublicEndpoint = {
  type: 'email' | 'form'
  value: string
  sourceUrl: string
}

/** Extract only contact details visibly present in bounded research text. */
export function extractPublicEndpoints(pages: ReadonlyArray<ResearchPageInput>): Array<PublicEndpoint> {
  const found = new Map<string, PublicEndpoint>()
  for (const page of pages.slice(0, 5)) {
    const text = page.markdown.slice(0, 20_000)
    for (const value of text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []) {
      const email = value.toLowerCase()
      found.set(`email:${email}`, { type: 'email', value: email, sourceUrl: page.url })
    }
    for (const raw of text.match(/https?:\/\/[^\s)\]"']*(?:contact|quote|request)[^\s)\]"']*/gi) ?? []) {
      try {
        const value = new URL(raw).toString()
        found.set(`form:${value}`, { type: 'form', value, sourceUrl: page.url })
      } catch {
        // Ignore malformed text; never manufacture a route from a homepage.
      }
    }
  }
  return [...found.values()].slice(0, 4)
}
