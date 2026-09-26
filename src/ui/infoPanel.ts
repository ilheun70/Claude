import type { AppData, CountryInfo, Stat } from '../types.ts'
import { METRICS, metricValue, type MetricId } from '../lib/choropleth.ts'
import { continentJa, subregionJa } from '../lib/regions.ts'
import { h } from './dom.ts'

function statusText(c: CountryInfo, data: AppData): string {
  if (c.status === 'independent') {
    return c.notRecognizedByJapan ? '独立国（日本は国家として承認していない）' : '独立国'
  }
  if (c.status === 'dependency' && c.sovereign) return `地域（主権国：${data.info.countries[c.sovereign].ja}）`
  return '地域'
}

function regionText(c: CountryInfo): string {
  const continent = continentJa(c.continent)
  const sub = subregionJa(c.subregion)
  return sub === continent ? continent : `${continent}（${sub}）`
}

function sourceText(s: Stat): string {
  return [s.year ? `${s.year}年` : '', s.source].filter(Boolean).join('・')
}

/** Rank among independent states, 1 = largest. */
function rankings(data: AppData) {
  const independent = Object.entries(data.info.countries).filter(([, c]) => c.status === 'independent')
  const ranks = {} as Record<MetricId, { rank: Map<string, number>; total: number }>
  for (const metric of Object.values(METRICS)) {
    const values = independent
      .map(([id, c]) => [id, metricValue(metric, id, c)] as const)
      .filter((e): e is readonly [string, number] => e[1] != null)
      .sort((a, b) => b[1] - a[1])
    ranks[metric.id] = { rank: new Map(values.map(([id], i) => [id, i + 1])), total: values.length }
  }
  return ranks
}

export function createInfoPanel(
  root: HTMLElement,
  data: AppData,
  on: { close: () => void; flyTo: (lat: number, lng: number) => void },
) {
  const ranks = rankings(data)

  function statRow(metricId: MetricId, id: string, c: CountryInfo, source?: Stat) {
    const metric = METRICS[metricId]
    const v = metric.value(c)
    const r = ranks[metricId].rank.get(id)
    return h(
      'div',
      { class: 'stat' },
      h('dt', {}, metric.label),
      h(
        'dd',
        {},
        h('span', { class: 'stat-value' }, v == null ? 'データなし' : `${source?.approx ? '約' : ''}${metric.format(v)}`),
        r ? h('span', { class: 'stat-rank' }, `独立国${ranks[metricId].total}か国中 ${r}位`) : null,
        source && h('span', { class: 'stat-source' }, source.approx ? `${source.source}（概算）` : sourceText(source)),
        metricId === 'density' && v != null && h('span', { class: 'stat-source' }, '人口 ÷ 面積で算出'),
      ),
    )
  }

  function show(id: string) {
    const c = data.info.countries[id]
    if (!c) return
    const capitalTerm = c.status === 'independent' ? '首都' : '中心都市'
    root.replaceChildren(
      h(
        'div',
        { class: 'panel-head' },
        c.iso2 && h('span', { class: `fi fi-${c.iso2} flag`, role: 'img', 'aria-label': `${c.ja}の旗` }),
        h(
          'div',
          { class: 'names' },
          h('h2', {}, c.ja),
          c.jaFormal && h('p', { class: 'formal' }, c.jaFormal),
          h('p', { class: 'en' }, c.enFormal ?? c.en),
        ),
        h('button', { class: 'close', type: 'button', 'aria-label': '閉じる', onclick: () => on.close() }, '×'),
      ),
      h(
        'dl',
        { class: 'facts' },
        h('div', { class: 'stat' }, h('dt', {}, '区分'), h('dd', {}, statusText(c, data))),
        h('div', { class: 'stat' }, h('dt', {}, '大陸'), h('dd', {}, regionText(c))),
        c.capitals.length > 0 &&
          h(
            'div',
            { class: 'stat' },
            h('dt', {}, capitalTerm),
            h(
              'dd',
              {},
              ...c.capitals.map((cap) =>
                h(
                  'span',
                  { class: 'capital' },
                  h('button', { type: 'button', class: 'link', onclick: () => on.flyTo(cap.lat, cap.lng) }, cap.ja),
                  cap.note && h('span', { class: 'stat-source' }, cap.note),
                ),
              ),
            ),
          ),
        statRow('population', id, c, c.population),
        statRow('area', id, c, c.area),
        statRow('density', id, c),
      ),
    )
    root.hidden = false
  }

  function hide() {
    root.hidden = true
    root.replaceChildren()
  }

  return { show, hide }
}
