/*
 * QualityDisruptionService — quality disruption, end to end (SCENARIO 1).
 *
 * plan(eventId)                          read the dashboard at whatever stage the event is at.
 * determineScope(eventId)                step 1 — quantify the hold in doses/batches/markets/revenue.
 * evaluateOptions(eventId)               step 2 — score recovery and supply options; rule out the
 *                                        ones that cannot beat the clock or the dossier.
 * allocation(eventId, optionId, commit)  step 3 — apply priority order; protect priority markets.
 * decide(eventId, optionId, signer, why) step 4 — governed Quality decision + Part 11 e-signature.
 * coordinate(eventId)                    step 5 — issue the response as owned, dated work.
 * reset(eventId)                         restore the pre-hold baseline (repeatable demo).
 *
 * Every figure the view shows is derived from Batch / ComponentLot / PackComponent /
 * CapacitySource / MarketCommitment rows at call time — nothing is asserted in prose.
 * The service touches NO Finding / Activity / Gate record, so the portfolio
 * reconciliation (11 findings / 107 activities) is unaffected.
 */

/* ── shared helpers ─────────────────────────────────────────────── */

var DEFAULT_EVENT = 'seed_qe_berobenatide_t2d_stopper';

/* Visual-inspection action limit (ppm). Batches under it can be recovered by a
 * 100% re-inspection; batches over it cannot be released on any route. */
var ACTION_LIMIT_PPM = 500;

/* Unit economics used to cost the options, in euros. */
var COGS_PER_DOSE = 4.20;      /* write-off value of finished drug product   */
var REINSPECT_PER_DOSE = 0.38; /* 100% manual re-inspection                   */
var EXPEDITE_FREIGHT = 180000; /* air-freight premium to recover lost days    */

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

function findEvent(eventId) {
  var id = eventId || DEFAULT_EVENT;
  var rs = QualityEvent.fetch({
    filter: Filter.eq('id', id),
    include: 'this, launch.id, launch.productName, launch.shortName, site.id, site.name, ' +
             'site.location, componentLot.id, componentLot.lotNo, componentLot.componentName, ' +
             'componentLot.defectRatePpm, componentLot.quantityRemaining, ' +
             'componentLot.acceptanceStatus, componentLot.supplier.id, ' +
             'componentLot.supplier.name, componentLot.supplier.singleSourceFlag, ' +
             'raisedBy.id, raisedBy.name, decidedBy.id, decidedBy.name, ' +
             'approvedOption.id, approvedOption.label',
    limit: 1
  }).objs;
  return rs && rs.length ? rs.get(0) : null;
}

/* every batch of this launch, so the view can show in-scope vs. clean stock. */
function launchBatches(launchId) {
  var out = [];
  var rs = FillBatch.fetch({
    filter: Filter.eq('launch', launchId),
    include: 'this, componentLot.id, componentLot.lotNo, site.id, site.name, ' +
             'dispositionBy.id, dispositionBy.name',
    order: 'ascending(fillDate)', limit: -1
  }).objs;
  if (rs) rs.each(function (b) { out.push(b); });
  return out;
}

/* the launch's market commitments in priority order — the allocation queue. */
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

function eventOptions(eventId) {
  var out = [];
  var rs = ScenarioOption.fetch({
    filter: Filter.eq('qualityEvent', eventId),
    include: 'this, capacitySource.id, capacitySource.name',
    order: 'ascending(sortOrder)', limit: -1
  }).objs;
  if (rs) rs.each(function (o) { out.push(o); });
  return out;
}

/* ── allocation engine ──────────────────────────────────────────────
 * Walk commitments in ascending priorityRank and serve each in full until the
 * available doses run out. This is what "protect priority markets" means
 * operationally: the queue order, not a sentiment.
 */
function allocate(cs, availableDoses, readyDate) {
  var left = availableDoses;
  var rows = [], served = 0, protectedRev = 0, lostRev = 0;
  var nWhole = 0, nConstrained = 0, nDeferred = 0, nMissed = 0;

  for (var i = 0; i < cs.length; i++) {
    var c = cs[i];
    var want = c.committedDoses || 0;

    /* A tender window that closes before the doses are ready cannot be served at
     * all — volume does not help once the window has shut. This is why a "serves
     * every dose" option can still lose a market. */
    var missedWindow = !!(readyDate && c.tenderDeadline && readyDate > c.tenderDeadline);

    var give = missedWindow ? 0 : Math.min(want, Math.max(0, left));
    left -= give;
    served += give;

    var state;
    if (missedWindow) { state = 'MISSED_WINDOW'; nMissed++; }
    else if (give >= want) { state = 'PROTECTED'; nWhole++; }
    else if (give > 0) { state = 'CONSTRAINED'; nConstrained++; }
    else { state = 'DEFERRED'; nDeferred++; }

    var rpd = c.revenuePerDose || 0;
    protectedRev += give * rpd;
    lostRev += (want - give) * rpd;

    rows.push({
      commitmentId: c.id,
      marketCode: c.market && c.market.code,
      marketName: c.market && c.market.name,
      regulatoryBody: c.market && c.market.regulatoryBody,
      priorityRank: c.priorityRank || 0,
      priorityTier: c.priorityTier,
      committedDoses: want,
      allocatedDoses: give,
      shortfallDoses: want - give,
      revenuePerDose: rpd,
      revenueProtected: round2(give * rpd),
      revenueLost: round2((want - give) * rpd),
      firstShipDate: iso(c.firstShipDate),
      tenderDeadline: iso(c.tenderDeadline),
      contractPenalty: !!c.contractPenalty,
      missedWindow: missedWindow,
      state: state
    });
  }

  return {
    rows: rows,
    servedDoses: served,
    marketsMissedWindow: nMissed,
    unservedDoses: Math.max(0, cs.reduce(function (s, c) { return s + (c.committedDoses || 0); }, 0) - served),
    revenueProtected: round2(protectedRev),
    revenueLost: round2(lostRev),
    marketsProtected: nWhole,
    marketsConstrained: nConstrained,
    marketsDeferred: nDeferred
  };
}

/* the date an option's doses are actually available, for tender-window checks. */
function readyDateOf(raisedAt, executionDays) {
  if (!raisedAt) return null;
  return DateTime.fromString('' + raisedAt).plusDays(executionDays || 0);
}

/* market codes in a given allocation state, or in any of several states. */
function namesOf(rows, state) {
  var want = ('' + state).split('|');
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    for (var w = 0; w < want.length; w++) {
      if (rows[i].state === want[w]) { out.push(rows[i].marketCode); break; }
    }
  }
  return out.join(', ');
}

/* ── the dashboard bundle ───────────────────────────────────────── */
function buildBundle(e) {
  if (!e) return null;

  var launchId = e.launch && e.launch.id;
  var lotId = e.componentLot && e.componentLot.id;
  var batches = launchBatches(launchId);
  var cs = commitments(launchId);

  var bRows = [], heldDoses = 0, heldCount = 0, cleanDoses = 0, releasedFromLot = 0;
  for (var i = 0; i < batches.length; i++) {
    var b = batches[i];
    var fromLot = b.componentLot && b.componentLot.id === lotId;
    var row = {
      id: b.id,
      batchNo: b.batchNo,
      siteName: b.site && b.site.name,
      presentation: b.presentation,
      doseCount: b.doseCount || 0,
      fillDate: iso(b.fillDate),
      expiryDate: iso(b.expiryDate),
      state: b.state,
      disposition: b.disposition || null,
      dispositionByName: b.dispositionBy && b.dispositionBy.name,
      holdReason: b.holdReason || null,
      lotNo: b.componentLot && b.componentLot.lotNo,
      fromSuspectLot: !!fromLot,
      inspectionRejectPpm: b.inspectionRejectPpm || 0,
      overActionLimit: (b.inspectionRejectPpm || 0) > ACTION_LIMIT_PPM
    };
    bRows.push(row);
    if (b.state === 'HOLD') { heldDoses += row.doseCount; heldCount++; }
    else if (b.state === 'RELEASED' && !fromLot) cleanDoses += row.doseCount;
    if (b.state === 'RELEASED' && fromLot) releasedFromLot += row.doseCount;
  }

  var committedDoses = 0, committedRev = 0;
  for (var j = 0; j < cs.length; j++) {
    committedDoses += cs[j].committedDoses || 0;
    committedRev += cs[j].committedRevenue || 0;
  }

  /* Baseline exposure: what priority order can and cannot cover from clean stock
   * alone. This is the "so what" of the hold, computed rather than asserted. */
  var baseline = allocate(cs, cleanDoses, null);

  /* Once a decision is signed the interesting table is no longer the hypothetical
   * exposure but the allocation that was actually committed, so switch the rows to
   * the persisted revisedDoses / status and tell the view which basis it is on. */
  var decided = e.stage === 'DECIDED' || e.stage === 'COORDINATED';
  var allocRows = baseline.rows;
  if (decided) {
    allocRows = [];
    for (var m = 0; m < cs.length; m++) {
      var cm = cs[m];
      var want = cm.committedDoses || 0;
      var got = cm.revisedDoses != null ? cm.revisedDoses : want;
      var rpd = cm.revenuePerDose || 0;
      allocRows.push({
        commitmentId: cm.id,
        marketCode: cm.market && cm.market.code,
        marketName: cm.market && cm.market.name,
        regulatoryBody: cm.market && cm.market.regulatoryBody,
        priorityRank: cm.priorityRank || 0,
        priorityTier: cm.priorityTier,
        committedDoses: want,
        allocatedDoses: got,
        shortfallDoses: Math.max(0, want - got),
        revenuePerDose: rpd,
        revenueProtected: round2(got * rpd),
        revenueLost: round2(Math.max(0, want - got) * rpd),
        firstShipDate: iso(cm.firstShipDate),
        tenderDeadline: iso(cm.tenderDeadline),
        contractPenalty: !!cm.contractPenalty,
        missedWindow: false,
        state: cm.status === 'COMMITTED' ? 'PROTECTED' : (cm.status || 'DEFERRED')
      });
    }
  }

  var oRows = [];
  var opts = eventOptions(e.id);
  for (var k = 0; k < opts.length; k++) {
    var o = opts[k];
    oRows.push({
      id: o.id,
      label: o.label,
      optionKind: o.optionKind,
      sortOrder: o.sortOrder || 0,
      description: o.description || null,
      dosesServed: o.dosesServed || 0,
      dosesLost: o.dosesLost || 0,
      dayImpact: o.dayImpact || 0,
      executionDays: o.executionDays || 0,
      incrementalCost: o.incrementalCost || 0,
      revenueProtected: o.revenueProtected || 0,
      revenueLost: o.revenueLost || 0,
      marketsProtected: o.marketsProtected || 0,
      marketsImpacted: o.marketsImpacted || 0,
      protectedMarkets: o.protectedMarkets || null,
      impactedMarkets: o.impactedMarkets || null,
      feasible: o.feasible !== false,
      infeasibleReason: o.infeasibleReason || null,
      regulatoryImpact: !!o.regulatoryImpact,
      regulatoryDetail: o.regulatoryDetail || null,
      residualRisk: o.residualRisk || null,
      score: o.score || 0,
      recommended: !!o.recommended,
      status: o.status || 'PROPOSED',
      capacitySourceName: o.capacitySource && o.capacitySource.name
    });
  }

  var lot = e.componentLot;
  return {
    event: {
      id: e.id,
      eventNo: e.eventNo,
      launchId: launchId,
      launchName: (e.launch && (e.launch.shortName || e.launch.productName)) || null,
      siteName: e.site && e.site.name,
      siteLocation: e.site && e.site.location,
      defectDescription: e.defectDescription,
      defectCategory: e.defectCategory,
      detectionMethod: e.detectionMethod,
      severity: e.severity,
      raisedAt: iso(e.raisedAt),
      raisedByName: e.raisedBy && e.raisedBy.name,
      stage: e.stage || 'RAISED',
      scopeBatchCount: e.scopeBatchCount || 0,
      scopeDoses: e.scopeDoses || 0,
      scopeMarketCount: e.scopeMarketCount || 0,
      scopeRevenueAtRisk: e.scopeRevenueAtRisk || 0,
      recallAssessmentRequired: !!e.recallAssessmentRequired,
      regulatoryNotificationRequired: !!e.regulatoryNotificationRequired,
      approvedOptionId: e.approvedOption && e.approvedOption.id,
      approvedOptionLabel: e.approvedOption && e.approvedOption.label,
      decisionAuthority: e.decisionAuthority || null,
      decidedByName: e.decidedBy && e.decidedBy.name,
      decidedAt: iso(e.decidedAt),
      decisionRationale: e.decisionRationale || null,
      coordinationComplete: !!e.coordinationComplete,
      coordinationActionCount: e.coordinationActionCount || 0,
      capaRef: e.capaRef || null,
      actionLimitPpm: ACTION_LIMIT_PPM
    },
    componentLot: lot ? {
      id: lot.id,
      lotNo: lot.lotNo,
      componentName: lot.componentName,
      supplierName: lot.supplier && lot.supplier.name,
      singleSource: !!(lot.supplier && lot.supplier.singleSourceFlag),
      defectRatePpm: lot.defectRatePpm || 0,
      quantityRemaining: lot.quantityRemaining || 0,
      acceptanceStatus: lot.acceptanceStatus
    } : null,
    batches: bRows,
    options: oRows,
    allocation: allocRows,
    allocationBasis: decided ? 'COMMITTED' : 'CLEAN_STOCK_ONLY',
    summary: {
      batchCount: bRows.length,
      heldBatchCount: heldCount,
      heldDoses: heldDoses,
      cleanDoses: cleanDoses,
      releasedFromSuspectLot: releasedFromLot,
      committedDoses: committedDoses,
      committedRevenue: round2(committedRev),
      marketCount: cs.length,
      uncoveredDoses: Math.max(0, committedDoses - cleanDoses),
      revenueAtRisk: baseline.revenueLost,
      marketsProtectedFromCleanStock: baseline.marketsProtected,
      marketsAtRisk: baseline.marketsConstrained + baseline.marketsDeferred,
      optionCount: oRows.length,
      feasibleOptionCount: oRows.filter(function (o) { return o.feasible; }).length
    }
  };
}

/* ── read: plan(eventId) ────────────────────────────────────────── */
function plan(eventId) {
  return buildBundle(findEvent(eventId));
}

/* ── step 1: determineScope(eventId) ───────────────────────────────
 * Find every batch filled from the suspect lot, hold the unreleased ones, and
 * write the quantified blast radius onto the event.
 */
function determineScope(eventId) {
  var e = findEvent(eventId);
  if (!e) throw new Error('No quality event found for ' + eventId);
  var lotId = e.componentLot && e.componentLot.id;
  if (!lotId) throw new Error('Event ' + e.id + ' has no component lot to trace.');

  var launchId = e.launch && e.launch.id;
  var batches = launchBatches(launchId);

  var heldDoses = 0, heldCount = 0, releasedFromLot = 0, cleanDoses = 0;
  for (var i = 0; i < batches.length; i++) {
    var b = batches[i];
    var fromLot = b.componentLot && b.componentLot.id === lotId;
    if (fromLot && b.state !== 'RELEASED') {
      /* sweep it into the hold and stamp the link back to this event */
      FillBatch.make({
        id: b.id,
        state: 'HOLD',
        disposition: 'PENDING',
        qualityEvent: { id: e.id }
      }).merge();
      heldDoses += b.doseCount || 0;
      heldCount++;
    } else if (fromLot && b.state === 'RELEASED') {
      releasedFromLot += b.doseCount || 0;
    } else if (b.state === 'RELEASED') {
      cleanDoses += b.doseCount || 0;
    }
  }

  /* the suspect lot itself goes on hold so it cannot be drawn again */
  ComponentLot.make({ id: lotId, acceptanceStatus: 'ON_HOLD' }).merge();

  /* Exposure = what priority order cannot cover once only clean stock is available. */
  var cs = commitments(launchId);
  var baseline = allocate(cs, cleanDoses, null);
  var affected = baseline.marketsConstrained + baseline.marketsDeferred;

  QualityEvent.make({
    id: e.id,
    stage: 'SCOPED',
    scopeBatchCount: heldCount,
    scopeDoses: heldDoses,
    scopeMarketCount: affected,
    scopeRevenueAtRisk: baseline.revenueLost,
    /* a batch from the suspect lot already in the market forces a recall assessment */
    recallAssessmentRequired: releasedFromLot > 0,
    regulatoryNotificationRequired: releasedFromLot > 0
  }).merge();

  return buildBundle(findEvent(e.id));
}

/* ── step 2: evaluateOptions(eventId) ──────────────────────────────
 * Score four recovery and supply options against real component, capacity and
 * expiry data. Two are ruled out by hard constraints — that is the point.
 */
function evaluateOptions(eventId) {
  var e = findEvent(eventId);
  if (!e) throw new Error('No quality event found for ' + eventId);
  if (!e.scopeDoses) {
    throw new Error('Scope has not been determined for ' + e.id + ' — run determineScope first.');
  }

  var launchId = e.launch && e.launch.id;
  var lotId = e.componentLot && e.componentLot.id;
  var batches = launchBatches(launchId);
  var cs = commitments(launchId);
  var raised = e.raisedAt;

  /* --- inputs, all read from the data ------------------------------------ */
  var heldDoses = 0, recoverableDoses = 0, unrecoverableDoses = 0, cleanDoses = 0;
  for (var i = 0; i < batches.length; i++) {
    var b = batches[i];
    var fromLot = b.componentLot && b.componentLot.id === lotId;
    var n = b.doseCount || 0;
    if (b.state === 'HOLD') {
      heldDoses += n;
      /* under the action limit a 100% re-inspection can recover the batch */
      if ((b.inspectionRejectPpm || 0) <= ACTION_LIMIT_PPM) recoverableDoses += n;
      else unrecoverableDoses += n;
    } else if (b.state === 'RELEASED' && !fromLot) {
      cleanDoses += n;
    }
  }

  /* replacement stopper supply */
  var stopper = null;
  var pcs = PackComponent.fetch({
    filter: Filter.eq('launch', launchId).and(Filter.eq('componentClass', 'PRIMARY')),
    include: 'this, supplier.name', limit: -1
  }).objs;
  if (pcs) {
    pcs.each(function (pc) {
      if (!stopper && pc.partNo && ('' + pc.partNo).indexOf('STOP') >= 0) stopper = pc;
    });
  }
  var stopperOnHand = stopper ? (stopper.onHandUnits || 0) : 0;
  var stopperLead = stopper ? (stopper.leadTimeDays || 0) : 0;
  var stopperArrival = stopper ? stopper.onOrderArrival : null;
  var stopperDual = stopper ? !!stopper.dualSourced : false;
  var stopperInDossier = stopper ? !!stopper.inRegulatoryDossier : true;
  var stopperCost = stopper ? (stopper.unitCost || 0) : 0;

  /* refill capacity */
  var cap = null;
  var caps = CapacitySource.fetch({
    filter: Filter.eq('launch', launchId).and(Filter.eq('operation', 'FILL_FINISH')),
    include: 'this, site.name', limit: -1
  }).objs;
  if (caps) caps.each(function (c) { if (!cap) cap = c; });
  var weeklyHeadroom = cap ? Math.max(0, (cap.dosesPerWeek || 0) - (cap.committedDosesPerWeek || 0)) : 0;
  var capCostPerK = cap ? (cap.costPerThousandDoses || 0) : 0;

  /* earliest contractual ship date — the clock every option is judged against */
  var earliestShip = null;
  for (var j = 0; j < cs.length; j++) {
    var d = cs[j].firstShipDate;
    if (d && (!earliestShip || d < earliestShip)) earliestShip = d;
  }
  var daysToShip = earliestShip ? dayDiff(raised, earliestShip) : 0;

  var opts = [];

  /* ---- Option A: rework the held batches -------------------------------- *
   * Ruled out by container-closure integrity: a lyophilised product cannot be
   * de-stoppered and re-stoppered without breaching the container closure integrity.      */
  var isLyo = ('' + (e.launch && e.launch.productName || '')).length > 0 &&
              batches.length > 0 &&
              ('' + (batches[0].presentation || '')).toLowerCase().indexOf('lyophilis') >= 0;
  opts.push({
    id: 'seed_sopt_qe_rework', sortOrder: 1,
    label: 'Rework — de-stopper and re-stopper held batches',
    optionKind: 'REWORK',
    description: 'Return the four held batches to the lyophilisation suite, remove the suspect ' +
                 'closures and re-stopper with conforming components.',
    dosesServed: 0, dosesLost: heldDoses, dayImpact: 0, executionDays: 45,
    incrementalCost: 0, revenueProtected: 0, revenueLost: 0,
    marketsProtected: 0, marketsImpacted: cs.length,
    feasible: !isLyo,
    infeasibleReason: isLyo
      ? 'Lyophilised product cannot be de-stoppered and re-stoppered without breaching ' +
        'container-closure integrity. Rework is not an approved route for this presentation.'
      : null,
    regulatoryImpact: true,
    regulatoryDetail: 'Would require a comparability protocol and stability bridging.',
    residualRisk: 'Sterility assurance cannot be re-established post-lyophilisation.',
    score: 0, recommended: false,
    status: isLyo ? 'RULED_OUT' : 'PROPOSED'
  });

  /* ---- Option B: reject and refill -------------------------------------- *
   * Scrap the held doses and re-manufacture. Phased: on-hand stoppers start
   * immediately, the balance waits for the open purchase order.               */
  var phase1Doses = Math.min(heldDoses, stopperOnHand);
  var phase2Doses = Math.max(0, heldDoses - phase1Doses);
  var fillWeeks = weeklyHeadroom > 0 ? Math.ceil(heldDoses / weeklyHeadroom) : 99;
  var arrivalDays = stopperArrival ? Math.max(0, dayDiff(raised, stopperArrival)) : stopperLead;
  var refillDays = phase2Doses > 0
    ? arrivalDays + Math.ceil((phase2Doses / Math.max(1, weeklyHeadroom)) * 7)
    : fillWeeks * 7;
  var refillReady = readyDateOf(raised, refillDays);
  var refillAlloc = allocate(cs, cleanDoses + heldDoses, refillReady);
  var refillCost = heldDoses * COGS_PER_DOSE            /* write off the held product */
                 + heldDoses * stopperCost              /* replacement closures       */
                 + (heldDoses / 1000) * capCostPerK     /* refill conversion          */
                 + EXPEDITE_FREIGHT;
  opts.push({
    id: 'seed_sopt_qe_refill', sortOrder: 2,
    label: 'Reject and refill — phased re-manufacture',
    optionKind: 'REJECT_AND_REFILL',
    description: 'Reject the held batches and re-manufacture. ' + fmt(phase1Doses) +
                 ' doses start immediately against on-hand closures; the remaining ' +
                 fmt(phase2Doses) + ' follow the open ' +
                 (stopper && stopper.supplier ? stopper.supplier.name : 'supplier') +
                 ' order. Every dose is replaced — the exposure is the ' + refillDays +
                 '-day clock, not the volume.',
    dosesServed: refillAlloc.servedDoses, dosesLost: refillAlloc.unservedDoses,
    dayImpact: Math.max(0, refillDays - daysToShip), executionDays: refillDays,
    incrementalCost: round2(refillCost),
    revenueProtected: refillAlloc.revenueProtected, revenueLost: refillAlloc.revenueLost,
    marketsProtected: refillAlloc.marketsProtected,
    marketsImpacted: refillAlloc.marketsConstrained + refillAlloc.marketsDeferred +
                     refillAlloc.marketsMissedWindow,
    protectedMarkets: namesOf(refillAlloc.rows, 'PROTECTED'),
    impactedMarkets: namesOf(refillAlloc.rows, 'MISSED_WINDOW|CONSTRAINED|DEFERRED'),
    feasible: true, infeasibleReason: null,
    regulatoryImpact: false,
    regulatoryDetail: 'No variation required — same site, same approved components.',
    residualRisk: refillAlloc.marketsMissedWindow > 0
      ? 'Re-manufacture completes after the ' + namesOf(refillAlloc.rows, 'MISSED_WINDOW') +
        ' tender window(s) close, so those doses cannot be sold this season despite being made.'
      : 'Later waves ship behind plan; tender windows must be re-confirmed.',
    score: 0, recommended: false, status: 'PROPOSED',
    capacitySource: cap ? { id: cap.id } : null
  });

  /* ---- Option C: alternate approved component --------------------------- *
   * Ruled out when the component is named in the dossier and single-sourced:
   * substitution needs a variation that outruns the ship clock.               */
  var variationDays = 90;
  var altBlocked = stopperInDossier && !stopperDual;
  var altAlloc = allocate(cs, cleanDoses + heldDoses, null);
  opts.push({
    id: 'seed_sopt_qe_altcomp', sortOrder: 3,
    label: 'Alternate approved closure — second-source stopper',
    optionKind: 'ALTERNATE_COMPONENT',
    description: 'Re-stopper the refill against a qualified second-source closure to break the ' +
                 'dependency on the suspect supplier lot.',
    dosesServed: altBlocked ? 0 : altAlloc.servedDoses,
    dosesLost: altBlocked ? heldDoses : 0,
    dayImpact: altBlocked ? 0 : Math.max(0, (variationDays + refillDays) - daysToShip),
    executionDays: variationDays + refillDays,
    incrementalCost: 0,
    revenueProtected: 0, revenueLost: 0,
    marketsProtected: 0, marketsImpacted: cs.length,
    feasible: !altBlocked,
    infeasibleReason: altBlocked
      ? 'The ' + (stopper ? stopper.name : 'closure') + ' is single-sourced and named in the ' +
        'regulatory dossier. Substitution requires a Type II variation (' + variationDays +
        ' days), which lands after the earliest committed ship date.'
      : null,
    regulatoryImpact: true,
    regulatoryDetail: 'Type II variation (EMA) plus a BLA supplement (FDA) for a dossier closure change.',
    residualRisk: 'No qualified alternate exists today; qualification is a programme, not a fix.',
    score: 0, recommended: false,
    status: altBlocked ? 'RULED_OUT' : 'PROPOSED'
  });

  /* ---- Option D: partial release of conforming stock -------------------- *
   * Release the batches under the action limit after a 100% re-inspection;
   * reject the rest. Fastest and cheapest, but forfeits doses.                */
  var partialAvail = cleanDoses + recoverableDoses;
  var partialDays = 12;
  var partialAlloc = allocate(cs, partialAvail, readyDateOf(raised, partialDays));
  var partialCost = recoverableDoses * REINSPECT_PER_DOSE + unrecoverableDoses * COGS_PER_DOSE;
  opts.push({
    id: 'seed_sopt_qe_partial', sortOrder: 4,
    label: 'Partial release — 100% re-inspection, reject the rest',
    optionKind: 'PARTIAL_RELEASE',
    description: 'Subject the batches under the ' + ACTION_LIMIT_PPM + ' ppm action limit to a 100% ' +
                 'manual re-inspection and release the conforming units (' +
                 fmt(recoverableDoses) + ' doses); reject the ' +
                 fmt(unrecoverableDoses) + ' doses above the limit.',
    dosesServed: partialAlloc.servedDoses, dosesLost: unrecoverableDoses,
    dayImpact: Math.max(0, partialDays - daysToShip), executionDays: partialDays,
    incrementalCost: round2(partialCost),
    revenueProtected: partialAlloc.revenueProtected, revenueLost: partialAlloc.revenueLost,
    marketsProtected: partialAlloc.marketsProtected,
    marketsImpacted: partialAlloc.marketsConstrained + partialAlloc.marketsDeferred +
                     partialAlloc.marketsMissedWindow,
    protectedMarkets: namesOf(partialAlloc.rows, 'PROTECTED'),
    impactedMarkets: namesOf(partialAlloc.rows, 'MISSED_WINDOW|CONSTRAINED|DEFERRED'),
    feasible: true, infeasibleReason: null,
    regulatoryImpact: false,
    regulatoryDetail: 'Re-inspection under the approved AQL sampling plan — no variation required.',
    residualRisk: (partialAlloc.marketsConstrained + partialAlloc.marketsDeferred) +
                  ' lower-priority market(s) go short this season: ' +
                  namesOf(partialAlloc.rows, 'CONSTRAINED|DEFERRED') + '. ' +
                  fmt(unrecoverableDoses) + ' doses are written off.',
    score: 0, recommended: false, status: 'PROPOSED'
  });

  /* --- score the feasible options --------------------------------------- *
   * Scored against absolute references rather than against each other, so the
   * numbers mean the same thing however many options survive feasibility:
   *
   *   value  (60%) — net revenue kept, as a share of the whole commitment book.
   *                  Net, because an option's cost is real money: an option that
   *                  protects revenue by spending more than it saves scores badly.
   *   timing (25%) — whether the doses land before the earliest committed ship
   *                  date, measured against that date rather than against the
   *                  slowest rival.
   *   reach  (15%) — share of markets kept whole, so serving eight markets
   *                  partially is not scored the same as serving three fully.
   *
   * Infeasible options score zero and cannot be recommended.                 */
  var totalBook = 0;
  for (var a = 0; a < cs.length; a++) totalBook += cs[a].committedRevenue || 0;
  var best = null;
  for (var c2 = 0; c2 < opts.length; c2++) {
    var o = opts[c2];
    if (!o.feasible) { o.score = 0; continue; }

    var net = o.revenueProtected - o.incrementalCost;
    var valScore = totalBook > 0 ? Math.max(0, net / totalBook) : 0;
    /* on time = full marks; every week late costs 10% of the timing component */
    var lateWeeks = Math.max(0, o.executionDays - daysToShip) / 7;
    var timScore = Math.max(0, 1 - 0.10 * lateWeeks);
    var reachScore = cs.length > 0 ? (o.marketsProtected / cs.length) : 0;

    o.score = round2(100 * (0.60 * valScore + 0.25 * timScore + 0.15 * reachScore));
    if (!best || o.score > best.score) best = o;
  }
  if (best) best.recommended = true;

  /* --- persist ---------------------------------------------------------- */
  for (var p = 0; p < opts.length; p++) {
    var s = opts[p];
    ScenarioOption.make({
      id: s.id, qualityEvent: { id: e.id }, label: s.label, optionKind: s.optionKind,
      sortOrder: s.sortOrder, description: s.description,
      dosesServed: s.dosesServed, dosesLost: s.dosesLost, dayImpact: s.dayImpact,
      executionDays: s.executionDays, incrementalCost: s.incrementalCost,
      revenueProtected: s.revenueProtected, revenueLost: s.revenueLost,
      marketsProtected: s.marketsProtected, marketsImpacted: s.marketsImpacted,
      protectedMarkets: s.protectedMarkets || null, impactedMarkets: s.impactedMarkets || null,
      feasible: s.feasible, infeasibleReason: s.infeasibleReason,
      regulatoryImpact: s.regulatoryImpact, regulatoryDetail: s.regulatoryDetail,
      residualRisk: s.residualRisk, score: s.score, recommended: s.recommended,
      status: s.status, capacitySource: s.capacitySource || null
    }).merge();
  }

  QualityEvent.make({ id: e.id, stage: 'OPTIONS_EVALUATED' }).merge();
  return buildBundle(findEvent(e.id));
}

/* ── step 3: allocation(eventId, optionId, commit) ─────────────────
 * Apply priority order to the doses an option makes available. Preview by
 * default; write market commitment status when commit is true.
 */
function allocation(eventId, optionId, commit) {
  var e = findEvent(eventId);
  if (!e) throw new Error('No quality event found for ' + eventId);

  var opts = eventOptions(e.id);
  var chosen = null;
  for (var i = 0; i < opts.length; i++) if (opts[i].id === optionId) chosen = opts[i];
  if (!chosen) throw new Error('No option ' + optionId + ' on event ' + e.id);

  var cs = commitments(e.launch && e.launch.id);
  /* Re-run the same engine the option was scored with — same doses, same ready
   * date — so what the view previews is exactly what a decision would commit. */
  var ready = readyDateOf(e.raisedAt, chosen.executionDays || 0);
  var result = allocate(cs, chosen.dosesServed || 0, ready);

  if (commit === true) {
    for (var j = 0; j < result.rows.length; j++) {
      var r = result.rows[j];
      MarketCommitment.make({
        id: r.commitmentId,
        revisedDoses: r.allocatedDoses,
        status: r.state === 'PROTECTED' ? 'COMMITTED'
              : (r.state === 'CONSTRAINED' ? 'CONSTRAINED' : 'DEFERRED')
      }).merge();
    }
  }

  return {
    eventId: e.id,
    optionId: chosen.id,
    optionLabel: chosen.label,
    availableDoses: chosen.dosesServed || 0,
    readyDate: iso(ready),
    committed: commit === true,
    rows: result.rows,
    summary: {
      servedDoses: result.servedDoses,
      unservedDoses: result.unservedDoses,
      revenueProtected: result.revenueProtected,
      revenueLost: result.revenueLost,
      marketsProtected: result.marketsProtected,
      marketsConstrained: result.marketsConstrained,
      marketsDeferred: result.marketsDeferred,
      marketsMissedWindow: result.marketsMissedWindow
    }
  };
}

/* ── step 4: decide(eventId, optionId, signerId, rationale) ────────
 * The governed Quality decision. Two guardrails make it real: an infeasible
 * option cannot be approved, and the signer must hold a Quality role.
 */
function decide(eventId, optionId, signerId, rationale) {
  var e = findEvent(eventId);
  if (!e) throw new Error('No quality event found for ' + eventId);
  if (e.stage !== 'OPTIONS_EVALUATED' && e.stage !== 'DECIDED') {
    throw new Error('Options have not been evaluated for ' + e.id + ' — run evaluateOptions first.');
  }

  var opts = eventOptions(e.id);
  var chosen = null;
  for (var i = 0; i < opts.length; i++) if (opts[i].id === optionId) chosen = opts[i];
  if (!chosen) throw new Error('No option ' + optionId + ' on event ' + e.id);
  if (chosen.feasible === false) {
    throw new Error('Option "' + chosen.label + '" was ruled out and cannot be approved: ' +
                    chosen.infeasibleReason);
  }

  var sid = signerId || 'seed_person_ak';
  var ps = Person.fetch({ filter: Filter.eq('id', sid), include: 'this', limit: 1 }).objs;
  if (!ps || !ps.length) throw new Error('No person ' + sid + ' to sign the decision.');
  var signer = ps.get(0);
  if (('' + (signer.functionName || '')).toLowerCase().indexOf('quality') < 0) {
    throw new Error('A batch-disposition decision must be signed by Quality. ' +
                    signer.name + ' holds the ' + signer.functionName + ' function.');
  }

  var now = DateTime.now();
  var why = rationale ||
    'Approved on the basis of the computed scope of ' + fmt(e.scopeDoses || 0) +
    ' doses and the market allocation this option supports.';

  /* mark the approved option and rule out the rest */
  for (var j = 0; j < opts.length; j++) {
    var o = opts[j];
    if (o.id === chosen.id) {
      ScenarioOption.make({ id: o.id, status: 'APPROVED' }).merge();
    } else if (o.feasible !== false) {
      ScenarioOption.make({ id: o.id, status: 'REJECTED' }).merge();
    }
  }

  /* 21 CFR Part 11 electronic signature over the decision */
  ESignature.make({
    id: 'sig_' + e.id + '_decision',
    signedAt: now,
    signer: { id: signer.id },
    printedName: signer.name,
    signerRoleAtTime: signer.role || 'Quality Lead',
    meaning: 'approved',
    entityTypeName: 'QualityEvent',
    entityId: e.id,
    signedPayloadHash: 'sha256:' + e.id + ':' + chosen.id + ':' + (e.scopeDoses || 0),
    reauthenticatedAt: now,
    reasonCode: 'QUALITY_DISPOSITION',
    justification: why,
    correlationId: e.eventNo
  }).merge();

  /* batch disposition follows the approved option */
  var batches = launchBatches(e.launch && e.launch.id);
  for (var k = 0; k < batches.length; k++) {
    var b = batches[k];
    if (b.state !== 'HOLD') continue;
    var under = (b.inspectionRejectPpm || 0) <= ACTION_LIMIT_PPM;
    var disp, state;
    if (chosen.optionKind === 'PARTIAL_RELEASE') {
      disp = under ? 'RELEASE' : 'REJECT';
      state = under ? 'RELEASED' : 'REJECTED';
    } else if (chosen.optionKind === 'REJECT_AND_REFILL') {
      disp = 'REJECT'; state = 'REJECTED';
    } else {
      disp = 'REWORK'; state = 'REWORKED';
    }
    FillBatch.make({
      id: b.id, disposition: disp, state: state,
      dispositionBy: { id: signer.id }, dispositionAt: now
    }).merge();
  }

  QualityEvent.make({
    id: e.id,
    stage: 'DECIDED',
    approvedOption: { id: chosen.id },
    decisionAuthority: 'Quality Council',
    decidedBy: { id: signer.id },
    decidedAt: now,
    decisionRationale: why
  }).merge();

  /* commit the market allocation the decision implies */
  allocation(e.id, chosen.id, true);

  return buildBundle(findEvent(e.id));
}

/* ── step 5: coordinate(eventId) ───────────────────────────────────
 * Turn the approved decision into owned, dated work plus the supplier CAPA.
 */
function coordinate(eventId) {
  var e = findEvent(eventId);
  if (!e) throw new Error('No quality event found for ' + eventId);
  if (e.stage !== 'DECIDED' && e.stage !== 'COORDINATED') {
    throw new Error('No approved decision on ' + e.id + ' — run decide first.');
  }
  var approvedId = e.approvedOption && e.approvedOption.id;
  var opts = eventOptions(e.id);
  var chosen = null;
  for (var i = 0; i < opts.length; i++) if (opts[i].id === approvedId) chosen = opts[i];

  var raised = e.raisedAt ? DateTime.fromString('' + e.raisedAt) : DateTime.now();
  var lot = e.componentLot;
  var supplierName = (lot && lot.supplier && lot.supplier.name) || 'the closure supplier';
  var kind = chosen ? chosen.optionKind : 'PARTIAL_RELEASE';

  /* the coordination set the approved response implies, across every function */
  var tasks = [
    { key: 'qa1', owner: 'A. Kowalski · Quality', due: 3,
      name: 'Sign the batch disposition record for all ' + (e.scopeBatchCount || 0) +
            ' held batches under ' + (e.eventNo || 'the deviation'),
      detail: 'Quality · disposition of record · Part 11 signature captured' },
    { key: 'qa2', owner: 'A. Kowalski · Quality', due: 10,
      name: 'Raise ' + (e.capaRef || 'the CAPA') + ' against ' + supplierName +
            ' for lot ' + (lot ? lot.lotNo : '') + ' closure non-conformance',
      detail: 'Quality · supplier CAPA · effectiveness check at 60 days' },
    { key: 'sc1', owner: 'M. Okafor · Sourcing', due: 5,
      name: 'Block the remaining ' + (lot ? fmt(lot.quantityRemaining || 0) : '0') +
            ' units of lot ' + (lot ? lot.lotNo : '') + ' and quarantine at goods-in',
      detail: 'Sourcing · containment · within guardrails' },
    { key: 'sc2', owner: 'A. Patel · Supply Chain', due: 7,
      name: kind === 'REJECT_AND_REFILL'
        ? 'Release the re-manufacture work order and confirm the phased fill plan'
        : 'Schedule the 100% re-inspection lane and confirm released quantities',
      detail: 'Supply Chain · execution of the approved option' },
    { key: 'ra1', owner: 'S. Lindqvist · Regulatory', due: 5,
      name: e.recallAssessmentRequired
        ? 'File the health-authority notification for released lot material and open the recall assessment'
        : 'Log the deviation in the site quality file; no notification triggered',
      detail: 'Regulatory · ' + (e.recallAssessmentRequired ? 'notification required' : 'no filing required') },
    { key: 'cm1', owner: 'T. Bergmann · Commercial', due: 4,
      name: 'Brief the affected markets (' +
            (chosen && chosen.impactedMarkets ? chosen.impactedMarkets : 'lower-priority waves') +
            ') on revised quantities and dates',
      detail: 'Commercial · market communication · tender windows re-confirmed' },
    { key: 'ma1', owner: 'D. Moreau · Market Access', due: 6,
      name: 'Re-confirm tender commitments where a deadline falls inside the recovery window',
      detail: 'Market Access · contractual exposure' },
    { key: 'lg1', owner: 'R. Devi · Logistics', due: 8,
      name: 'Re-plan cold-chain bookings against the revised release schedule',
      detail: 'Logistics · shipper allocation' }
  ];

  var n = 0;
  for (var t = 0; t < tasks.length; t++) {
    var tk = tasks[t];
    ActionPlanTask.make({
      id: 'task_' + e.id + '_' + tk.key,
      name: tk.name,
      owner: tk.owner,
      detail: tk.detail,
      agentRunnable: false,
      optionKey: chosen ? chosen.optionKind : null,
      status: 'Assigned',
      dueDate: raised.plusDays(tk.due)
    }).merge();
    n++;
  }

  /* the supplier CAPA that closes the loop on the defect itself */
  CAPA.make({
    id: 'capa_' + e.id,
    capaId: e.capaRef || ('CAPA-' + e.eventNo),
    openedAgainstProcess: (lot ? lot.componentName : 'primary closure') + ' — incoming inspection and ' +
                          supplierName + ' lot release',
    openedBy: 'Quality Council',
    openedAt: DateTime.now(),
    containmentAction: 'Lot ' + (lot ? lot.lotNo : '') + ' placed on hold and remaining units ' +
                       'quarantined; ' + (e.scopeBatchCount || 0) + ' batches (' +
                       fmt(e.scopeDoses || 0) + ' doses) dispositioned under ' +
                       (chosen ? chosen.label : 'the approved option') + '.',
    correctiveAction: 'Supplier audit of the moulding and washing process at ' + supplierName +
                      '; tighten the incoming AQL for flange geometry; qualify a second source to ' +
                      'remove the single-source dependency.',
    effectivenessCheck: 'Three consecutive receipts below ' + ACTION_LIMIT_PPM +
                        ' ppm on the incoming visual attribute before the tightened plan is relaxed.',
    effectivenessDueDate: raised.plusDays(60),
    status: 'CONTAINED',
    launch: { id: e.launch && e.launch.id }
  }).merge();

  QualityEvent.make({
    id: e.id, stage: 'COORDINATED', coordinationComplete: true, coordinationActionCount: n
  }).merge();

  return buildBundle(findEvent(e.id));
}

/* ── reset(eventId) — restore the pre-hold baseline ─────────────────
 *
 * A sparse merge cannot un-set a field: the platform drops nulls rather than
 * writing them, so `make({id, scopeDoses: null}).merge()` leaves the old value in
 * place. Anything that must go back to *empty* is therefore rebuilt — the row is
 * removed and re-created from the fields that belong to the pre-hold baseline.
 * Fields that merely change value (state, status) still merge normally.
 */
function reset(eventId) {
  var e = findEvent(eventId);
  if (!e) throw new Error('No quality event found for ' + eventId);
  var launchId = e.launch && e.launch.id;
  var lotId = e.componentLot && e.componentLot.id;

  /* Batches whose seeded state is RELEASED — the two from the clean lot plus the
   * one from the suspect lot that had already shipped, which is what makes the
   * recall assessment fire. Everything else on this launch starts on HOLD. */
  var SEEDED_RELEASED = {
    seed_batch_abr_0396: '2026-07-29',
    seed_batch_abr_0405: '2026-08-05',
    seed_batch_abr_0407: '2026-08-14'
  };

  /* Rebuild each batch so disposition fields genuinely clear. */
  var batches = launchBatches(launchId);
  for (var i = 0; i < batches.length; i++) {
    var b = batches[i];
    var fromLot = b.componentLot && b.componentLot.id === lotId;
    var releasedAt = SEEDED_RELEASED[b.id];
    var snap = {
      id: b.id, batchNo: b.batchNo, doseCount: b.doseCount,
      launch: launchId ? { id: launchId } : null,
      site: b.site && b.site.id ? { id: b.site.id } : null,
      presentation: b.presentation, fillDate: b.fillDate, expiryDate: b.expiryDate,
      componentLot: b.componentLot ? { id: b.componentLot.id } : null,
      inspectionRejectPpm: b.inspectionRejectPpm,
      state: releasedAt ? 'RELEASED' : 'HOLD',
      disposition: releasedAt ? 'RELEASE' : 'PENDING'
    };
    if (releasedAt) {
      snap.dispositionBy = { id: 'seed_person_ak' };
      snap.dispositionAt = DateTime.fromString(releasedAt);
    } else {
      snap.holdReason = b.holdReason;
      /* the hold link is re-established by determineScope, not by the baseline */
      if (fromLot) snap.qualityEvent = null;
    }
    FillBatch.removeAll({ filter: Filter.eq('id', b.id) }, true);
    FillBatch.make(snap).create();
  }

  if (lotId) ComponentLot.make({ id: lotId, acceptanceStatus: 'ACCEPTED' }).merge();

  /* Drop the computed options and the artefacts the decision produced. */
  ScenarioOption.removeAll({ filter: Filter.eq('qualityEvent', e.id) }, true);
  ESignature.removeAll({ filter: Filter.eq('entityId', e.id) }, true);
  ActionPlanTask.removeAll({ filter: Filter.eq('id', 'task_' + e.id + '_qa1')
    .or(Filter.eq('id', 'task_' + e.id + '_qa2'))
    .or(Filter.eq('id', 'task_' + e.id + '_sc1'))
    .or(Filter.eq('id', 'task_' + e.id + '_sc2'))
    .or(Filter.eq('id', 'task_' + e.id + '_ra1'))
    .or(Filter.eq('id', 'task_' + e.id + '_cm1'))
    .or(Filter.eq('id', 'task_' + e.id + '_ma1'))
    .or(Filter.eq('id', 'task_' + e.id + '_lg1')) }, true);
  CAPA.removeAll({ filter: Filter.eq('id', 'capa_' + e.id) }, true);

  /* Rebuild the market commitments so the revised-* fields genuinely clear. */
  var cs = commitments(launchId);
  for (var k = 0; k < cs.length; k++) {
    var c = cs[k];
    var cSnap = {
      id: c.id,
      launch: launchId ? { id: launchId } : null,
      market: c.market && c.market.id ? { id: c.market.id } : null,
      marketLaunch: c.marketLaunch && c.marketLaunch.id ? { id: c.marketLaunch.id } : null,
      priorityRank: c.priorityRank, priorityTier: c.priorityTier,
      committedDoses: c.committedDoses, skuCode: c.skuCode, presentation: c.presentation,
      firstShipDate: c.firstShipDate, wave: c.wave,
      revenuePerDose: c.revenuePerDose, committedRevenue: c.committedRevenue,
      tenderDeadline: c.tenderDeadline, contractPenalty: c.contractPenalty,
      status: 'COMMITTED'
    };
    MarketCommitment.removeAll({ filter: Filter.eq('id', c.id) }, true);
    MarketCommitment.make(cSnap).create();
  }

  /* Rebuild the event itself at RAISED, carrying only the pre-hold facts. */
  var eSnap = {
    id: e.id, eventNo: e.eventNo, stage: 'RAISED',
    defectDescription: e.defectDescription, defectCategory: e.defectCategory,
    detectionMethod: e.detectionMethod, severity: e.severity,
    raisedAt: e.raisedAt, capaRef: e.capaRef,
    launch: launchId ? { id: launchId } : null,
    site: e.site && e.site.id ? { id: e.site.id } : null,
    componentLot: lotId ? { id: lotId } : null,
    raisedBy: e.raisedBy && e.raisedBy.id ? { id: e.raisedBy.id } : null,
    recallAssessmentRequired: false, regulatoryNotificationRequired: false,
    coordinationComplete: false
  };
  QualityEvent.removeAll({ filter: Filter.eq('id', e.id) }, true);
  QualityEvent.make(eSnap).create();

  return buildBundle(findEvent(e.id));
}
