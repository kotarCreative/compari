/** Small cat seen from behind, sitting in front of a big monitor. Active-work indicator. */
export function TypingBuddy({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`typing-buddy ${className}`}
      role="presentation"
    >
      <svg viewBox="0 0 72 52" fill="none" focusable="false">
        {/* big monitor behind the cat */}
        <rect
          x="10"
          y="5"
          width="52"
          height="31"
          rx="3"
          fill="#0f172a"
          stroke="#475569"
          strokeWidth="1.5"
        />
        <rect x="13.5" y="8.5" width="45" height="24" rx="1.5" fill="#e0f2fe" />
        <rect
          className="typing-cursor-line typing-cursor-line-1"
          x="17"
          y="12"
          width="22"
          height="2.2"
          rx="1.1"
          fill="#0284c7"
        />
        <rect
          className="typing-cursor-line typing-cursor-line-2"
          x="17"
          y="16"
          width="15"
          height="2.2"
          rx="1.1"
          fill="#7dd3fc"
        />
        <rect x="41" y="12" width="14" height="14" rx="1" fill="#bae6fd" />
        {/* monitor stand */}
        <rect x="33" y="36" width="6" height="6" fill="#475569" />
        <rect x="26" y="41.5" width="20" height="2.5" rx="1.2" fill="#94a3b8" />
        {/* desk */}
        <rect x="4" y="44" width="64" height="3.5" rx="1.75" fill="#d8d0c2" />
        {/* keyboard peeking out on either side of the cat */}
        <rect x="16" y="41.5" width="40" height="3" rx="1.5" fill="#94a3b8" />
        {/* tail curled around the left side, wagging */}
        <path
          className="typing-tail"
          d="M25 43 Q17 44 17 37 Q17 33 21 32"
          stroke="#e9a45b"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <circle cx="21" cy="32" r="2.6" fill="#fff1dc" />
        {/* body centered in front of the monitor, seen from behind */}
        <ellipse cx="36" cy="38" rx="12.5" ry="8" fill="#e9a45b" />
        <path
          d="M29 34 Q36 32 43 34 M28.5 38 Q36 36 43.5 38"
          stroke="#c97f3d"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        {/* head from behind */}
        <g className="typing-head">
          <path d="M27 22 L28.5 12 L36.5 19 Z" fill="#e9a45b" />
          <path d="M45 22 L43.5 12 L35.5 19 Z" fill="#e9a45b" />
          <path d="M29.5 20 L30.2 15 L34 18 Z" fill="#f8b4b4" />
          <path d="M42.5 20 L41.8 15 L38 18 Z" fill="#f8b4b4" />
          <circle cx="36" cy="28" r="10" fill="#e9a45b" />
          <path
            d="M32 22 Q36 20 40 22 M32 25 Q36 23 40 25"
            stroke="#c97f3d"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <ellipse cx="36" cy="35" rx="2.4" ry="3" fill="#fff1dc" />
        </g>
      </svg>
    </span>
  )
}
