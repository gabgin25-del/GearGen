/** ~target spacing between axis ticks on screen (CSS px). */
export const AXIS_TICK_TARGET_PX = 72

/**
 * @param {number} rough
 * @returns {number}
 */
export function niceDecimalStep(rough) {
  if (!Number.isFinite(rough) || rough <= 0) return 1
  const exp = Math.floor(Math.log10(rough))
  const base = 10 ** exp
  const fr = rough / base
  let niceFr = 1
  if (fr <= 1) niceFr = 1
  else if (fr <= 2) niceFr = 2
  else if (fr <= 5) niceFr = 5
  else niceFr = 10
  return niceFr * base
}

/**
 * @param {number} minWX
 * @param {number} maxWX
 * @param {number} widthPx
 */
export function pickDecimalTickStep(minWX, maxWX, widthPx) {
  const span = maxWX - minWX
  const denom = Math.max(6, widthPx / AXIS_TICK_TARGET_PX)
  const rough = span / denom
  return niceDecimalStep(rough)
}

const PI_STEPS = [
  Math.PI / 6,
  Math.PI / 4,
  Math.PI / 3,
  Math.PI / 2,
  Math.PI,
  2 * Math.PI,
]

/**
 * Pick a π-friendly step so ticks are roughly `targetPx` apart on screen.
 * @param {number} minWX
 * @param {number} maxWX
 * @param {number} widthPx
 * @param {number} zoom
 */
export function pickRadiansTickStep(minWX, maxWX, widthPx, zoom) {
  const span = maxWX - minWX
  const denom = Math.max(6, widthPx / AXIS_TICK_TARGET_PX)
  const roughWorld = span / denom
  const roughScreen = roughWorld * (zoom || 1)
  for (const s of PI_STEPS) {
    if (s * (zoom || 1) >= roughScreen * 0.35) return s
  }
  return 2 * Math.PI
}

function gcd(a, b) {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y) {
    const t = y
    y = x % y
    x = t
  }
  return x || 1
}

/**
 * @param {number} coeff numeric multiple in front of π (e.g. 1/6 → π/6)
 */
function formatPiMultiple(coeff) {
  if (Math.abs(coeff) < 1e-9) return '0'
  const sign = coeff < 0 ? '-' : ''
  const c = Math.abs(coeff)
  for (const den of [1, 2, 3, 4, 6, 8, 12]) {
    const num = Math.round(c * den)
    if (Math.abs(c - num / den) < 1e-3) {
      if (den === 1)
        return num === 0 ? '0' : `${sign}${num === 1 ? '' : num}π`
      const g = gcd(num, den)
      const n2 = num / g
      const d2 = den / g
      if (d2 === 1) return `${sign}${n2 === 1 ? '' : n2}π`
      return `${sign}${n2 === 1 ? '' : n2}π/${d2}`
    }
  }
  return `${sign}${c.toFixed(2)}π`
}

/**
 * Format tick value in radians mode (multiples of the current step, π-based).
 * @param {number} x world coordinate
 * @param {number} step current tick step
 */
export function formatPiTickLabel(x, step) {
  const sp = step / Math.PI
  const xp = x / Math.PI
  const k = Math.round(xp / sp)
  if (Math.abs(xp - k * sp) > 1e-3) {
    return `${(x / Math.PI).toFixed(2)}π`
  }
  return formatPiMultiple(k * sp)
}

/**
 * @param {number} n integer: position is n·(π/6)
 */
export function formatSixthsOfPi(n) {
  return formatPiMultiple(n / 6)
}

/**
 * @param {number} x
 * @param {number} step
 * @param {'decimal' | 'radians_pi'} format
 */
export function formatAxisTickValue(x, step, format) {
  if (format === 'radians_pi') return formatPiTickLabel(x, step)
  const ax = Math.abs(x)
  const st = Math.abs(step)
  if (ax >= 1e6 || (ax > 0 && ax < 1e-4)) return x.toExponential(1)
  if (st >= 1) return String(Math.round(x))
  if (st >= 0.1) return String(Math.round(x * 10) / 10)
  if (st >= 0.01) return String(Math.round(x * 100) / 100)
  return x.toPrecision(3).replace(/\.?0+$/, '').replace(/\.$/, '')
}
