export function followUpIdempotencyKey(questionId: string) {
  return `follow-up:${questionId}:v1`
}

export function canProcessFollowUp(input: {
  jobKind: string; jobQuestionId?: string; questionId: string; jobRequestId?: string
  questionRequestId: string; jobCandidateId?: string; questionCandidateId?: string
  status: string; claimMatches: boolean; questionStatus: string
}) {
  return input.jobKind === 'send_follow_up' && input.jobQuestionId === input.questionId &&
    input.jobRequestId === input.questionRequestId && input.jobCandidateId === input.questionCandidateId &&
    input.status === 'running' && input.claimMatches && input.questionStatus === 'answered'
}
