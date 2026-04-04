import { ArrowLeft } from 'lucide-react'

export function HelpPage() {
  return (
    <div className="min-h-dvh bg-gg-workspace text-gg-text">
      <header className="border-b border-gg-border bg-gg-sidebar/40 px-4 py-3">
        <a
          href="#"
          className="inline-flex items-center gap-2 text-[13px] text-gg-accent hover:underline"
        >
          <ArrowLeft className="size-4" strokeWidth={2} aria-hidden />
          Back to canvas
        </a>
        <h1 className="mt-2 text-lg font-medium tracking-tight">
          Splines & curves — how it works
        </h1>
      </header>
      <article className="mx-auto max-w-2xl space-y-6 px-4 py-6 text-[14px] leading-relaxed text-gg-muted">
        <section className="space-y-2 text-gg-text">
          <h2 className="text-[15px] font-medium text-gg-text">Spline tool</h2>
          <p>
            Click to place <strong className="text-gg-text">knots</strong>{' '}
            (control points). The <strong className="text-gg-text">first</strong>{' '}
            knot is drawn in a distinct color so you can snap the last point
            near it to <strong className="text-gg-text">close</strong> the loop.
            You do <em>not</em> need the &quot;Closed&quot; checkbox on to close
            — with three or more knots, click near the first knot to finish a
            closed curve.
          </p>
          <p>
            <strong className="text-gg-text">Enter</strong> finishes an{' '}
            <strong className="text-gg-text">open</strong> curve (endpoints not
            joined). <strong className="text-gg-text">Escape</strong> commits
            the curve as geometry too: if the first and last knots are close in
            space, the spline is treated as <strong className="text-gg-text">closed</strong>{' '}
            and can be filled (when fill options are on).
          </p>
        </section>
        <section className="space-y-2 text-gg-text">
          <h2 className="text-[15px] font-medium text-gg-text">
            Curve types (toolbar chips)
          </h2>
          <ul className="list-inside list-disc space-y-2 text-gg-muted">
            <li>
              For straight segments through vertices, use the{' '}
              <strong className="text-gg-text">Polygon</strong> tool in the
              Shapes ribbon (open or closed).
            </li>
            <li>
              <strong className="text-gg-text">Catmull–Rom / chordal</strong> —
              smooth curve that passes <em>through</em> every knot.
            </li>
            <li>
              <strong className="text-gg-text">Natural cubic</strong> — smooth
              through knots (open ends); closed uses Catmull–Rom style.
            </li>
            <li>
              <strong className="text-gg-text">Uniform B-spline</strong> — the
              curve usually does <em>not</em> pass through the knots. Knots form
              a <strong className="text-gg-text">control cage</strong>; the
              dashed polygon in the canvas shows that cage (like Rhino / Blender).
            </li>
            <li>
              <strong className="text-gg-text">Quadratic A–H–A</strong> — pattern
              anchor, handle, anchor, … handles sit off the curve and pull it.
            </li>
            <li>
              <strong className="text-gg-text">Cubic A–H–H–A</strong> — Bézier
              spans with two handles between anchors.
            </li>
          </ul>
        </section>
        <section className="space-y-2 text-gg-text">
          <h2 className="text-[15px] font-medium text-gg-text">Fill</h2>
          <p>
            Closed splines can show a translucent fill. Use{' '}
            <strong className="text-gg-text">Fill closed spline loops</strong>{' '}
            in settings so loops closed by snapping or by Escape (when ends
            meet) pick up the fill tint. You can still toggle fill on a selected
            spline in the gear menu.
          </p>
        </section>
      </article>
    </div>
  )
}
