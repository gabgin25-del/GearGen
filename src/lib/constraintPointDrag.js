/**
 * Coincident clusters and anchor locks for persistent multi-point dragging.
 */

class UnionFind {
  constructor() {
    /** @type {Map<string, string>} */
    this.p = new Map()
  }
  /** @param {string} x */
  find(x) {
    if (!this.p.has(x)) this.p.set(x, x)
    const px = this.p.get(x)
    if (px === x) return x
    const r = this.find(px)
    this.p.set(x, r)
    return r
  }
  /** @param {string} a @param {string} b */
  union(a, b) {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra !== rb) this.p.set(ra, rb)
  }
}

/**
 * @param {object} data
 * @param {string} pointId
 * @returns {Set<string>}
 */
export function pointIdsCoincidentCluster(data, pointId) {
  const uf = new UnionFind()
  for (const c of data.constraints ?? []) {
    if (c.type !== 'coincident') continue
    const t = c.targets ?? []
    if (
      t.length === 2 &&
      t[0].kind === 'point' &&
      t[1].kind === 'point'
    ) {
      uf.union(t[0].id, t[1].id)
    }
  }
  const root = uf.find(pointId)
  const out = new Set()
  for (const p of data.points) {
    if (uf.find(p.id) === root) out.add(p.id)
  }
  return out
}

/**
 * @param {object} data
 * @param {string} pointId
 */
export function isPointFixedToWorldOrigin(data, pointId) {
  for (const c of data.constraints ?? []) {
    if (c.type !== 'fixOrigin') continue
    const t = c.targets ?? []
    if (
      t.length === 1 &&
      t[0].kind === 'point' &&
      t[0].id === pointId
    ) {
      return true
    }
  }
  return false
}

/**
 * @param {object} data
 * @param {Set<string>} clusterIds
 */
export function moveCoincidentClusterByDelta(data, clusterIds, dx, dy) {
  const set = clusterIds
  const points = data.points.map((p) =>
    set.has(p.id) ? { ...p, x: p.x + dx, y: p.y + dy } : p,
  )
  const pmap = new Map(points.map((p) => [p.id, p]))
  return {
    ...data,
    points,
    circles: data.circles.map((c) => {
      if (!c.centerId || !set.has(c.centerId)) return c
      const pt = pmap.get(c.centerId)
      return pt ? { ...c, cx: pt.x, cy: pt.y } : c
    }),
  }
}
