import assert from 'node:assert/strict'
import test from 'node:test'
import { APICallError } from 'ai'
import { openAIWorkflowError } from './openai.ts'

test('AI SDK retryable failures preserve workflow retry semantics', () => {
  const error = new APICallError({
    message: 'rate limited',
    url: 'https://api.openai.com/v1/responses',
    requestBodyValues: {},
    statusCode: 429,
    isRetryable: true,
  })

  assert.match(
    openAIWorkflowError(error, 'reasoning').message,
    /^retryable_external:/,
  )
})

test('AI SDK non-retryable failures require configuration attention', () => {
  const error = new APICallError({
    message: 'unauthorized',
    url: 'https://api.openai.com/v1/responses',
    requestBodyValues: {},
    statusCode: 401,
    isRetryable: false,
  })

  assert.match(openAIWorkflowError(error, 'ranking').message, /^needs_user:/)
})
