export type ProviderSearchResult = {
  name: string
  url: string
  snippet?: string
}
export type ResearchPage = { url: string; title?: string; markdown: string }
export interface WebResearchPort {
  searchProviders: (input: {
    query: string
    location?: string
    limit: number
  }) => Promise<Array<ProviderSearchResult>>
  researchProvider: (input: {
    url: string
    limit: number
  }) => Promise<Array<ResearchPage>>
  submitContactForm: (input: {
    url: string
    replyEmail: string
    message: string
    idempotencyKey: string
  }) => Promise<{ submissionId: string }>
}
