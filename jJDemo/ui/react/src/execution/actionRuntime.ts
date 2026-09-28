/*
 * Execution state for action-plan tasks, and the write receipt each one returns.
 *
 * SCOPE: this is a demonstration surface. Executing an action here records the
 * write locally for the session and renders the receipt the real integration
 * would return — it does not post to SAP, Veeva or Planisware. The page footer
 * already states the data is synthetic; this module keeps the *shape* of a
 * write-back honest (named system, named transaction, a document reference, a
 * timestamp and an actor) so the demo shows the mechanism rather than a
 * hand-wave.
 *
 * Receipts are derived from the task id rather than random, so a document
 * number does not change between renders — an audit trail that renumbers itself
 * on re-render would undermine the point being made.
 */

export type RunMode = 'agent' | 'self' | 'assign';

export type ActionStatus = 'Not started' | 'Assigned' | 'Running' | 'Done' | 'Failed';

export interface ActionReceipt {
  /** System of record the write landed in. */
  system: string;
  /** Document / object reference the system returned. */
  reference: string;
  /** What the transaction did, in that system's own language. */
  transaction: string;
  /** Who executed it — an agent name or a person. */
  actor: string;
  /** ISO timestamp of the write. */
  at: string;
}

export interface ActionRunState {
  status: ActionStatus;
  /** Set when the task has been assigned to a person rather than executed. */
  assignedTo?: string | null;
  note?: string | null;
  receipt?: ActionReceipt | null;
}

/** Keyed by task id. */
export type ActionRunMap = Record<string, ActionRunState>;

/*
 * The document-reference shape each system uses. Getting these roughly right is
 * most of what makes a write-back demo credible to someone who works in them.
 */
const REF_SHAPE: [RegExp, (n: number) => string][] = [
  [/Ariba/i, (n) => `PO 45001${n}`],
  [/SRM/i, (n) => `Contract amendment CW-${n} v2`],
  [/IBP/i, (n) => `Planning version PV-2026-${String(n).slice(0, 2)}`],
  [/SAP ECC/i, (n) => `Material document 49000${n}`],
  [/Vault RIM/i, (n) => `Submission record RIM-00${n}`],
  [/Vault QMS/i, (n) => `Protocol PRT-26-0${String(n).slice(0, 3)}`],
  [/Planisware/i, (n) => `Baseline BL-2026-${String(n).slice(0, 2)}`],
  [/LIMS/i, (n) => `Test order LIMS-1${n}`],
  [/MES/i, (n) => `Inspection plan IP-${String(n).slice(0, 4)} rev 4`],
  [/portal/i, (n) => `Booking BKG-2026-${String(n).slice(0, 5)}`],
  [/Pfizer Connect/i, (n) => `Activation request MA-${String(n).slice(0, 4)}`],
];

/** Stable pseudo-number from a task id — same id always yields the same ref. */
function seedNumber(taskId: string): number {
  let h = 0;
  for (let i = 0; i < taskId.length; i++) h = (h * 31 + taskId.charCodeAt(i)) % 1000000;
  return 100000 + h;
}

/** The document reference the given system would hand back for this task. */
export function referenceFor(taskId: string, system: string): string {
  const n = seedNumber(taskId);
  for (const [re, fmt] of REF_SHAPE) if (re.test(system)) return fmt(n);
  return `Record ${n}`;
}

/** Build the receipt an execution returns. */
export function makeReceipt(
  taskId: string,
  system: string,
  transaction: string,
  actor: string,
): ActionReceipt {
  return {
    system,
    transaction,
    actor,
    reference: referenceFor(taskId, system),
    at: new Date().toISOString(),
  };
}

/** Status after a given run mode. Assigning is not executing. */
export function statusAfter(mode: RunMode): ActionStatus {
  return mode === 'assign' ? 'Assigned' : 'Done';
}

/** The status chip index the existing `.ac-s[data-s]` styling expects. */
export function statusChip(status: ActionStatus): number {
  switch (status) {
    case 'Assigned': return 3;
    case 'Running': return 1;
    case 'Done': return 2;
    default: return 0;
  }
}

/** Progress summary across a plan. */
export function planProgress(taskIds: string[], runs: ActionRunMap) {
  let done = 0, assigned = 0, pending = 0;
  const systems = new Set<string>();
  for (const id of taskIds) {
    const r = runs[id];
    if (r?.status === 'Done') { done++; if (r.receipt) systems.add(r.receipt.system); }
    else if (r?.status === 'Assigned') assigned++;
    else pending++;
  }
  return {
    done,
    assigned,
    pending,
    total: taskIds.length,
    pct: taskIds.length ? Math.round((done / taskIds.length) * 100) : 0,
    systemsWritten: [...systems],
  };
}
