// scripts/backfill-policy-version-activated-valuation-v1.ts
//
// Slice A.1 of D-EVENT-VIEW-BOUNDARY-WIRE.
//
// Emits the founding PolicyVersionActivated event for VALUATION-POLICY-V1
// v1.0, effective 2026-05-19. This event is the machine-readable anchor
// that `OfficialMarkAdopted.policyVersionRef` (Slice B) resolves to, and
// the load-bearing audit artefact answering "which valuation policy version
// governed at time T?" for replay determinism.
//
// Why a backfill script?
//   Policies/valuation-policy-v1.md was authored (Helena, 2026-05-19) and
//   the `PolicyVersionActivated` event type was codified (Slice A, PR #626,
//   2026-05-20) after the policy was filed. A boot-time event fills the gap;
//   once emitted it is durable and idempotent on every subsequent CI run.
//
// Idempotency:
//   The script checks for an existing PolicyVersionActivated row with
//   policyId="VALUATION-POLICY-V1" and policyDomain="valuation" before
//   appending. Re-running has no effect.
//
// Document hash:
//   blake3:2e3163f0f1c77812d494f646acc3e8bd9da10b8ec63a2339904609018a5300c2
//   Computed from Policies/valuation-policy-v1.md at PR #626 head.
//   Verified: bun -e "import {hashContent} from './platform/document-store/hash';
//   import {readFileSync} from 'fs'; console.log(hashContent(readFileSync('../Policies/valuation-policy-v1.md','utf8')))"
//
// Authority: D-EVENT-VIEW-BOUNDARY-WIRE (CEO-approved 2026-05-20, PR #620).
//
// Author: Atlas (Core banking platform architect, engineering)

import { eventStore } from "../platform/composition";
import { makePolicyVersionActivated } from "../platform/event-store/event-types/policy-activation";
import { logger } from "../platform/observability/logger";

const POLICY_ID = "VALUATION-POLICY-V1";
const POLICY_DOMAIN = "valuation" as const;
const AS_OF = "2026-05-19T08:00:00.000Z";
const EFFECTIVE_FROM = "2026-05-19T00:00:00Z";
const DOCUMENT_HASH = "blake3:2e3163f0f1c77812d494f646acc3e8bd9da10b8ec63a2339904609018a5300c2";

function alreadyActivated(): boolean {
  for (const e of eventStore.replay({ type: "PolicyVersionActivated" })) {
    const p = e.payload as { policyId: string; policyDomain: string };
    if (p.policyId === POLICY_ID && p.policyDomain === POLICY_DOMAIN) return true;
  }
  return false;
}

function main(): number {
  if (alreadyActivated()) {
    logger.info(
      { policyId: POLICY_ID, policyDomain: POLICY_DOMAIN },
      "backfill-policy-version-activated-valuation-v1 — skipped (event already in store)",
    );
    return 0;
  }

  const event = makePolicyVersionActivated({
    asOf: AS_OF,
    entity: "LE-ZA-HOZ-BANK",
    actor: { id: "agent:helena:cro", type: "service" },
    citations: [
      "D-EVENT-VIEW-BOUNDARY-WIRE",
      "D-MARKETS-SCHEMA-FOUNDATION",
      "P1-EVENTS-AS-TRUTH",
      "Policies/valuation-policy-v1.md",
    ],
    payload: {
      policyDomain: POLICY_DOMAIN,
      policyId: POLICY_ID,
      version: "1.0",
      effectiveFrom: EFFECTIVE_FROM,
      documentHash: DOCUMENT_HASH,
      supersedes: null,
      activatedBy: "agent:helena:cro",
    },
  });

  eventStore.append(event);

  logger.info(
    {
      eventId: event.event_id,
      policyId: POLICY_ID,
      version: "1.0",
      effectiveFrom: EFFECTIVE_FROM,
      documentHash: DOCUMENT_HASH,
    },
    "PolicyVersionActivated emitted — VALUATION-POLICY-V1 v1.0 (founding activation)",
  );

  return 0;
}

process.exit(main());
