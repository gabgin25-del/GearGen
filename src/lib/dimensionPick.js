import { hitCircle } from './hitTest.js'
import { findNearestSegmentHit } from './hitTest.js'
import {
  parallelLinesMeasure,
  pointPointMeasure,
  pointToLineMeasure,
} from './dimensionGeometry.js'
import { circleWithResolvedCenter } from './circleResolve.js'

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
 */
export function radiusDimensionDraftFromCircle(pick, data) {
  if (pick.kind !== 'circle') return null
  const circ = data.circles.find((c) => c.id === pick.id)
  if (!circ) return null
  const pmap = new Map((data.points ?? []).map((p) => [p.id, p]))
  const rc = circleWithResolvedCenter(circ, pmap)
  if (rc.r < 1e-9) return null
  return {
    dimType: 'radius',
    targets: [circ.id],
    value: rc.r,
    cx: rc.cx,
    cy: rc.cy,
    r: rc.r,
  }
}
