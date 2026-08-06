import * as THREE from 'three'

// Real measurements in, drawable geometry out.
//
// The body is LOFTED, not scaled: each circumference becomes an elliptical
// cross-section at its landmark height, and the mesh is built by connecting
// those rings. Change your waist and the figure changes shape, not just size.

export const DEFAULT_MEASUREMENTS = {
  heightCm: 178,
  shoulderCm: 46,
  chestCm: 100,
  waistCm: 84,
  hipCm: 98,
  inseamCm: 81,
  footCm: 27,
}

export const MEASUREMENT_FIELDS = [
  { key: 'heightCm', label: 'Height', min: 140, max: 210, unit: 'cm' },
  { key: 'shoulderCm', label: 'Shoulder width', min: 32, max: 60, unit: 'cm' },
  { key: 'chestCm', label: 'Chest', min: 70, max: 150, unit: 'cm' },
  { key: 'waistCm', label: 'Waist', min: 55, max: 145, unit: 'cm' },
  { key: 'hipCm', label: 'Hip', min: 70, max: 150, unit: 'cm' },
  { key: 'inseamCm', label: 'Inseam', min: 55, max: 100, unit: 'cm' },
  { key: 'footCm', label: 'Foot length', min: 20, max: 34, unit: 'cm' },
]

const SEG = 44 // radial segments per ring
const smooth = (t) => t * t * (3 - 2 * t)

// circumference in cm -> apparent width in metres
const wFrom = (circ) => ((circ / Math.PI) * 1.1) / 100

function lerpRings(a, b, t) {
  const e = smooth(t)
  return { y: a.y + (b.y - a.y) * t, rx: a.rx + (b.rx - a.rx) * e, rz: a.rz + (b.rz - a.rz) * e }
}

export function subdivide(rings, n = 5) {
  const out = []
  for (let i = 0; i < rings.length - 1; i++) {
    for (let k = 0; k < n; k++) out.push(lerpRings(rings[i], rings[i + 1], k / n))
  }
  out.push(rings[rings.length - 1])
  return out
}

/**
 * Loft a stack of elliptical rings into a tube.
 * UVs are cylindrical: u = 0.5 is front-centre, so the front photo lands on the
 * chest and the back photo straddles the u=0/u=1 seam behind.
 */
export function loft(rings, { capTop = true, capBottom = true } = {}) {
  const r = [...rings]
  if (capBottom) r.unshift({ y: r[0].y - 0.004, rx: r[0].rx * 0.16, rz: r[0].rz * 0.16 })
  if (capTop) r.push({ y: r[r.length - 1].y + 0.004, rx: r[r.length - 1].rx * 0.16, rz: r[r.length - 1].rz * 0.16 })

  const pos = [], uv = [], idx = []
  const y0 = r[0].y
  const y1 = r[r.length - 1].y

  for (const ring of r) {
    for (let s = 0; s <= SEG; s++) {
      const t = s / SEG
      const a = t * Math.PI * 2 - Math.PI // t = 0.5 -> a = 0 -> +Z (front)
      pos.push(Math.sin(a) * ring.rx, ring.y, Math.cos(a) * ring.rz)
      uv.push(t, (ring.y - y0) / (y1 - y0 || 1))
    }
  }

  const row = SEG + 1
  for (let i = 0; i < r.length - 1; i++) {
    for (let s = 0; s < SEG; s++) {
      const a = i * row + s
      const b = a + row
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

export function limbRings(top, len, radiusAt, steps = 8) {
  const out = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const r = radiusAt(1 - t)
    out.push({ y: top - len * t, rx: r, rz: r })
  }
  return out.reverse()
}

export function bodySpec(m) {
  const H = m.heightCm / 100
  const y = (f) => H * f
  const chestR = wFrom(m.chestCm) / 2
  const waistR = wFrom(m.waistCm) / 2
  const hipR = wFrom(m.hipCm) / 2
  const shR = m.shoulderCm / 200
  const D = 0.66 // torso depth-to-width ratio

  const torso = [
    { y: y(0.485), rx: hipR * 0.94, rz: hipR * D * 0.9 },
    { y: y(0.54), rx: hipR, rz: hipR * D },
    { y: y(0.625), rx: waistR, rz: waistR * D },
    { y: y(0.745), rx: chestR, rz: chestR * D },
    { y: y(0.8), rx: shR * 0.97, rz: chestR * D * 0.92 },
    { y: y(0.828), rx: shR * 0.72, rz: chestR * D * 0.7 },
    { y: y(0.855), rx: H * 0.03, rz: H * 0.03 },
  ]

  const armR = chestR * 0.19
  const arm = { top: y(0.815), len: H * 0.3, r0: armR, r1: armR * 0.66, x: shR - armR * 0.55, tilt: 0.1 }
  const leg = {
    top: y(0.505),
    len: y(0.5) - y(0.045),
    r0: hipR * 0.55,
    rMid: hipR * 0.4,
    r1: hipR * 0.24,
    x: hipR * 0.46,
  }
  const head = { cy: y(1) - H * 0.064, rx: H * 0.046, ry: H * 0.064, rz: H * 0.053 }
  const foot = { y: y(0.045), len: m.footCm / 100, w: hipR * 0.44, h: H * 0.042 }

  return { H, y, torso, arm, leg, head, foot, shR, chestR, hipR }
}

/** Torso radius at an arbitrary height — used to build garment tubes over the body. */
export function torsoAt(spec, yy) {
  const t = spec.torso
  if (yy <= t[0].y) return { rx: t[0].rx, rz: t[0].rz }
  for (let i = 0; i < t.length - 1; i++) {
    if (yy <= t[i + 1].y) {
      const e = smooth((yy - t[i].y) / (t[i + 1].y - t[i].y))
      return {
        rx: t[i].rx + (t[i + 1].rx - t[i].rx) * e,
        rz: t[i].rz + (t[i + 1].rz - t[i].rz) * e,
      }
    }
  }
  const last = t[t.length - 1]
  return { rx: last.rx, rz: last.rz }
}

/** Leg radius at a given height, matching the taper used for the limb mesh. */
export function legRadiusAt(spec, yy) {
  const t = (yy - (spec.leg.top - spec.leg.len)) / spec.leg.len
  return t > 0.5
    ? spec.leg.r0 + (spec.leg.rMid - spec.leg.r0) * ((1 - t) * 2)
    : spec.leg.rMid + (spec.leg.r1 - spec.leg.rMid) * (1 - t * 2)
}
