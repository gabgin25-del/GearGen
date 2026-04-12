import katex from 'katex'
import 'katex/dist/katex.min.css'
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import { applyWorkspaceToDesmosCalculator } from '../../lib/desmosSketchBridge.js'

const LATEX_STORAGE_KEY = 'geargen-desmos-latex-preview'

/**
 * @returns {boolean}
 */
function isFullyDefinedWorkspace(data) {
  const d = data?.solverDiagnostics
  return (
    d?.engine === 'planegcs' &&
    d?.fullyDefined === true &&
    d?.solveFailed !== true
  )
}

/**
 * Desmos Graphing Calculator + KaTeX note + bridge from fully-defined GCS geometry.
 *
 * @param {{ workspaceData?: object }} props
 */
export function DesmosPanel({ workspaceData }) {
  const id = useId()
  const containerRef = useRef(null)
  /** @type {React.MutableRefObject<any>} */
  const calculatorRef = useRef(null)
  const [latex, setLatex] = useState(
    String.raw`y = \sin\left(\frac{\pi}{6} x\right)`,
  )
  const [previewHtml, setPreviewHtml] = useState('')
  const [katexError, setKatexError] = useState(null)
  const [calcError, setCalcError] = useState(null)
  const [desmosReady, setDesmosReady] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LATEX_STORAGE_KEY)
      if (saved) setLatex(saved)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(LATEX_STORAGE_KEY, latex)
    } catch {
      /* ignore */
    }
  }, [latex])

  const renderPreview = useCallback(() => {
    try {
      const html = katex.renderToString(latex, {
        throwOnError: true,
        displayMode: true,
      })
      setPreviewHtml(html)
      setKatexError(null)
    } catch (e) {
      setPreviewHtml('')
      setKatexError(e instanceof Error ? e.message : String(e))
    }
  }, [latex])

  useEffect(() => {
    renderPreview()
  }, [renderPreview])

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
          keypad: false,
          expressionsTopbar: false,
          settingsMenu: true,
          zoomButtons: true,
          expressions: true,
        })
        calculatorRef.current = calc
        setDesmosReady(true)
        setCalcError(null)
        calc.setExpression({
          id: 'note',
          type: 'text',
          text: 'GearGen — graph loads from index.html API script',
        })
        queueMicrotask(() => {
          try {
            calc.resize()
          } catch {
            /* ignore */
          }
        })
      } catch (e) {
        setCalcError(e instanceof Error ? e.message : String(e))
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
        calculatorRef.current?.resize?.()
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
      calculatorRef.current = null
      setDesmosReady(false)
    }
  }, [])

  useEffect(() => {
    const calc = calculatorRef.current
    if (!calc || !desmosReady || !workspaceData) return
    if (!isFullyDefinedWorkspace(workspaceData)) return
    try {
      applyWorkspaceToDesmosCalculator(calc, workspaceData)
    } catch (e) {
      setCalcError(e instanceof Error ? e.message : String(e))
    }
  }, [workspaceData, desmosReady])

  const manualSync = useCallback(() => {
    const calc = calculatorRef.current
    if (!calc || !workspaceData) return
    try {
      applyWorkspaceToDesmosCalculator(calc, workspaceData)
      setCalcError(null)
    } catch (e) {
      setCalcError(e instanceof Error ? e.message : String(e))
    }
  }, [workspaceData])

  const fd = isFullyDefinedWorkspace(workspaceData)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-2 text-[12px] text-gg-text">
      <p className="text-[11px] leading-snug text-gg-muted">
        Desmos loads from the global API script in{' '}
        <code className="text-[10px]">index.html</code>. When PlaneGCS reports a
        fully defined sketch, coordinates sync into expressions below. Use KaTeX
        for quick LaTeX checks.
      </p>
      <div
        ref={containerRef}
        className="min-h-[280px] w-full min-w-0 flex-1 rounded-md border border-gg-border bg-gg-canvas-bg"
        aria-label="Desmos graphing calculator"
      />
      {!desmosReady ? (
        <p className="text-[11px] text-gg-muted">
          Loading calculator…
        </p>
      ) : null}
      {calcError ? (
        <p className="text-[11px] text-red-400">{calcError}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!fd || !desmosReady}
          onClick={manualSync}
          className="rounded-md border border-gg-border bg-gg-sidebar-hover px-2.5 py-1.5 text-[11px] font-medium text-gg-text transition-colors enabled:hover:border-gg-accent/50 enabled:hover:text-gg-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          Sync fully-defined sketch to graph
        </button>
        <span className="text-[10px] text-gg-muted">
          {fd
            ? 'Sketch is fully defined — sync pushes points and segments.'
            : 'Solve to fully defined (PlaneGCS) to enable geometry sync.'}
        </span>
      </div>
      <label className="flex min-h-0 flex-col gap-1">
        <span className="text-[10px] font-medium uppercase tracking-wide text-gg-muted">
          LaTeX (KaTeX preview)
        </span>
        <textarea
          id={`${id}-latex`}
          value={latex}
          onChange={(e) => setLatex(e.target.value)}
          rows={4}
          spellCheck={false}
          className="min-h-[5rem] resize-y rounded-md border border-gg-border bg-gg-workspace px-2 py-1.5 font-mono text-[11px] text-gg-text"
        />
      </label>
      <div className="rounded-md border border-gg-border/70 bg-gg-canvas-bg/40 px-3 py-3">
        <div className="text-[10px] font-medium uppercase tracking-wide text-gg-muted">
          KaTeX preview
        </div>
        {katexError ? (
          <p className="mt-2 text-[11px] text-red-400">{katexError}</p>
        ) : (
          <div
            className="mt-2 overflow-x-auto text-[14px] leading-relaxed text-gg-text [&_.katex]:text-gg-text"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        )}
      </div>
    </div>
  )
}
