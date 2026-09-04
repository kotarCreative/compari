'use node'
import {
  isDemoMode,
  isRetryableHttpStatus,
  requireDeploymentEnv,
} from './runtime.ts'
import type {
  ProviderSearchResult,
  ResearchPage,
  WebResearchPort,
} from '../ports/webResearch'

let port: WebResearchPort | undefined
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
    let response: Response
    try {
      response = await fetch('https://api.firecrawl.dev/v2/search', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.key()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: [input.query, input.location].filter(Boolean).join(' '),
          limit: Math.min(input.limit, 12),
          sources: ['web'],
        }),
      })
    } catch {
      throw new Error('retryable_external: Firecrawl discovery is unreachable')
    }
    const payload: unknown = await response.json().catch(() => null)
    if (!response.ok)
      throw new Error(
        isRetryableHttpStatus(response.status)
          ? 'retryable_external: Firecrawl discovery is temporarily unavailable'
          : `permanent_external: Firecrawl search failed (${response.status})`,
      )
    return firecrawlSearchResults(payload)
      .flatMap((row): Array<ProviderSearchResult> => {
        if (!row || typeof row !== 'object') return []
        const x = row as Record<string, unknown>
        const url = typeof x.url === 'string' ? x.url : ''
        if (!url) return []
        let hostname: string
        try {
          hostname = new URL(url).hostname
        } catch {
          return []
        }
        return [
          {
            name:
              typeof x.title === 'string' ? x.title.slice(0, 160) : hostname,
            url,
            snippet:
              typeof x.description === 'string'
                ? x.description.slice(0, 1_000)
                : undefined,
          },
        ]
      })
      .slice(0, input.limit)
  }
  async researchProvider(input: {
    url: string
    query: string
    limit: number
  }): Promise<Array<ResearchPage>> {
    const baseUrl = new URL(input.url)
    const normalizedHost = baseUrl.hostname.replace(/^www\./, '').toLowerCase()
    let discoveredUrls: Array<string> = []
    if (input.limit > 1) {
      try {
        const detailResults = await this.searchProviders({
          query: `site:${baseUrl.hostname} ${input.query}`.slice(0, 500),
          limit: Math.min(input.limit - 1, 4),
        })
        discoveredUrls = detailResults.flatMap((result) => {
          try {
            const url = new URL(result.url)
            return url.hostname.replace(/^www\./, '').toLowerCase() ===
              normalizedHost
              ? [url.toString()]
              : []
          } catch {
            return []
          }
        })
      } catch {
        // Vendor-site discovery is an enhancement; the known page can still
        // provide useful evidence when Firecrawl search is temporarily sparse.
      }
    }
    const urls = [...new Set([baseUrl.toString(), ...discoveredUrls])].slice(
      0,
      input.limit,
    )
    const attempts = await Promise.allSettled(
      urls.map((url) => this.scrapePage(url)),
    )
    const pages = attempts.flatMap((attempt): Array<ResearchPage> =>
      attempt.status === 'fulfilled' && attempt.value ? [attempt.value] : [],
    )
    if (pages.length) return pages
    const failure = attempts.find(
      (attempt): attempt is PromiseRejectedResult =>
        attempt.status === 'rejected',
    )
    if (failure) throw failure.reason
    return []
  }

  private async scrapePage(url: string): Promise<ResearchPage | null> {
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
          onlyMainContent: true,
        }),
      })
    } catch {
      throw new Error('retryable_external: Firecrawl research is unreachable')
    }
    const payload: unknown = await response.json().catch(() => null)
    if (!response.ok)
      throw new Error(
        isRetryableHttpStatus(response.status)
          ? 'retryable_external: Firecrawl research is temporarily unavailable'
          : `permanent_external: Firecrawl scrape failed (${response.status})`,
      )
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
