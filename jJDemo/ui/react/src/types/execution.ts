/*
 * View-model interfaces for the Execution branch (§2). These mirror, field for
 * field, the JSON shapes returned by the backend ExecutionService read methods.
 */

export type DueTagClass = 'crit' | 'risk';
export type TagClass = 'crit' | 'auto' | 'risk';
export type CtaEmphasis = 'primary' | 'secondary';
export type Outcome = 'USER' | 'HELD' | 'AUTO' | 'RUNNING';
export type Category = 'ct' | 'rk' | 'ok';

/* ── My Actions — Pending ─────────────────────────────────────── */
export interface PendingCard {
  decisionId: string;
  findingId: string | null;
  displayId: string | null;
  title: string | null;
  category: Category | null;
  meta: string | null;
  agentRecommendation: string | null;
  dueLabel: string | null;
  dueTagClass: DueTagClass | null;
  functions: string | null;
  ctaEmphasis: CtaEmphasis | null;
  dueAt: string | null;
}
export interface PendingQueue {
  count: number;
  cards: PendingCard[];
}

/* ── My Actions — Escalated ───────────────────────────────────── */
export interface EscalationPip {
  sequence: number;
  label: string;
  state: string;
}
export interface EscalatedCard {
  escalationId: string;
  decisionId: string | null;
  findingId: string | null;
  displayId: string | null;
  title: string | null;
  meta: string | null;
  progressSummary: string | null;
  tagLabel: string | null;
  tagClass: TagClass | null;
  functionLabel: string | null;
  ctaEmphasis: CtaEmphasis | null;
  raisedAt: string | null;
  pips: EscalationPip[];
}
export interface EscalatedQueue {
  count: number;
  cards: EscalatedCard[];
}

/* ── My Actions — History ─────────────────────────────────────── */
export interface HistoryNote {
  author: string | null;
  role: string | null;
  at: string | null;
  body: string | null;
}
export interface HistoryRow {
  id: string;
  npiId: string | null;
  kind: 'MY' | 'ESC';
  status: 'RUNNING' | 'RESOLVED' | 'ESCALATED';
  label: string | null;
  subLine: string | null;
  occurredAt: string | null;
  sortOrder: number;
  note: HistoryNote | null;
}
export interface HistoryKpis {
  decisionsTaken: number;
  decisionsTakenWindow: string;
  decisionsTakenDelta: string;
  closed: number;
  closedOf: string;
  closedNote: string;
  actionsDelegated: number;
  actionsDelegatedNote: string;
  escalationsOpen: number;
  escalationsOpenNote: string;
  medianTimeToDecide: string;
}
export interface DecisionHistory {
  rows: HistoryRow[];
  counts: { taken: number; escalations: number; total: number };
  kpis: HistoryKpis;
}

/* ── Live board ───────────────────────────────────────────────── */
export interface ChainStep {
  sequence: number;
  verb: string | null;
  detail: string | null;
  agent: string | null;
  occurredAt: string | null;
  stateLabel: string | null;
  handoffPrompt: string | null;
  completed: boolean;
}
export interface BoardCard {
  findingId: string;
  displayId: string | null;
  phaseCode: string | null;
  outcome: Outcome | null;
  category: Category | null;
  found: string | null;
  headline: string | null;
  franchise: string | null;
  products: string[];
  marketCodes: string[];
  detectedBy: string | null;
  chainId: string | null;
  steps: ChainStep[];
}
export interface BoardColumn {
  code: string;
  name: string;
  state: string;
  running: number;
  onYou: number;
  cards: BoardCard[];
}
export interface BoardKpis {
  actionsOnBoard: number;
  findingCount: number;
  productCount: number;
  workingNow: number;
  yourDecision: number;
  heldByPerson: number;
  closedByFleet: number;
}
export interface LiveBoard {
  kpis: BoardKpis;
  columns: BoardColumn[];
  filters: { franchises: string[]; markets: string[] };
}

/* ── Activity log ─────────────────────────────────────────────── */
export interface ActivityRow {
  occurredAt: string | null;
  agent: string | null;
  verb: string | null;
  detail: string | null;
  product: string | null;
  otherProductCount: number;
  phaseCode: string | null;
  franchise: string | null;
  outcome: Outcome | null;
  findingId: string;
  displayId: string | null;
}
export interface ActivityLog {
  actionCount: number;
  agentCount: number;
  rows: ActivityRow[];
}

/* ── Resolution workspace ─────────────────────────────────────── */
export interface WorkspaceFinding {
  id: string;
  displayId: string | null;
  headline: string | null;
  description: string | null;
  signalSource: string | null;
  detectedAt: string | null;
  detectedBy: string | null;
  category: Category | null;
  outcome: Outcome | null;
  /* SELF | TEAM | AGENT | REGULATOR — REGULATOR is an outside authority the user
     cannot resolve by acting, so the workspace is view-only for those findings. */
  dependency: 'SELF' | 'TEAM' | 'AGENT' | 'REGULATOR' | null;
  phaseCode: string | null;
  phaseName: string | null;
  deviceName: string | null;
  shortName: string | null;
  franchise: string | null;
  revenueAtRisk: number | null;
  exposure: number | null;
  exposureCause: string | null;
}
export interface WorkspaceDecision {
  id: string;
  heldBy: Outcome;
  dueAt: string | null;
  dueLabel: string | null;
  authorityThreshold: string | null;
  approvedAt: string | null;
  selectedOption: string | null;
}
export interface DecisionOptionVm {
  optionKey: string;
  label: string | null;
  subLabel: string | null;
  daysRecovered: number | null;
  slipLabel: string | null;
  cost: number | null;
  gateImpact: string | null;
  revenueKept: number | null;
  forfeits: string | null;
  recommended: boolean;
  confidence: string | null;
  basis: string | null;
  riskBand: string | null;
}
export interface GuardrailVm {
  name: string | null;
  threshold: string | null;
  observed: string | null;
  result: string | null;
  guardrail: string | null;
  runBy: string | null;
  evaluatedAt: string | null;
}
export interface ThreadComment {
  author: string | null;
  role: string | null;
  at: string | null;
  body: string | null;
  isAutomatedCheck: boolean | null;
  sourcesRead: string | null;
}
export interface ActionPlanTaskVm {
  name: string | null;
  owner: string | null;
  detail: string | null;
  agentRunnable: boolean | null;
  optionKey: string | null;
  status: string | null;
  dueDate: string | null;
}
export interface WorkspaceCapa {
  capaId: string | null;
  openedAgainstProcess: string | null;
  openedBy: string | null;
  openedAt: string | null;
  containmentAction: string | null;
  correctiveAction: string | null;
  status: string | null;
}
export interface WorkspaceGateAtRisk {
  code: string;
  name: string;
  baselineDate: string | null;
  forecastDate: string | null;
  slipDays: number | null;
  status: 'ok' | 'late' | 'no';
}
export interface ResolutionWorkspace {
  capa: WorkspaceCapa | null;
  gateAtRisk: WorkspaceGateAtRisk | null;
  finding: WorkspaceFinding;
  decision: WorkspaceDecision | null;
  recommendedOption: DecisionOptionVm | null;
  recommendedOptionKey: string | null;
  options: DecisionOptionVm[];
  guardrails: GuardrailVm[];
  thread: ThreadComment[];
  tasks: ActionPlanTaskVm[];
  chainId: string | null;
  chainSteps: ChainStep[];
}

/* ── End-of-Day log (conversational capture) ──────────────────── */
export interface EodDomain {
  code: string;
  name: string;
  agentId: string | null;
  agentName: string | null;
}
export interface EodDomainsData {
  domains: EodDomain[];
}
export interface EodPrompt {
  promptId: string;
  question: string;
  hint: string | null;
  launchId: string | null;
  phaseId: string | null;
  source: 'gate' | 'finding' | 'open';
}
export interface EodPromptsData {
  domain: string;
  prompts: EodPrompt[];
}
/* An answer to a guided prompt, sent back to extractSignals. */
export interface EodAnswer {
  promptId: string;
  question: string;
  answer: string;
  launchId: string | null;
  phaseId: string | null;
}
/* A structured draft signal returned by extractSignals — reviewed by the owner
 * before anything is committed. `category`/`launchId` are editable in the UI. */
export interface EodDraft {
  kind: 'risk' | 'delay' | 'blocker' | 'decision' | 'evidence' | 'status';
  category: Category;
  headline: string;
  description: string;
  launchId: string | null;
  launchName: string | null;
  phaseId: string | null;
  confidence: number;
  source: string;
  engine: 'llm' | 'deterministic';
  needsReview: boolean;
}
export interface EodExtractData {
  domain: string;
  engine: 'llm' | 'deterministic' | 'none';
  count: number;
  drafts: EodDraft[];
  note?: string;
}
export interface EodCommittedFinding {
  id: string;
  displayId: string;
  headline: string;
  category: Category;
  launchId: string | null;
  detectedBy: string | null;
}
export interface EodCommitData {
  created: EodCommittedFinding[];
  count: number;
  note: string;
}

/* ── Copilot ──────────────────────────────────────────────────── */
export interface CopilotEvidence {
  label: string;
  value: string;
}
export interface CopilotStep {
  title: string;
  body: string;
  when?: string;
  flag?: string;
}
export interface CopilotAnswerAction {
  label: string;
  style: string;
  target: string;
}
export interface CopilotAnswer {
  prose?: string[];
  evidence?: CopilotEvidence[];
  steps?: CopilotStep[];
  prose2?: string[];
  rec?: string;
  why?: string[];
  confidence?: string;
  actions?: CopilotAnswerAction[];
}
export interface CopilotPromptVm {
  id: string;
  question: string;
  subtitle: string | null;
  groupLabel: string | null;
  sortOrder: number;
  answer: CopilotAnswer | null;
  showsGuardrails: boolean;
}
export interface CopilotGroup {
  label: string;
  prompts: CopilotPromptVm[];
}
export interface CopilotData {
  greeting: { title: string; body: string; note: string };
  prompts: CopilotPromptVm[];
  groups: CopilotGroup[];
  refusal: { prose: string; hint: string };
}
