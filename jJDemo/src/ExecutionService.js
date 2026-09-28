/*
 * ExecutionService — read-side projections for the Execution branch UI (§2).
 * Every method derives its bundle from the model at call time and returns plain
 * JSON the React pages render directly. No display strings are persisted beyond
 * the attested Pfizer copy already on the domain types (model invariant §3.6.1).
 */

/* ── shared helpers ─────────────────────────────────────────────── */

function iso(dt) {
  return dt ? dt.toString() : null;
}

/* The board/log share one franchise+market predicate. "Global" and "EU"
 * market codes always match a market selection, exactly as the prototype. */
function marketMatch(codes, market) {
  if (market === 'all' || !market) return true;
  if (!codes) return false;
  var arr = [];
  codes.each(function (c) { arr.push(c); });
  return arr.indexOf(market) >= 0 || arr.indexOf('Global') >= 0 || arr.indexOf('EU') >= 0;
}

/* ── §2.1 My Actions — Pending ──────────────────────────────────── */

function pendingQueue() {
  var decs = Decision.fetch({
    filter: Filter.eq('heldBy', 'USER'),
    include: 'this, finding.id, finding.displayId, finding.description, finding.category, ' +
      'finding.phase.code, finding.launch.productName, finding.launch.shortName',
    limit: -1
  }).objs;

  var cards = [];
  decs.each(function (d) {
    var f = d.finding;
    cards.push({
      decisionId: d.id,
      findingId: f ? f.id : null,
      displayId: f ? f.displayId : null,
      title: f ? f.description : null,
      category: f ? f.category : null,
      meta: d.queueMetaLabel,
      agentRecommendation: d.agentRecommendation,
      dueLabel: d.dueLabel,
      dueTagClass: d.dueTagClass,
      functions: d.functionsLabel,
      ctaEmphasis: d.ctaEmphasis,
      dueAt: iso(d.dueAt)
    });
  });

  /* order by due date, soonest first (the anchor 17:00-today card leads) */
  cards.sort(function (a, b) {
    if (!a.dueAt) return 1;
    if (!b.dueAt) return -1;
    return a.dueAt < b.dueAt ? -1 : a.dueAt > b.dueAt ? 1 : 0;
  });

  return { count: cards.length, cards: cards };
}

/* ── §2.1 My Actions — Escalated ────────────────────────────────── */

function escalatedQueue() {
  var escs = Escalation.fetch({
    include: 'this, decision.id, decision.finding.displayId, ' +
      'decision.finding.launch.productName',
    limit: -1
  }).objs;

  var cards = [];
  escs.each(function (e) {
    var d = e.decision;
    var f = d ? d.finding : null;
    /* ordered events for the progress pips */
    var evs = EscalationEvent.fetch({
      filter: Filter.eq('escalation.id', e.id),
      include: 'this, escalation.id',
      limit: -1
    }).objs;
    var pips = [];
    evs.each(function (ev) {
      pips.push({ sequence: ev.sequence, label: ev.label, state: ev.state });
    });
    pips.sort(function (a, b) { return a.sequence - b.sequence; });

    cards.push({
      escalationId: e.id,
      decisionId: d ? d.id : null,
      findingId: f ? f.id : null,
      displayId: f ? f.displayId : null,
      title: e.cardTitle,
      meta: e.cardMetaLabel,
      progressSummary: e.progressSummary,
      tagLabel: e.tagLabel,
      tagClass: e.tagClass,
      functionLabel: e.functionLabel,
      ctaEmphasis: e.ctaEmphasis,
      raisedAt: iso(e.raisedAt),
      pips: pips
    });
  });

  cards.sort(function (a, b) {
    if (!a.raisedAt) return 1;
    if (!b.raisedAt) return -1;
    return a.raisedAt < b.raisedAt ? -1 : a.raisedAt > b.raisedAt ? 1 : 0;
  });

  return { count: cards.length, cards: cards };
}

/* ── §2.1 My Actions — History ──────────────────────────────────── */

function decisionHistory() {
  var evs = DecisionHistoryEvent.fetch({ limit: -1 }).objs;

  /* Overlay the LIVE decision state onto the seeded history. Each event is
     seeded in its pre-approval state (e.g. NPI-0417 is RUNNING — "still open").
     Because DecisionHistoryEvent is a SeedData type its fields are seed-locked
     and cannot be mutated at runtime, so approve() can't flip it directly.
     Instead we project here: if the finding behind an event now has an APPROVED
     decision, the row reads RESOLVED/"taken" — so once Helena approves in the
     demo, her own History records the decision as taken, reconciling with the
     Execution branch. The Finding outcome is never read or touched. */
  var approvedByNpi = {};
  var apprv = Decision.fetch({
    filter: Filter.exists('approvedAt'),
    include: 'this, finding.displayId', limit: -1
  }).objs;
  if (apprv) {
    apprv.each(function (d) {
      var np = d.finding && d.finding.displayId;
      if (np) approvedByNpi[np] = d.selectedOption || 'the recommended option';
    });
  }

  var rows = [];
  evs.each(function (e) {
    var status = e.status;
    var subLine = e.subLine;
    /* Only advance a still-open decision she took (MY / RUNNING); escalations
       and already-closed rows keep their seeded outcome. */
    if (e.kind === 'MY' && e.status === 'RUNNING' && approvedByNpi[e.npiId]) {
      status = 'RESOLVED';
      subLine = 'Decision taken — ' + approvedByNpi[e.npiId] + ' approved.';
    }
    rows.push({
      id: e.id,
      npiId: e.npiId,
      kind: e.kind,
      status: status,
      label: e.label,
      subLine: subLine,
      occurredAt: iso(e.occurredAt),
      sortOrder: e.sortOrder,
      note: e.noteBody ? {
        author: e.noteAuthor,
        role: e.noteRole,
        at: iso(e.noteAt),
        body: e.noteBody
      } : null
    });
  });

  rows.sort(function (a, b) { return a.sortOrder - b.sortOrder; });

  var taken = 0, esc = 0;
  rows.forEach(function (r) {
    if (r.kind === 'MY') taken++; else if (r.kind === 'ESC') esc++;
  });

  /* KPI band — attested headline values from the prototype (§2.1) */
  return {
    rows: rows,
    counts: { taken: taken, escalations: esc, total: rows.length },
    kpis: {
      decisionsTaken: 23,
      decisionsTakenWindow: 'last 90 days',
      decisionsTakenDelta: '+4 vs prior 90 d',
      closed: 19,
      closedOf: 'of the 23 you took',
      closedNote: '4 still open',
      actionsDelegated: 61,
      actionsDelegatedNote: '54 came back done',
      escalationsOpen: 2,
      escalationsOpenNote: 'oldest raised 6 days ago',
      medianTimeToDecide: '4.2 d'
    }
  };
}

/* ── §2.2 Agent orchestration — Live board ──────────────────────── */

var PHASE_META = {
  seed_phase_p1: ['P1', 'Portfolio & Launch Strategy', 'closed'],
  seed_phase_p2: ['P2', 'NPL Initiation & Planning', 'closed'],
  seed_phase_p3: ['P3', 'Drug Substance (DS) Readiness', 'closed'],
  seed_phase_p4: ['P4', 'Drug Product (DP) Readiness', 'live'],
  seed_phase_p5: ['P5', 'Finished Product Readiness', 'live'],
  seed_phase_p6: ['P6', 'Launch Readiness & Market Enablement', 'live'],
  seed_phase_p7: ['P7', 'Global Launch Execution', 'queued'],
  seed_phase_p8: ['P8', 'Market Launch', 'queued'],
  seed_phase_p9: ['P9', 'Post-Launch Monitoring & Continuous Improvement', 'queued']
};
var PHASE_ORDER = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9'];
/* Ordinal rank so gates compare numerically (a plain string sort puts "BAU"
   before "G5"). Mirrors PortfolioService.GATE_RANK. */
var GATE_RANK = { G1: 1, G2: 2, G3: 3, G4: 4, G5: 5, G6: 6, G7: 7, G8: 8, BAU: 9 };
/* The gate that CLOSES each phase — a finding in P4 puts the P4-closing gate
   (G4) at risk, which is what its card meta states. */
var PHASE_GATE = { P1: 'G1', P2: 'G2', P3: 'G3', P4: 'G4', P5: 'G5', P6: 'G6', P7: 'G7', P8: 'G8', P9: 'BAU' };

/* The Finding<->Chain link is stored on Chain.finding (Finding.chain is a
 * non-inverse ref that does not resolve), so we build a findingId -> chainId
 * map from the Chain side, plus a chainId -> ordered steps map, once. */
function chainStepsByFinding() {
  var byFinding = {};       /* findingId -> chainId */
  var chains = Chain.fetch({ include: 'this, finding.id', limit: -1 }).objs;
  chains.each(function (c) {
    if (c.finding) byFinding[c.finding.id] = c.id;
  });

  var stepsByChain = {};    /* chainId -> [step] */
  var acts = AgentAction.fetch({
    include: 'this, chain.id, agent.name',
    limit: -1
  }).objs;
  acts.each(function (a) {
    var cid = a.chain ? a.chain.id : null;
    if (!cid) return;
    if (!stepsByChain[cid]) stepsByChain[cid] = [];
    stepsByChain[cid].push({
      sequence: a.sequence,
      verb: a.verb,
      detail: a.detail,
      agent: a.agent ? a.agent.name : null,
      occurredAt: iso(a.occurredAt),
      stateLabel: a.stateLabel,
      handoffPrompt: a.handoffPrompt,
      completed: a.completed
    });
  });
  for (var k in stepsByChain) {
    stepsByChain[k].sort(function (x, y) { return x.sequence - y.sequence; });
  }
  return { byFinding: byFinding, stepsByChain: stepsByChain };
}

function boardCards(franchise, market) {
  var findings = Finding.fetch({
    include: 'this, phase.id, phase.code, launch.productName, launch.shortName, ' +
      'launch.franchise.name, otherLaunches.shortName, otherLaunches.productName, ' +
      'detectedBy.name',
    limit: -1
  }).objs;

  var chainMap = chainStepsByFinding();

  var cards = [];
  findings.each(function (f) {
    var fr = f.launch && f.launch.franchise ? f.launch.franchise.name : null;
    if (franchise && franchise !== 'all' && fr !== franchise) return;
    if (!marketMatch(f.marketCodes, market)) return;

    /* the chain's ordered actions — the verb-by-verb work list */
    var chainId = chainMap.byFinding[f.id] || null;
    var steps = chainId && chainMap.stepsByChain[chainId] ? chainMap.stepsByChain[chainId] : [];

    var products = [];
    if (f.launch) products.push(f.launch.shortName || f.launch.productName);
    if (f.otherLaunches) {
      f.otherLaunches.each(function (l) { products.push(l.shortName || l.productName); });
    }
    var codes = [];
    if (f.marketCodes) f.marketCodes.each(function (c) { codes.push(c); });

    cards.push({
      findingId: f.id,
      displayId: f.displayId,
      phaseCode: f.phase ? f.phase.code : null,
      outcome: f.outcome,
      category: f.category,
      found: f.description,
      headline: f.headline,
      franchise: fr,
      products: products,
      marketCodes: codes,
      detectedBy: f.detectedBy ? f.detectedBy.name : null,
      chainId: chainId,
      steps: steps
    });
  });
  return cards;
}

function liveBoard(franchise, market) {
  var cards = boardCards(franchise, market);

  /* KPI row (§2.2): actions on the board = sum of completed steps */
  var actions = 0, run = 0, you = 0, held = 0, auto = 0;
  var products = {};
  cards.forEach(function (c) {
    c.steps.forEach(function (s) { if (s.completed) actions++; });
    if (c.outcome === 'RUNNING') run++;
    else if (c.outcome === 'USER') you++;
    else if (c.outcome === 'HELD') held++;
    else if (c.outcome === 'AUTO') auto++;
    c.products.forEach(function (p) { products[p] = 1; });
  });

  /* one column per NPI phase */
  var columns = PHASE_ORDER.map(function (code) {
    var meta = null;
    for (var key in PHASE_META) { if (PHASE_META[key][0] === code) meta = PHASE_META[key]; }
    var col = cards.filter(function (c) { return c.phaseCode === code; });
    var colRun = col.filter(function (c) { return c.outcome === 'RUNNING'; }).length;
    var colYou = col.filter(function (c) { return c.outcome === 'USER'; }).length;
    /* A phase is only shown as "live" if the current board actually has work
       in it. Otherwise the fixed P3/P4 'live' flag lit up empty columns for a
       filtered franchise (e.g. Rare Disease), reading as "active but empty". */
    var baseState = meta ? meta[2] : '';
    var state = (baseState === 'live' && col.length === 0) ? 'queued' : baseState;
    return {
      code: code,
      name: meta ? meta[1] : code,
      state: state,
      running: colRun,
      onYou: colYou,
      cards: col
    };
  });

  return {
    kpis: {
      actionsOnBoard: actions,
      findingCount: cards.length,
      productCount: Object.keys(products).length,
      workingNow: run,
      yourDecision: you,
      heldByPerson: held,
      closedByFleet: auto
    },
    columns: columns,
    filters: {
      franchises: ['all', 'Vaccines', 'Hospital', 'Oncology Biosimilars', 'Internal Medicine', 'Rare Disease'],
      markets: ['all', 'DE', 'FR', 'ES', 'US', 'IE']
    }
  };
}

/* ── §2.3 Agent orchestration — Activity log ────────────────────── */

function activityLog(franchise, market) {
  var cards = boardCards(franchise, market);

  var rows = [];
  var agents = {};
  cards.forEach(function (c) {
    c.steps.forEach(function (s) {
      if (!s.completed) return;                 /* only executed actions */
      if (s.agent === 'You' || s.verb === null) return;
      /* decision ("handed to you") steps are not fleet actions */
      if (s.verb && (s.verb.indexOf('HANDED TO YOU') >= 0 ||
        s.verb.indexOf('STOPPED ON A HUMAN') >= 0)) return;
      agents[s.agent] = 1;
      rows.push({
        occurredAt: s.occurredAt,
        agent: s.agent,
        verb: s.verb,
        detail: s.detail,
        product: c.products.length ? c.products[0] : null,
        otherProductCount: c.products.length > 1 ? c.products.length - 1 : 0,
        phaseCode: c.phaseCode,
        franchise: c.franchise,
        outcome: c.outcome,
        findingId: c.findingId,
        displayId: c.displayId
      });
    });
  });

  /* reverse-chronological (newest first) */
  rows.sort(function (a, b) {
    if (!a.occurredAt) return 1;
    if (!b.occurredAt) return -1;
    return a.occurredAt > b.occurredAt ? -1 : a.occurredAt < b.occurredAt ? 1 : 0;
  });

  return {
    actionCount: rows.length,
    agentCount: Object.keys(agents).length,
    rows: rows
  };
}

/* ── §2.4 Resolution workspace ──────────────────────────────────── */

function resolutionWorkspace(findingId) {
  var f = Finding.fetch({
    filter: Filter.eq('id', findingId),
    include: 'this, phase.code, phase.name, launch.productName, launch.shortName, ' +
      'launch.franchise.name, launch.revenueAtRisk, detectedBy.name',
    limit: 1
  }).objs;
  if (f.length === 0) return null;
  f = f.get(0);

  /* the decision */
  var decs = Decision.fetch({
    filter: Filter.eq('finding.id', findingId),
    include: 'this, finding.id',
    limit: 1
  }).objs;
  var d = decs.length ? decs.get(0) : null;

  /* modelled options */
  var options = [];
  if (d) {
    var opts = DecisionOption.fetch({
      filter: Filter.eq('decision.id', d.id),
      include: 'this, decision.id',
      limit: -1
    }).objs;
    opts.each(function (o) {
      options.push({
        optionKey: o.optionKey,
        label: o.label,
        subLabel: o.subLabel,
        daysRecovered: o.daysRecovered,
        slipLabel: o.slipLabel,
        cost: o.cost,
        gateImpact: o.gateImpact,
        revenueKept: o.revenueKept,
        forfeits: o.forfeits,
        recommended: o.recommended,
        confidence: o.confidence,
        basis: o.basis,
        riskBand: o.riskBand
      });
    });
    options.sort(function (a, b) {
      return a.optionKey < b.optionKey ? -1 : a.optionKey > b.optionKey ? 1 : 0;
    });
  }

  /* guardrail checks */
  var guardrails = [];
  var gcs = GuardrailCheck.fetch({
    filter: Filter.eq('finding.id', findingId),
    include: 'this, finding.id, guardrail.name, runBy.name',
    limit: -1
  }).objs;
  gcs.each(function (g) {
    guardrails.push({
      name: g.name,
      threshold: g.threshold,
      observed: g.observed,
      result: g.result,
      guardrail: g.guardrail ? g.guardrail.name : null,
      runBy: g.runBy ? g.runBy.name : null,
      evaluatedAt: iso(g.evaluatedAt)
    });
  });

  /* escalation thread (comments) */
  var thread = [];
  if (d) {
    var cs = Comment.fetch({
      filter: Filter.eq('decision.id', d.id),
      include: 'this, decision.id',
      limit: -1
    }).objs;
    cs.each(function (c) {
      thread.push({
        author: c.author,
        role: c.authorRole,
        at: iso(c.commentedAt),
        body: c.body,
        isAutomatedCheck: c.isAutomatedCheck,
        sourcesRead: c.sourcesRead
      });
    });
    thread.sort(function (a, b) {
      if (!a.at) return -1; if (!b.at) return 1;
      return a.at < b.at ? -1 : a.at > b.at ? 1 : 0;
    });
  }

  /* action plan — the recommended option's tasks */
  var tasks = [];
  var recKey = null;
  options.forEach(function (o) { if (o.recommended) recKey = o.optionKey; });
  if (d) {
    var ts = ActionPlanTask.fetch({
      filter: Filter.eq('decision.id', d.id),
      include: 'this, decision.id',
      limit: -1
    }).objs;
    ts.each(function (t) {
      tasks.push({
        id: t.id,
        name: t.name,
        owner: t.owner,
        detail: t.detail,
        agentRunnable: t.agentRunnable,
        optionKey: t.optionKey,
        status: t.status,
        dueDate: iso(t.dueDate),
        /* The system of record the action writes into when it runs, and the
           write itself — so the plan states where the change lands, not just
           that it was dispatched. */
        targetSystem: t.targetSystem,
        writeBack: t.writeBack
      });
    });
  }

  /* the chain the fleet ran — linked via Chain.finding */
  var chainSteps = [];
  var chainId = null;
  var chn = Chain.fetch({
    filter: Filter.eq('finding.id', findingId),
    include: 'this, finding.id',
    limit: 1
  }).objs;
  if (chn.length) {
    chainId = chn.get(0).id;
    var acts = AgentAction.fetch({
      filter: Filter.eq('chain.id', chainId),
      include: 'this, chain.id, agent.name',
      limit: -1
    }).objs;
    acts.each(function (a) {
      chainSteps.push({
        sequence: a.sequence,
        verb: a.verb,
        detail: a.detail,
        agent: a.agent ? a.agent.name : null,
        occurredAt: iso(a.occurredAt),
        handoffPrompt: a.handoffPrompt
      });
    });
    chainSteps.sort(function (x, y) { return x.sequence - y.sequence; });
  }

  var recOption = options.filter(function (o) { return o.recommended; })[0] || null;

  /* the CAPA (if any) opened for this finding — the resolution page only shows
     the supplier-quality/CAPA framing when a CAPA actually exists. Commercial
     findings (e.g. field-force certification) have no CAPA and must NOT render
     the "Quality agent opened CAPA-… against the fill-finish process" copy. */
  var capa = null;
  var caps = CAPA.fetch({
    filter: Filter.eq('finding.id', findingId),
    include: 'this, finding.id',
    limit: 1
  }).objs;
  if (caps.length) {
    var cp = caps.get(0);
    capa = {
      capaId: cp.capaId,
      openedAgainstProcess: cp.openedAgainstProcess,
      openedBy: cp.openedBy,
      openedAt: iso(cp.openedAt),
      containmentAction: cp.containmentAction,
      correctiveAction: cp.correctiveAction,
      status: cp.status
    };
  }

  /* the gate this finding puts at risk. A finding lives in a phase, and each
     phase is closed by a specific gate (P4 → G4), so the gate at risk is the
     gate that closes the FINDING'S phase — this is what the finding card's meta
     states (e.g. NPI-0402 in P4 reads "G4 Marketing Authorisation"). We therefore match
     the phase-closing gate first; only if that gate is not on the launch do we
     fall back to the earliest still-open gate BY RANK (a string compare would
     put "BAU" before "G5"). */
  var gateAtRisk = null;
  var lid = f.launch ? f.launch.id : null;
  if (lid) {
    var gates = Gate.fetch({
      filter: Filter.eq('launch.id', lid),
      include: 'this, launch.id',
      limit: -1
    }).objs;
    var phaseGateCode = f.phase ? PHASE_GATE[f.phase.code] : null;
    var best = null;
    var fallback = null;
    gates.each(function (g) {
      if (phaseGateCode && g.code === phaseGateCode) best = g;
      if (g.status !== 'ok') {
        if (!fallback || (GATE_RANK[g.code] || 99) < (GATE_RANK[fallback.code] || 99)) fallback = g;
      }
    });
    if (!best) best = fallback;
    if (best) {
      gateAtRisk = {
        code: best.code,
        name: best.name,
        baselineDate: iso(best.baselineDate),
        forecastDate: iso(best.forecastDate),
        slipDays: best.slipDays,
        status: best.status
      };
    }
  }

  return {
    capa: capa,
    gateAtRisk: gateAtRisk,
    finding: {
      id: f.id,
      displayId: f.displayId,
      headline: f.headline,
      description: f.description,
      signalSource: f.signalSource,
      detectedAt: iso(f.detectedAt),
      detectedBy: f.detectedBy ? f.detectedBy.name : null,
      category: f.category,
      outcome: f.outcome,
      /* who the next step depends on — REGULATOR (FDA / CHMP rapporteur / payer) is
         an outside authority the user cannot resolve by acting, so the workspace
         renders it view-only (no Approve). SELF/TEAM/AGENT are the org's own clock. */
      dependency: f.dependency || null,
      phaseCode: f.phase ? f.phase.code : null,
      phaseName: f.phase ? f.phase.name : null,
      productName: f.launch ? f.launch.productName : null,
      shortName: f.launch ? f.launch.shortName : null,
      franchise: f.launch && f.launch.franchise ? f.launch.franchise.name : null,
      revenueAtRisk: f.launch ? f.launch.revenueAtRisk : null,
      exposure: f.exposure,
      exposureCause: f.exposureCause
    },
    decision: d ? {
      id: d.id,
      heldBy: d.heldBy,
      dueAt: iso(d.dueAt),
      dueLabel: d.dueLabel,
      authorityThreshold: d.authorityThreshold,
      approvedAt: iso(d.approvedAt),
      selectedOption: d.selectedOption
    } : null,
    recommendedOption: recOption,
    recommendedOptionKey: recKey,
    options: options,
    guardrails: guardrails,
    thread: thread,
    tasks: tasks,
    chainId: chainId,
    chainSteps: chainSteps
  };
}

/* ── §2.5 Copilot ───────────────────────────────────────────────── */

function copilot() {
  var prompts = CopilotPrompt.fetch({ limit: -1 }).objs;

  var groups = {};
  var order = [];
  var list = [];
  prompts.each(function (p) {
    list.push({
      id: p.id,
      question: p.question,
      subtitle: p.subtitle,
      groupLabel: p.groupLabel,
      sortOrder: p.sortOrder,
      answer: p.answer,
      showsGuardrails: p.showsGuardrails
    });
  });
  list.sort(function (a, b) { return a.sortOrder - b.sortOrder; });
  list.forEach(function (p) {
    if (!groups[p.groupLabel]) { groups[p.groupLabel] = []; order.push(p.groupLabel); }
    groups[p.groupLabel].push(p);
  });

  var grouped = order.map(function (g) { return { label: g, prompts: groups[g] }; });

  /* the designed refusal — a fixed, ungrounded query gets this, not softened (§6) */
  var refusal = {
    prose: 'I can only answer from what is in the launch record, and I do not have that. ' +
      'Here is what I can take you through end to end:',
    hint: 'Try one of the prompts below, or ask about a launch, a gate, a market, ' +
      'a supplier or an agent by name.'
  };

  return {
    greeting: {
      title: 'Hi George. What do you want to work through?',
      body: 'Ask about any launch, gate, market, supplier or agent. Every answer opens the record behind it.',
      note: 'Grounded in the launch plan, the 107 activities, the agent log and the supplier ' +
        'and market data. Nothing here is a guess.'
    },
    prompts: list,
    groups: grouped,
    refusal: refusal
  };
}

/* ── R-TR-15 Demo rewind — resetDecision ────────────────────────────
 *
 * The Execution branch was the only one of the four scenario branches without a
 * reset (Quality, Market-wave and Cascade each ship one), so the first approval in
 * a walkthrough settled the decision permanently: the action bar showed the
 * outcome instead of the Approve button, and re-approving is refused by
 * assertUserCanDecide(). This restores the seeded baseline so the demo re-runs.
 *
 * Two constraints drive the implementation:
 *
 * 1. Baselines are declared, not derived. approve() clamps with Math.max(0, …)
 *    when it releases the exposure and recomputes the slip, so the pre-approval
 *    values are NOT recoverable from the post-approval row by adding the kept
 *    revenue back on — once exposure hits 0 the original is gone. The baseline
 *    therefore mirrors data/Gate + data/Launch, and BASELINE below is the one
 *    place to update if those seeds change.
 *
 * 2. The Decision row is rebuilt, not merged. A sparse merge cannot un-set a
 *    field — the platform drops nulls rather than writing them — so
 *    selectedOption/approvedAt would survive a merge of nulls. Rebuilding
 *    (remove + create, the technique QualityDisruptionService.reset uses for its
 *    batches) genuinely clears them. Child collections reference the id, which is
 *    preserved, so options/tasks/comments/notifications all stay attached.
 */

/* Seeded pre-approval state for everything approve() can touch, keyed by id.
   Mirrors data/Gate/Gate.json and data/Launch/Launch.json. */
var BASELINE = {
  /* forecastDate is the SEEDED FORECAST, not the gate's baselineDate — the two differ
     by exactly slipDays on a slipped gate. Restoring baselineDate here would leave the
     gate self-contradictory (forecast == baseline while slipDays says 47), which is how
     this was caught: the reset appeared to work but the pane read "+47 days" against an
     unslipped date. The invariant is asserted at the bottom of this block. */
  gates: {
    seed_gate_berobenatide_obesity_g3:  { forecastDate: '2025-12-24', slipDays: 0,  status: 'ok' },
    seed_gate_berobenatide_obesity_g4:  { forecastDate: '2026-07-11', slipDays: 47, status: 'late' },
    seed_gate_berobenatide_t2d_g2: { forecastDate: '2026-01-27', slipDays: 18, status: 'rk' }
  },
  launches: {
    seed_launch_berobenatide_obesity: { revenueAtRisk: 21200000, healthStatus: 'OFF_TRACK' },
    seed_launch_berobenatide_t2d:   { revenueAtRisk: 6200000,  healthStatus: 'AT_RISK' }
  },
  /* seeded Notification.sentAt — the cards were already sent when the decision was
     routed, so a reset restores that instant rather than clearing it. */
  notificationSentAt: '2026-09-11T08:23:00',
  /* CAPA status before approve() closed containment. */
  capaStatus: { seed_capa_0412: 'CORRECTIVE_IN_PROGRESS' }
};

/* The gate approve() would re-baseline for a decision: same launch + phase. */
function gateForDecision(launchId, phaseId) {
  if (!launchId || !phaseId) return null;
  var g = Gate.fetch({
    filter: Filter.eq('launch', launchId).and().eq('phase', phaseId),
    include: 'this', limit: 1
  }).objs;
  return (g && g.length) ? g.get(0) : null;
}

/*
 * Rebuild a row with selected fields cleared.
 *
 * Copies every populated field off the live object rather than naming them, so a
 * field added to Decision later is carried across instead of being silently
 * dropped on the floor by this reset — the failure mode would be a blanked queue
 * card. References are projected to {id} and meta/version are skipped (both are
 * platform-managed and rejected on create).
 */
function rebuildCleared(typeObj, id, include, clearFields) {
  var live = typeObj.fetch({ filter: Filter.eq('id', id), include: include, limit: 1 }).objs;
  if (!live || !live.length) return false;
  live = live.get(0);

  var snap = {};
  for (var k in live) {
    if (k === 'meta' || k === 'version' || k === 'id') continue;
    if (clearFields[k]) continue;
    var v = live[k];
    if (v === null || v === undefined) continue;
    // reference → {id}; scalars and datetimes copy across as-is
    if (typeof v === 'object' && v.id !== undefined && v.id !== null) snap[k] = { id: v.id };
    else snap[k] = v;
  }
  snap.id = id;

  typeObj.removeAll({ filter: Filter.eq('id', id) }, true);
  typeObj.make(snap).create();
  return true;
}

function resetOneDecision(d, out) {
  /* Nothing to undo — an unapproved decision is already at baseline. Checked so a
     refresh can call this unconditionally without writing on every page load. */
  if (!d.approvedAt && !d.selectedOption) {
    out.alreadyBaseline.push(d.id);
    return;
  }

  var launchId = d.finding && d.finding.launch && d.finding.launch.id;
  var phaseId = d.finding && d.finding.phase && d.finding.phase.id;
  var findingId = d.finding && d.finding.id;

  /* 1. Gate — restore the seeded forecast/slip/status. */
  var gate = gateForDecision(launchId, phaseId);
  if (gate && BASELINE.gates[gate.id]) {
    var gb = BASELINE.gates[gate.id];
    var restoredForecast = DateTime.fromString(gb.forecastDate);

    /* Guard the forecast/slip invariant rather than trusting the table: a gate whose
       forecast does not sit slipDays after its own baselineDate is incoherent, and
       silently writing one produces a pane that contradicts itself. Fail loudly
       instead — a wrong baseline is a code defect, not a runtime condition. */
    var expected = DateTime.fromString('' + gate.baselineDate).plusDays(gb.slipDays);
    if (('' + expected).substring(0, 10) !== ('' + restoredForecast).substring(0, 10)) {
      throw new Error(
        'BASELINE.gates["' + gate.id + '"] is inconsistent: baselineDate ' + gate.baselineDate +
        ' + ' + gb.slipDays + ' days = ' + expected + ', but the table says forecastDate ' +
        gb.forecastDate + '. Restoring it would leave the gate self-contradictory. ' +
        'Fix the entry to match data/Gate/Gate.json.'
      );
    }

    Gate.make({
      id: gate.id,
      forecastDate: restoredForecast,
      slipDays: gb.slipDays,
      status: gb.status
    }).merge();
    out.recordsRestored += 1;
  }

  /* 2. Launch exposure and health is restored by restoreBaselineLaunches(), which
        runs unconditionally in resetDecision() rather than from here — see the
        comment on that function for why it cannot live behind the early return. */

  /* 3. Tasks — every option's tasks go back to "Not started". Not just the
        approved option's: a reset must not leave a previously-approved option's
        tasks dispatched if the demo is re-run on a different option. */
  var tasks = ActionPlanTask.fetch({
    filter: Filter.eq('decision', d.id), include: 'this', limit: -1
  }).objs;
  if (tasks && tasks.length) {
    var back = [];
    tasks.each(function (t) {
      if (t.status !== 'Not started') back.push(ActionPlanTask.make({ id: t.id, status: 'Not started' }));
    });
    if (back.length) { ActionPlanTask.mergeBatch(back); out.recordsRestored += back.length; }
  }

  /* 4. Notifications — re-stamp the seeded sent instant. */
  var notifs = Notification.fetch({
    filter: Filter.eq('decision', d.id), include: 'this', limit: -1
  }).objs;
  if (notifs && notifs.length) {
    var seeded = DateTime.fromString(BASELINE.notificationSentAt);
    var restamp = [];
    notifs.each(function (n) { restamp.push(Notification.make({ id: n.id, sentAt: seeded })); });
    Notification.mergeBatch(restamp);
    out.recordsRestored += restamp.length;
  }

  /* 5. CAPA — reopen the containment approve() closed. closedByDecision is a
        reference that must genuinely clear, so the row is rebuilt. */
  if (findingId) {
    var capas = CAPA.fetch({
      filter: Filter.eq('finding', findingId), include: 'this, closedByDecision.id', limit: -1
    }).objs;
    if (capas && capas.length) {
      capas.each(function (cp) {
        if (cp.status !== 'CONTAINED' && !cp.closedByDecision) return;
        rebuildCleared(CAPA, cp.id, 'this, finding.id, launch.id, closedByDecision.id',
          { closedByDecision: 1 });
        var want = BASELINE.capaStatus[cp.id];
        if (want) CAPA.make({ id: cp.id, status: want }).merge();
        out.recordsRestored += 1;
      });
    }
  }

  /* 6. The generated CTD entry. Removed rather than kept because it is a record of
        a decision that, after the rewind, did not happen — leaving it would show a
        design-history entry for an unapproved decision. The seeded
        seed_dhf_* entries are untouched. */
  DesignHistoryFileEntry.removeAll({ filter: Filter.eq('id', 'dhf_approve_' + d.id) }, true);

  /* 7. The decision itself, last — so a failure above leaves it approved and the
        reset visibly incomplete, rather than clearing the marker while the cascade
        it guards is still half-applied. */
  rebuildCleared(Decision, d.id, 'this, finding.id, owner.id, escalation.id',
    { selectedOption: 1, approvedAt: 1 });
  out.recordsRestored += 1;
  out.reset.push(d.id);
}

/*
 * Restore every launch's seeded exposure and health.
 *
 * This runs unconditionally, and deliberately does NOT sit inside
 * resetOneDecision. That function early-returns on a decision whose approvedAt
 * and selectedOption are already clear, so once the first reset had cleared the
 * decision marker nothing ever wrote Launch.healthStatus again. Any state that
 * left a launch improved while its decision looked un-approved was therefore
 * permanent: Berobenatide stayed off OFF_TRACK, and because the portfolio sorts
 * worst-health-first it stopped being the launch the demo opens on.
 *
 * Safe to call on every page load: these are absolute values against fixed ids,
 * so the write is idempotent rather than incremental.
 */
function restoreBaselineLaunches(out) {
  for (var launchId in BASELINE.launches) {
    var lb = BASELINE.launches[launchId];
    Launch.make({
      id: launchId, revenueAtRisk: lb.revenueAtRisk, healthStatus: lb.healthStatus
    }).merge();
    out.recordsRestored += 1;
  }
}

function resetDecision(decisionId) {
  var out = { reset: [], alreadyBaseline: [], recordsRestored: 0 };

  restoreBaselineLaunches(out);

  var filter = (decisionId && ('' + decisionId).length)
    ? Filter.eq('id', decisionId)
    : Filter.eq('heldBy', 'USER');

  var ds = Decision.fetch({
    filter: filter,
    include: 'this, finding.id, finding.launch.id, finding.phase.id',
    limit: -1
  }).objs;

  if (!ds || !ds.length) {
    if (decisionId && ('' + decisionId).length) {
      throw new Error('No decision ' + decisionId + ' to reset.');
    }
    return out;
  }

  ds.each(function (d) { resetOneDecision(d, out); });
  return out;
}
