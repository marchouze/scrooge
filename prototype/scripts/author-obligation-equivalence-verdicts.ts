// scripts/author-obligation-equivalence-verdicts.ts
//
// Mira's P5 verdict-authoring backfill — classify every currently-unclassified
// expected SA↔BCBS overlap pair (WS-OBLIGATIONS-CLEANUP Phase 5) by emitting one
// `ObligationEquivalenceClassified` event per pair. The expected-overlap set is
// enumerated from the `ADOPTION_EDGES` Basel-provision spine in
// platform/regulatory/basel-adoption.ts; the recon gate `recon:obligation-divergence`
// surfaces the gaps. This script drives the gate's unclassified count toward zero.
//
// The PRIOR for each verdict is the existing `AdoptionEdge.adoptionType`:
//   - ADOPTS      → `equivalent` (same regulatory outcome).
//   - GOLD_PLATES → `sa-stricter-gold-plates` (reuse the edge delta as verdict delta).
//   - MODIFIES    → judgement: `equivalent` if the modification is immaterial to
//                   the outcome, else `materially-divergent`.
//   - SUPERSEDES  → usually `materially-divergent`.
// Each verdict below records the adoption edge it leans on and the merits-based
// judgement where the edge is MODIFIES.
//
// Idempotent: a pair already carrying an ObligationEquivalenceClassified event is
// skipped (re-run = no-op). The PoC leverage pair (ORG-PR-05 ↔ BCBS-LEV-s20.7,
// emitted by emit-obligation-equivalence-lev-proof.ts) is therefore left alone.
//
// Run against the SHARED store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//     bun run scripts/author-obligation-equivalence-verdicts.ts
//
// This is a one-off backfill, NOT a standing CI script — do not register it in
// package.json.
//
// Authority: D-OBLIGATIONS-REGISTER-CLEANUP (CEO-approved) — WS-OBLIGATIONS-CLEANUP P5.
// Author: Mira (Compliance / RegTech engineer, engineering).

import { clock, eventStore } from "../platform/composition";
import {
  type ObligationEquivalenceClassifiedPayload,
  type ObligationEquivalenceVerdict,
  makeObligationEquivalenceClassified,
} from "../platform/event-store/event-types/obligation-equivalence";

interface VerdictSpec {
  saObligationId: string;
  bcbsObligationId: string;
  /** The Basel provision URN bridging the pair (the adoption-edge key). */
  provision: string;
  verdict: ObligationEquivalenceVerdict;
  /** Required for the two non-equivalent verdicts. */
  delta?: string;
  rationale: string;
  confidence: number;
  /** Extra citations beyond the standing D-* + SA id pair. */
  citations: string[];
}

// ---------------------------------------------------------------------------
// The 21 unclassified expected-overlap pairs (recon:obligation-divergence run
// 2026-06-09), each judged against its ADOPTION_EDGES adoptionType prior.
// ---------------------------------------------------------------------------

const SPECS: VerdictSpec[] = [
  // ── RBC — capital minima + conservation buffer (Reg 38) ──────────────────
  // rbc:20.2 ADOPTS → equivalent. SA Reg 38 takes the Basel CET1/T1/total ratios
  // unchanged (the SA 9.5% total is the Basel 8% floor + the conservation buffer,
  // not a re-statement of the minimum ratio itself).
  {
    saObligationId: "ORG-PR-01",
    bcbsObligationId: "BCBS-RBC-s20.2",
    provision: "urn:reg:bcbs:rbc:20.2",
    verdict: "equivalent",
    rationale:
      "ADOPTS (basel-adoption.ts): Reg 38 takes the Basel minimum risk-based capital ratios (CET1 >=4.5%, T1 >=6%, total >=8% of RWA) verbatim; same regulatory outcome.",
    confidence: 0.95,
    citations: ["urn:reg:za:regs-relating-to-banks:reg38"],
  },
  {
    saObligationId: "ORG-PR-03",
    bcbsObligationId: "BCBS-RBC-s20.2",
    provision: "urn:reg:bcbs:rbc:20.2",
    verdict: "equivalent",
    rationale:
      "ADOPTS (basel-adoption.ts): ORG-PR-03 (buffer obligation) reaches the rbc:20.2 minimum ratios through the same Reg 38 adoption; the minimum-ratio outcome is identical to Basel.",
    confidence: 0.9,
    citations: ["urn:reg:za:regs-relating-to-banks:reg38"],
  },
  // rbc:30.2 MODIFIES → judged sa-stricter-gold-plates. SA holds the 2.5% Basel
  // conservation buffer AND adds Pillar-2A + a SARB-set CCyB on top — additive
  // requirements above the Basel floor, i.e. stricter, not a divergent outcome.
  {
    saObligationId: "ORG-PR-01",
    bcbsObligationId: "BCBS-RBC-s30.2",
    provision: "urn:reg:bcbs:rbc:30.2",
    verdict: "sa-stricter-gold-plates",
    delta:
      "SA preserves the 2.5% CET1 conservation buffer and adds bank-specific Pillar-2A add-ons plus a SARB-set countercyclical buffer (CCyB, 0% in the build phase) on top (ADOPTION_EDGES MODIFIES, basel-adoption.ts).",
    rationale:
      "MODIFIES -> judged stricter: the Basel 2.5% buffer outcome is fully preserved and SA layers additional CET1 demands (P2A + CCyB) above it — a national gold-plate, not a divergence.",
    confidence: 0.85,
    citations: ["urn:reg:za:regs-relating-to-banks:reg38"],
  },
  {
    saObligationId: "ORG-PR-03",
    bcbsObligationId: "BCBS-RBC-s30.2",
    provision: "urn:reg:bcbs:rbc:30.2",
    verdict: "sa-stricter-gold-plates",
    delta:
      "SA holds the 2.5% CET1 conservation buffer and adds Pillar-2A + a SARB-set countercyclical buffer above it (ADOPTION_EDGES MODIFIES, basel-adoption.ts); ORG-PR-03 is the explicit buffer-maintenance obligation.",
    rationale:
      "MODIFIES -> judged stricter: ORG-PR-03 requires the Basel conservation buffer plus the SA CCyB where prescribed; the Basel outcome is preserved and tightened, so a gold-plate.",
    confidence: 0.85,
    citations: ["urn:reg:za:regs-relating-to-banks:reg38"],
  },

  // ── CRE — credit + counterparty credit risk (Reg 23 / Reg 38) ────────────
  // cre:20.8 ADOPTS (with a national-discretion delta that Basel itself permits)
  // → equivalent. The 0%-weight on ZAR RSA sovereign is the discretion CRE20.8
  // expressly grants, so the outcome is within the Basel rule, not divergent.
  {
    saObligationId: "ORG-PR-RETURNS-007",
    bcbsObligationId: "BCBS-CRE-s20.8",
    provision: "urn:reg:bcbs:cre:20.8",
    verdict: "equivalent",
    delta:
      "PA exercises the national discretion CRE20.8 itself grants to 0%-weight ZAR-denominated RSA sovereign exposures (ADOPTION_EDGES ADOPTS + delta) — a permitted in-rule election, not a departure.",
    rationale:
      "ADOPTS: the BA 200 standardised credit-risk return adopts the CRE20.8 sovereign risk-weight table; the ZAR-sovereign 0% is the national discretion Basel expressly permits, so the outcome is equivalent.",
    confidence: 0.9,
    citations: [
      "urn:reg:za:regs-relating-to-banks:reg23",
      "urn:reg:za:regs-relating-to-banks:reg38",
    ],
  },
  {
    saObligationId: "ORG-PR-RETURNS-007",
    bcbsObligationId: "BCBS-CRE-s20.32",
    provision: "urn:reg:bcbs:cre:20.32",
    verdict: "equivalent",
    rationale:
      "ADOPTS (basel-adoption.ts): the BA 200 standardised credit-risk return adopts the CRE20.32 corporate risk-weight table (20%–150% by rating; unrated IG 65%) unchanged; same outcome.",
    confidence: 0.92,
    citations: [
      "urn:reg:za:regs-relating-to-banks:reg23",
      "urn:reg:za:regs-relating-to-banks:reg38",
    ],
  },
  {
    saObligationId: "ORG-PR-RETURNS-007",
    bcbsObligationId: "BCBS-CRE-s22.67",
    provision: "urn:reg:bcbs:cre:22.67",
    verdict: "equivalent",
    rationale:
      "ADOPTS (basel-adoption.ts): SA-CCR EAD = alpha x (RC + PFE), alpha = 1.4, is adopted verbatim via Reg 23/38 and consumed by the bank's SA-CCR engine; same outcome.",
    confidence: 0.92,
    citations: [
      "urn:reg:za:regs-relating-to-banks:reg23",
      "urn:reg:za:regs-relating-to-banks:reg38",
    ],
  },

  // ── MAR — market risk (Reg 28 / Reg 38) ──────────────────────────────────
  // mar:20.1 MODIFIES → judged materially-divergent. SA applies a simplified
  // instrument-class market-RWA proxy in the build phase pending FRTB-SA, so the
  // computed standardised charge differs materially from the Basel SbM+DRC+RRAO.
  {
    saObligationId: "ORG-PR-19",
    bcbsObligationId: "BCBS-MAR-s20.1",
    provision: "urn:reg:bcbs:mar:20.1",
    verdict: "materially-divergent",
    delta:
      "During the build phase the bank applies a simplified instrument-class market-RWA proxy in place of the full FRTB standardised charge (SbM + DRC + RRAO), pending FRTB-SA commencement (PA PC 18/2024) (ADOPTION_EDGES MODIFIES, basel-adoption.ts).",
    rationale:
      "MODIFIES -> judged divergent: the simplified proxy produces a materially different capital number than the Basel standardised approach, so this is a CONFLICTS_WITH until FRTB-SA lands; tracked as a known build-phase deviation (ORG-PR-33 roadmap).",
    confidence: 0.8,
    citations: [
      "urn:reg:za:regs-relating-to-banks:reg28",
      "urn:reg:za:regs-relating-to-banks:reg38",
    ],
  },
  // mar:33.1 ADOPTS → equivalent. Expected-shortfall at 97.5% (IMA) adopted unchanged.
  {
    saObligationId: "ORG-PR-19",
    bcbsObligationId: "BCBS-MAR-s33.1",
    provision: "urn:reg:bcbs:mar:33.1",
    verdict: "equivalent",
    rationale:
      "ADOPTS (basel-adoption.ts): the internal-models expected-shortfall measure at 97.5% one-tailed is adopted unchanged via Reg 38; same outcome (the bank uses SA, so this binds only on any future IMA election).",
    confidence: 0.85,
    citations: ["urn:reg:za:regs-relating-to-banks:reg38"],
  },
  // mar:32.18 ADOPTS → equivalent. 99% one-day VaR backtesting adopted unchanged.
  {
    saObligationId: "ORG-PR-19",
    bcbsObligationId: "BCBS-MAR-s32.18",
    provision: "urn:reg:bcbs:mar:32.18",
    verdict: "equivalent",
    rationale:
      "ADOPTS (basel-adoption.ts): the 99% one-tailed one-day VaR backtesting standard is adopted unchanged via Reg 38; same outcome (the bank's VaR engine calibrates to 99%).",
    confidence: 0.88,
    citations: ["urn:reg:za:regs-relating-to-banks:reg38"],
  },

  // ── LCR — liquidity coverage (Reg 26) ─────────────────────────────────────
  // All four lcr edges are ADOPTS → equivalent for both SA-side obligations
  // (ORG-PR-06 the live LCR obligation, ORG-PR-36 the Revised-LCR Directive D6/2015).
  {
    saObligationId: "ORG-PR-06",
    bcbsObligationId: "BCBS-LCR-s20.5",
    provision: "urn:reg:bcbs:lcr:20.5",
    verdict: "equivalent",
    rationale:
      "ADOPTS (basel-adoption.ts): Reg 26 adopts the LCR >=100% requirement over a 30-day stress unchanged; same outcome (the bank's internal B2 floor is a RAS buffer above this, captured separately).",
    confidence: 0.93,
    citations: ["urn:reg:za:regs-relating-to-banks:reg26"],
  },
  {
    saObligationId: "ORG-PR-36",
    bcbsObligationId: "BCBS-LCR-s20.5",
    provision: "urn:reg:bcbs:lcr:20.5",
    verdict: "equivalent",
    rationale:
      "ADOPTS (basel-adoption.ts): SARB Directive 6 of 2015 (Revised LCR) amends Reg 26 to implement the Basel LCR >=100% requirement in SA from 1 Jan 2015; same outcome.",
    confidence: 0.9,
    citations: ["urn:reg:za:regs-relating-to-banks:reg26"],
  },
  {
    saObligationId: "ORG-PR-06",
    bcbsObligationId: "BCBS-LCR-s30.43",
    provision: "urn:reg:bcbs:lcr:30.43",
    verdict: "equivalent",
    rationale:
      "ADOPTS (basel-adoption.ts): the L1 0% / L2A 15% / L2B 25–50% HQLA haircuts and the L2 40% / L2B 15% caps are operationalised in the SA HQLA schedule under Reg 26; same outcome.",
    confidence: 0.9,
    citations: ["urn:reg:za:regs-relating-to-banks:reg26"],
  },
  {
    saObligationId: "ORG-PR-36",
    bcbsObligationId: "BCBS-LCR-s30.43",
    provision: "urn:reg:bcbs:lcr:30.43",
    verdict: "equivalent",
    rationale:
      "ADOPTS (basel-adoption.ts): D6/2015 carries the Basel HQLA haircut schedule into the amended Reg 26 (incl. the SA FX-LCR formula + RCLF treatment, which are national-discretion mechanics within the LCR framework); same outcome.",
    confidence: 0.85,
    citations: ["urn:reg:za:regs-relating-to-banks:reg26"],
  },
  {
    saObligationId: "ORG-PR-06",
    bcbsObligationId: "BCBS-LCR-s40.1",
    provision: "urn:reg:bcbs:lcr:40.1",
    verdict: "equivalent",
    rationale:
      "ADOPTS (basel-adoption.ts): the stressed run-off rate schedule (stable retail 3–5%, less-stable 10%, operational wholesale 25%, non-operational up to 100%) is adopted via Reg 26; same outcome.",
    confidence: 0.9,
    citations: ["urn:reg:za:regs-relating-to-banks:reg26"],
  },
  {
    saObligationId: "ORG-PR-36",
    bcbsObligationId: "BCBS-LCR-s40.1",
    provision: "urn:reg:bcbs:lcr:40.1",
    verdict: "equivalent",
    rationale:
      "ADOPTS (basel-adoption.ts): D6/2015 carries the Basel net-cash-outflow run-off rates into the amended Reg 26; same outcome.",
    confidence: 0.85,
    citations: ["urn:reg:za:regs-relating-to-banks:reg26"],
  },
  {
    saObligationId: "ORG-PR-06",
    bcbsObligationId: "BCBS-LCR-s40.77",
    provision: "urn:reg:bcbs:lcr:40.77",
    verdict: "equivalent",
    rationale:
      "ADOPTS (basel-adoption.ts): the 75% inflow-recognition cap is adopted unchanged via Reg 26; same outcome.",
    confidence: 0.92,
    citations: ["urn:reg:za:regs-relating-to-banks:reg26"],
  },
  {
    saObligationId: "ORG-PR-36",
    bcbsObligationId: "BCBS-LCR-s40.77",
    provision: "urn:reg:bcbs:lcr:40.77",
    verdict: "equivalent",
    rationale:
      "ADOPTS (basel-adoption.ts): D6/2015's amended Reg 26 carries the Basel 75% inflow-recognition cap; same outcome.",
    confidence: 0.88,
    citations: ["urn:reg:za:regs-relating-to-banks:reg26"],
  },

  // ── NSF — net stable funding (Reg 26 / Reg 26A) ───────────────────────────
  // nsf:20.2 + nsf:30.1 ADOPTS → equivalent. ASF/RSF factors + 100% requirement
  // adopted (the ZAR national-discretion phase-out under D1/2023 is an in-framework
  // factor calibration, not a divergent outcome).
  {
    saObligationId: "ORG-PR-07",
    bcbsObligationId: "BCBS-NSF-s20.2",
    provision: "urn:reg:bcbs:nsf:20.2",
    verdict: "equivalent",
    rationale:
      "ADOPTS (basel-adoption.ts): Reg 26(14) adopts the NSFR >=100% (ASF / RSF) ongoing requirement unchanged; same outcome.",
    confidence: 0.92,
    citations: ["urn:reg:za:regs-relating-to-banks:reg26a"],
  },
  {
    saObligationId: "ORG-PR-07",
    bcbsObligationId: "BCBS-NSF-s30.1",
    provision: "urn:reg:bcbs:nsf:30.1",
    verdict: "equivalent",
    rationale:
      "ADOPTS (basel-adoption.ts): the ASF/RSF factor tables are adopted via Reg 26(14); SARB D1/2023's ZAR national-discretion phase-out is an in-framework factor calibration, not a different outcome.",
    confidence: 0.85,
    citations: ["urn:reg:za:regs-relating-to-banks:reg26a"],
  },

  // ── LEX — large exposures (Reg 24 / D3/2022) ──────────────────────────────
  // lex:10.8 ADOPTS → equivalent. The single/connected-counterparty 25% Tier-1
  // cap is adopted via Reg 24(6)–(8); D3/2022's phased D-SIB-to-D-SIB tightening
  // (18%/15%) is stricter ONLY for D-SIBs — Hoz Bank is not a D-SIB, so its
  // binding cap is the Basel 25%, an equivalent outcome.
  {
    saObligationId: "ORG-PR-40",
    bcbsObligationId: "BCBS-LEX-s10.8",
    provision: "urn:reg:bcbs:lex:10.8",
    verdict: "equivalent",
    rationale:
      "ADOPTS (basel-adoption.ts): Reg 24(6)–(8) read with D3/2022 adopts the 25%-of-Tier-1 single/connected-counterparty large-exposure cap; the phased D-SIB-to-D-SIB tightening (18%/15%) binds only D-SIBs, and Hoz Bank is not a D-SIB, so its cap is the Basel 25% — equivalent outcome.",
    confidence: 0.88,
    citations: ["urn:reg:za:regs-relating-to-banks:reg24"],
  },
];

// ---------------------------------------------------------------------------
// Emit
// ---------------------------------------------------------------------------

const alreadyClassified = new Set<string>();
for (const e of eventStore.replay({ type: "ObligationEquivalenceClassified" })) {
  const p = e.payload as ObligationEquivalenceClassifiedPayload;
  alreadyClassified.add(`${p.saObligationId}::${p.bcbsObligationId}`);
}

const asOf = clock.now();
let emitted = 0;
let skipped = 0;

for (const spec of SPECS) {
  const key = `${spec.saObligationId}::${spec.bcbsObligationId}`;
  if (alreadyClassified.has(key)) {
    console.log(`  skip  ${key} — already classified (idempotent).`);
    skipped++;
    continue;
  }

  const payload: ObligationEquivalenceClassifiedPayload = {
    saObligationId: spec.saObligationId,
    bcbsObligationId: spec.bcbsObligationId,
    verdict: spec.verdict,
    ...(spec.delta !== undefined ? { delta: spec.delta } : {}),
    rationale: spec.rationale,
    classifiedBy: "Mira (Compliance / RegTech engineer, engineering)",
    confidence: spec.confidence,
    asOf,
  };

  const event = makeObligationEquivalenceClassified({
    asOf,
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "service", id: "agent:Mira" },
    citations: ["D-OBLIGATIONS-REGISTER-CLEANUP", spec.saObligationId, ...spec.citations],
    payload,
  });

  eventStore.append(event);
  emitted++;
  console.log(`  emit  ${key} → ${spec.verdict} (${event.event_id}).`);
}

console.log(
  `\nauthor-obligation-equivalence-verdicts: ${emitted} emitted, ${skipped} skipped (already classified). Total specs: ${SPECS.length}.`,
);
