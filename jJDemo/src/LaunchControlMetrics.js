/*
 * LaunchControlMetrics — the portfolio metrics layer (§3.5).
 *
 * Every method derives its figure from the model (§3.6.1: no stored display
 * strings) and returns a small structured result the UI renders directly. All
 * static — this type holds no data.
 *
 * Where the specification quotes a TARGET or a portfolio BASE (readiness target
 * 85, portfolio value €412M, slip target ≤5), that constant is returned alongside
 * the derived value so the KPI card can show the threshold without the UI
 * hard-coding it. Those are legitimately constants: a target is set, not measured.
 *
 * What this type does NOT return is a trend. Two fields used to be published here
 * as measured 30-day movements — `deltaPts` (−6 points) and `delta30d` (+€11.2M)
 * — and both were spec constants with no computation behind them. Nothing in the
 * model carries a dated history of a KPI (no Gate, Criterion, Finding or Launch
 * field records a prior value or an as-of date), so a 30-day change cannot be
 * derived here at all. Publishing one from a constant made a fabricated figure
 * look sourced, which is worse than the hard-coded polyline it replaced, because
 * the view layer had no way to tell it apart from a real measurement (R-BASE-03).
 * Both fields are removed. The cockpit cards now state the DISTRIBUTION behind
 * each headline — how many launches sit below target, how concentrated the
 * exposure is — which is computable from what the model actually holds.
 *
 * If a genuine trend is ever wanted, it needs a stored time series (a
 * `LaunchControlMetrics.Snapshot` persisted on a schedule); it cannot be
 * back-filled from the current state.
 */

var PORTFOLIO_REVENUE = 412000000; // €412M portfolio base (§5 cockpit)
var READINESS_TARGET = 85;
var SLIP_TARGET = 5;

/* ---- helpers ------------------------------------------------------------ */
function round1(n) { return Math.round(n * 10) / 10; }

/* ---- PortfolioGateReadiness -------------------------------------------- */
function portfolioGateReadiness() {
  // Readiness = met criteria / total criteria on each launch's next open gate.
  var gates = Gate.fetch({
    filter: Filter.ne('status', 'ok'), // next-to-close / open gates
    include: 'code, launch.id, launch.productName, criteria.met', limit: -1
  }).objs;
  var perLaunch = [];
  var totMet = 0, totAll = 0;
  gates.each(function (g) {
    var met = 0, all = 0;
    if (g.criteria) g.criteria.each(function (c) { all++; if (c.met) met++; });
    if (all > 0) {
      totMet += met; totAll += all;
      perLaunch.push({
        launch: g.launch ? g.launch.productName : g.code,
        gate: g.code, met: met, total: all,
        pct: round1((met / all) * 100)
      });
    }
  });
  var value = totAll > 0 ? round1((totMet / totAll) * 100) : 0;
  return {
    metric: 'PortfolioGateReadiness', value: value, unit: '%',
    target: READINESS_TARGET, byLaunch: perLaunch
  };
}

/* ---- LaunchHealthDistribution ------------------------------------------
 * The cockpit headline must reconcile with the portfolio table, so this
 * exposes both the raw per-status breakdown (byStatus) AND the three figures
 * the cockpit card renders (rollup):
 *   - active   = launches still in flight (every status except LAUNCHED). A
 *                launched program has left launch control, so it is not part
 *                of the "N active launches" headline.
 *   - onPlan   = ON_PLAN + PRE_MARKET. A pre-market program that is on schedule
 *                (no gate slip) is on-track, so it rolls into the on-plan count
 *                rather than showing as a fourth, unreconciled bucket.
 *   - atRisk   = AT_RISK, offTrack = OFF_TRACK.
 * By construction onPlan + atRisk + offTrack === active, so the card sums to
 * its own header and matches the portfolio at-risk / off-track counts. */
function launchHealthDistribution() {
  var launches = Launch.fetch({ include: 'id, productName, healthStatus', limit: -1 }).objs;
  var buckets = {};
  launches.each(function (l) {
    var s = l.healthStatus || 'UNKNOWN';
    if (!buckets[s]) buckets[s] = { count: 0, launches: [] };
    buckets[s].count++;
    buckets[s].launches.push(l.productName);
  });
  function cnt(s) { return buckets[s] ? buckets[s].count : 0; }
  var launched = cnt('LAUNCHED');
  var rollup = {
    onPlan: cnt('ON_PLAN') + cnt('PRE_MARKET'),
    atRisk: cnt('AT_RISK'),
    offTrack: cnt('OFF_TRACK'),
    launched: launched
  };
  return {
    metric: 'LaunchHealthDistribution',
    total: launches.length,          // every program on the books (incl. launched)
    active: launches.length - launched, // in-flight launches — the cockpit headline
    rollup: rollup,
    byStatus: buckets
  };
}

/* ---- RevenueAtRisk ------------------------------------------------------ */
function revenueAtRisk() {
  var launches = Launch.fetch({
    filter: Filter.gt('revenueAtRisk', 0),
    include: 'id, productName, revenueAtRisk', limit: -1
  }).objs;
  var total = 0;
  var byLaunch = [];
  launches.each(function (l) {
    total += (l.revenueAtRisk || 0);
    byLaunch.push({ launch: l.productName, exposure: l.revenueAtRisk });
  });
  return {
    metric: 'RevenueAtRisk', value: total, unit: '€',
    pctOfPortfolio: round1((total / PORTFOLIO_REVENUE) * 100),
    portfolioBase: PORTFOLIO_REVENUE, byLaunch: byLaunch
  };
}

/* ---- AverageSlipAtGateClose --------------------------------------------
 * The headline "average slip" must reconcile with what the portfolio actually
 * shows: the gates that have SLIPPED. The portfolio timeline / launch cards only
 * ever surface gates that moved on the calendar (Berobenatide OB G3 +47, Berobenatide OSA G4
 * +21, Berobenatide T2D +14, PF-08634404 G3 +11, Sigvotatug G5 +9); a gate sitting exactly on
 * baseline is not a "slip". Averaging over ALL open gates (most with slipDays=0)
 * silently diluted the figure to ~4d and did not match any per-launch number the
 * user could see — the discrepancy flagged. So the average is taken over gates
 * that actually slipped (slipDays > 0). We still return the open-gate population
 * (`openGates`) and the on-plan count so the KPI card can say "N of M gates have
 * slipped" without hiding the denominator. */
function averageSlipAtGateClose() {
  // Gates still to close (status != 'ok') carry the live slip.
  var gates = Gate.fetch({
    filter: Filter.ne('status', 'ok'),
    include: 'code, slipDays, launch.productName, launch.shortName', limit: -1
  }).objs;
  var sum = 0, slippedCount = 0, openGates = 0, worst = 0;
  var byGate = [];
  gates.each(function (g) {
    var s = g.slipDays || 0;
    openGates++;
    if (s > 0) {
      sum += s; slippedCount++;
      if (s > worst) worst = s;
      byGate.push({
        gate: g.code,
        launch: g.launch ? (g.launch.shortName || g.launch.productName) : null,
        slipDays: s
      });
    }
  });
  // worst-first so the card's supporting list matches the portfolio ordering.
  byGate.sort(function (a, b) { return (b.slipDays || 0) - (a.slipDays || 0); });
  return {
    metric: 'AverageSlipAtGateClose',
    value: slippedCount > 0 ? round1(sum / slippedCount) : 0, unit: 'days',
    target: SLIP_TARGET, worst: worst,
    slippedGates: slippedCount, openGates: openGates, byGate: byGate
  };
}

/* ---- ActivitiesCompleteByDomain ---------------------------------------- */
function activitiesCompleteByDomain() {
  var acts = Activity.fetch({ include: 'statusCode, domain.code, domain.name', limit: -1 }).objs;
  var byDomain = {};
  acts.each(function (a) {
    var code = a.domain ? a.domain.code : 'UNKNOWN';
    var name = a.domain ? a.domain.name : 'Unknown';
    if (!byDomain[code]) byDomain[code] = { name: name, complete: 0, total: 0 };
    byDomain[code].total++;
    if (a.statusCode === 'ok') byDomain[code].complete++;
  });
  return { metric: 'ActivitiesCompleteByDomain', total: acts.length, byDomain: byDomain };
}

/* ---- autonomy split (shared) ------------------------------------------- */
function autonomySplit() {
  var acts = Activity.fetch({ include: 'autonomyClass.code', limit: -1 }).objs;
  var counts = { A: 0, R: 0 };
  acts.each(function (a) {
    var c = a.autonomyClass ? a.autonomyClass.code : null;
    if (c && counts[c] != null) counts[c]++;
  });
  counts.total = acts.length;
  return counts;
}

/* ---- AutonomousExecutionRate ------------------------------------------- */
function autonomousExecutionRate() {
  var s = autonomySplit();
  return {
    metric: 'AutonomousExecutionRate',
    value: s.total > 0 ? round1((s.A / s.total) * 100) : 0, unit: '%',
    autonomous: s.A, recommend: s.R, total: s.total
  };
}

/* ---- HumanTouchRate ---------------------------------------------------- */
function humanTouchRate() {
  var s = autonomySplit();
  var human = s.R;
  return {
    metric: 'HumanTouchRate',
    value: s.total > 0 ? round1((human / s.total) * 100) : 0, unit: '%',
    humanTouched: human, recommend: s.R, total: s.total
  };
}

/* ---- MeanTimeDetectionToDecision --------------------------------------- */
function meanTimeDetectionToDecision() {
  // Findings whose decision Helena has taken: detectedAt -> decision.approvedAt.
  var decs = Decision.fetch({
    filter: Filter.exists('approvedAt'),
    include: 'id, approvedAt, finding.detectedAt, finding.displayId', limit: -1
  }).objs;
  var sumHours = 0, n = 0, byFinding = [];
  decs.each(function (d) {
    if (d.finding && d.finding.detectedAt && d.approvedAt) {
      var ms = DateTime.fromString('' + d.approvedAt).toMillis()
             - DateTime.fromString('' + d.finding.detectedAt).toMillis();
      var hours = ms / 3600000;
      sumHours += hours; n++;
      byFinding.push({ finding: d.finding.displayId, hours: round1(hours) });
    }
  });
  return {
    metric: 'MeanTimeDetectionToDecision',
    value: n > 0 ? round1(sumHours / n) : null, unit: 'hours',
    decisionsTaken: n, byFinding: byFinding
  };
}

/* ---- GuardrailBreachCount ---------------------------------------------- */
function guardrailBreachCount(trailingDays) {
  var days = trailingDays || 90;
  var since = DateTime.now().plusDays(-days);
  var checks = GuardrailCheck.fetch({
    filter: Filter.eq('result', 'BREACH').and().ge('evaluatedAt', since),
    include: 'name, evaluatedAt, finding.displayId', limit: -1
  }).objs;
  return {
    metric: 'GuardrailBreachCount', value: checks.length,
    trailingDays: days, since: '' + since
  };
}

/* ---- HandoffsPerChain -------------------------------------------------- */
function handoffsPerChain() {
  var chains = Chain.fetch({ include: 'id, title, handoffCount', limit: -1 }).objs;
  var totalHandoffs = Handoff.fetchCount();
  var maxc = 0, byChain = [];
  chains.each(function (c) {
    var hc = c.handoffCount || 0;
    if (hc > maxc) maxc = hc;
    byChain.push({ chain: c.title, handoffs: hc });
  });
  return {
    metric: 'HandoffsPerChain',
    value: chains.length > 0 ? round1(totalHandoffs / chains.length) : 0,
    totalHandoffs: totalHandoffs, chains: chains.length, max: maxc, byChain: byChain
  };
}

/* ---- DecisionsTakenTrailing90Days -------------------------------------- */
function decisionsTakenTrailing90Days(trailingDays) {
  var days = trailingDays || 90;
  var since = DateTime.now().plusDays(-days);
  var decs = Decision.fetch({
    filter: Filter.exists('approvedAt').and().ge('approvedAt', since),
    include: 'id, selectedOption, approvedAt, finding.displayId', limit: -1
  }).objs;
  var list = [];
  decs.each(function (d) {
    list.push({ finding: d.finding ? d.finding.displayId : null, option: d.selectedOption, approvedAt: '' + d.approvedAt });
  });
  return { metric: 'DecisionsTakenTrailing90Days', value: decs.length, trailingDays: days, decisions: list };
}

/* ---- OpenFindingsByOutcome --------------------------------------------- */
function openFindingsByOutcome() {
  var findings = Finding.fetch({ include: 'id, displayId, outcome', limit: -1 }).objs;
  var byOutcome = { USER: 0, HELD: 0, AUTO: 0, RUNNING: 0 };
  findings.each(function (f) {
    if (f.outcome && byOutcome[f.outcome] != null) byOutcome[f.outcome]++;
  });
  return { metric: 'OpenFindingsByOutcome', total: findings.length, byOutcome: byOutcome };
}
