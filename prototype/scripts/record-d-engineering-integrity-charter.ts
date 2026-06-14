// scripts/record-d-engineering-integrity-charter.ts
//
// Records D-ENGINEERING-INTEGRITY-CHARTER — Marc's in-session approval
// (2026-06-14) to embed a standing Engineering Charter ("correctness before
// convenience") as foundational, durable engineering discipline so that, as
// the bank's functionality faces increasing complexity, volume, and scrutiny,
// coding always takes the proper path rather than the pragmatic/fast shortcut.
//
// The Charter (Engineering-Charter.md) holds ten standing commands plus a
// Definition of Done. Four enforcing recon gates back it — no-ts-suppression,
// no-skipped-tests, no-swallowed-errors, tracked-todo — plus the advisory
// meta-gate ratchet-hardening-only. Per Marc's scoping decision the discipline
// is embedded as a Charter + Decision (no new Principle; the count stays at 6),
// with the enforcement gates built now.
//
// Idempotent on (decisionId, phase, as_of). Scrooge is the recording
// instrument (recordedVia: scrooge:session-delegation); Marc is the
// authorizing principal (authorityRef: marc@tgv.co.za).
//
// Authority: CLAUDE.md §"Session delegation"; decision-authority-routing
// (engineering build decisions → CEO during build phase).
import "../platform/event-store/resolve-event-db-boot";
import { recordDecision, requestDecision } from "../runtime/decisions/record";

const REQ = "2026-06-14T06:10:00.000Z";
const APP = "2026-06-14T06:12:00.000Z";

const base = {
  decisionId: "D-ENGINEERING-INTEGRITY-CHARTER",
  authority: "CEO" as const,
  authorityRef: "marc@tgv.co.za",
  title:
    "Embed an Engineering Charter (correctness before convenience) as standing engineering discipline, backed by enforcing recon gates",
  category: "engineering" as const,
  recommendation:
    "Adopt Engineering-Charter.md as the standing, durable 'no-shortcuts' engineering standard binding every agent and every dispatch: ten commands (root-cause before remedy; fail-closed by default; no green by concealment; source don't hardcode; no silent deferral; the type system is a tool not an obstacle; whole-tree integrity; traceability before code; replay-safe & append-only; a Definition of Done) plus the Definition-of-Done checklist that gates 'done'. Surface it in CLAUDE.md (an Engineering-integrity operating-procedures subsection and a dispatch-discipline citation bullet so it binds dispatched agents, not just in-session work). Make the most common shortcuts fail CI now via four enforcing harden-only ratchet gates — recon:no-ts-suppression (bans @ts-ignore/@ts-expect-error), recon:no-skipped-tests (bans .skip/.only/.todo/x-forms), recon:no-swallowed-errors (bans empty catch blocks), recon:tracked-todo (bans untracked TODO/FIXME/HACK) — and one advisory meta-gate, recon:ratchet-hardening-only, asserting every ratchet carries its harden-only contract clause and an authority citation. No new Principle is added; the principle count stays at six.",
  rationale:
    "The bank's functionality must withstand increasing complexity, volume, and scrutiny. Under that pressure the cheap move is always available — patch the symptom, silence the type-checker, skip the failing test, widen the allowlist, hardcode the value, defer the gap and forget it — each shortcut locally rational and globally corrosive in a regulated institution where the later cost is a finding, a restatement, or a breach. The codebase already has strong mechanical enforcement (full tsc, biome, the citation gate, the wall-clock and append-only ratchets, 196 recon gates) but no foundational normative anchor: no no-shortcuts charter, no Definition of Done, and several of the most common shortcuts (type suppression, skipped tests, swallowed errors, untracked deferrals) were not yet mechanically caught. The Charter makes the proper-first bias durable rather than session-dependent, and the new gates give it teeth without forcing a mass cleanup (each onboards as a harden-only ratchet at its measured current count). Marc chose the Charter + Decision form (not a seventh Principle) and directed that the enforcement gates be built in the same pass.",
  sourceDocHashes: [],
  citations: [
    "Engineering-Charter.md",
    "Principles/1-events-are-truth.md",
    "Principles/2-single-graph-discipline.md",
    "D-PROVENANCE-FILTER-ENFORCEMENT",
  ],
  recordedVia: "scrooge:session-delegation" as const,
};

requestDecision(base, REQ);
const r = recordDecision({ ...base, phase: "approved" as const }, APP);
console.log(JSON.stringify({ ok: true, eventId: r.eventId, decisionId: base.decisionId }, null, 2));
