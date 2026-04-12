---
name: y14-5-drawing-ui-audit
description: >-
  Audits dimension and leader rendering in UI/canvas code against ANSI/ASME-style
  engineering graphics used with Y14.5 workflows (extension gap ~1.5 mm, arrowhead
  length:width 3:1, extension past dimension line, leader termination and shoulders).
  Use when reviewing or refactoring components like DimensionRenderer.js, sketch
  overlays, or any code that draws dimensions, leaders, or GD&T-like graphics.
---

# Y14.5-aligned drawing UI audit

Perform a **read-only** review of the cited files. Do not refactor unless the user asks. Focus on whether the **implemented geometry** matches professional drafting conventions commonly paired with **ASME Y14.5** (GD&T) documentation—especially line work drawn in **world/screen space** with zoom.

> **Scope note:** Y14.5 is primarily definitions and symbols for dimensioning and tolerancing. **Line weights, gaps, arrow proportions, and leader rules** are often specified in related drafting standards (e.g. ASME Y14.2) or company CAD standards. Treat the checklist below as this project’s **ANSI-style** bar unless the user specifies otherwise.

## Primary references in this repo

When present, compare behavior to the constants and comments in `src/lib/DimensionRenderer.js`:

- `ANSI_EXT_GAP_WORLD` — visible gap between object/feature and start of extension line (~**1.5** world units ≈ **1.5 mm** when 1 unit = 1 mm).
- `ANSI_EXT_OVERSHOOT_WORLD` — extension beyond the dimension line (~**3** mm equivalent).
- Arrow geometry: **length : width = 3 : 1** (e.g. `ARROW_LEN` and `ARROW_WIDTH = ARROW_LEN / 3`), filled arrowheads as appropriate.

## Audit checklist

Work through these in order. Cite **file paths and symbols** (function names, constants) when reporting issues.

### 1. Extension line gap (“vertex gap”)

- [ ] Extension lines **do not** start flush on the visible object outline at a corner/vertex; there is a **small, consistent gap** (target **~1.5 mm** in world space when that mapping applies).
- [ ] Gap is **consistent** across dimensions in the same view, not mixed with zero-gap unless explicitly a different style.

### 2. Arrowheads (3:1)

- [ ] Closed/filled arrowheads use approximately **3:1** length-to-width (or documented equivalent).
- [ ] Arrow size **scales with zoom** (`zoom` or equivalent) so on-screen proportions stay stable, not pixel-fixed heads that violate 3:1 at some zoom levels.
- [ ] Angular and linear dimensions use the **same** arrow style unless the standard calls for an exception (small arcs, etc.).

### 3. Extension past dimension line

- [ ] Extension lines extend **past** the dimension line by a short, consistent amount (target **~3 mm** equivalent where applicable), not stopping flush at the dimension line.

### 4. Dimension line and text

- [ ] Dimension line is **thin** relative to visible outlines; breaks for text do not leave ambiguous stubs.
- [ ] Text placement respects **readability** (aligned with dimension, not colliding with leaders or geometry).

### 5. Leader lines

- [ ] Leaders approach notes/symbols with a **clear landing** (e.g. horizontal shoulder where that style is used).
- [ ] Arrow or dot termination is **on the feature** or as required by the drawing style; no ambiguous mid-air endpoints.
- [ ] Leaders **do not** cross dimension lines unnecessarily; when crossing is unavoidable, behavior matches the product’s stated rules (e.g. breaks).

### 6. General professional graphics

- [ ] Line weights and alpha distinguish **construction vs. dimension** vs. **geometry** where the product intends it.
- [ ] No **clutter**: repeated stacking, illegible overlaps, or dimensions that obscure the feature they reference.

## Output format

Produce a short report:

1. **Summary** — compliant / partial / needs work.
2. **Pass list** — bullet items verified with code references.
3. **Findings** — each with **severity** (blocker / major / minor), **location**, **expected vs observed**, **fix hint** (one sentence).
4. **Optional** — items that cannot be verified without running the app (e.g. exact pixel gaps at a given DPI).

Do not claim literal “ASME Y14.5 clause X” compliance unless the user provides the standard text; phrase as **alignment with common ANSI/ASME drafting practice** and this repo’s constants.
