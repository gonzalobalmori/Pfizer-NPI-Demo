/*
 * Reproducible generator for the per-launch Gate ladders, GateCriterion sets and
 * Activity programmes — the data behind the Pipeline Status → Product detail page.
 *
 * WHY (manager review): "in the detail of each of the products, all the information
 * shown must match the context of that product. For the products at risk and the
 * yellow-gate ones, when clicked, the risks must appear ... use the lead programme
 * as the example of the tables that should exist. If the product is not at risk, the
 * tables should appear but only when they make sense — no item at risk, open
 * issues clean." Only the lead programme was fully seeded; every other launch had
 * an incomplete gate ladder, ZERO gate criteria (empty centre table) and ZERO
 * activities (empty Workflow board). This generator fixes all three from a single
 * source of truth.
 *
 * INVARIANTS honoured:
 *  - The lead programme's authored data is preserved VERBATIM: its gates, its G3
 *    GateCriterion set and its Activity records are copied through unchanged.
 *  - Gate ids keep the exact seed_gate_<slug>_<code> scheme the PPM transform
 *    (SrcPpmGate-Gate.js) reverses, so a re-load UPDATES gates idempotently.
 *  - Every launch's ladder is consistent with its currentPhase: gates BEFORE the
 *    live phase are closed (ok), the gate AT the live phase carries the launch's
 *    real slip/status, gates AFTER are pending (no).
 *  - Criteria sit only on each launch's NEXT (live) gate — exactly as the lead
 *    programme carries criteria only on its live gate. Troubled launches surface
 *    >=1 unmet criterion (the risk); on-plan launches read clean.
 *  - The PPM_GATE CSV (the ingest source of truth) is regenerated to match.
 *  - Deterministic: no randomness, so re-running yields identical output.
 *
 * RUN: node scripts/gen-gates-criteria-activities.mjs   (from the jJDemo pkg root)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const GATE_JSON = join(ROOT, 'data', 'Gate', 'Gate.json');
const GATE_CSV = join(ROOT, 'sources', 'ppm', 'PPM_GATE_20260911.csv');
const CRIT_JSON = join(ROOT, 'seed', 'GateCriterion', 'GateCriterion.json');
const ACT_JSON = join(ROOT, 'seed', 'Activity', 'Activity.json');
const LAUNCH_JSON = join(ROOT, 'data', 'Launch', 'Launch.json');

/* The lead programme, whose authored gate/criterion/activity data is preserved
   verbatim rather than templated (see the header note). */
const LEAD = 'seed_launch_berobenatide_obesity';

/* ── canonical gate metadata ────────────────────────────────────────── */
const GATE_NAME = {
  G1: 'Launch Strategy Approved',
  G2: 'NPL Plan Approved',
  G3: 'DS Released',
  G4: 'DP Released',
  G5: 'Finished Product Released',
  G6: 'Launch Readiness Confirmed',
  G7: 'Launch Go / No-Go',
  G8: 'Commercial Availability',
  BAU: 'BAU handover'
};
const GATE_PHASE = {
  G1: 'p1', G2: 'p2', G3: 'p3', G4: 'p4', G5: 'p5',
  G6: 'p6', G7: 'p7', G8: 'p8', BAU: 'p9'
};
const GATE_ORDER = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'BAU'];

/*
 * Per-launch identity plus the gate its programme is currently driving toward.
 * The nine-gate ladder is derived from `start` on a fixed cadence so the table
 * stays small and every ladder is monotonic by construction: gates before the
 * live one read closed, the live gate carries the launch's real slip, later
 * gates are pending. One launch sits in each phase so the portfolio exercises
 * the whole process model.
 */
const LAUNCHES = [
  { launchId: LEAD,                               slug: 'berobenatide_obesity',  project: 'PRJ-BERO',        readiness: 57, troubled: true,  next: 'G3',  start: '2024-09-24', slip: 47 },
  { launchId: 'seed_launch_berobenatide_t2d',     slug: 'berobenatide_t2d',      project: 'PRJ-SASA',       readiness: 46, troubled: true,  next: 'G2',  start: '2025-03-11', slip: 18 },
  { launchId: 'seed_launch_pf08634404_crc',       slug: 'pf08634404_crc',        project: 'PRJ-PF08634404_CRC', readiness: 38, troubled: true,  next: 'G3',  start: '2025-01-20', slip: 24 },
  { launchId: 'seed_launch_met097_obesity',       slug: 'met097_obesity',        project: 'PRJ-MET097_OB',      readiness: 61, troubled: false, next: 'G5',  start: '2024-06-03', slip: 0  },
  { launchId: 'seed_launch_berobenatide_osa',     slug: 'berobenatide_osa',      project: 'PRJ-VEPD',       readiness: 57, troubled: true,  next: 'G6',  start: '2024-04-15', slip: 12 },
  { launchId: 'seed_launch_berobenatide_knee_oa', slug: 'berobenatide_knee_oa',  project: 'PRJ-PF883',        readiness: 74, troubled: false, next: 'G7',  start: '2024-02-12', slip: 0  },
  { launchId: 'seed_launch_sigvotatug_nsclc',     slug: 'sigvotatug_nsclc',      project: 'PRJ-SIGVO_NSCLC',    readiness: 69, troubled: true,  next: 'G8',  start: '2023-11-06', slip: 9  },
  { launchId: 'seed_launch_pf3945_obesity',       slug: 'pf3945_obesity',        project: 'PRJ-PF3945_OB',      readiness: 21, troubled: false, next: 'G1',  start: '2025-09-08', slip: 0  },
  { launchId: 'seed_launch_atirmociclib_mbc',     slug: 'atirmociclib_mbc',      project: 'PRJ-ATIRMO_MBC',     readiness: 96, troubled: false, next: 'BAU', start: '2023-05-15', slip: 0  }
].map((L) => {
  /* ~5 months per phase, so a full programme runs a little over three years. */
  const CADENCE_DAYS = 152;
  const liveIdx = GATE_ORDER.indexOf(L.next);
  const t0 = new Date(L.start + 'T00:00:00Z').getTime();
  const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
  L.ladder = GATE_ORDER.map((code, i) => {
    const baseMs = t0 + (i + 1) * CADENCE_DAYS * 86400000;
    const slip = i === liveIdx ? L.slip : 0;
    const status = i < liveIdx ? 'ok' : i > liveIdx ? 'no' : (L.slip > 30 ? 'late' : L.slip > 0 ? 'rk' : 'run');
    return {
      code,
      baseline: iso(baseMs),
      forecast: iso(baseMs + slip * 86400000),
      slip,
      status
    };
  });
  return L;
});

/*
 * Per-launch commercial scope + drug-product facts (the "Launch scope" and
 * "Product" cards on the Product-detail page). Kept as attested programme data —
 * the single source of truth the UI reads instead of a hard-coded set. Numbers
 * are phase-appropriate: pre-market programmes have little commercial scope
 * built yet; launched programmes are complete.
 *
 * The four sterile-injectable programmes deliberately share the Puurs prefilled-syringe
 * route, because that shared line is what lets one drug-product event cascade
 * across several launches at once.
 *
 * fields: launchValue, fillFinish, manufacture, regsFiled/regsTotal,
 *         buildUnits, ffCertified/ffTotal, vacFiled/vacTotal.
 */
const SCOPE = {
  seed_launch_berobenatide_obesity: {
    launchValue: 96000000, fillFinish: 'Aseptic fill — prefilled syringe', manufacture: 'Puurs + Vetter Ravensburg',
    regsFiled: 11, regsTotal: 14, buildUnits: 4200, ffCertified: 62, ffTotal: 78, vacFiled: 9, vacTotal: 22
  },
  seed_launch_berobenatide_t2d: {
    launchValue: 54000000, fillFinish: 'Lyophilised — single-use vial', manufacture: 'Puurs',
    regsFiled: 3, regsTotal: 12, buildUnits: 0, ffCertified: 0, ffTotal: 64, vacFiled: 0, vacTotal: 18
  },
  seed_launch_sigvotatug_nsclc: {
    launchValue: 41000000, fillFinish: 'Lyophilised — single-use vial', manufacture: 'Grange Castle',
    regsFiled: 9, regsTotal: 11, buildUnits: 6800, ffCertified: 44, ffTotal: 52, vacFiled: 12, vacTotal: 19
  },
  seed_launch_met097_obesity: {
    launchValue: 120000000, fillFinish: 'Aseptic fill — prefilled syringe', manufacture: 'Kalamazoo (KZO)',
    regsFiled: 2, regsTotal: 6, buildUnits: 900, ffCertified: 18, ffTotal: 70, vacFiled: 2, vacTotal: 15
  },
  seed_launch_berobenatide_knee_oa: {
    launchValue: 88000000, fillFinish: 'Oral solid dose — film-coated tablet', manufacture: 'Freiburg',
    regsFiled: 7, regsTotal: 9, buildUnits: 5200, ffCertified: 58, ffTotal: 66, vacFiled: 14, vacTotal: 20
  },
  seed_launch_berobenatide_osa: {
    launchValue: 76000000, fillFinish: 'Oral solid dose — film-coated tablet', manufacture: 'Freiburg',
    regsFiled: 6, regsTotal: 12, buildUnits: 3100, ffCertified: 31, ffTotal: 84, vacFiled: 5, vacTotal: 24
  },
  seed_launch_atirmociclib_mbc: {
    launchValue: 62000000, fillFinish: 'Oral solid dose — film-coated tablet', manufacture: 'Freiburg',
    regsFiled: 9, regsTotal: 9, buildUnits: 480, ffCertified: 112, ffTotal: 112, vacFiled: 28, vacTotal: 28
  },
  seed_launch_pf3945_obesity: {
    launchValue: 210000000, fillFinish: 'Aseptic fill — prefilled pen', manufacture: 'Puurs',
    regsFiled: 0, regsTotal: 8, buildUnits: 0, ffCertified: 0, ffTotal: 90, vacFiled: 0, vacTotal: 30
  },
  seed_launch_pf08634404_crc: {
    launchValue: 47000000, fillFinish: 'Aseptic fill — single-use vial', manufacture: 'Grange Castle + Siegfried Hameln',
    regsFiled: 4, regsTotal: 13, buildUnits: 1200, ffCertified: 12, ffTotal: 48, vacFiled: 3, vacTotal: 21
  }
};

/* ── gate-criterion templates, keyed by gate code ───────────────────── */
/* Each entry: [name, unmetReason]. The reason is only emitted when the criterion
 * is scored unmet. Berobenatide's authored G3 set is preserved verbatim elsewhere,
 * so this G3 template is used only for the other G3 launches (pf08634404_crc). */
const CRIT_TEMPLATE = {
  G1: [
    ['Launch scope agreed (product / indication / market)', 'Indication list still open with the brand team'],
    ['Regulatory strategy approved', 'Pathway pending a health-authority meeting'],
    ['Manufacturing and inventory strategy set', 'Make-vs-buy decision outstanding'],
    ['Supply chain sourcing strategy defined', 'Sourcing options still being costed'],
    ['Market prioritisation and wave plan agreed', 'Wave sequencing under review with the affiliates'],
    ['Leadership endorsement recorded', 'Endorsement pending the portfolio committee']
  ],
  G2: [
    ['NPL created in the NPL Data Repository', 'NPL record raised but not yet complete'],
    ['Product Passport established', 'Passport attributes incomplete for two markets'],
    ['Project plan created in DLPP', 'DLPP plan awaiting workstream inputs'],
    ['Pfizer Connect programmes linked', 'Programme links not yet confirmed'],
    ['Governance and milestones configured', 'Milestone calendar pending sign-off'],
    ['Sourcing grid built', 'Sourcing grid missing secondary packaging lanes']
  ],
  G3: [
    ['DS demand forecast approved', 'Forecast awaiting the latest market inputs'],
    ['BOM and standard cost complete', 'Standard cost pending finance review'],
    ['DS manufacturing approved', 'Manufacturing approval in the quality queue'],
    ['Raw material procurement complete', 'One long-lead raw material still open'],
    ['DS manufactured', 'API campaign not yet complete'],
    ['DS released', 'Quality review open on the API campaign'],
    ['DS received at DP site', 'Shipment to the DP site not yet booked']
  ],
  G4: [
    ['DP demand forecast approved', 'DP forecast pending the supply review'],
    ['Packaging components ready', 'Primary packaging components not yet released'],
    ['Manufacturing scheduled', 'Fill-finish slot not yet confirmed with the CMO'],
    ['DP manufactured', 'Production run not yet executed'],
    ['DP released', 'Batch release pending QP disposition'],
    ['Transportation validated', 'Cold-chain lane validation outstanding'],
    ['DP delivered to packaging site', 'Delivery to the packaging site not yet scheduled']
  ],
  G5: [
    ['Artwork approved', 'Artwork in MLR review for two markets'],
    ['Labelling approved', 'Label text pending health-authority confirmation'],
    ['Printed components released', 'Printed component release pending artwork lock'],
    ['Packaging complete', 'Packaging campaign not yet run'],
    ['Serialisation ready', 'Serialisation master data not yet loaded'],
    ['Finished product released', 'Quality approval pending packaging release'],
    ['Transfer pricing complete', 'Transfer price not yet set for two affiliates']
  ],
  G6: [
    ['Enterprise systems set up via Pfizer Connect', 'Two market system configurations still open'],
    ['Market readiness assessments complete', 'Three affiliates have not returned their assessment'],
    ['Market approvals managed and tracked', 'Approval outstanding in the lead market'],
    ['Product listings prepared', 'Listing data incomplete for the wave-two markets'],
    ['Artwork samples submitted', 'Sample submissions pending in two markets'],
    ['Distribution centre readiness confirmed', 'DC readiness check not yet signed off']
  ],
  G7: [
    ['Launch command centre governance live', 'Command centre cadence not yet stood up'],
    ['Site-to-site coordination confirmed', 'Handover plan between sites still in draft'],
    ['Internal and external manufacturers aligned', 'CMO alignment call outstanding'],
    ['Supply allocation decisions taken', 'Allocation across markets not yet agreed'],
    ['Readiness milestones tracked green', 'Two milestones remain amber'],
    ['Exceptions cleared', 'One open exception awaiting a decision']
  ],
  G8: [
    ['Finished product shipped to DC', 'First shipment not yet despatched'],
    ['Launch supplies received at DC', 'Receipt confirmation pending at two DCs'],
    ['Market ready to order', 'Order enablement not yet switched on'],
    ['Product listing activated', 'Listing activation pending in the lead market'],
    ['First commercial shipment complete', 'First commercial order not yet shipped'],
    ['Commercial availability achieved', 'Availability not yet confirmed in all wave-one markets']
  ],
  BAU: [
    ['Launch KPI monitoring live', 'KPI pack being handed to the BAU team'],
    ['Inventory health tracking active', 'Inventory dashboards not yet transferred'],
    ['Supply continuity review complete', 'Continuity review scheduled but not held'],
    ['Lessons learned captured', 'Retrospective not yet run'],
    ['Playbook updated', 'Playbook revision outstanding']
  ]
};

/* ── activity programme templates, per phase ────────────────────────── */
/* Each entry: [name, domainCode]. Generic, industry-standard NPI activities so
 * every launch shows a populated, phase-appropriate Workflow board. */
const ACT_TEMPLATE = {
  P1: [
    ['Define launch scope: product, indication and market', 'gov'],
    ['Develop the regulatory strategy', 'reg'],
    ['Establish the manufacturing and inventory strategy', 'mfg'],
    ['Create the supply chain sourcing strategy', 'src'],
    ['Identify launch risks and mitigation plans', 'gov'],
    ['Run market wave planning', 'com'],
    ['Obtain leadership endorsements', 'gov']
  ],
  P2: [
    ['Create the NPL in the NPL Data Repository', 'it'],
    ['Establish the Product Passport', 'it'],
    ['Create the project plan in DLPP', 'gov'],
    ['Link the Pfizer Connect programmes', 'it'],
    ['Configure governance and milestones', 'gov'],
    ['Build the sourcing grid', 'src'],
    ['Establish the launch readiness timeline', 'gov'],
    ['Align cross-functional stakeholders', 'gov']
  ],
  P3: [
    ['Run drug substance demand forecasting', 'sc'],
    ['Complete the BOM and standard cost', 'fin'],
    ['Obtain manufacturing approval', 'qua'],
    ['Procure raw materials', 'src'],
    ['Execute API production', 'mfg'],
    ['Complete quality review and release', 'qua'],
    ['Set up the transfer price', 'fin'],
    ['Set up and validate the route', 'sc'],
    ['Ship drug substance to the DP site', 'sc']
  ],
  P4: [
    ['Run drug product demand forecasting', 'sc'],
    ['Confirm packaging component readiness', 'src'],
    ['Schedule manufacturing', 'mfg'],
    ['Execute drug product production', 'mfg'],
    ['Complete batch release', 'qua'],
    ['Validate transportation lanes', 'sc'],
    ['Ship drug product to the packaging site', 'sc'],
    ['Align inventory planning', 'sc']
  ],
  P5: [
    ['Execute packaging', 'mfg'],
    ['Approve artwork', 'com'],
    ['Approve labelling', 'reg'],
    ['Release printed components', 'qua'],
    ['Set up serialisation', 'it'],
    ['Obtain quality approval', 'qua'],
    ['Complete packaging release', 'qua'],
    ['Complete transfer pricing', 'fin'],
    ['Plan global distribution', 'sc']
  ],
  P6: [
    ['Set up enterprise systems through Pfizer Connect', 'it'],
    ['Run market readiness assessments', 'com'],
    ['Hold launch readiness reviews', 'gov'],
    ['Manage market approvals', 'reg'],
    ['Prepare product listings', 'com'],
    ['Submit artwork samples', 'reg'],
    ['Confirm distribution centre readiness', 'sc'],
    ['Run launch risk reviews', 'gov']
  ],
  P7: [
    ['Run launch command centre governance', 'gov'],
    ['Coordinate site to site', 'mfg'],
    ['Align internal and external manufacturers', 'src'],
    ['Take supply allocation decisions', 'sc'],
    ['Track readiness milestones', 'gov'],
    ['Manage exceptions', 'gov'],
    ['Produce executive reporting', 'fin'],
    ['Issue launch communications', 'com']
  ],
  P8: [
    ['Ship finished product to the DC', 'sc'],
    ['Receive inventory at the DC', 'sc'],
    ['Enable market ordering', 'it'],
    ['Activate the product listing', 'com'],
    ['Execute the first commercial shipment', 'sc'],
    ['Monitor demand', 'ma'],
    ['Track supply performance', 'sc']
  ],
  P9: [
    ['Monitor launch KPIs', 'gov'],
    ['Track inventory health', 'sc'],
    ['Monitor service levels', 'sc'],
    ['Review supply continuity', 'src'],
    ['Capture lessons learned', 'gov'],
    ['Assess launch agility', 'gov'],
    ['Update the launch playbook', 'gov'],
    ['Make recommendations for future launches', 'gov']
  ]
};

const PHASE_ORDER = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9'];
const PERSONS = ['hf', 'mo', 'ak', 'sl', 'kt', 'lh', 'ap', 'tb', 'dm', 'rm', 'jt', 'rd', 'jr'];
const STATUS_LABEL = { ok: 'Complete', run: 'In progress', rk: 'At risk', late: 'Late', no: 'Not started' };

function phaseIdx(launch) {
  // current phase index (1-based) from the live gate's phase, or from ladder.
  // We derive it from the launch's `next` gate code's phase.
  return PHASE_ORDER.indexOf('P' + GATE_PHASE[launch.next].slice(1)) + 1;
}

/* ── build Gate.json + PPM_GATE csv ─────────────────────────────────── */
const gateOut = [];
const csvRows = ['GateId,ProjectId,GateCode,GateName,BaselineDate,ForecastDate,SlipDays,Status'];

for (const L of LAUNCHES) {
  for (const g of L.ladder) {
    gateOut.push({
      id: `seed_gate_${L.slug}_${g.code.toLowerCase()}`,
      code: g.code,
      name: GATE_NAME[g.code],
      baselineDate: g.baseline,
      forecastDate: g.forecast,
      slipDays: g.slip,
      status: g.status,
      launch: { id: L.launchId },
      phase: { id: `seed_phase_${GATE_PHASE[g.code]}` }
    });
    const gateId = `G-${L.slug.toUpperCase()}_${g.code}`;
    const name = GATE_NAME[g.code].indexOf(',') >= 0 ? `"${GATE_NAME[g.code]}"` : GATE_NAME[g.code];
    csvRows.push(`${gateId},${L.project},${g.code},${name},${g.baseline},${g.forecast},${g.slip},${g.status}`);
  }
}

/* ── build GateCriterion.json ───────────────────────────────────────── */
/* Every launch, Berobenatide included, is scored from the nine-phase CRIT_TEMPLATE.
 * The previously authored G3 set described the old design-control process and
 * no longer matches the gate it now sits on. */
const critOut = [];
for (const L of LAUNCHES) {
  const tmpl = CRIT_TEMPLATE[L.next];
  const total = tmpl.length;
  // met count reflects readiness; a still-open gate keeps at least one unmet.
  let met = Math.round((L.readiness / 100) * total);
  if (met >= total) met = total - 1;
  if (met < 0) met = 0;
  const gateId = `seed_gate_${L.slug}_${L.next.toLowerCase()}`;
  tmpl.forEach(([name, reason], i) => {
    // Score the LAST `total-met` criteria unmet so the outstanding ones read as
    // the launch's live risks (matching Berobenatide, whose sole unmet is last).
    const isMet = i < met;
    const rec = {
      id: `seed_gc_${L.slug}_${L.next.toLowerCase()}_${i + 1}`,
      name,
      met: isMet,
      gate: { id: gateId }
    };
    if (!isMet) rec.outstandingReason = reason;
    critOut.push(rec);
  });
}

/* ── build Activity.json ────────────────────────────────────────────── */
/* Activities are generated for every launch from ACT_TEMPLATE so the whole
 * portfolio speaks the nine-phase process. */

function autonomyFor(n) {
  // mostly autonomous, a scatter of recommend / human-led (mirrors 95A/10R/2H).
  if (n % 13 === 5) return 'h';
  if (n % 5 === 3) return 'r';
  return 'a';
}

function statusForActivity(phaseNum, curPhase, troubled, launched, idxInPhase, count) {
  if (phaseNum < curPhase) return 'ok';
  if (phaseNum > curPhase) return 'no';
  // live phase
  if (launched) {
    // post-launch: steady-state, mostly complete with some in progress
    return idxInPhase < count - 1 ? 'ok' : 'run';
  }
  if (troubled) {
    // surface the risks in the live phase: one late, one or two at risk, rest running/ok
    if (idxInPhase === count - 1) return 'late';
    if (idxInPhase === count - 2 || idxInPhase === count - 3) return 'rk';
    return idxInPhase % 2 === 0 ? 'ok' : 'run';
  }
  // on plan: making progress, nothing at risk
  return idxInPhase % 2 === 0 ? 'ok' : 'run';
}

function detailFor(status) {
  switch (status) {
    case 'ok': return 'closed';
    case 'run': return 'in progress';
    case 'rk': return 'holding for data';
    case 'late': return 'behind plan';
    default: return 'not started';
  }
}

const actOut = [];
let personCursor = 0;
let autoCounter = 0;

/* The lead programme is generated like every other launch. It used to be
   skipped here on the assumption its activities were authored by hand, but that
   authored set was lost in the device-to-pharma rename, which left the demo's
   anchor launch as the only one with an empty Workflow board. */
for (const L of LAUNCHES) {
  const curPhase = phaseIdx(L); // 1-based
  const launched = L.launchId === 'seed_launch_atirmociclib_mbc';
  PHASE_ORDER.forEach((pcode, pi) => {
    const phaseNum = pi + 1;
    const tmpl = ACT_TEMPLATE[pcode];
    tmpl.forEach(([name, domain], idxInPhase) => {
      const status = statusForActivity(phaseNum, curPhase, L.troubled, launched, idxInPhase, tmpl.length);
      const auto = autonomyFor(autoCounter++);
      const person = PERSONS[personCursor++ % PERSONS.length];
      actOut.push({
        id: `seed_activity_${L.slug}_${pcode.toLowerCase()}_${idxInPhase}`,
        name,
        status: STATUS_LABEL[status],
        statusCode: status,
        detail: detailFor(status),
        phase: { id: `seed_phase_${pcode.toLowerCase()}` },
        domain: { id: `seed_domain_${domain}` },
        launch: { id: L.launchId },
        autonomyClass: { id: `seed_autonomy_${auto}` },
        owningPerson: { id: `seed_person_${person}` },
        owningAgent: null
      });
    });
  });
}

/* ── enrich Launch.json with scope + product facts ───────────────────── */
const launches = JSON.parse(readFileSync(LAUNCH_JSON, 'utf8'));
for (const L of launches) {
  const s = SCOPE[L.id];
  if (!s) throw new Error(`No SCOPE entry for launch ${L.id}`);
  L.launchValue = s.launchValue;
  L.fillFinishRoute = s.fillFinish;
  L.manufactureSite = s.manufacture;
  L.registrationsFiled = s.regsFiled;
  L.registrationsTotal = s.regsTotal;
  L.launchBuildUnits = s.buildUnits;
  L.fieldForceCertified = s.ffCertified;
  L.fieldForceTotal = s.ffTotal;
  L.vacApprovalsFiled = s.vacFiled;
  L.vacApprovalsTotal = s.vacTotal;
}

/* ── write all artifacts ────────────────────────────────────────────── */
writeFileSync(LAUNCH_JSON, JSON.stringify(launches, null, 2) + '\n');
writeFileSync(GATE_JSON, JSON.stringify(gateOut, null, 2) + '\n');
writeFileSync(GATE_CSV, csvRows.join('\n') + '\n');
writeFileSync(CRIT_JSON, JSON.stringify(critOut, null, 2) + '\n');
writeFileSync(ACT_JSON, JSON.stringify(actOut, null, 2) + '\n');

/* ── summary ────────────────────────────────────────────────────────── */
console.log(`Gates: ${gateOut.length}  (CSV rows ${csvRows.length - 1})`);
console.log(`GateCriterion: ${critOut.length}`);
console.log(`Activities: ${actOut.length}`);
const perLaunchCrit = {};
critOut.forEach((c) => {
  const g = c.gate.id;
  perLaunchCrit[g] = perLaunchCrit[g] || { total: 0, met: 0 };
  perLaunchCrit[g].total++;
  if (c.met) perLaunchCrit[g].met++;
});
console.table(perLaunchCrit);
