import type { GlobeInstance } from 'globe.gl'
import type { AppData } from '../types.ts'

// Labels are HTML elements rather than 3D text: globe.gl's 3D text uses a typeface
// without Japanese glyphs, while HTML labels use the system's Japanese fonts.

type LabelKind = 'country' | 'capital' | 'range' | 'peak' | 'river' | 'geo-line'

interface LabelDatum {
  kind: LabelKind
  text: string
  sub?: string
  lat: number
  lng: number
  /** Shown only while the camera altitude (in globe radii) is at or below this. */
  maxAlt: number
  countryId?: string
  rank: number
  /** Draw order; lower wins when labels overlap. */
  priority: number
  el?: HTMLElement
  w?: number
  h?: number
}

export interface LabelToggles {
  countries: boolean
  capitals: boolean
  physical: boolean
  rivers: boolean
  geoLines: boolean
}

const byRank = (rank: number, table: number[]) => table[Math.min(rank, table.length - 1)]

function buildLabels(data: AppData): LabelDatum[] {
  const labels: Omit<LabelDatum, 'priority'>[] = []
  for (const [id, c] of Object.entries(data.info.countries)) {
    labels.push({
      kind: 'country',
      text: c.ja,
      lat: c.label.lat,
      lng: c.label.lng,
      rank: c.label.rank, // Natural Earth LABELRANK: 2 (largest countries) … 10
      maxAlt: byRank(c.label.rank, [10, 10, 10, 2.6, 1.6, 1.1, 0.7, 0.45]),
      countryId: id,
    })
    for (const cap of c.capitals) {
      labels.push({
        kind: 'capital',
        text: cap.ja,
        lat: cap.lat,
        lng: cap.lng,
        rank: cap.rank,
        maxAlt: byRank(cap.rank, [1.3, 1.0, 0.8, 0.6, 0.45]),
        countryId: id,
      })
    }
  }
  for (const r of data.ranges) {
    labels.push({ kind: 'range', text: r.ja, lat: r.lat, lng: r.lng, rank: r.rank, maxAlt: byRank(r.rank, [2.2, 2.2, 1.3, 0.8]) })
  }
  for (const p of data.peaks) {
    labels.push({
      kind: 'peak',
      text: p.ja,
      sub: p.elevation ? `${p.elevation.toLocaleString('ja-JP')} m` : undefined,
      lat: p.lat,
      lng: p.lng,
      rank: p.rank,
      maxAlt: byRank(p.rank, [1.6, 1.6, 1.0, 0.6]),
    })
  }
  for (const r of data.riverLabels) {
    labels.push({ kind: 'river', text: r.ja, lat: r.lat, lng: r.lng, rank: r.rank, maxAlt: byRank(r.rank, [1.6, 1.6, 1.2, 0.9, 0.7, 0.5]) })
  }
  for (const l of data.geoLines) {
    const lat0 = l.points[0][0][0]
    if (l.en === 'International Date Line') {
      // The date line bends around island groups; label it where it runs along 180°.
      for (const target of [20, -30]) {
        const [lat, lng] = l.points.flat().reduce((a, b) => (Math.abs(b[0] - target) < Math.abs(a[0] - target) ? b : a))
        labels.push({ kind: 'geo-line', text: l.ja, lat, lng, rank: 0, maxAlt: 10 })
      }
    } else {
      for (let lng = -150; lng <= 150; lng += 60) {
        labels.push({ kind: 'geo-line', text: l.ja, lat: lat0, lng, rank: 0, maxAlt: 10 })
      }
    }
  }
  for (const lat of [20, -30]) labels.push({ kind: 'geo-line', text: '本初子午線', lat, lng: 0, rank: 0, maxAlt: 10 })
  return labels.map((l) => ({ ...l, priority: priority(l.kind, l.rank) }))
}

function createElement(d: LabelDatum): HTMLElement {
  const el = document.createElement('div')
  el.className = `label label-${d.kind}`
  const text = document.createElement('span')
  text.className = 'label-text'
  text.textContent = d.text
  el.append(text)
  if (d.sub) {
    const sub = document.createElement('span')
    sub.className = 'label-sub'
    sub.textContent = d.sub
    el.append(sub)
  }
  return el
}

// Lower draws first and wins overlaps.
function priority(kind: LabelKind, rank: number): number {
  switch (kind) {
    case 'country':
      return [10, 10, 10, 20, 30, 40][Math.min(rank, 5)] ?? 50
    case 'capital':
      return rank <= 1 ? 25 : rank <= 3 ? 45 : 60
    case 'range':
      return [35, 35, 55][rank] ?? 70
    case 'river':
      return rank <= 2 ? 50 : rank === 3 ? 65 : 80
    case 'peak':
      return rank <= 2 ? 55 : 75
    case 'geo-line':
      return 90
  }
}

const toRad = Math.PI / 180
const unit = (lat: number, lng: number): [number, number, number] => [
  Math.cos(lat * toRad) * Math.cos(lng * toRad),
  Math.cos(lat * toRad) * Math.sin(lng * toRad),
  Math.sin(lat * toRad),
]

export function setupLabels(globe: GlobeInstance, data: AppData, toggles: LabelToggles) {
  const all = buildLabels(data)
  const enabled: Record<LabelKind, () => boolean> = {
    country: () => toggles.countries,
    capital: () => toggles.capitals,
    range: () => toggles.physical,
    peak: () => toggles.physical,
    river: () => toggles.rivers,
    'geo-line': () => toggles.geoLines,
  }
  let selected: string | null = null
  let shown: LabelDatum[] = []
  // globe.gl creates label elements asynchronously, so layout has to be retried until
  // every shown label has an element that has been measured.
  let dirty = true

  globe
    .htmlLat('lat')
    .htmlLng('lng')
    .htmlAltitude(0.01)
    .htmlTransitionDuration(0)
    .htmlElement((d) => {
      const datum = d as LabelDatum
      return (datum.el ??= createElement(datum))
    })

  function update() {
    const alt = globe.pointOfView().altitude
    const next = all.filter((d) => enabled[d.kind]() && (d.maxAlt >= alt || isSelected(d)))
    if (next.length !== shown.length || next.some((d, i) => d !== shown[i])) {
      shown = next
      globe.htmlElementsData(shown)
      dirty = true
    }
    for (const d of shown) d.el?.classList.toggle('is-selected', isSelected(d))
    layout()
  }

  const isSelected = (d: LabelDatum) => d.countryId != null && d.countryId === selected && d.kind === 'country'

  // Hides labels near the horizon and labels that would overlap a more important one.
  function layout() {
    const pov = globe.pointOfView()
    const cam = unit(pov.lat, pov.lng)
    // Angular radius of the visible cap of the globe. Labels in its outer fifth are
    // hidden: foreshortening there squeezes them together along the edge.
    const horizon = Math.acos(1 / (1 + pov.altitude)) * 0.8
    const minDot = Math.cos(horizon)
    const placed: [number, number, number, number][] = []
    const order = [...shown].sort((a, b) => (isSelected(a) ? -1 : isSelected(b) ? 1 : a.priority - b.priority))
    let complete = true
    for (const d of order) {
      const el = d.el
      if (!el) {
        complete = false
        continue
      }
      const v = unit(d.lat, d.lng)
      let visible = v[0] * cam[0] + v[1] * cam[1] + v[2] * cam[2] >= minDot
      if (visible) {
        if (!d.w) {
          d.w = el.offsetWidth
          d.h = el.offsetHeight
          if (!d.w) complete = false
        }
        const w = (d.w || d.text.length * 12) / 2 + 2
        const h = (d.h || 16) / 2 + 1
        const { x, y } = globe.getScreenCoords(d.lat, d.lng, 0.01)
        const box: [number, number, number, number] = [x - w, y - h, x + w, y + h]
        visible = !placed.some((p) => box[0] < p[2] && box[2] > p[0] && box[1] < p[3] && box[3] > p[1])
        if (visible) placed.push(box)
      }
      el.classList.toggle('is-culled', !visible)
    }
    dirty = !complete
  }

  // Re-run whenever the camera moves, including during animated fly-tos.
  let last = ''
  const tick = () => {
    const pov = globe.pointOfView()
    const key = `${pov.lat.toFixed(3)},${pov.lng.toFixed(3)},${pov.altitude.toFixed(3)},${innerWidth}x${innerHeight}`
    if (key !== last) {
      last = key
      update()
    } else if (dirty) {
      layout()
    }
    requestAnimationFrame(tick)
  }
  update()
  requestAnimationFrame(tick)

  return {
    refresh: update,
    setSelected(id: string | null) {
      selected = id
      update()
    },
  }
}
