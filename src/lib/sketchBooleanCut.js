import { circleWithResolvedCenter } from './circleResolve.js'
import { pointInPolygon } from './hitTest.js'

const HOLE_VERTS = 28

/**
 * @param {object} data
 * @param {number} wx
 * @param {number} wy
 */
export function findFilledPolygonContaining(data, wx, wy) {
  const pmap = new Map((data.points ?? []).map((p) => [p.id, p]))
  const polys = data.polygons ?? []
  for (let i = polys.length - 1; i >= 0; i--) {
    const poly = polys[i]
    if (!poly.fill) continue
    const verts = poly.vertexIds.map((id) => pmap.get(id)).filter(Boolean)
    if (verts.length < 3) continue
    if (pointInPolygon(wx, wy, verts)) return poly
  }
  return null
}

/**
 * @param {object} data
 * @param {number} wx
 * @param {number} wy
 * @returns {{ circle: object; rc: { cx: number; cy: number; r: number } } | null}
 */
export function findFilledCircleContaining(data, wx, wy) {
  const pmap = new Map((data.points ?? []).map((p) => [p.id, p]))
  for (const c of data.circles ?? []) {
    if (!c.fill) continue
    const rc = circleWithResolvedCenter(c, pmap)
    if (rc.r < 1e-9) continue
    const d = Math.hypot(wx - rc.cx, wy - rc.cy)
    if (d + 1e-6 < rc.r) return { circle: c, rc }
  }
  return null
}

/**
 * @param {object} data
 * @param {string} polyId
 * @param {number} cx
 * @param {number} cy
 * @param {number} r
 * @param {(p: string) => string} nextId
 */
export function addCircularHoleToPolygon(data, polyId, cx, cy, r, nextId) {
  if (r < 1e-6) return null
  const poly = (data.polygons ?? []).find((p) => p.id === polyId)
  if (!poly || !poly.fill) return null

  const holeIds = []
  const newPts = []
  for (let i = 0; i < HOLE_VERTS; i++) {
    const ang = (i * 2 * Math.PI) / HOLE_VERTS
    const id = nextId('p')
    holeIds.push(id)
    newPts.push({
      id,
      x: cx + r * Math.cos(ang),
      y: cy + r * Math.sin(ang),
    })
  }
  const newSegs = []
  for (let i = 0; i < HOLE_VERTS; i++) {
    const a = holeIds[i]
    const b = holeIds[(i + 1) % HOLE_VERTS]
    newSegs.push({
      id: nextId('seg'),
      a,
      b,
      geoRegistered: true,
    })
  }
  const prevHoles = poly.holes ?? []
  return {
    ...data,
    points: [...data.points, ...newPts],
    segments: [...data.segments, ...newSegs],
    polygons: data.polygons.map((p) =>
      p.id === polyId
        ? { ...p, holes: [...prevHoles, holeIds] }
        : p,
    ),
  }
}

/**
 * @param {object} data
 * @param {string} circleId
 * @param {number} hx
 * @param {number} hy
 * @param {number} hr
 */
export function addCircularHoleToCircle(data, circleId, hx, hy, hr) {
  if (hr < 1e-6) return null
  const pmap = new Map((data.points ?? []).map((p) => [p.id, p]))
  const c = (data.circles ?? []).find((x) => x.id === circleId)
  if (!c || !c.fill) return null
  const rc = circleWithResolvedCenter(c, pmap)
  if (rc.r < 1e-9) return null
  const d = Math.hypot(hx - rc.cx, hy - rc.cy)
  if (d + hr > rc.r - 1e-3) return null
  const holes = [...(c.holes ?? [])]
  holes.push({ cx: hx, cy: hy, r: hr })
  return {
    ...data,
    circles: data.circles.map((x) =>
      x.id === circleId ? { ...x, holes } : x,
    ),
  }
}

/**
 * @param {object} data
 * @param {string} polyId
 * @param {{ minx: number; miny: number; maxx: number; maxy: number }} rect
 * @param {(p: string) => string} nextId
 */
export function addRectangularHoleToPolygon(data, polyId, rect, nextId) {
  const { minx, miny, maxx, maxy } = rect
  if (maxx - minx < 1e-6 || maxy - miny < 1e-6) return null
  const poly = (data.polygons ?? []).find((p) => p.id === polyId)
  if (!poly || !poly.fill) return null
  const pmap = new Map((data.points ?? []).map((p) => [p.id, p]))
  const cx = (minx + maxx) / 2
  const cy = (miny + maxy) / 2
  const verts = poly.vertexIds.map((id) => pmap.get(id)).filter(Boolean)
  if (verts.length < 3 || !pointInPolygon(cx, cy, verts)) return null

  const p1 = nextId('p')
  const p2 = nextId('p')
  const p3 = nextId('p')
  const p4 = nextId('p')
  const holeIds = [p1, p2, p3, p4]
  const newPts = [
    { id: p1, x: minx, y: miny },
    { id: p2, x: maxx, y: miny },
    { id: p3, x: maxx, y: maxy },
    { id: p4, x: minx, y: maxy },
  ]
  const s0 = nextId('seg')
  const s1 = nextId('seg')
  const s2 = nextId('seg')
  const s3 = nextId('seg')
  const newSegs = [
    { id: s0, a: p1, b: p2, geoRegistered: true },
    { id: s1, a: p2, b: p3, geoRegistered: true },
    { id: s2, a: p3, b: p4, geoRegistered: true },
    { id: s3, a: p4, b: p1, geoRegistered: true },
  ]
  const prevHoles = poly.holes ?? []
  return {
    ...data,
    points: [...data.points, ...newPts],
    segments: [...data.segments, ...newSegs],
    polygons: data.polygons.map((p) =>
      p.id === polyId
        ? { ...p, holes: [...prevHoles, holeIds] }
        : p,
    ),
  }
}

/**
 * Try to cut a circle-shaped void into a filled region; returns updated data or null.
 */
export function trySubtractCircleFromFill(data, cx, cy, r, nextId) {
  const poly = findFilledPolygonContaining(data, cx, cy)
  if (poly) return addCircularHoleToPolygon(data, poly.id, cx, cy, r, nextId)
  const fc = findFilledCircleContaining(data, cx, cy)
  if (fc) return addCircularHoleToCircle(data, fc.circle.id, cx, cy, r)
  return null
}

/**
 * @param {object} data
 * @param {{ minx: number; miny: number; maxx: number; maxy: number }} rect
 * @param {(p: string) => string} nextId
 */
export function trySubtractRectFromFill(data, rect, nextId) {
  const cx = (rect.minx + rect.maxx) / 2
  const cy = (rect.miny + rect.maxy) / 2
  const poly = findFilledPolygonContaining(data, cx, cy)
  if (poly) return addRectangularHoleToPolygon(data, poly.id, rect, nextId)
  const pmap = new Map((data.points ?? []).map((p) => [p.id, p]))
  for (const c of data.circles ?? []) {
    if (!c.fill) continue
    const rc = circleWithResolvedCenter(c, pmap)
    if (rc.r < 1e-9) continue
    if (!pointInPolygon(cx, cy, approxCircleVerts(rc.cx, rc.cy, rc.r))) continue
    return subtractRectFromFilledCircle(data, c.id, rect, nextId)
  }
  return null
}

function approxCircleVerts(cx, cy, r) {
  const n = 24
  const out = []
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n
    out.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })
  }
  return out
}

/**
 * Approximate rectangular cut on a disk using a clip polygon (boolean-style).
 */
function subtractRectFromFilledCircle(data, circleId, rect, nextId) {
  const pmap = new Map((data.points ?? []).map((p) => [p.id, p]))
  const c = data.circles.find((x) => x.id === circleId)
  if (!c) return null
  const rc = circleWithResolvedCenter(c, pmap)
  const { minx, miny, maxx, maxy } = rect
  const hx = (minx + maxx) / 2
  const hy = (miny + maxy) / 2
  const hr = Math.min(maxx - minx, maxy - miny) / 2
  const d = Math.hypot(hx - rc.cx, hy - rc.cy)
  if (d + hr > rc.r - 1e-3) return null
  return addCircularHoleToCircle(data, circleId, hx, hy, hr)
}
