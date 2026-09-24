#!/usr/bin/env node
/*
 * gen_pipeline_data.mjs — Item 4 derivation step.
 *
 * Reads the synthetic SOURCE extracts under jJDemo/sources/ (produced by
 * gen_sources.mjs) and the _MANIFEST.json, and derives the ONTOLOGY data files
 * for the pipeline's own bookkeeping + contrast-case types:
 *
 *   data/SupplierCrosswalk/   — key-resolution reference (from SUPPLIER_XWALK)
 *   data/DataFeedWatermark/   — one freshness contract per feed (from _MANIFEST)
 *   data/Lot/                 — Heraeus line-3 lots (from MES_LOT)
 *   data/ProcessMeasurement/  — SPC readings, violations kept + a bounded sample
 *   data/LineageRecord/       — provenance breadcrumbs for the gold-path objects
 *
 * Deterministic: no clock, no RNG. Re-runs are byte-identical.
 * These are DERIVED artefacts — the source extracts remain the origin of truth.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = '/usr/workspace/jJDemo';
const SRC = join(ROOT, 'sources');
const DATA = join(ROOT, 'data');
const LGNOW = '2026-09-11T08:42:00'; // demo clock

function readCsv(rel) {
  const txt = readFileSync(join(SRC, rel), 'utf8').replace(/\r/g, '');
  const lines = txt.split('\n').filter((l) => l.length > 0);
  const header = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const o = {};
    header.forEach((h, i) => (o[h] = cells[i] !== undefined ? cells[i] : ''));
    return o;
  });
}
function writeData(type, objs) {
  const dir = join(DATA, type);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${type}.json`), JSON.stringify(objs, null, 2) + '\n');
  console.log(`  data/${type}/${type}.json  (${objs.length} rows)`);
}

const manifest = JSON.parse(readFileSync(join(SRC, '_MANIFEST.json'), 'utf8'));
const feedByCode = Object.fromEntries(manifest.feeds.map((f) => [f.feed, f]));

console.log('Deriving ontology data files from source extracts:');

/* ---- 1. SupplierCrosswalk (identity resolution) ------------------------ */
const xwalk = readCsv(feedByCode.SUPPLIER_XWALK.file).map((r) => ({
  id: r.supplier_id,
  supplierId: r.supplier_id,
  canonicalName: r.canonical_name,
  sapVendor: r.sap_vendor,
  aribaSupplierId: r.ariba_supplier_id,
  qmsAuditSubject: r.qms_audit_subject,
  certificateName: r.certificate_name,
  dunsNumber: r.duns_number, // Heraeus intentionally blank -> D&B no-match
  resolutionState: r.resolution_state,
}));
writeData('SupplierCrosswalk', xwalk);

/* ---- 2. DataFeedWatermark (one freshness contract per feed) ------------ */
const FREQ_SECONDS = {
  daily: 86400,
  weekly: 604800,
  'weekly + event': 604800,
  event: 604800,
  reference: 2592000,
  'near-real-time': 900,
  'near-real-time (micro-batch 15 min)': 900,
  'streaming (5-min micro-batch)': 300,
  'hourly poll': 3600,
};
const watermarks = manifest.feeds.map((f) => {
  const expected = FREQ_SECONDS[f.frequency] || 86400;
  return {
    id: `wm_${f.feed.toLowerCase()}`,
    feedCode: f.feed,
    sourceSystem: f.system,
    targetType: f.target,
    lastWatermark: '20260911',
    lastLoadedAt: LGNOW,
    lastRowCount: f.rows,
    expectedEverySeconds: expected,
    status: 'FRESH',
    note: `${f.frequency}, arrives ${f.arrivalWindow}`,
  };
});
writeData('DataFeedWatermark', watermarks);

/* ---- 3. Lot (Heraeus line-3 lots, contrast case) ----------------------- */
const lotRows = readCsv(feedByCode.MES_LOT.file);
const lots = lotRows.map((r) => ({
  id: r.LotId,
  lotId: r.LotId,
  materialNo: r.MaterialNo,
  operation: r.Operation,
  equipmentId: r.EquipmentId,
  lotQty: parseInt(r.LotQty, 10),
  lotState: r.LotState, // Released | HOLD
  startTs: r.StartTs,
  spcViolation: r.LotState === 'HOLD', // lots 09-12 on hold carry the SPC breach
}));
writeData('Lot', lots);

/* ---- 4. ProcessMeasurement (all violations + bounded in-spec sample) --- */
const spcRows = readCsv(feedByCode.MES_SPC.file);
const violated = spcRows.filter((r) => r.SpcRuleViolated && r.SpcRuleViolated.length > 0);
// Keep every violation (the evidence) + a deterministic thin sample of in-spec
// readings (every 40th) so the demo shows context without loading 1,451 clean rows.
const inSpecSample = spcRows.filter((r) => !r.SpcRuleViolated).filter((_, i) => i % 40 === 0);
const measRows = violated.concat(inSpecSample);
const meas = measRows.map((r) => ({
  id: r.MeasId,
  measId: r.MeasId,
  lot: { id: r.LotId },
  parameter: r.Parameter,
  measValue: parseFloat(r.MeasValue),
  usl: parseFloat(r.USL),
  lsl: parseFloat(r.LSL),
  nominal: parseFloat(r.Nominal),
  spcRuleViolated: r.SpcRuleViolated || null,
  equipmentId: r.EquipmentId,
  cavity: parseInt(r.Cavity, 10),
  measTs: r.MeasTs,
}));
writeData('ProcessMeasurement', meas);
console.log(`     (kept ${violated.length} violations + ${inSpecSample.length} in-spec sample of ${spcRows.length} total)`);

/* ---- 5. LineageRecord (provenance for the gold-path objects) ----------- */
// One breadcrumb per demonstrable trace-to-source target.
const lineage = [
  {
    id: 'Gate__seed_gate_varipulse_g3',
    targetType: 'Gate',
    targetId: 'seed_gate_varipulse_g3',
    feedCode: 'PPM_GATE',
    sourceFile: feedByCode.PPM_GATE.file,
    sourceRowKey: 'G-VARIPULSE_G3',
    transform: 'SrcPpmGate-Gate',
    loadedAt: LGNOW,
  },
  {
    id: 'Finding__seed_finding_417',
    targetType: 'Finding',
    targetId: 'seed_finding_417',
    feedCode: 'PORTAL_CHAMBER',
    sourceFile: feedByCode.PORTAL_CHAMBER.file,
    sourceRowKey: 'BK-STERIS-VNL-20261012',
    transform: '(agent trigger — Quality agent raised finding)',
    loadedAt: LGNOW,
  },
  {
    id: 'CAPA__seed_capa_0148',
    targetType: 'CAPA',
    targetId: 'seed_capa_0148',
    feedCode: 'QMS_CAPA',
    sourceFile: feedByCode.QMS_CAPA.file,
    sourceRowKey: 'CAPA-2026-0148',
    transform: 'SrcQmsCapa-CAPA',
    loadedAt: LGNOW,
  },
  {
    id: 'Finding__seed_finding_412',
    targetType: 'Finding',
    targetId: 'seed_finding_412',
    feedCode: 'MES_SPC',
    sourceFile: feedByCode.MES_SPC.file,
    sourceRowKey: 'HRS-RE-2609-09 (first RULE_1 breach)',
    transform: '(line agent — SPC rule violation on lot 09)',
    loadedAt: LGNOW,
  },
];
writeData('LineageRecord', lineage);

console.log('Done.');
