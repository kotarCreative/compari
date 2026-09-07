export function ResearchLoader({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`research-loader ${compact ? 'research-loader-compact' : ''}`}
      aria-hidden="true"
    >
      <div className="research-orbit" />
      <span className="research-tile research-tile-one">✓</span>
      <span className="research-tile research-tile-two">≋</span>
      <span className="research-tile research-tile-three">✦</span>
      <span className="research-center">☺</span>
    </div>
  )
}

export function LoadingCards({
  label = 'Gathering your comparisons…',
}: {
  label?: string
}) {
  return (
    <div role="status" className="space-y-3">
      <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
        <ResearchLoader compact />
        <p>{label}</p>
      </div>
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          aria-hidden="true"
          className="loading-card py-5"
          style={{ animationDelay: `${item * 120}ms` }}
        >
          <div className="skeleton mb-3 h-4 w-2/5 rounded-full" />
          <div className="skeleton h-3 w-4/5 rounded-full" />
        </div>
      ))}
    </div>
  )
}
