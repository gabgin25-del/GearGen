/**
 * Gauss–Newton (2×2 normal equations) on scalar residuals from constraints
 * incident to a single point — a lightweight Newton-style guardrail layered on
 * top of sequential relaxation. Unknowns: that point’s (x, y); all other
 * coordinates stay fixed at the current sketch state.
 */

const LAMBDA = 1e-10
const MAX_GN = 8
const RES_TOL = 1e-7
const STEP_CAP = 2.5

/**
 * @param {object} data
 * @param {string} pointId
 * @param {number} x
 * @param {number} y
 * @returns {{ r: number[]; J: number[][] }}
 */
export function incidentResidualsAndJacobian(data, pointId, x, y) {
  const r = []
  const J = []
  const pmap = new Map(data.points.map((p) => [p.id, p]))

  const xyOf = (pid) =>
    pid === pointId ? { x, y } : pmap.get(pid) ?? { x: 0, y: 0 }

  for (const co of data.constraints ?? []) {
    const t = co.targets ?? []

    if (co.type === 'fixOrigin' && t.length === 1 && t[0].kind === 'point') {
      if (t[0].id !== pointId) continue
      r.push(x, y)
      J.push([1, 0], [0, 1])
      continue
    }

    if (co.type === 'coincident' && t.length === 2) {
      const [a, b] = t
      if (a.kind !== 'point' || b.kind !== 'point') continue
      if (a.id !== pointId && b.id !== pointId) continue
      const pa = xyOf(a.id)
      const pb = xyOf(b.id)
      r.push(pa.x - pb.x, pa.y - pb.y)
      if (a.id === pointId) {
        J.push([1, 0], [0, 1])
      } else {
        J.push([-1, 0], [0, -1])
      }
      continue
    }

    if (
      co.type === 'horizontal' &&
      t.length === 1 &&
      t[0].kind === 'segment'
    ) {
      const seg = data.segments.find((s) => s.id === t[0].id)
      if (!seg) continue
      if (seg.a !== pointId && seg.b !== pointId) continue
      const pa = xyOf(seg.a)
      const pb = xyOf(seg.b)
      r.push(pa.y - pb.y)
      const row =
        seg.a === pointId ? [0, 1] : seg.b === pointId ? [0, -1] : [0, 0]
      J.push(row)
      continue
    }

    if (co.type === 'vertical' && t.length === 1 && t[0].kind === 'segment') {
      const seg = data.segments.find((s) => s.id === t[0].id)
      if (!seg) continue
      if (seg.a !== pointId && seg.b !== pointId) continue
      const pa = xyOf(seg.a)
      const pb = xyOf(seg.b)
      r.push(pa.x - pb.x)
      const row =
        seg.a === pointId ? [1, 0] : seg.b === pointId ? [-1, 0] : [0, 0]
      J.push(row)
      continue
    }

    if (
      co.type === 'anchorAt' &&
      t.length === 1 &&
      t[0].kind === 'point' &&
      t[0].id === pointId &&
      co.x != null &&
      co.y != null
    ) {
      r.push(x - co.x, y - co.y)
      J.push([1, 0], [0, 1])
      continue
    }

    if (
      co.type === 'lockCoordX' &&
      t.length === 1 &&
      t[0].kind === 'point' &&
      t[0].id === pointId &&
      co.value != null
    ) {
      r.push(x - co.value)
      J.push([1, 0])
      continue
    }

    if (
      co.type === 'lockCoordY' &&
      t.length === 1 &&
      t[0].kind === 'point' &&
      t[0].id === pointId &&
      co.value != null
    ) {
      r.push(y - co.value)
      J.push([0, 1])
      continue
    }

    if (
      co.type === 'pointOnSegment' &&
      t.length === 2 &&
      t[0].kind === 'point' &&
      t[1].kind === 'segment' &&
      t[0].id === pointId
    ) {
      const seg = data.segments.find((s) => s.id === t[1].id)
      if (!seg) continue
      const pa = xyOf(seg.a)
      const pb = xyOf(seg.b)
      const abx = pb.x - pa.x
      const aby = pb.y - pa.y
      const apx = x - pa.x
      const apy = y - pa.y
      r.push(apx * aby - apy * abx)
      J.push([aby, -abx])
      continue
    }
  }

  return { r, J }
}

function normR(r) {
  let s = 0
  for (const v of r) s += v * v
  return Math.sqrt(s)
}

/**
 * @param {number[][]} Jrows
 * @param {number[]} r
 */
function gaussNewtonDelta(Jrows, r) {
  let a11 = LAMBDA
  let a12 = 0
  let a22 = LAMBDA
  let b1 = 0
  let b2 = 0
  for (let i = 0; i < r.length; i++) {
    const j0 = Jrows[i][0]
    const j1 = Jrows[i][1]
    const ri = r[i]
    a11 += j0 * j0
    a12 += j0 * j1
    a22 += j1 * j1
    b1 += j0 * ri
    b2 += j1 * ri
  }
  const det = a11 * a22 - a12 * a12
  if (Math.abs(det) < 1e-22) return [0, 0]
  const ex = -b1
  const ey = -b2
  return [(a22 * ex - a12 * ey) / det, (-a12 * ex + a11 * ey) / det]
}

/**
 * Try to walk from a nudged position back to the incident-constraint manifold
 * while staying in a neighborhood; if a feasible configuration exists away
 * from the original, the point is not fully defined.
 *
 * @param {object} data
 * @param {string} pointId
 * @param {{ x: number; y: number }} p0
 * @param {number} startX
 * @param {number} startY
 * @returns {{ x: number; y: number } | null}
 */
export function gaussNewtonIncidentRefine(data, pointId, p0, startX, startY) {
  let x = startX
  let y = startY
  for (let k = 0; k < MAX_GN; k++) {
    const { r, J } = incidentResidualsAndJacobian(data, pointId, x, y)
    if (r.length === 0) return null
    const nr = normR(r)
    if (nr < RES_TOL) return { x, y }
    const [dx, dy] = gaussNewtonDelta(J, r)
    const scale =
      Math.hypot(dx, dy) > STEP_CAP ? STEP_CAP / Math.hypot(dx, dy) : 1
    x += dx * scale
    y += dy * scale
    if (Math.hypot(x - p0.x, y - p0.y) > 120) break
  }
  const { r: rf } = incidentResidualsAndJacobian(data, pointId, x, y)
  if (rf.length === 0) return null
  if (normR(rf) < RES_TOL * 10) return { x, y }
  return null
}
