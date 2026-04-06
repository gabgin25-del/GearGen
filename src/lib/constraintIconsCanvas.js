/**
 * Stroke icons on canvas matching RelationsPanel (lucide-style), centered at origin.
 * Call inside ctx with scale(1/zoom) so one unit ≈ one screen pixel at anchor.
 */

const SW = 1.35

function stroke(ctx, draw) {
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = SW
  draw()
  ctx.restore()
}

/** @param {CanvasRenderingContext2D} ctx */
export function drawConstraintIconOnCanvas(ctx, type) {
  const s = 0.42
  ctx.scale(s, s)
  switch (type) {
    case 'fixOrigin':
      stroke(ctx, () => {
        ctx.beginPath()
        ctx.moveTo(0, 10)
        ctx.lineTo(0, -2)
        ctx.moveTo(-8, 2)
        ctx.quadraticCurveTo(-8, -8, 0, -10)
        ctx.quadraticCurveTo(8, -8, 8, 2)
        ctx.stroke()
      })
      break
    case 'equal':
      stroke(ctx, () => {
        ctx.beginPath()
        ctx.moveTo(-9, -3)
        ctx.lineTo(9, -3)
        ctx.moveTo(-9, 3)
        ctx.lineTo(9, 3)
        ctx.stroke()
      })
      break
    case 'parallel':
      stroke(ctx, () => {
        for (const x of [-5, 0, 5]) {
          ctx.beginPath()
          ctx.moveTo(x, -10)
          ctx.lineTo(x, 10)
          ctx.stroke()
        }
      })
      break
    case 'perpendicular':
      stroke(ctx, () => {
        ctx.beginPath()
        ctx.moveTo(-2, -10)
        ctx.lineTo(-2, 2)
        ctx.lineTo(10, 2)
        ctx.stroke()
      })
      break
    case 'tangent':
      stroke(ctx, () => {
        ctx.beginPath()
        ctx.moveTo(-10, 4)
        ctx.bezierCurveTo(-4, -8, 4, 8, 10, -4)
        ctx.stroke()
      })
      break
    case 'concentric':
      stroke(ctx, () => {
        ctx.beginPath()
        ctx.arc(0, 0, 5, 0, Math.PI * 2)
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(0, 0, 10, 0, Math.PI * 2)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(0, -2)
        ctx.lineTo(0, 2)
        ctx.moveTo(-2, 0)
        ctx.lineTo(2, 0)
        ctx.stroke()
      })
      break
    case 'coincident':
      stroke(ctx, () => {
        ctx.beginPath()
        ctx.moveTo(-8, -2)
        ctx.bezierCurveTo(-10, -10, 2, -10, 4, -2)
        ctx.bezierCurveTo(6, 4, -4, 4, -8, -2)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(4, 2)
        ctx.bezierCurveTo(6, -6, 10, -4, 8, 4)
        ctx.bezierCurveTo(6, 10, -2, 8, 4, 2)
        ctx.stroke()
      })
      break
    case 'collinear':
      stroke(ctx, () => {
        ctx.beginPath()
        ctx.moveTo(-11, 0)
        ctx.lineTo(11, 0)
        ctx.stroke()
      })
      break
    case 'horizontal':
      stroke(ctx, () => {
        ctx.beginPath()
        ctx.moveTo(-9, 0)
        ctx.lineTo(5, 0)
        ctx.moveTo(1, -3)
        ctx.lineTo(8, 0)
        ctx.lineTo(1, 3)
        ctx.stroke()
      })
      break
    case 'vertical':
      stroke(ctx, () => {
        ctx.beginPath()
        ctx.moveTo(0, -9)
        ctx.lineTo(0, 5)
        ctx.moveTo(-3, 1)
        ctx.lineTo(0, 8)
        ctx.lineTo(3, 1)
        ctx.stroke()
      })
      break
    case 'symmetric':
      stroke(ctx, () => {
        ctx.beginPath()
        ctx.moveTo(-9, -4)
        ctx.lineTo(-3, 0)
        ctx.lineTo(-9, 4)
        ctx.moveTo(9, -4)
        ctx.lineTo(3, 0)
        ctx.lineTo(9, 4)
        ctx.stroke()
      })
      break
    case 'similar':
      stroke(ctx, () => {
        ctx.beginPath()
        ctx.moveTo(-8, -6)
        ctx.lineTo(-2, 6)
        ctx.moveTo(2, -6)
        ctx.lineTo(8, 6)
        ctx.stroke()
      })
      break
    default:
      stroke(ctx, () => {
        ctx.beginPath()
        ctx.arc(0, 0, 3.5, 0, Math.PI * 2)
        ctx.stroke()
      })
  }
}
