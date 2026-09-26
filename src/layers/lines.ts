import type { GlobeInstance } from 'globe.gl'
import type { AppData } from '../types.ts'
import type { CountryView } from './countries.ts'

type LineKind = 'river' | 'geo-line'

interface LineDatum {
  kind: LineKind
  /** [lat, lng] pairs. */
  points: [number, number][]
  equator?: boolean
}

export interface LineToggles {
  rivers: boolean
  geoLines: boolean
}

function riverLines(data: AppData): LineDatum[] {
  const out: LineDatum[] = []
  for (const f of data.rivers.features) {
    const parts = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates
    for (const part of parts) out.push({ kind: 'river', points: part.map(([lng, lat]) => [lat, lng]) })
  }
  return out
}

function geoLines(data: AppData): LineDatum[] {
  const out: LineDatum[] = data.geoLines.flatMap((l) =>
    l.points.map((points) => ({ kind: 'geo-line' as const, points, equator: l.en === 'Equator' })),
  )
  // Natural Earth has no prime meridian line; add one.
  const meridian: [number, number][] = []
  for (let lat = -90; lat <= 90; lat += 2) meridian.push([lat, 0])
  out.push({ kind: 'geo-line', points: meridian })
  return out
}

export function setupLines(globe: GlobeInstance, data: AppData, toggles: LineToggles, view: CountryView) {
  const rivers = riverLines(data)
  const lines = geoLines(data)
  const kindOf = (d: object) => (d as LineDatum).kind

  globe
    .pathPoints((d) => (d as LineDatum).points)
    .pathPointAlt(0.007) // just above the country polygons (0.005)
    .pathStroke(null)
    .pathDashLength((d) => (kindOf(d) === 'river' ? 1 : 0.012))
    .pathDashGap((d) => (kindOf(d) === 'river' ? 0 : 0.006))
    .pathTransitionDuration(0)

  function refresh() {
    // On the blue choropleth, blue rivers would read as data; draw them in white.
    const river = view.metric ? 'rgba(255,255,255,0.55)' : 'rgba(120,190,255,0.9)'
    globe.pathColor((d: object) => (kindOf(d) === 'river' ? river : (d as LineDatum).equator ? '#ff9f6b' : '#ffd166'))
    globe.pathsData([...(toggles.rivers ? rivers : []), ...(toggles.geoLines ? lines : [])])
  }
  refresh()
  return { refresh }
}
