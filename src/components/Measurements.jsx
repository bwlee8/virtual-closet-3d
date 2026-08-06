import { MEASUREMENT_FIELDS, DEFAULT_MEASUREMENTS } from '../lib/body'

export default function Measurements({ value, onChange, showGuides, onToggleGuides }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Your measurements</h2>
        <button className="btn small" onClick={() => onChange(DEFAULT_MEASUREMENTS)}>Reset</button>
      </div>
      <div className="pad stack">
        <label className="check">
          <input type="checkbox" checked={showGuides} onChange={(e) => onToggleGuides(e.target.checked)} />
          Show measurement rings
        </label>
        {MEASUREMENT_FIELDS.map((f) => (
          <label className="field" key={f.key}>
            <span>{f.label} <em>{value[f.key]} {f.unit}</em></span>
            <input type="range" min={f.min} max={f.max} value={value[f.key]}
              onChange={(e) => onChange({ ...value, [f.key]: Number(e.target.value) })} />
          </label>
        ))}
        <p className="dim">
          Measure over a t-shirt with a soft tape. Chest, waist and hip are circumferences; shoulder is
          point-to-point across the back. Each one becomes an elliptical cross-section the mesh is
          lofted from, so the body changes shape rather than just scaling.
        </p>
      </div>
    </section>
  )
}
