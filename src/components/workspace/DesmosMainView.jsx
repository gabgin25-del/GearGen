import { useCallback, useEffect, useRef, useState } from 'react'
import { makeGearGenPayload } from '../../lib/sketchPayload.js'
import {
  buildExactCurveWorkspaceExport,
  captureDesmosPreviewImage,
  findRegionExpressionAtMath,
  pixelsToMathCoords,
} from '../../lib/desmosBridge.js'
import { useDesmosBridge } from '../../hooks/useDesmosBridge.js'

/**
 * Desmos graph: single calculator instance (mount once), no parent-driven setState loops.
 * Persists via debounced observe on expressions + cleanup on unmount.
 */
export function DesmosMainView({
  theme = 'dark',
  /** Current workspace snapshot; read via ref — do not wire to setState loops */
  workspaceDesmosState = null,
  commit,
  desmosVisible = true,
  addSketch,
  nextId,
  defaultFillRgba,
  onMessage,
  /** Increments when a sketch is loaded into the workspace — apply calculator state once */
  workspaceLoadGeneration = 0,
}) {
  const containerRef = useRef(null)
  const calcRef = useRef(/** @type {object | null} */ (null))
  const commitRef = useRef(commit)
  const themeRef = useRef(theme)
  const { registerCalculator } = useDesmosBridge()
  const persistTimerRef = useRef(/** @type {number | null} */ (null))
  const exprObserveUnsubRef = useRef(/** @type {(() => void) | null} */ (null))
  const workspaceDesmosRef = useRef(workspaceDesmosState)
  const lastAppliedGeneration = useRef(-1)

  const [ctxMenu, setCtxMenu] = useState(
    /** @type {{ x: number; y: number; expression: object } | null} */ (null),
  )

  commitRef.current = commit
  themeRef.current = theme
  workspaceDesmosRef.current = workspaceDesmosState

  /** Single init — empty dependency array */
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
          invertedColors: themeRef.current === 'dark',
        })
        calcRef.current = calc
        registerCalculator(calc)

        const initial = workspaceDesmosRef.current
        if (initial && typeof initial === 'object') {
          try {
            calc.setState(initial)
          } catch {
            /* ignore */
          }
        }

        const schedulePersistDesmosState = () => {
          if (persistTimerRef.current != null) {
            window.clearTimeout(persistTimerRef.current)
          }
          persistTimerRef.current = window.setTimeout(() => {
            persistTimerRef.current = null
            const c = calcRef.current
            if (!c?.getState) return
            try {
              const st = c.getState()
              commitRef.current((d) => ({ ...d, desmosState: st }))
            } catch {
              /* ignore */
            }
          }, 2000)
        }

        const onExprChange = () => schedulePersistDesmosState()
        if (typeof calc.observe === 'function') {
          try {
            calc.observe('expressions', onExprChange)
            exprObserveUnsubRef.current = () => {
              try {
                calc.unobserve?.('expressions', onExprChange)
              } catch {
                /* ignore */
              }
            }
          } catch {
            exprObserveUnsubRef.current = null
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
      if (persistTimerRef.current != null) window.clearTimeout(persistTimerRef.current)
      exprObserveUnsubRef.current?.()
      exprObserveUnsubRef.current = null
      ro.disconnect()
      const calc = calcRef.current
      calcRef.current = null
      if (calc?.getState) {
        try {
          const st = calc.getState()
          commitRef.current((d) => ({ ...d, desmosState: st }))
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- GraphingCalculator must mount once
  }, [])

  /** Apply external sketch only when load generation bumps (not on every desmosState commit) */
  useEffect(() => {
    if (workspaceLoadGeneration <= 0) return
    if (workspaceLoadGeneration === lastAppliedGeneration.current) return
    lastAppliedGeneration.current = workspaceLoadGeneration
    const calc = calcRef.current
    if (!calc?.setState) return
    const st = workspaceDesmosRef.current
    if (st && typeof st === 'object') {
      try {
        calc.setState(st)
      } catch {
        /* ignore */
      }
    } else {
      try {
        const list = calc.getExpressions?.() ?? []
        const ids = list.map((x) => x?.id).filter(Boolean)
        if (ids.length && calc.removeExpressions) {
          calc.removeExpressions(ids.map((id) => ({ id })))
        }
      } catch {
        /* ignore */
      }
    }
  }, [workspaceLoadGeneration])

  /** Theme without re-mounting calculator */
  useEffect(() => {
    const calc = calcRef.current
    if (!calc?.updateSettings) return
    try {
      calc.updateSettings({ invertedColors: theme === 'dark' })
    } catch {
      /* ignore */
    }
  }, [theme])

  useEffect(() => {
    if (!desmosVisible) return
    try {
      calcRef.current?.resize?.()
    } catch {
      /* ignore */
    }
  }, [desmosVisible])

  const onContextMenu = useCallback(async (e) => {
    const calc = calcRef.current
    const wrap = containerRef.current
    if (!calc || !wrap) return
    e.preventDefault()
    const px =
      typeof e.nativeEvent?.offsetX === 'number'
        ? e.nativeEvent.offsetX
        : e.clientX - wrap.getBoundingClientRect().left
    const py =
      typeof e.nativeEvent?.offsetY === 'number'
        ? e.nativeEvent.offsetY
        : e.clientY - wrap.getBoundingClientRect().top
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
  }, [])

  const closeMenu = useCallback(() => setCtxMenu(null), [])

  const onExportExact = useCallback(async () => {
    if (!ctxMenu) return
    const calc = calcRef.current
    if (!calc) return
    try {
      const geometry = await buildExactCurveWorkspaceExport(
        calc,
        ctxMenu.expression,
        nextId,
        { defaultFillRgba },
      )
      if (!geometry) {
        onMessage?.('Could not read that expression.')
        closeMenu()
        return
      }
      let preview = captureDesmosPreviewImage(calc)
      if (preview && typeof preview.then === 'function') {
        preview = await preview
      }
      const name = `Exact curve ${new Date().toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
      addSketch(name, {
        ...makeGearGenPayload('gearge-v1', geometry),
        previewImage: typeof preview === 'string' ? preview : null,
      })
      onMessage?.('Saved exact curve to Saved Sketches.')
    } catch (err) {
      onMessage?.(err instanceof Error ? err.message : String(err))
    }
    closeMenu()
  }, [ctxMenu, nextId, defaultFillRgba, addSketch, onMessage, closeMenu])

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
            onClick={onExportExact}
          >
            Export Exact Curve to Sketches
          </button>
        </div>
      ) : null}
    </div>
  )
}
