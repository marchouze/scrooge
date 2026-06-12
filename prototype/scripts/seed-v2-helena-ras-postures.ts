// scripts/seed-v2-helena-ras-postures.ts
//
// Pilot seed: Helena's (Chief Risk Officer, governance) RAS §B4 risk-appetite
// postures as V2 posture register events (W8 Slice 1).
//
// This script reads the canonical RAS appetite register (read-only) and emits
// PostureRegistered + PostureActivated event pairs for the anchor bank's key
// risk-appetite postures. Idempotent: re-running the script when the postures
// are already active is a no-op (existing active posture → skip).
//
// Pilot postures seeded (minimum per brief §4):
//   posture:risk-appetite:fx-var          FX 1-day 99% VaR limit (RAS §B4)
//   posture:risk-appetite:fx-svar         FX stressed VaR limit (RAS §B4)
//   posture:risk-appetite:fx-es           FX expected shortfall (RAS §B4)
//   posture:risk-appetite:irrbb-delta-eve IRRBB δEVE outlier threshold (RAS §B4)
//   posture:risk-appetite:lcr-floor       LCR floor (RAS §B3)
//
// Each posture reads its thresholds from `platform/risk/ras-appetite-register.ts`
// (read-only; never modified here) and stores them as structured `parameters`
// on the PostureRegistered event.
//
// Run against the shared store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/seed-v2-helena-ras-postures.ts
//
// Authority: D-W8-POSTURE-REGISTER-SLICE-1; D-RAS (CRO-approved 2026-05-06);
//   D-V2-BBAAS-BLUEPRINT-SYNTHESIS. Principle 1 (events are truth).
// Author: Mira (Chief Obligations & Regulatory Officer, compliance)
//         with RAS data from Helena (Chief Risk Officer, governance).

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import {
  makePostureActivated,
  makePostureRegistered,
} from "../platform/event-store/event-types/posture";
import { provenanceForEmit } from "../platform/event-store/provenance";
import type { Event } from "../platform/event-store/types";
import { requireRasAppetiteLine } from "../platform/risk/ras-appetite-register";
import type { AppliesToScope } from "../v2-core/posture/applies-when";
import type { PostureClass, PostureTier } from "../v2-core/posture/events";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "agent:mira:obligations-officer" };

const EVENT_CITATIONS = [
  "D-W8-POSTURE-REGISTER-SLICE-1",
  "D-RAS",
  "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
  "P1-EVENTS-AS-TRUTH",
  "P2-SINGLE-GRAPH-DISCIPLINE",
];

// ---------------------------------------------------------------------------
// Pilot posture definitions
// ---------------------------------------------------------------------------

interface PilotPostureSpec {
  postureId: string;
  rasLineId: string;
  description: string;
  appliesToScope: AppliesToScope;
  appliesToTier: PostureTier;
  postureClass: PostureClass;
  rasSection: string;
  additionalCitations: string[];
}

const PILOT_POSTURES: PilotPostureSpec[] = [
  // ── FX VaR (1-day 99%) ───────────────────────────────────────────────────
  {
    postureId: "posture:risk-appetite:fx-var",
    rasLineId: "appetite:market:trading-var",
    description:
      "FX trading-book 1-day 99% VaR posture: default trading-book VaR as % of CET1 (RAS §B4). " +
      "Governs how agents set VaR limits for the FX OTC vanilla book. " +
      "Calibrated when the FX book opens (licence-day); build-phase = default posture.",
    appliesToScope: {
      kind: "and",
      conditions: [
        { kind: "jurisdiction", jurisdiction: "ZA" },
        { kind: "risk-class", riskClass: "RT-MK" },
        { kind: "product-scope", filTaxonomyScope: "fil:type:fx:*" },
      ],
    },
    appliesToTier: "R",
    postureClass: "risk-appetite",
    rasSection: "RAS §B4",
    additionalCitations: ["D-RAS-STRUCTURED-REGISTER"],
  },
  // ── FX SVaR (stressed VaR) ───────────────────────────────────────────────
  {
    postureId: "posture:risk-appetite:fx-svar",
    rasLineId: "appetite:market:trading-var",
    description:
      "FX stressed VaR posture: applies the RAS §B4 trading-book VaR appetite line to stressed " +
      "scenario conditions (SVaR). SVaR uses the same % of CET1 framework as VaR; the stressed " +
      "window is the most adverse 250-day period for the FX OTC book. Calibrated at licence-day.",
    appliesToScope: {
      kind: "and",
      conditions: [
        { kind: "jurisdiction", jurisdiction: "ZA" },
        { kind: "risk-class", riskClass: "RT-MK" },
        { kind: "product-scope", filTaxonomyScope: "fil:type:fx:*" },
      ],
    },
    appliesToTier: "R",
    postureClass: "risk-appetite",
    rasSection: "RAS §B4",
    additionalCitations: ["D-RAS-STRUCTURED-REGISTER", "D-VAR-EXPOSURE-INCLUDES-STANDING-NOP"],
  },
  // ── FX ES (Expected Shortfall) ───────────────────────────────────────────
  {
    postureId: "posture:risk-appetite:fx-es",
    rasLineId: "appetite:market:trading-var",
    description:
      "FX expected shortfall (ES) posture: expected loss beyond the 99% VaR confidence interval, " +
      "averaged over the tail (RAS §B4 trading-book market-risk appetite, FRTB extension). " +
      "The ES posture governs the 97.5% ES limit alongside the standard VaR/SVaR measures. " +
      "Calibrated at licence-day.",
    appliesToScope: {
      kind: "and",
      conditions: [
        { kind: "jurisdiction", jurisdiction: "ZA" },
        { kind: "risk-class", riskClass: "RT-MK" },
        { kind: "product-scope", filTaxonomyScope: "fil:type:fx:*" },
      ],
    },
    appliesToTier: "R",
    postureClass: "risk-appetite",
    rasSection: "RAS §B4",
    additionalCitations: ["D-RAS-STRUCTURED-REGISTER", "D-VAR-EXPOSURE-INCLUDES-STANDING-NOP"],
  },
  // ── IRRBB δEVE outlier threshold ────────────────────────────────────────
  {
    postureId: "posture:risk-appetite:irrbb-delta-eve",
    rasLineId: "appetite:irrbb:delta-eve-outlier",
    description:
      "IRRBB δEVE outlier threshold posture (RAS §B4, BCBS d365 §A-3.4 supervisory test). " +
      "Maximum |δEVE| under any BCBS d365 shock scenario as % of Tier-1 capital. " +
      "Green <10% Tier-1 / amber 10-15% / red ≥15% (the BCBS d365 §A-3.4 supervisory outlier threshold). " +
      "Breach triggers ALCO escalation and PA notification pathway. " +
      "Measurement: IRRBBChecked.deltaPct from Ravi's ALM run.",
    appliesToScope: {
      kind: "and",
      conditions: [
        { kind: "jurisdiction", jurisdiction: "ZA" },
        { kind: "risk-class", riskClass: "RT-IRRBB" },
      ],
    },
    appliesToTier: "R",
    postureClass: "risk-appetite",
    rasSection: "RAS §B4",
    additionalCitations: [
      "D-RAS-STRUCTURED-REGISTER",
      "D-BOND-RAS-APPETITE",
      "D-IRRBB-DELTA-EVE-OUTLIER-MEASUREMENT",
      "BCBS-D365-IRRBB",
    ],
  },
  // ── LCR floor (RAS §B3) ──────────────────────────────────────────────────
  {
    postureId: "posture:risk-appetite:lcr-floor",
    rasLineId: "appetite:liquidity:lcr",
    description:
      "LCR buffer floor posture (RAS §B3). " +
      "Operate at ≥120% PA minimum in normal conditions; trigger management action <110%; " +
      "mandatory BRC escalation <105%. " +
      "Measurement: computeLCR. Tier-1 breach.",
    appliesToScope: {
      kind: "and",
      conditions: [
        { kind: "jurisdiction", jurisdiction: "ZA" },
        { kind: "risk-class", riskClass: "RT-LQ" },
      ],
    },
    appliesToTier: "R",
    postureClass: "risk-appetite",
    rasSection: "RAS §B3",
    additionalCitations: ["D-RAS-STRUCTURED-REGISTER", "RRTB-REG-26"],
  },
];

// ---------------------------------------------------------------------------
// Idempotency: check existing active postures
// ---------------------------------------------------------------------------

const existingActive = new Set<string>();
for (const ev of eventStore.replay({ type: "PostureActivated" })) {
  const p = ev.payload as { postureId?: string };
  if (p.postureId) existingActive.add(p.postureId);
}
// If later deactivated, remove from active set.
for (const ev of eventStore.replay({ type: "PostureDeactivated" })) {
  const p = ev.payload as { postureId?: string };
  if (p.postureId) existingActive.delete(p.postureId);
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

const batch: Event[] = [];
const asOf = clock.now();

for (const spec of PILOT_POSTURES) {
  if (existingActive.has(spec.postureId)) {
    process.stdout.write(`[skip] ${spec.postureId} — already active\n`);
    continue;
  }

  // Read RAS thresholds from the canonical register (read-only).
  const rasLine = requireRasAppetiteLine(spec.rasLineId);

  const parameters: Record<string, unknown> = {
    rasLineId: rasLine.id,
    rasLabel: rasLine.label,
    rasSection: rasLine.rasSection,
    category: rasLine.category,
    tier: rasLine.tier,
    thresholds: rasLine.thresholds,
    measurementBinding: rasLine.measurementBinding,
    measurementOwner: rasLine.measurementOwner,
  };

  const citations = [...EVENT_CITATIONS, ...spec.additionalCitations, ...rasLine.citations].map(
    (c) => c as string,
  );

  // Emit PostureRegistered.
  batch.push(
    makePostureRegistered({
      asOf,
      entity: ENTITY,
      actor: ACTOR,
      citations,
      payload: {
        postureId: spec.postureId,
        postureClass: spec.postureClass,
        description: spec.description,
        appliesToScope: spec.appliesToScope,
        appliesToTier: spec.appliesToTier,
        proposedBy: "Helena (Chief Risk Officer, governance)",
        citations: citations as unknown as import("../v2-core/fil-core/primitives").CitationRef[],
        parameters,
      },
    }),
  );

  // Emit PostureActivated.
  batch.push(
    makePostureActivated({
      asOf,
      entity: ENTITY,
      actor: ACTOR,
      citations,
      payload: {
        postureId: spec.postureId,
        appliesToScope: spec.appliesToScope,
        activatedAt: asOf as unknown as import("../v2-core/fil-core/primitives").Instant,
        authority: "D-W8-POSTURE-REGISTER-SLICE-1",
        citations: citations as unknown as import("../v2-core/fil-core/primitives").CitationRef[],
      },
    }),
  );

  process.stdout.write(`[queue] ${spec.postureId}\n`);
}

if (batch.length === 0) {
  process.stdout.write(
    "seed:v2-helena-ras-postures — all pilot postures already active; nothing to emit\n",
  );
  process.exit(0);
}

// Append all events.
for (const ev of batch) {
  eventStore.append(ev, { provenance: provenanceForEmit("PostureRegistered") });
}

process.stdout.write(
  `seed:v2-helena-ras-postures — emitted ${batch.length} events (${batch.length / 2} postures registered + activated)\n`,
);
