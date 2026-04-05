import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'
import { DEFAULT_GRID_STEP } from '../lib/gridSnap.js'
import { relationTargetsFromSelection } from '../lib/relationTargetsFromSelection.js'
import { tryCommitConstraint } from '../lib/sketchConstraintQuality.js'
import { computeSketchLockState } from '../lib/sketchLockState.js'
import {
  geometryFromSketchPayload,
  workspaceHasDrawableContent,
} from '../lib/sketchPayload.js'
import { deleteSketchEntities } from '../lib/sketchDelete.js'
import {
  cloneWorkspaceData,
  createInitialWorkspaceState,
  emptyWorkspaceData,
  workspaceReducer,
} from '../lib/workspaceReducer.js'

export const TOOL = {
  FREEHAND: 'freehand',
  POINT: 'point',
  SEGMENT: 'segment',
  CIRCLE: 'circle',
  ARC: 'arc',
  ANGLE: 'angle',
  POLYGON: 'polygon',
  SPLINE: 'spline',
  SELECT: 'select',
  DIMENSION: 'dimension',
  SHAPE_RECT: 'shapeRect',
  SHAPE_TRI: 'shapeTri',
  SHAPE_NGON: 'shapeNgon',
}

/** @type {{ id: string; label: string }[]} */
export const RELATION_TYPE_OPTIONS = [
  {
    id: 'fixOrigin',
    label: 'Fix origin',
    description: 'Locks a sketch point to the global origin (0,0).',
  },
  {
    id: 'equal',
    label: 'Equal',
    description:
      'Equal length (two segments) or equal radius (two circles).',
  },
  { id: 'parallel', label: 'Parallel', description: 'Two lines same direction.' },
  {
    id: 'perpendicular',
    label: 'Perpendicular',
    description: 'Two lines at 90°.',
  },
  {
    id: 'tangent',
    label: 'Tangent',
    description:
      'Line tangent to a circle, circle tangent to circle, or colinear segments at a shared vertex.',
  },
  {
    id: 'concentric',
    label: 'Concentric',
    description: 'Two circles/arcs share the same center.',
  },
  {
    id: 'coincident',
    label: 'Coincident',
    description: 'Point on point, or point lying on a line/segment.',
  },
  {
    id: 'collinear',
    label: 'Collinear',
    description: 'Two lines lie on the same infinite straight line.',
  },
  { id: 'horizontal', label: 'Horizontal', description: 'Segment parallel to X.' },
  { id: 'vertical', label: 'Vertical', description: 'Segment parallel to Y.' },
  {
    id: 'symmetric',
    label: 'Symmetric',
    description: 'Mirror one segment about the line of another.',
  },
  {
    id: 'similar',
    label: 'Similar',
    description: 'Same direction with a fixed length ratio.',
  },
]

export const ARC_MODE = {
  CENTER: 'center',
  TANGENT: 'tangent',
  THREE_POINT: 'threePoint',
}

export const SPLINE_TYPE_OPTIONS = [
  { id: 'catmullRom', label: 'Catmull–Rom (through all knots)' },
  { id: 'naturalCubic', label: 'Natural cubic (through knots)' },
  { id: 'uniformBSpline', label: 'Uniform B-spline (control cage)' },
  { id: 'chordalCatmullRom', label: 'Chordal Catmull–Rom' },
  {
    id: 'quadraticAnchors',
    label: 'Quadratic A–H–A (on / off / on every 2nd)',
  },
  {
    id: 'cubicAnchors',
    label: 'Cubic A–H–H–A (on-curve every 4th knot)',
  },
]

function clampZoomValue(z) {
  return Math.min(2.5, Math.max(0.15, z))
}

function hexToFillRgba(hex) {
  const h = (hex || '#3d8dd6').replace('#', '')
  if (h.length !== 6 || !/^[0-9a-fA-F]+$/.test(h)) {
    return 'rgba(61, 141, 214, 0.22)'
  }
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},0.22)`
}

/**
 * @param {{ onSketchMessage?: (msg: string) => void }} [options]
 */
export function useWorkspaceScene(options = {}) {
  const { onSketchMessage } = options
  const [workspace, dispatch] = useReducer(
    workspaceReducer,
    null,
    createInitialWorkspaceState,
  )

  const [tool, setTool] = useState(TOOL.SELECT)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoomRaw] = useState(1)
  const [gridMode, setGridMode] = useState('cartesian')
  const [showAxes, setShowAxes] = useState(true)
  const [axisOrigin, setAxisOrigin] = useState({ x: 0, y: 0 })
  const [polarAngleStepDeg, setPolarAngleStepDeg] = useState(30)
  const [originPickNextClick, setOriginPickNextClick] = useState(false)

  const setZoom = useCallback((next) => {
    setZoomRaw((prev) =>
      clampZoomValue(typeof next === 'function' ? next(prev) : next),
    )
  }, [])
  const [geomDraft, setGeomDraft] = useState(null)
  const [preview, setPreview] = useState(null)
  const [liveStroke, setLiveStroke] = useState(null)
  const [selectedPointId, setSelectedPointId] = useState(null)

  const [snapToGrid, setSnapToGrid] = useState(false)
  const [gridStep, setGridStep] = useState(DEFAULT_GRID_STEP)
  const [strictPointsOnly, setStrictPointsOnly] = useState(false)
  const [snapFreehand, setSnapFreehand] = useState(false)
  const [fixedSegmentLengthInput, setFixedSegmentLengthInput] = useState('')
  const [fixedCircleRadiusInput, setFixedCircleRadiusInput] = useState('')
  const [fillNewShapes, setFillNewShapes] = useState(true)
  const [autoFillClosedSplineLoops, setAutoFillClosedSplineLoops] =
    useState(true)
  const [shapeFillHex, setShapeFillHex] = useState('#3d8dd6')

  const [worldUnitLabel, setWorldUnitLabel] = useState('u')
  const [showAxisTickValues, setShowAxisTickValues] = useState(true)
  const [showAxisNameLabels, setShowAxisNameLabels] = useState(true)
  const [showAngleDegrees, setShowAngleDegrees] = useState(true)
  const [showDimensions, setShowDimensions] = useState(false)
  const [showRelations, setShowRelations] = useState(true)
  const [splinePanelOpen, setSplinePanelOpen] = useState(true)
  const [ribbonSectionsOpen, setRibbonSectionsOpen] = useState({
    sketch: true,
    curves: true,
    shapes: true,
    relations: true,
  })

  const [selectedShape, setSelectedShape] = useState(null)

  const [arcMode, setArcModeState] = useState(ARC_MODE.CENTER)
  const [splineType, setSplineType] = useState('catmullRom')
  const [splineTension, setSplineTension] = useState(0.5)
  const [splineClosed, setSplineClosed] = useState(false)
  const [splineSegmentsPerSpan, setSplineSegmentsPerSpan] = useState(14)
  const [presetNgonSides, setPresetNgonSides] = useState(6)
  const [sketchSelection, setSketchSelection] = useState([])

  const idRef = useRef(0)
  const nextId = useCallback((prefix) => {
    idRef.current += 1
    return `${prefix}${idRef.current}`
  }, [])

  const clearEphemeral = useCallback(() => {
    setGeomDraft(null)
    setPreview(null)
    setLiveStroke(null)
  }, [])

  const commit = useCallback((updater) => {
    dispatch({ type: 'COMMIT', updater })
  }, [])

  const checkpoint = useCallback(() => {
    dispatch({ type: 'CHECKPOINT' })
  }, [])

  const apply = useCallback((updater) => {
    dispatch({ type: 'APPLY', updater })
  }, [])

  const undo = useCallback(() => {
    clearEphemeral()
    setSelectedPointId(null)
    setSelectedShape(null)
    setSketchSelection([])
    dispatch({ type: 'UNDO' })
  }, [clearEphemeral])

  const redo = useCallback(() => {
    clearEphemeral()
    setSelectedPointId(null)
    setSelectedShape(null)
    setSketchSelection([])
    dispatch({ type: 'REDO' })
  }, [clearEphemeral])

  const clear = useCallback(() => {
    clearEphemeral()
    setSelectedPointId(null)
    setSelectedShape(null)
    setSketchSelection([])
    dispatch({
      type: 'COMMIT',
      updater: () => cloneWorkspaceData(emptyWorkspaceData()),
    })
  }, [clearEphemeral])

  const deleteSelectedSketch = useCallback(() => {
    let sel = sketchSelection
    if (!sel.length && selectedShape) {
      sel = [{ kind: selectedShape.kind, id: selectedShape.id }]
    }
    if (!sel.length) return
    clearEphemeral()
    commit((d) => deleteSketchEntities(d, sel))
    setSketchSelection([])
    setSelectedPointId(null)
    setSelectedShape(null)
  }, [sketchSelection, selectedShape, commit, clearEphemeral])

  const toggleSketchSelectionItem = useCallback((item) => {
    setSketchSelection((prev) => {
      const i = prev.findIndex(
        (x) => x.kind === item.kind && x.id === item.id,
      )
      if (i >= 0) {
        return [...prev.slice(0, i), ...prev.slice(i + 1)]
      }
      return [...prev, item]
    })
  }, [])

  const clearSketchSelection = useCallback(() => {
    setSketchSelection([])
  }, [])

  const replaceSketchSelection = useCallback((items) => {
    setSketchSelection(Array.isArray(items) ? items : [])
  }, [])

  const unionSketchSelection = useCallback((items) => {
    if (!items?.length) return
    setSketchSelection((prev) => {
      const map = new Map(prev.map((x) => [`${x.kind}:${x.id}`, x]))
      for (const it of items) {
        map.set(`${it.kind}:${it.id}`, it)
      }
      return [...map.values()]
    })
  }, [])

  const fixedSegmentLength = useMemo(() => {
    const v = parseFloat(fixedSegmentLengthInput)
    return Number.isFinite(v) && v > 0 ? v : null
  }, [fixedSegmentLengthInput])

  const fixedCircleRadius = useMemo(() => {
    const v = parseFloat(fixedCircleRadiusInput)
    return Number.isFinite(v) && v > 0 ? v : null
  }, [fixedCircleRadiusInput])

  const shapeFillRgba = useMemo(
    () => hexToFillRgba(shapeFillHex),
    [shapeFillHex],
  )

  const placementOptions = useMemo(
    () => ({
      snapToGrid,
      gridStep,
      strictPointsOnly,
      snapFreehand,
      fixedSegmentLength,
      fixedCircleRadius,
      zoom,
      axisOrigin,
      snapToSketchGuides: true,
    }),
    [
      snapToGrid,
      gridStep,
      strictPointsOnly,
      snapFreehand,
      fixedSegmentLength,
      fixedCircleRadius,
      zoom,
      axisOrigin,
    ],
  )

  const polarAngleStep = useMemo(
    () => (polarAngleStepDeg * Math.PI) / 180,
    [polarAngleStepDeg],
  )

  const viewDrawOptions = useMemo(
    () => ({
      gridMode,
      showAxes,
      axisOrigin,
      polarAngleStep,
    }),
    [gridMode, showAxes, axisOrigin, polarAngleStep],
  )

  const axisNumberFormat = gridMode === 'polar' ? 'radians_pi' : 'decimal'

  const labelDrawOptions = useMemo(
    () => ({
      worldUnit: worldUnitLabel,
      showAxisTickValues,
      showAxisNameLabels,
      axisNumberFormat,
      showAngleDegrees,
    }),
    [
      worldUnitLabel,
      showAxisTickValues,
      showAxisNameLabels,
      gridMode,
      showAngleDegrees,
    ],
  )

  const confirmOriginAtWorld = useCallback((world) => {
    setAxisOrigin({ x: world.x, y: world.y })
    setOriginPickNextClick(false)
  }, [])

  const cancelOriginPick = useCallback(() => {
    setOriginPickNextClick(false)
  }, [])

  const shapeStyle = useMemo(
    () => ({
      fillNewShapes,
      shapeFillRgba,
    }),
    [fillNewShapes, shapeFillRgba],
  )

  const { data } = workspace

  /** Closed regions may fill whenever the shape carries fill; edge color still follows DOF (sketchLockState). */
  const allowRegionFill = true

  const setDrivingDimensionValue = useCallback(
    (id, raw) => {
      const v = typeof raw === 'string' ? Number.parseFloat(raw) : raw
      if (!Number.isFinite(v)) return
      commit((d) => ({
        ...d,
        dimensions: (d.dimensions ?? []).map((dim) => {
          if (dim.id !== id) return dim
          if (
            (dim.type === 'distance' ||
              dim.type === 'radius' ||
              dim.type === 'diameter') &&
            v <= 0
          ) {
            return dim
          }
          if (
            dim.type === 'angle' &&
            (v <= 0 || v > 2 * Math.PI + 1e-9)
          ) {
            return dim
          }
          return { ...dim, value: v }
        }),
      }))
    },
    [commit],
  )

  const sketchLockState = useMemo(() => computeSketchLockState(data), [data])

  const canSaveSketch = useMemo(
    () => workspaceHasDrawableContent(data),
    [data],
  )

  const canUndo = workspace.past.length > 0
  const canRedo = workspace.future.length > 0

  const applySketchRelation = useCallback(
    (type) => {
      const targets = relationTargetsFromSelection(
        type,
        sketchSelection,
        data,
      )
      if (!targets) {
        onSketchMessage?.(
          'Could not apply that relation to the current selection.',
        )
        return
      }
      let newCo = { id: nextId('co'), type, targets }
      if (type === 'similar' && targets.length === 2) {
        const segLen = (sid) => {
          const seg = data.segments.find((s) => s.id === sid)
          if (!seg) return null
          const pa = data.points.find((p) => p.id === seg.a)
          const pb = data.points.find((p) => p.id === seg.b)
          if (!pa || !pb) return null
          return Math.hypot(pb.x - pa.x, pb.y - pa.y)
        }
        const L0 = segLen(targets[0].id)
        const L1 = segLen(targets[1].id)
        if (L0 == null || L1 == null || L0 < 1e-9) {
          onSketchMessage?.('Similar needs two segments with positive length.')
          return
        }
        newCo = { ...newCo, ratio: L1 / L0 }
      }
      const result = tryCommitConstraint(data, newCo)
      if (!result.ok) {
        if (result.reason === 'redundant') {
          onSketchMessage?.(
            'That constraint is redundant — it already exists or is implied.',
          )
        } else {
          onSketchMessage?.(
            'That would over-constrain the sketch — no change applied.',
          )
        }
        return
      }
      commit(() => result.data)
      setSketchSelection([])
    },
    [sketchSelection, commit, nextId, data, onSketchMessage],
  )

  const loadWorkspaceSnapshot = useCallback(
    (snapshot) => {
      clearEphemeral()
      setSelectedPointId(null)
      setSelectedShape(null)
      setSketchSelection([])
      const geo =
        geometryFromSketchPayload(snapshot) ??
        (snapshot &&
        typeof snapshot === 'object' &&
        Array.isArray(snapshot.points)
          ? snapshot
          : null)
      if (!geo) {
        onSketchMessage?.(
          'Could not load sketch (missing geometry or unsupported payload).',
        )
        return
      }
      dispatch({
        type: 'COMMIT',
        updater: () => cloneWorkspaceData(geo),
      })
    },
    [clearEphemeral, dispatch, onSketchMessage],
  )

  const exportWorkspaceJson = useCallback(() => {
    return JSON.stringify(cloneWorkspaceData(data), null, 2)
  }, [data])

  const sketchIsExportable = canSaveSketch

  const setArcMode = useCallback((mode) => {
    setGeomDraft(null)
    setPreview(null)
    setArcModeState(mode)
  }, [])

  useEffect(() => {
    if (splineType === 'polyline') setSplineType('catmullRom')
  }, [splineType])

  useEffect(() => {
    if (tool !== TOOL.SPLINE) setSplinePanelOpen(true)
  }, [tool])

  const toggleRibbonSection = useCallback((key) => {
    setRibbonSectionsOpen((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

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
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        deleteSelectedSketch()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo, deleteSelectedSketch])

  return {
    tool,
    setTool,
    pan,
    setPan,
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
    confirmOriginAtWorld,
    cancelOriginPick,
    viewDrawOptions,
    labelDrawOptions,
    strokes: data.strokes,
    points: data.points,
    segments: data.segments,
    circles: data.circles,
    polygons: data.polygons,
    arcs: data.arcs ?? [],
    angles: data.angles ?? [],
    splines: data.splines ?? [],
    constraints: data.constraints ?? [],
    dimensions: data.dimensions ?? [],
    setDrivingDimensionValue,
    commit,
    checkpoint,
    apply,
    undo,
    redo,
    clear,
    deleteSelectedSketch,
    canUndo,
    canRedo,
    geomDraft,
    setGeomDraft,
    preview,
    setPreview,
    liveStroke,
    setLiveStroke,
    nextId,
    selectedPointId,
    setSelectedPointId,
    placementOptions,
    shapeStyle,
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
    workspaceData: data,
    worldUnitLabel,
    setWorldUnitLabel,
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
    splinePanelOpen,
    setSplinePanelOpen,
    ribbonSectionsOpen,
    toggleRibbonSection,
    presetNgonSides,
    setPresetNgonSides,
    sketchSelection,
    toggleSketchSelectionItem,
    clearSketchSelection,
    replaceSketchSelection,
    unionSketchSelection,
    applySketchRelation,
    selectedShape,
    setSelectedShape,
    arcMode,
    setArcMode,
    splineType,
    setSplineType,
    splineTension,
    setSplineTension,
    splineClosed,
    setSplineClosed,
    splineSegmentsPerSpan,
    setSplineSegmentsPerSpan,
    allowRegionFill,
    sketchLockState,
    canSaveSketch,
    loadWorkspaceSnapshot,
    exportWorkspaceJson,
    sketchIsExportable,
  }
}
