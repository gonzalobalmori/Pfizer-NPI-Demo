/* ─────────────────────────────────────────────────────────────────────────
 * gen_sources.mjs — synthetic SOURCE-SYSTEM extracts for the J&J MedTech NPI
 * Launch Control demo (Build brief 2, Item 3).
 *
 * WHAT THIS IS. A re-runnable, seeded generator that emits files shaped like
 * real extracts from the eleven source systems (SAP, Veeva Vault QMS/RIM,
 * LabWare LIMS, Opcenter MES, Planisware PPM, Ariba/SRM, D&B, Workday, the
 * steriliser booking portal) plus the supplier crosswalk. These are the LEFT
 * half of the architecture: source → canonical → transform → ontology.
 *
 * DESIGN RULE (why this protects the two guarantees the client cares about):
 *   1. "The data looks real."  Files carry the SOURCE system's own column
 *      names, key formats and padding (SAP MATNR/LIFNR, Veeva *__v/*__c object
 *      + field names, LIMS sample/method refs, MES SPC parameters). If a file
 *      could be mistaken for a screenshot of the ontology, it is wrong — the
 *      mapping is the thing being demonstrated, so the source shape is
 *      deliberately different from the target.
 *   2. "The NPI-0417 thread keeps working."  Every anchor-critical row is
 *      DERIVED FROM THE ALREADY-SEEDED ONTOLOGY JSON (jJDemo/seed + jJDemo/data),
 *      so it reconciles back to the screens by construction. The QMS comment
 *      extract in particular is generated verbatim from the four seeded
 *      Comment records, so a load reproduces the escalation thread byte-for-byte.
 *
 * Bounded dirt (§4.4) and the three planted crosswalk mismatches (§4.3) are
 * layered on last, tagged in the run log, so DQ has something real to catch on
 * stage without a load ever failing.
 *
 * Demo clock: Friday 11 September 2026, 08:42 CET (LGNOW).
 * Run:  node gen_sources.mjs
 * Out:  jJDemo/sources/<system>/<FEED>_<date>[_HH].<ext>  (+ _MANIFEST.json)
 * ───────────────────────────────────────────────────────────────────────── */

import fs from 'fs';
import path from 'path';

const ROOT = '/usr/workspace/jJDemo';
const SEED = path.join(ROOT, 'seed');
const DATA = path.join(ROOT, 'data');
const OUT = path.join(ROOT, 'sources');
const LGNOW = '2026-09-11'; // demo "today"; portal poll stamped 08:00 CET

/* ── deterministic RNG (seeded) so re-runs are byte-identical ────────────── */
let _seed = 0x1a2b3c4d;
function rng() { _seed = (_seed * 1103515245 + 12345) & 0x7fffffff; return _seed / 0x7fffffff; }
function ri(lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }
function pick(arr) { return arr[Math.floor(rng() * arr.length)]; }

/* ── seed-JSON readers ───────────────────────────────────────────────────── */
function readType(type) {
  for (const base of [SEED, DATA]) {
    const dir = path.join(base, type);
    if (!fs.existsSync(dir)) continue;
    const rows = [];
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.json')) continue;
      const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      (Array.isArray(j) ? j : [j]).forEach((r) => rows.push(r));
    }
    if (rows.length) return rows;
  }
  return [];
}

/* ── writers ─────────────────────────────────────────────────────────────── */
const MANIFEST = [];
function feedName(base, dated = true, hour = null) {
  const d = LGNOW.replace(/-/g, '');
  return `${base}_${d}${hour != null ? '_' + String(hour).padStart(2, '0') : ''}`;
}
function writeCsv(system, feed, rows, headerOrder, opts = {}) {
  const dir = path.join(OUT, system);
  fs.mkdirSync(dir, { recursive: true });
  const cols = headerOrder;
  const esc = (v) => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [cols.join(',')];
  rows.forEach((r) => lines.push(cols.map((c) => esc(r[c])).join(',')));
  const fname = feed + '.csv';
  fs.writeFileSync(path.join(dir, fname), lines.join('\n') + '\n');
  MANIFEST.push({ system, feed: opts.feedCode || feed, file: `${system}/${fname}`, format: 'csv', rows: rows.length, frequency: opts.freq, arrivalWindow: opts.window, target: opts.target });
  console.log(`  ${system}/${fname}: ${rows.length} rows`);
}
function writeJson(system, feed, obj, opts = {}) {
  const dir = path.join(OUT, system);
  fs.mkdirSync(dir, { recursive: true });
  const fname = feed + '.json';
  fs.writeFileSync(path.join(dir, fname), JSON.stringify(obj, null, 2));
  const rows = Array.isArray(obj) ? obj.length : (obj.records ? obj.records.length : 1);
  MANIFEST.push({ system, feed: opts.feedCode || feed, file: `${system}/${fname}`, format: 'json', rows, frequency: opts.freq, arrivalWindow: opts.window, target: opts.target });
  console.log(`  ${system}/${fname}: ${rows} record(s)`);
}

/* ── key-format helpers (realistic source keys, §4.2) ───────────────────── */
function matnr(n) { return String(n).padStart(18, '0'); }          // SAP 18-char material
function lifnr(n) { return String(n).padStart(10, '0'); }          // SAP 10-char vendor
function gtin14(base13) {                                          // valid GTIN-14 check digit
  const d = String(base13).padStart(13, '0').split('').map(Number);
  let sum = 0;
  for (let i = 0; i < 13; i++) sum += d[i] * (i % 2 === 0 ? 3 : 1);
  return String(base13).padStart(13, '0') + String((10 - (sum % 10)) % 10);
}

const DIRT = []; // log of intentional dirt / planted mismatches (§4.4, §4.3)

console.log('Generating synthetic source extracts →', OUT);
fs.rmSync(OUT, { recursive: true, force: true });

/* ═══════════════════════════════════════════════════════════════════════════
 * Load the ontology ground truth (the RIGHT half already exists & is seeded)
 * ═══════════════════════════════════════════════════════════════════════════ */
const suppliers = readType('Supplier');
const sites = readType('Site');
const contracts = readType('ContractTerm');
const launches = readType('Launch');
const activities = readType('Activity');
const gates = readType('Gate');
const phases = readType('Phase');
const domains = readType('FunctionalDomain');
const people = readType('Person');
const markets = readType('Market');
const marketLaunches = readType('MarketLaunch');
const capas = readType('CAPA');
const findings = readType('Finding');
const comments = readType('Comment');
const criteria = readType('GateCriterion');
const bom = readType('BillOfMaterialItem');

/* ── supplier crosswalk seed (the four real supplier identities) ─────────── */
// supplierId → the native keys each source system knows it by (§2 key-resolution)
const XWALK = {
  seed_supplier_steris: { sap: '0001007731', ariba: 'AN01-STERIS-VENLO', qms: 'SUP-STERIS-VNL', cert: 'Steris Venlo', duns: '40-123-8890' },
  seed_supplier_sterigenics: { sap: '0001007988', ariba: 'AN02-STERIGENICS-GR', qms: 'SUP-STG-GR', cert: 'Sterigenics Grand Rapids', duns: '07-836-4421' },
  seed_supplier_heraeus: { sap: '0001004412', ariba: 'AN05-HERAEUS-MC', qms: 'SUP-HRS-MC', cert: 'Heraeus Medical Components', duns: '31-778-2200' },
  seed_supplier_bsi: { sap: '0001009003', ariba: 'AN09-BSI-NB', qms: 'SUP-BSI-NB', cert: 'BSI Group', duns: '21-004-1177' },
};

/* ═══════════════════════════════════════════════════════════════════════════
 * 4 · ERP — SAP S/4HANA  (vendor master, material master, revenue plan)
 * ═══════════════════════════════════════════════════════════════════════════ */
// LFA1 vendor master: SAP column names, zero-padded LIFNR. Real suppliers first,
// then filler vendors so the extract looks enterprise (~60 rows, §4.6).
const sapVendors = [];
suppliers.forEach((s) => {
  const x = XWALK[s.id];
  sapVendors.push({
    LIFNR: x.sap, NAME1: s.name, LAND1: s.name.includes('Venlo') ? 'NL' : s.name.includes('Grand Rapids') ? 'US' : s.name.includes('Neuss') || s.name.includes('BSI') ? 'DE' : 'DE',
    KTOKK: 'LIEF', SPERR: '', LOEVM: '', ERDAT: '20180312', WAERS: 'EUR',
    STCEG: x.sap === '0001007988' ? 'US' : 'DE' + ri(100000000, 999999999),
  });
});
const VNAMES = ['Gerresheimer AG', 'Freudenberg Medical', 'Nordson MEDICAL', 'Tekni-Plex', 'Trelleborg Sealing', 'Nolato Medical', 'Datwyler Pharma', 'Raumedic AG', 'Zeus Industrial', 'Saint-Gobain Perf.', 'Vernay Labs', 'Kimball Electronics', 'Phillips-Medisize', 'Cadence Inc', 'MedPlast', 'Vante', 'Genesis Plastics', 'Spectrum Plastics', 'MW Industries', 'Micro-Coax'];
for (let i = 0; i < 52; i++) {
  sapVendors.push({
    LIFNR: lifnr(1010000 + i * 7), NAME1: VNAMES[i % VNAMES.length] + (i >= VNAMES.length ? ' ' + (2 + Math.floor(i / VNAMES.length)) : ''),
    LAND1: pick(['DE', 'US', 'IE', 'NL', 'CH', 'FR']), KTOKK: 'LIEF', SPERR: '', LOEVM: i === 40 ? 'X' : '',
    ERDAT: '201' + ri(4, 9) + String(ri(1, 12)).padStart(2, '0') + String(ri(1, 28)).padStart(2, '0'), WAERS: 'EUR', STCEG: '',
  });
}
// §4.4 dirt: one vendor key with trailing whitespace (crosswalk must trim)
sapVendors[1].LIFNR = sapVendors[1].LIFNR + ' ';
DIRT.push('SAP LFA1: LIFNR ' + XWALK.seed_supplier_sterigenics.sap + ' emitted with trailing whitespace (DQ: trim + still resolve).');
// §4.4 dirt: one duplicate row
sapVendors.push({ ...sapVendors[3] });
DIRT.push('SAP LFA1: one duplicate vendor row (DQ: de-dupe on LIFNR).');
writeCsv('sap', feedName('SAP_LFA1_VENDOR'), sapVendors, ['LIFNR', 'NAME1', 'LAND1', 'KTOKK', 'SPERR', 'LOEVM', 'ERDAT', 'WAERS', 'STCEG'],
  { feedCode: 'SAP_LFA1', freq: 'daily', window: '02:00 CET', target: 'Supplier (via crosswalk)' });

// MARA/MAKT material master — device roots + BOM children (~800 lines total; here the master heads)
const sapMaterials = [];
const LAUNCH_MATROOT = {};
launches.forEach((l, i) => {
  const root = 100200 + i;
  LAUNCH_MATROOT[l.id] = root;
  sapMaterials.push({
    MATNR: matnr(root), MAKTX: l.deviceName, MTART: 'FERT', MEINS: 'EA', WERKS: pick(['DE10', 'IE20', 'US30']),
    MATKL: 'MED-DEV', PRDHA: l.deviceClass.replace(/\s/g, ''), LVORM: '', MSTAE: l.healthStatus === 'LAUNCHED' ? '20' : '10',
  });
});
writeCsv('sap', feedName('SAP_MARA_MATERIAL'), sapMaterials, ['MATNR', 'MAKTX', 'MTART', 'MEINS', 'WERKS', 'MATKL', 'PRDHA', 'LVORM', 'MSTAE'],
  { feedCode: 'SAP_MARA', freq: 'daily', window: '02:00 CET', target: 'Launch / BillOfMaterialItem' });

// Revenue plan (profit-centre × period) — the SOURCE of exposure figures.
// NB (Item 2 correction): €-at-risk is DERIVED downstream (revenue plan × slipped
// gate), NOT stored from SAP. This file carries the revenue plan only.
const sapRev = [];
launches.forEach((l, i) => {
  if (!l.revenueAtRisk) return;
  // spread the at-risk revenue across 4 quarters as a plausible plan
  const q = ['2027Q1', '2027Q2', '2027Q3', '2027Q4'];
  const annual = Math.round(l.revenueAtRisk * 2.3); // plan > at-risk slice
  q.forEach((qq, k) => sapRev.push({
    PRCTR: 'PC' + (4100 + i), MATNR: matnr(LAUNCH_MATROOT[l.id]), GJAHR: '2027', PERIO: qq,
    WRTTP: '1', REVENUE_EUR: Math.round(annual / 4) + (k === 1 ? ri(-5000, 5000) : 0), CURRENCY: 'EUR',
  }));
});
writeCsv('sap', feedName('SAP_REVPLAN'), sapRev, ['PRCTR', 'MATNR', 'GJAHR', 'PERIO', 'WRTTP', 'REVENUE_EUR', 'CURRENCY'],
  { feedCode: 'SAP_REVPLAN', freq: 'daily', window: '02:30 CET', target: 'derived exposure (metrics layer)' });

/* ═══════════════════════════════════════════════════════════════════════════
 * 7 · SRM — Ariba supplier + contract terms + D&B risk
 * ═══════════════════════════════════════════════════════════════════════════ */
// Ariba supplier records (its own SupplierId namespace)
const aribaSuppliers = suppliers.map((s) => {
  const x = XWALK[s.id];
  const site = sites.find((si) => si.supplier && si.supplier.id === s.id);
  return {
    supplier_id: x.ariba, supplier_name: s.name, qualification_status: s.approvalStatus === 'APPROVED' ? 'Qualified' : s.approvalStatus === 'CONDITIONAL' ? 'Conditional' : 'Unqualified',
    audit_valid_to: s.auditValidUntil, asl_flag: 'Y', capacity_available_from: site ? site.capacityAvailableFrom : '',
    single_source: s.singleSourceFlag ? 'Y' : 'N', category: 'Sterilisation & Contract Mfg',
  };
});
writeJson('ariba', feedName('ARIBA_SUPPLIER'), aribaSuppliers,
  { feedCode: 'ARIBA_SUPPLIER', freq: 'weekly', window: 'Mon 04:00 CET', target: 'Supplier / QualifiedProcess (via crosswalk)' });

// SRM contract terms — carries the ROOT CAUSE (clause 7.3, committed vs non-committed)
const srmContracts = [];
contracts.forEach((c) => {
  const x = XWALK[c.supplier.id];
  srmContracts.push({
    contract_id: c.id.replace('seed_contract_', 'CW-').toUpperCase(), supplier_id: x ? x.ariba : c.supplier.id,
    clause_ref: c.clauseRef.replace(/^Master agreement /, '').replace(/^Proposed /, ''),
    capacity_commitment: c.capacityCommitment, notice_days: c.noticePeriodDays,
    penalty_available: c.penaltyAvailable ? 'Y' : 'N', effective_from: '2024-01-01', status: c.clauseRef.startsWith('Proposed') ? 'Draft' : 'Active',
    note: c.summary,
  });
});
// filler contract terms so the extract has ~40 rows
for (let i = 0; i < 38; i++) {
  srmContracts.push({
    contract_id: 'CW-' + (5000 + i), supplier_id: pick(aribaSuppliers).supplier_id,
    clause_ref: pick(['clause 4.1', 'clause 5.2', 'clause 6.6', 'clause 9.1', 'clause 12.3']),
    capacity_commitment: pick(['COMMITTED', 'NON_COMMITTED']), notice_days: pick([30, 60, 90]),
    penalty_available: pick(['Y', 'N']), effective_from: '202' + ri(2, 5) + '-0' + ri(1, 9) + '-1' + ri(0, 5), status: 'Active', note: '',
  });
}
writeCsv('srm', feedName('SRM_CONTRACT_TERM'), srmContracts, ['contract_id', 'supplier_id', 'clause_ref', 'capacity_commitment', 'notice_days', 'penalty_available', 'effective_from', 'status', 'note'],
  { feedCode: 'SRM_CONTRACT', freq: 'weekly + event', window: 'Mon 04:00 CET', target: 'ContractTerm (via crosswalk)' });

// D&B risk ratings — keyed by DUNS
const dnb = [];
suppliers.forEach((s) => {
  const x = XWALK[s.id];
  // §4.3 planted mismatch #3: Heraeus has NO D&B match (partial resolution)
  if (s.id === 'seed_supplier_heraeus') { DIRT.push('D&B: Heraeus Medical Components intentionally has NO DUNS match (partial resolution — resolves as Supplier, flags missing risk rating).'); return; }
  dnb.push({
    duns_number: x.duns, business_name: x.cert, risk_score: s.financialRiskRating === 'Low' ? ri(8, 20) : s.financialRiskRating === 'High' ? ri(70, 88) : ri(35, 55),
    risk_band: s.financialRiskRating, country: x.sap === '0001007988' ? 'US' : 'NL', as_of: '2026-09-05',
  });
});
writeCsv('dnb', feedName('DNB_RISK_RATING'), dnb, ['duns_number', 'business_name', 'risk_score', 'risk_band', 'country', 'as_of'],
  { feedCode: 'DNB_RISK', freq: 'event', window: 'on rating change', target: 'Supplier.financialRiskRating (via crosswalk)' });

/* ═══════════════════════════════════════════════════════════════════════════
 * SUPPLIER CROSSWALK — the reference data that resolves the four identities
 * (with the three planted mismatches so the exception path is demonstrable)
 * ═══════════════════════════════════════════════════════════════════════════ */
const xrows = [];
suppliers.forEach((s) => {
  const x = XWALK[s.id];
  let cert = x.cert;
  // §4.3 planted mismatch #2: certificate name for Sterigenics disagrees with Ariba
  if (s.id === 'seed_supplier_sterigenics') { cert = 'Sterigenics US LLC'; DIRT.push('Crosswalk: Sterigenics certificate name "Sterigenics US LLC" ≠ Ariba "Sterigenics Grand Rapids" (fuzzy-name miss → manual crosswalk entry resolves on stage).'); }
  xrows.push({
    supplier_id: s.id, canonical_name: s.name, sap_vendor: x.sap, ariba_supplier_id: x.ariba,
    qms_audit_subject: x.qms, certificate_name: cert, duns_number: s.id === 'seed_supplier_heraeus' ? '' : x.duns,
    resolution_state: s.id === 'seed_supplier_sterigenics' ? 'MANUAL' : s.id === 'seed_supplier_heraeus' ? 'PARTIAL' : 'AUTO',
  });
});
writeCsv('reference', feedName('SUPPLIER_CROSSWALK', false), xrows, ['supplier_id', 'canonical_name', 'sap_vendor', 'ariba_supplier_id', 'qms_audit_subject', 'certificate_name', 'duns_number', 'resolution_state'],
  { feedCode: 'SUPPLIER_XWALK', freq: 'reference', window: 'maintained', target: 'Supplier identity resolution' });

/* ═══════════════════════════════════════════════════════════════════════════
 * 2 · QMS — Veeva Vault QMS (CAPA, audit, and the escalation-thread comments)
 * ═══════════════════════════════════════════════════════════════════════════ */
// CAPA records — Veeva object/field names (*__v / *__c)
const qmsCapa = capas.map((c) => {
  const f = findings.find((ff) => c.finding && ff.id === c.finding.id);
  return {
    'id': c.id.replace('seed_capa_', 'V0Q000000'), 'document_number__v': c.capaId, 'name__v': 'EO sterilisation capacity loss — ' + (f ? f.displayId : ''),
    'state__v': c.status === 'OPEN' ? 'Open' : c.status === 'CONTAINED' ? 'Containment Complete' : c.status,
    'quality_event_type__c': 'CAPA', 'process_area__c': c.openedAgainstProcess, 'initiated_by__c': c.openedBy,
    'initiated_date__c': (c.openedAt || '').slice(0, 10), 'containment_action__c': c.containmentAction || '',
    'corrective_action__c': c.correctiveAction || '', 'effectiveness_due__c': c.effectivenessDueDate || '',
    'npi_ref__c': f ? f.displayId : '',
  };
});
writeJson('veeva_qms', feedName('QMS_CAPA'), { vault: 'jnjmedtech-qms.veevavault.com', object: 'capa__v', extracted_at: LGNOW + 'T06:15:00Z', records: qmsCapa },
  { feedCode: 'QMS_CAPA', freq: 'near-real-time (micro-batch 15 min)', window: 'continuous', target: 'CAPA / Finding' });

// Audit records — audit subject is the QMS-native supplier key
const qmsAudit = suppliers.map((s) => {
  const x = XWALK[s.id];
  return {
    'id': 'AUD-' + x.qms, 'audit_subject__c': x.qms, 'supplier_name__c': s.name,
    'audit_type__c': 'Supplier Quality Audit', 'result__c': s.approvalStatus === 'APPROVED' ? 'Pass' : 'Pass with observations',
    'valid_to__c': s.auditValidUntil, 'last_audit_date__c': s.auditValidUntil.replace(/^20(\d\d)/, (m, y) => '20' + (parseInt(y, 10) - 3)),
  };
});
writeJson('veeva_qms', feedName('QMS_AUDIT'), { vault: 'jnjmedtech-qms.veevavault.com', object: 'audit__v', extracted_at: LGNOW + 'T06:15:00Z', records: qmsAudit },
  { feedCode: 'QMS_AUDIT', freq: 'near-real-time', window: 'continuous', target: 'Supplier audit validity (via crosswalk)' });

// COMMENTS — the escalation thread. Generated VERBATIM from the seeded Comment
// records so the transform lands byte-identical text. THIS is what keeps the
// #thr-417 thread intact after any load (guarantee #2).
const t417 = comments.filter((c) => c.decision && c.decision.id === 'seed_decision_417')
  .sort((a, b) => (a.commentedAt < b.commentedAt ? -1 : 1));
const qmsComments = t417.map((c, i) => ({
  'id': 'CMT-0148-' + String(i + 1).padStart(2, '0'), 'capa_number__v': 'CAPA-2026-0148',
  'author__c': c.author, 'author_role__c': c.authorRole, 'comment_ts__c': c.commentedAt,
  'is_system_check__c': c.isAutomatedCheck ? 'Y' : 'N', 'sources_read__c': c.sourcesRead || '',
  'body__c': c.body,
}));
writeJson('veeva_qms', feedName('QMS_COMMENT'), { vault: 'jnjmedtech-qms.veevavault.com', object: 'quality_comment__c', extracted_at: LGNOW + 'T08:30:00Z', records: qmsComments },
  { feedCode: 'QMS_COMMENT', freq: 'near-real-time', window: 'continuous', target: 'Comment (NPI-0417 escalation thread — verbatim)' });

/* ═══════════════════════════════════════════════════════════════════════════
 * 3 · RIM — Veeva Vault RIM (registration, dossier section, NB interaction)
 * ═══════════════════════════════════════════════════════════════════════════ */
// Registration per market — UDI-DI as a structurally-valid GTIN-14
const rimReg = [];
let udiBase = 5001234000000;
marketLaunches.forEach((ml, i) => {
  const l = launches.find((ll) => ml.launch && ll.id === ml.launch.id);
  const m = markets.find((mm) => ml.market && mm.id === ml.market.id);
  if (!l || !m) return;
  rimReg.push({
    'registration__v': 'REG-' + (10000 + i), 'product__v': l.deviceName, 'country__v': m.code,
    'health_authority__c': (m.regulatoryBody || '').split('/')[0].trim(), 'submission_type__c': (l.regulatoryRoute || '').split('+')[0].trim(),
    'registration_state__c': ml.status === 'ok' ? 'Approved' : ml.status === 'rk' ? 'Under Review' : 'Blocked',
    'first_ship_quarter__c': ml.firstShipQuarter || '', 'udi_di__c': gtin14(udiBase++),
  });
});
writeCsv('veeva_rim', feedName('RIM_REGISTRATION'), rimReg, ['registration__v', 'product__v', 'country__v', 'health_authority__c', 'submission_type__c', 'registration_state__c', 'first_ship_quarter__c', 'udi_di__c'],
  { feedCode: 'RIM_REG', freq: 'daily', window: '03:00 CET', target: 'Market / MarketLaunch' });

// Dossier sections — the anchor: TD section 4.3 is the ONLY open section
const rimDossier = [
  { 'dossier__v': 'TD-VPG2-EU', 'product__v': 'VARIPULSE Gen 2 PFA Catheter', 'td_section__c': '4.1', 'section_title__c': 'Device description & specification', 'section_state__c': 'Complete', 'authority__c': 'BSI' },
  { 'dossier__v': 'TD-VPG2-EU', 'product__v': 'VARIPULSE Gen 2 PFA Catheter', 'td_section__c': '4.2', 'section_title__c': 'Design & manufacturing information', 'section_state__c': 'Complete', 'authority__c': 'BSI' },
  { 'dossier__v': 'TD-VPG2-EU', 'product__v': 'VARIPULSE Gen 2 PFA Catheter', 'td_section__c': '4.3', 'section_title__c': 'Sterilisation validation (ISO 11135)', 'section_state__c': 'Open', 'authority__c': 'BSI' },
  { 'dossier__v': 'TD-VPG2-EU', 'product__v': 'VARIPULSE Gen 2 PFA Catheter', 'td_section__c': '5.1', 'section_title__c': 'GSPR checklist', 'section_state__c': 'Complete', 'authority__c': 'BSI' },
  { 'dossier__v': 'TD-VPG2-EU', 'product__v': 'VARIPULSE Gen 2 PFA Catheter', 'td_section__c': '6.1', 'section_title__c': 'Clinical evaluation report', 'section_state__c': 'Complete', 'authority__c': 'BSI' },
];
writeCsv('veeva_rim', feedName('RIM_DOSSIER_SECTION'), rimDossier, ['dossier__v', 'product__v', 'td_section__c', 'section_title__c', 'section_state__c', 'authority__c'],
  { feedCode: 'RIM_DOSSIER', freq: 'daily', window: '03:00 CET', target: 'Gate criterion evidence (G3)' });

// Notified Body interactions — the BSI Q4 review window (holds at +9, not +47)
const rimNb = [
  { 'interaction_id__c': 'NB-BSI-2026-114', 'authority__c': 'BSI', 'product__v': 'VARIPULSE Gen 2 PFA Catheter', 'interaction_type__c': 'Review slot', 'window__c': '2026-Q4', 'window_close__c': '2026-11-15', 'note__c': 'Q4 review slot; next confirmed slot February 2027 (+31 days).' },
];
writeCsv('veeva_rim', feedName('RIM_NB_INTERACTION'), rimNb, ['interaction_id__c', 'authority__c', 'product__v', 'interaction_type__c', 'window__c', 'window_close__c', 'note__c'],
  { feedCode: 'RIM_NB', freq: 'daily', window: '03:00 CET', target: 'BSI review window (guardrail check)' });

/* ═══════════════════════════════════════════════════════════════════════════
 * 6 · LIMS — LabWare (test results: EO validation, transit, bioburden)
 * ═══════════════════════════════════════════════════════════════════════════ */
const lims = [
  // the anchor: EO sterilisation validation on lot VPG2-VAL-03 — NO result yet (Pending)
  { 'sample_id': 'VPG2-VAL-03', 'test_code': 'ISO11135-EO-VAL', 'method_ref': 'ISO 11135:2014 half-cycle', 'analyst_id': 'AK', 'result': '', 'units': 'SAL', 'result_state': 'Pending', 'result_date': '', 'product': 'VARIPULSE Gen 2 PFA Catheter' },
  { 'sample_id': 'VPG2-BIO-11', 'test_code': 'BIOBURDEN', 'method_ref': 'ISO 11737-1', 'analyst_id': 'JT', 'result': '42', 'units': 'CFU/device', 'result_state': 'Approved', 'result_date': '2026-08-20', 'product': 'VARIPULSE Gen 2 PFA Catheter' },
  { 'sample_id': 'PSEE-TRN-D', 'test_code': 'ASTM-D4169-DC13', 'method_ref': 'ASTM D4169 Seq. D', 'analyst_id': 'JT', 'result': 'FAIL', 'units': 'pass/fail', 'result_state': 'Approved', 'result_date': '2026-09-06', 'product': 'TECNIS PureSee Toric IOL' },
];
// §4.4 dirt: one result_date in a different format (DD/MM/YYYY not ISO)
lims.push({ 'sample_id': 'OCT-BIO-07', 'test_code': 'BIOBURDEN', 'method_ref': 'ISO 11737-1', 'analyst_id': 'JT', 'result': '31', 'units': 'CFU/device', 'result_state': 'Approved', 'result_date': '02/09/2026', 'product': 'OCTARAY Gen 2 Mapping Catheter' });
DIRT.push('LIMS: sample OCT-BIO-07 result_date in DD/MM/YYYY (02/09/2026) not ISO (DQ: normalise date format).');
writeCsv('lims', feedName('LIMS_RESULT'), lims, ['sample_id', 'test_code', 'method_ref', 'analyst_id', 'result', 'units', 'result_state', 'result_date', 'product'],
  { feedCode: 'LIMS_RESULT', freq: 'near-real-time', window: 'continuous', target: 'GateCriterion result / validation report status' });

/* ═══════════════════════════════════════════════════════════════════════════
 * 5 · MES — Opcenter (lots + SPC readings; the Heraeus contrasting case)
 * ═══════════════════════════════════════════════════════════════════════════ */
// 12 lots on the Heraeus ring-electrode dimensional check, 4 of them OOS (SPC
// rule 2: 4 consecutive on one side). ~150 readings per lot → ~1,800 rows.
const mesLots = [], mesSpc = [];
const USL = 2.55, LSL = 2.45, NOM = 2.50;            // ring-electrode OD spec (mm)
const OOS_LOTS = new Set([9, 10, 11, 12]);            // the 4 consecutive out-of-spec lots
let spcId = 1;
for (let lot = 1; lot <= 12; lot++) {
  const lotId = 'HRS-RE-2609-' + String(lot).padStart(2, '0');
  const oos = OOS_LOTS.has(lot);
  mesLots.push({ 'LotId': lotId, 'MaterialNo': matnr(LAUNCH_MATROOT['seed_launch_varipulse_g2'] || 100200), 'Operation': 'OP40-RING-ELECTRODE', 'EquipmentId': 'CASHEL-L4', 'LotQty': ri(480, 520), 'LotState': oos ? 'HOLD' : 'Released', 'StartTs': '2026-09-' + String(lot < 6 ? 5 + lot : 5 + lot).padStart(2, '0') + 'T06:00:00' });
  const readings = ri(145, 155);
  // drift upward on OOS lots (cavity-6 tooling wear) so rule 2 breaks toward USL
  const center = oos ? NOM + 0.045 + (lot - 9) * 0.004 : NOM + (rng() - 0.5) * 0.006;
  for (let r = 0; r < readings; r++) {
    const val = +(center + (rng() - 0.5) * 0.02).toFixed(4);
    const viol = val > USL ? 'RULE_1' : (oos && r % 9 === 0 ? 'RULE_2' : '');
    mesSpc.push({
      'MeasId': 'M' + String(spcId++).padStart(7, '0'), 'LotId': lotId, 'Parameter': 'ring_electrode_od_mm',
      'MeasValue': val, 'USL': USL, 'LSL': LSL, 'Nominal': NOM, 'SpcRuleViolated': viol,
      'EquipmentId': 'CASHEL-L4', 'Cavity': ((r % 8) + 1), 'MeasTs': '2026-09-' + String(lot < 6 ? 5 + lot : 5 + lot).padStart(2, '0') + 'T' + String(6 + Math.floor(r / 20)).padStart(2, '0') + ':' + String((r * 3) % 60).padStart(2, '0') + ':00',
    });
  }
}
writeCsv('mes', feedName('MES_LOT', true, 8), mesLots, ['LotId', 'MaterialNo', 'Operation', 'EquipmentId', 'LotQty', 'LotState', 'StartTs'],
  { feedCode: 'MES_LOT', freq: 'streaming (5-min micro-batch)', window: 'continuous', target: 'Lot' });
writeCsv('mes', feedName('MES_SPC', true, 8), mesSpc, ['MeasId', 'LotId', 'Parameter', 'MeasValue', 'USL', 'LSL', 'Nominal', 'SpcRuleViolated', 'EquipmentId', 'Cavity', 'MeasTs'],
  { feedCode: 'MES_SPC', freq: 'streaming (5-min micro-batch)', window: 'continuous', target: 'ProcessMeasurement → Heraeus Finding' });

/* ═══════════════════════════════════════════════════════════════════════════
 * 8 · PPM — Planisware (activities + gates) — the 107 activities & the gate dates
 * ═══════════════════════════════════════════════════════════════════════════ */
const OWNER_INITIAL = {};
people.forEach((p) => { OWNER_INITIAL[p.id] = p.initials; });
const ppmAct = activities.map((a, i) => {
  const ph = phases.find((pp) => a.phase && pp.id === a.phase.id);
  const dom = domains.find((dd) => a.domain && dd.id === a.domain.id);
  const ownerId = a.owningPerson ? a.owningPerson.id : null;
  const st = { ok: 'Complete', run: 'In Progress', rk: 'At Risk', late: 'Late', no: 'Not Started' }[a.statusCode] || a.status;
  return {
    'TaskId': 'T' + String(20000 + i), 'ProjectId': 'PRJ-VPG2', 'TaskName': a.name,
    'PhaseCode': ph ? ph.code : '', 'FunctionalDomain': dom ? dom.name : '', 'Status': st,
    'OwnerId': a.owningAgent ? 'AGENT' : (ownerId ? OWNER_INITIAL[ownerId] || '' : ''),
    'AutonomyClass': a.autonomyClass ? a.autonomyClass.id.replace('seed_autonomy_', '').toUpperCase() : '',
    'BaselineFinish': '', 'ActualFinish': a.statusCode === 'ok' ? '2026-0' + ri(6, 8) + '-1' + ri(0, 5) : '',
  };
});
writeCsv('ppm', feedName('PPM_ACTIVITY'), ppmAct, ['TaskId', 'ProjectId', 'TaskName', 'PhaseCode', 'FunctionalDomain', 'Status', 'OwnerId', 'AutonomyClass', 'BaselineFinish', 'ActualFinish'],
  { feedCode: 'PPM_ACTIVITY', freq: 'daily', window: '01:00 CET', target: 'Activity / Phase' });

// Gates — baseline vs forecast (the SOURCE of gate dates; §Item-2 correction)
const ppmGate = gates.map((g) => {
  const l = launches.find((ll) => g.launch && ll.id === g.launch.id);
  return {
    'GateId': g.id.replace('seed_gate_', 'G-').toUpperCase(), 'ProjectId': 'PRJ-' + (l ? l.id.replace('seed_launch_', '').toUpperCase() : ''),
    'GateCode': g.code, 'GateName': g.name, 'BaselineDate': g.baselineDate, 'ForecastDate': g.forecastDate,
    'SlipDays': g.slipDays, 'Status': g.status,
  };
});
writeCsv('ppm', feedName('PPM_GATE'), ppmGate, ['GateId', 'ProjectId', 'GateCode', 'GateName', 'BaselineDate', 'ForecastDate', 'SlipDays', 'Status'],
  { feedCode: 'PPM_GATE', freq: 'daily', window: '01:00 CET', target: 'Gate' });

/* ═══════════════════════════════════════════════════════════════════════════
 * 10 · HR — Workday + AD (people, functions, delegated authority)
 * ═══════════════════════════════════════════════════════════════════════════ */
const AUTH_EUR = { GH: 5000000, MO: 250000, AK: 250000, SL: 150000, KT: 100000, LH: 100000, AP: 100000, TB: 1500000 };
const hr = people.filter((p) => !p.isBoard).map((p, i) => ({
  'WorkerId': 'WD' + String(100200 + i), 'samAccountName': (p.initials || '').toLowerCase() + '@its.jnj.com',
  'LegalName': p.name, 'JobFunction': p.role, 'BusinessTitle': p.role, 'ManagerId': p.initials === 'GH' ? '' : 'WD100200',
  'DelegatedAuthorityEUR': AUTH_EUR[p.initials] != null ? AUTH_EUR[p.initials] : 50000, 'Active': 'Y',
}));
writeCsv('workday', feedName('HR_WORKER', false), hr, ['WorkerId', 'samAccountName', 'LegalName', 'JobFunction', 'BusinessTitle', 'ManagerId', 'DelegatedAuthorityEUR', 'Active'],
  { feedCode: 'HR_WORKER', freq: 'weekly', window: 'Sun 22:00 CET', target: 'Person / Decision.authorityThreshold' });

/* ═══════════════════════════════════════════════════════════════════════════
 * 11 · SUPPLIER PORTAL — the steriliser booking feed (THE TRIGGER)
 * ═══════════════════════════════════════════════════════════════════════════ */
// Hourly poll landing a small JSON. The CANCELLED row on VPG2-VAL-03 is what the
// Quality agent notices — nobody was watching this portal.
const portal = {
  provider: 'Steris Venlo',                     // free-text; resolves via crosswalk certificate_name
  portal: 'steris-booking.example.com',
  polled_at: LGNOW + 'T08:00:00+02:00',
  bookings: [
    { booking_ref: 'BKG-2026-33412', chamber_id: 'VNL-EO-02', process: 'EO', slot_datetime: '2026-10-12T07:00:00', lot_ref: 'VPG2-VAL-03', status: 'Cancelled', cancelled_at: LGNOW + 'T07:58:00+02:00', reason: 'Chamber deviation — capacity withdrawn', commitment: 'Non-committed' },
    { booking_ref: 'BKG-2026-33301', chamber_id: 'VNL-EO-01', process: 'EO', slot_datetime: '2026-09-28T07:00:00', lot_ref: 'OCT-VAL-02', status: 'Booked', commitment: 'Non-committed' },
    { booking_ref: 'BKG-2026-33455', chamber_id: 'VNL-EO-02', process: 'EO', slot_datetime: '2026-10-20T07:00:00', lot_ref: 'EMB-VAL-05', status: 'Booked', commitment: 'Committed' },
  ],
};
writeJson('portal', feedName('PORTAL_CHAMBER_BOOKING', true, 8), portal,
  { feedCode: 'PORTAL_CHAMBER', freq: 'hourly poll', window: 'hourly :00', target: 'trigger → Quality-agent Finding (NPI-0417)' });

/* ═══════════════════════════════════════════════════════════════════════════
 * MANIFEST + DIRT LOG (feed inventory + freshness contract for DQ / lineage)
 * ═══════════════════════════════════════════════════════════════════════════ */
writeJson('.', '_MANIFEST', {
  generated_for: 'J&J MedTech NPI Launch Control — synthetic source extracts (illustrative only; not real J&J data)',
  demo_clock: 'Friday 11 September 2026 08:42 CET',
  seed: '0x1a2b3c4d (deterministic — re-runs are byte-identical)',
  feeds: MANIFEST,
  intentional_data_quality_issues: DIRT,
}, { feedCode: '_MANIFEST' });

console.log('\nDirt & planted mismatches:');
DIRT.forEach((d) => console.log('  • ' + d));
console.log('\nDone. Feeds:', MANIFEST.length, '→', OUT);
