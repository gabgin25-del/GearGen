import {
  classifyLinearDimensionProjection,
  linearDimensionOffsetForProjection,
  linearDistanceValueForProjection,
} from './dimensionGeometry.js'
import {
  DEFAULT_DOCUMENT_UNITS,
  formatLengthMmForDisplay,
  worldMmToDisplay,
} from './sketchUnits.js'

/**
 * Commit a driving dimension from placement draft and open the value editor.
 * Used for dimension tool: single-step placement (no extra "placement" click).
 *
 * @param {{
 *   pl: object
 *   wx: number
 *   wy: number
 *   clientX: number
 *   clientY: number
 *   containerRect: DOMRect | undefined | null
 *   commit: (fn: (d: object) => object) => void
 *   nextId: (prefix: string) => string
 *   setDimEdit: (v: object | null | ((p: object | null) => object | null)) => void
 *   canOpenEditor: boolean
 *   labelDrawOptions: object | undefined
 *   clampPopover?: (left: number, top: number) => { left: number; top: number }
 * }} o
 */
export function completeDrivingDimensionPlacement(o) {
  const {
    pl,
    wx,
    wy,
    clientX,
    clientY,
    containerRect,
    commit,
    nextId,
    setDimEdit,
    canOpenEditor,
    labelDrawOptions,
    clampPopover,
  } = o

  const ldo = labelDrawOptions ?? {}
  const du = ldo.documentUnits ?? DEFAULT_DOCUMENT_UNITS

  const popupLeftTop = () => {
    if (!containerRect) return { left: 12, top: 48 }
    let left = clientX - containerRect.left + 12
    let top = clientY - containerRect.top - 8
    if (clampPopover) {
      const c = clampPopover(left, top)
      left = c.left
      top = c.top
    }
    return { left, top }
  }

  if (pl.dimType === 'distance' && pl.ax != null) {
    const dk = pl.distanceKind
    const smart =
      dk === 'pointPoint' || dk === 'segment' || dk === 'pointLine'
    const proj = smart
      ? classifyLinearDimensionProjection(
          wx,
          wy,
          pl.ax,
          pl.ay,
          pl.bx,
          pl.by,
        )
      : 'aligned'
    const offsetWorld = linearDimensionOffsetForProjection(
      wx,
      wy,
      pl.ax,
      pl.ay,
      pl.bx,
      pl.by,
      proj,
    )
    const value = linearDistanceValueForProjection(
      pl.ax,
      pl.ay,
      pl.bx,
      pl.by,
      proj,
    )
    const dimId = nextId('dim')
    commit((d) => {
      const dims = d.dimensions ?? []
      const row = {
        id: dimId,
        type: 'distance',
        value,
        targets: pl.targets,
        distanceKind: pl.distanceKind ?? 'segment',
        offsetWorld,
        linearProjection: proj,
      }
      return { ...d, dimensions: [...dims, row] }
    })
    if (canOpenEditor && containerRect) {
      const d0 =
        value != null && Number.isFinite(value)
          ? String(worldMmToDisplay(value, du))
          : ''
      const { left, top } = popupLeftTop()
      setDimEdit({
        id: dimId,
        dimType: 'distance',
        editInDegrees: false,
        left,
        top,
        draft: d0,
        baselineDraft: d0,
        openKey: Date.now(),
      })
    }
    return
  }

  if (pl.dimType === 'angle') {
    const dimIdAng = nextId('dim')
    const showDegPl = ldo.showAngleDegrees !== false
    commit((d) => {
      const dims = d.dimensions ?? []
      if (
        dims.some(
          (dm) =>
            dm.type === 'angle' &&
            dm.targets?.length === 2 &&
            dm.targets[0]?.id === pl.targets[0].id &&
            dm.targets[1]?.id === pl.targets[1].id,
        )
      ) {
        return d
      }
      return {
        ...d,
        dimensions: [
          ...dims,
          {
            id: dimIdAng,
            type: 'angle',
            value: pl.value,
            targets: pl.targets,
          },
        ],
      }
    })
    if (canOpenEditor && containerRect) {
      const v0 = pl.value
      const dAng =
        v0 != null && Number.isFinite(v0)
          ? showDegPl
            ? String((v0 * 180) / Math.PI)
            : String(v0)
          : ''
      const { left, top } = popupLeftTop()
      setDimEdit({
        id: dimIdAng,
        dimType: 'angle',
        editInDegrees: showDegPl,
        left,
        top,
        draft: dAng,
        baselineDraft: dAng,
        openKey: Date.now(),
      })
    }
    return
  }

  if (pl.dimType === 'radius') {
    const dimIdR = nextId('dim')
    commit((d) => {
      const dims = d.dimensions ?? []
      if (
        dims.some(
          (dm) =>
            dm.type === 'radius' && dm.targets?.[0] === pl.targets[0],
        )
      ) {
        return d
      }
      const row = {
        id: dimIdR,
        type: 'radius',
        value: pl.value,
        targets: pl.targets,
        leaderAngle: pl.leaderAngle ?? 0,
        splineCurvature: !!pl.splineCurvature,
        ...(pl.splineCurvature
          ? {
              dimCx: pl.cx,
              dimCy: pl.cy,
              dimR: pl.value,
            }
          : {}),
      }
      return { ...d, dimensions: [...dims, row] }
    })
    if (canOpenEditor && containerRect) {
      const vr = pl.value
      const dR =
        vr != null && Number.isFinite(vr)
          ? String(worldMmToDisplay(vr, du))
          : ''
      const { left, top } = popupLeftTop()
      setDimEdit({
        id: dimIdR,
        dimType: 'radius',
        editInDegrees: false,
        left,
        top,
        draft: dR,
        baselineDraft: dR,
        openKey: Date.now(),
      })
    }
    return
  }

  if (pl.dimType === 'diameter') {
    const dimIdD = nextId('dim')
    commit((d) => {
      const dims = d.dimensions ?? []
      if (
        dims.some(
          (dm) =>
            dm.type === 'diameter' &&
            dm.targets?.[0] === pl.targets[0],
        )
      ) {
        return d
      }
      return {
        ...d,
        dimensions: [
          ...dims,
          {
            id: dimIdD,
            type: 'diameter',
            value: pl.value,
            targets: pl.targets,
            leaderAngle: pl.leaderAngle ?? 0,
          },
        ],
      }
    })
    if (canOpenEditor && containerRect) {
      const vd = pl.value
      const dD =
        vd != null && Number.isFinite(vd)
          ? String(worldMmToDisplay(vd, du))
          : ''
      const { left, top } = popupLeftTop()
      setDimEdit({
        id: dimIdD,
        dimType: 'diameter',
        editInDegrees: false,
        left,
        top,
        draft: dD,
        baselineDraft: dD,
        openKey: Date.now(),
      })
    }
  }
}
