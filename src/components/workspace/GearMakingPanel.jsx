import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { useToast } from '../../context/ToastContext.jsx'

const STORAGE_PREFIX = 'geargen-gear-making-'

/**
 * Mechanical gear synthesis parameters and envelope generation entry point.
 */
function readGearMakingInitial() {
  try {
    const t = Number(localStorage.getItem(`${STORAGE_PREFIX}teeth`))
    const m = Number(localStorage.getItem(`${STORAGE_PREFIX}module`))
    const p = Number(localStorage.getItem(`${STORAGE_PREFIX}pressure`))
    return {
      teeth: Number.isFinite(t) && t >= 3 ? Math.round(t) : 24,
      module: Number.isFinite(m) && m > 0 ? m : 2,
      pressure:
        Number.isFinite(p) && p > 0 && p < 45 ? p : 20,
    }
  } catch {
    return { teeth: 24, module: 2, pressure: 20 }
  }
}

export function GearMakingPanel() {
  const id = useId()
  const toast = useToast()
  const initialGear = useMemo(() => readGearMakingInitial(), [])
  const [toothCount, setToothCount] = useState(initialGear.teeth)
  const [moduleMm, setModuleMm] = useState(initialGear.module)
  const [pressureDeg, setPressureDeg] = useState(initialGear.pressure)

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}teeth`, String(toothCount))
      localStorage.setItem(`${STORAGE_PREFIX}module`, String(moduleMm))
      localStorage.setItem(`${STORAGE_PREFIX}pressure`, String(pressureDeg))
    } catch {
      /* ignore */
    }
  }, [toothCount, moduleMm, pressureDeg])

  const clampTeeth = useCallback((n) => {
    if (!Number.isFinite(n)) return 24
    return Math.min(512, Math.max(3, Math.round(n)))
  }, [])

  const onGenerateEnvelope = useCallback(() => {
    const pitchDiameter = moduleMm * toothCount
    toast.show(
      `Envelope (preview): ${toothCount} teeth, module ${moduleMm} mm, pressure ${pressureDeg}° — pitch diameter ≈ ${pitchDiameter.toFixed(3)} mm. Full tooth profile synthesis will attach to the sketch pipeline next.`,
    )
  }, [toast, toothCount, moduleMm, pressureDeg])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-2 text-[12px] text-gg-text">
      <p className="text-[11px] leading-snug text-gg-muted">
        Standard gear parameters for mechanical synthesis. Envelope generation
        prepares rack and involute outlines for the workspace (terminal output
        is a preview until the profile builder is wired).
      </p>
      <div className="grid grid-cols-1 gap-2">
        <label className="flex flex-col gap-0.5" htmlFor={`${id}-teeth`}>
          <span className="text-[10px] font-medium uppercase tracking-wide text-gg-muted">
            Tooth count
          </span>
          <input
            id={`${id}-teeth`}
            type="number"
            min={3}
            max={512}
            step={1}
            value={toothCount}
            onChange={(e) => setToothCount(clampTeeth(Number(e.target.value)))}
            className="rounded-md border border-gg-border bg-gg-workspace px-2 py-1.5 tabular-nums text-gg-text"
          />
        </label>
        <label className="flex flex-col gap-0.5" htmlFor={`${id}-module`}>
          <span className="text-[10px] font-medium uppercase tracking-wide text-gg-muted">
            Module (mm)
          </span>
          <input
            id={`${id}-module`}
            type="number"
            min={0.1}
            max={100}
            step={0.1}
            value={moduleMm}
            onChange={(e) => {
              const v = Number(e.target.value)
              if (!Number.isFinite(v) || v <= 0) return
              setModuleMm(Math.min(100, Math.max(0.1, v)))
            }}
            className="rounded-md border border-gg-border bg-gg-workspace px-2 py-1.5 tabular-nums text-gg-text"
          />
        </label>
        <label className="flex flex-col gap-0.5" htmlFor={`${id}-pressure`}>
          <span className="text-[10px] font-medium uppercase tracking-wide text-gg-muted">
            Pressure angle (°)
          </span>
          <input
            id={`${id}-pressure`}
            type="number"
            min={10}
            max={35}
            step={0.5}
            value={pressureDeg}
            onChange={(e) => {
              const v = Number(e.target.value)
              if (!Number.isFinite(v)) return
              setPressureDeg(Math.min(35, Math.max(10, v)))
            }}
            className="rounded-md border border-gg-border bg-gg-workspace px-2 py-1.5 tabular-nums text-gg-text"
          />
        </label>
      </div>
      <button
        type="button"
        onClick={onGenerateEnvelope}
        className="rounded-md border border-gg-border bg-gg-sidebar-hover px-3 py-2 text-[12px] font-medium text-gg-text transition-colors hover:border-gg-accent/50 hover:text-gg-accent"
      >
        Generate envelope (preview)
      </button>
    </div>
  )
}
