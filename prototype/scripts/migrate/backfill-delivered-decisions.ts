// scripts/migrate/backfill-delivered-decisions.ts
//
// One-shot backfill: emit Decision(approved) events for the 16 engineering
// slice decisions whose work landed before the D-DECISIONS-FRAMEWORK-REDESIGN
// backfill ran. The initial backfill created requested-phase events for all of
// them but had no way to infer that the underlying work was done, so they
// stayed open in the register.
//
// Idempotent: each entry is skipped if the projection already shows a terminal
// phase for that decisionId.
//
// Authority: D-DECISIONS-FRAMEWORK-REDESIGN (CEO-approved 2026-05-16).
// Author: Scrooge (session-delegation, 2026-05-16)

import { eventStore } from "../../platform/composition";
import { buildDecisionsRegister, decisionsSourceFromStore } from "../../projections/decisions";
import { recordDecision } from "../../runtime/decisions/record";

// ---------------------------------------------------------------------------
// Delivered decision catalogue
// ---------------------------------------------------------------------------
// Each entry: decisionId, delivery timestamp (PR merge, UTC), PR number,
// recommendation (what was approved), rationale (why / what it enables).

interface DeliveredDecision {
  decisionId: string;
  title: string;
  category: "engineering" | "governance" | "risk" | "compliance" | "product";
  deliveredAt: string; // ISO 8601 UTC
  pr: number;
  recommendation: string;
  rationale: string;
}

const DELIVERED: readonly DeliveredDecision[] = [
  {
    decisionId: "D-RMS-PHASE-1-SLICE-1",
    title: "RMS Phase 1 Slice 1 — content-addressed document store + BLAKE3 hashing",
    category: "engineering",
    deliveredAt: "2026-05-10T06:45:50Z",
    pr: 142,
    recommendation:
      "Approve — build content-addressed document store with BLAKE3 hashing as the RMS Phase 1 immutable document substrate",
    rationale:
      "Principle 1 requires all artefacts to be event-sourced. A content-addressed store with BLAKE3 hashes gives RMS its tamper-evident document layer; every downstream projection can reference documents by hash, not by path. PR #142 delivered the store, hash helpers, and the first passing round-trip test.",
  },
  {
    decisionId: "D-RMS-PHASE-1-SLICE-2",
    title: "RMS Phase 1 Slice 2 — seven RMS event types + record-helpers",
    category: "engineering",
    deliveredAt: "2026-05-10T07:06:06Z",
    pr: 144,
    recommendation: "Approve — introduce the seven typed RMS event types and record-helper API",
    rationale:
      "RMS Phase 1 spec (D-RMS-PHASE-1) requires a typed event family for each of the seven register projections. Slice 2 lands the Zod schemas and record() helpers so authoring surfaces can emit RMS events without constructing raw payloads. Resolves the S8/RMS event-type overlap identified in the spec. PR #144 merged cleanly.",
  },
  {
    decisionId: "D-RMS-PHASE-1-SLICE-3",
    title: "RMS Phase 1 Slice 3 — projection runtime + 7 RMS register projections",
    category: "engineering",
    deliveredAt: "2026-05-10T09:05:00Z",
    pr: 166,
    recommendation:
      "Approve — build projection runtime that folds the seven RMS event types into seven in-memory registers",
    rationale:
      "The register projections are the query layer that makes RMS useful: decisions, correspondence, records-of-agent-runs, documents, feedback, briefs, workstreams. PR #166 delivered all seven projections under a shared fold pattern; the dashboard reads them via the runtime. No filesystem scanning required post-Slice-3.",
  },
  {
    decisionId: "D-RMS-PHASE-1-SLICE-4",
    title: "RMS Phase 1 Slice 4 — dashboard register render (dual-render)",
    category: "engineering",
    deliveredAt: "2026-05-10T09:33:34Z",
    pr: 169,
    recommendation:
      "Approve — add dashboard render for all seven RMS registers, running in dual-render alongside legacy Owner Inbox tiles",
    rationale:
      "Principle 2 requires the dashboard to derive from events, not from filesystem scans. Slice 4 wires the projection output to the dashboard in dual-render mode: new events surface in the RMS register views while the legacy Owner Inbox tiles remain active during the Phase 1→4 migration. PR #169 introduced no regressions.",
  },
  {
    decisionId: "D-RMS-PHASE-1-SLICE-5",
    title: "RMS Phase 1 Slice 5 — end-to-end round-trip; Phase 1 substantively complete",
    category: "engineering",
    deliveredAt: "2026-05-10T09:55:55Z",
    pr: 173,
    recommendation:
      "Approve — run the full RMS round-trip test (emit → project → dashboard) confirming Phase 1 is substantively complete",
    rationale:
      "Phase 1 completion gate per D-RMS-PHASE-1 spec requires a passing end-to-end round-trip across all seven registers. PR #173 delivered the round-trip harness and the passing test suite; Phase 1 is declared substantively complete pending Phase 2 (content migration) and Phase 4 (legacy folder archive).",
  },
  {
    decisionId: "D-REPORTING-CAPABILITY-SLICE-1",
    title: "Reporting Capability Slice 1 — semantic-layer registry skeleton",
    category: "engineering",
    deliveredAt: "2026-05-10T08:10:16Z",
    pr: 156,
    recommendation:
      "Approve — build the semantic-layer registry as the typed descriptor store for all SARB reporting cells",
    rationale:
      "The M2/M3 reporting capability (D-REPORTING-CAPABILITY-M2-M3) requires a metadata registry that maps each BA-return cell to its derivation path and semantic type. Without this registry, BA return generators produce hardcoded cell arrays with no lineage. PR #156 landed the registry skeleton and the @platform/semantic import surface used by all downstream slices.",
  },
  {
    decisionId: "D-REPORTING-CAPABILITY-SLICE-2",
    title: "Reporting Capability Slice 2 — period-close event family + orchestration",
    category: "engineering",
    deliveredAt: "2026-05-10T09:34:06Z",
    pr: 170,
    recommendation:
      "Approve — introduce PeriodClose event family and orchestration layer that triggers all BA return generators at period end",
    rationale:
      "SARB requires period-close reporting on a defined calendar. Slice 2 lands the PeriodClose event type and the orchestration handler that dispatches to each return generator in sequence. This is the common trigger path for all BA returns; without it each return would need its own ad-hoc invocation. PR #170 merged with full test coverage.",
  },
  {
    decisionId: "D-REPORTING-CAPABILITY-SLICE-3",
    title: "Reporting Capability Slice 3 — BA 325 LCR end-to-end (first SARB return)",
    category: "engineering",
    deliveredAt: "2026-05-10T09:56:27Z",
    pr: 174,
    recommendation:
      "Approve — deliver the BA 325 LCR return as the first end-to-end SARB return harness",
    rationale:
      "BA 325 (Liquidity Coverage Ratio) is the first mandatory SARB return in scope. A passing BA 325 end-to-end proves the semantic registry, period-close trigger, and XML render layer work together. PR #174 delivered the BA 325 generator, its test suite, and the first passing SARB-format output file. All subsequent BA returns follow the same pattern.",
  },
  {
    decisionId: "D-REPORTING-CAPABILITY-SLICE-4",
    title: "Reporting Capability Slice 4 — BA 700 Capital Adequacy Return end-to-end",
    category: "engineering",
    deliveredAt: "2026-05-10T10:32:31Z",
    pr: 176,
    recommendation: "Approve — deliver the BA 700 Capital Adequacy return generator",
    rationale:
      "BA 700 is the primary capital adequacy return under Regulation 28. It is the most scrutinised return by SARB examiners. PR #176 delivered the full BA 700 generator with Tier 1/2/3 capital disaggregation, RWA roll-up, and the required XML/JSON dual output. Aligns with D-RMS-PHASE-1 provenance tagging requirements.",
  },
  {
    decisionId: "D-REPORTING-CAPABILITY-SLICE-6",
    title:
      "Reporting Capability Slice 6 — IFRS statement renderer (BS / IS / CF / Equity / Notes skeleton)",
    category: "engineering",
    deliveredAt: "2026-05-10T11:21:20Z",
    pr: 183,
    recommendation:
      "Approve — build the IFRS financial statement renderer covering Balance Sheet, Income Statement, Cash Flow, Equity Changes, and Notes skeleton",
    rationale:
      "IFRS reporting is required for statutory annual financial statements. Slice 6 delivers the renderer that folds the event store into IFRS-format statements; the Notes skeleton is intentionally minimal and will be extended as disclosure requirements are finalised. PR #183 delivered all five statement types with passing render tests.",
  },
  {
    decisionId: "D-DATA-PROVENANCE-SUBSTRATE-SLICE-2",
    title: "Data Provenance Substrate Slice 2 — projection-runtime mode selection + filtering",
    category: "engineering",
    deliveredAt: "2026-05-10T09:32:14Z",
    pr: 167,
    recommendation:
      "Approve — add projection-runtime mode selection (strict / permissive) and backfill-event filtering to the provenance substrate",
    rationale:
      "The provenance substrate (D-DATA-PROVENANCE-SUBSTRATE) requires a flag-gated strict mode that rejects events without ProvenanceTag envelopes, and a permissive mode for legacy backfill events. Without mode selection, enabling strict mode would break existing event replay. PR #167 delivered both modes and the per-provenance-tag filter that excludes old backfill events from strict-mode checks.",
  },
  {
    decisionId: "D-DATA-PROVENANCE-SUBSTRATE-SLICE-3",
    title: "Data Provenance Substrate Slice 3 — output watermarking + recon",
    category: "engineering",
    deliveredAt: "2026-05-10T09:57:06Z",
    pr: 175,
    recommendation:
      "Approve — add output watermarking (per-page provenance badge) and the provenance-badge-coverage recon gate",
    rationale:
      "Every dashboard page and report output must carry a provenance badge (Principle 2 traceability requirement). Slice 3 delivers the badge-injection middleware, the per-page resolution logic, and the CI recon gate that fails if any page is missing its badge. PR #175 merged with zero recon violations.",
  },
  {
    decisionId: "D-DATA-PROVENANCE-SUBSTRATE-SLICE-6-1",
    title:
      "Data Provenance Substrate Slices 6+1 (combined) — backfill + ProvenanceTag envelope + flag-gated append-rejection",
    category: "engineering",
    deliveredAt: "2026-05-10T08:40:39Z",
    pr: 161,
    recommendation:
      "Approve — combine Slices 6 and 1: backfill existing events with ProvenanceTag envelopes and introduce flag-gated append-rejection for events without provenance",
    rationale:
      "The provenance substrate requires all events in the store to carry a ProvenanceTag. Combining Slices 6 (backfill) and 1 (append-time enforcement) in one PR avoids a window where the enforcement gate runs before the backfill completes, which would break CI. PR #161 delivered both the backfill script and the append-rejection gate behind the PROVENANCE_STRICT env flag.",
  },
  {
    decisionId: "D-FX-SALES-TRADING-FRONTEND-SLICE-1",
    title: "FX Sales & Trading Frontend Slice 1 — UI shell + counterparty picker",
    category: "product",
    deliveredAt: "2026-05-10T08:11:27Z",
    pr: 154,
    recommendation:
      "Approve — build the FX sales & trading frontend shell with counterparty picker as the entry point for the FX RFQ workflow",
    rationale:
      "The FX sales & trading capability (D-FX-SALES-TRADING-FRONTEND) requires a browser UI for the trading desk. Slice 1 establishes the page structure, the counterparty picker (pulling from the Party register), and the route at /fx-trading. PR #154 delivered a functional shell that Slice 2 extends with the RFQ form.",
  },
  {
    decisionId: "D-FX-SALES-TRADING-FRONTEND-SLICE-2",
    title: "FX Sales & Trading Frontend Slice 2 — RFQ form + trade-emit",
    category: "product",
    deliveredAt: "2026-05-10T09:04:12Z",
    pr: 165,
    recommendation:
      "Approve — add the RFQ form and trade-emit handler completing the FX front-end MVP",
    rationale:
      "Slice 2 completes the FX trading UI with the RFQ entry form (ccy pair, notional, tenor, direction), client-side validation, and the event emission path that records a TradeRequested event to the event store. Together with Slice 1, this delivers a usable FX front-end. PR #165 merged with Anya + Kai + Saskia as contributing agents.",
  },
  {
    decisionId: "D-REGULATORY-READINESS-W1-SLICE-1",
    title: "Regulatory Readiness W1 Slice 1 — RMCP attestable specification",
    category: "compliance",
    deliveredAt: "2026-05-10T08:08:30Z",
    pr: 151,
    recommendation:
      "Approve — publish the Risk Management and Compliance Programme (RMCP) as an attestable specification",
    rationale:
      "SARB's Guidance Note 2 of 2018 and Regulation 39 require a documented RMCP. W1 Slice 1 produces the first attestable draft covering the compliance framework, risk appetite alignment, and the agent-based control model. Mira and Zara co-authored. The spec is filed in Owner Inbox as the canonical RMCP record pending the Board-level attestation that triggers at licence-application.",
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const register = buildDecisionsRegister(decisionsSourceFromStore(eventStore));
  const terminalIds = new Set(register.resolved.map((r) => r.decisionId));

  let emitted = 0;
  let skipped = 0;

  for (const d of DELIVERED) {
    if (terminalIds.has(d.decisionId)) {
      console.log(`SKIP  ${d.decisionId} — already resolved`);
      skipped++;
      continue;
    }

    recordDecision(
      {
        decisionId: d.decisionId,
        phase: "approved",
        authority: "CEO",
        authorityRef: "marc@tgv.co.za",
        title: d.title,
        category: d.category,
        recommendation: d.recommendation,
        rationale: d.rationale,
        sourceDocHashes: [],
        citations: [],
        recordedVia: "backfill:decisions-framework-cutover",
      },
      d.deliveredAt,
    );

    console.log(`EMIT  ${d.decisionId} approved @ ${d.deliveredAt} (PR #${d.pr})`);
    emitted++;
  }

  console.log(`\nDone: ${emitted} emitted, ${skipped} skipped.`);

  // Verify register after emissions
  const updated = buildDecisionsRegister(decisionsSourceFromStore(eventStore));
  const stillOpen = updated.open.filter((r) =>
    DELIVERED.some((d) => d.decisionId === r.decisionId),
  );
  if (stillOpen.length > 0) {
    console.error(`\nWARN: ${stillOpen.length} delivered decision(s) still open after backfill:`);
    for (const r of stillOpen) console.error(`  ${r.decisionId}`);
    process.exit(1);
  }
  console.log(`\nVerified: all ${DELIVERED.length} delivered decisions are now resolved.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
