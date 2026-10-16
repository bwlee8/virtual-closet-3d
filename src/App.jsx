import { useCallback, useState } from 'react'
import { useCloset } from './state/useCloset'
import { useRotation } from './state/useRotation'
import Stage2D from './components/Stage2D'
// 3D is parked, not removed — Stage3D.jsx still works. Swap this import (and
// the <Stage2D> below) back to Stage3D when it's time to return to 3D, and
// bring back RotationDial plus the drag-to-orbit / Spin 360° controls with it.
// The flat stage only has a front and a back, so it gets a two-way toggle.
// import Stage3D from './components/Stage3D'
// import RotationDial from './components/RotationDial'
import ClosetPanel from './components/ClosetPanel'
import AddGarment from './components/AddGarment'
import Inspector from './components/Inspector'
import Measurements from './components/Measurements'
import Outfits from './components/Outfits'

const FACES = [
  { deg: 0, label: 'Front' },
  { deg: 180, label: 'Back' },
]

const TABS = [
  { key: 'outfit', label: 'Outfit' },
  { key: 'fit', label: 'Fit' },
  { key: 'body', label: 'Body' },
]

export default function App() {
  const closet = useCloset()
  const rotation = useRotation(0)
  const [face, setFace] = useState(0)
  const [tab, setTab] = useState('outfit')
  const [adding, setAdding] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [showGuides, setShowGuides] = useState(false)

  // Stable identities — without these, memo() on ClosetPanel never skips,
  // because a fresh arrow function counts as a changed prop every render.
  const selectGarment = useCallback((id) => { setSelectedId(id); setTab('fit') }, [])
  const openAdd = useCallback(() => setAdding(true), [])

  const { deleteGarment } = closet
  const removeGarment = useCallback((id) => {
    deleteGarment(id)
    setSelectedId(null)
  }, [deleteGarment])

  const selected = closet.garments.find((g) => g.id === selectedId) || null

  return (
    <div className="app">
      <header className="topbar">
        <h1>Virtual Closet<span>/ {closet.garments.length} pieces</span></h1>
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
            <Stage2D
              measurements={closet.measurements}
              garments={closet.equippedGarments}
              rotation={rotation}
              showGuides={showGuides}
            />
            <div className="badge">2D · {closet.equippedGarments.length} layers</div>
            {showGuides && (
              <div className="legend">
                <span>CHEST {closet.measurements.chestCm}</span>
                <span>WAIST {closet.measurements.waistCm}</span>
                <span>HIP {closet.measurements.hipCm}</span>
              </div>
            )}
          </div>
          <div className="dial-snaps" role="group" aria-label="View">
            {FACES.map((f) => (
              <button key={f.deg} type="button" aria-pressed={face === f.deg}
                className={face === f.deg ? 'snap active' : 'snap'}
                onClick={() => { setFace(f.deg); rotation.set(f.deg) }}>
                {f.label}
              </button>
            ))}
          </div>
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
