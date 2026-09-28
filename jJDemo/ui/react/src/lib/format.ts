/*
 * Copyright 2009-2026 C3 AI (www.c3.ai). All Rights Reserved.
 * Confidential and Proprietary C3 Materials.
 * This material, including without limitation any software, is the confidential trade secret and proprietary
 * information of C3 and its licensors. Reproduction, use and/or distribution of this material in any form is
 * strictly prohibited except as set forth in a written license agreement with C3 and/or its authorized distributors.
 * This material may be covered by one or more patents or pending patent applications.
 */

import { gateName } from '@/pharmaText';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Parses an ISO-ish string/Date into a valid Date, or null when unparseable. */
function toDate(value: string | Date | null | undefined): Date | null {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Formats a date as a full day-month-year string, e.g. "12 Sep 2026".
 * Returns an empty string when the input is null/undefined/invalid.
 */
export function fmtDate(value: string | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return '';
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * Formats a date as month and year only, e.g. "Sep 2026".
 * Returns an empty string when the input is null/undefined/invalid.
 */
export function fmtDateYear(value: string | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return '';
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * Formats a date with time, e.g. "12 Sep 2026, 14:05".
 * Returns an empty string when the input is null/undefined/invalid.
 */
export function fmtDateTime(value: string | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return '';
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${fmtDate(d)}, ${hh}:${mm}`;
}

/**
 * Formats a numeric amount as a compact Euro value, e.g. "€48k", "€18.4M".
 * Returns an empty string when the input is null/undefined/NaN.
 */
export function fmtEuro(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  const round = (n: number): string => {
    const s = n.toFixed(1);
    return s.endsWith('.0') ? s.slice(0, -2) : s;
  };
  if (abs >= 1_000_000_000) return `${sign}€${round(abs / 1_000_000_000)}B`;
  if (abs >= 1_000_000) return `${sign}€${round(abs / 1_000_000)}M`;
  if (abs >= 1_000) return `${sign}€${Math.round(abs / 1_000)}k`;
  return `${sign}€${Math.round(abs)}`;
}

/** Joins a code and human-readable name with an em dash, e.g. "G3 — Design Freeze". */
function joinCodeName(code: string | null | undefined, name: string | null | undefined): string {
  const c = (code ?? '').trim();
  const n = (name ?? '').trim();
  if (c && n) return `${c} — ${n}`;
  return c || n || '';
}

/**
 * Formats a gate code and name, e.g. "G3 — Design Freeze".
 * Falls back to whichever value is present, or an empty string when both are empty.
 */
export function fmtGate(code: string | null | undefined, name?: string | null | undefined): string {
  /* The gate label is resolved rather than passed through, so a C3 environment
     still serving the device-era ladder ("Submission Commit", "Clearance / CE
     Certificate") renders the pharma gate names everywhere at once. */
  return joinCodeName(code, gateName(code, name));
}

/**
 * Formats a phase code and name, e.g. "P2 — Development".
 * Falls back to whichever value is present, or an empty string when both are empty.
 */
export function fmtPhase(code: string | null | undefined, name?: string | null | undefined): string {
  return joinCodeName(code, name);
}
