import { v } from 'convex/values'
import { mutation } from './_generated/server'
import { requireOwnedRequest } from './lib/auth'
import { transitionRequest } from './domain/workflowState'

export const confirmChoice = mutation({
  args: { requestId: v.id('procurementRequests'), candidateId: v.id('requestCandidates'), proposalId: v.id('proposals'), proposalVersion: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { request } = await requireOwnedRequest(ctx, args.requestId)
    if (request.status === 'completed' && request.selectedCandidateId === args.candidateId && request.selectedProposalId === args.proposalId) return null
    if (request.status !== 'awaiting_selection') throw new Error('validation: options are not ready for selection')
    const candidate = await ctx.db.get('requestCandidates', args.candidateId)
    const proposal = await ctx.db.get('proposals', args.proposalId)
    if (!candidate || !proposal || candidate.requestId !== request._id || proposal.requestId !== request._id || proposal.candidateId !== candidate._id)
      throw new Error('validation: selected offer does not belong to this request')
    const latest = await ctx.db.query('proposals').withIndex('by_candidate_id_and_version', (q) => q.eq('candidateId', candidate._id)).order('desc').first()
    if (!latest || latest._id !== proposal._id || proposal.version !== args.proposalVersion) throw new Error('validation: this offer is stale; review the latest evidence')
    if (proposal.status === 'withdrawn' || proposal.status === 'superseded' || proposal.status !== 'received') throw new Error('validation: this offer cannot be selected')
    if (candidate.status === 'declined' || candidate.status === 'rejected') throw new Error('validation: this provider is no longer viable')
    const inputVersion = request.evaluationInputVersion ?? request.version
    const evaluation = await ctx.db.query('evaluations').withIndex('by_request_id_and_input_version', (q) => q.eq('requestId', request._id).eq('inputVersion', inputVersion)).unique()
    if (!evaluation) throw new Error('validation: a current comparison is required before selection')
    const now = Date.now()
    transitionRequest('awaiting_selection', 'completed')
    await ctx.db.patch('procurementRequests', request._id, { status: 'completed', selectedCandidateId: candidate._id, selectedProposalId: proposal._id, selectedAt: now, updatedAt: now })
    await ctx.db.insert('activityEvents', { requestId: request._id, candidateId: candidate._id, eventType: 'provider_selected', safeMessage: 'Buyer recorded a final provider choice. No quote was accepted and no provider was contacted.', correlationId: `selection:${proposal._id}:${proposal.version}`, createdAt: now })
    return null
  },
})
