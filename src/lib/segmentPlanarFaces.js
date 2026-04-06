/**
 * Enumerate closed faces in a straight-line segment graph (planar walk).
 * Used for auto-fill of irregular closed outlines; arcs are not included (segments only).
 */

import { pointInPolygon } from './hitTest.js'

const MIN_AREA = 4
const MAX_AREA = 1e14

function polygonArea(pts) {
  if (pts.length < 3) return 0
  let s = 0
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length
    s += pts[i].x * pts[j].y - pts[j].x * pts[i].y
  }
  return s / 2
}

/**
 * Next vertex in CCW face walk: at `cur`, came from `prev`, pick neighbor with
 * smallest positive turn from the incoming direction (standard PSLG walk).
 * @param {string} prev
 * @param {string} cur
 * @param {Map<string, string[]>} adj
 * @param {Map<string, { x: number; y: number }>} pmap
 */
function nextOnFace(prev, cur, adj, pmap) {
  const pc = pmap.get(cur)
  const pp = pmap.get(prev)
  if (!pc || !pp) return null
  const vx = pc.x
  const vy = pc.y
  const backAng = Math.atan2(pp.y - vy, pp.x - vx)
  const neigh = (adj.get(cur) ?? []).filter((w) => w !== prev)
  if (neigh.length === 0) return null
  let best = null
  let bestD = Infinity
  for (const w of neigh) {
    const pw = pmap.get(w)
    if (!pw) continue
    const outAng = Math.atan2(pw.y - vy, pw.x - vx)
    let d = outAng - backAng
    while (d <= 1e-14) d += 2 * Math.PI
    if (d < bestD) {
      bestD = d
      best = w
    }
  }
  return best
}

/**
 * @param {string} u
 * @param {string} v
 * @param {Map<string, string[]>} adj
 * @param {Map<string, { x: number; y: number }>} pmap
 * @returns {string[] | null} vertex ids of closed walk (no duplicate closing vertex)
 */
function walkFaceFromDirectedEdge(u, v, adj, pmap) {
  const start = u
  const ring = [u, v]
  let prev = u
  let cur = v
  const maxSteps = Math.max(500, adj.size * 8)
  for (let n = 0; n < maxSteps; n++) {
    const next = nextOnFace(prev, cur, adj, pmap)
    if (next == null) return null
    if (next === start && ring.length >= 3) {
      return ring
    }
    ring.push(next)
    prev = cur
    cur = next
  }
  return null
}

/** Same cyclic vertex set → same key (for deduping fills vs explicit polygons). */
export function canonicalFaceKey(ids) {
  if (ids.length < 3) return ''
  const n = ids.length
  const rots = []
  for (let o = 0; o < n; o++) {
    rots.push(
      [...ids.slice(o), ...ids.slice(0, o)].join('\0'),
    )
  }
  const rev = [...ids].reverse()
  for (let o = 0; o < n; o++) {
    rots.push(
      [...rev.slice(o), ...rev.slice(0, o)].join('\0'),
    )
  }
  return rots.sort()[0]
}

/**
 * @param {{ id: string; x: number; y: number }[]} points
 * @param {{ id: string; a: string; b: string }[]} segments
 * @returns {string[][]} list of vertex id rings (CCW), unique, reasonable area
 */
export function computeSegmentFaceRings(points, segments) {
  const pmap = new Map((points ?? []).map((p) => [p.id, p]))
  const adj = new Map()
  for (const s of segments ?? []) {
    if (s.construction) continue
    if (!pmap.has(s.a) || !pmap.has(s.b)) continue
    if (!adj.has(s.a)) adj.set(s.a, [])
    if (!adj.has(s.b)) adj.set(s.b, [])
    adj.get(s.a).push(s.b)
    adj.get(s.b).push(s.a)
  }
  for (const [k, v] of adj) {
    adj.set(k, [...new Set(v)])
  }

  const seen = new Set()
  const out = []

  for (const s of segments ?? []) {
    if (s.construction) continue
    if (!pmap.has(s.a) || !pmap.has(s.b)) continue
    for (const [u, v] of [
      [s.a, s.b],
      [s.b, s.a],
    ]) {
      const ekey = `${u}>${v}`
      if (seen.has(ekey)) continue
      const ring = walkFaceFromDirectedEdge(u, v, adj, pmap)
      if (!ring || ring.length < 3) continue
      const verts = ring.map((id) => pmap.get(id)).filter(Boolean)
      const a = Math.abs(polygonArea(verts))
      if (a < MIN_AREA || a > MAX_AREA) continue
      const ck = canonicalFaceKey(ring)
      if (seen.has(ck)) continue
      seen.add(ck)
      for (let i = 0; i < ring.length; i++) {
        const a0 = ring[i]
        const b0 = ring[(i + 1) % ring.length]
        seen.add(`${a0}>${b0}`)
      }
      out.push(ring)
    }
  }
  return out
}

/**
 * @param {object} data workspace
 * @param {number} wx
 * @param {number} wy
 * @returns {string[] | null} vertex ring
 */
export function findSegmentFaceRingContainingPoint(data, wx, wy) {
  const pmap = new Map((data.points ?? []).map((p) => [p.id, p]))
  const rings = computeSegmentFaceRings(data.points ?? [], data.segments ?? [])
  for (const ring of rings) {
    const verts = ring.map((id) => pmap.get(id)).filter(Boolean)
    if (verts.length >= 3 && pointInPolygon(wx, wy, verts)) return ring
  }
  return null
}