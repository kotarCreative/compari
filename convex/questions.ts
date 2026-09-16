import { v } from 'convex/values'
import { internal } from './_generated/api'
import { mutation, query } from './_generated/server'
import { requireOwnedRequest } from './lib/auth'
import { followUpIdempotencyKey } from './domain/followUpPolicy'
import { questionsAreSimilar } from './domain/workflowState'

export const list = query({
  args: { requestId: v.id('procurementRequests') },
  returns: v.array(
    v.object({
      _id: v.id('questions'),
      requestId: v.id('procurementRequests'),
      text: v.string(),
      importance: v.union(v.literal('required'), v.literal('useful')),
      status: v.union(
        v.literal('open'),
        v.literal('answered'),
        v.literal('resolved'),
      ),
      answer: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    await requireOwnedRequest(ctx, args.requestId)
    const questions = await ctx.db
      .query('questions')
      .withIndex('by_request_id', (q) => q.eq('requestId', args.requestId))
      .take(100)
    return questions.map((question) => ({
      _id: question._id,
      requestId: question.requestId,
      text: question.text,
      importance: question.importance,
      status: question.status,
      ...(question.answer === undefined ? {} : { answer: question.answer }),
    }))
  },
})
export const answerForRequest = mutation({
  args: { questionId: v.id('questions'), answer: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const question = await ctx.db.get('questions', args.questionId)
    if (!question) throw new Error('validation: question does not exist')
    const { request } = await requireOwnedRequest(ctx, question.requestId)
    if (question.status !== 'open')
      throw new Error('validation: question has already been answered')
    const answer = args.answer.trim()
    if (!answer || answer.length > 4_000)
      throw new Error('validation: answer is required')
    const now = Date.now()
    const factId = await ctx.db.insert('facts', {
      requestId: request._id,
      candidateId: question.candidateId,
      key: `buyer_answer:${question._id}`,
      label: 'Buyer-provided answer',
      value: { schemaVersion: 1, value: answer },
      sourceType: 'user',
      sourceReference: {},
      confidence: 1,
      observedAt: now,
      createdAt: now,
    })
    await ctx.db.patch('questions', question._id, {
      answer,
      status: 'answered',
      supportingFactIds: [...question.supportingFactIds, factId],
      updatedAt: now,
    })
    const requestQuestions = await ctx.db
      .query('questions')
      .withIndex('by_request_id', (q) => q.eq('requestId', request._id))
      .take(100)
    const answeredQuestionTexts = requestQuestions.flatMap((item) =>
      item.status === 'answered' ? [item.text] : [],
    )
    const remainingOpenQuestions = requestQuestions.filter(
      (item) =>
        item.status === 'open' &&
        !answeredQuestionTexts.some((answered) =>
          questionsAreSimilar(answered, item.text),
        ),
    )
    for (const item of requestQuestions) {
      if (item.status === 'open' && !remainingOpenQuestions.includes(item))
        await ctx.db.patch('questions', item._id, {
          status: 'resolved',
          updatedAt: now,
        })
    }
    const shouldReinterpret =
      question.candidateId === undefined &&
      !remainingOpenQuestions.some((item) => item.candidateId === undefined)
    const nextVersion = shouldReinterpret
      ? request.version + 1
      : request.version
    if (shouldReinterpret) {
      await ctx.db.patch('procurementRequests', request._id, {
        version: nextVersion,
        updatedAt: now,
      })
      const jobId = await ctx.db.insert('sideEffectJobs', {
        userId: request.userId,
        kind: 'extract_requirements',
        idempotencyKey: `extract-requirements:${request._id}:v${nextVersion}`,
        status: 'pending',
        attemptCount: 0,
        maxAttempts: 3,
        requestId: request._id,
        inputVersion: nextVersion,
        scheduledAt: now,
        createdAt: now,
        updatedAt: now,
      })
      await ctx.scheduler.runAfter(0, internal.workflows.extractRequirements, {
        requestId: request._id,
        jobId,
      })
    }
    if (question.providerMessageId && question.candidateId) {
      const followUpJobId = await ctx.db.insert('sideEffectJobs', {
        userId: request.userId,
        kind: 'send_follow_up',
        idempotencyKey: followUpIdempotencyKey(question._id),
        status: 'pending',
        attemptCount: 0,
        maxAttempts: 3,
        requestId: request._id,
        candidateId: question.candidateId,
        questionId: question._id,
        inputVersion: nextVersion,
        scheduledAt: now,
        createdAt: now,
        updatedAt: now,
      })
      await ctx.scheduler.runAfter(
        0,
        internal.followUps.sendForAnsweredQuestion,
        {
          questionId: question._id,
          jobId: followUpJobId,
        },
      )
    }
    return null
  },
})
