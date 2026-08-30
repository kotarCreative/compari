export function validateBuyerSelection(input: { candidateIds: Array<string>; requestId: string; candidates: Array<{ id: string; requestId: string; recommended: boolean; current: boolean; contactable: boolean }> }): string | null {
  if (input.candidateIds.length < 1 || input.candidateIds.length > 5) return 'select one to five candidates'
  if (new Set(input.candidateIds).size !== input.candidateIds.length) return 'duplicate candidate selection'
  const byId = new Map(input.candidates.map(candidate => [candidate.id, candidate]))
  for (const id of input.candidateIds) {
    const candidate = byId.get(id)
    if (!candidate || candidate.requestId !== input.requestId) return 'candidate does not belong to this request'
    if (!candidate.recommended || !candidate.current || !candidate.contactable) return 'candidate is not a current contactable recommendation'
  }
  return null
}

/** The sole policy boundary that turns a buyer's explicit choices into work. */
export function outreachJobsForSelection(input: Parameters<typeof validateBuyerSelection>[0]): Array<string> {
  return validateBuyerSelection(input) === null ? [...input.candidateIds] : []
}
