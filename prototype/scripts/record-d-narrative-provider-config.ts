// scripts/record-d-narrative-provider-config.ts
//
// Records D-NARRATIVE-PROVIDER-CONFIG — Marc's in-session approval
// (2026-06-22) that the agent NARRATIVE provider is CONFIG-SELECTABLE via
// `BANK_NARRATIVE_PROVIDER`, defaulting to Gemini, with Anthropic (Claude)
// reachable by a config change alone — never a code change.
//
// Scope approved:
//   (1) A provider facade (`runtime/narrative.ts`) exposes
//       `narrativeAvailable()` + `tryGenerateNarrative(...)` with the SAME
//       contract the agents already consume. It selects the backend on
//       `BANK_NARRATIVE_PROVIDER` (default `gemini`; accepts
//       `anthropic`/`claude`), dispatching to `runtime/gemini.ts` or
//       `runtime/claude.ts`. Unknown values fail closed (typed throw).
//   (2) All 25 narrative-emitting agents (Vera's overnight recon, the
//       *-readiness / *-snapshot agents, …) re-point their import to the
//       facade. No call site names a provider; the "Narrative skipped" note
//       is provider-generic (`narrativeSkippedNote`).
//   (3) Default = Gemini, because the `.env.local` ANTHROPIC_API_KEY is
//       currently invalid (401) and the Gemini key is valid (it already
//       drives the regulation-distill path). `BANK_NARRATIVE_PROVIDER=
//       anthropic` flips the whole fleet back to Claude with zero code change.
//       The var is `BANK_*`, so it propagates through the launchd env-block
//       whitelist to the scheduler jobs.
//   (4) Graceful degradation is preserved per provider: a missing/invalid key
//       for the selected provider skips the narrative and the run still
//       completes ok:true.
//
// This mirrors the existing `BANK_DISTILL_PROVIDER` precedent (distill flow,
// dashboard/server.ts), generalised to the agent-narrative surface.
//
// Idempotent on (decisionId, phase, as_of) with a FIXED `asOf` so the
// ci:migrate replay is byte-stable. Scrooge is the recording instrument
// (recordedVia: scrooge:session-delegation); Marc is the authorizing
// principal. Engineering build decision in the build phase → CEO authority,
// `engineering` category (decision-authority-routing table).
//
// Authority: CLAUDE.md §"Session delegation"; D-ENGINEERING-INTEGRITY-CHARTER.
// brief: brief:atlas:config-selectable-agent-narrative-provider-defau:2026-06-22
// Author: Atlas (Core banking platform architect, engineering).
import "../platform/event-store/resolve-event-db-boot";
import { recordDecision, requestDecision } from "../runtime/decisions/record";

// Fixed instants so the ci:migrate replay is byte-stable. The decision-symmetry
// recon gate requires every closed decision to carry a `requested` phase before
// its terminal phase (D-DECISIONS-FRAMEWORK-REDESIGN) — emit both.
const REQUESTED = "2026-06-22T13:58:00.000Z";
const APPROVED = "2026-06-22T14:00:00.000Z";

const base = {
  decisionId: "D-NARRATIVE-PROVIDER-CONFIG",
  authority: "CEO" as const,
  authorityRef: "marc@tgv.co.za",
  title:
    "Agent narrative provider is config-selectable (BANK_NARRATIVE_PROVIDER); default Gemini, Anthropic available via config",
  category: "engineering" as const,
  recommendation:
    'Introduce a provider facade (runtime/narrative.ts) exposing narrativeAvailable() + tryGenerateNarrative(...) with the same contract the agents already consume. Select the backend at call time on BANK_NARRATIVE_PROVIDER (default `gemini`; accept `anthropic`/`claude`), dispatching to runtime/gemini.ts or runtime/claude.ts; unknown values fail closed with a typed throw. Re-point all 25 narrative-emitting agents (Vera\'s overnight recon + the *-readiness/*-snapshot agents) to import from the facade so NO call site names a provider, and generalise the "Narrative skipped" note to whichever provider is selected. Default to Gemini (the .env.local ANTHROPIC_API_KEY is currently invalid/401 and the Gemini key is valid — it already drives the regulation-distill path); BANK_NARRATIVE_PROVIDER=anthropic flips the whole fleet back to Claude with zero code change. Preserve per-provider graceful degradation (missing/invalid key → narrative skipped, run still ok:true). This mirrors the existing BANK_DISTILL_PROVIDER precedent, generalised to the agent-narrative surface.',
  rationale:
    "The per-agent narrative path called the Anthropic SDK unconditionally via runtime/claude.ts, so a provider switch was a code change touching ~25 call sites — and the live ANTHROPIC_API_KEY is invalid (401) while the Gemini key works. Hard-coding a provider at the call site violates Engineering Charter command 4 (source, don't hardcode): the provider is configuration, not code. Centralising selection behind a facade keyed on BANK_NARRATIVE_PROVIDER makes switching providers (back to Anthropic, or to any future provider) a config change, removes the live 401 from the fleet's narrative path by defaulting to the working Gemini key, and keeps degradation semantics identical across providers. The var is BANK_* so it propagates through the launchd env-block whitelist to the scheduler jobs without further plumbing.",
  sourceDocHashes: [],
  citations: ["D-ENGINEERING-INTEGRITY-CHARTER"],
  recordedVia: "scrooge:session-delegation",
};

// Symmetric phase chain: requested → approved (idempotent on the fixed instants).
requestDecision(base, REQUESTED);
const r = recordDecision({ ...base, phase: "approved" as const }, APPROVED);

console.log(
  JSON.stringify(
    { ok: true, eventId: r.eventId, decisionId: "D-NARRATIVE-PROVIDER-CONFIG" },
    null,
    2,
  ),
);
