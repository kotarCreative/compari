/** A tiny paper friend, drawn with simple ink strokes. */
export function NotebookPal({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 180 170"
      fill="none"
      aria-hidden="true"
    >
      <g
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M43 116 28 133l-10-5m112-14 18 12 13-10M69 135l-5 21H51m54-22 7 21h14" />
        <path d="m45 29 85-5 9 109-89 7z" fill="#ffe58a" />
        <path
          d="m54 29 8 106M72 45l43-3M74 55l30-2"
          stroke="#b88643"
          strokeWidth="2"
        />
        <path d="m49 21 1 15m16-17 1 15m16-17 1 15m16-17 1 15m16-17 1 15" />
        <path d="M76 78v5m31-7v5m-25 14q12 15 22-2" />
        <path
          d="m148 34 4-10 4 10 10 4-10 4-4 10-4-10-10-4z"
          fill="#e6b9c7"
          strokeWidth="2"
        />
        <path d="M21 62 12 57m12 19H12m17 13-9 6" strokeWidth="2" />
      </g>
      <ellipse cx="74" cy="91" rx="6" ry="3" fill="#ee9c83" />
      <ellipse cx="113" cy="88" rx="6" ry="3" fill="#ee9c83" />
    </svg>
  )
}
