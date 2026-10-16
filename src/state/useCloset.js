import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { STORES, getAll, get, put, del, newId } from '../lib/db'
import { DEFAULT_MEASUREMENTS } from '../lib/body'
import { DEFAULT_FIT, slotOf } from '../lib/layers'
import { panelCanvas, canvasToBlob } from '../lib/garment-art'
import { loadImage } from '../lib/cutout'

const SETTINGS_ID = 'measurements'

/** Stored record -> record plus loaded images the renderer can draw from. */
async function hydrate(stored) {
  // Garments saved before brand/style existed only have a name: carry it over
  // as the style so the label survives. It is written back on the next edit.
  const { name, ...record } = stored
  if (name && !record.style && !record.brand) record.style = name
  const frontUrl = record.frontBlob ? URL.createObjectURL(record.frontBlob) : null
  const backUrl = record.backBlob ? URL.createObjectURL(record.backBlob) : null
  const [frontImg, backImg] = await Promise.all([
    frontUrl ? loadImage(frontUrl).catch(() => null) : null,
    backUrl ? loadImage(backUrl).catch(() => null) : null,
  ])
  return { ...record, frontUrl, backUrl, frontImg, backImg }
}

const strip = ({ frontUrl, backUrl, frontImg, backImg, ...record }) => record

export function useCloset() {
  const [garments, setGarments] = useState([])
  const [outfits, setOutfits] = useState([])
  const [measurements, setMeasurementsState] = useState(DEFAULT_MEASUREMENTS)
  const [equipped, setEquipped] = useState({})
  const [ready, setReady] = useState(false)
  const urls = useRef(new Map())

  const track = useCallback((g) => {
    const prev = urls.current.get(g.id)
    if (prev) {
      if (prev.front) URL.revokeObjectURL(prev.front)
      if (prev.back) URL.revokeObjectURL(prev.back)
    }
    urls.current.set(g.id, { front: g.frontUrl, back: g.backUrl })
    return g
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [gs, os, settings] = await Promise.all([
          getAll(STORES.garments),
          getAll(STORES.outfits),
          get(STORES.settings, SETTINGS_ID),
        ])
        const hydrated = await Promise.all(gs.map(hydrate))
        if (cancelled) return
        hydrated.forEach(track)
        setGarments(hydrated)
        setOutfits(os.sort((a, b) => b.createdAt - a.createdAt))
        if (settings) setMeasurementsState({ ...DEFAULT_MEASUREMENTS, ...settings.value })
      } catch (e) {
        console.error('Closet failed to load', e)
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => { cancelled = true }
  }, [track])

  useEffect(() => {
    const map = urls.current
    return () => {
      for (const e of map.values()) {
        if (e.front) URL.revokeObjectURL(e.front)
        if (e.back) URL.revokeObjectURL(e.back)
      }
      map.clear()
    }
  }, [])

  const persist = useCallback(async (record) => {
    await put(STORES.garments, strip(record))
    const fresh = track(await hydrate(strip(record)))
    setGarments((list) => {
      const i = list.findIndex((x) => x.id === fresh.id)
      return i === -1 ? [...list, fresh] : list.map((x) => (x.id === fresh.id ? fresh : x))
    })
    return fresh
  }, [track])

  const addGarment = useCallback(({ brand, style, category, color, frontBlob, backBlob }) =>
    persist({
      id: newId(),
      brand: brand?.trim() || '',
      style: style?.trim() || '',
      category,
      color: color || '',
      frontBlob,
      backBlob: backBlob || null,
      fit: { ...DEFAULT_FIT },
      wearCount: 0,
      lastWorn: null,
      pin: null,
      createdAt: Date.now(),
    }), [persist])

  // Patch without a DB round-trip for the read: cheap enough that fit sliders
  // stay responsive, and the write is fire-and-forget.
  const updateGarment = useCallback((id, patch) => {
    setGarments((list) => list.map((g) => {
      if (g.id !== id) return g
      const next = { ...g, ...patch }
      put(STORES.garments, strip(next)).catch((e) => console.error('Save failed', e))
      return next
    }))
  }, [])

  const deleteGarment = useCallback(async (id) => {
    await del(STORES.garments, id)
    const e = urls.current.get(id)
    if (e) {
      if (e.front) URL.revokeObjectURL(e.front)
      if (e.back) URL.revokeObjectURL(e.back)
      urls.current.delete(id)
    }
    setGarments((l) => l.filter((g) => g.id !== id))
    setEquipped((eq) => Object.fromEntries(Object.entries(eq).filter(([, v]) => v !== id)))
  }, [])

  const toggleEquip = useCallback((g) => {
    setEquipped((eq) => {
      const s = slotOf(g.category)
      return { ...eq, [s]: eq[s] === g.id ? undefined : g.id }
    })
  }, [])

  const clearOutfit = useCallback(() => setEquipped({}), [])

  const setMeasurements = useCallback((next) => {
    setMeasurementsState(next)
    put(STORES.settings, { id: SETTINGS_ID, value: next }).catch((e) => console.error('Save failed', e))
  }, [])

  const saveOutfit = useCallback((name) => {
    const slots = Object.fromEntries(Object.entries(equipped).filter(([, v]) => v))
    if (!Object.keys(slots).length) return null
    const outfit = { id: newId(), name: name?.trim() || 'Untitled outfit', slots, createdAt: Date.now() }
    put(STORES.outfits, outfit).catch((e) => console.error('Save failed', e))
    setOutfits((l) => [outfit, ...l])
    return outfit.id
  }, [equipped])

  const loadOutfit = useCallback((outfit) => setEquipped({ ...outfit.slots }), [])

  const deleteOutfit = useCallback(async (id) => {
    await del(STORES.outfits, id)
    setOutfits((l) => l.filter((o) => o.id !== id))
  }, [])

  // "I wore this today" — the only honest way to learn what you actually wear.
  const logWear = useCallback(() => {
    const ids = Object.values(equipped).filter(Boolean)
    if (!ids.length) return 0
    const now = Date.now()
    setGarments((list) => list.map((g) => {
      if (!ids.includes(g.id)) return g
      const next = { ...g, wearCount: (g.wearCount || 0) + 1, lastWorn: now }
      put(STORES.garments, strip(next)).catch((e) => console.error('Save failed', e))
      return next
    }))
    return ids.length
  }, [equipped])

  /** Seeds a procedural sample closet so the app is not empty on first run. */
  const seedSamples = useCallback(async () => {
    const spec = [
      ['Heavyweight tee', 'tshirt', '#E8E4DB', 'Bone', 41, 'most'],
      ['Pocket tee', 'tshirt', '#2C3B4A', 'Navy', 12, null],
      ['Oxford button-down', 'shirt', '#B9CFE0', 'Pale blue', 23, null],
      ['Flannel overshirt', 'shirt', '#8C4034', 'Rust', 3, 'least'],
      ['Chore jacket', 'jacket', '#3E5240', 'Olive', 17, null],
      ['Slim chinos', 'pants', '#7A6A52', 'Khaki', 34, 'most'],
      ['Black jeans', 'pants', '#22262B', 'Black', 28, null],
      ['Camp shorts', 'shorts', '#5E6B54', 'Sage', 6, null],
      ['Court sneakers', 'shoes', '#EDEAE2', 'White', 52, 'most'],
    ]
    for (const [style, category, hex, color, wearCount, pin] of spec) {
      const frontBlob = await canvasToBlob(panelCanvas(category, hex, 'front'))
      const backBlob = await canvasToBlob(panelCanvas(category, hex, 'back'))
      await persist({
        id: newId(), brand: '', style, category, color, frontBlob, backBlob,
        fit: { ...DEFAULT_FIT }, wearCount, lastWorn: Date.now() - wearCount * 36e5 * 40,
        pin, createdAt: Date.now(),
      })
    }
  }, [persist])

  // Outermost slot first, matching build order in the scene.
  const equippedGarments = useMemo(() => {
    const order = ['outerTop', 'midTop', 'baseTop', 'bottom', 'feet']
    return order
      .slice()
      .reverse()
      .map((s) => garments.find((g) => g.id === equipped[s]))
      .filter(Boolean)
  }, [equipped, garments])

  return {
    ready, garments, outfits, measurements, equipped, equippedGarments,
    addGarment, updateGarment, deleteGarment, toggleEquip, clearOutfit,
    setMeasurements, saveOutfit, loadOutfit, deleteOutfit, logWear, seedSamples,
  }
}
