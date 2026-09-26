const group = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 0 })

/**
 * Writes a number with Japanese 万/億/兆 units, keeping every digit:
 * 123366734 → "1億2336万6734". Values below 1万 use digit grouping ("7,469").
 */
export function jaUnits(n: number): string {
  const v = Math.round(n)
  if (Math.abs(v) < 10_000) return group.format(v)
  const units: [number, string][] = [
    [1e12, '兆'],
    [1e8, '億'],
    [1e4, '万'],
  ]
  let rest = Math.abs(v)
  let out = v < 0 ? '-' : ''
  for (const [size, name] of units) {
    const q = Math.floor(rest / size)
    if (q > 0) out += `${q}${name}`
    rest -= q * size
  }
  return rest > 0 ? out + rest : out
}

/** Short form for legends: 123366734 → "1.2億", 5347896 → "535万". */
export function jaCompact(n: number): string {
  if (n >= 1e8) return `${+(n / 1e8).toFixed(n < 1e9 ? 1 : 0)}億`
  if (n >= 1e4) return `${Math.round(n / 1e4)}万`
  if (n >= 10) return group.format(Math.round(n))
  return n.toLocaleString('ja-JP', { maximumFractionDigits: 1 })
}

export function formatPopulation(n: number): string {
  return `${jaUnits(n)}人`
}

export function formatArea(km2: number): string {
  if (km2 < 10) return `${km2.toLocaleString('ja-JP', { maximumFractionDigits: 2 })} km²`
  return `${jaUnits(km2)} km²`
}

export function formatDensity(perKm2: number): string {
  const digits = perKm2 < 10 ? 1 : 0
  return `${perKm2.toLocaleString('ja-JP', { maximumFractionDigits: digits, minimumFractionDigits: digits })} 人/km²`
}
