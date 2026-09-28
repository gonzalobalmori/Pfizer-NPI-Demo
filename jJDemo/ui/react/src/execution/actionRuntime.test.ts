/*
 * The write-back receipt and plan-progress logic.
 *
 * These are the two claims the execution UI makes and cannot be allowed to get
 * wrong: that a document reference is stable (an audit trail that renumbers
 * itself on re-render is worthless), and that assigning is not counted as
 * executing.
 */

import {
  makeReceipt,
  planProgress,
  referenceFor,
  statusAfter,
  statusChip,
  type ActionRunMap,
} from './actionRuntime';

describe('referenceFor', () => {
  it('is stable for the same task and system', () => {
    const a = referenceFor('seed_task_417_a_1', 'SAP Ariba');
    const b = referenceFor('seed_task_417_a_1', 'SAP Ariba');
    expect(a).toBe(b);
  });

  it('differs between tasks, so two writes are not reported under one document', () => {
    expect(referenceFor('seed_task_417_a_1', 'SAP ECC'))
      .not.toBe(referenceFor('seed_task_417_a_7', 'SAP ECC'));
  });

  it('uses the document shape of the target system', () => {
    expect(referenceFor('seed_task_417_a_1', 'SAP Ariba')).toMatch(/^PO 45001/);
    expect(referenceFor('seed_task_417_a_4', 'Planisware')).toMatch(/^Baseline BL-2026-/);
    expect(referenceFor('seed_task_417_b_2', 'LabWare LIMS')).toMatch(/^Test order LIMS-/);
    expect(referenceFor('seed_task_412_a_2', 'MES')).toMatch(/^Inspection plan IP-/);
  });

  it('falls back to a generic record for an unknown system', () => {
    expect(referenceFor('seed_task_x', 'Some Other System')).toMatch(/^Record \d+$/);
  });
});

describe('makeReceipt', () => {
  it('records system, transaction, actor and reference together', () => {
    const r = makeReceipt('seed_task_417_a_1', 'SAP Ariba', 'Convert requisition to purchase order', 'Sourcing agent');
    expect(r.system).toBe('SAP Ariba');
    expect(r.transaction).toBe('Convert requisition to purchase order');
    expect(r.actor).toBe('Sourcing agent');
    expect(r.reference).toBe(referenceFor('seed_task_417_a_1', 'SAP Ariba'));
    expect(Number.isNaN(Date.parse(r.at))).toBe(false);
  });
});

describe('statusAfter', () => {
  it('treats assigning as not executed', () => {
    expect(statusAfter('assign')).toBe('Assigned');
  });

  it('treats both run paths as done', () => {
    expect(statusAfter('agent')).toBe('Done');
    expect(statusAfter('self')).toBe('Done');
  });
});

describe('planProgress', () => {
  const ids = ['t1', 't2', 't3', 't4'];

  it('counts nothing as done on an untouched plan', () => {
    const p = planProgress(ids, {});
    expect(p).toMatchObject({ done: 0, assigned: 0, pending: 4, total: 4, pct: 0 });
    expect(p.systemsWritten).toEqual([]);
  });

  it('counts an assigned action as neither done nor pending', () => {
    const runs: ActionRunMap = { t1: { status: 'Assigned', assignedTo: 'A. Kowalski' } };
    expect(planProgress(ids, runs)).toMatchObject({ done: 0, assigned: 1, pending: 3, pct: 0 });
  });

  it('reports the distinct systems actually written to, without duplicates', () => {
    const runs: ActionRunMap = {
      t1: { status: 'Done', receipt: makeReceipt('t1', 'SAP ECC', 'x', 'You') },
      t2: { status: 'Done', receipt: makeReceipt('t2', 'SAP ECC', 'y', 'You') },
      t3: { status: 'Done', receipt: makeReceipt('t3', 'Planisware', 'z', 'Planning agent') },
    };
    const p = planProgress(ids, runs);
    expect(p).toMatchObject({ done: 3, pending: 1, pct: 75 });
    expect(p.systemsWritten.sort()).toEqual(['Planisware', 'SAP ECC']);
  });

  it('does not credit a system for an assignment that has not run', () => {
    const runs: ActionRunMap = { t1: { status: 'Assigned', assignedTo: 'M. Okafor' } };
    expect(planProgress(ids, runs).systemsWritten).toEqual([]);
  });

  it('is safe on an empty plan', () => {
    expect(planProgress([], {})).toMatchObject({ total: 0, pct: 0 });
  });
});

describe('statusChip', () => {
  it('maps each status onto the chip the CSS styles', () => {
    expect(statusChip('Not started')).toBe(0);
    expect(statusChip('Running')).toBe(1);
    expect(statusChip('Done')).toBe(2);
    expect(statusChip('Assigned')).toBe(3);
  });
});
