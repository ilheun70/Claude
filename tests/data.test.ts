// Checks the generated files in public/data (run `npm run data` after changing the build).
import fs from 'node:fs'
import path from 'node:path'
import { geoArea, geoCentroid, geoContains, geoDistance } from 'd3-geo'
import { describe, expect, it } from 'vitest'
import type { CountryFeature, CountryInfoFile } from '../src/types.ts'

const dir = path.resolve(import.meta.dirname, '../public/data')
const read = <T>(name: string): T => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')) as T

const shapes = read<{ features: CountryFeature[] }>('countries.geojson').features
const { countries } = read<CountryInfoFile>('country-info.json')
const shapeOf = (id: string) => shapes.find((f) => f.properties.id === id)!
const polygonsOf = (f: CountryFeature) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates)
const degrees = (a: [number, number], b: [number, number]) => (geoDistance(a, b) * 180) / Math.PI

/** Whether the country has a polygon whose center lies within `maxDeg` of the point. */
const hasIslandNear = (id: string, lng: number, lat: number, maxDeg = 0.3) =>
  polygonsOf(shapeOf(id)).some((rings) => degrees(geoCentroid({ type: 'Polygon', coordinates: rings }), [lng, lat]) <= maxDeg)

describe('countries', () => {
  const independent = Object.entries(countries).filter(([, c]) => c.status === 'independent')

  it('counts 197 independent states as Japanese textbooks do', () => {
    expect(independent).toHaveLength(197)
    expect(countries.PRK.notRecognizedByJapan).toBe(true)
    for (const id of ['VAT', 'KOS', 'COK', 'NIU']) expect(countries[id].status).toBe('independent')
    expect(countries.TWN.status).toBe('other')
  })

  it('gives every independent state a name, capital, population and area', () => {
    for (const [id, c] of independent) {
      expect(c.ja, id).toBeTruthy()
      expect(c.capitals.length, id).toBeGreaterThan(0)
      expect(c.population?.value, id).toBeGreaterThan(0)
      expect(c.area.value, id).toBeGreaterThan(0)
    }
  })

  it('has a shape for every country entry', () => {
    expect(new Set(shapes.map((f) => f.properties.id))).toEqual(new Set(Object.keys(countries)))
  })

  it('winds every polygon clockwise (d3/globe.gl convention)', () => {
    // A polygon wound the other way covers the rest of the sphere.
    for (const f of shapes) expect(geoArea(f), f.properties.id).toBeLessThan(2 * Math.PI)
  })

  it('places capitals in or next to their country', () => {
    for (const [id, c] of Object.entries(countries)) {
      const shape = shapeOf(id)
      for (const cap of c.capitals) {
        const p: [number, number] = [cap.lng, cap.lat]
        const near = geoContains(shape, p) || polygonsOf(shape).some((rings) => rings[0].some((v) => degrees(v as [number, number], p) < 0.5))
        expect(near, `${id} ${cap.ja}`).toBe(true)
      }
    }
  })
})

describe("borders follow Japan's point of view", () => {
  it('draws the Northern Territories, Takeshima and the Senkaku Islands as Japan', () => {
    expect(geoContains(shapeOf('JPN'), [147.9, 45.0])).toBe(true) // 択捉島
    expect(hasIslandNear('JPN', 146.75, 43.8)).toBe(true) // 色丹島
    expect(hasIslandNear('JPN', 131.867, 37.242, 0.05)).toBe(true) // 竹島
    expect(hasIslandNear('JPN', 123.5, 25.75)).toBe(true) // 尖閣諸島
    expect(hasIslandNear('KOR', 131.867, 37.242)).toBe(false)
    expect(geoContains(shapeOf('RUS'), [147.9, 45.0])).toBe(false)
  })

  it('draws Crimea as Ukraine', () => {
    expect(geoContains(shapeOf('UKR'), [34.1, 44.95])).toBe(true)
    expect(geoContains(shapeOf('RUS'), [34.1, 44.95])).toBe(false)
  })
})

describe('size', () => {
  it('keeps the data small enough for phones', () => {
    const total = fs.readdirSync(dir).reduce((n, f) => n + fs.statSync(path.join(dir, f)).size, 0)
    expect(fs.statSync(path.join(dir, 'countries.geojson')).size).toBeLessThan(800 * 1024)
    expect(total).toBeLessThan(1200 * 1024)
  })
})
