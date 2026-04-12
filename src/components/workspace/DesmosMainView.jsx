import { useEffect, useRef } from 'react'
import { useDesmosBridge } from '../../hooks/useDesmosBridge.js'

/**
 * Full-width Desmos graphing calculator for the main workspace when the Desmos tab is active.
 *
 * @param {{ theme?: 'light' | 'dark' }} props
 */
export function DesmosMainView({ theme = 'dark' }) {
  const containerRef = useRef(null)
  const { registerCalculator } = useDesmosBridge()

  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof window === 'undefined') return

    let cancelled = false
    /** @type {any} */
    let calc = null
    let poll = null

    const tryInit = () => {
      const Desmos = window.Desmos
      if (!Desmos?.GraphingCalculator || cancelled) return
      try {
        calc = Desmos.GraphingCalculator(el, {
          keypad: true,
          expressions: true,
          settingsMenu: true,
          zoomButtons: true,
          expressionsTopbar: true,
          invertedColors: theme === 'dark',
        })
        registerCalculator(calc)
        queueMicrotask(() => {
          try {
            calc.resize()
          } catch {
            /* ignore */
          }
        })
      } catch {
        registerCalculator(null)
      }
    }

    if (window.Desmos?.GraphingCalculator) {
      tryInit()
    } else {
      poll = window.setInterval(() => {
        if (window.Desmos?.GraphingCalculator) {
          if (poll != null) window.clearInterval(poll)
          poll = null
          tryInit()
        }
      }, 50)
    }

    const ro = new ResizeObserver(() => {
      try {
        calc?.resize?.()
      } catch {
        /* ignore */
      }
    })
    ro.observe(el)

    return () => {
      cancelled = true
      if (poll != null) window.clearInterval(poll)
      ro.disconnect()
      try {
        calc?.destroy?.()
      } catch {
        /* ignore */
      }
      registerCalculator(null)
    }
  }, [registerCalculator, theme])

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-gg-border bg-gg-canvas-bg shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
    >
      <div
        ref={containerRef}
        className="h-full min-h-[min(100%,32rem)] w-full min-w-0 flex-1"
        aria-label="Desmos graphing calculator"
      />
    </div>
  )
}
