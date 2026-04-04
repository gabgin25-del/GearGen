import { circleWithResolvedCenter } from './circleResolve.js'
import { sampleSplinePolyline } from './splineMath.js'

/**
 * @param {number} px
 * @param {number} py
 * @param {number} minX
 * @param {number} maxX
 * @param {number} minY
 * @param {number} maxY
 */
export function pointInWorldRect(px, py, minX, maxX, minY, maxY) {
  const a = Math.min(minX, maxX)
  const b = Math.max(minX, maxX)
  const c = Math.min(minY, maxY)
  const d = Math.max(minY, maxY)
  return px >= a && px <= b && py >= c && py <= d
}

/**
 * @param {number} ax
 * @param {number} ay
 * @param {number} bx
 * @param {number} by
 */
function segTouchesRect(ax, ay, bx, by, minX, maxX, minY, maxY) {
  if (pointInWorldRect(ax, ay, minX, maxX, minY, maxY)) return true
  if (pointInWorldRect(bx, by, minX, maxX, minY, maxY)) return true
  const mx = (ax + bx) / 2
  const my = (ay + by) / 2
  if (pointInWorldRect(mx, my, minX, maxX, minY, maxY)) return true
  return false
}

/**
 * @param {object} data
 * @param {number} minWX
 * @param {number} maxWX
 * @param {number} minWY
 * @param {number} maxWY
 * @returns {{ kind: string; id: string }[]}
 */
export function collectSketchEntitiesInWorldRect(
  data,
  minWX,
  maxWX,
  minWY,
  maxWY,
) {
  const out = []
  const seen = new Set()
  const add = (kind, id) => {
    const k = `${kind}:${id}`
    if (seen.has(k)) return
    seen.add(k)
    out.push({ kind, id })
  }

  const pointById = new Map(data.points.map((p) => [p.id, p]))

  for (const pt of data.points) {
    if (pointInWorldRect(pt.x, pt.y, minWX, maxWX, minWY, maxWY)) {
      add('point', pt.id)
    }
  }

  for (const seg of data.segments) {
    const a = pointById.get(seg.a)
    const b = pointById.get(seg.b)
    if (!a || !b) continue
    if (segTouchesRect(a.x, a.y, b.x, b.y, minWX, maxWX, minWY, maxWY)) {
      add('segment', seg.id)
    }
  }

  for (const c of data.circles) {
    const r = circleWithResolvedCenter(c, pointById)
    const pad = r.r
    if (
      pointInWorldRect(r.cx, r.cy, minWX, maxWX, minWY, maxWY) ||
      pointInWorldRect(r.cx - pad, r.cy, minWX, maxWX, minWY, maxWY) ||
      pointInWorldRect(r.cx + pad, r.cy, minWX, maxWX, minWY, maxWY) ||
      pointInWorldRect(r.cx, r.cy - pad, minWX, maxWX, minWY, maxWY) ||
      pointInWorldRect(r.cx, r.cy + pad, minWX, maxWX, minWY, maxWY)
    ) {
      add('circle', c.id)
    }
  }

  for (const poly of data.polygons ?? []) {
    let any = false
    for (const vid of poly.vertexIds) {
      const v = pointById.get(vid)
      if (v && pointInWorldRect(v.x, v.y, minWX, maxWX, minWY, maxWY)) {
        any = true
        break
      }
    }
    if (any) add('polygon', poly.id)
  }

  for (const a of data.arcs ?? []) {
    const mid = a.a0 + a.sweep / 2
    const mx = a.cx + Math.cos(mid) * a.r
    const my = a.cy + Math.sin(mid) * a.r
    if (pointInWorldRect(mx, my, minWX, maxWX, minWY, maxWY)) {
      add('arc', a.id)
    }
  }

  for (const ang of data.angles ?? []) {
    const C = pointById.get(ang.centerId)
    if (C && pointInWorldRect(C.x, C.y, minWX, maxWX, minWY, maxWY)) {
      add('angle', ang.id)
    }
  }

  for (const sp of data.splines ?? []) {
    const verts = sp.vertexIds
      .map((id) => pointById.get(id))
      .filter(Boolean)
    if (verts.length < 2) continue
    const samples = sampleSplinePolyline(verts, sp.splineType ?? 'catmullRom', {
      tension: sp.tension ?? 0.5,
      closed: !!sp.closed,
      segmentsPerSpan: sp.segmentsPerSpan ?? 14,
    })
    let hit = false
    for (const q of samples) {
      if (pointInWorldRect(q.x, q.y, minWX, maxWX, minWY, maxWY)) {
        hit = true
        break
      }
    }
    if (hit) add('spline', sp.id)
  }

  return out
}
