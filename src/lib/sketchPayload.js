/**
 * Flexible sketch book entry payload: native geometry and optional future slots.
 *
 * @typedef {{
 *   format?: string
 *   geometry?: object
 *   desmosState?: string | null
 *   meta?: Record<string, unknown>
 * }} SketchPayload
 */

/**
 * @param {SketchPayload | null | undefined} payload
 * @returns {object | null} workspace geometry clone-ready object
 */
export function geometryFromSketchPayload(payload) {
  if (!payload || typeof payload !== 'object') return null
  if (payload.geometry && typeof payload.geometry === 'object') {
    const base = { ...payload.geometry }
    if (
      base.desmosState == null &&
      Object.prototype.hasOwnProperty.call(payload, 'desmosState')
    ) {
      base.desmosState = payload.desmosState ?? null
    }
    return base
  }
  return null
}

/**
 * @param {string} format
 * @param {object} geometry
 * @param {{ desmosState?: string | null; meta?: Record<string, unknown> }} [extra]
 * @returns {SketchPayload}
 */
export function makeGearGenPayload(format, geometry, extra = {}) {
  return {
    format,
    geometry,
    desmosState: extra.desmosState ?? null,
    meta: extra.meta,
  }
}

/**
 * @param {object | null | undefined} data
 */
export function workspaceHasDrawableContent(data) {
  if (!data || typeof data !== 'object') return false
  return (
    (data.points?.length ?? 0) > 0 ||
    (data.segments?.length ?? 0) > 0 ||
    (data.polygons?.length ?? 0) > 0 ||
    (data.circles?.length ?? 0) > 0 ||
    (data.arcs?.length ?? 0) > 0 ||
    (data.splines?.length ?? 0) > 0 ||
    (data.strokes?.length ?? 0) > 0 ||
    (data.angles?.length ?? 0) > 0 ||
    (data.exactParametricCurves?.length ?? 0) > 0
  )
}
