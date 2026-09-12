const scribbleLines = [
  'M42 49 q4 -6 8 0 t8 0 t8 0 t8 0 t8 0 t8 0 t8 0 t8 0 t8 0 t8 0',
  'M42 70 q4 -6 8 0 t8 0 t8 0 t8 0 t8 0 t8 0 t8 0 t8 0',
  'M42 91 q4 -6 8 0 t8 0 t8 0 t8 0 t8 0 t8 0',
]
const scribblePath = scribbleLines.join(' ')

export function ResearchLoader({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`research-loader ${compact ? 'research-loader-compact' : ''}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 180 130" fill="none" focusable="false">
        <path d="M22 24H153V116H22Z" fill="#e6e0d5" />
        <rect
          x="18"
          y="18"
          width="132"
          height="94"
          rx="4"
          fill="#fffefa"
          stroke="#d8d0c2"
        />
        <path d="M36 19V111" stroke="#d5a59c" strokeOpacity=".65" />
        <path
          d="M37 53H140M37 74H140M37 95H140"
          stroke="#bccbd5"
          strokeOpacity=".6"
        />
        {[34, 55, 76, 97].map((y) => (
          <circle key={y} cx="26" cy={y} r="2.5" fill="#d8d0c2" />
        ))}
        {scribbleLines.map((line, index) => (
          <path
            key={line}
            className={`research-ink research-ink-${index + 1}`}
            d={line}
            pathLength="1"
            stroke="#615344"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        ))}
        <g
          className="research-pen"
          style={{ offsetPath: `path('${scribblePath}')` }}
        >
          <path
            d="M0 0L4-15L14-5Z"
            fill="#d9a04b"
            stroke="#514638"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <path
            d="M4-15L29-40Q32-43 35-40L39-36Q42-33 39-30L14-5Z"
            fill="#514638"
          />
          <path
            d="M9-17L30-38"
            stroke="#a59680"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path d="M25-36L35-26" stroke="#edbf68" strokeWidth="3" />
          <path
            d="M0 0L5-5"
            stroke="#352e28"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      </svg>
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
