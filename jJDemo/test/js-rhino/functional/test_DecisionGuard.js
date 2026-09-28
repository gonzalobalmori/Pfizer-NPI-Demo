/**
 * Decision service-layer guard — §2 hard requirement #1 (the atomic approve is
 * gated so only a USER-held, not-yet-approved decision can be decided). This is a
 * read-only functional test: assertUserCanDecide() only reads state, so it is
 * safe to invoke inside expect(...). It does NOT run approve() (which mutates the
 * whole cascade); that transaction is smoke-tested separately via runJsCode.
 *
 * Anchor case NPI-0417 (seed_decision_417) is held by the USER and unapproved,
 * so the guard must pass. Findings held by the fleet (AGENT) or by another person
 * (ESCALATED / DELEGATED) must be refused — George cannot decide those.
 */
const filename = 'test_DecisionGuard';

describe(filename, function () {
  describe('Decision#assertUserCanDecide', function () {
    describe('when the decision is held by the USER and unapproved', function () {
      it('returns true for the anchor case NPI-0417', function () {
        expect(Decision.forId('seed_decision_417').assertUserCanDecide()).toBeTrue();
      });
    });

    describe('when the decision is held by the fleet (AGENT)', function () {
      it('throws — the user cannot decide a fleet-held finding', function () {
        expect(() => {
          Decision.forId('seed_decision_319').assertUserCanDecide();
        }).toThrow();
      });
    });

    describe('when the decision is escalated to another person', function () {
      it('throws — the user cannot decide an escalated finding', function () {
        expect(() => {
          Decision.forId('seed_decision_344').assertUserCanDecide();
        }).toThrow();
      });
    });

    describe('when the decision is delegated to another person', function () {
      it('throws — the user cannot decide a delegated finding', function () {
        expect(() => {
          Decision.forId('seed_decision_351').assertUserCanDecide();
        }).toThrow();
      });
    });
  });
});
