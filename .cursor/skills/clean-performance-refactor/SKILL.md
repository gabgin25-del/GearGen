---
name: clean-performance-refactor
description: >-
  Simplifies complex logic and improves React render performance without
  changing behavior. Reduces prop drilling (context, composition, colocated
  hooks), splits heavy components, and stabilizes updates where it measurably
  helps. Use when refactoring files like src/lib/planeGcs/solvePlaneGcs.js or
  src/components/workspace/WorkspaceCanvas.jsx, or when the user asks for
  cleanliness, performance, fewer props, or fewer re-renders.
---

# Clean & performance refactor

## Role

Act as a **behavior-preserving** refactor agent: clarity and performance first; no feature work unless requested.

## Workflow

1. **Map the surface**: read the target file and main callers; list exported behavior (props, return values, side effects).
2. **Choose one theme per pass**: e.g. “reduce props through context” OR “split render-heavy subtree” OR “extract pure functions from solver path”—avoid mixing unrelated moves.
3. **Refactor**: apply the smallest change that achieves the theme; keep names stable unless renaming is the goal.
4. **Sanity-check**: same inputs → same outputs; geometry/solver code: preserve tolerances and call order into WASM/APIs.

## React specifics

- **Prop drilling**: default order of preference—(1) pass only what children need, (2) composition / render props, (3) focused context split by domain, (4) custom hooks colocated with the feature.
- **Re-renders**: split components; avoid inline object/array literals in hot paths when they force child updates; `useCallback`/`useMemo`/`memo` when they address a real dependency or referential issue—not blanket wrapping.

## Solver / geometry JS

- Extract **pure** functions with explicit inputs/outputs; keep hot paths allocation-light where the file already cares about that.
- Use `Math.atan2` for angles; guard `NaN`/`Infinity` where the codebase already does.

## Out of scope (unless asked)

- New APIs, UX changes, bug fixes unrelated to the refactor, large formatting-only edits.
