import { useEffect, useRef, useState } from 'react'
import { loadImageFromFile, removeBackground, toCanvas, panelFrom } from '../lib/cutout'
import { canvasToBlob } from '../lib/garment-art'
import { CATEGORIES, CATEGORY_ORDER } from '../lib/layers'

const empty = { img: null, canvas: null, url: null }

export default function AddGarment({ onAdd, onClose }) {
  const [brand, setBrand] = useState('')
  const [style, setStyle] = useState('')
  const [category, setCategory] = useState('tshirt')
  const [color, setColor] = useState('')
  const [tolerance, setTolerance] = useState(42)
  const [cut, setCut] = useState(true)
  const [front, setFront] = useState(empty)
  const [back, setBack] = useState(empty)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const firstField = useRef(null)

  useEffect(() => { firstField.current?.focus() }, [])

  const process = (img) => panelFrom(cut ? removeBackground(img, tolerance) : toCanvas(img))

  const pick = async (file, shot, setShot) => {
    if (!file) return
    setError('')
    setBusy(true)
    try {
      const img = await loadImageFromFile(file)
      const canvas = process(img)
      if (shot.url) URL.revokeObjectURL(shot.url)
      setShot({ img, canvas, url: canvas.toDataURL() })
    } catch (e) {
      setError(e.message || 'That image could not be processed.')
    } finally {
      setBusy(false)
    }
  }

  const reprocess = () => {
    if (!front.img && !back.img) return
    setBusy(true)
    // Let the browser paint the busy state before the synchronous flood fill.
    setTimeout(() => {
      for (const [shot, setShot] of [[front, setFront], [back, setBack]]) {
        if (!shot.img) continue
        const canvas = process(shot.img)
        setShot({ ...shot, canvas, url: canvas.toDataURL() })
      }
      setBusy(false)
    }, 0)
  }

  const submit = async () => {
    if (!front.canvas) {
      setError('A front photo is required — it is what wraps the front of the mesh.')
      return
    }
    setBusy(true)
    try {
      const frontBlob = await canvasToBlob(front.canvas)
      const backBlob = back.canvas ? await canvasToBlob(back.canvas) : null
      await onAdd({ brand, style, category, color, frontBlob, backBlob })
      onClose()
    } catch (e) {
      setError('Saving failed. Your browser may be out of storage.')
      setBusy(false)
    }
  }

  return (
    <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Add a garment">
        <div className="sheet-head">
          <h2>Add a garment</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="sheet-body">
          <div className="shots">
            <Shot label="Front" hint="Required — wraps the front" shot={front}
              onPick={(f) => pick(f, front, setFront)} />
            <Shot label="Back" hint="Optional — wraps the back" shot={back}
              onPick={(f) => pick(f, back, setBack)} />
          </div>

          <label className="check">
            <input type="checkbox" checked={cut} onChange={(e) => setCut(e.target.checked)} />
            Remove the background
          </label>

          {cut && (
            <label className="field">
              <span>Cut tolerance <em>{tolerance}</em></span>
              <input type="range" min="8" max="110" value={tolerance}
                onChange={(e) => setTolerance(Number(e.target.value))}
                onMouseUp={reprocess} onTouchEnd={reprocess} onKeyUp={reprocess} />
              <small>
                Shoot on a plain wall or floor. Raise this if background remains, lower it if the
                garment is getting eaten.
              </small>
            </label>
          )}

          <div className="field-row">
            <label className="field">
              <span>Brand</span>
              <input ref={firstField} type="text" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Uniqlo" />
            </label>
            <label className="field">
              <span>Style</span>
              <input type="text" value={style} onChange={(e) => setStyle(e.target.value)} placeholder="Oxford button-down" />
            </label>
          </div>

          <div className="field-row">
            <label className="field">
              <span>Category</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORY_ORDER.map((c) => <option key={c} value={c}>{CATEGORIES[c].label}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Colour</span>
              <input type="text" value={color} onChange={(e) => setColor(e.target.value)} placeholder="Navy" />
            </label>
          </div>

          {error && <p className="error">{error}</p>}
        </div>

        <div className="sheet-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={submit} disabled={busy}>
            {busy ? 'Working…' : 'Add to closet'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Shot({ label, hint, shot, onPick }) {
  const id = `shot-${label.toLowerCase()}`
  return (
    <div>
      <label className="shot-drop" htmlFor={id}>
        {shot.url
          ? <img src={shot.url} alt={`${label} view preview`} />
          : <span className="shot-empty"><b>{label}</b><small>{hint}</small></span>}
      </label>
      <input id={id} type="file" accept="image/*" capture="environment" className="visually-hidden"
        onChange={(e) => onPick(e.target.files?.[0])} />
    </div>
  )
}
