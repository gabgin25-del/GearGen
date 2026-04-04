import { useEffect, useRef, useState } from 'react'

/**
 * Tracks the content-box size of a DOM element via ResizeObserver.
 */
export function useElementSize() {
  const ref = useRef(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const update = () => {
      const r = el.getBoundingClientRect()
      setSize({
        width: Math.max(0, Math.floor(r.width)),
        height: Math.max(0, Math.floor(r.height)),
      })
    }

    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return { ref, size }
}
