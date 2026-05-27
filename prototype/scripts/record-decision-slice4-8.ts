import { recordDecision } from "../runtime/decisions/record.ts";

const result = recordDecision(
  {
    decisionId: "D-PRODUCT-CONSTRUCTION-SLICES-4-8",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title:
      "Product-construction substrate Slices 4–8: policy-attestation runtime, M1–M4 NPA attestations, Vera attestation-integrity recon",
    category: "engineering",
    recommendation:
      "Dispatch PR-D (Slices 4–6: shared attestation runtime + NPA events for 5 products) and PR-E (Slice 8: Vera ProductApproved-precedes-14-attestations recon gate). Slice 7 gaps (model-risk/Nadia) tracked as info findings.",
    rationale:
      "Both D-PRODUCT-CONSTRUCTION-SUBSTRATE and D-NEW-PRODUCT-APPROVAL-POLICY are landed; M3 IRS fixture and RWA-delta estimator (PR #820) allow capital dimension to move to implementation-attested for M3; trade book (PR #822) books equity/bond/IRS but no ProductApproved events exist in the production event store. Slices 4–6 fill that gap; Slice 8 adds the Vera gate to lock the invariant.",
    sourceDocHashes: [],
    citations: ["D-PRODUCT-CONSTRUCTION-SUBSTRATE", "D-NEW-PRODUCT-APPROVAL-POLICY"],
    recordedVia: "scrooge:session-delegation",
  },
  new Date().toISOString(),
);

console.log(JSON.stringify(result, null, 2));
