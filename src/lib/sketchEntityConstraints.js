/**
 * Find sketch constraints and driving dimensions that reference an entity.
 */

import { RELATION_TYPE_OPTIONS } from '../hooks/useWorkspaceScene.js'

const REL_LABEL = Object.fromEntries(
  RELATION_TYPE_OPTIONS.map((o) => [o.id, o.label]),
)

/** Same numbering as on-canvas constraint badges (per type: 1, 2, …). */
export function buildConstraintTypeSerialMap(constraints) {
  const next = new Map()
  /** @type {Map<string, number>} */
  const serialById = new Map()
  for (const co of constraints ?? []) {
    const t = co.type
    const n = (next.get(t) ?? 0) + 1
    next.set(t, n)
    if (co.id) serialById.set(co.id, n)
  }
  return serialById
}

/**
 * @param {{ kind: string; id: string }} t
 * @param {string} kind
 * @param {string} id
 */
function targetMatches(t, kind, id) {
  if (!t || typeof t !== 'object') return false
  return t.kind === kind && t.id === id
}

/**
 * @param {unknown} t
 * @param {string} pointId
 */
function stringTargetIsPoint(t, pointId) {
  return typeof t === 'string' && t === pointId
}

/**
 * @param {object} dim
 * @param {string} kind
 * @param {string} id
 */
function dimensionTouchesEntity(dim, kind, id) {
  const targets = dim.targets ?? []
  for (const t of targets) {
    if (typeof t === 'string') {
      if (kind === 'point' && t === id) return true
      if ((kind === 'circle' || kind === 'arc') && t === id) return true
      continue
    }
    if (targetMatches(t, kind, id)) return true
  }
  return false
}

/**
 * @param {object} data workspace
 * @param {string} kind point | segment | circle | arc | polygon | spline | angle
 * @param {string} id
 */
export function constraintsInvolvingEntity(data, kind, id) {
  /** @type {{ id: string; category: 'constraint' | 'dimension'; type: string; label: string }[]} */
  const out = []
  for (const c of data.constraints ?? []) {
    const targets = c.targets ?? []
    let hit = false
    for (const t of targets) {
      if (targetMatches(t, kind, id)) {
        hit = true
        break
      }
      if (kind === 'point' && stringTargetIsPoint(t, id)) {
        hit = true
        break
      }
    }
    if (hit) {
      out.push({
        id: c.id,
        category: 'constraint',
        type: c.type,
        label: REL_LABEL[c.type] ?? c.type,
      })
    }
  }
  for (const dim of data.dimensions ?? []) {
    if (dimensionTouchesEntity(dim, kind, id)) {
      out.push({
        id: dim.id,
        category: 'dimension',
        type: dim.type,
        label: formatDimensionLabel(dim),
      })
    }
  }
  return out
}

function formatDimensionLabel(dim) {
  const t = dim.type
  if (t === 'distance') return 'Driving distance'
  if (t === 'angle') return 'Driving angle'
  if (t === 'radius') return 'Driving radius'
  if (t === 'diameter') return 'Driving diameter'
  return t ?? 'Dimension'
}
