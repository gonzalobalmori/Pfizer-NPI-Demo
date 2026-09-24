# Workspace Summary

> Work-to-date map of this workspace. Keep concise; update as meaningful changes land.

## Current state

Building the **J&J MedTech agentic NPI Launch Control** app (Mode A, full-scope) from
`.attachments/JNJ_MedTech_NPI_Demo.html` (functional/visual spec) + `.attachments/C3_build_prompt.md`
(priority-ordered brief). Demo "now" = **2026-09-11 08:42** (LGNOW).

- **Ontology (`src/`):** ✅ DONE — 34 entity types + `HasExposure` mixin, all validate & provision clean.
- **Seed data:** ✅ DONE — generated from the exact HTML arrays, upserted, reconciliation invariants pass.
- **Backend methods & metrics:** ✅ DONE (task #2) — approve transaction + heldBy guard + 12 §3.5 metrics, all verified.
- **Reconciliation unit tests (§3.6, task #4):** ✅ DONE — `testtools` added to c3pkg.json deps.
  `test/js-rhino/unit/test_Reconciliation.js` (11 specs: activities by phase 16/19/27/22/14/9,
  by status 48/8/5/2/44, by domain 12/sum107, autonomy A95/R12 (H merged into R), findings
  **USER5/HELD3/AUTO1/RUNNING2 — 11 total** after post-market removal, see below)
  + `test/js-rhino/functional/test_DecisionGuard.js` (4 specs: assertUserCanDecide passes NPI-0417 USER,
  throws for AGENT/ESCALATED/DELEGATED). All 15 pass via `runTest`.
- **UI — Execution branch (§2, task #5):** ✅ DONE — `ExecutionService.js` (7 read methods returning
  plain JSON) + 4 React pages, all browser-verified (c3Action 200 OK, real seed data). See below.
- **UI — oversight screens (§5, task #6):** ✅ DONE — Cockpit, Portfolio (4 lenses), Open Issues,
  Launch Record (Overview/Workflow/Documents tabs), Strategic Decisions placeholder. Backed by
  `PortfolioService` (8 read methods), all browser-verified (c3Action 200 OK, real seed data). See below.
- **Verify/wire/smoke-test (task #7):** ✅ DONE — `npm run build` clean (lint+tsc+vite), no critical
  Pkg.Issue, every §5 page fires its c3Action → 200 OK with real J&J records rendered.
- **UI RE-SKIN (verbatim prototype port):** ✅ DONE — the entire frontend was rebuilt to reproduce the
  click-through prototype (`JNJ_MedTech_NPI_Demo.html`) exactly: raw CSS ported verbatim, prototype's own
  top-header + tab-strip navigation (no URL routing), landing MENU screen, all 11 views + menu using the
  prototype's own class names. Every figure stays fed by the existing PortfolioService/ExecutionService
  c3Actions ("keep live C3 data"). Browser-verified: all 11 views + menu render, all c3Actions 200 OK,
  model invariants hold (Copilot refusal verbatim, no escalation withdrawal, absolute timestamps). See
  **UI shell / views** below (this SUPERSEDES the old Tailwind/SideNav/routed-pages layer).

- **Time-impact / schedule-recovery feature (tasks #10–15):** ✅ DONE — surfaces which open-issue delay
  you can pull in by acting vs. a fixed wait on an outside authority. `Finding` gained two fields:
  `dependency` enum SELF/TEAM/AGENT/REGULATOR + `daysAtStake: int`. Split rule (single source):
  `recoverableDays = dependency==='REGULATOR' ? 0 : daysAtStake`; agents count as recoverable (they only
  run when you launch them). New backend `PortfolioService.timeImpact()` returns portfolio totals
  {daysAtStake, recoverableDays, regulatorDays, pctRecoverable, openCount} + per-launch breakdown
  (worst-first); `openIssues()` enriched with `dependency, daysAtStake, recoverableDays, regulatorDays,
  recoverable`, adds an **AUTHORITY** waiting-on bucket + counts, and sorts by recoverableDays first.
  New regulator-bound finding NPI-0420 (VARIPULSE, FDA deficiency letter, 45d). **Cockpit** (`CockpitView.tsx`)
  shows a full-width Recharts horizontal stacked bar (green recoverable / grey authority-fixed) per launch,
  headline + legend. **Open issues** (`AlertsView.tsx` — the LIVE view; `pages/OpenIssues/OpenIssues.tsx`
  is dead/unrouted) gained an "On an authority" lens, two live header tiles (Recoverable-by-acting /
  Waiting-on-authority replacing the old hardcoded "Worst slip"/"Agents resolving"), and a **Time impact**
  column with a "You can accelerate" (green) vs "Waiting on authority" (grey) chip. Verified reconciling:
  totals 131d = 51 recoverable + 80 authority (39%); VARIPULSE 43%, ETHICON 0% (all authority), others 100%;
  openIssues counts YOU5/PERSON2/AGENT0/AUTHORITY3, total 10. Build green.

- **Post-market removal + cockpit metric reconciliation (tasks #38–43):** ✅ DONE. (1) **Removed all
  post-market (P6) agent activity**: the two AUTO findings on the LAUNCHED DUALTO — I-331 (Cashel yield)
  & I-328 (EUDAMED) — and every dependent (chains chn01/chn02, 7 AgentActions, 5 Handoffs, 2 Decisions,
  CAPA-2026-0139, 2 GuardrailChecks, 4 Comments, the Veeva V0Q…139 source row). In-flight AUTO finding
  I-319 (Javelin XL) KEPT. Live DB orphans purged via `removeAll`. Findings now **11** (USER5/HELD3/**AUTO1**/
  RUNNING2); chains **11** (all in-flight); CAPAs **2** (0148, 0151). (2) **Cockpit top metrics now
  reconcile with portfolio**: `LaunchControlMetrics.launchHealthDistribution()` returns `active`
  (= total − LAUNCHED = 8) + `rollup {onPlan: ON_PLAN+PRE_MARKET=3, atRisk:4, offTrack:1, launched:1}`;
  `LaunchHealthKpi` (portfolio.ts) + `CockpitView.tsx` render **8 active · 3 on plan / 4 at risk / 1 off
  track** (sum 8 = active), matching the portfolio at-risk/off-track table. Browser-verified. CopilotPrompt
  copy updated (waiting/overnight/today: "Six→Four more moving without you"). gen_seed.mjs source maps
  updated in parallel (POST_MARKET filter Sets on IZ/OCH/THR, guardrail loop `['319']`, DEC_HELD, CAPA
  0139 push removed) so a future re-run stays consistent. test_Reconciliation fixture → 11/AUTO1, all pass.

## Seed generator

`/usr/workspace/gen_seed.mjs` (Node, run `node gen_seed.mjs` from `/usr/workspace`). Parses the HTML
literal arrays (FLA, OCH, IZ, OLANE, MKT/MKS/MKN, THR, PROB, HOLD, PEEK, ACTS, doc register) and emits
per-type JSON into `jJDemo/seed/<TypeName>/`. **Edit the generator, not the JSON**, then re-run + `upsertSeedData`.
⚠️ NOTE: the generator is STALE relative to several later surgical JSON edits (DUALTO revenueAtRisk 200000→0,
etc.) — re-running would REGRESS them. Post-market removal was done by editing JSON + source maps in
parallel WITHOUT re-running. Treat re-running as a manual reconciliation exercise, not a safe refresh.

## Backend types (34 + 1 mixin, in `src/`)

Segment, Franchise, Launch, Phase, Gate, GateCriterion, FunctionalDomain, AutonomyClass, Person,
Activity, Market, MarketLaunch, Supplier, Site, QualifiedProcess, ContractTerm, BillOfMaterialItem,
Agent, Finding, Chain, AgentAction, Handoff, Guardrail, GuardrailCheck, Decision, DecisionOption,
Escalation, EscalationEvent, CAPA, ActionPlanTask, Document, DesignHistoryFileEntry, Comment,
Notification; mixin HasExposure.

- **Decision**: `heldBy enum('USER','ESCALATED','DELEGATED','AGENT')`; `approve(optionLabel):Decision js` +
  `assertUserCanDecide():boolean js` — ✅ IMPLEMENTED in `src/Decision.js` & smoke-tested. Approve verified to
  produce the exact toast: G3 21 Dec→13 Nov · slip 47→9 · €18.4M released (launch→ON_PLAN) · 7 tasks (4 Dispatched
  /3 Assigned) · 3 notifications sent · CAPA-2026-0148→CONTAINED · immutable DHF entry appended. Re-run rejected;
  non-USER rejected. (Test state was reset back to pre-approval after verifying.)
- **CRITICAL ontology change:** the 8 **operational** types the approve transaction / fleet mutate at runtime —
  **Gate, Launch, Finding, Decision, ActionPlanTask, Notification, CAPA, DesignHistoryFileEntry** — had the
  `SeedData` mixin **REMOVED** (they are now plain `entity type`, Launch/Finding keep `HasExposure`). Reason:
  `SeedData` **locks every provisioned field value against runtime updates** ("Seed Data value can not be updated"),
  which is fatal for the approve cascade. Their seed JSON now lives in **`jJDemo/data/<Type>/`** (loaded, not locked),
  not `seed/`. The generator routes these via the `OPERATIONAL` set → `DATA` dir. All other types stay `SeedData` in `seed/`.
- **CAPA**: `id` = seed key (`seed_capa_0148`); `capaId` = business id (`CAPA-2026-0148`).
- **EodLogService** (`src/EodLogService.c3typ` + `.py`) — the conversational-capture backend for the End-of-day log UI. **Python service** (NOT JS): the LLM `completion` API can only be called natively from `py-vertexai_litellm_312`, so it throws from JS — hence Python. Four static methods (all take `cls` first, all return `json`): `domains()` (13 domains incl. "all"→Orchestrator agent, from Agent + FunctionalDomain seed), `guidedPrompts(domain)` (builds targeted questions from the domain's slipping gates `status!='ok' && slipDays>0` + open findings `outcome in USER/RUNNING/HELD`, always ends with a catch-all prompt), `extractSignals(domain,freeText,answers)` (splits text into sentences / parses guided answers, tries `_llm_extract` over keys [gpt_4o, gemini_2.5_pro, default-completions, gemini_2.0_flash] then falls back to `_fallback_extract` — a deterministic bilingual EN/ES keyword classifier that maps each signal to a kind→category and matches launches by name token; returns DRAFTS with confidence + needsReview, `engine` = 'llm'|'deterministic'), and `commitSignals(approvedDrafts)` — the **SOLE writer**, creates `Finding` via `mergeBatch` (id `eod_finding_<seq>`, displayId `NPI-<seq>`, `outcome='RUNNING'`, `signalSource='eod-log'`, `detectedBy`=domain agent, `detectedAt`=now). **Sandbox caveat:** no LLM secret is provisioned so all clients fail auth → extraction always uses the deterministic fallback (LLM path stays wired for when creds exist). Full circuit verified via runJsCode incl. a create-then-cleanup of a real Finding (`Finding.removeAll({filter},true)`). No critical Pkg.Issue.
- Reserved-name avoidance: used `functionName`, `documentDate`, `entryAt`, `commentedAt`, `handedAt`,
  `occurredAt`, `evaluatedAt`, `sentAt` (not `type`/`make`/`at`/`scan`/`schema`).

## Seed counts (live, verified)

Segment 3, Franchise 7, Launch 9, Phase 6, Gate 5, GateCriterion 6, FunctionalDomain 12, AutonomyClass 2 (A, R — H merged into R),
Person 14, Agent 14, **Activity 107**, Market 22, MarketLaunch 46, Supplier 4, Site 4, QualifiedProcess 3,
ContractTerm 2, **BillOfMaterialItem 4** (ring-electrode shared-supplier set — see Set M), Guardrail 6, GuardrailCheck 9, **Finding 12**, **Chain 9**,
**AgentAction 33**, Handoff 24, Decision 11, DecisionOption 8, Escalation 2, EscalationEvent 10, CAPA 3,
ActionPlanTask 21, **Document 731** (every launch now has a complete 9-section register; see below), DesignHistoryFileEntry 4, Comment 27, Notification 3.

## Reconciliation invariants (§3.6, verified against DB)

- Activities by **phase** 16/19/27/22/14/9 ✓ · by **status** ok48/run8/rk5/late2/no44 ✓ ·
  by **autonomy** A95/R12=107 ✓ (former Human-led H folded into R — clean agent-executes vs. human-decides split) · **12 domains** ✓.
- Activity log = **33 completed actions across 14 agents**, reverse-chronological (brief says "32,
  grows as the fleet works"; restored the Line Monitor's genuine CHN-02 opening detection to reach 14 agents).
- Anchor case **NPI-0417 / CAPA-2026-0148** modelled end-to-end: finding→decision(USER, due 17:00,
  €250k authority)→3 options (A recommended, keeps €18.4M)→21 tasks→CAPA→6 guardrail checks→4-comment
  thread→3 notifications→4 DHF entries. CHN-09 reconstructs in time order (qua→gov→src→reg→orc).

## Manager demo-review changes (J&J Demo Changes.docx — applied)

Feedback doc `.attachments/docx_extract/` (~28 items, Spanish, 11 screenshots). Applied:

- **Phase renaming (structural, top ask):** all 6 phases renamed to the manager's scheme —
  P1 Feasibility (strategic definition) / P2 Design Inputs (supply definition) / P3 V&V (verification & validation)
  / P4 Transfer / P5 Ready / P6 Post-market. Changed in `seed/Phase/Phase.json`, `PortfolioService.PHASE_META`+`PHASE_MODEL`,
  and `ExecutionService.PHASE_META` (all three must stay in sync). Upserted + cache-cleared + verified in cockpit/openIssues/launchRecord.
- **Cockpit phase/gate/milestone band:** new `PHASE_MODEL` (backend) → `data.phaseModel` drives a `.pm-band` on the
  Cockpit first page (CockpitView) defining phases, gate that closes each (G1..G5/BAU), and regulatory milestones
  (Regulatory Submission Filed @ G3, FDA Approved/CE @ G4, First Ship @ G5). Verified rendering.
- **Cockpit "Next gate" column:** was showing markets; now shows the launch's actual next open gate via
  `nextGateByLaunch` lookup (`cockpit()`), with a code-vs-name dedup so "BAU handover" doesn't double.
- **Item 1 — IssueView false CAPA framing:** `IssueView.tsx` hard-coded VARIPULSE-G2 supplier-quality/CAPA copy
  (CAPA-2026-0148, "Quality agent opened CAPA…", G3/+47d, validation/BSI impact) that rendered for ANY finding —
  so Javelin's commercial NPI-0319 showed a false quality/CAPA story. Now data-driven: `resolutionWorkspace()` returns
  `capa` (from `CAPA.fetch` by finding) + `gateAtRisk` (launch's next open gate); the CAPA chip, quality tag, CAPA
  paragraph, gate meta, and impact block render conditionally on `ws.capa`/slip. Verified: 0319 → no CAPA, "Commercial"
  tag, "on schedule"; 417 → CAPA-2026-0148, G3, +47d.
- **Item 2a — Cerenovus empty-but-live columns:** `ExecutionService.liveBoard` column `state` was hard-coded 'live'
  for P3/P4; now downgraded to 'queued' when the (franchise-filtered) column has 0 cards. Verified Cerenovus.
- **Item 2b — mis-attributed step:** `seed_chain_iz351_a2` "Pricing a second sterilisation lane" was `seed_agent_qua`
  (Quality); reassigned to `seed_agent_sc` (Supply Chain) to match the finding's `detectedBy` and sibling step a1. Verified.
- **Item 3 — Manufacturing count confusion:** no data bug (whole-launch "4 Not started" vs P3-only "1/3" answer different
  questions). Clarified the FlowView Status strip label to "… across all phases" so the scope is explicit.
- **Item 4 — India timeline empty:** `MK_QUARTERS` ended Q4 2027 but India ships Q2/Q3 2028 → row said "2" with no chips.
  Extended window contiguously through Q3 2028. Verified: India now shows ETHICON 4000+ (Q2 28) + Javelin XL (Q3 28).

Runtime gotcha: after editing backend `.js`, `runJsCode` can be stale — call `clearCaches({workspaceId})` then retry.
`Filter.and` here is a member (`Filter.eq(...).and(...)`), NOT varargs-array.

## Key decisions

- Two HTML action datasets: **OCH** (9 rich chain narratives w/ handoff prompts) and **IZ.steps**
  (timestamped activity feed). Seeded chains/actions from OCH, mapped IZ elapsed markers → absolute
  `occurredAt` (§6: no elapsed-only timestamps).
- §4.3.2 honored: no invented franchises; failures attributed to next-gen designations (Gen 2, 4000+), not marketed devices.
- **Metrics layer:** `src/LaunchControlMetrics.{c3typ,js}` — all 12 §3.5 metrics as static `json`-returning
  derivation methods (UI calls via c3Action; §3.6.1 no stored display strings). Verified values: autonomy 95A/12R
  (88.8%; H merged into R), handoffs 24/9 chains (max 4), breaches 0, 12 domains/107 acts, openFindings 5 USER/2 HELD/3 AUTO/2 RUNNING,
  health 9 launches. `guardrailBreachCount(days)` & `decisionsTakenTrailing90Days(days)` take an `int` param.
- **DEVIATION (§6, documented):** the prototype's per-launch exposure figures do NOT reconcile to its own €30.5M
  headline (cockpit attention table sums to €44.1M; resolution narratives to €38M; only VARIPULSE €18.4M is stated
  consistently). Per §3.6.1 (one source, derive don't store) we keep each launch's attested `revenueAtRisk` and
  DERIVE the portfolio total (€38M) rather than hard-coding €30.5M. Spec constants (Δ+€11.2M/30d, €412M base,
  readiness target 85/−6pts, slip target ≤5/worst 47) are returned as context alongside the derived value.
- Finding outcomes are **5 USER / 2 HELD / 3 AUTO / 2 RUNNING** (from the HTML), not the 4/2/3/3 an earlier comment sketched.

## Data pipeline (Build brief 2 — Items 3 & 4, REAL & verified)

- **Item 3 — synthetic source extracts:** `/usr/workspace/gen_sources.mjs` (seeded 0x1a2b3c4d, re-runnable, byte-identical). Emits **21 feeds** across 11 source systems into `jJDemo/sources/<system>/` + `_MANIFEST.json`. Feeds look like real SAP/Ariba/SRM/D&B/Veeva-QMS/Veeva-RIM/LIMS/MES/PPM/Workday/portal extracts (real column names, key formats, bounded dirt: nulls, 1 dup, trailing-space key, DD/MM/YYYY alt-date; 3 planted crosswalk mismatches; Heraeus omitted from D&B → no match). `QMS_COMMENT` generated verbatim from the 4 locked Comment records of `seed_decision_417` (thread guarantee).
- **Item 4 — the pipeline (DONE):**
  - New ontology types: `Lot`, `ProcessMeasurement` (Heraeus SPC contrast case), `SupplierCrosswalk` (key resolution), `DataFeedWatermark` (freshness), `LineageRecord` (provenance). All operational → `data/`.
  - **Gold path proven REAL:** `src/source/SrcPpmGate.c3typ` + `metadata/Transform/SrcPpmGate-Gate.js` (uses `replace()` not `replaceAll` — id reversal `G-VARIPULSE_G3`→`seed_gate_varipulse_g3`) + `metadata/FileSourceSystem/NpiSourceFiles.json` + `metadata/FileSourceCollection/PpmGateFeed.json`. Verified end-to-end: wrote a mutated PPM_GATE file to the Azure inbox, `.process()`, and the SAME gate row updated (slip 47→9, forecast 2026-12-21→2026-11-13, no duplicate). Then RESTORED to baseline (47/2026-12-21) so the thread demo is intact.
  - **`src/PipelineOrchestrator.{c3typ,js}`** — stateless service, 5 methods (all smoke-tested green): `feedHealth()` (20 feeds FRESH, flips STALE at 2× cadence — drives demo 3), `resolveSupplier(kind,value)` + `crosswalkReport()` (AUTO 2/MANUAL 1/PARTIAL 1; Heraeus DUNS gap surfaced), `lineageFor(type,id)` (Gate→PPM_GATE/file/row/transform — demo 1), `reconcileThread()` (staged QMS_COMMENT vs locked golden thread — **match=true, 4/4 byte-for-byte**).
  - Derivation step: `/usr/workspace/gen_pipeline_data.mjs` turns source extracts → `data/` files for the 5 new types (deterministic). Verified in DB: 12 lots (09-12 HOLD w/ spcViolation), 403 measurements (366 violations, all confined to the 4 HOLD lots, escalating 59→66→110→131; RULE_1 333 / RULE_2 33 — matches NPI-0412 "4 of 12 lots out of spec").
  - **Two lanes honored:** operational types in `data/` accept idempotent load updates; `SeedData` types (Comment etc.) are LOCKED — the escalation thread cannot be mutated by any load, so QMS_COMMENT is STAGED + reconciled, never written over.
- **Item 5 — DQ + reconciliation tests (DONE, failing-first):**
  - **`src/DataQualityCheck.{c3typ,js}`** — 7-rule engine, uniform verdict shape `{rule, feed, field, rowsChecked, failures, offenders[], status}` (PASS/WARN/FAIL). DQ-* read raw `meta://` extracts; RECON-* read loaded ontology. `runAll()` = scoreboard. NOTE: native JS arrays (split/JSON.parse/literals) lack C3 `.each()` → use the `forEach()` helper; only `.objs` fetch results keep `.each()`.
  - Rules + verified verdicts: **DQ-KEY-01** (SAP_LFA1.LIFNR trailing space → FAIL, Sterigenics `0001007988 ` line 3), **DQ-UNIQ-01** (dup → FAIL, BSI `0001009003` ×2), **DQ-DATE-01** (LIMS non-ISO → FAIL, OCT-BIO-07 `02/09/2026`), **DQ-REF-01** (missing DUNS → FAIL, Heraeus PARTIAL), **DQ-COMPLETE-01** (STCEG nulls → WARN 52/57, non-blocking), **RECON-SPC-01** (366 breaches all in HOLD lots → PASS), **RECON-THREAD-01** (staged QMS_COMMENT == locked golden NPI-0417 thread → PASS, the regression guard).
  - **DQ-GATE-01 — enforcing admission gate (`supplierAdmissionGate()`):** the "80/20" mechanism the user asked for. Sorts all 57 SAP_LFA1 rows into 3 buckets, none lost: **ADMITTED 55** (clean, load as-is), **CLEANSED 1** (Sterigenics padded key trimmed inline then admitted), **QUARANTINED 1** (BSI duplicate, refused with reason, never loaded). Returns `{status:'GATED', rowsChecked:57, admittedCount:55, cleansedCount:1, quarantinedCount:1, admittedRate:98.2}`. Surfaced in `runAll()` under `.gate` (status GATED, NOT counted in the PASS/WARN/FAIL scoreboard so the 4/1/2 tally stays clean).
  - Tests: **`test/js-rhino/unit/test_DataQuality.js`** — 20 specs, all green (each DQ test asserts the rule CATCHES its planted defect: right count AND right key — "failing-first" = non-vacuous; 5 specs cover DQ-GATE-01 buckets/repair/quarantine/98.2% admit). `runAll` scoreboard test pins 4 FAIL / 1 WARN / 2 PASS. Existing `test_Reconciliation.js` (11) + `test_DecisionGuard.js` still green.
  - **Env note (§7):** Data Lakehouse + Data Sharing sections are NOT provisioned in this sandbox (route `/lakehouse` returns "No page found") — demo Data Integration + Object Model + Data Validation, which are fully real here.
  - **Native platform DataValidation.Rule registration (DONE — the user's actual ask):** the ontology-level DQ rules are ALSO registered as native `DataValidation.Rule` objects so they appear + are editable in Studio's **Configure → Data Fusion → Data Validation** screen (not only as `c3Action` methods). Two new `DataQualityCheck` methods make this reproducible in-repo: **`registerValidationRules()`** (idempotent — removes prior draft by id, then authors 6 rules) and **`runValidationRules()`** (registers + runs all 6, returns runIds). Both live in `src/DataQualityCheck.js` with signatures in the `.c3typ`.
    - **KEY API LEARNING:** author as a **`DataValidation.Rule.Lambda.Draft`** via `DataValidation.Rule.Lambda.Draft.save(draft, UpsertSpec.make({}))` — this is the exact object the editor operates on, and `save()` parses the rule's **`userCode`** (JS source shown in the editor) into the runnable `map`/`summarize` lambdas, persisting BOTH together. A bare `Rule.Lambda.make()/create()` DROPS `userCode`; `deploy()`-ing a Draft to a concrete rule ALSO drops `userCode` — so we KEEP the Draft. Draft runs via `draft.run()`. `detailsType` must be a NAMED tuple (`TupleType.fromMap({...})`).
    - **6 rules + verified verdicts (live):** `dq_supplier_risk_rating` (PASSED), `dq_supplier_approval_present` (PASSED), `dq_supplier_audit_current` (PASSED), `dq_supplier_single_source_risk` (**FAILED_MODERATE**, 1 offender = `seed_supplier_heraeus` Heraeus Medical Components, single-source + High risk), `dq_lot_state_present` (PASSED), `recon_spc_confinement` (PASSED, all out-of-spec measurements confined to spcViolation-flagged lots). All 6 persist `userCode` (498–1021 chars) so the editor shows editable source. Raw-file DQ-* rules (KEY/UNIQ/DATE/COMPLETE + admission gate) read `meta://` CSVs (not MapReduce-able entity types) so they stay `c3Action` methods, not registered here.
    - **NOTE on recompilation:** after editing `DataQualityCheck.js`, new method signatures may not resolve in the running app until caches clear — use `clearCaches(workspaceId)` then wait ~25s before calling the new method.
- **Item 6 — 3 live-demo runbooks (DONE):** `jJDemo/resource/DEMO_RUNBOOK.md`. Demo 1 = trace a number to its source row (`lineageFor('Gate','seed_gate_varipulse_g3')`); Demo 2 = change a source, watch the app move (mutate PPM_GATE → `.process()` → slip 47→9, then reset script); Demo 3 (SUBSTITUTED for "break a feed" per user) = the DQ-GATE-01 admission gate (55 admit / 1 repair / 1 quarantine — the 80/20 story). Each script has steps + call + expected output + the sentence to say; ends with `runAll()` closer + §7 sandbox caveat.
  - Remaining brief item (pending user confirm): Item 7 (business-language written summary).

## UI shell / views (current — verbatim prototype port)

The React app reproduces the prototype's **screen model**, not React-Router routes:
- **CSS:** raw prototype CSS ported verbatim to `ui/react/src/styles/prototype.css` (~2266 lines; J&J red
  ramp `--red500:#EB1700`/`--red600`, `--amber`, warm-grey ramp, 13px base). Imported LAST in `main.tsx`
  so it wins over any residual Tailwind. Verbatim port rules: `class`→`className`, `onclick`→`onClick`,
  inline `style="…"`→`style={{…}}`, void tags self-closed, prototype class names + static text word-for-word.
- **Nav model:** `nav/NavContext.tsx` — two screens (`menu`/`app`), three branches
  (strategy/pipeline/exec) each with a tab set (`BRANCH[branch]`), drivers `go(branch,view)` /
  `open(view,param)` / `tab(view)` / `toMenu()`. `param` carries a launchId/findingId into drill-downs.
  `VIEW_BRANCH` maps drill-downs (launch/flow/docs→pipeline, issue→exec). Default branch 'pipeline', view
  'cockpit'. NO URL routing — App.tsx renders `MenuScreen` (menu) or `AppShell` (app) off nav state.
  Also exposes **`drive(target: DriveTarget)`** — atomic deep navigation that sets screen/branch/view/param
  AND publishes a `DriveIntent` (the target + a `seq` counter) so a destination view can land on an exact
  sub-state: `lens` (Portfolio), `marketView`/`marketPick` (Portfolio market), `actionsPane` (My actions),
  `towerPane`/`towerFranchise`/`towerOpenCard` (Agent tower), `chatAsk` (Copilot canned prompt). Each view
  reads `intent` via `useNav()` and applies the fields naming its own local state; `go`/`open`/`tab` clear
  the intent. This is the mechanism the guided tour uses.
- **Shell:** `shell/AppShell.tsx` — two-row sticky `.hdr` (J&J wordmark + back-to-menu chevron, branch
  label, "Guided demo" button, "My decisions" button → exec/actions, avatar; source-systems chip removed) + `.tabs` strip
  from the active branch's tab set; `.body` renders exactly one `.view.on`. `shell/MenuScreen.tsx` — the
  landing "SCREEN 0" (wordmark bar, "Hi, Helena" hero, 3 branch cards, right rail).
- **11 views** in `ui/react/src/views/` (all fetch via `api/portfolio.ts` / `api/execution.ts` → c3Action):
  - `CockpitView` → `getCockpit()` (reference pattern: 4 KPI `.kc` cards + 2 `.pnl`/`.dt` panels; rows → `open('launch',id)`)
  - `PortfolioView` → 4 lenses (`getPortfolioProduct/Market/BusinessUnit/Timeline`; Market lens embeds the decorative world-map SVG). **Lens visibility fix:** all four pane roots carry `pf-l sb-p on` (prototype CSS hides `.pf-l`/`.sb-p` unless `on`; originally only the product pane had it, so Market/Business unit/Timeline were invisible — verified all 4 now render). **Business-unit lens redesign (per manager feedback — no static title sections):** `BuPane` now renders a `.filt` **filter-chip bar** ("All units" + one health-toned `.fb` chip per unit w/ launch-count badge) plus `.bu2-row` **expandable rows** (`BuSegmentRow`) — each row summarises the unit (health-mix tally `.bu2-mix` + revenue-at-risk `.bu2-rk`) and expands on click to the existing `BuCardView` franchise cards. Chips are now a **filter** (`filter: string|null` — narrow to one unit or "All units") kept SEPARATE from **expansion** (`expanded: Set<string>` — each row opens/closes independently, initialised to ALL segment names so all three units are expanded by default; per manager feedback that opening one unit shouldn't collapse the others). Backend `getPortfolioBusinessUnit()` unchanged. CSS in `prototype.css` "BY BUSINESS UNIT v4" block (`.filt`/`.fb-n`/`.fb.ct`/`.fb.rk`/`.bu2-*`); note `.ac` is a global 3px pip class — the mix chips use bare `<em>`/`.a`/`.r`, NOT `.ac`. Verified in browser: chips render, rows expand/collapse to franchise cards, no console errors. **Market side panel** (`#map-side`) is populated from `views/marketDetail.ts` (`MK_MARKETS` 12 launch markets + `MK_SMALL` 10 registration markets, ported from prototype MKT/MKS literals); clicking a `.wp[data-m]` map bubble (or the tour driving `marketPick`) fills `.ms-*`/`.mrk` — a risk row's action opens the issue (`open('issue',findingId)`) or hands off to the copilot (`drive({view:'chat'})`).
  - `LaunchView` / `FlowView` / `DocsView` → all read `param` and call `getLaunchRecord(param)` (overview+gates / workflow board / doc register). **Header actions (per manager feedback — the 4 crowded buttons "Resolve blocker / Message workstream leads / Request gate review / Escalate to Launch Board" were fatal):** now just two — **Resolve** (`btn s`) and **Escalate** (`btn p`). LaunchView additionally calls `getOpenIssues()`, filters rows by `launchId`, picks the blocking finding (`category==='ct'`, else first) → `resolveFindingId`; **Resolve** does `open('issue', resolveFindingId)` which routes into the **exec** branch resolution workspace (IssueView) — i.e. "resolve it in Execution". Falls back to `open('flow', param)` if no finding. Escalate opens the same finding (or `alerts`). **Gate label dedup:** the post-market gate is `code="BAU"` / `name="BAU handover"`, so any `${code} ${name}` render doubled to "BAU BAU handover". Added `fmtGate(code,name)` in `lib/format.ts` (drops the code when the name already starts with it) and use it in LaunchView (gate-readiness header + gate schedule) and IssueView (gate-at-risk + impact rows). Product lens (`ngName.startsWith(ngCode)`) and BuLaunchView (code-only `→ BAU`) were already safe. **Descriptive/tour-style `.vs`/`.ld-cs` subtitles removed** from all dashboard view headers (Cockpit, Portfolio all 4 lenses, Launch gate-readiness, Alerts, Actions ×3, Strat) per manager feedback ("frases explicativas que nunca estarían en un dashboard"); Flow/Docs keep the factual count/type lists only.
  - `IssueView` → `getResolutionWorkspace(param)`; Approve → `approveDecision(id,label)` (enabled only when decision USER-held + option selected; NO withdraw control)
  - `ActionsView` → 3 sub-panes `getPendingQueue`/`getEscalatedQueue`/`getDecisionHistory`; cards → `open('issue',findingId)`
  - `TowerView` → `getLiveBoard('all','all')` + `getActivityLog('all','all')`
  - `AlertsView` → `getOpenIssues()`; rows → `open('issue',findingId)`
  - `ChatView` → **two-mode Copilot** (per user: integrated INTO the Copilot as two modes, NOT a separate tab — the old `EodLogView` + `eod` nav tab were removed). A `.cq-modes` segmented control at the top of `#v-chat` toggles `mode` (`'ask'` default | `'eod'`); each mode keeps its own state so switching never loses an in-progress thread or capture. CSS `.cq-modes`/`.cq-mode(.on)`/`.cq-mode-ic`/`.cq-mode-tx` in prototype.css "COPILOT" block (purple icon accent, J&J-red active border).
    - **Ask** → the existing grounded Q&A copilot: `getCopilot()` (greeting + suggestion prompts; refusal prose rendered VERBATIM, never softened). The guided tour's `chatAsk` forces Ask mode.
    - **End-of-day log** → the conversational capture assistant (`EodMode` sub-component wrapping the shared **`components/EodCapture.tsx`**): a domain owner tells the copilot what happened and it becomes real `Finding` records the tower sees, no form-filling. Two **text-only** modes inside — **Free dump** (`extractEodSignals(domain,text,[])`) and **Guided** (questions from `getEodPrompts(domain)` → `extractEodSignals(domain,'',answers)`); domain chips from `getEodDomains()` (13 incl. "all"→Orchestrator); extraction returns **DRAFTS only** (edit headline, change impact ct/rk/ok, include/exclude, confidence + NEEDS REVIEW badges); **Capture** → `commitEodSignals(approvedDrafts)` (SOLE writer → `outcome='RUNNING'`, `signalSource='eod-log'`, `detectedBy`=domain agent). A "Captured this session" list links each new finding into its resolution workspace via `open('issue',id)`. Wired in `api/execution.ts` (4 fns) + types in `types/execution.ts` (`EodDomain`/`EodPrompt`/`EodAnswer`/`EodDraft`/`EodExtractData`/`EodCommittedFinding`+Data wrappers). **Verified in browser:** mode selector renders, EOD mode fires `domains` + `extractSignals` (both 200 OK), 2 drafts render correctly classified.
  - `StratView` → fully static verbatim port (out-of-scope branch, no data wiring by design)
- **Fleet board card timelines (fixed):** every finding card on the Agent control tower now shows its
  verb-by-verb step timeline (steps already run, each stamped with the hour, ending on the step in flight
  or the decision held on you). Previously only the 9 findings with a rich **OCH** chain had steps; the 4
  **IZ-only** findings (NPI-0412/0359/0351/0319) came back with 0 steps → blank timeline. Fixed in
  `gen_seed.mjs` by seeding a lightweight `Chain` + `AgentAction` timeline from IZ for any finding not
  covered by an OCH chain (Chain 9→13, AgentAction 33→44; activity log 24→32 completed fleet actions, 13
  agents). Reconciliation tests still 11/11. TowerView `agentLabel`/`agentBase` helpers dedupe the "agent"
  suffix (seed names carry "… agent"; prototype AL map appends it).
- **Timeline gate data — FIXED.** The Timeline (Milestones) lens previously showed markers for VARIPULSE
  only; the other 8 launches rendered as empty lines ("can barely see any information"). Root cause: only
  VARIPULSE had `Gate` seed records. Added `OTHER_GATES` in `gen_seed.mjs` (block just before
  `write('Gate', gates)`) seeding gates for all 8 remaining launches with the **prototype's own §2.4
  milestone dates** (EMBOTRAP G5 17→26 Sep +9d, ETHICON G4 12 Oct→02 Nov +21d, OCTARAY G2 16→30 Sep +14d,
  PureSee G3 03→14 Nov +11d, plus on-plan/future markers for Impella/Javelin/OTTAVA/DUALTO and BAU
  handovers). Gate count 5→22, all 9 timeline rows now carry markers (verified: `rowsWithNoGates:0`).
  Non-slipped gates set `baselineDate = forecastDate` so `monthPos` plots the single forecast marker.
- **BU cards + Timeline slip bars — FIXED (readiness/float/next-gate/slip visuals).** BU cards previously
  had no readiness progress bar, slip pill, or next-gate label; Timeline slip bars collapsed to zero width
  for in-month slips. Fixes: (1) added `readinessPct: int` + `scheduleFloatDays: int` to `Launch.c3typ`
  (attested display data, per §3.6.1), seeded via `gen_seed.mjs` LAUNCHES cols [12]/[13] (varipulse 83/-,
  octaray 86/-, embotrap 67/-, impella 92/31, javelin 88/18, ethicon 80/-, dualto 100/-, ottava 95/24,
  puresee 83/-). (2) `PortfolioService.portfolioBusinessUnit()` enriched: `gatesByLaunch`, `issuesByLaunch`,
  `nextGate(lid)` helper (earliest non-`ok` gate → {code,name,forecastDate,slipDays}; sorts by forecastDate
  using `<`/`>` on C3 datetimes — NOT `.getTime()`, which throws); each BuLaunch now carries readinessPct/
  scheduleFloatDays/nextGate/openIssues, each franchise carries summed openIssues. (3) `BuLaunchView` renders
  `bu-rd` bar (`bar-f r/a/g` by health, width=readinessPct%), `slp` pill (+Nd | Nd float | launched | on plan),
  next-gate (`bu-lp` phase → code + fmtDate). (4) `monthPos()` now uses fractional day-of-month so a +9d/+11d
  in-month slip draws a visible striped `ms-sp` bar. **Data-difference note:** VARIPULSE BU next gate is
  self-consistent **G3 21 Dec / +47d** (04 Nov baseline + 47d; matches issue-workspace "04 Nov → 21 Dec" and
  worst-slip KPI). The prototype's BU card hardcodes "13 Nov" text while labeling +47d — an internal prototype
  inconsistency; per §3.6.1 (one source, derive don't store) we keep the derived 21 Dec. All other 8 launches'
  BU dates/slips/readiness match the prototype exactly. Verified via browser (bu-view.png, timeline-view.png).
- **Timeline per-market coherence — FIXED (color ↔ slip-bar ↔ launch-status agreement).** The expanded
  Timeline showed markets with `mlStatus:'ok'` (green/no slip bar) that nonetheless inherited the lead
  gate's slip (VARIPULSE ES/UK/US +47, EMBOTRAP DE/FR/UK, ETHICON ES +21, PureSee DE +11) — color/graph
  said "on plan" while the data carried a delay — and OCTARAY had **zero** MarketLaunch rows (empty expand)
  despite a 14-day G2 slip. Root cause = incoherent **seed** (`seed/MarketLaunch/MarketLaunch.json`), NOT a
  render bug: `mlStatus` is the single shared tone source across Cockpit / Market lens / Timeline, so the
  fix belongs in the authored data (fixing only `deriveMarketGates` would desync the Timeline from the
  Market lens). **Coherence invariant now held:** a non-live market has slip>0 ⟺ status≠ok, and severity
  reconciles with launch health (OFF_TRACK→lead `ct`, exposed followers `rk`; AT_RISK→`rk`; on-time/live→`ok`).
  Edits: VARIPULSE ES/UK/US ok→rk; EMBOTRAP DE/FR/UK ok→rk; ETHICON ES ok→rk and DE/UK moved Q1 27→Q3 27
  (they shipped *before* the US lead → `deltaQ<0` spuriously projected them "live"; now same-quarter as lead
  so they share the 21d G4 slip); PureSee DE ok→rk; **added 5 OCTARAY MarketLaunch rows** (DE-lead+US Q3 27
  `rk` on the late G2, FR/UK/JP later `ok`). Verified: `portfolioTimeline()` reports **0 incoherences**,
  Cockpit-vs-Timeline marketGates signatures match exactly, all 11 `test_Reconciliation` cases pass, build+
  lint green. Browser-verified (timeline-varipulse-expanded.png): DE/FR red dot+red G3+red slip bar, ES/UK/US
  amber dot+amber G3+amber slip bar, AU/BR/CA/CN/JP grey dot+grey G2+no bar.
- **Msg 8 — three coherence fixes (identity / authority / timeline-cohort) — FIXED.**
  - **(8a) Timeline cohort tone.** VARIPULSE (OFF_TRACK) was the only launch whose slipped-gate cohort was
    two-toned: DE/FR `ct` but ES/UK/US `rk`, despite all five sharing the *identical* cohort (G3 / +47d /
    Q4 26 forecast) — same marker position, different colour, so a per-country difference was *always* shown
    even when the markets are in the same situation. Every other launch already renders its slipped cohort
    uniformly. Fix (seed, `MarketLaunch.json`): VARIPULSE US/UK/ES `rk`→`ct` so all five delayed markets read
    one tone. Coherence invariant still holds (0 incoherences).
    - **CLARIFIED INTENT (Msg 9, w/ screenshots):** the user CONFIRMED that all-same-colour + all-same-delay
      (VARIPULSE's 5 red markets each with an identical red striped slip bar) is exactly what they want — the
      uniform-cohort change above is correct. The real defect they flagged is **(8a-fix) small slips were
      invisible** on the per-country rows: EMBOTRAP's +9d G5 cohort (DE/ES/FR/UK) showed the amber G5 marker
      but NO slip bar. Root cause was a **positioning bug**, not just a floor: `MarketTimelineRow` positioned
      by `quarterPos(gateForecastQuarter)`, and the slipped markets carried the coarse quarter `"Q3 26"` whose
      mid-month (Aug 26) falls *before* the Sep-26 axis start → clamped to `left:0%`, collapsing the slip bar
      to 0 width behind the forecast marker. Fix, two parts:
      1. **Backend (`PortfolioService.js`):** `deriveMarketGates` now emits real projected gate dates
         `gateBaselineDate`/`gateForecastDate` = the lead gate's dates shifted `deltaQ*3` months
         (`shiftIsoMonths` helper); `marketGatesByLaunch` gate fetch now also pulls `baselineDate`. This lets
         the per-market rows position on the SAME date axis (`monthPos`) as the lead train instead of the
         coarse quarter. (Added `gateBaselineDate`/`gateForecastDate` to `MarketGate` type in `portfolio.ts`.)
      2. **Frontend (`PortfolioView.tsx`):** `MarketTimelineRow` now uses `monthPos(mk.gateForecastDate)`
         (falling back to `quarterPos` only if no date), plus `MIN_SLIP_BAR_PCT=5` / `slipBarGeom` floor so a
         small to-scale slip is still drawn wide enough to separate the hollow baseline marker from the
         forecast marker. Applied to both `MarketTimelineRow` (per-country) and `MilestoneRowView` (lead row).
      Browser-verified: EMBOTRAP DE/ES/FR/UK now render `ms-sp amb` bar (`width:5%`, baseline `left:0.95%` →
      forecast `left:5.95%`); VARIPULSE +47d bars unchanged (wide, red `ms-sp`, to-scale); on-plan markets show
      no bar. 11/11 reconciliation tests still pass; build+lint green.
  - **(8b) Identity — "You" vs "Helena Fossi".** The signed-in user *is* Helena Fossi (`seed_person_hf` owns
    all 12 Decisions), so `waitingOnFor` (PortfolioService.js) showed her USER findings as "You" but the two
    DELEGATED-to-agent RUNNING findings (NPI-0351/0359) as "Helena Fossi" — same person, two labels. Fix:
    reordered `waitingOnFor` so AUTO/RUNNING/`dependency==='AGENT'` classify as **AGENT** *before* the
    held-by-person branch, and added `ownerName===SELF_PERSON_NAME` ('Helena Fossi') → collapse to "You". Now
    the user is only ever "You"; NPI-0351/0359 read "Supply Chain agent"/"Quality agent". Open-issues lens
    counts: YOU 5 / someone-else **0** / **agent 2** / authority 3 (was agent 0 / person 2).
  - **(8c) Authority items are view-only.** AlertsView `AlertRow` rendered "Resolve →" for every row; now
    `waitingOn==='AUTHORITY'` rows show **"View detail →"**. IssueView: added `authorityBound =
    finding.dependency==='REGULATOR'` — the bottom bar drops Approve/Reject/Reassign and shows a view-only
    "Waiting on an outside authority — acting here won't move it" + "View detail →"; `canApprove` also gated
    on `!authorityBound`. Required exposing `finding.dependency` in `ExecutionService.resolutionWorkspace`
    projection + `WorkspaceFinding` type. Browser-verified: NPI-0420/0344/0365 show "View detail →" in Alerts
    and no Approve button in the workspace; SELF findings keep Resolve/Approve.
- **Remaining documented data-shape gaps** (layout is verbatim; these fields have no backing data yet,
  rendered as static prototype text): (1) `IssueRow` lacks `slipDays`/`slipLabel`/`gateForecastDate` → Alerts "Gate at risk"/
  "Slip" columns show "—"; (3) misc markup (MarketLaunchRow chip detail, BuFranchise readiness/next-gate/
  issue counts, Launch downstream-impact, docs "1.42 GB" header, tab badge counts) shown as verbatim
  static labels. Future backend reconciliation can populate these.

- **Guided demo (`shell/GuidedTour.tsx`, mounted in App.tsx inside NavProvider):** faithful port of the
  prototype's GUIDED DEMO engine (its `GD` step array + gd* spotlight globals). 16 steps, one CAPA end to
  end (CAPA-2026-0148 / NPI-0417). `t`/`p`/`say` copy is verbatim (rendered via `dangerouslySetInnerHTML`);
  each step's navigation is a `DriveTarget` published through `drive()` instead of the prototype's imperative
  globals. The spotlight engine reproduces gdClear/gdSpot/gdPlace/gdBring/gdTrack: adds `.gdp-spot` to target
  nodes by the prototype's own selectors and floats `.gdp-mk` labels in a fixed `#gdp-marks` layer that a 90ms
  frame loop keeps glued to the boxes as the page scrolls / a pane re-renders. **Because views are async
  (c3Action-fed), `show()` retries the spotlight (~every 100ms, up to 25 tries) until the target renders** —
  this is the key difference from the synchronous prototype. Arrow keys / Escape drive it; Finish returns to
  the menu and resets the tower franchise filter. Two selectors were renamed for the React port: `#c-I-417`→
  `#c-seed_finding_417` (tower card id), `#lg-n`→`.lg-n` (log count is a class here). Triggered by the
  `.h-gd` "Guided demo" button in both `MenuScreen` (`.m-top`) and the `AppShell` header, via
  `startGuidedTour()` (dispatches a `gd:start` window event). Browser-verified: all 16 steps drive + spotlight
  correctly against live data, zero console errors.
  - **Callout collision-avoidance (added for overlap fix):** the prototype pins `#gdp` bottom-right always,
    which on a ~1280px viewport lands directly on top of the step-6 P3 tower card (`#c-seed_finding_417`),
    hiding the very rectangle it spotlights. `place()` now calls `reflow()`, which rectangle-tests the
    bottom-right home against all spotlighted boxes and toggles a `.gdp-left` class (CSS: `right:auto;left:20px`,
    plus a `.gdp-top` variant) to flip the panel to the opposite corner **only** when the home would collide
    and the flipped position is clear. `clear()` removes `.gdp-left` so each step starts from the bottom-right
    home. Runs on the same 90ms track loop, so it re-evaluates on scroll/resize. Browser-verified: step 6 flips
    left (overlap gone, whole card + all 5 chain steps visible); steps 1/2/5 stay bottom-right (no false flips).
  - **Label collision-avoidance (added for the second overlap report):** the floating `.gdp-mk` labels are
    pinned 7px above their target box (prototype default). In dense views (My actions, cockpit) a target butts
    against the sticky header or sits one row below other content, so an "above" label covered a *neighbour*
    (e.g. the sub-tab label crossed into the header/`My decisions` heading; the `NPI-0417` label covered the
    `.vs` paragraph). `place()` now renders each label as a real node and tests it with `document.elementFromPoint`
    (which sees through the `pointer-events:none` marks layer): it tries **above → below → inside the box's own
    top edge**, keeping the first position that lands only on the target itself (or a descendant/ancestor), never
    on foreign content. CSS adds `.gdp-mk.below` (arrow flips up) and `.gdp-mk.inside` (no arrow, sits on its own
    target — acceptable, since a label may cover the thing it names, just not a neighbour). Browser-verified on
    steps 1 (above), 2/3 (inside its own KPI/row because a subtitle sits directly above), 5 (both labels inside
    their own boxes — header/heading/paragraph all clear), 6 (inside the `.tbwk` block, callout still flips left).
  - **Padding-band refinement (third overlap report, step 8 issue view):** the `.is-meta` bar is a full-width
    5-column strip (GATE AT RISK · GATE DATE · SLIP · REVENUE EXPOSED · DECIDE BY) with the `.is-hd-top` header
    block touching it above (0px gap) and `.is-two` 17px below. "Above" collided (real header content), and
    `collides()` also rejected "below" because `elementFromPoint` at the below-gap returned the next `.sec-h`
    heading — but that point landed in the heading's **13px top padding**, not on visible text. The label then
    fell to `inside`, blanking the "GATE DATE" column header. Fix: `collides()` now ignores a hit when the sample
    point is outside the hit element's **content box** (a new `inContent()` helper subtracts each side's padding).
    Padding bands are background, so "below" now wins here and the label sits in the gap. Self-correcting: a label
    tall enough to reach a neighbour's actual text still hits content on its lower sample points and is rejected.
    Browser-verified: step 8 both labels `below` (meta label clears the GATE DATE header), and steps 5/6 unchanged.

- **Pending-queue decision-row display copy (data fix, same overlap report):** the step-5 `.dr` rows rendered as
  id + title only because `Decision.queueMetaLabel / agentRecommendation / dueLabel / dueTagClass / functionsLabel
  / ctaEmphasis` were never seeded (all null) — which also left the view too short to scroll, starving the tour
  labels of headroom. These are attested prototype strings (§3.6.1 pattern, like `Launch.readinessPct`); added a
  `DEC_DISPLAY` map in `gen_seed.mjs` for the four USER-held decisions (417/402/388/371), verbatim from the
  prototype `.dr` markup (meta line, agent recommendation, due tag + class, functions, CTA emphasis). Regenerated
  + `upsertSeedData`; `ExecutionService.pendingQueue()` now returns full rows for all four (verified via runJsCode).

- **3-demo picker (`shell/GuidedTour.tsx`, added on request "elegir qué demo hacer"):** the "Guided demo" button
  now dispatches **`gd:open`** (opens a chooser overlay) instead of starting immediately. Architecture: a `Demo`
  interface `{ id, chip, title, blurb, steps }` and a `DEMOS: Demo[]` registry (`DEFAULT_DEMO = DEMOS[0]`); the
  running step array + header chip come from `demoRef.current`/`demo` state, so `show()`/`go()` read
  `demoRef.current.steps`. `choose(d)` sets the demo, rewinds to 0, starts. `gd:open` opens the picker unless a
  demo is paused mid-run (`iRef.current > 0` → resume via `start()`); `gd:start` can carry a demo id in
  `(e as CustomEvent<string>).detail` for deep links. Picker overlay is `.gdp.gdp-pick` reusing the dark panel
  shell (styles appended to `prototype.css`: `.gdp-pick/.gdp-pk/.gdp-pk-b/.gdp-pk-n/.gdp-pk-tx/.gdp-pk-s`).
  **All three demos are now 16 steps** (user: "las tres tienen que enseñar un end to end pero con diferente
  casuistica … no puede ser que la primera tenga 16 pasos y las otras 5 o 6"). Each walks the SAME end-to-end
  arc (menu 3-cards → cockpit KPIs → portfolio product lens → portfolio market lens → my actions →
  agent tower live card + autonomy KPIs → resolution workspace / options / action-plan → escalation thread →
  a second reconciling finding → decision/approve → My-actions history → fleet activity log → Copilot answer),
  anchored on a DIFFERENT case for a DIFFERENT audience. Sharing screens between demos is by design. Picker
  auto-shows `d.steps.length` (all read "16 steps"); browser-verified the picker renders 3 cards each at 16.
  - **Demo 1 `capa` (16 steps, chip CAPA-2026-0148):** the original VARIPULSE sterilisation-slot CAPA
    (NPI-0417), verbatim — the template arc all three mirror.
  - **Demo 2 `regulatory` (16 steps, chip REGULATORY):** regulatory-agency angle, anchored on **FDA 0420**
    (VARIPULSE G2 deficiency letter, view-only / authority-bound — no Approve) + **BSI 0365** (Ethicon 4000+,
    Notified Body signature we owe, movable). **INVARIANT (post-review): there is exactly ONE authority-bound
    thread — NPI-0420/FDA (45 fixed/grey days in `PortfolioService.timeImpact()`). NPI-0365/BSI is 100%
    recoverable (a signature Helena owes, not an agency wait). No card may claim "two agency clocks/threads on
    the authority."** Arc: menu → cockpit **time-recovery panel** (card 2 spots `.ti-pnl` / `.ti-card.reg`
    "Waiting on an authority" 45d / `.ti-card.rec`; the ONE authority thread, FDA) → **VARIPULSE launch detail**
    (card 3, `view:'launch', param:'seed_launch_varipulse_g2'`; `#ld-slip`/`#ld-rev` — reached in one click from
    the grey bar, NOT the product-lens list) → portfolio market lens **US** (card 4, `.wp[data-m=US]` FDA/the one
    fixed clock + `.wp[data-m=UK]` BSI/movable) → open issues **authority** filter (card 5, exactly ONE row:
    `#v-alerts .al-lens .wl.authority`, `tr[data-npi="NPI-0420"]`) → my actions **escalated**
    (`.dr[data-npi="NPI-0365"]`) → agent tower **Ethicon** (`#c-seed_finding_365 .tbwk`, 3 steps — NOT 0420,
    which has 0 chain/tower steps) → tower autonomy KPIs **+ board card `#c-seed_finding_420`** (card 8, the
    one-click bridge into the FDA record) → 0420 issue (`#is-t`/`.is-bar` view-only) → 0420 problem (`#pb-txt`)
    → 0365 issue (`#is-held`, held) → 0365 chain (`#hd-chain`) → dossier register (card 13 spots the SHORT group
    **headers** `#v-docs .dc-g[data-c=reg] .dc-gh` / `[data-c=cert] .dc-gh` — not the tall `.dc-g`, whose outline
    scrolled off) → history (card 14 spots `.fb2[data-f=esc]` + `#v-actions .sb-p.on .ev[data-npi="NPI-0365"]` —
    the ETHICON escalation from THIS tour; ActionsView history rows now carry `data-npi`) → fleet log (all
    franchises) → Copilot `chatAsk='regulatory'` (`.cq-ev`/`.cq-rec`/`.cq-act`; card 16 copy = "one FDA clock +
    one signature + BSI slot + site visit", NOT "two agency clocks"). **Data:** `hist_0365` ESCALATED
    `DecisionHistoryEvent` seeded so History genuinely contains the NPI-0365 escalation
    (`decisionHistory().counts` = {taken:6, escalations:2, total:8}); reconciles History escalations with the KPI
    band ("Escalations open: 2") and the Escalated pane (0344 + 0365). `test_Reconciliation` unaffected (11/11).
  - **Demo 3 `supplier` (16 steps, chip SUPPLIER CHANGE):** shared-component supplier-reallocation, anchored on
    **NPI-0412** (Heraeus line-3 dimensional-drift SPC defect on VARIPULSE — a fully-modelled USER decision:
    options a\*/b/c, 4-entry thread, **5 tower work steps**, 5 action-plan tasks) + **NPI-0388** (OCTARAY G2
    single-source, owns the reserved Neuss capacity). Arc: menu → cockpit → portfolio product lens (four
    launches share the ring electrode) → portfolio market lens **DE** (`.wp[data-m=DE]`, the concentration) →
    my actions pending (`.dr[data-npi="NPI-0412"]`) → agent tower **Biosense Webster**
    (`#c-seed_finding_412 .tbwk`, 5 steps) → tower autonomy KPIs → 0412 issue (`#pb-txt`/`.is-meta`) → three
    options (`#opt-a` reroute-line-5 recommended / `#opt-b` 100%-inspection / `#opt-c` Neuss diversion) →
    action plan (`#run-all`, 4 of 5 steps agent-runnable) → thread (`#thr-417`) → 0388 OCTARAY side
    (`#is-t`/`#opt-a`, ships later w/ longer FDA path so it can lend) → approve (`#btn-app`) → history → fleet
    log → Copilot `chatAsk='supplier'` (`.cq-ev`/`.cq-rec`/`.cq-act`).
    - **Tower vs workspace chain — IMPORTANT:** `resolutionWorkspace('seed_finding_412').chain` returns **0**
      (0412 has no `Chain`/`AgentAction` record), but the **tower `liveBoard` card** `#c-seed_finding_412`
      renders **5 work steps** (V&V column, Biosense Webster) — a SEPARATE projection. So Demo 3's tower step
      spotlights `.tbwk` correctly; do NOT rely on the workspace-chain count for tower steps.
  - **Data added for Demos 2 & 3 is TEST-INVISIBLE** (no Finding/activity touched, so the reconciliation lock —
    **13 findings / 107 activities / 11 `test_Reconciliation.js` tests — is unaffected and re-verified green**):
    a third decision option **`seed_option_412_c`** (Neuss diversion, recommended:false so recommended stays
    `a`), a 4-entry comment thread **`seed_comment_412_1..4`** (Line Monitor / L. Haugen / Sourcing agent /
    M. Okafor), **5 `ActionPlanTask` `seed_task_412_a_1..5`** on `seed_decision_412` optionKey "a" (4
    agentRunnable + 1 manual Neuss hedge), and `regulatory`/`supplier` `CopilotPrompt`s. All upserted via
    `upsertSeedData`. `ActionPlanTask`, `DecisionOption`, `Comment`, `CopilotPrompt` are NOT `Activity`/`Finding`
    instances, so the 107/13 counts cannot change.
  - **ActionsView data hooks:** the pending AND escalated `.dr` cards carry **`data-npi={displayId}`** so the
    demos can spotlight NPI-0412 (pending) and NPI-0365 (escalated) precisely.
  - **Verify (this session):** `VITE_C3_PKG=jJDemo npm run build` green (lint+tsc+vite, exit 0); 11/11
    `test_Reconciliation.js` pass (107 activities / 13 findings unchanged); Playwright walk confirmed the picker
    shows 3×"16 steps" and Demo 3 drives menu→…→tower with `#c-seed_finding_412 .tbwk` spotlit (`tbwk gdp-spot`),
    0 console errors. (Fixed a build-blocking parse error: `a*/b/c` in the GD3 block comment prematurely closed
    the `/* */` — reworded the comment.)

### Legacy (superseded, still on disk but NOT imported by App.tsx)

The old Tailwind/shadcn routed pages (`pages/Cockpit`, `Copilot`, `Dashboard`, `LaunchRecord`, `MyActions`,
`OpenIssues`, `Orchestration`, `Portfolio`, `Resolution`, `StrategicDecisions`) + SideNav/`config/navigation.ts`
are orphaned by the re-skin. Build passes without them (unreferenced). The section below documents that layer
for history; the **backend services it describes are unchanged and still power the new views.**

## Backend behind the UI (unchanged by the re-skin)

**Backend for the Execution branch:** `src/ExecutionService.js` — stateless service, 7 read methods
returning plain JSON (view-models, not entities): `pendingQueue`, `escalatedQueue`, `decisionHistory`,
`liveBoard(franchise, market)`, `activityLog(franchise, market)`, `resolutionWorkspace(findingId)`,
`copilot`. Approve goes through `Decision.approve(optionLabel)` (member action).

- **CRITICAL fetch findings** (baked into ExecutionService): `Comment` refs `decision` (NOT finding) →
  filter `decision.id`; `GuardrailCheck` refs `finding.id`; `Chain` refs `finding` via `Chain.finding`
  (the inverse `Finding.chain` is a **non-inverse ref returning null** — MUST query from the Chain side,
  helper `chainStepsByFinding()`); `DecisionOption` filtered by `decision.id`, has `optionKey` (a/b/c),
  NO sortOrder; `AgentAction` has chain/agent/sequence/verb/detail/stateLabel/handoffPrompt/completed/
  occurredAt; `Comment.sourcesRead` is a **comma-separated string**, NOT an array.
- New display-support types this branch: `CopilotPrompt`, `DecisionHistoryEvent`; added `shortName`/
  `marketCodes` + card display fields to findings/launches.

**React pages** (`ui/react/src/`, all fetch via `api/execution.ts` → c3Action/c3MemberAction):
- `/` → `pages/MyActions` (Inbox nav "My Actions") — 3 panes by decision ownership: Pending (4 USER),
  Escalated (2), History (23/90d). Pending cards → `/resolve/:findingId`.
- `/orchestration` → `pages/Orchestration` (LayoutGrid nav "Fleet") — shared franchise+market filter;
  Live board tab (KPI row + 6 phase columns over Finding.outcome) + Activity log tab (completed actions,
  reverse-chron, "N actions by M agents").
- `/resolve/:findingId` → `pages/Resolution` (routed, no nav) — 8 sections + sticky decision bar; the
  atomic approve transaction (Dialog confirm → `Decision.approve`). Read-only when heldBy !== 'USER'.
- `/copilot` → `pages/Copilot` (Sparkles nav) — greeting + 8 grounded prompts in 4 groups; free-text
  matches known prompts else fires the verbatim designed refusal (§6, never softened).
- Support: `types/execution.ts` (view-models), `api/execution.ts`, `lib/format.ts` (absolute
  timestamps/€ fmt), `components/execution/Tags.tsx` (Severity/Outcome/Category chips).

**Backend for the oversight screens:** `src/PortfolioService.{c3typ,js}` — stateless service, 8 read
methods returning plain JSON: `cockpit` (reads LaunchControlMetrics: gateReadiness/launchHealth/
revenueAtRisk/avgSlip + attention[worst-first] + gatesClosing[≤120d]), `portfolioProduct` (9 rows,
phase blocks + gate markers), `portfolioMarket` (22 markets, LAUNCH/REGISTRATION tiers, rollupStatus
ct<rk<ok, quarter timeline), `portfolioBusinessUnit` (Segment→Franchise→Launch rollup), `portfolioTimeline`
(per-gate baseline vs forecast), `openIssues` (12 findings, waitingOn YOU5/PERSON4/AGENT3, worst-first),
`launchRecord(launchId)` (overview gates+criteria / workflow 6 phase-cols+gate-at-foot / documents 9
groups), `launchIndex`. `DOC_GROUP_ORDER = dhf,vv,cli,reg,cert,mfg,com,sco,pm` (labels: Design & development
(DHF), Verification & validation, Clinical & evidence, Regulatory submissions, Certificates/licences/
registrations, Manufacturing & quality, Labelling & commercial, Supply chain & operations, Post-market
surveillance).

**Document register (COMPLETE per launch):** every launch now carries the full industry-standard J&J
MedTech checklist (81 items × 8 launches + VARIPULSE's 83 = **731** total). The full set is always present
(manager: "que esten todos porque son cosas que hay que subir"); only `status` varies by how far the launch
has progressed. VARIPULSE keeps its 78 bespoke docs verbatim (incl. `seed_doc_varipulse_44`, a GateCriterion
evidence link) + a new 5-doc supply-chain section. The other 8 launches are generated deterministically by
`scripts/gen-documents.mjs` (in-repo, re-runnable), grading each doc's status from the launch's current phase
vs the doc's expected-completion phase — DUALTO/P6 ≈ all approved, OTTAVA/P1 ≈ all not-started, mid-phase
graded in between; AT_RISK/OFF_TRACK launches surface a few `miss` gaps. Verified in-browser (200 OK) for
DUALTO + OTTAVA.

**Product-detail consistency (manager review — "all data connected end-to-end, nothing hardcoded"):**
Previously only VARIPULSE was fully seeded and LaunchView hard-coded VARIPULSE's scope/workstreams/issues
for every product (DUALTO's detail was empty; ETHICON showed no at-risk steps; downstream/issues tables
missing). Fixed end-to-end:
- **Scope + gate ladders + criteria + activities generated for all 9 launches** by the single consolidated
  `scripts/gen-launch-detail.mjs` (deterministic, re-runnable; supersedes the earlier split
  gen-gates-criteria-activities.mjs / add-launch-scope.mjs). It writes 4 files: `data/Launch/Launch.json` (scope
  fields), `data/Gate/Gate.json` (**48 Gates**), `seed/GateCriterion/GateCriterion.json` (**54 GateCriterion** — on
  each launch's ACTIVE gate only; a late/amber gate surfaces ≥1 unmet criterion WITH an `outstandingReason` = the
  risk, a clean gate shows criteria met/in-hand with no flag), `seed/Activity/Activity.json` (**963 Activities** =
  107 per launch, phase-shifted). Ladders reconciled to each launch's `currentPhase`. **CRITICAL id rule:** gate ids
  use `gslug` (= launch id minus `seed_launch_`, e.g. `seed_gate_ethicon_4000_g4`), NOT the short `slug` — the
  short-slug ids were the bug that created orphan duplicate gates + broke the SrcPpmGate→Gate transform. An
  `AUTHORED` table in the script is the source of truth for narrative late/slip gates (varipulse G3 +47, octaray
  G2 +14, embotrap G5 +9, ethicon G4 +21, puresee G3 +11, dualto G5 ok) so re-runs never lose a late gate to file
  drift. VARIPULSE's 5 gates / 6 G3 criteria / 107 activities preserved verbatim (guard-checked, asserts counts).
  NOTE: an earlier bad-id upsert left 27 orphan short-slug gates in the DB (ethicon/impella g1-g5, octaray g1-g5,
  embotrap/javelin g1-g5+bau) that shadowed the real active gate → "0/0 criteria"; these were removed via
  `Gate.removeAll` and the live total is back to 48. This made `LaunchControlMetrics.portfolioGateReadiness` a
  real aggregate.
- **Launch scope fields** added to `Launch.c3typ` (launchValue, sterilisationMethod, manufactureSite,
  registrations Filed/Total, launchBuildUnits, fieldForce Certified/Total, vacApprovals Filed/Total) and merged
  per-launch by `scripts/add-launch-scope.mjs` (idempotent, values match persisted data). `PortfolioService.launchRecord`
  now returns these + a derived `workstreams[]` (8 workstreams, pct = done/total from Activity statusCode==='ok',
  null when no activity → UI omits the bar) + an `issues` block (per-launch Finding rows, openCount, blockingCount).
- **LaunchView.tsx fully data-driven** — no hardcoded €96M / "2 issues" / EO / Irvine / registrations / workstream
  bars. The "Downstream impact if <G> slips" panel is now generic (gates from next-gate onward, first slipping gate
  = hit, later = warn, held gate = neutral) and only renders when the next gate actually slips (`slipDays>0`) — so
  on-plan/launched programmes show nothing there. Open-issues table is generic for all launches (clean "no open
  issues" when empty). Verified via launchRecord replay across ALL 9 launches: at-risk/late products surface
  risks in the center Gate-readiness table (varipulse G3 5/6+1rk, octaray G2 5/6+1rk, embotrap G5 4/6+2rk,
  ethicon G4 5/6+1rk, puresee G3 5/6+1rk); on-plan/launched/pre-market are clean (impella G4 6/6, javelin G5 5/6,
  dualto BAU 6/6, ottava G1 6/6 — 0 risks, 0 blocking). DUALTO now fully populated (was empty); ETHICON now shows
  its G4 at-risk criteria + full ladder. All carry 8 workstream bars + attested scope (launchValue, build units,
  field force, VAC, registrations, sterilisation, site).
- **Portfolio legend** already carries all three gate states: "Gate closed" (gray `gd done`), "Gate at risk"
  (amber `gd rk`), "Gate blocked" (red `gd ct`) — matching the tones ProductRowView renders.
- **"Open issues" count is live, not hardcoded** — the "11" that was baked into `NavContext.BRANCH` (tab badge)
  and `MenuScreen` ("11 exceptions, worst first") is removed. `contexts/PortfolioCountsProvider.tsx` fetches
  `PortfolioService.openIssues().total` once and feeds both the AppShell tab badge (v==='alerts') and the menu
  card text; null while loading → badge/count omitted (no guessed fallback). Finding-outcome split is pinned to
  §3.6.3 (USER5/HELD2/AUTO3/RUNNING2) by `test_Reconciliation.js` (which counts the 12 raw `Finding` seed rows,
  not the projection); `seed_finding_359` (PureSee, at-risk redesign) is `RUNNING` to satisfy that invariant.
- **Open-issues definition unified across ALL views (Set F — cross-view consistency fix).** The user flagged
  JAVELIN reading "on plan" / 0 open issues in its detail yet still appearing in the portfolio-wide **Open
  Issues** page. Root cause: `openIssues()` returned *all 12* findings (including 3 resolved `AUTO` ones) while
  `launchRecord()` counts a finding open only when `outcome ∈ {USER,HELD,RUNNING}` (`AUTO` = agent already
  resolved). Fix: `openIssues()` now applies the **same open-definition** and skips `AUTO` findings →
  portfolio total **9** (YOU5/PERSON4/AGENT0), and it reconciles exactly with the sum of each launch's
  `issues.openCount` (verified 9 == 9). `LaunchView.tsx` also filters its "Open issues on this launch" card to
  `r.open` only, so an ON_PLAN launch whose only finding is resolved (JAVELIN → NPI-0319 AUTO/ok) reads clean
  everywhere: 0 in the counter, empty card, absent from the Open Issues list, on-plan in cockpit/timeline.

**React pages** (`ui/react/src/`, all fetch via `api/portfolio.ts` → c3Action):
- `/cockpit` → `pages/Cockpit` (Gauge nav "Cockpit") — 4 KPI cards + attention panel + gates-closing panel.
- `/portfolio` → `pages/Portfolio` (Boxes nav) — in-page lens switcher (Product/Market/BU/Timeline);
  lens state does not reset the market sub-view. Product/BU/Timeline rows → `/launch/:launchId`.
- `/issues` → `pages/OpenIssues` (AlertTriangle nav) — stat band (5/4/3) doubles as waiting-on filter +
  impact filter (Blocking/Float/Monitored); a YOU+USER finding routes to `/resolve/:findingId`, else launch.
- `/launch/:launchId` → `pages/LaunchRecord` (routed, no nav) — 3 tabs (Overview / Workflow · 107 /
  Documents · 81 per launch). Workflow domain+status filters recount the phase-column headers live.
- `/strategic` → `pages/StrategicDecisions` (Compass nav) — out-of-scope banner + 4 placeholder cards.
- Support: `types/portfolio.ts` (view-models), `api/portfolio.ts`, `components/portfolio/HealthTag.tsx`
  (HealthTag/HealthDot/PhaseTrack/GateMarkers/SlipPill/MlStatusDot/ProgressBar), `fmtDateYear` in `lib/format.ts`.

## Session fixes (Set A + Set B)

**Set A**
- **Escalated activities were empty ghosts** — `seed/Escalation/Escalation.json` was missing the seven card
  display fields the `ExecutionService.escalatedQueue()` reads. Restored `cardTitle`, `cardMetaLabel`,
  `progressSummary`, `tagLabel`, `tagClass`, `functionLabel`, `ctaEmphasis` on both escalations (365, 344).
- **Weird vertical spaces in product detail** — `prototype.css` global `.z{margin-bottom:26px}` was hitting
  the "pending" pills (`pill z`). Scoped to `.z:not(.pill)`.

**Set B**
- **TECNIS not amber in timeline** — root cause: `MilestoneRowView` derives marker tone from `row.health`,
  and `seed_launch_puresee` was `ON_PLAN` despite an 11-day-late G3 slip (the sole health/slip mismatch;
  every other slipping launch is AT_RISK+). Fixed the underlying data: set PureSee `healthStatus` to
  `AT_RISK` in `data/Launch/Launch.json` so product/BU/timeline all agree. Verified live: timeline forecast
  G3 renders `ms-g risk` + slip bar `ms-sp amb`.
- **"Missing products" in BU view** — NOT reproduced. All 9 launches are present and identical (health/slip/
  revenue) across product, timeline, and BU lenses at both the data and rendered-DOM level (BuPane renders
  3 segments / 7 franchise cards / 9 launches). No change needed beyond the TECNIS health alignment above.
- **Javelin XL commercial-vs-quality incoherence** — NOT present in the live app. `seed_finding_319` and its
  `resolutionWorkspace` are fully commercial (field-force certification, reps, lab-session cohort), `capa: null`;
  IssueView gates ALL CAPA/Quality copy on `ws.capa`. Swept all 12 findings — every one is coherent
  (function/category/thread/CAPA aligned). The mixed CAPA/supplier narrative lives only in the DEAD
  `ui/react/src/pages/Resolution/Resolution.tsx` (hardcoded VARIPULSE CAPA-2026-0148 port), which is not
  imported anywhere (`pages/*` is unused; the live app uses `views/*`). No change needed.

**Set C — per-market phase/gate (Scope C, derived)**
- **Problem:** cockpit "Next gate" column showed a single "lead market X" line, and the timeline showed no
  market info — but a launch is at different gates per market (US ahead of France). The model has ONE gate
  train per `Launch` (= lead-market schedule) + per-`MarketLaunch.firstShipQuarter`; no per-market gate field.
- **Solution (no schema change):** `PortfolioService.js` derives each market's phase/gate by shifting the lead
  gate train by the market's first-ship quarter delta and reading the first gate whose projected quarter is
  ≥ "today" (`DateTime.now()` = Q3 26). Markets at/ahead of lead (deltaQ ≤ 0) skip closed ('ok') gates so the
  lead aligns with the launch's next open gate. Helpers: `GATE_RANK`, `GATE_PHASE`, `quarterIndexFromLabel/Iso`,
  `quarterLabel`, `deriveMarketGates`, `marketGatesByLaunch`. `cockpit().attention[]` and
  `portfolioTimeline().rows[]` now each carry `marketGates: [{marketCode, marketName, marketTier,
  firstShipQuarter, phaseCode, gateCode, gateName, gateForecastQuarter, status, live}]`, most-advanced first.
- **Frontend (Set C, superseded by Set D):** `types/portfolio.ts` adds `MarketGate` + `marketGates` on
  `AttentionRow`/`TimelineRow`. Originally rendered as gate-grouped chips (`<MarketGateSpread>`/`<TimelineMarketSpread>`);
  those components were removed in Set D.

**Set D — one row per country + unified colour (supersedes Set C's grouped chips)**
- **Problem (user):** per-country tags showed inconsistent colours (chips were toned by DERIVED gate status while the
  Market tab colours by `MarketLaunch.status`), and delays in the product detail weren't attributable to a specific
  country. User wanted "una linea por cada pais" in the cockpit, click-to-expand per-market timeline detail, and all
  tabs to reconcile ("los datos tienen que cuadrar entre todas las tabs").
- **Single shared tone source:** `MarketLaunch.status` (`ok`/`rk`/`ct`) drives colour EVERYWHERE (cockpit rows,
  timeline sub-rows, market tab, launch-record rollout). The derived Scope-C gate/phase is CONTENT only, never colour.
  `MarketGate` now also carries `mlStatus` (shared tone), `slipDays`, `reimbursementStatus`, `isLead`. Backend sort:
  lead-first, then worst `mlStatus` (ML_RANK {ct:0,rk:1,ok:2}), then gate advancement, then code. `launchRecord`
  overview now also returns `marketGates` (via `deriveMarketGates(l, recGateInputs, recMls)`).
- **Frontend:** `CockpitView` renders `<MarketGateRows>` — one `.mg-row` per country (dot toned `mg-dot.{mlStatus}`,
  code, `lead` tag, derived gate/phase, first-ship quarter) in the Next-gate cell. `PortfolioView` `MilestoneRowView`
  is click-to-expand (`.msr-name` button + chevron) revealing `.msr-mk` per-market sub-rows, each with its own gate
  markers on the axis. `LaunchView` adds a "Market rollout — where each country stands" `.ld-card` (one row/market:
  dot, name, `lead`, derived gate + slip, `mlPill`/`mlLabel` status pill, first-ship quarter). New CSS `.mg-rows`/
  `.mg-row`/`.mg-dot`/`.mg-mk`/`.mg-lead`/`.mg-gate`/`.mg-q` + `.msr-name`/`.msr-cv`/`.msr-mks`/`.msr-mk*` in
  `prototype.css`. Tone map: ct→red, rk→amber, ok→green.
- **Verified live (all four tabs reconcile):** cockpit shows 40 per-country rows; timeline expands 0→10 sub-rows on
  click; launch record shows 10-market rollout — same `mlStatus` colours across all (e.g. VARIPULSE Gen2 PFA: DE/FR=ct
  red, ES/UK/US/AU/BR/CA/CN/JP=ok green). Build+lint green, no critical pkg issues, 0 console errors.

**Set E — cockpit attention panel flattened to one line per slipping market (supersedes Set D's grouped sub-rows)**
- **Problem (user):** the grouped per-country sub-rows under one launch wrapped ugly in the narrow "Next gate" cell,
  AND showed on-plan markets which "no need attention". User wanted ONE LINE per market with product + phase + gate +
  slip, and ONLY markets that have slip (drop on-plan).
- **Solution:** `CockpitView` now flattens `data.attention` into `FlatAttnRow[]` — one row per launch×market, keeping
  only markets whose `mlStatus` is `ct`/`rk` (on-plan `ok` dropped). A launch with markets modelled but all on-plan is
  dropped entirely; a launch with NO per-market rollout falls back to a single launch-level line. Sorted ct→rk then by
  slip. Panel renamed "Markets needing attention"; the `<MarketGateRows>` sub-row component was removed. Market shown
  as an `.atn-mk` chip next to the product name + `lead` tag; row toned by `mlStatus`. `healthTone` helper removed
  (unused). The Timeline expand and Launch-record rollout (Set D) are UNCHANGED — those keep the full per-market list.
- **Verified live:** VARIPULSE→DE+FR only (not ES/UK/US), ETHICON→US+FR+DE+UK, TECNIS→IT, EMBOTRAP→ES, OCTARAY→DE.
  Build+lint green, 0 console errors.
- **Layout follow-up:** market moved to its OWN column (headers: Launch · Market · Gate · Slip · €M). Product name +
  `franchise · phaseCode` sub-line stays one line; Market cell = `.atn-mk-cell` (dot + code + `lead`); Gate = code bold
  + name sub-line (no more tall wrap in the wrong cell). New `.atn-t` CSS trims cell padding to 8px, pins the slip
  `.bar-t` to 56px, and keeps the €M column from clipping. `fmtPhase` import dropped from CockpitView (unused).
- **Timeline per-market slip (follow-up):** `MarketTimelineRow` now draws the market's slip AS A BAR like the lead
  train — hollow baseline `.ms-g.base` → `.ms-sp`/`.ms-sp.amb` slip bar → coloured `.ms-g.{crit|risk}` forecast marker
  — for rk/ct markets (width from `slipWidthPct(mk.slipDays)`, baseline = forecastPos − slipW). On-plan markets show a
  single neutral marker; live shows the green ✓. The redundant "Gate · name" text line under each country code was
  REMOVED (gate reads off the track marker); `.msr-mk-w` CSS deleted. Label column now just dot+code+`lead`+quarter.

**Set G — cross-view data-consistency pass (8 fixes A–H, applied one-by-one, each verified reconciling)**
User rule: "los datos tienen que cuadrar" — same product/market/person/issue/gate reads identically everywhere.
All fixes touched only `dependency`/`owner`/`launch` refs + derivation logic — NEVER a finding `outcome`, so the
11-spec `test_Reconciliation.js` (13 findings USER5/HELD3/AUTO3/RUNNING2, 107 activities, A95/R12) still passes.
- **A — NPI-0388 re-attributed VARIPULSE→OCTARAY** (`data/Finding/Finding.json`): its Decision card already read
  "OCTARAY G2 and 3 others", phase p2 matches OCTARAY. Result: VARIPULSE open 5→4/blocking 3, OCTARAY 1→2/blocking 1.
- **B — NPI-0412 given a USER Decision + 2 options** (`data/Decision`, `seed/DecisionOption`): it was a YOU finding
  with no Decision, so "on you" (5) ≠ Pending queue (4). Now Pending = 5 = YOU count. `seed_decision_412`/`seed_option_412_a,b`.
- **C — authority-vs-escalation fix:** NPI-0344 & 0365 were internal escalations mis-tagged `dependency=REGULATOR`
  (inflating AUTHORITY to 3). Set them to `TEAM` + Decision owner → Launch Board (`seed_person_board`) / S. Lindqvist
  (`seed_person_sl`) so `waitingOnFor` routes them to PERSON. NPI-0420 (FDA deficiency letter) stays the sole REGULATOR.
  Result: Open Issues YOU5/PERSON2/AGENT2/AUTHORITY1; PERSON 2 = Escalated queue 2; timeImpact recoverable 51→86 (66%),
  regulator 80→45 (only 0420).
- **D — cockpit `nextGateByLaunch`** (`PortfolioService.js`): string compare put "BAU"<"G5"; now uses `GATE_RANK`.
  EMBOTRAP next gate BAU→G5.
- **E — resolutionWorkspace `gateAtRisk`** (`ExecutionService.js`): now derives the gate that CLOSES the finding's
  phase (added `PHASE_GATE` + `GATE_RANK` maps), with earliest-open-by-rank fallback. NPI-0402 (P4) G3→G4 = its card.
- **F — label vocabulary made distinct across screens:** "slip"/"+Nd" = gate schedule movement (SlipPill everywhere);
  "days at stake"/"recoverable" = finding's own critical-path cost (Open Issues); "Recovery" = option's modelled gain.
- **G — Open Issues gained a "Gate at risk" column** (`PortfolioService.openIssues` + `types/portfolio.ts`
  `IssueGateAtRisk` + `OpenIssues.tsx` `GateAtRiskCell`): same phase-closing-gate rule as the workspace, so the gate a
  row shows == the gate its resolution page shows == the finding card. Header comment de-staled (was "twelve"/"4 on people").
- **H — cleanups:** DUALTO (LAUNCHED) `revenueAtRisk` 200000→0 (cockpit revenue now €37.8M, DUALTO absent from
  attention); Cockpit "Gates closing" renders "+Nd slip"/"criteria pending" instead of a misleading "0/0 met" bar.
- **Verified whole:** Open Issues total 10 = YOU5+PERSON2+AGENT2+AUTHORITY1; Pending 5 = YOU; Escalated 2 = PERSON;
  Σ per-launch open (4+2+1+2+1+0) = 10; timeImpact 131 at stake / 86 recoverable / 45 regulator; build+lint green;
  11/11 reconciliation specs pass; no critical Pkg.Issue.

### Set H — card-vs-screen exposure reconciliation ("las cards cuadran con la info de pantalla")
- **Live UI layer confirmed:** `App.tsx → shell/AppShell` renders the `views/` layer; **Open issues = `views/AlertsView.tsx`**
  (the `pages/OpenIssues.tsx` / `pages/Cockpit.tsx` in the routed Tailwind layer are LEGACY and NOT mounted — Fix G's
  column edit had landed there and never rendered).
- **Root inconsistency:** `Finding.exposure`/`exposureCause` were NULL on all 13 findings, so AlertsView's €M column
  (`row.exposure`) showed "—" on every row while the decision cards cite €18.4M / €6.2M / €2.8M; and the "Slip" column was
  mis-wired to `row.exposureCause` (also null) instead of the gate slip the backend already computes. The "€30.5M exposed"
  band was hardcoded.
- **Fix (data):** seeded `exposure`/`exposureCause` on the 4 gate-blocking (`ct`) findings so the €M column matches the
  cards and sums to the band: NPI-0417 €18.4M (VARIPULSE G3), NPI-0388 €6.2M (OCTARAY G2), NPI-0402 €2.8M (VARIPULSE G4),
  NPI-0351 €3.1M (EMBOTRAP G5) → **Σ = €30.5M**. NPI-0420 stays null (its VARIPULSE revenue is already counted via 0417 —
  no double-count; its real cost is the 45-day authority wait). `rk`/`ok` findings stay null (they consume float/are
  monitored, cards cite days not €). **No `outcome` touched → 11/11 reconciliation specs still pass.**
- **Fix (AlertsView.tsx):** "Slip" column rewired from `exposureCause` to a new `GateSlipChip` reading `row.gateAtRisk`
  (renders `G3 +47d` / `G4 · not met` / `on plan`) — same phase-closing gate the card & workspace show. "€30.5M exposed"
  band now derived (`ctExposure` = Σ `exposure` over `ct` rows via `fmtEuro`), not hardcoded.
- **Verified live (Playwright, localhost:9000 → Open issues):** 10 rows; €M column reads 18.4/6.2/3.1/2.8M on the ct rows
  (— on rk/authority); Slip column reads G3+47d/G2+14d/G5+9d/G4·not met matching each card; band "€30.5M exposed"; lens
  10 = You5+Else2+Agent2+Authority1. build+lint green.

### Set I — full-portfolio KPI reconciliation ("TODAS las metricas revisadas, que TODOS los KPIs cuadren")
User flagged: (1) average slip at close didn't match Portfolio, (2) **Revenue exposed differed between Cockpit and
Open issues**, (3) "can recover" days weren't reflected on the other tabs. Root causes + the single reconciliation
model now enforced everywhere:
- **CANONICAL "Revenue exposed" = €40.6M, one grain everywhere.** Previously Cockpit summed `Launch.revenueAtRisk`
  (€37.8M) while Open Issues summed `Finding.exposure` (€30.5M) — two grains, so they never matched. Fix: made each
  launch's open-finding exposures **sum exactly to that launch's `revenueAtRisk`**, and Open Issues now reads a
  **server-computed total** (`PortfolioService.openIssues().totals.exposureOpen`) instead of re-summing visible rows.
  - Data edits: `data/Finding/Finding.json` — added `exposure` 2.3M (NPI-0359 TECNIS/PureSee, RUNNING) and 7.8M
    (NPI-0344 ETHICON 4000+, HELD) + `exposureCause` prose; `data/Launch/Launch.json` — VARIPULSE `revenueAtRisk`
    18.4M→**21.2M** (= its open findings 0417 18.4M + 0402 2.8M). Per-launch check (all match): EMBOTRAP 3.1M,
    ETHICON 7.8M, OCTARAY 6.2M, PureSee 2.3M, VARIPULSE 21.2M → **Σ = €40.6M**.
  - **`exposureBlocking` €30.5M** is the gate-blocking (`ct`) subset, shown as the "of €X blocking a gate" subtitle —
    never as a rival headline. AlertsView 2nd header tile relabelled "Blocking a gate" → **"Revenue exposed"** €40.6M
    with "€30.5M blocking a gate" subtitle.
- **Average slip at close = 20.4d (worst 47), averaged over SLIPPED gates only.** Was 4.3d because ~19 zero-slip open
  gates diluted it. `LaunchControlMetrics.averageSlipAtGateClose()` now averages only gates with `slipDays>0` and
  returns `slippedGates`(5) / `openGates`(24) so the card reads "avg across 5 slipped gates". Cockpit slip card
  subtitle updated to match.
- **Recoverable ("can recover") days now propagate to every tab** via one rule (`timeSplitFor`: REGULATOR → all
  `regulatorDays`, recoverable 0; SELF/TEAM/AGENT → all `recoverableDays`). Portfolio totals: **daysAtStake 131,
  recoverable 86, regulator 45, 66% recoverable** — identical across `openIssues.totals`, `timeImpact.totals`,
  product-lens row sums, and BU-lens segment sums. New helper `launchTimeRecoveryMap()` feeds per-launch
  daysAtStake/recoverableDays/regulatorDays/pctRecoverable into `portfolioProduct()`, `portfolioBusinessUnit()`
  (franchise + segment roll-ups) and `launchRecord()`. UI surfaces it: AlertsView "Recoverable by acting" tile,
  Cockpit time-recovery chart, PortfolioView BU footer (`Nd recoverable`) + segment subtitle, **LaunchView slip
  tile subtitle** (`Nd recoverable by acting` when >0, else "zero float on path").
- **Verified (runJsCode, fresh cache):** cockpit_revenueExposed 40.6M = openIssues.exposureOpen = product_sumRAR =
  bu_sumRAR; days 131/86/45 identical across openIssues, timeImpact, product & BU sums; slip 20.4/worst47/slipped5/
  open24; every launchRecord.openExposure == its revenueAtRisk. build+lint+bundle green. No `outcome` touched →
  finding counts (11) unchanged, test_Reconciliation unaffected.
- **"Revenue exposed" definition (for the user):** the first-year launch revenue that will be lost or delayed if the
  currently-open issues on a launch aren't cleared before their gate — the sum, across every open issue, of the
  revenue each one puts at risk. It is NOT money already lost; it is money **at risk until you act**. €40.6M is the
  whole-portfolio figure; €30.5M of it sits behind issues that are actually blocking a gate right now.

### Set J — demo copy reconciled to the Set I numbers + descriptions rewritten (`shell/GuidedTour.tsx`)
User: "revisar todos los numeros de las demos para que cuadren con los nuevos numeros" + "no me gusta la
descripcion de las distintas demos … da a entender que solo la primera te enseña todo". Two parts, both done:
- **Numbers reconciled** to the canonical Set I baseline (cockpit: gate readiness **87%** ▼6 vs target 85;
  health **3 on plan / 4 at risk / 1 off track** of 8 active; revenue exposed **€40.6M** ▲€11.2M/30d = 9.9% of
  €412M; avg slip **20d** worst **47** across 5 slipped launches). Edited step-2 prose + spotlights on **all three**
  demos (Demo 1 `capa`, Demo 2 `regulatory`, Demo 3 `supplier`) — previously they read the stale 83% / three at
  risk / €38M. Demo 1 step 5 "Four decisions"→"Five decisions" (matches Pending 5 = YOU). Demo 1 step 13 ("€18.4M
  released, launch slip 47→9, cockpit worst 47→21") verified CORRECT and left unchanged (NPI-0417 = €18.4M;
  ETHICON 4000+ G4 = 21d is next-worst after VARIPULSE's 47). "107 activities / 32 actions / 28 minutes / €340k"
  are narrative-only (no on-screen KPI conflict) — kept as story detail.
- **Descriptions rewritten** so each demo advertises a FULL end-to-end tour (no longer implying only Demo 1 shows
  everything). Parallel three-blurb structure in the `DEMOS` registry: titles "A steriliser drops a booked slot" /
  "Two agencies, two clocks" / "One part, four catheters"; each blurb leads with its lens ("A supply shock." /
  "A regulatory read." / "A supply-chain call.") then the case. Picker heading "Which walkthrough?"→**"Pick a
  case"** + new intro: "Three complete walkthroughs of the **same** pipeline … end to end. Each follows a
  **different real case** … so any one on its own shows the whole product." Top-of-file docstring de-canonicalised
  (removed the "original 16-step tour, verbatim" wording that framed Demo 1 as the master).
- **Verified (Playwright, localhost:9000):** Demo 1 step 2 renders "87% … four at risk … €40.6M … €11.2M more …
  20 days … worst case 47" and the cockpit behind it matches exactly; picker shows the three new blurbs + the
  "same pipeline" intro, each card labelled "16 STEPS". `VITE_C3_PKG=jJDemo npm run build` green (lint+tsc+vite).
  No backend/data/`outcome` touched → reconciliation specs unaffected.

### Set K — History records Helena's taken decision + activity-log pill relabel
User (two parts): "nos aseguramos que en la demo uno la decision que ha tomado helena ha quedado grabada en
history verdad?" + "en el activity log de los agents no tiene sentido que ponga your call … seria mas como
decir si fue automnoma o fue human in the loop". Both done:
- **History reflects the taken decision (NPI-0417).** The seed `hist_0417` correctly stays `RUNNING`
  ("Decision still open — due 17:00 today.") = the honest pre-approval state the demo starts in. **Key
  constraint:** `DecisionHistoryEvent` is a `SeedData` type, so its fields are **seed-locked** and CANNOT be
  mutated at runtime (`approve()` trying to `merge` a new `subLine`/`status` throws "Seed Data value can not be
  updated"). So the flip is done **read-side** in `ExecutionService.decisionHistory()`: it fetches Decisions with
  `Filter.exists('approvedAt')`, and for any `MY`/`RUNNING` event whose `npiId` now has an approved Decision it
  projects `status: 'RESOLVED'`, `subLine: 'Decision taken — <selectedOption> approved.'`. So after Helena
  approves in Demo 1, her My Actions → History reads **"Decision taken — Option A approved."** Finding `outcome`
  is never read or touched (reconciliation invariant). Verified end-to-end: approve → History RESOLVED; baseline
  restored → History RUNNING again. (`Decision.js` was NOT changed — an earlier attempt to write History there was
  reverted once the SeedData lock was found.)
- **Activity-log pill relabelled** (`TowerView.tsx` `LED` map). Old labels `USER:'your call'` / `HELD:'with a
  person'` / `AUTO:'closed'` were wrong for a **fleet log of AGENT actions** — "your call" implies ownership. New:
  `USER→'stopped for a human'` (agent did the work, chain stopped for a human decision), `HELD→'handed to a human'`
  (routed out to another person), `AUTO→'autonomous'` (fleet closed it end to end), plus the previously-missing
  `RUNNING→'in progress'` (2 rows were falling through to the generic "done"). Same [label, class] tuple shape;
  classes/tones unchanged (`you`=red, `held`=amber, `auto`=green, `run`=purple).
- **Verified:** `VITE_C3_PKG=jJDemo npm run build` green (lint+tsc+vite); `runTest test_Reconciliation` 11/11 pass;
  live baseline confirmed canonical (decision USER/unapproved, G3 slip 47, launch €21.2M OFF_TRACK, History
  RUNNING, stray approve-DHF removed, CAPA back to OPEN). NOTE: backend JS recompile lags — after editing a `.js`
  service, `clearCaches(workspaceId)` was needed for the live app to pick up `decisionHistory()`'s new projection.

### Set L — Demo 2 (regulatory) critique fixes, 8 items (`shell/GuidedTour.tsx`, GD2 only)
Governing rule reaffirmed: each client sees only ONE demo, so no demo may say "the same X as another demo".
Core theme fixed across Demo 2: there is exactly ONE authority-bound thread — **NPI-0420/FDA** (45 fixed grey
days); **NPI-0365/BSI is a recoverable signature Helena owes** (drafted, unsigned 6 days), NOT an agency wait.
All "two agency clocks/threads" over-claims corrected. Edited GD2 cards 2,3,4,5,8,13,14,16: card 2 → cockpit
time-recovery panel (`.ti-pnl`/`.ti-card.reg` 45d/`.ti-card.rec`); card 3 lands on VARIPULSE launch detail; card 4
market lens UK→US with both pins; card 5 singularised to one authority row; card 8 board card `#c-seed_finding_420`;
card 13 short `.dc-gh` headers; card 14 spots `.fb2[data-f=esc]` + `.ev[data-npi="NPI-0365"]`; card 16 "one FDA
clock + one signature + BSI slot + site visit". Verified: 11/11 reconciliation, build/lint green, browser confirmed.

### Set M — Demo 3 (supplier change) critique fixes, 3 items (governing "cuadrar" rule)
User (verbatim): "en la demo tres donde veo yo que tienen el mismo supplier, deberia estar en el detalle … que
haga click en el detalle de los 4 y vea que es el mismo … el mapa no aplica. asegurate … las decisiones tomadas
se vean reflejadas en el historico del humano y … en el del agent tambien." Three fixes, all done + verified:
- **D3-1 · Shared supplier verifiable in launch detail.** `seed/BillOfMaterialItem/seed_bom_ring_electrode.json`
  expanded from 1 row (VARIPULSE only) to **4 rows** — all Heraeus (`seed_supplier_heraeus`), SINGLE_SOURCE, frozen
  at G2, part "Ring electrode subassembly" — for varipulse/octaray/embotrap/javelin. New `criticalSupply` projection
  in `PortfolioService.launchRecord()`: fetches this launch's BOM, then all BOM once, groups siblings by
  `supplier.id + partName`, returns `{partName, sourcingMode, frozenAtGate, supplierId, supplierName, sharedAcross,
  siblings[]}` (sorted single-source/most-shared first). Types in `types/portfolio.ts` (`CriticalSupplyItem`,
  `CriticalSupplySibling`, `LaunchOverview.criticalSupply`). `LaunchView.tsx` left rail renders a **"Critical supply"**
  card (`#ld-supply`, `.ld-sup*` styles in `prototype.css`): part, Heraeus, "Single-source · frozen at G2 · shared
  across 4 launches", and clickable sibling chips (`.ld-sup-lk` → `open('launch', siblingId)`). Verified runtime:
  `sharedAcross:4`, 3 siblings (OCTARAY/EMBOTRAP/Javelin). NOTE: no launch has a `shortName` in seed → chips show
  full device names (still concrete + clickable).
- **D3-2 · Map removed from Demo 3.** GD3 card 4 was the DE market-map step (user: "el mapa no aplica"). Replaced
  with an **"Open one launch and see the same supplier"** step that drives to VARIPULSE launch detail
  (`view:'launch', param:'seed_launch_varipulse_g2'`) and spotlights `#ld-supply` + `.ld-sup-sib` — the viewer
  clicks the sibling chips to confirm the same Heraeus part on each of the 4 launches.
- **D3-3 · NPI-0412 decision reflected in BOTH records, spotlighted for this demo.** Added `hist_0412` MY/RUNNING
  `DecisionHistoryEvent` (sortOrder 0, newest) — mirrors `hist_0417`, so once Helena approves NPI-0412 in the demo
  it flips read-side to RESOLVED/"Decision taken" in `decisionHistory()`. Added `data-npi={r.displayId}` to fleet-log
  rows in `TowerView.tsx`. Retargeted GD3 card 14 (her history) → spot `#ev-list .ev[data-npi="NPI-0412"]`; card 15
  (fleet log) → spot `#lg-b .lg-r[data-npi="NPI-0412"]` — the SAME NPI-0412 event seen from both sides, reconciling
  on one id. History rows already carried `data-npi`.
- **Verified:** upsert + `clearCaches` (for PortfolioService.js); `VITE_C3_PKG=jJDemo npm run build` green
  (lint+tsc+vite, 723 modules); `runTest test_Reconciliation` **11/11** (DecisionHistoryEvent + BillOfMaterialItem
  changes don't touch the Activity-107/Finding-11 fixture); runtime confirms criticalSupply, hist_0412 (MY/RUNNING),
  and 4 NPI-0412 fleet-log rows. No Finding `outcome` touched → reconciliation invariant preserved.

### Set N — cross-cutting: agent-response timing realism + KPI sanity (Request 5)
User (verbatim): "asegurate que tras implementar en todas las demos los cambios sugeridos por el agent … tengan
sentidos los cambios en los kpis. Y ojo con el tiempo de respuesta de los agentes en su historial que igual dias es
exagerado."
- **Timing.** `seed/AgentAction/AgentAction.json`: compressed unrealistic **agent→agent** gaps that spanned a full
  day down to minute-scale for the 3 demo chains — chn04 (NPI-0344), chn05 (NPI-0365), chn07 (NPI-0388). Runtime now
  confirms every demo chain (0344/0365/0388/0412) resolves within **≤5 min on a single day** (maxGapHours 0). NPI-0365
  detail reworded (07 Sep since / 08 Sep reminder). **Deliberately left unchanged:** iz351 ("Pricing a second
  sterilisation lane", 48h) and iz359 ("Redesigning the thermoform insert", 120h) — those are genuine single-agent
  engineering durations, not response latency, so multi-day is correct there.
- **KPI sanity — all reconcile, no distortion from the demo changes.** Cockpit: 87% readiness, €40.6M exposed
  (byLaunch sums 3.1+7.8+6.2+2.3+21.2 = 40.6 ✓), 8 active, rollup 3 on-plan/4 at-risk/1 off-track ✓. Board:
  findingCount 11 = yourDecision 5 + heldByPerson 3 + closedByFleet 1 + workingNow 2 ✓ (maps to USER5/HELD3/AUTO1/
  RUNNING2). History band: 23 taken / 19 closed / 2 esc open / 4.2 d median (canonical, untouched). Surfacing the
  shared-supplier BOM feeds **no** metric, and NPI-0412 was already counted in workingNow(2)/RUNNING(2) — so the
  Demo-3 additions add verifiability without double-counting; the decision stays RUNNING until Helena approves in the
  demo, then flips RESOLVED (intended before/after).
- **Verified:** upsert (AgentAction + 4-row BOM into live DB, orphan check clean — no stale `seed_bom_ring_electrode`
  row); `npm run build` green (723 modules); `runTest test_Reconciliation` **11/11**.

## Milestone replan — SCENARIO 1: regulatory-date slip → dynamic cascade replan (functional feature + 4th guided demo)

New end-to-end feature: an outside authority (the FDA) moves a launch's clearance date; the platform fans the
impact across every downstream commitment, auto-adjusting what it safely can and surfacing ONLY the items that
need a human. Anchored on **OTTAVA** (robotic surgical platform, keyed on its FDA 510(k) clearance). The demo
story: FDA slips OTTAVA's clearance six weeks; three downstream commitments auto-adjust, two decisions reach
Helena, she resolves both in one meeting.

- **Backend types (`src/`):**
  - `RegulatoryMilestone.c3typ` — the authority milestone (launch, authority, milestoneName, baselineDate,
    currentDate, status ON_TRACK/REPLANNED, slipDays/slipWeeks). Operational → seed in `data/RegulatoryMilestone/`
    (`seed_milestone_ottava_fda.json`, FDA, baseline+current 2026-11-02, ON_TRACK).
  - `CascadeImpactItem.c3typ` — one downstream commitment (milestone, domain MANUFACTURING/LOGISTICS/COMMERCIAL/
    FINANCE/…, resolution AUTO|HUMAN, status PENDING/AUTO_ADJUSTED/RESOLVED, targetLabel/detail/autoAction/
    decisionPrompt/decisionOptions/ownerName/costImpact/resolvedOption). Operational → `data/CascadeImpactItem/`
    (5 items: run2 hold / kits delay / comms flag = AUTO; storage FINANCE HUMAN owner seed_person_jr costImpact
    €48 000 + 2 options; field COMMERCIAL HUMAN owner seed_person_tb + 2 options).
  - `CascadeReplanService.c3typ` + `.js` — stateless service, 4 methods returning plain JSON view-models:
    `getPlan(launchId)` (milestone + items + summary), `cascadeReplan(milestoneId, targetIso)` (books the slip →
    milestone REPLANNED with slipDays/slipWeeks, marks AUTO items AUTO_ADJUSTED, leaves HUMAN items PENDING),
    `resolveImpact(itemId, option)` (RESOLVED + records option, books cost), `reset(milestoneId)` (back to
    ON_TRACK baseline, all items PENDING). Smoke-tested via runJsCode: base ON_TRACK(5 pending) → replan →
    {total 5, autoAdjusted 3, needDecision 2, slipWeeks 6, costTotal 48000, REPLANNED} → resolve storage →
    {needDecision 1, resolved 1, costBooked 48000} → reset → clean.
- **Frontend:** `ui/react/src/views/CascadeView.tsx` (id `#v-cascade`) — the exception dashboard. Header (`.vt`/`.vs`),
  4-card KPI band (`#cs-kpis`: milestone slip / auto-adjusted / need-a-human / working-capital), `.cs-hint`
  pre-slip banner, primary `#cs-run` button ("FDA slips 6 weeks — run cascade replan") that flips to "Reset
  scenario" once slipped, and a two-column `.two.cs-two` layout (`#cs-auto-list` AutoItem cards / `#cs-human-list`
  HumanItem cards with option buttons → resolve). Reads the tour's `cascadeRun` DriveIntent to land already-cascaded.
  Wired via `api/cascade.ts` (getCascadePlan/runCascadeReplan/resolveCascadeImpact/resetCascade + OTTAVA_LAUNCH_ID
  `seed_launch_ottava` / OTTAVA_FDA_MILESTONE_ID `seed_milestone_ottava_fda`); types `CascadePlan`/`CascadeItem` in
  `types/portfolio.ts`; `| 'cascade'` ViewId; pipeline-branch tab `{v:'cascade', l:'Milestone replan'}` in
  NavContext; `cascadeRun?: boolean` on DriveTarget; view registered in AppShell body. CSS `.cs-*` block appended
  to `prototype.css`. Added `data-launch={row.launchId}` to PortfolioView product-lens rows so the tour can
  spotlight OTTAVA.
- **4th guided demo (`shell/GuidedTour.tsx`):** `GD4` (16 steps), registered in DEMOS as `{id:'cascade', chip:
  'MILESTONE REPLAN', title:'A regulator slips a date'}`. Arc: menu → cockpit → portfolio product lens (spotlight
  `.tkr[data-launch="seed_launch_ottava"]`) → OTTAVA launch record → cascade view (on-track) → cascade with
  `cascadeRun:true` → exception summary → auto column → human finance card → human field card → resolve → cost
  booked → milestone re-planned → launch record re-timed → Copilot `chatAsk:'cascade'` → close (points at the
  on-screen Reset scenario button). New `cascade` CopilotPrompt (`seed/CopilotPrompt/CopilotPrompt.json`,
  sortOrder 10, group "Diagnose a launch"): Q "The FDA slipped OTTAVA's clearance six weeks — what moves?", 5
  evidence items (3 auto-adjusted / 2 need-you), rec + why bullets, actions [open the replan dashboard `cascade:`
  / open the OTTAVA record `launch:seed_launch_ottava`].
- **Verified:** `runJsCode` full circuit (replan/resolve/reset) green; CascadeView renders live seed data +
  cascade c3Actions 200 OK (Playwright: run replan → KPIs +6 wks / 3 auto / 2 human / €48k, all 3
  CascadeReplanService calls 200 OK, then reset to clean baseline). Reconciliation lock intact — new types are
  NOT Finding/Activity/Gate instances, so 11 findings / 107 activities / 11 `test_Reconciliation` specs unchanged
  and re-verified green. No critical Pkg.Issue (only a pre-existing testtools SemanticVersion WARNING, unrelated).

## Demo 1 & Demo 3 reframe — CAPA removed from the slot case, Demo 3 becomes a manufacturing story

Two edits to the EXISTING guided demos (all backing records are test-invisible — Decision/Comment/Task/CAPA/Option
are not Finding/Activity/Gate instances — so reconciliation stays 11 findings / 107 activities / 11 specs green).

- **Demo 1 (`capa`, NPI-0417) — CAPA reference removed.** Rationale: a CAPA opens only for a quality defect, and a
  contract steriliser cancelling a booked slot is a supply/scheduling shock, not a quality problem. Removed the
  `seed_capa_0148` record (deleted `data/CAPA/CAPA.json` entry AND removed the already-persisted DB row via
  `runJsCode` `CAPA.removeAll({filter: Filter.eq('finding.id','seed_finding_417')}, true)` — upsert alone won't
  delete). IssueView renders ALL CAPA copy conditionally on `ws.capa`, so NPI-0417 now shows no CAPA chip
  (`#is-capa`), no "Quality" tag, no CAPA paragraph, no "CAPA status" fact, no "CAPA effectiveness" impact row.
  GuidedTour `GD`: reworded the "How did this even reach me?" step (dropped "opened CAPA-2026-0148"), retitled/rewrote
  "The case, in plain words" (was "…language of the quality system"; now spotlights `#pb-txt` + `.is-meta` instead of
  `#is-capa`, and explicitly says it opens no CAPA), "What the decision actually needs from her" (was "…the CAPA…"),
  "One decision" ("dual-source" not "containment action"), the fleet-record step ("follow-through" not "corrective
  action"), and the "why me" aside. DEMOS chip `CAPA-2026-0148`→`STERILISATION SLOT`. `Decision.js` needs no change
  (its CAPA-closure step is guarded by a length check → no-op when no CAPA on the finding).
- **Demo 3 (`supplier`, NPI-0412) — full manufacturing reframe.** Was a Heraeus shared-component supplier-change /
  Neuss-diversion story; now: **VARIPULSE builds commercial output on two lines (3 and 5); line 3 produced 3 batches
  out of spec on the dimensional check; a CAPA IS appropriate here (manufacturing defect) and is overdue because its
  DMAIC is open/in-progress.** Data fact encoded: V&V produces **3 batches as the norm** (12 at one site), so 3 bad
  commercial batches = a full run's worth. Changes:
  - `Finding.json` `seed_finding_412`: headline "Commercial batches at risk on line 3?", description reframed
    (lines 3 & 5, 3 out-of-spec batches, V&V-3-norm, overdue CAPA/DMAIC); Heraeus/ring-electrode/4-of-12 framing gone.
  - NEW manufacturing CAPA `seed_capa_0412` (`CAPA-2026-0149`, status `CORRECTIVE_IN_PROGRESS`, linked to
    seed_finding_412) — correctiveAction spells out the DMAIC (Measure/Analyse done, Improve in progress, Control
    unsigned → overdue). No new CAPA field needed; expressed in existing fields.
  - 3 DecisionOptions rewritten (`seed_option_412_a/b/c`): **A = prioritise markets & redistribute reduced volume
    (recommended); B = drive the in-progress DMAICs to close the CAPA & re-operate line 3; C = move output to another
    qualified site, same modality (contingent on agents confirming regulatory/engineering clearance + capacity).**
    All Neuss/OCTARAY/supplier-change content removed.
  - Comment thread `seed_comment_412_1..4` rewritten to Line Monitor → A. Kowalski (Quality, overdue CAPA/DMAIC) →
    Planning agent (shortfall model) → L. Haugen (three routes, market-priority is above his line). **M. Okafor
    sourcing comment and all Neuss/OCTARAY-diversion content removed** (per user screenshot).
  - ActionPlanTasks `seed_task_412_a_1..5` realigned to Option A (quarantine 3 batches, supply from line 5, re-weight
    market allocation, re-baseline P3, manual approve revised market priority — Neuss hedge removed).
  - `supplier` CopilotPrompt reframed: Q "What is putting VARIPULSE's commercial batches at risk?", evidence =
    line 3 vs line 5 / overdue CAPA-DMAIC / V&V-3-norm / G3 holds / three routes; rec = re-prioritise markets;
    actions → open NPI-0412. Heraeus-concentration framing gone.
  - GuidedTour `GD3` (16 steps) fully rewritten to the manufacturing arc; **dropped the `#ld-supply` Critical-supply
    step, the NPI-0388/OCTARAY "other side of the same part" step, and the "one part, four catheters" framing.** New
    steps land on the launch scope (`#ld-phase`/`#ld-strip`), spotlight the overdue CAPA (`#is-capa`), the 3 rewritten
    options (`#opt-a/b/c`), and a dedicated "Why the CAPA is overdue" DMAIC step. DEMOS chip `SUPPLIER CHANGE`→
    `MANUFACTURING`, title "One part, four catheters"→"Commercial batches at risk".
  - **Verified:** upsertSeedData + stale-CAPA delete; `resolutionWorkspace('seed_finding_417')` → `capa:null` with
    Sterigenics options; `resolutionWorkspace('seed_finding_412')` → CAPA-2026-0149 CORRECTIVE_IN_PROGRESS, 3 new
    options, 4-entry thread (Line Monitor/Kowalski/Planning/Haugen), 5 tasks. `npm run build` + lint + tsc green;
    `test_Reconciliation` 11/11; no critical Pkg.Issue.
