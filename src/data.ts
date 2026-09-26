import type { AppData, CountryFeature, CountryInfoFile, GeoLine, PlaceLabel } from './types.ts'

const base = `${import.meta.env.BASE_URL}data/`

async function getJson<T>(name: string): Promise<T> {
  const res = await fetch(base + name)
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`)
  return res.json() as Promise<T>
}

export async function loadData(): Promise<AppData> {
  const [countries, info, rivers, riverLabels, ranges, peaks, geoLines] = await Promise.all([
    getJson<{ features: CountryFeature[] }>('countries.geojson'),
    getJson<CountryInfoFile>('country-info.json'),
    getJson<AppData['rivers']>('rivers.geojson'),
    getJson<PlaceLabel[]>('river-labels.json'),
    getJson<PlaceLabel[]>('ranges.json'),
    getJson<PlaceLabel[]>('peaks.json'),
    getJson<GeoLine[]>('geo-lines.json'),
  ])
  return { countries: countries.features, info, rivers, riverLabels, ranges, peaks, geoLines }
}
