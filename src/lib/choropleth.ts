import type { CountryInfo } from '../types.ts'
import { formatArea, formatDensity, formatPopulation, jaCompact } from './format.ts'

export type MetricId = 'population' | 'area' | 'density'

export interface Metric {
  id: MetricId
  label: string
  unit: string
  value: (c: CountryInfo) => number | undefined
  format: (v: number) => string
  /** Class breaks, ascending. n breaks make n + 1 classes. */
  breaks: number[]
}

// Sequential blue ramp (steps 250-650 of the reference palette), light to dark.
// Validated as an ordinal ramp against the choropleth ocean color below.
export const RAMP = ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#104281']
export const OCEAN = '#fcfcfb'
export const NO_DATA = '#898781'

const density = (c: CountryInfo) =>
  c.population && c.area.value > 0 ? c.population.value / c.area.value : undefined

export const METRICS: Record<MetricId, Metric> = {
  population: {
    id: 'population',
    label: '人口',
    unit: '人',
    value: (c) => c.population?.value,
    format: formatPopulation,
    breaks: [1e6, 1e7, 5e7, 1e8],
  },
  area: {
    id: 'area',
    label: '面積',
    unit: 'km²',
    value: (c) => c.area.value,
    format: formatArea,
    breaks: [1e4, 1e5, 5e5, 2e6],
  },
  density: {
    id: 'density',
    label: '人口密度',
    unit: '人/km²',
    value: density,
    format: formatDensity,
    breaks: [25, 50, 100, 300],
  },
}

/** Antarctica has no permanent population; comparing it would only distort the map. */
const EXCLUDED = new Set(['ATA'])

export function metricValue(metric: Metric, id: string, c: CountryInfo): number | undefined {
  if (EXCLUDED.has(id)) return undefined
  const v = metric.value(c)
  return v != null && Number.isFinite(v) ? v : undefined
}

export function classIndex(metric: Metric, v: number): number {
  let i = 0
  while (i < metric.breaks.length && v >= metric.breaks[i]) i++
  return i
}

export function colorFor(metric: Metric, v: number | undefined): string {
  return v == null ? NO_DATA : RAMP[classIndex(metric, v)]
}

/** Legend rows from the lowest class to the highest. */
export function legendRows(metric: Metric): { color: string; label: string }[] {
  const b = metric.breaks
  return RAMP.map((color, i) => {
    let label: string
    if (i === 0) label = `${jaCompact(b[0])}未満`
    else if (i === b.length) label = `${jaCompact(b[i - 1])}以上`
    else label = `${jaCompact(b[i - 1])}〜${jaCompact(b[i])}`
    return { color, label }
  })
}
