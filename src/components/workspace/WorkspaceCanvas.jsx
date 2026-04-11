import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import {
  angleSweepCCW,
  arcSweepCenterFromCursor,
} from '../../lib/geometryMetrics.js'
import { arcSecantAndBulge, arcTangentLineAndPoint } from '../../lib/arcGeometry.js'
import { recomputeBoundArcs } from '../../lib/arcPointBindings.js'
import { applyConstraintEnforcement } from '../../lib/constraintEnforce.js'
import {
  isPointFixedToWorldOrigin,
  moveCoincidentClusterByDelta,
  pointIdsCoincidentCluster,
} from '../../lib/constraintPointDrag.js'
import { drawWorkspaceScene } from '../../lib/drawWorkspace.js'
import { snapWorldToGrid } from '../../lib/gridSnap.js'
import { snapWorldToSketchGuides } from '../../lib/sketchSnapGuides.js'
import {
  relaxAllConstraints,
  tryCommitConstraint,
} from '../../lib/sketchConstraintQuality.js'
import {
  tryAxisOriginAutoConstraints,
  tryPointOnSegmentConstraint,
} from '../../lib/sketchAutoConstraints.js'
import { cloneWorkspaceData } from '../../lib/workspaceReducer.js'
import {
  findNearestSegmentHit,
  hitArc,
  hitCircle,
  hitPolylineSamples,
  hitPolygonBoundarySegmentId,
  hitPolygonInterior,
  hitSegment,
  pointInPolygon,
} from '../../lib/hitTest.js'
import { circleWithResolvedCenter } from '../../lib/circleResolve.js'
import {
  classifyLinearDimensionProjection,
  distanceDimNeedsOrientationPhase,
  linearDimensionOffsetForProjection,
  linearDistanceValueForProjection,
} from '../../lib/dimensionGeometry.js'
import {
  pickDimensionEntity,
  diameterDimensionDraftFromCircle,
  radiusDimensionDraftFromArc,
  splineCurvatureDimensionDraft,
  resolveDimensionFromTwoPicks,
} from '../../lib/dimensionPick.js'
import {
  hitDrivingDimension,
  hitRadialDimensionShoulder,
} from '../../lib/dimensionHitTest.js'
import {
  DEFAULT_DOCUMENT_UNITS,
  formatLengthMmForDisplay,
  worldMmToDisplay,
} from '../../lib/sketchUnits.js'
import { sampleSplinePolyline } from '../../lib/splineMath.js'
import {
  circleRadiusFromCursor,
  constrainSegmentEnd,
  findNearbyPoint,
  pickWorldAtCursor,
  rawWorldFromCanvas,
  resolvePlacement,
} from '../../lib/placement.js'
import { canvasLocalFromClient } from '../../lib/workspaceCoords.js'
import { collectSketchEntitiesInWorldRect } from '../../lib/marqueeSelection.js'
import { ARC_MODE, TOOL } from '../../hooks/useWorkspaceScene.js'
import { useElementSize } from '../../hooks/useElementSize.js'
import Draggable from 'react-draggable'
import { completeDrivingDimensionPlacement } from '../../lib/dimensionPlacementCommit.js'
import {
  trySubtractCircleFromFill,
  trySubtractRectFromFill,
} from '../../lib/sketchBooleanCut.js'
import { trimSegmentAtClick } from '../../lib/sketchTrim.js'
import { radialLeaderGeometry } from '../../lib/DimensionRenderer.js'
import {
  ObjectPropertiesModal,
  SketchContextMenu,
} from './ObjectPropertiesModal.jsx'

/**
 * @param {object} dim
 * @param {object} data
 * @returns {{ cx: number; cy: number } | null}
 */
function radialDimCenterWorld(dim, data) {
  if (dim.splineCurvature && dim.dimCx != null && dim.dimCy != null) {
    return { cx: dim.dimCx, cy: dim.dimCy }
  }
  const tid = dim.targets?.[0]
  if (!tid) return null
  const pmap = new Map((data.points ?? []).map((p) => [p.id, p]))
  const circles = data.circles ?? []
  const arcs = data.arcs ?? []
  const shape =
    circles.find((c) => c.id === tid) ?? arcs.find((a) => a.id === tid)
  if (!shape) return null
  const rc = circleWithResolvedCenter(shape, pmap)
  if (rc.r < 1e-9) return null
  return { cx: rc.cx, cy: rc.cy }
}

function sanitizeDimEditDraft(raw, dimType) {
  const s = String(raw ?? '')
  if (dimType === 'angle') {
    return s.replace(/[^\d.+\-eE]/g, '')
  }
  return s.replace(/[^\d.]/g, '')
}

/** Top UI chrome (header) clearance for floating dimension popover. */
const CHROME_TOP_PAD_PX = 52

function tryCommitForSketchPlacement(d, co) {
  const r = tryCommitConstraint(d, co)
  if (r.ok) return r
  if (r.reason === 'needSolver') {
    return {
      ok: true,
      data: { ...d, constraints: [...(d.constraints ?? []), co] },
    }
  }
  return { ok: false }
}

/** Lucide `ruler` icon as cursor (dual stroke for contrast on light/dark grids). */
const DIMENSION_CURSOR =
  'url("data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none">' +
      '<path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 7.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 7.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z" stroke="#f8fafc" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="m14.5 12.5 2-2m3-3 2-2M3 11l9-9" stroke="#0f172a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="m14.5 12.5 2-2m3-3 2-2M3 11l9-9" stroke="#38bdf8" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>',
  ) +
  '") 4 22, crosshair'

const SNAP_PX = 10
/** Canvas pixels: below this, marquee counts as a click (clear / no-op), not a box. */
const MARQUEE_MIN_DRAG_PX = 5
/** Slightly larger hit target for closing splines by snapping to the first knot. */
const SNAP_CLOSE_PX = 22
const FREEHAND_MIN_DIST = 1.75
/** World units: if first & last knots are closer than this on Escape, treat as closed. */
const SPLINE_CLOSE_WORLD = 16

/**
 * Grid snap, then sketch axis / origin guides (when enabled).
 * @param {number} lx
 * @param {number} ly
 * @param {{ x: number; y: number }} pan
 * @param {number} zoom
 * @param {object[]} points
 * @param {{ snapToGrid: boolean; gridStep: number; snapToSketchGuides?: boolean; axisOrigin?: { x: number; y: number } }} opt
 */
function worldFromCursorPlacement(lx, ly, pan, zoom, points, opt) {
  const near = findNearbyPoint(points, lx, ly, pan, zoom, SNAP_PX)
  if (near) {
    return { wx: near.x, wy: near.y, guides: {} }
  }
  const w = pickWorldAtCursor(
    lx,
    ly,
    pan,
    zoom,
    points,
    SNAP_PX,
    opt.snapToGrid,
    opt.gridStep,
  )
  if (!opt.snapToSketchGuides) {
    return { wx: w.x, wy: w.y, guides: {} }
  }
  const ax = opt.axisOrigin ?? { x: 0, y: 0 }
  const sg = snapWorldToSketchGuides(w.x, w.y, {
    ox: ax.x,
    oy: ax.y,
    zoom,
    snapPx: SNAP_PX,
  })
  return { wx: sg.x, wy: sg.y, guides: sg.guides }
}

function snapGuidesEqual(a, b) {
  if (!a && !b) return true
  if (!a || !b) return false
  return (
    !!a.origin === !!b.origin &&
    !!a.axisX === !!b.axisX &&
    !!a.axisY === !!b.axisY &&
    !!a.worldOrigin === !!b.worldOrigin
  )
}

/** Apply axis / origin snap to world coords (after grid). */
function withSketchGuidesXY(x, y, opt) {
  if (!opt.snapToSketchGuides) return { x, y }
  const ax = opt.axisOrigin ?? { x: 0, y: 0 }
  const sg = snapWorldToSketchGuides(x, y, {
    ox: ax.x,
    oy: ax.y,
    zoom: opt.zoom,
    snapPx: SNAP_PX,
  })
  return { x: sg.x, y: sg.y }
}

function resolvePlacementWithSketchGuides(
  lx,
  ly,
  pan,
  zoom,
  points,
  opt,
  strictPointsOnly,
) {
  const r = resolvePlacement(
    lx,
    ly,
    pan,
    zoom,
    points,
    SNAP_PX,
    opt.snapToGrid,
    opt.gridStep,
    strictPointsOnly,
  )
  if (!r) return null
  if (!r.isNewPoint) return { ...r, guides: {} }
  if (!opt.snapToSketchGuides) {
    return { ...r, guides: {} }
  }
  const ax = opt.axisOrigin ?? { x: 0, y: 0 }
  const sg = snapWorldToSketchGuides(r.x, r.y, {
    ox: ax.x,
    oy: ax.y,
    zoom,
    snapPx: SNAP_PX,
  })
  return { ...r, x: sg.x, y: sg.y, guides: sg.guides }
}

function applyPlacementAutoConstraints(
  data,
  pointId,
  edgeSegId,
  axisOrigin,
  tryCommit,
  nextCoId,
) {
  const tryC = (d, co) => tryCommit(d, co)
  if (edgeSegId) {
    return tryPointOnSegmentConstraint(
      data,
      pointId,
      edgeSegId,
      tryC,
      nextCoId,
    )
  }
  return tryAxisOriginAutoConstraints(
    data,
    pointId,
    axisOrigin,
    tryC,
    nextCoId,
  )
}

const SPLINE_PREVIEW_HULL_TYPES = new Set([
  'uniformBSpline',
  'naturalCubic',
  'quadraticAnchors',
  'cubicAnchors',
])

function buildSplinePreviewPayload(
  vertexIds,
  points,
  cursorWorld,
  opts,
  newPointFallback = null,
) {
  const map = new Map(points.map((pt) => [pt.id, pt]))
  const verts = []
  for (const id of vertexIds) {
    let q = map.get(id)
    if (!q && newPointFallback && id === newPointFallback.id) {
      q = { x: newPointFallback.x, y: newPointFallback.y }
    }
    if (q) verts.push({ x: q.x, y: q.y })
  }
  const v = cursorWorld ? [...verts, cursorWorld] : verts
  const splineType = opts.splineType
  const showHull = SPLINE_PREVIEW_HULL_TYPES.has(splineType)
  if (v.length < 2) {
    const samples =
      v.length === 1 && cursorWorld ? [v[0], cursorWorld] : v
    return {
      kind: 'spline',
      samples,
      hullVerts: verts.length >= 2 ? verts : null,
      splineType,
      showControlHull: showHull && verts.length >= 2,
    }
  }
  const samples = sampleSplinePolyline(v, splineType, {
    tension: opts.tension,
    closed: false,
    segmentsPerSpan: opts.segmentsPerSpan,
  })
  return {
    kind: 'spline',
    samples,
    hullVerts: verts.length >= 2 ? verts : null,
    hullToCursor: cursorWorld && verts.length ? cursorWorld : null,
    splineType,
    showControlHull: showHull && verts.length >= 2,
  }
}

/**
 * @param {number} wx
 * @param {number} wy
 * @param {{ points: object[]; segments: object[]; circles: object[]; polygons: object[]; arcs?: object[]; angles?: object[]; splines?: object[] }} data
 * @param {number} tolWorld
 */
function pickShapeAtWorld(wx, wy, data, tolWorld) {
  const pointById = new Map(data.points.map((p) => [p.id, p]))
  const arcs = data.arcs ?? []
  for (let i = arcs.length - 1; i >= 0; i--) {
    const a = arcs[i]
    if (hitArc(wx, wy, a, tolWorld)) return { kind: 'arc', id: a.id }
  }
  for (let i = data.segments.length - 1; i >= 0; i--) {
    const s = data.segments[i]
    if (hitSegment(wx, wy, s, pointById, tolWorld))
      return { kind: 'segment', id: s.id }
  }
  const splines = data.splines ?? []
  for (let i = splines.length - 1; i >= 0; i--) {
    const sp = splines[i]
    const verts = sp.vertexIds.map((id) => pointById.get(id)).filter(Boolean)
    if (verts.length < 2) continue
    const samples = sampleSplinePolyline(verts, sp.splineType, {
      tension: sp.tension ?? 0.5,
      closed: !!sp.closed,
      segmentsPerSpan: sp.segmentsPerSpan ?? 14,
    })
    if (
      sp.closed &&
      sp.fill &&
      samples.length >= 3 &&
      pointInPolygon(wx, wy, samples)
    ) {
      return { kind: 'spline', id: sp.id }
    }
    if (hitPolylineSamples(wx, wy, samples, tolWorld)) {
      return { kind: 'spline', id: sp.id }
    }
  }
  for (let i = data.circles.length - 1; i >= 0; i--) {
    const c = data.circles[i]
    if (hitCircle(wx, wy, c, pointById, tolWorld))
      return { kind: 'circle', id: c.id }
  }
  for (let i = data.polygons.length - 1; i >= 0; i--) {
    const poly = data.polygons[i]
    const boundarySeg = hitPolygonBoundarySegmentId(
      wx,
      wy,
      poly,
      data.segments,
      pointById,
      tolWorld,
    )
    if (boundarySeg) return { kind: 'segment', id: boundarySeg }
    if (hitPolygonInterior(wx, wy, poly, pointById))
      return { kind: 'polygon', id: poly.id }
  }
  const angles = data.angles ?? []
  for (let i = angles.length - 1; i >= 0; i--) {
    const ang = angles[i]
    const C = pointById.get(ang.centerId)
    const A = pointById.get(ang.arm1Id)
    const B = pointById.get(ang.arm2Id)
    if (!C || !A || !B) continue
    const aa = Math.atan2(A.y - C.y, A.x - C.x)
    const ab = Math.atan2(B.y - C.y, B.x - C.x)
    const sweep = angleSweepCCW(aa, ab)
    const distA = Math.hypot(A.x - C.x, A.y - C.y)
    const distB = Math.hypot(B.x - C.x, B.y - C.y)
    const markR = Math.min(28, Math.max(10, 0.32 * Math.min(distA, distB)))
    if (
      hitArc(
        wx,
        wy,
        { cx: C.x, cy: C.y, r: markR, a0: aa, sweep },
        tolWorld * 1.35,
      )
    ) {
      return { kind: 'angle', id: ang.id }
    }
  }
  return null
}

/**
 * @param {number} wx
 * @param {number} wy
 * @param {number} lx
 * @param {number} ly
 */
function pickSketchEntity(wx, wy, lx, ly, data, p, zoom, tolWorld) {
  const near = findNearbyPoint(data.points, lx, ly, p, zoom, SNAP_PX)
  if (near) return { kind: 'point', id: near.id }
  const sh = pickShapeAtWorld(wx, wy, data, tolWorld)
  if (sh) return sh
  const pointById = new Map(data.points.map((q) => [q.id, q]))
  const hit = findNearestSegmentHit(
    data.segments,
    pointById,
    wx,
    wy,
    tolWorld,
  )
  if (hit) return { kind: 'segment', id: hit.seg.id }
  return null
}

export function WorkspaceCanvas({
  tool,
  pan,
  setPan,
  zoom,
  setZoom,
  viewDrawOptions,
  labelDrawOptions,
  selectedShape,
  setSelectedShape,
  originPickNextClick,
  confirmOriginAtWorld,
  cancelOriginPick,
  strokes,
  points,
  segments,
  circles,
  polygons,
  arcs,
  angles,
  splines,
  constraints = [],
  dimensions = [],
  arcMode,
  splineType,
  splineTension,
  splineClosed,
  splineSegmentsPerSpan,
  shapeStyle,
  commit,
  checkpoint,
  apply,
  geomDraft,
  setGeomDraft,
  preview,
  setPreview,
  nextId,
  liveStroke,
  setLiveStroke,
  selectedPointId,
  setSelectedPointId,
  placementOptions,
  autoFillClosedSplineLoops = true,
  showDimensions = false,
  showRelations = true,
  sketchSelection = [],
  toggleSketchSelectionItem,
  clearSketchSelection,
  replaceSketchSelection,
  unionSketchSelection,
  presetNgonSides = 6,
  setTool,
  allowRegionFill = true,
  sketchLockState = null,
  theme = 'dark',
  setDrivingDimensionValue,
  cutMode = false,
  deleteSelectedSketch,
}) {
  const cutModeRef = useRef(cutMode)
  useEffect(() => {
    cutModeRef.current = cutMode
  }, [cutMode])

  const [hoverHighlight, setHoverHighlight] = useState(null)
  const hoverHighlightRef = useRef(null)
  const [snapGuideHighlight, setSnapGuideHighlight] = useState(null)
  const [dimEdit, setDimEdit] = useState(null)
  const [sketchContextMenu, setSketchContextMenu] = useState(null)
  const [objectPropsEntity, setObjectPropsEntity] = useState(null)
  const dimEditRef = useRef(null)
  const dimInputRef = useRef(null)
  /** Required for react-draggable on React 19 (findDOMNode was removed). */
  const dimDragNodeRef = useRef(null)
  /** Live radial Ø/R leader drag (visual only until pointer up). */
  const radialLeaderDragRef = useRef(null)
  /** Live radial shoulder length drag (leaderShoulderWorld). */
  const radialShoulderDragRef = useRef(null)
  const paintRef = useRef(() => {})
  const setDrivingDimRef = useRef(setDrivingDimensionValue)
  const sketchSelectionRef = useRef(sketchSelection)
  const sketchLockStateRef = useRef(sketchLockState)
  const labelDrawOptionsRef = useRef(labelDrawOptions)
  const drivingDimEditDraft = useCallback(
    (dim) => {
      const showDeg = labelDrawOptions?.showAngleDegrees !== false
      const editInDegrees = dim.type === 'angle' && showDeg
      const du =
        labelDrawOptions?.documentUnits ?? DEFAULT_DOCUMENT_UNITS
      let draft = ''
      if (dim.value != null && Number.isFinite(dim.value)) {
        if (editInDegrees) {
          draft = String((dim.value * 180) / Math.PI)
        } else if (
          dim.type === 'distance' ||
          dim.type === 'radius' ||
          dim.type === 'diameter'
        ) {
          draft = String(worldMmToDisplay(dim.value, du))
        } else {
          draft = String(dim.value)
        }
      }
      return { draft, editInDegrees }
    },
    [labelDrawOptions],
  )
  /** @type {React.MutableRefObject<null | { phase: string; [k: string]: unknown }>} */
  const dimPlacementRef = useRef(null)
  const { ref: containerRef, size } = useElementSize()

  const clampDimPopoverPosition = useCallback(
    (left, top) => {
      const w = size.width
      const h = size.height
      const pw = 220
      const ph = 120
      const pad = 8
      const topMin = CHROME_TOP_PAD_PX
      return {
        left: Math.min(Math.max(pad, left), Math.max(pad, w - pw - pad)),
        top: Math.min(
          Math.max(topMin + pad, top),
          Math.max(topMin + pad, h - ph - pad),
        ),
      }
    },
    [size.width, size.height],
  )
  const canvasRef = useRef(null)
  const marqueeOverlayRef = useRef(null)
  const panRef = useRef(pan)
  const toolRef = useRef(tool)
  const pointsRef = useRef(points)
  const geomDraftRef = useRef(geomDraft)
  const patchDraft = useCallback(
    (next) => {
      geomDraftRef.current = next
      setGeomDraft(next)
    },
    [setGeomDraft],
  )
  const placementRef = useRef(placementOptions)
  const shapeStyleRef = useRef(shapeStyle)
  const zoomRef = useRef(zoom)
  const originPickRef = useRef(originPickNextClick)
  const arcModeRef = useRef(arcMode)
  const splineTypeRef = useRef(splineType)
  const splineTensionRef = useRef(splineTension)
  const splineClosedRef = useRef(splineClosed)
  const splineSegmentsPerSpanRef = useRef(splineSegmentsPerSpan)
  const autoFillClosedSplineLoopsRef = useRef(autoFillClosedSplineLoops)
  const presetNgonSidesRef = useRef(presetNgonSides)
  const deleteSelectedSketchRef = useRef(deleteSelectedSketch)

  const workspaceRef = useRef({
    points,
    segments,
    circles,
    polygons,
    arcs,
    angles,
    splines,
    constraints,
    dimensions,
  })
  const selectedShapeRef = useRef(selectedShape)
  const setSelectedShapeRef = useRef(setSelectedShape)
  const dragRef = useRef(null)
  const freehandRef = useRef(null)
  const movePointCheckpointRef = useRef(false)
  const didInitialPanCenterRef = useRef(false)

  useLayoutEffect(() => {
    if (
      didInitialPanCenterRef.current ||
      size.width < 16 ||
      size.height < 16
    ) {
      return
    }
    didInitialPanCenterRef.current = true
    setPan({ x: size.width / 2, y: size.height / 2 })
  }, [size.width, size.height, setPan])

  useEffect(() => {
    panRef.current = pan
  }, [pan])

  useLayoutEffect(() => {
    pointsRef.current = points
  }, [points])

  useLayoutEffect(() => {
    geomDraftRef.current = geomDraft
  }, [geomDraft])

  useEffect(() => {
    placementRef.current = placementOptions
  }, [placementOptions])

  useEffect(() => {
    shapeStyleRef.current = shapeStyle
  }, [shapeStyle])

  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])

  useEffect(() => {
    originPickRef.current = originPickNextClick
  }, [originPickNextClick])

  useEffect(() => {
    arcModeRef.current = arcMode
  }, [arcMode])

  useEffect(() => {
    splineTypeRef.current = splineType
    splineTensionRef.current = splineTension
    splineClosedRef.current = splineClosed
    splineSegmentsPerSpanRef.current = splineSegmentsPerSpan
  }, [splineType, splineTension, splineClosed, splineSegmentsPerSpan])

  useEffect(() => {
    autoFillClosedSplineLoopsRef.current = autoFillClosedSplineLoops
  }, [autoFillClosedSplineLoops])

  useEffect(() => {
    presetNgonSidesRef.current = presetNgonSides
  }, [presetNgonSides])

  useEffect(() => {
    sketchLockStateRef.current = sketchLockState
  }, [sketchLockState])

  useEffect(() => {
    sketchSelectionRef.current = sketchSelection
  }, [sketchSelection])

  useEffect(() => {
    labelDrawOptionsRef.current = labelDrawOptions
  }, [labelDrawOptions])

  useEffect(() => {
    setDrivingDimRef.current = setDrivingDimensionValue
  }, [setDrivingDimensionValue])

  useEffect(() => {
    deleteSelectedSketchRef.current = deleteSelectedSketch
  }, [deleteSelectedSketch])

  useEffect(() => {
    dimEditRef.current = dimEdit
  }, [dimEdit])

  useEffect(() => {
    if (!dimEdit?.openKey) return
    const id = requestAnimationFrame(() => {
      dimInputRef.current?.focus()
      dimInputRef.current?.select?.()
    })
    return () => cancelAnimationFrame(id)
  }, [dimEdit?.openKey])

  const onCanvasDoubleClick = useCallback(
    (e) => {
      if (
        (tool !== TOOL.SELECT && tool !== TOOL.DIMENSION) ||
        !setDrivingDimensionValue
      )
        return
      const canvas = canvasRef.current
      if (!canvas) return
      e.preventDefault()
      const p = panRef.current
      const opt = placementRef.current
      const { x: lx, y: ly } = canvasLocalFromClient(
        canvas,
        e.clientX,
        e.clientY,
      )
      const wx = (lx - p.x) / opt.zoom
      const wy = (ly - p.y) / opt.zoom
      const dimPickId = hitDrivingDimension(
        wx,
        wy,
        workspaceRef.current,
        Math.max(40 / opt.zoom, 5),
        opt.zoom,
      )
      if (!dimPickId) return
      const dim = (workspaceRef.current.dimensions ?? []).find(
        (d) => d.id === dimPickId,
      )
      if (
        dim?.type !== 'distance' &&
        dim?.type !== 'radius' &&
        dim?.type !== 'diameter' &&
        dim?.type !== 'angle'
      ) {
        return
      }
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const { draft, editInDegrees } = drivingDimEditDraft(dim)
      const l0 = e.clientX - rect.left - 90
      const t0 = e.clientY - rect.top - 78
      const c = clampDimPopoverPosition(l0, t0)
      setDimEdit({
        id: dimPickId,
        dimType: dim.type,
        editInDegrees,
        left: c.left,
        top: c.top,
        draft,
        baselineDraft: draft,
        openKey: Date.now(),
      })
    },
    [
      tool,
      setDrivingDimensionValue,
      drivingDimEditDraft,
      clampDimPopoverPosition,
      containerRef,
    ],
  )

  const commitDimEdit = useCallback(() => {
    const cur = dimEditRef.current
    const applyFn = setDrivingDimRef.current
    if (!cur || !applyFn) {
      dimEditRef.current = null
      setDimEdit(null)
      return
    }
    const raw = String(cur.draft).trim()
    let v = Number.parseFloat(raw)
    if (raw === '' || !Number.isFinite(v)) {
      setDimEdit((prev) =>
        prev ? { ...prev, draft: prev.baselineDraft ?? '' } : null,
      )
      return
    }
    if (cur.editInDegrees) v = (v * Math.PI) / 180
    const t = cur.dimType
    if (
      (t === 'distance' || t === 'radius' || t === 'diameter') &&
      v <= 0
    ) {
      setDimEdit((prev) =>
        prev ? { ...prev, draft: prev.baselineDraft ?? '' } : null,
      )
      return
    }
    if (t === 'angle' && (v <= 0 || v > 2 * Math.PI + 1e-9)) {
      setDimEdit((prev) =>
        prev ? { ...prev, draft: prev.baselineDraft ?? '' } : null,
      )
      return
    }
    dimEditRef.current = null
    setDimEdit(null)
    applyFn(cur.id, v)
  }, [])

  useEffect(() => {
    hoverHighlightRef.current = hoverHighlight
  }, [hoverHighlight])

  useEffect(() => {
    toolRef.current = tool
    patchDraft(null)
    setPreview(null)
    if (tool !== TOOL.DIMENSION) dimPlacementRef.current = null
  }, [tool, patchDraft, setPreview])

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    el.style.cursor = tool === TOOL.DIMENSION ? DIMENSION_CURSOR : ''
    return () => {
      el.style.cursor = ''
    }
  }, [tool])

  useEffect(() => {
    workspaceRef.current = {
      points,
      segments,
      circles,
      polygons,
      arcs,
      angles,
      splines,
      constraints,
      dimensions,
    }
  }, [
    points,
    segments,
    circles,
    polygons,
    arcs,
    angles,
    splines,
    constraints,
    dimensions,
  ])

  const workspaceSnapshot = useMemo(
    () => ({
      points,
      segments,
      circles,
      polygons,
      arcs,
      angles,
      splines,
      constraints,
      dimensions,
    }),
    [
      points,
      segments,
      circles,
      polygons,
      arcs,
      angles,
      splines,
      constraints,
      dimensions,
    ],
  )

  useEffect(() => {
    if (!sketchContextMenu) return
    const close = (e) => {
      const t = e.target
      if (typeof t?.closest === 'function' && t.closest('[data-sketch-context-menu]')) {
        return
      }
      setSketchContextMenu(null)
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [sketchContextMenu])

  useEffect(() => {
    if (!objectPropsEntity) return
    const onKey = (e) => {
      if (e.key === 'Escape') setObjectPropsEntity(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [objectPropsEntity])

  useEffect(() => {
    selectedShapeRef.current = selectedShape
  }, [selectedShape])

  useEffect(() => {
    setSelectedShapeRef.current = setSelectedShape
  }, [setSelectedShape])

  const drawPoints = useMemo(() => {
    if (!sketchLockState) return points
    return points.map((p) => ({
      ...p,
      isLocked: sketchLockState.pointLocked.get(p.id) === true,
    }))
  }, [points, sketchLockState])

  const drawPolygons = useMemo(() => {
    if (!allowRegionFill) {
      return polygons.map((p) => ({ ...p, fill: null }))
    }
    return polygons
  }, [polygons, allowRegionFill])

  const drawCircles = useMemo(() => {
    if (!allowRegionFill) {
      return circles.map((c) => ({ ...c, fill: null }))
    }
    return circles
  }, [circles, allowRegionFill])

  const drawSplines = useMemo(() => {
    if (!allowRegionFill) {
      return splines.map((sp) => ({ ...sp, fill: null }))
    }
    return splines
  }, [splines, allowRegionFill])

  const paint = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || size.width < 1 || size.height < 1) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.floor(size.width * dpr)
    canvas.height = Math.floor(size.height * dpr)
    canvas.style.width = `${size.width}px`
    canvas.style.height = `${size.height}px`

    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const strokeList =
      liveStroke && liveStroke.points.length > 0
        ? [...strokes, { id: '__live', points: liveStroke.points }]
        : strokes

    const rd = radialLeaderDragRef.current
    const rs = radialShoulderDragRef.current
    const dimensionsDraw = dimensions.map((d) => {
      let o = d
      if (
        rd?.dimId != null &&
        d.id === rd.dimId &&
        (d.type === 'radius' || d.type === 'diameter')
      ) {
        o = { ...o, leaderAngle: rd.leaderAngle }
      }
      if (
        rs?.dimId != null &&
        o.id === rs.dimId &&
        (o.type === 'radius' || o.type === 'diameter')
      ) {
        o = { ...o, leaderShoulderWorld: rs.shoulderWorld }
      }
      return o
    })

    drawWorkspaceScene(ctx, {
      width: size.width,
      height: size.height,
      dpr,
      pan,
      zoom,
      gridMinor: placementOptions.gridStep,
      ...viewDrawOptions,
      labelDrawOptions,
      strokes: strokeList,
      points: drawPoints,
      segments,
      circles: drawCircles,
      polygons: drawPolygons,
      arcs,
      angles,
      splines: drawSplines,
      preview,
      selectedPointId,
      hoverHighlight,
      selectedShape,
      splineAnchorPointId:
        geomDraft?.kind === 'spline' && geomDraft.vertexIds?.length
          ? geomDraft.vertexIds[0]
          : null,
      constraints,
      dimensions: dimensionsDraw,
      showDimensions,
      showRelations,
      sketchSelection,
      allowRegionFill,
      theme,
      sketchLockState,
      snapGuideHighlight,
    })
  }, [
    size.width,
    size.height,
    pan,
    zoom,
    strokes,
    drawPoints,
    segments,
    drawCircles,
    drawPolygons,
    arcs,
    angles,
    drawSplines,
    constraints,
    dimensions,
    showDimensions,
    showRelations,
    sketchSelection,
    allowRegionFill,
    preview,
    liveStroke,
    selectedPointId,
    placementOptions.gridStep,
    viewDrawOptions,
    labelDrawOptions,
    hoverHighlight,
    selectedShape,
    geomDraft,
    theme,
    sketchLockState,
    snapGuideHighlight,
  ])

  useEffect(() => {
    paintRef.current = paint
  }, [paint])

  useEffect(() => {
    paint()
  }, [paint])

  const paintMarqueeOverlay = useCallback(() => {
    const ov = marqueeOverlayRef.current
    if (!ov || size.width < 1 || size.height < 1) return
    const dpr = window.devicePixelRatio || 1
    ov.width = Math.floor(size.width * dpr)
    ov.height = Math.floor(size.height * dpr)
    ov.style.width = `${size.width}px`
    ov.style.height = `${size.height}px`
    const ctx = ov.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size.width, size.height)
    const d = dragRef.current
    if (d?.type !== 'marquee') return
    const x0 = Math.min(d.lx0, d.lx1)
    const y0 = Math.min(d.ly0, d.ly1)
    const rw = Math.abs(d.lx1 - d.lx0)
    const rh = Math.abs(d.ly1 - d.ly0)
    const stroke =
      theme === 'light'
        ? 'rgba(37, 99, 235, 0.88)'
        : 'rgba(147, 197, 253, 0.92)'
    const fill =
      theme === 'light'
        ? 'rgba(37, 99, 235, 0.07)'
        : 'rgba(147, 197, 253, 0.11)'
    ctx.fillStyle = fill
    ctx.strokeStyle = stroke
    ctx.lineWidth = 1
    ctx.setLineDash([5, 4])
    ctx.fillRect(x0, y0, rw, rh)
    ctx.strokeRect(x0, y0, rw, rh)
    ctx.setLineDash([])
  }, [size.width, size.height, theme])

  useEffect(() => {
    const onKey = (e) => {
      const t = e.target
      if (
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        (t instanceof HTMLElement && t.isContentEditable)
      ) {
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const sel = sketchSelectionRef.current ?? []
        const sh = selectedShapeRef.current
        const canDelete =
          sel.length > 0 || (sh?.kind && sh?.id)
        if (canDelete && deleteSelectedSketchRef.current) {
          e.preventDefault()
          deleteSelectedSketchRef.current()
        }
        return
      }
      if (e.key === 'Escape') {
        if (dimEditRef.current) {
          e.preventDefault()
          dimEditRef.current = null
          setDimEdit(null)
          return
        }
        if (dimPlacementRef.current && toolRef.current === TOOL.DIMENSION) {
          e.preventDefault()
          dimPlacementRef.current = null
          setPreview(null)
          return
        }
        cancelOriginPick?.()
        clearSketchSelection?.()
        const draft = geomDraftRef.current
        if (
          toolRef.current === TOOL.SPLINE &&
          draft?.kind === 'spline' &&
          draft.vertexIds.length >= 2
        ) {
          const ids = draft.vertexIds
          const pts = pointsRef.current
          const resolved = ids
            .map((id) => pts.find((q) => q.id === id))
            .filter(Boolean)
          if (resolved.length >= 2) {
            const first = resolved[0]
            const last = resolved[resolved.length - 1]
            const dist = Math.hypot(last.x - first.x, last.y - first.y)
            const isClosed = dist < SPLINE_CLOSE_WORLD
            const fillOk =
              isClosed &&
              (shapeStyleRef.current.fillNewShapes ||
                autoFillClosedSplineLoopsRef.current)
            const fill = fillOk
              ? shapeStyleRef.current.shapeFillRgba
              : null
            commit((d) => ({
              ...d,
              splines: [
                ...(d.splines ?? []),
                {
                  id: nextId('spl'),
                  vertexIds: [...draft.vertexIds],
                  splineType: splineTypeRef.current,
                  tension: splineTensionRef.current,
                  closed: isClosed,
                  segmentsPerSpan: splineSegmentsPerSpanRef.current,
                  fill,
                  geoRegistered: true,
                },
              ],
            }))
          }
        }
        patchDraft(null)
        setPreview(null)
        setSelectedShape(null)
        setTool?.(TOOL.SELECT)
        return
      }
      if (e.key === 'Enter') {
        const draft = geomDraftRef.current
        if (
          toolRef.current === TOOL.SPLINE &&
          draft?.kind === 'spline' &&
          draft.vertexIds.length >= 2
        ) {
          e.preventDefault()
          const wantClosed = splineClosedRef.current
          const fill =
            wantClosed &&
            (shapeStyleRef.current.fillNewShapes ||
              autoFillClosedSplineLoopsRef.current)
              ? shapeStyleRef.current.shapeFillRgba
              : null
          commit((d) => ({
            ...d,
            splines: [
              ...(d.splines ?? []),
              {
                id: nextId('spl'),
                vertexIds: [...draft.vertexIds],
                splineType: splineTypeRef.current,
                tension: splineTensionRef.current,
                closed: wantClosed,
                segmentsPerSpan: splineSegmentsPerSpanRef.current,
                fill,
                geoRegistered: true,
              },
            ],
          }))
          patchDraft(null)
          setPreview(null)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    cancelOriginPick,
    clearSketchSelection,
    commit,
    nextId,
    patchDraft,
    setPreview,
    setDimEdit,
    setSelectedShape,
    setTool,
  ])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e) => {
      const canvas = canvasRef.current
      if (!canvas) return
      e.preventDefault()
      const { x: lx, y: ly } = canvasLocalFromClient(canvas, e.clientX, e.clientY)
      const p = panRef.current
      const z = zoomRef.current
      const factor = e.deltaY > 0 ? 0.9 : 1.1
      const nz = Math.min(2.5, Math.max(0.15, z * factor))
      const wx = (lx - p.x) / z
      const wy = (ly - p.y) / z
      setPan({ x: lx - wx * nz, y: ly - wy * nz })
      setZoom(nz)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [containerRef, setPan, setZoom, size.width])

  const onPointerDown = useCallback(
    (e) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const t = toolRef.current
      const { x: lx, y: ly } = canvasLocalFromClient(canvas, e.clientX, e.clientY)
      const p = panRef.current
      const pts = pointsRef.current
      const opt = placementRef.current

      if (e.button === 2) {
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        dragRef.current = {
          type: 'rightPan',
          x: e.clientX,
          y: e.clientY,
          panX: p.x,
          panY: p.y,
        }
        return
      }

      if (e.button !== 0) return

      if (originPickRef.current) {
        e.preventDefault()
        confirmOriginAtWorld(rawWorldFromCanvas(lx, ly, p, zoomRef.current))
        return
      }

      e.preventDefault()

      const wx = (lx - p.x) / opt.zoom
      const wy = (ly - p.y) / opt.zoom
      const tol = SNAP_PX / opt.zoom

      if (e.shiftKey) {
        const ent = pickSketchEntity(
          wx,
          wy,
          lx,
          ly,
          workspaceRef.current,
          p,
          opt.zoom,
          tol,
        )
        if (ent) {
          toggleSketchSelectionItem?.(ent)
          return
        }
        if (t === TOOL.SELECT) {
          e.currentTarget.setPointerCapture(e.pointerId)
          dragRef.current = {
            type: 'marquee',
            lx0: lx,
            ly0: ly,
            lx1: lx,
            ly1: ly,
            additive: true,
          }
          paintMarqueeOverlay()
          return
        }
        clearSketchSelection?.()
        return
      }

      if (t === TOOL.SELECT) {
        const hit = findNearbyPoint(pts, lx, ly, p, opt.zoom, SNAP_PX)
        if (hit) {
          const ws = workspaceRef.current
          if (
            isPointFixedToWorldOrigin(ws, hit.id) ||
            sketchLockStateRef.current?.pointLocked?.get(hit.id) === true
          ) {
            return
          }
          clearSketchSelection?.()
          setSelectedShapeRef.current?.(null)
          setSelectedPointId(hit.id)
          movePointCheckpointRef.current = false
          e.currentTarget.setPointerCapture(e.pointerId)
          dragRef.current = {
            type: 'movePoint',
            id: hit.id,
            clusterIds: pointIdsCoincidentCluster(ws, hit.id),
            startClientX: e.clientX,
            startClientY: e.clientY,
          }
          return
        }
        if (setDrivingDimRef.current && !dimEditRef.current) {
          const shoulderId = hitRadialDimensionShoulder(
            wx,
            wy,
            workspaceRef.current,
            Math.max(6 / opt.zoom, 3),
            opt.zoom,
          )
          if (shoulderId) {
            const dim = (workspaceRef.current.dimensions ?? []).find(
              (x) => x.id === shoulderId,
            )
            if (
              dim &&
              (dim.type === 'radius' || dim.type === 'diameter')
            ) {
              const pmapSh = new Map(
                (workspaceRef.current.points ?? []).map((q) => [q.id, q]),
              )
              const tid = dim.targets?.[0]
              const c =
                (workspaceRef.current.circles ?? []).find((x) => x.id === tid) ??
                (workspaceRef.current.arcs ?? []).find((x) => x.id === tid)
              if (c) {
                const rc = circleWithResolvedCenter(c, pmapSh)
                if (rc.r > 1e-9) {
                  e.currentTarget.setPointerCapture(e.pointerId)
                  const g = radialLeaderGeometry({
                    cx: rc.cx,
                    cy: rc.cy,
                    r: rc.r,
                    zoom: opt.zoom,
                    leaderAngle: dim.leaderAngle ?? 0,
                    leaderShoulderWorld: dim.leaderShoulderWorld,
                  })
                  const raw = (wx - g.pBend.x) * g.hSign
                  const shoulderWorld = Math.max(
                    8 / opt.zoom,
                    Math.min(520, raw),
                  )
                  radialShoulderDragRef.current = {
                    dimId: shoulderId,
                    shoulderWorld,
                  }
                  dragRef.current = {
                    type: 'radialShoulder',
                    dimId: shoulderId,
                  }
                  paintRef.current()
                  return
                }
              }
            }
          }
          const dimPickId = hitDrivingDimension(
            wx,
            wy,
            workspaceRef.current,
            Math.max(40 / opt.zoom, 5),
            opt.zoom,
          )
          if (dimPickId) {
            const dim = (workspaceRef.current.dimensions ?? []).find(
              (d) => d.id === dimPickId,
            )
            if (
              dim &&
              (dim.type === 'radius' || dim.type === 'diameter')
            ) {
              const cen = radialDimCenterWorld(dim, workspaceRef.current)
              if (cen) {
                e.currentTarget.setPointerCapture(e.pointerId)
                const ang = Math.atan2(wy - cen.cy, wx - cen.cx)
                radialLeaderDragRef.current = {
                  dimId: dimPickId,
                  leaderAngle: ang,
                }
                dragRef.current = {
                  type: 'radialLeader',
                  dimId: dimPickId,
                }
                paintRef.current()
                return
              }
            }
          }
        }
        const pmapSel = new Map(pts.map((q) => [q.id, q]))
        const segsW = workspaceRef.current.segments ?? []
        const hitSeg = findNearestSegmentHit(segsW, pmapSel, wx, wy, tol)
        if (hitSeg) {
          const pa = pmapSel.get(hitSeg.seg.a)
          const pb = pmapSel.get(hitSeg.seg.b)
          if (pa && pb) {
            const endTol = Math.max(6 / opt.zoom, tol * 0.5)
            const da = Math.hypot(pa.x - wx, pa.y - wy)
            const db = Math.hypot(pb.x - wx, pb.y - wy)
            if (da > endTol && db > endTol) {
              clearSketchSelection?.()
              setSelectedPointId(null)
              setSelectedShapeRef.current?.({
                kind: 'segment',
                id: hitSeg.seg.id,
              })
              movePointCheckpointRef.current = false
              e.currentTarget.setPointerCapture(e.pointerId)
              const base = cloneWorkspaceData(workspaceRef.current)
              const U = new Set()
              for (const vid of [hitSeg.seg.a, hitSeg.seg.b]) {
                pointIdsCoincidentCluster(base, vid).forEach((x) => U.add(x))
              }
              dragRef.current = {
                type: 'moveSegment',
                startWx: wx,
                startWy: wy,
                baseSnapshot: base,
                unionIds: U,
              }
              checkpoint()
              return
            }
          }
        }
        const shapeHit = pickShapeAtWorld(
          wx,
          wy,
          workspaceRef.current,
          tol,
        )
        if (shapeHit) {
          clearSketchSelection?.()
          setSelectedPointId(null)
          setSelectedShapeRef.current?.(shapeHit)
          return
        }
        setSelectedPointId(null)
        setSelectedShapeRef.current?.(null)
        setSnapGuideHighlight(null)
        e.currentTarget.setPointerCapture(e.pointerId)
        dragRef.current = {
          type: 'marquee',
          lx0: lx,
          ly0: ly,
          lx1: lx,
          ly1: ly,
          additive: false,
        }
        paintMarqueeOverlay()
        return
      }

      if (t === TOOL.TRIM) {
        const pmapSel = new Map(pts.map((q) => [q.id, q]))
        const segsW = workspaceRef.current.segments ?? []
        const hitSeg = findNearestSegmentHit(segsW, pmapSel, wx, wy, tol)
        if (hitSeg) {
          const trimmed = trimSegmentAtClick(
            workspaceRef.current,
            hitSeg.seg.id,
            wx,
            wy,
            nextId,
            tol,
          )
          if (trimmed) {
            checkpoint()
            commit(() => trimmed)
          }
        }
        return
      }

      if (t === TOOL.FREEHAND) {
        e.currentTarget.setPointerCapture(e.pointerId)
        let w = pickWorldAtCursor(lx, ly, p, opt.zoom, pts, SNAP_PX, opt.snapToGrid, opt.gridStep)
        if (opt.snapFreehand) {
          w = snapWorldToGrid(w.x, w.y, opt.gridStep, true)
        }
        w = withSketchGuidesXY(w.x, w.y, opt)
        const id = nextId('s')
        freehandRef.current = { id, points: [{ x: w.x, y: w.y }] }
        setLiveStroke({ points: [{ x: w.x, y: w.y }] })
        dragRef.current = { type: 'freehand' }
        return
      }

      if (t === TOOL.POINT) {
        const r = resolvePlacementWithSketchGuides(
          lx,
          ly,
          p,
          opt.zoom,
          pts,
          opt,
          opt.strictPointsOnly,
        )
        if (!r || !r.isNewPoint) return
        let fx = r.x
        let fy = r.y
        let edgeId = null
        const segsP = workspaceRef.current.segments ?? []
        const pmapP = new Map(pts.map((q) => [q.id, q]))
        const hh = hoverHighlightRef.current
        if (hh?.kind === 'segment') {
          const hi = findNearestSegmentHit(segsP, pmapP, r.x, r.y, tol)
          if (hi && hi.seg.id === hh.id) {
            fx = hi.tx
            fy = hi.ty
            edgeId = hh.id
          }
        }
        const axisO = opt.axisOrigin ?? { x: 0, y: 0 }
        commit((d) => {
          const pid = nextId('p')
          let next = {
            ...d,
            points: [...d.points, { id: pid, x: fx, y: fy }],
          }
          next = applyPlacementAutoConstraints(
            next,
            pid,
            edgeId,
            axisO,
            tryCommitForSketchPlacement,
            () => nextId('co'),
          )
          return next
        })
        return
      }

      if (t === TOOL.SEGMENT || t === TOOL.CENTER_LINE) {
        const isCenterLine = t === TOOL.CENTER_LINE
        const draft = geomDraftRef.current
        const first =
          !draft ||
          (draft.kind !== 'segment' && draft.kind !== 'centerLine')

        if (first) {
          const r = resolvePlacementWithSketchGuides(
            lx,
            ly,
            p,
            opt.zoom,
            pts,
            opt,
            opt.strictPointsOnly,
          )
          if (!r) return
          let pid = r.pointId
          let ax = r.x
          let ay = r.y
          if (r.isNewPoint) {
            pid = nextId('p')
            let fx = r.x
            let fy = r.y
            let edgeId = null
            const segs0 = workspaceRef.current.segments ?? []
            const pmap0 = new Map(pts.map((q) => [q.id, q]))
            const hh0 = hoverHighlightRef.current
            if (hh0?.kind === 'segment') {
              const hi0 = findNearestSegmentHit(segs0, pmap0, r.x, r.y, tol)
              if (hi0 && hi0.seg.id === hh0.id) {
                fx = hi0.tx
                fy = hi0.ty
                edgeId = hh0.id
              }
            }
            const axisO = opt.axisOrigin ?? { x: 0, y: 0 }
            commit((d) => {
              let next = {
                ...d,
                points: [...d.points, { id: pid, x: fx, y: fy }],
              }
              next = applyPlacementAutoConstraints(
                next,
                pid,
                edgeId,
                axisO,
                tryCommitForSketchPlacement,
                () => nextId('co'),
              )
              return next
            })
            ax = fx
            ay = fy
          }
          patchDraft({
            kind: isCenterLine ? 'centerLine' : 'segment',
            fromId: pid,
            ax,
            ay,
          })
          setPreview({
            kind: 'segment',
            ax,
            ay,
            bx: ax,
            by: ay,
          })
          return
        }

        const lineIsCenter = draft.kind === 'centerLine'

        const near = findNearbyPoint(pts, lx, ly, p, opt.zoom, SNAP_PX)
        if (near) {
          if (near.id === draft.fromId) return
          if (lineIsCenter) {
            const midId = nextId('p')
            const lid = nextId('l')
            commit((d) => {
              const pmap = new Map(d.points.map((q) => [q.id, q]))
              const pa = pmap.get(draft.fromId)
              const pb = pmap.get(near.id)
              if (!pa || !pb) return d
              const mx = (pa.x + pb.x) / 2
              const my = (pa.y + pb.y) / 2
              return {
                ...d,
                points: [...d.points, { id: midId, x: mx, y: my }],
                segments: [
                  ...d.segments,
                  {
                    id: lid,
                    a: draft.fromId,
                    b: near.id,
                    construction: true,
                    geoRegistered: true,
                  },
                ],
                constraints: [
                  ...(d.constraints ?? []),
                  {
                    id: nextId('co'),
                    type: 'midPoint',
                    targets: [
                      { kind: 'point', id: midId },
                      { kind: 'segment', id: lid },
                    ],
                  },
                ],
              }
            })
          } else {
            commit((d) => ({
              ...d,
              segments: [
                ...d.segments,
                { id: nextId('l'), a: draft.fromId, b: near.id },
              ],
            }))
          }
          patchDraft(null)
          setPreview(null)
          return
        }

        if (opt.strictPointsOnly) return

        let w = pickWorldAtCursor(lx, ly, p, opt.zoom, pts, SNAP_PX, opt.snapToGrid, opt.gridStep)
        let c = constrainSegmentEnd(
          draft.ax,
          draft.ay,
          w.x,
          w.y,
          opt.fixedSegmentLength,
        )
        c = snapWorldToGrid(c.x, c.y, opt.gridStep, opt.snapToGrid)
        let fx = c.x
        let fy = c.y
        let edgeId = null
        if (opt.snapToSketchGuides) {
          const ax = opt.axisOrigin ?? { x: 0, y: 0 }
          const sg = snapWorldToSketchGuides(c.x, c.y, {
            ox: ax.x,
            oy: ax.y,
            zoom: opt.zoom,
            snapPx: SNAP_PX,
          })
          fx = sg.x
          fy = sg.y
        }
        const segs1 = workspaceRef.current.segments ?? []
        const pmap1 = new Map(pts.map((q) => [q.id, q]))
        const hh1 = hoverHighlightRef.current
        if (hh1?.kind === 'segment') {
          const hi1 = findNearestSegmentHit(segs1, pmap1, fx, fy, tol)
          if (hi1 && hi1.seg.id === hh1.id) {
            fx = hi1.tx
            fy = hi1.ty
            edgeId = hh1.id
          }
        }
        const endPid = nextId('p')
        const lid = nextId('l')
        const midId = lineIsCenter ? nextId('p') : null
        const axisO = opt.axisOrigin ?? { x: 0, y: 0 }
        commit((d) => {
          let pointsOut = [...d.points, { id: endPid, x: fx, y: fy }]
          if (lineIsCenter && midId) {
            const pmap = new Map(pointsOut.map((q) => [q.id, q]))
            const pa = pmap.get(draft.fromId)
            const pb = pmap.get(endPid)
            if (!pa || !pb) return d
            const mx = (pa.x + pb.x) / 2
            const my = (pa.y + pb.y) / 2
            pointsOut = [...pointsOut, { id: midId, x: mx, y: my }]
          }
          let next = {
            ...d,
            points: pointsOut,
            segments: [
              ...d.segments,
              lineIsCenter
                ? {
                    id: lid,
                    a: draft.fromId,
                    b: endPid,
                    construction: true,
                    geoRegistered: true,
                  }
                : { id: lid, a: draft.fromId, b: endPid },
            ],
          }
          if (lineIsCenter && midId) {
            next.constraints = [
              ...(next.constraints ?? []),
              {
                id: nextId('co'),
                type: 'midPoint',
                targets: [
                  { kind: 'point', id: midId },
                  { kind: 'segment', id: lid },
                ],
              },
            ]
          }
          next = applyPlacementAutoConstraints(
            next,
            endPid,
            edgeId,
            axisO,
            tryCommitForSketchPlacement,
            () => nextId('co'),
          )
          return next
        })
        patchDraft(null)
        setPreview(null)
        return
      }

      if (t === TOOL.DIMENSION) {
        if (setDrivingDimRef.current && !dimEditRef.current) {
          const shoulderId = hitRadialDimensionShoulder(
            wx,
            wy,
            workspaceRef.current,
            Math.max(6 / opt.zoom, 3),
            opt.zoom,
          )
          if (shoulderId) {
            const dim = (workspaceRef.current.dimensions ?? []).find(
              (x) => x.id === shoulderId,
            )
            if (
              dim &&
              (dim.type === 'radius' || dim.type === 'diameter')
            ) {
              const pmapSh = new Map(
                (workspaceRef.current.points ?? []).map((q) => [q.id, q]),
              )
              const tid = dim.targets?.[0]
              const c =
                (workspaceRef.current.circles ?? []).find((x) => x.id === tid) ??
                (workspaceRef.current.arcs ?? []).find((x) => x.id === tid)
              if (c) {
                const rc = circleWithResolvedCenter(c, pmapSh)
                if (rc.r > 1e-9) {
                  e.currentTarget.setPointerCapture(e.pointerId)
                  const g = radialLeaderGeometry({
                    cx: rc.cx,
                    cy: rc.cy,
                    r: rc.r,
                    zoom: opt.zoom,
                    leaderAngle: dim.leaderAngle ?? 0,
                    leaderShoulderWorld: dim.leaderShoulderWorld,
                  })
                  const raw = (wx - g.pBend.x) * g.hSign
                  const shoulderWorld = Math.max(
                    8 / opt.zoom,
                    Math.min(520, raw),
                  )
                  radialShoulderDragRef.current = {
                    dimId: shoulderId,
                    shoulderWorld,
                  }
                  dragRef.current = {
                    type: 'radialShoulder',
                    dimId: shoulderId,
                  }
                  paintRef.current()
                  return
                }
              }
            }
          }
          const dimPickId = hitDrivingDimension(
            wx,
            wy,
            workspaceRef.current,
            Math.max(40 / opt.zoom, 5),
            opt.zoom,
          )
          if (dimPickId) {
            const dim = (workspaceRef.current.dimensions ?? []).find(
              (d) => d.id === dimPickId,
            )
            if (
              dim &&
              (dim.type === 'radius' || dim.type === 'diameter')
            ) {
              const cen = radialDimCenterWorld(dim, workspaceRef.current)
              if (cen) {
                e.currentTarget.setPointerCapture(e.pointerId)
                const ang = Math.atan2(wy - cen.cy, wx - cen.cx)
                radialLeaderDragRef.current = {
                  dimId: dimPickId,
                  leaderAngle: ang,
                }
                dragRef.current = {
                  type: 'radialLeader',
                  dimId: dimPickId,
                }
                paintRef.current()
                return
              }
            }
          }
        }

        const ws = workspaceRef.current
        const dstate = dimPlacementRef.current
        const rectCont = containerRef.current?.getBoundingClientRect()

        const runDimPlacement = (pl) => {
          dimPlacementRef.current = null
          setPreview(null)
          completeDrivingDimensionPlacement({
            pl,
            wx,
            wy,
            clientX: e.clientX,
            clientY: e.clientY,
            containerRect: rectCont,
            commit,
            nextId,
            setDimEdit,
            canOpenEditor: !!setDrivingDimRef.current,
            labelDrawOptions: labelDrawOptionsRef.current,
            clampPopover: clampDimPopoverPosition,
          })
        }

        if (dstate?.phase === 'orient' && dstate.pl) {
          runDimPlacement(dstate.pl)
          return
        }

        if (dstate?.phase === 'pick2') {
          const e2 = pickDimensionEntity(wx, wy, ws, opt.zoom)
          if (!e2) return
          const p1 = dstate.pick1
          if (
            p1.kind === 'segment' &&
            e2.kind === 'segment' &&
            p1.id === e2.id
          ) {
            const seg = ws.segments.find((s) => s.id === p1.id)
            if (!seg) {
              dimPlacementRef.current = null
              return
            }
            const pmapW = new Map((ws.points ?? []).map((q) => [q.id, q]))
            const pa = pmapW.get(seg.a)
            const pb = pmapW.get(seg.b)
            if (!pa || !pb) {
              dimPlacementRef.current = null
              return
            }
            const L = Math.hypot(pb.x - pa.x, pb.y - pa.y)
            if (L < 1e-9) {
              dimPlacementRef.current = null
              return
            }
            const plDraft = {
              dimType: 'distance',
              distanceKind: 'segment',
              targets: [seg.id],
              value: L,
              ax: pa.x,
              ay: pa.y,
              bx: pb.x,
              by: pb.y,
            }
            if (distanceDimNeedsOrientationPhase(plDraft)) {
              dimPlacementRef.current = { phase: 'orient', pl: plDraft }
              return
            }
            runDimPlacement(plDraft)
            return
          }
          const resolved = resolveDimensionFromTwoPicks(p1, e2, ws)
          if (!resolved) {
            dimPlacementRef.current = null
            setPreview(null)
            return
          }
          if (distanceDimNeedsOrientationPhase(resolved)) {
            dimPlacementRef.current = { phase: 'orient', pl: resolved }
            return
          }
          runDimPlacement(resolved)
          return
        }

        const e1 = pickDimensionEntity(wx, wy, ws, opt.zoom)
        if (!e1) return

        if (e1.kind === 'circle') {
          const rad = diameterDimensionDraftFromCircle(e1, ws, wx, wy)
          if (!rad) return
          runDimPlacement(rad)
          return
        }
        if (e1.kind === 'arc') {
          const rad = radiusDimensionDraftFromArc(e1, ws, wx, wy)
          if (!rad) return
          runDimPlacement(rad)
          return
        }
        if (e1.kind === 'spline') {
          const rad = splineCurvatureDimensionDraft(e1, ws, wx, wy)
          if (!rad) return
          runDimPlacement(rad)
          return
        }

        dimPlacementRef.current = { phase: 'pick2', pick1: e1 }
        return
      }

      if (t === TOOL.CIRCLE) {
        const draft = geomDraftRef.current
        if (!draft || draft.kind !== 'circle') {
          const r = resolvePlacementWithSketchGuides(
            lx,
            ly,
            p,
            opt.zoom,
            pts,
            opt,
            opt.strictPointsOnly,
          )
          if (!r) return
          patchDraft({ kind: 'circle', cx: r.x, cy: r.y })
          setPreview({
            kind: 'circle',
            cx: r.x,
            cy: r.y,
            r: 0,
          })
          return
        }

        const w = pickWorldAtCursor(lx, ly, p, opt.zoom, pts, SNAP_PX, opt.snapToGrid, opt.gridStep)
        const rad = circleRadiusFromCursor(
          draft.cx,
          draft.cy,
          w.x,
          w.y,
          opt.fixedCircleRadius,
        )
        if (rad < 4) {
          patchDraft(null)
          setPreview(null)
          return
        }
        const fill = shapeStyleRef.current.fillNewShapes
          ? shapeStyleRef.current.shapeFillRgba
          : null
        const centerId = nextId('p')
        const circleId = nextId('c')
        commit((d) => ({
          ...d,
          points: [...d.points, { id: centerId, x: draft.cx, y: draft.cy }],
          circles: [
            ...d.circles,
            {
              id: circleId,
              centerId,
              cx: draft.cx,
              cy: draft.cy,
              r: rad,
              fill,
              isCut: !!cutModeRef.current,
              geoRegistered: true,
            },
          ],
        }))
        patchDraft(null)
        setPreview(null)
        return
      }

      if (t === TOOL.SHAPE_RECT) {
        const draft = geomDraftRef.current
        const r = resolvePlacementWithSketchGuides(
          lx,
          ly,
          p,
          opt.zoom,
          pts,
          opt,
          opt.strictPointsOnly,
        )
        if (!r) return
        if (!draft || draft.kind !== 'shapeRect') {
          patchDraft({ kind: 'shapeRect', x1: r.x, y1: r.y })
          return
        }
        const x2 = r.x
        const y2 = r.y
        const minx = Math.min(draft.x1, x2)
        const maxx = Math.max(draft.x1, x2)
        const miny = Math.min(draft.y1, y2)
        const maxy = Math.max(draft.y1, y2)
        if (maxx - minx < 2 || maxy - miny < 2) {
          patchDraft(null)
          return
        }
        const fill = shapeStyleRef.current.fillNewShapes
          ? shapeStyleRef.current.shapeFillRgba
          : null
        const p1 = nextId('p')
        const p2 = nextId('p')
        const p3 = nextId('p')
        const p4 = nextId('p')
        const polyId = nextId('poly')
        const s0 = nextId('seg')
        const s1 = nextId('seg')
        const s2 = nextId('seg')
        const s3 = nextId('seg')
        const coPar0 = {
          id: nextId('co'),
          type: 'parallel',
          targets: [
            { kind: 'segment', id: s0 },
            { kind: 'segment', id: s2 },
          ],
        }
        const coPar1 = {
          id: nextId('co'),
          type: 'parallel',
          targets: [
            { kind: 'segment', id: s1 },
            { kind: 'segment', id: s3 },
          ],
        }
        const coPerp = {
          id: nextId('co'),
          type: 'perpendicular',
          targets: [
            { kind: 'segment', id: s0 },
            { kind: 'segment', id: s1 },
          ],
        }
        const coPerpOpp = {
          id: nextId('co'),
          type: 'perpendicular',
          targets: [
            { kind: 'segment', id: s2 },
            { kind: 'segment', id: s3 },
          ],
        }
        const newConstraints = [coPar0, coPar1, coPerp, coPerpOpp]
        commit((d) => {
          let next = {
            ...d,
            points: [
              ...d.points,
              { id: p1, x: minx, y: miny },
              { id: p2, x: maxx, y: miny },
              { id: p3, x: maxx, y: maxy },
              { id: p4, x: minx, y: maxy },
            ],
            segments: [
              ...d.segments,
              { id: s0, a: p1, b: p2, geoRegistered: true },
              { id: s1, a: p2, b: p3, geoRegistered: true },
              { id: s2, a: p3, b: p4, geoRegistered: true },
              { id: s3, a: p4, b: p1, geoRegistered: true },
            ],
            polygons: [
              ...d.polygons,
              {
                id: polyId,
                vertexIds: [p1, p2, p3, p4],
                fill,
                isCut: !!cutModeRef.current,
                geoRegistered: true,
                outlineViaSegments: true,
                boundarySegmentIds: [s0, s1, s2, s3],
              },
            ],
            constraints: [...(d.constraints ?? [])],
          }
          for (const c of newConstraints) {
            next = { ...next, constraints: [...next.constraints, c] }
            next = applyConstraintEnforcement(next, c)
          }
          return recomputeBoundArcs(next)
        })
        patchDraft(null)
        return
      }

      if (t === TOOL.SHAPE_TRI || t === TOOL.SHAPE_NGON) {
        const n =
          t === TOOL.SHAPE_TRI
            ? 3
            : Math.min(96, Math.max(3, Math.round(presetNgonSidesRef.current)))
        const draft = geomDraftRef.current
        const r = resolvePlacementWithSketchGuides(
          lx,
          ly,
          p,
          opt.zoom,
          pts,
          opt,
          opt.strictPointsOnly,
        )
        if (!r) return
        const kind = t === TOOL.SHAPE_TRI ? 'shapeTri' : 'shapeNgon'
        if (!draft || draft.kind !== kind) {
          patchDraft({ kind, cx: r.x, cy: r.y })
          return
        }
        const rad = Math.hypot(r.x - draft.cx, r.y - draft.cy)
        if (rad < 3) {
          patchDraft(null)
          return
        }
        const theta = Math.atan2(r.y - draft.cy, r.x - draft.cx)
        const fill = shapeStyleRef.current.fillNewShapes
          ? shapeStyleRef.current.shapeFillRgba
          : null
        commit((d) => {
          const newIds = []
          const newPts = []
          for (let i = 0; i < n; i++) {
            const ang = theta + (i * 2 * Math.PI) / n
            const id = nextId('p')
            newIds.push(id)
            newPts.push({
              id,
              x: draft.cx + rad * Math.cos(ang),
              y: draft.cy + rad * Math.sin(ang),
            })
          }
          const polyId = nextId('poly')
          const newSegs = []
          const boundarySegmentIds = []
          for (let i = 0; i < n; i++) {
            const a = newIds[i]
            const b = newIds[(i + 1) % n]
            const sid = nextId('seg')
            boundarySegmentIds.push(sid)
            newSegs.push({ id: sid, a, b, geoRegistered: true })
          }
          let next = {
            ...d,
            points: [...d.points, ...newPts],
            segments: [...d.segments, ...newSegs],
            polygons: [
              ...d.polygons,
              {
                id: polyId,
                vertexIds: newIds,
                fill,
                isCut: !!cutModeRef.current,
                geoRegistered: true,
                outlineViaSegments: true,
                boundarySegmentIds,
              },
            ],
            constraints: [...(d.constraints ?? [])],
          }
          for (let i = 0; i < n - 1; i++) {
            const c = {
              id: nextId('co'),
              type: 'equal',
              targets: [
                { kind: 'segment', id: boundarySegmentIds[i] },
                { kind: 'segment', id: boundarySegmentIds[i + 1] },
              ],
            }
            next = { ...next, constraints: [...next.constraints, c] }
            next = applyConstraintEnforcement(next, c)
          }
          return recomputeBoundArcs(next)
        })
        patchDraft(null)
        return
      }

      if (t === TOOL.ARC) {
        const mode = arcModeRef.current
        const draft = geomDraftRef.current
        const tolW = SNAP_PX / opt.zoom
        const pointById = new Map(pts.map((q) => [q.id, q]))

        const commitArc = (params) => {
          commit((d) => ({
            ...d,
            arcs: [
              ...(d.arcs ?? []),
              {
                id: nextId('a'),
                ...params,
                arcMode: mode,
                fill: null,
                geoRegistered: true,
              },
            ],
          }))
          patchDraft(null)
          setPreview(null)
        }

        if (!draft || draft.kind !== 'arc' || draft.mode !== mode) {
          if (mode === ARC_MODE.CENTER) {
            const r = resolvePlacementWithSketchGuides(
              lx,
              ly,
              p,
              opt.zoom,
              pts,
              opt,
              opt.strictPointsOnly,
            )
            if (!r) return
            let centerId = r.pointId
            if (r.isNewPoint) {
              centerId = nextId('p')
              commit((d) => ({
                ...d,
                points: [...d.points, { id: centerId, x: r.x, y: r.y }],
              }))
            }
            patchDraft({
              kind: 'arc',
              mode: ARC_MODE.CENTER,
              step: 1,
              centerId,
            })
            setPreview({ kind: 'circle', cx: r.x, cy: r.y, r: 0 })
            return
          }
          if (mode === ARC_MODE.THREE_POINT) {
            const r = resolvePlacementWithSketchGuides(
              lx,
              ly,
              p,
              opt.zoom,
              pts,
              opt,
              opt.strictPointsOnly,
            )
            if (!r) return
            let pid = r.pointId
            if (r.isNewPoint) {
              pid = nextId('p')
              commit((d) => ({
                ...d,
                points: [...d.points, { id: pid, x: r.x, y: r.y }],
              }))
            }
            patchDraft({
              kind: 'arc',
              mode: ARC_MODE.THREE_POINT,
              step: 1,
              pointIds: [pid],
            })
            setPreview(null)
            return
          }
          if (mode === ARC_MODE.TANGENT) {
            const wx = (lx - p.x) / opt.zoom
            const wy = (ly - p.y) / opt.zoom
            const hit = findNearestSegmentHit(
              workspaceRef.current.segments,
              pointById,
              wx,
              wy,
              tolW,
            )
            if (!hit) return
            patchDraft({
              kind: 'arc',
              mode: ARC_MODE.TANGENT,
              step: 1,
              tx: hit.tx,
              ty: hit.ty,
              tdx: hit.tdx,
              tdy: hit.tdy,
              segId: hit.seg.id,
            })
            setPreview(null)
            return
          }
          return
        }

        if (mode === ARC_MODE.CENTER) {
          if (draft.step === 1) {
            const r = resolvePlacementWithSketchGuides(
              lx,
              ly,
              p,
              opt.zoom,
              pts,
              opt,
              opt.strictPointsOnly,
            )
            if (!r) return
            if (r.pointId === draft.centerId) return
            const C = pts.find((q) => q.id === draft.centerId)
            if (!C) return
            const rad = Math.hypot(r.x - C.x, r.y - C.y)
            if (rad < 4) {
              patchDraft(null)
              setPreview(null)
              return
            }
            let startId = r.pointId
            if (r.isNewPoint) {
              startId = nextId('p')
              commit((d) => ({
                ...d,
                points: [...d.points, { id: startId, x: r.x, y: r.y }],
              }))
            }
            patchDraft({
              kind: 'arc',
              mode: ARC_MODE.CENTER,
              step: 2,
              centerId: draft.centerId,
              startId,
              rimR: rad,
            })
            return
          }
          if (draft.step === 2) {
            const r = resolvePlacementWithSketchGuides(
              lx,
              ly,
              p,
              opt.zoom,
              pts,
              opt,
              opt.strictPointsOnly,
            )
            if (!r) return
            commit((d) => {
              const eid = nextId('p')
              const ptsOut = [...d.points, { id: eid, x: r.x, y: r.y }]
              const pmap = new Map(ptsOut.map((q) => [q.id, q]))
              const C = pmap.get(draft.centerId)
              const A = pmap.get(draft.startId)
              const B = pmap.get(eid)
              if (!C || !A || !B) return d
              const params = arcSweepCenterFromCursor(
                C.x,
                C.y,
                draft.rimR,
                A.x,
                A.y,
                B.x,
                B.y,
                r.x,
                r.y,
              )
              if (!params) return d
              return {
                ...d,
                points: ptsOut,
                arcs: [
                  ...(d.arcs ?? []),
                  {
                    id: nextId('a'),
                    ...params,
                    centerId: draft.centerId,
                    startId: draft.startId,
                    endId: eid,
                    arcMode: mode,
                    fill: null,
                    geoRegistered: true,
                  },
                ],
              }
            })
            patchDraft(null)
            setPreview(null)
            return
          }
        }

        if (mode === ARC_MODE.THREE_POINT) {
          if (draft.step === 1) {
            const r = resolvePlacementWithSketchGuides(
              lx,
              ly,
              p,
              opt.zoom,
              pts,
              opt,
              opt.strictPointsOnly,
            )
            if (!r) return
            let pid = r.pointId
            if (r.isNewPoint) {
              pid = nextId('p')
              commit((d) => ({
                ...d,
                points: [...d.points, { id: pid, x: r.x, y: r.y }],
              }))
            }
            const last = draft.pointIds[draft.pointIds.length - 1]
            if (pid === last) return
            patchDraft({
              ...draft,
              step: 2,
              pointIds: [...draft.pointIds, pid],
            })
            return
          }
          if (draft.step === 2) {
            const r = resolvePlacementWithSketchGuides(
              lx,
              ly,
              p,
              opt.zoom,
              pts,
              opt,
              opt.strictPointsOnly,
            )
            if (!r) return
            commit((d) => {
              let ptsOut = d.points
              let pid = r.pointId
              if (r.isNewPoint) {
                pid = nextId('p')
                ptsOut = [...d.points, { id: pid, x: r.x, y: r.y }]
              }
              const ptMap = new Map(ptsOut.map((q) => [q.id, q]))
              const pa = ptMap.get(draft.pointIds[0])
              const pb = ptMap.get(draft.pointIds[1])
              if (!pa || !pb) return d
              let p2x = r.x
              let p2y = r.y
              if (!r.isNewPoint) {
                const pc = ptMap.get(pid)
                if (!pc) return d
                p2x = pc.x
                p2y = pc.y
              }
              const params = arcSecantAndBulge(
                pa.x,
                pa.y,
                pb.x,
                pb.y,
                p2x,
                p2y,
              )
              if (!params) return d
              const pointIds = [...draft.pointIds, pid]
              return {
                ...d,
                points: ptsOut,
                arcs: [
                  ...(d.arcs ?? []),
                  {
                    id: nextId('a'),
                    ...params,
                    pointIds,
                    arcMode: mode,
                    fill: null,
                    geoRegistered: true,
                  },
                ],
              }
            })
            patchDraft(null)
            setPreview(null)
            return
          }
        }

        if (mode === ARC_MODE.TANGENT && draft.step === 1) {
          const w = pickWorldAtCursor(
            lx,
            ly,
            p,
            opt.zoom,
            pts,
            SNAP_PX,
            opt.snapToGrid,
            opt.gridStep,
          )
          const params = arcTangentLineAndPoint(
            draft.tx,
            draft.ty,
            draft.tdx,
            draft.tdy,
            w.x,
            w.y,
          )
          if (!params) {
            patchDraft(null)
            setPreview(null)
            return
          }
          commitArc(params)
          return
        }
      }

      if (t === TOOL.ANGLE) {
        const draft = geomDraftRef.current
        const r = resolvePlacementWithSketchGuides(
          lx,
          ly,
          p,
          opt.zoom,
          pts,
          opt,
          opt.strictPointsOnly,
        )
        if (!r) return

        if (!draft || draft.kind !== 'angle') {
          let pid = r.pointId
          if (r.isNewPoint) {
            pid = nextId('p')
            commit((d) => ({
              ...d,
              points: [...d.points, { id: pid, x: r.x, y: r.y }],
            }))
          }
          patchDraft({ kind: 'angle', centerId: pid })
          return
        }

        if (!draft.arm1Id) {
          let pid = r.pointId
          if (pid === draft.centerId) return
          if (r.isNewPoint) {
            pid = nextId('p')
            commit((d) => ({
              ...d,
              points: [...d.points, { id: pid, x: r.x, y: r.y }],
            }))
          }
          patchDraft({ kind: 'angle', centerId: draft.centerId, arm1Id: pid })
          return
        }

        let pid = r.pointId
        if (pid === draft.centerId || pid === draft.arm1Id) return
        if (r.isNewPoint) {
          pid = nextId('p')
          commit((d) => ({
            ...d,
            points: [...d.points, { id: pid, x: r.x, y: r.y }],
          }))
        }
        commit((d) => ({
          ...d,
          angles: [
            ...(d.angles ?? []),
            {
              id: nextId('ang'),
              centerId: draft.centerId,
              arm1Id: draft.arm1Id,
              arm2Id: pid,
              geoRegistered: true,
            },
          ],
        }))
        patchDraft(null)
        setPreview(null)
        return
      }

      if (t === TOOL.POLYGON) {
        const draft = geomDraftRef.current
        if (!draft || draft.kind !== 'polygon') {
          const r = resolvePlacementWithSketchGuides(
            lx,
            ly,
            p,
            opt.zoom,
            pts,
            opt,
            opt.strictPointsOnly,
          )
          if (!r) return
          let pid = r.pointId
          if (r.isNewPoint) {
            pid = nextId('p')
            commit((d) => ({
              ...d,
              points: [...d.points, { id: pid, x: r.x, y: r.y }],
            }))
          }
          patchDraft({ kind: 'polygon', vertexIds: [pid] })
          setPreview({ kind: 'polygon', verts: [{ x: r.x, y: r.y }] })
          return
        }

        const firstId = draft.vertexIds[0]
        const firstPt = pts.find((q) => q.id === firstId)
        if (firstPt && draft.vertexIds.length >= 3) {
          const sx = firstPt.x * opt.zoom + p.x
          const sy = firstPt.y * opt.zoom + p.y
          const dpx = lx - sx
          const dpy = ly - sy
          if (dpx * dpx + dpy * dpy <= SNAP_PX * SNAP_PX) {
            const fill = shapeStyleRef.current.fillNewShapes
              ? shapeStyleRef.current.shapeFillRgba
              : null
            commit((d) => ({
              ...d,
              polygons: [
                ...d.polygons,
                {
                  id: nextId('poly'),
                  vertexIds: [...draft.vertexIds],
                  fill,
                  isCut: !!cutModeRef.current,
                  geoRegistered: true,
                },
              ],
            }))
            patchDraft(null)
            setPreview(null)
            return
          }
        }

        const r = resolvePlacementWithSketchGuides(
          lx,
          ly,
          p,
          opt.zoom,
          pts,
          opt,
          opt.strictPointsOnly,
        )
        if (!r) return
        const lastId = draft.vertexIds[draft.vertexIds.length - 1]
        let newId = r.pointId
        if (r.isNewPoint) {
          newId = nextId('p')
          commit((d) => ({
            ...d,
            points: [...d.points, { id: newId, x: r.x, y: r.y }],
          }))
        }
        if (newId === lastId) return
        const nextIds = [...draft.vertexIds, newId]
        const positions = draft.vertexIds
          .map((id) => {
            const pt = pts.find((q) => q.id === id)
            return pt ? { x: pt.x, y: pt.y } : null
          })
          .filter(Boolean)
        if (r.isNewPoint) {
          positions.push({ x: r.x, y: r.y })
        } else {
          const pt = pts.find((q) => q.id === newId)
          if (pt) positions.push({ x: pt.x, y: pt.y })
        }
        patchDraft({ kind: 'polygon', vertexIds: nextIds })
        setPreview({ kind: 'polygon', verts: positions })
      }

      if (t === TOOL.SPLINE) {
        const draft = geomDraftRef.current
        const optSpl = {
          splineType: splineTypeRef.current,
          tension: splineTensionRef.current,
          segmentsPerSpan: splineSegmentsPerSpanRef.current,
        }
        if (!draft || draft.kind !== 'spline') {
          const r = resolvePlacementWithSketchGuides(
            lx,
            ly,
            p,
            opt.zoom,
            pts,
            opt,
            opt.strictPointsOnly,
          )
          if (!r) return
          let pid = r.pointId
          if (r.isNewPoint) {
            pid = nextId('p')
            commit((d) => ({
              ...d,
              points: [...d.points, { id: pid, x: r.x, y: r.y }],
            }))
          }
          patchDraft({ kind: 'spline', vertexIds: [pid] })
          setPreview(
            buildSplinePreviewPayload(
              [pid],
              pts,
              { x: r.x, y: r.y },
              optSpl,
              r.isNewPoint ? { id: pid, x: r.x, y: r.y } : null,
            ),
          )
          return
        }

        const firstId = draft.vertexIds[0]
        const firstPt = pts.find((q) => q.id === firstId)
        if (firstPt && draft.vertexIds.length >= 3) {
          const sx = firstPt.x * opt.zoom + p.x
          const sy = firstPt.y * opt.zoom + p.y
          const dpx = lx - sx
          const dpy = ly - sy
          if (dpx * dpx + dpy * dpy <= SNAP_CLOSE_PX * SNAP_CLOSE_PX) {
            const fillClosed =
              (shapeStyleRef.current.fillNewShapes ||
                autoFillClosedSplineLoopsRef.current)
                ? shapeStyleRef.current.shapeFillRgba
                : null
            commit((d) => ({
              ...d,
              splines: [
                ...(d.splines ?? []),
                {
                  id: nextId('spl'),
                  vertexIds: [...draft.vertexIds],
                  splineType: splineTypeRef.current,
                  tension: splineTensionRef.current,
                  closed: true,
                  segmentsPerSpan: splineSegmentsPerSpanRef.current,
                  fill: fillClosed,
                  geoRegistered: true,
                },
              ],
            }))
            patchDraft(null)
            setPreview(null)
            return
          }
        }

        const r = resolvePlacementWithSketchGuides(
          lx,
          ly,
          p,
          opt.zoom,
          pts,
          opt,
          opt.strictPointsOnly,
        )
        if (!r) return
        const lastId = draft.vertexIds[draft.vertexIds.length - 1]
        let newId = r.pointId
        if (r.isNewPoint) {
          newId = nextId('p')
          commit((d) => ({
            ...d,
            points: [...d.points, { id: newId, x: r.x, y: r.y }],
          }))
        }
        if (newId === lastId) return
        const nextIds = [...draft.vertexIds, newId]
        patchDraft({ kind: 'spline', vertexIds: nextIds })
        setPreview(
          buildSplinePreviewPayload(
            nextIds,
            pts,
            null,
            optSpl,
            r.isNewPoint ? { id: newId, x: r.x, y: r.y } : null,
          ),
        )
      }
    },
    [
      commit,
      nextId,
      patchDraft,
      setPreview,
      setLiveStroke,
      setSelectedPointId,
      confirmOriginAtWorld,
      toggleSketchSelectionItem,
      clearSketchSelection,
      paintMarqueeOverlay,
      setDimEdit,
      clampDimPopoverPosition,
      checkpoint,
      containerRef,
    ],
  )

  const onPointerMove = useCallback(
    (e) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const d = dragRef.current
      const p = panRef.current
      const opt = placementRef.current

      if (d?.type === 'rightPan') {
        setPan({
          x: d.panX + (e.clientX - d.x),
          y: d.panY + (e.clientY - d.y),
        })
        return
      }

      if (d?.type === 'radialLeader' && d.dimId) {
        const { x: lx, y: ly } = canvasLocalFromClient(
          canvas,
          e.clientX,
          e.clientY,
        )
        const wx = (lx - p.x) / opt.zoom
        const wy = (ly - p.y) / opt.zoom
        const dim = (workspaceRef.current.dimensions ?? []).find(
          (x) => x.id === d.dimId,
        )
        if (!dim) {
          radialLeaderDragRef.current = null
          dragRef.current = null
          paintRef.current()
          return
        }
        const cen = radialDimCenterWorld(dim, workspaceRef.current)
        if (!cen) return
        const leaderAngle = Math.atan2(wy - cen.cy, wx - cen.cx)
        radialLeaderDragRef.current = { dimId: d.dimId, leaderAngle }
        paintRef.current()
        return
      }

      if (d?.type === 'radialShoulder' && d.dimId) {
        const { x: lx } = canvasLocalFromClient(
          canvas,
          e.clientX,
          e.clientY,
        )
        const wx = (lx - p.x) / opt.zoom
        const dim = (workspaceRef.current.dimensions ?? []).find(
          (x) => x.id === d.dimId,
        )
        if (!dim) {
          radialShoulderDragRef.current = null
          dragRef.current = null
          paintRef.current()
          return
        }
        const pmap = new Map(
          (workspaceRef.current.points ?? []).map((q) => [q.id, q]),
        )
        const tid = dim.targets?.[0]
        const c =
          (workspaceRef.current.circles ?? []).find((x) => x.id === tid) ??
          (workspaceRef.current.arcs ?? []).find((x) => x.id === tid)
        if (!c) return
        const rc = circleWithResolvedCenter(c, pmap)
        if (rc.r < 1e-9) return
        const g = radialLeaderGeometry({
          cx: rc.cx,
          cy: rc.cy,
          r: rc.r,
          zoom: opt.zoom,
          leaderAngle: dim.leaderAngle ?? 0,
          leaderShoulderWorld: dim.leaderShoulderWorld,
        })
        const raw = (wx - g.pBend.x) * g.hSign
        const shoulderWorld = Math.max(8 / opt.zoom, Math.min(520, raw))
        radialShoulderDragRef.current = {
          dimId: d.dimId,
          shoulderWorld,
        }
        paintRef.current()
        return
      }

      if (d?.type === 'marquee') {
        const { x: lx2, y: ly2 } = canvasLocalFromClient(
          canvas,
          e.clientX,
          e.clientY,
        )
        d.lx1 = lx2
        d.ly1 = ly2
        paintMarqueeOverlay()
        return
      }

      if (d?.type === 'moveSegment') {
        const { x: lx, y: ly } = canvasLocalFromClient(canvas, e.clientX, e.clientY)
        const wx = (lx - p.x) / opt.zoom
        const wy = (ly - p.y) / opt.zoom
        const dw = { x: wx - d.startWx, y: wy - d.startWy }
        apply((data) => {
          let next = { ...data }
          for (const id of d.unionIds) {
            const p0 = d.baseSnapshot.points.find((q) => q.id === id)
            if (!p0) continue
            next = {
              ...next,
              points: next.points.map((pt) =>
                pt.id === id
                  ? { ...pt, x: p0.x + dw.x, y: p0.y + dw.y }
                  : pt,
              ),
            }
          }
          next = {
            ...next,
            circles: next.circles.map((c) => {
              if (!c.centerId || !d.unionIds.has(c.centerId)) return c
              const pt = next.points.find((q) => q.id === c.centerId)
              return pt ? { ...c, cx: pt.x, cy: pt.y } : c
            }),
          }
          next = relaxAllConstraints(next, 32)
          return recomputeBoundArcs(next)
        })
        return
      }

      if (d?.type === 'movePoint') {
        const dx = e.clientX - d.startClientX
        const dy = e.clientY - d.startClientY
        if (!movePointCheckpointRef.current && dx * dx + dy * dy >= 9) {
          checkpoint()
          movePointCheckpointRef.current = true
        }
        const { x: lx, y: ly } = canvasLocalFromClient(canvas, e.clientX, e.clientY)
        const { wx, wy, guides } = worldFromCursorPlacement(
          lx,
          ly,
          p,
          opt.zoom,
          pointsRef.current,
          opt,
        )
        setSnapGuideHighlight((prev) =>
          snapGuidesEqual(prev, guides) ? prev : guides,
        )
        const cluster =
          d.clusterIds instanceof Set && d.clusterIds.size > 0
            ? d.clusterIds
            : new Set([d.id])
        apply((data) => {
          const pid = d.id
          if (isPointFixedToWorldOrigin(data, pid)) return data
          const pt = data.points.find((q) => q.id === pid)
          if (!pt) return data
          const ddx = wx - pt.x
          const ddy = wy - pt.y
          if (ddx === 0 && ddy === 0) return data
          let next = moveCoincidentClusterByDelta(data, cluster, ddx, ddy)
          next = relaxAllConstraints(next, 28)
          return recomputeBoundArcs(next)
        })
        return
      }

      if (d?.type === 'freehand' && freehandRef.current) {
        const { x: lx, y: ly } = canvasLocalFromClient(canvas, e.clientX, e.clientY)
        let w = pickWorldAtCursor(lx, ly, p, opt.zoom, pointsRef.current, SNAP_PX, opt.snapToGrid, opt.gridStep)
        if (opt.snapFreehand) {
          w = snapWorldToGrid(w.x, w.y, opt.gridStep, true)
        }
        if (opt.snapToSketchGuides) {
          const ax = opt.axisOrigin ?? { x: 0, y: 0 }
          const sg = snapWorldToSketchGuides(w.x, w.y, {
            ox: ax.x,
            oy: ax.y,
            zoom: opt.zoom,
            snapPx: SNAP_PX,
          })
          w = { x: sg.x, y: sg.y }
          setSnapGuideHighlight((prev) =>
            snapGuidesEqual(prev, sg.guides) ? prev : sg.guides,
          )
        }
        const cur = freehandRef.current.points
        const last = cur[cur.length - 1]
        if (
          cur.length > 0 &&
          Math.hypot(w.x - last.x, w.y - last.y) < FREEHAND_MIN_DIST
        ) {
          return
        }
        const nextPts = [...cur, { x: w.x, y: w.y }]
        freehandRef.current = { ...freehandRef.current, points: nextPts }
        setLiveStroke({ points: nextPts })
        return
      }

      const { x: lx, y: ly } = canvasLocalFromClient(canvas, e.clientX, e.clientY)
      const draft = geomDraftRef.current
      const pts = pointsRef.current

      if (!d) {
        const wx = (lx - p.x) / opt.zoom
        const wy = (ly - p.y) / opt.zoom
        const tol = SNAP_PX / opt.zoom
        const ptHit = findNearbyPoint(pts, lx, ly, p, opt.zoom, SNAP_PX)
        let next = null
        if (ptHit) next = { kind: 'point', id: ptHit.id }
        else if (toolRef.current === TOOL.DIMENSION) {
          next = pickDimensionEntity(wx, wy, workspaceRef.current, opt.zoom)
        } else {
          next = pickShapeAtWorld(wx, wy, workspaceRef.current, tol)
        }
        setHoverHighlight((prev) => {
          const same =
            (!prev && !next) ||
            (prev &&
              next &&
              prev.kind === next.kind &&
              prev.id === next.id)
          if (same) return prev
          return next
        })
        const { guides } = worldFromCursorPlacement(
          lx,
          ly,
          p,
          opt.zoom,
          pts,
          opt,
        )
        setSnapGuideHighlight((prev) =>
          snapGuidesEqual(prev, guides) ? prev : guides,
        )
      }

      if (!d && toolRef.current === TOOL.DIMENSION) {
        const pl = dimPlacementRef.current
        const wx = (lx - p.x) / opt.zoom
        const wy = (ly - p.y) / opt.zoom
        let pv = null
        if (pl?.phase === 'orient' && pl.pl) {
          pv = pl.pl
        } else if (pl?.phase === 'pick2' && pl.pick1) {
          const eHover = pickDimensionEntity(
            wx,
            wy,
            workspaceRef.current,
            opt.zoom,
          )
          if (!eHover) {
            setPreview(null)
            return
          }
          const resolved = resolveDimensionFromTwoPicks(
            pl.pick1,
            eHover,
            workspaceRef.current,
          )
          if (!resolved) {
            setPreview(null)
            return
          }
          pv = resolved
        }
        if (pv) {
          const ldo = labelDrawOptionsRef.current
          const du = ldo?.documentUnits ?? DEFAULT_DOCUMENT_UNITS
          const unit = ldo?.worldUnit ?? 'mm'
          const showDeg = ldo?.showAngleDegrees !== false
          const z = opt.zoom
          if (pv.dimType === 'distance' && pv.ax != null) {
            const dk = pv.distanceKind
            const smart =
              dk === 'pointPoint' || dk === 'segment' || dk === 'pointLine'
            const proj = smart
              ? classifyLinearDimensionProjection(
                  wx,
                  wy,
                  pv.ax,
                  pv.ay,
                  pv.bx,
                  pv.by,
                )
              : 'aligned'
            const off = linearDimensionOffsetForProjection(
              wx,
              wy,
              pv.ax,
              pv.ay,
              pv.bx,
              pv.by,
              proj,
            )
            const v = linearDistanceValueForProjection(
              pv.ax,
              pv.ay,
              pv.bx,
              pv.by,
              proj,
            )
            setPreview({
              kind: 'linearDimension',
              ax: pv.ax,
              ay: pv.ay,
              bx: pv.bx,
              by: pv.by,
              offsetWorld: off,
              projection: proj,
              label: `${formatLengthMmForDisplay(v, du)} ${unit}`,
            })
          } else if (pv.dimType === 'angle' && pv.a0 != null) {
            const r = Math.max(12 / z, Math.hypot(wx - pv.vx, wy - pv.vy))
            const label = showDeg
              ? `${((pv.value * 180) / Math.PI).toFixed(1)}°`
              : `${Number(pv.value).toFixed(3)} rad`
            setPreview({
              kind: 'angularDimension',
              vx: pv.vx,
              vy: pv.vy,
              r,
              a0: pv.a0,
              a1: pv.a1,
              label,
            })
          } else if (pv.dimType === 'radius') {
            setPreview({
              kind: 'radialDimension',
              cx: pv.cx,
              cy: pv.cy,
              r: pv.r,
              leaderAngle: pv.leaderAngle ?? 0,
              label: `R ${formatLengthMmForDisplay(pv.value, du)} ${unit}`,
            })
          } else if (pv.dimType === 'diameter') {
            setPreview({
              kind: 'radialDimension',
              cx: pv.cx,
              cy: pv.cy,
              r: pv.r,
              leaderAngle: pv.leaderAngle ?? 0,
              label: `Ø ${formatLengthMmForDisplay(pv.value, du)} ${unit}`,
            })
          }
        }
      }

      if (draft?.kind === 'segment' || draft?.kind === 'centerLine') {
        const near = findNearbyPoint(pts, lx, ly, p, opt.zoom, SNAP_PX)
        let bx
        let by
        if (near) {
          bx = near.x
          by = near.y
          setSnapGuideHighlight((prev) =>
            snapGuidesEqual(prev, {}) ? prev : {},
          )
        } else {
          let w = pickWorldAtCursor(lx, ly, p, opt.zoom, pts, SNAP_PX, opt.snapToGrid, opt.gridStep)
          const c = constrainSegmentEnd(
            draft.ax,
            draft.ay,
            w.x,
            w.y,
            opt.fixedSegmentLength,
          )
          const s = snapWorldToGrid(c.x, c.y, opt.gridStep, opt.snapToGrid)
          if (opt.snapToSketchGuides) {
            const ax = opt.axisOrigin ?? { x: 0, y: 0 }
            const sg = snapWorldToSketchGuides(s.x, s.y, {
              ox: ax.x,
              oy: ax.y,
              zoom: opt.zoom,
              snapPx: SNAP_PX,
            })
            bx = sg.x
            by = sg.y
            setSnapGuideHighlight((prev) =>
              snapGuidesEqual(prev, sg.guides) ? prev : sg.guides,
            )
          } else {
            bx = s.x
            by = s.y
          }
        }
        setPreview({
          kind: 'segment',
          ax: draft.ax,
          ay: draft.ay,
          bx,
          by,
        })
        return
      }

      if (draft?.kind === 'circle') {
        const { wx, wy, guides } = worldFromCursorPlacement(
          lx,
          ly,
          p,
          opt.zoom,
          pts,
          opt,
        )
        setSnapGuideHighlight((prev) =>
          snapGuidesEqual(prev, guides) ? prev : guides,
        )
        const r = circleRadiusFromCursor(
          draft.cx,
          draft.cy,
          wx,
          wy,
          opt.fixedCircleRadius,
        )
        setPreview({
          kind: 'circle',
          cx: draft.cx,
          cy: draft.cy,
          r,
        })
        return
      }

      if (draft?.kind === 'shapeTri' || draft?.kind === 'shapeNgon') {
        const { wx, wy, guides } = worldFromCursorPlacement(
          lx,
          ly,
          p,
          opt.zoom,
          pts,
          opt,
        )
        setSnapGuideHighlight((prev) =>
          snapGuidesEqual(prev, guides) ? prev : guides,
        )
        setPreview({
          kind: 'segment',
          ax: draft.cx,
          ay: draft.cy,
          bx: wx,
          by: wy,
        })
        return
      }

      if (draft?.kind === 'shapeRect') {
        const { wx, wy, guides } = worldFromCursorPlacement(
          lx,
          ly,
          p,
          opt.zoom,
          pts,
          opt,
        )
        setSnapGuideHighlight((prev) =>
          snapGuidesEqual(prev, guides) ? prev : guides,
        )
        const minx = Math.min(draft.x1, wx)
        const maxx = Math.max(draft.x1, wx)
        const miny = Math.min(draft.y1, wy)
        const maxy = Math.max(draft.y1, wy)
        setPreview({
          kind: 'rect',
          minx,
          miny,
          maxx,
          maxy,
        })
        return
      }

      if (draft?.kind === 'polygon') {
        const pointById = new Map(pts.map((pt) => [pt.id, pt]))
        const verts = draft.vertexIds
          .map((id) => pointById.get(id))
          .filter(Boolean)
          .map((pt) => ({ x: pt.x, y: pt.y }))
        const { wx, wy, guides } = worldFromCursorPlacement(
          lx,
          ly,
          p,
          opt.zoom,
          pts,
          opt,
        )
        setSnapGuideHighlight((prev) =>
          snapGuidesEqual(prev, guides) ? prev : guides,
        )
        setPreview({
          kind: 'polygon',
          verts: [...verts, { x: wx, y: wy }],
        })
        return
      }

      if (
        draft?.kind === 'arc' &&
        draft.mode === ARC_MODE.CENTER &&
        draft.step === 1
      ) {
        const cmap = new Map(pts.map((q) => [q.id, q]))
        const C = cmap.get(draft.centerId)
        if (!C) return
        const { wx, wy, guides } = worldFromCursorPlacement(
          lx,
          ly,
          p,
          opt.zoom,
          pts,
          opt,
        )
        setSnapGuideHighlight((prev) =>
          snapGuidesEqual(prev, guides) ? prev : guides,
        )
        const r = Math.hypot(wx - C.x, wy - C.y)
        setPreview({ kind: 'circle', cx: C.x, cy: C.y, r })
        return
      }

      if (
        draft?.kind === 'arc' &&
        draft.mode === ARC_MODE.CENTER &&
        draft.step === 2
      ) {
        const cmap = new Map(pts.map((q) => [q.id, q]))
        const C = cmap.get(draft.centerId)
        const A = cmap.get(draft.startId)
        if (!C || !A) return
        const { wx, wy, guides } = worldFromCursorPlacement(
          lx,
          ly,
          p,
          opt.zoom,
          pts,
          opt,
        )
        setSnapGuideHighlight((prev) =>
          snapGuidesEqual(prev, guides) ? prev : guides,
        )
        const params = arcSweepCenterFromCursor(
          C.x,
          C.y,
          draft.rimR,
          A.x,
          A.y,
          wx,
          wy,
          wx,
          wy,
        )
        if (params) {
          setPreview({
            kind: 'arc',
            cx: params.cx,
            cy: params.cy,
            r: params.r,
            a0: params.a0,
            sweep: params.sweep,
          })
        }
        return
      }

      if (
        draft?.kind === 'arc' &&
        draft.mode === ARC_MODE.THREE_POINT &&
        draft.step === 2
      ) {
        const map = new Map(pts.map((pt) => [pt.id, pt]))
        const pa = map.get(draft.pointIds[0])
        const pb = map.get(draft.pointIds[1])
        const w = pickWorldAtCursor(
          lx,
          ly,
          p,
          opt.zoom,
          pts,
          SNAP_PX,
          opt.snapToGrid,
          opt.gridStep,
        )
        if (pa && pb) {
          const prm = arcSecantAndBulge(
            pa.x,
            pa.y,
            pb.x,
            pb.y,
            w.x,
            w.y,
          )
          if (prm) {
            setPreview({
              kind: 'arc',
              cx: prm.cx,
              cy: prm.cy,
              r: prm.r,
              a0: prm.a0,
              sweep: prm.sweep,
            })
          } else setPreview(null)
        }
        return
      }

      if (
        draft?.kind === 'arc' &&
        draft.mode === ARC_MODE.TANGENT &&
        draft.step === 1
      ) {
        const w = pickWorldAtCursor(
          lx,
          ly,
          p,
          opt.zoom,
          pts,
          SNAP_PX,
          opt.snapToGrid,
          opt.gridStep,
        )
        const prm = arcTangentLineAndPoint(
          draft.tx,
          draft.ty,
          draft.tdx,
          draft.tdy,
          w.x,
          w.y,
        )
        if (prm) {
          setPreview({
            kind: 'arc',
            cx: prm.cx,
            cy: prm.cy,
            r: prm.r,
            a0: prm.a0,
            sweep: prm.sweep,
          })
        } else setPreview(null)
        return
      }

      if (draft?.kind === 'spline') {
        const cur = pickWorldAtCursor(
          lx,
          ly,
          p,
          opt.zoom,
          pts,
          SNAP_PX,
          opt.snapToGrid,
          opt.gridStep,
        )
        const opts = {
          splineType: splineTypeRef.current,
          tension: splineTensionRef.current,
          segmentsPerSpan: splineSegmentsPerSpanRef.current,
        }
        setPreview(
          buildSplinePreviewPayload(draft.vertexIds, pts, cur, opts),
        )
        return
      }

      if (draft?.kind === 'angle') {
        const C = pts.find((q) => q.id === draft.centerId)
        if (!C) return
        const w = pickWorldAtCursor(lx, ly, p, opt.zoom, pts, SNAP_PX, opt.snapToGrid, opt.gridStep)
        if (!draft.arm1Id) {
          setPreview({ kind: 'angle', C, A: w, B: w })
          return
        }
        const A = pts.find((q) => q.id === draft.arm1Id)
        if (!A) return
        setPreview({ kind: 'angle', C, A, B: w })
      }
    },
    [
      apply,
      checkpoint,
      setPan,
      setPreview,
      setLiveStroke,
      setHoverHighlight,
      paintMarqueeOverlay,
    ],
  )

  const onPointerUp = useCallback(
    (e) => {
      const d = dragRef.current
      if (d?.type === 'marquee') {
        const dist = Math.hypot(d.lx1 - d.lx0, d.ly1 - d.ly0)
        const p = panRef.current
        const z = placementRef.current.zoom
        if (dist < MARQUEE_MIN_DRAG_PX) {
          if (!d.additive) {
            replaceSketchSelection?.([])
            setSelectedPointId(null)
            setSelectedShapeRef.current?.(null)
          }
        } else {
          const minLX = Math.min(d.lx0, d.lx1)
          const maxLX = Math.max(d.lx0, d.lx1)
          const minLY = Math.min(d.ly0, d.ly1)
          const maxLY = Math.max(d.ly0, d.ly1)
          const minWX = (minLX - p.x) / z
          const maxWX = (maxLX - p.x) / z
          const minWY = (minLY - p.y) / z
          const maxWY = (maxLY - p.y) / z
          const picked = collectSketchEntitiesInWorldRect(
            workspaceRef.current,
            minWX,
            maxWX,
            minWY,
            maxWY,
          )
          if (d.additive) {
            unionSketchSelection?.(picked)
          } else {
            replaceSketchSelection?.(picked)
            setSelectedPointId(null)
            setSelectedShapeRef.current?.(null)
          }
        }
        dragRef.current = null
        paintMarqueeOverlay()
        try {
          e.currentTarget.releasePointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }
        return
      }

      if (d?.type === 'rightPan') {
        dragRef.current = null
        try {
          e.currentTarget.releasePointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }
        return
      }

      if (d?.type === 'radialLeader') {
        const rd = radialLeaderDragRef.current
        radialLeaderDragRef.current = null
        dragRef.current = null
        if (rd?.dimId != null) {
          commit((data) => ({
            ...data,
            dimensions: (data.dimensions ?? []).map((dm) =>
              dm.id === rd.dimId
                ? { ...dm, leaderAngle: rd.leaderAngle }
                : dm,
            ),
          }))
        }
        paintRef.current()
        try {
          e.currentTarget.releasePointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }
        return
      }

      if (d?.type === 'radialShoulder') {
        const rs = radialShoulderDragRef.current
        radialShoulderDragRef.current = null
        dragRef.current = null
        if (rs?.dimId != null) {
          commit((data) => ({
            ...data,
            dimensions: (data.dimensions ?? []).map((dm) =>
              dm.id === rs.dimId
                ? { ...dm, leaderShoulderWorld: rs.shoulderWorld }
                : dm,
            ),
          }))
        }
        paintRef.current()
        try {
          e.currentTarget.releasePointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }
        return
      }

      if (d?.type === 'movePoint') {
        dragRef.current = null
        setSnapGuideHighlight(null)
        try {
          e.currentTarget.releasePointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }
        return
      }

      if (d?.type === 'moveSegment') {
        dragRef.current = null
        setSnapGuideHighlight(null)
        try {
          e.currentTarget.releasePointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }
        return
      }

      if (d?.type === 'freehand' && freehandRef.current) {
        const { id, points: fp } = freehandRef.current
        freehandRef.current = null
        dragRef.current = null
        setLiveStroke(null)
        if (fp.length >= 2) {
          commit((data) => ({
            ...data,
            strokes: [...data.strokes, { id, points: fp }],
          }))
        }
        try {
          e.currentTarget.releasePointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }
        return
      }

      if (dragRef.current) {
        dragRef.current = null
        try {
          e.currentTarget.releasePointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }
      }
    },
    [
      commit,
      setLiveStroke,
      paintMarqueeOverlay,
      replaceSketchSelection,
      unionSketchSelection,
      setSelectedPointId,
    ],
  )

  const handleCanvasContextMenu = useCallback((e) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const p = panRef.current
    const opt = placementRef.current
    const { x: lx, y: ly } = canvasLocalFromClient(
      canvas,
      e.clientX,
      e.clientY,
    )
    const wx = (lx - p.x) / opt.zoom
    const wy = (ly - p.y) / opt.zoom
    const tol = SNAP_PX / opt.zoom
    const ent = pickSketchEntity(
      wx,
      wy,
      lx,
      ly,
      workspaceRef.current,
      p,
      opt.zoom,
      tol,
    )
    if (!ent) return
    const pad = 6
    const maxX = (typeof window !== 'undefined' ? window.innerWidth : 9999) - 168
    const maxY = (typeof window !== 'undefined' ? window.innerHeight : 9999) - 72
    setSketchContextMenu({
      x: Math.max(pad, Math.min(e.clientX, maxX)),
      y: Math.max(pad, Math.min(e.clientY, maxY)),
      entity: ent,
    })
  }, [])

  let cursorClass = 'cursor-crosshair'
  if (tool === TOOL.SELECT)
    cursorClass = 'cursor-default active:cursor-grabbing'

  return (
    <>
    <div
      ref={containerRef}
      className="relative min-h-0 min-w-0 flex-1 overflow-visible"
    >
      <div className="h-full min-h-0 w-full overflow-hidden rounded-lg border border-gg-border bg-gg-canvas-bg shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <canvas
        ref={canvasRef}
        className={`relative z-0 block touch-none select-none ${cursorClass}`}
        onContextMenu={handleCanvasContextMenu}
        onPointerDown={onPointerDown}
        onDoubleClick={onCanvasDoubleClick}
        onPointerMove={onPointerMove}
        onPointerLeave={() => {
          setHoverHighlight(null)
          setSnapGuideHighlight(null)
        }}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      <canvas
        ref={marqueeOverlayRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[1] block touch-none select-none"
      />
      {size.width === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[13px] text-gg-muted">
          Resizing…
        </div>
      )}
      </div>
      {dimEdit ? (
        <div
          className="pointer-events-none absolute inset-0 z-20 overflow-visible"
          aria-live="polite"
        >
          <Draggable
            key={dimEdit.openKey ?? dimEdit.id}
            nodeRef={dimDragNodeRef}
            handle=".dim-drag-handle"
            cancel="input"
            defaultPosition={{ x: dimEdit.left, y: dimEdit.top }}
          >
            <div
              ref={dimDragNodeRef}
              className="pointer-events-auto absolute left-0 top-0 flex min-w-[10rem] max-w-[16rem] flex-col overflow-hidden rounded-md border border-gg-border bg-gg-workspace shadow-lg"
            >
              <div className="dim-drag-handle flex cursor-grab touch-none items-center justify-between gap-1 rounded-t-md border-b border-gg-border/60 bg-gg-canvas-bg/40 px-2 py-1 active:cursor-grabbing">
                <span className="text-[9px] font-semibold uppercase tracking-wide text-gg-muted">
                  Driving dimension
                </span>
                <span className="select-none text-[10px] text-gg-muted opacity-50" aria-hidden>
                  ⋮⋮
                </span>
              </div>
              <div className="flex flex-col gap-1 px-2 py-2">
                <label className="text-[10px] font-medium uppercase tracking-wide text-gg-muted">
                  {dimEdit.dimType === 'angle' && dimEdit.editInDegrees
                    ? 'Driving angle (°)'
                    : dimEdit.dimType === 'angle'
                      ? 'Driving angle (rad)'
                      : dimEdit.dimType === 'radius'
                        ? 'Driving radius'
                        : dimEdit.dimType === 'diameter'
                          ? 'Driving diameter'
                          : 'Driving length'}
                </label>
                <input
                  ref={dimInputRef}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  className="w-full rounded border border-gg-border bg-gg-canvas-bg px-2 py-1.5 text-[13px] text-gg-text tabular-nums"
                  value={dimEdit.draft}
                  placeholder={dimEdit.baselineDraft ?? ''}
                  onChange={(ev) =>
                    setDimEdit((prev) =>
                      prev
                        ? {
                            ...prev,
                            draft: sanitizeDimEditDraft(
                              ev.target.value,
                              prev.dimType,
                            ),
                          }
                        : prev,
                    )
                  }
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter') {
                      ev.preventDefault()
                      commitDimEdit()
                    }
                  }}
                  onBlur={() => {
                    commitDimEdit()
                  }}
                />
              </div>
            </div>
          </Draggable>
        </div>
      ) : null}
    </div>
    {typeof document !== 'undefined' &&
      sketchContextMenu &&
      createPortal(
        <SketchContextMenu
          x={sketchContextMenu.x}
          y={sketchContextMenu.y}
          theme={theme}
          segmentConstruction={
            sketchContextMenu.entity?.kind === 'segment'
              ? !!workspaceSnapshot.segments?.find(
                  (s) => s.id === sketchContextMenu.entity.id,
                )?.construction
              : false
          }
          onToggleConstruction={
            sketchContextMenu.entity?.kind === 'segment'
              ? () => {
                  const sid = sketchContextMenu.entity.id
                  commit((d) => ({
                    ...d,
                    segments: d.segments.map((s) =>
                      s.id === sid
                        ? { ...s, construction: !s.construction }
                        : s,
                    ),
                  }))
                  setSketchContextMenu(null)
                }
              : undefined
          }
          onClose={() => setSketchContextMenu(null)}
          onObjectProperties={() => {
            setObjectPropsEntity(sketchContextMenu.entity)
            setSketchContextMenu(null)
          }}
          isCutShape={
            sketchContextMenu.entity?.kind === 'circle'
              ? !!workspaceSnapshot.circles?.find(
                  (c) => c.id === sketchContextMenu.entity.id,
                )?.isCut
              : sketchContextMenu.entity?.kind === 'polygon'
                ? !!workspaceSnapshot.polygons?.find(
                    (pg) => pg.id === sketchContextMenu.entity.id,
                  )?.isCut
                : sketchContextMenu.entity?.kind === 'spline'
                  ? !!workspaceSnapshot.splines?.find(
                      (sp) => sp.id === sketchContextMenu.entity.id,
                    )?.isCut
                  : false
          }
          onToggleCutGeometry={
            sketchContextMenu.entity?.kind === 'circle' ||
            sketchContextMenu.entity?.kind === 'polygon' ||
            sketchContextMenu.entity?.kind === 'spline'
              ? () => {
                  const e = sketchContextMenu.entity
                  commit((d) => {
                    if (e.kind === 'circle') {
                      return {
                        ...d,
                        circles: d.circles.map((c) =>
                          c.id === e.id ? { ...c, isCut: !c.isCut } : c,
                        ),
                      }
                    }
                    if (e.kind === 'polygon') {
                      return {
                        ...d,
                        polygons: d.polygons.map((p) =>
                          p.id === e.id ? { ...p, isCut: !p.isCut } : p,
                        ),
                      }
                    }
                    return {
                      ...d,
                      splines: (d.splines ?? []).map((s) =>
                        s.id === e.id ? { ...s, isCut: !s.isCut } : s,
                      ),
                    }
                  })
                  setSketchContextMenu(null)
                }
              : undefined
          }
          onExecuteCut={
            sketchContextMenu.entity?.kind === 'circle' ||
            sketchContextMenu.entity?.kind === 'polygon' ||
            sketchContextMenu.entity?.kind === 'spline'
              ? () => {
                  const e = sketchContextMenu.entity
                  const fill =
                    shapeStyleRef.current.shapeFillRgba ??
                    'rgba(59, 130, 246, 0.22)'
                  commit((d) => {
                    if (e.kind === 'circle') {
                      const c = d.circles.find((x) => x.id === e.id)
                      if (!c?.isCut) return d
                      const pmap = new Map((d.points ?? []).map((p) => [p.id, p]))
                      const rc = circleWithResolvedCenter(c, pmap)
                      const next = trySubtractCircleFromFill(
                        d,
                        rc.cx,
                        rc.cy,
                        rc.r,
                        nextId,
                        { defaultPolygonFill: fill },
                      )
                      if (!next) return d
                      return {
                        ...next,
                        circles: (next.circles ?? []).filter((x) => x.id !== e.id),
                      }
                    }
                    const pmap = new Map((d.points ?? []).map((p) => [p.id, p]))
                    const poly = d.polygons.find((x) => x.id === e.id)
                    const spl = (d.splines ?? []).find((x) => x.id === e.id)
                    const verts = poly
                      ? poly.vertexIds.map((id) => pmap.get(id)).filter(Boolean)
                      : spl
                        ? (spl.vertexIds ?? []).map((id) => pmap.get(id)).filter(Boolean)
                        : []
                    const isCut = poly?.isCut || spl?.isCut
                    if (!isCut || verts.length < 3) return d
                    let minx = Infinity
                    let miny = Infinity
                    let maxx = -Infinity
                    let maxy = -Infinity
                    for (const v of verts) {
                      minx = Math.min(minx, v.x)
                      miny = Math.min(miny, v.y)
                      maxx = Math.max(maxx, v.x)
                      maxy = Math.max(maxy, v.y)
                    }
                    const next = trySubtractRectFromFill(
                      d,
                      { minx, miny, maxx, maxy },
                      nextId,
                      { defaultPolygonFill: fill },
                    )
                    if (!next) return d
                    return {
                      ...next,
                      polygons: (next.polygons ?? []).filter((x) => x.id !== e.id),
                      splines: (next.splines ?? []).filter((x) => x.id !== e.id),
                    }
                  })
                  setSketchContextMenu(null)
                }
              : undefined
          }
        />,
        document.body,
      )}
    {typeof document !== 'undefined' &&
      createPortal(
        <ObjectPropertiesModal
          open={!!objectPropsEntity}
          entity={objectPropsEntity}
          data={workspaceSnapshot}
          theme={theme}
          labelDrawOptions={labelDrawOptions}
          onClose={() => setObjectPropsEntity(null)}
        />,
        document.body,
      )}
    </>
  )
}
