# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

A browser-based 3D globe for studying geography (Japanese UI, for adult learners), built with globe.gl (three.js) + Vite + TypeScript, deployed to GitHub Pages. See README.md (Japanese) for features and data sources.

## Commands

```sh
npm run dev          # http://localhost:5173/Claude/  (note the /Claude/ base path)
npm test             # vitest: unit tests + checks on the generated files in public/data
npx vitest run tests/format.test.ts     # one file
npx vitest run -t "Crimea"              # tests matching a name
npm run build        # tsc (typecheck, noEmit) + vite build → dist/ (also writes dist/licenses.md)
npm run typecheck
npm run data         # regenerate public/data/* from Natural Earth + World Bank (downloads cached in .cache/)
npm run data -- --refresh
npm run texture      # regenerate public/textures/earth.jpg (downloads a ~100 MB raster into .cache/)
```

Behind an HTTPS proxy, prefix the data/texture scripts with `NODE_USE_ENV_PROXY=1` (Node's fetch ignores HTTPS_PROXY otherwise).

Generated files in `public/data/` and `public/textures/` are committed; CI (`.github/workflows/deploy.yml`, on push to `main`) only runs `npm test` and `npm run build`. After changing `scripts/build-data.mjs` or `data/overrides/`, rerun `npm run data` and `npm test`.

## Architecture

**Build-time data pipeline** (`scripts/build-data.mjs`, plain Node ESM, not typechecked):
- Borders come from Natural Earth's *Japan point-of-view* file (`ne_10m_admin_0_countries_jpn`), which only exists at 1:10m, so it is simplified with mapshaper: explode → simplify 4% keep-shapes → drop islands < 100 km² except each country's largest ring, islands near capitals, and `data/overrides/keep-islands.json` (Takeshima, Senkaku, …) → regroup by ADM0_A3. Output precision is 1e-4°; 1e-3° collapses islets.
- `fixWinding` makes exterior rings clockwise (d3/globe.gl convention; mapshaper writes RFC 7946 CCW). A wrongly wound polygon renders as "the whole sphere except the country" — a test checks every shape's area < 2π.
- `data/overrides/*.json` are hand-maintained tables, each with `_note`/`_sources`: the 197 independent states (UN 193 + VAT/KOS/COK/NIU; PRK flagged not recognized by Japan), Japanese country names (Statistics Bureau style), capitals (Teikoku-shoin textbook names; `en` must equal a NE 1:50m populated-place `NAME`, else give `lat`/`lng`), river names, World Bank code fixes, fallback stats. Keep facts sourced; when adding one, record the source in the file.
- Country ids everywhere are NE `ADM0_A3` (not ISO — e.g. FRA/NOR have ISO_A3 = -99; South Sudan is SDS in countries but SSD in populated places).
- Output: `countries.geojson` (shapes, `properties.id` only) and `country-info.json` (everything shown in the UI), plus rivers, labels, ranges, peaks, geo-lines. Types for all of them are in `src/types.ts`.

**Runtime** (`src/main.ts` wires everything): `createGlobe` (`src/globe.ts`) builds the globe.gl instance; each layer module (`src/layers/`) owns one globe.gl layer and returns `refresh()`. Shared state lives in plain objects mutated by `main.ts` (`view`: metric/hovered/selected; `toggles`: layer switches), followed by the relevant `refresh()` calls. The selected country is mirrored to `location.hash` (`#JPN`).

- `layers/countries.ts` — polygons layer. Uses unlit `MeshBasicMaterial`s cached per color; fully transparent caps use `visible: false` (not drawn, still hit-testable). Side walls are generated only for the selected country, and `polygonCapCurvatureResolution(3)` is deliberate — both were big triangle-count factors.
- `layers/labels.ts` — all text is globe.gl's HTML elements layer, because its 3D text typeface has no Japanese glyphs. A requestAnimationFrame loop re-lays out labels when the camera moves: altitude-based level of detail (`maxAlt`), hiding labels near the horizon, and greedy overlap removal by `priority` (toggles `.is-culled`). globe.gl creates elements asynchronously, hence the `dirty` retry flag.
- `layers/lines.ts` — rivers and special latitude lines as paths.
- `lib/choropleth.ts` — metrics, class breaks, and the sequential ramp (validated as an ordinal ramp against the `OCEAN` color; in choropleth mode the globe texture is swapped for that plain color). Antarctica is excluded from the map and rankings.
- `ui/` — info panel, legend + ranking table, built with the small `h()` helper in `ui/dom.ts` (no framework).

## Checking changes in a browser

In dev mode the globe instance is exposed as `window.__globe` (e.g. `__globe.pointOfView({lat, lng, altitude}, 0)`, `__globe.getScreenCoords(lat, lng)` to click a country, `__globe.renderer().info.render` for triangle/draw-call counts). Headless Chromium needs `--use-angle=swiftshader --enable-unsafe-swiftshader` for WebGL; it renders slowly, so wait a few seconds after camera moves.
