import { useCallback, useEffect, useMemo, useRef } from 'react'

export const norm = (d) => ((d % 360) + 360) % 360

/**
 * Rotation lives OUTSIDE React state, deliberately.
 *
 * Driving it through useState meant every pointermove re-rendered the whole
 * tree — closet list, inspector, tabs — sixty times a second just to move one
 * transform. That is the stutter. Here the value sits in a ref and subscribers
 * write straight to the DOM and to three.js from a single rAF loop, so React
 * never renders while you drag.
 *
 * Subscribers get called once immediately on subscribe, then only on frames
 * where the value actually changed.
 */
export function useRotation(initial = 0) {
  const value = useRef(initial)
  const subs = useRef([])
  const dirty = useRef(true)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      if (dirty.current) {
        dirty.current = false
        for (const fn of subs.current) fn(value.current)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const set = useCallback((next) => {
    value.current = norm(typeof next === 'function' ? next(value.current) : next)
    dirty.current = true
  }, [])

  const subscribe = useCallback((fn) => {
    subs.current.push(fn)
    fn(value.current)
    return () => { subs.current = subs.current.filter((x) => x !== fn) }
  }, [])

  return useMemo(() => ({ value, set, subscribe }), [set, subscribe])
}
