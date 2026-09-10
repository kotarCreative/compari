import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { defineConfig, loadEnv } from 'vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import viteReact from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_PUBLIC_SITE_URL')
  const siteOrigin = new URL(
    env.VITE_PUBLIC_SITE_URL || 'https://enduring-husky-65.convex.site/',
  ).origin
  return {
    define: {
      'import.meta.env.VITE_PUBLIC_SITE_URL': JSON.stringify(siteOrigin),
    },
    server: {
      port: 3000,
    },
    plugins: [
      tailwindcss(),
      tsConfigPaths({
        projects: ['./tsconfig.json'],
      }),
      tanstackStart({
        prerender: {
          enabled: true,
          autoStaticPathsDiscovery: false,
          crawlLinks: false,
        },
        pages: [
          { path: '/' },
          { path: '/requests/new', sitemap: { exclude: true } },
        ],
        sitemap: { enabled: true, host: siteOrigin },
      }),
      viteReact(),
    ],
  }
})
