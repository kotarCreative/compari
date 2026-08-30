import type { AuthConfig } from 'convex/server'

declare const process: { env: Record<string, string | undefined> }

const siteUrl = process.env.CONVEX_SITE_URL
if (!siteUrl) throw new Error('CONVEX_SITE_URL must be configured before authentication can start')
const authConfig: AuthConfig = {
  providers: [
    {
      domain: siteUrl,
      applicationID: 'convex',
    },
  ],
}
export default authConfig
