import katex from 'katex'
import 'katex/dist/katex.min.css'
import { useCallback, useEffect, useId, useState } from 'react'

const STORAGE_KEY = 'geargen-desmos-api-key'
const LATEX_STORAGE_KEY = 'geargen-desmos-latex-preview'

/**
 * Desmos bridge: API key storage and LaTeX preview for math-driven visualization.
 */
export function DesmosPanel() {
  const id = useId()
  const [apiKey, setApiKey] = useState('')
  const [latex, setLatex] = useState(String.raw`y = \sin\left(\frac{\pi}{6} x\right)`)
  const [previewHtml, setPreviewHtml] = useState('')
  const [katexError, setKatexError] = useState(null)

  useEffect(() => {
    try {
      setApiKey(localStorage.getItem(STORAGE_KEY) ?? '')
      const saved = localStorage.getItem(LATEX_STORAGE_KEY)
      if (saved) setLatex(saved)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, apiKey)
    } catch {
      /* ignore */
    }
  }, [apiKey])

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

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-2 text-[12px] text-gg-text">
      <p className="text-[11px] leading-snug text-gg-muted">
        Store your Desmos API key locally for embedding graphs. LaTeX preview uses
        KaTeX for quick validation of expressions before wiring the calculator.
      </p>
      <label className="flex flex-col gap-1" htmlFor={`${id}-desmos-key`}>
        <span className="text-[10px] font-medium uppercase tracking-wide text-gg-muted">
          Desmos API key
        </span>
        <input
          id={`${id}-desmos-key`}
          type="password"
          autoComplete="off"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Paste key (stored in this browser only)"
          className="rounded-md border border-gg-border bg-gg-workspace px-2 py-1.5 font-mono text-[11px] text-gg-text"
        />
      </label>
      <label className="flex min-h-0 flex-1 flex-col gap-1">
        <span className="text-[10px] font-medium uppercase tracking-wide text-gg-muted">
          LaTeX
        </span>
        <textarea
          value={latex}
          onChange={(e) => setLatex(e.target.value)}
          rows={5}
          spellCheck={false}
          className="min-h-[6rem] resize-y rounded-md border border-gg-border bg-gg-workspace px-2 py-1.5 font-mono text-[11px] text-gg-text"
        />
      </label>
      <div className="rounded-md border border-gg-border/70 bg-gg-canvas-bg/40 px-3 py-3">
        <div className="text-[10px] font-medium uppercase tracking-wide text-gg-muted">
          Preview
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
