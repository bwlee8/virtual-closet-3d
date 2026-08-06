import * as THREE from 'three'
import { markSRGB } from './three-compat'

export const shade = (hex, amt) => {
  const n = parseInt(hex.slice(1), 16)
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * amt)))
  return `#${[f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

/**
 * Build the cylindrical texture for one garment.
 *
 * u = 0.5 is front-centre, so the front image occupies the middle half of the
 * atlas and the back image straddles the u=0 / u=1 seam (drawn twice, once off
 * each edge). Feed it HTMLImageElement or HTMLCanvasElement — both work.
 */
export function atlasTexture({ frontImg, backImg }) {
  const W = 1024
  const H = 512
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')

  g.drawImage(frontImg, W * 0.25, 0, W * 0.5, H)

  if (backImg) {
    g.drawImage(backImg, W * 0.75, 0, W * 0.5, H)
    g.drawImage(backImg, -W * 0.25, 0, W * 0.5, H)
  } else {
    // No back photo: reuse the front, desaturated. An honest visual signal that
    // you are looking at a stand-in rather than the real back of the garment.
    g.filter = 'saturate(30%) brightness(1.14)'
    g.drawImage(frontImg, W * 0.75, 0, W * 0.5, H)
    g.drawImage(frontImg, -W * 0.25, 0, W * 0.5, H)
    g.filter = 'none'
  }

  const t = new THREE.CanvasTexture(c)
  t.wrapS = THREE.RepeatWrapping
  t.anisotropy = 4
  return markSRGB(t)
}

/** Average colour of an image — used for sleeves and trouser legs. */
export function averageColor(img) {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 64
  const g = c.getContext('2d', { willReadFrequently: true })
  g.drawImage(img, 0, 0, 64, 64)
  const d = g.getImageData(0, 0, 64, 64).data
  let r = 0, gr = 0, b = 0, n = 0
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 24) continue
    r += d[i]; gr += d[i + 1]; b += d[i + 2]; n++
  }
  if (!n) return new THREE.Color(0.7, 0.7, 0.7)
  return new THREE.Color(r / n / 255, gr / n / 255, b / n / 255)
}

/* ---------------------------------------------------------------------------
 * Procedural panel art. Only used to seed the sample closet so the app is not
 * empty on first run — your real photos replace this entirely.
 * ------------------------------------------------------------------------- */
export function panelCanvas(category, color, side) {
  const W = 512, H = 512
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')
  const dark = shade(color, 0.8)
  const darker = shade(color, 0.62)
  const light = shade(color, 1.12)
  const seam = (x1, y1, x2, y2, col, w = 3) => {
    g.strokeStyle = col; g.lineWidth = w
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke()
  }

  g.fillStyle = color
  g.fillRect(0, 0, W, H)

  if (category === 'tshirt') {
    g.fillStyle = dark
    g.beginPath(); g.ellipse(W / 2, 4, side === 'front' ? 96 : 78, side === 'front' ? 62 : 34, 0, 0, Math.PI * 2); g.fill()
    g.fillStyle = color
    g.beginPath(); g.ellipse(W / 2, -6, side === 'front' ? 88 : 70, side === 'front' ? 54 : 28, 0, 0, Math.PI * 2); g.fill()
    seam(0, H - 26, W, H - 26, dark)
  } else if (category === 'shirt') {
    g.fillStyle = dark
    g.fillRect(0, 0, W, 26)
    if (side === 'front') {
      g.fillStyle = light
      g.fillRect(W / 2 - 30, 26, 60, H - 26)
      seam(W / 2 - 30, 26, W / 2 - 30, H, dark, 2)
      seam(W / 2 + 30, 26, W / 2 + 30, H, dark, 2)
      g.fillStyle = darker
      for (let y = 78; y < H - 30; y += 78) { g.beginPath(); g.arc(W / 2, y, 8, 0, Math.PI * 2); g.fill() }
      g.strokeStyle = dark; g.lineWidth = 3
      g.strokeRect(W / 2 + 78, 84, 84, 96)
    } else {
      seam(0, 96, W, 96, dark)
      g.fillStyle = light
      g.fillRect(W / 2 - 26, 96, 52, 44)
    }
  } else if (category === 'jacket') {
    g.fillStyle = dark
    g.fillRect(0, 0, W, 30)
    if (side === 'front') {
      g.fillStyle = darker
      g.beginPath(); g.moveTo(W / 2 - 92, 24); g.lineTo(W / 2, 190); g.lineTo(W / 2 + 92, 24); g.closePath(); g.fill()
      g.fillStyle = shade(color, 0.94)
      g.beginPath(); g.moveTo(W / 2 - 92, 24); g.lineTo(W / 2 - 52, 18); g.lineTo(W / 2, 150); g.lineTo(W / 2, 190); g.closePath(); g.fill()
      g.beginPath(); g.moveTo(W / 2 + 92, 24); g.lineTo(W / 2 + 52, 18); g.lineTo(W / 2, 150); g.lineTo(W / 2, 190); g.closePath(); g.fill()
      seam(W / 2, 190, W / 2, H, darker, 5)
      g.fillStyle = dark
      g.fillRect(W / 2 - 160, 322, 92, 20)
      g.fillRect(W / 2 + 68, 322, 92, 20)
    } else {
      seam(0, 118, W, 118, dark, 4)
      seam(W / 2, 118, W / 2, H, dark, 3)
    }
  } else if (category === 'pants' || category === 'shorts') {
    g.fillStyle = shade(color, 0.9)
    g.fillRect(0, 0, W, 46)
    seam(0, 46, W, 46, darker, 3)
    g.strokeStyle = dark; g.lineWidth = 3
    if (side === 'front') {
      seam(W / 2, 46, W / 2, 150, dark, 3)
      g.beginPath(); g.moveTo(W / 2 - 190, 56); g.lineTo(W / 2 - 130, 56); g.lineTo(W / 2 - 146, 122); g.stroke()
      g.beginPath(); g.moveTo(W / 2 + 190, 56); g.lineTo(W / 2 + 130, 56); g.lineTo(W / 2 + 146, 122); g.stroke()
    } else {
      g.strokeRect(W / 2 - 176, 66, 108, 76)
      g.strokeRect(W / 2 + 68, 66, 108, 76)
    }
  } else if (category === 'shoes') {
    g.fillStyle = shade(color, 0.42)
    g.fillRect(0, H - 120, W, 120)
    if (side === 'front') {
      g.strokeStyle = shade(color, 1.4); g.lineWidth = 9
      for (let y = 96; y < 300; y += 60) {
        g.beginPath(); g.moveTo(W / 2 - 70, y); g.lineTo(W / 2 + 70, y + 18); g.stroke()
      }
    }
  }
  return c
}

export const canvasToBlob = (canvas) =>
  new Promise((res) => canvas.toBlob((b) => res(b), 'image/png'))
