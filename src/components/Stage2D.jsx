import { useEffect, useRef } from 'react'
import { bodySpec, torsoAt, legRadiusAt } from '../lib/body'
import { CATEGORIES, DEFAULT_FIT } from '../lib/layers'

/* Flat paper-doll renderer. Draws the exact same measurement-driven body
 * model as Stage3D (same bodySpec/torsoAt/legRadiusAt math), just projected
 * straight-on with plain canvas 2D instead of lofted into a WebGL mesh.
 * Garments are their own cutout photos, stretched over the body region their
 * category occupies, same landmarks (hem/sleeve/puff/off) as the 3D build.
 *
 * Parked for a return to 3D: Stage3D.jsx is untouched, still imports three.js,
 * and takes the same props. Swapping the import in App.jsx switches back. */

const SKIN = '#dad7d0'
const SKIN_SHADE = '#c7c3ba'
const GUIDE = '#a6741a'

/** Mirrored tube outline: left side up one edge, right side down the other. */
function tubePath(ctx, pts, centerXm, px, py) {
  ctx.beginPath()
  pts.forEach((p, i) => {
    const x = px(centerXm - p.r)
    const y = py(p.y)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  for (let i = pts.length - 1; i >= 0; i--) {
    ctx.lineTo(px(centerXm + pts[i].r), py(pts[i].y))
  }
  ctx.closePath()
}

/* Photos are stored letterboxed into a square panel (the 3D build needs square
 * textures to wrap). Stretching that whole square onto the body squeezes the
 * garment into a strip with transparent margins, so the 2D stage draws only
 * the visible pixels. Cached per image, since scanning is per-pixel. */
const bounds = new WeakMap()
function contentBox(img) {
  let box = bounds.get(img)
  if (box) return box
  const w = img.naturalWidth || img.width
  const h = img.naturalHeight || img.height
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d', { willReadFrequently: true })
  g.drawImage(img, 0, 0)
  const data = g.getImageData(0, 0, w, h).data
  let minX = w, minY = h, maxX = -1, maxY = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 16) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  box = maxX < 0 ? { sx: 0, sy: 0, sw: w, sh: h } : { sx: minX, sy: minY, sw: maxX - minX + 1, sh: maxY - minY + 1 }
  bounds.set(img, box)
  return box
}

/** drawImage of just the garment's visible pixels into the given rect. */
function drawGarment(ctx, img, x, y, w, h) {
  const b = contentBox(img)
  ctx.drawImage(img, b.sx, b.sy, b.sw, b.sh, x, y, w, h)
}

export default function Stage2D({ measurements, garments, rotation, showGuides, dragHandlers }) {
  const mount = useRef(null)
  const draw = useRef(() => {})
  // Props read inside the rAF-driven rotation subscriber, so they must not be stale closures.
  const state = useRef({})
  state.current = { measurements, garments, showGuides }

  useEffect(() => {
    const el = mount.current
    const canvas = document.createElement('canvas')
    el.appendChild(canvas)
    const ctx = canvas.getContext('2d')

    draw.current = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      if (!w || !h) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const pxW = Math.round(w * dpr)
      const pxH = Math.round(h * dpr)
      if (canvas.width !== pxW || canvas.height !== pxH) {
        canvas.width = pxW
        canvas.height = pxH
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      const { measurements: m, garments: gs, showGuides: guides } = state.current
      const spec = bodySpec(m)
      const scale = (h * 0.86) / spec.H
      const originX = w / 2
      const groundPx = h * 0.94
      const px = (x) => originX + x * scale
      const py = (y) => groundPx - y * scale

      const angle = rotation.value.current
      const isBack = angle > 90 && angle < 270

      // --- mannequin ---
      ctx.fillStyle = SKIN
      tubePath(ctx, spec.torso.map((r) => ({ y: r.y, r: r.rx })), 0, px, py)
      ctx.fill()

      ctx.beginPath()
      ctx.ellipse(px(0), py(spec.head.cy), spec.head.rx * scale, spec.head.ry * scale, 0, 0, Math.PI * 2)
      ctx.fill()

      for (const side of [-1, 1]) {
        tubePath(ctx, [
          { y: spec.arm.top - spec.arm.len, r: spec.arm.r1 },
          { y: spec.arm.top, r: spec.arm.r0 },
        ], side * spec.arm.x, px, py)
        ctx.fill()

        const legPts = []
        for (let i = 0; i <= 6; i++) {
          const yy = spec.leg.top - (spec.leg.len * i) / 6
          legPts.push({ y: yy, r: legRadiusAt(spec, yy) })
        }
        tubePath(ctx, legPts, side * spec.leg.x, px, py)
        ctx.fill()

        ctx.fillStyle = SKIN_SHADE
        ctx.fillRect(
          px(side * spec.leg.x - spec.foot.w / 2),
          py(spec.foot.y),
          spec.foot.w * scale,
          spec.foot.h * scale
        )
        ctx.fillStyle = SKIN
      }

      // --- garments, outermost drawn last so it paints over inner layers ---
      for (const g of gs) {
        const cfg = CATEGORIES[g.category]
        if (!cfg || !g.frontImg) continue
        const fit = { ...DEFAULT_FIT, ...(g.fit || {}) }
        const off = cfg.off * fit.scale
        const puff = 1 + (cfg.puff - 1) * fit.scale

        // No back photo: fall back to the front, desaturated — an honest
        // signal you're looking at a stand-in, same call as the 3D atlas.
        const img = isBack && g.backImg ? g.backImg : g.frontImg
        const standIn = isBack && !g.backImg
        if (standIn) ctx.filter = 'saturate(30%) brightness(1.14)'

        if (cfg.kind === 'top') {
          const hemY = spec.y(cfg.hem * fit.length) + fit.drop
          const topY = spec.y(0.842) + fit.drop
          let halfW = torsoAt(spec, (hemY + topY) / 2).rx * puff + off
          if (cfg.sleeve > 0.02) {
            const reach = (spec.arm.x + spec.arm.r0) * (0.55 + 0.45 * cfg.sleeve) * puff + off
            halfW = Math.max(halfW, reach)
          }
          drawGarment(ctx, img, px(-halfW), py(topY), halfW * 2 * scale, py(hemY) - py(topY))
        } else if (cfg.kind === 'bottom') {
          const waistY = spec.y(0.635) + fit.drop
          const hemY = spec.y(cfg.hem * (2 - fit.length))
          // Widest point is the hips, not the waistband, and the legs splay out
          // to leg.x + r0 — size to whichever reaches further.
          const halfW = Math.max(spec.hipR, spec.leg.x + spec.leg.r0) * puff + off
          drawGarment(ctx, img, px(-halfW), py(waistY), halfW * 2 * scale, py(hemY) - py(waistY))
        } else if (cfg.kind === 'feet') {
          const halfW = spec.leg.x + spec.foot.w * 1.1 * puff
          const topY = spec.foot.y + spec.foot.h * 0.7
          const botY = spec.foot.y - spec.foot.h * 1.1 * puff
          drawGarment(ctx, img, px(-halfW), py(topY), halfW * 2 * scale, py(botY) - py(topY))
        }
        if (standIn) ctx.filter = 'none'
      }

      // --- measurement guides ---
      if (guides) {
        ctx.strokeStyle = GUIDE
        ctx.lineWidth = 1
        ctx.setLineDash([4, 3])
        for (const f of [0.745, 0.625, 0.54]) {
          const yy = spec.y(f)
          const r = torsoAt(spec, yy).rx + 0.012
          ctx.beginPath()
          ctx.moveTo(px(-r), py(yy))
          ctx.lineTo(px(r), py(yy))
          ctx.stroke()
        }
        ctx.setLineDash([])
      }
    }

    const ro = new ResizeObserver(() => draw.current())
    ro.observe(el)
    draw.current()

    return () => {
      ro.disconnect()
      if (canvas.parentNode === el) el.removeChild(canvas)
    }
  }, [rotation])

  // Rebuild on body/outfit/guide changes — cheap enough to just redraw whole.
  useEffect(() => { draw.current() }, [measurements, garments, showGuides])

  // Rotation lives outside React state (see useRotation); subscribe to repaint
  // on every frame it actually changes, same contract Stage3D relies on.
  useEffect(() => rotation.subscribe(() => draw.current()), [rotation])

  return <div ref={mount} style={{ width: '100%', height: '100%' }} {...dragHandlers} />
}
