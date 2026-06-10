// prototype/scripts/obligation-summaries/summary-types.ts
//
// Shared types for the P4-SCALE reviewed-requirement-summary modules
// (D-OBLIGATIONS-REGISTER-CLEANUP Phase 4 SCALE, WS-OBLIGATIONS-CLEANUP).
//
// One module per non-A domain (B..J) exports a `Record<obligationId,
// ObligationSummary>` keyed by obligation id. The generic author
// (`author-obligation-summaries.ts`) reads them and emits, per obligation:
//   - one `ObligationReviewCompleted` event (reviewerAgentName "Mira",
//     reviewerSeat = the obligation's owning seat);
//   - for `reviewed-modified` rows, a corrected `ObligationAdopted.requirement`
//     fed via the seed (SA rows are in `Regulations/_obligations.seed.json`).
//
// Authoring rules (mirror the Domain-A pilot exactly):
//   - `reviewed-confirmed` — the existing register `requirement` is already an
//     accurate plain-English summary (typically the rich CS/ODP/FAIS-RK/GV-FNP/
//     MK-RPT rows that already carry full sub-section detail); no rewrite. The
//     review event records the confirmation; the requirement is unchanged.
//   - `reviewed-modified` — the existing `requirement` is a thin one-liner
//     (a bare verb-phrase); the authored 2–4 sentence `summary` replaces it.
//   - ALL non-A obligations are SA `ORG-*` rows whose source text is `missing`
//     in the live drill-down (no extractable graph Provision text for the SA
//     instruments — confirmed by the pilot). Summaries are therefore authored
//     from the citation + existing requirement prose, with the source-text gap
//     noted in the rationale, NOT fabricated around.
//
// Author: Mira (Compliance / RegTech engineer, engineering — reports to Zara
//   (Chief Compliance Officer, governance)).

export type ReviewVerdict = "reviewed-confirmed" | "reviewed-modified";

export interface ObligationSummary {
  /** Owning seat — the obligation's owner; the review event's reviewerSeat. */
  readonly reviewerSeat: string;
  readonly verdict: ReviewVerdict;
  /** Authored summary; present only for `reviewed-modified`. Becomes the
   *  corrected `ObligationAdopted.requirement`. */
  readonly summary?: string;
  /** One-line review rationale; survives in the ObligationReviewCompleted trail. */
  readonly rationale: string;
}

export type SummaryModule = Record<string, ObligationSummary>;
