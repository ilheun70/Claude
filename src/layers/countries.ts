import { MeshBasicMaterial } from 'three'
import type { GlobeInstance } from 'globe.gl'
import type { AppData, CountryFeature } from '../types.ts'
import { METRICS, colorFor, metricValue, type MetricId } from '../lib/choropleth.ts'

export interface CountryView {
  metric: MetricId | null
  hovered: string | null
  selected: string | null
}

const materials = new Map<string, MeshBasicMaterial>()

// Unlit materials, so choropleth colors appear exactly as in the legend. A fully
// transparent cap is not drawn at all but still receives hover and click events.
function material(color: string, opacity: number): MeshBasicMaterial {
  const key = `${color}/${opacity}`
  let m = materials.get(key)
  if (!m) {
    const transparent = opacity < 1
    m = new MeshBasicMaterial({ color, transparent, opacity, depthWrite: !transparent, visible: opacity > 0 })
    materials.set(key, m)
  }
  return m
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export function setupCountries(
  globe: GlobeInstance,
  data: AppData,
  view: CountryView,
  on: { hover: (id: string | null) => void; click: (id: string) => void },
) {
  const info = data.info.countries
  const idOf = (d: object) => (d as CountryFeature).properties.id

  globe
    .polygonsData(data.countries)
    // Degrees between interpolated cap vertices; coarser values leave gaps in large
    // concave countries. (~40k triangles for the world at 3°.)
    .polygonCapCurvatureResolution(3)
    .polygonsTransitionDuration(150)
    .onPolygonHover((d) => on.hover(d ? idOf(d) : null))
    .onPolygonClick((d) => on.click(idOf(d)))

  function refresh() {
    const metric = view.metric ? METRICS[view.metric] : null
    const valueOf = (id: string) => (metric ? metricValue(metric, id, info[id]) : undefined)

    globe
      .polygonAltitude((d) => {
        const id = idOf(d)
        if (id === view.selected) return 0.02
        if (id === view.hovered) return 0.012
        return 0.005
      })
      .polygonCapMaterial((d) => {
        const id = idOf(d)
        if (metric) return material(colorFor(metric, valueOf(id)), 1)
        if (id === view.selected) return material('#ffffff', 0.35)
        if (id === view.hovered) return material('#ffffff', 0.2)
        return material('#ffffff', 0)
      })
      // Side walls only for the raised, selected country; they are costly for all 250.
      .polygonSideColor((d) => (idOf(d) === view.selected ? 'rgba(255,255,255,0.35)' : (null as unknown as string)))
      .polygonStrokeColor((d) => {
        const id = idOf(d)
        if (id === view.selected || id === view.hovered) return metric ? '#0b0b0b' : '#ffffff'
        return metric ? '#fcfcfb' : 'rgba(255,255,255,0.45)'
      })
      .polygonLabel((d) => {
        const id = idOf(d)
        const c = info[id]
        if (!c) return ''
        let line = escapeHtml(c.en)
        if (metric) {
          const v = valueOf(id)
          line = `${metric.label}：${v == null ? 'データなし' : escapeHtml(metric.format(v))}`
        }
        return `<div class="tooltip"><strong>${escapeHtml(c.ja)}</strong><span>${line}</span></div>`
      })
  }

  refresh()
  return { refresh }
}
