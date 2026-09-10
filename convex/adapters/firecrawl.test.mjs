import assert from 'node:assert/strict'
import test from 'node:test'
import {
  firecrawlSearchResults,
  isLikelyProviderSearchResult,
  localizedProviderQuery,
  providerSearchResultScore,
  rankProviderResearchLinks,
} from './firecrawl.ts'

test('normalizes current Firecrawl v2 web search results', () => {
  const web = [
    {
      title: 'Example vendor',
      description: 'A relevant supplier',
      url: 'https://vendor.example',
    },
  ]

  assert.deepEqual(
    firecrawlSearchResults({ success: true, data: { web, news: [] } }),
    web,
  )
})

test('continues to normalize the legacy Firecrawl search envelope', () => {
  const rows = [{ title: 'Legacy vendor', url: 'https://legacy.example' }]

  assert.deepEqual(firecrawlSearchResults({ success: true, data: rows }), rows)
  assert.deepEqual(firecrawlSearchResults({ success: true, data: {} }), [])
})

test('rejects code repositories and Python configuration results', () => {
  assert.equal(
    isLikelyProviderSearchResult({
      url: 'https://github.com/example/project/blob/main/pyproject.toml',
      title: 'pyproject.toml',
    }),
    false,
  )
  assert.equal(
    isLikelyProviderSearchResult({
      url: 'https://example.dev/guides/configuration',
      title: 'Python configuration file guide',
    }),
    false,
  )
  assert.equal(
    isLikelyProviderSearchResult({
      url: 'https://local-printer.example/services/event-programs',
      title: 'Local Printer — Event program printing',
    }),
    true,
  )
})

test('rejects directories and listicles while ranking relevant official sites', () => {
  assert.equal(
    isLikelyProviderSearchResult({
      url: 'https://www.yelp.com/search?find_desc=printers',
      title: 'Best printers near Calgary',
    }),
    false,
  )
  const relevant = providerSearchResultScore({
    url: 'https://acmeprint.example/services/brochure-printing',
    title: 'Acme Print — Brochure printing services',
    description: 'Commercial printing and quote requests in Calgary.',
    query: 'commercial brochure printer Calgary',
  })
  const generic = providerSearchResultScore({
    url: 'https://acmeprint.example/',
    title: 'Acme Print',
    description: 'Welcome to our company.',
    query: 'commercial brochure printer Calgary',
  })
  assert.ok(relevant > generic)
})

test('selects bounded same-site contact and request-specific research pages', () => {
  assert.deepEqual(
    rankProviderResearchLinks({
      pages: [
        {
          url: 'https://printer.example/',
          title: 'Printer',
          markdown:
            '[Contact](/contact) [Brochures](/services/brochure-printing) [Blog](/blog/brochure-trends) [External](https://other.example/contact)',
        },
      ],
      origin: 'https://printer.example',
      query: 'brochure printing pricing contact',
      excludedUrls: ['https://printer.example/'],
      limit: 2,
    }),
    [
      'https://printer.example/services/brochure-printing',
      'https://printer.example/contact',
    ],
  )
})

test('prioritizes pricing links and pricing PDFs ahead of contact forms', () => {
  assert.deepEqual(
    rankProviderResearchLinks({
      pages: [
        {
          url: 'https://cleaner.example/',
          markdown:
            '[Contact us](/contact) [Our rates](/details) [Price list PDF](/downloads/service-pricing.pdf) [Terms PDF](/terms.pdf)',
        },
      ],
      origin: 'https://cleaner.example',
      query: 'home cleaning price quote',
      limit: 3,
    }),
    [
      'https://cleaner.example/downloads/service-pricing.pdf',
      'https://cleaner.example/details',
      'https://cleaner.example/contact',
    ],
  )
})

test('adds location only when the planned query does not already include it', () => {
  assert.equal(
    localizedProviderQuery('commercial printer Calgary', 'Calgary, Alberta'),
    'commercial printer Calgary',
  )
  assert.equal(
    localizedProviderQuery('commercial brochure printer', 'Calgary, Alberta'),
    'commercial brochure printer Calgary, Alberta',
  )
})
