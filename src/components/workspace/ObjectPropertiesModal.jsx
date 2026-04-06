import { useMemo } from 'react'
import { circleWithResolvedCenter } from '../../lib/circleResolve.js'
import {
  buildConstraintTypeSerialMap,
  constraintsInvolvingEntity,
} from '../../lib/sketchEntityConstraints.js'
import {
  DEFAULT_DOCUMENT_UNITS,
  formatLengthMmForDisplay,
  worldMmToDisplay,
} from '../../lib/sketchUnits.js'
import { sampleSplinePolyline } from '../../lib/splineMath.js'

/**
 * @param {object} data
 * @param {{ kind: string; id: string } | null} entity
 * @param {import('../../lib/sketchUnits.js').DocumentUnits | undefined} docUnits
 */
function describeEntity(data, entity, docUnits) {
  if (!entity) return { title: '', rows: [] }
  const pmap = new Map((data.points ?? []).map((p) => [p.id, p]))
  const du = docUnits ?? DEFAULT_DOCUMENT_UNITS

  if (entity.kind === 'point') {
    const p = pmap.get(entity.id)
    if (!p) return { title: 'Point', rows: [] }
    const xd = worldMmToDisplay(p.x, du)
    const yd = worldMmToDisplay(p.y, du)
    return {
      title: 'Point',
      rows: [
        { k: 'ID', v: entity.id },
        { k: 'X', v: `${xd.toFixed(4)} (display)` },
        { k: 'Y', v: `${yd.toFixed(4)} (display)` },
        { k: 'X (world mm)', v: String(p.x) },
        { k: 'Y (world mm)', v: String(p.y) },
      ],
    }
  }

  if (entity.kind === 'segment') {
    const s = (data.segments ?? []).find((x) => x.id === entity.id)
    if (!s) return { title: 'Line', rows: [] }
    const pa = pmap.get(s.a)
    const pb = pmap.get(s.b)
    if (!pa || !pb) return { title: 'Line', rows: [] }
    const dx = pb.x - pa.x
    const dy = pb.y - pa.y
    const L = Math.hypot(dx, dy)
    const angDeg = (Math.atan2(dy, dx) * 180) / Math.PI
    return {
      title: 'Line (segment)',
      rows: [
        { k: 'ID', v: entity.id },
        {
          k: 'Length',
          v: `${formatLengthMmForDisplay(L, du)} mm`,
        },
        {
          k: 'Angle',
          v: `${angDeg.toFixed(2)}° (from +X)`,
        },
        { k: 'Endpoint A', v: s.a },
        { k: 'Endpoint B', v: s.b },
        { k: 'Construction', v: s.construction ? 'Yes' : 'No' },
      ],
    }
  }

  if (entity.kind === 'circle') {
    const c = (data.circles ?? []).find((x) => x.id === entity.id)
    if (!c) return { title: 'Circle', rows: [] }
    const rc = circleWithResolvedCenter(c, pmap)
    return {
      title: 'Circle',
      rows: [
        { k: 'ID', v: entity.id },
        { k: 'Center X (mm)', v: String(rc.cx) },
        { k: 'Center Y (mm)', v: String(rc.cy) },
        {
          k: 'Radius',
          v: `${formatLengthMmForDisplay(rc.r, du)} mm`,
        },
        {
          k: 'Diameter',
          v: `${formatLengthMmForDisplay(2 * rc.r, du)} mm`,
        },
        ...(c.centerId ? [{ k: 'Center point', v: c.centerId }] : []),
      ],
    }
  }

  if (entity.kind === 'arc') {
    const a = (data.arcs ?? []).find((x) => x.id === entity.id)
    if (!a) return { title: 'Arc', rows: [] }
    const rc = circleWithResolvedCenter(a, pmap)
    const sweepDeg = (a.sweep * 180) / Math.PI
    return {
      title: 'Arc',
      rows: [
        { k: 'ID', v: entity.id },
        { k: 'Center X (mm)', v: String(rc.cx) },
        { k: 'Center Y (mm)', v: String(rc.cy) },
        {
          k: 'Radius',
          v: `${formatLengthMmForDisplay(rc.r, du)} mm`,
        },
        { k: 'Start angle (rad)', v: String(a.a0) },
        { k: 'Sweep (rad)', v: String(a.sweep) },
        { k: 'Sweep (°)', v: `${sweepDeg.toFixed(2)}°` },
        { k: 'Center point', v: a.centerId ?? '—' },
      ],
    }
  }

  if (entity.kind === 'polygon') {
    const poly = (data.polygons ?? []).find((x) => x.id === entity.id)
    if (!poly) return { title: 'Polygon', rows: [] }
    return {
      title: 'Polygon',
      rows: [
        { k: 'ID', v: entity.id },
        { k: 'Vertices', v: String(poly.vertexIds?.length ?? 0) },
        { k: 'Filled', v: poly.fill ? 'Yes' : 'No' },
      ],
    }
  }

  if (entity.kind === 'spline') {
    const sp = (data.splines ?? []).find((x) => x.id === entity.id)
    if (!sp) return { title: 'Spline', rows: [] }
    const verts = sp.vertexIds.map((id) => pmap.get(id)).filter(Boolean)
    const samples = sampleSplinePolyline(verts, sp.splineType, {
      tension: sp.tension ?? 0.5,
      closed: !!sp.closed,
      segmentsPerSpan: sp.segmentsPerSpan ?? 14,
    })
    let approxLen = 0
    for (let i = 1; i < samples.length; i++) {
      approxLen += Math.hypot(
        samples[i].x - samples[i - 1].x,
        samples[i].y - samples[i - 1].y,
      )
    }
    return {
      title: 'Spline',
      rows: [
        { k: 'ID', v: entity.id },
        { k: 'Type', v: sp.splineType ?? '—' },
        { k: 'Knots', v: String(verts.length) },
        { k: 'Closed', v: sp.closed ? 'Yes' : 'No' },
        {
          k: 'Approx. length',
          v: `${formatLengthMmForDisplay(approxLen, du)} mm`,
        },
      ],
    }
  }

  return {
    title: entity.kind,
    rows: [{ k: 'ID', v: entity.id }],
  }
}

/**
 * @param {{
 *   open: boolean
 *   entity: { kind: string; id: string } | null
 *   data: object
 *   onClose: () => void
 *   theme?: 'light' | 'dark'
 *   labelDrawOptions?: { documentUnits?: import('../../lib/sketchUnits.js').DocumentUnits }
 * }} props
 */
export function ObjectPropertiesModal({
  open,
  entity,
  data,
  onClose,
  theme = 'dark',
  labelDrawOptions,
}) {
  const serialById = useMemo(
    () => buildConstraintTypeSerialMap(data.constraints ?? []),
    [data.constraints],
  )

  const involved = useMemo(() => {
    if (!open || !entity) return []
    return constraintsInvolvingEntity(data, entity.kind, entity.id)
  }, [open, entity, data])

  const du = labelDrawOptions?.documentUnits ?? DEFAULT_DOCUMENT_UNITS
  const { title, rows } = useMemo(
    () => describeEntity(data, entity, du),
    [data, entity, du],
  )

  if (!open || !entity) return null

  const panel =
    theme === 'light'
      ? 'border-gg-border bg-white text-neutral-900 shadow-xl'
      : 'border-gg-border bg-gg-workspace text-gg-text shadow-xl'

  return (
    <div
      className="fixed inset-0 z-[200] flex items-stretch justify-end bg-black/35 p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="obj-props-title"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
    >
      <div
        className={`flex h-full w-full max-w-md flex-col overflow-hidden rounded-lg border ${panel}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-gg-border/60 px-3 py-2">
          <h2 id="obj-props-title" className="text-[14px] font-semibold">
            Object properties
          </h2>
          <button
            type="button"
            className="rounded px-2 py-1 text-[12px] text-gg-muted hover:bg-white/10 hover:text-gg-text"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 text-[12px]">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-gg-muted">
            {title}
          </p>
          <dl className="mb-4 grid grid-cols-[7rem_1fr] gap-x-2 gap-y-1.5">
            {rows.map((r) => (
              <div key={r.k} className="contents">
                <dt className="text-gg-muted">{r.k}</dt>
                <dd className="font-mono text-[11px] tabular-nums text-gg-text">
                  {r.v}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-gg-muted">
            Constraints &amp; driving dimensions
          </p>
          {involved.length === 0 ? (
            <p className="text-[12px] text-gg-muted">None on this entity.</p>
          ) : (
            <ul className="space-y-1.5">
              {involved.map((item) => {
                const sn =
                  item.category === 'constraint'
                    ? serialById.get(item.id)
                    : null
                const label =
                  item.category === 'constraint' && sn
                    ? `${item.label} ${sn}`
                    : item.label
                return (
                  <li
                    key={`${item.category}:${item.id}`}
                    className="rounded border border-gg-border/50 bg-gg-canvas-bg/40 px-2 py-1.5"
                  >
                    <span className="text-[10px] uppercase text-gg-muted">
                      {item.category}
                    </span>
                    <div className="text-[12px] font-medium">{label}</div>
                    <div className="font-mono text-[10px] text-gg-muted">
                      {item.type} · {item.id}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * @param {{
 *   x: number
 *   y: number
 *   onObjectProperties: () => void
 *   onClose: () => void
 *   theme?: 'light' | 'dark'
 *   segmentConstruction?: boolean
 *   onToggleConstruction?: () => void
 * }} props
 */
export function SketchContextMenu({
  x,
  y,
  onObjectProperties,
  onClose,
  theme,
  segmentConstruction,
  onToggleConstruction,
}) {
  const panel =
    theme === 'light'
      ? 'border border-neutral-300 bg-white text-neutral-900 shadow-lg'
      : 'border border-gg-border bg-gg-workspace text-gg-text shadow-lg'
  const item =
    theme === 'light'
      ? 'hover:bg-neutral-100'
      : 'hover:bg-white/10'
  return (
    <div
      data-sketch-context-menu
      className={`fixed z-[210] min-w-[11rem] overflow-hidden rounded-md py-0.5 ${panel}`}
      style={{ left: x, top: y }}
      role="menu"
    >
      <button
        type="button"
        role="menuitem"
        className={`block w-full px-3 py-2 text-left text-[13px] ${item}`}
        onClick={() => {
          onObjectProperties()
          onClose()
        }}
      >
        Object properties…
      </button>
      {onToggleConstruction ? (
        <button
          type="button"
          role="menuitem"
          className={`block w-full px-3 py-2 text-left text-[13px] ${item}`}
          onClick={() => {
            onToggleConstruction()
          }}
        >
          {segmentConstruction
            ? 'Use as solid geometry'
            : 'Construction geometry'}
        </button>
      ) : null}
    </div>
  )
}
