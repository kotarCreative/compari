import { v } from 'convex/values'
import { action, mutation, query } from './_generated/server'
import { api } from './_generated/api'

declare const process: {
  env: Record<string, string | undefined>
}

// Write your Convex functions in any file inside this directory (`convex`).
// See https://docs.convex.dev/functions for more.

// You can read data from the database via a query:
export const listNumbers = query({
  // Validators for arguments.
  args: {
    count: v.number(),
  },

  // Query implementation.
  handler: async (ctx, args) => {
    // Read the database as many times as you need here.
    // See https://docs.convex.dev/database/reading-data.
    const numbers = await ctx.db
      .query('numbers')
      // Ordered by _creationTime, return most recent
      .order('desc')
      .take(args.count)
    return {
      viewer: (await ctx.auth.getUserIdentity())?.name ?? null,
      numbers: numbers.reverse().map((number) => number.value),
    }
  },
})

// You can write data to the database via a mutation:
export const addNumber = mutation({
  // Validators for arguments.
  args: {
    value: v.number(),
  },

  // Mutation implementation.
  handler: async (ctx, args) => {
    // Insert or modify documents in the database here.
    // Mutations can also read from the database like queries.
    // See https://docs.convex.dev/database/writing-data.

    const id = await ctx.db.insert('numbers', { value: args.value })

    console.log('Added new document with id:', id)
    // Optionally, return a value from your mutation.
    // return id;
  },
})

// You can fetch data from and send data to third-party APIs via an action:
export const myAction = action({
  // Validators for arguments.
  args: {
    first: v.number(),
  },

  // Action implementation.
  handler: async (ctx, args) => {
    // // Use the browser-like `fetch` API to send HTTP requests.
    // // See https://docs.convex.dev/functions/actions#calling-third-party-apis-and-using-npm-packages.
    // const response = await fetch("https://api.thirdpartyservice.com");
    // const data = await response.json();

    // // Query data by running Convex queries.
    const data = await ctx.runQuery(api.myFunctions.listNumbers, {
      count: 10,
    })
    console.log(data)

    // // Write data by running Convex mutations.
    await ctx.runMutation(api.myFunctions.addNumber, {
      value: args.first,
    })
  },
})

export const scrapePage = action({
  args: {
    url: v.string(),
  },
  returns: v.object({
    url: v.string(),
    title: v.union(v.string(), v.null()),
    markdown: v.union(v.string(), v.null()),
    error: v.union(v.string(), v.null()),
  }),
  handler: async (_ctx, args) => {
    let url: URL
    try {
      url = new URL(args.url)
    } catch {
      return {
        url: args.url,
        title: null,
        markdown: null,
        error: 'Enter a valid URL, including https://.',
      }
    }

    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return {
        url: args.url,
        title: null,
        markdown: null,
        error: 'Only http and https URLs can be scraped.',
      }
    }

    const apiKey = process.env.FIRECRAWL_API_KEY
    if (!apiKey) {
      return {
        url: url.toString(),
        title: null,
        markdown: null,
        error: 'Firecrawl is not configured. Set FIRECRAWL_API_KEY in Convex.',
      }
    }

    const response = await fetch('https://api.firecrawl.dev/v2/scrape', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url.toString(),
        formats: ['markdown'],
        onlyMainContent: true,
      }),
    })

    const payload: unknown = await response.json()
    if (!response.ok || !isRecord(payload) || payload.success !== true) {
      return {
        url: url.toString(),
        title: null,
        markdown: null,
        error: getErrorMessage(payload, response.status),
      }
    }

    const data = payload.data
    const metadata = isRecord(data) && isRecord(data.metadata) ? data.metadata : null
    const markdown = isRecord(data) && typeof data.markdown === 'string'
      ? data.markdown.slice(0, 20_000)
      : null

    return {
      url: url.toString(),
      title: metadata && typeof metadata.title === 'string' ? metadata.title : null,
      markdown,
      error: markdown ? null : 'Firecrawl returned no markdown for this page.',
    }
  },
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getErrorMessage(payload: unknown, status: number): string {
  if (isRecord(payload) && typeof payload.error === 'string') {
    return payload.error
  }
  return `Firecrawl request failed (${status}).`
}
