/*
 * Reproducible generator for the per-launch Gate ladders, GateCriterion sets and
 * Activity programmes — the data behind the Pipeline Status → Product detail page.
 *
 * WHY (manager review): "in the detail of each of the products, all the information
 * shown must match the context of that product. For the products at risk and the
 * yellow-gate ones, when clicked, the risks must appear ... use VARIPULSE as the
 * example of the tables that should exist. If the product is not at risk, the
 * tables should appear but only when they make sense — no item at risk, open
 * issues clean." Currently only VARIPULSE is fully seeded; every other launch has
 * an incomplete gate ladder, ZERO gate criteria (empty centre table) and ZERO
 * activities (empty Workflow board). This generator fixes all three from a single
 * source of truth.
 *
 * INVARIANTS honoured:
 *  - VARIPULSE G2's authored data is preserved VERBATIM: its 5 gates, its 6 G3
 *    GateCriterion (incl. seed_gc_varipulse_g3_sterilisation -> seed_doc_varipulse_44),
 *    and its 107 Activity records are copied through unchanged.
 *  - Gate ids keep the exact seed_gate_<slug>_<code> scheme the PPM transform
 *    (SrcPpmGate-Gate.js) reverses, so a re-load UPDATES gates idempotently.
 *  - Every launch's ladder is consistent with its currentPhase: gates BEFORE the
 *    live phase are closed (ok), the gate AT the live phase carries the launch's
 *    real slip/status, gates AFTER are pending (no).
 *  - Criteria sit only on each launch's NEXT (live) gate — exactly as VARIPULSE
 *    carries criteria only on G3, not G4/G5. Troubled launches surface >=1 unmet
 *    criterion (the risk); on-plan launches read clean.
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

const VARIPULSE = 'seed_launch_varipulse_g2';

/* ── canonical gate metadata ────────────────────────────────────────── */
const GATE_NAME = {
  G1: 'NPI Readiness Gate',
  G2: 'Design Freeze',
  G3: 'Submission Commit',
  G4: 'Clearance / CE Certificate',
  G5: 'Launch Go / No-Go — First Ship',
  BAU: 'BAU handover'
};
const GATE_PHASE = { G1: 'p1', G2: 'p2', G3: 'p3', G4: 'p4', G5: 'p5', BAU: 'p6' };

/*
 * Per-launch identity + full gate ladder. Each ladder is complete and consistent
 * with the launch's currentPhase (see header). Existing gate dates/slips/statuses
 * are reproduced exactly; missing gates get plausible monotonic dates; the three
 * inconsistent ladders (impella P4, javelin P5, ottava P1) are corrected so early
 * gates read closed and the live gate is the one at the current phase.
 *
 * slug   -> the gate-id slug, matching the ALREADY-SEEDED ids exactly.
 * project-> PPM ProjectId (kept for source realism; not used by the projection).
 * next   -> the code of the launch's live gate (gets the GateCriterion set).
 */
const LAUNCHES = [
  {
    launchId: VARIPULSE, slug: 'varipulse', project: 'PRJ-VARIPULSE_G2',
    readiness: 83, troubled: true, next: 'G3',
    ladder: [
      { code: 'G1', baseline: '2024-09-24', forecast: '2024-09-24', slip: 0, status: 'ok' },
      { code: 'G2', baseline: '2026-06-19', forecast: '2026-06-19', slip: 0, status: 'ok' },
      { code: 'G3', baseline: '2026-11-04', forecast: '2026-12-21', slip: 47, status: 'late' },
      { code: 'G4', baseline: '2027-05-18', forecast: '2027-05-18', slip: 0, status: 'no' },
      { code: 'G5', baseline: '2027-06-29', forecast: '2027-06-29', slip: 0, status: 'no' }
    ]
  },
  {
    launchId: 'seed_launch_octaray_g2', slug: 'octaray_g2', project: 'PRJ-OCTARAY_G2',
    readiness: 86, troubled: true, next: 'G2',
    ladder: [
      { code: 'G1', baseline: '2024-11-15', forecast: '2024-11-15', slip: 0, status: 'ok' },
      { code: 'G2', baseline: '2026-09-16', forecast: '2026-09-30', slip: 14, status: 'late' },
      { code: 'G3', baseline: '2027-03-15', forecast: '2027-03-15', slip: 0, status: 'no' },
      { code: 'G4', baseline: '2027-08-15', forecast: '2027-08-15', slip: 0, status: 'no' },
      { code: 'G5', baseline: '2027-12-15', forecast: '2027-12-15', slip: 0, status: 'no' }
    ]
  },
  {
    launchId: 'seed_launch_embotrap_iv', slug: 'embotrap_iv', project: 'PRJ-EMBOTRAP_IV',
    readiness: 67, troubled: true, next: 'G5',
    ladder: [
      { code: 'G1', baseline: '2023-06-15', forecast: '2023-06-15', slip: 0, status: 'ok' },
      { code: 'G2', baseline: '2024-03-15', forecast: '2024-03-15', slip: 0, status: 'ok' },
      { code: 'G3', baseline: '2024-11-15', forecast: '2024-11-15', slip: 0, status: 'ok' },
      { code: 'G4', baseline: '2025-07-15', forecast: '2025-07-15', slip: 0, status: 'ok' },
      { code: 'G5', baseline: '2026-09-17', forecast: '2026-09-26', slip: 9, status: 'late' },
      { code: 'BAU', baseline: '2026-10-30', forecast: '2026-10-30', slip: 0, status: 'no' }
    ]
  },
  {
    launchId: 'seed_launch_impella_ecp', slug: 'impella_ecp', project: 'PRJ-IMPELLA_ECP',
    readiness: 92, troubled: false, next: 'G4',
    ladder: [
      { code: 'G1', baseline: '2024-05-15', forecast: '2024-05-15', slip: 0, status: 'ok' },
      { code: 'G2', baseline: '2025-01-19', forecast: '2025-01-19', slip: 0, status: 'ok' },
      { code: 'G3', baseline: '2025-09-15', forecast: '2025-09-15', slip: 0, status: 'ok' },
      { code: 'G4', baseline: '2027-06-15', forecast: '2027-06-15', slip: 0, status: 'no' },
      { code: 'G5', baseline: '2027-12-15', forecast: '2027-12-15', slip: 0, status: 'no' }
    ]
  },
  {
    launchId: 'seed_launch_javelin_xl', slug: 'javelin_xl', project: 'PRJ-JAVELIN_XL',
    readiness: 88, troubled: false, next: 'G5',
    ladder: [
      { code: 'G1', baseline: '2023-09-15', forecast: '2023-09-15', slip: 0, status: 'ok' },
      { code: 'G2', baseline: '2024-06-15', forecast: '2024-06-15', slip: 0, status: 'ok' },
      { code: 'G3', baseline: '2025-03-12', forecast: '2025-03-12', slip: 0, status: 'ok' },
      { code: 'G4', baseline: '2025-11-15', forecast: '2025-11-15', slip: 0, status: 'ok' },
      { code: 'G5', baseline: '2027-12-15', forecast: '2027-12-15', slip: 0, status: 'no' }
    ]
  },
  {
    launchId: 'seed_launch_ethicon_4000', slug: 'ethicon_4000', project: 'PRJ-ETHICON_4000',
    readiness: 80, troubled: true, next: 'G4',
    ladder: [
      { code: 'G1', baseline: '2024-02-15', forecast: '2024-02-15', slip: 0, status: 'ok' },
      { code: 'G2', baseline: '2024-10-15', forecast: '2024-10-15', slip: 0, status: 'ok' },
      { code: 'G3', baseline: '2025-06-15', forecast: '2025-06-15', slip: 0, status: 'ok' },
      { code: 'G4', baseline: '2026-10-12', forecast: '2026-11-02', slip: 21, status: 'late' },
      { code: 'G5', baseline: '2026-12-14', forecast: '2026-12-14', slip: 0, status: 'no' }
    ]
  },
  {
    launchId: 'seed_launch_dualto', slug: 'dualto', project: 'PRJ-DUALTO',
    readiness: 100, troubled: false, next: 'BAU',
    ladder: [
      { code: 'G1', baseline: '2022-06-15', forecast: '2022-06-15', slip: 0, status: 'ok' },
      { code: 'G2', baseline: '2023-03-15', forecast: '2023-03-15', slip: 0, status: 'ok' },
      { code: 'G3', baseline: '2023-11-15', forecast: '2023-11-15', slip: 0, status: 'ok' },
      { code: 'G4', baseline: '2024-07-15', forecast: '2024-07-15', slip: 0, status: 'ok' },
      { code: 'G5', baseline: '2026-08-12', forecast: '2026-08-12', slip: 0, status: 'ok' },
      { code: 'BAU', baseline: '2026-10-30', forecast: '2026-10-30', slip: 0, status: 'no' }
    ]
  },
  {
    launchId: 'seed_launch_ottava', slug: 'ottava', project: 'PRJ-OTTAVA',
    readiness: 95, troubled: false, next: 'G1',
    ladder: [
      { code: 'G1', baseline: '2026-11-15', forecast: '2026-11-15', slip: 0, status: 'no' },
      { code: 'G2', baseline: '2027-04-15', forecast: '2027-04-15', slip: 0, status: 'no' },
      { code: 'G3', baseline: '2027-10-15', forecast: '2027-10-15', slip: 0, status: 'no' },
      { code: 'G4', baseline: '2028-04-15', forecast: '2028-04-15', slip: 0, status: 'no' },
      { code: 'G5', baseline: '2028-08-15', forecast: '2028-08-15', slip: 0, status: 'no' }
    ]
  },
  {
    launchId: 'seed_launch_puresee', slug: 'puresee', project: 'PRJ-PURESEE',
    readiness: 83, troubled: false, next: 'G3',
    ladder: [
      { code: 'G1', baseline: '2024-08-15', forecast: '2024-08-15', slip: 0, status: 'ok' },
      { code: 'G2', baseline: '2025-06-15', forecast: '2025-06-15', slip: 0, status: 'ok' },
      { code: 'G3', baseline: '2026-11-03', forecast: '2026-11-03', slip: 0, status: 'no' },
      { code: 'G4', baseline: '2027-06-15', forecast: '2027-06-15', slip: 0, status: 'no' },
      { code: 'G5', baseline: '2027-12-15', forecast: '2027-12-15', slip: 0, status: 'no' }
    ]
  }
];

/*
 * Per-launch commercial scope + device facts (the "Launch scope" and "Device"
 * cards on the Product-detail page). Kept as attested programme data — the single
 * source of truth the UI must read instead of the old hard-coded VARIPULSE values.
 * VARIPULSE reproduces the prototype exactly (€96M, EO, Irvine + CMO, 11/14,
 * 4200, 62/78, 9/22). Numbers are phase-appropriate: pre-market programmes have
 * little commercial scope built yet; launched programmes are complete.
 *
 * fields: launchValue, sterilisation, manufacture, regsFiled/regsTotal,
 *         buildUnits, ffCertified/ffTotal, vacFiled/vacTotal.
 */
const SCOPE = {
  seed_launch_varipulse_g2: {
    launchValue: 96000000, sterilisation: 'EO', manufacture: 'Irvine + CMO',
    regsFiled: 11, regsTotal: 14, buildUnits: 4200, ffCertified: 62, ffTotal: 78, vacFiled: 9, vacTotal: 22
  },
  seed_launch_octaray_g2: {
    launchValue: 54000000, sterilisation: 'EO', manufacture: 'Irwindale',
    regsFiled: 3, regsTotal: 12, buildUnits: 0, ffCertified: 0, ffTotal: 64, vacFiled: 0, vacTotal: 18
  },
  seed_launch_embotrap_iv: {
    launchValue: 41000000, sterilisation: 'e-beam', manufacture: 'Galway',
    regsFiled: 9, regsTotal: 11, buildUnits: 6800, ffCertified: 44, ffTotal: 52, vacFiled: 12, vacTotal: 19
  },
  seed_launch_impella_ecp: {
    launchValue: 120000000, sterilisation: 'EO', manufacture: 'Danvers',
    regsFiled: 2, regsTotal: 6, buildUnits: 900, ffCertified: 18, ffTotal: 70, vacFiled: 2, vacTotal: 15
  },
  seed_launch_javelin_xl: {
    launchValue: 88000000, sterilisation: 'EO', manufacture: 'Santa Clara',
    regsFiled: 7, regsTotal: 9, buildUnits: 5200, ffCertified: 58, ffTotal: 66, vacFiled: 14, vacTotal: 20
  },
  seed_launch_ethicon_4000: {
    launchValue: 76000000, sterilisation: 'Gamma', manufacture: 'Cincinnati + CMO',
    regsFiled: 6, regsTotal: 12, buildUnits: 3100, ffCertified: 31, ffTotal: 84, vacFiled: 5, vacTotal: 24
  },
  seed_launch_dualto: {
    launchValue: 62000000, sterilisation: 'N/A', manufacture: 'Cincinnati',
    regsFiled: 9, regsTotal: 9, buildUnits: 480, ffCertified: 112, ffTotal: 112, vacFiled: 28, vacTotal: 28
  },
  seed_launch_ottava: {
    launchValue: 210000000, sterilisation: 'N/A', manufacture: 'Santa Clara',
    regsFiled: 0, regsTotal: 8, buildUnits: 0, ffCertified: 0, ffTotal: 90, vacFiled: 0, vacTotal: 30
  },
  seed_launch_puresee: {
    launchValue: 47000000, sterilisation: 'Gamma', manufacture: 'Groningen',
    regsFiled: 4, regsTotal: 13, buildUnits: 1200, ffCertified: 12, ffTotal: 48, vacFiled: 3, vacTotal: 21
  }
};

/* ── gate-criterion templates, keyed by gate code ───────────────────── */
/* Each entry: [name, unmetReason]. The reason is only emitted when the criterion
 * is scored unmet. VARIPULSE's authored G3 set is preserved verbatim elsewhere,
 * so this G3 template is used only for the other G3 launches (puresee). */
const CRIT_TEMPLATE = {
  G1: [
    ['Design & Development Plan approved', 'Development plan in review with the core team'],
    ['Risk Management File opened (ISO 14971)', 'Initial hazard analysis still being compiled'],
    ['Regulatory strategy and pathway confirmed', 'Pathway pending a pre-submission meeting'],
    ['Clinical Evaluation Plan drafted', 'Clinical plan awaiting KOL input'],
    ['Programme budget and RACI approved', 'Budget approval pending the portfolio review']
  ],
  G2: [
    ['Design inputs signed off', 'Two of the design inputs remain unsigned'],
    ['Design FMEA complete', 'FMEA review actions still open'],
    ['Design verification & validation plan approved', 'V&V plan in second review cycle'],
    ['Biocompatibility evaluation plan complete', 'Biocompatibility strategy under review'],
    ['Critical suppliers qualified / second-sourced', 'Single-source supplier not yet dual-sourced'],
    ['Design review minutes closed', 'Design review actions being closed out']
  ],
  G3: [
    ['Design verification complete', 'Verification report awaiting sign-off'],
    ['Design validation complete', 'Validation runs in progress'],
    ['Clinical Evaluation Report approved', 'CER in Notified Body query cycle'],
    ['Sterilisation validation report (ISO 11135)', 'Sterilisation validation slot cancelled; report slips'],
    ['Risk management file current', 'Risk file update pending latest test data'],
    ['EU MDR Technical Documentation complete', 'Technical documentation 96% complete']
  ],
  G4: [
    ['Notified Body / FDA review closed', 'Query cycle 2 open on the clinical section'],
    ['Process validation complete (IQ/OQ/PQ)', 'PQ runs not yet complete on the transfer line'],
    ['Design transfer to manufacturing complete', 'Design transfer package being finalised'],
    ['Labelling and IFU approved', 'IFU artwork in MLR review'],
    ['CAPAs and non-conformances closed', 'Two CAPAs remain open from the at-risk build'],
    ['Declaration of Conformity ready', 'DoC held pending certificate issuance']
  ],
  G5: [
    ['Launch build and safety stock complete', 'At-risk build authorisation above delegated authority'],
    ['Field-force certification >= 95%', 'Certification at 91% against a 95% target'],
    ['Country registrations filed', 'Country dossiers pending final registration'],
    ['Distribution and 3PL agreements signed', '3PL agreement in legal review'],
    ['VAC approvals and reimbursement secured', 'CPT code application pending — no US reimbursement path yet'],
    ['First-case loaner sets certified', 'Loaner instrument sets not certified for first-case coverage']
  ],
  BAU: [
    ['Post-Market Surveillance plan active', 'PMS plan being handed to the BAU team'],
    ['Complaint handling and vigilance live', 'Vigilance procedure transfer in progress'],
    ['First production lots released', 'First lots released to distribution'],
    ['Surveillance ownership transferred to BAU', 'Final BAU handover sign-off outstanding']
  ]
};

/* ── activity programme templates, per phase ────────────────────────── */
/* Each entry: [name, domainCode]. Generic, industry-standard NPI activities so
 * every launch shows a populated, phase-appropriate Workflow board. */
const ACT_TEMPLATE = {
  P1: [
    ['Activate NPI governance and assign workstream owners', 'gov'],
    ['Open the Design History File and draft the development plan', 'rnd'],
    ['Confirm device classification and regulatory pathway', 'reg'],
    ['Draft the clinical evaluation plan', 'cli'],
    ['Approve the programme budget and business case', 'fin']
  ],
  P2: [
    ['Freeze design inputs and requirements', 'rnd'],
    ['Complete the design FMEA and risk analysis', 'rnd'],
    ['Approve the design verification & validation plan', 'qua'],
    ['Qualify critical suppliers and activate second sources', 'src'],
    ['Compile the pre-submission (Q-Sub) package', 'reg']
  ],
  P3: [
    ['Execute design verification testing', 'rnd'],
    ['Execute design validation and biocompatibility', 'qua'],
    ['Complete sterilisation validation (ISO 11135)', 'qua'],
    ['Finalise the clinical evaluation report', 'cli'],
    ['Assemble the EU MDR technical documentation', 'reg']
  ],
  P4: [
    ['Complete process validation (IQ/OQ/PQ)', 'mfg'],
    ['Execute design transfer to manufacturing', 'mfg'],
    ['Respond to Notified Body / FDA queries', 'reg'],
    ['Approve labelling and IFU artwork', 'com'],
    ['Close CAPAs and non-conformances', 'qua']
  ],
  P5: [
    ['Complete the launch build and safety stock', 'sc'],
    ['Certify the field force and complete training', 'com'],
    ['File country registrations', 'reg'],
    ['Secure VAC approvals and reimbursement', 'ma'],
    ['Sign distribution and 3PL agreements', 'sc']
  ],
  P6: [
    ['Activate the post-market surveillance plan', 'pm'],
    ['Stand up complaint handling and vigilance', 'pm'],
    ['Release the first production lots', 'mfg'],
    ['Complete the BAU handover', 'gov']
  ]
};

const PHASE_ORDER = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
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
/* Preserve VARIPULSE's authored 6 (they reference seed_doc_varipulse_44). */
const existingCrit = JSON.parse(readFileSync(CRIT_JSON, 'utf8'));
const varipulseCrit = existingCrit.filter(
  (c) => c.gate && c.gate.id === 'seed_gate_varipulse_g3'
);
if (varipulseCrit.length !== 6) {
  throw new Error(`Expected 6 VARIPULSE G3 criteria to preserve, found ${varipulseCrit.length}`);
}

const critOut = [...varipulseCrit];
for (const L of LAUNCHES) {
  if (L.launchId === VARIPULSE) continue; // authored, already carried through
  const tmpl = CRIT_TEMPLATE[L.next];
  const total = tmpl.length;
  // met count reflects readiness; a still-open gate keeps at least one unmet.
  let met = Math.round((L.readiness / 100) * total);
  if (met >= total) met = total - 1;
  if (met < 0) met = 0;
  const gateId = `seed_gate_${L.slug}_${L.next.toLowerCase()}`;
  tmpl.forEach(([name, reason], i) => {
    // Score the LAST `total-met` criteria unmet so the outstanding ones read as
    // the launch's live risks (matching VARIPULSE, whose sole unmet is last).
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
/* Preserve VARIPULSE's authored 107 activities verbatim. */
const existingActs = JSON.parse(readFileSync(ACT_JSON, 'utf8'));
const varipulseActs = existingActs.filter((a) => a.launch && a.launch.id === VARIPULSE);
if (varipulseActs.length !== 107) {
  throw new Error(`Expected 107 VARIPULSE activities to preserve, found ${varipulseActs.length}`);
}

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
    // post-market: steady-state, mostly complete with some in progress
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

const actOut = [...varipulseActs];
let personCursor = 0;
let autoCounter = 0;

for (const L of LAUNCHES) {
  if (L.launchId === VARIPULSE) continue;
  const curPhase = phaseIdx(L); // 1-based
  const launched = L.launchId === 'seed_launch_dualto';
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

/* ── enrich Launch.json with scope + device facts ───────────────────── */
const launches = JSON.parse(readFileSync(LAUNCH_JSON, 'utf8'));
for (const L of launches) {
  const s = SCOPE[L.id];
  if (!s) throw new Error(`No SCOPE entry for launch ${L.id}`);
  L.launchValue = s.launchValue;
  L.sterilisationMethod = s.sterilisation;
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
console.log(`GateCriterion: ${critOut.length}  (VARIPULSE preserved ${varipulseCrit.length})`);
console.log(`Activities: ${actOut.length}  (VARIPULSE preserved ${varipulseActs.length})`);
const perLaunchCrit = {};
critOut.forEach((c) => {
  const g = c.gate.id;
  perLaunchCrit[g] = perLaunchCrit[g] || { total: 0, met: 0 };
  perLaunchCrit[g].total++;
  if (c.met) perLaunchCrit[g].met++;
});
console.table(perLaunchCrit);
