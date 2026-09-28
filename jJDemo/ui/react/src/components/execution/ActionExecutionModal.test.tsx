/*
 * The execution sheet — the three things it must get right:
 *
 *   - the write it is about to make is always visible, in every mode, so nobody
 *     confirms a write without seeing which system it lands in
 *   - assign cannot be confirmed until a colleague is actually chosen
 *   - the colleague search matches on name, role AND initials, because people
 *     look each other up by all three
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ActionExecutionModal from './ActionExecutionModal';
import type { Assignee, ExecTarget } from './ActionExecutionModal';

const target: ExecTarget = {
  taskId: 'seed_task_417_a_1',
  name: 'Book the 29 Sep fill slot at Siegfried and issue the capacity PO',
  owner: 'Sourcing agent',
  detail: 'Sourcing agent · within guardrails · reversible for 24h',
  system: 'SAP Ariba',
  writeBack: 'Convert requisition to purchase order (capacity PO)',
};

const people: Assignee[] = [
  { id: 'p1', name: 'A. Kowalski', initials: 'AK', role: 'Quality Lead' },
  { id: 'p2', name: 'M. Okafor', initials: 'MO', role: 'Sourcing Lead' },
  { id: 'p3', name: 'S. Lindqvist', initials: 'SL', role: 'Regulatory Affairs' },
];

function setup(mode: 'agent' | 'self' | 'assign') {
  const onConfirm = jest.fn();
  const onClose = jest.fn();
  render(
    <ActionExecutionModal
      mode={mode}
      target={target}
      people={people}
      onClose={onClose}
      onConfirm={onConfirm}
    />,
  );
  return { onConfirm, onClose };
}

describe('the write is always stated', () => {
  /* getAllByText, not getByText: agent and self modes state the system twice
     on purpose — once in the summary grid and again in the guardrail or
     confirmation copy. Asserting a single occurrence would fail on the modes
     that are most explicit. */
  it.each(['agent', 'self', 'assign'] as const)('names the system and transaction in %s mode', (mode) => {
    setup(mode);
    expect(screen.getAllByText('SAP Ariba').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Convert requisition to purchase order/).length).toBeGreaterThan(0);
  });

  it('shows the reference the system will return', () => {
    setup('self');
    expect(screen.getByText(/^PO 45001/)).toBeInTheDocument();
  });
});

describe('agent mode', () => {
  it('states the guardrail as a boundary, not a reassurance', () => {
    setup('agent');
    expect(screen.getByText(/may write/)).toBeInTheDocument();
    expect(screen.getByText(/and\s*nothing else/)).toBeInTheDocument();
  });

  it('confirms immediately — there is nothing to choose', () => {
    const { onConfirm } = setup('agent');
    fireEvent.click(screen.getByRole('button', { name: 'Dispatch and write' }));
    expect(onConfirm).toHaveBeenCalledWith('agent', undefined, undefined);
  });
});

describe('self mode', () => {
  it('passes the note through to the record', () => {
    const { onConfirm } = setup('self');
    fireEvent.change(screen.getByPlaceholderText(/Why you executed this yourself/), {
      target: { value: 'Agent queue backed up' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Execute the write' }));
    expect(onConfirm).toHaveBeenCalledWith('self', undefined, 'Agent queue backed up');
  });
});

describe('assign mode', () => {
  it('cannot be confirmed until someone is chosen', () => {
    const { onConfirm } = setup('assign');
    const btn = screen.getByRole('button', { name: 'Assign' });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('enables and returns the chosen colleague', () => {
    const { onConfirm } = setup('assign');
    fireEvent.click(screen.getByText('M. Okafor'));
    const btn = screen.getByRole('button', { name: 'Assign' });
    expect(btn).toBeEnabled();
    fireEvent.click(btn);
    expect(onConfirm).toHaveBeenCalledWith('assign', expect.objectContaining({ name: 'M. Okafor' }), undefined);
  });

  it('searches by name', () => {
    setup('assign');
    fireEvent.change(screen.getByLabelText('Search colleagues'), { target: { value: 'kowal' } });
    expect(screen.getByText('A. Kowalski')).toBeInTheDocument();
    expect(screen.queryByText('M. Okafor')).not.toBeInTheDocument();
  });

  it('searches by role', () => {
    setup('assign');
    fireEvent.change(screen.getByLabelText('Search colleagues'), { target: { value: 'regulatory' } });
    expect(screen.getByText('S. Lindqvist')).toBeInTheDocument();
    expect(screen.queryByText('A. Kowalski')).not.toBeInTheDocument();
  });

  it('searches by initials', () => {
    setup('assign');
    fireEvent.change(screen.getByLabelText('Search colleagues'), { target: { value: 'MO' } });
    expect(screen.getByText('M. Okafor')).toBeInTheDocument();
    expect(screen.queryByText('S. Lindqvist')).not.toBeInTheDocument();
  });

  it('says so when nothing matches, rather than showing an empty box', () => {
    setup('assign');
    fireEvent.change(screen.getByLabelText('Search colleagues'), { target: { value: 'zzzz' } });
    expect(screen.getByText(/No colleague matches/)).toBeInTheDocument();
  });

  it('is explicit that assigning does not execute the write', () => {
    setup('assign');
    expect(screen.getByText(/does not execute the write/)).toBeInTheDocument();
  });
});

describe('dismissal', () => {
  it('closes on Escape', () => {
    const { onClose } = setup('agent');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Cancel', () => {
    const { onClose } = setup('self');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });
});
