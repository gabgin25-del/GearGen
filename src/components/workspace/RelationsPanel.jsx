import {
  Anchor,
  AlignJustify,
  ArrowDown,
  ArrowRight,
  CircleDot,
  CornerDownRight,
  Equal,
  FlipHorizontal,
  Link2,
  Minus,
  Ratio,
  Spline,
  Target,
} from 'lucide-react'
import { RELATION_TYPE_OPTIONS } from '../../hooks/useWorkspaceScene.js'

const RELATION_ICON = {
  fixOrigin: Anchor,
  equal: Equal,
  parallel: AlignJustify,
  perpendicular: CornerDownRight,
  tangent: Spline,
  concentric: Target,
  coincident: Link2,
  collinear: Minus,
  horizontal: ArrowRight,
  vertical: ArrowDown,
  symmetric: FlipHorizontal,
  similar: Ratio,
}

const btnClass =
  'flex size-9 shrink-0 items-center justify-center rounded-md border border-gg-border bg-gg-workspace/40 text-gg-text shadow-sm transition-colors hover:border-gg-accent/45 hover:bg-white/[0.06] active:bg-white/[0.08]'

/**
 * @param {{
 *   sketchSelection?: { kind: string; id: string }[]
 *   applySketchRelation: (type: string) => void
 * }} props
 */
export function RelationsPanel({ applySketchRelation }) {
  return (
    <div className="flex flex-col gap-2 p-0">
      <p className="text-[10px] leading-snug text-gg-muted">
        SolidWorks-style sketch relations. Pick entities, then tap an icon.
        Coincident includes point-on-line; Equal includes equal radius on two
        circles.
      </p>
      <div className="flex flex-row flex-wrap gap-1.5">
        {RELATION_TYPE_OPTIONS.map((o) => {
          const Icon = RELATION_ICON[o.id] ?? CircleDot
          const desc = o.description ?? o.label
          return (
            <button
              key={o.id}
              type="button"
              title={`${o.label} — ${desc}`}
              aria-label={o.label}
              onClick={() => applySketchRelation(o.id)}
              className={btnClass}
            >
              <Icon className="size-4 shrink-0 opacity-90" strokeWidth={1.85} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
