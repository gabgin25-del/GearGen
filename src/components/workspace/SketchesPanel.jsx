import { useCallback, useMemo, useState } from 'react'
import { Download, FolderPlus, Trash2 } from 'lucide-react'
import { useSketches } from '../../context/SketchesContext.jsx'
import {
  geometryFromSketchPayload,
  makeGearGenPayload,
} from '../../lib/sketchPayload.js'

/**
 * @param {{
 *   sketchIsExportable: boolean
 *   exportWorkspaceJson: () => string
 *   loadWorkspaceSnapshot: (data: object) => void
 *   onMessage?: (msg: string) => void
 * }} props
 */
export function SketchesPanel({
  sketchIsExportable,
  exportWorkspaceJson,
  loadWorkspaceSnapshot,
  onMessage,
}) {
  const { sketches, addSketch, removeSketch } = useSketches()
  const [name, setName] = useState('Sketch')

  const sorted = useMemo(
    () => [...sketches].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [sketches],
  )

  const handleSave = useCallback(() => {
    if (!sketchIsExportable) {
      onMessage?.('Add geometry to the canvas before saving.')
      return
    }
    const geometry = JSON.parse(exportWorkspaceJson())
    addSketch(
      name.trim() || 'Sketch',
      makeGearGenPayload('gearge-v1', geometry),
    )
    onMessage?.(`Saved “${name.trim() || 'Sketch'}” to Sketches.`)
  }, [sketchIsExportable, exportWorkspaceJson, name, addSketch, onMessage])

  const handleExportFile = useCallback(() => {
    if (!sketchIsExportable) {
      onMessage?.('Add geometry before exporting.')
      return
    }
    const json = exportWorkspaceJson()
    const blob = new Blob([json], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${(name.trim() || 'sketch').replace(/\s+/g, '-')}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }, [sketchIsExportable, exportWorkspaceJson, name, onMessage])

  const handleLoad = useCallback(
    (id) => {
      const e = sketches.find((x) => x.id === id)
      if (!e) return
      const geo =
        geometryFromSketchPayload(e.payload) ??
        (e.data && typeof e.data === 'object' ? e.data : null)
      if (!geo) {
        if (e.payload?.desmosState && !e.payload?.geometry) {
          onMessage?.(
            'This entry has no native geometry yet (external graph only).',
          )
          return
        }
        onMessage?.('Could not read geometry for that sketch.')
        return
      }
      loadWorkspaceSnapshot(geo)
      onMessage?.(`Loaded “${e.name}”.`)
    },
    [sketches, loadWorkspaceSnapshot, onMessage],
  )

  const handleDelete = useCallback(
    (id) => {
      removeSketch(id)
    },
    [removeSketch],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-2 text-[12px] text-gg-text">
      <p className="text-[11px] leading-snug text-gg-muted">
        Region fill appears only when the sketch is constraint-consistent and
        every vertex of a closed region is fully defined (no motion without
        breaking constraints). Payloads can later include a Desmos API string
        alongside <code className="text-[10px]">geometry</code>.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-[7rem] flex-1 flex-col gap-0.5">
          <span className="text-[10px] font-medium uppercase tracking-wide text-gg-muted">
            Name
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-gg-border bg-gg-workspace px-2 py-1.5 text-[12px] text-gg-text"
          />
        </label>
        <button
          type="button"
          disabled={!sketchIsExportable}
          onClick={handleSave}
          className="flex items-center gap-1.5 rounded-md border border-gg-border bg-gg-sidebar-hover px-2.5 py-1.5 text-[11px] font-medium transition-colors enabled:hover:border-gg-accent/50 enabled:hover:text-gg-accent disabled:opacity-35"
        >
          <FolderPlus className="size-3.5" strokeWidth={2} aria-hidden />
          Save
        </button>
        <button
          type="button"
          disabled={!sketchIsExportable}
          onClick={handleExportFile}
          className="flex items-center gap-1.5 rounded-md border border-gg-border px-2.5 py-1.5 text-[11px] font-medium transition-colors enabled:hover:border-gg-accent/50 enabled:hover:text-gg-accent disabled:opacity-35"
        >
          <Download className="size-3.5" strokeWidth={2} aria-hidden />
          Export JSON
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-gg-border/60 bg-gg-workspace/20">
        {sorted.length === 0 ? (
          <p className="p-3 text-[11px] text-gg-muted">No sketches saved yet.</p>
        ) : (
          <ul className="divide-y divide-gg-border/40">
            {sorted.map((e) => (
              <li
                key={e.id}
                className="flex items-center gap-2 px-2 py-2 hover:bg-white/[0.04]"
              >
                <button
                  type="button"
                  onClick={() => handleLoad(e.id)}
                  className="min-w-0 flex-1 truncate text-left text-[12px] font-medium text-gg-text hover:text-gg-accent"
                >
                  {e.name}
                </button>
                <span className="shrink-0 text-[10px] text-gg-muted tabular-nums">
                  {new Date(e.createdAt).toLocaleDateString()}
                </span>
                <button
                  type="button"
                  title="Delete"
                  onClick={() => handleDelete(e.id)}
                  className="shrink-0 rounded p-1 text-gg-muted hover:bg-red-500/15 hover:text-red-300"
                >
                  <Trash2 className="size-3.5" strokeWidth={2} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
