// scripts/record-d-domain-ownership-map.ts
//
// Records D-DOMAIN-OWNERSHIP-MAP (CEO-approved 2026-06-14 via plan approval /
// session-delegation). Marc is the authorising principal; Scrooge is the
// recording instrument (recordedVia: scrooge:session-delegation).
//
// The decision: adopt the v3 normalised regulatory-domain taxonomy (10
// top-level domains, 26 sub-domains, keyed off the stable obligation id-prefix;
// Prudential[capital]→CFO and Risk[risk-measurement]→CRO separated; Treasury &
// Liquidity its own domain → Treasurer; ICAAP co-owned CRO+CFO; Large Exposures
// → CRO; SARB-PA directives decomposed by topic) as the canonical Agent⟺Domain⟺
// Obligation ownership map, overriding the partial basel-family-seat.ts seats.
//
// Idempotent — skips if already approved.

import "../platform/event-store/resolve-event-db-boot";
import { eventStore } from "../platform/composition";
import { recordDecision } from "../runtime/decisions/record";

const DECISION_ID = "D-DOMAIN-OWNERSHIP-MAP";

const already = [...eventStore.replay({ type: "Decision" })].some((e) => {
  const p = e.payload as { decisionId?: string; phase?: string };
  return p.decisionId === DECISION_ID && p.phase === "approved";
});
if (already) {
  console.log(`[record-d-domain-ownership-map] ${DECISION_ID} already approved — skipping.`);
  process.exit(0);
}

const appAt = "2026-06-14T08:15:02.000Z";
const r = recordDecision(
  {
    decisionId: DECISION_ID,
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    category: "governance",
    title:
      "Adopt the v3 normalised domain taxonomy as the canonical Agent⟺Domain⟺Obligation ownership map",
    recommendation:
      "Approved. 10 top-level domains / 26 sub-domains keyed off the stable obligation id-prefix; Prudential (capital→CFO) and Risk (risk-measurement→CRO) separated; Treasury & Liquidity own domain (Treasurer); ICAAP co-owned CRO+CFO; Large Exposures→CRO; SARB-PA directives decomposed by topic. Overrides basel-family-seat.ts seats. Enforced by recon:domain-ownership-coherence (advisory pending owner-drift remediation).",
    rationale:
      "Reviewed interactively 2026-06-14: id-prefix is non-colliding (section letters collide/drift); the map is the single source of truth (basel-family-seat.ts delegates to it). Coverage on two axes: every obligation owned, every domain owned. 255 owner-drift surfaced for a separate governed remediation (Slice 3).",
    sourceDocHashes: [],
    citations: [],
    recordedVia: "scrooge:session-delegation",
  },
  appAt,
);
console.log(JSON.stringify({ ok: true, decisionId: DECISION_ID, eventId: r.eventId }, null, 2));
