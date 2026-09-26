import 'flag-icons/css/flag-icons.min.css'
import './style.css'
import { loadData } from './data.ts'
import { createGlobe, homeView, setSurface } from './globe.ts'
import { setupCountries, type CountryView } from './layers/countries.ts'
import { setupLabels, type LabelToggles } from './layers/labels.ts'
import { setupLines } from './layers/lines.ts'
import { METRICS, type MetricId } from './lib/choropleth.ts'
import { createInfoPanel } from './ui/infoPanel.ts'
import { createLegend } from './ui/legend.ts'
import { h } from './ui/dom.ts'

type Toggles = LabelToggles & { graticules: boolean }

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

async function main() {
  const container = $<HTMLDivElement>('globe')
  const data = await loadData()
  const countriesInfo = data.info.countries

  const globe = createGlobe(container)
  // Exposed for debugging and for the browser checks described in CLAUDE.md.
  if (import.meta.env.DEV) Object.assign(window, { __globe: globe })
  const view: CountryView = { metric: null, hovered: null, selected: null }
  const toggles: Toggles = { countries: true, capitals: true, physical: true, rivers: true, geoLines: true, graticules: true }

  const countries = setupCountries(globe, data, view, {
    hover(id) {
      if (id === view.hovered) return
      view.hovered = id
      container.style.cursor = id ? 'pointer' : ''
      countries.refresh()
    },
    click: (id) => select(id),
  })
  const lines = setupLines(globe, data, toggles, view)
  const labels = setupLabels(globe, data, toggles)

  const info = createInfoPanel($('info'), data, {
    close: () => select(null),
    flyTo: (lat, lng) => globe.pointOfView({ lat, lng, altitude: 0.4 }, 1000),
  })
  const legend = createLegend($('legend'), data, { select: (id) => select(id) })

  // Zoom out further for larger countries so the whole country is in view.
  const altitudeFor = (area: number) => Math.min(2.2, Math.max(0.35, 0.35 + Math.sqrt(area) / 1800))

  function select(id: string | null, fly = true) {
    if (id && !countriesInfo[id]) id = null
    view.selected = id
    countries.refresh()
    labels.setSelected(id)
    if (id) {
      const c = countriesInfo[id]
      info.show(id)
      if (fly) globe.pointOfView({ lat: c.label.lat, lng: c.label.lng, altitude: altitudeFor(c.area.value) }, 1200)
    } else {
      info.hide()
    }
    const hash = id ? `#${id}` : ''
    if (location.hash !== hash) history.replaceState(null, '', hash || location.pathname + location.search)
  }

  globe.onGlobeClick(() => select(null))

  // Search by Japanese or English name.
  const names = Object.entries(countriesInfo).sort(([, a], [, b]) => a.ja.localeCompare(b.ja, 'ja'))
  $('country-list').replaceChildren(...names.map(([, c]) => h('option', { value: c.ja }, c.en)))
  const input = $<HTMLInputElement>('search-input')
  const find = (q: string) => {
    const s = q.trim().toLowerCase()
    if (!s) return null
    const exact = names.find(([, c]) => c.ja === q.trim() || c.en.toLowerCase() === s || c.enFormal?.toLowerCase() === s)
    if (exact) return exact[0]
    const partial = names.filter(([, c]) => c.ja.includes(q.trim()) || c.en.toLowerCase().includes(s))
    return partial.length === 1 ? partial[0][0] : null
  }
  const runSearch = () => {
    const id = find(input.value)
    input.setCustomValidity(id || !input.value ? '' : '見つかりませんでした')
    input.reportValidity()
    if (id) {
      select(id)
      input.blur()
    }
  }
  $('search').addEventListener('submit', (e) => {
    e.preventDefault()
    runSearch()
  })
  input.addEventListener('change', runSearch)

  // Choropleth.
  const metricSelect = $<HTMLSelectElement>('metric')
  metricSelect.addEventListener('change', () => {
    const m = (metricSelect.value || null) as MetricId | null
    view.metric = m && m in METRICS ? m : null
    setSurface(globe, view.metric ? 'plain' : 'terrain')
    countries.refresh()
    lines.refresh()
    legend.set(view.metric)
  })

  // Layer toggles.
  for (const box of document.querySelectorAll<HTMLInputElement>('input[data-toggle]')) {
    const key = box.dataset.toggle as keyof Toggles
    box.checked = toggles[key]
    box.addEventListener('change', () => {
      toggles[key] = box.checked
      if (key === 'graticules') globe.showGraticules(box.checked)
      lines.refresh()
      labels.refresh()
    })
  }

  $('home').addEventListener('click', () => {
    select(null)
    globe.pointOfView(homeView(container), 1200)
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && view.selected) select(null)
  })
  window.addEventListener('hashchange', () => select(location.hash.slice(1) || null))

  const initial = location.hash.slice(1)
  if (initial) select(initial)

  $('loading').hidden = true
}

main().catch((err) => {
  console.error(err)
  $('loading').textContent = `読み込みに失敗しました：${err instanceof Error ? err.message : String(err)}`
})
