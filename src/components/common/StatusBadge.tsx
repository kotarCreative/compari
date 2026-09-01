import { Badge } from '~/components/ui'

function statusVariant(status: string) {
  if (status === 'ready' || status === 'completed') return 'success' as const
  if (
    status === 'retryable_failure' ||
    status === 'permanent_failure' ||
    status === 'cancelled'
  )
    return 'warning' as const
  return 'default' as const
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={statusVariant(status)}>{status.replaceAll('_', ' ')}</Badge>
  )
}
