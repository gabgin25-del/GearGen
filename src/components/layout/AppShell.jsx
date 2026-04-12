import {
  ChevronDown,
  ChevronUp,
  CircleHelp,
  Moon,
  MousePointer2,
  Ruler,
  Sun,
} from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTheme } from '../../context/ThemeContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { useSketches } from '../../context/SketchesContext.jsx'
import { DEFAULT_GRID_STEP } from '../../lib/gridSnap.js'
import { DesmosPanel } from '../workspace/DesmosPanel.jsx'
import { DrawingToolsPanel } from '../workspace/DrawingToolsPanel.jsx'
import { GearMakingPanel } from '../workspace/GearMakingPanel.jsx'
import { RegisteredShapesPanel } from '../workspace/RegisteredShapesPanel.jsx'
import { SketchesPanel } from '../workspace/SketchesPanel.jsx'
import { WorkspaceCanvas } from '../workspace/WorkspaceCanvas.jsx'
import { WorkspaceSettingsMenu } from '../workspace/WorkspaceSettingsMenu.jsx'
import { WorkspaceToolbar } from '../workspace/WorkspaceToolbar.jsx'
import { makeGearGenPayload } from '../../lib/sketchPayload.js'
import { TOOL, useWorkspaceScene } from '../../hooks/useWorkspaceScene.js'
import { Sidebar } from './Sidebar.jsx'
import { NAV_IDS } from './sidebarNav.js'

const TOOL_LABEL = {
  [TOOL.SELECT]: 'Selection',
  [TOOL.DIMENSION]: 'Dimension',
  [TOOL.FREEHAND]: 'Freehand',
  [TOOL.POINT]: 'Point',
  [TOOL.SEGMENT]: 'Segment',
  [TOOL.CENTER_LINE]: 'Center line',
  [TOOL.CIRCLE]: 'Circle',
  [TOOL.ARC]: 'Arc',
  [TOOL.ANGLE]: 'Angle',
  [TOOL.POLYGON]: 'Polygon',
  [TOOL.SPLINE]: 'Spline',
  [TOOL.TRIM]: 'Trim',
  [TOOL.SHAPE_RECT]: 'Rectangle',
  [TOOL.SHAPE_TRI]: 'Triangle',
  [TOOL.SHAPE_NGON]: 'Regular n-gon',
}

function clampGridStep(n) {
  if (!Number.isFinite(n)) return DEFAULT_GRID_STEP
  return Math.min(200, Math.max(4, Math.round(n)))
}

function clampPolarDeg(n) {
  if (!Number.isFinite(n)) return 15
  return Math.min(90, Math.max(5, Math.round(n)))
}

export function AppShell() {
  const toast = useToast()
  const { addSketch } = useSketches()
  const scene = useWorkspaceScene({ onSketchMessage: toast.show })
  const { theme, toggleTheme } = useTheme()
  const [topChromeOpen, setTopChromeOpen] = useState(true)
  const [sidebarTab, setSidebarTab] = useState('drawing')
  const zoomPct = Math.round(scene.zoom * 100)
  const toolLabel = TOOL_LABEL[scene.tool] ?? scene.tool

  const handleToolChange = useCallback(
    (id) => {
      if (id === TOOL.SPLINE && scene.tool === TOOL.SPLINE) {
        scene.setSplinePanelOpen((o) => !o)
        return
      }
      if (id !== TOOL.SPLINE) {
        scene.setSplinePanelOpen(true)
      }
      scene.setTool(id)
    },
    [scene],
  )

  const handleSaveSketch = useCallback(() => {
    if (!scene.canSaveSketch) {
      toast.show('Nothing on the canvas to save yet.')
      return
    }
    const geometry = JSON.parse(scene.exportWorkspaceJson())
    addSketch(
      `Sketch ${new Date().toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
      makeGearGenPayload('gearge-v1', geometry, { desmosState: null }),
    )
    toast.show(
      'Sketch saved — open the Saved Sketches tab to load or rename it.',
    )
  }, [scene, addSketch, toast])

  const settingsMenu = (
    <WorkspaceSettingsMenu
      scene={scene}
      clampGridStep={clampGridStep}
      clampPolarDeg={clampPolarDeg}
    />
  )

  return (
    <div className="flex h-full min-h-0 bg-gg-workspace">
      <Sidebar
        activeTab={sidebarTab}
        onTabChange={setSidebarTab}
        drawingPanel={
          <DrawingToolsPanel
            ribbonSectionsOpen={scene.ribbonSectionsOpen}
            onRibbonSectionToggle={scene.toggleRibbonSection}
            registeredShapesSlot={
              <RegisteredShapesPanel workspaceData={scene.workspaceData} />
            }
          />
        }
        savedSketchesPanel={
          <SketchesPanel
            sketchIsExportable={scene.sketchIsExportable}
            exportWorkspaceJson={scene.exportWorkspaceJson}
            loadWorkspaceSnapshot={scene.loadWorkspaceSnapshot}
            onMessage={toast.show}
          />
        }
        desmosPanel={<DesmosPanel workspaceData={scene.workspaceData} />}
        gearMakingPanel={<GearMakingPanel />}
      />
      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col p-4">
        {topChromeOpen ? (
          <>
            <header className="mb-1 flex shrink-0 items-start justify-between gap-2">
              <div className="min-w-0">
                <h1 className="text-[15px] font-medium tracking-tight text-gg-text">
                  Canvas
                </h1>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <a
                  href="#help"
                  className="flex size-9 shrink-0 items-center justify-center rounded-md border border-gg-border text-gg-muted transition-colors hover:border-gg-accent/50 hover:text-gg-text"
                  title="Help: splines and tools"
                  aria-label="Open help page (splines)"
                >
                  <CircleHelp className="size-4" strokeWidth={2} aria-hidden />
                </a>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="flex size-9 shrink-0 items-center justify-center rounded-md border border-gg-border text-gg-muted transition-colors hover:border-gg-accent/50 hover:text-gg-text"
                  aria-label={
                    theme === 'dark'
                      ? 'Switch to light mode'
                      : 'Switch to dark mode'
                  }
                >
                  {theme === 'dark' ? (
                    <Sun className="size-4" strokeWidth={2} aria-hidden />
                  ) : (
                    <Moon className="size-4" strokeWidth={2} aria-hidden />
                  )}
                </button>
                {settingsMenu}
                <button
                  type="button"
                  onClick={() => setTopChromeOpen(false)}
                  className="flex shrink-0 items-center gap-1 rounded-md border border-gg-border px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-gg-muted transition-colors hover:border-gg-accent/50 hover:text-gg-text"
                  aria-expanded
                  aria-label="Minimize tools and options panel"
                >
                  <ChevronUp className="size-4" strokeWidth={2} aria-hidden />
                  <span className="hidden sm:inline">Minimize</span>
                </button>
              </div>
            </header>
            <WorkspaceToolbar
              tool={scene.tool}
              onToolChange={handleToolChange}
              onClear={scene.clear}
              canUndo={scene.canUndo}
              canRedo={scene.canRedo}
              onUndo={scene.undo}
              onRedo={scene.redo}
              canSaveSketch={scene.canSaveSketch}
              onSaveSketch={handleSaveSketch}
              showDrawingRibbon={sidebarTab === NAV_IDS.drawing}
              ribbonSectionsOpen={scene.ribbonSectionsOpen}
              onRibbonSectionToggle={scene.toggleRibbonSection}
              presetNgonSides={scene.presetNgonSides}
              onPresetNgonSidesChange={scene.setPresetNgonSides}
              sketchSelection={scene.sketchSelection}
              applySketchRelation={scene.applySketchRelation}
              arcMode={scene.arcMode}
              onArcModeChange={scene.setArcMode}
              splineType={scene.splineType}
              onSplineTypeChange={scene.setSplineType}
              splineTension={scene.splineTension}
              onSplineTensionChange={scene.setSplineTension}
              splineClosed={scene.splineClosed}
              onSplineClosedChange={scene.setSplineClosed}
              splineSegmentsPerSpan={scene.splineSegmentsPerSpan}
              onSplineSegmentsPerSpanChange={scene.setSplineSegmentsPerSpan}
              splinePanelOpen={scene.splinePanelOpen}
              cutMode={scene.cutMode}
              onCutModeChange={scene.setCutMode}
            />
          </>
        ) : (
          <div className="mb-2 flex min-h-0 shrink-0 flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-gg-border bg-gg-sidebar/25 px-3 py-2">
            <span className="text-[13px] font-medium tracking-tight text-gg-text">
              Canvas
            </span>
            <span className="text-[12px] text-gg-muted">
              Tool{' '}
              <span className="font-medium text-gg-text">{toolLabel}</span>
            </span>
            <div
              className="flex shrink-0 items-center gap-0.5 rounded-md border border-gg-border/80 bg-gg-workspace/30 p-0.5"
              role="group"
              aria-label="Quick tools"
            >
              <button
                type="button"
                title="Selection"
                aria-pressed={scene.tool === TOOL.SELECT}
                onClick={() => handleToolChange(TOOL.SELECT)}
                className={[
                  'flex size-9 shrink-0 items-center justify-center rounded-md transition-colors',
                  scene.tool === TOOL.SELECT
                    ? 'bg-white/[0.12] text-gg-text shadow-sm'
                    : 'text-gg-muted hover:bg-gg-sidebar-hover hover:text-gg-text',
                ].join(' ')}
              >
                <MousePointer2 className="size-4" strokeWidth={1.75} aria-hidden />
              </button>
              <button
                type="button"
                title="Dimension (driving length)"
                aria-pressed={scene.tool === TOOL.DIMENSION}
                onClick={() => handleToolChange(TOOL.DIMENSION)}
                className={[
                  'flex size-9 shrink-0 items-center justify-center rounded-md transition-colors',
                  scene.tool === TOOL.DIMENSION
                    ? 'bg-white/[0.12] text-gg-text shadow-sm'
                    : 'text-gg-muted hover:bg-gg-sidebar-hover hover:text-gg-text',
                ].join(' ')}
              >
                <Ruler className="size-4" strokeWidth={1.75} aria-hidden />
              </button>
            </div>
            <label className="flex min-w-[8rem] max-w-[12rem] flex-1 items-center gap-2 text-[11px] text-gg-muted">
              <span className="shrink-0 tabular-nums">{zoomPct}%</span>
              <input
                type="range"
                min={15}
                max={250}
                value={zoomPct}
                onChange={(e) =>
                  scene.setZoom(Number(e.target.value) / 100)
                }
                className="min-w-0 flex-1 accent-gg-accent"
                aria-label="Zoom"
              />
            </label>
            <button
              type="button"
              onClick={toggleTheme}
              className="flex size-9 shrink-0 items-center justify-center rounded-md border border-gg-border text-gg-muted transition-colors hover:border-gg-accent/50 hover:text-gg-text"
              aria-label={
                theme === 'dark'
                  ? 'Switch to light mode'
                  : 'Switch to dark mode'
              }
            >
              {theme === 'dark' ? (
                <Sun className="size-4" strokeWidth={2} aria-hidden />
              ) : (
                <Moon className="size-4" strokeWidth={2} aria-hidden />
              )}
            </button>
            {settingsMenu}
            <button
              type="button"
              onClick={() => setTopChromeOpen(true)}
              className="flex items-center gap-1 rounded-md border border-gg-border px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wide text-gg-muted transition-colors hover:border-gg-accent/50 hover:text-gg-text"
              aria-expanded={false}
              aria-label="Show tools and options panel"
            >
              <ChevronDown className="size-4" strokeWidth={2} aria-hidden />
              Tools
            </button>
          </div>
        )}
        {scene.workspaceData?.solverDiagnostics?.engine === 'planegcs' &&
        scene.workspaceData.solverDiagnostics.overConstrained ? (
          <div
            className={
              theme === 'light'
                ? 'mb-2 shrink-0 rounded-md border border-red-600/45 bg-red-600/10 px-3 py-2 text-[12px] text-red-900'
                : 'mb-2 shrink-0 rounded-md border border-red-500/55 bg-red-500/12 px-3 py-2 text-[12px] text-red-200'
            }
            role="status"
          >
            Sketch is over-constrained (PlaneGCS). Remove or relax redundant
            constraints, or adjust driving dimensions so the system can
            resolve.
          </div>
        ) : null}
        <WorkspaceCanvas
          tool={scene.tool}
          pan={scene.pan}
          setPan={scene.setPan}
          zoom={scene.zoom}
          setZoom={scene.setZoom}
          viewDrawOptions={scene.viewDrawOptions}
          labelDrawOptions={scene.labelDrawOptions}
          selectedShape={scene.selectedShape}
          setSelectedShape={scene.setSelectedShape}
          originPickNextClick={scene.originPickNextClick}
          confirmOriginAtWorld={scene.confirmOriginAtWorld}
          cancelOriginPick={scene.cancelOriginPick}
          strokes={scene.strokes}
          points={scene.points}
          segments={scene.segments}
          circles={scene.circles}
          polygons={scene.polygons}
          arcs={scene.arcs}
          angles={scene.angles}
          splines={scene.splines}
          constraints={scene.constraints}
          dimensions={scene.dimensions}
          arcMode={scene.arcMode}
          splineType={scene.splineType}
          splineTension={scene.splineTension}
          splineClosed={scene.splineClosed}
          splineSegmentsPerSpan={scene.splineSegmentsPerSpan}
          shapeStyle={scene.shapeStyle}
          commit={scene.commit}
          checkpoint={scene.checkpoint}
          apply={scene.apply}
          geomDraft={scene.geomDraft}
          setGeomDraft={scene.setGeomDraft}
          preview={scene.preview}
          setPreview={scene.setPreview}
          nextId={scene.nextId}
          liveStroke={scene.liveStroke}
          setLiveStroke={scene.setLiveStroke}
          selectedPointId={scene.selectedPointId}
          setSelectedPointId={scene.setSelectedPointId}
          placementOptions={scene.placementOptions}
          autoFillClosedSplineLoops={scene.autoFillClosedSplineLoops}
          showDimensions={scene.showDimensions}
          showRelations={scene.showRelations}
          presetNgonSides={scene.presetNgonSides}
          sketchSelection={scene.sketchSelection}
          toggleSketchSelectionItem={scene.toggleSketchSelectionItem}
          clearSketchSelection={scene.clearSketchSelection}
          replaceSketchSelection={scene.replaceSketchSelection}
          unionSketchSelection={scene.unionSketchSelection}
          setTool={scene.setTool}
          setDrivingDimensionValue={scene.setDrivingDimensionValue}
          cutMode={scene.cutMode}
          deleteSelectedSketch={scene.deleteSelectedSketch}
          allowRegionFill={scene.allowRegionFill}
          sketchLockState={scene.sketchLockState}
          theme={theme}
        />
      </main>
    </div>
  )
}
