import {
  Activity,
  ChevronDown,
  ChevronRight,
  CircleDot,
  FolderPlus,
  GitBranch,
  LayoutGrid,
  Link2,
  ListTree,
  Minus,
  MousePointer2,
  Orbit,
  Pencil,
  Redo2,
  Ruler,
  Trash2,
  Undo2,
} from 'lucide-react'
import { AngleToolIcon } from '../icons/AngleToolIcon.jsx'
import {
  ARC_MODE,
  SPLINE_TYPE_OPTIONS,
  TOOL,
} from '../../hooks/useWorkspaceScene.js'
import { RelationsPanel } from './RelationsPanel.jsx'
import { ShapesPanel } from './ShapesPanel.jsx'

const sketchTools = [
  { id: TOOL.FREEHAND, label: 'Free draw', icon: Pencil },
  { id: TOOL.POINT, label: 'Point', icon: CircleDot },
  {
    id: TOOL.DIMENSION,
    label: 'Dimension — driving length on segment; click label to edit',
    icon: Ruler,
  },
]

const curveTools = [
  { id: TOOL.SEGMENT, label: 'Segment', icon: Minus },
  {
    id: TOOL.ARC,
    label: 'Arc — center, 3-point, or tangent (chips when active)',
    icon: Orbit,
  },
  {
    id: TOOL.ANGLE,
    label: 'Angle — vertex, then two arm points',
    icon: AngleToolIcon,
  },
  {
    id: TOOL.SPLINE,
    label:
      'Spline — click again to fold the spline toolbox; Enter commits; Esc commits and closes if near start',
    icon: GitBranch,
  },
]

const SPLINE_TYPE_ICONS = {
  catmullRom: GitBranch,
  naturalCubic: Activity,
  uniformBSpline: LayoutGrid,
  chordalCatmullRom: Link2,
  quadraticAnchors: CircleDot,
  cubicAnchors: ListTree,
}

const ARC_MODE_ITEMS = [
  {
    id: ARC_MODE.CENTER,
    label: 'Center',
    title:
      'Center point, then start on arc, then end — cursor picks minor vs major arc',
  },
  {
    id: ARC_MODE.THREE_POINT,
    label: '3-pt',
    title:
      'Two points define a chord; third point is a bulge on the circle through all three',
  },
  {
    id: ARC_MODE.TANGENT,
    label: 'Tangent',
    title:
      'Click an existing segment for tangent start, then pick the arc endpoint',
  },
]

/** @param {{ sectionKey: string, label: string, open: boolean, onToggle: (k: string) => void, contentClassName?: string, children: import('react').ReactNode }} props */
function RibbonSection({
  sectionKey,
  label,
  open,
  onToggle,
  contentClassName,
  children,
}) {
  const Chev = open ? ChevronDown : ChevronRight
  return (
    <div className="flex min-w-0 shrink-0 flex-row items-stretch rounded-md border border-gg-border/60 bg-gg-workspace/25">
      <button
        type="button"
        title={label}
        onClick={() => onToggle(sectionKey)}
        className="flex w-[4.75rem] min-w-0 max-w-[5.5rem] shrink-0 flex-row items-center gap-0.5 border-r border-gg-border/50 px-1 py-1 text-left text-[9px] font-semibold uppercase leading-tight tracking-wide text-gg-muted transition-colors hover:bg-white/[0.06] hover:text-gg-text"
        aria-expanded={open}
      >
        <Chev className="size-3 shrink-0 opacity-80" strokeWidth={2} />
        <span className="min-w-0 truncate">{label}</span>
      </button>
      {open ? (
        <div
          className={
            contentClassName ??
            'flex min-w-0 flex-row flex-wrap items-center gap-x-1 gap-y-1 px-1 py-1'
          }
        >
          {children}
        </div>
      ) : null}
    </div>
  )
}

function ToolBtn({ item, tool, onToolChange }) {
  const Icon = item.icon
  const active = tool === item.id
  return (
    <button
      type="button"
      title={item.label}
      aria-pressed={active}
      onClick={() => onToolChange(item.id)}
      className={[
        'flex size-9 shrink-0 items-center justify-center rounded-md transition-colors',
        active
          ? 'bg-white/[0.12] text-gg-text shadow-sm'
          : 'text-gg-muted hover:bg-gg-sidebar-hover hover:text-gg-text',
      ].join(' ')}
    >
      <Icon className="size-4" strokeWidth={1.75} />
    </button>
  )
}

function GroupDivider() {
  return <div className="mx-0.5 h-6 w-px shrink-0 bg-gg-border" aria-hidden />
}

export function WorkspaceToolbar({
  tool,
  onToolChange,
  onClear,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  canSaveSketch,
  onSaveSketch,
  ribbonSectionsOpen,
  onRibbonSectionToggle,
  presetNgonSides,
  onPresetNgonSidesChange,
  sketchSelection,
  applySketchRelation,
  arcMode,
  onArcModeChange,
  splineType,
  onSplineTypeChange,
  splineTension,
  onSplineTensionChange,
  splineClosed,
  onSplineClosedChange,
  splineSegmentsPerSpan,
  onSplineSegmentsPerSpanChange,
  splinePanelOpen,
}) {
  const sections = ribbonSectionsOpen ?? {
    sketch: true,
    curves: true,
    shapes: true,
    relations: true,
  }

  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg border border-gg-border bg-gg-sidebar/40 p-1">
      <div className="flex min-w-0 flex-wrap items-stretch gap-x-2 gap-y-2 pb-0.5">
          <RibbonSection
            sectionKey="sketch"
            label="Sketch"
            open={sections.sketch}
            onToggle={onRibbonSectionToggle}
          >
            {sketchTools.map((item) => (
              <ToolBtn
                key={item.id}
                item={item}
                tool={tool}
                onToolChange={onToolChange}
              />
            ))}
          </RibbonSection>
          <RibbonSection
            sectionKey="curves"
            label="Curves"
            open={sections.curves}
            onToggle={onRibbonSectionToggle}
            contentClassName="flex min-w-0 max-w-[min(100%,48rem)] flex-row flex-wrap items-center gap-x-1 gap-y-1 px-1 py-1"
          >
            {curveTools.map((item) => (
              <ToolBtn
                key={item.id}
                item={item}
                tool={tool}
                onToolChange={onToolChange}
              />
            ))}
            {tool === TOOL.ARC && onArcModeChange ? (
              <>
                <GroupDivider />
                <div
                  className="flex shrink-0 flex-wrap items-center gap-0.5 rounded-md border border-gg-border/70 bg-gg-workspace/40 px-0.5 py-0.5"
                  role="group"
                  aria-label="Arc mode"
                >
                  {ARC_MODE_ITEMS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      title={m.title}
                      onClick={() => onArcModeChange(m.id)}
                      className={[
                        'rounded px-1.5 py-1 text-[10px] font-medium uppercase tracking-wide transition-colors',
                        arcMode === m.id
                          ? 'bg-white/[0.12] text-gg-text'
                          : 'text-gg-muted hover:bg-white/[0.06] hover:text-gg-text',
                      ].join(' ')}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
            {tool === TOOL.SPLINE &&
            splinePanelOpen &&
            onSplineTypeChange &&
            onSplineTensionChange &&
            onSplineClosedChange &&
            onSplineSegmentsPerSpanChange ? (
              <>
                <GroupDivider />
                <div
                  className="flex min-w-0 max-w-[min(100%,40rem)] flex-row flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-gg-border/70 bg-gg-workspace/40 px-1 py-1"
                  role="group"
                  aria-label="Spline toolbox"
                >
                  <span className="shrink-0 px-0.5 text-[9px] font-medium uppercase tracking-wide text-gg-muted">
                    Spline
                  </span>
                  <div className="flex min-w-0 flex-1 flex-wrap gap-0.5">
                    {SPLINE_TYPE_OPTIONS.map((o) => {
                      const SIcon = SPLINE_TYPE_ICONS[o.id] ?? GitBranch
                      return (
                        <button
                          key={o.id}
                          type="button"
                          title={o.label}
                          onClick={() => onSplineTypeChange(o.id)}
                          className={[
                            'flex max-w-[11rem] items-center gap-1 truncate rounded px-1.5 py-0.5 text-[9px] font-medium transition-colors',
                            splineType === o.id
                              ? 'bg-white/[0.12] text-gg-text'
                              : 'text-gg-muted hover:bg-white/[0.06] hover:text-gg-text',
                          ].join(' ')}
                        >
                          <SIcon
                            className="size-3 shrink-0 opacity-90"
                            strokeWidth={2}
                            aria-hidden
                          />
                          <span className="truncate">
                            {o.label.replace(/\s*\(.+\)\s*$/, '')}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 px-0.5">
                    <label className="flex min-w-[7rem] flex-1 items-center gap-1 text-[10px] text-gg-muted">
                      <span className="shrink-0">Tension</span>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={splineTension}
                        onChange={(e) =>
                          onSplineTensionChange(Number(e.target.value))
                        }
                        className="min-w-0 flex-1 accent-gg-accent"
                        aria-label="Spline tension"
                      />
                      <span className="w-7 shrink-0 tabular-nums text-gg-text">
                        {splineTension.toFixed(2)}
                      </span>
                    </label>
                    <label className="flex items-center gap-1 text-[10px] text-gg-muted">
                      <span>Samples</span>
                      <input
                        type="number"
                        min={4}
                        max={48}
                        step={1}
                        value={splineSegmentsPerSpan}
                        onChange={(e) =>
                          onSplineSegmentsPerSpanChange(
                            Math.min(
                              48,
                              Math.max(
                                4,
                                Math.round(Number(e.target.value)),
                              ),
                            ),
                          )
                        }
                        className="w-11 rounded border border-gg-border bg-gg-workspace px-1 py-0.5 text-[10px] text-gg-text tabular-nums"
                      />
                    </label>
                    <label className="flex cursor-pointer items-center gap-1 text-[10px] text-gg-text">
                      <input
                        type="checkbox"
                        className="size-3 rounded border-gg-border bg-gg-workspace accent-gg-accent"
                        checked={splineClosed}
                        onChange={(e) =>
                          onSplineClosedChange(e.target.checked)
                        }
                      />
                      Closed
                    </label>
                  </div>
                </div>
              </>
            ) : null}
          </RibbonSection>
          <RibbonSection
            sectionKey="shapes"
            label="Shapes"
            open={sections.shapes}
            onToggle={onRibbonSectionToggle}
            contentClassName="flex min-w-0 flex-row flex-nowrap items-stretch gap-1 overflow-visible px-1 py-1"
          >
            <div className="min-w-0">
              <ShapesPanel
                tool={tool}
                onToolChange={onToolChange}
                presetNgonSides={presetNgonSides}
                onPresetNgonSidesChange={onPresetNgonSidesChange}
              />
            </div>
          </RibbonSection>
          <RibbonSection
            sectionKey="relations"
            label="Relations"
            open={sections.relations}
            onToggle={onRibbonSectionToggle}
            contentClassName="flex min-w-0 max-w-[min(100%,36rem)] flex-row flex-wrap items-center gap-1.5 px-1 py-1"
          >
            <div className="min-w-0">
              <RelationsPanel
                sketchSelection={sketchSelection}
                applySketchRelation={applySketchRelation}
              />
            </div>
          </RibbonSection>
        </div>
      <div className="flex w-full min-w-0 shrink-0 flex-wrap items-center gap-0.5 border-t border-gg-border/50 pt-1">
        <button
          type="button"
          title="Selection — move points and pick shapes (Esc)"
          aria-pressed={tool === TOOL.SELECT}
          onClick={() => onToolChange(TOOL.SELECT)}
          className={[
            'flex size-9 shrink-0 items-center justify-center rounded-md transition-colors',
            tool === TOOL.SELECT
              ? 'bg-white/[0.12] text-gg-text shadow-sm'
              : 'text-gg-muted hover:bg-gg-sidebar-hover hover:text-gg-text',
          ].join(' ')}
        >
          <MousePointer2 className="size-4" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          title="Dimension — click a segment for driving length; click a label to edit"
          aria-pressed={tool === TOOL.DIMENSION}
          onClick={() => onToolChange(TOOL.DIMENSION)}
          className={[
            'flex size-9 shrink-0 items-center justify-center rounded-md transition-colors',
            tool === TOOL.DIMENSION
              ? 'bg-white/[0.12] text-gg-text shadow-sm'
              : 'text-gg-muted hover:bg-gg-sidebar-hover hover:text-gg-text',
          ].join(' ')}
        >
          <Ruler className="size-4" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          title="Undo (Ctrl+Z)"
          disabled={!canUndo}
          onClick={onUndo}
          className="flex size-9 items-center justify-center rounded-md text-gg-muted transition-colors enabled:hover:bg-gg-sidebar-hover enabled:hover:text-gg-text disabled:opacity-35"
        >
          <Undo2 className="size-4" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
          disabled={!canRedo}
          onClick={onRedo}
          className="flex size-9 items-center justify-center rounded-md text-gg-muted transition-colors enabled:hover:bg-gg-sidebar-hover enabled:hover:text-gg-text disabled:opacity-35"
        >
          <Redo2 className="size-4" strokeWidth={1.75} />
        </button>
        {onSaveSketch ? (
          <button
            type="button"
            title="Save sketch to the Sketches tab"
            disabled={!canSaveSketch}
            onClick={onSaveSketch}
            className="flex size-9 shrink-0 items-center justify-center rounded-md text-gg-muted transition-colors enabled:hover:bg-gg-sidebar-hover enabled:hover:text-gg-text disabled:opacity-35"
          >
            <FolderPlus className="size-4" strokeWidth={1.75} />
          </button>
        ) : null}
        <button
          type="button"
          title="Clear canvas"
          onClick={onClear}
          className="flex size-9 items-center justify-center rounded-md text-gg-muted transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300"
        >
          <Trash2 className="size-4" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  )
}
