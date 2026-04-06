/**
 * Trim straight segments at intersections (click removes the span under the cursor).
 */

const EPS = 1e-7

/**
 * @param {number} ax
 * @param {number} ay
 * @param {number} bx
 * @param {number} by
 * @param {number} cx
 * @param {number} cy
 * @param {number} dx
 * @param {number} dy
 * @returns {{ t: number; u: number } | null}
 */
function segSegIntersectParam(ax, ay, bx, by, cx, cy, dx, dy) {
  const rx = bx - ax
  const ry = by - ay
  const sx = dx - cx
  const sy = dy - cy
  const denom = rx * sy - ry * sx
  if (Math.abs(denom) < 1e-14) return null
  const qx = cx - ax
  const qy = cy - ay
  const t = (qx * sy - qy * sx) / denom
  const u = (qx * ry - qy * rx) / denom
  return { t, u }
}

function clamp01(t) {
  return Math.max(0, Math.min(1, t))
}

function projectParam(px, py, ax, ay, bx, by) {
  const abx = bx - ax
  const aby = by - ay
  const len2 = abx * abx + aby * aby
  if (len2 < 1e-18) return 0
  return clamp01(((px - ax) * abx + (py - ay) * aby) / len2)
}

function lerpPt(ax, ay, bx, by, t) {
  return { x: ax + t * (bx - ax), y: ay + t * (by - ay) }
}

function segmentUsedAsPolygonBoundary(data, segId) {
  for (const poly of data.polygons ?? []) {
    if (poly.boundarySegmentIds?.includes(segId)) return true
  }
  return false
}

/**
 * Remove the open interval (tLo, tHi) along seg AB; keep [0,tLo] and [tHi,1].
 * @param {object} data
 * @param {string} segId
 * @param {number} wx
 * @param {number} wy
 * @param {(p: string) => string} nextId
 * @param {number} [worldTol]
 * @returns {object | null}
 */
export function trimSegmentAtClick(data, segId, wx, wy, nextId, worldTol = 1) {
  if (segmentUsedAsPolygonBoundary(data, segId)) return null
  const seg = (data.segments ?? []).find((s) => s.id === segId)
  if (!seg) return null
  const pmap = new Map((data.points ?? []).map((p) => [p.id, p]))
  const pa = pmap.get(seg.a)
  const pb = pmap.get(seg.b)
  if (!pa || !pb) return null
  const ax = pa.x
  const ay = pa.y
  const bx = pb.x
  const by = pb.y
  const chord = Math.hypot(bx - ax, by - ay)
  if (chord < 1e-9) return null

  const ptol = Math.max(EPS * 100, worldTol * 0.08)
  const ts = [0, 1]
  for (const o of data.segments ?? []) {
    if (o.id === seg.id) continue
    const pc = pmap.get(o.a)
    const pd = pmap.get(o.b)
    if (!pc || !pd) continue
    const hit = segSegIntersectParam(
      ax,
      ay,
      bx,
      by,
      pc.x,
      pc.y,
      pd.x,
      pd.y,
    )
    if (
      !hit ||
      hit.t <= ptol ||
      hit.t >= 1 - ptol ||
      hit.u <= ptol ||
      hit.u >= 1 - ptol
    ) {
      continue
    }
    ts.push(hit.t)
  }
  ts.sort((a, b) => a - b)
  const uniq = []
  for (const t of ts) {
    if (!uniq.length || Math.abs(t - uniq[uniq.length - 1]) > ptol) uniq.push(t)
  }

  if (uniq.length < 2) return null

  const t0 = projectParam(wx, wy, ax, ay, bx, by)
  let idx = -1
  for (let i = 0; i < uniq.length - 1; i++) {
    const a0 = uniq[i]
    const b0 = uniq[i + 1]
    if (t0 + 1e-12 >= a0 && t0 - 1e-12 <= b0) {
      if (b0 - a0 <= ptol * 2) continue
      if (t0 - a0 < ptol || b0 - t0 < ptol) continue
      idx = i
      break
    }
  }
  if (idx < 0) return null

  const tL = uniq[idx]
  const tR = uniq[idx + 1]

  const PL = lerpPt(ax, ay, bx, by, tL)
  const PR = lerpPt(ax, ay, bx, by, tR)

  const newPoints = []
  function nearPointId(x, y) {
    for (const p of [...(data.points ?? []), ...newPoints]) {
      if (Math.hypot(p.x - x, p.y - y) <= ptol) return p.id
    }
    return null
  }
  function ensurePoint(x, y) {
    const ex = nearPointId(x, y)
    if (ex) return ex
    const id = nextId('p')
    newPoints.push({ id, x, y })
    return id
  }

  const idA = seg.a
  const idB = seg.b
  let idL = idA
  if (tL > ptol) idL = ensurePoint(PL.x, PL.y)
  let idR = idB
  if (tR < 1 - ptol) idR = ensurePoint(PR.x, PR.y)

  const newSegs = []
  if (idL !== idA && Math.hypot(PL.x - ax, PL.y - ay) > ptol) {
    newSegs.push({
      id: nextId('seg'),
      a: idA,
      b: idL,
      geoRegistered: true,
    })
  }
  if (idR !== idB && Math.hypot(bx - PR.x, by - PR.y) > ptol) {
    newSegs.push({
      id: nextId('seg'),
      a: idR,
      b: idB,
      geoRegistered: true,
    })
  }

  const nextSegments = (data.segments ?? []).filter((s) => s.id !== seg.id)
  const nextConstraints = (data.constraints ?? []).filter((c) => {
    const tg = c.targets ?? []
    return !tg.some((t) => t.kind === 'segment' && t.id === segId)
  })

  return {
    ...data,
    points: [...(data.points ?? []), ...newPoints],
    segments: [...nextSegments, ...newSegs],
    constraints: nextConstraints,
  }
}
