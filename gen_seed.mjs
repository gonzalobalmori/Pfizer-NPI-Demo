/* Seed generator for jJDemo.
 * Reads the J&J MedTech NPI prototype HTML and emits C3 SeedData JSON,
 * keeping the data exactly as authored. Run with: node gen_seed.mjs
 */
import fs from 'fs';
import path from 'path';

const HTML = fs.readFileSync('/usr/workspace/.attachments/JNJ_MedTech_NPI_Demo.html', 'utf8');
const SEED = '/usr/workspace/jJDemo/seed';
const DATA = '/usr/workspace/jJDemo/data';
// Operational types the approve transaction (and the fleet) mutate at runtime.
// SeedData locks provisioned field values against runtime updates, so these are
// plain entity types loaded from data/ (loads but does not lock), not seed/.
const OPERATIONAL = new Set([
  'Gate', 'Launch', 'Decision', 'ActionPlanTask', 'Notification', 'CAPA',
  'DesignHistoryFileEntry', 'Finding',
]);

/* ---- helpers ------------------------------------------------------------ */
function decode(s) {
  if (s == null) return s;
  return String(s)
    .replace(/&amp;/g, '&').replace(/&euro;/g, '€').replace(/&middot;/g, '·')
    .replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').replace(/&rarr;/g, '→')
    .replace(/&larr;/g, '←').replace(/&rsquo;/g, '’').replace(/&lsquo;/g, '‘')
    .replace(/&ldquo;/g, '“').replace(/&rdquo;/g, '”').replace(/&minus;/g, '−')
    .replace(/&Idot;/g, 'İ').replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/<\/?b>/g, '').replace(/<\/?em>/g, '').replace(/<[^>]+>/g, '')
    // Manager copy change: drop "cadaver" qualifier — say "lab session"/"labs".
    .replace(/cadaver-lab/gi, 'lab').replace(/cadaver labs/gi, 'labs')
    .trim();
}
// extract `var NAME = <literal>;` and eval the literal
function extractVar(name) {
  const m = new RegExp('var\\s+' + name + '\\s*=\\s*').exec(HTML);
  if (!m) throw new Error('var not found: ' + name);
  let i = m.index + m[0].length;
  let depth = 0, inStr = false, q = '', started = false, start = i;
  for (; i < HTML.length; i++) {
    const c = HTML[i];
    if (inStr) { if (c === '\\') { i++; continue; } if (c === q) inStr = false; continue; }
    if (c === '"' || c === "'") { inStr = true; q = c; started = true; continue; }
    if (c === '[' || c === '{') { depth++; started = true; continue; }
    if (c === ']' || c === '}') { depth--; if (depth === 0) { i++; break; } continue; }
    if (c === ';' && depth === 0 && started) break;
  }
  const lit = HTML.slice(start, i);
  // eslint-disable-next-line no-eval
  return eval('(' + lit + ')');
}
function ref(id) { return id == null ? null : { id }; }
function write(type, records) {
  const base = OPERATIONAL.has(type) ? DATA : SEED;
  const dir = path.join(base, type);
  fs.mkdirSync(dir, { recursive: true });
  // convention: a single-record seed file's name should match the record id
  const fname = (records.length === 1 ? records[0].id : type) + '.json';
  fs.writeFileSync(path.join(dir, fname), JSON.stringify(records, null, 2));
  console.log(`  ${type}: ${records.length}`);
}
// parse "10 Sep 19:40" / "11 Feb 2026" / "closed 12 Apr 24" -> ISO datetime (year default 2026)
const MON = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
function pad(n) { return ('0' + n).slice(-2); }
function isoDate(y, mo, d, hh = 0, mm = 0) {
  return `${y}-${pad(mo + 1)}-${pad(d)}T${pad(hh)}:${pad(mm)}:00`;
}
function parseDate(str) {
  if (!str) return null;
  let s = decode(str).replace(/^(closed|forecast|baseline|to|after|from)\s+/i, '').trim();
  // dd Mon hh:mm (this year) — check the colon form BEFORE the year form
  let m = /(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{1,2}):(\d{2})/.exec(s);
  if (m) return isoDate(2026, MON[m[2]], +m[1], +m[3], +m[4]);
  m = /(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})/.exec(s); // dd Mon yyyy
  if (m) return isoDate(+m[3], MON[m[2]], +m[1]);
  m = /(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{2})\b/.exec(s); // dd Mon yy
  if (m) return isoDate(2000 + +m[3], MON[m[2]], +m[1]);
  m = /(\d{1,2})\s+([A-Za-z]{3})/.exec(s); // dd Mon (this year)
  if (m) return isoDate(2026, MON[m[2]], +m[1]);
  m = /([A-Za-z]{3})[a-z]*\s+(\d{4})/.exec(s); // Mon yyyy
  if (m) return isoDate(+m[2], MON[m[1]], 1);
  return null;
}
// LGNOW-relative timestamps for chain steps ("28m","4d","40s","2m ago")
const LGNOW = new Date(2026, 8, 11, 8, 42);
function agoMins(e) {
  if (!e) return null;
  e = String(e).replace(/\s*ago$/, '').trim();
  if (e === 'running' || e === 'now' || e === '0m') return 0;
  const m = /^(\d+)\s*(s|m|h|d)$/.exec(e);
  if (!m) return null;
  const n = +m[1];
  return m[2] === 's' ? n / 60 : m[2] === 'm' ? n : m[2] === 'h' ? n * 60 : n * 1440;
}
function stampFromAgo(e) {
  const mins = agoMins(e);
  if (mins == null) return null;
  const d = new Date(LGNOW.getTime() - mins * 60000);
  return isoDate(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes());
}

/* ---- pull the data literals -------------------------------------------- */
const FLP = extractVar('FLP');     // phases [code,name,window,state]
const FLG = extractVar('FLG');     // gates by phase
const FLA = extractVar('FLA');     // 107 activities
// Post-market (P6) agent activity is out of scope for launch control: DUALTO is
// LAUNCHED, so its two autonomous findings (I-331 Cashel yield, I-328 EUDAMED) and
// their chains (CHN-02, CHN-01) are dropped here at the source. Filtering IZ/OCH
// once makes every downstream loop (findings, chains, actions, handoffs, decisions,
// guardrail checks) skip them without further edits.
const POST_MARKET_FINDING_KEYS = new Set(['331', '328']);
const POST_MARKET_CHAIN_IDS = new Set(['CHN-02', 'CHN-01']);
const IZ = extractVar('IZ')        // 12 findings/board → 10 after dropping post-market
  .filter(z => !POST_MARKET_FINDING_KEYS.has(z.id.replace('I-', '')));
const OCH = extractVar('OCH')      // 9 chains → 7 after dropping post-market
  .filter(c => !POST_MARKET_CHAIN_IDS.has(c.id));
const OLANE = extractVar('OLANE'); // agent lanes
const AL = extractVar('AL');       // agent code -> name
const MKT = extractVar('MKT');     // 12 launch markets
const MKS = extractVar('MKS');     // 10 registration markets
const MKN = extractVar('MKN');     // market names
const ISSUE = extractVar('ISSUE'); // finding meta
const PEEK = extractVar('PEEK');   // finding exposure/gate
const HOLD = extractVar('HOLD');   // ownership state
const THR = (() => {                // escalation threads — drop post-market keys
  const raw = extractVar('THR');
  POST_MARKET_FINDING_KEYS.forEach(k => { delete raw[k]; });
  return raw;
})();
const PROB = extractVar('PROB');   // problem statements
const ACTS = extractVar('ACTS');   // option action plans
const CAPAM = extractVar('CAPA');  // finding -> capa id
const DUE = extractVar('DUE');     // finding -> due label

/* ============================ SEGMENTS & FRANCHISES ===================== */
write('Segment', [
  { id: 'seed_segment_surgery', name: 'Surgery', revenueScale: '~$12B', growthRate: 0.05 },
  { id: 'seed_segment_cardiovascular', name: 'Cardiovascular', revenueScale: '~$9B', growthRate: 0.15 },
  { id: 'seed_segment_vision', name: 'Vision', revenueScale: '~$5.5B', growthRate: 0.03 },
]);
const FRAN = [
  ['seed_franchise_biosense', 'Biosense Webster', 'seed_segment_cardiovascular'],
  ['seed_franchise_cerenovus', 'Cerenovus', 'seed_segment_cardiovascular'],
  ['seed_franchise_abiomed', 'Abiomed', 'seed_segment_cardiovascular'],
  ['seed_franchise_shockwave', 'Shockwave', 'seed_segment_cardiovascular'],
  ['seed_franchise_ethicon', 'Ethicon', 'seed_segment_surgery'],
  ['seed_franchise_digital_surgery', 'Digital Surgery', 'seed_segment_surgery'],
  ['seed_franchise_vision', 'J&J Vision', 'seed_segment_vision'],
];
write('Franchise', FRAN.map(([id, name, seg]) => ({ id, name, segment: ref(seg) })));

/* ============================ LAUNCHES ================================== */
// [id, deviceName, franchiseId, deviceClass, regRoute, leadMarket, phase, health, revAtRisk, firstShip, exposure, cause, readinessPct, floatDays]
// readinessPct + floatDays are the prototype's §2.3 Business-unit card figures (bar-f width + slp pill).
const LAUNCHES = [
  ['seed_launch_varipulse_g2', 'VARIPULSE Gen 2 PFA Catheter', 'seed_franchise_biosense', 'Class III', 'PMA + EU MDR', 'seed_market_de', 'P3', 'OFF_TRACK', 18400000, '2027-06-29', 18400000, 'G3 EO sterilisation slip (NPI-0417)', 83, null],
  ['seed_launch_octaray_g2', 'OCTARAY Gen 2 Mapping Catheter', 'seed_franchise_biosense', 'Class III', 'PMA + EU MDR', 'seed_market_de', 'P2', 'AT_RISK', 6200000, '2027-07-15', 6200000, 'G2 Heraeus single-source + unsigned inputs (NPI-0388/0371)', 86, null],
  ['seed_launch_embotrap_iv', 'EMBOTRAP IV Revascularisation Device', 'seed_franchise_cerenovus', 'Class III', 'PMA + EU MDR', 'seed_market_de', 'P5', 'AT_RISK', 3100000, '2026-09-26', 3100000, 'G5 loaner-set certification (NPI-0351)', 67, null],
  ['seed_launch_impella_ecp', 'Impella ECP+ Console v3', 'seed_franchise_abiomed', 'Class III', 'PMA', 'seed_market_us', 'P4', 'ON_PLAN', 0, '2027-12-15', 0, null, 92, 31],
  ['seed_launch_javelin_xl', 'Javelin XL IVL Catheter', 'seed_franchise_shockwave', 'Class III', 'PMA + EU MDR', 'seed_market_us', 'P5', 'ON_PLAN', 0, '2027-12-15', 0, 'Iberia field-force certification (NPI-0319)', 88, 18],
  ['seed_launch_ethicon_4000', 'ETHICON 4000+ Stapler', 'seed_franchise_ethicon', 'Class II', '510(k) + EU MDR', 'seed_market_us', 'P4', 'AT_RISK', 7800000, '2027-03-15', 7800000, 'US CPT code + NB clock-stop (NPI-0344/0365)', 80, null],
  ['seed_launch_dualto', 'DUALTO Energy System', 'seed_franchise_ethicon', 'Class II', 'EU MDR', 'seed_market_us', 'P6', 'LAUNCHED', 200000, '2026-01-01', 200000, 'Cashel line-4 yield (NPI-0331)', 100, null],
  ['seed_launch_ottava', 'OTTAVA Robotic Platform Kit', 'seed_franchise_digital_surgery', 'Class II', 'EU MDR', 'seed_market_de', 'P1', 'PRE_MARKET', 0, '2027-06-30', 0, null, 95, 24],
  ['seed_launch_puresee', 'TECNIS PureSee Toric IOL', 'seed_franchise_vision', 'Class III', 'PMA + EU MDR', 'seed_market_de', 'P3', 'ON_PLAN', 2300000, '2027-09-30', 2300000, 'Transit validation Seq. D failure (NPI-0359)', 83, null],
];
write('Launch', LAUNCHES.map(l => ({
  id: l[0], deviceName: l[1], franchise: ref(l[2]), deviceClass: l[3], regulatoryRoute: l[4],
  leadMarket: ref(l[5]), currentPhase: ref('seed_phase_' + l[6].toLowerCase()), healthStatus: l[7],
  revenueAtRisk: l[8], firstShipDate: l[9],
  readinessPct: l[12], ...(l[13] != null ? { scheduleFloatDays: l[13] } : {}),
})));
// display-name -> launch id (for market launches, findings)
const LNAME2ID = {
  'VARIPULSE G2': 'seed_launch_varipulse_g2', 'VARIPULSE Gen 2': 'seed_launch_varipulse_g2',
  'OCTARAY G2': 'seed_launch_octaray_g2', 'OCTARAY Gen 2': 'seed_launch_octaray_g2',
  'EMBOTRAP IV': 'seed_launch_embotrap_iv', 'Impella ECP+': 'seed_launch_impella_ecp',
  'Javelin XL': 'seed_launch_javelin_xl', 'ETHICON 4000+': 'seed_launch_ethicon_4000',
  'ETHICON 4000+ G4': 'seed_launch_ethicon_4000', 'DUALTO': 'seed_launch_dualto',
  'OTTAVA': 'seed_launch_ottava', 'PureSee Toric': 'seed_launch_puresee', 'TECNIS PureSee Toric': 'seed_launch_puresee',
};

/* ============================ PHASES ==================================== */
write('Phase', FLP.map((p, i) => ({
  id: 'seed_phase_' + p[0].toLowerCase(), code: p[0], name: decode(p[1]), window: decode(p[2]), state: p[3],
})));

/* ============================ AUTONOMY CLASSES ========================== */
write('AutonomyClass', [
  { id: 'seed_autonomy_a', code: 'A', shortLabel: 'Autonomous', description: 'Agent decides and executes, inside guardrails', requiresHumanDecision: false },
  { id: 'seed_autonomy_r', code: 'R', shortLabel: 'Recommend', description: 'Agent recommends, human decides', requiresHumanDecision: true },
  { id: 'seed_autonomy_h', code: 'H', shortLabel: 'Human-led', description: 'Human in the lead, not delegable', requiresHumanDecision: true },
]);

/* ============================ FUNCTIONAL DOMAINS ======================== */
// code -> [name, agentCode]
const DOMAINS = [
  ['gov', 'Governance', 'gov'], ['rnd', 'R&D / Design', 'rnd'], ['cli', 'Clinical', 'cli'],
  ['reg', 'Regulatory', 'reg'], ['qua', 'Quality', 'qua'], ['mfg', 'Manufacturing', 'mfg'],
  ['src', 'Sourcing', 'src'], ['sc', 'Supply Chain', 'sc'], ['com', 'Commercial', 'com'],
  ['ma', 'Market Access', 'ma'], ['it', 'IT / Digital', 'it'], ['fin', 'Finance', 'fin'],
];
write('FunctionalDomain', DOMAINS.map(d => ({
  id: 'seed_domain_' + d[0], code: d[0], name: d[1], agent: ref('seed_agent_' + d[2]),
})));

/* ============================ AGENTS ==================================== */
// OLANE: [code,name,desc,activityCount,state,phaseLoad]  + orchestrator + line monitor
const AGENTS = [];
OLANE.forEach(a => {
  AGENTS.push({
    id: 'seed_agent_' + a[0], code: a[0], name: decode(a[1]),
    autonomyBand: a[0] === 'orc' ? 'Routing only' : 'Autonomous within guardrails',
    toolsPermitted: decode(a[2]),
    escalationRules: 'Route to a human when a gate date moves or spend exceeds delegated authority',
    domain: a[0] === 'orc' ? null : ref('seed_domain_' + a[0]),
  });
});
AGENTS.push({
  id: 'seed_agent_line', code: 'line', name: 'Line Monitor agent',
  autonomyBand: 'Autonomous within guardrails', toolsPermitted: 'Reads MES / SPC signals from the lines',
  escalationRules: 'Raise to Quality on an SPC rule breach; stopping a supplier line is never autonomous',
  domain: ref('seed_domain_mfg'),
});
write('Agent', AGENTS);
// agent display-name (as used on the board) -> agent code
const AGENTNAME2CODE = {};
Object.keys(AL).forEach(k => { AGENTNAME2CODE[decode(AL[k])] = k; });

/* ============================ PEOPLE ==================================== */
const PEOPLE = [
  ['George Hall', 'Global NPI Lead', 'Governance', 'GH', false, 'hf'],
  ['M. Okafor', 'Sourcing Lead', 'Sourcing', 'MO', false],
  ['A. Kowalski', 'Quality Lead', 'Quality', 'AK', false],
  ['S. Lindqvist', 'Regulatory Affairs', 'Regulatory', 'SL', false],
  ['K. Tanaka', 'R&D Lead', 'R&D / Design', 'KT', false],
  ['L. Haugen', 'Manufacturing Lead', 'Manufacturing', 'LH', false],
  ['A. Patel', 'Supply Chain Lead', 'Supply Chain', 'AP', false],
  ['T. Bergmann', 'Commercial & Finance', 'Commercial', 'TB', false],
  ['D. Moreau', 'Market Access Lead', 'Market Access', 'DM', false],
  ['R. Mehta', 'IT / Digital Lead', 'IT / Digital', 'RM', false],
  ['J. Thomson', 'Clinical Lead', 'Clinical', 'JT', false],
  ['R. Devi', 'Logistics Lead', 'Supply Chain', 'RD', false],
  ['J. Ruiz', 'Legal Counsel', 'Finance', 'JR', false],
  ['the Launch Board', 'Collective decision body', 'Governance', '●', true, 'board'],
];
function pslug(p) { return 'seed_person_' + (p[5] || p[3].toLowerCase().replace(/[^a-z0-9]/g, '')); }
write('Person', PEOPLE.map(p => ({
  id: pslug(p), name: p[0], role: p[1], functionName: p[2], initials: p[3], isBoard: p[4],
})));
const OWNER2PERSON = {}; // "K. Tanaka" -> id
PEOPLE.forEach(p => { OWNER2PERSON[p[0]] = pslug(p); });
OWNER2PERSON['H. Fossi'] = 'seed_person_hf';

/* ============================ GATES + CRITERIA (VARIPULSE) ============== */
// FLG: {P1:[code,name,when,criteriaText,status],...}
// Pre-approval state: G3 baseline 04 Nov, forecast slipped to 21 Dec (the "do nothing" outcome,
// +47 days). The approve transaction re-baselines the forecast to 13 Nov (+9). The toast reads
// "G3 moved 21 Dec -> 13 Nov · slip 47 -> 9 days".
const GATE_BASE = { G3: '2026-11-04', G4: '2027-05-18', G5: '2027-06-29', G1: '2024-09-24', G2: '2026-06-19' };
const GATE_FORE = { G3: '2026-12-21', G4: '2027-05-18', G5: '2027-06-29', G1: '2024-09-24', G2: '2026-06-19' };
const gates = [], criteria = [];
Object.keys(FLG).forEach(ph => {
  const g = FLG[ph];
  const code = g[0];
  const base = GATE_BASE[code], fore = GATE_FORE[code];
  const slip = base && fore ? Math.round((new Date(fore) - new Date(base)) / 86400000) : 0;
  gates.push({
    id: 'seed_gate_varipulse_' + code.toLowerCase(), code, name: decode(g[1]),
    baselineDate: base, forecastDate: fore, slipDays: slip, status: g[4],
    launch: ref('seed_launch_varipulse_g2'), phase: ref('seed_phase_' + ph.toLowerCase()),
  });
});
// G3 the only one with an outstanding criterion (sterilisation validation)
criteria.push({
  id: 'seed_gc_varipulse_g3_sterilisation', name: 'ISO 11135 sterilisation validation report', met: false,
  outstandingReason: 'EO sterilisation validation slot cancelled; report slips to 19 Dec (NPI-0417)',
  gate: ref('seed_gate_varipulse_g3'), evidence: ref('seed_doc_varipulse_44'),
});
['Design verification complete', 'Design validation complete', 'Clinical evaluation report approved',
 'EU MDR Technical Documentation 96% complete', 'Risk management file current'].forEach((n, i) => {
  criteria.push({
    id: 'seed_gc_varipulse_g3_' + (i + 1), name: n, met: true, gate: ref('seed_gate_varipulse_g3'),
  });
});

/* Gates for the other eight launches, ported verbatim from the prototype's
 * "Key Milestones & Status" timeline (§2.4). Each entry: [code, name, baseline,
 * forecast, status]. Baseline is omitted (null) for gates the prototype shows
 * as a single on-plan/future marker with no slip. slipDays is derived from the
 * two dates. Phase is mapped G1→P1 … G5→P5, BAU→P6. */
const OTHER_GATES = {
  seed_launch_embotrap_iv: [
    ['G5', 'Launch Go / No-Go — First Ship', '2026-09-17', '2026-09-26', 'late'],
    ['BAU', 'BAU handover', null, '2026-10-30', 'no'],
  ],
  seed_launch_ethicon_4000: [
    ['G4', 'Clearance / CE Certificate', '2026-10-12', '2026-11-02', 'late'],
    ['G5', 'Launch Go / No-Go — First Ship', null, '2026-12-14', 'no'],
  ],
  seed_launch_octaray_g2: [
    ['G2', 'Design Freeze', '2026-09-16', '2026-09-30', 'late'],
    ['G3', 'Submission Commit', null, '2027-03-15', 'no'],
    ['G4', 'Clearance / CE Certificate', null, '2027-08-15', 'no'],
  ],
  seed_launch_puresee: [
    ['G3', 'Submission Commit', '2026-11-03', '2026-11-14', 'late'],
    ['G4', 'Clearance / CE Certificate', null, '2027-06-15', 'no'],
  ],
  seed_launch_impella_ecp: [
    ['G2', 'Design Freeze', null, '2027-01-19', 'no'],
    ['G3', 'Submission Commit', null, '2027-09-15', 'no'],
  ],
  seed_launch_javelin_xl: [
    ['G3', 'Submission Commit', null, '2027-03-12', 'no'],
    ['G4', 'Clearance / CE Certificate', null, '2027-11-15', 'no'],
  ],
  seed_launch_ottava: [
    ['G4', 'Clearance / CE Certificate', null, '2027-02-08', 'no'],
    ['G5', 'Launch Go / No-Go — First Ship', null, '2027-04-14', 'no'],
  ],
  seed_launch_dualto: [
    ['G5', 'Launch Go / No-Go — First Ship', null, '2026-08-12', 'ok'],
    ['BAU', 'BAU handover', null, '2026-10-30', 'no'],
  ],
};
const GATE2PHASE = { G1: 'p1', G2: 'p2', G3: 'p3', G4: 'p4', G5: 'p5', BAU: 'p6' };
Object.keys(OTHER_GATES).forEach(lid => {
  const slug = lid.replace('seed_launch_', '');
  OTHER_GATES[lid].forEach(g => {
    const [code, name, base, fore, status] = g;
    const slip = base && fore ? Math.round((new Date(fore) - new Date(base)) / 86400000) : 0;
    gates.push({
      id: 'seed_gate_' + slug + '_' + code.toLowerCase(), code, name,
      baselineDate: base || fore, forecastDate: fore, slipDays: slip, status,
      launch: ref(lid), phase: ref('seed_phase_' + GATE2PHASE[code]),
    });
  });
});

write('Gate', gates);
write('GateCriterion', criteria);

/* ============================ ACTIVITIES (107, VARIPULSE) =============== */
// FLA row: [statusCode, phase, index, domainCode, name, domainLabel, owner, autonomyCls, badge, statusLabel, detail]
const AUT = { a: 'seed_autonomy_a', r: 'seed_autonomy_r', h: 'seed_autonomy_h' };
const activities = FLA.map((a, i) => {
  const [sc, ph, idx, dom, name, domLabel, owner, aut, badge, stLabel, detail] = a;
  const isAgent = owner === 'Agent';
  return {
    id: `seed_activity_varipulse_${ph.toLowerCase()}_${idx}`,
    name: decode(name), status: decode(stLabel), statusCode: sc, detail: decode(detail),
    phase: ref('seed_phase_' + ph.toLowerCase()), domain: ref('seed_domain_' + dom),
    launch: ref('seed_launch_varipulse_g2'), autonomyClass: ref(AUT[aut]),
    owningPerson: isAgent ? null : ref(OWNER2PERSON[owner] || null),
    owningAgent: isAgent ? ref('seed_agent_' + dom) : null,
  };
});
write('Activity', activities);
// reconciliation asserts (invariants §3.6.7 / 3.6.8)
const byPhase = {}, byStatus = {}, byAut = {};
FLA.forEach(a => { byPhase[a[1]] = (byPhase[a[1]] || 0) + 1; byStatus[a[0]] = (byStatus[a[0]] || 0) + 1; byAut[a[7]] = (byAut[a[7]] || 0) + 1; });
console.log('  reconcile byPhase', byPhase, 'byStatus', byStatus, 'byAutonomy', byAut, 'total', FLA.length);

/* ============================ MARKETS (22) ============================== */
const MREG = {
  US: ['FDA', 'FDA PMA + 510(k) / CMS'], CA: ['Health Canada', 'Health Canada MDL / provincial'],
  BR: ['ANVISA', 'ANVISA registration'], UK: ['MHRA / NICE', 'UKCA + EU MDR / NHS Supply Chain'],
  ES: ['AEMPS', 'EU MDR / regional tenders'], FR: ['HAS / CEPS', 'EU MDR / HAS / CEPS'],
  DE: ['G-BA', 'EU MDR / G-BA'], IT: ['AIFA', 'EU MDR / AIFA device register'],
  IN: ['CDSCO', 'CDSCO / state tenders'], CN: ['NMPA', 'NMPA / volume-based procurement'],
  JP: ['PMDA / Chuikyo', 'PMDA / Chuikyo listing'], AU: ['TGA', 'TGA / Prostheses List'],
  MX: ['COFEPRIS', 'COFEPRIS / IMSS & ISSSTE'], AR: ['ANMAT', 'ANMAT / provincial tenders'],
  NL: ['EU MDR', 'EU MDR / hospital purchasing groups'], SE: ['EU MDR', 'EU MDR / regional procurement'],
  PL: ['AOTMiT', 'EU MDR / AOTMiT appraisal'], TR: ['TİTCK / SGK', 'TİTCK / SGK reimbursement'],
  AE: ['MoHAP & DoH Abu Dhabi', 'MoHAP & DoH Abu Dhabi registration'], ZA: ['SAHPRA', 'SAHPRA / private group contracting'],
  KR: ['MFDS / HIRA', 'MFDS / HIRA reimbursement'], SG: ['HSA', 'HSA / public healthcare cluster tenders'],
};
const MLL = {
  US: [38.9, -77], CA: [45.4, -75.7], BR: [-15.8, -47.9], UK: [51.5, -0.1], ES: [40.4, -3.7],
  FR: [48.9, 2.3], DE: [52.5, 13.4], IT: [41.9, 12.5], IN: [28.6, 77.2], CN: [39.9, 116.4],
  JP: [35.7, 139.7], AU: [-35.3, 149.1], MX: [19.4, -99.1], AR: [-34.6, -58.4], NL: [52.4, 4.9],
  SE: [59.3, 18.1], PL: [52.2, 21.0], TR: [39.9, 32.9], AE: [24.5, 54.4], ZA: [-25.7, 28.2],
  KR: [37.6, 127.0], SG: [1.35, 103.8],
};
const LAUNCH_MK = ['US', 'CA', 'BR', 'UK', 'ES', 'FR', 'DE', 'IT', 'IN', 'CN', 'JP', 'AU'];
const REG_MK = ['MX', 'AR', 'NL', 'SE', 'PL', 'TR', 'AE', 'ZA', 'KR', 'SG'];
const markets = [];
LAUNCH_MK.concat(REG_MK).forEach(code => {
  const isLaunch = LAUNCH_MK.includes(code);
  const reg = MREG[code] || ['', ''];
  const tw = MKT[code] && /tender/i.test(decode(MKT[code].reg)) ? decode(MKT[code].reg) : '';
  const wave = isLaunch ? 'Launch' : (MKS[code] ? decode(MKS[code][2]) : 'Registration');
  markets.push({
    id: 'seed_market_' + code.toLowerCase(), code, name: decode(MKN[code]),
    regulatoryBody: reg[0], regulatoryRoute: reg[1], tier: isLaunch ? 'LAUNCH' : 'REGISTRATION',
    tenderWindows: code === 'DE' ? 'Q2 and Q4' : tw, wave,
    latitude: MLL[code][0], longitude: MLL[code][1],
  });
});
write('Market', markets);

/* ============================ MARKET LAUNCHES =========================== */
const mls = [];
Object.keys(MKT).forEach(code => {
  (MKT[code].l || []).forEach(row => {
    const lname = decode(row[0]).replace(/ G4$/, '');
    const lid = LNAME2ID[decode(row[0])] || LNAME2ID[lname];
    if (!lid) return;
    mls.push({
      id: `seed_ml_${lid.replace('seed_launch_', '')}_${code.toLowerCase()}`,
      launch: ref(lid), market: ref('seed_market_' + code.toLowerCase()),
      firstShipQuarter: decode(row[1]), status: row[2] || 'ok',
      reimbursementStatus: '',
    });
  });
});
write('MarketLaunch', mls);

/* ============================ SUPPLIERS + supply chain ================= */
write('Supplier', [
  { id: 'seed_supplier_steris', name: 'Steris Venlo', approvalStatus: 'APPROVED', auditValidUntil: '2027-12-31', financialRiskRating: 'Low', singleSourceFlag: false },
  { id: 'seed_supplier_sterigenics', name: 'Sterigenics Grand Rapids', approvalStatus: 'APPROVED', auditValidUntil: '2028-03-22', financialRiskRating: 'Low', singleSourceFlag: false },
  { id: 'seed_supplier_heraeus', name: 'Heraeus Medical Components', approvalStatus: 'CONDITIONAL', auditValidUntil: '2027-06-30', financialRiskRating: 'High', singleSourceFlag: true },
  { id: 'seed_supplier_bsi', name: 'BSI (Notified Body)', approvalStatus: 'APPROVED', auditValidUntil: '2028-01-31', financialRiskRating: 'Low', singleSourceFlag: false },
]);
write('Site', [
  { id: 'seed_site_venlo', name: 'Steris Venlo EO facility', location: 'Venlo, NL', capabilities: 'EO sterilisation', capacityAvailableFrom: '2026-11-28', supplier: ref('seed_supplier_steris') },
  { id: 'seed_site_grandrapids', name: 'Sterigenics Grand Rapids', location: 'Grand Rapids, US', capabilities: 'EO sterilisation', capacityAvailableFrom: '2026-09-29', supplier: ref('seed_supplier_sterigenics') },
  { id: 'seed_site_cashel', name: 'Cashel', location: 'Cashel, IE', capabilities: 'Device manufacturing', capacityAvailableFrom: '2026-09-01', supplier: ref('seed_supplier_heraeus') },
  { id: 'seed_site_neuss', name: 'Neuss', location: 'Neuss, DE', capabilities: 'Ring electrode subassembly; sterilisation lane', capacityAvailableFrom: '2026-09-15', supplier: ref('seed_supplier_heraeus') },
]);
write('QualifiedProcess', [
  { id: 'seed_qp_grandrapids_eo', processType: 'EO sterilisation', qualifiedForLaunches: 'OCTARAY G2, EMBOTRAP IV', qualificationDepth: 'half-cycle', site: ref('seed_site_grandrapids') },
  { id: 'seed_qp_venlo_eo', processType: 'EO sterilisation', qualifiedForLaunches: 'VARIPULSE G2', qualificationDepth: 'full', site: ref('seed_site_venlo') },
  { id: 'seed_qp_neuss_electrode', processType: 'Ring electrode subassembly', qualifiedForLaunches: 'VARIPULSE G2, OCTARAY G2', qualificationDepth: 'full', site: ref('seed_site_neuss') },
]);
write('ContractTerm', [
  { id: 'seed_contract_steris_73', clauseRef: 'Master agreement clause 7.3', capacityCommitment: 'NON_COMMITTED', noticePeriodDays: 30, penaltyAvailable: false, summary: 'Non-committed capacity reservation, reallocable on 30 days notice, no claim and no penalty — the root cause of NPI-0417.', supplier: ref('seed_supplier_steris') },
  { id: 'seed_contract_sterigenics_committed', clauseRef: 'Proposed committed-capacity clause', capacityCommitment: 'COMMITTED', noticePeriodDays: 90, penaltyAvailable: true, summary: 'Corrective action: replace the non-committed reservation with committed capacity at a permanently qualified second source.', supplier: ref('seed_supplier_sterigenics') },
]);
write('BillOfMaterialItem', [
  { id: 'seed_bom_ring_electrode', partName: 'Ring electrode subassembly', sourcingMode: 'SINGLE_SOURCE', frozenAtGate: 'G2', launch: ref('seed_launch_varipulse_g2'), supplier: ref('seed_supplier_heraeus') },
]);

/* ============================ GUARDRAILS ================================ */
write('Guardrail', [
  { id: 'seed_guardrail_gate_date', name: 'Gate-date authority', rule: 'Any action that moves a gate date must be decided by a human.', scope: 'Portfolio', breachCount: 0 },
  { id: 'seed_guardrail_spend', name: 'Spend authority', rule: 'Spend above the delegated authority threshold must be decided by a human.', scope: 'Portfolio', breachCount: 0 },
  { id: 'seed_guardrail_supplier_line', name: 'Supplier-line stop', rule: 'The fleet cannot stop a supplier line on its own.', scope: 'Sourcing / Quality', breachCount: 0 },
  { id: 'seed_guardrail_supply_arch', name: 'Supply-architecture change', rule: 'Changing the supply architecture (e.g. activating a second source) is not autonomous.', scope: 'Sourcing', breachCount: 0 },
  { id: 'seed_guardrail_reversible', name: 'Reversibility window', rule: 'Autonomous actions must be reversible for 24h and logged.', scope: 'Portfolio', breachCount: 0 },
  { id: 'seed_guardrail_dossier', name: 'Dossier integrity', rule: 'A dossier shift must be checked against the Notified Body review window before proposal.', scope: 'Regulatory', breachCount: 0 },
]);

/* ============================ FINDINGS / CHAINS / ACTIONS =============== */
const OUT2FINDING = { you: 'USER', held: 'HELD', auto: 'AUTO', run: 'RUNNING' };
const OUT2HELDBY = { you: 'USER', esc: 'ESCALATED', del: 'DELEGATED', agent: 'AGENT' };
const CAT2 = { ct: 'ct', rk: 'rk', ok: 'ok' };
// chain lookup by finding key
const CHAIN_BY_KEY = {};
OCH.forEach(c => { if (c.k) CHAIN_BY_KEY[c.k] = c; });

const findings = [], chains = [], actions = [], handoffs = [], gchecks = [], comments = [];
const decisions = [], options = [], escalations = [], escEvents = [], capas = [], tasks = [], notifications = [], dhf = [];

// exposure parse from PEEK.r (e.g. "&euro;18.4M")
function parseEuro(s) {
  if (!s) return 0;
  const m = /€\s*([\d.]+)\s*M/.exec(decode(s));
  return m ? Math.round(parseFloat(m[1]) * 1000000) : 0;
}

IZ.forEach(z => {
  const key = z.id.replace('I-', '');
  const issue = ISSUE[key] || {};
  const peek = PEEK[key] || {};
  const hold = HOLD[key] || {};
  const prob = PROB[key] || {};
  const cur = z.steps[z.step - 1];
  const firstAgent = z.steps[0][0];
  const otherLaunchIds = (z.pr || []).map(p => LNAME2ID[p]).filter(Boolean);
  const primaryLaunch = otherLaunchIds[0] || 'seed_launch_varipulse_g2';
  const fid = 'seed_finding_' + key;
  findings.push({
    id: fid, displayId: 'NPI-0' + key,
    headline: decode(cur[1]),                       // the action in flight (spec §2.2.2)
    description: decode(issue.t || z.found),
    signalSource: decode((prob.f && prob.f[0] && prob.f[0][1]) || z.found),
    detectedAt: (prob.f && prob.f[0] && parseDate(prob.f[0][1])) || null,
    outcome: OUT2FINDING[z.out], category: ['ct', 'rk', 'ok'].includes(issue.cat) ? issue.cat : 'rk',
    phase: ref('seed_phase_' + z.ph.toLowerCase()),
    launch: ref(primaryLaunch),
    otherLaunches: otherLaunchIds.slice(1).map(ref),
    detectedBy: ref('seed_agent_' + firstAgent),
  });
});

// IZ carries the canonical elapsed markers (relative to LGNOW) per finding+agent;
// OCH carries the rich chain prose. Map the two so each OCH action gets a real
// absolute occurredAt (§2.3 — the activity log is timestamped, never elapsed-only §6).
const CHAIN2KEY = { 'CHN-09': '417', 'CHN-08': '402', 'CHN-07': '388', 'CHN-06': '371', 'CHN-05': '365', 'CHN-04': '344', 'CHN-03': '303', 'CHN-02': '331', 'CHN-01': '328' };
let CH03 = null; try { CH03 = extractVar('CH03'); } catch (e) { /* optional */ }
const IZ_ELAPSED = {}; // key -> { agentCode: elapsedLabel }
IZ.concat(CH03 ? [CH03] : []).forEach(z => {
  const k = z.id.replace('I-', ''); IZ_ELAPSED[k] = {};
  z.steps.forEach(s => { if (s[0] !== 'you') IZ_ELAPSED[k][s[0]] = s[3]; });
});
OCH.forEach(c => {
  const cid = 'seed_chain_' + c.id.toLowerCase().replace(/-/g, '');
  const fid = c.k ? 'seed_finding_' + c.k : null;
  const seq = c.seq || [];
  const key = CHAIN2KEY[c.id];
  const elapsedMap = IZ_ELAPSED[key] || {};
  // minutes-ago for each step: from IZ where available, else interpolate for orc-close
  const stepMins = (c.st || []).map(s => {
    const e = elapsedMap[s.a];
    return e != null ? agoMins(e) : null;
  });
  // orchestrator / unmapped steps close just after the last mapped step (more recent)
  const mapped = stepMins.filter(m => m != null);
  const minMapped = mapped.length ? Math.min(...mapped) : 0;
  for (let i = 0; i < stepMins.length; i++) {
    if (stepMins[i] == null) stepMins[i] = Math.max(0, minMapped - (stepMins.length - i));
  }
  const stamps = stepMins.map(m => {
    const d = new Date(LGNOW.getTime() - m * 60000);
    return isoDate(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes());
  });
  chains.push({
    id: cid, title: decode(c.t), handoffCount: Math.max(0, seq.length - 1),
    outcome: OUT2FINDING[{ r: 'you', h: 'held', a: 'auto' }[c.o]] || 'HELD',
    startedAt: stamps[0] || null, closedAt: stamps[stamps.length - 1] || null, finding: ref(fid),
  });
  (c.st || []).forEach((s, i) => {
    const delta = (s.d || []);
    actions.push({
      id: `${cid}_a${i + 1}`, sequence: i + 1, occurredAt: stamps[i],
      verb: decode(s.s), detail: decode(s.p), stateLabel: decode(s.s),
      handoffPrompt: decode(s.h || ''), completed: true,
      deltaBefore: delta.length ? delta.map(r => `${decode(r[0])}: ${decode(r[1])}`).join('; ') : '',
      deltaAfter: delta.length ? delta.map(r => `${decode(r[0])}: ${decode(r[2])} (${decode(r[3])})`).join('; ') : '',
      outcome: i === (c.st.length - 1) ? (OUT2FINDING[{ r: 'you', h: 'held', a: 'auto' }[c.o]] || '') : '',
      chain: ref(cid), agent: ref('seed_agent_' + s.a),
    });
    // handoff to next agent when a prompt names one
    if (s.h && seq[i + 1]) {
      handoffs.push({
        id: `${cid}_h${i + 1}`, fromAgent: ref('seed_agent_' + s.a), toAgent: ref('seed_agent_' + seq[i + 1]),
        reasonAsked: decode(s.h), handedAt: stamps[i], chain: ref(cid),
      });
    }
  });
});
// The Line Monitor agent opens CHN-02 (I-331) — IZ records line → mfg → qua → sc,
// but OCH's chain narrative abbreviates the opening detection away. Restore it so the
// fleet's 14th agent appears in the log and the chain matches the finding's own record.
(() => {
  const cid = 'seed_chain_chn02';
  if (!chains.some(c => c.id === cid)) return; // CHN-02 is post-market — dropped above
  const lineMins = agoMins('1d') + 2; // just before the mfg step (also 1d)
  const d = new Date(LGNOW.getTime() - lineMins * 60000);
  const stamp = isoDate(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes());
  // renumber the existing CHN-02 actions to sit after the line detection
  actions.filter(a => a.chain.id === cid).forEach(a => { a.sequence += 1; });
  actions.push({
    id: `${cid}_a0`, sequence: 1, occurredAt: stamp,
    verb: 'DETECTED THE PARAMETER DRIFT', detail: 'MES data, 14 lots — cavity-6 tooling wear on Cashel line 4.',
    stateLabel: 'DETECTED', handoffPrompt: 'Manufacturing agent — “is this affecting yield?”',
    completed: true, deltaBefore: '', deltaAfter: '', outcome: '',
    chain: ref(cid), agent: ref('seed_agent_line'),
  });
  const c2 = chains.find(c => c.id === cid);
  if (c2) { c2.startedAt = stamp; c2.handoffCount += 1; }
  handoffs.push({
    id: `${cid}_h0`, fromAgent: ref('seed_agent_line'), toAgent: ref('seed_agent_mfg'),
    reasonAsked: 'Manufacturing agent — “is this affecting yield?”', handedAt: stamp, chain: ref(cid),
  });
})();

// ── Board-card step timelines for findings without an OCH chain (§2.2) ──
// The live board's per-card timeline is the IZ work list: every finding shows the
// steps the fleet has already run, each stamped with the hour it happened, ending
// on the step in flight (or the decision handed to you). Nine findings get their
// timeline from the rich OCH chains above; the remaining four (I-412, I-359, I-351,
// I-319) are IZ-only, so seed a lightweight chain + actions from IZ for them so
// their card is never blank. Timestamps stay absolute (§6) — elapsed → clock time.
const OCH_KEYS = new Set(Object.values(CHAIN2KEY)); // finding keys already covered by an OCH chain
IZ.forEach(z => {
  const key = z.id.replace('I-', '');
  if (OCH_KEYS.has(key)) return;                    // already has a rich chain
  const cid = 'seed_chain_iz' + key;
  const fid = 'seed_finding_' + key;
  const lastIdx = z.step - 1;                       // 0-based index of the step in flight
  const nowStamp = isoDate(LGNOW.getFullYear(), LGNOW.getMonth(), LGNOW.getDate(), LGNOW.getHours(), LGNOW.getMinutes());
  const stamps = z.steps.map(s => stampFromAgo(s[3]) || nowStamp);
  const agentSteps = z.steps.filter(s => s[0] !== 'you').length;
  chains.push({
    id: cid, title: decode(z.found),
    handoffCount: Math.max(0, agentSteps - 1),
    outcome: OUT2FINDING[z.out],
    startedAt: stamps[0] || null,
    closedAt: stamps[stamps.length - 1] || null,
    finding: ref(fid),
  });
  z.steps.forEach((s, i) => {
    const isYou = s[0] === 'you';
    const inFlight = (i === lastIdx) && (z.out === 'run'); // the running step is not yet completed
    actions.push({
      id: `${cid}_a${i + 1}`, sequence: i + 1, occurredAt: stamps[i],
      verb: decode(s[1]), detail: decode(s[2]), stateLabel: decode(s[1]),
      handoffPrompt: '', completed: !isYou && !inFlight,
      deltaBefore: '', deltaAfter: '',
      outcome: (i === z.steps.length - 1 && !isYou && z.out === 'auto') ? OUT2FINDING[z.out] : '',
      chain: ref(cid),
      agent: isYou ? null : ref('seed_agent_' + s[0]),
    });
  });
});

// guardrail checks — 6 for the anchor 417, plus a PASS per autonomously-closed finding
const G417 = [
  ['Gate date moves?', 'no autonomous gate move', 'G3 shifts 9 days — routed to a human', 'seed_guardrail_gate_date'],
  ['Spend within authority?', '≤ delegated authority', '€340k — routed to a human', 'seed_guardrail_spend'],
  ['Second site approved & audited?', 'approved + audit current', 'Sterigenics approved, audit to Mar 2028', 'seed_guardrail_supply_arch'],
  ['Modality unchanged?', 'same modality', 'EO unchanged — half-cycle revalidation', 'seed_guardrail_dossier'],
  ['BSI review window holds?', 'dossier complete before slot', 'holds at +9 days', 'seed_guardrail_dossier'],
  ['Action reversible & logged?', 'reversible 24h', 'reversible for 24h, logged', 'seed_guardrail_reversible'],
];
G417.forEach((g, i) => {
  gchecks.push({
    id: `seed_gcheck_417_${i + 1}`, name: g[0], threshold: g[1], observed: g[2], result: 'PASS',
    evaluatedAt: '2026-09-11T08:23:00', finding: ref('seed_finding_417'), guardrail: ref(g[3]), runBy: ref('seed_agent_reg'),
  });
});
// A PASS guardrail check per autonomously-closed finding. 331/328 were post-market
// (dropped above); 319 (Javelin XL field-force) is the only in-flight AUTO close left.
['319'].forEach((k, i) => {
  gchecks.push({
    id: `seed_gcheck_${k}_1`, name: 'Known root cause + dated fix?', threshold: 'both present', observed: 'both present — inside guardrails', result: 'PASS',
    evaluatedAt: '2026-09-10T20:00:00', finding: ref('seed_finding_' + k), guardrail: ref('seed_guardrail_reversible'), runBy: ref('seed_agent_' + IZ.find(z => z.id === 'I-' + k).steps[0][0]),
  });
});

/* ---- Decisions (open) --------------------------------------------------- */
// USER: 417,402,388,371 ; ESCALATED: 365,344 ; DELEGATED: 351,359 ; AGENT: 319
// (331/328 were post-market DUALTO closes — dropped above with IZ/OCH.)
const DEC_HELD = { '417': 'USER', '402': 'USER', '388': 'USER', '371': 'USER', '365': 'ESCALATED', '344': 'ESCALATED', '351': 'DELEGATED', '359': 'DELEGATED', '319': 'AGENT' };
const DEC_THRESH = { '417': '€250k / no gate move', '402': '€1.5M write-off', '388': 'supply architecture', '371': 'design-input signature' };
/* Decision-row display copy (§2.1 pending queue), verbatim from the prototype's
   .dr rows (HTML §BRANCH 3A). Attested strings on the domain type per §3.6.1 —
   the row would otherwise render id + title only, with no meta/recommendation. */
const DEC_DISPLAY = {
  '417': {
    meta: 'VARIPULSE G2 · G3 Submission Commit · +47 days · €18.4M at risk',
    agentRecommendation: 'Agent recommends dual-source to Sterigenics — recovers 38 of the 47 days · 3 options modelled',
    dueLabel: 'Due today · 17:00', dueTagClass: 'crit', functionsLabel: 'Sourcing · Quality · Regulatory', ctaEmphasis: 'primary',
  },
  '402': {
    meta: 'VARIPULSE G2 · G4 CE Certificate · €2.8M write-off exposure · above your €1.5M authority',
    agentRecommendation: 'Agent recommends a phased 2,600 units — caps exposure at €1.7M and holds the G5 date',
    dueLabel: 'Due 13 Sep', dueTagClass: 'crit', functionsLabel: 'Manufacturing · Finance', ctaEmphasis: 'primary',
  },
  '388': {
    meta: 'OCTARAY G2 and 3 others · G2 Design Freeze · 19 days float · €6.2M if realised',
    agentRecommendation: 'Agent recommends activating the second source before G2 — after the gate the same move costs 11 weeks',
    dueLabel: 'Due 16 Sep', dueTagClass: 'risk', functionsLabel: 'Sourcing', ctaEmphasis: 'secondary',
  },
  '371': {
    meta: 'OCTARAY G2 · G2 Design Freeze · 12 of 14 inputs signed · +14 days if unsigned',
    agentRecommendation: 'IEC 62366 usability and ASTM D4169 transit summaries already drafted and traced to the input matrix',
    dueLabel: 'Due 18 Sep', dueTagClass: 'risk', functionsLabel: 'R&D · Quality', ctaEmphasis: 'secondary',
  },
};
Object.keys(DEC_HELD).forEach(key => {
  const hold = HOLD[key] || {};
  const due = DUE[key];
  const disp = DEC_DISPLAY[key] || {};
  decisions.push({
    id: 'seed_decision_' + key, heldBy: DEC_HELD[key],
    dueAt: due ? (due === 'Today 17:00' ? '2026-09-11T17:00:00' : parseDate(due)) : null,
    authorityThreshold: DEC_THRESH[key] || '', selectedOption: null, approvedAt: null,
    queueMetaLabel: disp.meta || null, agentRecommendation: disp.agentRecommendation || null,
    dueLabel: disp.dueLabel || null, dueTagClass: disp.dueTagClass || null,
    functionsLabel: disp.functionsLabel || null, ctaEmphasis: disp.ctaEmphasis || null,
    finding: ref('seed_finding_' + key), owner: ref('seed_person_hf'),
  });
});

/* ---- Decision options --------------------------------------------------- */
// 417 — the three modelled options (option cards + OPTSUM)
const OPT417 = [
  ['a', 'Dual-source to Sterigenics Grand Rapids', 'Half-cycle revalidation at an approved site, same modality', 38, '+9d instead of +47', 340000, 'G3 to 13 Nov (+9d), BSI slot retained', 18400000, 'None — BSI slot retained', true, 'High', 'Site already approved, modality unchanged, OCTARAY G2 precedent to reuse', 'Medium'],
  ['b', 'Switch modality to X-ray at Marcoule', 'Needs biocompatibility bridging and a dossier rewrite', -15, '+62d', 1100000, 'BSI Q4 slot forfeited', 14700000, 'BSI Q4 window, €3.7M', false, 'Low', 'Different modality means full requalification', 'High'],
  ['c', 'Re-sequence — US first, EU wave 2', 'Irvine steriliser is unaffected; needs a G1 decision reversal', 0, '+78d in EU, none in US', 0, 'BSI Q4 slot forfeited; needs a G1 reversal', 11200000, 'Two EU tender windows; €7.2M moved to FY28', false, 'Medium', 'Irvine in-house EO unaffected, but unwinds a gate decision', 'Low'],
];
OPT417.forEach(o => options.push({
  id: 'seed_option_417_' + o[0], optionKey: o[0], label: o[1], subLabel: o[2], daysRecovered: o[3],
  slipLabel: o[4], cost: o[5], gateImpact: o[6], revenueKept: o[7], forfeits: o[8], recommended: o[9],
  confidence: o[10], basis: o[11], riskBand: o[12], decision: ref('seed_decision_417'),
}));
// 402 — three build volumes (CHN-08)
const OPT402 = [
  ['a', 'Phased 2,600 units', 'Caps exposure at €1.7M, covers first 9 weeks in DE and FR, holds G5', 1700000, true, 'Medium'],
  ['b', 'Full 4,200 units', 'Full launch cover but €2.8M write-off exposure', 2800000, false, 'High'],
  ['c', '1,400 units', '€0.9M exposure but stocks out in week 5', 900000, false, 'Low'],
];
OPT402.forEach(o => options.push({
  id: 'seed_option_402_' + o[0], optionKey: o[0], label: o[1], subLabel: o[2], cost: o[3],
  recommended: o[4], riskBand: o[5], gateImpact: 'Holds G5 First Ship', revenueKept: 0,
  decision: ref('seed_decision_402'), basis: 'Modelled against P50 demand',
}));
// 388, 371 — single recommended options
options.push({ id: 'seed_option_388_a', optionKey: 'a', label: 'Activate the qualified second source before the G2 freeze', subLabel: 'Document change now vs 11 weeks of change control after G2', recommended: true, confidence: 'High', basis: 'BOM trace machine-read from the released DMR', riskBand: 'Low', gateImpact: 'Protects G2 Design Freeze', decision: ref('seed_decision_388') });
options.push({ id: 'seed_option_371_a', optionKey: 'a', label: 'Review and sign the two design inputs', subLabel: 'Both drafts traced to the input matrix; no criteria waived', recommended: true, confidence: 'High', basis: 'IEC 62366 + ASTM D4169 evidence complete', riskBand: 'Low', gateImpact: 'G2 closes on schedule', decision: ref('seed_decision_371') });
write('DecisionOption', options);

/* ---- Escalations (365, 344) -------------------------------------------- */
[['365', 'S. Lindqvist', 'Regulatory Affairs'], ['344', 'the Launch Board', 'tabled for 24 Sep']].forEach(([key, who, role]) => {
  const h = HOLD[key];
  escalations.push({
    id: 'seed_escalation_' + key, raisedBy: ref('seed_person_hf'), raisedAt: parseDate(h.since),
    assignedTo: ref(OWNER2PERSON[who] || null), assigneeRole: decode(role), reason: decode(h.why), status: 'Open', immutableUpward: true,
    decision: ref('seed_decision_' + key),
  });
  (h.chain || []).forEach((c, i) => escEvents.push({
    id: `seed_escevent_${key}_${i + 1}`, sequence: i + 1, label: decode(c[0]),
    state: ['done', 'now', 'pending'].includes(c[2]) ? c[2] : 'pending',
    occurredAt: c[1] && c[1] !== '—' ? parseDate(c[1]) : null,
    escalation: ref('seed_escalation_' + key),
  }));
});
write('Escalation', escalations);
write('EscalationEvent', escEvents);

/* ---- CAPAs -------------------------------------------------------------- */
capas.push({
  id: 'seed_capa_0148', capaId: 'CAPA-2026-0148', openedAgainstProcess: 'Supplier-managed EO sterilisation (Steris Venlo)',
  openedBy: 'Quality agent', openedAt: '2026-09-11T06:05:00',
  containmentAction: 'Dual-source the validation lot to Sterigenics Grand Rapids (half-cycle revalidation).',
  correctiveAction: 'Qualify Sterigenics permanently as second source; replace the non-committed reservation with a committed-capacity clause.',
  effectivenessCheck: 'Validation report delivered by 06 Nov, ahead of the gate.', effectivenessDueDate: '2026-11-06',
  status: 'OPEN', finding: ref('seed_finding_417'), launch: ref('seed_launch_varipulse_g2'), closedByDecision: null,
});
capas.push({ id: 'seed_capa_0151', capaId: 'CAPA-2026-0151', openedAgainstProcess: 'Transit packaging (ASTM D4169 Seq. D)', openedBy: 'Quality agent', openedAt: '2026-09-06T16:44:00', containmentAction: 'Redesign the thermoform insert; re-test 14 Sep.', status: 'CONTAINED', finding: ref('seed_finding_359'), launch: ref('seed_launch_puresee') });
// CAPA-2026-0139 (Cashel cavity-6 wear, DUALTO/NPI-0331) removed — post-market, out of launch-control scope.
write('CAPA', capas);

/* ---- Action plan tasks (417 — all 3 option plans) ---------------------- */
['a', 'b', 'c'].forEach(optKey => {
  const plan = ACTS[optKey];
  (plan.rows || []).forEach((r, i) => {
    const isAg = r[0] === 'ag';
    tasks.push({
      id: `seed_task_417_${optKey}_${i + 1}`, name: decode(r[2]), owner: isAg ? decode(r[3]).split('·')[0].trim() : decode(r[1]),
      detail: decode(r[3]), agentRunnable: isAg, optionKey: optKey, status: 'Not started',
      dueDate: r[4] && /\d/.test(r[4]) ? parseDate(r[4]) : null, decision: ref('seed_decision_417'),
    });
  });
});
write('ActionPlanTask', tasks);

/* ---- Comments (escalation threads) ------------------------------------- */
// 417 hardcoded thread (from the HTML markup)
const T417 = [
  ['M. Okafor', 'Sourcing', '2026-09-10T19:40:00', 'Steris have cancelled our 12 Oct slot. I pushed back on the phone — they have a genuine chamber deviation and cannot hold it. Nothing earlier across Venlo, Petten or Daventry. Escalating because this is the validation lot, not a routine cycle.', false, ''],
  ['Sourcing agent', 'Automated check', '2026-09-11T06:05:00', 'Checked the master agreement: the booking was a non-committed capacity reservation, clause 7.3 permits reallocation on 30 days notice. No contractual claim and no penalty available. Scanned the ASL for EO alternatives — Sterigenics Grand Rapids is approved, audit current to Mar 2028, already qualified for OCTARAY G2 and EMBOTRAP IV, and has capacity from 29 Sep.', true, 'master agreement clause 7.3, Approved Supplier List, audit validity'],
  ['A. Kowalski', 'Quality', '2026-09-11T07:12:00', 'If we move site, it is a half-cycle revalidation, not a full one, because the modality is unchanged. Realistically 21 days of protocol plus execution. I would want the protocol drafted against the OCTARAY G2 precedent so we are not writing it from scratch. Flagging that cycle development on a new chamber has overrun 5–8 days on two of our last seven transfers.', false, ''],
  ['S. Lindqvist', 'Regulatory', '2026-09-11T08:04:00', 'The bigger risk is not the 47 days, it is the BSI review slot. We hold a Q4 window. If the dossier is not complete by mid-November we lose it and the next confirmed slot is February — that is another 31 days on top. Please treat the BSI date as the real deadline.', false, ''],
];
T417.forEach((c, i) => comments.push({
  id: `seed_comment_417_${i + 1}`, author: c[0], authorRole: c[1], commentedAt: c[2], body: c[3],
  isAutomatedCheck: c[4], sourcesRead: c[5], decision: ref('seed_decision_417'),
}));
// other threads from THR
Object.keys(THR).forEach(key => {
  (THR[key].c || []).forEach((c, i) => {
    const isAg = c[1] === 'AG';
    comments.push({
      id: `seed_comment_${key}_${i + 1}`, author: decode(c[0]), authorRole: isAg ? 'Automated check' : decode(c[1]),
      commentedAt: parseDate(c[2]), body: decode(c[3]), isAutomatedCheck: isAg, sourcesRead: '',
      decision: ref('seed_decision_' + key),
    });
  });
});
write('Comment', comments);

/* ---- Notifications (anchor case fires 3 Teams cards) ------------------- */
[['M. Okafor'], ['A. Kowalski'], ['S. Lindqvist']].forEach((n, i) => notifications.push({
  id: `seed_notification_417_${i + 1}`, recipient: n[0], channel: 'Teams', sentAt: '2026-09-11T08:23:00',
  subject: 'NPI-0417 — decision routed to George Hall: dual-source EO sterilisation to Sterigenics',
  decision: ref('seed_decision_417'),
}));
write('Notification', notifications);

/* ---- DHF entries (immutable) ------------------------------------------- */
[
  ['2024-04-12T00:00:00', 'R&D', 'Design History File opened', 'DHF-0720', 'seed_launch_varipulse_g2'],
  ['2026-06-19T00:00:00', 'Governance', 'G2 Design Freeze closed — BOM frozen, 6/6 criteria met', 'G2', 'seed_launch_varipulse_g2'],
  ['2026-09-11T06:05:00', 'Quality agent', 'CAPA-2026-0148 opened against supplier-managed EO sterilisation', 'CAPA-2026-0148', 'seed_launch_varipulse_g2'],
  ['2026-09-11T08:23:00', 'Orchestrator', 'NPI-0417 routed to a human — €18.4M exposed and a gate date moves', 'NPI-0417', 'seed_launch_varipulse_g2'],
].forEach((e, i) => dhf.push({
  id: `seed_dhf_varipulse_${i + 1}`, entryAt: e[0], actor: e[1], action: e[2], recordRef: e[3], immutable: true, launch: ref(e[4]),
}));
write('DesignHistoryFileEntry', dhf);

/* ---- write the finding/chain/action tables ----------------------------- */
write('Finding', findings);
write('Chain', chains);
write('AgentAction', actions);
write('Handoff', handoffs);
write('GuardrailCheck', gchecks);
write('Decision', decisions);

/* ============================ DOCUMENTS (78, VARIPULSE) ================= */
// parse the document register DOM
const docs = [];
const groupRe = /<div class="dc-g" data-c="([a-z]+)">([\s\S]*?)(?=<div class="dc-g"|<\/div>\s*<\/div>\s*<\/div>)/g;
let gm, gi = 0;
const DOCGROUP = { dhf: 'Design History File', vv: 'Verification & validation', cli: 'Clinical', reg: 'Regulatory submissions', cert: 'Certificates, licences & registrations', mfg: 'Manufacturing & quality', com: 'Labelling & commercial', pm: 'Post-market' };
const rowRe = /<div class="dc-r [a-z]+" data-s="([a-z]+)">[\s\S]*?<span class="dc-n">([\s\S]*?)<\/span><span class="dc-m">([\s\S]*?)<\/span>[\s\S]*?<span class="dc-d">([\s\S]*?)<\/span><span class="dc-z">([\s\S]*?)<\/span>/g;
let n = 0;
Object.keys(DOCGROUP).forEach(gcode => {
  const gRe = new RegExp('<div class="dc-g" data-c="' + gcode + '">([\\s\\S]*?)</div>\\s*(?=<div class="dc-g"|</div>\\s*</div>)');
  const gmatch = gRe.exec(HTML);
  if (!gmatch) return;
  let rm;
  const rr = new RegExp(rowRe.source, 'g');
  while ((rm = rr.exec(gmatch[1]))) {
    n++;
    const meta = decode(rm[3]);            // "Plan · rev 6 · K. Tanaka"
    const parts = meta.split('·').map(s => s.trim());
    docs.push({
      id: 'seed_doc_varipulse_' + n, name: decode(rm[2]), docType: parts[0] || '',
      group: gcode, revision: parts[1] || '', status: rm[1],
      documentDate: parseDate(rm[4]), owner: parts[2] || '', fileSize: decode(rm[5]),
      launch: ref('seed_launch_varipulse_g2'),
    });
  }
});
write('Document', docs);
console.log('\nDone. Documents parsed:', docs.length);
