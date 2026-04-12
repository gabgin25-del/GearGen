---
name: geometric-constraints-solvers
description: >-
  Applies 2D/3D Euclidean geometry, kinematic chains, constraint-to-Jacobian
  reasoning, iterative solver warm starts, and PlaneGCS (@salusoft89/planegcs)
  WASM usage in this codebase. Use when editing sketch or GCS code, debugging
  solver convergence or DOF, tuning constraint relaxation, or working with
  planeGcsSingleton, solvePlaneGcs, buildPlaneGcsPrimitives, or WASM init.
---

# Geometric constraints and solvers

## When to read this skill

Use for: sketch constraints, arc/line/circle geometry, degrees of freedom, iterative solves (DogLeg / LM-style flows), seeding from current state, PlaneGCS wrapper calls, or mapping symbolic constraints to linearized systems (Jacobian / residual intuition).

## Euclidean geometry (2D/3D)

- Prefer stable angle APIs: use `Math.atan2(dy, dx)`; guard `NaN`/`Infinity` before persisting coordinates.
- Distinguish **model DOF** (parameters you solve for) from **constraint count**; redundancy and conflicts show up as rank-deficient or inconsistent Jacobians after linearization.
- For **kinematic chains**, propagate motion by sequential transforms; closed loops add **closure constraints** (same as redundant constraint sets in sketch solvers).

## Constraints → Jacobian (working model)

Iterative geometric solvers minimize a residual vector \(r(x)\) (constraint errors). Each iteration linearizes:

\[
r(x + \Delta x) \approx r(x) + J(x)\,\Delta x
\]

- **Rows** of \(J\): one constraint (or scalar equation), often split into normal/tangent components for contacts.
- **Columns**: partial derivatives w.r.t. each solved variable (point coords, radii, angles).
- **Underdetermined** systems: null space of \(J\) corresponds to **unconstrained motion**; **overdetermined** / conflicting rows → least-squares or conflict reporting depending on engine.

When reasoning in code, tie each constraint primitive to **which parameters it touches** and whether errors are **linear** in parameters (distance) vs **nonlinear** (angle, tangent). Nonlinearity drives the need for **good initial seeds** and iteration limits.

## Warm start and seeding

- **Warm start**: initialize solver variables from the **last known good configuration** (current sketch state) before `solve`, so \(x_0\) is near feasible and Jacobians are well-behaved.
- In this repo, PlaneGCS is seeded from workspace points after primitives are pushed; keep that path consistent when adding new primitive types or point IDs.
- If convergence fails, prefer **constraint relaxation / staged solving** over blindly raising iterations—check DOF and conflicts first.

## PlaneGCS in this project

| Role | Location |
|------|----------|
| WASM singleton + `make_gcs_wrapper` | `src/lib/planeGcs/planeGcsSingleton.js` |
| Build primitives + params from workspace | `src/lib/planeGcs/buildPlaneGcsPrimitives.js` |
| Solve, merge results, warm-start, fallback | `src/lib/planeGcs/solvePlaneGcs.js` |

**Integration habits**

- Initialization must complete before solves; entry point is wired from `main.jsx`.
- After changing how primitives map from workspace data, verify **ID alignment** between workspace points and PlaneGCS primitives for seeding.
- `Algorithm.DogLeg` and `SolveStatus` come from `@salusoft89/planegcs`; treat status enums as authoritative for success vs invalid/conflict.

## WASM bridge

- The wrapper loads `planegcs.wasm` via URL import; failures fall back to legacy solver paths—preserve that degradation when touching init.
- Prefer **one shared wrapper** instance; avoid creating multiple WASM runtimes unless you have a strong isolation reason.

## Checklist for solver-related changes

- [ ] New constraint or primitive: defined in builder, represented in solver, IDs stable for warm start.
- [ ] Non-finite values filtered before solve and after merge-back.
- [ ] DOF / conflict handling: understand `dof()`, conflicting-constraint queries, and relaxation path when the first solve fails.
- [ ] Geometry metrics and arc bindings (`recomputeBoundArcs`, etc.) stay consistent with solved coordinates.
