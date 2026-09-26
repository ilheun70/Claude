// Japanese names for Natural Earth's CONTINENT and SUBREGION values (UN M49 subregions).

const CONTINENTS: Record<string, string> = {
  Africa: 'アフリカ',
  Antarctica: '南極',
  Asia: 'アジア',
  Europe: 'ヨーロッパ',
  'North America': '北アメリカ',
  Oceania: 'オセアニア',
  'Seven seas (open ocean)': '大洋の島々',
  'South America': '南アメリカ',
}

const SUBREGIONS: Record<string, string> = {
  Antarctica: '南極',
  'Australia and New Zealand': 'オーストラリア・ニュージーランド',
  Caribbean: 'カリブ海',
  'Central America': '中央アメリカ',
  'Central Asia': '中央アジア',
  'Eastern Africa': '東アフリカ',
  'Eastern Asia': '東アジア',
  'Eastern Europe': '東ヨーロッパ',
  Melanesia: 'メラネシア',
  Micronesia: 'ミクロネシア',
  'Middle Africa': '中部アフリカ',
  'Northern Africa': '北アフリカ',
  'Northern America': '北部アメリカ',
  'Northern Europe': '北ヨーロッパ',
  Polynesia: 'ポリネシア',
  'Seven seas (open ocean)': '大洋の島々',
  'South America': '南アメリカ',
  'South-Eastern Asia': '東南アジア',
  'Southern Africa': '南部アフリカ',
  'Southern Asia': '南アジア',
  'Southern Europe': '南ヨーロッパ',
  'Western Africa': '西アフリカ',
  'Western Asia': '西アジア',
  'Western Europe': '西ヨーロッパ',
}

export const continentJa = (name: string) => CONTINENTS[name] ?? name
export const subregionJa = (name: string) => SUBREGIONS[name] ?? name
