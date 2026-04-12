import { useCallback } from 'react'
import { useDesmosBridge } from '../../hooks/useDesmosBridge.js'
import { applyWorkspaceToDesmosCalculator } from '../../lib/desmosSketchBridge.js'
import { convertDesmosToSketch } from '../../lib/convertDesmosToSketch.js'

/**
 * Sidebar controls for the Desmos bridge (calculator instance lives in DesmosMainView).
 *
 * @param {{
 *   workspaceData?: object
 *   commit: (fn: (d: object) => object) => void
 *   nextId: (prefix: string) => string
 *   defaultFillRgba?: string
 *   onMessage?: (msg: string) => void
 * }} props
 */
export function DesmosPanel({
  workspaceData,
  commit,
  nextId,
  defaultFillRgba,
  onMessage,
}) {
  const { getCalculator } = useDesmosBridge()

  const onExportToWorkspace = useCallback(async () => {
    const calc = getCalculator()
    if (!calc) {
      onMessage?.('Switch to the Desmos tab so the calculator is active.')
      return
    }
    const n = await convertDesmosToSketch(calc, commit, nextId, {
      defaultFillRgba,
    })
    if (n > 0) {
      onMessage?.(
        `Imported ${n} curve layer(s). Open the Drawing tab to edit the sketch.`,
      )
    } else {
      onMessage?.(
        'No graphable curves found. Add explicit y=f(x) or a numeric table.',
      )
    }
  }, [commit, nextId, defaultFillRgba, getCalculator, onMessage])

  const onLatexSync = useCallback(() => {
    const calc = getCalculator()
    if (!calc) {
      onMessage?.('Switch to the Desmos tab so the calculator is active.')
      return
    }
    try {
      applyWorkspaceToDesmosCalculator(calc, workspaceData ?? {})
      onMessage?.('Workspace geometry pushed to Desmos (when fully defined).')
    } catch (e) {
      onMessage?.(e instanceof Error ? e.message : String(e))
    }
  }, [getCalculator, workspaceData, onMessage])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
      <button
        type="button"
        onClick={onExportToWorkspace}
        className="rounded-md border border-gg-border bg-gg-sidebar-hover px-3 py-2 text-[12px] font-medium text-gg-text transition-colors hover:border-gg-accent/50 hover:text-gg-accent"
      >
        Export to Workspace
      </button>
      <button
        type="button"
        onClick={onLatexSync}
        className="rounded-md border border-gg-border px-3 py-2 text-[12px] font-medium text-gg-text transition-colors hover:border-gg-accent/50 hover:text-gg-accent"
      >
        LaTeX Sync
      </button>
    </div>
  )
}
