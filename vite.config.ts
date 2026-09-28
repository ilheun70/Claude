import { defineConfig } from 'vite'

export default defineConfig({
  // The path the site is served under. The deploy workflow passes GitHub Pages' base
  // path (e.g. "/geo-globe/"), so renaming the repository needs no code change.
  base: process.env.BASE_PATH || '/',
  build: {
    // flag-icons' CSS references ~500 small SVGs; inlining them would put every flag
    // into the stylesheet. As files, a flag is fetched only when it is shown.
    assetsInlineLimit: 0,
    // three.js and globe.gl make up most of the ~2 MB bundle; it is loaded once.
    chunkSizeWarningLimit: 2500,
    // Notices for the bundled libraries (MIT/ISC require shipping them); linked from the page.
    license: { fileName: 'licenses.md' },
  },
})
