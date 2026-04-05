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

  const primitives = buildPlaneGcsPrimitives(data)
  if (primitives == null) return null

  try {
    w.clear_data()
    w.set_max_iterations(120)
    w.set_convergence_threshold(1e-9)
    w.push_primitives_and_params(primitives)
    const status = w.solve(Algorithm.DogLeg)

    const conflicting = w.has_gcs_conflicting_constraints()
      ? w.get_gcs_conflicting_constraints()
      : []
    const redundant = w.has_gcs_redundant_constraints()
      ? w.get_gcs_redundant_constraints()
      : []

    let dof = 0
    try {
      dof = w.gcs.dof()
    } catch {
      dof = -1
    }

    const okSolve =
      status === SolveStatus.Success ||
      status === SolveStatus.Converged ||
      status === SolveStatus.SuccessfulSolutionInvalid

    const overConstrained = conflicting.length > 0
    const partiallyRedundant = w.has_gcs_partially_redundant_constraints()

    if (!okSolve) {
      const next = cloneWorkspaceData(data)
      next.solverDiagnostics = {
        engine: 'planegcs',
        solveStatus: status,
        dof,
        overConstrained,
        conflictingConstraintIds: conflicting,
        redundantConstraintIds: redundant,
        fullyDefined: false,
        solveFailed: true,
      }
      return next
    }

    w.apply_solution()

    const primMap = new Map(
      w.sketch_index.get_primitives().map((p) => [p.id, p]),
    )

    let next = cloneWorkspaceData(data)
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
      !overConstrained && dof === 0 && !partiallyRedundant

    next.solverDiagnostics = {
      engine: 'planegcs',
      solveStatus: status,
      dof,
      overConstrained,
      conflictingConstraintIds: conflicting,
      redundantConstraintIds: redundant,
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
