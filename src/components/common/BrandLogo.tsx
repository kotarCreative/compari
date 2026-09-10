export function BrandLogo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <img src="/logo.svg" width="40" height="40" alt="" aria-hidden="true" />
      <span className="brand-wordmark">compari</span>
    </span>
  )
}
