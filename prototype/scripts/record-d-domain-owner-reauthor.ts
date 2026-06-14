// scripts/record-d-domain-owner-reauthor.ts
// Records D-DOMAIN-OWNER-REAUTHOR (CEO-approved 2026-06-14 in session: "yes
// reauthor"). Re-authors the obligations-register owner column for the 241 ORG-*
// rows whose authored owner drifted from the v3 accountable seat, flipping
// recon:domain-ownership-coherence to enforcing (0 drift). Idempotent.
import "../platform/event-store/resolve-event-db-boot";
import { eventStore } from "../platform/composition";
import { recordDecision } from "../runtime/decisions/record";

const ID = "D-DOMAIN-OWNER-REAUTHOR";
if (
  [...eventStore.replay({ type: "Decision" })].some((e) => {
    const p = e.payload as { decisionId?: string; phase?: string };
    return p.decisionId === ID && p.phase === "approved";
  })
) {
  console.log(`${ID} already approved — skipping.`);
  process.exit(0);
}

const r = recordDecision(
  {
    decisionId: ID,
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    category: "governance",
    title: "Re-author obligation owners to the v3 accountable seats (drift remediation)",
    recommendation:
      "Approved. Re-authored 241 ORG-* register rows whose owner drifted from their domain's accountable seat per D-DOMAIN-OWNERSHIP-MAP; regenerated the seed; recon:domain-ownership-coherence flipped to enforcing (0 owner-drift, 0 orphans, 10/10 domains owned).",
    rationale:
      "Marc approved the bulk owner re-author in session 2026-06-14 ('yes reauthor'). The markdown register is the authored source; seed regenerated from it (seed-parity holds). Live-store propagation + the 14 event-only unset rows handled at deploy.",
    sourceDocHashes: [],
    citations: ["D-DOMAIN-OWNERSHIP-MAP"],
    recordedVia: "scrooge:session-delegation",
  },
  "2026-06-14T08:40:00.000Z",
);
console.log(JSON.stringify({ ok: true, decisionId: ID, eventId: r.eventId }));
