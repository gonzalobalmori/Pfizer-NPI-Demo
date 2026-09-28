/*
 * CascadeReplanService — connected-milestone dynamic cascade replan (SCENARIO 1).
 *
 * plan(launchId)                     read the milestone + downstream impact
 *                                    dashboard (auto vs. human split + cost roll-up).
 * cascadeReplan(milestoneId, iso)    move the authority's date, recompute the slip,
 *                                    auto-adjust what is safe, surface what needs a
 *                                    human. The scenario's core action.
 * resolveImpact(itemId, optionLabel) record a human decision on one item.
 * reset(milestoneId)                 restore the pre-slip baseline (repeatable demo).
 *
 * The service holds no data — it derives every bundle from RegulatoryMilestone /
 * CascadeImpactItem at call time. It touches NO Finding / Activity / Gate record,
 * so the portfolio reconciliation (13 findings / 107 activities) is unaffected.
 */

/* ── shared helpers ─────────────────────────────────────────────── */

var DEFAULT_LAUNCH = 'seed_launch_pf3945_obesity';

function iso(dt) {
  return dt ? dt.toString() : null;
}

/* whole-day difference between two C3 datetimes (b - a), rounded. */
function dayDiff(a, b) {
  if (!a || !b) return 0;
  var da = DateTime.fromString('' + a);
  var db = DateTime.fromString('' + b);
  // `millis` is a property on the C3 DateTime; prefer it, fall back to a bounded day-step loop.
  if (da.millis != null && db.millis != null) {
    return Math.round((db.millis - da.millis) / 86400000);
  }
  var n = 0, dir = 1, cur = da;
  if (db < da) { dir = -1; cur = db; }
  var end = dir === 1 ? db : da;
  while (cur < end && n < 3650) { cur = cur.plusDays(1); n++; }
  return dir * n;
}

/* the milestone for a launch, or the anchor Berobenatide OA milestone by default. */
function findMilestone(launchId, milestoneId) {
  if (milestoneId) {
    var byId = RegulatoryMilestone.fetch({
      filter: Filter.eq('id', milestoneId), include: 'this, launch.id, launch.productName', limit: 1
    }).objs;
    if (byId && byId.length) return byId.get(0);
  }
  var lid = launchId || DEFAULT_LAUNCH;
  var byLaunch = RegulatoryMilestone.fetch({
    filter: Filter.eq('launch', lid), include: 'this, launch.id, launch.productName', limit: 1
  }).objs;
  return byLaunch && byLaunch.length ? byLaunch.get(0) : null;
}

/* project one impact item into the view-model row. */
function projectItem(it) {
  var opts = [];
  if (it.decisionOptions) {
    // decisionOptions is a C3 array (has .each); guard for native too
    if (typeof it.decisionOptions.each === 'function') {
      it.decisionOptions.each(function (o) { opts.push(o); });
    } else {
      for (var i = 0; i < it.decisionOptions.length; i++) opts.push(it.decisionOptions[i]);
    }
  }
  return {
    id: it.id,
    sortOrder: it.sortOrder || 0,
    domain: it.domain,
    domainLabel: it.domainLabel || it.domain,
    targetLabel: it.targetLabel,
    detail: it.detail || null,
    resolution: it.resolution,
    autoAction: it.autoAction || null,
    decisionPrompt: it.decisionPrompt || null,
    decisionOptions: opts,
    ownerName: it.owner && it.owner.name ? it.owner.name : null,
    costImpact: it.costImpact || 0,
    dayShift: it.dayShift || 0,
    status: it.status || 'PENDING',
    resolvedOption: it.resolvedOption || null,
    resolvedAt: iso(it.resolvedAt)
  };
}

/* the full dashboard bundle for a milestone. */
function buildBundle(m) {
  if (!m) return null;
  var items = CascadeImpactItem.fetch({
    filter: Filter.eq('milestone', m.id),
    include: 'this, owner.id, owner.name, milestone.id',
    order: 'ascending(sortOrder)', limit: -1
  }).objs;

  var rows = [];
  var autoAdjusted = 0, needDecision = 0, resolved = 0;
  var costBooked = 0, costPending = 0;

  if (items) {
    items.each(function (it) {
      var r = projectItem(it);
      rows.push(r);
      if (r.status === 'AUTO_ADJUSTED') { autoAdjusted++; costBooked += r.costImpact; }
      else if (r.status === 'AWAITING_DECISION') { needDecision++; costPending += r.costImpact; }
      else if (r.status === 'RESOLVED') { resolved++; costBooked += r.costImpact; }
    });
  }

  var slip = m.slipDays || 0;
  return {
    milestone: {
      id: m.id,
      displayId: m.displayId || m.id,
      launchId: m.launch && m.launch.id,
      launchName: m.launch && m.launch.productName,
      authority: m.authority,
      milestoneName: m.milestoneName,
      baselineDate: iso(m.baselineDate),
      currentDate: iso(m.currentDate),
      slipDays: slip,
      slipWeeks: Math.round((slip / 7) * 10) / 10,
      status: m.status || 'ON_TRACK'
    },
    items: rows,
    summary: {
      total: rows.length,
      autoAdjusted: autoAdjusted,
      needDecision: needDecision,
      resolved: resolved,
      pending: rows.length - autoAdjusted - needDecision - resolved,
      costBooked: costBooked,
      costPending: costPending,
      costTotal: costBooked + costPending
    }
  };
}

/* ── read: plan(launchId) ───────────────────────────────────────── */
function plan(launchId) {
  var m = findMilestone(launchId, null);
  return buildBundle(m);
}

/* ── the cascade: cascadeReplan(milestoneId, newDateIso) ────────── */
function cascadeReplan(milestoneId, newDateIso) {
  var m = findMilestone(null, milestoneId);
  if (!m) throw new Error('No regulatory milestone found for ' + milestoneId);

  var newDate = DateTime.fromString('' + newDateIso);
  var slip = Math.max(0, dayDiff(m.baselineDate, newDate));

  // 1. Move the authority's date on the milestone and stamp the new slip.
  RegulatoryMilestone.make({
    id: m.id,
    currentDate: newDate,
    slipDays: slip,
    status: slip > 0 ? 'REPLANNED' : 'ON_TRACK'
  }).merge();

  var now = DateTime.now();

  // 2. Walk every downstream item: AUTO re-times/holds itself; HUMAN surfaces.
  var items = CascadeImpactItem.fetch({
    filter: Filter.eq('milestone', m.id), include: 'this', limit: -1
  }).objs;

  if (items) {
    items.each(function (it) {
      // never re-open an already-resolved human decision
      if (it.status === 'RESOLVED') return;
      if (it.resolution === 'AUTO') {
        CascadeImpactItem.make({
          id: it.id, status: 'AUTO_ADJUSTED', dayShift: slip, resolvedAt: now
        }).merge();
      } else {
        CascadeImpactItem.make({
          id: it.id, status: 'AWAITING_DECISION', dayShift: slip
        }).merge();
      }
    });
  }

  return buildBundle(findMilestone(null, m.id));
}

/* ── resolve one human item: resolveImpact(itemId, optionLabel) ── */
function resolveImpact(itemId, optionLabel) {
  var byId = CascadeImpactItem.fetch({
    filter: Filter.eq('id', itemId), include: 'this, milestone.id', limit: 1
  }).objs;
  if (!byId || !byId.length) throw new Error('No cascade impact item ' + itemId);
  var it = byId.get(0);
  if (it.resolution !== 'HUMAN') {
    throw new Error('Item ' + itemId + ' is auto-adjusted — it needs no human decision.');
  }
  CascadeImpactItem.make({
    id: it.id, status: 'RESOLVED', resolvedOption: optionLabel || null, resolvedAt: DateTime.now()
  }).merge();

  return buildBundle(findMilestone(null, it.milestone && it.milestone.id));
}

/* ── reset(milestoneId) — restore the pre-slip baseline ─────────── */
function reset(milestoneId) {
  var m = findMilestone(null, milestoneId);
  if (!m) throw new Error('No regulatory milestone found for ' + milestoneId);

  RegulatoryMilestone.make({
    id: m.id, currentDate: m.baselineDate, slipDays: 0, status: 'ON_TRACK'
  }).merge();

  var items = CascadeImpactItem.fetch({
    filter: Filter.eq('milestone', m.id), include: 'this', limit: -1
  }).objs;
  if (items) {
    items.each(function (it) {
      CascadeImpactItem.make({
        id: it.id, status: 'PENDING', dayShift: 0, resolvedOption: null, resolvedAt: null
      }).merge();
    });
  }
  return buildBundle(findMilestone(null, m.id));
}
