/*
 * Copilot (§2.5) — grounded assistant. Eight suggested prompts in four groups,
 * each with a designed, evidence-backed answer that opens the record behind it.
 * A query outside the launch record gets the designed refusal — verbatim, never
 * softened (§6): "I can only answer from what is in the launch record…".
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Sparkles, ShieldCheck, CheckCircle2, ArrowUpRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { getCopilot } from '@/api/execution';
import type { CopilotData, CopilotPromptVm, CopilotAnswer, CopilotAnswerAction } from '@/types/execution';

interface ChatTurn {
  id: string;
  question: string;
  answer: CopilotAnswer | null; // null → designed refusal
  showsGuardrails: boolean;
}

export default function Copilot() {
  const [data, setData] = useState<CopilotData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [seq, setSeq] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getCopilot());
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Failed to load the copilot.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns]);

  const nextId = () => {
    const id = `t${seq}`;
    setSeq((s) => s + 1);
    return id;
  };

  const askPrompt = (p: CopilotPromptVm) => {
    setTurns((t) => [
      ...t,
      { id: nextId(), question: p.question, answer: p.answer, showsGuardrails: p.showsGuardrails },
    ]);
  };

  const submitFreeText = () => {
    const q = input.trim();
    if (!q || !data) return;
    // Ground only against the known prompts; anything else gets the designed refusal.
    const match = data.prompts.find(
      (p) => p.question.toLowerCase() === q.toLowerCase() || q.toLowerCase().includes(p.id.toLowerCase()),
    );
    setTurns((t) => [
      ...t,
      {
        id: nextId(),
        question: q,
        answer: match ? match.answer : null,
        showsGuardrails: match ? match.showsGuardrails : false,
      },
    ]);
    setInput('');
  };

  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-danger bg-danger-weak p-4 text-danger">{error}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col p-6">
      <header className="mb-4 flex items-center gap-2">
        <Sparkles className="size-5 text-accent" />
        <h1 className="text-xl font-semibold text-primary">Copilot</h1>
      </header>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <Skeleton className="h-64 w-full rounded-lg" />
        ) : data ? (
          <>
            {turns.length === 0 && <Greeting data={data} onAsk={askPrompt} />}
            <div className="flex flex-col gap-4">
              {turns.map((t) => (
                <TurnView key={t.id} turn={t} refusal={data.refusal} />
              ))}
            </div>
            <div ref={endRef} />
          </>
        ) : null}
      </div>

      <form
        className="mt-4 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submitFreeText();
        }}
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about a launch, a gate, a market, a supplier or an agent…"
          className="flex-1"
        />
        <Button type="submit" size="icon" aria-label="Ask">
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}

function Greeting({ data, onAsk }: { data: CopilotData; onAsk: (p: CopilotPromptVm) => void }) {
  return (
    <div>
      <div className="c3-card rounded-lg border border-weak bg-primary p-5">
        <h2 className="text-lg font-semibold text-primary">{data.greeting.title}</h2>
        <p className="mt-1 text-sm text-secondary">{data.greeting.body}</p>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-secondary">
          <ShieldCheck className="size-3.5 text-success" /> {data.greeting.note}
        </p>
      </div>
      <div className="mt-4 flex flex-col gap-4">
        {data.groups.map((g) => (
          <div key={g.label}>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-secondary">{g.label}</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {g.prompts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onAsk(p)}
                  className="c3-card flex flex-col gap-0.5 rounded-lg border border-weak bg-primary p-3 text-left transition-colors hover:border-accent"
                >
                  <span className="text-sm font-medium text-primary">{p.question}</span>
                  {p.subtitle && <span className="text-xs text-secondary">{p.subtitle}</span>}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TurnView({
  turn,
  refusal,
}: {
  turn: ChatTurn;
  refusal: { prose: string; hint: string };
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="self-end rounded-lg rounded-br-sm bg-accent px-3 py-2 text-sm text-primary-foreground">
        {turn.question}
      </div>
      <div className="c3-card self-start rounded-lg rounded-bl-sm border border-weak bg-primary p-4">
        {turn.answer ? (
          <AnswerBody answer={turn.answer} showsGuardrails={turn.showsGuardrails} />
        ) : (
          <div>
            <p className="text-sm text-primary">{refusal.prose}</p>
            <p className="mt-2 text-xs text-secondary">{refusal.hint}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* Urgency flags carried on a copilot step: "r" = blocking/urgent, "a" = advisory. */
function StepFlag({ flag }: { flag: string }) {
  const isUrgent = flag.toLowerCase() === 'r';
  return (
    <span
      className={cn(
        'ml-2 rounded px-1.5 py-0.5 text-[10px] font-medium',
        isUrgent ? 'bg-danger-weak text-danger' : 'bg-warning-weak text-warning',
      )}
    >
      {isUrgent ? 'Urgent' : 'Advisory'}
    </span>
  );
}

function AnswerBody({ answer, showsGuardrails }: { answer: CopilotAnswer; showsGuardrails: boolean }) {
  const navigate = useNavigate();

  const handleAction = (a: CopilotAnswerAction) => {
    const t = a.target ?? '';
    if (t.startsWith('openFinding:')) navigate(`/resolve/${t.split(':')[1]}`);
    else if (t.startsWith('pane:')) navigate('/');
    else if (t.startsWith('board:') || t.startsWith('log:')) navigate('/orchestration');
    else navigate('/');
  };

  return (
    <div className="flex flex-col gap-3 text-sm">
      {answer.prose?.map((p, i) => (
        <p key={`p${i}`} className="text-primary">
          {p}
        </p>
      ))}

      {answer.evidence && answer.evidence.length > 0 && (
        <dl className="grid grid-cols-2 gap-2 rounded-md bg-secondary/50 p-3">
          {answer.evidence.map((e, i) => (
            <div key={`e${i}`}>
              <dt className="text-xs text-secondary">{e.label}</dt>
              <dd className="text-sm font-medium text-primary">{e.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {answer.steps && answer.steps.length > 0 && (
        <ol className="flex flex-col gap-2">
          {answer.steps.map((s, i) => (
            <li key={`s${i}`} className="flex gap-2">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-weak text-[11px] font-medium text-accent">
                {i + 1}
              </span>
              <div>
                <div className="font-medium text-primary">
                  {s.title}
                  {s.flag && <StepFlag flag={s.flag} />}
                </div>
                {s.body && <div className="text-secondary">{s.body}</div>}
                {s.when && <div className="text-xs text-secondary">{s.when}</div>}
              </div>
            </li>
          ))}
        </ol>
      )}

      {answer.prose2?.map((p, i) => (
        <p key={`p2${i}`} className="text-primary">
          {p}
        </p>
      ))}

      {showsGuardrails && (
        <div className="flex items-center gap-1.5 rounded-md border border-success bg-success-weak px-3 py-2 text-xs text-success">
          <ShieldCheck className="size-3.5" /> Every action here stayed inside its guardrails.
        </div>
      )}

      {answer.rec && (
        <div className="rounded-md border border-accent bg-accent-weak p-3">
          <div className="text-sm font-medium text-primary">{answer.rec}</div>
          {answer.why && answer.why.length > 0 && (
            <ul className="mt-1.5 flex flex-col gap-1">
              {answer.why.map((w, i) => (
                <li key={`w${i}`} className="flex items-start gap-1.5 text-xs text-secondary">
                  <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-success" /> {w}
                </li>
              ))}
            </ul>
          )}
          {answer.confidence && <div className="mt-1.5 text-xs text-secondary">Confidence: {answer.confidence}</div>}
        </div>
      )}

      {answer.actions && answer.actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {answer.actions.map((a, i) => (
            <Button
              key={`a${i}`}
              size="sm"
              variant={a.style === 'primary' ? 'default' : 'outline'}
              onClick={() => handleAction(a)}
            >
              {a.label} <ArrowUpRight className="size-3.5" />
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
