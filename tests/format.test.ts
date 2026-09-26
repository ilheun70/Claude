import { describe, expect, it } from 'vitest'
import { formatArea, formatDensity, formatPopulation, jaCompact, jaUnits } from '../src/lib/format.ts'

describe('jaUnits', () => {
  it('keeps small numbers with digit grouping', () => {
    expect(jaUnits(7469)).toBe('7,469')
    expect(jaUnits(0)).toBe('0')
  })

  it('uses 万 and 億 and keeps every digit', () => {
    expect(jaUnits(123366734)).toBe('1億2336万6734')
    expect(jaUnits(10000)).toBe('1万')
    expect(jaUnits(100000000)).toBe('1億')
    expect(jaUnits(1406585000)).toBe('14億658万5000')
  })
})

describe('jaCompact', () => {
  it('shortens for legends', () => {
    expect(jaCompact(1e8)).toBe('1億')
    expect(jaCompact(123366734)).toBe('1.2億')
    expect(jaCompact(1.4e9)).toBe('14億')
    expect(jaCompact(5347896)).toBe('535万')
    expect(jaCompact(300)).toBe('300')
  })
})

describe('formatters', () => {
  it('adds units', () => {
    expect(formatPopulation(123366734)).toBe('1億2336万6734人')
    expect(formatArea(377969.27)).toBe('37万7969 km²')
    expect(formatArea(0.4)).toBe('0.4 km²')
    expect(formatDensity(326.4)).toBe('326 人/km²')
    expect(formatDensity(0.14)).toBe('0.1 人/km²')
  })
})
