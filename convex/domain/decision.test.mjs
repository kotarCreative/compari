import assert from 'node:assert/strict'
import test from 'node:test'
import { canAutoReply, normalizeTrustedViews } from './decision.ts'

test('trusted views reject unknown types and use a safe fallback', () => {
  const views = normalizeTrustedViews([{ type: 'script', label: 'run this' }], [{ key: 'price', label: 'Price', kind: 'number' }], ['candidate-1'])
  assert.deepEqual(views.map((view) => view.type), ['provider_cards', 'comparison_matrix'])
})

test('trusted metric views reject incompatible metrics', () => {
  const views = normalizeTrustedViews([{ type: 'timeline', label: 'Timeline', metricKeys: ['price'] }, { type: 'provider_cards', label: 'Providers' }], [{ key: 'price', label: 'Price', kind: 'number' }], [])
  assert.equal(views[0].type, 'provider_cards')
})

test('known-fact reply policy rejects commitments and low confidence', () => {
  assert.equal(canAutoReply({ requestActive: true, paused: false, hasExactUserFact: true, confidence: 1, answer: 'The requested quantity is 500.' }).allowed, true)
  assert.equal(canAutoReply({ requestActive: true, paused: false, hasExactUserFact: true, confidence: 1, answer: 'We accept your offer.' }).allowed, false)
  assert.equal(canAutoReply({ requestActive: true, paused: false, hasExactUserFact: true, confidence: 0.5, answer: '500' }).allowed, false)
})
