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

/**
 * Run GCS after geometry-changing commits / live applies.
 * @param {object} data
 */
export function finalizeSketchData(data) {
  const solved = solveGCS(data, { maxIter: 40, tol: 1e-5 })
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
        data: finalizeSketchData(raw),
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
        data: finalizeSketchData(raw),
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
