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
    const rows =
      payload &&
      typeof payload === 'object' &&
      Array.isArray((payload as { data?: unknown }).data)
        ? (payload as { data: Array<unknown> }).data
        : []
    return rows
      .flatMap((row): Array<ProviderSearchResult> => {
        if (!row || typeof row !== 'object') return []
        const x = row as Record<string, unknown>
        const url = typeof x.url === 'string' ? x.url : ''
        if (!url) return []
        return [
          {
            name:
              typeof x.title === 'string'
                ? x.title.slice(0, 160)
                : new URL(url).hostname,
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
    limit: number
  }): Promise<Array<ResearchPage>> {
    let response: Response
    try {
      response = await fetch('https://api.firecrawl.dev/v2/scrape', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.key()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: input.url,
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
      return []
    const row = data as { markdown: string; metadata?: { title?: unknown } }
    return [
      {
        url: input.url,
        title:
          typeof row.metadata?.title === 'string'
            ? row.metadata.title
            : undefined,
        markdown: row.markdown.slice(0, 20_000),
      },
    ].slice(0, input.limit)
  }
  submitContactForm(): Promise<{ submissionId: string }> {
    return Promise.reject(
      new Error(
        'needs_user: Firecrawl form submission is not configured or safely reconcilable',
      ),
    )
  }
}
