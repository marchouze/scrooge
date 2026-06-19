// scripts/record-d-acct-schema-home-and-fx-postings.ts
//
// Records two CEO decisions approved by Marc in-session 2026-06-18 via
// Scrooge session-delegation (Marc is the authorising principal; Scrooge is
// the recording instrument — recordedVia: scrooge:session-delegation).
//
//   1. D-ACCT-SCHEMA-CANONICAL-HOME — name v2-core as the single canonical
//      home for accounting schemas (FIL menu, treatment menu, posting rules),
//      Zod-first; consolidate the dual-sourced chart-of-accounts to one source;
//      give the posting-rule registry a Zod schema and relocate it into the
//      v2-core posting-rules spine; add recon:accounting-schema-home (advisory
//      first, then harden to enforcing).
//
//   2. D-ACCT-FX-IFRS-POSTING-COMPLETENESS — complete IFRS-compliant postings
//      for every accounting permutation of the FIL FX product (settlement /
//      realised-P&L, derecognition with realised-P&L reversal, swap near/far
//      leg decomposition, NDF fixing + cash-only settlement, FVOCI→P&L
//      reclassification), and surface the accounting determination on the V2
//      NPA page. Cites (does not supersede) D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD.
//
// Idempotent — skips either decision that is already approved.

import "../platform/event-store/resolve-event-db-boot";
import { eventStore } from "../platform/composition";
import { recordDecision } from "../runtime/decisions/record";

const APP_AT = "2026-06-18T00:00:00.000Z";

function alreadyApproved(decisionId: string): boolean {
  return [...eventStore.replay({ type: "Decision" })].some((e) => {
    const p = e.payload as { decisionId?: string; phase?: string };
    return p.decisionId === decisionId && p.phase === "approved";
  });
}

const results: Array<{ decisionId: string; eventId: string | "skipped" }> = [];

// ---------------------------------------------------------------------------
// 1. D-ACCT-SCHEMA-CANONICAL-HOME
// ---------------------------------------------------------------------------
const D1 = "D-ACCT-SCHEMA-CANONICAL-HOME";
if (alreadyApproved(D1)) {
  console.log(`[record] ${D1} already approved — skipping.`);
  results.push({ decisionId: D1, eventId: "skipped" });
} else {
  const r = recordDecision(
    {
      decisionId: D1,
      phase: "approved",
      authority: "CEO",
      authorityRef: "marc@tgv.co.za",
      category: "engineering",
      title: "Canonical home + conventions for accounting schemas (v2-core, Zod-first)",
      recommendation:
        "Approved. v2-core is the single canonical home for accounting schemas, organised on the three modular axes of D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD: FIL menu (v2-core/fil-core), treatment menu (v2-core/reporting-treatments) and posting rules (relocate to v2-core/posting-rules). Conventions made binding: Zod-first single source (v1 side only re-exports + wires the event-store registry row); registries exported as shareable constants consumed identically by seeds and tests; pure folds, no stored postings. Close two gaps: (a) consolidate the dual-sourced chart-of-accounts (chart-of-accounts.json + coa-registry.ts) to a single Zod source in v2-core, generating or retiring the JSON and repointing gl-projection; (b) give posting-rule-registry.ts a Zod schema and relocate it into v2-core/posting-rules alongside the lifted pure rule functions. Add recon:accounting-schema-home (advisory first: no accounting schema hand-declared outside v2-core, CoA single-source, every treatment-referenced posting rule resolves) then harden to enforcing per the Engineering Charter.",
      rationale:
        "Reviewed interactively 2026-06-18. The modular fold already put determination canonical at the approved Product with treatment/FIL/IFRS schemas in v2-core; this names that arrangement as the standard and closes the residual fragmentation (CoA dual-sourced; posting-rule registry plain-TS while adjacent schemas are Zod). Recon-gate-first ordering surfaces the true scope of schemas living outside v2-core before any files move.",
      citations: [],
      sourceDocHashes: [],
      recordedVia: "scrooge:session-delegation",
    },
    APP_AT,
  );
  console.log(`[record] ${D1} approved — ${r.eventId}`);
  results.push({ decisionId: D1, eventId: r.eventId });
}

// ---------------------------------------------------------------------------
// 2. D-ACCT-FX-IFRS-POSTING-COMPLETENESS
// ---------------------------------------------------------------------------
const D2 = "D-ACCT-FX-IFRS-POSTING-COMPLETENESS";
if (alreadyApproved(D2)) {
  console.log(`[record] ${D2} already approved — skipping.`);
  results.push({ decisionId: D2, eventId: "skipped" });
} else {
  const r = recordDecision(
    {
      decisionId: D2,
      phase: "approved",
      authority: "CEO",
      authorityRef: "marc@tgv.co.za",
      category: "finance",
      title:
        "Complete IFRS-compliant postings for all FIL FX accounting permutations + NPA surfacing",
      recommendation:
        "Approved. Build IFRS-compliant posting rules covering every accounting permutation of the FIL FX product as lifted pure functions in the v2-core posting-rules spine: settlement cash / realised-P&L recognition (IAS 21.23/.28), derecognition with realised-P&L reversal replacing the current zero-amount memo (IFRS 9 §3.2.3), FX swap near/far leg decomposition, NDF fixing P&L + cash-only settlement (no principal exchange), and FVOCI→P&L reclassification on derecognition (IFRS 9 §5.7.10-11). Existing PR-FX-001-V2 (initial recognition, IFRS 9 §3.1.1), PR-FX-REVAL-V2 (revaluation incl. FVOCI election, IFRS 9 §5.7.1/.5) are retained. Each new rule carries an IFRS citation and a posting-rule registry entry, and is proven by an engine unit test (legs balance; sum to zero per currency). Surface the accounting determination already present in the product fixture (IFRS 9 family, IFRS 13 hierarchy, IAS 21 treatment, BA-return mapping, treatment modules, per-lifecycle-event posting-rule status) as an 'Accounting treatment' section on the V2 NPA product page, name-masked per the V2 seat-Title convention.",
      rationale:
        "Reviewed interactively 2026-06-18 against a gap analysis of the FX vertical (PRs #1415-1418): three V2 rules exist (init/reval/close) but settlement/realised-P&L, proper derecognition reversal, swap near/far, NDF fixing+cash-settle and FVOCI reclassification are missing or stubbed; the NPA page already carries the accounting data in its DTO but never renders it. FX IFRS treatment (FVTPL, with FVOCI election) is settled policy; these are the mechanical completions, not new policy. Sequenced after D-ACCT-SCHEMA-CANONICAL-HOME because new rules must land into the relocated Zod posting-rule registry (shared-file collision otherwise).",
      citations: [],
      sourceDocHashes: [],
      followOnDispatch: [{ route: "accounting-engineer:fx-posting-completeness" }],
      recordedVia: "scrooge:session-delegation",
    },
    APP_AT,
  );
  console.log(`[record] ${D2} approved — ${r.eventId}`);
  results.push({ decisionId: D2, eventId: r.eventId });
}

console.log(JSON.stringify({ ok: true, results }, null, 2));
