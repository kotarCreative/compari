export const siteTitle = 'Compari — Find and compare the right vendors'
export const siteDescription =
  'Find and compare vendors with Compari, your AI research buddy. Explore options, compare services, and make your next big decision with a little less work.'

// Supply the public marketing origin at build time, never a backend URL.
const configuredOrigin = import.meta.env.VITE_PUBLIC_SITE_URL?.trim()
export const siteOrigin = configuredOrigin
  ? new URL(configuredOrigin).origin
  : undefined

export function publicUrl(path: string) {
  return siteOrigin ? new URL(path, siteOrigin).href : path
}
