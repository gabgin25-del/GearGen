/**
 * Run PlaneGCS on a workspace clone; merge solved coordinates back.
 */

import { Algorithm, SolveStatus } from '@salusoft89/planegcs'
import { cloneWorkspaceData } from '../workspaceReducer.js'
import { recomputeBoundArcs } from '../arcPointBindings.js'
import { relaxAllConstraints } from '../sketchConstraintQuality.js'
import { circleWithResolvedCenter } from '../circleResolve.js'
import {
  buildPlaneGcsPrimitives,
  circlePrimitiveId,
  linePrimitiveId,
} from './buildPlaneGcsPrimitives.js'
import { getPlaneGcsWrapper } from './planeGcsSingleton.js'

/**
 * @param {object} data
 * @returns {object | null} solved workspace or null (caller uses legacy)
 */
export function solveWithPlaneGcs(data) {
  const w = getPlaneGcsWrapper()
  if (!w) return null
  if (!(data.points?.length > 0)) return null

  let workData = data
  let primitives = buildPlaneGcsPrimitives(workData)
  if (primitives == null) return null

  const runOnce = () => {
    w.clear_data()
    w.set_max_iterations(120)
    w.set_convergence_threshold(1e-9)
    w.push_primitives_and_params(primitives)
    return w.solve(Algorithm.DogLeg)
  }

  try {
    let status = runOnce()

    let dof = 0
    try {
      dof = w.gcs.dof()
    } catch {
      dof = -1
    }

    let okSolve =
      status === SolveStatus.Success ||
      status === SolveStatus.Converged ||
      status === SolveStatus.SuccessfulSolutionInvalid

    let overConstrained =
      (w.has_gcs_conflicting_constraints()
        ? w.get_gcs_conflicting_constraints()
        : []
      ).length > 0

    if (!okSolve || overConstrained) {
      const relaxed = relaxAllConstraints(cloneWorkspaceData(data), 48)
      const prim2 = buildPlaneGcsPrimitives(relaxed)
      if (prim2 != null) {
        primitives = prim2
        workData = relaxed
        status = runOnce()
        const c2 = w.has_gcs_conflicting_constraints()
          ? w.get_gcs_conflicting_constraints()
          : []
        const ok2 =
          status === SolveStatus.Success ||
          status === SolveStatus.Converged ||
          status === SolveStatus.SuccessfulSolutionInvalid
        if (ok2 && c2.length === 0) {
          okSolve = true
          overConstrained = false
          try {
            dof = w.gcs.dof()
          } catch {
            dof = -1
          }
        }
      }
    }

    if (!okSolve) {
      const cFail = w.has_gcs_conflicting_constraints()
        ? w.get_gcs_conflicting_constraints()
        : []
      const rFail = w.has_gcs_redundant_constraints()
        ? w.get_gcs_redundant_constraints()
        : []
      let dofFail = dof
      try {
        dofFail = w.gcs.dof()
      } catch {
        dofFail = -1
      }
      const next = cloneWorkspaceData(data)
      next.solverDiagnostics = {
        engine: 'planegcs',
        solveStatus: status,
        dof: dofFail,
        overConstrained: cFail.length > 0,
        conflictingConstraintIds: cFail,
        redundantConstraintIds: rFail,
        fullyDefined: false,
        solveFailed: true,
      }
      return next
    }

    w.apply_solution()

    const conflictingFinal = w.has_gcs_conflicting_constraints()
      ? w.get_gcs_conflicting_constraints()
      : []
    const redundantFinal = w.has_gcs_redundant_constraints()
      ? w.get_gcs_redundant_constraints()
      : []
    let dofFinal = 0
    try {
      dofFinal = w.gcs.dof()
    } catch {
      dofFinal = -1
    }
    const overConstrainedFinal = conflictingFinal.length > 0
    const partiallyRedundantFinal = w.has_gcs_partially_redundant_constraints()

    const primMap = new Map(
      w.sketch_index.get_primitives().map((p) => [p.id, p]),
    )

    let next = cloneWorkspaceData(workData)
    next.points = next.points.map((pt) => {
      const solved = primMap.get(pt.id)
      if (solved && solved.type === 'point') {
        return { ...pt, x: solved.x, y: solved.y }
      }
      return pt
    })

    const ptMap = new Map(next.points.map((p) => [p.id, p]))
    next.circles = next.circles.map((c) => {
      const gid = circlePrimitiveId(c.id)
      const g = primMap.get(gid)
      if (g && g.type === 'circle' && typeof g.radius === 'number') {
        const rc = circleWithResolvedCenter(c, ptMap)
        if (c.centerId) {
          const cen = ptMap.get(c.centerId)
          if (cen)
            return { ...c, cx: cen.x, cy: cen.y, r: g.radius }
        }
        return { ...c, r: g.radius, cx: rc.cx, cy: rc.cy }
      }
      return c
    })

    next = relaxAllConstraints(next, 24)
    next = recomputeBoundArcs(next)

    const fullyDefined =
      !overConstrainedFinal && dofFinal === 0 && !partiallyRedundantFinal

    next.solverDiagnostics = {
      engine: 'planegcs',
      solveStatus: status,
      dof: dofFinal,
      overConstrained: overConstrainedFinal,
      conflictingConstraintIds: conflictingFinal,
      redundantConstraintIds: redundantFinal,
      fullyDefined,
      solveFailed: false,
    }

    return next
  } catch (e) {
    console.warn('[PlaneGCS] solve failed:', e)
    return null
  }
}

/** For lock state / rendering: segment line id helper re-export semantics */
export { linePrimitiveId }
