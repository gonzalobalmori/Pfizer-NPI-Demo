/*
 * PortfolioService — read-side projections for the non-Execution screens (§5).
 * Every method derives its bundle from the model at call time and returns plain
 * JSON the React pages render directly. No display strings are persisted beyond
 * the attested Pfizer copy already on the domain types (model invariant §3.6.1).
 */

/* ── shared helpers ─────────────────────────────────────────────── */

function iso(dt) {
  return dt ? dt.toString() : null;
}

/* worst-first health ordering for the portfolio sort (§5) */
var HEALTH_RANK = { OFF_TRACK: 0, AT_RISK: 1, PRE_MARKET: 2, ON_PLAN: 3, LAUNCHED: 4 };
function healthRank(h) {
  return HEALTH_RANK[h] != null ? HEALTH_RANK[h] : 9;
}

var PHASE_ORDER = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
var PHASE_META = {
  P1: ['Feasibility (strategic definition)', 'closed'],
  P2: ['Design Inputs (supply definition)', 'closed'],
  P3: ['V&V (verification & validation)', 'live'],
  P4: ['Transfer', 'live'],
  P5: ['Ready', 'queued'],
  P6: ['Post-market', 'queued']
};

/*
 * The canonical NPI phase/gate map, surfaced on the Pipeline Cockpit so the
 * first page defines — for the whole portfolio — what the phases are, the
 * short label used across the app, and the gate/milestone that closes each
 * phase. `short` is the reviewer-approved label (matches the Portfolio phase
 * axis); `full` expands it; `gate`/`gateName` name the decision gate; and
 * `milestone` calls out the regulatory milestone that lands in that phase
 * (notably "Regulatory Submission Filed" at G3 and "FDA Approved / CE Marked"
 * at G4, which the reviewer flagged as missing from the phase overview).
 */
var PHASE_MODEL = [
  { code: 'P1', short: 'Feasibility', full: 'Feasibility (strategic definition)', gate: 'G1', gateName: 'NPI Readiness Gate', milestone: null },
  { code: 'P2', short: 'Design Inputs', full: 'Design Inputs (supply definition)', gate: 'G2', gateName: 'Design Freeze', milestone: null },
  { code: 'P3', short: 'V&V', full: 'V&V (verification & validation)', gate: 'G3', gateName: 'Submission Commit', milestone: 'Regulatory Submission Filed — full dossier to FDA' },
  { code: 'P4', short: 'Transfer', full: 'Reg review, design transfer & at-risk build', gate: 'G4', gateName: 'Clearance / CE Certificate', milestone: 'FDA Approved / CE Marked' },
  { code: 'P5', short: 'Ready', full: 'Launch readiness', gate: 'G5', gateName: 'Launch Go / No-Go — First Ship', milestone: 'First Ship' },
  { code: 'P6', short: 'Post-market', full: 'Post-market surveillance & BAU transfer', gate: 'BAU', gateName: 'BAU handover', milestone: null }
];

/* the current-phase code marks which phase column a launch is executing in */
function phaseStateFor(phaseCode, currentPhaseCode) {
  var idx = PHASE_ORDER.indexOf(phaseCode);
  var cur = PHASE_ORDER.indexOf(currentPhaseCode);
  if (cur < 0) return PHASE_META[phaseCode] ? PHASE_META[phaseCode][1] : 'queued';
  if (idx < cur) return 'closed';
  if (idx === cur) return 'live';
  return 'queued';
}

/* ── §5 Per-market phase/gate derivation (Scope C) ──────────────────
 *
 * The model carries a single gate train per {@link Launch} — effectively the
 * lead-market schedule — plus a per-{@link MarketLaunch} first-ship quarter. A
 * follower market ships later than the lead, so it is proportionally *behind*
 * on the same gate train. We derive each market's current phase/gate by shifting
 * the lead train by the market's first-ship quarter delta and reading off the
 * first gate whose projected quarter has not yet passed "today". Nothing is
 * persisted; this is a pure projection so USA-vs-France divergence surfaces
 * without a schema change. */

/* Ordinal rank so gates sort/compare numerically (string sort puts BAU first). */
var GATE_RANK = { G1: 1, G2: 2, G3: 3, G4: 4, G5: 5, BAU: 6 };
/* The gate that CLOSES each phase — a finding in P4 puts the P4-closing gate
   (G4) at risk. Kept identical to ExecutionService.PHASE_GATE so the Open-issues
   row, the resolution workspace and the finding card all name the same gate. */
var PHASE_GATE = { P1: 'G1', P2: 'G2', P3: 'G3', P4: 'G4', P5: 'G5', P6: 'BAU' };
/* Which phase a launch is executing in while driving toward a given gate. */
var GATE_PHASE = {
  G1: ['P1', 'Feasibility'],
  G2: ['P2', 'Design Inputs'],
  G3: ['P3', 'V&V'],
  G4: ['P4', 'Transfer'],
  G5: ['P5', 'Ready'],
  BAU: ['P6', 'Post-market']
};

/* Quarter index (year*4 + quarter-1) from a "Q2 27" / "Q2 2027" label. */
function quarterIndexFromLabel(q) {
  if (!q) return null;
  var m = /Q([1-4])\s*'?(\d{2,4})/.exec(q);
  if (!m) return null;
  var qq = parseInt(m[1], 10);
  var yy = parseInt(m[2], 10);
  if (yy < 100) yy += 2000;
  return yy * 4 + (qq - 1);
}
/* Quarter index from an ISO date string. */
function quarterIndexFromIso(isoStr) {
  if (!isoStr) return null;
  var d = new Date(isoStr);
  if (isNaN(d.getTime())) return null;
  return d.getFullYear() * 4 + Math.floor(d.getMonth() / 3);
}
/* "Q2 27"-style label from a quarter index. */
function quarterLabel(idx) {
  if (idx == null) return null;
  var y = Math.floor(idx / 4);
  var q = (idx % 4) + 1;
  return 'Q' + q + ' ' + String(y).slice(2);
}
/* Shift an ISO date string by N whole months, preserving the day-of-month where
 * possible. Used to project a follower market's gate dates off the lead-gate
 * dates (deltaQ quarters → deltaQ*3 months) so the timeline can position a
 * per-market gate on the SAME date axis (monthPos) the lead train uses, instead
 * of the coarse quarter mid-month which clamps sub-axis dates to the left edge. */
function shiftIsoMonths(isoStr, months) {
  if (!isoStr) return null;
  var d = new Date(isoStr);
  if (isNaN(d.getTime())) return null;
  var day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  var lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T00:00:00';
}

/*
 * Derive the per-market phase/gate spread for one launch.
 *   launch  — the Launch (needs leadMarket.code + firstShipDate)
 *   gates   — [{ code, name, forecastDate(iso), status, slipDays }] for this launch
 *   mls     — [{ marketCode, marketName, marketTier, firstShipQuarter, status,
 *               reimbursementStatus }]
 * Returns an array (most-advanced market first) of
 *   { marketCode, marketName, marketTier, firstShipQuarter, phaseCode,
 *     gateCode, gateName, gateForecastQuarter, gateStatus, slipDays, mlStatus,
 *     reimbursementStatus, isLead, live }.
 *
 * NOTE ON COLOUR: `mlStatus` (the market launch's own ok/rk/ct) is the single
 * tone source shared with the Market lens, so a market reads the SAME colour in
 * the cockpit, the timeline and the market tab. `gateStatus` (the projected
 * lead-gate status) is kept only as secondary content, never for the row tone.
 */
function deriveMarketGates(launch, gates, mls) {
  var nowIdx = quarterIndexFromIso(iso(DateTime.now()));
  var ordered = gates.slice().sort(function (a, b) {
    return (GATE_RANK[a.code] || 9) - (GATE_RANK[b.code] || 9);
  });

  var leadCode = launch.leadMarket ? launch.leadMarket.code : null;
  var leadShipQ = null;
  mls.forEach(function (ml) {
    if (ml.marketCode === leadCode) leadShipQ = quarterIndexFromLabel(ml.firstShipQuarter);
  });
  if (leadShipQ == null) leadShipQ = quarterIndexFromIso(iso(launch.firstShipDate));

  var out = [];
  mls.forEach(function (ml) {
    var isLead = ml.marketCode === leadCode;
    /* already shipping — past the whole train */
    if (ml.firstShipQuarter === 'live') {
      out.push({
        marketCode: ml.marketCode, marketName: ml.marketName, marketTier: ml.marketTier,
        firstShipQuarter: ml.firstShipQuarter, phaseCode: 'P6',
        gateCode: null, gateName: 'Live in market', gateForecastQuarter: null,
        gateStatus: 'ok', slipDays: 0,
        mlStatus: ml.status || 'ok', reimbursementStatus: ml.reimbursementStatus || null,
        isLead: isLead, live: true
      });
      return;
    }
    var mShipQ = quarterIndexFromLabel(ml.firstShipQuarter);
    var deltaQ = (mShipQ != null && leadShipQ != null) ? (mShipQ - leadShipQ) : 0;
    /* A market at or ahead of the lead (deltaQ <= 0) has already closed its
       earlier gates, so skip gates the lead train marks closed ('ok') — this
       keeps the lead consistent with the launch's next open gate even when a
       closed gate's forecast date lands in the current quarter or the seed dates
       are non-monotonic. A follower (deltaQ > 0) files its own submissions later,
       so its earlier gates are still ahead of it — pure date projection. */
    var next = null;
    for (var i = 0; i < ordered.length; i++) {
      var gq = quarterIndexFromIso(ordered[i].forecastDate);
      if (gq == null) continue;
      if (deltaQ <= 0 && ordered[i].status === 'ok') continue;
      var pq = gq + deltaQ;
      if (pq >= nowIdx) { next = { gate: ordered[i], pq: pq }; break; }
    }
    if (!next) {
      out.push({
        marketCode: ml.marketCode, marketName: ml.marketName, marketTier: ml.marketTier,
        firstShipQuarter: ml.firstShipQuarter, phaseCode: 'P6',
        gateCode: null, gateName: 'Live in market', gateForecastQuarter: null,
        gateStatus: 'ok', slipDays: 0,
        mlStatus: ml.status || 'ok', reimbursementStatus: ml.reimbursementStatus || null,
        isLead: isLead, live: true
      });
      return;
    }
    var pm = GATE_PHASE[next.gate.code] || ['P?', ''];
    /* Project the lead gate's real dates onto this market by shifting deltaQ
       quarters (deltaQ*3 months). This lets the timeline position the per-market
       gate on the SAME date axis (monthPos) as the lead train, so a small slip
       (e.g. Elrexfio G5 +9d) renders a visible baseline→forecast bar instead of
       collapsing to the left edge when the coarse quarter mid-month falls before
       the axis start. */
    var monthShift = deltaQ * 3;
    out.push({
      marketCode: ml.marketCode, marketName: ml.marketName, marketTier: ml.marketTier,
      firstShipQuarter: ml.firstShipQuarter, phaseCode: pm[0],
      gateCode: next.gate.code, gateName: next.gate.name,
      gateForecastQuarter: quarterLabel(next.pq),
      gateBaselineDate: shiftIsoMonths(next.gate.baselineDate, monthShift),
      gateForecastDate: shiftIsoMonths(next.gate.forecastDate, monthShift),
      /* the projected lead-gate status (secondary content only) */
      gateStatus: next.gate.status,
      /* the lead gate's slip in days, shifted markets inherit it as an estimate */
      slipDays: next.gate.slipDays || 0,
      /* the market's OWN status — the shared tone source across all lenses */
      mlStatus: ml.status || 'ok',
      reimbursementStatus: ml.reimbursementStatus || null,
      isLead: isLead, live: false
    });
  });

  /* order: lead first, then by market-launch status (worst first), then by gate
     advancement, then market code — so the most attention-worthy markets top the
     list and the ordering matches the worst-first sort used everywhere else. */
  var ML_RANK = { ct: 0, rk: 1, ok: 2 };
  out.sort(function (a, b) {
    if (a.isLead !== b.isLead) return a.isLead ? -1 : 1;
    var sa = ML_RANK[a.mlStatus] != null ? ML_RANK[a.mlStatus] : 9;
    var sb = ML_RANK[b.mlStatus] != null ? ML_RANK[b.mlStatus] : 9;
    if (sa !== sb) return sa - sb;
    var ra = a.live ? 99 : (GATE_RANK[a.gateCode] || 0);
    var rb = b.live ? 99 : (GATE_RANK[b.gateCode] || 0);
    if (rb !== ra) return rb - ra;
    return (a.marketCode || '') < (b.marketCode || '') ? -1 : 1;
  });
  return out;
}

/*
 * Build a { launchId → [marketGate,…] } index for every launch, from one bulk
 * fetch of gates + market launches. Shared by the cockpit and the timeline so
 * both lenses show the same per-market spread. `launchesById` maps id → the
 * Launch object (for leadMarket + firstShipDate).
 */
function marketGatesByLaunch(launchesById) {
  var gatesFor = {};
  Gate.fetch({ include: 'this, launch.id', limit: -1 }).objs.each(function (g) {
    var lid = g.launch ? g.launch.id : null;
    if (!lid) return;
    if (!gatesFor[lid]) gatesFor[lid] = [];
    gatesFor[lid].push({
      code: g.code, name: g.name, forecastDate: iso(g.forecastDate),
      baselineDate: iso(g.baselineDate),
      status: g.status, slipDays: g.slipDays
    });
  });

  var mlsFor = {};
  MarketLaunch.fetch({
    include: 'this, launch.id, market.code, market.name, market.tier',
    limit: -1
  }).objs.each(function (ml) {
    var lid = ml.launch ? ml.launch.id : null;
    if (!lid) return;
    if (!mlsFor[lid]) mlsFor[lid] = [];
    mlsFor[lid].push({
      marketCode: ml.market ? ml.market.code : null,
      marketName: ml.market ? ml.market.name : null,
      marketTier: ml.market ? ml.market.tier : null,
      firstShipQuarter: ml.firstShipQuarter,
      status: ml.status,
      reimbursementStatus: ml.reimbursementStatus
    });
  });

  var byLaunch = {};
  for (var lid in launchesById) {
    byLaunch[lid] = deriveMarketGates(launchesById[lid], gatesFor[lid] || [], mlsFor[lid] || []);
  }
  return byLaunch;
}

/* ── §5 Cockpit ─────────────────────────────────────────────────── */

function cockpit() {
  var readiness = LaunchControlMetrics.portfolioGateReadiness();
  var health = LaunchControlMetrics.launchHealthDistribution();
  var revenue = LaunchControlMetrics.revenueAtRisk();
  var slip = LaunchControlMetrics.averageSlipAtGateClose();

  /* launches needing attention — health-ranked, only those not fully ON_PLAN */
  var launches = Launch.fetch({
    include: 'this, franchise.name, currentPhase.code, currentPhase.name, leadMarket.code, firstShipDate',
    limit: -1
  }).objs;

  /* per-market phase/gate spread for every launch (Scope C) — the cockpit shows
     each attention row's markets at the gate they are actually driving toward,
     not a single "lead market" label. */
  var launchesById = {};
  launches.each(function (l) { launchesById[l.id] = l; });
  var marketGates = marketGatesByLaunch(launchesById);

  /* next open gate per launch, so the cockpit shows the actual gate (not the
     market) in the "Next gate" column. The gate is the lead-market schedule. */
  var nextGateByLaunch = {};
  Gate.fetch({
    filter: Filter.ne('status', 'ok'),
    include: 'this, launch.id',
    limit: -1
  }).objs.each(function (g) {
    var lid = g.launch ? g.launch.id : null;
    if (!lid) return;
    var cur = nextGateByLaunch[lid];
    /* earliest open gate by ORDINAL rank — a plain string compare puts "BAU"
       before "G5", so Elrexfio (only G5 + BAU open) would mislabel its next gate
       as BAU. GATE_RANK gives the correct G1<…<G5<BAU order. */
    if (!cur || (GATE_RANK[g.code] || 99) < (GATE_RANK[cur.code] || 99)) {
      nextGateByLaunch[lid] = { code: g.code, name: g.name, forecastDate: iso(g.forecastDate), status: g.status };
    }
  });

  var attention = [];
  launches.each(function (l) {
    if (l.healthStatus === 'ON_PLAN' || l.healthStatus === 'LAUNCHED') return;
    var ng = nextGateByLaunch[l.id] || null;
    var mg = marketGates[l.id] || [];
    /* the gate spread across markets: distinct gate codes the markets sit at,
       most-advanced first, so the cockpit can show "US G4 · FR G3" rather than a
       single lead-market gate. Live markets are folded in as the "Live" head. */
    attention.push({
      launchId: l.id,
      device: l.deviceName,
      shortName: l.shortName,
      franchise: l.franchise ? l.franchise.name : null,
      phaseCode: l.currentPhase ? l.currentPhase.code : null,
      phaseName: l.currentPhase ? l.currentPhase.name : null,
      health: l.healthStatus,
      revenueAtRisk: l.revenueAtRisk,
      leadMarket: l.leadMarket ? l.leadMarket.code : null,
      nextGateCode: ng ? ng.code : null,
      nextGateName: ng ? ng.name : null,
      marketGates: mg,
      exposureCause: l.exposureCause
    });
  });
  attention.sort(function (a, b) {
    var r = healthRank(a.health) - healthRank(b.health);
    if (r !== 0) return r;
    return (b.revenueAtRisk || 0) - (a.revenueAtRisk || 0);
  });

  /* gates closing in the next 120 days — by forecast date */
  var horizon = DateTime.now().plusDays(120);
  var gates = Gate.fetch({
    filter: Filter.ne('status', 'ok').and().le('forecastDate', horizon),
    include: 'this, launch.deviceName, launch.shortName, launch.id, phase.code, criteria.met',
    limit: -1
  }).objs;
  var closing = [];
  gates.each(function (g) {
    var met = 0, all = 0;
    if (g.criteria) g.criteria.each(function (c) { all++; if (c.met) met++; });
    closing.push({
      launchId: g.launch ? g.launch.id : null,
      device: g.launch ? g.launch.deviceName : null,
      shortName: g.launch ? g.launch.shortName : null,
      gateCode: g.code,
      gateName: g.name,
      baselineDate: iso(g.baselineDate),
      forecastDate: iso(g.forecastDate),
      slipDays: g.slipDays,
      status: g.status,
      criteriaMet: met,
      criteriaTotal: all
    });
  });
  closing.sort(function (a, b) {
    if (!a.forecastDate) return 1;
    if (!b.forecastDate) return -1;
    return a.forecastDate < b.forecastDate ? -1 : a.forecastDate > b.forecastDate ? 1 : 0;
  });

  return {
    kpis: {
      gateReadiness: readiness,
      launchHealth: health,
      revenueExposed: revenue,
      scheduleDiscipline: slip
    },
    attention: attention,
    gatesClosing: closing,
    phaseModel: PHASE_MODEL
  };
}

/* ── §5 Portfolio · Product lens ────────────────────────────────── */

function portfolioProduct() {
  var launches = Launch.fetch({
    include: 'this, franchise.name, franchise.segment.name, currentPhase.code, leadMarket.code',
    limit: -1
  }).objs;

  /* gates per launch, in code order */
  var gatesByLaunch = {};
  var gates = Gate.fetch({ include: 'this, launch.id', limit: -1 }).objs;
  gates.each(function (g) {
    var lid = g.launch ? g.launch.id : null;
    if (!lid) return;
    if (!gatesByLaunch[lid]) gatesByLaunch[lid] = [];
    gatesByLaunch[lid].push({
      code: g.code, name: g.name, status: g.status,
      slipDays: g.slipDays, baselineDate: iso(g.baselineDate), forecastDate: iso(g.forecastDate)
    });
  });

  /* per-launch time-recovery + exposure — same source the Cockpit chart and
     Open-issues band read, so "can recover" days reconcile across every view. */
  var timeByLaunch = launchTimeRecoveryMap();

  var rows = [];
  launches.each(function (l) {
    var curCode = l.currentPhase ? l.currentPhase.code : null;
    var phases = PHASE_ORDER.map(function (code) {
      return { code: code, name: PHASE_META[code][0], state: phaseStateFor(code, curCode) };
    });
    var lg = gatesByLaunch[l.id] || [];
    lg.sort(function (a, b) { return a.code < b.code ? -1 : a.code > b.code ? 1 : 0; });
    var tr = timeByLaunch[l.id] || { daysAtStake: 0, recoverableDays: 0, regulatorDays: 0, pctRecoverable: 0, openCount: 0 };
    rows.push({
      launchId: l.id,
      device: l.deviceName,
      shortName: l.shortName,
      franchise: l.franchise ? l.franchise.name : null,
      segment: l.franchise && l.franchise.segment ? l.franchise.segment.name : null,
      deviceClass: l.deviceClass,
      regulatoryRoute: l.regulatoryRoute,
      leadMarket: l.leadMarket ? l.leadMarket.code : null,
      currentPhase: curCode,
      health: l.healthStatus,
      revenueAtRisk: l.revenueAtRisk,
      firstShipDate: iso(l.firstShipDate),
      phases: phases,
      gates: lg,
      /* time-recovery for this launch (days) — reconciles with Cockpit / Open issues */
      daysAtStake: tr.daysAtStake,
      recoverableDays: tr.recoverableDays,
      regulatorDays: tr.regulatorDays,
      pctRecoverable: tr.pctRecoverable
    });
  });
  rows.sort(function (a, b) {
    var r = healthRank(a.health) - healthRank(b.health);
    if (r !== 0) return r;
    return (b.revenueAtRisk || 0) - (a.revenueAtRisk || 0);
  });
  return { rows: rows };
}

/* ── §5 Portfolio · Market lens ─────────────────────────────────── */

function portfolioMarket() {
  var markets = Market.fetch({ include: 'this', limit: -1 }).objs;

  /* market launches grouped by market code */
  var byMarket = {};
  var mls = MarketLaunch.fetch({
    include: 'this, market.code, launch.shortName, launch.deviceName, launch.healthStatus',
    limit: -1
  }).objs;
  mls.each(function (ml) {
    var code = ml.market ? ml.market.code : null;
    if (!code) return;
    if (!byMarket[code]) byMarket[code] = [];
    byMarket[code].push({
      launch: ml.launch ? (ml.launch.shortName || ml.launch.deviceName) : null,
      status: ml.status,
      firstShipQuarter: ml.firstShipQuarter,
      reimbursementStatus: ml.reimbursementStatus,
      health: ml.launch ? ml.launch.healthStatus : null
    });
  });

  var STATUS_RANK = { ct: 0, rk: 1, ok: 2 };
  var rows = [];
  markets.each(function (m) {
    var list = byMarket[m.code] || [];
    /* roll up to the worst status present */
    var worst = 'ok';
    list.forEach(function (x) {
      if ((STATUS_RANK[x.status] != null ? STATUS_RANK[x.status] : 9) <
          (STATUS_RANK[worst] != null ? STATUS_RANK[worst] : 9)) worst = x.status;
    });
    rows.push({
      code: m.code,
      name: m.name,
      regulatoryBody: m.regulatoryBody,
      tier: m.tier,
      tenderWindows: m.tenderWindows,
      wave: m.wave,
      latitude: m.latitude,
      longitude: m.longitude,
      launchCount: list.length,
      rollupStatus: list.length ? worst : null,
      launches: list
    });
  });
  rows.sort(function (a, b) { return b.launchCount - a.launchCount; });

  /* quarter timeline: count of first-ships per quarter across all market launches */
  var quarters = {};
  mls.each(function (ml) {
    var q = ml.firstShipQuarter;
    if (!q) return;
    quarters[q] = (quarters[q] || 0) + 1;
  });
  var timeline = [];
  for (var q in quarters) timeline.push({ quarter: q, count: quarters[q] });

  return { markets: rows, timeline: timeline };
}

/* ── §5 Portfolio · Business-unit lens ──────────────────────────── */

function portfolioBusinessUnit() {
  var segments = Segment.fetch({ include: 'this, franchises.name', limit: -1 }).objs;
  var launches = Launch.fetch({
    include: 'this, franchise.name, franchise.segment.name, currentPhase.code',
    limit: -1
  }).objs;

  /* gates per launch, to derive each launch's next open gate + its slip (§2.3) */
  var gatesByLaunch = {};
  Gate.fetch({ include: 'this, launch.id', limit: -1 }).objs.each(function (g) {
    var lid = g.launch ? g.launch.id : null;
    if (!lid) return;
    if (!gatesByLaunch[lid]) gatesByLaunch[lid] = [];
    gatesByLaunch[lid].push(g);
  });
  /* open findings per launch, for the card footer's "N open issues" count */
  var issuesByLaunch = {};
  Finding.fetch({ include: 'this, launch.id, outcome', limit: -1 }).objs.each(function (f) {
    var lid = f.launch ? f.launch.id : null;
    if (!lid) return;
    var open = f.outcome === 'USER' || f.outcome === 'HELD' || f.outcome === 'RUNNING';
    if (!issuesByLaunch[lid]) issuesByLaunch[lid] = 0;
    if (open) issuesByLaunch[lid]++;
  });

  /* the next gate a launch is driving toward = earliest gate not yet closed
     (status 'late' or 'no'); its forecast date + slip feed the card row. */
  function nextGate(lid) {
    var gs = (gatesByLaunch[lid] || []).slice();
    gs.sort(function (a, b) {
      if (!a.forecastDate) return 1;
      if (!b.forecastDate) return -1;
      return a.forecastDate < b.forecastDate ? -1 : a.forecastDate > b.forecastDate ? 1 : 0;
    });
    var open = gs.filter(function (g) { return g.status !== 'ok'; });
    var g = open.length ? open[0] : (gs.length ? gs[gs.length - 1] : null);
    if (!g) return null;
    return { code: g.code, name: g.name, forecastDate: iso(g.forecastDate), slipDays: g.slipDays || 0 };
  }

  /* per-launch time-recovery, shared with every other lens */
  var timeByLaunch = launchTimeRecoveryMap();

  /* launches grouped by franchise name */
  var byFranchise = {};
  launches.each(function (l) {
    var fn = l.franchise ? l.franchise.name : 'Unassigned';
    if (!byFranchise[fn]) byFranchise[fn] = [];
    var tr = timeByLaunch[l.id] || { daysAtStake: 0, recoverableDays: 0, regulatorDays: 0, pctRecoverable: 0 };
    byFranchise[fn].push({
      launchId: l.id, device: l.deviceName, shortName: l.shortName,
      health: l.healthStatus, currentPhase: l.currentPhase ? l.currentPhase.code : null,
      revenueAtRisk: l.revenueAtRisk,
      readinessPct: l.readinessPct != null ? l.readinessPct : null,
      scheduleFloatDays: l.scheduleFloatDays != null ? l.scheduleFloatDays : null,
      nextGate: nextGate(l.id),
      openIssues: issuesByLaunch[l.id] || 0,
      daysAtStake: tr.daysAtStake,
      recoverableDays: tr.recoverableDays,
      regulatorDays: tr.regulatorDays
    });
  });

  function healthMix(list) {
    var mix = { ON_PLAN: 0, AT_RISK: 0, OFF_TRACK: 0, LAUNCHED: 0, PRE_MARKET: 0 };
    list.forEach(function (x) { if (mix[x.health] != null) mix[x.health]++; });
    return mix;
  }

  var segRows = [];
  segments.each(function (s) {
    var frRows = [];
    var segLaunchCount = 0;
    var segExposure = 0;
    var segRecoverable = 0, segDaysAtStake = 0;
    if (s.franchises) {
      s.franchises.each(function (fr) {
        var list = byFranchise[fr.name] || [];
        list.sort(function (a, b) { return healthRank(a.health) - healthRank(b.health); });
        var exp = 0;
        var openIssues = 0;
        var recoverable = 0, daysAtStake = 0;
        list.forEach(function (x) {
          exp += (x.revenueAtRisk || 0);
          openIssues += (x.openIssues || 0);
          recoverable += (x.recoverableDays || 0);
          daysAtStake += (x.daysAtStake || 0);
        });
        segLaunchCount += list.length;
        segExposure += exp;
        segRecoverable += recoverable;
        segDaysAtStake += daysAtStake;
        frRows.push({
          franchise: fr.name,
          launchCount: list.length,
          revenueAtRisk: exp,
          openIssues: openIssues,
          recoverableDays: recoverable,
          daysAtStake: daysAtStake,
          healthMix: healthMix(list),
          launches: list
        });
      });
    }
    frRows.sort(function (a, b) { return b.launchCount - a.launchCount; });
    segRows.push({
      segment: s.name,
      revenueScale: s.revenueScale,
      growthRate: s.growthRate,
      launchCount: segLaunchCount,
      revenueAtRisk: segExposure,
      recoverableDays: segRecoverable,
      daysAtStake: segDaysAtStake,
      franchises: frRows
    });
  });
  return { segments: segRows };
}

/* ── §5 Portfolio · Timeline lens ───────────────────────────────── */

function portfolioTimeline() {
  var launches = Launch.fetch({
    include: 'this, franchise.name, currentPhase.code, leadMarket.code, firstShipDate',
    limit: -1
  }).objs;

  var gatesByLaunch = {};
  var gates = Gate.fetch({ include: 'this, launch.id', limit: -1 }).objs;
  gates.each(function (g) {
    var lid = g.launch ? g.launch.id : null;
    if (!lid) return;
    if (!gatesByLaunch[lid]) gatesByLaunch[lid] = [];
    gatesByLaunch[lid].push({
      code: g.code, name: g.name, status: g.status, slipDays: g.slipDays,
      baselineDate: iso(g.baselineDate), forecastDate: iso(g.forecastDate)
    });
  });

  /* per-market phase/gate spread (Scope C) so the timeline can show which markets
     sit at which gate, not just the single lead-market train. */
  var launchesById = {};
  launches.each(function (l) { launchesById[l.id] = l; });
  var marketGates = marketGatesByLaunch(launchesById);

  var rows = [];
  launches.each(function (l) {
    var lg = gatesByLaunch[l.id] || [];
    lg.sort(function (a, b) { return (GATE_RANK[a.code] || 9) - (GATE_RANK[b.code] || 9); });
    rows.push({
      launchId: l.id,
      device: l.deviceName,
      shortName: l.shortName,
      franchise: l.franchise ? l.franchise.name : null,
      leadMarket: l.leadMarket ? l.leadMarket.code : null,
      health: l.healthStatus,
      firstShipDate: iso(l.firstShipDate),
      gates: lg,
      marketGates: marketGates[l.id] || []
    });
  });
  rows.sort(function (a, b) {
    var r = healthRank(a.health) - healthRank(b.health);
    if (r !== 0) return r;
    return (b.revenueAtRisk || 0) - (a.revenueAtRisk || 0);
  });
  return { rows: rows };
}

/* ── §5 Open issues ─────────────────────────────────────────────── */

/* how the finding maps to a waiting-on label, keyed on decision.heldBy where a
 * decision exists, else the outcome itself.
 *
 * `dependency === 'REGULATOR'` overrides everything else: when the next step is
 * with a body outside Pfizer (FDA, a Notified Body, a reimbursement authority) the
 * issue is waiting on an AUTHORITY no matter who nominally holds it internally —
 * this is the time you cannot pull in by acting faster. That distinction is the
 * whole point of the time-recovery view, so it wins over USER/HELD/AUTO. */
/* The signed-in user. There is exactly ONE human identity in this demo — the NPI
 * lead viewing the app IS Helena Fossi — so her own findings must always read as
 * "You" and NEVER as "Helena Fossi". Showing both labels for the same person (a
 * call owed by "You" next to one owed by "Helena Fossi") is the contradiction the
 * user flagged: they are the same person. */
var SELF_PERSON_NAME = 'Helena Fossi';

function waitingOnFor(outcome, heldBy, ownerName, agentName, dependency) {
  /* An outside authority (FDA, Notified Body, payer) overrides everything: acting
     faster cannot pull this in. */
  if (dependency === 'REGULATOR') return { kind: 'AUTHORITY', label: 'A regulatory authority' };
  /* Agent-driven work is classified BEFORE the held-by-person branch. A finding an
     agent is actively running (outcome RUNNING, or the next step depends on an
     agent) belongs in "Agent handling it" — even when it was DELEGATED — because
     its nominal owner is the signed-in user herself, and labelling it with her name
     would duplicate her identity. AUTO = the fleet already resolved it. */
  if (outcome === 'AUTO') return { kind: 'AGENT', label: agentName || 'The fleet', done: true };
  if (outcome === 'RUNNING' || dependency === 'AGENT') return { kind: 'AGENT', label: agentName || 'An agent' };
  /* A call the signed-in user owes — heldBy USER, or the owner IS the signed-in
     user. Collapse the self-owner case to "You" so the same person is never shown
     as both "You" and "Helena Fossi". */
  if (heldBy === 'USER' || outcome === 'USER' || ownerName === SELF_PERSON_NAME) {
    return { kind: 'YOU', label: 'You' };
  }
  /* A genuinely different named person now holds it (escalated up / delegated to a
     function led by someone other than the user). */
  if (heldBy === 'ESCALATED' || heldBy === 'DELEGATED' || outcome === 'HELD') {
    return { kind: 'PERSON', label: ownerName || 'A named person' };
  }
  return { kind: 'AGENT', label: agentName || 'An agent' };
}

/* Time booked by an open finding splits into two buckets on one rule: a
 * REGULATOR dependency is *fixed* (you are waiting on a third party — acting
 * faster upstream buys nothing), everything else (SELF / TEAM / AGENT, i.e. your
 * own org — agents included, since they only run when you launch them) is
 * *recoverable*. Returns { total, recoverable, regulator } in days. */
function timeSplitFor(daysAtStake, dependency) {
  var d = daysAtStake || 0;
  if (dependency === 'REGULATOR') return { total: d, recoverable: 0, regulator: d };
  return { total: d, recoverable: d, regulator: 0 };
}

/* Per-launch time-recovery + exposure roll-up, keyed by launch id. Every screen
 * that shows "can recover" days for a launch (Portfolio product lens, BU lens,
 * launch detail) reads THIS so the per-launch figures are identical to the
 * Cockpit chart and the Open-issues band — the same open-definition
 * (USER/HELD/RUNNING), the same {@link timeSplitFor} rule, the same
 * Finding.exposure. Returns { launchId -> { daysAtStake, recoverableDays,
 * regulatorDays, pctRecoverable, exposure, openCount } }. */
function launchTimeRecoveryMap() {
  var findings = Finding.fetch({
    include: 'this, dependency, daysAtStake, launch.id', limit: -1
  }).objs;
  var map = {};
  findings.each(function (f) {
    var isOpen = f.outcome === 'USER' || f.outcome === 'HELD' || f.outcome === 'RUNNING';
    if (!isOpen) return;
    var lid = f.launch ? f.launch.id : null;
    if (!lid) return;
    if (!map[lid]) {
      map[lid] = {
        daysAtStake: 0, recoverableDays: 0, regulatorDays: 0,
        exposure: 0, openCount: 0
      };
    }
    var ts = timeSplitFor(f.daysAtStake, f.dependency);
    var m = map[lid];
    m.daysAtStake += ts.total;
    m.recoverableDays += ts.recoverable;
    m.regulatorDays += ts.regulator;
    m.exposure += (f.exposure || 0);
    m.openCount += 1;
  });
  for (var k in map) {
    if (map.hasOwnProperty(k)) {
      var r = map[k];
      r.pctRecoverable = r.daysAtStake > 0
        ? Math.round((r.recoverableDays / r.daysAtStake) * 100) : 0;
    }
  }
  return map;
}

function openIssues() {
  var findings = Finding.fetch({
    include: 'this, dependency, daysAtStake, phase.code, phase.name, launch.deviceName, ' +
      'launch.shortName, launch.id, launch.franchise.name, detectedBy.name',
    limit: -1
  }).objs;

  /* decisions keyed by finding id for heldBy + owner */
  var decByFinding = {};
  var decs = Decision.fetch({ include: 'this, finding.id, owner.name', limit: -1 }).objs;
  decs.each(function (d) {
    if (d.finding) decByFinding[d.finding.id] = {
      heldBy: d.heldBy, owner: d.owner ? d.owner.name : null
    };
  });

  /* gates keyed by launchId -> { gateCode -> gate } so each issue can name the
     gate that closes its phase (the "Gate at risk" / "Slip" columns). Uses the
     SAME phase-closing-gate rule as the resolution workspace and finding card,
     so the gate a row shows matches what the user sees when they open it. */
  var gatesByLaunch = {};
  Gate.fetch({ include: 'this, launch.id', limit: -1 }).objs.each(function (g) {
    var lid = g.launch ? g.launch.id : null;
    if (!lid) return;
    if (!gatesByLaunch[lid]) gatesByLaunch[lid] = {};
    gatesByLaunch[lid][g.code] = g;
  });
  function gateAtRiskFor(launchId, phaseCode) {
    if (!launchId) return null;
    var byCode = gatesByLaunch[launchId] || {};
    var wantCode = phaseCode ? PHASE_GATE[phaseCode] : null;
    var g = wantCode ? byCode[wantCode] : null;
    /* fall back to the earliest still-open gate by rank if the phase-closing
       gate isn't on this launch */
    if (!g) {
      var best = null;
      for (var code in byCode) {
        var cand = byCode[code];
        if (cand.status === 'ok') continue;
        if (!best || (GATE_RANK[cand.code] || 99) < (GATE_RANK[best.code] || 99)) best = cand;
      }
      g = best;
    }
    if (!g) return null;
    return {
      code: g.code, name: g.name, status: g.status,
      slipDays: g.slipDays != null ? g.slipDays : null,
      baselineDate: iso(g.baselineDate), forecastDate: iso(g.forecastDate)
    };
  }

  var rows = [];
  var counts = { YOU: 0, PERSON: 0, AGENT: 0, AUTHORITY: 0 };
  findings.each(function (f) {
    /*
     * "Open" here MUST match the launch-detail definition (launchRecord): a
     * finding is open only while it is a call you owe, a held item, or an
     * in-flight agent action (USER / HELD / RUNNING). AUTO = the agent already
     * resolved it — it is NOT an open issue. Without this filter the page
     * titled "Open Issues" listed resolved findings, so an ON_PLAN launch such
     * as JAVELIN (whose only finding is AUTO/ok) read as clean in its own
     * detail yet still surfaced here — the exact cross-view contradiction the
     * user flagged. Now both views agree: resolved findings are excluded.
     */
    var isOpen = f.outcome === 'USER' || f.outcome === 'HELD' || f.outcome === 'RUNNING';
    if (!isOpen) return;
    var dec = decByFinding[f.id] || {};
    var wo = waitingOnFor(f.outcome, dec.heldBy, dec.owner,
      f.detectedBy ? f.detectedBy.name : null, f.dependency);
    counts[wo.kind] = (counts[wo.kind] || 0) + 1;
    /* schedule cost of this issue, split into recoverable (you can act) vs
       regulator (fixed wait). `recoverable` drives the Open-issues sort and the
       "accelerable vs waiting on authority" badge. */
    var ts = timeSplitFor(f.daysAtStake, f.dependency);
    rows.push({
      findingId: f.id,
      displayId: f.displayId,
      headline: f.headline,
      description: f.description,
      category: f.category,
      outcome: f.outcome,
      waitingOn: wo.kind,
      waitingOnLabel: wo.label,
      /* the raw dependency + the derived time split so the UI can show a
         Days-at-stake column and mark each issue accelerable vs authority-bound
         without re-deriving the rule. */
      dependency: f.dependency || null,
      daysAtStake: f.daysAtStake != null ? f.daysAtStake : null,
      recoverableDays: ts.recoverable,
      regulatorDays: ts.regulator,
      recoverable: ts.regulator === 0 && ts.total > 0,
      /* the gate this issue puts at risk (Gate-at-risk / Slip columns) — the gate
         that closes the finding's phase, matching the resolution workspace. */
      gateAtRisk: gateAtRiskFor(f.launch ? f.launch.id : null, f.phase ? f.phase.code : null),
      phaseCode: f.phase ? f.phase.code : null,
      phaseName: f.phase ? f.phase.name : null,
      device: f.launch ? f.launch.deviceName : null,
      shortName: f.launch ? f.launch.shortName : null,
      launchId: f.launch ? f.launch.id : null,
      franchise: f.launch && f.launch.franchise ? f.launch.franchise.name : null,
      detectedBy: f.detectedBy ? f.detectedBy.name : null,
      detectedAt: iso(f.detectedAt),
      exposure: f.exposure,
      exposureCause: f.exposureCause
    });
  });

  /* impact-first: the issues that give back the most schedule time by acting sit
     at the top (the user's ask — "lo que más tiempo te ahorra, arriba"), then the
     total days at stake (so a big regulator wait still ranks), then who owes the
     call (your calls before held/in-flight), then exposure. */
  var OUTCOME_RANK = { USER: 0, HELD: 1, RUNNING: 2, AUTO: 3 };
  rows.sort(function (a, b) {
    var rec = (b.recoverableDays || 0) - (a.recoverableDays || 0);
    if (rec !== 0) return rec;
    var das = (b.daysAtStake || 0) - (a.daysAtStake || 0);
    if (das !== 0) return das;
    var r = (OUTCOME_RANK[a.outcome] != null ? OUTCOME_RANK[a.outcome] : 9) -
            (OUTCOME_RANK[b.outcome] != null ? OUTCOME_RANK[b.outcome] : 9);
    if (r !== 0) return r;
    return (b.exposure || 0) - (a.exposure || 0);
  });

  /* Authoritative roll-ups, computed HERE (server-side) so every screen reads the
     SAME figure instead of re-summing rows locally and drifting apart:
       exposureOpen     — revenue exposed across ALL open findings. This is the ONE
                          canonical "Revenue exposed" number; because each launch's
                          Launch.revenueAtRisk equals the sum of its own open
                          findings' exposure, this reconciles with the Cockpit
                          revenueExposed KPI (Σ Launch.revenueAtRisk) by construction.
       exposureBlocking — the subset carried by gate-blocking (category 'ct') issues.
                          A strict subset of exposureOpen, shown as "of €X exposed",
                          never as a competing headline.
       daysAtStake / recoverableDays / regulatorDays — the same time-recovery split
                          timeImpact() returns, so the Open-issues band and the
                          Cockpit chart agree. */
  var totals = {
    exposureOpen: 0, exposureBlocking: 0,
    daysAtStake: 0, recoverableDays: 0, regulatorDays: 0
  };
  rows.forEach(function (r) {
    totals.exposureOpen += (r.exposure || 0);
    if (r.category === 'ct') totals.exposureBlocking += (r.exposure || 0);
    totals.daysAtStake += (r.daysAtStake || 0);
    totals.recoverableDays += (r.recoverableDays || 0);
    totals.regulatorDays += (r.regulatorDays || 0);
  });
  totals.pctRecoverable = totals.daysAtStake > 0
    ? Math.round((totals.recoverableDays / totals.daysAtStake) * 100) : 0;
  totals.blockingCount = rows.filter(function (r) { return r.category === 'ct'; }).length;
  totals.launchCount = (function () {
    var s = {};
    rows.forEach(function (r) { if (r.launchId) s[r.launchId] = true; });
    return Object.keys(s).length;
  })();

  return { rows: rows, counts: counts, total: rows.length, totals: totals };
}

/* ── §5 Time impact (schedule recovery) ─────────────────────────────
 *
 * The read-side of the critical-path story: of all the calendar time the open
 * findings are holding on the portfolio, how much can you get back by acting
 * (SELF / TEAM / AGENT — your own organisation, agents included since they only
 * run when you launch them) versus how much is a fixed wait on an outside
 * authority (REGULATOR — FDA, a Notified Body, a reimbursement body). Acting
 * faster on the first bucket pulls the schedule in; the second does not move no
 * matter how fast you work. Same open-definition as {@link openIssues}
 * (USER/HELD/RUNNING) so the numbers reconcile across every view.
 *
 * Returns:
 *   totals   { daysAtStake, recoverableDays, regulatorDays, pctRecoverable,
 *              openCount }
 *   byLaunch [{ launchId, device, shortName, health, daysAtStake,
 *               recoverableDays, regulatorDays, pctRecoverable, findingCount }]
 *              — worst-first by total days at stake, only launches that carry any.
 */
function timeImpact() {
  var findings = Finding.fetch({
    include: 'this, dependency, daysAtStake, launch.deviceName, launch.shortName, ' +
      'launch.id, launch.healthStatus',
    limit: -1
  }).objs;

  var totals = { daysAtStake: 0, recoverableDays: 0, regulatorDays: 0, openCount: 0 };
  var byLaunchMap = {};

  findings.each(function (f) {
    /* same "open" gate as openIssues/launchRecord — resolved AUTO items carry no
       live schedule cost. */
    var isOpen = f.outcome === 'USER' || f.outcome === 'HELD' || f.outcome === 'RUNNING';
    if (!isOpen) return;
    var ts = timeSplitFor(f.daysAtStake, f.dependency);
    if (ts.total <= 0) return;

    totals.daysAtStake += ts.total;
    totals.recoverableDays += ts.recoverable;
    totals.regulatorDays += ts.regulator;
    totals.openCount += 1;

    var lid = f.launch ? f.launch.id : null;
    if (!lid) return;
    if (!byLaunchMap[lid]) {
      byLaunchMap[lid] = {
        launchId: lid,
        device: f.launch.deviceName,
        shortName: f.launch.shortName,
        health: f.launch.healthStatus,
        daysAtStake: 0, recoverableDays: 0, regulatorDays: 0, findingCount: 0
      };
    }
    var b = byLaunchMap[lid];
    b.daysAtStake += ts.total;
    b.recoverableDays += ts.recoverable;
    b.regulatorDays += ts.regulator;
    b.findingCount += 1;
  });

  var byLaunch = [];
  for (var k in byLaunchMap) {
    if (byLaunchMap.hasOwnProperty(k)) {
      var row = byLaunchMap[k];
      row.pctRecoverable = row.daysAtStake > 0
        ? Math.round((row.recoverableDays / row.daysAtStake) * 100) : 0;
      byLaunch.push(row);
    }
  }
  /* worst-first by total days at stake so the biggest schedule holders top the
     chart; ties fall back to the more-recoverable one (more actionable) first. */
  byLaunch.sort(function (a, b) {
    var d = (b.daysAtStake || 0) - (a.daysAtStake || 0);
    if (d !== 0) return d;
    return (b.recoverableDays || 0) - (a.recoverableDays || 0);
  });

  totals.pctRecoverable = totals.daysAtStake > 0
    ? Math.round((totals.recoverableDays / totals.daysAtStake) * 100) : 0;

  return { totals: totals, byLaunch: byLaunch };
}

/* ── §5 Launch record ───────────────────────────────────────────── */

var DOC_GROUPS = {
  dhf: 'Design & development (DHF)',
  vv: 'Verification & validation',
  cli: 'Clinical & evidence',
  reg: 'Regulatory submissions',
  cert: 'Certificates, licences & registrations',
  mfg: 'Manufacturing & quality',
  com: 'Labelling & commercial',
  sco: 'Supply chain & operations',
  pm: 'Post-market surveillance'
};
var DOC_GROUP_ORDER = ['dhf', 'vv', 'cli', 'reg', 'cert', 'mfg', 'com', 'sco', 'pm'];

function launchRecord(launchId) {
  var ls = Launch.fetch({
    filter: Filter.eq('id', launchId),
    include: 'this, franchise.name, franchise.segment.name, currentPhase.code, currentPhase.name, ' +
      'leadMarket.code, leadMarket.name, firstShipDate, launchValue, sterilisationMethod, manufactureSite, ' +
      'registrationsFiled, registrationsTotal, launchBuildUnits, fieldForceCertified, ' +
      'fieldForceTotal, vacApprovalsFiled, vacApprovalsTotal',
    limit: 1
  }).objs;
  if (ls.length === 0) return null;
  var l = ls.get(0);

  /* gates */
  var gates = [];
  var gs = Gate.fetch({
    filter: Filter.eq('launch.id', launchId),
    include: 'this, launch.id, phase.code, criteria.name, criteria.met, criteria.outstandingReason',
    limit: -1
  }).objs;
  gs.each(function (g) {
    var crit = [];
    if (g.criteria) g.criteria.each(function (c) {
      crit.push({ name: c.name, met: c.met, outstandingReason: c.outstandingReason });
    });
    gates.push({
      code: g.code, name: g.name, status: g.status, slipDays: g.slipDays,
      baselineDate: iso(g.baselineDate), forecastDate: iso(g.forecastDate),
      phaseCode: g.phase ? g.phase.code : null, criteria: crit
    });
  });
  gates.sort(function (a, b) { return a.code < b.code ? -1 : a.code > b.code ? 1 : 0; });

  /* per-market phase/gate spread for this launch (Scope C) — so the detail page
     can attribute each gate delay to a specific market (USA vs France). Shares
     deriveMarketGates with the cockpit/timeline, so the same market reads the
     same gate + tone across every screen. */
  var recMls = [];
  MarketLaunch.fetch({
    filter: Filter.eq('launch.id', launchId),
    include: 'this, launch.id, market.code, market.name, market.tier',
    limit: -1
  }).objs.each(function (ml) {
    recMls.push({
      marketCode: ml.market ? ml.market.code : null,
      marketName: ml.market ? ml.market.name : null,
      marketTier: ml.market ? ml.market.tier : null,
      firstShipQuarter: ml.firstShipQuarter,
      status: ml.status,
      reimbursementStatus: ml.reimbursementStatus
    });
  });
  var recGateInputs = [];
  gates.forEach(function (g) {
    recGateInputs.push({ code: g.code, name: g.name, forecastDate: g.forecastDate, status: g.status, slipDays: g.slipDays });
  });
  var marketGates = deriveMarketGates(l, recGateInputs, recMls);

  /* activities → grouped into phase columns; domain + status tallies */
  var acts = Activity.fetch({
    filter: Filter.eq('launch.id', launchId),
    include: 'this, launch.id, phase.code, domain.code, domain.name, autonomyClass.code, ' +
      'owningPerson.name, owningAgent.name',
    limit: -1
  }).objs;

  var colByPhase = {};
  PHASE_ORDER.forEach(function (code) { colByPhase[code] = []; });
  var domainTally = {};
  var statusTally = { ok: 0, run: 0, rk: 0, late: 0, no: 0 };
  var autonomyTally = { A: 0, R: 0 };

  acts.each(function (a) {
    var pc = a.phase ? a.phase.code : null;
    var owner = a.owningAgent ? a.owningAgent.name : (a.owningPerson ? a.owningPerson.name : null);
    var ownerKind = a.owningAgent ? 'AGENT' : (a.owningPerson ? 'PERSON' : null);
    var row = {
      id: a.id, name: a.name, status: a.status, statusCode: a.statusCode,
      detail: a.detail, phaseCode: pc,
      domainCode: a.domain ? a.domain.code : null,
      domainName: a.domain ? a.domain.name : null,
      autonomy: a.autonomyClass ? a.autonomyClass.code : null,
      owner: owner, ownerKind: ownerKind,
      plannedEnd: iso(a.plannedEnd), actualEnd: iso(a.actualEnd)
    };
    if (pc && colByPhase[pc]) colByPhase[pc].push(row);
    var dc = a.domain ? a.domain.code : 'UNKNOWN';
    var dn = a.domain ? a.domain.name : 'Unknown';
    if (!domainTally[dc]) domainTally[dc] = { code: dc, name: dn, count: 0 };
    domainTally[dc].count++;
    if (a.statusCode && statusTally[a.statusCode] != null) statusTally[a.statusCode]++;
    var au = a.autonomyClass ? a.autonomyClass.code : null;
    if (au && autonomyTally[au] != null) autonomyTally[au]++;
  });

  /*
   * Findings raised against this launch, mapped to the Product-detail "Open
   * issues on this launch" table. Open = outcome USER / HELD / RUNNING (a call
   * you owe, a held item, or an in-flight agent action); AUTO = resolved. This
   * replaces the hard-coded Comirnaty-only issues list so every product's issue
   * table reflects its own findings — and an on-plan launch with no open
   * findings reads clean (empty). blockingCount = open findings whose category
   * is 'ct' (critical — blocks the gate).
   */
  var findings = Finding.fetch({
    filter: Filter.eq('launch.id', launchId),
    include: 'this, launch.id, phase.code, detectedBy.name, dependency, daysAtStake',
    limit: -1
  }).objs;
  var issues = [];
  var openIssueCount = 0;
  var blockingCount = 0;
  /* per-launch time-recovery + exposure roll-up on the SAME open-definition and
     time-split rule as the Cockpit chart / Open-issues band, so the launch detail
     shows the same "can recover" days and exposure the rest of the app does. */
  var openExposure = 0, blockingExposure = 0;
  var recDaysAtStake = 0, recRecoverable = 0, recRegulator = 0;
  findings.each(function (f) {
    var isOpen = f.outcome === 'USER' || f.outcome === 'HELD' || f.outcome === 'RUNNING';
    var ts = timeSplitFor(f.daysAtStake, f.dependency);
    if (isOpen) {
      openIssueCount++;
      if (f.category === 'ct') { blockingCount++; blockingExposure += (f.exposure || 0); }
      openExposure += (f.exposure || 0);
      recDaysAtStake += ts.total;
      recRecoverable += ts.recoverable;
      recRegulator += ts.regulator;
    }
    issues.push({
      findingId: f.id,
      displayId: f.displayId,
      headline: f.headline,
      description: f.description,
      category: f.category,
      outcome: f.outcome,
      open: isOpen,
      exposure: f.exposure,
      exposureCause: f.exposureCause,
      dependency: f.dependency || null,
      daysAtStake: f.daysAtStake != null ? f.daysAtStake : null,
      recoverableDays: ts.recoverable,
      regulatorDays: ts.regulator,
      recoverable: ts.regulator === 0 && ts.total > 0,
      detectedBy: f.detectedBy ? f.detectedBy.name : null,
      detectedAt: iso(f.detectedAt)
    });
  });
  /* open first, then by exposure desc */
  issues.sort(function (a, b) {
    if (a.open !== b.open) return a.open ? -1 : 1;
    return (b.exposure || 0) - (a.exposure || 0);
  });

  var curCode = l.currentPhase ? l.currentPhase.code : null;
  var columns = PHASE_ORDER.map(function (code) {
    var gate = null;
    gates.forEach(function (g) { if (g.phaseCode === code) gate = g; });
    return {
      code: code, name: PHASE_META[code][0], state: phaseStateFor(code, curCode),
      activities: colByPhase[code], count: colByPhase[code].length, gate: gate
    };
  });

  var domains = [];
  for (var k in domainTally) domains.push(domainTally[k]);
  domains.sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });

  /*
   * Workstream readiness (§ Product-detail left rail): the share of each
   * workstream's activities that are complete, derived from Activity status —
   * NOT hard-coded. A workstream maps onto one or more functional-domain codes.
   * Completed = statusCode 'ok'; in-progress activities count toward the total.
   * Where a launch has no activity in a workstream yet, readiness is null and the
   * UI omits the bar. This makes every product's bars reflect its own programme.
   */
  var WORKSTREAMS = [
    { label: 'Regulatory', domains: ['reg'] },
    { label: 'R&D / Design', domains: ['rnd'] },
    { label: 'Quality', domains: ['qua'] },
    { label: 'Sourcing', domains: ['src'] },
    { label: 'Manufacturing', domains: ['mfg'] },
    { label: 'Supply chain', domains: ['sc'] },
    { label: 'Commercial', domains: ['com'] },
    { label: 'Market access', domains: ['ma'] }
  ];
  var wsAgg = {};
  acts.each(function (a) {
    var dc = a.domain ? a.domain.code : null;
    if (!dc) return;
    if (!wsAgg[dc]) wsAgg[dc] = { done: 0, total: 0 };
    wsAgg[dc].total++;
    if (a.statusCode === 'ok') wsAgg[dc].done++;
  });
  var workstreams = [];
  WORKSTREAMS.forEach(function (w) {
    var done = 0, total = 0;
    w.domains.forEach(function (dc) {
      if (wsAgg[dc]) { done += wsAgg[dc].done; total += wsAgg[dc].total; }
    });
    workstreams.push({
      label: w.label,
      pct: total > 0 ? Math.round((done / total) * 100) : null,
      done: done, total: total
    });
  });

  /* documents grouped */
  var docs = Document.fetch({
    filter: Filter.eq('launch.id', launchId),
    include: 'this, launch.id',
    limit: -1
  }).objs;
  var docByGroup = {};
  var missing = 0;
  docs.each(function (dc) {
    var g = dc.group || 'other';
    if (!docByGroup[g]) docByGroup[g] = [];
    if (dc.status === 'miss') missing++;
    docByGroup[g].push({
      name: dc.name, docType: dc.docType, revision: dc.revision,
      status: dc.status, documentDate: iso(dc.documentDate), owner: dc.owner, fileSize: dc.fileSize
    });
  });
  var docGroups = [];
  DOC_GROUP_ORDER.forEach(function (g) {
    if (docByGroup[g]) {
      docGroups.push({ code: g, label: DOC_GROUPS[g], documents: docByGroup[g] });
    }
  });
  /* any groups not in the canonical order */
  for (var gk in docByGroup) {
    if (DOC_GROUP_ORDER.indexOf(gk) < 0) {
      docGroups.push({ code: gk, label: gk, documents: docByGroup[gk] });
    }
  }

  /*
   * Critical supply (§ Demo 3): the launch's bill-of-materials parts and, for each
   * SINGLE_SOURCE part, the OTHER launches that draw the same part from the same
   * supplier. This is what makes a supplier concentration verifiable in the detail
   * page instead of merely asserted in a tour: open any of the four ring-electrode
   * launches and the same Heraeus part + the same three siblings read back. The
   * sibling list is resolved by a second BOM fetch keyed on (supplier, partName),
   * so it reconciles across every launch that shares the part.
   */
  var myBom = BillOfMaterialItem.fetch({
    filter: Filter.eq('launch.id', launchId),
    include: 'this, launch.id, supplier.id, supplier.name',
    limit: -1
  }).objs;
  var criticalSupply = [];
  if (myBom && myBom.length > 0) {
    /* one fetch of every BOM row, so sibling launches can be grouped in memory
       without an N+1 query per part. */
    var allBom = BillOfMaterialItem.fetch({
      include: 'this, launch.id, launch.deviceName, launch.shortName, supplier.id, supplier.name',
      limit: -1
    }).objs;
    myBom.each(function (b) {
      var supId = b.supplier ? b.supplier.id : null;
      var siblings = [];
      allBom.each(function (o) {
        if (!o.launch || o.launch.id === launchId) return;
        var oSup = o.supplier ? o.supplier.id : null;
        if (oSup && oSup === supId && o.partName === b.partName) {
          siblings.push({
            launchId: o.launch.id,
            device: o.launch.deviceName,
            shortName: o.launch.shortName || null
          });
        }
      });
      siblings.sort(function (a, b2) {
        return (a.device || '') < (b2.device || '') ? -1 : (a.device || '') > (b2.device || '') ? 1 : 0;
      });
      criticalSupply.push({
        partName: b.partName,
        sourcingMode: b.sourcingMode,
        frozenAtGate: b.frozenAtGate,
        supplierId: supId,
        supplierName: b.supplier ? b.supplier.name : null,
        /* how many launches in total depend on this part from this supplier
           (this launch + siblings) — the concentration count. */
        sharedAcross: siblings.length + 1,
        siblings: siblings
      });
    });
    /* single-source, most-shared first */
    criticalSupply.sort(function (a, b) {
      if ((a.sourcingMode === 'SINGLE_SOURCE') !== (b.sourcingMode === 'SINGLE_SOURCE')) {
        return a.sourcingMode === 'SINGLE_SOURCE' ? -1 : 1;
      }
      return b.sharedAcross - a.sharedAcross;
    });
  }

  return {
    overview: {
      launchId: l.id,
      device: l.deviceName,
      shortName: l.shortName,
      deviceClass: l.deviceClass,
      regulatoryRoute: l.regulatoryRoute,
      franchise: l.franchise ? l.franchise.name : null,
      segment: l.franchise && l.franchise.segment ? l.franchise.segment.name : null,
      leadMarket: l.leadMarket ? l.leadMarket.name : null,
      leadMarketCode: l.leadMarket ? l.leadMarket.code : null,
      currentPhase: curCode,
      currentPhaseName: l.currentPhase ? l.currentPhase.name : null,
      health: l.healthStatus,
      revenueAtRisk: l.revenueAtRisk,
      exposureCause: l.exposureCause,
      firstShipDate: iso(l.firstShipDate),
      launchValue: l.launchValue,
      sterilisationMethod: l.sterilisationMethod,
      manufactureSite: l.manufactureSite,
      registrationsFiled: l.registrationsFiled,
      registrationsTotal: l.registrationsTotal,
      launchBuildUnits: l.launchBuildUnits,
      fieldForceCertified: l.fieldForceCertified,
      fieldForceTotal: l.fieldForceTotal,
      vacApprovalsFiled: l.vacApprovalsFiled,
      vacApprovalsTotal: l.vacApprovalsTotal,
      workstreams: workstreams,
      gates: gates,
      marketGates: marketGates,
      criticalSupply: criticalSupply,
      activityCount: acts.length
    },
    issues: {
      rows: issues,
      openCount: openIssueCount,
      blockingCount: blockingCount,
      /* exposure + time-recovery roll-ups for this launch — reconcile with the
         launch's revenueAtRisk and with the Cockpit / Open-issues figures. */
      openExposure: openExposure,
      blockingExposure: blockingExposure,
      daysAtStake: recDaysAtStake,
      recoverableDays: recRecoverable,
      regulatorDays: recRegulator,
      pctRecoverable: recDaysAtStake > 0 ? Math.round((recRecoverable / recDaysAtStake) * 100) : 0
    },
    workflow: {
      columns: columns,
      domains: domains,
      statusTally: statusTally,
      autonomyTally: autonomyTally,
      total: acts.length
    },
    documents: {
      groups: docGroups,
      total: docs.length,
      missing: missing
    }
  };
}

/* ── §5 Launch index ────────────────────────────────────────────── */

function launchIndex() {
  var launches = Launch.fetch({
    include: 'this, franchise.name, currentPhase.code, currentPhase.name',
    limit: -1
  }).objs;
  var rows = [];
  launches.each(function (l) {
    rows.push({
      launchId: l.id,
      device: l.deviceName,
      shortName: l.shortName,
      franchise: l.franchise ? l.franchise.name : null,
      currentPhase: l.currentPhase ? l.currentPhase.code : null,
      currentPhaseName: l.currentPhase ? l.currentPhase.name : null,
      health: l.healthStatus,
      revenueAtRisk: l.revenueAtRisk
    });
  });
  rows.sort(function (a, b) {
    var r = healthRank(a.health) - healthRank(b.health);
    if (r !== 0) return r;
    return (b.revenueAtRisk || 0) - (a.revenueAtRisk || 0);
  });
  return { rows: rows };
}
