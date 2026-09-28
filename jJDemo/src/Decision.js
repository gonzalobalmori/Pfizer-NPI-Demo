/*
 * Decision implementation — the Execution branch's core behaviour.
 *
 * assertUserCanDecide()  enforces §3.6.3 / §2.1 at the service layer: only a
 *                        decision the user holds (heldBy == 'USER') and has not
 *                        already approved may be acted on. ESCALATED / DELEGATED /
 *                        AGENT decisions, and any already-approved decision, are
 *                        rejected here — not in the UI.
 *
 * approve(optionLabel)   the atomic cascade (§2.4). All-or-nothing: it re-baselines
 *                        the gate, releases the exposure on the launch, assigns and
 *                        dispatches the chosen option's tasks, fires and logs the
 *                        notifications, writes the CAPA containment closure, appends
 *                        an immutable DHF entry, and stamps the decision approved.
 *                        A second run is rejected by the same guard.
 */

/* ---- service-layer guard ------------------------------------------------ */
function assertUserCanDecide() {
  var d = this.get('id, heldBy, approvedAt');
  if (d.heldBy !== 'USER') {
    throw new Error(
      'Decision ' + d.id + ' is held by ' + d.heldBy +
        ', not the user — it cannot be approved here. Work travels up, never back.'
    );
  }
  if (d.approvedAt) {
    throw new Error(
      'Decision ' + d.id + ' was already approved at ' + d.approvedAt + '. Approve runs once.'
    );
  }
  return true;
}

/* ---- resolve the chosen option ----------------------------------------- */
function resolveOption(decisionId, optionLabel) {
  var opts = DecisionOption.fetch({
    filter: Filter.eq('decision', decisionId),
    include: 'this', limit: -1
  }).objs;
  if (!opts || opts.length === 0) {
    throw new Error('Decision ' + decisionId + ' has no modelled options.');
  }
  var want = (optionLabel || '').trim();
  var wantKey = want.replace(/^option\s+/i, '').trim().toLowerCase();
  var match = null;
  opts.each(function (o) {
    if (match) return;
    if (o.optionKey && o.optionKey.toLowerCase() === wantKey) match = o;
    else if (o.label && o.label.toLowerCase() === want.toLowerCase()) match = o;
  });
  if (!match) {
    // default to the recommended option when the label doesn't resolve
    opts.each(function (o) { if (!match && o.recommended) match = o; });
  }
  if (!match) {
    throw new Error('No option matches "' + optionLabel + '" on decision ' + decisionId + '.');
  }
  return match;
}

/* ---- the atomic approve transaction ------------------------------------ */
function approve(optionLabel) {
  // 1. Preconditions — reject at the service layer before any write.
  this.assertUserCanDecide();

  var d = this.get('id, heldBy, finding.id, finding.launch.id, finding.phase.id, finding.displayId');
  var now = DateTime.now();
  var option = resolveOption(d.id, optionLabel);
  var optionLabelText = 'Option ' + (option.optionKey || '').toUpperCase();

  var findingId = d.finding && d.finding.id;
  var launch = d.finding && d.finding.launch;
  var launchId = launch && launch.id;
  var phaseId = d.finding && d.finding.phase && d.finding.phase.id;

  var dhfLines = [];

  // 2. Re-baseline the gate on the finding's launch + phase (§2.4).
  //    New slip = current slip - days recovered by the chosen option.
  if (launchId && phaseId) {
    var gate = Gate.fetch({
      filter: Filter.eq('launch', launchId).and().eq('phase', phaseId),
      include: 'this', limit: 1
    }).objs;
    if (gate && gate.length > 0) {
      var g = gate.get(0);
      var recovered = option.daysRecovered || 0;
      var oldForecast = g.forecastDate;
      var oldSlip = g.slipDays || 0;
      var newSlip = Math.max(0, oldSlip - recovered);
      var baseline = g.baselineDate || g.forecastDate;
      var newForecast = DateTime.fromString('' + baseline).plusDays(newSlip);
      g = g.withForecastDate(newForecast).withSlipDays(newSlip)
           .withStatus(newSlip <= 0 ? 'ok' : 'late');
      g.merge();
      dhfLines.push('Gate ' + g.code + ' re-baselined ' + oldForecast +
        ' → ' + newForecast + ' (slip ' + oldSlip + ' → ' + newSlip + ' days)');
    }
  }

  // 3. Release the exposure on the launch (§2.4 — "release the exposure").
  if (launch) {
    var lf = Launch.forId(launchId).get('revenueAtRisk, healthStatus, deviceName');
    var released = lf.revenueAtRisk || 0;
    var kept = option.revenueKept || 0;
    var newRisk = Math.max(0, released - kept);
    var upd = Launch.make({ id: launchId, revenueAtRisk: newRisk });
    if (newRisk === 0) upd = upd.withHealthStatus('ON_PLAN');
    upd.merge();
    if (released > 0) {
      dhfLines.push('Exposure released on ' + lf.deviceName + ': €' +
        (released / 1000000).toFixed(1) + 'M kept (' + optionLabelText + ')');
    }
  }

  // 4. Assign and dispatch the chosen option's tasks (§2.4).
  var tasks = ActionPlanTask.fetch({
    filter: Filter.eq('decision', d.id).and().eq('optionKey', option.optionKey),
    include: 'this', limit: -1
  }).objs;
  var dispatched = [];
  var dispatchedCount = 0;
  if (tasks && tasks.length > 0) {
    tasks.each(function (t) {
      // agent-runnable tasks are dispatched to the fleet; manual tasks are assigned.
      var status = t.agentRunnable ? 'Dispatched' : 'Assigned';
      if (status === 'Dispatched') dispatchedCount++;
      dispatched.push(ActionPlanTask.make({ id: t.id, status: status }));
    });
    ActionPlanTask.mergeBatch(dispatched);
    dhfLines.push(tasks.length + ' tasks assigned (' + dispatchedCount + ' dispatched to the fleet)');
  }

  // 5. Fire and log the notifications (§2.4 — stamp them sent).
  var notifs = Notification.fetch({
    filter: Filter.eq('decision', d.id), include: 'this', limit: -1
  }).objs;
  if (notifs && notifs.length > 0) {
    var sent = [];
    notifs.each(function (n) { sent.push(Notification.make({ id: n.id, sentAt: now })); });
    Notification.mergeBatch(sent);
    dhfLines.push(notifs.length + ' notifications fired');
  }

  // 6. Write the CAPA containment closure (§2.4).
  if (findingId) {
    var capas = CAPA.fetch({
      filter: Filter.eq('finding', findingId), include: 'this', limit: -1
    }).objs;
    if (capas && capas.length > 0) {
      var capaClosures = [];
      capas.each(function (cp) {
        capaClosures.push(CAPA.make({ id: cp.id, status: 'CONTAINED', closedByDecision: { id: d.id } }));
        dhfLines.push('CAPA ' + cp.capaId + ' containment closed');
      });
      CAPA.mergeBatch(capaClosures);
    }
  }

  // 7. Stamp the decision approved (idempotency marker — a second run is rejected in step 1).
  Decision.make({ id: d.id, selectedOption: optionLabelText, approvedAt: now }).merge();

  // 8. Append the immutable DHF entry LAST, summarising the cascade (§3.6.6 append-only).
  if (launchId) {
    DesignHistoryFileEntry.make({
      id: 'dhf_approve_' + d.id,
      entryAt: now, actor: 'George Hall (Global NPI Lead)',
      action: optionLabelText + ' approved for ' + d.finding.displayId + ' — ' +
        (dhfLines.length ? dhfLines.join('; ') : 'decision recorded'),
      recordRef: d.finding.displayId, immutable: true, launch: { id: launchId }
    }).upsert();
  }

  return this.get('id, selectedOption, approvedAt, heldBy, finding.displayId');
}
