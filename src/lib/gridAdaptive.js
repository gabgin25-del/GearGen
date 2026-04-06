/**
 * Zoom-aware cartesian grid: increase step when zoomed out so minor lines stay
 * ~targetPx apart; fade minors when they would crowd.
 */

const TARGET_MINOR_PX = 26

/**
 * @param {number} minWX
 * @param {number} maxWX
 * @param {number} minWY
 * @param {number} maxWY
 * @param {number} zoom
 * @param {number} baseMinor user grid preference (floor)
 */
export function pickAdaptiveCartesianSteps(
  minWX,
  maxWX,
  minWY,
  maxWY,
  zoom,
  baseMinor,
) {
  const z = zoom || 1
  const span = Math.max(maxWX - minWX, maxWY - minWY, 1)
  let minor = Math.max(4, baseMinor)

  for (let i = 0; i < 50; i++) {
    const px = minor * z
    if (px >= TARGET_MINOR_PX) break
    const next = minor * 2
    if (next > span / 2 && span > 0) break
    minor = next
  }

  const minorAlpha = 1

  let major = minor * 5
  const majorPx = major * z
  if (majorPx > 220) {
    major = minor * 2
  }

  return { minor, major, minorAlpha }
}
