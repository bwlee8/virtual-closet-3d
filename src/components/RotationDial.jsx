import { useEffect, useRef } from 'react'
import { norm } from '../state/useRotation'

const SNAPS = [
  { deg: 0, label: 'Front' },
  { deg: 45, label: '3/4' },
  { deg: 90, label: 'Side' },
  { deg: 180, label: 'Back' },
  { deg: 270, label: 'Side' },
]

const TICK_COUNT = 145 // -360deg .. +1800deg, so the gauge never runs dry either side
const TICK_ORIGIN = 720 // px offset of the 0deg tick within the row (2px per degree)

export default function RotationDial({ rotation }) {
  const ticks = useRef(null)
  const deg = useRef(null)
  const face = useRef(null)
  const snaps = useRef(null)
  const track = useRef(null)
  const drag = useRef({ on: false, x: 0 })

  useEffect(() => rotation.subscribe((a) => {
    // Math.round is what stops the shimmer. Fractional pixel offsets force the
    // browser to re-rasterize every glyph each frame with different subpixel
    // antialiasing, which reads as shaking text. At 2px per degree, snapping to
    // whole pixels is invisible.
    if (ticks.current) {
      ticks.current.style.transform = `translate3d(${Math.round(-a * 2 - TICK_ORIGIN)}px,0,0)`
    }
    const d = Math.round(a)
    if (deg.current) deg.current.textContent = `${String(d).padStart(3, '0')}°`
    if (face.current) face.current.textContent = a > 90 && a < 270 ? 'Back' : 'Front'
    if (track.current) track.current.setAttribute('aria-valuenow', String(d))
    if (snaps.current) {
      for (const btn of snaps.current.children) {
        btn.classList.toggle('active', Number(btn.dataset.deg) === d)
      }
    }
  }), [rotation])

  return (
    <div className="dial">
      <div
        className="dial-track"
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label="Rotate avatar"
        aria-valuemin={0}
        aria-valuemax={359}
        onPointerDown={(e) => {
          drag.current = { on: true, x: e.clientX }
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          if (!drag.current.on) return
          const dx = e.clientX - drag.current.x
          drag.current.x = e.clientX
          rotation.set((a) => a + dx * 0.85)
        }}
        onPointerUp={() => { drag.current.on = false }}
        onPointerCancel={() => { drag.current.on = false }}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 15 : 3
          if (e.key === 'ArrowLeft') { rotation.set((a) => a - step); e.preventDefault() }
          if (e.key === 'ArrowRight') { rotation.set((a) => a + step); e.preventDefault() }
        }}
      >
        <div className="dial-ticks" ref={ticks}>
          {Array.from({ length: TICK_COUNT }, (_, i) => {
            const d = norm(i * 15 - 360)
            const major = d % 90 === 0
            return <span key={i} className={major ? 'tick major' : 'tick'}>{major && <b>{d}</b>}</span>
          })}
        </div>
        <div className="dial-needle" />
      </div>

      <div className="dial-readout">
        <span className="deg" ref={deg}>000°</span>
        <span className="face" ref={face}>Front</span>
      </div>

      <div className="dial-snaps" ref={snaps}>
        {SNAPS.map((s) => (
          <button key={s.deg} type="button" className="snap" data-deg={s.deg} onClick={() => rotation.set(s.deg)}>
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}
