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
  // Follow-on (Charter cmd 5 — no silent deferral): the return-of-record EVENT
  // carries the attestable figures + a BLAKE3 content hash; filing the FULL
  // rendered return blob into the RMS content-addressed document store
  // (RecordFiled) is deliberately NOT done in the first slice — the hash is the
  // integrity anchor, and the full artefact is reproducible from the events
  // (Principle 1). Tracked so it is not a silent omission.
  // ---------------------------------------------------------------------------
  {
    id: "ba-return-of-record-document-store",
    title: "BA-return rendered-artefact into RMS document store (RecordFiled)",
    description:
      "The BA-return-of-record ReportGenerated event carries the attestable figures + a BLAKE3 content hash of the rendered return, but the FULL rendered return artefact (the SARB XML envelope) is not yet filed into the RMS content-addressed document store via a RecordFiled event. The content hash is the integrity anchor and the full artefact is reproducible from the events (Principle 1), so this is a completeness follow-on, not a correctness gap. Closing it = render the return, put the blob into the document store, and emit RecordFiled referencing the ReportGenerated content hash. Trigger: RMS document-store integration for regulatory returns. Authority: D-BA-RETURN-OF-RECORD-EVENT-FAMILY; D-RMS-PHASE-1.",
    severity: "medium",
    status: "planned",
    mitigation: "partial",
  },
  // ---------------------------------------------------------------------------
  // IAS 21 oracle coverage (D-FX-IFRS-REVIEW-FOUNDATION, F9). The IAS-21 domain-
  // truth oracle (Regulations/INTL/IASB/source-docs/ias-21-structured.json) the
  // FX-vanilla review validates against ingests the FX-vanilla-bearing paragraphs:
  // §8 (definitions), §20–§23 (reporting + closing-rate retranslation), §28–§30,
  // §32 (recognition of exchange differences, incl. the net-investment exclusion
  // §28 cross-references). It does NOT yet ingest §15A (long-term net-investment
  // monetary items), §25/§26 (cash-flow / multiple-rate mechanics), §33 (change of
  // functional currency for the net-investment difference) or §48 (reclassification
  // on disposal of a foreign operation). None bear on the FX trading-book treatment
  // the foundation asserts today, so this is forward coverage, not a live defect —
  // a future treatment touching net-investment hedges or change-of-functional-
  // currency must extend the oracle first. Full IAS 21 text is © IFRS Foundation;
  // ingestion completes at licence-day procurement (see ias-21 sourceNote).
  // ---------------------------------------------------------------------------
  {
    id: "ias21-oracle-coverage",
    title: "IAS 21 oracle: §15A/§25/§26/§33/§48 not yet ingested",
    description:
      "The IAS-21 domain-truth oracle ingests the FX-vanilla-bearing paragraphs (§8, §20–§23, §28–§30, §32 — including the net-investment exclusion §28 cross-references). It does NOT yet ingest §15A (long-term net-investment monetary items), §25/§26 (settlement / multiple-rate mechanics), §33 (change of functional currency) or §48 (reclassification on disposal of a foreign operation). None bear on the FX trading-book treatment the FX-vanilla review asserts today — this is forward coverage, NOT a live defect. A future treatment touching net-investment hedges or change-of-functional-currency must extend the oracle first. The golden-case test header (fx-ifrs-golden-cases.test.ts) and the FX-vanilla review PROC state these blind spots for the reader. Full IAS 21 text is © IFRS Foundation; ingestion completes at licence-day procurement. Authority: D-FX-IFRS-REVIEW-FOUNDATION (F9).",
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
