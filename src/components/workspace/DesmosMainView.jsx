import { useEffect, useRef } from 'react'
import { useDesmosBridge } from '../../hooks/useDesmosBridge.js'

/**
 * Full-area Desmos graphing calculator. Persists calculator JSON in workspace `desmosState`
 * via getState/setState so tab switches do not lose expressions.
 *
 * @param {{
 *   theme?: 'light' | 'dark'
 *   savedDesmosState: object | null
 *   commit: (fn: (d: object) => object) => void
 * }} props
 */
export function DesmosMainView({
  theme = 'dark',
  savedDesmosState = null,
  commit,
}) {
  const containerRef = useRef(null)
  const calcRef = useRef(/** @type {object | null} */ (null))
  const savedRef = useRef(savedDesmosState)
  const { registerCalculator } = useDesmosBridge()

  useEffect(() => {
    savedRef.current = savedDesmosState
  }, [savedDesmosState])

  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof window === 'undefined') return

    let cancelled = false
    let poll = null

    const tryInit = () => {
      const Desmos = window.Desmos
      if (!Desmos?.GraphingCalculator || cancelled) return
      try {
        const calc = Desmos.GraphingCalculator(el, {
          keypad: true,
          expressions: true,
          settingsMenu: true,
          zoomButtons: true,
          expressionsTopbar: true,
          invertedColors: theme === 'dark',
        })
        calcRef.current = calc
        registerCalculator(calc)
        const initial = savedRef.current
        if (initial && typeof initial === 'object') {
          try {
            calc.setState(initial)
          } catch {
            /* ignore invalid snapshot */
          }
        }
        queueMicrotask(() => {
          try {
            calc.resize()
          } catch {
            /* ignore */
          }
        })
      } catch {
        calcRef.current = null
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
        calcRef.current?.resize?.()
      } catch {
        /* ignore */
      }
    })
    ro.observe(el)

    return () => {
      cancelled = true
      if (poll != null) window.clearInterval(poll)
      ro.disconnect()
      const calc = calcRef.current
      calcRef.current = null
      if (calc?.getState) {
        try {
          const st = calc.getState()
          commit((d) => ({ ...d, desmosState: st }))
        } catch {
          /* ignore */
        }
      }
      try {
        calc?.destroy?.()
      } catch {
        /* ignore */
      }
      registerCalculator(null)
    }
  }, [commit, registerCalculator, theme])

  useEffect(() => {
    const calc = calcRef.current
    if (!calc?.setState || savedDesmosState == null) return
    try {
      calc.setState(savedDesmosState)
    } catch {
      /* ignore */
    }
  }, [savedDesmosState])

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-gg-border bg-gg-canvas-bg shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div
        ref={containerRef}
        className="h-full min-h-[min(100%,32rem)] w-full min-w-0 flex-1"
        aria-label="Desmos graphing calculator"
      />
    </div>
  )
}
