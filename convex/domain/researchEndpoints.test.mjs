import assert from 'node:assert/strict'
import test from 'node:test'
import { extractPublicEndpoints } from './researchEndpoints.ts'

test('research endpoint extraction preserves only visible email and form URLs', () => {
  const endpoints = extractPublicEndpoints([
    { url: 'https://vendor.test', markdown: 'Sales: QUOTES@Vendor.test. Contact https://vendor.test/contact for a quote.' },
  ])
  assert.deepEqual(endpoints, [
    { type: 'email', value: 'quotes@vendor.test', sourceUrl: 'https://vendor.test' },
    { type: 'form', value: 'https://vendor.test/contact', sourceUrl: 'https://vendor.test' },
  ])
})

test('research endpoint extraction does not invent contact routes', () => {
  assert.deepEqual(extractPublicEndpoints([
    { url: 'https://vendor.test', markdown: 'We are happy to help; please contact our team.' },
  ]), [])
})
