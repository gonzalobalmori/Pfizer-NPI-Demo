/*
 * API bridge for the Execution branch. Every call goes to the backend
 * ExecutionService read methods (or Decision#approve) via c3Action — there is
 * no local/mock data. A failing call surfaces to the caller.
 */

import { c3Action, c3MemberAction } from '@/c3Action';
import type {
  PendingQueue,
  EscalatedQueue,
  DecisionHistory,
  LiveBoard,
  ActivityLog,
  ResolutionWorkspace,
  CopilotData,
  EodDomainsData,
  EodPromptsData,
  EodAnswer,
  EodExtractData,
  EodDraft,
  EodCommitData,
} from '@/types/execution';

export const getPendingQueue = (): Promise<PendingQueue> =>
  c3Action('ExecutionService', 'pendingQueue', []);

export const getEscalatedQueue = (): Promise<EscalatedQueue> =>
  c3Action('ExecutionService', 'escalatedQueue', []);

export const getDecisionHistory = (): Promise<DecisionHistory> =>
  c3Action('ExecutionService', 'decisionHistory', []);

export const getLiveBoard = (franchise: string, market: string): Promise<LiveBoard> =>
  c3Action('ExecutionService', 'liveBoard', [franchise, market]);

export const getActivityLog = (franchise: string, market: string): Promise<ActivityLog> =>
  c3Action('ExecutionService', 'activityLog', [franchise, market]);

export const getResolutionWorkspace = (findingId: string): Promise<ResolutionWorkspace | null> =>
  c3Action('ExecutionService', 'resolutionWorkspace', [findingId]);

export const getCopilot = (): Promise<CopilotData> =>
  c3Action('ExecutionService', 'copilot', []);

export const approveDecision = (decisionId: string, optionLabel: string): Promise<{ id: string }> =>
  c3MemberAction('Decision', 'approve', { id: decisionId }, [optionLabel]);

/* ── End-of-Day log (conversational capture) ──────────────────── */

export const getEodDomains = (): Promise<EodDomainsData> =>
  c3Action('EodLogService', 'domains', []);

export const getEodPrompts = (domain: string): Promise<EodPromptsData> =>
  c3Action('EodLogService', 'guidedPrompts', [domain]);

export const extractEodSignals = (
  domain: string,
  freeText: string,
  answers: EodAnswer[],
): Promise<EodExtractData> =>
  c3Action('EodLogService', 'extractSignals', [domain, freeText, answers]);

export const commitEodSignals = (approvedDrafts: EodDraft[]): Promise<EodCommitData> =>
  c3Action('EodLogService', 'commitSignals', [approvedDrafts]);
