/*
 * Reproducible generator for the Document seed register.
 *
 * WHY: every launch must show a COMPLETE, industry-standard J&J MedTech document
 * section (the manager's requirement: "todos los productos tienen su seccion de
 * documentos completa, aunque el status cambie ... que esten todos porque son
 * cosas que hay que subir"). Statuses vary by how far each launch has progressed,
 * but the full checklist is present for every product.
 *
 * INVARIANTS honoured:
 *  - VARIPULSE G2's 78 bespoke, hand-authored documents are preserved VERBATIM
 *    (including seed_doc_varipulse_44, which a GateCriterion references as
 *    evidence). We only ADD the new Supply-chain & operations section to it.
 *  - The catalog maps the manager's 8 industry categories onto the 9 group codes
 *    the UI/back end already render (dhf, vv, cli, reg, cert, mfg, com, sco, pm).
 *  - Deterministic: no randomness, so re-running yields identical output.
 *
 * RUN: node scripts/gen-documents.mjs   (from the jJDemo package root)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SEED = join(HERE, '..', 'seed', 'Document', 'Document.json');
const VARIPULSE = 'seed_launch_varipulse_g2';

/* Launches and the phase each currently sits in (drives status derivation). */
const LAUNCHES = [
  { id: 'seed_launch_dualto', slug: 'dualto', phase: 6, health: 'LAUNCHED' },
  { id: 'seed_launch_embotrap_iv', slug: 'embotrap', phase: 5, health: 'AT_RISK' },
  { id: 'seed_launch_ethicon_4000', slug: 'ethicon', phase: 4, health: 'AT_RISK' },
  { id: 'seed_launch_impella_ecp', slug: 'impella', phase: 4, health: 'ON_PLAN' },
  { id: 'seed_launch_javelin_xl', slug: 'javelin', phase: 5, health: 'ON_PLAN' },
  { id: 'seed_launch_octaray_g2', slug: 'octaray', phase: 2, health: 'AT_RISK' },
  { id: 'seed_launch_ottava', slug: 'ottava', phase: 1, health: 'PRE_MARKET' },
  { id: 'seed_launch_puresee', slug: 'puresee', phase: 3, health: 'ON_PLAN' },
];

/*
 * Master catalog. Each entry: [name, docType, group, expectedPhase].
 * expectedPhase = the NPI phase by which the document is normally completed.
 * Groups (manager's 8 categories → group codes):
 *   1 Design & Development (DHF) ....... dhf
 *   2 Regulatory Submissions ........... reg  (+ cert for licences/registrations)
 *   3 Manufacturing & Quality .......... mfg
 *   4 Clinical & Evidence .............. cli
 *   5 Post-Market Surveillance ......... pm
 *   6 Labeling & IFU ................... com  (with commercial/market access)
 *   7 Commercial & Market Access ....... com
 *   8 Supply Chain & Operations ........ sco
 * Verification & validation (vv) is split out of Design as its own section,
 * matching VARIPULSE's authored structure.
 */
const CATALOG = [
  // ── Design & development (DHF) ──
  ['Design & Development Plan', 'Plan', 'dhf', 1],
  ['Design Input Requirements (DIR)', 'Specification', 'dhf', 2],
  ['Design Output — drawings and specifications', 'Specification', 'dhf', 3],
  ['Requirements traceability matrix', 'Matrix', 'dhf', 3],
  ['Design Review minutes', 'Minutes', 'dhf', 3],
  ['Risk Management File, ISO 14971', 'Risk file', 'dhf', 3],
  ['Design FMEA', 'Analysis', 'dhf', 3],
  ['Process FMEA', 'Analysis', 'dhf', 3],
  ['Device Master Record (DMR)', 'Record', 'dhf', 4],
  ['Design History File index', 'Index', 'dhf', 4],
  // ── Verification & validation ──
  ['Design verification summary report', 'Report', 'vv', 3],
  ['Bench and mechanical test reports', 'Test reports', 'vv', 3],
  ['Electrical safety and EMC, IEC 60601', 'Test report', 'vv', 3],
  ['Software verification and validation, IEC 62304', 'Report', 'vv', 3],
  ['Usability engineering report, IEC 62366', 'Report', 'vv', 3],
  ['Biocompatibility evaluation, ISO 10993', 'Report', 'vv', 3],
  ['Shelf-life and accelerated ageing study', 'Study', 'vv', 4],
  ['Package and transit validation, ASTM D4169', 'Report', 'vv', 4],
  ['Sterile barrier integrity report', 'Report', 'vv', 4],
  ['Sterilisation validation report, ISO 11135', 'Report', 'vv', 4],
  ['Bioburden baseline study', 'Study', 'vv', 4],
  // ── Clinical & evidence ──
  ['Clinical Evaluation Plan', 'Plan', 'cli', 2],
  ['Investigator brochure', 'Brochure', 'cli', 3],
  ['IDE / clinical study approval', 'Approval', 'cli', 3],
  ['Clinical Investigation Plan (CIP)', 'Protocol', 'cli', 3],
  ['Clinical study report (CSR)', 'Report', 'cli', 4],
  ['Clinical Evaluation Report (CER)', 'Report', 'cli', 4],
  ['Proctor and KOL engagement plan', 'Plan', 'cli', 5],
  ['Post-Market Clinical Follow-up (PMCF) plan', 'Plan', 'cli', 5],
  // ── Regulatory submissions ──
  ['Regulatory strategy and pathway plan', 'Plan', 'reg', 2],
  ['Device classification rationale', 'Rationale', 'reg', 2],
  ['FDA Q-Sub / pre-submission minutes', 'Minutes', 'reg', 3],
  ['EU MDR Technical Documentation', 'Dossier', 'reg', 4],
  ['FDA submission — 510(k) / PMA / De Novo', 'Dossier', 'reg', 4],
  ['Notified Body correspondence', 'Correspondence', 'reg', 4],
  ['Summary of Safety and Clinical Performance (SSCP)', 'Summary', 'reg', 4],
  ['EU Authorised Representative agreement', 'Agreement', 'reg', 4],
  ['Country dossiers', 'Dossier set', 'reg', 5],
  ['Declaration of Conformity', 'Declaration', 'reg', 5],
  // ── Certificates, licences & registrations ──
  ['ISO 13485:2016 certificate', 'Certificate', 'cert', 3],
  ['MDSAP certificate', 'Certificate', 'cert', 3],
  ['FDA establishment registration', 'Registration', 'cert', 4],
  ['Sterilisation facility licence', 'Licence', 'cert', 4],
  ['UDI-DI assignment record, GS1', 'Record', 'cert', 4],
  ['GUDID submission record', 'Registration', 'cert', 5],
  ['EUDAMED registration record', 'Registration', 'cert', 5],
  ['Import and export licences', 'Licence set', 'cert', 5],
  ['Free Sale Certificate application', 'Application', 'cert', 5],
  // ── Manufacturing & quality ──
  ['Process validation master plan', 'Plan', 'mfg', 3],
  ['Approved Supplier List', 'List', 'mfg', 3],
  ['Installation Qualification (IQ) report', 'Report', 'mfg', 4],
  ['Operational Qualification (OQ) report', 'Report', 'mfg', 4],
  ['Performance Qualification (PQ) protocol', 'Protocol', 'mfg', 4],
  ['Performance Qualification (PQ) report', 'Report', 'mfg', 5],
  ['Tooling FAT and SAT reports', 'Report', 'mfg', 4],
  ['Engineering build records', 'Batch records', 'mfg', 4],
  ['Supplier audit reports', 'Audit reports', 'mfg', 4],
  ['Quality Agreements', 'Agreements', 'mfg', 4],
  ['PPAP and first-article inspection records', 'Records', 'mfg', 4],
  ['Non-conformance and CAPA log', 'Log', 'mfg', 5],
  ['QSIT / MDSAP inspection readiness self-audit', 'Self-audit', 'mfg', 5],
  // ── Labelling & commercial ──
  ['Instructions for Use (IFU) — master', 'Labelling', 'com', 4],
  ['Labelling artwork', 'Artwork', 'com', 4],
  ['Symbols and UDI carrier specification', 'Specification', 'com', 4],
  ['eIFU registration', 'Registration', 'com', 5],
  ['Health economic model', 'Model', 'com', 4],
  ['Global Value Dossier', 'Dossier', 'com', 4],
  ['Pricing corridor and IRP exposure analysis', 'Analysis', 'com', 4],
  ['Value Analysis Committee evidence pack', 'Pack', 'com', 5],
  ['Field-force training and certification curriculum', 'Curriculum', 'com', 5],
  ['Promotional material — MLR review', 'Material', 'com', 5],
  // ── Supply chain & operations ──
  ['Demand forecast and launch build plan', 'Plan', 'sco', 4],
  ['Safety stock and inventory policy', 'Policy', 'sco', 5],
  ['Country registration status tracker', 'Tracker', 'sco', 5],
  ['Distribution and 3PL agreements', 'Agreements', 'sco', 5],
  ['Import / export documentation pack', 'Pack', 'sco', 5],
  // ── Post-market surveillance ──
  ['Post-Market Surveillance (PMS) plan', 'Plan', 'pm', 5],
  ['Vigilance and complaint handling procedure', 'Procedure', 'pm', 5],
  ['Field Safety Corrective Action procedure', 'Procedure', 'pm', 5],
  ['Trend analysis and signal detection procedure', 'Procedure', 'pm', 6],
  ['Periodic Safety Update Report (PSUR)', 'Report', 'pm', 6],
];

/* The Supply-chain section VARIPULSE is currently missing — added so it too is
 * complete across all nine groups. Statuses reflect VARIPULSE at P3, OFF_TRACK. */
const VARIPULSE_SCO = [
  ['Demand forecast and launch build plan — 4,200 units', 'Plan', 'sco', 'dft'],
  ['Safety stock and inventory policy', 'Policy', 'sco', 'na'],
  ['Country registration status tracker — 11 of 14 filed', 'Tracker', 'sco', 'rev'],
  ['Distribution and 3PL agreements', 'Agreements', 'sco', 'na'],
  ['Import / export documentation pack — 9 of 14', 'Pack', 'sco', 'dft'],
];

const OWNERS = {
  dhf: 'R&D / Design',
  vv: 'V&V engineering',
  cli: 'Clinical affairs',
  reg: 'Regulatory affairs',
  cert: 'Regulatory operations',
  mfg: 'Quality / Manufacturing',
  com: 'Commercial / Marketing',
  sco: 'Supply chain',
  pm: 'Post-market surveillance',
};

/* Deterministic small hash from a string → non-negative int. */
function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0x7fffffff;
  return h;
}

/*
 * Derive a document's status from how far the launch has progressed relative to
 * the phase the document is normally complete by. Troubled launches (AT_RISK /
 * OFF_TRACK) surface a few gaps ('miss') around their current phase.
 */
function statusFor(currentPhase, expectedPhase, health, seed) {
  const d = currentPhase - expectedPhase;
  let s;
  if (d >= 2) s = 'ok';
  else if (d === 1) s = seed % 5 === 0 ? 'rev' : 'ok';
  else if (d === 0) s = seed % 3 === 0 ? 'rev' : seed % 3 === 1 ? 'dft' : 'rev';
  else if (d === -1) s = seed % 2 === 0 ? 'dft' : 'na';
  else s = 'na';
  const troubled = health === 'AT_RISK' || health === 'OFF_TRACK';
  if (troubled && (d === 0 || d === 1) && seed % 7 === 0) s = 'miss';
  return s;
}

/* Cosmetic, deterministic document date for started docs; null when not started. */
function dateFor(expectedPhase, status, seed) {
  if (status === 'na' || status === 'miss') return null;
  const month = Math.min(12, Math.max(1, expectedPhase * 2));
  const day = 5 + (seed % 22);
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `2026-${mm}-${dd}T00:00:00`;
}

function sizeFor(seed) {
  const mb = ((seed % 380) + 3) / 10;
  return `${mb.toFixed(1)} MB`;
}

/* ── Build ── */
const existing = JSON.parse(readFileSync(SEED, 'utf8'));
const varipulseDocs = existing.filter((d) => d.launch && d.launch.id === VARIPULSE);
if (varipulseDocs.length !== 78) {
  throw new Error(`Expected 78 VARIPULSE docs to preserve, found ${varipulseDocs.length}`);
}

const out = [...varipulseDocs];

// Add VARIPULSE's missing Supply-chain section.
VARIPULSE_SCO.forEach(([name, docType, group, status], i) => {
  const seed = hash(VARIPULSE + name);
  out.push({
    id: `seed_doc_varipulse_sco_${i + 1}`,
    name,
    docType,
    group,
    revision: `rev ${(seed % 6) + 1}`,
    status,
    documentDate: status === 'na' ? null : dateFor(3, status, seed),
    owner: OWNERS[group],
    fileSize: status === 'na' || status === 'miss' ? null : sizeFor(seed),
    launch: { id: VARIPULSE },
  });
});

// Generate the full catalog for the 8 other launches.
for (const L of LAUNCHES) {
  CATALOG.forEach(([name, docType, group, expectedPhase], i) => {
    const seed = hash(L.id + name);
    const status = statusFor(L.phase, expectedPhase, L.health, seed);
    out.push({
      id: `seed_doc_${L.slug}_${i + 1}`,
      name,
      docType,
      group,
      revision: `rev ${(seed % 6) + 1}`,
      status,
      documentDate: dateFor(expectedPhase, status, seed),
      owner: OWNERS[group],
      fileSize: status === 'na' || status === 'miss' ? null : sizeFor(seed),
      launch: { id: L.id },
    });
  });
}

writeFileSync(SEED, JSON.stringify(out, null, 2) + '\n');

// Summary to stdout.
const byLaunch = {};
for (const d of out) {
  const k = d.launch.id;
  byLaunch[k] = byLaunch[k] || { total: 0, ok: 0, rev: 0, dft: 0, miss: 0, na: 0 };
  byLaunch[k].total++;
  byLaunch[k][d.status]++;
}
console.log(`Wrote ${out.length} documents.`);
console.table(byLaunch);
