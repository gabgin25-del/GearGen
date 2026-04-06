import { arcSecantAndBulge } from './arcGeometry.js'
import { arcSweepCenterFromCursor } from './geometryMetrics.js'

/**
 * After points move, recompute arcs that reference point ids.
 * @param {{ points: { id: string; x: number; y: number }[]; arcs?: object[] }} data
 */
export function recomputeBoundArcs(data) {
  const arcs = data.arcs ?? []
  if (!arcs.length) return data
  const pt = new Map(data.points.map((p) => [p.id, p]))

  const nextArcs = arcs.map((a) => {
    if (a.pointIds?.length === 3) {
      const [id0, id1, id2] = a.pointIds
      const p0 = pt.get(id0)
      const p1 = pt.get(id1)
      const p2 = pt.get(id2)
      if (!p0 || !p1 || !p2) return a
      const prm = arcSecantAndBulge(p0.x, p0.y, p1.x, p1.y, p2.x, p2.y)
      return prm ? { ...a, ...prm } : a
    }
    if (a.centerId && a.startId && a.endId) {
      const C = pt.get(a.centerId)
      const A = pt.get(a.startId)
      const B = pt.get(a.endId)
      if (!C || !A || !B) return a
      const r = Math.hypot(A.x - C.x, A.y - C.y)
      if (r < 1e-6) return a
      const midAng =
        a.a0 != null &&
        a.sweep != null &&
        Number.isFinite(a.a0) &&
        Number.isFinite(a.sweep)
          ? a.a0 + a.sweep / 2
          : Math.atan2(B.y - C.y, B.x - C.x)
      const mpx = C.x + r * Math.cos(midAng)
      const mpy = C.y + r * Math.sin(midAng)
      const prm = arcSweepCenterFromCursor(
        C.x,
        C.y,
        r,
        A.x,
        A.y,
        B.x,
        B.y,
        mpx,
        mpy,
      )
      return prm ? { ...a, ...prm } : a
    }
    return a
  })

  return { ...data, arcs: nextArcs }
}
