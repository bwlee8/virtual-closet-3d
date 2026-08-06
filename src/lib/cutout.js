// Removes a plain background from a garment photo, entirely in the browser.
// Flood-fills inward from the border and drops pixels close to the sampled
// background colour, then feathers the edge and crops transparent margins.
//
// Good on a wall, floor, or bed. Fails on busy backgrounds — hence the
// tolerance slider and the "keep original" escape hatch in the UI.
//
// To upgrade later, swap removeBackground for @imgly/background-removal (a
// segmentation model via WASM, still no server). Keep this signature:
//   (HTMLImageElement, number) => Promise<Blob>

const MAX_EDGE = 1000

export function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => res(img)
    img.onerror = () => rej(new Error('That image could not be read. Try a JPG or PNG.'))
    img.src = src
  })
}

export async function loadImageFromFile(file) {
  const url = URL.createObjectURL(file)
  try {
    return await loadImage(url)
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }
}

export function toCanvas(img, maxEdge = MAX_EDGE) {
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = Math.round(img.width * scale)
  c.height = Math.round(img.height * scale)
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
  return c
}

export function removeBackground(img, tolerance = 42) {
  const canvas = toCanvas(img)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const W = canvas.width
  const H = canvas.height
  const image = ctx.getImageData(0, 0, W, H)
  const d = image.data

  const seeds = []
  const push = (x, y) => seeds.push((y * W + x) * 4)
  for (let x = 0; x < W; x += Math.max(1, (W / 40) | 0)) { push(x, 0); push(x, H - 1) }
  for (let y = 0; y < H; y += Math.max(1, (H / 40) | 0)) { push(0, y); push(W - 1, y) }

  const cols = seeds.map((i) => [d[i], d[i + 1], d[i + 2]])
  const tol = tolerance * 3
  const near = (i) =>
    cols.some((c) => Math.abs(d[i] - c[0]) + Math.abs(d[i + 1] - c[1]) + Math.abs(d[i + 2] - c[2]) <= tol)

  const visited = new Uint8Array(W * H)
  const clear = new Uint8Array(W * H)
  const stack = []
  for (const idx of seeds) {
    const px = idx / 4
    if (!visited[px]) { visited[px] = 1; stack.push(px) }
  }

  while (stack.length) {
    const px = stack.pop()
    if (!near(px * 4)) continue
    clear[px] = 1
    const x = px % W
    const y = (px / W) | 0
    const n = [x > 0 ? px - 1 : -1, x < W - 1 ? px + 1 : -1, y > 0 ? px - W : -1, y < H - 1 ? px + W : -1]
    for (const p of n) {
      if (p >= 0 && !visited[p]) { visited[p] = 1; stack.push(p) }
    }
  }

  for (let px = 0; px < W * H; px++) if (clear[px]) d[px * 4 + 3] = 0
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const px = y * W + x
      if (clear[px]) continue
      const e = clear[px - 1] + clear[px + 1] + clear[px - W] + clear[px + W]
      if (e) d[px * 4 + 3] = 255 - e * 45
    }
  }
  ctx.putImageData(image, 0, 0)
  return trim(canvas)
}

function trim(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const W = canvas.width
  const H = canvas.height
  const d = ctx.getImageData(0, 0, W, H).data
  let minX = W, minY = H, maxX = 0, maxY = 0, found = false
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (d[(y * W + x) * 4 + 3] > 12) {
        found = true
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (!found) return canvas
  const out = document.createElement('canvas')
  out.width = Math.max(1, maxX - minX + 1)
  out.height = Math.max(1, maxY - minY + 1)
  out.getContext('2d').drawImage(canvas, minX, minY, out.width, out.height, 0, 0, out.width, out.height)
  return out
}

/** Fit an image into a square panel — this is what wraps the mesh. */
export function panelFrom(source, size = 512) {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const g = c.getContext('2d')
  const s = Math.min(size / source.width, size / source.height)
  const w = source.width * s
  const h = source.height * s
  g.drawImage(source, (size - w) / 2, (size - h) / 2, w, h)
  return c
}
