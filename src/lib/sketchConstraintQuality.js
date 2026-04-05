import { applyConstraintEnforcement } from './constraintEnforce.js'
import { recomputeBoundArcs } from './arcPointBindings.js'
import { circleWithResolvedCenter } from './circleResolve.js'
import { distPointToSegment } from './hitTest.js'

const LEN_TOL = 1e-2
const PT_TOL = 1e-3
const ANG_TOL = 1e-3

function ptMap(data) {
  return new Map(data.points.map((p) => [p.id, p]))
}

function segEndpoints(data, segId) {
  const seg = data.segments.find((s) => s.id === segId)
  if (!seg) return null
  const m = ptMap(data)
  const pa = m.get(seg.a)
  const pb = m.get(seg.b)
  if (!pa || !pb) return null
  return { seg, pa, pb }
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

function segLen(data, segId) {
  const ep = segEndpoints(data, segId)
  if (!ep) return null
  return Math.hypot(ep.pb.x - ep.pa.x, ep.pb.y - ep.pa.y)
}

/**
 * @param {object} data
 * @param {{ type: string; targets?: { kind: string; id: string }[] }} c
 */
export function constraintSatisfied(data, c) {
  const t = c.type
  const targets = c.targets ?? []

  if (t === 'coincident' && targets.length === 2) {
    const [a, b] = targets
    const m = ptMap(data)
    if (a.kind === 'point' && b.kind === 'point') {
      const pa = m.get(a.id)
      const pb = m.get(b.id)
      if (!pa || !pb) return false
      return Math.hypot(pb.x - pa.x, pb.y - pa.y) <= PT_TOL
    }
    if (a.kind === 'point' && b.kind === 'segment') {
      const p = m.get(a.id)
      const ep = segEndpoints(data, b.id)
      if (!p || !ep) return false
      const d = distPointToSegment(
        p.x,
        p.y,
        ep.pa.x,
        ep.pa.y,
        ep.pb.x,
        ep.pb.y,
      )
      return d <= PT_TOL * 8
    }
    if (a.kind === 'segment' && b.kind === 'point') {
      const p = m.get(b.id)
      const ep = segEndpoints(data, a.id)
      if (!p || !ep) return false
      const d = distPointToSegment(
        p.x,
        p.y,
        ep.pa.x,
        ep.pa.y,
        ep.pb.x,
        ep.pb.y,
      )
      return d <= PT_TOL * 8
    }
    return true
  }

  if (
    t === 'pointOnSegment' &&
    targets.length === 2 &&
    targets[0].kind === 'point' &&
    targets[1].kind === 'segment'
  ) {
    const p = ptMap(data).get(targets[0].id)
    const ep = segEndpoints(data, targets[1].id)
    if (!p || !ep) return false
    const d = distPointToSegment(
      p.x,
      p.y,
      ep.pa.x,
      ep.pa.y,
      ep.pb.x,
      ep.pb.y,
    )
    return d <= PT_TOL * 8
  }

  if (
    t === 'anchorAt' &&
    targets.length === 1 &&
    targets[0].kind === 'point' &&
    c.x != null &&
    c.y != null
  ) {
    const p = ptMap(data).get(targets[0].id)
    if (!p) return false
    return (
      Math.abs(p.x - c.x) <= PT_TOL * 8 && Math.abs(p.y - c.y) <= PT_TOL * 8
    )
  }

  if (
    t === 'lockCoordX' &&
    targets.length === 1 &&
    targets[0].kind === 'point' &&
    c.value != null
  ) {
    const p = ptMap(data).get(targets[0].id)
    if (!p) return false
    return Math.abs(p.x - c.value) <= PT_TOL * 8
  }

  if (
    t === 'lockCoordY' &&
    targets.length === 1 &&
    targets[0].kind === 'point' &&
    c.value != null
  ) {
    const p = ptMap(data).get(targets[0].id)
    if (!p) return false
    return Math.abs(p.y - c.value) <= PT_TOL * 8
  }

  if (t === 'equal' && targets.length === 2) {
    if (targets[0].kind === 'circle' && targets[1].kind === 'circle') {
      const m = ptMap(data)
      const c0 = data.circles.find((c) => c.id === targets[0].id)
      const c1 = data.circles.find((c) => c.id === targets[1].id)
      if (!c0 || !c1) return false
      const r0 = circleWithResolvedCenter(c0, m).r
      const r1 = circleWithResolvedCenter(c1, m).r
      return Math.abs(r0 - r1) <= LEN_TOL
    }
    const L0 = segLen(data, targets[0].id)
    const L1 = segLen(data, targets[1].id)
    if (L0 == null || L1 == null) return false
    return Math.abs(L0 - L1) <= LEN_TOL
  }

  if (
    t === 'collinear' &&
    targets.length === 2 &&
    targets[0].kind === 'segment' &&
    targets[1].kind === 'segment'
  ) {
    const e0 = segEndpoints(data, targets[0].id)
    const e1 = segEndpoints(data, targets[1].id)
    if (!e0 || !e1) return false
    const dx0 = e0.pb.x - e0.pa.x
    const dy0 = e0.pb.y - e0.pa.y
    const dx1 = e1.pb.x - e1.pa.x
    const dy1 = e1.pb.y - e1.pa.y
    const L0 = Math.hypot(dx0, dy0)
    const L1 = Math.hypot(dx1, dy1)
    if (L0 < 1e-9 || L1 < 1e-9) return false
    const cross = dx0 * dy1 - dy0 * dx1
    if (Math.abs(cross) / (L0 * L1) > ANG_TOL) return false
    const p = ptMap(data).get(e1.seg.a)
    if (!p) return false
    const d = distPointToSegment(
      p.x,
      p.y,
      e0.pa.x,
      e0.pa.y,
      e0.pb.x,
      e0.pb.y,
    )
    return d <= PT_TOL * 10
  }

  if (t === 'horizontal' && targets.length >= 2 && targets[0].kind === 'point') {
    const m = ptMap(data)
    const y0 = m.get(targets[0].id)?.y
    if (y0 == null || !Number.isFinite(y0)) return false
    for (let i = 1; i < targets.length; i++) {
      const p = m.get(targets[i].id)
      if (!p || Math.abs(p.y - y0) > PT_TOL) return false
    }
    return true
  }

  if (t === 'vertical' && targets.length >= 2 && targets[0].kind === 'point') {
    const m = ptMap(data)
    const x0 = m.get(targets[0].id)?.x
    if (x0 == null || !Number.isFinite(x0)) return false
    for (let i = 1; i < targets.length; i++) {
      const p = m.get(targets[i].id)
      if (!p || Math.abs(p.x - x0) > PT_TOL) return false
    }
    return true
  }

  if (t === 'horizontal' && targets.length === 1) {
    const ep = segEndpoints(data, targets[0].id)
    if (!ep) return false
    return Math.abs(ep.pb.y - ep.pa.y) <= ANG_TOL * Math.max(1, Math.hypot(ep.pb.x - ep.pa.x, ep.pb.y - ep.pa.y))
  }

  if (t === 'vertical' && targets.length === 1) {
    const ep = segEndpoints(data, targets[0].id)
    if (!ep) return false
    return Math.abs(ep.pb.x - ep.pa.x) <= ANG_TOL * Math.max(1, Math.hypot(ep.pb.x - ep.pa.x, ep.pb.y - ep.pa.y))
  }

  if (
    t === 'concentric' &&
    targets.length === 2 &&
    targets[0].kind === 'circle' &&
    targets[1].kind === 'circle'
  ) {
    const m = ptMap(data)
    const c0 = data.circles.find((c) => c.id === targets[0].id)
    const c1 = data.circles.find((c) => c.id === targets[1].id)
    if (!c0 || !c1) return false
    const r0 = circleWithResolvedCenter(c0, m)
    const r1 = circleWithResolvedCenter(c1, m)
    return Math.hypot(r1.cx - r0.cx, r1.cy - r0.cy) <= PT_TOL
  }

  if (t === 'fixOrigin' && targets.length === 1 && targets[0].kind === 'point') {
    const p = ptMap(data).get(targets[0].id)
    if (!p) return false
    return Math.hypot(p.x, p.y) <= PT_TOL
  }

  if (
    t === 'tangent' &&
    targets.length === 2 &&
    targets[0].kind === 'segment' &&
    targets[1].kind === 'segment'
  ) {
    const e0 = segEndpoints(data, targets[0].id)
    const e1 = segEndpoints(data, targets[1].id)
    if (!e0 || !e1) return false
    const sh = sharedSegmentVertex(e0, e1)
    if (!sh) return false
    const m = ptMap(data)
    const P = m.get(sh.shared)
    const A = m.get(sh.o0)
    const B = m.get(sh.o1)
    if (!P || !A || !B) return false
    const dx0 = A.x - P.x
    const dy0 = A.y - P.y
    const dx1 = B.x - P.x
    const dy1 = B.y - P.y
    const L0 = Math.hypot(dx0, dy0)
    const L1 = Math.hypot(dx1, dy1)
    if (L0 < 1e-9 || L1 < 1e-9) return false
    const cross = dx0 * dy1 - dy0 * dx1
    return Math.abs(cross) <= ANG_TOL * L0 * L1
  }

  if (
    t === 'tangent' &&
    targets.length === 2 &&
    targets[0].kind === 'circle' &&
    targets[1].kind === 'circle'
  ) {
    const m = ptMap(data)
    const c0 = data.circles.find((x) => x.id === targets[0].id)
    const c1 = data.circles.find((x) => x.id === targets[1].id)
    if (!c0 || !c1) return false
    const rc0 = circleWithResolvedCenter(c0, m)
    const rc1 = circleWithResolvedCenter(c1, m)
    const dcent = Math.hypot(rc1.cx - rc0.cx, rc1.cy - rc0.cy)
    const internal = c.circleTangentMode === 'internal'
    const want = internal
      ? Math.abs(rc0.r - rc1.r)
      : rc0.r + rc1.r
    return Math.abs(dcent - want) <= LEN_TOL
  }

  if (
    t === 'tangent' &&
    targets.length === 2 &&
    targets[0].kind === 'segment' &&
    targets[1].kind === 'arc'
  ) {
    const ep = segEndpoints(data, targets[0].id)
    const arc = data.arcs?.find((x) => x.id === targets[1].id)
    if (!ep || !arc?.centerId) return false
    const m = ptMap(data)
    const pC = m.get(arc.centerId)
    const pA = arc.startId ? m.get(arc.startId) : null
    if (!pC || !pA) return false
    const r = Math.hypot(pA.x - pC.x, pA.y - pC.y)
    if (r < 1e-9) return false
    const dx = ep.pb.x - ep.pa.x
    const dy = ep.pb.y - ep.pa.y
    const L = Math.hypot(dx, dy)
    if (L < 1e-9) return false
    const nx = -dy / L
    const ny = dx / L
    const dist = Math.abs(
      (pC.x - ep.pa.x) * nx + (pC.y - ep.pa.y) * ny,
    )
    return Math.abs(dist - r) <= LEN_TOL
  }

  if (
    t === 'tangent' &&
    targets.length === 2 &&
    targets[0].kind === 'segment' &&
    targets[1].kind === 'circle'
  ) {
    const ep = segEndpoints(data, targets[0].id)
    const c = data.circles.find((x) => x.id === targets[1].id)
    if (!ep || !c) return false
    const m = ptMap(data)
    const rc = circleWithResolvedCenter(c, m)
    const { pa, pb } = ep
    const dx = pb.x - pa.x
    const dy = pb.y - pa.y
    const L = Math.hypot(dx, dy)
    if (L < 1e-9) return false
    const nx = -dy / L
    const ny = dx / L
    const dist = Math.abs(
      (rc.cx - pa.x) * nx + (rc.cy - pa.y) * ny,
    )
    return Math.abs(dist - c.r) <= LEN_TOL
  }

  if (
    t === 'similar' &&
    targets.length === 2 &&
    targets[0].kind === 'segment' &&
    targets[1].kind === 'segment'
  ) {
    const ratio = c.ratio
    if (ratio == null || !Number.isFinite(ratio)) return false
    const L0 = segLen(data, targets[0].id)
    const L1 = segLen(data, targets[1].id)
    if (L0 == null || L1 == null || L0 < 1e-9) return false
    const e0 = segEndpoints(data, targets[0].id)
    const e1 = segEndpoints(data, targets[1].id)
    if (!e0 || !e1) return false
    const dx0 = e0.pb.x - e0.pa.x
    const dy0 = e0.pb.y - e0.pa.y
    const dx1 = e1.pb.x - e1.pa.x
    const dy1 = e1.pb.y - e1.pa.y
    const n0 = Math.hypot(dx0, dy0)
    const n1 = Math.hypot(dx1, dy1)
    if (n0 < 1e-9 || n1 < 1e-9) return false
    const cross = dx0 * dy1 - dy0 * dx1
    const parallelOk = Math.abs(cross) / (n0 * n1) <= ANG_TOL
    const lenOk = Math.abs(L1 - ratio * L0) <= LEN_TOL * Math.max(1, L0)
    return parallelOk && lenOk
  }

  if (
    (t === 'parallel' || t === 'perpendicular') &&
    targets.length === 2
  ) {
    const e0 = segEndpoints(data, targets[0].id)
    const e1 = segEndpoints(data, targets[1].id)
    if (!e0 || !e1) return false
    const dx0 = e0.pb.x - e0.pa.x
    const dy0 = e0.pb.y - e0.pa.y
    const dx1 = e1.pb.x - e1.pa.x
    const dy1 = e1.pb.y - e1.pa.y
    const L0 = Math.hypot(dx0, dy0)
    const L1 = Math.hypot(dx1, dy1)
    if (L0 < 1e-9 || L1 < 1e-9) return false
    const cross = dx0 * dy1 - dy0 * dx1
    const dot = dx0 * dx1 + dy0 * dy1
    const n = L0 * L1
    if (t === 'parallel') return Math.abs(cross) / n <= ANG_TOL
    return Math.abs(dot) / n <= ANG_TOL
  }

  return true
}

/** @param {object} data */
export function allConstraintsSatisfied(data) {
  const cons = data.constraints ?? []
  for (const c of cons) {
    if (!constraintSatisfied(data, c)) return false
  }
  return true
}

/** @param {{ type: string; targets?: { kind: string; id: string }[] }} a @param {typeof a} b */
function sameConstraintTargets(a, b) {
  if (a.type !== b.type) return false
  const ta = a.targets ?? []
  const tb = b.targets ?? []
  if (ta.length !== tb.length) return false
  const norm = (t) => {
    if (
      (a.type === 'horizontal' || a.type === 'vertical') &&
      t.length >= 2 &&
      t.every((x) => x.kind === 'point')
    ) {
      return [...t].sort((u, v) => u.id.localeCompare(v.id))
    }
    if (
      a.type === 'coincident' &&
      t.length === 2 &&
      t[0].kind === 'segment' &&
      t[1].kind === 'point'
    ) {
      return [t[1], t[0]]
    }
    if (
      a.type === 'tangent' &&
      t.length === 2 &&
      t[0].kind === 'arc' &&
      t[1].kind === 'segment'
    ) {
      return [t[1], t[0]]
    }
    return t
  }
  const taN = norm(ta)
  const tbN = norm(tb)
  const ka = taN.map((x) => `${x.kind}:${x.id}`).sort()
  const kb = tbN.map((x) => `${x.kind}:${x.id}`).sort()
  if (!ka.every((s, i) => s === kb[i])) return false
  if (
    a.type === 'tangent' &&
    taN[0]?.kind === 'circle' &&
    taN[1]?.kind === 'circle'
  ) {
    const ma = a.circleTangentMode === 'internal' ? 'internal' : 'external'
    const mb = b.circleTangentMode === 'internal' ? 'internal' : 'external'
    if (ma !== mb) return false
  }
  if (a.type === 'similar') {
    const ra = a.ratio
    const rb = b.ratio
    if (ra == null || rb == null) return false
    return Math.abs(ra - rb) <= 1e-5
  }
  if (a.type === 'anchorAt') {
    return (
      Math.abs((a.x ?? 0) - (b.x ?? 0)) <= 1e-6 &&
      Math.abs((a.y ?? 0) - (b.y ?? 0)) <= 1e-6
    )
  }
  if (a.type === 'lockCoordX' || a.type === 'lockCoordY') {
    return Math.abs((a.value ?? 0) - (b.value ?? 0)) <= 1e-6
  }
  return true
}

/**
 * @param {object} data
 * @param {{ type: string; targets?: { kind: string; id: string }[] }} newCo
 */
export function isRedundantConstraint(data, newCo) {
  for (const c of data.constraints ?? []) {
    if (sameConstraintTargets(c, newCo)) return true
  }
  const t = newCo.type
  const targets = newCo.targets ?? []
  if (t === 'horizontal' && targets.length === 1) {
    const trial = { ...newCo, type: 'vertical' }
    for (const c of data.constraints ?? []) {
      if (sameConstraintTargets(c, trial)) return true
    }
  }
  if (t === 'vertical' && targets.length === 1) {
    const trial = { ...newCo, type: 'horizontal' }
    for (const c of data.constraints ?? []) {
      if (sameConstraintTargets(c, trial)) return true
    }
  }
  return false
}

/**
 * Re-apply every constraint in order repeatedly (weak relaxation).
 * @param {object} data
 * @param {number} passes
 */
export function relaxAllConstraints(data, passes = 10) {
  let d = data
  const cons = d.constraints ?? []
  if (cons.length === 0) return d
  for (let p = 0; p < passes; p++) {
    for (const c of cons) {
      d = applyConstraintEnforcement(d, c)
    }
    d = recomputeBoundArcs(d)
  }
  return d
}

/**
 * Try adding a constraint: duplicate check, apply + relax, satisfaction check.
 * @returns {{ ok: true, data: object } | { ok: false, reason: 'redundant' | 'overconstrained' }}
 */
export function tryCommitConstraint(data, newCo) {
  if (isRedundantConstraint(data, newCo)) {
    return { ok: false, reason: 'redundant' }
  }
  let next = {
    ...data,
    constraints: [...(data.constraints ?? []), newCo],
  }
  next = applyConstraintEnforcement(next, newCo)
  next = relaxAllConstraints(next, 12)
  if (!allConstraintsSatisfied(next)) {
    return { ok: false, reason: 'overconstrained' }
  }
  return { ok: true, data: next }
}
