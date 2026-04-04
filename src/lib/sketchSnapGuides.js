/**
 * Snap world position to axis lines through axisOrigin and to world (0,0).
 * @param {number} wx
 * @param {number} wy
 * @param {{ ox: number; oy: number; zoom: number; snapPx?: number; snapToOrigin?: boolean; snapToAxis?: boolean; snapWorldOrigin?: boolean }} opts
 */
export function snapWorldToSketchGuides(wx, wy, opts) {
  const {
    ox,
    oy,
    zoom,
    snapPx = 10,
    snapToOrigin = true,
    snapToAxis = true,
    snapWorldOrigin = true,
  } = opts
  const z = zoom || 1
  const tol = snapPx / z

  let x = wx
  let y = wy
  /** @type {{ origin?: boolean; axisX?: boolean; axisY?: boolean; worldOrigin?: boolean }} */
  const guides = {}

  if (snapWorldOrigin) {
    if (Math.abs(wx) <= tol && Math.abs(wy) <= tol) {
      x = 0
      y = 0
      guides.worldOrigin = true
      guides.axisX = true
      guides.axisY = true
      return { x, y, guides }
    }
    if (Math.abs(wx) <= tol) {
      x = 0
      guides.worldOrigin = true
    }
    if (Math.abs(wy) <= tol) {
      y = 0
      guides.worldOrigin = true
    }
  }

  if (snapToAxis) {
    if (Math.abs(wy - oy) <= tol) {
      y = oy
      guides.axisX = true
    }
    if (Math.abs(wx - ox) <= tol) {
      x = ox
      guides.axisY = true
    }
  }

  if (snapToOrigin) {
    if (Math.hypot(wx - ox, wy - oy) <= tol) {
      x = ox
      y = oy
      guides.origin = true
    }
  }

  return { x, y, guides }
}
