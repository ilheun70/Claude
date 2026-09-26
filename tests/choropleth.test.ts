import { describe, expect, it } from 'vitest'
import { METRICS, NO_DATA, RAMP, classIndex, colorFor, legendRows, metricValue } from '../src/lib/choropleth.ts'
import type { CountryInfo } from '../src/types.ts'

const country = (population: number | undefined, area: number): CountryInfo => ({
  ja: 'テスト',
  en: 'Test',
  status: 'independent',
  continent: 'Asia',
  subregion: 'Eastern Asia',
  label: { lat: 0, lng: 0, rank: 2 },
  capitals: [],
  ...(population != null && { population: { value: population, source: 'test' } }),
  area: { value: area, source: 'test' },
})

describe('classes', () => {
  it('has one ramp color per class', () => {
    for (const metric of Object.values(METRICS)) expect(metric.breaks.length + 1).toBe(RAMP.length)
  })

  it('puts break values in the upper class', () => {
    const pop = METRICS.population
    expect(classIndex(pop, 999_999)).toBe(0)
    expect(classIndex(pop, 1e6)).toBe(1)
    expect(classIndex(pop, 2e8)).toBe(RAMP.length - 1)
  })

  it('colors missing values as no data', () => {
    expect(colorFor(METRICS.population, undefined)).toBe(NO_DATA)
    expect(colorFor(METRICS.population, 5e7)).toBe(RAMP[3])
  })

  it('labels every class', () => {
    const rows = legendRows(METRICS.population)
    expect(rows.map((r) => r.label)).toEqual(['100万未満', '100万〜1000万', '1000万〜5000万', '5000万〜1億', '1億以上'])
  })
})

describe('metricValue', () => {
  it('computes density and excludes Antarctica', () => {
    expect(metricValue(METRICS.density, 'JPN', country(1000, 10))).toBe(100)
    expect(metricValue(METRICS.density, 'XXX', country(undefined, 10))).toBeUndefined()
    expect(metricValue(METRICS.area, 'ATA', country(undefined, 1e7))).toBeUndefined()
  })
})
