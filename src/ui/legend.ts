import type { AppData } from '../types.ts'
import { METRICS, NO_DATA, colorFor, legendRows, metricValue, type MetricId } from '../lib/choropleth.ts'
import { h } from './dom.ts'

export function createLegend(root: HTMLElement, data: AppData, on: { select: (id: string) => void }) {
  let tableOpen = false
  let current: MetricId | null = null

  function ranking(metricId: MetricId) {
    const metric = METRICS[metricId]
    const rows = Object.entries(data.info.countries)
      .filter(([, c]) => c.status === 'independent')
      .map(([id, c]) => ({ id, c, v: metricValue(metric, id, c) }))
      .filter((r): r is typeof r & { v: number } => r.v != null)
      .sort((a, b) => b.v - a.v)
    return h(
      'div',
      { class: 'ranking' },
      h(
        'table',
        {},
        h('caption', {}, `独立国の${metric.label}ランキング（${rows.length}か国）`),
        h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, '順位'), h('th', { scope: 'col' }, '国'), h('th', { scope: 'col' }, metric.label))),
        h(
          'tbody',
          {},
          ...rows.map((r, i) =>
            h(
              'tr',
              { onclick: () => on.select(r.id) },
              h('td', { class: 'num' }, String(i + 1)),
              h(
                'td',
                {},
                h('span', { class: 'swatch', style: `background:${colorFor(metric, r.v)}` }),
                h('button', { type: 'button', class: 'link' }, r.c.ja),
              ),
              h('td', { class: 'num' }, metric.format(r.v)),
            ),
          ),
        ),
      ),
    )
  }

  function render() {
    if (!current) {
      root.hidden = true
      root.replaceChildren()
      return
    }
    const metric = METRICS[current]
    const source = current === 'area' ? data.info.sources.area : data.info.sources.population
    root.replaceChildren(
      h('h2', {}, `${metric.label}（${metric.unit}）`),
      h(
        'ul',
        { class: 'legend-rows' },
        ...legendRows(metric)
          .reverse()
          .map((r) => h('li', {}, h('span', { class: 'swatch', style: `background:${r.color}` }), r.label)),
        h('li', {}, h('span', { class: 'swatch', style: `background:${NO_DATA}` }), 'データなし'),
      ),
      h('p', { class: 'legend-source' }, current === 'density' ? `${data.info.sources.population} ÷ ${data.info.sources.area}` : source),
      h(
        'button',
        {
          type: 'button',
          class: 'toggle-table',
          'aria-expanded': String(tableOpen),
          onclick: () => {
            tableOpen = !tableOpen
            render()
          },
        },
        tableOpen ? '一覧を閉じる' : 'ランキング一覧',
      ),
      ...(tableOpen ? [ranking(current)] : []),
    )
    root.hidden = false
  }

  return {
    set(metric: MetricId | null) {
      current = metric
      render()
    },
  }
}
