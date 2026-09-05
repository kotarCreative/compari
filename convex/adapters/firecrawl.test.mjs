import assert from 'node:assert/strict'
import test from 'node:test'
import {
  firecrawlSearchResults,
  isLikelyProviderSearchResult,
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
