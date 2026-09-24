# EodLogService — conversational End-of-Day capture that becomes real Findings.
#
# LLM extraction runs on the platform completion client when one is provisioned
# and falls back to a deterministic keyword extractor otherwise, so the
# capture -> review -> commit circuit works even in the offline sandbox. Nothing
# is persisted until the owner approves: only commitSignals() writes.

import json as _json
import re as _re

# Kinds we classify a captured sentence into, and how each maps to a Finding
# category (ct = blocking a gate, rk = eats float, ok = monitored).
_KIND_CATEGORY = {
    "blocker": "ct",
    "delay": "rk",
    "risk": "rk",
    "decision": "ok",
    "evidence": "ok",
    "status": "ok",
}

# Keyword cues for the deterministic fallback classifier. Order matters: the
# first kind whose cues match wins, most-severe first. Bilingual (EN/ES) because
# the owners logging here work in both.
_KIND_CUES = [
    ("blocker", ["block", "blocked", "blocker", "cannot", "can't", "cant", "stopped",
                 "stop ", "down", "cancel", "cancelled", "canceled", "slot", "no confirma",
                 "sin confirmar", "bloque", "parad", "cae", "cayó", "cayo", "se cayó"]),
    ("delay", ["delay", "delayed", "late", "slip", "slipped", "push", "pushed", "behind",
               "won't be ready", "wont be ready", "not ready", "retras", "tarde",
               "jueves", "no llega", "se retrasa"]),
    ("risk", ["risk", "risky", "concern", "concerned", "issue", "problem", "at risk",
              "exposure", "riesgo", "problema", "preocupa", "incidencia"]),
    ("decision", ["decide", "decision", "decisión", "decision needed", "need to decide",
                  "approve", "approval", "sign-off needed", "hay que decidir"]),
    ("evidence", ["uploaded", "upload", "report", "completed", "complete", "signed off",
                  "signed-off", "evidence", "passed", "closed out", "done", "finished",
                  "subido", "informe", "completad", "firmad", "cerrado", "hecho"]),
    ("status", ["moved", "now in", "changed", "updated", "advanced", "progress",
                "on track", "avanz", "cambi", "actualiz", "en curso"]),
]


# ── shared helpers ──────────────────────────────────────────────────────────

def _iso(dt):
    return str(dt) if dt is not None else None


def _domain_agent_map():
    """domainCode -> {code,name,agentId,agentName}."""
    out = {}
    res = c3.FunctionalDomain.fetch({
        "include": "code, name, agent.id, agent.name",
        "limit": -1,
    })
    for d in res.objs:
        out[d.code] = {
            "code": d.code,
            "name": d.name,
            "agentId": d.agent.id if d.agent else None,
            "agentName": d.agent.name if d.agent else None,
        }
    return out


def _launch_lookup():
    """List of launches with the tokens we match free text against."""
    res = c3.Launch.fetch({
        "include": "id, deviceName, shortName, currentPhase.id, currentPhase.code, "
                   "franchise.name, healthStatus",
        "limit": -1,
    })
    launches = []
    for l in res.objs:
        tokens = set()
        for src in [l.shortName, l.deviceName]:
            if not src:
                continue
            for tok in _re.split(r"[\s/]+", src.lower()):
                if len(tok) >= 3:
                    tokens.add(tok)
        launches.append({
            "id": l.id,
            "deviceName": l.deviceName,
            "shortName": l.shortName,
            "phaseId": l.currentPhase.id if l.currentPhase else None,
            "phaseCode": l.currentPhase.code if l.currentPhase else None,
            "franchise": l.franchise.name if l.franchise else None,
            "health": l.healthStatus,
            "tokens": tokens,
        })
    return launches


def _match_launch(text, launches, default_id=None):
    """Best-effort: match a launch by name token appearing in the text."""
    if not text:
        return default_id
    low = text.lower()
    for l in launches:
        for tok in l["tokens"]:
            if tok in low:
                return l["id"]
    return default_id


# ── domains() ───────────────────────────────────────────────────────────────

def domains(cls):
    dm = _domain_agent_map()
    rows = sorted(dm.values(), key=lambda r: r["name"])
    rows.insert(0, {
        "code": "all",
        "name": "All domains (cross-functional)",
        "agentId": "seed_agent_orc",
        "agentName": "Orchestrator",
    })
    return {"domains": rows}


# ── guidedPrompts(domain) ─────────────────────────────────────────────────────

def guidedPrompts(cls, domain=None):
    """Build targeted questions from the domain's live open gates + findings."""
    prompts = []

    # Slipping / not-yet-closed gates → "any change today?"
    gates = c3.Gate.fetch({
        "filter": "status != 'ok' && slipDays > 0",
        "include": "code, name, slipDays, forecastDate, status, "
                   "launch.id, launch.shortName, launch.deviceName, launch.currentPhase.id",
        "limit": -1,
    })
    seen = set()
    for g in gates.objs:
        if not g.launch:
            continue
        name = g.launch.shortName or g.launch.deviceName
        key = (g.launch.id, g.code)
        if key in seen:
            continue
        seen.add(key)
        prompts.append({
            "promptId": "gate_%s_%s" % (g.launch.id, g.code),
            "question": "%s %s on %s is +%dd late — any change today?" % (
                g.code, g.name, name, g.slipDays or 0),
            "hint": "Slot confirmed, recovery booked, still stuck, or worse?",
            "launchId": g.launch.id,
            "phaseId": g.launch.currentPhase.id if g.launch.currentPhase else None,
            "source": "gate",
        })

    # Open findings still waiting → "still open? anything move?"
    findings = c3.Finding.fetch({
        "filter": "outcome == 'USER' || outcome == 'RUNNING' || outcome == 'HELD'",
        "include": "displayId, headline, outcome, "
                   "launch.id, launch.shortName, launch.deviceName, phase.id, "
                   "detectedBy.domain.code",
        "limit": -1,
    })
    for f in findings.objs:
        dcode = None
        if f.detectedBy and f.detectedBy.domain:
            dcode = f.detectedBy.domain.code
        # In a specific-domain log, only surface that domain's findings.
        if domain and domain != "all" and dcode and dcode != domain:
            continue
        name = (f.launch.shortName or f.launch.deviceName) if f.launch else "the programme"
        prompts.append({
            "promptId": "finding_%s" % f.displayId,
            "question": "%s (%s) is still open on %s — any update, or is it resolved?" % (
                f.displayId, f.headline or "open signal", name),
            "hint": "New information, a workaround, or ready to close?",
            "launchId": f.launch.id if f.launch else None,
            "phaseId": f.phase.id if f.phase else None,
            "source": "finding",
        })

    # Always end with an open catch-all so nothing is lost.
    prompts.append({
        "promptId": "catchall",
        "question": "Anything else that happened today the tower should know about?",
        "hint": "New risks, delays, blockers, decisions or evidence.",
        "launchId": None,
        "phaseId": None,
        "source": "open",
    })
    return {"domain": domain or "all", "prompts": prompts}


# ── extraction ────────────────────────────────────────────────────────────────

def _classify_kind(text):
    low = text.lower()
    for kind, cues in _KIND_CUES:
        for c in cues:
            if c in low:
                return kind
    return "risk"


def _split_sentences(text):
    if not text:
        return []
    parts = _re.split(r"(?<=[.!?;\n])\s+|\n+", text.strip())
    return [p.strip() for p in parts if p and len(p.strip()) >= 4]


def _headline_from(text):
    t = text.strip()
    t = t[0].upper() + t[1:] if t else t
    if len(t) > 80:
        t = t[:77].rstrip() + "…"
    if t and t[-1] not in ".!?":
        pass
    return t


def _fallback_extract(domain, snippets, launches, default_launch):
    drafts = []
    for sn in snippets:
        text = sn["text"]
        kind = _classify_kind(text)
        lid = sn.get("launchId") or _match_launch(text, launches, default_launch)
        phase_id = sn.get("phaseId")
        if not phase_id and lid:
            for l in launches:
                if l["id"] == lid:
                    phase_id = l["phaseId"]
                    break
        # confidence: higher when we matched a launch and a strong kind cue.
        conf = 0.55
        if lid:
            conf += 0.2
        if kind in ("blocker", "delay", "evidence"):
            conf += 0.1
        drafts.append({
            "kind": kind,
            "category": _KIND_CATEGORY.get(kind, "rk"),
            "headline": _headline_from(text),
            "description": text.strip(),
            "launchId": lid,
            "phaseId": phase_id,
            "confidence": round(min(conf, 0.95), 2),
            "source": sn.get("source", "free"),
            "engine": "deterministic",
            "needsReview": conf < 0.7 or lid is None,
        })
    return drafts


def _llm_extract(domain, snippets, launches):
    """Try the platform LLM. Returns drafts list or None if unavailable."""
    try:
        client = None
        for key in ["gpt_4o", "gemini_2.5_pro", "default-completions", "gemini_2.0_flash"]:
            try:
                cand = c3.GenaiCore.Llm.Completion.Client.forConfigKey(key)
                if cand is not None:
                    client = cand
                    break
            except Exception:
                continue
        if client is None:
            return None

        launch_list = "\n".join(
            "- %s: %s (%s)" % (l["id"], l["deviceName"], l.get("franchise") or "")
            for l in launches
        )
        joined = "\n".join("%d. %s" % (i + 1, s["text"]) for i, s in enumerate(snippets))
        system = (
            "You structure an end-of-day operations log for a MedTech new-product "
            "launch programme into discrete signals. For EACH distinct signal, "
            "output an object with: kind (one of risk, delay, blocker, decision, "
            "evidence, status), headline (<=80 chars), description, launchId (the "
            "best-matching id from the list, or null), category (ct if it blocks a "
            "gate, rk if it eats schedule float, ok if merely monitored), and "
            "confidence (0-1). Do not invent risks that are not in the text. Never "
            "attribute a failure to an already-marketed device. Return ONLY a JSON "
            "object: {\"signals\": [ ... ]}."
        )
        user = "Launches:\n%s\n\nDomain: %s\n\nLog entries:\n%s" % (
            launch_list, domain or "all", joined)
        resp = client.completion(
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            options={"returnJson": True, "max_tokens": 2048, "temperature": 0},
        )
        content = resp["choices"][0]["message"]["content"]
        if isinstance(content, str):
            m = _re.search(r"\{.*\}", content, _re.DOTALL)
            content = _json.loads(m.group(0) if m else content)
        signals = content.get("signals", []) if isinstance(content, dict) else []
        valid_ids = {l["id"] for l in launches}
        drafts = []
        for s in signals:
            kind = (s.get("kind") or "risk").lower()
            lid = s.get("launchId")
            if lid not in valid_ids:
                lid = None
            phase_id = None
            if lid:
                for l in launches:
                    if l["id"] == lid:
                        phase_id = l["phaseId"]
                        break
            conf = float(s.get("confidence", 0.6) or 0.6)
            drafts.append({
                "kind": kind,
                "category": s.get("category") or _KIND_CATEGORY.get(kind, "rk"),
                "headline": _headline_from(s.get("headline") or s.get("description") or ""),
                "description": s.get("description") or s.get("headline") or "",
                "launchId": lid,
                "phaseId": phase_id,
                "confidence": round(min(max(conf, 0.0), 1.0), 2),
                "source": "llm",
                "engine": "llm",
                "needsReview": conf < 0.7 or lid is None,
            })
        return drafts if drafts else None
    except Exception:
        return None


def extractSignals(cls, domain=None, freeText=None, answers=None):
    launches = _launch_lookup()

    # default launch for a domain-scoped log: the domain's worst open finding's
    # launch, so an un-attributable line still lands somewhere sensible.
    default_launch = None
    if domain and domain != "all":
        fres = c3.Finding.fetch({
            "filter": "detectedBy.domain.code == '%s'" % domain,
            "include": "launch.id, category",
            "limit": -1,
        })
        for f in fres.objs:
            if f.launch:
                default_launch = f.launch.id
                if f.category == "ct":
                    break

    # Build snippets from both modes.
    snippets = []
    for s in _split_sentences(freeText or ""):
        snippets.append({"text": s, "source": "free"})

    ans = answers
    if isinstance(ans, str):
        try:
            ans = _json.loads(ans)
        except Exception:
            ans = []
    if ans:
        for a in ans:
            txt = (a.get("answer") or "").strip()
            if not txt or len(txt) < 3:
                continue
            # skip non-answers
            if txt.lower() in ("no", "n/a", "na", "nada", "none", "no change", "sin cambios"):
                continue
            snippets.append({
                "text": txt,
                "source": "guided",
                "launchId": a.get("launchId"),
                "phaseId": a.get("phaseId"),
                "question": a.get("question"),
            })

    if not snippets:
        return {"drafts": [], "engine": "none",
                "note": "Nothing to extract — the log was empty."}

    drafts = _llm_extract(domain, snippets, launches)
    engine = "llm"
    if drafts is None:
        drafts = _fallback_extract(domain, snippets, launches, default_launch)
        engine = "deterministic"

    # stamp launch display names onto drafts for the review UI
    by_id = {l["id"]: l for l in launches}
    for d in drafts:
        l = by_id.get(d.get("launchId"))
        d["launchName"] = (l["shortName"] or l["deviceName"]) if l else None

    return {"domain": domain or "all", "engine": engine,
            "count": len(drafts), "drafts": drafts}


# ── commitSignals(approvedDrafts) — the only writer ──────────────────────────

def _next_npi_seq():
    res = c3.Finding.fetch({"include": "displayId", "limit": -1})
    mx = 0
    for f in res.objs:
        if f.displayId:
            m = _re.search(r"(\d+)", f.displayId)
            if m:
                mx = max(mx, int(m.group(1)))
    return mx


def commitSignals(cls, approvedDrafts=None):
    drafts = approvedDrafts
    if isinstance(drafts, str):
        try:
            drafts = _json.loads(drafts)
        except Exception:
            drafts = []
    if not drafts:
        return {"created": [], "count": 0, "note": "No approved drafts to commit."}

    dm = _domain_agent_map()
    now = c3.DateTime.now()
    seq = _next_npi_seq()

    created = []
    to_create = []
    for d in drafts:
        seq += 1
        fid = "eod_finding_%d" % seq
        display = "NPI-%04d" % seq
        domain = d.get("domain") or "all"
        agent_id = dm.get(domain, {}).get("agentId") or "seed_agent_orc"

        obj = {
            "id": fid,
            "displayId": display,
            "detectedAt": now,
            "signalSource": "eod-log",
            "headline": d.get("headline") or "Captured from end-of-day log",
            "description": d.get("description") or d.get("headline") or "",
            "outcome": "RUNNING",
            "category": d.get("category") or "rk",
        }
        if d.get("phaseId"):
            obj["phase"] = {"id": d["phaseId"]}
        if d.get("launchId"):
            obj["launch"] = {"id": d["launchId"]}
        obj["detectedBy"] = {"id": agent_id}
        to_create.append(c3.Finding.make(obj))
        created.append({
            "id": fid, "displayId": display,
            "headline": obj["headline"], "category": obj["category"],
            "launchId": d.get("launchId"), "detectedBy": agent_id,
        })

    if to_create:
        c3.Finding.mergeBatch(objs=to_create)

    return {"created": created, "count": len(created),
            "note": "%d finding(s) captured from the end-of-day log — "
                    "now visible on Open issues and the Agent tower." % len(created)}
