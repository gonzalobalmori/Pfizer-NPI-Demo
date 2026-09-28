# DROPPED

Per R-BP-07: scope is never silently reduced. Anything in the build request that is *not*
being delivered as literally written is recorded here with the reason and what was done
instead. An empty section means nothing was dropped from that part of the spec.

At the end of M1 there are **no dropped requirements** — only two deviations forced by
constraints that outrank the spec, both of which preserve the requirement's intent.

## Deviations (requirement met, letter of the spec changed)

| # | Spec text | Deviation | Why | Intent preserved? |
|---|---|---|---|---|
| D-01 | §1 R-BASE-04 — "complete Pfizer re-brand … no J&J asset, colour, product, site, person or supplier anywhere, including comments, tests and seed files" | The **package directory and id remain `jJDemo`**. | The project instructions state: "**Do NOT** change the package name. The package name is set when the package is created and must remain unchanged." A package id is not a user-visible asset, colour, product, site, person or supplier. | Yes. Every *user-visible* string, colour, product, site, person, supplier, comment, test name and seed value is Pfizer. The audit of R-BASE-04 and R-DOD-12 is scoped to content, and runs in M7. Recorded as ASSUMPTIONS A-03. |
| D-02 | §12 deliverables — "`README.md`" | The deliverable docs (`README.md`, `COVERAGE.md`, `ASSUMPTIONS.md`, `STATUS.md`, `DROPPED.md`, `DEMO.md`, data dictionary) live at the **repository root**, not inside `jJDemo/`. | The project instructions state: "**Do NOT** create `README.md` files in C3 packages — they are not part of the C3 package structure." | Yes. Every §12 document is delivered and discoverable; only the directory differs. `README.md` itself is written in M7 alongside `DEMO.md` and the data dictionary. |

## Deferred, not dropped

These are scheduled, not abandoned. Listed here only because a reader of COVERAGE.md at the
M1 mark would otherwise see `NOT DONE` with no plan attached.

| Requirement | Milestone | Note |
|---|---|---|
| R-TR-07 lineage drill-down | M3 | The spec calls this "the single most important differentiator". It needs the Scenario 1 options table to drill *into*, so it is built with it rather than before it. |
| R-BE-04 (a)–(g) invariants | M2–M4 | Each invariant constrains a domain object that M2 creates. Writing the guard before the thing it guards would mean writing it twice. |
| R-BE-09 health endpoint + job-run history | M7 | No dependency; grouped with hardening. |
| §6 nine phases (R-PH-00..10) | M2 | |
| §8.1 / §8.2 scenarios | M3 / M4 | |
| §9 UI (R-UI-01..14) | M5 / M6 | |

## Priority-tier cuts

None. R-BP-08 permits cutting P2 first, then P1, never P0. Nothing has been cut at any
tier — no milestone has yet run short of room.
