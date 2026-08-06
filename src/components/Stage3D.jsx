import { useCallback, useEffect, useRef } from 'react'
import * as THREE from 'three'
import { bodySpec, loft, subdivide, limbRings, torsoAt, legRadiusAt } from '../lib/body'
import { CATEGORIES, DEFAULT_FIT } from '../lib/layers'
import { atlasTexture, averageColor } from '../lib/garment-art'
import { configureRenderer } from '../lib/three-compat'

export default function Stage3D({ measurements, garments, rotation, showGuides, dragHandlers }) {
  const mount = useRef(null)
  const scene = useRef({})
  const texCache = useRef(new Map())

  /* Building the 1024x512 atlas costs real time per garment, and none of it
   * depends on measurements. Without this cache, dragging a body slider
   * regenerated every equipped garment's texture on every frame. Keyed on the
   * actual image objects, so it only rebuilds when a photo or category changes. */
  const materialsFor = useCallback((g) => {
    const hit = texCache.current.get(g.id)
    if (hit && hit.front === g.frontImg && hit.back === g.backImg && hit.category === g.category) return hit
    hit?.tex.dispose()
    const tex = atlasTexture({ frontImg: g.frontImg, backImg: g.backImg })
    const entry = {
      tex,
      color: averageColor(g.frontImg),
      front: g.frontImg,
      back: g.backImg,
      category: g.category,
    }
    texCache.current.set(g.id, entry)
    return entry
  }, [])

  useEffect(() => {
    const cache = texCache.current
    return () => {
      for (const e of cache.values()) e.tex.dispose()
      cache.clear()
    }
  }, [])

  // ---- mount: renderer, camera, lights, render loop -----------------------
  useEffect(() => {
    const el = mount.current
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    configureRenderer(renderer)
    el.appendChild(renderer.domElement)

    const s = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100)
    camera.position.set(0, 1.0, 4.6)
    camera.lookAt(0, 0.92, 0)

    s.add(new THREE.HemisphereLight(0xffffff, 0xdedbd4, 0.78))
    const key = new THREE.DirectionalLight(0xffffff, 0.72)
    key.position.set(2.4, 4.2, 3.0)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    key.shadow.camera.near = 1
    key.shadow.camera.far = 12
    key.shadow.camera.left = -1.6
    key.shadow.camera.right = 1.6
    key.shadow.camera.top = 2.6
    key.shadow.camera.bottom = -0.4
    s.add(key)

    const fill = new THREE.DirectionalLight(0xffffff, 0.26)
    fill.position.set(-3, 2.2, -2.4)
    s.add(fill)
    const rim = new THREE.DirectionalLight(0xffffff, 0.34)
    rim.position.set(-1.2, 2.6, -3.4)
    s.add(rim)

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ opacity: 0.14 }))
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    s.add(ground)

    const root = new THREE.Group()
    s.add(root)

    const resize = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      if (!w || !h) return
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(el)
    resize()

    let raf = 0
    const loop = () => {
      renderer.render(s, camera)
      raf = requestAnimationFrame(loop)
    }
    loop()

    scene.current = { renderer, scene: s, camera, root }
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      root.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.() })
      ground.geometry.dispose()
      ground.material.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement)
    }
  }, [])

  // ---- rotation: written straight to the transform, no React render -------
  useEffect(() => rotation.subscribe((a) => {
    const { root } = scene.current
    if (root) root.rotation.y = -(a * Math.PI) / 180
  }), [rotation])

  // ---- rebuild the figure when the body or the outfit changes -------------
  useEffect(() => {
    const { root } = scene.current
    if (!root) return

    // Geometry and materials are per-build. Textures are NOT — they live in
    // texCache and outlive the rebuild, so disposing their maps here would
    // destroy something we are about to reuse.
    while (root.children.length) {
      const c = root.children.pop()
      c.traverse?.((o) => { o.geometry?.dispose?.(); o.material?.dispose?.() })
    }

    const spec = bodySpec(measurements)
    const skin = new THREE.MeshStandardMaterial({ color: 0xdad7d0, roughness: 0.86, metalness: 0 })
    const add = (geo, mat) => {
      const mesh = new THREE.Mesh(geo, mat)
      mesh.castShadow = true
      mesh.receiveShadow = true
      root.add(mesh)
      return mesh
    }

    // --- mannequin ---
    add(loft(subdivide(spec.torso)), skin)
    add(
      new THREE.SphereGeometry(1, 28, 22)
        .scale(spec.head.rx, spec.head.ry, spec.head.rz)
        .translate(0, spec.head.cy, 0),
      skin
    )

    for (const side of [-1, 1]) {
      const armMesh = add(
        loft(limbRings(spec.arm.top, spec.arm.len, (t) => spec.arm.r0 + (spec.arm.r1 - spec.arm.r0) * (1 - t))),
        skin
      )
      armMesh.position.x = side * spec.arm.x
      armMesh.rotation.z = -side * spec.arm.tilt

      const legMesh = add(
        loft(limbRings(spec.leg.top, spec.leg.len, (t) =>
          legRadiusAt(spec, spec.leg.top - spec.leg.len * (1 - t)))),
        skin
      )
      legMesh.position.x = side * spec.leg.x

      const footMesh = add(new THREE.BoxGeometry(spec.foot.w, spec.foot.h, spec.foot.len), skin)
      footMesh.position.set(side * spec.leg.x, spec.foot.y - spec.foot.h / 2, spec.foot.len * 0.22)
    }

    // --- garments ---
    for (const g of garments) {
      const cfg = CATEGORIES[g.category]
      if (!cfg || !g.frontImg) continue

      const fit = { ...DEFAULT_FIT, ...(g.fit || {}) }
      const off = cfg.off * fit.scale
      const puff = 1 + (cfg.puff - 1) * fit.scale
      const { tex, color } = materialsFor(g)

      const wrapped = new THREE.MeshStandardMaterial({
        map: tex, roughness: 0.82, metalness: 0, side: THREE.DoubleSide,
      })
      // Cylindrically wrapping a flat photo around a limb smears badly, so
      // sleeves and legs take the photo's average colour instead.
      const solid = new THREE.MeshStandardMaterial({ color, roughness: 0.85 })

      if (cfg.kind === 'top') {
        const hemY = spec.y(cfg.hem * fit.length) + fit.drop
        const topY = spec.y(0.842) + fit.drop
        const rings = []
        for (let i = 0; i <= 22; i++) {
          const yy = hemY + (topY - hemY) * (i / 22)
          const r = torsoAt(spec, yy)
          rings.push({ y: yy, rx: r.rx * puff + off, rz: r.rz * puff + off })
        }
        add(loft(rings, { capTop: false, capBottom: false }), wrapped)

        if (cfg.sleeve > 0.02) {
          for (const side of [-1, 1]) {
            const sleeve = add(
              loft(
                limbRings(spec.arm.top + fit.drop, spec.arm.len * cfg.sleeve, (t) => {
                  const base = spec.arm.r0 + (spec.arm.r1 - spec.arm.r0) * (1 - t) * cfg.sleeve
                  return base * puff + off
                }),
                { capTop: false, capBottom: false }
              ),
              solid
            )
            sleeve.position.x = side * spec.arm.x
            sleeve.rotation.z = -side * spec.arm.tilt
          }
        }
      } else if (cfg.kind === 'bottom') {
        const waistY = spec.y(0.635) + fit.drop
        const crotchY = spec.y(0.487)
        const seat = []
        for (let i = 0; i <= 10; i++) {
          const yy = crotchY + (waistY - crotchY) * (i / 10)
          const r = torsoAt(spec, yy)
          seat.push({ y: yy, rx: r.rx * puff + off, rz: r.rz * puff + off })
        }
        add(loft(seat, { capTop: false, capBottom: false }), wrapped)

        const hemY = spec.y(cfg.hem)
        for (const side of [-1, 1]) {
          const rings = []
          for (let i = 0; i <= 12; i++) {
            const yy = hemY + (crotchY - hemY) * (i / 12)
            const r = legRadiusAt(spec, yy) * puff + off
            rings.push({ y: yy, rx: r, rz: r })
          }
          const legMesh = add(loft(rings, { capTop: false, capBottom: false }), solid)
          legMesh.position.x = side * spec.leg.x
        }
      } else if (cfg.kind === 'feet') {
        for (const side of [-1, 1]) {
          const shoe = add(
            new THREE.BoxGeometry(
              spec.foot.w * 1.34 * puff,
              spec.foot.h * 1.7 * puff,
              spec.foot.len * 1.12 * puff
            ),
            wrapped
          )
          shoe.position.set(side * spec.leg.x, spec.foot.y - spec.foot.h * 0.42, spec.foot.len * 0.24)
        }
      }
    }

    // --- measurement rings ---
    if (showGuides) {
      const mat = new THREE.LineBasicMaterial({ color: 0xa6741a })
      for (const f of [0.745, 0.625, 0.54]) {
        const yy = spec.y(f)
        const r = torsoAt(spec, yy)
        const pts = []
        for (let i = 0; i <= 64; i++) {
          const a = (i / 64) * Math.PI * 2
          pts.push(new THREE.Vector3(Math.sin(a) * (r.rx + 0.012), yy, Math.cos(a) * (r.rz + 0.012)))
        }
        root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat))
      }
    }
  }, [measurements, garments, showGuides, materialsFor])

  return <div ref={mount} style={{ width: '100%', height: '100%' }} {...dragHandlers} />
}
