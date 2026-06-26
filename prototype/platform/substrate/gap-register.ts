// platform/substrate/gap-register.ts
//
// Canonical typed register of the engineering substrate's known gaps.
//
// Previously these lived as a curated `KNOWN_SUBSTRATE_GAPS: string[]` inside
// `runtime/agents/atlas-substrate-state.ts`, with severity / status /
// mitigation re-derived every run by regex over the prose. That coupled the
// classification to keyword accidents and hid it from any other consumer.
//
// This register is the single canonical source (Principle 2): each gap carries
// a stable `id` and EXPLICIT severity / status / mitigation. Atlas's
// substrate-state handler folds it into the `SubstrateStateSnapshot.gaps[]`
// inventory + per-gap WorkstreamRegistered events. Substrate gaps are forward
// engineering work, NOT risk-register findings (WS-RISK-REGISTER-CLOSURE) —
// `severity` here is a planning heuristic (blast radius), not a risk-appetite
// measure.
//
// Author: Atlas (Core banking platform architect, engineering)

/** Planning-severity of a substrate gap — blast radius, not risk appetite. */
export type SubstrateGapSeverity = "medium" | "high";
/**
 * Lifecycle status of the engineering work that closes the gap.
 *   - "planned"   — work identified, not started.
 *   - "in-flight" — work underway.
 *   - "resolved"  — the gap is CLOSED; the substrate now exists. The record is
 *                   RETAINED (not deleted) for audit lineage — `closedBy` cites
 *                   the closing event/decision. Resolved gaps are filtered out
 *                   of the OPEN-gap inventory (they are no longer gaps).
 */
export type SubstrateGapStatus = "planned" | "in-flight" | "resolved";
/** Whether an interim mitigation is in place while the gap is open. */
export type SubstrateGapMitigation = "none" | "partial";

/** One row in the canonical substrate-gap register. */
export interface SubstrateGapRecord {
  /** Stable kebab-case identifier — survives reordering of the register. */
  readonly id: string;
  /** Short human title. */
  readonly title: string;
  /** Full prose: what the gap is, its dependency, and the closing plan. */
  readonly description: string;
  readonly severity: SubstrateGapSeverity;
  readonly status: SubstrateGapStatus;
  readonly mitigation: SubstrateGapMitigation;
  /**
   * When `status === "resolved"`: the closing event type / Decision / PR that
   * closed the gap (Principle 1 — the closure cites its evidence). Absent on
   * open gaps.
   */
  readonly closedBy?: string;
}

export const SUBSTRATE_GAP_REGISTER: readonly SubstrateGapRecord[] = [
  {
    id: "event-store-cloud-shared",
    title: "Event store cloud-shared via Neon Postgres",
    description:
      "Event store: cloud-shared via Neon Postgres (`BANK_EVENT_DB_URL`); local sqlite remains canonical-shape on every host. Bidirectional sync runs before/after every agent workflow via `bun run event-store:sync`. Senna threat model APPROVED for build-phase use under exception `TM-NEON-EVENT-STORE-001` (Owen's substrate-exception register). Hardening conditions §5.1 (role downgrade to SELECT+INSERT) and §5.2 (IP allowlist) deferred while events remain non-sensitive; required before any sensitive-data event flows. M8 cloud lift swaps Neon for Neon-on-Azure or Azure Postgres without code change.",
    severity: "medium",
    status: "planned",
    mitigation: "partial",
  },
  {
    id: "typed-event-payload-schemas",
    title: "Typed event-payload schemas + risk closure family",
    description:
      "Typed event-payload schemas: AgentEscalation, AgentDecision, WorkstreamRegistered, RiskRaised + closure family (RiskResolved / RiskAccepted / RiskMitigated) — DEFINED in `platform/event-store/event-types/risk.ts` + `.../event-types.ts` with Zod payload schemas and typed `make<Type>` factories. Substrate gaps surface on the SubstrateStateSnapshot `gaps[]` status inventory + per-gap WorkstreamRegistered events; they are NOT risk-register findings, so Atlas no longer emits RiskRaised for them (WS-RISK-REGISTER-CLOSURE). The closure family lets goal-loops resolve a risk register by riskId pairing. Vera's audit pipelines #14/#15 and the dashboard's curated-seed retirement now have substrate to consume.",
    severity: "high",
    status: "in-flight",
    mitigation: "partial",
  },
  {
    id: "runtime-trigger-kinds",
    title: "Runtime trigger kinds (scheduled / event-driven / on-request)",
    description:
      "Runtime trigger kinds: scheduled, event-driven, and on-request are all first-class in `runtime/run.ts`. Event-driven dispatch fans out in-process from a parent run when the parent appended an event type a downstream handler subscribes to; cross-process / cross-workflow event-bus is M8 cloud-lift work. On-request handlers are dispatched via `bun run agent:<slug>` or workflow_dispatch with no schedule (first example: `mira:citation-gate`).",
    severity: "high",
    status: "in-flight",
    mitigation: "partial",
  },
  {
    id: "claude-api-narrative",
    title: "Claude API integration for agent-narrative output",
    description:
      "Claude API integration for agent-narrative output: ROLLED OUT. All seven runtime handlers (Vera, Atlas, Mira, Owen, Senna, Anya, Scrooge) call `tryGenerateNarrative` after their mechanical pass. Each has a stable persona-grounded system prompt cached as the prefix; per-run state is the volatile suffix. Requires ANTHROPIC_API_KEY in the host env or GitHub Actions secret; runs degrade gracefully when unset.",
    severity: "medium",
    status: "in-flight",
    mitigation: "partial",
  },
  {
    id: "projection-cache-persistence",
    title: "Projection-cache persistence via anya:projection-refresh",
    description:
      "Projection-cache persistence: closed by `anya:projection-refresh`, an event-driven handler subscribed to SubstrateStateSnapshot / WorkstreamRegistered / WorkstreamCompleted / CeoDecision. Re-derives the dashboard projection from canonical sources + the live event store and writes it to the runtime cache `prototype/.local/dashboard-state.json` (gitignored). D-EVENT-STORE-SCALING Slice 3a (PR #138, 2026-05-10) split this runtime path off the previously-committed seed; Slice 3b (same day) removed the seed from the commit graph entirely — the recon harness now derives + asserts internal consistency at recon time rather than comparing against a stored cache.",
    severity: "medium",
    status: "planned",
    mitigation: "none",
  },
  {
    id: "citation-gate-wrapper",
    title: "Citation gate wrapped as mira:citation-gate",
    description:
      "Citation gate: now wrapped as `mira:citation-gate` (on-request). Walks the event store, emits `CitationGatePassed` / `CitationGateFailed` and one `AuditFinding` per missing-citation event. Workflow at `.github/workflows/agent-runtime-mira-citation-gate.yml` (workflow_dispatch only — the gate is also still part of the `ci` script for synchronous CI verification).",
    severity: "high",
    status: "planned",
    mitigation: "none",
  },
  {
    id: "github-actions-cron",
    title: "GitHub Actions cron unreliability (A2.1 scheduler)",
    description:
      "GitHub Actions cron unreliability — interim substrate. GH Actions silently dropped Anya 03:00 UTC + Scrooge 04:00 UTC daily slots overnight 2026-05-07/08; Vera 02:00 UTC fired 2h46m late. All ten scheduled workflows re-pinned 2026-05-08 to off-the-hour distinct minutes (Vera 02:13, Anya 03:17, Scrooge 04:27, Helena 04:30, Devon Mon 05:23, Zara Mon 05:30, Atlas Mon 06:19, Owen Tue 07:31, Mira Wed 07:29, Senna Thu 07:37). Permanent fix is A2.1 — substrate scheduler emitting typed `ScheduledTrigger` events from a Bun process — at which point cron files become thin shims or retire entirely.",
    severity: "medium",
    status: "planned",
    mitigation: "none",
  },
  // ---------------------------------------------------------------------------
  // Legacy product re-NPA backlog (D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION,
  // CEO-approved 2026-06-18). Five products approved 2026-05-26..28 under the
  // superseded 14-dimension gate policy were withdrawn via ProductWithheld
  // (scripts/withdraw-legacy-superseded-products.ts). Each must be re-run
  // through a clean 15-dimension NPA cycle (the FX-OTC pattern, per
  // platform/markets/products/fx-otc-vanilla-npa-cycle.ts) once the per-product
  // substrate is ready. Tracked here so the re-NPA work is never silently
  // dropped (Engineering Charter: no silent deferral). Trigger for every entry:
  // "substrate ready → clean NPA cycle".
  // ---------------------------------------------------------------------------
  {
    id: "re-npa-jse-equity-cash",
    title: "Re-run clean NPA cycle — prd:bank:equity:jse-equity-cash",
    description:
      "prd:bank:equity:jse-equity-cash (JSE listed cash equity, M1) was approved 2026-05-26 under the superseded 14-dimension gate policy and withdrawn via ProductWithheld under D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION. Must be re-run through a clean 15-dimension NPA cycle (incl. data-quality dimension, no design-attested-without-tracked-gaps) before re-approval. Trigger: substrate ready → clean NPA cycle. Authority: D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION; D-NPA-GATE-POLICY-REDESIGN.",
    severity: "high",
    status: "planned",
    mitigation: "none",
  },
  {
    id: "re-npa-sagb-fixed-coupon",
    title: "Re-run clean NPA cycle — prd:bank:bond:sagb-fixed-coupon",
    description:
      "prd:bank:bond:sagb-fixed-coupon (SAGB fixed-coupon bond) was approved 2026-05-26 under the superseded 14-dimension gate policy and withdrawn via ProductWithheld under D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION. Must be re-run through a clean 15-dimension NPA cycle before re-approval. Trigger: substrate ready → clean NPA cycle. Authority: D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION; D-NPA-GATE-POLICY-REDESIGN.",
    severity: "high",
    status: "planned",
    mitigation: "none",
  },
  {
    id: "re-npa-open-repo-gmra",
    title: "Re-run clean NPA cycle — prd:bank:bond:open-repo-gmra",
    description:
      "prd:bank:bond:open-repo-gmra (open repo under GMRA) was approved 2026-05-26 under the superseded 14-dimension gate policy and withdrawn via ProductWithheld under D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION. Must be re-run through a clean 15-dimension NPA cycle before re-approval. Trigger: substrate ready → clean NPA cycle. Authority: D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION; D-NPA-GATE-POLICY-REDESIGN.",
    severity: "high",
    status: "planned",
    mitigation: "none",
  },
  {
    id: "re-npa-vanilla-zar-fix-zaronia",
    title: "Re-run clean NPA cycle — prd:bank:ird:vanilla-zar-fix-zaronia",
    description:
      "prd:bank:ird:vanilla-zar-fix-zaronia (vanilla ZAR fixed-vs-ZARONIA IRS) was approved 2026-05-26 under the superseded 14-dimension gate policy and withdrawn via ProductWithheld under D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION. Must be re-run through a clean 15-dimension NPA cycle before re-approval. Trigger: substrate ready → clean NPA cycle. Authority: D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION; D-NPA-GATE-POLICY-REDESIGN.",
    severity: "high",
    status: "planned",
    mitigation: "none",
  },
  {
    id: "re-npa-repo-sagb-term",
    title: "Re-run clean NPA cycle — prd:bank:treasury:repo-sagb-term",
    description:
      "prd:bank:treasury:repo-sagb-term (SAGB-backed term repo, M5) was approved 2026-05-28 under the superseded 14-dimension gate policy and withdrawn via ProductWithheld under D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION. Must be re-run through a clean 15-dimension NPA cycle before re-approval. Trigger: substrate ready → clean NPA cycle. Authority: D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION; D-NPA-GATE-POLICY-REDESIGN.",
    severity: "high",
    status: "planned",
    mitigation: "none",
  },
  {
    id: "re-npa-mmd-deposit",
    title: "Re-run clean NPA cycle — prd:bank:treasury:mmd-deposit",
    description:
      "prd:bank:treasury:mmd-deposit (Money Market Deposit, M6) was approved 2026-05-28 under the superseded 14-dimension gate policy and withdrawn via ProductWithheld under D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION. Must be re-run through a clean 15-dimension NPA cycle before re-approval. Trigger: substrate ready → clean NPA cycle. Authority: D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION; D-NPA-GATE-POLICY-REDESIGN.",
    severity: "high",
    status: "planned",
    mitigation: "none",
  },
  {
    id: "re-npa-funding-line",
    title: "Re-run clean NPA cycle — prd:bank:treasury:funding-line",
    description:
      "prd:bank:treasury:funding-line (Committed Funding Line, M7) was approved 2026-05-28 under the superseded 14-dimension gate policy and withdrawn via ProductWithheld under D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION. Must be re-run through a clean 15-dimension NPA cycle before re-approval. Trigger: substrate ready → clean NPA cycle. Authority: D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION; D-NPA-GATE-POLICY-REDESIGN.",
    severity: "high",
    status: "planned",
    mitigation: "none",
  },
  // ---------------------------------------------------------------------------
  // BA-return filing-lifecycle gap (no silent deferral — Engineering Charter #5).
  // Surfaced while wiring the V2 Finance → Regulatory-Returns register page
  // (brief:mira:wire-ba-returns-register-onto-v2-finance-regulat:2026-06-20):
  // the register shows what each return IS and (for BA 700 / BA 320) its live
  // figure, but the page CANNOT show "last filed" / "reporting period" /
  // "overdue" because there is no filing-lifecycle event in the substrate. The
  // page renders those columns "—" / "N/A" (never fabricated); this register
  // entry is the tracked obligation to build the event family.
  // ---------------------------------------------------------------------------
  {
    id: "ba-returns-filing-lifecycle",
    title: "BA-return filing-lifecycle event family (ReportFiled / ReportDue)",
    description:
      "RESOLVED (D-BA-RETURN-OF-RECORD-EVENT-FAMILY): the born-V2 filing-lifecycle event family now exists — ReportGenerated (return-of-record: attestable figures + BLAKE3 content hash) + ReportDue / ReportFiled / ReportSubmissionAcknowledged. The BA 700 period-close handler (bea:ba700-period-close) emits ReportGenerated + ReportFiled on every AccountingPeriodClosed (idempotent). The V2 Finance Regulatory-Returns page (GET /api/v2/finance/returns) folds these events for reporting-period / last-filed / overdue instead of rendering '—' / 'N/A'. Authority: D-BA-RETURN-OF-RECORD-EVENT-FAMILY; D-RMS-PHASE-1. Originally tracked under D-BANK-WIDE-V2-MIGRATION; brief:mira:wire-ba-returns-register-onto-v2-finance-regulat:2026-06-20.",
    severity: "medium",
    status: "resolved",
    mitigation: "none",
    closedBy: "ReportGenerated/ReportFiled (D-BA-RETURN-OF-RECORD-EVENT-FAMILY)",
  },
  // ---------------------------------------------------------------------------
  // RESOLVED (D-BA-RETURN-OF-RECORD-DOCUMENT-STORE): the full rendered return
  // blob is now filed into the RMS content-addressed document store.
  // ---------------------------------------------------------------------------
  {
    id: "ba-return-of-record-document-store",
    title: "BA-return rendered-artefact into RMS document store (RecordFiled)",
    description:
      "RESOLVED (D-BA-RETURN-OF-RECORD-DOCUMENT-STORE): the FULL rendered BA 700 return artefact (the SARB XML envelope) is now filed into the RMS content-addressed document store via a RecordFiled{registerKey:'documents'} event on every period-close (fileBa700ReturnArtefact in platform/returns/ba700/report-of-record.ts). The envelope is rendered from the SAME generator output already attested by ReportGenerated (renderBa700Envelope; NOT re-derived). HASH-LINKAGE: the RecordFiled records the envelope's OWN document-store hash as documentHash (NOT equal to ReportGenerated.contentHash — the two hash different bytes; the contentHash is over the attestable figures, replay-stable, while the envelope hash is over the rendered XML and embeds incidental per-store ids), and references the ReportGenerated by event id + attestable contentHash in its citations — linkage by reference, not hash-equality. Filing is idempotent at both the blob layer (content-addressing) and the event layer (per entity+form+period). Read-path-store-aware recon: recon:ba700-document-store-completeness asserts every closed-period BA 700 return-of-record has a filed artefact whose blob resolves in the store the reader actually reads (home-default-ENABLED, NOT the excludeHomeDefault singleton). Authority: D-BA-RETURN-OF-RECORD-DOCUMENT-STORE; D-BA-RETURN-OF-RECORD-EVENT-FAMILY; D-RMS-PHASE-1.",
    severity: "medium",
    status: "resolved",
    mitigation: "none",
    closedBy: "RecordFiled rendered-envelope filing (D-BA-RETURN-OF-RECORD-DOCUMENT-STORE)",
  },
  // ---------------------------------------------------------------------------
  // IAS 21 oracle coverage (D-FX-IFRS-REVIEW-FOUNDATION, F9). The IAS-21 domain-
  // truth oracle (Regulations/INTL/IASB/source-docs/ias-21-structured.json) the
  // FX-vanilla review validates against ingests the FX-vanilla-bearing paragraphs:
  // RESOLVED (FX-vanilla full-closure tail, 2026-06-26). The oracle now ingests
  // the full FX-vanilla-bearing set §8, §15, §15A, §20–§23, §25, §26, §28–§30, §32,
  // §33, §48 — every paragraph this gap previously named as un-ingested (§15A net-
  // investment monetary-item holder; §25 carrying-amount-by-comparison; §26 several-
  // rates / temporary-non-exchangeability; §33 where the net-investment difference
  // arises; §48 reclassification on disposal) is now in ias-21-structured.json,
  // verbatim. Nothing FX-vanilla-relevant remains un-ingested, so the gap is CLOSED
  // (not merely narrowed). The only IAS 21 material deliberately still excluded is
  // the translation-to-a-presentation-currency machinery §38–§47 and §49–§57, which
  // is a CONSOLIDATION concern (presentation currency ≠ functional currency), not an
  // FX trading-book treatment — it sits in a SEPARATE, not-yet-opened scope, never a
  // blind spot of the FX-vanilla oracle. Full IAS 21 text is © IFRS Foundation; the
  // licence-day procurement obligation is tracked separately (file-ias-21-licensing-
  // flag), independent of this coverage gap.
  // ---------------------------------------------------------------------------
  {
    id: "ias21-oracle-coverage",
    title: "IAS 21 oracle: §15A/§25/§26/§33/§48 ingested — FX-vanilla coverage complete",
    description:
      "RESOLVED (2026-06-26, FX-vanilla full-closure). The IAS-21 domain-truth oracle now ingests the complete FX-vanilla-bearing set (§8, §15, §15A, §20–§23, §25, §26, §28–§30, §32, §33, §48) in Regulations/INTL/IASB/source-docs/ias-21-structured.json, verbatim. The previously-named tail — §15A (net-investment monetary-item holder), §25 (carrying-amount-by-comparison), §26 (several rates / temporary non-exchangeability), §33 (where the net-investment difference arises), §48 (reclassification on disposal) — is fully ingested. Nothing FX-vanilla-relevant is un-ingested. The translation-to-a-presentation-currency paragraphs (§38–§47, §49–§57) remain out of scope by design — they are a CONSOLIDATION concern (presentation ≠ functional currency), not an FX trading-book treatment, and belong to a separate not-yet-opened scope rather than a blind spot of this oracle. The golden-case test header (fx-ifrs-golden-cases.test.ts) is updated to record the closed coverage. Full IAS 21 text is © IFRS Foundation; the licence-day procurement obligation is tracked separately. Authority: D-FX-IFRS-REVIEW-FOUNDATION (F9).",
    severity: "medium",
    status: "resolved",
    mitigation: "none",
    closedBy:
      "FX-vanilla full-closure run (D-FX-IFRS-REVIEW-FOUNDATION F9); ias-21-structured.json §15/§15A/§25/§26/§33/§48 ingestion.",
  },
  {
    id: "ba320-ir-sim-gl",
    title: "BA 320 IR risk class: live simulated trading-book bond seed deferred",
    description:
      "The simulator-first trading book (D-BA-RETURN-SIMULATOR-FIRST Phase 1; scripts/sim/seed-trading-book-sim-v1.ts) seeds live SIMULATED equity + commodity trading-book positions that drive the BA 320 equity + commodity risk classes (the classes that previously folded to zero — no event stream fed them). It does NOT seed a live simulated BondTradeExecuted for the INTEREST-RATE risk class, because every live BondTradeExecuted requires its matching V1 SubLedgerPostingEmitted (posting rule PR-BOND-001) or recon:gl-ledger-coverage flags an uncovered lifecycle — seeding a live sim bond would drag the whole bond GL-posting chain into this slice. The IR risk class is ALREADY driven by the existing ba-320-bond-events-adapter / ba-320-irs-events-adapter (which filter portfolio === 'trading-book'); the brief's IR scope ('ensure trading-book designation') is honoured and PROVEN end-to-end against the Reg 28(3)(a) Table A oracle by platform/returns/ba320/trading-book-sim-golden.test.ts (R100m SA-gov @ 5-7y → R3,250,000; banking-book excluded) using an in-memory store. The live IR sim seed (a simulated trading-book bond WITH its GL postings on the sim path) is the named follow-on. Authority: D-BA-RETURN-SIMULATOR-FIRST; Engineering Charter cmd 5 (no silent deferral).",
    severity: "medium",
    status: "planned",
    mitigation: "partial",
  },
];

/** Open (not-yet-resolved) gaps — the inventory the substrate snapshot tracks. */
export function openSubstrateGaps(): readonly SubstrateGapRecord[] {
  return SUBSTRATE_GAP_REGISTER.filter((g) => g.status !== "resolved");
}

/** Look up a gap record by id. */
export function getSubstrateGap(id: string): SubstrateGapRecord | undefined {
  return SUBSTRATE_GAP_REGISTER.find((g) => g.id === id);
}
