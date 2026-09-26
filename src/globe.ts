import Globe, { type GlobeInstance } from 'globe.gl'
import { OCEAN } from './lib/choropleth.ts'

const EARTH_TEXTURE = `${import.meta.env.BASE_URL}textures/earth.jpg`

/** A 1×1 image of the ocean color, used as the globe surface in choropleth mode. */
function solidTexture(color: string): string {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = color
  ctx.fillRect(0, 0, 1, 1)
  return canvas.toDataURL()
}

/**
 * Camera altitude (in globe radii) at which the whole globe fills about 80% of the
 * narrower screen dimension. globe.gl's camera has a 50° vertical field of view.
 */
export function fitAltitude(width: number, height: number): number {
  const halfV = 25 * (Math.PI / 180)
  const halfH = Math.atan(Math.tan(halfV) * (width / height))
  return 1 / Math.sin(0.8 * Math.min(halfV, halfH)) - 1
}

export const homeView = (el: HTMLElement) => ({ lat: 30, lng: 138, altitude: fitAltitude(el.clientWidth, el.clientHeight) })

export function createGlobe(container: HTMLElement): GlobeInstance {
  const globe = new Globe(container, { animateIn: false })
    .globeImageUrl(EARTH_TEXTURE)
    .backgroundColor('#05070d')
    .showAtmosphere(true)
    .atmosphereColor('#8fbcff')
    .atmosphereAltitude(0.14)
    .showGraticules(true)
    .pointOfView(homeView(container))

  // The globe radius is 100 scene units, so these clamp the altitude to 0.1–6 radii.
  const controls = globe.controls()
  controls.minDistance = 110
  controls.maxDistance = 700
  controls.zoomSpeed = 1.2

  const resize = () => globe.width(container.clientWidth).height(container.clientHeight)
  new ResizeObserver(resize).observe(container)
  resize()
  return globe
}

const plainSurface = solidTexture(OCEAN)

export function setSurface(globe: GlobeInstance, mode: 'terrain' | 'plain') {
  globe.globeImageUrl(mode === 'terrain' ? EARTH_TEXTURE : plainSurface)
}
