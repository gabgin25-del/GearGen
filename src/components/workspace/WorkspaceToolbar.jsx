import {
  FolderPlus,
  MousePointer2,
  Redo2,
  Ruler,
  Trash2,
  Undo2,
} from 'lucide-react'
import { TOOL } from '../../hooks/useWorkspaceScene.js'
import { DrawingRibbon } from './DrawingRibbon.jsx'

/**
 * Main canvas toolbar plus optional drawing ribbon (when sidebar tab is Drawing).
 */
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
  showDrawingRibbon = false,
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
  cutMode,
  onCutModeChange,
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg border border-gg-border bg-gg-sidebar/40 p-1">
      <div className="flex min-w-0 flex-wrap items-center gap-0.5">
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
            title="Save sketch to Saved Sketches"
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
      {showDrawingRibbon ? (
        <DrawingRibbon
          tool={tool}
          onToolChange={onToolChange}
          ribbonSectionsOpen={ribbonSectionsOpen}
          onRibbonSectionToggle={onRibbonSectionToggle}
          presetNgonSides={presetNgonSides}
          onPresetNgonSidesChange={onPresetNgonSidesChange}
          sketchSelection={sketchSelection}
          applySketchRelation={applySketchRelation}
          arcMode={arcMode}
          onArcModeChange={onArcModeChange}
          splineType={splineType}
          onSplineTypeChange={onSplineTypeChange}
          splineTension={splineTension}
          onSplineTensionChange={onSplineTensionChange}
          splineClosed={splineClosed}
          onSplineClosedChange={onSplineClosedChange}
          splineSegmentsPerSpan={splineSegmentsPerSpan}
          onSplineSegmentsPerSpanChange={onSplineSegmentsPerSpanChange}
          splinePanelOpen={splinePanelOpen}
          cutMode={cutMode}
          onCutModeChange={onCutModeChange}
        />
      ) : null}
    </div>
  )
}
