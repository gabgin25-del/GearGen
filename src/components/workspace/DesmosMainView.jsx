import { useCallback, useEffect, useRef, useState } from 'react'
import { makeGearGenPayload } from '../../lib/sketchPayload.js'
import {
  buildSketchFromDesmosExpression,
  captureDesmosPreviewImage,
  findRegionExpressionAtMath,
  pixelsToMathCoords,
} from '../../lib/desmosBridge.js'
import { useDesmosBridge } from '../../hooks/useDesmosBridge.js'

/**
 * Full-area Desmos graphing calculator. Persists `desmosState` in workspace,
 * observes expression changes, and supports right-click region export to Saved Sketches.
 *
 * @param {{
 *   theme?: 'light' | 'dark'
 *   savedDesmosState: object | null
 *   commit: (fn: (d: object) => object) => void
 *   desmosVisible: boolean
 *   addSketch: (name: string, payload: object) => unknown
 *   nextId: (p: string) => string
 *   defaultFillRgba?: string
 *   onMessage?: (msg: string) => void
 * }} props
 */
export function DesmosMainView({
  theme = 'dark',
  savedDesmosState = null,
  commit,
  desmosVisible = true,
  addSketch,
  nextId,
  defaultFillRgba,
  onMessage,
}) {
  const containerRef = useRef(null)
  const calcRef = useRef(/** @type {object | null} */ (null))
  const savedRef = useRef(savedDesmosState)
  const changeTimerRef = useRef(/** @type {number | null} */ (null))
  const observeUnsubRef = useRef(/** @type {(() => void) | null} */ (null))
  const { registerCalculator } = useDesmosBridge()

  const [ctxMenu, setCtxMenu] = useState(
    /** @type {{ x: number; y: number; expression: object } | null} */ (null),
  )

  useEffect(() => {
    savedRef.current = savedDesmosState
  }, [savedDesmosState])

  const schedulePersistState = useCallback(() => {
    if (changeTimerRef.current != null) window.clearTimeout(changeTimerRef.current)
    changeTimerRef.current = window.setTimeout(() => {
      changeTimerRef.current = null
      const calc = calcRef.current
      if (!calc?.getState) return
      try {
        const st = calc.getState()
        commit((d) => ({ ...d, desmosState: st }))
      } catch {
        /* ignore */
      }
    }, 400)
  }, [commit])

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

        const onChange = () => schedulePersistState()
        if (typeof calc.observeEvent === 'function') {
          calc.observeEvent('change', onChange)
          observeUnsubRef.current = () => {
            try {
              calc.unobserveEvent?.('change', onChange)
            } catch {
              /* ignore */
            }
          }
        } else if (typeof calc.observe === 'function') {
          calc.observe('change', onChange)
          observeUnsubRef.current = () => {
            try {
              calc.unobserve?.('change', onChange)
            } catch {
              /* ignore */
            }
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
      if (changeTimerRef.current != null) window.clearTimeout(changeTimerRef.current)
      observeUnsubRef.current?.()
      observeUnsubRef.current = null
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
  }, [commit, registerCalculator, schedulePersistState, theme])

  useEffect(() => {
    const calc = calcRef.current
    if (!calc?.setState || savedDesmosState == null) return
    try {
      calc.setState(savedDesmosState)
    } catch {
      /* ignore */
    }
  }, [savedDesmosState])

  useEffect(() => {
    if (!desmosVisible) return
    try {
      calcRef.current?.resize?.()
    } catch {
      /* ignore */
    }
  }, [desmosVisible])

  const onContextMenu = useCallback(
    async (e) => {
      const calc = calcRef.current
      const wrap = containerRef.current
      if (!calc || !wrap) return
      e.preventDefault()
      const rect = wrap.getBoundingClientRect()
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      const math = pixelsToMathCoords(calc, px, py)
      if (!math || !Number.isFinite(math.x) || !Number.isFinite(math.y)) {
        setCtxMenu(null)
        return
      }
      const hit = await findRegionExpressionAtMath(calc, math.x, math.y)
      if (!hit) {
        setCtxMenu(null)
        return
      }
      setCtxMenu({ x: e.clientX, y: e.clientY, expression: hit })
    },
    [],
  )

  const closeMenu = useCallback(() => setCtxMenu(null), [])

  const onExportRegion = useCallback(async () => {
    if (!ctxMenu) return
    const calc = calcRef.current
    if (!calc) return
    try {
      const geometry = await buildSketchFromDesmosExpression(
        calc,
        ctxMenu.expression,
        nextId,
        { defaultFillRgba },
      )
      if (!geometry) {
        onMessage?.('Could not sample that region.')
        closeMenu()
        return
      }
      let preview = captureDesmosPreviewImage(calc)
      if (preview && typeof preview.then === 'function') {
        preview = await preview
      }
      const name = `Desmos region ${new Date().toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
      addSketch(name, {
        ...makeGearGenPayload('gearge-v1', geometry),
        previewImage: typeof preview === 'string' ? preview : null,
      })
      onMessage?.('Saved to Saved Sketches.')
    } catch (err) {
      onMessage?.(err instanceof Error ? err.message : String(err))
    }
    closeMenu()
  }, [
    ctxMenu,
    nextId,
    defaultFillRgba,
    addSketch,
    onMessage,
    closeMenu,
  ])

  useEffect(() => {
    const onDoc = () => setCtxMenu(null)
    window.addEventListener('click', onDoc)
    return () => window.removeEventListener('click', onDoc)
  }, [])

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div
        ref={containerRef}
        className="h-full min-h-0 w-full min-w-0 flex-1"
        aria-label="Desmos graphing calculator"
        onContextMenu={onContextMenu}
      />
      {ctxMenu ? (
        <div
          className="fixed z-[100] min-w-[14rem] rounded-md border border-gg-border bg-gg-sidebar py-1 text-[12px] text-gg-text shadow-lg"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          role="menu"
          onClick={(ev) => ev.stopPropagation()}
          onKeyDown={(ev) => {
            if (ev.key === 'Escape') closeMenu()
          }}
        >
          <button
            type="button"
            role="menuitem"
            className="w-full px-3 py-2 text-left hover:bg-gg-sidebar-hover"
            onClick={onExportRegion}
          >
            Export region to Saved Sketches
          </button>
        </div>
      ) : null}
    </div>
  )
}
