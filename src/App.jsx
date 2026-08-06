import { useCallback, useEffect, useRef, useState } from 'react'
import { useCloset } from './state/useCloset'
import { useRotation } from './state/useRotation'
import Stage3D from './components/Stage3D'
import RotationDial from './components/RotationDial'
import ClosetPanel from './components/ClosetPanel'
import AddGarment from './components/AddGarment'
import Inspector from './components/Inspector'
import Measurements from './components/Measurements'
import Outfits from './components/Outfits'

const TABS = [
  { key: 'outfit', label: 'Outfit' },
  { key: 'fit', label: 'Fit' },
  { key: 'body', label: 'Body' },
]

export default function App() {
  const closet = useCloset()
  const rotation = useRotation(18)
  const [tab, setTab] = useState('outfit')
  const [adding, setAdding] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [showGuides, setShowGuides] = useState(false)
  const [spinning, setSpinning] = useState(false)
  const drag = useRef({ on: false, x: 0 })

  useEffect(() => {
    if (!spinning) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      rotation.set(rotation.value.current > 90 && rotation.value.current < 270 ? 0 : 180)
      setSpinning(false)
      return
    }
    let start = null
    let raf = 0
    const from = rotation.value.current
    const step = (t) => {
      if (start === null) start = t
      const p = Math.min(1, (t - start) / 3000)
      const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2
      rotation.set(from + eased * 360)
      if (p < 1) raf = requestAnimationFrame(step)
      else setSpinning(false)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [spinning, rotation])

  // Stable identities — without these, memo() on ClosetPanel never skips,
  // because a fresh arrow function counts as a changed prop every render.
  const selectGarment = useCallback((id) => { setSelectedId(id); setTab('fit') }, [])
  const openAdd = useCallback(() => setAdding(true), [])

  const { deleteGarment } = closet
  const removeGarment = useCallback((id) => {
    deleteGarment(id)
    setSelectedId(null)
  }, [deleteGarment])

  const dragHandlers = {
    onPointerDown: (e) => {
      drag.current = { on: true, x: e.clientX }
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    onPointerMove: (e) => {
      if (!drag.current.on) return
      const dx = e.clientX - drag.current.x
      drag.current.x = e.clientX
      rotation.set((a) => a + dx * 0.55)
    },
    onPointerUp: () => { drag.current.on = false },
    onPointerCancel: () => { drag.current.on = false },
  }

  const selected = closet.garments.find((g) => g.id === selectedId) || null

  return (
    <div className="app">
      <header className="topbar">
        <h1>Virtual Closet<span>/ {closet.garments.length} pieces</span></h1>
        <button className="btn small" onClick={() => setSpinning(true)} disabled={spinning}>Spin 360°</button>
      </header>

      <main className="layout">
        <ClosetPanel
          garments={closet.garments}
          equipped={closet.equipped}
          onToggle={closet.toggleEquip}
          onSelect={selectGarment}
          selectedId={selectedId}
          onAdd={openAdd}
          onSeed={closet.seedSamples}
        />

        <section className="stage">
          <div className="stage-frame">
            <Stage3D
              measurements={closet.measurements}
              garments={closet.equippedGarments}
              rotation={rotation}
              showGuides={showGuides}
              dragHandlers={dragHandlers}
            />
            <div className="badge">WebGL · {closet.equippedGarments.length} layers</div>
            {showGuides && (
              <div className="legend">
                <span>CHEST {closet.measurements.chestCm}</span>
                <span>WAIST {closet.measurements.waistCm}</span>
                <span>HIP {closet.measurements.hipCm}</span>
              </div>
            )}
          </div>
          <RotationDial rotation={rotation} />
          <p className="stage-hint dim">Drag the figure or the gauge to orbit. Arrow keys step, shift for bigger steps.</p>
        </section>

        <div className="rail">
          <div className="tabs" role="tablist">
            {TABS.map((t) => (
              <button key={t.key} role="tab" aria-selected={tab === t.key}
                className={tab === t.key ? 'tab active' : 'tab'} onClick={() => setTab(t.key)}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'outfit' && (
            <Outfits
              equipped={closet.equipped}
              garments={closet.garments}
              outfits={closet.outfits}
              onSave={closet.saveOutfit}
              onLoad={closet.loadOutfit}
              onDelete={closet.deleteOutfit}
              onClear={closet.clearOutfit}
              onLogWear={closet.logWear}
            />
          )}
          {tab === 'fit' && (
            <Inspector garment={selected} onUpdate={closet.updateGarment} onDelete={removeGarment} />
          )}
          {tab === 'body' && (
            <Measurements
              value={closet.measurements}
              onChange={closet.setMeasurements}
              showGuides={showGuides}
              onToggleGuides={setShowGuides}
            />
          )}
        </div>
      </main>

      {adding && <AddGarment onAdd={closet.addGarment} onClose={() => setAdding(false)} />}
    </div>
  )
}
