const POS_TOL = 0.02

/**
 * @param {object} data
 * @param {string} pointId
 * @param {string | null} segmentId
 * @param {(d: object, c: object) => { ok: boolean; data?: object }} tryCommit
 * @param {() => string} nextCoId
 */
export function tryPointOnSegmentConstraint(data, pointId, segmentId, tryCommit, nextCoId) {
  if (!segmentId) return data
  const co = {
    id: nextCoId(),
    type: 'pointOnSegment',
    targets: [
      { kind: 'point', id: pointId },
      { kind: 'segment', id: segmentId },
    ],
  }
  const r = tryCommit(data, co)
  return r.ok ? r.data : data
}

/**
 * Axis / origin auto-constraints after placing a point.
 * @param {object} data
 * @param {string} pointId
 * @param {{ x: number; y: number }} axisOrigin
 * @param {(d: object, c: object) => { ok: boolean; data?: object }} tryCommit
 * @param {() => string} nextCoId
 */
export function tryAxisOriginAutoConstraints(
  data,
  pointId,
  axisOrigin,
  tryCommit,
  nextCoId,
) {
  const p = data.points.find((q) => q.id === pointId)
  if (!p) return data
  const ox = axisOrigin?.x ?? 0
  const oy = axisOrigin?.y ?? 0
  let d = data

  const tryOne = (co) => {
    const r = tryCommit(d, co)
    if (r.ok) d = r.data
  }

  if (Math.abs(p.x) < POS_TOL && Math.abs(p.y) < POS_TOL) {
    tryOne({
      id: nextCoId(),
      type: 'fixOrigin',
      targets: [{ kind: 'point', id: pointId }],
    })
    return d
  }

  if (Math.hypot(p.x - ox, p.y - oy) < POS_TOL) {
    tryOne({
      id: nextCoId(),
      type: 'anchorAt',
      targets: [{ kind: 'point', id: pointId }],
      x: ox,
      y: oy,
    })
    return d
  }

  if (Math.abs(p.y - oy) < POS_TOL) {
    tryOne({
      id: nextCoId(),
      type: 'lockCoordY',
      targets: [{ kind: 'point', id: pointId }],
      value: oy,
    })
  }

  if (Math.abs(p.x - ox) < POS_TOL) {
    tryOne({
      id: nextCoId(),
      type: 'lockCoordX',
      targets: [{ kind: 'point', id: pointId }],
      value: ox,
    })
  }

  if (Math.abs(p.x) < POS_TOL) {
    tryOne({
      id: nextCoId(),
      type: 'lockCoordX',
      targets: [{ kind: 'point', id: pointId }],
      value: 0,
    })
  }

  if (Math.abs(p.y) < POS_TOL) {
    tryOne({
      id: nextCoId(),
      type: 'lockCoordY',
      targets: [{ kind: 'point', id: pointId }],
      value: 0,
    })
  }

  return d
}
