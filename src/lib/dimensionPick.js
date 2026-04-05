import {
  hitArc,
  hitCircle,
  hitPolylineSamples,
  findNearestSegmentHit,
} from './hitTest.js'
import {
  parallelLinesMeasure,
  pointPointMeasure,
  pointToLineMeasure,
} from './dimensionGeometry.js'
import { circleWithResolvedCenter } from './circleResolve.js'
import { sampleSplinePolyline } from './splineMath.js'

/**
 * @param {number} ax
 * @param {number} ay
 * @param {number} bx
 * @param {number} by
 * @param {number} cx
 * @param {number} cy
 */
function circumcenter(ax, ay, bx, by, cx, cy) {
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))
  if (Math.abs(d) < 1e-14) return null
  const a2 = ax * ax + ay * ay
  const b2 = bx * bx + by * by
  const c2 = cx * cx + cy * cy
  return {
    x: (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d,
    y: (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d,
  }
}

/**
 * @param {number} wx
 * @param {number} wy
 * @param {object} data
 * @param {number} zoom
 * @returns {{ kind: string; id: string } | null}
 */
export function pickDimensionEntity(wx, wy, data, zoom) {
  const tol = Math.max(10 / zoom, 3)
  const pts = data.points ?? []
  let best = null
  let bestD = Infinity
  for (const p of pts) {
    const d = Math.hypot(p.x - wx, p.y - wy)
    if (d <= tol && d < bestD) {
      bestD = d
      best = { kind: 'point', id: p.id }
    }
  }
  if (best) return best

  const pmap = new Map(pts.map((q) => [q.id, q]))
  const hi = findNearestSegmentHit(data.segments ?? [], pmap, wx, wy, tol)
  if (hi) return { kind: 'segment', id: hi.seg.id }

  for (const a of data.arcs ?? []) {
    if (hitArc(wx, wy, a, tol)) return { kind: 'arc', id: a.id }
  }

  for (const sp of data.splines ?? []) {
    const verts = sp.vertexIds.map((id) => pmap.get(id)).filter(Boolean)
    if (verts.length < 2) continue
    const samples = sampleSplinePolyline(verts, sp.splineType, {
      tension: sp.tension ?? 0.5,
      closed: !!sp.closed,
      segmentsPerSpan: sp.segmentsPerSpan ?? 14,
    })
    if (samples.length >= 2 && hitPolylineSamples(wx, wy, samples, tol)) {
      return { kind: 'spline', id: sp.id }
    }
  }

  for (const c of data.circles ?? []) {
    if (hitCircle(wx, wy, c, pmap, tol)) {
      return { kind: 'circle', id: c.id }
    }
  }
  return null
}

/**
 * @param {{ kind: string; id: string }} p1
 * @param {{ kind: string; id: string }} p2
 * @param {object} data
 * @returns {object | null} dimension draft for commit (includes geometry for preview)
 */
export function resolveDimensionFromTwoPicks(p1, p2, data) {
  const pmap = new Map((data.points ?? []).map((p) => [p.id, p]))
  const segments = data.segments ?? []

  let a = p1
  let b = p2
  if (a.kind === 'segment' && b.kind === 'point') {
    const t = a
    a = b
    b = t
  }

  if (a.kind === 'point' && b.kind === 'point') {
    const m = pointPointMeasure(a.id, b.id, pmap)
    if (!m || m.value < 1e-9) return null
    return {
      dimType: 'distance',
      distanceKind: 'pointPoint',
      targets: [a.id, b.id],
      value: m.value,
      ax: m.ax,
      ay: m.ay,
      bx: m.bx,
      by: m.by,
    }
  }

  if (a.kind === 'point' && b.kind === 'segment') {
    const seg = segments.find((s) => s.id === b.id)
    if (!seg) return null
    const m = pointToLineMeasure(a.id, seg, pmap)
    if (!m || m.value < 1e-9) return null
    return {
      dimType: 'distance',
      distanceKind: 'pointLine',
      targets: [
        { kind: 'point', id: a.id },
        { kind: 'segment', id: b.id },
      ],
      value: m.value,
      ax: m.ax,
      ay: m.ay,
      bx: m.bx,
      by: m.by,
    }
  }

  if (a.kind === 'segment' && b.kind === 'segment') {
    const s0 = segments.find((s) => s.id === a.id)
    const s1 = segments.find((s) => s.id === b.id)
    if (!s0 || !s1) return null
    const pa0 = pmap.get(s0.a)
    const pb0 = pmap.get(s0.b)
    const pa1 = pmap.get(s1.a)
    const pb1 = pmap.get(s1.b)
    if (!pa0 || !pb0 || !pa1 || !pb1) return null
    const pl = parallelLinesMeasure(s0, s1, pmap)
    if (pl && pl.value > 1e-9) {
      return {
        dimType: 'distance',
        distanceKind: 'parallelLines',
        targets: [
          { kind: 'segment', id: s0.id },
          { kind: 'segment', id: s1.id },
        ],
        value: pl.value,
        ax: pl.ax,
        ay: pl.ay,
        bx: pl.bx,
        by: pl.by,
      }
    }
    const u0x = pb0.x - pa0.x
    const u0y = pb0.y - pa0.y
    const u1x = pb1.x - pa1.x
    const u1y = pb1.y - pa1.y
    const L0 = Math.hypot(u0x, u0y)
    const L1 = Math.hypot(u1x, u1y)
    if (L0 < 1e-9 || L1 < 1e-9) return null
    const dot = (u0x * u1x + u0y * u1y) / (L0 * L1)
    const ang = Math.acos(Math.min(1, Math.max(-1, Math.abs(dot))))
    const vx = (pa0.x + pb0.x + pa1.x + pb1.x) / 4
    const vy = (pa0.y + pb0.y + pa1.y + pb1.y) / 4
    const a0 = Math.atan2(u0y / L0, u0x / L0)
    const a1 = Math.atan2(u1y / L1, u1x / L1)
    return {
      dimType: 'angle',
      targets: [
        { kind: 'segment', id: s0.id },
        { kind: 'segment', id: s1.id },
      ],
      value: ang,
      vx,
      vy,
      a0,
      a1,
    }
  }

  if (a.kind === 'circle' && b.kind === 'circle') {
    const c0 = data.circles.find((c) => c.id === a.id)
    const c1 = data.circles.find((c) => c.id === b.id)
    if (!c0?.centerId || !c1?.centerId) return null
    const m = pointPointMeasure(c0.centerId, c1.centerId, pmap)
    if (!m || m.value < 1e-9) return null
    return {
      dimType: 'distance',
      distanceKind: 'pointPoint',
      targets: [c0.centerId, c1.centerId],
      value: m.value,
      ax: m.ax,
      ay: m.ay,
      bx: m.bx,
      by: m.by,
    }
  }

  return null
}

/**
 * @param {{ kind: string; id: string }} pick
 * @param {object} data
 * @param {number} wx
 * @param {number} wy
 */
export function diameterDimensionDraftFromCircle(pick, data, wx, wy) {
  if (pick.kind !== 'circle') return null
  const circ = data.circles.find((c) => c.id === pick.id)
  if (!circ) return null
  const pmap = new Map((data.points ?? []).map((p) => [p.id, p]))
  const rc = circleWithResolvedCenter(circ, pmap)
  if (rc.r < 1e-9) return null
  const leaderAngle = Math.atan2(wy - rc.cy, wx - rc.cx)
  return {
    dimType: 'diameter',
    targets: [circ.id],
    value: 2 * rc.r,
    cx: rc.cx,
    cy: rc.cy,
    r: rc.r,
    leaderAngle,
  }
}

/**
 * @param {{ kind: string; id: string }} pick
 * @param {object} data
 * @param {number} wx
 * @param {number} wy
 */
export function radiusDimensionDraftFromArc(pick, data, wx, wy) {
  if (pick.kind !== 'arc') return null
  const arc = data.arcs?.find((a) => a.id === pick.id)
  if (!arc) return null
  const pmap = new Map((data.points ?? []).map((p) => [p.id, p]))
  const rc = circleWithResolvedCenter(arc, pmap)
  if (rc.r < 1e-9) return null
  const leaderAngle = Math.atan2(wy - rc.cy, wx - rc.cx)
  return {
    dimType: 'radius',
    targets: [arc.id],
    value: rc.r,
    cx: rc.cx,
    cy: rc.cy,
    r: rc.r,
    leaderAngle,
  }
}

/**
 * Local osculating circle from three polyline samples (annotation; weak solver coupling).
 * @param {{ kind: string; id: string }} pick
 * @param {object} data
 * @param {number} wx
 * @param {number} wy
 */
export function splineCurvatureDimensionDraft(pick, data, wx, wy) {
  if (pick.kind !== 'spline') return null
  const sp = data.splines?.find((s) => s.id === pick.id)
  if (!sp) return null
  const pmap = new Map((data.points ?? []).map((p) => [p.id, p]))
  const verts = sp.vertexIds.map((id) => pmap.get(id)).filter(Boolean)
  if (verts.length < 3) return null
  const samples = sampleSplinePolyline(verts, sp.splineType, {
    tension: sp.tension ?? 0.5,
    closed: !!sp.closed,
    segmentsPerSpan: Math.max(24, sp.segmentsPerSpan ?? 14),
  })
  if (samples.length < 3) return null

  let bestI = 1
  let bestD = Infinity
  for (let i = 1; i < samples.length - 1; i++) {
    const q = samples[i]
    const d = Math.hypot(q.x - wx, q.y - wy)
    if (d < bestD) {
      bestD = d
      bestI = i
    }
  }
  if (bestD > 25) return null

  const p0 = samples[bestI - 1]
  const p1 = samples[bestI]
  const p2 = samples[bestI + 1]
  const cc = circumcenter(p0.x, p0.y, p1.x, p1.y, p2.x, p2.y)
  if (!cc) return null
  const R = Math.hypot(p1.x - cc.x, p1.y - cc.y)
  if (R < 1e-3 || R > 1e6) return null
  const leaderAngle = Math.atan2(wy - cc.y, wx - cc.x)
  return {
    dimType: 'radius',
    splineCurvature: true,
    targets: [sp.id],
    value: R,
    cx: cc.x,
    cy: cc.y,
    r: R,
    leaderAngle,
  }
}
