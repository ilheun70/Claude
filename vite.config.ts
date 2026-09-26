import { defineConfig } from 'vite'

// GitHub Pages serves this repository at https://<user>.github.io/Claude/
export default defineConfig({
  base: '/Claude/',
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
