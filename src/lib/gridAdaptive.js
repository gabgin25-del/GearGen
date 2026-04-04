/**
 * Zoom-aware cartesian grid: increase step when zoomed out so minor lines stay
 * ~targetPx apart; fade minors when they would crowd.
 */

const TARGET_MINOR_PX = 26
const MIN_MINOR_PX = 14

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

  for (let i = 0; i < 14; i++) {
    const px = minor * z
    if (px >= TARGET_MINOR_PX) break
    const next = minor * 2
    if (next > span / 2 && span > 0) break
    minor = next
  }

  const minorPx = minor * z
  let minorAlpha = 1
  if (minorPx < MIN_MINOR_PX * 0.85) minorAlpha = 0
  else if (minorPx < MIN_MINOR_PX * 1.15) minorAlpha = 0.22
  else if (minorPx < TARGET_MINOR_PX * 0.78) minorAlpha = 0.45

  let major = minor * 5
  const majorPx = major * z
  if (majorPx > 220) {
    major = minor * 2
  }

  return { minor, major, minorAlpha }
}
