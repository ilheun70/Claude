// Builds the app's data files in public/data from Natural Earth and the World Bank.
//
//   npm run data              # uses downloads cached in .cache/
//   npm run data -- --refresh # re-downloads everything
//
// Behind an HTTPS proxy, run with NODE_USE_ENV_PROXY=1 so Node's fetch uses it.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mapshaper from 'mapshaper'
import { geoArea, geoCentroid, geoDistance, geoLength } from 'd3-geo'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = path.join(ROOT, '.cache')
const OUT = path.join(ROOT, 'public', 'data')
const OVERRIDES = path.join(ROOT, 'data', 'overrides')
const REFRESH = process.argv.includes('--refresh')

const NE_TAG = 'v5.1.2'
const NE_BASE = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${NE_TAG}/geojson/`
const WB_BASE = 'https://api.worldbank.org/v2/country/all/indicator/'
const EARTH_RADIUS_KM = 6371.0088

const NE_SOURCE = `Natural Earth ${NE_TAG}`
const WB_SOURCE = '世界銀行 World Development Indicators'

async function cached(name, url) {
  const file = path.join(CACHE, name)
  if (!REFRESH) {
    try {
      return await fs.readFile(file, 'utf8')
    } catch {
      // not cached yet
    }
  }
  console.log(`download ${url}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  const text = await res.text()
  await fs.mkdir(CACHE, { recursive: true })
  await fs.writeFile(file, text)
  return text
}

const naturalEarth = async (layer) => JSON.parse(await cached(`${layer}.geojson`, `${NE_BASE}${layer}.geojson`))
const readOverride = async (name) => JSON.parse(await fs.readFile(path.join(OVERRIDES, name), 'utf8'))
const isSet = (v) => v != null && v !== '' && v !== '-99' && v !== -99

async function worldBank(indicator) {
  const url = `${WB_BASE}${indicator}?format=json&mrnev=1&per_page=500`
  const [meta, rows] = JSON.parse(await cached(`wb-${indicator}.json`, url))
  if (meta.pages !== 1) throw new Error(`${indicator}: expected a single page, got ${meta.pages}`)
  const byCode = new Map()
  for (const r of rows) {
    if (r.value != null && r.countryiso3code) byCode.set(r.countryiso3code, { value: r.value, year: Number(r.date) })
  }
  return { byCode, lastUpdated: meta.lastupdated }
}

// Rounds coordinates to keep the output small; 3 decimals is about 100 m.
const round = (n, d = 3) => Math.round(n * 10 ** d) / 10 ** d

async function simplify(geojson, commands, precision) {
  const out = await mapshaper.applyCommands(`-i in.json ${commands} -o out.json format=geojson precision=${precision}`, {
    'in.json': JSON.stringify(geojson),
  })
  const result = JSON.parse(out['out.json'].toString())
  // Simplification can collapse tiny features to nothing.
  result.features = result.features.filter((f) => f.geometry)
  return result
}

// d3-geo and globe.gl expect clockwise exterior rings (the opposite of RFC 7946, which
// mapshaper writes). A polygon wound the other way covers the rest of the sphere, so
// reverse any polygon whose spherical area exceeds a hemisphere.
function fixWinding(feature) {
  const g = feature.geometry
  const polygons = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []
  for (const rings of polygons) {
    if (geoArea({ type: 'Polygon', coordinates: rings }) > 2 * Math.PI) {
      for (const ring of rings) ring.reverse()
    }
  }
  return feature
}

async function writeJson(name, data) {
  const text = JSON.stringify(data)
  await fs.writeFile(path.join(OUT, name), text)
  console.log(`wrote public/data/${name} (${(text.length / 1024).toFixed(0)} KB)`)
}

// ---------- countries ----------

const MIN_ISLAND_KM2 = 100

// The 10m Japan point-of-view file is the only one with Japan's borders, so it is
// simplified here. Each ring is simplified on its own (explode + keep-shapes) so small
// islands keep a shape; then islands under MIN_ISLAND_KM2 are dropped, except a
// country's largest ring and the islands near the `keep` points. Coordinates keep
// 4 decimals (~10 m): coarser rounding collapses islets such as Takeshima.
async function simplifyCountries(ne, keep) {
  const slim = {
    type: 'FeatureCollection',
    features: ne.features.map((f) => ({ type: 'Feature', properties: { id: f.properties.ADM0_A3 }, geometry: f.geometry })),
  }
  const parts = await simplify(slim, '-explode -simplify 4% weighted keep-shapes', 0.0001)
  const byId = new Map()
  for (const f of parts.features) {
    fixWinding(f)
    const list = byId.get(f.properties.id) ?? []
    list.push({ rings: f.geometry.coordinates, km2: geoArea(f) * EARTH_RADIUS_KM ** 2, center: geoCentroid(f) })
    byId.set(f.properties.id, list)
  }
  const listed = (id, center) =>
    keep.some((k) => k.id === id && geoDistance(center, [k.lng, k.lat]) * (180 / Math.PI) <= k.radius)
  const features = []
  for (const [id, list] of byId) {
    list.sort((a, b) => b.km2 - a.km2)
    const polygons = list.filter((p, i) => i === 0 || p.km2 >= MIN_ISLAND_KM2 || listed(id, p.center)).map((p) => p.rings)
    features.push({
      type: 'Feature',
      properties: { id },
      geometry: polygons.length === 1 ? { type: 'Polygon', coordinates: polygons[0] } : { type: 'MultiPolygon', coordinates: polygons },
    })
  }
  return { type: 'FeatureCollection', features }
}

async function buildCountries() {
  const [ne, states, names, capitalOverrides, fallback, wbCodes, pop, area, places, keepIslands] = await Promise.all([
    naturalEarth('ne_10m_admin_0_countries_jpn'),
    readOverride('independent-states.json'),
    readOverride('country-names.ja.json'),
    readOverride('capitals.ja.json'),
    readOverride('fallback-stats.json'),
    readOverride('wb-codes.json'),
    worldBank('SP.POP.TOTL'),
    worldBank('AG.SRF.TOTL.K2'),
    naturalEarth('ne_50m_populated_places'),
    readOverride('keep-islands.json'),
  ])

  const independent = new Set([...states.unMembers, ...states.recognizedNonUnMembers])
  const notRecognized = new Set(states.notRecognizedByJapan)
  const props = new Map(ne.features.map((f) => [f.properties.ADM0_A3, f.properties]))
  const jaName = (id) => names.names[id] ?? props.get(id)?.NAME_JA
  // Dependencies name their sovereign by NE's SOVEREIGNT; map it to an independent state.
  const bySovereignName = new Map()
  for (const [id, p] of props) if (independent.has(id)) bySovereignName.set(p.SOVEREIGNT, id)

  // Natural Earth capitals by country. FCLASS_JP (Japan's point of view) overrides the
  // default FEATURECLA, and populated places code South Sudan as SSD rather than SDS.
  const placeCountry = (code) => (code === 'SSD' ? 'SDS' : code)
  const neCapitals = new Map()
  for (const f of places.features) {
    const p = f.properties
    const cls = p.FCLASS_JP ?? p.FEATURECLA
    if (cls !== 'Admin-0 capital' && cls !== 'Admin-0 capital alt') continue
    const [lng, lat] = f.geometry.coordinates
    const id = placeCountry(p.ADM0_A3)
    const list = neCapitals.get(id) ?? []
    list.push({ ja: p.NAME_JA, en: p.NAME, lat: round(lat, 3), lng: round(lng, 3), rank: p.SCALERANK, primary: cls === 'Admin-0 capital' })
    neCapitals.set(id, list)
  }
  // Names follow the textbook table in data/overrides; coordinates come from Natural
  // Earth unless the table gives them. Countries not in the table keep NE's capitals.
  const capitalsFor = (id) => {
    const table = capitalOverrides.capitals[id] ?? capitalOverrides.others[id]
    const ne = neCapitals.get(id) ?? []
    if (!table) return ne.filter((c) => c.primary).map(({ primary, ...c }) => c)
    return table.map((e) => {
      const match = ne.find((c) => c.en === e.en)
      if (e.lat == null && !match) throw new Error(`capital ${id}:${e.en} not found in Natural Earth`)
      return {
        ja: e.ja,
        en: e.en,
        lat: e.lat ?? match.lat,
        lng: e.lng ?? match.lng,
        rank: match?.rank ?? 4,
        ...(e.note && { note: e.note }),
      }
    })
  }

  const info = {}
  const missing = { pop: [], area: [] }
  for (const f of ne.features) {
    const p = f.properties
    const id = p.ADM0_A3
    // independent: counted as a country in Japanese textbooks; dependency: a territory of
    // one of those; other: anything else (Taiwan, Palestine, Western Sahara, Antarctica, ...).
    const sovereignId = independent.has(id) || p.TYPE === 'Indeterminate' ? undefined : bySovereignName.get(p.SOVEREIGNT)
    const status = independent.has(id) ? 'independent' : sovereignId ? 'dependency' : 'other'

    const wbCode = wbCodes.codes[id] ?? [p.ISO_A3_EH, p.WB_A3, id].find(isSet)
    const stat = (wb, key) => {
      const manual = fallback.stats[id]?.[key]
      if (manual) return manual
      const hit = wb.byCode.get(wbCode)
      if (hit) return { value: hit.value, year: hit.year, source: WB_SOURCE }
      return null
    }

    let population = stat(pop, 'pop')
    // Antarctica has no permanent population (NE's POP_EST counts research staff).
    if (!population && id !== 'ATA' && isSet(p.POP_EST) && p.POP_EST > 0) {
      population = { value: p.POP_EST, year: p.POP_YEAR, source: `${NE_SOURCE}（POP_EST）` }
    }
    let surface = stat(area, 'area')
    if (!surface) {
      // Spherical area of the (unsimplified) polygon; shown as an approximation.
      const km2 = geoArea(f) * EARTH_RADIUS_KM ** 2
      surface = { value: Math.round(km2), source: `${NE_SOURCE}の境界線から算出`, approx: true }
    }
    if (!population) missing.pop.push(id)
    if (surface.approx) missing.area.push(id)

    const iso2 = [p.ISO_A2_EH, p.ISO_A2].find((c) => isSet(c) && /^[A-Z]{2}$/.test(c))
    info[id] = {
      ja: jaName(id),
      ...(names.names[id] && names.names[id] !== p.NAME_JA && { jaFormal: p.NAME_JA }),
      en: p.NAME_LONG,
      ...(isSet(p.FORMAL_EN) && p.FORMAL_EN !== p.NAME_LONG && { enFormal: p.FORMAL_EN }),
      ...(iso2 && { iso2: iso2.toLowerCase() }),
      status,
      ...(notRecognized.has(id) && { notRecognizedByJapan: true }),
      ...(sovereignId && { sovereign: sovereignId }),
      continent: p.CONTINENT,
      subregion: p.SUBREGION,
      label: { lat: round(p.LABEL_Y, 2), lng: round(p.LABEL_X, 2), rank: p.LABELRANK },
      capitals: capitalsFor(id),
      ...(population && { population }),
      area: surface,
    }
  }

  // Besides the listed islands, keep the island each capital is on (e.g. Tarawa).
  const capitalIslands = ne.features.flatMap((f) =>
    capitalsFor(f.properties.ADM0_A3).map((c) => ({ id: f.properties.ADM0_A3, lat: c.lat, lng: c.lng, radius: 0.3 })),
  )
  const shapes = await simplifyCountries(ne, [...keepIslands.islands, ...capitalIslands])
  await writeJson('countries.geojson', shapes)
  await writeJson('country-info.json', {
    sources: {
      boundaries: `${NE_SOURCE}（日本視点版 admin_0_countries_jpn）`,
      population: `${WB_SOURCE} SP.POP.TOTL（最終更新 ${pop.lastUpdated}）`,
      area: `${WB_SOURCE} AG.SRF.TOTL.K2（最終更新 ${area.lastUpdated}）`,
    },
    countries: info,
  })
  console.log(`countries: ${Object.keys(info).length}, independent: ${Object.values(info).filter((c) => c.status === 'independent').length}`)
  console.log(`  no population: ${missing.pop.join(' ') || '-'}`)
  console.log(`  area approximated from geometry: ${missing.area.join(' ') || '-'}`)
  const unmatchedWb = Object.entries(info)
    .filter(([, c]) => c.status === 'independent' && c.population?.source !== WB_SOURCE)
    .map(([id]) => id)
  console.log(`  independent states without World Bank population: ${unmatchedWb.join(' ') || '-'}`)
}

// ---------- physical features and lines ----------

// Longest part of a (Multi)LineString, optionally limited to parts inside a bbox.
function longestPart(geometry, bbox) {
  const parts = geometry.type === 'LineString' ? [geometry.coordinates] : geometry.coordinates
  const inBox = (part) => !bbox || part.every(([x, y]) => x >= bbox[0] && y >= bbox[1] && x <= bbox[2] && y <= bbox[3])
  let best = null
  let bestLen = -1
  for (const part of parts.filter(inBox)) {
    const len = geoLength({ type: 'LineString', coordinates: part })
    if (len > bestLen) [best, bestLen] = [part, len]
  }
  return best && { coords: best, length: bestLen }
}

async function buildRivers() {
  const [ne, dict] = await Promise.all([naturalEarth('ne_50m_rivers_lake_centerlines'), readOverride('river-names.ja.json')])
  const kept = ne.features.filter((f) => f.properties.featurecla === 'River' && f.properties.scalerank <= 5)
  const lines = kept.map((f) => ({
    type: 'Feature',
    properties: { rank: f.properties.scalerank },
    geometry: f.geometry,
  }))
  const simplified = await simplify({ type: 'FeatureCollection', features: lines }, '-simplify 30% weighted', 0.01)

  // One label per Japanese name, placed at the middle of the river's longest segment.
  const labels = new Map()
  for (const f of kept) {
    const entry = dict.rivers[f.properties.name]
    if (!entry) continue
    const part = longestPart(f.geometry, entry.labelBbox)
    if (!part) continue
    const prev = labels.get(entry.ja)
    if (prev && prev.length >= part.length) continue
    const [lng, lat] = part.coords[Math.floor(part.coords.length / 2)]
    labels.set(entry.ja, { ja: entry.ja, lat: round(lat, 2), lng: round(lng, 2), rank: f.properties.scalerank, length: part.length })
  }
  await writeJson('rivers.geojson', simplified)
  await writeJson(
    'river-labels.json',
    [...labels.values()].map(({ length, ...l }) => l),
  )
}

async function buildRanges() {
  const ne = await naturalEarth('ne_50m_geography_regions_polys')
  const seen = new Set()
  const ranges = []
  for (const f of ne.features) {
    const p = f.properties
    if (p.FEATURECLA !== 'Range/mtn' || p.SCALERANK > 3 || !p.NAME_JA || seen.has(p.NAME_JA)) continue
    seen.add(p.NAME_JA)
    const [lng, lat] = geoCentroid(f)
    ranges.push({ ja: p.NAME_JA, en: p.NAME, lat: round(lat, 2), lng: round(lng, 2), rank: p.SCALERANK })
  }
  await writeJson('ranges.json', ranges)
}

async function buildPeaks() {
  const ne = await naturalEarth('ne_10m_geography_regions_elevation_points')
  const peaks = ne.features
    .map((f) => f.properties)
    .filter((p) => p.featurecla === 'mountain' && p.name_ja && (p.scalerank <= 4 || p.elevation >= 8000))
    .map((p) => ({ ja: p.name_ja, en: p.name, elevation: p.elevation, lat: round(p.lat_y, 3), lng: round(p.long_x, 3), rank: p.scalerank }))
  await writeJson('peaks.json', peaks)
}

async function buildGeoLines() {
  const ne = await naturalEarth('ne_50m_geographic_lines')
  const lines = ne.features.map((f) => ({
    ja: f.properties.name_ja,
    en: f.properties.name,
    // [lat, lng] pairs, the order globe.gl paths use by default.
    points: (f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates).map((part) =>
      part.map(([lng, lat]) => [round(lat, 3), round(lng, 3)]),
    ),
  }))
  await writeJson('geo-lines.json', lines)
}

await fs.mkdir(OUT, { recursive: true })
await buildCountries()
await buildRivers()
await buildRanges()
await buildPeaks()
await buildGeoLines()
