import type { ReactNode } from 'react'
import { BrandLogo } from '~/components/common/BrandLogo'

export function RequestChatLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-10 sm:py-16">
      <header className="mb-8 text-center">
        <BrandLogo />
        <h1 className="mt-6 text-3xl font-semibold">
          Let’s find your options.
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Your request, the details, and what we find — all in one place.
        </p>
      </header>
      <div className="welcome-form notebook-form space-y-4">{children}</div>
    </main>
  )
}
