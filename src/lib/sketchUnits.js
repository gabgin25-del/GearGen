/**
 * Document/display units vs internal sketch coordinates (millimeters).
 * All geometry and driving dimension values are stored in mm.
 */

/** @typedef {'mm' | 'inch' | 'cm' | 'm' | 'ft' | 'custom'} UnitPreset */

/**
 * @typedef {{
 *   preset: UnitPreset
 *   customLabel: string
 *   customMmPerUnit: number
 * }} DocumentUnits
 */

export const DEFAULT_DOCUMENT_UNITS = /** @type {const} */ ({
  preset: 'mm',
  customLabel: 'cu',
  customMmPerUnit: 1,
})

const INCH_MM = 25.4

/**
 * Millimeters per one unit shown in the UI for the given document unit spec.
 */
export function mmPerDisplayUnit(spec) {
  switch (spec.preset) {
    case 'mm':
      return 1
    case 'inch':
      return INCH_MM
    case 'cm':
      return 10
    case 'm':
      return 1000
    case 'ft':
      return 12 * INCH_MM
    case 'custom': {
      const s = spec.customMmPerUnit
      return Number.isFinite(s) && s > 0 ? s : 1
    }
    default:
      return 1
  }
}

/** Short suffix for dimension labels (e.g. mm, in). */
export function displaySuffix(spec) {
  if (spec.preset === 'custom') {
    const t = (spec.customLabel ?? '').trim()
    return t.length > 0 ? t : 'cu'
  }
  switch (spec.preset) {
    case 'mm':
      return 'mm'
    case 'inch':
      return 'in'
    case 'cm':
      return 'cm'
    case 'm':
      return 'm'
    case 'ft':
      return 'ft'
    default:
      return 'mm'
  }
}

export function worldMmToDisplay(mm, spec) {
  return mm / mmPerDisplayUnit(spec)
}

export function displayToWorldMm(value, spec) {
  return value * mmPerDisplayUnit(spec)
}

export function formatLengthMmForDisplay(mm, spec, fractionDigits = 2) {
  const v = worldMmToDisplay(mm, spec)
  if (!Number.isFinite(mm)) return '—'
  return v.toFixed(fractionDigits)
}

/** Preset options for settings UI. */
export const UNIT_PRESET_OPTIONS = [
  { id: 'mm', label: 'Millimeters (mm)' },
  { id: 'inch', label: 'Inches (in)' },
  { id: 'cm', label: 'Centimeters (cm)' },
  { id: 'm', label: 'Meters (m)' },
  { id: 'ft', label: 'Feet (ft)' },
  { id: 'custom', label: 'Custom (scale vs mm)' },
]
