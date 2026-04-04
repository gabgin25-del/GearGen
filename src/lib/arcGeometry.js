import {
  arcSweepOnCircle,
  circleFromThreePoints,
} from './geometryMetrics.js'

export { arcSecantAndBulge } from './geometryMetrics.js'

/** Whether angle tTest lies on arc from a0 with signed sweep in (-π, π] */
function onDirectedArc(a0, sweep, tTest) {
  let dt = tTest - a0
  while (dt <= -Math.PI) dt += 2 * Math.PI
  while (dt > Math.PI) dt -= 2 * Math.PI
  if (sweep >= 0) {
    const u = dt < 0 ? dt + 2 * Math.PI : dt
    return u >= -1e-4 && u <= sweep + 1e-4
  }
  const u = dt > 0 ? dt - 2 * Math.PI : dt
  return u <= 1e-4 && u >= sweep - 1e-4
}

/**
 * Minor arc from P0 → P2 that passes through P1 (SolidWorks-style 3-point arc).
 */
export function arcThroughThreePoints(x0, y0, x1, y1, x2, y2) {
  const circ = circleFromThreePoints(x0, y0, x1, y1, x2, y2)
  if (!circ) return null
  const { cx, cy, r } = circ
  const t0 = Math.atan2(y0 - cy, x0 - cx)
  const t1 = Math.atan2(y1 - cy, x1 - cx)
  const t2 = Math.atan2(y2 - cy, x2 - cx)

  let sweep = t2 - t0
  while (sweep <= -Math.PI) sweep += 2 * Math.PI
  while (sweep > Math.PI) sweep -= 2 * Math.PI
  if (onDirectedArc(t0, sweep, t1)) {
    return { cx, cy, r, a0: t0, sweep }
  }

  sweep = t2 - t0
  if (sweep > 0) sweep -= 2 * Math.PI
  else sweep += 2 * Math.PI
  if (onDirectedArc(t0, sweep, t1)) {
    return { cx, cy, r, a0: t0, sweep }
  }
  return null
}

export function arcTangentLineAndPoint(Tx, Ty, dx, dy, Ex, Ey) {
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const perps = [
    [-uy, ux],
    [uy, -ux],
  ]
  const vx = Ex - Tx
  const vy = Ey - Ty
  const vv = vx * vx + vy * vy
  if (vv < 1) return null

  for (const [nx, ny] of perps) {
    const vd = vx * nx + vy * ny
    if (Math.abs(vd) < 1e-8) continue
    const R = vv / (2 * vd)
    const absR = Math.abs(R)
    if (absR < 1.5 || absR > 1e7 || !Number.isFinite(absR)) continue
    const cx = Tx + R * nx
    const cy = Ty + R * ny
    const prm = arcSweepOnCircle(cx, cy, absR, Tx, Ty, Ex, Ey)
    if (prm) return prm
  }
  return null
}
