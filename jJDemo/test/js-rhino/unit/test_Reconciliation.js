/**
 * Reconciliation unit tests — model invariants §3.6.7 and §3.6.8.
 *
 * These are the invariants the brief (§6) requires be pinned down as unit tests
 * BEFORE any UI is built: the 107 activities must reconcile three independent
 * ways, and the autonomy split must sum to the same 107. The specs are pure
 * read-and-assert against provisioned seed data — nothing is created here, so no
 * TestApi context / waitForSetup is needed.
 *
 *   §3.6.7  Activities reconcile:
 *             by phase    P1..P6  = 16 / 19 / 27 / 22 / 14 / 9  (= 107)
 *             by status   ok/run/rk/late/no = 49 / 8 / 4 / 2 / 44  (= 107)
 *               (Berobenatide P2_12 corrected rk→ok: a CLOSED phase cannot hold an
 *                at-risk deliverable — manager feedback; residual risk lives in P3)
 *             by domain   12 functional domains, counts sum to 107
 *   §3.6.8  Autonomy split A / R = 95 / 12  (= 107)
 *               (the former human-led "H" class is folded into R — both mean the
 *                human makes the decision, so the split is a clean
 *                agent-executes vs. human-decides dichotomy)
 */
const filename = 'test_Reconciliation';

describe(filename, function () {
  beforeAll(function () {
    this.TOTAL = 107;

    // Read Berobenatide's authored activity set once (statusCode + phase code +
    // domain code + autonomy class code), then derive every tally from that one
    // collection so all four reconciliations are proven against the same 107
    // rows. Scoped to Berobenatide: the §3.6.7–8 fixture is the Berobenatide board;
    // the other launches carry their own phase-shifted activity boards.
    var acts = Activity.fetch({
      filter: Filter.eq('launch.id', 'seed_launch_berobenatide_obesity'),
      include: 'id, statusCode, phase.code, domain.code, autonomyClass.code',
      limit: -1
    }).objs;

    this.count = acts.length;

    var byPhase = {};
    var byStatus = {};
    var byDomain = {};
    var byAutonomy = {};
    acts.each(function (a) {
      var p = a.phase ? a.phase.code : 'UNKNOWN';
      var s = a.statusCode || 'UNKNOWN';
      var d = a.domain ? a.domain.code : 'UNKNOWN';
      var au = a.autonomyClass ? a.autonomyClass.code : 'UNKNOWN';
      byPhase[p] = (byPhase[p] || 0) + 1;
      byStatus[s] = (byStatus[s] || 0) + 1;
      byDomain[d] = (byDomain[d] || 0) + 1;
      byAutonomy[au] = (byAutonomy[au] || 0) + 1;
    });
    this.byPhase = byPhase;
    this.byStatus = byStatus;
    this.byDomain = byDomain;
    this.byAutonomy = byAutonomy;

    var domainSum = 0;
    for (var k in byDomain) { if (byDomain.hasOwnProperty(k)) domainSum += byDomain[k]; }
    this.domainCount = 0;
    for (var k2 in byDomain) { if (byDomain.hasOwnProperty(k2)) this.domainCount++; }
    this.domainSum = domainSum;

    // Expected fixtures (from the prototype, §3.6).
    this.expectedPhase = { P1: 16, P2: 19, P3: 27, P4: 22, P5: 14, P6: 9 };
    this.expectedStatus = { ok: 49, run: 8, rk: 4, late: 2, no: 44 };
    this.expectedAutonomy = { A: 95, R: 12 };

    // Finding outcomes (§3.6.3): 11 findings, USER5/HELD3/AUTO1/RUNNING2.
    // (The third HELD is NPI-0420, the FDA BLA-review finding added for the
    // time-recovery feature: it depends on a regulator, so it sits HELD while the
    // agency responds.)
    // The two post-launch (P6) AUTO findings — I-331 (Ferentino yield) and I-328
    // (EU FMD) on the LAUNCHED PF-3945 — were removed with all post-launch agent
    // activity: post-launch is out of launch-control scope. That drops AUTO 3→1
    // and the finding total 13→11.
    var findings = Finding.fetch({ include: 'id, outcome', limit: -1 }).objs;
    this.findingCount = findings.length;
    var byOutcome = {};
    findings.each(function (f) {
      var o = f.outcome || 'UNKNOWN';
      byOutcome[o] = (byOutcome[o] || 0) + 1;
    });
    this.byOutcome = byOutcome;
    this.expectedOutcome = { USER: 5, HELD: 3, AUTO: 1, RUNNING: 2 };
  });

  describe('Activity total', function () {
    it('has exactly 107 activities', function () {
      expect(this.count).toBe(this.TOTAL);
    });
  });

  describe('reconciliation by phase (§3.6.7)', function () {
    it('matches 16/19/27/22/14/9 across P1..P6', function () {
      C3.Array.ofStr('P1', 'P2', 'P3', 'P4', 'P5', 'P6').each((code) => {
        expect(this.byPhase[code])
          .withContext('phase ' + code)
          .toBe(this.expectedPhase[code]);
      });
    });

    it('sums to 107 across phases', function () {
      var sum = 0;
      var self = this;
      C3.Array.ofStr('P1', 'P2', 'P3', 'P4', 'P5', 'P6').each((code) => {
        sum += (self.byPhase[code] || 0);
      });
      expect(sum).toBe(this.TOTAL);
    });
  });

  describe('reconciliation by status (§3.6.7)', function () {
    it('matches ok49/run8/rk4/late2/no44', function () {
      C3.Array.ofStr('ok', 'run', 'rk', 'late', 'no').each((code) => {
        expect(this.byStatus[code])
          .withContext('status ' + code)
          .toBe(this.expectedStatus[code]);
      });
    });

    it('sums to 107 across statuses', function () {
      var sum = 0;
      var self = this;
      C3.Array.ofStr('ok', 'run', 'rk', 'late', 'no').each((code) => {
        sum += (self.byStatus[code] || 0);
      });
      expect(sum).toBe(this.TOTAL);
    });
  });

  describe('reconciliation by domain (§3.6.7)', function () {
    it('spreads across exactly 12 functional domains', function () {
      expect(this.domainCount).toBe(12);
    });

    it('sums to 107 across domains', function () {
      expect(this.domainSum).toBe(this.TOTAL);
    });
  });

  describe('reconciliation by autonomy class (§3.6.8)', function () {
    it('matches A95/R12', function () {
      C3.Array.ofStr('A', 'R').each((code) => {
        expect(this.byAutonomy[code])
          .withContext('autonomy ' + code)
          .toBe(this.expectedAutonomy[code]);
      });
    });

    it('sums to 107 across autonomy classes', function () {
      var sum = 0;
      var self = this;
      C3.Array.ofStr('A', 'R').each((code) => {
        sum += (self.byAutonomy[code] || 0);
      });
      expect(sum).toBe(this.TOTAL);
    });
  });

  describe('finding outcomes (§3.6.3)', function () {
    it('has exactly 11 findings', function () {
      expect(this.findingCount).toBe(11);
    });

    it('splits USER5/HELD3/AUTO1/RUNNING2', function () {
      C3.Array.ofStr('USER', 'HELD', 'AUTO', 'RUNNING').each((code) => {
        expect(this.byOutcome[code])
          .withContext('outcome ' + code)
          .toBe(this.expectedOutcome[code]);
      });
    });
  });
});
