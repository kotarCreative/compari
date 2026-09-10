export type PricingEvidencePage = {
  url: string
  title?: string
  markdown: string
}

const directPricePattern =
  /(?:[$£€¥₹]\s*\d|\b(?:AUD|CAD|EUR|GBP|NZD|USD)\s*\$?\s*\d|\d(?:[\d,.]*\d)?\s*(?:AUD|CAD|EUR|GBP|NZD|USD)\b)/i
const pricingLanguagePattern =
  /\b(?:costs?|fees?|from|packages?|plans?|prices?|pricing|rates?|starting at)\b/i
const recurringRatePattern =
  /(?:\d|free)\s*(?:\/|per\s+)(?:day|hour|month|night|person|session|unit|week|year)\b/i

/**
 * Keep bounded, verbatim pricing neighborhoods for request-aware extraction.
 * This is only a high-recall prefilter; the reasoning boundary must still
 * determine whether a published amount applies to the buyer's requested work.
 */
export function pricingEvidencePages(
  pages: ReadonlyArray<PricingEvidencePage>,
  limit = 5,
): Array<PricingEvidencePage> {
  const evidence: Array<PricingEvidencePage> = []
  for (const page of pages) {
    if (evidence.length >= limit) break
    const lines = page.markdown.split(/\r?\n/)
    const selected = new Set<number>()
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index] ?? ''
      if (!looksLikePricingLine(line)) continue
      for (
        let neighbor = Math.max(0, index - 2);
        neighbor <= Math.min(lines.length - 1, index + 2);
        neighbor++
      )
        selected.add(neighbor)
    }
    if (!selected.size) continue
    const excerpts: Array<string> = []
    let previous = -2
    for (const index of [...selected].sort((a, b) => a - b)) {
      if (index > previous + 1 && excerpts.length) excerpts.push('\n…\n')
      excerpts.push(lines[index] ?? '')
      previous = index
    }
    const markdown = excerpts.join('\n').trim().slice(0, 4_000)
    if (markdown) evidence.push({ ...page, markdown })
  }
  return evidence
}

export function looksLikePricingLine(line: string): boolean {
  const compact = line.trim()
  if (!compact || compact.length > 1_000) return false
  return (
    directPricePattern.test(compact) ||
    recurringRatePattern.test(compact) ||
    (pricingLanguagePattern.test(compact) && /\d|\bfree\b/i.test(compact))
  )
}

/** Reject a model summary when its numeric or explicit currency claims are not
 * present in the verbatim snippet selected from the cited page. */
export function publishedPriceIsSupported(
  price: string,
  sourceExcerpt: string,
): boolean {
  const normalizeAmounts = (value: string) =>
    value
      .match(/\d[\d,.]*/g)
      ?.map((amount) => amount.replace(/,/g, '').replace(/[.]$/, ''))
      .map((amount) => Number(amount))
      .filter(Number.isFinite)
      .map(String) ?? []
  const claimedAmounts = normalizeAmounts(price)
  const sourceAmounts = new Set(normalizeAmounts(sourceExcerpt))
  if (
    !claimedAmounts.length ||
    claimedAmounts.some((amount) => !sourceAmounts.has(amount))
  )
    return false
  const explicitCurrencies =
    price.toUpperCase().match(/\b(?:AUD|CAD|EUR|GBP|NZD|USD)\b/g) ?? []
  const source = sourceExcerpt.toUpperCase()
  return explicitCurrencies.every((currency) => source.includes(currency))
}
