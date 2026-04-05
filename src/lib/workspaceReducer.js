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
    circles: data.circles.map((c) => ({ ...c })),
    polygons: data.polygons.map((p) => ({
      ...p,
      vertexIds: [...p.vertexIds],
      boundarySegmentIds: p.boundarySegmentIds
        ? [...p.boundarySegmentIds]
        : undefined,
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
 * Run GCS after geometry-changing commits / live applies.
 * @param {object} data
 */
export function finalizeSketchData(data) {
  return solveGCS(data, { maxIter: 40, tol: 1e-5 })
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
