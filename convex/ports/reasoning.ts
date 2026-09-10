export type ExtractedRequirement = {
  key: string
  label: string
  value: unknown
  kind: 'hard_constraint' | 'preference' | 'information'
  importance?: number
  confidence: number
}
export type AnsweredQuestion = {
  question: string
  answer: string
}
export type ProviderSearchPlan = {
  discoveryQueries: Array<string>
  vendorDetailQuery: string
}
export type ProviderExtraction = {
  schemaVersion: 1
  facts: Array<{
    key: string
    label: string
    value: string
    confidence: number
  }>
  proposal: {
    status: 'partial' | 'complete'
    summary: string
    attributes: Record<string, string>
    missingInformation: Array<string>
  }
  providerQuestion?: string
  confidence: number
}
export type WebsiteQuote = {
  price: string
  pricingType:
    'exact' | 'range' | 'starting_at' | 'rate' | 'package' | 'estimate'
  scope?: string
  conditions?: string
  missingInformation: Array<string>
  sourceUrl: string
  confidence: number
}
export type OutreachEmail = { subject: string; body: string }
export type OutreachEmailContext = {
  originalRequest: string
  requestTitle: string
  location?: string
  buyerName: string
  providerName: string
  requirements: Array<{
    label: string
    value: string
    kind: 'hard_constraint' | 'preference' | 'information'
  }>
}
export interface ReasoningPort {
  extractRequirements: (input: {
    prompt: string
    timezone: string
    corrections: Array<ExtractedRequirement>
    answeredQuestions: Array<AnsweredQuestion>
  }) => Promise<{
    title: string
    location?: string
    requirements: Array<ExtractedRequirement>
    clarifyingQuestions: Array<{
      question: string
      importance: 'required' | 'useful'
    }>
  }>
  planProviderSearch: (input: {
    prompt: string
    location?: string
    requirements: Array<ExtractedRequirement>
    answeredQuestions: Array<AnsweredQuestion>
  }) => Promise<ProviderSearchPlan>
  extractWebsiteQuote: (input: {
    prompt: string
    requirements: Array<{ label: string; value: string }>
    evidencePages: Array<{
      url: string
      title?: string
      markdown: string
    }>
  }) => Promise<WebsiteQuote | null>
  composeOutreachEmail: (input: OutreachEmailContext) => Promise<OutreachEmail>
  /** The caller supplies provider content inside explicit untrusted delimiters. */
  extractProviderResponse: (input: {
    delimitedBody: string
  }) => Promise<ProviderExtraction>
}
