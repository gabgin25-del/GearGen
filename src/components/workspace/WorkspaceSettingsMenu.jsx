import { Settings, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { CollapsibleSection } from '../ui/CollapsibleSection.jsx'
import { ErrorBoundary } from '../ui/ErrorBoundary.jsx'
import { inferDistanceKind } from '../../lib/dimensionGeometry.js'
import {
  formatLengthMmForDisplay,
  UNIT_PRESET_OPTIONS,
  worldMmToDisplay,
} from '../../lib/sketchUnits.js'
import { SPLINE_TYPE_OPTIONS } from '../../hooks/useWorkspaceScene.js'
import { WorkspaceOptions } from './WorkspaceOptions.jsx'

export function WorkspaceSettingsMenu({
  scene,
  clampGridStep,
  clampPolarDeg,
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      const el = rootRef.current
      if (el && !el.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  if (!scene || typeof scene !== 'object') {
    return null
  }

  const {
    snapToGrid,
    setSnapToGrid,
    gridStep,
    setGridStep,
    strictPointsOnly,
    setStrictPointsOnly,
    snapFreehand,
    setSnapFreehand,
    fixedSegmentLengthInput,
    setFixedSegmentLengthInput,
    fixedCircleRadiusInput,
    setFixedCircleRadiusInput,
    fillNewShapes,
    setFillNewShapes,
    autoFillClosedSplineLoops,
    setAutoFillClosedSplineLoops,
    shapeFillHex,
    setShapeFillHex,
    zoom,
    setZoom,
    gridMode,
    setGridMode,
    showAxes,
    setShowAxes,
    axisOrigin,
    setAxisOrigin,
    polarAngleStepDeg,
    setPolarAngleStepDeg,
    originPickNextClick,
    setOriginPickNextClick,
    worldUnitLabel,
    documentUnits,
    setDocumentUnits,
    circleTangentMode,
    setCircleTangentMode,
    showAxisTickValues,
    setShowAxisTickValues,
    showAxisNameLabels,
    setShowAxisNameLabels,
    showAngleDegrees,
    setShowAngleDegrees,
    showDimensions,
    setShowDimensions,
    showRelations,
    setShowRelations,
    selectedShape,
    setSelectedShape,
    workspaceData,
    commit,
    shapeStyle,
    dimensions = [],
    setDrivingDimensionValue,
  } = scene

  const patchShape = (kind, id, patch) => {
    commit((d) => {
      if (kind === 'polygon') {
        return {
          ...d,
          polygons: d.polygons.map((p) =>
            p.id === id ? { ...p, ...patch } : p,
          ),
        }
      }
      if (kind === 'circle') {
        const target = d.circles.find((c) => c.id === id)
        const moveCenter =
          target?.centerId &&
          (patch.cx !== undefined || patch.cy !== undefined)
        return {
          ...d,
          points: moveCenter
            ? d.points.map((pt) =>
                pt.id === target.centerId
                  ? {
                      ...pt,
                      x: patch.cx ?? pt.x,
                      y: patch.cy ?? pt.y,
                    }
                  : pt,
              )
            : d.points,
          circles: d.circles.map((c) =>
            c.id === id ? { ...c, ...patch } : c,
          ),
        }
      }
      if (kind === 'arc') {
        return {
          ...d,
          arcs: (d.arcs ?? []).map((a) =>
            a.id === id ? { ...a, ...patch } : a,
          ),
        }
      }
      if (kind === 'angle') {
        return {
          ...d,
          angles: (d.angles ?? []).map((a) =>
            a.id === id ? { ...a, ...patch } : a,
          ),
        }
      }
      if (kind === 'spline') {
        return {
          ...d,
          splines: (d.splines ?? []).map((s) =>
            s.id === id ? { ...s, ...patch } : s,
          ),
        }
      }
      return d
    })
  }

  const selectedPoly =
    selectedShape?.kind === 'polygon'
      ? (workspaceData.polygons ?? []).find((p) => p.id === selectedShape.id)
      : null
  const selectedCircle =
    selectedShape?.kind === 'circle'
      ? (workspaceData.circles ?? []).find((c) => c.id === selectedShape.id)
      : null
  const selectedArc =
    selectedShape?.kind === 'arc'
      ? (workspaceData.arcs ?? []).find((a) => a.id === selectedShape.id)
      : null
  const selectedAngle =
    selectedShape?.kind === 'angle'
      ? (workspaceData.angles ?? []).find((a) => a.id === selectedShape.id)
      : null
  const selectedSpline =
    selectedShape?.kind === 'spline'
      ? (workspaceData.splines ?? []).find((s) => s.id === selectedShape.id)
      : null

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          'flex size-9 items-center justify-center rounded-md border transition-colors',
          open
            ? 'border-gg-accent bg-gg-accent-soft text-gg-text'
            : 'border-gg-border text-gg-muted hover:border-gg-accent/50 hover:text-gg-text',
        ].join(' ')}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Canvas settings"
      >
        <Settings className="size-4" strokeWidth={1.75} />
      </button>
      {open ? (
        <div
          className="absolute right-0 z-50 mt-1 max-h-[min(85vh,640px)] w-[min(100vw-2rem,22rem)] overflow-y-auto rounded-lg border border-gg-border bg-gg-sidebar py-2 shadow-xl"
          role="dialog"
          aria-label="Canvas settings"
        >
          <ErrorBoundary>
          <div className="flex items-center justify-between border-b border-gg-border px-3 pb-2">
            <span className="text-[12px] font-medium text-gg-text">
              Canvas settings
            </span>
            <button
              type="button"
              className="rounded p-1 text-gg-muted hover:bg-white/[0.06] hover:text-gg-text"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              <X className="size-4" strokeWidth={2} />
            </button>
          </div>
          <div className="px-2 pt-2">
            <WorkspaceOptions
              embedded
              snapToGrid={snapToGrid}
              onSnapToGridChange={setSnapToGrid}
              gridStep={gridStep}
              onGridStepChange={(n) => setGridStep(clampGridStep(n))}
              strictPointsOnly={strictPointsOnly}
              onStrictPointsOnlyChange={setStrictPointsOnly}
              snapFreehand={snapFreehand}
              onSnapFreehandChange={setSnapFreehand}
              fixedSegmentLengthInput={fixedSegmentLengthInput}
              onFixedSegmentLengthInputChange={setFixedSegmentLengthInput}
              fixedCircleRadiusInput={fixedCircleRadiusInput}
              onFixedCircleRadiusInputChange={setFixedCircleRadiusInput}
              fillNewShapes={fillNewShapes}
              onFillNewShapesChange={setFillNewShapes}
              autoFillClosedSplineLoops={autoFillClosedSplineLoops}
              onAutoFillClosedSplineLoopsChange={setAutoFillClosedSplineLoops}
              shapeFillHex={shapeFillHex}
              onShapeFillHexChange={setShapeFillHex}
              zoom={zoom}
              onZoomChange={setZoom}
              gridMode={gridMode}
              onGridModeChange={setGridMode}
              showAxes={showAxes}
              onShowAxesChange={setShowAxes}
              axisOrigin={axisOrigin}
              onAxisOriginChange={setAxisOrigin}
              polarAngleStepDeg={polarAngleStepDeg}
              onPolarAngleStepDegChange={(v) =>
                setPolarAngleStepDeg(clampPolarDeg(v))
              }
              originPickNextClick={originPickNextClick}
              onOriginPickNextClick={setOriginPickNextClick}
            />
            <div className="mt-1 border-t border-gg-border/60 px-1 pt-2">
              <CollapsibleSection
                title="Labels"
                defaultOpen
                persistKey="geargen-settings-labels"
                bodyClassName="border-b border-gg-border/50 pb-2 pt-1"
              >
                <div className="flex flex-col gap-2">
                  <label className="flex max-w-full flex-col gap-0.5 text-[11px] text-gg-muted">
                    Document units (stored geometry is always mm)
                    <select
                      value={documentUnits.preset}
                      onChange={(e) => {
                        const id = e.target.value
                        if (!UNIT_PRESET_OPTIONS.some((o) => o.id === id)) return
                        setDocumentUnits((d) => ({ ...d, preset: id }))
                      }}
                      className="rounded border border-gg-border bg-gg-workspace px-2 py-1.5 text-[12px] text-gg-text"
                    >
                      {UNIT_PRESET_OPTIONS.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {documentUnits.preset === 'custom' ? (
                    <>
                      <label className="flex max-w-full flex-col gap-0.5 text-[11px] text-gg-muted">
                        Custom label (axis & dimensions)
                        <input
                          type="text"
                          value={documentUnits.customLabel ?? ''}
                          onChange={(e) =>
                            setDocumentUnits((d) => ({
                              ...d,
                              customLabel: e.target.value.slice(0, 12),
                            }))
                          }
                          className="rounded border border-gg-border bg-gg-workspace px-2 py-1.5 text-[12px] text-gg-text"
                          maxLength={12}
                          placeholder="e.g. uu"
                        />
                      </label>
                      <label className="flex max-w-full flex-col gap-0.5 text-[11px] text-gg-muted">
                        Millimeters per 1 display unit
                        <input
                          type="number"
                          step="any"
                          min={1e-9}
                          value={
                            Number.isFinite(documentUnits.customMmPerUnit)
                              ? String(documentUnits.customMmPerUnit)
                              : '1'
                          }
                          onChange={(e) => {
                            const v = Number.parseFloat(e.target.value)
                            if (!Number.isFinite(v) || v <= 0) return
                            setDocumentUnits((d) => ({
                              ...d,
                              customMmPerUnit: v,
                            }))
                          }}
                          className="rounded border border-gg-border bg-gg-workspace px-2 py-1.5 text-[12px] text-gg-text"
                        />
                      </label>
                      <p className="text-[10px] leading-snug text-gg-muted">
                        Example: if 1 shown unit = 25.4 mm, enter 25.4 (inch-scale
                        drawing without switching preset).
                      </p>
                    </>
                  ) : null}
                  <label className="flex max-w-full flex-col gap-0.5 text-[11px] text-gg-muted">
                    Circle–circle tangent (new constraints)
                    <select
                      value={circleTangentMode}
                      onChange={(e) =>
                        setCircleTangentMode(
                          e.target.value === 'internal'
                            ? 'internal'
                            : 'external',
                        )
                      }
                      className="rounded border border-gg-border bg-gg-workspace px-2 py-1.5 text-[12px] text-gg-text"
                    >
                      <option value="external">
                        External (centers separated by r₁ + r₂)
                      </option>
                      <option value="internal">
                        Internal (|r₁ − r₂| between centers)
                      </option>
                    </select>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-[12px] text-gg-text">
                    <input
                      type="checkbox"
                      className="size-3.5 rounded border-gg-border bg-gg-workspace accent-gg-accent"
                      checked={showAxisTickValues}
                      onChange={(e) => setShowAxisTickValues(e.target.checked)}
                    />
                    Axis tick values (along grid)
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-[12px] text-gg-text">
                    <input
                      type="checkbox"
                      className="size-3.5 rounded border-gg-border bg-gg-workspace accent-gg-accent"
                      checked={showAxisNameLabels}
                      onChange={(e) => setShowAxisNameLabels(e.target.checked)}
                    />
                    Axis titles (x, y with unit)
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-[12px] text-gg-text">
                    <input
                      type="checkbox"
                      className="size-3.5 rounded border-gg-border bg-gg-workspace accent-gg-accent"
                      checked={showAngleDegrees}
                      onChange={(e) => setShowAngleDegrees(e.target.checked)}
                    />
                    Angle arc labels (°)
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-[12px] text-gg-text">
                    <input
                      type="checkbox"
                      className="size-3.5 rounded border-gg-border bg-gg-workspace accent-gg-accent"
                      checked={showDimensions}
                      onChange={(e) => setShowDimensions(e.target.checked)}
                    />
                    ANSI-style driving dimensions on canvas
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-[12px] text-gg-text">
                    <input
                      type="checkbox"
                      className="size-3.5 rounded border-gg-border bg-gg-workspace accent-gg-accent"
                      checked={showRelations}
                      onChange={(e) => setShowRelations(e.target.checked)}
                    />
                    Relation symbols on canvas
                  </label>
                </div>
              </CollapsibleSection>
            </div>
            <div className="mt-1 border-t border-gg-border/60 px-1 pt-2">
              <CollapsibleSection
                title="Driving dimensions"
                defaultOpen
                persistKey="geargen-settings-driving-dim"
                bodyClassName="border-b border-gg-border/50 pb-2 pt-1"
              >
                {dimensions.length === 0 ? (
                  <p className="text-[11px] leading-snug text-gg-muted">
                    Dimension tool: first pick an entity, second pick another
                    (or the same segment for its length), move the mouse for the
                    ghost preview, then click to place. Double-click a dimension
                    in Select mode to edit. Values below drive PlaneGCS.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {dimensions.map((dim) => (
                      <li
                        key={dim.id}
                        className="flex flex-col gap-1 rounded border border-gg-border/50 bg-gg-workspace/40 px-2 py-1.5"
                      >
                        <span className="text-[11px] font-medium text-gg-text">
                          {dim.type === 'distance'
                            ? (() => {
                                const k = inferDistanceKind(dim)
                                const pfx =
                                  k === 'parallelLines'
                                    ? 'Line spacing'
                                    : k === 'pointPoint'
                                      ? 'Point distance'
                                      : k === 'pointLine'
                                        ? 'Point–line'
                                        : 'Length'
                                const v = dim.value
                                const s =
                                  v != null && Number.isFinite(v)
                                    ? formatLengthMmForDisplay(
                                        v,
                                        documentUnits,
                                      )
                                    : '—'
                                return `${pfx} · ${s} ${worldUnitLabel || 'mm'}`
                              })()
                            : dim.type === 'radius'
                              ? `Radius R · ${
                                  dim.value != null &&
                                  Number.isFinite(dim.value)
                                    ? formatLengthMmForDisplay(
                                        dim.value,
                                        documentUnits,
                                      )
                                    : '—'
                                } ${worldUnitLabel || 'mm'}`
                              : dim.type === 'diameter'
                                ? `Diameter Ø · ${
                                    dim.value != null &&
                                    Number.isFinite(dim.value)
                                      ? formatLengthMmForDisplay(
                                          dim.value,
                                          documentUnits,
                                        )
                                      : '—'
                                  } ${worldUnitLabel || 'mm'}`
                                : showAngleDegrees
                                  ? `Angle · ${dim.value != null && Number.isFinite(dim.value) ? ((dim.value * 180) / Math.PI).toFixed(1) : '—'}°`
                                  : `Angle · ${dim.value != null && Number.isFinite(dim.value) ? dim.value.toFixed(3) : '—'} rad`}
                        </span>
                        {(dim.type === 'distance' ||
                          dim.type === 'radius' ||
                          dim.type === 'diameter') && (
                          <label className="flex flex-col gap-0.5 text-[11px] text-gg-muted">
                            Value ({worldUnitLabel || 'mm'} display units)
                            <input
                              type="number"
                              step="any"
                              min={0.0001}
                              className="rounded border border-gg-border bg-gg-workspace px-2 py-1 text-[12px] text-gg-text"
                              value={
                                dim.value != null && Number.isFinite(dim.value)
                                  ? String(
                                      worldMmToDisplay(
                                        dim.value,
                                        documentUnits,
                                      ),
                                    )
                                  : ''
                              }
                              onChange={(e) =>
                                setDrivingDimensionValue?.(dim.id, e.target.value)
                              }
                            />
                          </label>
                        )}
                        {dim.type === 'angle' && (
                          <label className="flex flex-col gap-0.5 text-[11px] text-gg-muted">
                            {showAngleDegrees ? 'Angle (°)' : 'Angle (rad)'}
                            <input
                              type="number"
                              step="any"
                              className="rounded border border-gg-border bg-gg-workspace px-2 py-1 text-[12px] text-gg-text"
                              value={
                                dim.value != null && Number.isFinite(dim.value)
                                  ? showAngleDegrees
                                    ? String((dim.value * 180) / Math.PI)
                                    : String(dim.value)
                                  : ''
                              }
                              onChange={(e) => {
                                const x = Number.parseFloat(e.target.value)
                                if (!Number.isFinite(x)) return
                                const rad = showAngleDegrees
                                  ? (x * Math.PI) / 180
                                  : x
                                setDrivingDimensionValue?.(dim.id, rad)
                              }}
                            />
                          </label>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CollapsibleSection>
            </div>
            {selectedShape ? (
              <div className="mt-1 border-t border-gg-border/60 px-1 pt-2">
                <CollapsibleSection
                  title="Selected shape"
                  defaultOpen
                  persistKey="geargen-settings-selected"
                  bodyClassName="pt-1"
                >
                  <div className="flex flex-col gap-2 text-[12px] text-gg-text">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-gg-muted">
                        {selectedShape.kind} ·{' '}
                        <span className="font-mono text-[11px] text-gg-text">
                          {selectedShape.id}
                        </span>
                      </span>
                      <button
                        type="button"
                        className="text-[11px] text-gg-accent hover:underline"
                        onClick={() => setSelectedShape(null)}
                      >
                        Clear
                      </button>
                    </div>
                    {selectedPoly && (
                      <>
                        <label className="flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            className="size-3.5 accent-gg-accent"
                            checked={!!selectedPoly.fill}
                            onChange={(e) =>
                              patchShape('polygon', selectedPoly.id, {
                                fill: e.target.checked
                                  ? scene.shapeStyle.shapeFillRgba
                                  : null,
                              })
                            }
                          />
                          Filled region
                        </label>
                        <label className="flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            className="size-3.5 accent-gg-accent"
                            checked={selectedPoly.geoRegistered !== false}
                            onChange={(e) =>
                              patchShape('polygon', selectedPoly.id, {
                                geoRegistered: e.target.checked,
                              })
                            }
                          />
                          Registered geometry
                        </label>
                      </>
                    )}
                    {selectedCircle && (
                      <>
                        <label className="flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            className="size-3.5 accent-gg-accent"
                            checked={!!selectedCircle.fill}
                            onChange={(e) =>
                              patchShape('circle', selectedCircle.id, {
                                fill: e.target.checked
                                  ? scene.shapeStyle.shapeFillRgba
                                  : null,
                              })
                            }
                          />
                          Filled region
                        </label>
                        <label className="flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            className="size-3.5 accent-gg-accent"
                            checked={selectedCircle.geoRegistered !== false}
                            onChange={(e) =>
                              patchShape('circle', selectedCircle.id, {
                                geoRegistered: e.target.checked,
                              })
                            }
                          />
                          Registered geometry
                        </label>
                      </>
                    )}
                    {selectedArc && (
                      <>
                        <label className="flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            className="size-3.5 accent-gg-accent"
                            checked={!!selectedArc.fill}
                            onChange={(e) =>
                              patchShape('arc', selectedArc.id, {
                                fill: e.target.checked
                                  ? scene.shapeStyle.shapeFillRgba
                                  : null,
                              })
                            }
                          />
                          Filled sector
                        </label>
                        <label className="flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            className="size-3.5 accent-gg-accent"
                            checked={selectedArc.geoRegistered !== false}
                            onChange={(e) =>
                              patchShape('arc', selectedArc.id, {
                                geoRegistered: e.target.checked,
                              })
                            }
                          />
                          Registered geometry
                        </label>
                      </>
                    )}
                    {selectedAngle && (
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          className="size-3.5 accent-gg-accent"
                          checked={selectedAngle.geoRegistered !== false}
                          onChange={(e) =>
                            patchShape('angle', selectedAngle.id, {
                              geoRegistered: e.target.checked,
                            })
                          }
                        />
                        Registered geometry
                      </label>
                    )}
                    {selectedSpline && (
                      <>
                        <label className="flex max-w-full flex-col gap-0.5 text-[11px] text-gg-muted">
                          Curve type
                          <select
                            value={
                              SPLINE_TYPE_OPTIONS.some(
                                (o) =>
                                  o.id ===
                                  (selectedSpline.splineType ?? 'catmullRom'),
                              )
                                ? (selectedSpline.splineType ?? 'catmullRom')
                                : 'catmullRom'
                            }
                            onChange={(e) =>
                              patchShape('spline', selectedSpline.id, {
                                splineType: e.target.value,
                              })
                            }
                            className="rounded border border-gg-border bg-gg-workspace px-2 py-1.5 text-[12px] text-gg-text"
                          >
                            {SPLINE_TYPE_OPTIONS.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            className="size-3.5 accent-gg-accent"
                            checked={!!selectedSpline.fill}
                            disabled={!selectedSpline.closed}
                            onChange={(e) =>
                              patchShape('spline', selectedSpline.id, {
                                fill: e.target.checked
                                  ? shapeStyle.shapeFillRgba
                                  : null,
                              })
                            }
                          />
                          Fill closed region
                        </label>
                        <label className="flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            className="size-3.5 accent-gg-accent"
                            checked={selectedSpline.geoRegistered !== false}
                            onChange={(e) =>
                              patchShape('spline', selectedSpline.id, {
                                geoRegistered: e.target.checked,
                              })
                            }
                          />
                          Registered geometry
                        </label>
                      </>
                    )}
                    {!selectedPoly &&
                      !selectedCircle &&
                      !selectedArc &&
                      !selectedAngle &&
                      !selectedSpline && (
                        <p className="text-[11px] text-gg-muted">
                          Shape not found (may have been deleted).
                        </p>
                      )}
                  </div>
                </CollapsibleSection>
              </div>
            ) : null}
          </div>
          </ErrorBoundary>
        </div>
      ) : null}
    </div>
  )
}
