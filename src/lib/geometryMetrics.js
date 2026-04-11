import { polylineLength, sampleSplinePolyline } from './splineMath.js'
import { resolveCircleCenter } from './circleResolve.js'

/**
 * Counterclockwise sweep from direction aa to ab (same angle convention as Math.atan2).
 * Result in (0, 2π] so reflex angles (> 180°) are preserved for arcs.
 */
export function angleSweepCCW(aa, ab) {
  let s = ab - aa
  while (s <= 0) s += 2 * Math.PI
  while (s > 2 * Math.PI) s -= 2 * Math.PI
  if (s < 1e-9) return 2 * Math.PI
  return s
}

/** Shoelace area for simple polygon (closed), vertices in order */
export function polygonArea(verts) {
  if (verts.length < 3) return 0
  let s = 0
  for (let i = 0; i < verts.length; i++) {
    const j = (i + 1) % verts.length
    s += verts[i].x * verts[j].y - verts[j].x * verts[i].y
  }
  return Math.abs(s / 2)
}

export function polygonPerimeter(verts) {
  if (verts.length < 2) return 0
  let p = 0
  for (let i = 0; i < verts.length; i++) {
    const j = (i + 1) % verts.length
    const dx = verts[j].x - verts[i].x
    const dy = verts[j].y - verts[i].y
    p += Math.hypot(dx, dy)
  }
  return p
}

export function circleArea(r) {
  return Math.PI * r * r
}

export function circlePerimeter(r) {
  return 2 * Math.PI * r
}

/** Minor arc: sweep in (-π, π] from a0 toward rim point 2 (averaged radius) */
export function arcFromThreePoints(cx, cy, x1, y1, x2, y2) {
  const r1 = Math.hypot(x1 - cx, y1 - cy)
  const r2 = Math.hypot(x2 - cx, y2 - cy)
  const r = (r1 + r2) / 2
  if (r < 1) return null
  const a0 = Math.atan2(y1 - cy, x1 - cx)
  const a1 = Math.atan2(y2 - cy, x2 - cx)
  let sweep = a1 - a0
  while (sweep <= -Math.PI) sweep += 2 * Math.PI
  while (sweep > Math.PI) sweep -= 2 * Math.PI
  return { cx, cy, r, a0, sweep }
}

/** Fixed-radius minor arc from first rim point to second rim direction */
export function arcSweepOnCircle(cx, cy, r, p1x, p1y, p2x, p2y) {
  if (r < 1) return null
  const a0 = Math.atan2(p1y - cy, p1x - cx)
  const a1 = Math.atan2(p2y - cy, p2x - cx)
  let sweep = a1 - a0
  while (sweep <= -Math.PI) sweep += 2 * Math.PI
  while (sweep > Math.PI) sweep -= 2 * Math.PI
  return { cx, cy, r, a0, sweep }
}

/**
 * Center-point arc (SolidWorks-style): sweep from start rim point to end rim point
 * follows the side of the chord indicated by cross((p1-c),(p2-c)), allowing >180°.
 */
export function arcSweepCenterDirected(cx, cy, r, p1x, p1y, p2x, p2y) {
  if (r < 1) return null
  const a0 = Math.atan2(p1y - cy, p1x - cx)
  const a1 = Math.atan2(p2y - cy, p2x - cx)
  const cross =
    (p1x - cx) * (p2y - cy) - (p1y - cy) * (p2x - cx)
  let sweep = a1 - a0
  if (cross > 0) {
    while (sweep <= 0) sweep += 2 * Math.PI
  } else if (cross < 0) {
    while (sweep >= 0) sweep -= 2 * Math.PI
  } else {
    while (sweep <= -Math.PI) sweep += 2 * Math.PI
    while (sweep > Math.PI) sweep -= 2 * Math.PI
  }
  if (Math.abs(sweep) < 1e-4) return null
  return { cx, cy, r, a0, sweep }
}

/**
 * Center arc: choose minor vs major sweep from start to end rim so the arc
 * midpoint is closer (angularly) to the cursor — allows >180° like SolidWorks.
 */
export function arcSweepCenterFromCursor(
  cx,
  cy,
  r,
  p1x,
  p1y,
  p2x,
  p2y,
  mx,
  my,
) {
  if (r < 1) return null
  const a0 = Math.atan2(p1y - cy, p1x - cx)
  const a1 = Math.atan2(p2y - cy, p2x - cx)
  let minor = a1 - a0
  while (minor < 0) minor += 2 * Math.PI
  while (minor >= 2 * Math.PI) minor -= 2 * Math.PI
  const major = 2 * Math.PI - minor
  const am = Math.atan2(my - cy, mx - cx)
  const midDist = (sweep) => {
    const mid = a0 + sweep / 2
    let d = am - mid
    while (d > Math.PI) d -= 2 * Math.PI
    while (d <= -Math.PI) d += 2 * Math.PI
    return Math.abs(d)
  }
  const twoPi = 2 * Math.PI
  const bases = [minor, major]
  const candidates = []
  const seen = new Set()
  for (const b of bases) {
    if (Math.abs(b) < 1e-4 || b > twoPi + 1e-9) continue
    const key = Math.round(b * 1e6)
    if (seen.has(key)) continue
    seen.add(key)
    candidates.push(b)
  }
  let sweep = minor
  let bestD = Infinity
  for (const s of candidates) {
    const d = midDist(s)
    if (d < bestD) {
      bestD = d
      sweep = s
    }
  }
  if (Math.abs(sweep) < 1e-4) return null
  return { cx, cy, r, a0, sweep }
}

/** Point (phi angle from center) lies on arc starting at a0 with signed sweep. */
export function phiIsOnArcSweep(a0, sweep, phi) {
  const twoPi = 2 * Math.PI
  const steps = 72
  for (let i = 0; i <= steps; i++) {
    const t = a0 + (sweep * i) / steps
    let diff = phi - t
    while (diff > Math.PI) diff -= twoPi
    while (diff <= -Math.PI) diff += twoPi
    if (Math.abs(diff) < 0.06) return true
  }
  return false
}

/** Circumcircle of three non-collinear points */
export function circleFromThreePoints(x1, y1, x2, y2, x3, y3) {
  const d =
    2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2))
  if (Math.abs(d) < 1e-9) return null
  const u1 = x1 * x1 + y1 * y1
  const u2 = x2 * x2 + y2 * y2
  const u3 = x3 * x3 + y3 * y3
  const cx = (u1 * (y2 - y3) + u2 * (y3 - y1) + u3 * (y1 - y2)) / d
  const cy = (u1 * (x3 - x2) + u2 * (x1 - x3) + u3 * (x2 - x1)) / d
  const r = Math.hypot(x1 - cx, y1 - cy)
  if (r < 1e-6) return null
  return { cx, cy, r }
}

/**
 * 3-point arc: P0–P1 are chord endpoints; bulge lies on the circle and picks
 * which arc between P0 and P1 (radius from circumcircle of the three).
 */
export function arcSecantAndBulge(p0x, p0y, p1x, p1y, bx, by) {
  const circ = circleFromThreePoints(p0x, p0y, p1x, p1y, bx, by)
  if (!circ) return null
  const { cx, cy, r } = circ
  const a0 = Math.atan2(p0y - cy, p0x - cx)
  const a1 = Math.atan2(p1y - cy, p1x - cx)
  const ap = Math.atan2(by - cy, bx - cx)
  let minor = a1 - a0
  while (minor <= -Math.PI) minor += 2 * Math.PI
  while (minor > Math.PI) minor -= 2 * Math.PI
  const major = minor > 0 ? minor - 2 * Math.PI : minor + 2 * Math.PI
  const onBulge = (sweep) => phiIsOnArcSweep(a0, sweep, ap)
  if (onBulge(minor)) return { cx, cy, r, a0, sweep: minor }
  if (onBulge(major)) return { cx, cy, r, a0, sweep: major }
  return { cx, cy, r, a0, sweep: minor }
}

export function arcArcLength(r, sweep) {
  return r * Math.abs(sweep)
}

export function arcSectorArea(r, sweep) {
  return 0.5 * r * r * Math.abs(sweep)
}

/** Interior angle ∠ACB in radians (smallest between rays CA and CB) */
export function angleAtVertex(C, A, B) {
  const ux = A.x - C.x
  const uy = A.y - C.y
  const vx = B.x - C.x
  const vy = B.y - C.y
  const la = Math.hypot(ux, uy)
  const lb = Math.hypot(vx, vy)
  if (la < 1e-9 || lb < 1e-9) return null
  let cos = (ux * vx + uy * vy) / (la * lb)
  cos = Math.max(-1, Math.min(1, cos))
  return Math.acos(cos)
}

/** @param {{ points: { id: string; x: number; y: number }[]; polygons: object[]; circles: object[]; arcs?: object[]; angles?: object[]; splines?: object[] }} data */
export function listRegisteredShapes(data) {
  const pt = new Map(data.points.map((p) => [p.id, p]))
  const out = []

  for (const poly of data.polygons) {
    if (poly.geoRegistered === false) continue
    const verts = poly.vertexIds.map((id) => pt.get(id)).filter(Boolean)
    if (verts.length < 3) continue
    out.push({
      id: poly.id,
      kind: 'Polygon',
      vertices: verts.length,
      area: polygonArea(verts),
      perimeter: polygonPerimeter(verts),
    })
  }

  for (const c of data.circles) {
    if (c.geoRegistered === false) continue
    const cen = resolveCircleCenter(c, pt)
    out.push({
      id: c.id,
      kind: 'Circle',
      area: circleArea(c.r),
      perimeter: circlePerimeter(c.r),
      detail: c.centerId ? `@${cen.x.toFixed(1)},${cen.y.toFixed(1)}` : undefined,
    })
  }

  for (const a of data.arcs) {
    if (a.geoRegistered === false) continue
    const L = arcArcLength(a.r, a.sweep)
    const sector = arcSectorArea(a.r, a.sweep)
    out.push({
      id: a.id,
      kind: 'Arc',
      area: sector,
      perimeter: L,
      detail: `${((Math.abs(a.sweep) * 180) / Math.PI).toFixed(1)}°`,
    })
  }

  for (const ang of data.angles ?? []) {
    if (ang.geoRegistered === false) continue
    const C = pt.get(ang.centerId)
    const A = pt.get(ang.arm1Id)
    const B = pt.get(ang.arm2Id)
    if (!C || !A || !B) continue
    const rad = angleAtVertex(C, A, B)
    if (rad == null) continue
    out.push({
      id: ang.id,
      kind: 'Angle',
      area: null,
      perimeter: null,
      detail: `${((rad * 180) / Math.PI).toFixed(1)}°`,
    })
  }

  for (const sp of data.splines ?? []) {
    if (sp.geoRegistered === false) continue
    const verts = sp.vertexIds.map((id) => pt.get(id)).filter(Boolean)
    if (verts.length < 2) continue
    const samples = sampleSplinePolyline(verts, sp.splineType, {
      tension: sp.tension ?? 0.5,
      closed: !!sp.closed,
      segmentsPerSpan: sp.segmentsPerSpan ?? 14,
    })
    const L = polylineLength(samples)
    out.push({
      id: sp.id,
      kind: 'Spline',
      area: null,
      perimeter: L,
      detail: String(sp.splineType ?? ''),
    })
  }

  return out
}
