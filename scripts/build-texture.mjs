// Builds public/textures/earth.jpg from Natural Earth's 1:50m "Cross Blended Hypso with
// Shaded Relief and Water" raster (public domain, equirectangular WGS84).
//
//   npm run texture              # 4096 px wide
//   npm run texture -- --width 2048
//
// Behind an HTTPS proxy, run with NODE_USE_ENV_PROXY=1 so Node's fetch uses it.
import fs from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import yauzl from 'yauzl'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = path.join(ROOT, '.cache')
const URL = 'https://naciscdn.org/naturalearth/50m/raster/HYP_50M_SR_W.zip'
const ZIP = path.join(CACHE, 'HYP_50M_SR_W.zip')
const TIF = path.join(CACHE, 'HYP_50M_SR_W.tif')
const OUT = path.join(ROOT, 'public', 'textures', 'earth.jpg')

const widthArg = process.argv.indexOf('--width')
const WIDTH = widthArg > 0 ? Number(process.argv[widthArg + 1]) : 4096

async function exists(file) {
  return fs.access(file).then(
    () => true,
    () => false,
  )
}

async function download() {
  console.log(`download ${URL}`)
  const res = await fetch(URL)
  if (!res.ok || !res.body) throw new Error(`${URL}: HTTP ${res.status}`)
  await fs.mkdir(CACHE, { recursive: true })
  await pipeline(Readable.fromWeb(res.body), createWriteStream(`${ZIP}.part`))
  await fs.rename(`${ZIP}.part`, ZIP)
}

function extractTif() {
  return new Promise((resolve, reject) => {
    yauzl.open(ZIP, { lazyEntries: true }, (err, zip) => {
      if (err) return reject(err)
      zip.on('entry', (entry) => {
        if (!/\.tif$/i.test(entry.fileName)) return zip.readEntry()
        zip.openReadStream(entry, (err2, stream) => {
          if (err2) return reject(err2)
          pipeline(stream, createWriteStream(TIF)).then(() => {
            zip.close()
            resolve()
          }, reject)
        })
      })
      zip.on('end', () => reject(new Error('no .tif in archive')))
      zip.readEntry()
    })
  })
}

if (!(await exists(TIF))) {
  if (!(await exists(ZIP))) await download()
  await extractTif()
}

await fs.mkdir(path.dirname(OUT), { recursive: true })
// The source TIFF is larger than sharp's default pixel limit.
const info = await sharp(TIF, { limitInputPixels: false })
  .resize({ width: WIDTH, height: WIDTH / 2, fit: 'fill', kernel: 'lanczos3' })
  .jpeg({ quality: 82, mozjpeg: true })
  .toFile(OUT)
console.log(`wrote public/textures/earth.jpg (${info.width}x${info.height}, ${(info.size / 1024).toFixed(0)} KB)`)
