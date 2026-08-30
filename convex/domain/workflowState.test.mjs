import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canResearch,
  normalizeDomain,
  transitionCandidate,
  transitionRequest,
} from './workflowState.ts'

test('request transitions permit bounded progression and reject invalid selection', () => {
  assert.equal(transitionRequest('draft', 'researching'), 'researching')
  assert.equal(transitionRequest('contacting', 'cancelled'), 'cancelled')
  assert.throws(() => transitionRequest('draft', 'completed'), /cannot transition/)
})

test('candidate transitions and domain normalization are deterministic', () => {
  assert.equal(transitionCandidate('qualified', 'queued_for_contact'), 'queued_for_contact')
  assert.throws(() => transitionCandidate('rejected', 'researching'), /cannot transition/)
  assert.equal(normalizeDomain('https://www.Example.com/contact'), 'example.com')
  assert.throws(() => normalizeDomain('mailto:hello@example.com'), /http or https/)
  assert.equal(canResearch('Find a local printer for a short-run program.'), true)
  assert.equal(canResearch('too short'), false)
})
