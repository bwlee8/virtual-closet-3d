import { CATEGORIES, CATEGORY_ORDER, DEFAULT_FIT } from '../lib/layers'

export default function Inspector({ garment, onUpdate, onDelete }) {
  if (!garment) {
    return (
      <section className="panel">
        <div className="panel-head"><h2>Fit</h2></div>
        <p className="dim pad">Pick a garment to adjust how it sits on the body.</p>
      </section>
    )
  }

  const fit = { ...DEFAULT_FIT, ...(garment.fit || {}) }
  const setFit = (patch) => onUpdate(garment.id, { fit: { ...fit, ...patch } })

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Fit</h2>
        <button className="btn small" onClick={() => setFit(DEFAULT_FIT)}>Reset</button>
      </div>
      <div className="pad stack">
        <label className="field">
          <span>Name</span>
          <input type="text" value={garment.name} onChange={(e) => onUpdate(garment.id, { name: e.target.value })} />
        </label>

        <label className="field">
          <span>Category</span>
          <select value={garment.category} onChange={(e) => onUpdate(garment.id, { category: e.target.value })}>
            {CATEGORY_ORDER.map((c) => <option key={c} value={c}>{CATEGORIES[c].label}</option>)}
          </select>
          <small>Category sets the slot and its real thickness. A jacket sits physically outside a shirt.</small>
        </label>

        <Slider label="Looseness" value={fit.scale} min={0.5} max={2.4} step={0.02} suffix="×"
          onChange={(v) => setFit({ scale: v })} />
        <Slider label="Length" value={fit.length} min={0.9} max={1.14} step={0.005}
          fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setFit({ length: v })} />
        <Slider label="Sit height" value={fit.drop} min={-0.08} max={0.08} step={0.002}
          fmt={(v) => `${(v * 100).toFixed(1)}cm`} onChange={(v) => setFit({ drop: v })} />

        <div className="wear-box">
          <div className="wear-count">
            <em>{garment.wearCount || 0}</em>
            <span>wears logged</span>
          </div>
          <p className="dim">
            {garment.lastWorn ? `Last worn ${new Date(garment.lastWorn).toLocaleDateString()}` : 'Never logged'}
          </p>
          <div className="pins">
            <button className={garment.pin === 'most' ? 'pinbtn most on' : 'pinbtn most'}
              onClick={() => onUpdate(garment.id, { pin: garment.pin === 'most' ? null : 'most' })}>
              ★ In rotation
            </button>
            <button className={garment.pin === 'least' ? 'pinbtn least on' : 'pinbtn least'}
              onClick={() => onUpdate(garment.id, { pin: garment.pin === 'least' ? null : 'least' })}>
              ◦ Barely worn
            </button>
          </div>
          <div className="counter-row">
            <button className="btn small"
              onClick={() => onUpdate(garment.id, { wearCount: Math.max(0, (garment.wearCount || 0) - 1) })}>−1</button>
            <button className="btn small"
              onClick={() => onUpdate(garment.id, { wearCount: (garment.wearCount || 0) + 1, lastWorn: Date.now() })}>+1</button>
          </div>
        </div>

        <button className="btn danger small" onClick={() => onDelete(garment.id)}>Remove from closet</button>
      </div>
    </section>
  )
}

function Slider({ label, value, min, max, step, suffix = '', fmt, onChange }) {
  const shown = fmt ? fmt(value) : (step < 1 ? Number(value).toFixed(2) : Math.round(value))
  return (
    <label className="field">
      <span>{label} <em>{shown}{suffix}</em></span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}
