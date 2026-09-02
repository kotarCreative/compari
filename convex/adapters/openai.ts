'use node'

import {
  APICallError,
  NoObjectGeneratedError,
  NoOutputGeneratedError,
  Output,
  RetryError,
  generateText,
  jsonSchema,
} from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { deploymentEnv, requireDeploymentEnv } from './runtime.ts'
import type { OpenAIResponsesProviderOptions } from '@ai-sdk/openai'
import type { JSONSchema7 } from 'ai'

type OpenAIOperation = 'reasoning' | 'ranking'

export async function generateOpenAIStructuredOutput(input: {
  operation: OpenAIOperation
  name: string
  schema: Record<string, unknown>
  system: string
  user: string
}): Promise<unknown> {
  const apiKey = requireDeploymentEnv(
    'OPENAI_API_KEY',
    `needs_user: OpenAI ${input.operation} is not configured`,
  )
  const openai = createOpenAI({ apiKey })
  try {
    const result = await generateText({
      model: openai.responses(
        deploymentEnv('OPENAI_REASONING_MODEL') ?? 'gpt-4.1-mini',
      ),
      instructions: input.system,
      prompt: input.user,
      output: Output.object({
        name: input.name,
        schema: jsonSchema(input.schema as JSONSchema7),
      }),
      maxRetries: 0,
      timeout: 30_000,
      providerOptions: {
        openai: {
          store: false,
          strictJsonSchema: true,
        } satisfies OpenAIResponsesProviderOptions,
      },
    })
    return result.output
  } catch (error) {
    throw openAIWorkflowError(error, input.operation)
  }
}

export function openAIWorkflowError(
  error: unknown,
  operation: OpenAIOperation,
): Error {
  const cause = RetryError.isInstance(error) ? error.lastError : error
  if (APICallError.isInstance(cause) && cause.isRetryable)
    return new Error(
      `retryable_external: OpenAI ${operation} is temporarily unavailable`,
    )
  if (
    NoObjectGeneratedError.isInstance(cause) ||
    NoOutputGeneratedError.isInstance(cause)
  )
    return new Error(
      `needs_user: OpenAI ${operation} returned invalid structured output`,
    )
  return new Error(
    `needs_user: OpenAI ${operation} configuration or request needs attention`,
  )
}
