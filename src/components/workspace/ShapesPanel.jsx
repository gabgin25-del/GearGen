import { Circle, Hexagon, RectangleHorizontal, Shapes } from 'lucide-react'
import { useEffect, useState } from 'react'
import { TOOL } from '../../hooks/useWorkspaceScene.js'

const btnClass = (active) =>
  [
    'flex shrink-0 items-center gap-2 rounded-md border px-2 py-2 text-left text-[12px] transition-colors',
    active
      ? 'border-gg-accent bg-gg-accent-soft text-gg-text'
      : 'border-gg-border text-gg-muted hover:border-gg-accent/40 hover:text-gg-text',
  ].join(' ')

/**
 * @param {{
 *   tool: string
 *   onToolChange: (t: string) => void
 *   presetNgonSides: number
 *   onPresetNgonSidesChange: (n: number) => void
 * }} props
 */
export function ShapesPanel({
  tool,
  onToolChange,
  presetNgonSides,
  onPresetNgonSidesChange,
}) {
  const [nStr, setNStr] = useState(String(presetNgonSides))

  useEffect(() => {
    setNStr(String(presetNgonSides))
  }, [presetNgonSides])

  const flushNgonSides = () => {
    const raw = nStr.trim()
    let n = parseInt(raw, 10)
    if (!Number.isFinite(n) || raw === '') n = 3
    n = Math.min(96, Math.max(3, n))
    setNStr(String(n))
    onPresetNgonSidesChange(n)
  }

  const rowItems = [
    {
      id: TOOL.CIRCLE,
      label: 'Circle',
      hint: 'Center, then rim — center is a point you can move',
      icon: Circle,
    },
    {
      id: TOOL.POLYGON,
      label: 'Polygon',
      hint: 'Click vertices; first point again or close to finish',
      icon: Hexagon,
    },
    {
      id: TOOL.SHAPE_RECT,
      label: 'Rectangle',
      hint: 'Axis-aligned: two opposite corners',
      icon: RectangleHorizontal,
    },
  ]

  const ngonActive = tool === TOOL.SHAPE_NGON
  const ShapesIcon = Shapes

  return (
    <div className="flex w-full min-w-0 flex-nowrap items-center gap-x-1 overflow-visible py-2">
      {rowItems.map((it) => {
        const Icon = it.icon
        const active = tool === it.id
        return (
          <button
            key={it.id}
            type="button"
            title={it.hint}
            onClick={() => onToolChange(it.id)}
            className={btnClass(active)}
          >
            <Icon className="size-4 shrink-0 opacity-90" strokeWidth={1.75} />
            <span className="whitespace-nowrap font-medium">{it.label}</span>
          </button>
        )
      })}
      <div
        className={[
          'flex shrink-0 flex-row items-stretch overflow-hidden rounded-md border',
          ngonActive
            ? 'border-gg-accent bg-gg-accent-soft'
            : 'border-gg-border bg-gg-workspace/30',
        ].join(' ')}
      >
        <button
          type="button"
          title="Center, then vertex — sides field on the right"
          onClick={() => onToolChange(TOOL.SHAPE_NGON)}
          className={[
            'flex items-center gap-2 border-r border-gg-border/80 px-2 py-2 text-left text-[12px] transition-colors',
            ngonActive
              ? 'text-gg-text'
              : 'text-gg-muted hover:bg-white/[0.04] hover:text-gg-text',
          ].join(' ')}
        >
          <ShapesIcon
            className="size-4 shrink-0 opacity-90"
            strokeWidth={1.75}
          />
          <span className="whitespace-nowrap font-medium">Regular n-gon</span>
        </button>
        <input
          type="text"
          inputMode="numeric"
          value={nStr}
          onChange={(e) =>
            setNStr(e.target.value.replace(/[^\d]/g, ''))
          }
          onBlur={flushNgonSides}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur()
            }
          }}
          className="w-11 min-w-[2.75rem] border-0 bg-gg-workspace px-2 py-2 text-center text-[12px] text-gg-text tabular-nums outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-gg-accent"
          aria-label="Number of sides for regular polygon"
        />
      </div>
    </div>
  )
}
