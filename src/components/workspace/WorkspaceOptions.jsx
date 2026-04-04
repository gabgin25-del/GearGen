import { CollapsibleSection } from '../ui/CollapsibleSection.jsx'

export function WorkspaceOptions({
  embedded = false,
  collapsePersistPrefix = 'geargen-settings',
  snapToGrid,
  onSnapToGridChange,
  gridStep,
  onGridStepChange,
  strictPointsOnly,
  onStrictPointsOnlyChange,
  snapFreehand,
  onSnapFreehandChange,
  fixedSegmentLengthInput,
  onFixedSegmentLengthInputChange,
  fixedCircleRadiusInput,
  onFixedCircleRadiusInputChange,
  fillNewShapes,
  onFillNewShapesChange,
  autoFillClosedSplineLoops,
  onAutoFillClosedSplineLoopsChange,
  shapeFillHex,
  onShapeFillHexChange,
  zoom,
  onZoomChange,
  gridMode,
  onGridModeChange,
  showAxes,
  onShowAxesChange,
  axisOrigin,
  onAxisOriginChange,
  polarAngleStepDeg,
  onPolarAngleStepDegChange,
  originPickNextClick,
  onOriginPickNextClick,
}) {
  const zoomPct = Math.round(zoom * 100)

  return (
    <div
      className={
        embedded
          ? 'flex min-w-0 flex-col gap-1 px-0 py-0'
          : 'flex min-w-0 flex-col gap-1 rounded-lg border border-gg-border bg-gg-sidebar/25 px-2 py-2'
      }
    >
      <CollapsibleSection
        title="View & grid"
        defaultOpen
        persistKey={`${collapsePersistPrefix}-view-grid`}
        bodyClassName="border-b border-gg-border/50 pb-2 pt-1"
      >
        <div className="flex flex-col gap-2">
          <label className="flex max-w-xs flex-col gap-1 text-[11px] text-gg-muted">
            <span className="flex justify-between text-[12px] text-gg-text">
              <span>Zoom</span>
              <span className="tabular-nums text-gg-muted">{zoomPct}%</span>
            </span>
            <input
              type="range"
              min={15}
              max={250}
              value={zoomPct}
              onChange={(e) => onZoomChange(Number(e.target.value) / 100)}
              className="w-full accent-gg-accent"
            />
            <span className="text-[10px] leading-tight text-gg-muted">
              Scroll wheel on the canvas zooms toward the cursor.
            </span>
          </label>
          <label className="flex max-w-xs flex-col gap-0.5 text-[11px] text-gg-muted">
            Grid type
            <select
              value={gridMode}
              onChange={(e) => onGridModeChange(e.target.value)}
              className="rounded border border-gg-border bg-gg-workspace px-2 py-1.5 text-[12px] text-gg-text"
            >
              <option value="cartesian">Cartesian (square)</option>
              <option value="polar">Polar (circles &amp; spokes)</option>
            </select>
          </label>
          <p className="text-[10px] leading-snug text-gg-muted">
            Axis tick numbers use decimals on Cartesian grids and π-style
            radians on polar grids.
          </p>
          {gridMode === 'polar' && (
            <label className="flex w-fit flex-col gap-0.5 text-[11px] text-gg-muted">
              Spoke angle (°)
              <input
                type="number"
                min={5}
                max={90}
                step={1}
                value={polarAngleStepDeg}
                onChange={(e) =>
                  onPolarAngleStepDegChange(Number(e.target.value))
                }
                className="w-20 rounded border border-gg-border bg-gg-workspace px-2 py-1 text-[12px] text-gg-text tabular-nums"
              />
            </label>
          )}
          <label className="flex cursor-pointer items-center gap-2 text-[12px] text-gg-text">
            <input
              type="checkbox"
              className="size-3.5 rounded border-gg-border bg-gg-workspace accent-gg-accent"
              checked={showAxes}
              onChange={(e) => onShowAxesChange(e.target.checked)}
            />
            Show x / y axes through origin
          </label>
          <div className="flex flex-wrap gap-2">
            <label className="flex flex-col gap-0.5 text-[11px] text-gg-muted">
              Origin X
              <input
                type="number"
                step="any"
                value={axisOrigin.x}
                onChange={(e) =>
                  onAxisOriginChange({
                    ...axisOrigin,
                    x: Number(e.target.value),
                  })
                }
                className="w-[5.5rem] rounded border border-gg-border bg-gg-workspace px-2 py-1 text-[12px] text-gg-text tabular-nums"
              />
            </label>
            <label className="flex flex-col gap-0.5 text-[11px] text-gg-muted">
              Origin Y
              <input
                type="number"
                step="any"
                value={axisOrigin.y}
                onChange={(e) =>
                  onAxisOriginChange({
                    ...axisOrigin,
                    y: Number(e.target.value),
                  })
                }
                className="w-[5.5rem] rounded border border-gg-border bg-gg-workspace px-2 py-1 text-[12px] text-gg-text tabular-nums"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() => onOriginPickNextClick(true)}
            className={[
              'w-fit rounded-md border px-2.5 py-1.5 text-[12px] transition-colors',
              originPickNextClick
                ? 'border-gg-accent bg-gg-accent-soft text-gg-text'
                : 'border-gg-border text-gg-muted hover:border-gg-accent/50 hover:text-gg-text',
            ].join(' ')}
          >
            {originPickNextClick
              ? 'Click canvas to set origin…'
              : 'Set origin from canvas click'}
          </button>
          <div className="flex flex-wrap items-center gap-3 border-t border-gg-border/40 pt-2">
            <label className="flex cursor-pointer items-center gap-2 text-[12px] text-gg-text">
              <input
                type="checkbox"
                className="size-3.5 rounded border-gg-border bg-gg-workspace accent-gg-accent"
                checked={snapToGrid}
                onChange={(e) => onSnapToGridChange(e.target.checked)}
              />
              Snap to grid
            </label>
            <label className="flex items-center gap-1.5 text-[12px] text-gg-muted">
              <span>Step</span>
              <input
                type="number"
                min={4}
                max={200}
                step={1}
                value={gridStep}
                onChange={(e) => onGridStepChange(Number(e.target.value))}
                className="w-16 rounded border border-gg-border bg-gg-workspace px-2 py-1 text-[12px] text-gg-text tabular-nums"
              />
              <span>px</span>
            </label>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Geometry"
        defaultOpen
        persistKey={`${collapsePersistPrefix}-geometry`}
        bodyClassName="border-b border-gg-border/50 pb-2 pt-1"
      >
        <div className="flex flex-col gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-[12px] text-gg-text">
            <input
              type="checkbox"
              className="size-3.5 rounded border-gg-border bg-gg-workspace accent-gg-accent"
              checked={strictPointsOnly}
              onChange={(e) => onStrictPointsOnlyChange(e.target.checked)}
            />
            Points-only (no new points off empty space)
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-[12px] text-gg-text">
            <input
              type="checkbox"
              className="size-3.5 rounded border-gg-border bg-gg-workspace accent-gg-accent"
              checked={snapFreehand}
              onChange={(e) => onSnapFreehandChange(e.target.checked)}
            />
            Snap freehand to grid
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-[12px] text-gg-text">
            <input
              type="checkbox"
              className="size-3.5 rounded border-gg-border bg-gg-workspace accent-gg-accent"
              checked={fillNewShapes}
              onChange={(e) => onFillNewShapesChange(e.target.checked)}
            />
            Fill closed shapes
          </label>
          {onAutoFillClosedSplineLoopsChange != null ? (
            <label className="flex cursor-pointer items-center gap-2 text-[12px] text-gg-text">
              <input
                type="checkbox"
                className="size-3.5 rounded border-gg-border bg-gg-workspace accent-gg-accent"
                checked={!!autoFillClosedSplineLoops}
                onChange={(e) =>
                  onAutoFillClosedSplineLoopsChange(e.target.checked)
                }
              />
              Auto-fill spline loops (snap close or Esc near start)
            </label>
          ) : null}
          <label className="flex items-center gap-2 text-[12px] text-gg-muted">
            <span>Fill color</span>
            <input
              type="color"
              value={shapeFillHex}
              onChange={(e) => onShapeFillHexChange(e.target.value)}
              className="size-8 cursor-pointer rounded border border-gg-border bg-transparent p-0"
              title="Fill tint for new closed shapes"
            />
          </label>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Fixed distances (world px)"
        defaultOpen={false}
        persistKey={`${collapsePersistPrefix}-fixed`}
        bodyClassName="pt-1"
      >
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-0.5 text-[11px] text-gg-muted">
            Segment length
            <input
              type="text"
              inputMode="decimal"
              placeholder="Free"
              value={fixedSegmentLengthInput}
              onChange={(e) => onFixedSegmentLengthInputChange(e.target.value)}
              className="w-[7.5rem] rounded border border-gg-border bg-gg-workspace px-2 py-1 text-[12px] text-gg-text placeholder:text-gg-muted/60"
            />
          </label>
          <label className="flex flex-col gap-0.5 text-[11px] text-gg-muted">
            Circle radius
            <input
              type="text"
              inputMode="decimal"
              placeholder="Free"
              value={fixedCircleRadiusInput}
              onChange={(e) => onFixedCircleRadiusInputChange(e.target.value)}
              className="w-[7.5rem] rounded border border-gg-border bg-gg-workspace px-2 py-1 text-[12px] text-gg-text placeholder:text-gg-muted/60"
            />
          </label>
        </div>
      </CollapsibleSection>
    </div>
  )
}
