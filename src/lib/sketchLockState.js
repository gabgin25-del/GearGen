import { gaussNewtonIncidentRefine } from './sketchIncidentNewton.js'
import { cloneWorkspaceData } from './workspaceReducer.js'
import {
  allConstraintsSatisfied,
  relaxAllConstraints,
} from './sketchConstraintQuality.js'
import { solveGCS } from './gcsSolver.js'

/**
 * Layer 1 — Relaxation probe: nudge a point, relax + GCS heal; if a satisfying
 * configuration exists with the point displaced from its pre-nudge position,
 * it still has freedom.
 *
 * Layer 2 — Newton on incident constraints, then same heal.
 *
 * Driving dimensions are enforced by running solveGCS after relaxation so
 * length/angle residuals are respected when judging DOF.
 */

const NUDGE = 0.45
const MOVED_TOL = 0.14
const RELAX_PASSES = 22
const NR_MOVED_TOL = 0.12
const DIM_LEN_TOL = 0.06
const DIM_ANG_TOL = 0.04

/**
 * @param {object} data
 * @param {number} [lenTol]
 * @param {number} [angTol]
 */
export function dimensionsSatisfied(
  data,
  lenTol = DIM_LEN_TOL,
  angTol = DIM_ANG_TOL,
) {
  const pmap = new Map(data.points.map((p) => [p.id, p]))
  for (const dim of data.dimensions ?? []) {
    if (dim.type === 'distance' && dim.targets?.[0]) {
      const seg = (data.segments ?? []).find((s) => s.id === dim.targets[0])
      if (!seg) return false
      const pa = pmap.get(seg.a)
      const pb = pmap.get(seg.b)
      if (!pa || !pb) return false
      const L = Math.hypot(pb.x - pa.x, pb.y - pa.y)
      const v = dim.value
      if (v == null || !Number.isFinite(v) || v <= 0) continue
      if (Math.abs(L - v) > lenTol) return false
    }
    if (dim.type === 'angle' && dim.targets?.length >= 3) {
      const [idC, idA, idB] = dim.targets
      const C = pmap.get(idC)
      const A = pmap.get(idA)
      const B = pmap.get(idB)
      if (!C || !A || !B) return false
      const v0 = dim.value
      if (v0 == null || !Number.isFinite(v0)) continue
      const a1 = Math.atan2(A.y - C.y, A.x - C.x)
      const a2 = Math.atan2(B.y - C.y, B.x - C.x)
      let sweep = a2 - a1
      while (sweep <= -Math.PI) sweep += 2 * Math.PI
      while (sweep > Math.PI) sweep -= 2 * Math.PI
      if (Math.abs(sweep - v0) > angTol) return false
    }
  }
  return true
}

function healProbeState(trial) {
  const relaxed = relaxAllConstraints(trial, RELAX_PASSES)
  return solveGCS(relaxed)
}

function relaxProbeState(trial) {
  return relaxAllConstraints(trial, RELAX_PASSES)
}

/**
 * Points connected to a world anchor (fixOrigin / anchorAt) via segments or
 * coincident constraints — used with driving dimensions for “black” segments.
 *
 * @param {object} data
 * @returns {Set<string>}
 */
export function pointsTiedToWorldDatum(data) {
  const grounded = new Set()
  for (const c of data.constraints ?? []) {
    const t = c.targets ?? []
    if (
      c.type === 'fixOrigin' &&
      t.length === 1 &&
      t[0].kind === 'point'
    ) {
      grounded.add(t[0].id)
    }
    if (
      c.type === 'anchorAt' &&
      t.length === 1 &&
      t[0].kind === 'point'
    ) {
      grounded.add(t[0].id)
    }
  }
  const adj = new Map()
  const addEdge = (u, v) => {
    if (!adj.has(u)) adj.set(u, new Set())
    if (!adj.has(v)) adj.set(v, new Set())
    adj.get(u).add(v)
    adj.get(v).add(u)
  }
  for (const s of data.segments ?? []) {
    addEdge(s.a, s.b)
  }
  for (const c of data.constraints ?? []) {
    const t = c.targets ?? []
    if (c.type === 'coincident' && t.length === 2) {
      if (t[0].kind === 'point' && t[1].kind === 'point') {
        addEdge(t[0].id, t[1].id)
      }
    }
  }
  const seen = new Set(grounded)
  const q = [...grounded]
  while (q.length) {
    const id = q.shift()
    for (const nb of adj.get(id) ?? []) {
      if (!seen.has(nb)) {
        seen.add(nb)
        q.push(nb)
      }
    }
  }
  return seen
}

/**
 * @param {object} data
 * @param {string} pointId
 */
function relaxationProbeSuggestsFreedom(data, pointId) {
  const idx = data.points.findIndex((p) => p.id === pointId)
  if (idx < 0) return false

  const base = cloneWorkspaceData(data)
  const cons = base.constraints ?? []
  if (cons.length > 0 && !allConstraintsSatisfied(base)) {
    return true
  }
  if (
    (base.dimensions ?? []).length > 0 &&
    !dimensionsSatisfied(base)
  ) {
    return true
  }

  const p0 = base.points[idx]
  const dirs = [
    [NUDGE, 0],
    [-NUDGE, 0],
    [0, NUDGE],
    [0, -NUDGE],
  ]

  const hasDims = (base.dimensions ?? []).length > 0
  for (const [dx, dy] of dirs) {
    const trial = cloneWorkspaceData(base)
    const j = trial.points.findIndex((p) => p.id === pointId)
    trial.points[j] = {
      ...trial.points[j],
      x: p0.x + dx,
      y: p0.y + dy,
    }
    const healed = hasDims ? healProbeState(trial) : relaxProbeState(trial)
    if (!allConstraintsSatisfied(healed)) continue
    if (hasDims && !dimensionsSatisfied(healed)) continue
    const pf = healed.points.find((p) => p.id === pointId)
    if (!pf) continue
    if (Math.hypot(pf.x - p0.x, pf.y - p0.y) > MOVED_TOL) return true
  }

  return false
}

/**
 * @param {object} data
 * @param {string} pointId
 */
function newtonIncidentProbeSuggestsFreedom(data, pointId) {
  const idx = data.points.findIndex((p) => p.id === pointId)
  if (idx < 0) return false

  const base = cloneWorkspaceData(data)
  const cons = base.constraints ?? []
  if (cons.length > 0 && !allConstraintsSatisfied(base)) {
    return true
  }
  if (
    (base.dimensions ?? []).length > 0 &&
    !dimensionsSatisfied(base)
  ) {
    return true
  }

  const p0 = base.points[idx]
  const dirs = [
    [NUDGE, 0],
    [-NUDGE, 0],
    [0, NUDGE],
    [0, -NUDGE],
  ]

  const hasDims = (base.dimensions ?? []).length > 0
  for (const [dx, dy] of dirs) {
    const gn = gaussNewtonIncidentRefine(
      data,
      pointId,
      { x: p0.x, y: p0.y },
      p0.x + dx,
      p0.y + dy,
    )
    if (!gn) continue
    const trial = cloneWorkspaceData(base)
    const j = trial.points.findIndex((p) => p.id === pointId)
    trial.points[j] = { ...trial.points[j], x: gn.x, y: gn.y }
    const healed = hasDims ? healProbeState(trial) : relaxProbeState(trial)
    if (!allConstraintsSatisfied(healed)) continue
    if (hasDims && !dimensionsSatisfied(healed)) continue
    if (Math.hypot(gn.x - p0.x, gn.y - p0.y) > NR_MOVED_TOL) return true
  }

  return false
}

/**
 * @param {object} data workspace snapshot
 * @param {string} pointId
 * @returns {boolean} true if the point can move while keeping constraints satisfiable
 */
export function pointHasRemainingDof(data, pointId) {
  if (relaxationProbeSuggestsFreedom(data, pointId)) return true
  if (newtonIncidentProbeSuggestsFreedom(data, pointId)) return true
  return false
}

/**
 * @param {object} data
 * @returns {{
 *   pointLocked: Map<string, boolean>
 *   segmentStrokeConstrained: Map<string, boolean>
 *   polygonFullyDefined: Set<string>
 *   circleFullyDefined: Set<string>
 *   splineFullyDefined: Set<string>
 * }}
 */
export function computeSketchLockState(data) {
  const pointLocked = new Map()
  for (const p of data.points) {
    pointLocked.set(p.id, !pointHasRemainingDof(data, p.id))
  }

  const worldTied = pointsTiedToWorldDatum(data)
  const drivingSegIds = new Set()
  for (const dim of data.dimensions ?? []) {
    if (dim.type === 'distance' && dim.targets?.[0]) {
      drivingSegIds.add(dim.targets[0])
    }
  }

  const segmentStrokeConstrained = new Map()
  for (const seg of data.segments ?? []) {
    const pla = pointLocked.get(seg.a) === true
    const plb = pointLocked.get(seg.b) === true
    const hasD = drivingSegIds.has(seg.id)
    const tied = worldTied.has(seg.a) && worldTied.has(seg.b)
    const ok = pla && plb && (!hasD || tied)
    segmentStrokeConstrained.set(seg.id, ok)
  }

  const polygonFullyDefined = new Set()
  for (const poly of data.polygons ?? []) {
    const ids = poly.vertexIds ?? []
    if (ids.length < 2) continue
    const ok = ids.every((vid) => pointLocked.get(vid) === true)
    if (ok) polygonFullyDefined.add(poly.id)
  }

  const circleFullyDefined = new Set()
  for (const c of data.circles ?? []) {
    if (c.centerId) {
      if (pointLocked.get(c.centerId) === true) circleFullyDefined.add(c.id)
    } else {
      circleFullyDefined.add(c.id)
    }
  }

  const splineFullyDefined = new Set()
  for (const sp of data.splines ?? []) {
    if (!sp.closed) continue
    const ids = sp.vertexIds ?? []
    if (ids.length < 2) continue
    const ok = ids.every((vid) => pointLocked.get(vid) === true)
    if (ok) splineFullyDefined.add(sp.id)
  }

  return {
    pointLocked,
    segmentStrokeConstrained,
    polygonFullyDefined,
    circleFullyDefined,
    splineFullyDefined,
  }
}
