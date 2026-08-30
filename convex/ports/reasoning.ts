export type ExtractedRequirement = {
  key: string
  label: string
  value: unknown
  kind: 'hard_constraint' | 'preference' | 'information'
  importance?: number
  confidence: number
}
export type ProviderExtraction = {
  schemaVersion: 1
  facts: Array<{ key: string; label: string; value: string; confidence: number }>
  proposal: {
    status: 'partial' | 'complete'
    summary: string
    attributes: Record<string, string>
    missingInformation: Array<string>
  }
  providerQuestion?: string
  confidence: number
}
export interface ReasoningPort {
  extractRequirements: (input: {
    prompt: string
    timezone: string
    corrections: Array<ExtractedRequirement>
  }) => Promise<{
    title: string
    location?: string
    requirements: Array<ExtractedRequirement>
    clarifyingQuestions: Array<{
      question: string
      importance: 'required' | 'useful'
    }>
  }>
  /** The caller supplies provider content inside explicit untrusted delimiters. */
  extractProviderResponse: (input: { delimitedBody: string }) => Promise<ProviderExtraction>
}
