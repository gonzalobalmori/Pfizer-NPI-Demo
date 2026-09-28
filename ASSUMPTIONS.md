# ASSUMPTIONS

Per R-BP-01: where the spec is ambiguous, the most reasonable option was chosen, recorded
here with a one-line rationale, and the build continued without stopping to ask.

## Base repository (§1)

| # | Assumption | Rationale |
|---|---|---|
| A-01 | The J&J NPI demo referenced by R-BASE-01 **is this repository** (`jJDemo` package), already forked into this workspace and already partially re-branded to Pfizer by prior sessions. | `jJDemo.c3pkg.json` + `resource/WORKSPACE_SUMMARY.md` describe exactly the prototype R-BASE-02 lists (BRANCH/go/tab/openIssue/ACTS/approve cascade). Starting blank would violate R-BASE-01. |
| A-02 | The existing 3-branch nav, `prototype.css`, `NavContext`, `AppShell` and the `views/` layer are the "base repo UI component library" to reuse; the orphaned `pages/*` Tailwind layer is NOT extended. | `WORKSPACE_SUMMARY.md` records `pages/*` as legacy/unmounted; the live shell is `views/*`. |
| A-03 | The package name stays `jJDemo` even though the app is Pfizer-branded. | CLAUDE.md forbids changing a package name after creation. R-DOD-12 is about *user-visible* branding, comments, tests and seed data — not the immutable package id. Recorded in DROPPED.md as a documented deviation. |
| A-04 | ~~Existing device-era launches are **retained** alongside the six new §3 pharma products.~~ **REVERSED 2026-09-28 on explicit instruction:** every launch must be one of the six supplied products, and anything naming another product, phase or team is replaced. The nine launch records are kept but re-identified as nine *programmes* across the six molecules — one per indication, berobenatide carrying four. | The original rationale was reach against R-SD-02's 18–24 NPLs. That is now knowingly unmet (9 programmes, not 18–24): the instruction to purge non-listed products takes precedence over the count. Nine-from-six also avoided deleting records, so no scenario or dependent row was orphaned — see COVERAGE.md → "Product / master-data audit" for the mapping. |

## Traceability (§5)

| # | Assumption | Rationale |
|---|---|---|
| A-05 | The audit hash chain uses **SHA-256 over a canonical field-ordered string** of the event payload plus the previous hash, computed in JS. | R-TR-03 requires tamper evidence and re-walkable verification; SHA-256 is the platform-available standard and deterministic across re-runs. |
| A-06 | Hash chains are **per-entity** (`entityType + entityId`), not one global chain. | R-TR-03 says "per entity" explicitly; per-entity chains also let verification scope to one record for the demo. |
| A-07 | Bitemporal fields are modelled as **explicit `validFrom`/`validTo`/`recordedAt`/`supersededAt` fields on a `TemporalFact` mixin + a version-row type**, not via platform `Timeseries`. | R-TR-04 needs two independent time axes on *business* entities; the platform's own versioning does not expose valid-time, and the demo must query both axes (R-TR-05). |
| A-08 | "Re-authentication at signing" (R-TR-10) is demo-grade: the signer re-enters credentials, and the action verifies the submitted signer identity matches the acting user and records the challenge. No real IdP round-trip in the sandbox. | No IdP is provisioned in this environment; the control, its record and its enforcement are real and testable. |
| A-09 | E-signature `meaning` is a closed enum: `approved`, `reviewed`, `released`, `disposition`. | R-TR-10 lists exactly these four meanings. |
| A-10 | Demo Reset (R-TR-15) rewinds by **restoring each affected entity from its pre-decision version row** and writing a new audit event of type `DEMO_RESET`; no audit rows are deleted. | R-TR-15 mandates bitemporal rewind, not deletion, and requires the reset itself be logged. |

## Backend (§4)

| # | Assumption | Rationale |
|---|---|---|
| A-11 | Idempotency keys (R-BE-05) are stored in an `IdempotencyRecord` type keyed by `(actionName, idempotencyKey)`; a replay returns the original result instead of re-executing. | Standard idempotency semantics; makes the invariant testable. |
| A-12 | Optimistic concurrency (R-BE-06) uses a monotonically incremented `versionToken` int on the guarded entity, supplied by the caller and compared before write. | Simplest correct implementation that yields the required "clear error, never silent overwrite". |
| A-13 | "Transactional" (R-BE-07) means the cascade validates **all** preconditions first, then performs writes, and on any failure runs a compensating rollback to the captured pre-state — a saga, since C3 actions are not a single DB transaction. | C3 server actions cannot span one ACID transaction across many types; all-or-nothing is preserved observably, which is what R-BE-07 requires. |
| A-14 | RBAC roles are enforced in an `AccessControlService.assertCan(...)` called at the top of every privileged action, backed by `metadata/Role/` definitions. | R-UI-13 / R-DOD-08 require server-side enforcement provable by test. |
| A-15 | Unit/timezone explicitness (R-BE-04g) = every quantity field carries a companion `*Uom` and every datetime is stored UTC with a `siteLocalTimeZone` on `Site` for local rendering. | Satisfies "unit- and timezone-explicit" without duplicating every timestamp. |

## Scenarios (§8)

| # | Assumption | Rationale |
|---|---|---|
| A-16 | Scenario figures given in the spec (612,000 units, +71 days, $42.8M, option costs/slips) are **authored inputs** on the seeded records; the options table then *derives* its displayed values from those records. | R-BASE-03/R-TR-07 forbid hard-coded values in the view layer, but the spec fixes the numbers — so they live in data and are computed/aggregated server-side, drillable to source. |
| A-17 | Currency: Scenario 1/2 figures are **USD** as written in the spec ($42.8M, $2.1M); the pre-existing portfolio KPIs stay EUR (€). Each monetary field carries an explicit `currency`. | The spec writes scenario money in dollars; the inherited portfolio is in euros. Explicit currency per field avoids a false unified total. |
| A-18 | "Agent recommends" is a boolean on the option record (`recommended`), one per issue. | Matches the existing `DecisionOption.recommended` field in the base repo. |

## Discovered during M1 (platform constraints, not spec ambiguities)

These were not judgement calls about the spec — they are facts about the platform that
changed how a requirement had to be built. Recorded because the *why* is not inferable from
the code.

| # | Finding | Consequence |
|---|---|---|
| A-19 | Every C3 entity type already inherits a platform `version` field, and re-declaring it with a different value type is a compile error (`declared field value type is not assignable to value type of mixin field`). | `EntityVersion`'s monotonic counter is named **`versionNo`**. The platform's field counts revisions of one live row; `versionNo` counts snapshots across a record's history — different quantities, so they coexist. The JSON keys returned by `TemporalQueryService` are still `version`, so callers and A-12 are unaffected. |
| A-20 | Bitemporal history is stored only for types listed in `TemporalQueryService`'s explicit `GOVERNED` registry (10 types at M1). | This is deliberate, not an oversight: an unsnapshotted target could not be rolled back, so `TransactionService.begin` **throws** on an ungoverned type rather than silently skipping the snapshot and advertising atomicity it cannot deliver. Adding a type to the registry is the single step that grants it history, versioning and rollback. Proven by `test_Transaction.js` › *refuses a type it does not govern*. |
| A-21 | A hash chain cannot detect an attacker who rewrites **every** row from the tampered event onward, because they can re-forge a self-consistent chain. | Accepted and documented rather than papered over. Detection then depends on the chain head having been observed elsewhere — which `exportAuditCsv` (R-TR-12) provides, since an exported CSV carries the hashes. The limitation is asserted explicitly in `test_AuditDigest.js` › *when the whole chain is re-forged*, so it is a known property rather than an undiscovered hole. |
| A-22 | SHA-256 is implemented in-repo (`AuditService.js`) rather than delegated to a platform helper. | A hash chain is only evidence if the digest rule is stable forever. Pinning the implementation means a platform upgrade cannot silently change the arithmetic and invalidate seeded history (R-SD-05). Verified against an independent implementation across 15 vectors, including every padding boundary and multi-byte UTF-8. |
| A-23 | `AuditService.record` was written before any caller existed, so `hashOf` — needed to make the chain independently re-derivable — was missing from the type until the tests demanded it. | Both halves of the scheme (`digestOf` + `hashOf`) are now public. This matters beyond convenience: it means the verifier does not grade its own homework, because anything that can call the service can recompute a stored hash from the event's own fields. |
| A-24 | The workspace has **two unrelated package roots**: `jJDemo/` (the real package, 265 files, the only `.c3pkg.json`) and `pkgbca8aec7/` (this workspace's original scaffold). `MAIN_PKG_NAME` points at the latter. They are **not** a rename — `git log` shows them as two root commits with no shared ancestor, on two different branches. | The UI service derives its working directory from `MAIN_PKG_NAME` and ran `npm install` in `pkgbca8aec7/ui/react`, which had a stale `node_modules` but no `package.json`, exiting 254 and killing the app. Fixed by symlinking `pkgbca8aec7/ui/react` → `../../jJDemo/ui/react` so the path the service is hard-wired to resolves to the real app. See the "UI service startup" note in STATUS.md for why a symlink rather than a rename or an env edit. |
