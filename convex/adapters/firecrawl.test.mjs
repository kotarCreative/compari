import assert from 'node:assert/strict'
import test from 'node:test'
import { firecrawlSearchResults } from './firecrawl.ts'

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
