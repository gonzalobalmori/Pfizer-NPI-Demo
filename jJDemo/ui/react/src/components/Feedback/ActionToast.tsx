/*
 * Transient confirmation toast (.toast / .tck / .ttx from the prototype CSS).
 *
 * Exists because an approved decision used to give NO visible acknowledgement:
 * Decision#approve ran its whole cascade server-side, the workspace reloaded, and
 * the only on-screen change was the Approve button going grey (canApprove flips
 * false once approvedAt is set). Users read that as "nothing happened" and
 * clicked again — which the service-layer guard then rejected ("Approve runs
 * once"), making a SUCCESSFUL action look like a broken one.
 *
 * Rendered only while `open` so it never sits in the DOM as a stale artefact;
 * the `.on` class drives the slide-up transition. role="status" +
 * aria-live="polite" so assistive tech announces the confirmation rather than
 * leaving the outcome purely visual.
 */

import React, { useEffect } from 'react';
import Glyph from '@/components/Brand/Glyph';

export interface ActionToastProps {
  /** Whether the toast is visible. */
  open: boolean;
  /** Headline — what just happened, e.g. "Option A approved". */
  title: string;
  /** Optional second line — the consequence, e.g. tasks dispatched. */
  detail?: string | null;
  /** Fired after `duration` ms so the parent can clear its state. */
  onDismiss: () => void;
  /** How long to stay up, in ms. Defaults to 6000. */
  duration?: number;
}

export default function ActionToast({
  open,
  title,
  detail,
  onDismiss,
  duration = 6000,
}: ActionToastProps) {
  /* Auto-dismiss. The timer is re-armed whenever the message changes so two
     approvals in a row each get a full display window rather than the second
     inheriting the remainder of the first. */
  useEffect(() => {
    if (!open) return undefined;
    const t = window.setTimeout(onDismiss, duration);
    return () => window.clearTimeout(t);
  }, [open, title, detail, duration, onDismiss]);

  if (!open) return null;

  return (
    <div className="toast on" role="status" aria-live="polite">
      <span className="tck"><Glyph name="check" /></span>
      <span className="ttx">
        <b>{title}</b>
        {detail ? <i>{detail}</i> : null}
      </span>
    </div>
  );
}
