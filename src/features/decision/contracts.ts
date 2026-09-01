import { api } from '../../../convex/_generated/api'
import type { FunctionReference } from 'convex/server'

type Json = { schemaVersion: 1; value: unknown }

export type EvaluationData = {
  evaluation: { recommendation: string; inputVersion: number } | null
  views: Array<{
    _id: string
    label: string
    viewType: string
    configuration: {
      value?: {
        explanation?: string
        metricKeys?: Array<string>
        candidateIds?: Array<string>
      }
    }
  }>
}

export type DecisionProposal = {
  _id: string
  candidateId: string
  status: string
  summary: string
  confidence: number
  version: number
  attributes: Json
}

export type DecisionProvider = {
  id: string
  name: string
  factLabels: Array<string>
}

export const decisionApi = api as unknown as {
  evaluations: {
    list: FunctionReference<
      'query',
      'public',
      { requestId: string },
      EvaluationData
    >
    reconfigure: FunctionReference<
      'mutation',
      'public',
      { requestId: string; instruction: string },
      null
    >
  }
  proposals: {
    list: FunctionReference<
      'query',
      'public',
      { requestId: string },
      Array<DecisionProposal>
    >
  }
  selections: {
    confirmChoice: FunctionReference<
      'mutation',
      'public',
      {
        requestId: string
        candidateId: string
        proposalId: string
        proposalVersion: number
      },
      null
    >
  }
  diagnostics: {
    getRequest: FunctionReference<
      'query',
      'public',
      { requestId: string },
      {
        jobs: Array<{
          _id: string
          kind: string
          status: string
          lastErrorSummary?: string
        }>
      }
    >
  }
}
