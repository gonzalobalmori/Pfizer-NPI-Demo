# NPI Launch Control — 10-minute quality-disruption script

**Spoken script for a live demo, first person as George Hall, NPI Senior Manager.**
Same shape as the existing NPI speech: persona, the old world, the ambition, the
walkthrough, and a close on the reason to believe. Roughly 1,400 spoken words —
about ten minutes at a demo pace with clicks.

All figures below are the ones actually in the demo. If the environment is
re-seeded they stay true; if a number on screen differs from a number here, the
screen wins — say the number you can see.

---

## Before you start

**On the slides behind you:** the persona profile · the current situation
(manual chasing, many systems, low-value work eating the week) · the ambition
(one orchestrated launch process, agents and humans together, decisions that
write back into the systems of record).

**Have open:** the app on **Cockpit**, and the **Quality disruption** tab
already loaded in a second tab so you are never waiting on a fetch.

**Say once, early:** *"All the data here is illustrative — this environment was
built for today."*

**Reset before presenting:** run the demo reset so the quality event is back at
stage `RAISED` and the batches are back on `HOLD` / `PENDING`. If you have
already clicked through once, the scope is already determined and the story
loses its first beat.

**The one line to land:** *this is not a dashboard that tells me to go and fix
something somewhere else — approving the decision writes back into SAP, Veeva
and Planisware.*

---

## 0:00 — Who I am, and what my week used to look like

Hi everyone — I'm George. I sit in the global team that takes a new medicine
from "approved to launch" to "first batch on a hospital shelf."

Nine phases, from launch strategy through to post-launch monitoring. Drug
substance, drug product, finished product, market enablement. Quality,
Regulatory, Supply Chain, the sites, Commercial, our external partners.

And here is the honest version of my old week. Most of it was not judgement. It
was chasing. Pinging a colleague at Puurs for a batch status. Asking Regulatory
whether a dossier section had moved. Rebuilding a spreadsheet because three
teams each had their own plan and none of them agreed. Then sitting in three
forums to reconcile what we had all just spent the week collecting.

By the time that reconciliation surfaced a problem, the problem was usually
already three weeks old. I was not preventing delays. I was reporting them.

## 1:15 — What changed

What you will see now is that work reinvented. Agents capture the data, reconcile
it, quantify it, and put a decision in front of me with the options already
costed. I stay in the lead on the decision — but I arrive at it informed, on
time, and with everyone looking at the same numbers.

And when I decide, the decision does not become an email. It becomes a write
into the system that owns the data. That is the part I would ask you to watch
for.

## 2:00 — Monday morning

*[Cockpit]*

It's Monday. One screen, every live launch, worst first. This is not my view of
the portfolio — it is the same view Quality, Regulatory and Supply Chain are
looking at, which is the first thing that changed.

And there's a new one at the top. **Sasanlimab** — our anti-PD-1 antibody, in
market-enablement phase. Quality event.

*[Open Quality disruption]*

## 2:45 — What happened

**DEV-26-0881.** Raised at Puurs on the 9th of September by Anna Kowalski in
site Quality — not by a global function, by the site that found it.

Routine 100% visual inspection on batch **SAS-26-0431** found stopper flange
lift with partial seal displacement. **1,640 parts per million, against a
500 ppm action limit.** That is more than three times the limit. Traced to a
West Pharmaceutical stopper lot, **WPS-26-4471**.

In the old world, this is the moment my week disappears. Which batches used that
stopper lot? Which markets were they promised to? Has any of it already shipped?
Four teams, two days, and a spreadsheet.

## 3:30 — Step one: how big is this really

*[Determine scope]*

One click. The agent sweeps every batch filled from that suspect component lot.

**Five batches touched that lot.** Four are unreleased — that is
**612,000 doses** now on hold. And the fifth, **SAS-26-0407**, 96,000 doses,
was **already released to market on the 14th of August.**

That last line is the one that matters. Because a released batch from a suspect
lot is no longer a hold — it is a **recall assessment**, and the system has
flagged it as such without me having to know to ask the question.

Two other batches, 0396 and 0405, came off a different stopper lot. They are
clean. They stay clean. Nobody has to defend them in a meeting.

Notice also what this event is *not* limited to. That stopper is single-source
from Aptar, and it is on the frozen bill of materials for **four** of our
injectable programmes. So the tower is already showing me this is not a
Sasanlimab problem — it is a shared-component problem with a blast radius.

## 4:45 — Step two: what can we actually do

*[Evaluate options]*

Four options, scored against real component, capacity and expiry data — doses
served, days of delay, incremental cost, revenue protected, markets kept whole.

And look at the first one. **Rework — de-stopper and re-stopper the held
batches.** It is **ruled out**, and it tells me why: this is a **lyophilised**
product. You cannot unseal a lyophilised vial and re-stopper it without
breaching the sterile boundary. The system is not ranking that option last and
hoping I notice. It is refusing it, on the science, with the reason written
down.

That is the difference between a tool that sorts a list and a tool that knows
the process.

What's left is real. **Reject and refill** — phased re-manufacture. **Alternate
approved closure** — our second-source stopper, if it's qualified and the lead
time beats the clock. **Partial release** — 100% re-inspection, release what
conforms, reject the rest.

## 6:15 — Step three: who gets supply

*[Protect priority markets]*

Here is the question I actually get asked in the forum: *which market loses
units?*

The tower walks the market commitments in priority order and allocates what the
option makes available — and tells me which markets are served whole, which are
constrained, and which are deferred. Before I commit to anything.

I can preview this. I can change the option and preview it again. I am having
the supply-allocation conversation with numbers instead of opinions.

## 7:15 — Step four: the decision stays mine

*[Decide]*

Now — I decide. Not the agent.

And when I sign, it is a governed Quality decision with a **21 CFR Part 11
electronic signature**. Who decided, what they chose, what they were shown at
the time, and why. That is not a log file I have to reconstruct for an inspector
eighteen months from now. It is the record, captured at the moment of the
decision.

If this one were above my delegated authority — or if it needed Commercial in
the room — I would escalate it instead, and the agenda, the pre-read and the
options go with it. Consistently, every time, in every market.

## 8:15 — Step five: the part that is genuinely new

*[Coordinate — Action plan]*

This is the bit I would ask you to really look at.

The response comes out as owned, dated work. Some of it agents run inside
guardrails; some of it I run myself — both paths are on every row.

But read the second line on each action. **Every one of them names the system it
writes into.**

Quarantine the affected batches — that is a **QM inspection block in SAP ECC**.
Move to 100% dimensional check on the alternate line — that is an **inspection
plan update in the MES**. Re-weight the market allocation — **SAP IBP**. Hold the
gate and cascade the shortfall — **Planisware**. The protocol and the
disposition — **Veeva Vault QMS**. The authority notification — **Veeva Vault
RIM**.

Same systems this tower reads from. The loop closes.

So when I approve, nobody gets an email asking them to go and type this into SAP
on Tuesday. The write happens, in the system of record, with the signature
attached — and the next time this tower reads that feed, it reads back its own
decision.

That is the shift. From a reporting layer that tells people to act, to an
orchestration layer that acts.

## 9:15 — Why I'd adopt this

So what's my reason to believe?

It isn't the visuals. It's three things.

**I found this on Monday morning, not in a Thursday forum.** The signal came to
me, quantified, with the released batch already flagged for recall assessment.

**The option that could not work was refused, with the reason.** I did not have
to be the person in the room who remembered that you cannot re-stopper a
lyophilised vial.

**And the decision landed in the systems that own the data** — signed, audited,
and cascaded — instead of becoming six handoffs and a follow-up meeting.

The process was always supposed to be orchestrated. It just wasn't, because
orchestrating it manually cost more than the delays did. That is what changes
here.

---

## If you get asked

- **"Is the data real?"** No — it is synthetic, built for this session. The
  shape of the process, the gate ladder and the source systems are real.
- **"Can the agent decide on its own?"** No. Agents run the actions inside
  guardrails; the gate and Quality decisions are signed by a person. That is
  deliberate, and it is why there is an electronic signature on the decision.
- **"What if the write to SAP fails?"** The action carries its own status —
  it is not marked done until the write is confirmed, and the decision record
  keeps the audit trail either way.
- **"Where did the +47 days on the other launch come from?"** Different
  scenario — a cancelled fill-finish slot on Berobenatide. Trace it in the
  lineage view if they want to see the data provenance story too.
- **"Why is one option greyed out?"** Because it is infeasible on the science,
  and the tower says so rather than hiding it. That usually lands well — offer
  to click into the reason.
