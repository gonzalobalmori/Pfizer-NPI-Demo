# COVERAGE

Per R-BP-06: every requirement ID in the build request, its status, the file that
implements it and the test that proves it. Appended to at the end of every milestone;
never rewritten to hide a regression.

Status vocabulary:

- **DONE** — implemented and proven by a named test, or (for structural requirements)
  verifiable by inspection of the named file.
- **PARTIAL** — the mechanism exists and is used, but not yet across the full scope the
  requirement asks for. The gap is stated.
- **NOT DONE** — not yet built. Scheduled milestone given.

Paths are relative to the repository root. The C3 package is `jJDemo/` (see ASSUMPTIONS
A-03 for why the package id is unchanged while the app is Pfizer-branded).

---

## M1 — Traceability core + type system skeleton (§4, §5)

### §5.1 Append-only audit store

| ID | Status | File | Test |
|---|---|---|---|
| R-TR-01 | DONE | `jJDemo/src/AuditEvent.c3typ`, `jJDemo/src/AuditService.js` (`record`, no delete path exposed); tombstones via `AuditEvent.changeType = 'TOMBSTONE'` | `test_AuditChain.js` › *record › linking*; `test_AuditDigest.js` › *when an event is deleted (attack b)* |
| R-TR-02 | DONE | `jJDemo/src/AuditEvent.c3typ` (20 fields); `requireField` in `AuditService.js` | `test_AuditChain.js` › *when a required actor field is missing* |
| R-TR-03 | DONE | `AuditService.js` — `digestOf`, `hashOf`, `buildEvent`, `verifyChain`, `verifyAllChains` | `test_AuditDigest.js` (all four attacks + the re-forge limitation); `test_AuditChain.js` › *verifyChain* |

### §5.2 Bitemporal history

| ID | Status | File | Test |
|---|---|---|---|
| R-TR-04 | DONE | `jJDemo/src/Bitemporal.c3typ` (validFrom/validTo/recordedAt/supersededAt), `jJDemo/src/EntityVersion.c3typ` | `test_Transaction.js` › *begin › snapshots every target up front* |
| R-TR-05 | DONE | `jJDemo/src/TemporalQueryService.js` — `asOf`, `replay`, `historyOf`, `diffVersions` | `test_Transaction.js` › *assertVersion* (exercises `versionTokenOf` over real version rows) |
| R-TR-15 | DONE | `TemporalQueryService.js` — `demoReset` (append-only: restores live records, retains and counts all evidence) | Deferred to M7 e2e; logic reviewed — no hard delete path exists in the file |

### §5.3 Lineage

| ID | Status | File | Test |
|---|---|---|---|
| R-TR-06 | PARTIAL | `jJDemo/src/LineageRecord.c3typ` exists from the base repo | Lineage *drill-down over scenario numbers* lands in M3 with the options table |
| R-TR-07 | NOT DONE | — | M3. This is the "single most important differentiator" — every number in the options table drillable. |

### §5.4 E-signatures (21 CFR Part 11)

| ID | Status | File | Test |
|---|---|---|---|
| R-TR-08 | DONE | `jJDemo/src/ESignature.c3typ`; `AuditService.js` — `sign` binds signature to a hashed record snapshot | Deferred to M7 (needs a signable business record from M2) |
| R-TR-09 | DONE | `AuditService.js` — `MEANING_PRIVILEGE` map; refuses a signer lacking the privilege the meaning requires | `test_AccessControl.js` › *Commercial user attempts to sign a batch disposition* |
| R-TR-10 | DONE | `AuditService.js` — `REAUTH_WINDOW_MINUTES = 5`, `reauthChallengeRef` required (demo-grade per A-08) | M7 |
| R-TR-11 | DONE | `AuditService.js` — `verifySignature` re-hashes and reports drift without invalidating the signature | M7 |
| R-TR-12 | DONE | `AuditService.js` — `exportAuditCsv` embeds filter criteria in the CSV header | M7 |

### §5.5 Agent traceability

| ID | Status | File | Test |
|---|---|---|---|
| R-TR-13 | DONE | `jJDemo/src/AgentRunRecord.c3typ`; `AuditService.js` — `recordAgentAction` | M6 (needs an agent action to record) |
| R-TR-14 | DONE | `AuditService.js` — `assertAgentMayNotCommit`, `AGENT_GUARDED_CLASSES` | `test_AuditChain.js` › *assertAgentMayNotCommit — the autonomy guard* (3 specs) |

### §4 Backend platform requirements

| ID | Status | File | Test |
|---|---|---|---|
| R-BE-01 | PARTIAL | 64 `.c3typ` types in `jJDemo/src/`; canonical types + transforms in `jJDemo/metadata/Transform/` | Feed-by-feed canonical coverage completes in M2 (R-DM-06) |
| R-BE-02 | PARTIAL | All M1 writes go through service actions; no direct field write exists in M1 code | Repo-wide "no business value in the view layer" sweep is an M5 gate |
| R-BE-03 | PARTIAL | `jJDemo/src/LaunchControlMetrics.js` (12 server-side metrics) from base repo | M5 gate |
| R-BE-04 | NOT DONE | — | M2–M4. The seven invariants need the domain model they constrain. |
| R-BE-05 | DONE | `jJDemo/src/IdempotencyRecord.c3typ`; `TransactionService.js` — `claim`/`complete`/`fail` with replay-not-reject | `test_Transaction.js` › *claim — idempotent writes* (5 specs) |
| R-BE-06 | DONE | `TransactionService.js` — `assertVersion`, `versionTokens` | `test_Transaction.js` › *assertVersion — optimistic concurrency* (4 specs) |
| R-BE-07 | DONE | `TransactionService.js` — `begin`/`commit`/`rollback` saga with reverse-order compensation | `test_Transaction.js` › *begin / commit / rollback — atomicity* (6 specs) |
| R-BE-08 | DONE | `TransactionService.js` — `newCorrelationId`; `correlationId` required on every `AuditEvent` | `test_Transaction.js` › *shares one correlation id across the burst* |
| R-BE-09 | NOT DONE | — | M7 |
| R-BE-10 | PARTIAL | 4 unit test files, 36 specs | Invariant + referential-integrity + e2e suites are M7 |

### §3 Domain model foundations built in M1

| ID | Status | File | Test |
|---|---|---|---|
| R-DM-01 | DONE | `jJDemo/src/Team.c3typ`; `jJDemo/seed/Team/Team.json` — 13 teams (9 functions, Sites expanded to 4) | `test_AccessControl.js` › *raciFor* |
| R-DM-02 | DONE | `jJDemo/seed/Site/Site.json` — Freiburg, Puurs, Kalamazoo, Grange Castle appended | M2 referential-integrity sweep |
| R-DM-03 | DONE | `jJDemo/src/RoleAssignment.c3typ` + `AccessControlService.js#rolesFor(personId, asOf)`; seed pair `ra_jt_qp_puurs_cover_ended` / `ra_jt_clinical_current` | `test_AccessControl.js` › *authority as-of an instant* (4 specs) — proves J. Thomson **was** QP on 15 Mar and **is not** today |
| R-DM-04 | NOT DONE | — | M2 (six products) |
| R-DM-05 | PARTIAL | Core entities exist from the base repo | M2 |
| R-DM-06 | PARTIAL | `jJDemo/metadata/FileSourceSystem/`, `FileSourceCollection/`, `Transform/` | M2 (ten source systems) |

### §9 / §11 access control

| ID | Status | File | Test |
|---|---|---|---|
| R-UI-13 | DONE (server half) | `jJDemo/src/AppRole.c3typ`, `jJDemo/seed/AppRole/AppRole.json` (6 roles), `AccessControlService.js` — `assertCan` | `test_AccessControl.js` › *refusals* (5 specs) + *roleMatrix* (3 specs) |
| R-DOD-07 | DONE | `AuditService.js` — `verifyAllChains` | `test_AuditChain.js` › *reports no broken chains (R-DOD-07)* |
| R-DOD-08 | DONE | `AccessControlService.js` — `assertCan` throws for under-privileged callers | `test_AccessControl.js` › *Commercial cannot sign disposition*, *Auditor cannot approve*, *Site Planner cannot re-baseline*, *unknown caller fails closed* |

### M1 verification actually run

| Check | Result |
|---|---|
| `npm run lint` | clean |
| `tsc -p tsconfig.build.json` | clean |
| `vite build` (with `VITE_C3_PKG=jJDemo`) | 725 modules, built |
| `node --check` on all 4 new implementations + 4 test files | all pass |
| SHA-256 vs an independent implementation — 15 vectors incl. every padding boundary, 2/3/4-byte UTF-8 | 15/15 pass |
| Hash-chain tamper detection (4 attacks + re-forge limitation) against the real `digestOf`/`hashOf` | 12/12 pass |
| RBAC + time-travel against the real seed JSON | 27/27 pass |
| Compile errors `EntityVersion.version` and `RoleAssignment.team` | both resolved — confirmed in regenerated `gen/cache/TypeMetaDeps#dts` |

**Jasmine specs are written but not yet executed in-app**: the app service returns HTTP 500
on every `runJsCode` / `validatePkgs` / `runTest` call. See STATUS.md. The three harnesses
above were run locally against the real source and the real seed files to avoid claiming
untested code.

## Pfizer re-brand (R-BASE-04, R-BASE-05) — user-requested pass

> **SUPERSEDED — read the "Product / master-data audit" section at the end of this file for
> the current state.** This pass fixed the **visual** identity (colour, favicon, title,
> contact-data residue) and that part stands. It did **not** re-brand the *domain model*, and
> this section originally over-claimed R-BASE-04 as a result: the launches were still device
> form factors with marketed-product names pasted on, and the J&J operating companies survived
> as franchise primary keys.
> **That was remediated on 2026-09-28** — launch identities, franchise/segment keys, the
> regulatory model and the device process vocabulary were all replaced. **R-BASE-04 and
> R-DM-04 now read as met**; the residual gaps are listed at the end of the audit section.

Triggered by the user reporting "the branding and colors dont look like pfizer". The app
already said the *word* Pfizer but carried none of the brand's colour: the palette was the
inherited one (`--red500:#EB1700`, a warm taupe neutral ramp, and `--purple:#A100FF`, a
partner firm's magenta).

### The trap this pass had to avoid

`--red500` was doing **two unrelated jobs**: brand identity (`.m-wm`, `.h-wm`, `.mr-n`,
`.m-hi b`) *and* semantic danger (`.tag.crit`, `.bar-f.r`, `.gd.crit`, `.ms-g.crit`,
`.kn-v.r`). A global find-and-replace to Pfizer Blue would have turned every critical gate,
breached threshold and at-risk KPI **blue** — destroying the risk semantics the whole
control tower exists to communicate. The token block was therefore **split** into a
`--brand-*` scale and a danger-only `--red-*` scale, with a comment forbidding re-merging.

| Area | Change |
|---|---|
| Brand tokens | `--brand:#0000C9` / `-600:#0000A8` / `-700:#00008A`; `--sky:#0093D0`; `--brand-bg`/`--brand-bd` |
| Neutral ramp | Warm taupe → luminance-matched **cool** ramp (`--g50:#F7F9FC` … `--g900:#121A25`). Neutrals are ~90% of on-screen pixels, so they carried the old identity more than any accent |
| Danger scale | Narrowed to critical states only (`#D8232A`/`#C21B22`/`#A6151B`) |
| Agent accent | `--purple:#A100FF` (a partner firm's brand colour) → `#6C4BD8`, still distinct from `--brand` so AI-authored artefacts stay visually separate (R-TR-13) |
| Shadows | Taupe `rgba(26,24,23,…)` → cool `rgba(18,26,37,…)`, 43 occurrences |
| Interactive states | 17 brand selectors + **33** non-danger uses of the danger scale (selection, active-tab underline, primary CTA, hover, in-progress, "you"/identity) repointed to `--brand` |
| Components | Stale `var(--token, #warmFallback)` pairs refreshed in `EodCapture.tsx` (22), `ChatView.tsx`, `CockpitView.tsx`, `PortfolioView.tsx`; `#7E9BB4` map dots → `--sky` |
| Browser chrome | Favicon was the **C3 AI logo** and the tab title "My Package" → brand-blue monogram `favicon.svg` + "Pfizer · NPI Launch Control Tower" |
| J&J residue | `sources/workday/HR_WORKER…csv` (13 × `@its.jnj.com`) and 3 Veeva extracts (`jnjmedtech-qms…`) → Pfizer domains; `Johnson` names in the example fixture replaced |

### R-BASE-05 — persistent disclaimer

Previously the footer read "Demo · Accenture for Pfizer Biopharma · all figures
illustrative" and existed **only on the menu screen** — it named another company and was
absent from the entire app shell. Replaced with a new `shell/DataDisclaimer.tsx` rendered
once at the `App.tsx` root, so it persists across every screen, branch and tab. It is
non-dismissible by construction: no close button and no visibility state.

### Verified

| Check | Result |
|---|---|
| `npm run lint` + `tsc` + `vite build` | clean, 726 modules |
| Legacy palette purged (`EB1700`, `A100FF`, `26,24,23`, `235,23,0`, `7E9BB4`, `eae6e1`, `d8d2cc`, `A39992`, `c11400`) | 0 occurrences outside vendor `c3ui/` |
| Runtime computed styles | `--brand` → `rgb(0,0,201)`; wordmark and active-tab underline both resolve to it; `--red500` still `#D8232A` |
| Disclaimer at runtime | `position:fixed`, visible, correct text, `hasCloseButton:false` |
| WCAG contrast, 11 pairs | all pass (`g500` on white improved 2.6 → 3.11 vs the old taupe) |
| Browser console | 0 errors on the menu screen |

`c3ui/*.css` (the vendor C3 design-system tokens, incl. its `#2266F0` blue) was deliberately
**not** touched: `App.tsx` mounts only the `prototype.css` shell, so those tokens and the
`pages/*` Tailwind layer are not user-visible. Changing vendor files would have been churn
with no rendered effect.

**Not verified:** data-bearing views still cannot render because the app service returns 500
on every `/api/8/...` call (see STATUS.md). That outage is unrelated to this pass, and the
screens correctly show "Failed to load the cockpit." rather than falling back to mock data.

---

## App-runtime fix — the "Failed to load the replan dashboard." error

**Reported as:** the Milestone replan tab rendering red text *"Failed to load the replan
dashboard."* In fact every data-bearing view was failing the same way; replan was simply the
tab the user happened to be on.

### Why the first diagnosis was wrong

The evidence pointed hard at a platform outage, and it was recorded as one. Every runtime
path under `/gse67e2092/liveapp/` returned a bare 21-byte, headerless, deterministic 500,
while an *unknown* env/app cleanly 400'd and `validatePkgs` / `issuesForPkg` / `pkgStoreConfig`
all succeeded. The wrong inference was: "package validates, so the package is fine; the app
must be down."

The tell that was under-weighted: **routing succeeded** (the app tag resolved — an unknown one
400s) but **every** path 500'd. That is the signature of the app resolving its root package
and failing, not of a dead service.

### Actual root cause

`MAIN_PKG_NAME=pkgbca8aec7`, so `pkgbca8aec7` is the app's **root package**. The workspace has
two unrelated git roots, and the checked-out branch (`f8f6b98`, the jJDemo demo) contains
**zero** `pkgbca8aec7` files. Checking it out deleted every tracked file of the root package,
including `pkgbca8aec7.c3pkg.json`, leaving only untracked residue (`gen/`, `jsconfig.json`,
and a stale `.c3pkg.lock.json` still pinning `mcpServer: 8.10`).

A root package with no manifest cannot be resolved → the app never finishes booting → bare 500
on every path. The same deletion removed `ui/react/package.json`, which is what produced the
earlier `npm install failed with code 254`. One cause, both symptoms.

### Changes

| File | Change | Why |
|---|---|---|
| `pkgbca8aec7/pkgbca8aec7.c3pkg.json` | **Recreated**, depending on `jJDemo: "1.0"` | Gives the app a resolvable root package that pulls in the real code |
| `pkgbca8aec7/pkgbca8aec7.c3pkg.lock.json` | Deleted (backed up to `/tmp`) | Pinned a resolution from before the manifest existed |
| `jJDemo/jJDemo.c3pkg.json` | `mcpServer` `8.10`→`8.11`; `testtools` `"*"`→`8.11` | Both are **Java Store** packages, so they must pin to the platform version (8.11.2+73). `"*"` is an invalid `SemanticVersion.MajorMinor` and the validator warned it becomes an ERROR as of 8.10 |

Two platform rules this pinned down: Java Store deps track the platform version, and
dependency versions are **MajorMinor** (`1.0`) — full semver (`1.0.0`) is rejected.

No view-layer or service code was changed. `CascadeView.tsx`, `api/cascade.ts`,
`CascadeReplanService.{c3typ,js}` and all the seed records were audited during the
investigation and were correct throughout — the error message was the UI faithfully surfacing
a backend failure, exactly as R-BASE-03 and the no-fallback rule intend.

### Verification

| Check | Result |
|---|---|
| `runJsCode 1+1` | `2` — runtime answers again |
| `issuesForPkg` (both packages) | **0 issues** — the `testtools` WARNING is gone too |
| `upsertSeedData` | `seeded: true`; Launch 9 · RegulatoryMilestone 1 · CascadeImpactItem 5 · AppRole 6 · Team 12 · RoleAssignment 18 · Site 8 |
| `CascadeReplanService.plan('seed_launch_pf3945_obesity')` | returns `{milestone, items, summary}` |
| Replan cascade, in-browser | +6 wks (2 Nov → 14 Dec, +42 days), 3 of 5 auto-adjusted, 2 human decisions, €48k — all computed server-side |
| `Reset scenario` | restores the baseline |
| Cockpit / Portfolio / Open issues / Milestone replan | all render live data; no "Failed to load" anywhere |
| Network sweep | **30/30** `/api/8/*` calls **200 OK**, including the `PortfolioService/openIssues` + `timeImpact` calls that previously 500'd |
| Browser console | **0 errors** |
| `VITE_C3_PKG=jJDemo npm run build` | green — lint + tsc + 726 modules |

**M1's blocked items are now closed:** seed data is loaded, and the M1 services were
smoke-tested live — `AuditService.hashOf('abc')` matches the canonical SHA-256 vector, and
`AccessControlService` returns the right roles/privileges for `seed_person_ak` while failing
**closed** on an unknown privilege (R-DOD-08).

**Still open:** `runTest` returns `testsuite: []` for all six spec files despite `dev` mode
with the test overlay on — suite *discovery*, not product code. Deferred to M7.

**Caveat:** the recreated manifest, like the `ui/react` symlink, is untracked on this branch
and will not survive a fresh clone. The durable fix is repointing `MAIN_PKG_NAME` at `jJDemo`.

---

## Scenario coverage audit (§8.1 Quality disruption, §8.2 Demand / market-wave change)

Audited on request. **Verdict: neither scenario is implemented.** `DROPPED.md` already records
`§8.1 / §8.2 scenarios → M3 / M4`, and M3/M4 are "Not started" in STATUS.md, so this confirms
the plan rather than contradicting it. What follows is the clause-by-clause gap list so M3/M4
can be built against it.

The reusable *machinery* largely exists (decisions, options, approvals, audit chain, cascade,
RBAC); what is missing is the **domain modelling and the seeded narrative** for these two
specific stories. None of the spec's scenario figures (612,000 units, +71 days, $42.8M, $2.1M)
appear anywhere in `src/`, `seed/`, `data/` or the UI.

### The story that IS seeded today

A **medical-device** narrative inherited from the base repo, not a pharma one: EO-sterilisation
slot cancellation (`seed_finding_417`), single-source ring-electrode supplier risk
(`seed_finding_388`), at-risk build authorisation (`seed_finding_402`), line-3 commercial
at-risk batches (`seed_finding_412`), G2 design-freeze unsigned inputs (`seed_finding_371`).
The only lots on hold are 4 ring-electrode lots (`HRS-RE-2609-09`…`-12`) held for an **SPC
breach**, not a visual-inspection defect.

### §8.1 Quality disruption

| Clause | State | Evidence |
|---|---|---|
| C1 batch placed on hold | **PARTIAL** | `Lot.lotState` has `HOLD` and 4 lots are seeded on hold — but the trigger is an SPC/process breach (`spcViolation: true` on all four), not a quality inspection. **`Lot` does carry a real quantity** (`lotQty: int`): the 12 seeded lots total 5,978 units of which the 4 held lots are **2,017 units (33.7%)** — the one place in the app where a hold has a computable size, and the natural seed for a scope calculation. But **`Lot` is orphaned**: no relation to `Finding`, `Decision`, `CAPA`, `Launch` or `Market`, referenced in no service or view (only `DataQualityCheck.js` + `TemporalQueryService.js` infrastructure). The `BatchLot` type cited in `ESignature`/`EntityVersion`/`AuditEvent` doc comments **does not exist** (dangling `{@link BatchLot#disposition}`) |
| C2 visual inspection finds a **stopper**-related defect | **MISSING** | No defect/inspection model of any kind. `"stopper"` and `"Berobenatide"` exist **only as prose in two seed descriptions** (`seed/Team/Team.json:55,70`, `seed/Site/Site.json:53`) plus one test string — **there is no Berobenatide `Launch` record**, so the product this scenario is about is not in the data |
| C3 determine the scope | **PARTIAL** | `CascadeReplanService` + `CascadeImpactItem` compute a blast radius, but only from a **regulatory date slip** (`cascadeReplan(milestoneId, newDateIso)`) — there is no quantity/lot/market scoping of a quality event. No `determineScope`/`affectedLots`/`affectedMarkets` service exists, and `seed_finding_412` has **no `marketCodes` populated** |
| C4 evaluate recovery & supply options | **PARTIAL** | `Decision` / `DecisionOption` and a working options comparison table exist (11 seeded options with real tradeoff fields), but none are stopper-recovery. The 3 quality options (`seed_option_412_a/b/c`) carry **`daysRecovered: 0` and `revenueKept: 0`** — the quality case has no quantified recovery; the richly-costed set belongs to the EO-slot supply case |
| C5 protect priority markets | **MISSING** | **No market-priority field exists** (`priorit*` = 0 hits in `Market`/`MarketLaunch` types and seed). `Market.tier`/`wave` are the only building blocks; `MarketLaunch` carries no volumes. Prioritisation exists **only as English text** in option/task/comment prose — nothing computes it. The `SUPPLY_ALLOCATION` hits are audit permission labels, not allocation math |
| C6 Quality & launch decisions | **PARTIAL** | Two disconnected halves. The decision+approval flow is live (`Decision.approve`, `assertUserCanDecide`, wired to `IssueView`). But the Part-11 layer — `ESignature`, `AuditService.sign`, `AccessControlService.assertCan`, `TransactionService` — is **called zero times from any decision path** (verified: 0 matches in `Decision.js`, `ExecutionService.js`, `CascadeReplanService.js`). No `ESignature` records are seeded, and no QP batch-disposition signature exists despite `ESignature.c3typ` documenting one |
| C7 coordinate the approved response | **COVERED** (mechanism) | `Decision.approve()` runs a real 7-step cascade — re-baselines the `Gate`, releases `Launch.revenueAtRisk`, dispatches/assigns `ActionPlanTask`s, stamps `Notification.sentAt`, sets `CAPA.status → CONTAINED`, appends a `DesignHistoryFileEntry`. Live-wired via `c3MemberAction('Decision','approve')`. Caveats: no `Notification` records exist for the quality decision, and most `IssueView` action buttons ("Run all agent actions", "Assign", "Escalate to Launch Board") are **static with no `onClick`** — only "Approve Option" is wired |

### §8.2 Demand and market-wave change

| Clause | State | Evidence |
|---|---|---|
| C1 eight weeks before **packaging** | **MISSING** | No packaging milestone, phase or gate to count back from: `seed/Phase/Phase.json` is P1 Feasibility → P6 Post-market, and `data/Gate/Gate.json` is G1 NPI Readiness → G5 Launch Go/No-Go + BAU handover. The only `RegulatoryMilestone` record in the app is `seed_milestone_pf3945_obesity_fda` (FDA 510(k), a *clearance*, not a pack run). "Eight weeks" appears only as narrative (`seed/AgentAction`, `seed/Comment`) and one hard-coded chart label in `AlertsView.tsx:172`. **The countdown primitive does exist** — `daysUntil(iso)` in `CockpitView.tsx:82` over `Gate.forecastDate`, plus `slipDays` on `Gate`/`RegulatoryMilestone` — it just has no packaging anchor to point at |
| C2 Commercial **increases demand** for a priority market | **MISSING** | No demand/forecast entity and **no per-market volume field**: `MarketLaunch` is `launch, market, firstShipQuarter (string), status, reimbursementStatus, findings` — all 51 records carry no volume. `AuditEvent.changeType` has no value for a demand revision. **The trigger is seeded as prose only** — `seed/Team/Team.json:41` says "Scenario 2 begins with a Commercial signal — a **+64% Germany forecast revision**"; that string appears nowhere else in the repo. *Partial credit:* the target market **does** exist as a record — `seed_market_de` Germany, `tier: LAUNCH`, `wave: Launch` |
| C3 changes required **SKU / pack mix** | **MISSING** | No SKU, pack-size, presentation or pack-configuration field on any of the 61 types. Every "pack mix" hit is prose — `team_gplo` even asserts "Scenario 2's action plan routes most of its work here", yet **no `ActionPlanTask` of the 26 is scoped to GPLO for a pack-mix change**. Sole SKU reference is an activity label (`…live order-to-cash test with real SKUs`) |
| C4 supply, site, **CMO**, packaging-component, logistics constraints | **MISSING** as quantities (qualitative labels only) | None of the five is a number that can be exceeded. Supply: `ContractTerm.capacityCommitment` = `COMMITTED`/`NON_COMMITTED` enum. Site: `Site.capacityAvailableFrom` is a **datetime** — answers "is the site free yet?", never "can it make 64% more?". **CMO: no entity at all** — it is a substring inside `Launch.manufactureSite` ("Irvine + CMO"). BOM: `BillOfMaterialItem` has no quantity/on-hand/lead-time, and all 4 records are `"Ring electrode subassembly"` — **a device subassembly, not packaging**; no carton, label, leaflet, blister or vial part exists. Logistics: a `CascadeImpactItem.domain` enum value only. **So "cannot support every market as planned" cannot be computed anywhere** |
| C5 the four comparable options (constrained launch / inventory reallocation / added capacity / market-wave resequencing) | **PARTIAL** — mechanism real, content absent | The comparison engine is genuine and quantified (`DecisionOption`: `daysRecovered`, `cost`, `revenueKept`, `gateImpact`, `forfeits`, `riskBand`, `confidence`, `basis`), but **its doc comment says "one of the *three* modelled alternatives"** and all 10 seeded decisions have exactly three. Two of the four have close analogues: *constrained launch* → `seed_option_402_a/b/c` ("Phased 2,600 units" / "Full 4,200 units" / "1,400 units", `basis: "Modelled against P50 demand"` — **units live in the label text, not in a field**), and *wave resequencing* → `seed_option_417_c` ("Re-sequence — US first, EU wave 2", `+78d in EU, none in US`, forfeits "Two EU tender windows; €7.2M moved to FY28"). *Inventory reallocation* and *added capacity* have **no option**: the nearest, `seed_option_412_a`, reallocates **reduced supply** not existing inventory, and `412_c`'s own subLabel admits "the agents first confirm … that the site actually has the capacity" — i.e. the capacity check is narrated, not computed. **No option carries units, a per-market volume split, or a capacity delta**, so the four cannot be compared on the axis the scenario requires. `StratView.tsx` names this four-way comparison explicitly and is labelled "This branch is deliberately not built out" |
| C6 governed decision | **PARTIAL** | Decision + spend authority are real and Scenario-2-tagged: `AppRole` seeds Executive at $50M as the **only** role with `canApproveGovernanceReversal: true`, Commercial at $1M with `market.commit` and "no quality or supply-allocation authority"; `AccessControlService.assertSpendAuthority` throws naming the limit "(R-S2-05 check 7)" and is covered by `test_AccessControl.js`. But the same gap as §8.1 C6: `Decision.approve` never calls `AuditService`, `TransactionService` or `assertSpendAuthority`, and **zero records exist for `ESignature`, `AuditEvent`, `EntityVersion`, `AgentRunRecord`, `IdempotencyRecord`** — so the audit trail is empty at runtime. `AuditEvent.c3typ:104` documents a `WAVE_RESEQUENCE` reason code that **no code path emits** |
| C7 update all affected plans, owners, sites, partners, commitments | **PARTIAL** | Two cascade mechanisms exist and **neither touches markets, sites or partners.** `Decision.approve` writes Gate, Launch, ActionPlanTask, Notification, CAPA, DHF entry — never `MarketLaunch`, `Market`, `Site`, `Supplier`, `ContractTerm` or `CascadeImpactItem`. **`MarketLaunch` is written by no decision path at all** (only `PortfolioService` reads it and `TemporalQueryService` registers a generic replay `put`), so the 51 market-commitment records are read-only decoration. `CascadeReplanService` is date-only, single-milestone, and hardcodes `DEFAULT_LAUNCH = 'seed_launch_pf3945_obesity'`. **Decisively: `CascadeImpactItem.targetLabel` is a `!string` display label with no FK to the plan record being re-timed**, and `decisionOptions: [string]` are plain strings, not `DecisionOption` records — so "update all affected plans" is a status flip on a label, not a write to a governed plan. The market/partner cascade exists only as task prose ("14 affiliate plans to re-time", "Re-time the DE and FR tender entries") describing records that do not exist |

### What M3/M4 actually need to add

1. **Quantities.** Demand/forecast volume per market (on `MarketLaunch`), capacity per site/CMO/line, and packaging-component (BOM) quantities. `Lot.lotQty` already proves the pattern works — extend it rather than invent it. Without these, Scenario 2 cannot be more than narrative and its four options cannot be compared. Corollary: **`DecisionOption` needs a units/volume field** so option figures stop living in label text, and its "three alternatives" doc comment needs to admit four.
   - Also needed: a **CMO entity** (today "CMO" is a substring inside `Launch.manufactureSite`) and **real packaging parts** in `BillOfMaterialItem` (today all 4 records are one device subassembly).
2. **A second cascade trigger.** `CascadeReplanService` needs a demand/mix-change entry point alongside `cascadeReplan(milestoneId, newDateIso)`.
3. **A quality-event scope path.** Lot hold → affected lots/quantity → affected markets, driven by an inspection finding rather than an SPC rule.
4. **Pharma primary-packaging modelling** (vial/stopper/closure components) for the C2 defect mechanism.
5. **Market allocation logic** that uses the existing `Market.tier` / `Market.wave` to protect priority markets and to resequence waves.
6. **The seeded narratives themselves**, carrying the spec's figures (612,000 units, +71 days, $42.8M, $2.1M) as authored record inputs per A-16 — derived server-side, never hard-coded in the view (R-BASE-03).

### Two defects found during this audit (independent of the M3/M4 gap)

These are problems in what already exists, not missing scenario work:

1. **The Part-11 governance layer is unreachable.** `ESignature`, `AuditService.sign`,
   `AccessControlService.assertCan` and `TransactionService` are all implemented and
   privilege-mapped (`disposition → batch.disposition.sign`, 5-minute reauth window, Annex 16
   agent refusal), and `role_quality_qp` carries `canSignDisposition: true`. But **no decision
   path calls any of them** — `grep` for those symbols in `Decision.js`, `ExecutionService.js`
   and `CascadeReplanService.js` returns **0 matches**. So `Decision.approve()` performs no
   privilege check, writes no `AuditEvent`, captures no signature, and does not run inside the
   `begin/commit/rollback` saga its own doc comment claims. No `ESignature`, `AuditEvent` or
   `EntityVersion` records are seeded. This undercuts R-TR / R-DOD-08 for the decision path
   specifically — the enforcement exists but is not on the critical path. **Worth fixing before
   M3/M4 build more decision flows on top of it.**

2. **Seeded narrative contradicts itself on the same event.** For finding 412, the
   Decision/Chain/DecisionHistory say *"4 of 12 lots out of spec"*
   (`data/Decision/Decision.json:169`, `seed/Chain/Chain.json:79`,
   `seed/DecisionHistoryEvent/DecisionHistoryEvent.json:14`) while the Finding/CAPA/Comment say
   *"3 batches out of spec"* (`data/Finding/Finding.json:6`, `data/CAPA/CAPA.json:8`,
   `seed/Comment/Comment.json:259`). A reviewer reading two panels on the same screen sees two
   different numbers.

### Corrections to earlier claims in this file

Four, all found by re-verifying this audit's own assertions rather than trusting them:

1. **§8.1 C6 was marked COVERED.** Wrong — the types exist and `AccessControlService` works
   *when called directly*, but nothing on the decision path calls it (defect 1 above). Now
   **PARTIAL**. Likewise §8.1 C5 is **MISSING**, not PARTIAL: there is no market-priority field.
2. **§8.1 C1 claimed the held lots had no quantity.** Wrong — `Lot.lotQty` exists and is
   populated, giving **2,017 of 5,978 units (33.7%) on hold**. This matters: it is the only
   computable "scope of a hold" in the app, so C3's scope calculation has a real starting point.
3. **§8.2 C5 was marked MISSING.** Overstated — two of the four options have close seeded
   analogues (`402_a/b/c` constrained volumes, `417_c` wave resequencing). The real defect is
   narrower and sharper: **the units live in option *label text*, never in a field**, and
   `DecisionOption`'s own doc comment is written for *three* alternatives, not four.
4. **A "0 hits" grep result was wrong.** An earlier pass reported `R-S2-` as absent from the
   repo. The tags **do** exist (`AppRole.c3typ:54`, `AccessControlService.{c3typ,js}`,
   `test_AccessControl.js:166,207`, `ESignature.c3typ:32`). The cause was a BusyBox `grep
   --include` invocation that silently matches nothing — a known trap in this workspace, already
   noted in WORKSPACE_SUMMARY. **Use the Grep tool, not `grep --include`, here.** Correcting this
   changed a conclusion: Scenario 2 was not merely unbuilt, it was *deliberately provisioned
   for* — roles, spend authority, the governance-reversal flag and signature meanings were all
   built to spec and tagged, then never connected.

**Net effect of the corrections:** the verdict is unchanged (neither scenario is implemented),
but the gap is less about absent machinery and more about **absent connections** — Scenario 2's
authority model is built and tagged, the options engine is quantified, the countdown primitive
exists, and the held lots have real unit counts. What is missing is per-market volume, capacity
quantities, and FKs from cascade items to the plans they claim to re-time.

### A third defect: dangling promises in doc comments

Separate from the missing scenarios, several type doc comments assert behaviour that no code
implements. These read as "done" to anyone browsing the type system:

| Claim | Where | Reality |
|---|---|---|
| `{@link BatchLot#disposition}` | `ESignature`, `EntityVersion`, `AuditEvent` | **No `BatchLot` type exists** in `src/` |
| reason code `"WAVE_RESEQUENCE"` | `AuditEvent.c3typ:104` | Emitted by no code path |
| "the Scenario 1 and 2 approval cascades are single transactions" (R-BE-07) | `TransactionService.c3typ` | `Decision.approve` never calls `TransactionService` |
| "the Scenario 2 wave resequencing is signed by the Launch Board" (R-DOD-10) | `ESignature.c3typ:32` | No `ESignature` record is seeded or written |
| "Scenario 2's action plan routes most of its work here" | `seed/Team/Team.json` `team_gplo` | No `ActionPlanTask` is scoped to GPLO for a pack-mix change |
| "Scenario 2 begins with a Commercial signal — a +64% Germany forecast revision" | `seed/Team/Team.json:41` | `+64%` appears nowhere else; no record implements it |

These should be resolved in M3/M4 either by building the behaviour or by softening the comment —
a doc comment that describes unbuilt behaviour is worse than none, because it defeats the audit
this system exists to support.

---

## Product / master-data audit against the supplied NPI product table (R-DM-04, R-BASE-04)

**Status: RESOLVED (2026-09-28).** The portfolio is now the six supplied pipeline molecules,
modelled as **nine launch programmes — one per indication**, because an NPI launch is scoped per
indication and the injectable programmes share one fill line off one drug substance. That shared drug
substance is deliberate: it is what lets one drug-product event cascade across several
programmes at once.

| Launch id | Product | Modality | Indication | Dev phase | Est. launch | NPI phase |
|---|---|---|---|---|---|---|
| `seed_launch_pf3945_obesity` | PF-3945 | Amylin analogue FDC (with berobenatide) | Obesity | Phase 2 | Post-2028 | P1 |
| `seed_launch_berobenatide_t2d` | Berobenatide | Monthly GLP-1 agonist | Type 2 diabetes | Phase 3 | ~2028 | P2 |
| `seed_launch_pf08634404_crc` | PF-08634404 | Bispecific, dual PD-1/VEGF | mCRC; 1L NSCLC | Phase 3 (2 pivotal) | 2028+ | P3 |
| `seed_launch_berobenatide_obesity` | Berobenatide | Monthly GLP-1 agonist | Obesity | Phase 3 (10 trials) | ~2028 | P4 |
| `seed_launch_met097_obesity` | MET097 | Monthly injectable GLP-1 | Obesity | Phase 3 (9 trials) | ~2028 | P5 |
| `seed_launch_berobenatide_osa` | Berobenatide | Monthly GLP-1 agonist | Obstructive sleep apnoea | Phase 3 | ~2028 | P6 |
| `seed_launch_berobenatide_knee_oa` | Berobenatide | Monthly GLP-1 agonist | Knee osteoarthritis | Phase 3 | ~2028 | P7 |
| `seed_launch_sigvotatug_nsclc` | Sigvotatug vedotin | ADC (integrin beta-6) | Metastatic NSCLC | Late Phase 3 | 2027-2028 | P8 |
| `seed_launch_atirmociclib_mbc` | Atirmociclib | Selective CDK4 inhibitor | HR+/HER2- mBC (1L) | Late Phase 3 | 2027-2028 | P9 |

One launch sits in each of the nine phases, so the portfolio exercises the whole process model.

### What changed, against the seven M2 items

1. **Launch identities replaced, ids included.** No J&J/Abbott asset codename survives as a
   primary key — roughly 2,900 id and slug replacements, verified at 0 dangling references.
2. **`Launch` re-modelled for pharma.** `productName`->`productName`, `modality`->`modality`,
   `fillFinishRoute`->`fillFinishRoute`, plus new `molecule`, `indication`,
   `developmentPhase`, `trialCount`, `estimatedLaunch` and `targetMarkets` — so all four
   columns of the supplied table (Type, Indication, Phase, Est. launch) now have somewhere to
   live. The `device` field on every service payload is now `product`.
3. **Franchises rekeyed** to real therapeutic areas (`seed_franchise_internal_medicine`,
   `_oncology`, `_vaccines`, `_inflammation_immunology`, `_rare_disease`); segments to
   Primary Care / Specialty Care / Oncology. The `seed_franchise_internal_medicine`-style keys are gone.
4. **Regulatory model swapped** to NDA / BLA / MAA with FDA, EMA/CHMP and NMPA. The UI's
   US/EU pathway derivation no longer branches on `MDR` or `510(k)`, and supplement/variation
   forms are matched before their base form.
5. **Nine phases seeded** (P1-P9) on a nine-gate ladder (G1-G8 + BAU), now consistent end to
   end — `ExecutionService` had been left on the six-phase constants, which silently dropped
   P7-P9 from the Live board and mis-ranked gates G6-G8.
6. **Suppliers rekeyed.** The vendor *names* were already pharma (Aptar, West, SCHOTT,
   Stevanato, Datwyler, Vetter, Siegfried, Baxter Halle, Patheon); their ids and the
   Ariba / QMS / SRM cross-system keys now agree with them. The single-source Aptar vial
   stopper spans exactly the four sterile-injectable programmes, which is what gives Scenario 1 its
   blast radius.
7. **Target markets** carried per launch (US / EU / Global / China).

Device *process* vocabulary went with it: EO sterilisation -> aseptic fill, half-cycle ->
bracketed revalidation, cycle development -> media-fill qualification, V&V -> PPQ, notified
body -> contract laboratory, Value Analysis Committee -> P&T formulary, GUDID/EUDAMED ->
DSCSA/EU FMD, ISO 11737-1 -> Ph.Eur. 2.6.12, loaner-kit staging -> launch stock staging.

### Known remaining gaps

- `tour-overlap-report.json` and `tour-values-report.json` are tracked UI-audit snapshots from
  a pre-rebrand run and still quote the original device names. They are stale *output*, not
  inputs — regenerate or delete them rather than hand-editing, which would fabricate audit
  results.
- `DesignHistoryFileEntry` still carries a 21 CFR 820.30 device type name, though its prose now
  reads CTD. Renaming the type touches its relations on `Launch` and is deferred.
- `vacApprovals*` keeps its Value-Analysis-Committee field names while holding
  payer/formulary counts.
- The four site-era `seed_site_*` records flagged earlier (Venlo, Grand Rapids, Cashel, Neuss)
  were not part of this pass.
- The C3 Rhino test suites (`test/js-rhino/`) could not be executed here — they need a cluster.
  JSON validity, referential integrity, the QMS/Comment byte-for-byte reconciliation, the UI
  typecheck and lint were all verified locally instead.

---

## Request C — full UI redesign (Pfizer brand, Noto Sans, logo): visual-integrity pass

Work done against George's instruction to *"give a whole go on re designing completely the whole
UI, render the visuals like Celonis or Palantir, redesign with the Pfizer branding: use Pfizer font
Noto Sans, and include the logo in the relevant pages."* This section records what was **measured**,
because most of what was wrong here was invisible to code review and only showed up at runtime.

### C-1 · Tofu glyphs — ten codepoints had no glyph in the brand font

`@fontsource-variable/noto-sans` gates every `@font-face` by `unicode-range`. Ten codepoints the UI
used as **text** fell outside every subset and rendered as the browser's `.notdef` box:

| | | | | |
|---|---|---|---|---|
| `→` U+2192 | `↳` U+21B3 | `⋮` U+22EE | `▲` U+25B2 | `▼` U+25BC |
| `◆` U+25C6 | `●` U+25CF | `✓` U+2713 | `✕` U+2715 | `✗` U+2717 |

**The obvious test lies.** `document.fonts.check('600 12px "Noto Sans Variable"', '▼')` returns
**true** for all ten — it answers "is a face for this family loaded and usable", a LOAD-STATUS
question, not "does that face contain this glyph". The reliable probe is metric: render the
character in the brand family *alone* and compare its advance width against a private-use codepoint
no font has. Both measured exactly **24.00px at 40px** — the same `.notdef` box. (Comparing against
`serif`/`monospace` is not sufficient on this container image, where both generics resolve to the
same physical font; only the notdef-width signal is trustworthy.)

Characters the same probe **cleared**, deliberately left as text: `≤` `€` `•` `—` `·` `…`. These are
also outside Noto's subsets, but the fallback font has them, so they render as real typography.
Replacing them with SVG would be worse.

Fixes:
- `components/Brand/Glyph.tsx` — one component, nine named symbols, each a 12×12 SVG inheriting
  `currentColor`, `aria-hidden` (every instance sits beside a real text label). Verified at runtime:
  the down-arrow resolved to `rgb(73,88,113)` (`--g700`) and the up-arrow to `rgb(194,27,34)`
  (`--red600`) from `.kc-delta.up.r`, with no per-context colour rule.
- `.pm-ms .ms-chip::before` was `content:"◆"`; a CSS pseudo-element can't hold an SVG, so it is now
  a rotated square.
- `.ga` (mask-based arrow) for the guided tour, whose narration and spotlight labels are injected via
  `innerHTML` / `dangerouslySetInnerHTML` and so cannot use a React component. Same path geometry as
  `Glyph`'s `arrow-right`; 15 sites converted.
- **Every arrow codepoint is tofu** (`→ ⇒ ➡` all measured at notdef width); only `»` and `>` render.
  So substituting a different arrow character was not an option.

Runtime verification: a `TreeWalker` over every text node on the cockpit returns **zero** remaining
tofu characters.

**Audit-method lesson:** the first glyph audit scanned literal source characters and MISSED
`&#9660;`/`&#9650;`, because HTML entities are invisible to a codepoint scan. Two separate audits are
required — one over literal characters, one over `&#nnn;` / `&#xhh;` / named entities — and both must
strip comments first so decorative dividers don't raise false positives.

### C-2 · Accessibility: at-risk amber re-stepped (a defect affecting ALL users)

`--amber` moved `#B45309` → **`#8C5008`**. Three constraints apply and they pull in opposite
directions, so all three must be re-checked together on any future change:

| Check | Before | After | Limit |
|---|---|---|---|
| Normal-vision ΔE vs off-track red | 9.8 | **16.0** | hard floor 15 — secondary encoding does **not** excuse this |
| WCAG contrast on white | 5.02:1 | **6.43:1** | AA 4.5:1 (these tones label "+47d"/"at risk" as text) |
| CVD ΔE vs off-track red | ~2.7 | ~2.7 | target 8 — **irreducible**; 11 candidates tested, best 2.0–4.0 |

A near-miss worth recording: selecting purely on separation picked `#A8790B` (ΔE 16.9) which **fails
AA at 3.89:1**. `#8C5008` is the candidate that satisfies all three.

`.kb.a` (the launch-health stacked bar) was still using the **decorative** `--amber-s` (`#E8A33D`,
2.1:1, never validated) — confirmed at runtime as `rgb(232,163,61)`. Now the validated tone.

The validator still reports FAIL on CVD for `#15803D,#8C5008,#D8232A`, which its own rule permits
**only with secondary encoding**. Verified present three times over on that bar: the counts are
stated in words directly above it ("3 on plan · 4 at risk · 1 off track"), segments carry a 3px
surface gap, and each segment now has a `title`. Colour is the redundant channel there, not the only
one — so the labels above that bar are load-bearing and must not be removed.

### C-3 · Five fabricated charts removed (R-BASE-03)

All five had geometry hard-coded in the view layer, and three **contradicted real numbers rendered
beside them**:

| Where | What it drew | The contradiction |
|---|---|---|
| Cockpit KPI cards ×2 | 7-point `<polyline>` trend | no backend field feeds any history |
| Cockpit | rect series | — |
| Open issues | 8-week area chart | "peak 15" / "8 w ago · 14" beside a live total |
| My actions | 13 weekly bars | heights summed to 24 next to `closed: 19` |
| My actions | trend area | "3.6 d now" next to `medianTimeToDecide: "4.2 d"` |

**No time series exists anywhere in the backend** — no KPI carries a trend/history field,
`PortfolioService` has no `/trend|history|weekly|series|byWeek/` method, and
`decisionHistory.rows[].occurredAt` clusters inside ~7 days. So no trend in this app could be made
honest. Each was replaced with a real **distribution** the backend already returns
(`gateReadiness.byLaunch`, `revenueExposed.byLaunch`, `scheduleDiscipline.byGate`,
`openIssues.counts`, `decisionHistory.rows`). The holder-split bars in Open issues double as live
filters.

### C-4 · KPI card 1 read backwards

Cards 2 and 3 plot quantities of *badness* (€ exposed, days late) so taller = worse; card 1 plotted
readiness **%**, a measure of *goodness*, so the launches in trouble drew the SHORTEST bars while
100 %-ready launches towered over them. Three adjacent cards, two opposite conventions.

Fixed with an explicit `invert` prop on `KpiDistribution` (plots shortfall from 100, clamped at 0)
rather than by mangling the data. Breach tinting still evaluates the **true** value, and the
`aria-label` changes to "Shortfall from 100 across 9 launches" so a screen-reader user isn't told the
opposite of what is drawn. Verified: worst launch (Sigvotatug, 67 %) is now the tall bar; the three
100 % launches draw the 2px floor.

Not a bug, checked: the label says "6 are under the 85 target" while tooltips read "83%" — the
tooltip *rounds* 5/6 = 83.33 % for display while the breach test uses the true value against 85.

### C-5 · Duplicate bar labels in "Days at stake"

Four of five rows printed the same number twice ~8px apart ("35d 35d", "13d 13d", "8d 8d", "5d 5d"):
the inside segment label and the end-of-bar total coincide whenever `regulatorDays === 0`. Only
Berobenatide is genuinely split (25 green + 45 grey = 70).

The fix had to go through `valueAccessor`, **not** `formatter`: Recharts' `LabelList` types
`formatter?: Function` (untyped) and passes it the resolved value only, whereas
`value = isNil(dataKey) ? valueAccessor(entry, index) : getValueByDataKey(...)` shows the accessor
receives the whole row — and only when `dataKey` is absent. Verified at runtime: `["25d", blank×4,
"70d","35d","13d","8d","5d"]`.

### C-6 · Housekeeping

- `src/pages/` (10 files) proved to be **dead code** — `App.tsx` renders only `MenuScreen`/`AppShell`,
  which import exclusively from `src/views/`; zero imports from `pages/` exist. No redesign effort
  spent there. (It is still a removal candidate.)
- Removed 25 inline styles in favour of `.v-msg`/`.v-err`, and de-duplicated a byte-identical
  ~14-property inline-styled block present in **both** `ChatView` and `EodCapture` into
  `.cap-l`/`.cap-i` (+ a `.cap-l.ok` success variant). That block hardcoded `#fff` and `#F0F7F2`;
  `--ok-bg` is exactly `#F0F7F2`, so the token now tracks it.
- Gridlines in the days-at-stake chart are dashed and paint behind the bars.

### Still open on Request C

- Views not yet redesigned: Portfolio, Resolution, LaunchRecord, OpenIssues, Copilot, MyActions,
  Orchestration.
- `CascadeView`'s emoji domain icons (🏭📦📣💶🔬⚖️) still stand in for real iconography.
- Card 1 renders six amber bars of near-identical height — honest, but a poor read; needs either
  ordering by shortfall magnitude or a different encoding.
- Dark mode is unvalidated against its own surface (`--s1..--s6` remain additive-only).
- Density: "Markets needing attention" duplicates rows 5×.
- Text leftovers: "Notified Body" (device regulatory) in `AlertsView`; hardcoded "oldest raised
  **6 days ago** · 1 already chased once" in `ActionsView`.
- **The product names in every screenshot above are still device form factors** — "Berobenatide Gen 2
  PFA Catheter", "Vepdegestrant", "PF-08634404". R-DM-04 (M2) is the fix; no amount of
  visual work resolves it.

### C-7 · Colour-only status marks replaced with a shape vocabulary

Four hand-copied `<span className={'mg-dot ' + status}>` instances across three views became one
`components/Brand/MlDot.tsx`. Each state now carries geometry as well as hue — triangle (off track,
angular, matching `SstIcon`'s existing "angular = blocked commitment" rule), solid disc (at risk),
hollow ring (on plan, no ink to draw the eye), dash (not reported, *absent* rather than merely
quiet) — plus a named `<title>`.

Two defects this surfaced that were invisible in source review:

- `PortfolioView`'s first-ship list did `className={l.status === 'ok' ? '' : l.status}`, so an
  on-plan launch and a launch with **no status at all** rendered pixel-identically.
- `.mg-dot` base `--g300` vs `.ok` `--g500` is ~0.2 lightness at 7px, i.e. "nobody reported" and
  "this is fine" looked alike.

`components/portfolio/HealthTag.tsx` (7 exports, **0 importers**, verified twice) encoded status by
colour alone and was deleted — dead code that does this is worse than merely unused, because it is
the file the next author copies. `SideNav`/`TopNav` are also unreachable but **kept**: the frontend
skill says "Never remove the SideNav."

### C-8 · A legend that was lying about the map it explained

The map legend's `.md` base was a raw `#8FA9C0` found nowhere in the token system, while the on-plan
pins it claimed to explain painted `var(--sky)` `#0093D0`. Measured: legend `rgb(143,169,192)` vs
pin `rgb(0,147,208)`. After re-pointing `.md` to the same tokens as the pins: `allMatch: true`
across all three state pairs. No static check could have found this — it is a *measured* drift
between two files that never mention each other.

Also removed 9 static inline style objects (6 in the track legend, 3 in the map scale) to classes,
including a presentational `--f: 55%` phase-fill that was being set from JSX and read as a business
value; runtime confirms `inlineStylesLeft: 0` in both legends.

### C-9 · Tofu in backend prose — the defect class a source grep structurally cannot find

A background agent scanned every `.ts`/`.tsx` file and reported the nine known tofu codepoints
clean: "0 in rendered JSX text or in string constants." **That was true and still wrong.** A runtime
tree-walk over rendered text found live `.notdef` boxes, because the remaining instances never
appear in source — they arrive in prose *from the backend*. `Escalation.progressSummary` was
rendering "Raised □ accepted □ both scenarios prepared by the agent"; the copilot's handoff-chain
subtitle was four boxes. Canvas metric probe confirmed: arrow advance `24.0039px` ===
private-use U+E0FF `24.0039px`, vs `A` at `25.56px`.

A UTF-8-aware scan of `seed/` + `data/` (BusyBox `grep -o` splits multibyte chars into bytes, so its
counts are worthless here) found **12 × U+2192 and 1 × U+25CF over 7 lines in 4 files**, of which:

- **10 arrows are correct data** — the summary really is a ladder of states and `→` is how "this
  becomes that" is written. The defect is the *font subset*, not the text. Fixed at render via a new
  `components/Brand/GlyphText.tsx`, so authors can keep writing ordinary prose; stripping arrows out
  of seed JSON would flatten real structure and would have to be redone for every future string.
- `Person.initials: "●"` → `"LB"`. Unrendered today (IssueView derives initials from `name` and
  already draws a `Glyph` dot for the no-name case), so this was a latent trap: the **data** was
  saying "draw me a box".
- `DataFeedWatermark.targetType` → ASCII `->`, which is what its own `.c3typ` doc already specified
  (`"ProcessMeasurement -> Lot"`). The data was violating its own contract.

Accessibility: `Glyph` is `aria-hidden` because its callers pair it with a visible label, but here
the arrow *is a word in the sentence*, so each substitution ships an adjacent screen-reader-only
word. Accessible text now reads "Raised **then** accepted **then** …" instead of welding two rungs
together. This required adding `.sr-t` — the CSS had no screen-reader-only utility at all, and
`ChatView` was hand-rolling the idiom in four inline style properties.

**Two bugs found in my own fix, both only by measuring after the change:**

1. `TOFU_RE.test()` with the `g` flag advances `lastIndex`, so the same string alternates
   true/false/true between renders and arrows would flicker. Split into an unflagged `HAS_RE` for
   testing and a `g`-flagged `SPLIT_RE` for splitting; `String.split` ignores `lastIndex`, `.test`
   does not.
2. Tailwind's preflight sets `svg{display:block}`. Every prior `Glyph` caller got away with it by
   sitting in a flex row, but `GlyphText` puts glyphs *inside a line of prose*, where a block-level
   svg forces a break — **shredding the copilot's one-line 15.9px subtitle into 115.8px across 9
   stacked lines** (`rd-16-chain-broken.png`). `.gly` now declares `display:inline-block`. Note a
   CSS grep cannot find this: `svg.matches(rule.selectorText)` over every stylesheet returned **no
   `display` rule at all**, because the offender is in the preflight.
   Separately, `vertical-align` is inert on a flex item, so the arrows in `.dr-ai`
   (`display:flex`) hung 3.91px above the text's optical centre at 11.5px type; `.dr-ai .gly
   {align-self:center}` brings it to 0.01px.

Verified: `isTofu: true` still (the font is unchanged — the arrow is *drawn*, not fixed) while
`liveTofuTextNodes: []` across all 10 views and sub-panes; chain height 15.9px exactly matching its
glyph-free sibling; 20 glyphs across 6 views with no layout regression. Build green, 732 modules.
Screenshots `rd-15-tofu-fixed.png`, `rd-16-chain-broken.png`, `rd-17-chain-fixed.png`.
