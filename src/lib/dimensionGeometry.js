/**
 * CAD-style dimension measurements and anchor points (world space).
 */

/** ~2° — treat as parallel for line–line distance dimensions. */
export const PARALLEL_LINE_COS_MIN = Math.cos((2 * Math.PI) / 180)

/**
 * @param {{ x: number; y: number }} pa
 * @param {{ x: number; y: number }} pb
 * @param {{ x: number; y: number }} pc
 * @param {{ x: number; y: number }} pd
 */
export function segmentsParallelCos(pa, pb, pc, pd) {
  const u0x = pb.x - pa.x
  const u0y = pb.y - pa.y
  const u1x = pd.x - pc.x
  const u1y = pd.y - pc.y
  const L0 = Math.hypot(u0x, u0y)
  const L1 = Math.hypot(u1x, u1y)
  if (L0 < 1e-9 || L1 < 1e-9) return 0
  return Math.abs((u0x * u1x + u0y * u1y) / (L0 * L1))
}

/**
 * @param {number} px
 * @param {number} py
 * @param {number} ax
 * @param {number} ay
 * @param {number} bx
 * @param {number} by
 */
export function closestPointOnInfiniteLine(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const L2 = dx * dx + dy * dy
  if (L2 < 1e-18) return { x: ax, y: ay }
  const t = ((px - ax) * dx + (py - ay) * dy) / L2
  return { x: ax + t * dx, y: ay + t * dy }
}

/**
 * Shortest distance between two infinite lines (parallel case uses offset).
 * @param {{ a: string; b: string }} seg0
 * @param {{ a: string; b: string }} seg1
 * @param {Map<string, { x: number; y: number }>} pmap
 * @returns {{ value: number; ax: number; ay: number; bx: number; by: number } | null}
 */
export function parallelLinesMeasure(seg0, seg1, pmap) {
  const pa0 = pmap.get(seg0.a)
  const pb0 = pmap.get(seg0.b)
  const pa1 = pmap.get(seg1.a)
  const pb1 = pmap.get(seg1.b)
  if (!pa0 || !pb0 || !pa1 || !pb1) return null
  const cos = segmentsParallelCos(pa0, pb0, pa1, pb1)
  if (cos < PARALLEL_LINE_COS_MIN) return null
  const mid0 = { x: (pa0.x + pb0.x) / 2, y: (pa0.y + pb0.y) / 2 }
  const foot1 = closestPointOnInfiniteLine(
    mid0.x,
    mid0.y,
    pa1.x,
    pa1.y,
    pb1.x,
    pb1.y,
  )
  const foot0 = closestPointOnInfiniteLine(
    foot1.x,
    foot1.y,
    pa0.x,
    pa0.y,
    pb0.x,
    pb0.y,
  )
  const value = Math.hypot(foot1.x - foot0.x, foot1.y - foot0.y)
  return { value, ax: foot0.x, ay: foot0.y, bx: foot1.x, by: foot1.y }
}

/**
 * Point–segment: anchors at point and foot on line.
 * @returns {{ value: number; ax: number; ay: number; bx: number; by: number } | null}
 */
export function pointToLineMeasure(pid, seg, pmap) {
  const p = pmap.get(pid)
  const pa = pmap.get(seg.a)
  const pb = pmap.get(seg.b)
  if (!p || !pa || !pb) return null
  const foot = closestPointOnInfiniteLine(p.x, p.y, pa.x, pa.y, pb.x, pb.y)
  const value = Math.hypot(foot.x - p.x, foot.y - p.y)
  return { value, ax: p.x, ay: p.y, bx: foot.x, by: foot.y }
}

/**
 * @param {string} p1
 * @param {string} p2
 * @param {Map<string, { x: number; y: number }>} pmap
 */
export function pointPointMeasure(p1, p2, pmap) {
  const a = pmap.get(p1)
  const b = pmap.get(p2)
  if (!a || !b) return null
  const value = Math.hypot(b.x - a.x, b.y - a.y)
  return { value, ax: a.x, ay: a.y, bx: b.x, by: b.y }
}

/**
 * Offset of cursor from chord mid along left normal (matches drawLinearDimension).
 * @param {number} wx
 * @param {number} wy
 * @param {number} ax
 * @param {number} ay
 * @param {number} bx
 * @param {number} by
 */
export function linearDimensionOffsetFromCursor(wx, wy, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const len = Math.hypot(dx, dy)
  if (len < 1e-9) return 0
  const mx = (ax + bx) / 2
  const my = (ay + by) / 2
  const nx = -dy / len
  const ny = dx / len
  return (wx - mx) * nx + (wy - my) * ny
}

/**
 * @param {object} dim
 * @returns {'segment' | 'pointPoint' | 'pointLine' | 'parallelLines'}
 */
export function inferDistanceKind(dim) {
  if (dim.type !== 'distance') return 'segment'
  if (dim.distanceKind) return dim.distanceKind
  const t = dim.targets ?? []
  if (t.length === 2 && typeof t[0] === 'string' && typeof t[1] === 'string') {
    return 'pointPoint'
  }
  if (
    t.length === 2 &&
    ((t[0]?.kind === 'point' && t[1]?.kind === 'segment') ||
      (t[0]?.kind === 'segment' && t[1]?.kind === 'point'))
  ) {
    return 'pointLine'
  }
  if (
    t.length === 2 &&
    t[0]?.kind === 'segment' &&
    t[1]?.kind === 'segment'
  ) {
    return 'parallelLines'
  }
  return 'segment'
}

/**
 * Anchor points for linear driving distance (for draw + hit-test).
 * @param {object} dim
 * @param {object} data workspace
 * @returns {{ ax: number; ay: number; bx: number; by: number } | null}
 */
export function linearDistanceAnchorPoints(dim, data) {
  if (dim.type !== 'distance') return null
  const pmap = new Map((data.points ?? []).map((p) => [p.id, p]))
  const segments = data.segments ?? []
  const kind = inferDistanceKind(dim)
  const t = dim.targets ?? []

  if (kind === 'segment' && typeof t[0] === 'string') {
    const seg = segments.find((s) => s.id === t[0])
    if (!seg) return null
    const a = pmap.get(seg.a)
    const b = pmap.get(seg.b)
    if (!a || !b) return null
    return { ax: a.x, ay: a.y, bx: b.x, by: b.y }
  }
  if (kind === 'pointPoint') {
    const a = pmap.get(t[0])
    const b = pmap.get(t[1])
    if (!a || !b) return null
    return { ax: a.x, ay: a.y, bx: b.x, by: b.y }
  }
  if (kind === 'pointLine') {
    let pid
    let segId
    if (t[0]?.kind === 'point') {
      pid = t[0].id
      segId = t[1].id
    } else {
      pid = t[1].id
      segId = t[0].id
    }
    const seg = segments.find((s) => s.id === segId)
    if (!seg) return null
    const m = pointToLineMeasure(pid, seg, pmap)
    if (!m) return null
    return { ax: m.ax, ay: m.ay, bx: m.bx, by: m.by }
  }
  if (kind === 'parallelLines') {
    const s0 = segments.find((s) => s.id === t[0].id)
    const s1 = segments.find((s) => s.id === t[1].id)
    if (!s0 || !s1) return null
    const m = parallelLinesMeasure(s0, s1, pmap)
    if (!m) return null
    return { ax: m.ax, ay: m.ay, bx: m.bx, by: m.by }
  }
  return null
}
