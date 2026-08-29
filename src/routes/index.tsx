import { Link, createFileRoute } from '@tanstack/react-router'
import { useAction, useMutation } from 'convex/react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useState } from 'react'
import { api } from '../../convex/_generated/api'
import type { FormEvent } from 'react'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const {
    data: { viewer, numbers },
  } = useSuspenseQuery(convexQuery(api.myFunctions.listNumbers, { count: 10 }))

  const addNumber = useMutation(api.myFunctions.addNumber)
  const scrapePage = useAction(api.myFunctions.scrapePage)
  const [url, setUrl] = useState('https://example.com')
  const [scrapeResult, setScrapeResult] = useState<{
    url: string
    title: string | null
    markdown: string | null
    error: string | null
  } | null>(null)
  const [isScraping, setIsScraping] = useState(false)

  async function handleScrape(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsScraping(true)
    setScrapeResult(null)
    try {
      setScrapeResult(await scrapePage({ url }))
    } catch {
      setScrapeResult({
        url,
        title: null,
        markdown: null,
        error: 'Unable to reach Firecrawl. Please try again.',
      })
    } finally {
      setIsScraping(false)
    }
  }

  return (
    <main className="p-8 flex flex-col gap-16">
      <h1 className="text-4xl font-bold text-center">
        Convex + Tanstack Start
      </h1>
      <div className="flex flex-col gap-8 max-w-lg mx-auto">
        <p>Welcome {viewer ?? 'Anonymous'}!</p>
        <p>
          Click the button below and open this page in another window - this
          data is persisted in the Convex cloud database!
        </p>
        <p>
          <button
            className="bg-dark dark:bg-light text-light dark:text-dark text-sm px-4 py-2 rounded-md border-2"
            onClick={() => {
              void addNumber({ value: Math.floor(Math.random() * 10) })
            }}
          >
            Add a random number
          </button>
        </p>
        <p>
          Numbers:{' '}
          {numbers.length === 0 ? 'Click the button!' : numbers.join(', ')}
        </p>
        <section className="flex flex-col gap-3 rounded-md border border-slate-300 p-4 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-bold">Scrape a page with Firecrawl</h2>
            <p className="text-sm">
              Get the primary content from a public web page as clean markdown.
            </p>
          </div>
          <form className="flex flex-col gap-2" onSubmit={handleScrape}>
            <label className="flex flex-col gap-1 text-sm" htmlFor="scrape-url">
              Page URL
              <input
                className="rounded border border-slate-300 bg-white px-3 py-2 text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                id="scrape-url"
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://example.com"
                required
                type="url"
                value={url}
              />
            </label>
            <button
              className="self-start rounded-md border-2 bg-dark px-4 py-2 text-sm text-light disabled:cursor-not-allowed disabled:opacity-50 dark:bg-light dark:text-dark"
              disabled={isScraping}
              type="submit"
            >
              {isScraping ? 'Scraping…' : 'Scrape page'}
            </button>
          </form>
          {scrapeResult?.error ? (
            <p className="text-sm text-red-600 dark:text-red-400">
              {scrapeResult.error}
            </p>
          ) : null}
          {scrapeResult?.markdown ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold">
                {scrapeResult.title ?? scrapeResult.url}
              </p>
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded bg-slate-100 p-3 text-xs dark:bg-slate-900">
                {scrapeResult.markdown}
              </pre>
            </div>
          ) : null}
        </section>
        <p>
          Edit{' '}
          <code className="text-sm font-bold font-mono bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded-md">
            convex/myFunctions.ts
          </code>{' '}
          to change your backend
        </p>
        <p>
          Edit{' '}
          <code className="text-sm font-bold font-mono bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded-md">
            src/routes/index.tsx
          </code>{' '}
          to change your frontend
        </p>
        <p>
          Open{' '}
          <Link
            to="/anotherPage"
            className="text-blue-600 underline hover:no-underline"
          >
            another page
          </Link>{' '}
          to send an action.
        </p>
        <div className="flex flex-col">
          <p className="text-lg font-bold">Useful resources:</p>
          <div className="flex gap-2">
            <div className="flex flex-col gap-2 w-1/2">
              <ResourceCard
                title="Convex docs"
                description="Read comprehensive documentation for all Convex features."
                href="https://docs.convex.dev/home"
              />
              <ResourceCard
                title="Stack articles"
                description="Learn about best practices, use cases, and more from a growing
            collection of articles, videos, and walkthroughs."
                href="https://www.typescriptlang.org/docs/handbook/2/basic-types.html"
              />
            </div>
            <div className="flex flex-col gap-2 w-1/2">
              <ResourceCard
                title="Templates"
                description="Browse our collection of templates to get started quickly."
                href="https://www.convex.dev/templates"
              />
              <ResourceCard
                title="Discord"
                description="Join our developer community to ask questions, trade tips & tricks,
            and show off your projects."
                href="https://www.convex.dev/community"
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

function ResourceCard({
  title,
  description,
  href,
}: {
  title: string
  description: string
  href: string
}) {
  return (
    <div className="flex flex-col gap-2 bg-slate-200 dark:bg-slate-800 p-4 rounded-md h-28 overflow-auto">
      <a href={href} className="text-sm underline hover:no-underline">
        {title}
      </a>
      <p className="text-xs">{description}</p>
    </div>
  )
}
