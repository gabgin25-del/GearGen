import {
  Anchor,
  AlignJustify,
  ArrowDown,
  ArrowRight,
  Columns2,
  CornerDownRight,
  Equal,
  FlipHorizontal,
  Link2,
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
    <div className="flex flex-col gap-1 p-0">
      <div className="flex flex-row flex-wrap gap-1.5">
        {RELATION_TYPE_OPTIONS.map((o) => {
          const Icon = RELATION_ICON[o.id] ?? Link2
          return (
            <button
              key={o.id}
              type="button"
              title={`${o.label} — apply to current selection`}
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
