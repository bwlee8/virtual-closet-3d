import { useState } from 'react'
import { SLOTS, SLOT_ORDER, garmentLabel } from '../lib/layers'

export default function Outfits({
  equipped, garments, outfits, onSave, onLoad, onDelete, onClear, onLogWear,
}) {
  const [name, setName] = useState('')
  const [toast, setToast] = useState('')
  const byId = (id) => garments.find((g) => g.id === id)
  const worn = SLOT_ORDER.map((s) => byId(equipped[s])).filter(Boolean)
  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 2400) }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Outfit</h2>
        {worn.length > 0 && <button className="btn small" onClick={onClear}>Take everything off</button>}
      </div>
      <div className="pad stack">
        <ol className="layerstack">
          {SLOT_ORDER.map((s) => {
            const g = byId(equipped[s])
            return (
              <li key={s} className={g ? 'slot filled' : 'slot'}>
                <span className="slot-label">{SLOTS[s].label}</span>
                <span className="slot-value">{g ? garmentLabel(g) : '—'}</span>
              </li>
            )
          })}
        </ol>

        <div className="save-row">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Name this outfit" aria-label="Outfit name" />
          <button className="btn primary small" disabled={!worn.length}
            onClick={() => { if (onSave(name)) { setName(''); flash('Outfit saved') } }}>Save</button>
        </div>

        <button className="btn brass" disabled={!worn.length}
          onClick={() => { const n = onLogWear(); if (n) flash(`Logged ${n} item${n === 1 ? '' : 's'} as worn today`) }}>
          I wore this today
        </button>
        {toast && <p className="toast">{toast}</p>}

        {outfits.length > 0 && (
          <>
            <h3 className="subhead">Saved outfits</h3>
            <ul className="outfit-list">
              {outfits.map((o) => (
                <li key={o.id}>
                  <button className="outfit" onClick={() => onLoad(o)}>
                    <b>{o.name}</b>
                    <small>{Object.keys(o.slots).length} pieces</small>
                  </button>
                  <button className="icon-btn" aria-label={`Delete ${o.name}`} onClick={() => onDelete(o.id)}>×</button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  )
}
