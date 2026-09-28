/*
 * Reproducible generator for the Product-detail data layer, so EVERY launch's
 * drill-down page is as complete and connected as Berobenatide's.
 *
 * It writes four files, deterministically (no randomness → re-running is a
 * no-op diff):
 *   1. data/Launch/Launch.json      — augments each launch with attested scope
 *                                     fields (launch value, build units, field
 *                                     force, payer, registrations, fill-finish,
 *                                     manufacture site).
 *   2. data/Gate/Gate.json          — completes each launch's G1..G5 (+BAU where
 *                                     it ships) ladder so phases behind the
 *                                     current one read "closed" and future ones
 *                                     "pending", consistent with currentPhase.
 *   3. seed/GateCriterion/…         — criteria for each launch's ACTIVE gate
 *                                     (the one the center table shows). A late
 *                                     (amber) gate surfaces unmet criteria WITH
 *                                     an outstanding reason (the "risks"); a
 *                                     clean gate shows criteria met / in-hand
 *                                     with no risk flag. met count tracks the
 *                                     launch's readinessPct.
 *   4. seed/Activity/Activity.json  — a full Berobenatide-shaped activity board for
 *                                     every launch, statuses shifted to each
 *                                     launch's phase (closed behind, in-flight
 *                                     at, not-started ahead).
 *
 * INVARIANTS honoured:
 *   - Berobenatide (seed_launch_berobenatide_obesity) is preserved VERBATIM across gates,
 *     its 6 G3 criteria (incl. seed_gc_berobenatide_obesity_g3_sterilisation → evidence
 *     seed_doc_berobenatide_obesity_44) and its 107 authored activities (the reconciliation
 *     fixture §3.6.7–8). We only ADD scope fields to its Launch record.
 *   - Gate ids stay stable (seed_gate_<slug>_<code>) so the idempotent
 *     SrcPpmGate→Gate transform still keys correctly.
 *   - Risk profile is driven by GATE STATUS, not health, matching the manager's
 *     rule: "for the products at risk and the yellow-gate ones, the risks must
 *     appear … if the product is not at risk, no item should appear at risk."
 *
 * RUN: node scripts/gen-launch-detail.mjs   (from the jJDemo package root)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const P_LAUNCH = join(ROOT, 'data', 'Launch', 'Launch.json');
const P_GATE = join(ROOT, 'data', 'Gate', 'Gate.json');
const P_CRIT = join(ROOT, 'seed', 'GateCriterion', 'GateCriterion.json');
const P_ACT = join(ROOT, 'seed', 'Activity', 'Activity.json');

const BERO_OB = 'seed_launch_berobenatide_obesity';

/* ── launch registry ─────────────────────────────────────────────── */
/*
 * slug drives the SCOPE table + activity/criteria id prefixes. gslug drives
 * GATE ids and MUST equal the launch id minus the "seed_launch_" prefix so the
 * generated gate ids EXACTLY match the pre-existing seeded gate ids
 * (seed_gate_berobenatide_osa_g4, …). Changing them would (a) create orphan
 * duplicate gates on upsert and (b) break the idempotent SrcPpmGate→Gate
 * transform, which keys on those ids. cur = phase index the launch executes.
 */
const LAUNCHES = [
  { id: BERO_OB, slug: 'berobenatide_obesity', gslug: 'berobenatide_obesity', cur: 3, health: 'OFF_TRACK' },
  { id: 'seed_launch_berobenatide_t2d', slug: 'berobenatide_t2d', gslug: 'berobenatide_t2d', cur: 2, health: 'AT_RISK' },
  { id: 'seed_launch_sigvotatug_nsclc', slug: 'sigvotatug_nsclc', gslug: 'sigvotatug_nsclc', cur: 5, health: 'AT_RISK' },
  { id: 'seed_launch_met097_obesity', slug: 'met097_obesity', gslug: 'met097_obesity', cur: 4, health: 'ON_PLAN' },
  { id: 'seed_launch_berobenatide_knee_oa', slug: 'berobenatide_knee_oa', gslug: 'berobenatide_knee_oa', cur: 5, health: 'ON_PLAN' },
  { id: 'seed_launch_berobenatide_osa', slug: 'berobenatide_osa', gslug: 'berobenatide_osa', cur: 4, health: 'AT_RISK' },
  { id: 'seed_launch_atirmociclib_mbc', slug: 'atirmociclib_mbc', gslug: 'atirmociclib_mbc', cur: 6, health: 'LAUNCHED' },
  { id: 'seed_launch_pf3945_obesity', slug: 'pf3945_obesity', gslug: 'pf3945_obesity', cur: 1, health: 'PRE_MARKET' },
  { id: 'seed_launch_pf08634404_crc', slug: 'pf08634404_crc', gslug: 'pf08634404_crc', cur: 3, health: 'ON_PLAN' },
];
const BY_ID = Object.fromEntries(LAUNCHES.map((l) => [l.id, l]));

/* attested per-launch launch scope (device-appropriate, hand-set). */
const SCOPE = {
  berobenatide_obesity: { launchValue: 96000000, launchBuildUnits: 4200, fieldForceCertified: 62, fieldForceTotal: 78, vacApprovalsFiled: 9, vacApprovalsTotal: 22, registrationsFiled: 11, registrationsTotal: 14, fillFinishRoute: 'EO', manufactureSite: 'Irvine + CMO' },
  berobenatide_t2d: { launchValue: 42000000, launchBuildUnits: 3100, fieldForceCertified: 40, fieldForceTotal: 60, vacApprovalsFiled: 6, vacApprovalsTotal: 20, registrationsFiled: 8, registrationsTotal: 14, fillFinishRoute: 'EO', manufactureSite: 'Irvine + CMO' },
  sigvotatug_nsclc: { launchValue: 55000000, launchBuildUnits: 5200, fieldForceCertified: 55, fieldForceTotal: 70, vacApprovalsFiled: 12, vacApprovalsTotal: 24, registrationsFiled: 12, registrationsTotal: 14, fillFinishRoute: 'Gamma', manufactureSite: 'Galway' },
  met097_obesity: { launchValue: 120000000, launchBuildUnits: 900, fieldForceCertified: 70, fieldForceTotal: 80, vacApprovalsFiled: 15, vacApprovalsTotal: 28, registrationsFiled: 6, registrationsTotal: 8, fillFinishRoute: 'N/A (capital)', manufactureSite: 'Danvers' },
  berobenatide_knee_oa: { launchValue: 88000000, launchBuildUnits: 6400, fieldForceCertified: 66, fieldForceTotal: 72, vacApprovalsFiled: 18, vacApprovalsTotal: 26, registrationsFiled: 5, registrationsTotal: 6, fillFinishRoute: 'e-beam', manufactureSite: 'Santa Clara' },
  berobenatide_osa: { launchValue: 74000000, launchBuildUnits: 8800, fieldForceCertified: 48, fieldForceTotal: 90, vacApprovalsFiled: 14, vacApprovalsTotal: 30, registrationsFiled: 9, registrationsTotal: 14, fillFinishRoute: 'EO', manufactureSite: 'Cincinnati + CMO' },
  atirmociclib_mbc: { launchValue: 210000000, launchBuildUnits: 320, fieldForceCertified: 88, fieldForceTotal: 88, vacApprovalsFiled: 26, vacApprovalsTotal: 26, registrationsFiled: 14, registrationsTotal: 14, fillFinishRoute: 'N/A (capital)', manufactureSite: 'Cincinnati' },
  pf3945_obesity: { launchValue: 260000000, launchBuildUnits: 40, fieldForceCertified: 20, fieldForceTotal: 40, vacApprovalsFiled: 4, vacApprovalsTotal: 18, registrationsFiled: 3, registrationsTotal: 12, fillFinishRoute: 'N/A (capital)', manufactureSite: 'Santa Clara' },
  pf08634404_crc: { launchValue: 64000000, launchBuildUnits: 12000, fieldForceCertified: 44, fieldForceTotal: 58, vacApprovalsFiled: 10, vacApprovalsTotal: 22, registrationsFiled: 9, registrationsTotal: 14, fillFinishRoute: 'Autoclave', manufactureSite: 'Groningen' },
};

/* ── gate metadata ───────────────────────────────────────────────── */
const GATE_META = {
  G1: { name: 'NPI Readiness Gate', phase: 'seed_phase_p1', idx: 1 },
  G2: { name: 'CMC Lock', phase: 'seed_phase_p2', idx: 2 },
  G3: { name: 'Submission Commit', phase: 'seed_phase_p3', idx: 3 },
  G4: { name: 'Approval / Marketing Authorisation', phase: 'seed_phase_p4', idx: 4 },
  G5: { name: 'Launch Go / No-Go — First Ship', phase: 'seed_phase_p5', idx: 5 },
  BAU: { name: 'BAU handover', phase: 'seed_phase_p6', idx: 6 },
};
function activeCode(cur) { return cur === 6 ? 'BAU' : 'G' + cur; }

/*
 * Authored gate states — the hand-set slip/late narrative for each launch's
 * ACTIVE gate (and other authored gates), keyed "slug|code". These are the
 * source of truth so re-running never loses a late gate to file drift. Missing
 * gates are generated as clean (ok if behind the current phase, no if ahead).
 */
const AUTHORED = {
  'berobenatide_obesity|G1': { status: 'ok', baselineDate: '2024-09-24', forecastDate: '2024-09-24', slipDays: 0 },
  'berobenatide_obesity|G2': { status: 'ok', baselineDate: '2026-06-19', forecastDate: '2026-06-19', slipDays: 0 },
  'berobenatide_obesity|G3': { status: 'late', baselineDate: '2026-11-04', forecastDate: '2026-12-21', slipDays: 47 },
  'berobenatide_obesity|G4': { status: 'no', baselineDate: '2027-05-18', forecastDate: '2027-05-18', slipDays: 0 },
  'berobenatide_obesity|G5': { status: 'no', baselineDate: '2027-06-29', forecastDate: '2027-06-29', slipDays: 0 },
  'berobenatide_t2d|G2': { status: 'late', baselineDate: '2026-09-16', forecastDate: '2026-09-30', slipDays: 14 },
  'berobenatide_t2d|G3': { status: 'no', baselineDate: '2027-03-15', forecastDate: '2027-03-15', slipDays: 0 },
  'berobenatide_t2d|G4': { status: 'no', baselineDate: '2027-08-15', forecastDate: '2027-08-15', slipDays: 0 },
  'sigvotatug_nsclc|G5': { status: 'late', baselineDate: '2026-09-17', forecastDate: '2026-09-26', slipDays: 9 },
  'sigvotatug_nsclc|BAU': { status: 'no', baselineDate: '2026-10-30', forecastDate: '2026-10-30', slipDays: 0 },
  'berobenatide_osa|G4': { status: 'late', baselineDate: '2026-10-12', forecastDate: '2026-11-02', slipDays: 21 },
  'berobenatide_osa|G5': { status: 'no', baselineDate: '2026-12-14', forecastDate: '2026-12-14', slipDays: 0 },
  'pf08634404_crc|G3': { status: 'late', baselineDate: '2026-11-03', forecastDate: '2026-11-14', slipDays: 11 },
  'pf08634404_crc|G4': { status: 'no', baselineDate: '2027-06-15', forecastDate: '2027-06-15', slipDays: 0 },
  'atirmociclib_mbc|G5': { status: 'ok', baselineDate: '2026-08-12', forecastDate: '2026-08-12', slipDays: 0 },
  'atirmociclib_mbc|BAU': { status: 'no', baselineDate: '2026-10-30', forecastDate: '2026-10-30', slipDays: 0 },
};

/* ── criteria templates per gate code ────────────────────────────── */
const CRITERIA = {
  G1: ['Business case approved', 'Development & CMC Plan baselined', 'Regulatory strategy and pathway defined', 'Project RACI and budget approved', 'Feasibility risk assessment complete', 'Clinical strategy outlined'],
  G2: ['CMC package locked', 'Design FMEA complete', 'Requirements traceability established', 'Design review minutes signed off', 'Risk management file drafted', 'Verification protocols approved'],
  G3: ['Analytical verification complete', 'Process validation complete', 'Clinical study report approved', 'CTD Module 3 quality dossier complete', 'Risk management file current', 'Process Performance Qualification report approved'],
  G4: ['Regulatory submission accepted for review', 'Design transfer to manufacturing complete', 'Process validation (IQ/OQ/PQ) complete', 'CHMP rapporteur / FDA queries closed', 'Labelling and IFU finalised', 'QMS audit readiness confirmed'],
  G5: ['Marketing Authorisation received', 'Launch build complete and released', 'Affiliate field teams trained and certified', 'Distribution and 3PL agreements signed', 'P&T formulary committee approvals secured', 'Pharmacovigilance & post-launch plan in place'],
  BAU: ['Launch KPIs meeting target', 'Complaint handling in steady state', 'PMCF plan active', 'Supply chain at safety stock', 'Commercial ramp on plan', 'Programme handed to BAU owner'],
};
/* short outstanding reasons keyed by "<code>#<criterion index>" for late gates. */
function reasonFor(code, name) {
  const R = {
    'Process Performance Qualification report approved': 'Fill-finish validation slot slipped; report awaiting site data',
    'CTD Module 3 quality dossier complete': 'Technical documentation at 96%; two annexes outstanding with the CHMP rapporteur',
    'CMC Lock': 'Target product profile not yet frozen; late change request under review',
    'CMC package locked': 'Late change request under review; freeze held pending disposition',
    'Verification protocols approved': 'Two verification protocols awaiting sign-off',
    'Regulatory submission accepted for review': 'Submission returned with deficiency questions; response in preparation',
    'CHMP rapporteur / FDA queries closed': 'Open CHMP rapporteur queries on extractables and leachables not yet closed',
    'Process validation (IQ/OQ/PQ) complete': 'PQ run held for equipment qualification',
    'Marketing Authorisation received': 'Certificate pending — CHMP rapporteur review slot at risk',
    'Affiliate field teams trained and certified': 'Field-force certification behind plan',
    'P&T formulary committee approvals secured': 'Payer listings behind target across key accounts',
  };
  return R[name] || `${name} outstanding — action open`;
}

/* ── deterministic helpers ───────────────────────────────────────── */
function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0x7fffffff;
  return h;
}
function isoDate(d) {
  return d.toISOString().slice(0, 10);
}
function addDays(baseIso, days) {
  const d = new Date(baseIso.slice(0, 10) + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

/* ════════════════════════ 1. LAUNCH SCOPE ═══════════════════════ */
const launches = JSON.parse(readFileSync(P_LAUNCH, 'utf8'));
for (const l of launches) {
  const meta = BY_ID[l.id];
  if (!meta) continue;
  Object.assign(l, SCOPE[meta.slug]);
}
writeFileSync(P_LAUNCH, JSON.stringify(launches, null, 2) + '\n');
const shipById = Object.fromEntries(launches.map((l) => [l.id, l.firstShipDate]));
const readinessById = Object.fromEntries(launches.map((l) => [l.id, l.readinessPct]));

/* ════════════════════════ 2. GATE LADDER ════════════════════════ */
const outGates = [];
const gateByKey = {};
for (const L of LAUNCHES) {
  const codes = ['G1', 'G2', 'G3', 'G4', 'G5'].concat(L.cur >= 5 ? ['BAU'] : []);
  const ship = shipById[L.id];
  for (const code of codes) {
    const meta = GATE_META[code];
    const authored = AUTHORED[`${L.slug}|${code}`];
    let status, baselineDate, forecastDate, slipDays;
    if (authored) {
      // hand-set narrative gate (late/slip preserved verbatim)
      status = authored.status;
      baselineDate = authored.baselineDate;
      forecastDate = authored.forecastDate;
      slipDays = authored.slipDays;
    } else {
      // generated: closed behind current phase, pending ahead. Dates spaced
      // ~160d/phase around the launch's first-ship date.
      status = meta.idx < L.cur ? 'ok' : 'no';
      const offset = (meta.idx - L.cur) * 160;
      baselineDate = addDays(ship, offset);
      forecastDate = baselineDate;
      slipDays = 0;
    }
    const g = {
      id: `seed_gate_${L.gslug}_${code.toLowerCase()}`,
      code,
      name: meta.name,
      baselineDate,
      forecastDate,
      slipDays,
      status,
      launch: { id: L.id },
      phase: { id: meta.phase },
    };
    outGates.push(g);
    gateByKey[`${L.id}|${code}`] = g;
  }
}
outGates.sort((a, b) => {
  const la = a.launch.id, lb = b.launch.id;
  if (la !== lb) return la < lb ? -1 : 1;
  return GATE_META[a.code].idx - GATE_META[b.code].idx;
});
writeFileSync(P_GATE, JSON.stringify(outGates, null, 2) + '\n');

/* ════════════════════════ 3. GATE CRITERIA ══════════════════════ */
const existingCrit = JSON.parse(readFileSync(P_CRIT, 'utf8'));
/* preserve Berobenatide's 6 authored criteria verbatim (incl. evidence link). */
const berobenatide_obesityCrit = existingCrit.filter((c) => c.gate && c.gate.id === 'seed_gate_berobenatide_obesity_g3');
if (berobenatide_obesityCrit.length !== 6) {
  throw new Error(`Expected 6 Berobenatide criteria to preserve, found ${berobenatide_obesityCrit.length}`);
}
const outCrit = [...berobenatide_obesityCrit];

for (const L of LAUNCHES) {
  if (L.slug === 'berobenatide_obesity') continue; // preserved above
  const code = activeCode(L.cur);
  const gateId = gateByKey[`${L.id}|${code}`].id;
  const gate = outGates.find((g) => g.id === gateId);
  const late = gate && gate.status === 'late';
  const names = CRITERIA[code];
  const readiness = readinessById[L.id] != null ? readinessById[L.id] : 80;
  let metCount = Math.round((readiness / 100) * names.length);
  if (metCount > names.length) metCount = names.length;
  // A late (amber) gate must surface at least one unmet criterion (the risk).
  if (late && metCount >= names.length) metCount = names.length - 1;
  names.forEach((name, i) => {
    const met = i < metCount;
    const row = {
      id: `seed_gc_${L.slug}_${code.toLowerCase()}_${i + 1}`,
      name,
      met,
      gate: { id: gateId },
    };
    // Only a late gate's unmet criteria are risks (carry an outstanding reason).
    // A clean/pending gate's unmet criteria are simply in progress — no flag.
    if (!met && late) row.outstandingReason = reasonFor(code, name);
    outCrit.push(row);
  });
}
writeFileSync(P_CRIT, JSON.stringify(outCrit, null, 2) + '\n');

/* ════════════════════════ 4. ACTIVITIES ═════════════════════════ */
const existingActs = JSON.parse(readFileSync(P_ACT, 'utf8'));
const berobenatide_obesityActs = existingActs.filter((a) => a.launch && a.launch.id === BERO_OB);
if (berobenatide_obesityActs.length !== 107) {
  throw new Error(`Expected 107 Berobenatide activities to preserve, found ${berobenatide_obesityActs.length}`);
}
const outActs = [...berobenatide_obesityActs];

const PHASE_IDX = { seed_phase_p1: 1, seed_phase_p2: 2, seed_phase_p3: 3, seed_phase_p4: 4, seed_phase_p5: 5, seed_phase_p6: 6 };
const STATUS_TEXT = { ok: 'Complete', run: 'In progress', rk: 'At risk', late: 'Late', no: 'Not started' };

function deriveStatus(L, phaseIdx, seed, gateLate) {
  if (phaseIdx < L.cur) return 'ok';
  if (phaseIdx > L.cur) return 'no';
  // current phase
  if (L.health === 'LAUNCHED') return 'ok';
  const base = seed % 4 === 0 ? 'run' : 'ok';
  if (gateLate) {
    if (seed % 11 === 0) return 'late';
    if (seed % 6 === 0) return 'rk';
  }
  return base;
}
function detailFor(statusCode, seed) {
  if (statusCode === 'ok') return 'complete';
  if (statusCode === 'run') return 'in progress';
  if (statusCode === 'rk') return 'holding for input';
  if (statusCode === 'late') return `${7 + (seed % 40)} days late`;
  return '';
}

for (const L of LAUNCHES) {
  if (L.slug === 'berobenatide_obesity') continue;
  const activeGate = gateByKey[`${L.id}|${activeCode(L.cur)}`];
  const gateLate = activeGate && activeGate.status === 'late';
  for (const tmpl of berobenatide_obesityActs) {
    const phaseId = tmpl.phase ? tmpl.phase.id : null;
    const phaseIdx = phaseId ? PHASE_IDX[phaseId] : 0;
    const id = tmpl.id.replace('berobenatide_obesity', L.slug);
    const seed = hash(id);
    const sc = deriveStatus(L, phaseIdx, seed, gateLate);
    outActs.push({
      id,
      name: tmpl.name,
      status: STATUS_TEXT[sc],
      statusCode: sc,
      detail: detailFor(sc, seed),
      phase: tmpl.phase,
      domain: tmpl.domain,
      launch: { id: L.id },
      autonomyClass: tmpl.autonomyClass,
      owningPerson: tmpl.owningPerson || null,
      owningAgent: tmpl.owningAgent || null,
    });
  }
}
writeFileSync(P_ACT, JSON.stringify(outActs, null, 2) + '\n');

/* ── summary ── */
console.log(`Launches: ${launches.length} (scope fields added)`);
console.log(`Gates: ${outGates.length}`);
console.log(`Criteria: ${outCrit.length}`);
console.log(`Activities: ${outActs.length} (berobenatide_obesity ${berobenatide_obesityActs.length} preserved)`);
const critByLaunch = {};
for (const L of LAUNCHES) {
  const code = activeCode(L.cur);
  const rows = outCrit.filter((c) => c.gate.id.includes(`_${L.slug}_`) || (L.slug === 'berobenatide_obesity' && c.gate.id === 'seed_gate_berobenatide_obesity_g3'));
  const met = rows.filter((r) => r.met).length;
  const risks = rows.filter((r) => r.outstandingReason).length;
  critByLaunch[L.slug] = `${code}: ${met}/${rows.length} met, ${risks} risk(s)`;
}
console.table(critByLaunch);
