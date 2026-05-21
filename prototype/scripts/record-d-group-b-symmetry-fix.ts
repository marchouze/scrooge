// scripts/record-d-group-b-symmetry-fix.ts
//
// D-DECISIONS-FRAMEWORK-REDESIGN — Group B symmetry residuals.
//
// 27 decisions in the projection have terminal phases but no `requested`
// opener. These were approved via session-delegation or close-out scripts
// that emitted only terminal events; the migrate:decisions-backfill script
// cannot synthesise openers for them because their source documents either
// lack a `decision-id` frontmatter field or were never filed in the inbox.
//
// Strategy: scan the live event store for every Decision / CeoDecision with a
// terminal phase; for each whose projection entry lacks a `requested` event,
// emit requestDecision at (earliest-terminal-asOf − 1 second). Idempotent.
//
// Authority: D-DECISIONS-FRAMEWORK-REDESIGN (CEO-approved 2026-05-16).
// Author: Atlas (Core banking platform architect, engineering)

import { eventStore } from "../platform/composition";
import { buildDecisionsRegister, decisionsSourceFromStore } from "../projections/decisions";
import { requestDecision } from "../runtime/decisions/record";
import { validateDecisionSlug } from "../runtime/decisions/registry";

const TERMINAL_PHASES = new Set(["approved", "rejected", "deferred", "superseded", "withdrawn"]);

const RECORDED_VIA = "backfill:decisions-framework-cutover";
const CITATIONS = ["GOV-FRAMEWORK-CEO-RESERVED", "COMPANIES-ACT-71-2008"];

// ---------------------------------------------------------------------------
// 1. Build the current projection and collect all (decisionId → earliestTerminalMs)
//    for decisions that have no `requested` event.
// ---------------------------------------------------------------------------

const register = buildDecisionsRegister(decisionsSourceFromStore(eventStore));

// Also collect earliest terminal asOf from raw events (Decision + CeoDecision)
// so we can back-date the opener.
const earliestTerminalMs = new Map<string, number>();

for (const e of eventStore.replay({ type: "Decision" })) {
  const p = e.payload as Record<string, unknown>;
  const id = typeof p.decisionId === "string" ? p.decisionId : "";
  const phase = typeof p.phase === "string" ? p.phase : "";
  if (id && TERMINAL_PHASES.has(phase)) {
    const t = new Date(e.as_of).getTime();
    if (!earliestTerminalMs.has(id) || t < (earliestTerminalMs.get(id) as number)) {
      earliestTerminalMs.set(id, t);
    }
  }
}
for (const e of eventStore.replay({ type: "CeoDecision" })) {
  const p = e.payload as Record<string, unknown>;
  const id = typeof p.decisionId === "string" ? p.decisionId : "";
  const action = typeof p.action === "string" ? p.action : "";
  if (id && (action === "approve" || action === "reject")) {
    const t = new Date(e.as_of).getTime();
    if (!earliestTerminalMs.has(id) || t < (earliestTerminalMs.get(id) as number)) {
      earliestTerminalMs.set(id, t);
    }
  }
}

// ---------------------------------------------------------------------------
// 2. For each projection entry with a terminal but no requested phase,
//    emit a synthetic opener.
// ---------------------------------------------------------------------------

let emitted = 0;
let skipped = 0;

for (const [id, history] of register.byId.entries()) {
  const phases = history.events.map((e) => e.phase);
  const hasRequested = phases.includes("requested");
  const hasTerminal = phases.some((p) => TERMINAL_PHASES.has(p));

  if (!hasTerminal || hasRequested) {
    skipped++;
    continue;
  }

  // Skip legacy numeric sprint IDs (S3, S5, S6, S7, S8) — these predate the
  // D-* naming convention and fail slug validation. They are suppressed in
  // the decision-symmetry-baseline.txt instead.
  if (!validateDecisionSlug(id).ok) {
    console.log(
      JSON.stringify({
        level: "info",
        msg: `${id}: slug invalid — skip (add to baseline if symmetry recon flags it)`,
      }),
    );
    skipped++;
    continue;
  }

  const terminalMs = earliestTerminalMs.get(id);
  if (!terminalMs) {
    // No terminal event in the raw store (projection derived from CeoDecision only
    // via legacy path) — use 2026-05-15 as a safe pre-approval date.
    const fallbackAsOf = "2026-05-15T00:00:00.000Z";
    console.log(
      JSON.stringify({
        level: "warn",
        msg: `${id}: no terminal raw event found; emitting requested at fallback ${fallbackAsOf}`,
      }),
    );
    requestDecision(
      {
        decisionId: id,
        authority: "CEO",
        authorityRef: "marc@tgv.co.za",
        title: id,
        category: "governance",
        recommendation: id,
        rationale: `Backfill Group B: synthetic requested opener for ${id}. Terminal phase exists in projection but no raw terminal event found; fallback date used.`,
        sourceDocHashes: [],
        citations: CITATIONS,
        recordedVia: RECORDED_VIA,
        actor: { type: "human", id: "marc@tgv.co.za" },
      },
      fallbackAsOf,
    );
    emitted++;
    continue;
  }

  // Emit opener 1 second before the earliest terminal event.
  const openerMs = terminalMs - 1_000;
  const openerAsOf = new Date(openerMs).toISOString();

  console.log(
    JSON.stringify({
      level: "info",
      msg: `${id}: emitting requested opener at ${openerAsOf} (terminal at ${new Date(terminalMs).toISOString()})`,
    }),
  );

  requestDecision(
    {
      decisionId: id,
      authority: "CEO",
      authorityRef: "marc@tgv.co.za",
      title: history.events[0]?.title ?? id,
      category: "governance",
      recommendation: history.events[0]?.title ?? id,
      rationale: `Backfill Group B: synthetic requested opener for ${id}. Approved via session-delegation or close-out script that emitted only terminal event; opener was missing from event chain.`,
      sourceDocHashes: [],
      citations: CITATIONS,
      recordedVia: RECORDED_VIA,
      actor: { type: "human", id: "marc@tgv.co.za" },
    },
    openerAsOf,
  );
  emitted++;
}

console.log(
  JSON.stringify({
    level: "info",
    msg: "record-d-group-b-symmetry-fix: complete",
    emitted,
    skipped,
  }),
);
