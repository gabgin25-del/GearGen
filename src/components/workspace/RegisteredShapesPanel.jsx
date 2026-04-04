import { useMemo } from 'react'
import { listRegisteredShapes } from '../../lib/geometryMetrics.js'

function fmt(n) {
  if (n == null || Number.isNaN(n)) return '—'
  if (n < 0.01 || n > 1e6) return n.toExponential(2)
  return n.toFixed(1)
}

export function RegisteredShapesPanel({ workspaceData, className = '' }) {
  const rows = useMemo(
    () => listRegisteredShapes(workspaceData),
    [workspaceData],
  )

  if (rows.length === 0) {
    return (
      <div
        className={[
          'rounded-lg border border-gg-border border-dashed bg-gg-sidebar/15 px-3 py-2.5 text-[12px] text-gg-muted',
          className,
        ].join(' ')}
      >
        No registered shapes yet. Close a polygon, draw a circle or arc, or place an
        angle. Metrics update live when you move points. Toggle fill to shade regions.
      </div>
    )
  }

  return (
    <div
      className={[
        'max-h-40 overflow-auto rounded-lg border border-gg-border bg-gg-sidebar/25',
        className,
      ].join(' ')}
    >
      <div className="sticky top-0 border-b border-gg-border bg-gg-sidebar/80 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-gg-muted">
        Registered geometry ({rows.length})
      </div>
      <table className="w-full text-left text-[12px] text-gg-text">
        <thead className="text-gg-muted">
          <tr className="border-b border-gg-border/80">
            <th className="px-3 py-1.5 font-medium">Type</th>
            <th className="px-2 py-1.5 font-medium">Area</th>
            <th className="px-2 py-1.5 font-medium">Length / angle</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-gg-border/40 last:border-0 hover:bg-white/[0.04]"
            >
              <td className="px-3 py-1.5 tabular-nums text-gg-muted">
                {row.kind}
              </td>
              <td className="px-2 py-1.5 tabular-nums">
                {row.area != null ? fmt(row.area) : '—'}
              </td>
              <td className="px-2 py-1.5 tabular-nums text-gg-muted">
                {row.detail != null
                  ? row.detail
                  : row.perimeter != null
                    ? fmt(row.perimeter)
                    : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
