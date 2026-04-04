export const DEFAULT_GRID_STEP = 20

/**
 * Snap world coordinates to a square grid when enabled.
 */
export function snapWorldToGrid(x, y, step, enabled) {
  if (!enabled || step == null || step <= 0) return { x, y }
  return {
    x: Math.round(x / step) * step,
    y: Math.round(y / step) * step,
  }
}
