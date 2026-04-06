import { solveGCS } from './gcsSolver.js'

export const emptyWorkspaceData = () => ({
  strokes: [],
  points: [],
  segments: [],
  circles: [],
  polygons: [],
  arcs: [],
  angles: [],
  splines: [],
  constraints: [],
  dimensions: [],
})

export function cloneWorkspaceData(data) {
  return {
    strokes: data.strokes.map((s) => ({
      ...s,
      points: s.points.map((p) => ({ ...p })),
    })),
    points: data.points.map((p) => ({ ...p })),
    segments: data.segments.map((s) => ({ ...s })),
    circles: data.circles.map((c) => ({
      ...c,
      holes: c.holes ? c.holes.map((h) => ({ ...h })) : undefined,
    })),
    polygons: data.polygons.map((p) => ({
      ...p,
      vertexIds: [...p.vertexIds],
      boundarySegmentIds: p.boundarySegmentIds
        ? [...p.boundarySegmentIds]
        : undefined,
      holes: p.holes ? p.holes.map((ring) => [...ring]) : undefined,
    })),
    arcs: (data.arcs ?? []).map((a) => ({ ...a })),
    angles: (data.angles ?? []).map((a) => ({ ...a })),
    splines: (data.splines ?? []).map((s) => ({
      ...s,
      vertexIds: [...s.vertexIds],
    })),
    constraints: (data.constraints ?? []).map((c) => ({
      ...c,
      targets: [...(c.targets ?? [])],
    })),
    dimensions: (data.dimensions ?? []).map((d) => ({
      ...d,
      targets: (d.targets ?? []).map((t) =>
        typeof t === 'object' && t !== null && !Array.isArray(t)
          ? { ...t }
          : t,
      ),
    })),
    solverDiagnostics: data.solverDiagnostics
      ? { ...data.solverDiagnostics }
      : undefined,
  }
}

/**
 * Remove whole-sketch translation drift when the only world anchor is fixOrigin → (0,0).
 * Skips if other constraints pin coordinates in absolute space.
 * @param {object} data
 */
function reanchorFixOriginSketch(data) {
  const cons = data.constraints ?? []
  if (
    cons.some(
      (c) =>
        c.type === 'anchorAt' ||
        c.type === 'lockCoordX' ||
        c.type === 'lockCoordY',
    )
  ) {
    return data
  }
  const fix = cons.find(
    (c) =>
      c.type === 'fixOrigin' &&
      c.targets?.length === 1 &&
      c.targets[0].kind === 'point',
  )
  if (!fix) return data
  const pid = fix.targets[0].id
  const p = data.points.find((q) => q.id === pid)
  if (!p) return data
  const dx = -p.x
  const dy = -p.y
  if (Math.hypot(dx, dy) < 1e-12) return data
  return {
    ...data,
    points: data.points.map((pt) => ({
      ...pt,
      x: pt.x + dx,
      y: pt.y + dy,
    })),
  }
}

const DRIVING_DIM_TYPES = new Set([
  'distance',
  'radius',
  'diameter',
  'angle',
])

/**
 * @param {object} prev
 * @param {object} next
 * @returns {{ id: string; from: number; to: number } | null}
 */
function singleDrivingDimensionChange(prev, next) {
  const pmap = new Map((prev.dimensions ?? []).map((d) => [d.id, d]))
  /** @type {{ id: string; from: number; to: number } | null} */
  let found = null
  for (const d of next.dimensions ?? []) {
    if (!DRIVING_DIM_TYPES.has(d.type)) continue
    const p = pmap.get(d.id)
    if (!p) continue
    const from = p.value
    const to = d.value
    if (from === to) continue
    if (!Number.isFinite(from) || !Number.isFinite(to)) continue
    const eps = 1e-9 * Math.max(1, Math.abs(from), Math.abs(to))
    if (Math.abs(from - to) <= eps) continue
    if (found) return null
    found = { id: d.id, from, to }
  }
  return found
}

function dimensionRampSteps(from, to) {
  const delta = to - from
  const mag = Math.abs(delta)
  if (!Number.isFinite(from) || !Number.isFinite(to) || mag < 1e-14) {
    return [to]
  }
  const scale = Math.max(mag, Math.abs(from), Math.abs(to), 1)
  const rel = mag / scale
  let n = 1
  if (rel > 0.18) n = Math.min(8, Math.max(2, Math.ceil(rel / 0.22)))
  const out = []
  for (let i = 0; i <= n; i++) out.push(from + (delta * i) / n)
  return out
}

function solveWithDrivingDimensionRamp(finalData, previousData) {
  const ch = singleDrivingDimensionChange(previousData, finalData)
  if (ch == null) {
    return solveGCS(finalData, { maxIter: 40, tol: 1e-5 })
  }
  const steps = dimensionRampSteps(ch.from, ch.to)
  if (steps.length <= 2) {
    return solveGCS(finalData, { maxIter: 40, tol: 1e-5 })
  }
  let work = cloneWorkspaceData(finalData)
  for (let i = 1; i < steps.length; i++) {
    const v = steps[i]
    work = cloneWorkspaceData(work)
    work.dimensions = work.dimensions.map((d) =>
      d.id === ch.id ? { ...d, value: v } : d,
    )
    work = solveGCS(work, { maxIter: 40, tol: 1e-5 })
  }
  return work
}

/**
 * Run GCS after geometry-changing commits / live applies.
 * @param {object} data
 * @param {object | null} [previousData] when set, enables warm multi-step solve for one edited driving dimension
 */
export function finalizeSketchData(data, previousData = null) {
  const solved = previousData
    ? solveWithDrivingDimensionRamp(data, previousData)
    : solveGCS(data, { maxIter: 40, tol: 1e-5 })
  return reanchorFixOriginSketch(solved)
}

const MAX_HISTORY = 80

/**
 * @param {{ data: ReturnType<typeof emptyWorkspaceData>; past: ReturnType<typeof cloneWorkspaceData>[]; future: ReturnType<typeof cloneWorkspaceData>[] }} state
 */
export function workspaceReducer(state, action) {
  switch (action.type) {
    case 'COMMIT': {
      const raw = action.updater(state.data)
      return {
        past: [...state.past, cloneWorkspaceData(state.data)].slice(-MAX_HISTORY),
        future: [],
        data: finalizeSketchData(raw, state.data),
      }
    }
    case 'CHECKPOINT': {
      return {
        ...state,
        past: [...state.past, cloneWorkspaceData(state.data)].slice(-MAX_HISTORY),
        future: [],
      }
    }
    case 'APPLY': {
      const raw = action.updater(state.data)
      return {
        ...state,
        data: finalizeSketchData(raw, state.data),
      }
    }
    case 'UNDO': {
      if (state.past.length === 0) return state
      const prev = state.past[state.past.length - 1]
      return {
        data: cloneWorkspaceData(prev),
        past: state.past.slice(0, -1),
        future: [cloneWorkspaceData(state.data), ...state.future].slice(
          0,
          MAX_HISTORY,
        ),
      }
    }
    case 'REDO': {
      if (state.future.length === 0) return state
      const [next, ...rest] = state.future
      return {
        data: cloneWorkspaceData(next),
        past: [...state.past, cloneWorkspaceData(state.data)].slice(-MAX_HISTORY),
        future: rest,
      }
    }
    default:
      return state
  }
}

export function createInitialWorkspaceState() {
  const data = emptyWorkspaceData()
  return {
    data: cloneWorkspaceData(data),
    past: [],
    future: [],
  }
}
