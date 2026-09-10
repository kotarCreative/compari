import assert from 'node:assert/strict'
import test from 'node:test'
import {
  looksLikePricingLine,
  pricingEvidencePages,
  publishedPriceIsSupported,
} from './websitePricing.ts'

test('recognizes published prices and rates without treating arbitrary numbers as quotes', () => {
  assert.equal(
    looksLikePricingLine('Full interior detail — from $219 CAD'),
    true,
  )
  assert.equal(looksLikePricingLine('Consulting is 95 USD per hour'), true)
  assert.equal(looksLikePricingLine('Plans start at 29/month'), true)
  assert.equal(looksLikePricingLine('Call 403-555-0199'), false)
  assert.equal(looksLikePricingLine('Serving Calgary since 1998'), false)
})

test('retains bounded verbatim context from every page with potential pricing', () => {
  const pages = pricingEvidencePages([
    {
      url: 'https://example.test/services',
      title: 'Services',
      markdown:
        '# Services\nInterior detailing\nFrom $219 for cars\nLarge vehicles cost more\nBook online\nUnrelated footer',
    },
    {
      url: 'https://example.test/about',
      markdown: '# About\nFamily owned since 1998',
    },
  ])

  assert.equal(pages.length, 1)
  assert.equal(pages[0]?.url, 'https://example.test/services')
  assert.match(pages[0]?.markdown ?? '', /Interior detailing/)
  assert.match(pages[0]?.markdown ?? '', /From \$219 for cars/)
  assert.doesNotMatch(pages[0]?.markdown ?? '', /Unrelated footer/)
})

test('rejects price summaries whose amounts or currency are not in the cited excerpt', () => {
  const excerpt = 'Interior detail: $219–$249 CAD depending on vehicle size.'
  assert.equal(publishedPriceIsSupported('$219-$249 CAD', excerpt), true)
  assert.equal(
    publishedPriceIsSupported('$1,299 CAD', 'Complete package: $1,299.00 CAD'),
    true,
  )
  assert.equal(publishedPriceIsSupported('$199-$249 CAD', excerpt), false)
  assert.equal(publishedPriceIsSupported('$219-$249 USD', excerpt), false)
})
