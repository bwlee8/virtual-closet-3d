import React, { useMemo, useState } from 'react'
import { CATEGORIES, CATEGORY_ORDER, garmentLabel, slotOf } from '../lib/layers'

const SORTS = [
  { key: 'recent', label: 'Newest' },
  { key: 'most', label: 'Worn most' },
  { key: 'least', label: 'Worn least' },
]

// memo() matters here: without it every fit-slider drag re-renders every row.
// It only pays off because App passes stable useCallback handlers.
const ClosetPanel = React.memo(function ClosetPanel({
  garments, equipped, onToggle, onSelect, selectedId, onAdd, onSeed,
}) {
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('recent')

  const shown = useMemo(() => {
    const by = {
      recent: (a, b) => b.createdAt - a.createdAt,
      most: (a, b) => (b.wearCount || 0) - (a.wearCount || 0) || b.createdAt - a.createdAt,
      least: (a, b) => (a.wearCount || 0) - (b.wearCount || 0) || b.createdAt - a.createdAt,
    }
    return garments.filter((g) => filter === 'all' || g.category === filter).sort(by[sort])
  }, [garments, filter, sort])

  const counts = useMemo(() => {
    const c = { all: garments.length }
    for (const g of garments) c[g.category] = (c[g.category] || 0) + 1
    return c
  }, [garments])

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Closet</h2>
        <button className="btn primary small" onClick={onAdd}>+ Add</button>
      </div>

      <div className="chips" role="tablist" aria-label="Filter by category">
        <button className={filter === 'all' ? 'chip active' : 'chip'} onClick={() => setFilter('all')}>
          All <em>{counts.all}</em>
        </button>
        {CATEGORY_ORDER.map((c) => (
          <button key={c} className={filter === c ? 'chip active' : 'chip'} onClick={() => setFilter(c)}>
            {CATEGORIES[c].label} <em>{counts[c] || 0}</em>
          </button>
        ))}
      </div>

      <div className="sortbar">
        {SORTS.map((s) => (
          <button key={s.key} className={sort === s.key ? 'sort active' : 'sort'} onClick={() => setSort(s.key)}>
            {s.label}
          </button>
        ))}
      </div>

      {garments.length === 0 ? (
        <div className="empty">
          <p>Nothing here yet.</p>
          <p className="dim">
            Lay a garment on a plain floor or wall, shoot it straight on, and add it. The front photo
            wraps the front of the mesh; a back photo wraps the back.
          </p>
          <button className="btn primary" onClick={onAdd}>Add your first garment</button>
          <button className="btn small" onClick={onSeed}>Load a sample closet</button>
        </div>
      ) : (
        <ul className="rack">
          {shown.map((g) => {
            const on = equipped[slotOf(g.category)] === g.id
            return (
              <li key={g.id}>
                <button
                  className={`rack-item${on ? ' on' : ''}${selectedId === g.id ? ' sel' : ''}`}
                  aria-pressed={on}
                  onClick={() => { onToggle(g); onSelect(g.id) }}
                >
                  <span className="thumb">
                    {g.frontUrl && <img src={g.frontUrl} alt="" />}
                    {!g.backUrl && <i className="no-back" title="No back photo">F</i>}
                  </span>
                  <span className="rack-meta">
                    <b>{garmentLabel(g)}</b>
                    <small>{CATEGORIES[g.category]?.label}{g.color ? ` · ${g.color}` : ''}</small>
                  </span>
                  <span className="wear" title={`Worn ${g.wearCount || 0} times`}>
                    {g.pin === 'most' && <i className="pin most">★</i>}
                    {g.pin === 'least' && <i className="pin least">◦</i>}
                    {g.wearCount || 0}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
})

export default ClosetPanel
