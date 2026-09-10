import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canResearch,
  moveCandidateCount,
  normalizeDomain,
  normalizedQuestionKey,
  questionsAreSimilar,
  transitionCandidate,
  transitionRequest,
} from './workflowState.ts'

test('request transitions permit bounded progression and reject invalid selection', () => {
  assert.equal(transitionRequest('draft', 'researching'), 'researching')
  assert.equal(transitionRequest('researching', 'evaluating'), 'evaluating')
  assert.equal(
    transitionRequest('awaiting_selection', 'contacting'),
    'contacting',
  )
  assert.equal(transitionRequest('contacting', 'cancelled'), 'cancelled')
  assert.throws(
    () => transitionRequest('draft', 'completed'),
    /cannot transition/,
  )
})

test('question keys ignore punctuation, casing, and repeated whitespace', () => {
  assert.equal(
    normalizedQuestionKey(' What is your budget? '),
    normalizedQuestionKey('WHAT  is your budget!!!'),
  )
})

test('question similarity catches paraphrased duplicate intake questions', () => {
  assert.equal(
    questionsAreSimilar(
      'What is the location of the tree to be cut down?',
      'What is the location of the tree that needs to be cut down?',
    ),
    true,
  )
  assert.equal(
    questionsAreSimilar(
      'What is the location of the tree?',
      'What is your maximum budget?',
    ),
    false,
  )
})

test('workflow counts advance through outbound and inbound handoffs', () => {
  const initial = {
    discovered: 0,
    researching: 0,
    qualified: 0,
    rejected: 0,
    queuedForContact: 1,
    contacted: 0,
    responded: 0,
  }
  const contacted = moveCandidateCount(initial, 'queuedForContact', 'contacted')
  assert.deepEqual(contacted, { ...initial, queuedForContact: 0, contacted: 1 })
  const responded = moveCandidateCount(contacted, 'contacted', 'responded')
  assert.deepEqual(responded, { ...initial, queuedForContact: 0, responded: 1 })
  assert.equal(
    moveCandidateCount(responded, 'contacted', 'responded').contacted,
    0,
  )
})

test('candidate transitions and domain normalization are deterministic', () => {
  assert.equal(
    transitionCandidate('qualified', 'queued_for_contact'),
    'queued_for_contact',
  )
  assert.throws(
    () => transitionCandidate('rejected', 'researching'),
    /cannot transition/,
  )
  assert.equal(
    normalizeDomain('https://www.Example.com/contact'),
    'example.com',
  )
  assert.throws(
    () => normalizeDomain('mailto:hello@example.com'),
    /http or https/,
  )
  assert.equal(
    canResearch('Find a local printer for a short-run program.'),
    true,
  )
  assert.equal(canResearch('too short'), false)
})
