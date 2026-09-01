import { Button } from '~/components/ui'

export function CenteredMessage({
  title,
  detail,
  action,
  onAction,
}: {
  title: string
  detail: string
  action?: string
  onAction?: () => void
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-3 p-8">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-slate-600 dark:text-slate-300">{detail}</p>
      {action && onAction ? (
        <Button className="mt-2 w-fit" onClick={onAction} variant="outline">
          {action}
        </Button>
      ) : null}
    </main>
  )
}
