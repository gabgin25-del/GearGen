import { recomputeBoundArcs } from './arcPointBindings.js'
import { circleWithResolvedCenter } from './circleResolve.js'
import { projectPointOnSegment } from './hitTest.js'

/**
 * One-shot geometry adjustment when a sketch constraint is added.
 * Moves the “second” entity’s free degrees of freedom toward satisfaction.
 */

/** @returns {{ dist: number; nx: number; ny: number } | null} */
function pointLineSignedDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const L = Math.hypot(dx, dy)
  if (L < 1e-9) return null
  const nx = -dy / L
  const ny = dx / L
  const dist = (px - ax) * nx + (py - ay) * ny
  return { dist, nx, ny }
}

/** @param {{ points: { id: string; x: number; y: number }[] }} data */
function movePoint(data, id, x, y) {
  return {
    ...data,
    points: data.points.map((p) => (p.id === id ? { ...p, x, y } : p)),
  }
}

function projectPointOntoCircleWorld(px, py, cx, cy, r) {
  if (r < 1e-9) return null
  const dx = px - cx
  const dy = py - cy
  const d = Math.hypot(dx, dy)
  if (d < 1e-12) return { x: cx + r, y: cy }
  const k = r / d
  return { x: cx + dx * k, y: cy + dy * k }
}

/** @param {Map<string, { x: number; y: number }>} pmap */
function closestPointOnArcSampled(px, py, arc, pmap) {
  const C = pmap.get(arc.centerId)
  const A = pmap.get(arc.startId)
  if (!C || !A) return null
  const r = Math.hypot(A.x - C.x, A.y - C.y)
  if (r < 1e-9) return null
  let best = { x: A.x, y: A.y }
  let bestD = (px - best.x) ** 2 + (py - best.y) ** 2
  for (let i = 0; i <= 32; i++) {
    const u = i / 32
    const ang = arc.a0 + u * arc.sweep
    const x = C.x + r * Math.cos(ang)
    const y = C.y + r * Math.sin(ang)
    const d = (px - x) ** 2 + (py - y) ** 2
    if (d < bestD) {
      bestD = d
      best = { x, y }
    }
  }
  return best
}

function segEndpoints(data, segId) {
  const seg = data.segments.find((s) => s.id === segId)
  if (!seg) return null
  const pa = data.points.find((p) => p.id === seg.a)
  const pb = data.points.find((p) => p.id === seg.b)
  if (!pa || !pb) return null
  return { seg, pa, pb }
}

/** Segment id if `pid` is the dependent point of a midPoint constraint. */
function midPointSegmentForPoint(data, pid) {
  for (const c of data.constraints ?? []) {
    if (c.type !== 'midPoint') continue
    const t = c.targets ?? []
    if (t.length !== 2) continue
    if (t[0].kind === 'point' && t[0].id === pid && t[1].kind === 'segment') {
      return t[1].id
    }
    if (t[1].kind === 'point' && t[1].id === pid && t[0].kind === 'segment') {
      return t[0].id
    }
  }
  return null
}

/** Point id constrained as midpoint of `segId`, if any. */
function midPointPointForSegment(data, segId) {
  for (const c of data.constraints ?? []) {
    if (c.type !== 'midPoint') continue
    const t = c.targets ?? []
    if (t.length !== 2) continue
    if (t[1].kind === 'segment' && t[1].id === segId && t[0].kind === 'point') {
      return t[0].id
    }
    if (t[0].kind === 'segment' && t[0].id === segId && t[1].kind === 'point') {
      return t[1].id
    }
  }
  return null
}

/** Translate segment endpoints and sync the linked midPoint sketch point, if present. */
function translateSegmentEndpointsIncludingMid(data, segId, dx, dy) {
  const ep = segEndpoints(data, segId)
  if (!ep) return data
  let d = movePoint(data, ep.seg.a, ep.pa.x + dx, ep.pa.y + dy)
  d = movePoint(d, ep.seg.b, ep.pb.x + dx, ep.pb.y + dy)
  const mpid = midPointPointForSegment(d, segId)
  if (mpid) {
    const ep2 = segEndpoints(d, segId)
    if (ep2) {
      d = movePoint(
        d,
        mpid,
        (ep2.pa.x + ep2.pb.x) / 2,
        (ep2.pa.y + ep2.pb.y) / 2,
      )
    }
  }
  return d
}

function len(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay)
}

function norm(dx, dy) {
  const L = Math.hypot(dx, dy)
  if (L < 1e-9) return null
  return { x: dx / L, y: dy / L }
}

/** @param {{ seg: { a: string; b: string } }} e0 @param {{ seg: { a: string; b: string } }} e1 */
function sharedSegmentVertex(e0, e1) {
  const a0 = e0.seg.a
  const b0 = e0.seg.b
  const a1 = e1.seg.a
  const b1 = e1.seg.b
  if (a0 === a1) return { shared: a0, o0: b0, o1: b1 }
  if (a0 === b1) return { shared: a0, o0: b0, o1: a1 }
  if (b0 === a1) return { shared: b0, o0: a0, o1: b1 }
  if (b0 === b1) return { shared: b0, o0: a0, o1: a1 }
  return null
}

/** Reflect P across the infinite line through A–B. */
function reflectPointAcrossLine(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const L = Math.hypot(dx, dy)
  if (L < 1e-9) return null
  const ux = dx / L
  const uy = dy / L
  const vx = px - ax
  const vy = py - ay
  const proj = vx * ux + vy * uy
  const qx = ax + proj * ux
  const qy = ay + proj * uy
  return { x: 2 * qx - px, y: 2 * qy - py }
}

function moveCircleCenterTo(data, circleId, cx, cy) {
  const c = data.circles.find((x) => x.id === circleId)
  if (!c) return data
  if (c.centerId) {
    return movePoint(data, c.centerId, cx, cy)
  }
  return {
    ...data,
    circles: data.circles.map((x) =>
      x.id === circleId ? { ...x, cx, cy } : x,
    ),
  }
}

function moveCircleRadiusTo(data, circleId, r) {
  return {
    ...data,
    circles: data.circles.map((c) =>
      c.id === circleId ? { ...c, r } : c,
    ),
  }
}

/**
 * @param {object} data workspace snapshot (points, segments, circles, …)
 * @param {{ type: string; targets?: { kind: string; id: string }[] }} constraint
 */
export function applyConstraintEnforcement(data, constraint) {
  const t = constraint.type
  const targets = constraint.targets ?? []

  if (t === 'fixOrigin' && targets.length === 1 && targets[0].kind === 'point') {
    return recomputeBoundArcs(movePoint(data, targets[0].id, 0, 0))
  }

  if (t === 'coincident' && targets.length === 2) {
    const [a, b] = targets
    if (a.kind === 'point' && b.kind === 'point') {
      const pa = data.points.find((p) => p.id === a.id)
      const pb = data.points.find((p) => p.id === b.id)
      if (!pa || !pb) return recomputeBoundArcs(data)
      return recomputeBoundArcs(movePoint(data, b.id, pa.x, pa.y))
    }
    if (a.kind === 'point' && b.kind === 'segment') {
      const ep = segEndpoints(data, b.id)
      const p = data.points.find((q) => q.id === a.id)
      if (!ep || !p) return recomputeBoundArcs(data)
      const q = projectPointOnSegment(p.x, p.y, ep.pa.x, ep.pa.y, ep.pb.x, ep.pb.y)
      return recomputeBoundArcs(movePoint(data, a.id, q.x, q.y))
    }
    if (a.kind === 'segment' && b.kind === 'point') {
      const ep = segEndpoints(data, a.id)
      const p = data.points.find((q) => q.id === b.id)
      if (!ep || !p) return recomputeBoundArcs(data)
      const q = projectPointOnSegment(p.x, p.y, ep.pa.x, ep.pa.y, ep.pb.x, ep.pb.y)
      return recomputeBoundArcs(movePoint(data, b.id, q.x, q.y))
    }
    if (a.kind === 'point' && b.kind === 'circle') {
      const pmap = new Map(data.points.map((q) => [q.id, q]))
      const p = pmap.get(a.id)
      const c = data.circles?.find((x) => x.id === b.id)
      if (!p || !c) return recomputeBoundArcs(data)
      const rc = circleWithResolvedCenter(c, pmap)
      const q = projectPointOntoCircleWorld(p.x, p.y, rc.cx, rc.cy, rc.r)
      if (!q) return recomputeBoundArcs(data)
      return recomputeBoundArcs(movePoint(data, a.id, q.x, q.y))
    }
    if (a.kind === 'circle' && b.kind === 'point') {
      const pmap = new Map(data.points.map((q) => [q.id, q]))
      const p = pmap.get(b.id)
      const c = data.circles?.find((x) => x.id === a.id)
      if (!p || !c) return recomputeBoundArcs(data)
      const rc = circleWithResolvedCenter(c, pmap)
      const q = projectPointOntoCircleWorld(p.x, p.y, rc.cx, rc.cy, rc.r)
      if (!q) return recomputeBoundArcs(data)
      return recomputeBoundArcs(movePoint(data, b.id, q.x, q.y))
    }
    if (a.kind === 'point' && b.kind === 'arc') {
      const pmap = new Map(data.points.map((q) => [q.id, q]))
      const p = pmap.get(a.id)
      const arc = data.arcs?.find((x) => x.id === b.id)
      if (!p || !arc) return recomputeBoundArcs(data)
      const q = closestPointOnArcSampled(p.x, p.y, arc, pmap)
      if (!q) return recomputeBoundArcs(data)
      return recomputeBoundArcs(movePoint(data, a.id, q.x, q.y))
    }
    if (a.kind === 'arc' && b.kind === 'point') {
      const pmap = new Map(data.points.map((q) => [q.id, q]))
      const p = pmap.get(b.id)
      const arc = data.arcs?.find((x) => x.id === a.id)
      if (!p || !arc) return recomputeBoundArcs(data)
      const q = closestPointOnArcSampled(p.x, p.y, arc, pmap)
      if (!q) return recomputeBoundArcs(data)
      return recomputeBoundArcs(movePoint(data, b.id, q.x, q.y))
    }
    return recomputeBoundArcs(data)
  }

  if (
    t === 'pointOnSegment' &&
    targets.length === 2 &&
    targets[0].kind === 'point' &&
    targets[1].kind === 'segment'
  ) {
    const pid = targets[0].id
    const ep = segEndpoints(data, targets[1].id)
    if (!ep) return recomputeBoundArcs(data)
    const pCur = data.points.find((p) => p.id === pid)
    if (!pCur) return recomputeBoundArcs(data)
    const q = projectPointOnSegment(
      pCur.x,
      pCur.y,
      ep.pa.x,
      ep.pa.y,
      ep.pb.x,
      ep.pb.y,
    )
    return recomputeBoundArcs(movePoint(data, pid, q.x, q.y))
  }

  if (
    t === 'midPoint' &&
    targets.length === 2 &&
    targets[0].kind === 'point' &&
    targets[1].kind === 'segment'
  ) {
    const pid = targets[0].id
    const ep = segEndpoints(data, targets[1].id)
    if (!ep) return recomputeBoundArcs(data)
    const mx = (ep.pa.x + ep.pb.x) / 2
    const my = (ep.pa.y + ep.pb.y) / 2
    return recomputeBoundArcs(movePoint(data, pid, mx, my))
  }

  if (
    t === 'anchorAt' &&
    targets.length === 1 &&
    targets[0].kind === 'point' &&
    constraint.x != null &&
    constraint.y != null
  ) {
    return recomputeBoundArcs(
      movePoint(data, targets[0].id, constraint.x, constraint.y),
    )
  }

  if (
    t === 'lockCoordX' &&
    targets.length === 1 &&
    targets[0].kind === 'point' &&
    constraint.value != null &&
    Number.isFinite(constraint.value)
  ) {
    const p = data.points.find((q) => q.id === targets[0].id)
    if (!p) return recomputeBoundArcs(data)
    return recomputeBoundArcs(
      movePoint(data, targets[0].id, constraint.value, p.y),
    )
  }

  if (
    t === 'lockCoordY' &&
    targets.length === 1 &&
    targets[0].kind === 'point' &&
    constraint.value != null &&
    Number.isFinite(constraint.value)
  ) {
    const p = data.points.find((q) => q.id === targets[0].id)
    if (!p) return recomputeBoundArcs(data)
    return recomputeBoundArcs(
      movePoint(data, targets[0].id, p.x, constraint.value),
    )
  }

  if (t === 'horizontal' && targets.length >= 2 && targets[0].kind === 'point') {
    let d = data
    const y0 = d.points.find((p) => p.id === targets[0].id)?.y
    if (y0 == null || !Number.isFinite(y0)) return recomputeBoundArcs(d)
    for (let i = 1; i < targets.length; i++) {
      const pid = targets[i].id
      const p = d.points.find((q) => q.id === pid)
      if (!p) continue
      const segId = midPointSegmentForPoint(d, pid)
      if (segId) {
        const ep = segEndpoints(d, segId)
        if (ep) {
          const my = (ep.pa.y + ep.pb.y) / 2
          const dy = y0 - my
          d = translateSegmentEndpointsIncludingMid(d, segId, 0, dy)
        }
      } else {
        d = movePoint(d, pid, p.x, y0)
      }
    }
    return recomputeBoundArcs(d)
  }

  if (t === 'vertical' && targets.length >= 2 && targets[0].kind === 'point') {
    let d = data
    const x0 = d.points.find((p) => p.id === targets[0].id)?.x
    if (x0 == null || !Number.isFinite(x0)) return recomputeBoundArcs(d)
    for (let i = 1; i < targets.length; i++) {
      const pid = targets[i].id
      const p = d.points.find((q) => q.id === pid)
      if (!p) continue
      const segId = midPointSegmentForPoint(d, pid)
      if (segId) {
        const ep = segEndpoints(d, segId)
        if (ep) {
          const mx = (ep.pa.x + ep.pb.x) / 2
          const dx = x0 - mx
          d = translateSegmentEndpointsIncludingMid(d, segId, dx, 0)
        }
      } else {
        d = movePoint(d, pid, x0, p.y)
      }
    }
    return recomputeBoundArcs(d)
  }

  if (t === 'horizontal' && targets.length === 1 && targets[0].kind === 'segment') {
    const ep = segEndpoints(data, targets[0].id)
    if (!ep) return recomputeBoundArcs(data)
    return recomputeBoundArcs(
      movePoint(data, ep.seg.b, ep.pb.x, ep.pa.y),
    )
  }

  if (t === 'vertical' && targets.length === 1 && targets[0].kind === 'segment') {
    const ep = segEndpoints(data, targets[0].id)
    if (!ep) return recomputeBoundArcs(data)
    return recomputeBoundArcs(
      movePoint(data, ep.seg.b, ep.pa.x, ep.pb.y),
    )
  }

  if (
    t === 'equal' &&
    targets.length === 2 &&
    targets[0].kind === 'circle' &&
    targets[1].kind === 'circle'
  ) {
    const c0 = data.circles.find((c) => c.id === targets[0].id)
    const c1 = data.circles.find((c) => c.id === targets[1].id)
    if (!c0 || !c1) return recomputeBoundArcs(data)
    const ptMap = new Map(data.points.map((p) => [p.id, p]))
    const r0 = circleWithResolvedCenter(c0, ptMap).r
    return recomputeBoundArcs(
      moveCircleRadiusTo(data, c1.id, r0),
    )
  }

  if (
    t === 'equal' &&
    targets.length === 2 &&
    targets[0].kind === 'segment' &&
    targets[1].kind === 'segment'
  ) {
    const e0 = segEndpoints(data, targets[0].id)
    const e1 = segEndpoints(data, targets[1].id)
    if (!e0 || !e1) return recomputeBoundArcs(data)
    const L = len(e0.pa.x, e0.pa.y, e0.pb.x, e0.pb.y)
    if (L < 1e-6) return recomputeBoundArcs(data)
    const u = norm(e1.pb.x - e1.pa.x, e1.pb.y - e1.pa.y)
    if (!u) return recomputeBoundArcs(data)
    const nx = e1.pa.x + u.x * L
    const ny = e1.pa.y + u.y * L
    return recomputeBoundArcs(movePoint(data, e1.seg.b, nx, ny))
  }

  if (
    t === 'parallel' &&
    targets.length === 2 &&
    targets[0].kind === 'segment' &&
    targets[1].kind === 'segment'
  ) {
    const e0 = segEndpoints(data, targets[0].id)
    const e1 = segEndpoints(data, targets[1].id)
    if (!e0 || !e1) return recomputeBoundArcs(data)
    const ref = norm(e0.pb.x - e0.pa.x, e0.pb.y - e0.pa.y)
    if (!ref) return recomputeBoundArcs(data)
    const L1 = len(e1.pa.x, e1.pa.y, e1.pb.x, e1.pb.y)
    if (L1 < 1e-6) return recomputeBoundArcs(data)
    const v = norm(e1.pb.x - e1.pa.x, e1.pb.y - e1.pa.y)
    if (!v) return recomputeBoundArcs(data)
    const dot = v.x * ref.x + v.y * ref.y
    const sign = dot >= 0 ? 1 : -1
    const nx = e1.pa.x + ref.x * sign * L1
    const ny = e1.pa.y + ref.y * sign * L1
    return recomputeBoundArcs(movePoint(data, e1.seg.b, nx, ny))
  }

  if (
    t === 'similar' &&
    targets.length === 2 &&
    targets[0].kind === 'segment' &&
    targets[1].kind === 'segment'
  ) {
    const ratio = constraint.ratio
    if (ratio == null || !Number.isFinite(ratio)) return recomputeBoundArcs(data)
    const e0 = segEndpoints(data, targets[0].id)
    const e1 = segEndpoints(data, targets[1].id)
    if (!e0 || !e1) return recomputeBoundArcs(data)
    const L0 = len(e0.pa.x, e0.pa.y, e0.pb.x, e0.pb.y)
    if (L0 < 1e-6) return recomputeBoundArcs(data)
    const ref = norm(e0.pb.x - e0.pa.x, e0.pb.y - e0.pa.y)
    if (!ref) return recomputeBoundArcs(data)
    const L1 = len(e1.pa.x, e1.pa.y, e1.pb.x, e1.pb.y)
    if (L1 < 1e-6) return recomputeBoundArcs(data)
    const v = norm(e1.pb.x - e1.pa.x, e1.pb.y - e1.pa.y)
    if (!v) return recomputeBoundArcs(data)
    const dot = v.x * ref.x + v.y * ref.y
    const sign = dot >= 0 ? 1 : -1
    const Lwant = ratio * L0
    const nx = e1.pa.x + ref.x * sign * Lwant
    const ny = e1.pa.y + ref.y * sign * Lwant
    return recomputeBoundArcs(movePoint(data, e1.seg.b, nx, ny))
  }

  if (
    t === 'perpendicular' &&
    targets.length === 2 &&
    targets[0].kind === 'segment' &&
    targets[1].kind === 'segment'
  ) {
    const e0 = segEndpoints(data, targets[0].id)
    const e1 = segEndpoints(data, targets[1].id)
    if (!e0 || !e1) return recomputeBoundArcs(data)
    const ref = norm(e0.pb.x - e0.pa.x, e0.pb.y - e0.pa.y)
    if (!ref) return recomputeBoundArcs(data)
    const perp = { x: -ref.y, y: ref.x }
    const L1 = len(e1.pa.x, e1.pa.y, e1.pb.x, e1.pb.y)
    if (L1 < 1e-6) return recomputeBoundArcs(data)
    const v = norm(e1.pb.x - e1.pa.x, e1.pb.y - e1.pa.y)
    if (!v) return recomputeBoundArcs(data)
    const dot = v.x * perp.x + v.y * perp.y
    const sign = dot >= 0 ? 1 : -1
    const nx = e1.pa.x + perp.x * sign * L1
    const ny = e1.pa.y + perp.y * sign * L1
    return recomputeBoundArcs(movePoint(data, e1.seg.b, nx, ny))
  }

  if (
    t === 'concentric' &&
    targets.length === 2 &&
    targets[0].kind === 'circle' &&
    targets[1].kind === 'circle'
  ) {
    const c0 = data.circles.find((c) => c.id === targets[0].id)
    const c1 = data.circles.find((c) => c.id === targets[1].id)
    if (!c0 || !c1) return recomputeBoundArcs(data)
    const ptMap = new Map(data.points.map((p) => [p.id, p]))
    const p0 = c0.centerId ? ptMap.get(c0.centerId) : null
    const cx = p0 ? p0.x : c0.cx ?? 0
    const cy = p0 ? p0.y : c0.cy ?? 0
    return recomputeBoundArcs(moveCircleCenterTo(data, c1.id, cx, cy))
  }

  if (
    t === 'tangent' &&
    targets.length === 2 &&
    targets[0].kind === 'segment' &&
    targets[1].kind === 'circle'
  ) {
    const e0 = segEndpoints(data, targets[0].id)
    const c = data.circles.find((x) => x.id === targets[1].id)
    if (!e0 || !c) return recomputeBoundArcs(data)
    const ptMap = new Map(data.points.map((p) => [p.id, p]))
    const pC = c.centerId ? ptMap.get(c.centerId) : null
    const cx = pC ? pC.x : c.cx ?? 0
    const cy = pC ? pC.y : c.cy ?? 0
    const pr = pointLineSignedDist(cx, cy, e0.pa.x, e0.pa.y, e0.pb.x, e0.pb.y)
    if (!pr) return recomputeBoundArcs(data)
    const { dist, nx, ny } = pr
    const r = c.r
    const sign = Math.abs(dist) < 1e-9 ? 1 : Math.sign(dist)
    const targetDist = sign * r
    const ncx = cx + nx * (targetDist - dist)
    const ncy = cy + ny * (targetDist - dist)
    return recomputeBoundArcs(moveCircleCenterTo(data, c.id, ncx, ncy))
  }

  if (
    t === 'tangent' &&
    targets.length === 2 &&
    targets[0].kind === 'segment' &&
    targets[1].kind === 'arc'
  ) {
    const e0 = segEndpoints(data, targets[0].id)
    const arc = data.arcs?.find((x) => x.id === targets[1].id)
    if (!e0 || !arc?.centerId) return recomputeBoundArcs(data)
    const ptMap = new Map(data.points.map((p) => [p.id, p]))
    const pC = ptMap.get(arc.centerId)
    const pA = arc.startId ? ptMap.get(arc.startId) : null
    if (!pC || !pA) return recomputeBoundArcs(data)
    const r = Math.hypot(pA.x - pC.x, pA.y - pC.y)
    if (r < 1e-9) return recomputeBoundArcs(data)
    const pr = pointLineSignedDist(
      pC.x,
      pC.y,
      e0.pa.x,
      e0.pa.y,
      e0.pb.x,
      e0.pb.y,
    )
    if (!pr) return recomputeBoundArcs(data)
    const { dist, nx, ny } = pr
    const sign = Math.abs(dist) < 1e-9 ? 1 : Math.sign(dist)
    const targetDist = sign * r
    const ncx = pC.x + nx * (targetDist - dist)
    const ncy = pC.y + ny * (targetDist - dist)
    return recomputeBoundArcs(movePoint(data, arc.centerId, ncx, ncy))
  }

  if (
    t === 'tangent' &&
    targets.length === 2 &&
    targets[0].kind === 'circle' &&
    targets[1].kind === 'circle'
  ) {
    const c0 = data.circles.find((x) => x.id === targets[0].id)
    const c1 = data.circles.find((x) => x.id === targets[1].id)
    if (!c0 || !c1) return recomputeBoundArcs(data)
    const ptMap = new Map(data.points.map((p) => [p.id, p]))
    const r0 = circleWithResolvedCenter(c0, ptMap).r
    const r1 = circleWithResolvedCenter(c1, ptMap).r
    const p0 = c0.centerId ? ptMap.get(c0.centerId) : null
    const p1 = c1.centerId ? ptMap.get(c1.centerId) : null
    const x0 = p0 ? p0.x : c0.cx ?? 0
    const y0 = p0 ? p0.y : c0.cy ?? 0
    const x1 = p1 ? p1.x : c1.cx ?? 0
    const y1 = p1 ? p1.y : c1.cy ?? 0
    const dx = x1 - x0
    const dy = y1 - y0
    const d = Math.hypot(dx, dy)
    if (d < 1e-9) return recomputeBoundArcs(data)
    const ux = dx / d
    const uy = dy / d
    const internal = constraint.circleTangentMode === 'internal'
    const want = internal ? Math.abs(r0 - r1) : r0 + r1
    const ncx = x0 + ux * want
    const ncy = y0 + uy * want
    return recomputeBoundArcs(moveCircleCenterTo(data, c1.id, ncx, ncy))
  }

  if (
    t === 'collinear' &&
    targets.length === 2 &&
    targets[0].kind === 'segment' &&
    targets[1].kind === 'segment'
  ) {
    const seg0 = data.segments.find((s) => s.id === targets[0].id)
    const seg1 = data.segments.find((s) => s.id === targets[1].id)
    if (!seg0 || !seg1) return recomputeBoundArcs(data)
    let d = applyConstraintEnforcement(data, {
      type: 'parallel',
      targets: [
        { kind: 'segment', id: seg0.id },
        { kind: 'segment', id: seg1.id },
      ],
    })
    d = applyConstraintEnforcement(d, {
      type: 'pointOnSegment',
      targets: [
        { kind: 'point', id: seg1.a },
        { kind: 'segment', id: seg0.id },
      ],
    })
    return d
  }

  if (
    t === 'tangent' &&
    targets.length === 2 &&
    targets[0].kind === 'segment' &&
    targets[1].kind === 'segment'
  ) {
    const e0 = segEndpoints(data, targets[0].id)
    const e1 = segEndpoints(data, targets[1].id)
    if (!e0 || !e1) return recomputeBoundArcs(data)
    const sh = sharedSegmentVertex(e0, e1)
    if (!sh) return recomputeBoundArcs(data)
    const ptMap = new Map(data.points.map((p) => [p.id, p]))
    const P = ptMap.get(sh.shared)
    const A = ptMap.get(sh.o0)
    const B = ptMap.get(sh.o1)
    if (!P || !A || !B) return recomputeBoundArcs(data)
    const ref = norm(A.x - P.x, A.y - P.y)
    if (!ref) return recomputeBoundArcs(data)
    const L1 = len(P.x, P.y, B.x, B.y)
    if (L1 < 1e-6) return recomputeBoundArcs(data)
    const bx = B.x - P.x
    const by = B.y - P.y
    const dot = bx * ref.x + by * ref.y
    const sign = dot >= 0 ? 1 : -1
    const nx = P.x + ref.x * sign * L1
    const ny = P.y + ref.y * sign * L1
    return recomputeBoundArcs(movePoint(data, sh.o1, nx, ny))
  }

  if (
    t === 'symmetric' &&
    targets.length === 2 &&
    targets[0].kind === 'segment' &&
    targets[1].kind === 'segment'
  ) {
    const e0 = segEndpoints(data, targets[0].id)
    const e1 = segEndpoints(data, targets[1].id)
    if (!e0 || !e1) return recomputeBoundArcs(data)
    const refPt = reflectPointAcrossLine(
      e1.pb.x,
      e1.pb.y,
      e0.pa.x,
      e0.pa.y,
      e0.pb.x,
      e0.pb.y,
    )
    if (!refPt) return recomputeBoundArcs(data)
    return recomputeBoundArcs(movePoint(data, e1.seg.b, refPt.x, refPt.y))
  }

  return recomputeBoundArcs(data)
}
