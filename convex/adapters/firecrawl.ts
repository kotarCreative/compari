'use node'
import {
  isDemoMode,
  isRetryableHttpStatus,
  requireDeploymentEnv,
  retryAfterDelayMs,
} from './runtime.ts'
import type {
  ProviderSearchResult,
  ResearchPage,
  WebResearchPort,
} from '../ports/webResearch'

let port: WebResearchPort | undefined

class RetryableFirecrawlError extends Error {
  readonly retryAfterMs?: number

  constructor(
    message: string,
    retryAfterHeader: string | null,
    fallbackDelayMs?: number,
  ) {
    super(`retryable_external: ${message}`)
    this.retryAfterMs = retryAfterDelayMs(retryAfterHeader) ?? fallbackDelayMs
  }
}

function firecrawlHttpError(response: Response, operation: string): Error {
  if (response.status === 429)
    return new RetryableFirecrawlError(
      `Firecrawl ${operation} rate limit reached`,
      response.headers.get('Retry-After'),
      60_000,
    )
  if (isRetryableHttpStatus(response.status))
    return new RetryableFirecrawlError(
      `Firecrawl ${operation} is temporarily unavailable (${response.status})`,
      response.headers.get('Retry-After'),
    )
  return new Error(
    `permanent_external: Firecrawl ${operation} failed (${response.status})`,
  )
}

export function getWebResearchPort(): WebResearchPort {
  port ??= isDemoMode() ? new DemoWebResearchAdapter() : new FirecrawlAdapter()
  return port
}
/** Deterministic fixtures, isolated behind the same research port as production. */
class DemoWebResearchAdapter implements WebResearchPort {
  searchProviders(): Promise<Array<ProviderSearchResult>> {
    return Promise.resolve(
      ['northline', 'prairie', 'rivercity'].map((name) => ({
        name: `${name[0].toUpperCase()}${name.slice(1)} Print`,
        url: `https://${name}.demo.test`,
      })),
    )
  }
  researchProvider(input: { url: string }): Promise<Array<ResearchPage>> {
    return Promise.resolve([
      {
        url: input.url,
        title: 'Demo print provider',
        markdown:
          'Public demo fixture. Contact sales@example.demo.test for factual quote details.',
      },
    ])
  }
  submitContactForm(input: {
    idempotencyKey: string
  }): Promise<{ submissionId: string }> {
    return Promise.resolve({
      submissionId: `demo-form-${input.idempotencyKey.slice(0, 80)}`,
    })
  }
}
class FirecrawlAdapter implements WebResearchPort {
  private key() {
    return requireDeploymentEnv(
      'FIRECRAWL_API_KEY',
      'permanent_external: Firecrawl is not configured',
    )
  }
  async searchProviders(input: {
    query: string
    location?: string
    limit: number
  }): Promise<Array<ProviderSearchResult>> {
    const searchQuery = localizedProviderQuery(input.query, input.location)
    let response: Response
    try {
      response = await fetch('https://api.firecrawl.dev/v2/search', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.key()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchQuery,
          // Ask for extra rows because directories, articles, and duplicate
          // domains are deliberately removed before discovery is persisted.
          limit: Math.min(Math.max(input.limit * 2, 8), 12),
          sources: ['web'],
        }),
      })
    } catch {
      throw new Error('retryable_external: Firecrawl discovery is unreachable')
    }
    const payload: unknown = await response.json().catch(() => null)
    if (!response.ok) throw firecrawlHttpError(response, 'discovery')
    return firecrawlSearchResults(payload)
      .flatMap(
        (row): Array<{ result: ProviderSearchResult; relevance: number }> => {
          if (!row || typeof row !== 'object') return []
          const x = row as Record<string, unknown>
          const url = typeof x.url === 'string' ? x.url : ''
          const title = typeof x.title === 'string' ? x.title : ''
          const description =
            typeof x.description === 'string' ? x.description : ''
          if (
            !url ||
            !isLikelyProviderSearchResult({ url, title, description })
          )
            return []
          let hostname: string
          try {
            hostname = new URL(url).hostname
          } catch {
            return []
          }
          const relevance = providerSearchResultScore({
            url,
            title,
            description,
            query: searchQuery,
          })
          if (relevance < 3) return []
          return [
            {
              result: {
                name: title ? title.slice(0, 160) : hostname,
                url,
                snippet: description ? description.slice(0, 1_000) : undefined,
              },
              relevance,
            },
          ]
        },
      )
      .sort((a, b) => b.relevance - a.relevance)
      .map(({ result }) => result)
      .slice(0, input.limit)
  }
  async researchProvider(input: {
    url: string
    query: string
    limit: number
  }): Promise<Array<ResearchPage>> {
    const baseUrl = new URL(input.url)
    const pageLimit = Math.max(1, Math.min(input.limit, 5))
    const seedUrls = [
      ...new Set([baseUrl.toString(), `${baseUrl.origin}/`]),
    ].slice(0, Math.min(2, pageLimit))
    const initialAttempts = await Promise.allSettled(
      seedUrls.map((url) =>
        this.scrapePage(url, new URL(url).pathname !== '/'),
      ),
    )
    const pages = initialAttempts.flatMap((attempt): Array<ResearchPage> =>
      attempt.status === 'fulfilled' && attempt.value ? [attempt.value] : [],
    )
    const linkedUrls = rankProviderResearchLinks({
      pages,
      origin: baseUrl.origin,
      query: input.query,
      excludedUrls: seedUrls,
      limit: pageLimit - pages.length,
    })
    if (linkedUrls.length) {
      const linkedAttempts = await Promise.allSettled(
        linkedUrls.map((url) => this.scrapePage(url, true)),
      )
      pages.push(
        ...linkedAttempts.flatMap((attempt): Array<ResearchPage> =>
          attempt.status === 'fulfilled' && attempt.value
            ? [attempt.value]
            : [],
        ),
      )
    }
    if (pages.length) return pages
    const failure = initialAttempts.find(
      (attempt): attempt is PromiseRejectedResult =>
        attempt.status === 'rejected',
    )
    if (failure) throw failure.reason
    return []
  }

  private async scrapePage(
    url: string,
    onlyMainContent: boolean,
  ): Promise<ResearchPage | null> {
    let response: Response
    try {
      response = await fetch('https://api.firecrawl.dev/v2/scrape', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.key()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          formats: ['markdown'],
          // Whole homepages preserve navigation and footer contact details;
          // selected service/detail pages stay focused on their main content.
          onlyMainContent,
        }),
      })
    } catch {
      throw new Error('retryable_external: Firecrawl research is unreachable')
    }
    const payload: unknown = await response.json().catch(() => null)
    if (!response.ok) throw firecrawlHttpError(response, 'research')
    const data =
      payload && typeof payload === 'object'
        ? (payload as { data?: unknown }).data
        : null
    if (
      !data ||
      typeof data !== 'object' ||
      typeof (data as { markdown?: unknown }).markdown !== 'string'
    )
      return null
    const row = data as { markdown: string; metadata?: { title?: unknown } }
    return {
      url,
      title:
        typeof row.metadata?.title === 'string'
          ? row.metadata.title
          : undefined,
      markdown: row.markdown.slice(0, 20_000),
    }
  }
  submitContactForm(): Promise<{ submissionId: string }> {
    return Promise.reject(
      new Error(
        'needs_user: Firecrawl form submission is not configured or safely reconcilable',
      ),
    )
  }
}

/** Firecrawl v2 groups results by source under `data.web`. Keep accepting the
 * older array envelope so deployments can migrate without losing discovery. */
export function firecrawlSearchResults(payload: unknown): Array<unknown> {
  if (!payload || typeof payload !== 'object') return []
  const data = (payload as { data?: unknown }).data
  if (Array.isArray(data)) return data
  if (!data || typeof data !== 'object') return []
  const web = (data as { web?: unknown }).web
  return Array.isArray(web) ? web : []
}

const developerContentHosts = new Set([
  'docs.python.org',
  'gist.github.com',
  'github.com',
  'gitlab.com',
  'npmjs.com',
  'pypi.org',
  'readthedocs.io',
  'readthedocs.org',
  'stackoverflow.com',
])

const directoryAndContentHosts = new Set([
  'angi.com',
  'facebook.com',
  'homeadvisor.com',
  'instagram.com',
  'linkedin.com',
  'reddit.com',
  'thumbtack.com',
  'wikipedia.org',
  'x.com',
  'yellowpages.com',
  'yelp.com',
])

const searchStopWords = new Set([
  'and',
  'business',
  'company',
  'contractor',
  'for',
  'from',
  'local',
  'near',
  'provider',
  'quote',
  'service',
  'supplier',
  'the',
  'vendor',
  'with',
])

/** Discovery should yield businesses, not source code or package
 * documentation that happens to share keywords with a buyer request. */
export function isLikelyProviderSearchResult(input: {
  url: string
  title?: string
  description?: string
}): boolean {
  let url: URL
  try {
    url = new URL(input.url)
  } catch {
    return false
  }
  const hostname = url.hostname.toLowerCase().replace(/^www\./, '')
  if (
    developerContentHosts.has(hostname) ||
    directoryAndContentHosts.has(hostname) ||
    hostname.endsWith('.readthedocs.io')
  )
    return false
  let path = url.pathname.toLowerCase()
  try {
    path = decodeURIComponent(path)
  } catch {
    // The URL itself is valid; matching its encoded path is still safe.
  }
  if (
    /\/(?:blob|tree)\//.test(path) ||
    /\/(?:article|blog|directory|guides?|magazine|news|reviews?)(?:\/|$)/.test(
      path,
    ) ||
    /(?:^|\/)(?:pyproject\.toml|requirements\.txt|setup\.py)$/.test(path) ||
    /\.(?:cfg|ini|ipynb|lock|py|toml)$/.test(path)
  )
    return false
  const label = `${input.title ?? ''} ${input.description ?? ''}`.toLowerCase()
  return !(
    /\bpython (?:config|configuration) file\b/.test(label) ||
    /\b(?:best|top) \d+\b/.test(label) ||
    /\b(?:business directory|compare providers|reviews? and ratings)\b/.test(
      label,
    )
  )
}

/** Rank official, request-relevant business pages ahead of generic matches.
 * This is intentionally heuristic: final qualification still relies on
 * retained website evidence, but obvious directories and content pages never
 * become candidates merely because they rank well in web search. */
export function providerSearchResultScore(input: {
  url: string
  title?: string
  description?: string
  query: string
}): number {
  if (!isLikelyProviderSearchResult(input)) return Number.NEGATIVE_INFINITY
  const url = new URL(input.url)
  const searchable =
    `${url.hostname} ${url.pathname} ${input.title ?? ''} ${input.description ?? ''}`.toLowerCase()
  const title = (input.title ?? '').toLowerCase()
  const queryTokens = meaningfulTokens(input.query)
  let score = url.pathname === '/' || url.pathname === '' ? 2 : 0
  for (const token of queryTokens) {
    if (title.includes(token)) score += 3
    else if (searchable.includes(token)) score += 1
  }
  if (
    /\b(?:about|company|contact|manufacturer|our services|request a quote|services|solutions|studio|supplier)\b/.test(
      searchable,
    )
  )
    score += 2
  return score
}

export function localizedProviderQuery(
  query: string,
  location?: string,
): string {
  const trimmedQuery = query.trim()
  const trimmedLocation = location?.trim()
  if (!trimmedLocation) return trimmedQuery
  const queryTokens = new Set(trimmedQuery.toLowerCase().match(/[a-z0-9]+/g))
  const locationTokens =
    trimmedLocation
      .toLowerCase()
      .match(/[a-z0-9]+/g)
      ?.filter((x) => x.length >= 3) ?? []
  return locationTokens.some((token) => queryTokens.has(token))
    ? trimmedQuery
    : `${trimmedQuery} ${trimmedLocation}`
}

/** Pull a few high-value, same-site pages from links already present in the
 * scraped official page. Contact and quote pages are prioritized, followed by
 * request-specific service pages. */
export function rankProviderResearchLinks(input: {
  pages: ReadonlyArray<ResearchPage>
  origin: string
  query: string
  excludedUrls?: ReadonlyArray<string>
  limit: number
}): Array<string> {
  if (input.limit <= 0) return []
  const origin = new URL(input.origin)
  const excluded = new Set(
    (input.excludedUrls ?? []).map((url) => canonicalResearchUrl(url)),
  )
  const scores = new Map<string, number>()
  const tokens = meaningfulTokens(input.query)
  for (const page of input.pages) {
    const links = page.markdown.matchAll(
      /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
    )
    for (const match of links) {
      let linked: URL
      try {
        linked = new URL(match[1], page.url)
      } catch {
        continue
      }
      if (
        !['http:', 'https:'].includes(linked.protocol) ||
        linked.hostname.replace(/^www\./, '') !==
          origin.hostname.replace(/^www\./, '')
      )
        continue
      linked.hash = ''
      const canonical = canonicalResearchUrl(linked.toString())
      const path = linked.pathname.toLowerCase()
      if (
        excluded.has(canonical) ||
        /\/(?:account|blog|careers?|legal|login|news|privacy|terms)(?:\/|$)/.test(
          path,
        ) ||
        /\.(?:docx?|jpe?g|pdf|png|svg|webp)$/i.test(path)
      )
        continue
      let score = 0
      if (/\/(?:contact|estimate|quote|request)(?:\/|$)/.test(path)) score += 10
      if (
        /\/(?:about|capabilities|pricing|products?|services?)(?:\/|$)/.test(
          path,
        )
      )
        score += 5
      for (const token of tokens) if (path.includes(token)) score += 2
      if (score > 0)
        scores.set(canonical, Math.max(scores.get(canonical) ?? 0, score))
    }
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, input.limit)
    .map(([url]) => url)
}

function meaningfulTokens(value: string): Array<string> {
  return [
    ...new Set(
      value
        .toLowerCase()
        .match(/[a-z0-9]+/g)
        ?.filter((token) => token.length >= 3 && !searchStopWords.has(token)) ??
        [],
    ),
  ].slice(0, 16)
}

function canonicalResearchUrl(value: string): string {
  const url = new URL(value)
  url.hash = ''
  if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/$/, '')
  return url.toString()
}
