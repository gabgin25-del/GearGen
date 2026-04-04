/**
 * @param {{ cx?: number; cy?: number; r: number; centerId?: string | null }} c
 * @param {Map<string, { x: number; y: number }>} pointById
 * @returns {{ x: number; y: number }}
 */
export function resolveCircleCenter(c, pointById) {
  if (c.centerId) {
    const p = pointById.get(c.centerId)
    if (p) return { x: p.x, y: p.y }
  }
  return { x: c.cx ?? 0, y: c.cy ?? 0 }
}

/**
 * @param {{ cx?: number; cy?: number; r: number; centerId?: string | null; [k: string]: unknown }} c
 * @param {Map<string, { x: number; y: number }>} pointById
 */
export function circleWithResolvedCenter(c, pointById) {
  const p = resolveCircleCenter(c, pointById)
  return { ...c, cx: p.x, cy: p.y }
}
