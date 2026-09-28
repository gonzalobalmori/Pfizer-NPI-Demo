/*
 * MarketWaveService — demand and market-wave change, end to end (SCENARIO 2).
 *
 * plan(changeId)                          read the dashboard at whatever stage the request is at.
 * assessConstraints(changeId)             step 1 — test the uplift against capacity, components and
 *                                         logistics; name the constraint that binds first.
 * evaluateOptions(changeId)               step 2 — score the four options the scenario names.
 * allocation(changeId, optionId)          step 3 — project the market-by-market plan.
 * decide(changeId, optionId, signer, why) step 4 — governed decision + Part 11 e-signature.
 * commit(changeId)                        step 5 — update every affected plan, owner, site,
 *                                         partner and market commitment.
 * reset(changeId)                         restore the pre-request baseline (repeatable demo).
 *
 * Every figure the view shows is derived from CapacitySource / PackComponent /
 * MarketCommitment rows at call time. Nothing is asserted in prose: the reason the
 * pack-mix change cannot be served is a lead time compared against a runway, and
 * the reason the uplift is 70,000 short is a weekly packaging headroom multiplied
 * by the weeks Commercial left us.
 *
 * The service touches NO Finding / Activity / Gate record, so the portfolio
 * reconciliation is unaffected.
 */

/* ── shared constants ───────────────────────────────────────────────── */

var DEFAULT_CHANGE = 'seed_dchg_berobenatide_obesity_de';

/* Late-delivery exposure on a commitment that carries a contractual penalty,
 * per week of delay, as a share of the delayed commitment value. Resequencing a
 * penalty-bearing market is therefore not free even when its tender window is
 * still met. */
var PENALTY_RATE_PER_WEEK = 0.015;

/* One wave step, in days — the granularity a launch wave can be moved by. */
var WAVE_STEP_DAYS = 14;

/* Cost of qualifying and filing for a packaging site that is not yet approved
 * for this launch: the qualification campaign plus the variation dossier. */
var QUALIFICATION_COST = 450000;

/* Re-designating doses already planned for one market to another: relabel,
 * re-carton and re-book freight. Per dose moved. */
var REALLOCATION_PER_DOSE = 0.85;

/* ── small helpers ──────────────────────────────────────────────────── */

function iso(dt) {
  return dt ? dt.toString() : null;
}

/* whole-day difference between two C3 datetimes (b - a), rounded. */
function dayDiff(a, b) {
  if (!a || !b) return 0;
  var da = DateTime.fromString('' + a);
  var db = DateTime.fromString('' + b);
  if (da.millis != null && db.millis != null) {
    return Math.round((db.millis - da.millis) / 86400000);
  }
  var n = 0, dir = 1, cur = da;
  if (db < da) { dir = -1; cur = db; }
  var end = dir === 1 ? db : da;
  while (cur < end && n < 3650) { cur = cur.plusDays(1); n++; }
  return dir * n;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/* Thousands separator, formatted by hand — Rhino locale formatting is not dependable. */
function fmt(n) {
  var s = '' + Math.round(n || 0);
  var neg = s.charAt(0) === '-';
  if (neg) s = s.substring(1);
  var out = '';
  while (s.length > 3) {
    out = ',' + s.substring(s.length - 3) + out;
    s = s.substring(0, s.length - 3);
  }
  return (neg ? '-' : '') + s + out;
}

/* ── readers ────────────────────────────────────────────────────────── */

function findChange(changeId) {
  var id = changeId || DEFAULT_CHANGE;
  var rs = DemandChange.fetch({
    filter: Filter.eq('id', id),
    include: 'this, launch.id, launch.productName, launch.shortName, ' +
             'market.id, market.code, market.name, market.regulatoryBody, ' +
             'marketCommitment.id, marketCommitment.priorityRank, ' +
             'requestedBy.id, requestedBy.name, requestedBy.functionName, ' +
             'decidedBy.id, decidedBy.name, approvedOption.id, approvedOption.label',
    limit: 1
  }).objs;
  return rs && rs.length ? rs.get(0) : null;
}

/* the launch's market commitments in priority order — the plan being revised. */
function commitments(launchId) {
  var out = [];
  var rs = MarketCommitment.fetch({
    filter: Filter.eq('launch', launchId),
    include: 'this, market.id, market.code, market.name, market.regulatoryBody, marketLaunch.id',
    order: 'ascending(priorityRank)', limit: -1
  }).objs;
  if (rs) rs.each(function (c) { out.push(c); });
  return out;
}

function capacitySources(launchId) {
  var out = [];
  var rs = CapacitySource.fetch({
    filter: Filter.eq('launch', launchId),
    include: 'this, site.id, site.name, supplier.id, supplier.name',
    order: 'ascending(id)', limit: -1
  }).objs;
  if (rs) rs.each(function (c) { out.push(c); });
  return out;
}

function packComponents(launchId) {
  var out = [];
  var rs = PackComponent.fetch({
    filter: Filter.eq('launch', launchId),
    include: 'this, supplier.id, supplier.name, supplier.singleSourceFlag',
    order: 'ascending(id)', limit: -1
  }).objs;
  if (rs) rs.each(function (p) { out.push(p); });
  return out;
}

function changeOptions(changeId) {
  var out = [];
  var rs = ScenarioOption.fetch({
    filter: Filter.eq('demandChange', changeId),
    include: 'this, capacitySource.id, capacitySource.name',
    order: 'ascending(sortOrder)', limit: -1
  }).objs;
  if (rs) rs.each(function (o) { out.push(o); });
  return out;
}

/* ── the constraint model ───────────────────────────────────────────────
 * Everything the four options are judged against, computed once from the
 * capacity and component rows so every option uses the same numbers.
 */
function constraintModel(c) {
  var launchId = c.launch && c.launch.id;
  var uplift = Math.max(0, (c.requestedDoses || 0) - (c.baselineDoses || 0));
  var runwayDays = dayDiff(c.requestedAt, c.packagingStartDate);
  var weeks = c.weeksBeforePackaging || Math.max(1, Math.round(runwayDays / 7));
  var packStart = c.packagingStartDate;

  var caps = capacitySources(launchId);
  var pcs = packComponents(launchId);

  /* --- capacity, per operation, for the presentation actually being made ---
   * A lane only counts if it is qualified for this launch and free before
   * packaging starts. Headroom is weekly, so the window is what converts it into
   * doses: eight weeks of runway times the spare doses per week. */
  function laneHeadroom(operation, presentation) {
    var perWeek = 0, lanes = [];
    for (var i = 0; i < caps.length; i++) {
      var s = caps[i];
      if (s.operation !== operation) continue;
      if (presentation && s.presentation !== presentation) continue;
      var usable = s.qualifiedForLaunch !== false &&
                   (!s.availableFrom || !packStart || s.availableFrom <= packStart);
      var hr = Math.max(0, (s.dosesPerWeek || 0) - (s.committedDosesPerWeek || 0));
      if (usable) perWeek += hr;
      lanes.push({
        id: s.id, name: s.name, sourceKind: s.sourceKind, operation: s.operation,
        presentation: s.presentation,
        siteName: (s.site && s.site.name) || (s.supplier && s.supplier.name),
        dosesPerWeek: s.dosesPerWeek || 0,
        committedDosesPerWeek: s.committedDosesPerWeek || 0,
        headroomPerWeek: hr,
        headroomInWindow: hr * weeks,
        availableFrom: iso(s.availableFrom),
        qualifiedForLaunch: s.qualifiedForLaunch !== false,
        qualificationLeadDays: s.qualificationLeadDays || 0,
        costPerThousandDoses: s.costPerThousandDoses || 0,
        regulatoryVariationRequired: !!s.regulatoryVariationRequired,
        usableInWindow: usable
      });
    }
    return { perWeek: perWeek, inWindow: perWeek * weeks, lanes: lanes };
  }

  /* The contested window: the packaging campaign that is oversubscribed. A
   * market only competes for the scarce headroom if its committed first ship
   * falls inside it — which is why a Wave 3 market shipping in February cannot
   * relieve a November packaging bottleneck, however low its priority. */
  var windowEnd = packStart ? DateTime.fromString('' + packStart).plusDays(weeks * 7) : null;

  var basePres = c.baselinePresentation;
  var reqPres = c.requestedPresentation;

  var baseFill = laneHeadroom('FILL_FINISH', basePres);
  var basePack = laneHeadroom('PACKAGING', basePres);
  var reqFill = laneHeadroom('FILL_FINISH', reqPres);

  /* --- components -------------------------------------------------------
   * A component supports a number of doses, not a number of units, so free
   * units are divided by units-per-dose. An order that lands after packaging
   * starts does not count; a lead time longer than the runway means more cannot
   * be bought at any price, which is the hardest constraint in the scenario. */
  function componentCapability(presentation) {
    var limit = null, rows = [];
    for (var i = 0; i < pcs.length; i++) {
      var p = pcs[i];
      if (presentation && p.presentation !== presentation) continue;
      var upd = p.unitsPerDose || 1;
      var free = Math.max(0, (p.onHandUnits || 0) - (p.allocatedUnits || 0));
      var inTime = free +
        ((p.onOrderArrival && packStart && p.onOrderArrival <= packStart) ? (p.onOrderUnits || 0) : 0);
      var doses = Math.floor(inTime / upd);
      var buyable = (p.leadTimeDays || 0) <= runwayDays;
      var row = {
        id: p.id, partNo: p.partNo, name: p.name, componentClass: p.componentClass,
        presentation: p.presentation,
        supplierName: p.supplier && p.supplier.name,
        singleSource: !!(p.supplier && p.supplier.singleSourceFlag),
        onHandUnits: p.onHandUnits || 0, allocatedUnits: p.allocatedUnits || 0,
        freeUnits: free, onOrderUnits: p.onOrderUnits || 0,
        onOrderArrival: iso(p.onOrderArrival),
        onOrderArrivesInTime: !!(p.onOrderArrival && packStart && p.onOrderArrival <= packStart),
        leadTimeDays: p.leadTimeDays || 0,
        leadTimeWithinRunway: buyable,
        unitsPerDose: upd, unitCost: p.unitCost || 0,
        dualSourced: !!p.dualSourced, inRegulatoryDossier: !!p.inRegulatoryDossier,
        supportableDoses: doses
      };
      rows.push(row);
      /* the scarcest component sets the ceiling for the whole presentation */
      if (limit === null || doses < limit.supportableDoses) limit = row;
    }
    return { rows: rows, binding: limit, supportableDoses: limit ? limit.supportableDoses : 0 };
  }

  var baseComp = componentCapability(basePres);
  var reqComp = componentCapability(reqPres);

  /* Marginal cost of one more dose on the baseline route: its components, plus
   * the cheapest fill and pack lane that is actually free in the window — an
   * extra dose goes on the cheapest open line, not on whichever line is listed
   * first. */
  var compCostPerDose = 0;
  for (var q = 0; q < baseComp.rows.length; q++) {
    compCostPerDose += (baseComp.rows[q].unitsPerDose || 0) * (baseComp.rows[q].unitCost || 0);
  }
  function cheapestUsable(lanes) {
    var c2 = null;
    for (var z = 0; z < lanes.length; z++) {
      if (!lanes[z].usableInWindow) continue;
      var rate = (lanes[z].costPerThousandDoses || 0) / 1000;
      if (c2 === null || rate < c2) c2 = rate;
    }
    return c2 || 0;
  }
  var fillCostPerDose = cheapestUsable(baseFill.lanes);
  var packCostPerDose = cheapestUsable(basePack.lanes);
  var convCostPerDose = round2(compCostPerDose + fillCostPerDose + packCostPerDose);

  /* --- cold chain -------------------------------------------------------- */
  var cold = null;
  for (var u = 0; u < pcs.length; u++) {
    if (pcs[u].componentClass === 'COLD_CHAIN') { cold = pcs[u]; break; }
  }
  var coldDoses = cold
    ? Math.floor((Math.max(0, (cold.onHandUnits || 0) - (cold.allocatedUnits || 0)) +
        ((cold.onOrderArrival && packStart && cold.onOrderArrival <= packStart) ? (cold.onOrderUnits || 0) : 0))
        / (cold.unitsPerDose || 1))
    : 0;

  /* --- what actually limits the uplift ---------------------------------- *
   * The uplift has to clear fill, pack, components and cold chain. The lowest
   * of those is what can be served; the gap is what cannot. */
  var servable = Math.min(baseFill.inWindow, basePack.inWindow, baseComp.supportableDoses, coldDoses);
  var upliftServable = Math.min(uplift, Math.max(0, servable));
  var capacityGapPerWeek = Math.max(0, Math.ceil((uplift - basePack.inWindow) / Math.max(1, weeks)));

  /* Which constraint binds first. A lead time longer than the runway is
   * absolute — no amount of money shortens it — so it outranks a capacity gap.
   *
   * Two forms are returned for the same finding, because two different readers
   * need it. `binding` is the sentence a planner has to be able to repeat in a
   * meeting — which component, whose supplier, how many days against how many.
   * `bindingKind` is the short key a chip or a filter can hold; a chip cannot
   * hold a sentence, and a sentence cannot be grouped on. Deriving the key from
   * the prose later would mean parsing English, so both are set here together
   * and can never disagree. */
  var binding = null;
  var bindingKind = null;
  if (reqComp.binding && !reqComp.binding.leadTimeWithinRunway &&
      reqComp.supportableDoses < (c.requestedDoses || 0)) {
    bindingKind = 'COMPONENT_LEAD_TIME';
    binding = reqComp.binding.name + ' (' + reqComp.binding.supplierName + ') — ' +
              reqComp.binding.leadTimeDays + '-day lead time against a ' + runwayDays +
              '-day runway, so only ' + fmt(reqComp.supportableDoses) + ' of the requested ' +
              fmt(c.requestedDoses || 0) + ' doses can be served as ' + reqPres + '.';
  } else if (uplift > basePack.inWindow) {
    bindingKind = 'PACK_CAPACITY';
    binding = 'Secondary packaging headroom — ' + fmt(basePack.perWeek) + ' doses per week across ' +
              weeks + ' weeks is ' + fmt(basePack.inWindow) + ' doses against an uplift of ' +
              fmt(uplift) + ', leaving ' + fmt(uplift - basePack.inWindow) + ' unpackable.';
  } else if (uplift > baseComp.supportableDoses) {
    bindingKind = 'COMPONENTS';
    binding = (baseComp.binding ? baseComp.binding.name : 'A primary component') +
              ' — only ' + fmt(baseComp.supportableDoses) + ' doses can be supported in time.';
  } else if (uplift > coldDoses) {
    bindingKind = 'COLD_CHAIN';
    binding = 'Ultra-cold shipper availability — ' + fmt(coldDoses) + ' doses of shipper capacity.';
  } else {
    bindingKind = 'NONE';
    binding = 'No binding constraint — the uplift can be absorbed as planned.';
  }

  /* pack-mix verdict: how much of the request can actually be served in the
   * presentation Commercial asked for */
  var reqPresServable = Math.min(reqComp.supportableDoses, reqFill.inWindow);

  return {
    uplift: uplift, runwayDays: runwayDays, weeks: weeks,
    baselinePresentation: basePres, requestedPresentation: reqPres,
    fill: baseFill, pack: basePack, requestedFill: reqFill,
    components: baseComp, requestedComponents: reqComp,
    coldChainDoses: coldDoses, coldChain: cold ? {
      partNo: cold.partNo, name: cold.name,
      freeUnits: Math.max(0, (cold.onHandUnits || 0) - (cold.allocatedUnits || 0)),
      supportableDoses: coldDoses
    } : null,
    servableUplift: upliftServable,
    upliftGap: Math.max(0, uplift - upliftServable),
    capacityGapPerWeek: capacityGapPerWeek,
    windowEnd: windowEnd, packagingStart: packStart,
    bindingConstraint: binding,
    bindingKind: bindingKind,
    convCostPerDose: convCostPerDose,
    componentCostPerDose: round2(compCostPerDose),
    requestedPresentationServable: Math.max(0, reqPresServable),
    packMixNote: reqPresServable < (c.requestedDoses || 0)
      ? fmt(Math.max(0, reqPresServable)) + ' of the ' + fmt(c.requestedDoses || 0) +
        ' doses can be served as ' + reqPres + ' from free stock; the remaining ' +
        fmt(Math.max(0, (c.requestedDoses || 0) - reqPresServable)) + ' stay on the ' + basePres +
        ' because the ' + (reqComp.binding ? reqComp.binding.name : 'primary component') +
        ' lead time (' + (reqComp.binding ? reqComp.binding.leadTimeDays : 0) +
        ' days) exceeds the ' + runwayDays + '-day runway. The pack-mix change is ' +
        'deliverable in part, not in full.'
      : 'The requested pack mix can be served in full.'
  };
}

/* ── the market projection ──────────────────────────────────────────────
 * One function turns an option into a market-by-market plan, and every headline
 * figure an option reports is a sum over these rows. That way the cards and the
 * table can never disagree.
 */
function project(c, m, kind) {
  var launchId = c.launch && c.launch.id;
  var cs = commitments(launchId);
  var targetId = c.marketCommitment && c.marketCommitment.id;
  var uplift = m.uplift;

  var rows = [];
  var i, r;

  /* start from the committed plan, unchanged */
  for (i = 0; i < cs.length; i++) {
    var x = cs[i];
    rows.push({
      commitmentId: x.id,
      marketCode: x.market && x.market.code,
      marketName: x.market && x.market.name,
      regulatoryBody: x.market && x.market.regulatoryBody,
      priorityRank: x.priorityRank || 0,
      priorityTier: x.priorityTier,
      committedDoses: x.committedDoses || 0,
      revisedDoses: x.committedDoses || 0,
      wave: x.wave,
      revisedWave: x.wave,
      firstShipDate: iso(x.firstShipDate),
      revisedFirstShipDate: iso(x.firstShipDate),
      slipDays: 0,
      revenuePerDose: x.revenuePerDose || 0,
      contractPenalty: !!x.contractPenalty,
      tenderDeadline: iso(x.tenderDeadline),
      tenderBreached: false,
      isTarget: x.id === targetId,
      /* Only a market packed inside the contested window holds capacity the
       * priority market could use. */
      inContestedWindow: !!(x.firstShipDate && m.windowEnd && x.firstShipDate <= m.windowEnd),
      state: 'PROTECTED',
      note: null,
      _firstShip: x.firstShipDate,
      _tender: x.tenderDeadline
    });
  }

  function find(id) {
    for (var k = 0; k < rows.length; k++) if (rows[k].commitmentId === id) return rows[k];
    return null;
  }
  var target = find(targetId) || rows[0];

  /* helper: push a market out by n days and record the consequence */
  function slip(row, days, newWave) {
    row.slipDays = days;
    if (row._firstShip) {
      var nd = DateTime.fromString('' + row._firstShip).plusDays(days);
      row.revisedFirstShipDate = iso(nd);
      row.tenderBreached = !!(row._tender && nd > row._tender);
    }
    if (newWave) row.revisedWave = newWave;
  }

  function waveOf(label, step) {
    var n = parseInt(('' + (label || 'Wave 1')).replace(/[^0-9]/g, ''), 10);
    if (isNaN(n)) n = 1;
    return 'Wave ' + Math.max(1, n + step);
  }

  var reallocated = 0, resequenced = 0, extraCost = 0, note = null;

  if (kind === 'CONSTRAINED_LAUNCH') {
    /* Serve what the constraints allow and no more. Nothing else moves. */
    target.revisedDoses = (target.committedDoses || 0) + m.servableUplift;
    target.state = m.upliftGap > 0 ? 'CONSTRAINED' : 'UPLIFTED';
    target.note = m.upliftGap > 0
      ? fmt(m.upliftGap) + ' of the requested uplift cannot be packaged inside the window'
      : 'uplift served in full';
    extraCost = m.servableUplift * m.convCostPerDose;

  } else if (kind === 'INVENTORY_REALLOCATION') {
    /* Serve the target in full by taking the gap from the lowest-priority
     * commitments upward. Volume is moved, not created — and it can only be
     * taken from markets packed inside the same contested window, because doses
     * scheduled for a later campaign are not available to this one. */
    target.revisedDoses = (target.committedDoses || 0) + uplift;
    target.state = 'UPLIFTED';
    target.note = 'served in full by reallocating from lower-priority commitments';
    var need = m.upliftGap;
    for (i = rows.length - 1; i >= 0 && need > 0; i--) {
      r = rows[i];
      if (r.commitmentId === target.commitmentId) continue;
      if (!r.inContestedWindow) continue;
      if (r.priorityTier === 'CRITICAL') continue;   /* not reducible without a reversal */
      var take = Math.min(need, r.revisedDoses);
      if (take <= 0) continue;
      r.revisedDoses -= take;
      need -= take;
      reallocated += take;
      r.state = r.revisedDoses > 0 ? 'CONSTRAINED' : 'REALLOCATED';
      r.note = fmt(take) + ' doses reallocated to ' + (target.marketCode || 'the priority market');
    }
    /* Whatever reallocation could not find still has to come off the target. */
    if (need > 0) {
      target.revisedDoses -= need;
      target.state = 'CONSTRAINED';
      target.note = 'reallocation covers all but ' + fmt(need) + ' doses of the request';
    }
    extraCost = m.servableUplift * m.convCostPerDose + reallocated * REALLOCATION_PER_DOSE;
    note = need > 0 ? fmt(need) + ' doses could not be found even after reallocation' : null;

  } else if (kind === 'ADD_CAPACITY') {
    /* Buy the headroom. Volume is created, and the target's date moves to when
     * the added lane is actually available. */
    target.revisedDoses = (target.committedDoses || 0) + uplift;
    target.state = 'UPLIFTED';
    var lane = null;
    for (i = 0; i < m.pack.lanes.length; i++) {
      var L = m.pack.lanes[i];
      if (!L.usableInWindow && L.headroomPerWeek * m.weeks >= m.upliftGap) { lane = L; break; }
    }
    var slipDays = 0;
    if (lane && lane.availableFrom && c.packagingStartDate) {
      slipDays = Math.max(0, dayDiff(c.packagingStartDate, DateTime.fromString(lane.availableFrom)));
    }
    if (slipDays > 0) slip(target, slipDays, null);
    target.note = lane
      ? 'uplift served in full on ' + lane.name + (slipDays > 0 ? ', ' + slipDays + ' days later' : '')
      : 'uplift served in full';
    extraCost = uplift * m.convCostPerDose + QUALIFICATION_COST +
                (lane ? (m.upliftGap / 1000) * Math.max(0, lane.costPerThousandDoses) : 0);

  } else if (kind === 'WAVE_RESEQUENCE') {
    /* Serve the target in full by pushing lower-priority markets out of the
     * contested window, which frees their packaging slots. Nobody loses volume;
     * some markets ship later. Only markets currently *inside* the window can
     * free anything, and each is moved far enough to actually clear it. */
    target.revisedDoses = (target.committedDoses || 0) + uplift;
    target.state = 'UPLIFTED';
    target.note = 'served in full by resequencing later waves';
    var freed = 0;
    for (i = rows.length - 1; i >= 0 && freed < m.upliftGap; i--) {
      r = rows[i];
      if (r.commitmentId === target.commitmentId) continue;
      if (r.priorityRank <= target.priorityRank) continue;
      if (!r.inContestedWindow) continue;
      if (r.priorityTier === 'CRITICAL') continue;
      /* push in whole wave steps until this market is clear of the window */
      var steps = 1;
      if (r._firstShip && m.windowEnd) {
        var gap = dayDiff(r._firstShip, m.windowEnd);
        steps = Math.max(1, Math.ceil((gap + 1) / WAVE_STEP_DAYS));
      }
      slip(r, WAVE_STEP_DAYS * steps, waveOf(r.wave, steps));
      r.state = 'RESEQUENCED';
      r.note = 'moved to ' + r.revisedWave + ', ' + (WAVE_STEP_DAYS * steps) + ' days later';
      resequenced++;
      freed += r.revisedDoses;
      if (r.contractPenalty) {
        extraCost += r.revisedDoses * r.revenuePerDose *
                     PENALTY_RATE_PER_WEEK * (WAVE_STEP_DAYS * steps / 7);
      }
    }
    /* If no eligible market could be moved far enough, the request is not fully
     * served by resequencing either — say so rather than implying it was. */
    if (freed < m.upliftGap) {
      var short = m.upliftGap - freed;
      target.revisedDoses -= short;
      target.state = 'CONSTRAINED';
      target.note = 'resequencing frees ' + fmt(freed) + ' doses of slot, ' + fmt(short) +
                    ' short of the request';
      note = fmt(short) + ' doses of the request remain unserved after resequencing';
    }
    extraCost += Math.max(0, target.revisedDoses - (target.committedDoses || 0)) * m.convCostPerDose;
  }

  /* --- roll the rows up ------------------------------------------------- */
  var served = 0, committed = 0, revenue = 0, baseRevenue = 0;
  var whole = 0, hit = 0, breached = 0, maxSlip = 0;
  var keptNames = [], hitNames = [];
  for (i = 0; i < rows.length; i++) {
    r = rows[i];
    served += r.revisedDoses;
    committed += r.committedDoses;
    revenue += r.revisedDoses * r.revenuePerDose;
    baseRevenue += r.committedDoses * r.revenuePerDose;
    if (r.tenderBreached) breached++;
    if (r.slipDays > maxSlip) maxSlip = r.slipDays;
    if (r.state === 'PROTECTED' || r.state === 'UPLIFTED') {
      whole++; keptNames.push(r.marketCode);
    } else {
      hit++; hitNames.push(r.marketCode);
    }
    delete r._firstShip; delete r._tender;
  }

  return {
    rows: rows,
    targetCode: target.marketCode,
    targetRevised: target.revisedDoses,
    upliftServed: Math.max(0, target.revisedDoses - (target.committedDoses || 0)),
    upliftShort: Math.max(0, uplift - (target.revisedDoses - (target.committedDoses || 0))),
    reallocatedDoses: reallocated,
    resequencedMarkets: resequenced,
    totalDoses: served,
    baselineDoses: committed,
    revenue: round2(revenue),
    baselineRevenue: round2(baseRevenue),
    incrementalRevenue: round2(revenue - baseRevenue),
    marketsWhole: whole, marketsImpacted: hit,
    tendersBreached: breached, maxSlipDays: maxSlip,
    keptMarkets: keptNames.join(', '), impactedMarkets: hitNames.join(', '),
    extraCost: round2(extraCost),
    note: note
  };
}

/* ── the dashboard bundle ───────────────────────────────────────────── */
function buildBundle(c) {
  if (!c) return null;

  var m = constraintModel(c);
  var launchId = c.launch && c.launch.id;
  var cs = commitments(launchId);

  var oRows = [], opts = changeOptions(c.id);
  for (var k = 0; k < opts.length; k++) {
    var o = opts[k];
    oRows.push({
      id: o.id, label: o.label, optionKind: o.optionKind, sortOrder: o.sortOrder || 0,
      description: o.description || null,
      dosesServed: o.dosesServed || 0, dosesLost: o.dosesLost || 0,
      dayImpact: o.dayImpact || 0, executionDays: o.executionDays || 0,
      incrementalCost: o.incrementalCost || 0,
      revenueProtected: o.revenueProtected || 0, revenueLost: o.revenueLost || 0,
      marketsProtected: o.marketsProtected || 0, marketsImpacted: o.marketsImpacted || 0,
      protectedMarkets: o.protectedMarkets || null, impactedMarkets: o.impactedMarkets || null,
      feasible: o.feasible !== false, infeasibleReason: o.infeasibleReason || null,
      regulatoryImpact: !!o.regulatoryImpact, regulatoryDetail: o.regulatoryDetail || null,
      residualRisk: o.residualRisk || null,
      score: o.score || 0, recommended: !!o.recommended, status: o.status || 'PROPOSED',
      capacitySourceName: o.capacitySource && o.capacitySource.name
    });
  }

  /* The market table: the committed plan until a decision is committed, and the
   * persisted revision afterwards, so the view always shows the live truth. */
  var committedStage = c.stage === 'COMMITTED';
  var mRows = [];
  for (var i = 0; i < cs.length; i++) {
    var x = cs[i];
    var rev = x.revisedDoses != null ? x.revisedDoses : (x.committedDoses || 0);
    mRows.push({
      commitmentId: x.id,
      marketCode: x.market && x.market.code,
      marketName: x.market && x.market.name,
      regulatoryBody: x.market && x.market.regulatoryBody,
      priorityRank: x.priorityRank || 0, priorityTier: x.priorityTier,
      committedDoses: x.committedDoses || 0,
      revisedDoses: committedStage ? rev : (x.committedDoses || 0),
      wave: x.wave, revisedWave: committedStage ? (x.revisedWave || x.wave) : x.wave,
      firstShipDate: iso(x.firstShipDate),
      revisedFirstShipDate: committedStage
        ? iso(x.revisedFirstShipDate || x.firstShipDate) : iso(x.firstShipDate),
      presentation: x.presentation, skuCode: x.skuCode,
      revenuePerDose: x.revenuePerDose || 0,
      committedRevenue: x.committedRevenue || 0,
      contractPenalty: !!x.contractPenalty, tenderDeadline: iso(x.tenderDeadline),
      status: x.status || 'COMMITTED',
      isTarget: !!(c.marketCommitment && c.marketCommitment.id === x.id)
    });
  }

  var bookDoses = 0, bookRevenue = 0;
  for (var j = 0; j < cs.length; j++) {
    bookDoses += cs[j].committedDoses || 0;
    bookRevenue += cs[j].committedRevenue || 0;
  }

  return {
    change: {
      id: c.id, requestNo: c.requestNo,
      launchId: launchId,
      launchName: (c.launch && (c.launch.shortName || c.launch.productName)) || null,
      marketCode: c.market && c.market.code,
      marketName: c.market && c.market.name,
      regulatoryBody: c.market && c.market.regulatoryBody,
      requestedByName: c.requestedBy && c.requestedBy.name,
      requestedByFunction: c.requestedBy && c.requestedBy.functionName,
      requestedAt: iso(c.requestedAt),
      weeksBeforePackaging: c.weeksBeforePackaging || 0,
      packagingStartDate: iso(c.packagingStartDate),
      baselineDoses: c.baselineDoses || 0, requestedDoses: c.requestedDoses || 0,
      upliftDoses: m.uplift, upliftPercent: c.upliftPercent || 0,
      baselinePresentation: c.baselinePresentation, requestedPresentation: c.requestedPresentation,
      baselineSku: c.baselineSku, requestedSku: c.requestedSku,
      rationale: c.rationale, incrementalRevenue: c.incrementalRevenue || 0,
      stage: c.stage || 'RAISED',
      capacityShortfall: !!c.capacityShortfall,
      capacityGapDosesPerWeek: c.capacityGapDosesPerWeek || 0,
      componentShortfall: !!c.componentShortfall,
      componentGapUnits: c.componentGapUnits || 0,
      logisticsShortfall: !!c.logisticsShortfall,
      bindingConstraint: c.bindingConstraint || null,
      approvedOptionId: c.approvedOption && c.approvedOption.id,
      approvedOptionLabel: c.approvedOption && c.approvedOption.label,
      decisionAuthority: c.decisionAuthority || null,
      decidedByName: c.decidedBy && c.decidedBy.name,
      decidedAt: iso(c.decidedAt),
      decisionRationale: c.decisionRationale || null,
      commitmentsUpdated: !!c.commitmentsUpdated,
      updatedCommitmentCount: c.updatedCommitmentCount || 0
    },
    constraints: {
      runwayDays: m.runwayDays, weeks: m.weeks,
      fillHeadroomPerWeek: m.fill.perWeek, fillHeadroomInWindow: m.fill.inWindow,
      packHeadroomPerWeek: m.pack.perWeek, packHeadroomInWindow: m.pack.inWindow,
      requestedFillHeadroomInWindow: m.requestedFill.inWindow,
      componentCeilingDoses: m.components.supportableDoses,
      bindingComponent: m.components.binding ? m.components.binding.name : null,
      requestedComponentCeilingDoses: m.requestedComponents.supportableDoses,
      requestedBindingComponent: m.requestedComponents.binding
        ? m.requestedComponents.binding.name : null,
      coldChainDoses: m.coldChainDoses, coldChain: m.coldChain,
      servableUplift: m.servableUplift, upliftGap: m.upliftGap,
      capacityGapPerWeek: m.capacityGapPerWeek,
      bindingConstraint: m.bindingConstraint,
      bindingKind: m.bindingKind,
      requestedPresentationServable: m.requestedPresentationServable,
      packMixNote: m.packMixNote,
      convCostPerDose: m.convCostPerDose,
      lanes: m.fill.lanes.concat(m.pack.lanes).concat(m.requestedFill.lanes),
      components: m.components.rows.concat(m.requestedComponents.rows)
    },
    options: oRows,
    markets: mRows,
    summary: {
      marketCount: cs.length,
      bookDoses: bookDoses, bookRevenue: round2(bookRevenue),
      upliftDoses: m.uplift, upliftServable: m.servableUplift, upliftGap: m.upliftGap,
      optionCount: oRows.length,
      feasibleOptionCount: oRows.filter(function (o) { return o.feasible; }).length,
      marketsRevised: mRows.filter(function (r) {
        return r.revisedDoses !== r.committedDoses || r.revisedWave !== r.wave;
      }).length
    }
  };
}

/* ── read: plan(changeId) ───────────────────────────────────────────── */
function plan(changeId) {
  return buildBundle(findChange(changeId));
}

/* ── step 1: assessConstraints(changeId) ───────────────────────────── */
function assessConstraints(changeId) {
  var c = findChange(changeId);
  if (!c) throw new Error('No demand change found for ' + changeId);

  var m = constraintModel(c);

  var compGapUnits = 0;
  if (m.requestedComponents.binding &&
      m.requestedComponents.supportableDoses < (c.requestedDoses || 0)) {
    var b = m.requestedComponents.binding;
    compGapUnits = Math.ceil(((c.requestedDoses || 0) - b.supportableDoses) * (b.unitsPerDose || 1));
  }

  DemandChange.make({
    id: c.id,
    stage: 'CONSTRAINTS_ASSESSED',
    capacityShortfall: m.uplift > m.pack.inWindow || m.uplift > m.fill.inWindow,
    capacityGapDosesPerWeek: m.capacityGapPerWeek,
    componentShortfall: compGapUnits > 0,
    componentGapUnits: compGapUnits,
    logisticsShortfall: m.uplift > m.coldChainDoses,
    bindingConstraint: m.bindingConstraint
  }).merge();

  return buildBundle(findChange(c.id));
}

/* ── step 2: evaluateOptions(changeId) ─────────────────────────────────
 * The four comparisons the scenario names, each computed from the same
 * constraint model so the cards are commensurable.
 */
function evaluateOptions(changeId) {
  var c = findChange(changeId);
  if (!c) throw new Error('No demand change found for ' + changeId);
  if (c.stage === 'RAISED') {
    throw new Error('Constraints have not been assessed for ' + c.id +
                    ' — run assessConstraints first.');
  }

  var m = constraintModel(c);
  var cs = commitments(c.launch && c.launch.id);

  /* the unqualified lane an add-capacity option would have to buy */
  var addLane = null;
  for (var i = 0; i < m.pack.lanes.length; i++) {
    var L = m.pack.lanes[i];
    if (!L.usableInWindow && L.headroomPerWeek * m.weeks >= m.upliftGap) { addLane = L; break; }
  }
  var qualInRunway = addLane ? addLane.qualificationLeadDays <= m.runwayDays : false;

  var defs = [
    {
      id: 'seed_sopt_dc_constrained', sortOrder: 1, kind: 'CONSTRAINED_LAUNCH',
      label: 'Constrained launch — serve what capacity allows',
      regulatoryImpact: false,
      regulatoryDetail: 'No filing — same sites, same approved components, same pack.',
      feasible: true, infeasibleReason: null,
      executionDays: 0
    },
    {
      id: 'seed_sopt_dc_realloc', sortOrder: 2, kind: 'INVENTORY_REALLOCATION',
      label: 'Inventory reallocation — move doses from lower-priority markets',
      regulatoryImpact: false,
      regulatoryDetail: 'No filing — re-designation within approved markets; national ' +
                        'labelling and carton change only.',
      feasible: true, infeasibleReason: null,
      executionDays: 14
    },
    {
      id: 'seed_sopt_dc_addcap', sortOrder: 3, kind: 'ADD_CAPACITY',
      label: addLane ? ('Add capacity — qualify ' + addLane.name) : 'Add capacity — contract packer',
      regulatoryImpact: addLane ? addLane.regulatoryVariationRequired : true,
      regulatoryDetail: addLane && addLane.regulatoryVariationRequired
        ? 'Type IA notification (EMA) plus an FDA supplement to add the packaging site to ' +
          'the dossier; qualification run required before first commercial pack.'
        : 'No filing required for an already-qualified lane.',
      feasible: !!addLane && qualInRunway,
      infeasibleReason: !addLane
        ? 'No packaging lane with enough headroom exists to qualify inside the window.'
        : (!qualInRunway
            ? addLane.name + ' needs ' + addLane.qualificationLeadDays +
              ' days of qualification against a ' + m.runwayDays +
              '-day runway, so it cannot be brought online in time.'
            : null),
      executionDays: addLane && addLane.availableFrom
        ? Math.max(0, dayDiff(c.requestedAt, DateTime.fromString(addLane.availableFrom)))
        : 0,
      capacitySource: addLane ? { id: addLane.id } : null
    },
    {
      id: 'seed_sopt_dc_resequence', sortOrder: 4, kind: 'WAVE_RESEQUENCE',
      label: 'Market-wave resequencing — move later waves back one step',
      regulatoryImpact: false,
      regulatoryDetail: 'No filing — launch sequence is a commercial plan, not a dossier commitment.',
      feasible: true, infeasibleReason: null,
      executionDays: 7
    }
  ];

  var opts = [];
  for (var d = 0; d < defs.length; d++) {
    var def = defs[d];
    var p = project(c, m, def.kind);

    /* An option that breaches a tender window it was supposed to protect is not
     * a trade-off, it is a failure — rule it out on the data. */
    var feasible = def.feasible && p.tendersBreached === 0;
    var why = def.infeasibleReason;
    if (def.feasible && p.tendersBreached > 0) {
      why = 'Pushes ' + p.tendersBreached + ' tender deadline(s) past their close date, which ' +
            'forfeits the award rather than delaying it.';
    }

    var desc, risk;
    if (def.kind === 'CONSTRAINED_LAUNCH') {
      desc = 'Hold every other market exactly as planned and give ' + p.targetCode + ' the ' +
             fmt(m.servableUplift) + ' doses the ' + fmt(m.pack.perWeek) +
             '-dose-per-week packaging headroom supports across ' + m.weeks + ' weeks. ' +
             fmt(m.upliftGap) + ' doses of the request go unserved.';
      risk = 'Commercial does not get the volume it asked for: ' + fmt(p.upliftShort) +
             ' doses and ' + fmt(round2(p.upliftShort * (m.uplift > 0 ?
               ((c.incrementalRevenue || 0) / m.uplift) : 0))) +
             ' EUR of incremental revenue are forgone. No plan, site or partner changes.';
    } else if (def.kind === 'INVENTORY_REALLOCATION') {
      desc = 'Serve ' + p.targetCode + ' in full by moving ' + fmt(p.reallocatedDoses) +
             ' doses from the lowest-priority commitments (' + p.impactedMarkets +
             ') into the priority wave. Volume is moved, not created, so no new capacity ' +
             'or component buy is needed.';
      risk = p.impactedMarkets + ' lose volume they were committed to. Doses must be ' +
             're-cartoned and re-labelled for the receiving market before release.';
    } else if (def.kind === 'ADD_CAPACITY') {
      desc = addLane
        ? 'Qualify and book ' + addLane.name + ' — ' + fmt(addLane.headroomPerWeek) +
          ' doses per week of spare packaging, available from ' + addLane.availableFrom +
          '. Serves the request in full and leaves every other market whole, at the cost of ' +
          'a qualification run, a filing and a ' + p.maxSlipDays + '-day slip on ' +
          p.targetCode + '.'
        : 'No qualifiable lane available.';
      risk = addLane
        ? 'Qualification must complete on first pass; the lane is only free from ' +
          addLane.availableFrom + ', which puts ' + p.targetCode + ' ' + p.maxSlipDays +
          ' days behind its committed ship date. The Type IA notification must be filed ' +
          'before the first commercial pack.'
        : 'Not executable.';
    } else {
      desc = 'Serve ' + p.targetCode + ' in full by moving ' + p.resequencedMarkets +
             ' later-wave market(s) (' + p.impactedMarkets + ') back one ' + WAVE_STEP_DAYS +
             '-day wave step, which frees their packaging slots. No market loses volume.';
      risk = p.resequencedMarkets + ' market(s) ship ' + WAVE_STEP_DAYS +
             ' days later than committed. Penalty-bearing contracts among them accrue ' +
             'late-delivery exposure even though their tender windows are still met.';
    }

    opts.push({
      id: def.id, sortOrder: def.sortOrder, optionKind: def.kind, label: def.label,
      description: desc,
      dosesServed: p.upliftServed,
      dosesLost: p.upliftShort + p.reallocatedDoses,
      dayImpact: p.maxSlipDays,
      executionDays: def.executionDays,
      incrementalCost: p.extraCost,
      revenueProtected: p.revenue,
      revenueLost: round2(Math.max(0, (p.baselineRevenue + (c.incrementalRevenue || 0)) - p.revenue)),
      marketsProtected: p.marketsWhole,
      marketsImpacted: p.marketsImpacted,
      protectedMarkets: p.keptMarkets || null,
      impactedMarkets: p.impactedMarkets || null,
      feasible: feasible, infeasibleReason: why,
      regulatoryImpact: def.regulatoryImpact, regulatoryDetail: def.regulatoryDetail,
      residualRisk: risk,
      score: 0, recommended: false,
      status: feasible ? 'PROPOSED' : 'RULED_OUT',
      capacitySource: def.capacitySource || null,
      /* scoring inputs, not persisted */
      _gain: round2((p.revenue - p.baselineRevenue) - p.extraCost)
    });
  }

  /* --- score --------------------------------------------------------------
   * Every option starts from the same committed book, so scoring on total
   * revenue would put all four inside a two-point band and make the ranking
   * meaningless. What differs between them is the *delta* each one creates, so
   * that is what value is measured on:
   *
   *   value  (55%) — net revenue gained (revenue change less the option's cost)
   *                  against the most the uplift could possibly be worth, which
   *                  is the full incremental revenue Commercial is asking for.
   *   timing (25%) — whether the plan still lands on its committed dates; every
   *                  week of slip on any market costs a tenth of the component.
   *   reach  (20%) — share of markets left whole, so an option that buys volume
   *                  by taking it from someone else is not scored as if it were
   *                  free.
   *
   * Infeasible options score zero and cannot be recommended.                */
  var upside = c.incrementalRevenue || 0;

  var best = null;
  for (var s = 0; s < opts.length; s++) {
    var o = opts[s];
    if (!o.feasible) { o.score = 0; continue; }
    var valScore = upside > 0 ? Math.max(0, Math.min(1, o._gain / upside)) : 0;
    var lateWeeks = o.dayImpact / 7;
    var timScore = Math.max(0, 1 - 0.10 * lateWeeks);
    var reachScore = cs.length > 0 ? (o.marketsProtected / cs.length) : 0;
    o.score = round2(100 * (0.55 * valScore + 0.25 * timScore + 0.20 * reachScore));
    if (!best || o.score > best.score) best = o;
  }
  if (best) best.recommended = true;

  for (var p2 = 0; p2 < opts.length; p2++) {
    var w = opts[p2];
    ScenarioOption.make({
      id: w.id, demandChange: { id: c.id }, label: w.label, optionKind: w.optionKind,
      sortOrder: w.sortOrder, description: w.description,
      dosesServed: w.dosesServed, dosesLost: w.dosesLost, dayImpact: w.dayImpact,
      executionDays: w.executionDays, incrementalCost: w.incrementalCost,
      revenueProtected: w.revenueProtected, revenueLost: w.revenueLost,
      marketsProtected: w.marketsProtected, marketsImpacted: w.marketsImpacted,
      protectedMarkets: w.protectedMarkets, impactedMarkets: w.impactedMarkets,
      feasible: w.feasible, infeasibleReason: w.infeasibleReason,
      regulatoryImpact: w.regulatoryImpact, regulatoryDetail: w.regulatoryDetail,
      residualRisk: w.residualRisk, score: w.score, recommended: w.recommended,
      status: w.status, capacitySource: w.capacitySource
    }).merge();
  }

  DemandChange.make({ id: c.id, stage: 'OPTIONS_EVALUATED' }).merge();
  return buildBundle(findChange(c.id));
}

/* ── step 3: allocation(changeId, optionId) ────────────────────────────
 * The market-by-market consequence of one option, before anyone signs.
 */
function allocation(changeId, optionId) {
  var c = findChange(changeId);
  if (!c) throw new Error('No demand change found for ' + changeId);

  var opts = changeOptions(c.id);
  var chosen = null;
  for (var i = 0; i < opts.length; i++) if (opts[i].id === optionId) chosen = opts[i];
  if (!chosen) throw new Error('No option ' + optionId + ' on change ' + c.id);

  var m = constraintModel(c);
  var p = project(c, m, chosen.optionKind);

  return {
    changeId: c.id, optionId: chosen.id, optionLabel: chosen.label,
    optionKind: chosen.optionKind, feasible: chosen.feasible !== false,
    rows: p.rows,
    summary: {
      targetCode: p.targetCode, targetRevised: p.targetRevised,
      upliftServed: p.upliftServed, upliftShort: p.upliftShort,
      reallocatedDoses: p.reallocatedDoses, resequencedMarkets: p.resequencedMarkets,
      totalDoses: p.totalDoses, baselineDoses: p.baselineDoses,
      revenue: p.revenue, baselineRevenue: p.baselineRevenue,
      incrementalRevenue: p.incrementalRevenue,
      marketsWhole: p.marketsWhole, marketsImpacted: p.marketsImpacted,
      tendersBreached: p.tendersBreached, maxSlipDays: p.maxSlipDays,
      extraCost: p.extraCost
    }
  };
}

/* ── step 4: decide(changeId, optionId, signerId, rationale) ────────────
 * Two guardrails make the decision governed rather than merely recorded: an
 * option ruled out on the data cannot be approved, and the signer must hold a
 * Commercial or Governance function — a cross-market supply trade-off is not a
 * Quality signature.
 */
function decide(changeId, optionId, signerId, rationale) {
  var c = findChange(changeId);
  if (!c) throw new Error('No demand change found for ' + changeId);
  if (c.stage !== 'OPTIONS_EVALUATED' && c.stage !== 'DECIDED' && c.stage !== 'COMMITTED') {
    throw new Error('Options have not been evaluated for ' + c.id +
                    ' — run evaluateOptions first.');
  }

  var opts = changeOptions(c.id);
  var chosen = null;
  for (var i = 0; i < opts.length; i++) if (opts[i].id === optionId) chosen = opts[i];
  if (!chosen) throw new Error('No option ' + optionId + ' on change ' + c.id);
  if (chosen.feasible === false) {
    throw new Error('Option "' + chosen.label + '" was ruled out and cannot be approved: ' +
                    chosen.infeasibleReason);
  }

  var sid = signerId || 'seed_person_hf';
  var ps = Person.fetch({ filter: Filter.eq('id', sid), include: 'this', limit: 1 }).objs;
  if (!ps || !ps.length) throw new Error('No person ' + sid + ' to sign the decision.');
  var signer = ps.get(0);
  var fn = ('' + (signer.functionName || '')).toLowerCase();
  if (fn.indexOf('commercial') < 0 && fn.indexOf('governance') < 0) {
    throw new Error('A market-commitment change must be signed by Commercial or Governance. ' +
                    signer.name + ' holds the ' + signer.functionName + ' function.');
  }

  var now = DateTime.now();
  var why = rationale ||
    'Approved against the assessed constraint (' + (c.bindingConstraint || 'as computed') +
    ') and the market plan this option supports.';

  for (var j = 0; j < opts.length; j++) {
    var o = opts[j];
    if (o.id === chosen.id) ScenarioOption.make({ id: o.id, status: 'APPROVED' }).merge();
    else if (o.feasible !== false) ScenarioOption.make({ id: o.id, status: 'REJECTED' }).merge();
  }

  ESignature.make({
    id: 'sig_' + c.id + '_decision',
    signedAt: now,
    signer: { id: signer.id },
    printedName: signer.name,
    signerRoleAtTime: signer.role || 'Launch Steering Committee',
    meaning: 'approved',
    entityTypeName: 'DemandChange',
    entityId: c.id,
    signedPayloadHash: 'sha256:' + c.id + ':' + chosen.id + ':' +
                       ((c.requestedDoses || 0) - (c.baselineDoses || 0)),
    reauthenticatedAt: now,
    reasonCode: 'MARKET_COMMITMENT_CHANGE',
    justification: why,
    correlationId: c.requestNo
  }).merge();

  DemandChange.make({
    id: c.id, stage: 'DECIDED', approvedOption: { id: chosen.id },
    decisionAuthority: 'Launch Steering Committee',
    decidedBy: { id: signer.id }, decidedAt: now, decisionRationale: why
  }).merge();

  return buildBundle(findChange(c.id));
}

/* ── step 5: commit(changeId) ──────────────────────────────────────────
 * Update all affected plans, owners, sites, partners and market commitments.
 * This is the clause most demos skip: a decision that does not land anywhere is
 * not a decision.
 */
function commit(changeId) {
  var c = findChange(changeId);
  if (!c) throw new Error('No demand change found for ' + changeId);
  if (c.stage !== 'DECIDED' && c.stage !== 'COMMITTED') {
    throw new Error('No approved decision on ' + c.id + ' — run decide first.');
  }

  var approvedId = c.approvedOption && c.approvedOption.id;
  var opts = changeOptions(c.id);
  var chosen = null;
  for (var i = 0; i < opts.length; i++) if (opts[i].id === approvedId) chosen = opts[i];
  if (!chosen) throw new Error('Approved option not found on ' + c.id);

  var m = constraintModel(c);
  var p = project(c, m, chosen.optionKind);
  var requestedAt = c.requestedAt ? DateTime.fromString('' + c.requestedAt) : DateTime.now();

  /* The commitment and task writes below are absolute values against fixed ids,
   * so re-running commit is harmless. The capacity booking and the component
   * draw-down are *increments*, though, so they are applied only on the first
   * pass — otherwise a second call would book the lane twice and consume the
   * components twice. */
  var firstPass = c.stage !== 'COMMITTED';

  /* --- market commitments ------------------------------------------------ */
  var changed = 0;
  for (var j = 0; j < p.rows.length; j++) {
    var r = p.rows[j];
    var moved = r.revisedDoses !== r.committedDoses || r.revisedWave !== r.wave;
    var status = 'COMMITTED';
    if (r.state === 'CONSTRAINED') status = 'CONSTRAINED';
    else if (r.state === 'REALLOCATED') status = 'REALLOCATED';
    else if (r.state === 'RESEQUENCED') status = 'DEFERRED';
    MarketCommitment.make({
      id: r.commitmentId,
      revisedDoses: r.revisedDoses,
      revisedWave: r.revisedWave,
      revisedFirstShipDate: r.revisedFirstShipDate
        ? DateTime.fromString('' + r.revisedFirstShipDate) : null,
      status: status
    }).merge();
    if (moved) changed++;
  }

  /* --- the target market's SKU and presentation -------------------------- *
   * Only as far as the components actually allow: the pack-mix change is
   * deliverable in part, so the commitment records what can be shipped. */
  var targetId = c.marketCommitment && c.marketCommitment.id;
  if (targetId && m.requestedPresentationServable > 0) {
    MarketCommitment.make({
      id: targetId,
      presentation: m.requestedPresentationServable >= (c.requestedDoses || 0)
        ? c.requestedPresentation
        : c.baselinePresentation + ' (+ ' + fmt(m.requestedPresentationServable) + ' ' +
          c.requestedPresentation + ')',
      skuCode: m.requestedPresentationServable >= (c.requestedDoses || 0)
        ? c.requestedSku : c.baselineSku
    }).merge();
  }

  /* --- the site or partner that carries the change ----------------------- */
  if (firstPass && chosen.optionKind === 'ADD_CAPACITY' &&
      chosen.capacitySource && chosen.capacitySource.id) {
    var lane = CapacitySource.fetch({
      filter: Filter.eq('id', chosen.capacitySource.id), include: 'this', limit: 1
    }).objs;
    if (lane && lane.length) {
      var L = lane.get(0);
      var book = Math.min(m.upliftGap, Math.max(0, (L.dosesPerWeek || 0) - (L.committedDosesPerWeek || 0)) * m.weeks);
      CapacitySource.make({
        id: L.id,
        committedDosesPerWeek: (L.committedDosesPerWeek || 0) + Math.ceil(book / Math.max(1, m.weeks)),
        qualifiedForLaunch: true
      }).merge();
    }
  }

  /* --- the components the plan now consumes ------------------------------ */
  var served = firstPass ? p.upliftServed : 0;
  if (served > 0) {
    for (var k = 0; k < m.components.rows.length; k++) {
      var pc = m.components.rows[k];
      var need = Math.ceil(served * (pc.unitsPerDose || 1));
      PackComponent.make({
        id: pc.id, allocatedUnits: (pc.allocatedUnits || 0) + need
      }).merge();
    }
  }

  /* --- owned, dated work across every function -------------------------- */
  var tasks = [
    { key: 'cm1', owner: 'T. Bergmann · Commercial', due: 3,
      name: 'Confirm the revised ' + p.targetCode + ' commitment of ' + fmt(p.targetRevised) +
            ' doses and re-issue the customer schedule',
      detail: 'Commercial · market commitment of record' },
    { key: 'sc1', owner: 'A. Patel · Supply Chain', due: 5,
      name: chosen.optionKind === 'ADD_CAPACITY'
        ? 'Book the added packaging lane and re-cut the master production schedule'
        : 'Re-cut the master production schedule against the revised wave plan',
      detail: 'Supply Chain · production plan' },
    { key: 'mf1', owner: 'L. Haugen · Manufacturing', due: 7,
      name: 'Confirm ' + fmt(m.servableUplift) + ' doses of additional packaging output against ' +
            fmt(m.pack.perWeek) + ' doses per week of hall B headroom',
      detail: 'Manufacturing · site capacity confirmation' },
    { key: 'so1', owner: 'M. Okafor · Sourcing', due: 5,
      name: 'Place the component call-off for the revised volume and escalate the ' +
            (m.requestedComponents.binding ? m.requestedComponents.binding.name : 'primary component') +
            ' lead time with the supplier',
      detail: 'Sourcing · component call-off and supplier escalation' },
    { key: 'ra1', owner: 'S. Lindqvist · Regulatory', due: 6,
      name: chosen.regulatoryImpact
        ? 'File the ' + (chosen.regulatoryDetail || 'required variation') +
          ' before the first commercial pack'
        : 'Confirm no variation is triggered and log the plan change in the dossier file',
      detail: 'Regulatory · ' + (chosen.regulatoryImpact ? 'filing required' : 'no filing required') },
    { key: 'lg1', owner: 'R. Devi · Logistics', due: 8,
      name: 'Re-book cold-chain shippers and lanes against the revised wave dates',
      detail: 'Logistics · ' + fmt(m.coldChainDoses) + ' doses of shipper capacity available' },
    { key: 'ma1', owner: 'D. Moreau · Market Access', due: 6,
      name: p.marketsImpacted > 0
        ? 'Re-confirm tender and contract positions for ' + p.impactedMarkets
        : 'Confirm no tender or contract position is affected',
      detail: 'Market Access · contractual exposure' },
    { key: 'fi1', owner: 'J. Ruiz · Finance', due: 10,
      name: 'Re-forecast the launch P&L for ' + fmt(p.incrementalRevenue) +
            ' EUR of net revenue change and ' + fmt(chosen.incrementalCost) + ' EUR of added cost',
      detail: 'Finance · launch P&L re-forecast' }
  ];

  var n = 0;
  for (var t = 0; t < tasks.length; t++) {
    var tk = tasks[t];
    ActionPlanTask.make({
      id: 'task_' + c.id + '_' + tk.key,
      name: tk.name, owner: tk.owner, detail: tk.detail,
      agentRunnable: false, optionKey: chosen.optionKind,
      status: 'Assigned', dueDate: requestedAt.plusDays(tk.due)
    }).merge();
    n++;
  }

  DemandChange.make({
    id: c.id, stage: 'COMMITTED',
    commitmentsUpdated: true, updatedCommitmentCount: changed
  }).merge();

  return buildBundle(findChange(c.id));
}

/* ── reset(changeId) — restore the pre-request baseline ─────────────────
 *
 * A sparse merge cannot un-set a field: the platform drops nulls rather than
 * writing them. Anything that must go back to *empty* is therefore rebuilt —
 * the row is removed and re-created from the fields that belong to the baseline.
 */
function reset(changeId) {
  var c = findChange(changeId);
  if (!c) throw new Error('No demand change found for ' + changeId);
  var launchId = c.launch && c.launch.id;

  /* drop the computed options and the artefacts a decision produced */
  ScenarioOption.removeAll({ filter: Filter.eq('demandChange', c.id) }, true);
  ESignature.removeAll({ filter: Filter.eq('entityId', c.id) }, true);
  var keys = ['cm1', 'sc1', 'mf1', 'so1', 'ra1', 'lg1', 'ma1', 'fi1'];
  var f = Filter.eq('id', 'task_' + c.id + '_' + keys[0]);
  for (var q = 1; q < keys.length; q++) f = f.or(Filter.eq('id', 'task_' + c.id + '_' + keys[q]));
  ActionPlanTask.removeAll({ filter: f }, true);

  /* Rebuild the market commitments so the revised-* fields genuinely clear, and
   * restore the seeded presentation and SKU the commit step may have rewritten. */
  var targetId = c.marketCommitment && c.marketCommitment.id;
  var cs = commitments(launchId);
  for (var i = 0; i < cs.length; i++) {
    var x = cs[i];
    var snap = {
      id: x.id,
      launch: launchId ? { id: launchId } : null,
      market: x.market && x.market.id ? { id: x.market.id } : null,
      marketLaunch: x.marketLaunch && x.marketLaunch.id ? { id: x.marketLaunch.id } : null,
      priorityRank: x.priorityRank, priorityTier: x.priorityTier,
      committedDoses: x.committedDoses,
      skuCode: x.id === targetId ? c.baselineSku : x.skuCode,
      presentation: x.id === targetId ? c.baselinePresentation : x.presentation,
      firstShipDate: x.firstShipDate, wave: x.wave,
      revenuePerDose: x.revenuePerDose, committedRevenue: x.committedRevenue,
      tenderDeadline: x.tenderDeadline, contractPenalty: x.contractPenalty,
      status: 'COMMITTED'
    };
    MarketCommitment.removeAll({ filter: Filter.eq('id', x.id) }, true);
    MarketCommitment.make(snap).create();
  }

  /* un-book any capacity the commit step reserved, and release the components */
  var caps = capacitySources(launchId);
  var CAP_BASE = {
    seed_cap_puurs_mdv: 1050000, seed_cap_puurs_pfs: 210000, seed_cap_halle_cmo: 180000,
    seed_cap_puurs_pack: 575000, seed_cap_ferentino_pack: 90000, seed_cap_kzo_lyo: 120000
  };
  var CAP_QUAL = { seed_cap_ferentino_pack: false };
  for (var j = 0; j < caps.length; j++) {
    var L = caps[j];
    var base = CAP_BASE[L.id];
    if (base != null && L.committedDosesPerWeek !== base) {
      CapacitySource.make({ id: L.id, committedDosesPerWeek: base }).merge();
    }
    if (CAP_QUAL[L.id] === false && L.qualifiedForLaunch !== false) {
      CapacitySource.make({ id: L.id, qualifiedForLaunch: false }).merge();
    }
  }

  var PC_BASE = {
    seed_pkc_com_vial: 262000, seed_pkc_com_stopper: 262000, seed_pkc_com_pfs: 30000,
    seed_pkc_com_plunger: 30000, seed_pkc_com_carton: 41000, seed_pkc_com_coldchain: 3100,
    seed_pkc_abr_stopper: 0
  };
  var pcs = packComponents(launchId);
  for (var k = 0; k < pcs.length; k++) {
    var pc = pcs[k];
    var b = PC_BASE[pc.id];
    if (b != null && pc.allocatedUnits !== b) {
      PackComponent.make({ id: pc.id, allocatedUnits: b }).merge();
    }
  }

  /* rebuild the request itself at RAISED, carrying only the pre-assessment facts */
  var snapC = {
    id: c.id, requestNo: c.requestNo, stage: 'RAISED',
    launch: launchId ? { id: launchId } : null,
    market: c.market && c.market.id ? { id: c.market.id } : null,
    marketCommitment: targetId ? { id: targetId } : null,
    requestedBy: c.requestedBy && c.requestedBy.id ? { id: c.requestedBy.id } : null,
    requestedAt: c.requestedAt,
    weeksBeforePackaging: c.weeksBeforePackaging,
    packagingStartDate: c.packagingStartDate,
    baselineDoses: c.baselineDoses, requestedDoses: c.requestedDoses,
    upliftPercent: c.upliftPercent,
    baselinePresentation: c.baselinePresentation, requestedPresentation: c.requestedPresentation,
    baselineSku: c.baselineSku, requestedSku: c.requestedSku,
    rationale: c.rationale, incrementalRevenue: c.incrementalRevenue,
    capacityShortfall: false, componentShortfall: false, logisticsShortfall: false,
    commitmentsUpdated: false
  };
  DemandChange.removeAll({ filter: Filter.eq('id', c.id) }, true);
  DemandChange.make(snapC).create();

  return buildBundle(findChange(c.id));
}
