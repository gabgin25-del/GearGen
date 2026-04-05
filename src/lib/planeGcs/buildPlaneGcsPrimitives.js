/**
 * Maps GearGen workspace → PlaneGCS sketch primitives (points, lines, circles, constraints).
 * Unsupported relations defer to the legacy solver (return null).
 */

import { circleWithResolvedCenter } from '../circleResolve.js'
import { inferDistanceKind } from '../dimensionGeometry.js'

/**
 * Whole-sketch fallback to legacy Gauss–Newton when PlaneGCS mapping is incomplete.
 */
function workspaceRequiresLegacySolver(data) {
  for (const c of data.constraints ?? []) {
    if (c.type === 'similar' || c.type === 'symmetric') return true
    if (c.type === 'tangent') {
      const t = c.targets ?? []
      if (
        t.length === 2 &&
        t[0]?.kind === 'segment' &&
        t[1]?.kind === 'segment'
      ) {
        return true
      }
    }
  }
  return false
}

/** @param {string} segId */
export function linePrimitiveId(segId) {
  return `ln:${segId}`
}

/** @param {string} circleId */
export function circlePrimitiveId(circleId) {
  return `ci:${circleId}`
}

/**
 * @param {object} data workspace
 * @returns {object[] | null} primitives + params, or null to use legacy solver
 */
export function buildPlaneGcsPrimitives(data) {
  if (workspaceRequiresLegacySolver(data)) return null
  const constraints = data.constraints ?? []

  const points = data.points ?? []
  const segments = data.segments ?? []
  const circles = data.circles ?? []
  const dimensions = data.dimensions ?? []

  const pmap = new Map(points.map((p) => [p.id, p]))
  const fixedPoint = new Set()

  for (const c of constraints) {
    const t = c.targets ?? []
    if (c.type === 'fixOrigin' && t[0]?.kind === 'point') {
      fixedPoint.add(t[0].id)
    }
  }

  /** @type {object[]} */
  const out = []

  for (const dim of dimensions) {
    const pname = `dim_${dim.id}`
    if (dim.type === 'distance' && (dim.targets?.length ?? 0) > 0) {
      const v = dim.value
      if (v != null && Number.isFinite(v) && v > 0) {
        out.push({ type: 'param', name: pname, value: v })
      }
    } else if (dim.type === 'radius' && dim.targets?.[0]) {
      const v = dim.value
      if (v != null && Number.isFinite(v) && v > 0) {
        out.push({ type: 'param', name: pname, value: v })
      }
    } else if (dim.type === 'diameter' && dim.targets?.[0]) {
      const v = dim.value
      if (v != null && Number.isFinite(v) && v > 0) {
        out.push({ type: 'param', name: pname, value: v })
      }
    } else if (dim.type === 'angle' && dim.targets?.length >= 2) {
      const v = dim.value
      if (v != null && Number.isFinite(v)) {
        out.push({ type: 'param', name: pname, value: v })
      }
    }
  }

  for (const p of points) {
    const fixed = fixedPoint.has(p.id)
    out.push({
      id: p.id,
      type: 'point',
      x: p.x,
      y: p.y,
      fixed,
    })
  }

  for (const s of segments) {
    if (!pmap.has(s.a) || !pmap.has(s.b)) continue
    out.push({
      id: linePrimitiveId(s.id),
      type: 'line',
      p1_id: s.a,
      p2_id: s.b,
    })
  }

  for (const circ of circles) {
    const cpt =
      circ.centerId && pmap.get(circ.centerId)
        ? circ.centerId
        : null
    if (!cpt) continue
    const rc = circleWithResolvedCenter(circ, pmap)
    out.push({
      id: circlePrimitiveId(circ.id),
      type: 'circle',
      c_id: cpt,
      radius: rc.r,
    })
  }

  let ctag = 0
  const nextCid = (prefix) => `${prefix}_${++ctag}`

  for (const c of constraints) {
    const t = c.targets ?? []

    if (c.type === 'fixOrigin' && t.length === 1 && t[0].kind === 'point') {
      const pid = t[0].id
      out.push({
        id: nextCid('fx'),
        type: 'coordinate_x',
        p_id: pid,
        x: 0,
        scale: 1e6,
      })
      out.push({
        id: nextCid('fy'),
        type: 'coordinate_y',
        p_id: pid,
        y: 0,
        scale: 1e6,
      })
      continue
    }

    if (c.type === 'coincident' && t.length === 2) {
      if (t[0].kind === 'point' && t[1].kind === 'point') {
        out.push({
          id: nextCid('coin'),
          type: 'p2p_coincident',
          p1_id: t[0].id,
          p2_id: t[1].id,
        })
        continue
      }
      if (t[0].kind === 'point' && t[1].kind === 'segment') {
        const seg = segments.find((s) => s.id === t[1].id)
        if (!seg) continue
        out.push({
          id: nextCid('coinpl'),
          type: 'point_on_line_ppp',
          p_id: t[0].id,
          lp1_id: seg.a,
          lp2_id: seg.b,
        })
        continue
      }
      if (t[0].kind === 'segment' && t[1].kind === 'point') {
        const seg = segments.find((s) => s.id === t[0].id)
        if (!seg) continue
        out.push({
          id: nextCid('coinpl'),
          type: 'point_on_line_ppp',
          p_id: t[1].id,
          lp1_id: seg.a,
          lp2_id: seg.b,
        })
        continue
      }
    }

    if (
      c.type === 'pointOnSegment' &&
      t.length === 2 &&
      t[0].kind === 'point' &&
      t[1].kind === 'segment'
    ) {
      const seg = segments.find((s) => s.id === t[1].id)
      if (!seg) continue
      out.push({
        id: nextCid('pol'),
        type: 'point_on_line_ppp',
        p_id: t[0].id,
        lp1_id: seg.a,
        lp2_id: seg.b,
      })
      continue
    }

    if (
      c.type === 'anchorAt' &&
      t.length === 1 &&
      t[0].kind === 'point' &&
      c.x != null &&
      c.y != null
    ) {
      const pid = t[0].id
      out.push({
        id: nextCid('ax'),
        type: 'coordinate_x',
        p_id: pid,
        x: c.x,
        scale: 1e6,
      })
      out.push({
        id: nextCid('ay'),
        type: 'coordinate_y',
        p_id: pid,
        y: c.y,
        scale: 1e6,
      })
      continue
    }

    if (
      c.type === 'lockCoordX' &&
      t.length === 1 &&
      t[0].kind === 'point' &&
      c.value != null
    ) {
      out.push({
        id: nextCid('lx'),
        type: 'coordinate_x',
        p_id: t[0].id,
        x: c.value,
        scale: 1e6,
      })
      continue
    }

    if (
      c.type === 'lockCoordY' &&
      t.length === 1 &&
      t[0].kind === 'point' &&
      c.value != null
    ) {
      out.push({
        id: nextCid('ly'),
        type: 'coordinate_y',
        p_id: t[0].id,
        y: c.value,
        scale: 1e6,
      })
      continue
    }

    if (c.type === 'horizontal' && t.length === 1 && t[0].kind === 'segment') {
      out.push({
        id: nextCid('hor'),
        type: 'horizontal_l',
        l_id: linePrimitiveId(t[0].id),
      })
      continue
    }

    if (c.type === 'vertical' && t.length === 1 && t[0].kind === 'segment') {
      out.push({
        id: nextCid('ver'),
        type: 'vertical_l',
        l_id: linePrimitiveId(t[0].id),
      })
      continue
    }

    if (
      c.type === 'parallel' &&
      t.length === 2 &&
      t[0].kind === 'segment' &&
      t[1].kind === 'segment'
    ) {
      out.push({
        id: nextCid('par'),
        type: 'parallel',
        l1_id: linePrimitiveId(t[0].id),
        l2_id: linePrimitiveId(t[1].id),
      })
      continue
    }

    if (
      c.type === 'perpendicular' &&
      t.length === 2 &&
      t[0].kind === 'segment' &&
      t[1].kind === 'segment'
    ) {
      out.push({
        id: nextCid('perp'),
        type: 'perpendicular_ll',
        l1_id: linePrimitiveId(t[0].id),
        l2_id: linePrimitiveId(t[1].id),
      })
      continue
    }

    if (c.type === 'equal' && t.length === 2) {
      if (t[0].kind === 'segment' && t[1].kind === 'segment') {
        out.push({
          id: nextCid('eq'),
          type: 'equal_length',
          l1_id: linePrimitiveId(t[0].id),
          l2_id: linePrimitiveId(t[1].id),
        })
        continue
      }
      if (t[0].kind === 'circle' && t[1].kind === 'circle') {
        out.push({
          id: nextCid('eqr'),
          type: 'equal_radius_cc',
          c1_id: circlePrimitiveId(t[0].id),
          c2_id: circlePrimitiveId(t[1].id),
        })
        continue
      }
    }

    if (
      c.type === 'collinear' &&
      t.length === 2 &&
      t[0].kind === 'segment' &&
      t[1].kind === 'segment'
    ) {
      const s0 = segments.find((s) => s.id === t[0].id)
      const s1 = segments.find((s) => s.id === t[1].id)
      if (!s0 || !s1) continue
      out.push({
        id: nextCid('coll_p'),
        type: 'parallel',
        l1_id: linePrimitiveId(t[0].id),
        l2_id: linePrimitiveId(t[1].id),
      })
      out.push({
        id: nextCid('coll_on'),
        type: 'point_on_line_ppp',
        p_id: s1.a,
        lp1_id: s0.a,
        lp2_id: s0.b,
      })
      continue
    }

    if (
      c.type === 'tangent' &&
      t.length === 2 &&
      t[0].kind === 'segment' &&
      t[1].kind === 'circle'
    ) {
      out.push({
        id: nextCid('tan_lc'),
        type: 'tangent_lc',
        l_id: linePrimitiveId(t[0].id),
        c_id: circlePrimitiveId(t[1].id),
      })
      continue
    }

    if (
      c.type === 'tangent' &&
      t.length === 2 &&
      t[0].kind === 'circle' &&
      t[1].kind === 'circle'
    ) {
      out.push({
        id: nextCid('tan_cc'),
        type: 'tangent_cc',
        c1_id: circlePrimitiveId(t[0].id),
        c2_id: circlePrimitiveId(t[1].id),
      })
      continue
    }

    if (
      c.type === 'concentric' &&
      t.length === 2 &&
      t[0].kind === 'circle' &&
      t[1].kind === 'circle'
    ) {
      const c0 = circles.find((x) => x.id === t[0].id)
      const c1 = circles.find((x) => x.id === t[1].id)
      if (!c0?.centerId || !c1?.centerId) continue
      out.push({
        id: nextCid('conc'),
        type: 'p2p_coincident',
        p1_id: c0.centerId,
        p2_id: c1.centerId,
      })
      continue
    }
  }

  for (const dim of dimensions) {
    const pname = `dim_${dim.id}`
    if (dim.type === 'distance') {
      const v = dim.value
      if (v == null || !Number.isFinite(v) || v <= 0) continue
      const t = dim.targets ?? []
      const dk = inferDistanceKind(dim)

      if (dk === 'pointPoint' && t.length === 2) {
        const p1 = t[0]
        const p2 = t[1]
        if (typeof p1 !== 'string' || typeof p2 !== 'string') continue
        out.push({
          id: nextCid('dpp'),
          type: 'p2p_distance',
          p1_id: p1,
          p2_id: p2,
          distance: pname,
          driving: true,
        })
        continue
      }

      if (dk === 'pointLine' && t.length === 2) {
        let pid
        let segId
        if (t[0]?.kind === 'point' && t[1]?.kind === 'segment') {
          pid = t[0].id
          segId = t[1].id
        } else if (t[0]?.kind === 'segment' && t[1]?.kind === 'point') {
          pid = t[1].id
          segId = t[0].id
        } else continue
        const seg = segments.find((s) => s.id === segId)
        if (!seg) continue
        out.push({
          id: nextCid('dp2l'),
          type: 'p2l_distance',
          p_id: pid,
          l_id: linePrimitiveId(segId),
          distance: pname,
          driving: true,
        })
        continue
      }

      if (
        dk === 'parallelLines' &&
        t.length === 2 &&
        t[0]?.kind === 'segment' &&
        t[1]?.kind === 'segment'
      ) {
        const s0 = segments.find((s) => s.id === t[0].id)
        const s1 = segments.find((s) => s.id === t[1].id)
        if (!s0 || !s1) continue
        out.push({
          id: nextCid('dpl'),
          type: 'p2l_distance',
          p_id: s0.a,
          l_id: linePrimitiveId(s1.id),
          distance: pname,
          driving: true,
        })
        continue
      }

      if (dk === 'segment' && typeof t[0] === 'string') {
        const seg = segments.find((s) => s.id === t[0])
        if (!seg) continue
        out.push({
          id: nextCid('dlen'),
          type: 'p2p_distance',
          p1_id: seg.a,
          p2_id: seg.b,
          distance: pname,
          driving: true,
        })
        continue
      }
    }
    if (dim.type === 'radius' && dim.targets?.[0]) {
      const cid = circlePrimitiveId(dim.targets[0])
      const v = dim.value
      if (v == null || !Number.isFinite(v) || v <= 0) continue
      out.push({
        id: nextCid('drad'),
        type: 'circle_radius',
        c_id: cid,
        radius: pname,
        driving: true,
      })
      continue
    }
    if (dim.type === 'diameter' && dim.targets?.[0]) {
      const cid = circlePrimitiveId(dim.targets[0])
      const v = dim.value
      if (v == null || !Number.isFinite(v) || v <= 0) continue
      out.push({
        id: nextCid('ddia'),
        type: 'circle_diameter',
        c_id: cid,
        diameter: pname,
        driving: true,
      })
      continue
    }
    if (
      dim.type === 'angle' &&
      dim.targets?.length === 2 &&
      dim.targets[0]?.kind === 'segment' &&
      dim.targets[1]?.kind === 'segment'
    ) {
      const v = dim.value
      if (v == null || !Number.isFinite(v)) continue
      out.push({
        id: nextCid('dang'),
        type: 'l2l_angle_ll',
        l1_id: linePrimitiveId(dim.targets[0].id),
        l2_id: linePrimitiveId(dim.targets[1].id),
        angle: pname,
        driving: true,
      })
      continue
    }
    if (dim.type === 'angle' && dim.targets?.length === 3) {
      const [idC, idA, idB] = dim.targets
      const v = dim.value
      if (v == null || !Number.isFinite(v)) continue
      if (typeof idC !== 'string') continue
      out.push({
        id: nextCid('dang3'),
        type: 'l2l_angle_pppp',
        l1p1_id: idC,
        l1p2_id: idA,
        l2p1_id: idC,
        l2p2_id: idB,
        angle: pname,
        driving: true,
      })
    }
  }

  return out
}
