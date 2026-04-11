import { phiIsOnArcSweep } from './geometryMetrics.js'
import { resolveCircleCenter } from './circleResolve.js'

/** @param {{ x: number; y: number }[]} verts */
export function pointInPolygon(wx, wy, verts) {
  if (verts.length < 3) return false
  let inside = false
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const xi = verts[i].x
    const yi = verts[i].y
    const xj = verts[j].x
    const yj = verts[j].y
    const intersect =
      yi > wy !== yj > wy &&
      wx < ((xj - xi) * (wy - yi)) / (yj - yi + 1e-12) + xi
    if (intersect) inside = !inside
  }
  return inside
}

/** Closest point on segment AB to P (clamped). */
export function projectPointOnSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax
  const aby = by - ay
  const apx = px - ax
  const apy = py - ay
  const ab2 = abx * abx + aby * aby
  if (ab2 < 1e-12) return { x: ax, y: ay, t: 0 }
  let t = (apx * abx + apy * aby) / ab2
  t = Math.max(0, Math.min(1, t))
  return {
    x: ax + t * abx,
    y: ay + t * aby,
    t,
  }
}

export function distPointToSegment(px, py, ax, ay, bx, by) {
  const q = projectPointOnSegment(px, py, ax, ay, bx, by)
  return Math.hypot(px - q.x, py - q.y)
}

/**
 * @param {number} wx
 * @param {number} wy
 * @param {{ vertexIds: string[] }} poly
 * @param {Map<string, { x: number; y: number }>} pointById
 * @param {number} tolWorld
 */
/** Filled interior only (no boundary). */
export function hitPolygonInterior(wx, wy, poly, pointById) {
  const verts = poly.vertexIds.map((id) => pointById.get(id)).filter(Boolean)
  return verts.length >= 3 && pointInPolygon(wx, wy, verts)
}

/**
 * If the cursor is on a polygon edge, return the matching segment id when possible
 * (prefer `boundarySegmentIds` so each perimeter edge is individually selectable).
 * @param {{ id: string; a: string; b: string }[]} segments
 * @returns {string | null}
 */
export function hitPolygonBoundarySegmentId(
  wx,
  wy,
  poly,
  segments,
  pointById,
  tolWorld,
) {
  const vids = poly.vertexIds ?? []
  if (vids.length < 2) return null
  const bids = poly.boundarySegmentIds
  for (let i = 0; i < vids.length; i++) {
    const a = vids[i]
    const b = vids[(i + 1) % vids.length]
    const pa = pointById.get(a)
    const pb = pointById.get(b)
    if (!pa || !pb) continue
    if (distPointToSegment(wx, wy, pa.x, pa.y, pb.x, pb.y) > tolWorld) continue
    if (bids?.length > i && bids[i]) {
      const seg = segments.find((s) => s.id === bids[i])
      if (seg) return seg.id
    }
    const seg = segments.find(
      (s) => (s.a === a && s.b === b) || (s.a === b && s.b === a),
    )
    return seg ? seg.id : null
  }
  return null
}

export function hitPolygon(wx, wy, poly, pointById, tolWorld) {
  const verts = poly.vertexIds.map((id) => pointById.get(id)).filter(Boolean)
  if (verts.length < 2) return false
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i]
    const b = verts[(i + 1) % verts.length]
    if (distPointToSegment(wx, wy, a.x, a.y, b.x, b.y) <= tolWorld) {
      return true
    }
  }
  return hitPolygonInterior(wx, wy, poly, pointById)
}

/**
 * @param {number} wx
 * @param {number} wy
 * @param {{ cx?: number; cy?: number; r: number; centerId?: string | null }} c
 * @param {Map<string, { x: number; y: number }>} pointById
 * @param {number} tolWorld
 */
export function hitCircle(wx, wy, c, pointById, tolWorld) {
  const p = resolveCircleCenter(c, pointById)
  const d = Math.hypot(wx - p.x, wy - p.y)
  if (c.r < 1e-9) return d <= tolWorld
  if (Math.abs(d - c.r) <= tolWorld) return true
  const hasFill = c.fill != null && c.fill !== ''
  if (hasFill) {
    const innerMargin = Math.min(tolWorld * 0.65, c.r * 0.04)
    if (d <= c.r - innerMargin) return true
  }
  return false
}

/**
 * @param {number} wx
 * @param {number} wy
 * @param {{ cx: number; cy: number; r: number; a0: number; sweep: number }} a
 * @param {number} tolWorld
 */
export function hitArc(wx, wy, a, tolWorld) {
  const d = Math.hypot(wx - a.cx, wy - a.cy)
  if (Math.abs(d - a.r) > tolWorld) return false
  if (Math.abs(a.sweep) < 1e-9) return false
  const phi = Math.atan2(wy - a.cy, wx - a.cx)
  const angTol = Math.max(0.045, tolWorld / Math.max(a.r, 1))
  const twoPi = 2 * Math.PI
  const steps = Math.min(180, Math.ceil((Math.abs(a.sweep) / twoPi) * 140) + 32)
  for (let i = 0; i <= steps; i++) {
    const t = a.a0 + (a.sweep * i) / steps
    let diff = phi - t
    while (diff > Math.PI) diff -= twoPi
    while (diff <= -Math.PI) diff += twoPi
    if (Math.abs(diff) < angTol) return true
  }
  return phiIsOnArcSweep(a.a0, a.sweep, phi)
}

/**
 * @param {number} wx
 * @param {number} wy
 * @param {{ a: string; b: string }} seg
 * @param {Map<string, { x: number; y: number }>} pointById
 * @param {number} tolWorld
 */
export function hitSegment(wx, wy, seg, pointById, tolWorld) {
  const pa = pointById.get(seg.a)
  const pb = pointById.get(seg.b)
  if (!pa || !pb) return false
  return distPointToSegment(wx, wy, pa.x, pa.y, pb.x, pb.y) <= tolWorld
}

/**
 * @param {{ a: string; b: string }[]} segments
 * @param {Map<string, { x: number; y: number }>} pointById
 * @returns {null | { seg: object; tx: number; ty: number; tdx: number; tdy: number }}
 */
export function findNearestSegmentHit(segments, pointById, wx, wy, tolWorld) {
  let best = null
  let bestD = Infinity
  for (const seg of segments) {
    const a = pointById.get(seg.a)
    const b = pointById.get(seg.b)
    if (!a || !b) continue
    const d = distPointToSegment(wx, wy, a.x, a.y, b.x, b.y)
    if (d <= tolWorld && d < bestD) {
      bestD = d
      const abx = b.x - a.x
      const aby = b.y - a.y
      const len2 = abx * abx + aby * aby
      let t =
        len2 < 1e-12 ? 0 : ((wx - a.x) * abx + (wy - a.y) * aby) / len2
      t = Math.max(0, Math.min(1, t))
      const tx = a.x + t * abx
      const ty = a.y + t * aby
      const len = Math.hypot(abx, aby) || 1
      best = {
        seg,
        tx,
        ty,
        tdx: abx / len,
        tdy: aby / len,
      }
    }
  }
  return bestD <= tolWorld ? best : null
}

/** @param {{ x: number; y: number }[]} samples */
export function hitPolylineSamples(wx, wy, samples, tolWorld) {
  if (samples.length < 2) return false
  for (let i = 1; i < samples.length; i++) {
    const p0 = samples[i - 1]
    const p1 = samples[i]
    if (distPointToSegment(wx, wy, p0.x, p0.y, p1.x, p1.y) <= tolWorld) {
      return true
    }
  }
  return false
}
