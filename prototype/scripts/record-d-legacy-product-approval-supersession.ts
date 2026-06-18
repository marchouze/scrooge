// scripts/record-d-legacy-product-approval-supersession.ts
//
// Records the CEO decision (Marc, session-delegation 2026-06-18) on how to treat
// the legacy `ProductApproved` events that the backward-looking
// `recon:product-approval-attestation-integrity` flags — option (b): explicit
// supersession/withdrawal events (append-only), NOT a grandfather allowlist and
// NOT gate-weakening; with the 5 active non-compliant products WITHDRAWN now and
// re-run through clean NPA cycles when their substrate is ready (the FX precedent).
//
// Facts (HOME/production store, 2026-06-18). The recon scans EVERY historical
// ProductApproved and fails any with <15 dimensions or a design-attested-no-gaps
// dimension. Flagged (8 approvals across 7 products):
//   - fx:otc-vanilla ×2 (2026-06-10, 2026-06-11) — SUPERSEDED by the clean
//     internal-test cycle from PR #1420 (D-FX-NPA-RESTART), which is the current
//     effective approval.
//   - fx:fx-swap-usdzar (2026-05-26) — already ProductRetired (2026-06-10).
//   - equity:jse-equity-cash, bond:sagb-fixed-coupon, bond:open-repo-gmra,
//     ird:vanilla-zar-fix-zaronia, treasury:repo-sagb-term — 5 ACTIVE products
//     approved 2026-05-26..28 under the THEN-14-dimension standard, before the
//     data-quality 15th dimension (D-NPA-POST-APPROVAL-FINDING-REVIEW) and before
//     the design-attested-no-gaps-is-fatal rule (D-NPA-GATE-POLICY-REDESIGN). They
//     are non-compliant under current policy.
//
// Resolution:
//   (1) Make the recon SUPERSESSION-AWARE: judge each product's CURRENT EFFECTIVE
//       approval (the latest ProductApproved not superseded by a later clean
//       ProductApproved / ProductWithheld / ProductRetired). This is a correctness
//       fix (a dead, superseded approval is not the product's approved state), not
//       gate-weakening. It clears the 2 fx:otc-vanilla legacy approvals (current
//       effective approval = the clean #1420 cycle) and fx:fx-swap-usdzar (current
//       state = retired) with NO new events.
//   (2) Emit explicit `ProductWithheld` for the 5 active non-FX products, citing
//       D-NPA-GATE-POLICY-REDESIGN (approved under the superseded gate policy;
//       non-compliant under the current 15-dimension standard). Each is flagged
//       for a clean NPA cycle when its substrate is ready (build backlog) —
//       matching how FX was withdrawn (D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL) then
//       clean-restarted (D-FX-NPA-RESTART). Build phase: no real trading affected.
//
// No historical events are deleted (Principle 1). No gate is weakened.
//
// Authority: CEO (Marc, session-delegation 2026-06-18) — chose option (b)
// "emit explicit supersession/withdrawal events" and, for the 5 active products,
// "withdraw now, clean-cycle later".
//
// Run against the SHARED canonical store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//     bun run scripts/record-d-legacy-product-approval-supersession.ts
//
// Author: Scrooge (Chief of Staff) — recording instrument for the CEO decision.

import { recordDecision } from "../runtime/decisions/record.ts";

const ts = new Date().toISOString();

const result = recordDecision(
  {
    decisionId: "D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title:
      "Resolve legacy ProductApproved flags via supersession + withdraw 5 active non-compliant products (clean-cycle later)",
    category: "governance",
    recommendation:
      "Resolve the backward-looking recon:product-approval-attestation-integrity flags on legacy ProductApproved events honestly and append-only (option b), in two parts. (1) Refine the recon to judge each product's CURRENT EFFECTIVE approval — the latest ProductApproved not superseded by a later clean ProductApproved / ProductWithheld / ProductRetired — rather than re-judging every dead historical approval; this is a correctness fix (a superseded approval is not the product's approved state), explicitly NOT gate-weakening, documented and tested. It clears the two fx:otc-vanilla legacy approvals (current effective approval is the clean internal-test cycle from PR #1420 / D-FX-NPA-RESTART) and fx:fx-swap-usdzar (current state already ProductRetired) with no new events. (2) Emit explicit ProductWithheld for the five ACTIVE non-FX products approved 2026-05-26..28 under the superseded 14-dimension gate policy (design-attested-no-gaps, missing the data-quality 15th dimension): equity:jse-equity-cash, bond:sagb-fixed-coupon, bond:open-repo-gmra, ird:vanilla-zar-fix-zaronia, treasury:repo-sagb-term — each citing D-NPA-GATE-POLICY-REDESIGN as the reason (non-compliant under current policy) and each flagged for a clean NPA cycle when its substrate is ready (build backlog), matching the FX precedent (withdraw then clean-restart). Build phase: no real trading is affected. No historical events deleted (Principle 1). recon:product-approval-attestation-integrity green afterwards; no gate weakened.",
    rationale:
      "Marc chose option (b) — explicit supersession/withdrawal events — and, on the active products, 'withdraw now, clean-cycle later'. Investigation established the recon scans every historical ProductApproved, so no event clears a dead approval unless the recon judges the current effective approval; making it supersession-aware is therefore both necessary and correct. The five flagged active products were validly approved under the then-current standard but are non-compliant under the tightened gate policy (D-NPA-GATE-POLICY-REDESIGN made design-attested-no-gaps fatal; D-NPA-POST-APPROVAL-FINDING-REVIEW added the data-quality 15th dimension). Withdrawing them now (rather than back-filling attestations onto immutable historical approvals, which is impossible under Principle 1, or grandfathering, which hides non-compliance) is the honest state and mirrors exactly how FX was handled. Each carries a tracked build-backlog flag so the deferral is not silent (Engineering Charter command 5).",
    sourceDocHashes: [],
    citations: [
      "D-NPA-GATE-POLICY-REDESIGN",
      "D-FX-NPA-RESTART",
      "D-NEW-PRODUCT-APPROVAL-POLICY-V2",
      "D-ENGINEERING-INTEGRITY-CHARTER",
    ],
    recordedVia: "scrooge:session-delegation",
  },
  ts,
);

console.log(JSON.stringify({ decision: result.eventId }, null, 2));
