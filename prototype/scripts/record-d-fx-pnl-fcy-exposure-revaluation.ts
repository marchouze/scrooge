// scripts/record-d-fx-pnl-fcy-exposure-revaluation.ts
//
// Records one CEO decision approved by Marc in-session 2026-06-25 via Scrooge
// session-delegation (Marc is the authorising principal; Scrooge is the recording
// instrument — recordedVia: scrooge:session-delegation).
//
//   D-FX-PNL-FCY-EXPOSURE-REVALUATION — Correct the FX trading-book P&L model. P&L
//   is the change in functional-currency (ZAR) value of the foreign-currency
//   exposure, carried at a ZAR cost basis. It is UNREALISED while the exposure is
//   open — and the exposure stays open ACROSS settlement (a forward receivable
//   becoming cash is a change of FORM, not of exposure). Realised P&L arises ONLY
//   when the FCY is converted back to ZAR (the position is squared). Settlement is
//   NOT a realisation event. Settled FCY cash is revalued identically to an
//   unsettled FX contract.
//
// Supersedes the settlement realised-P&L basis introduced by #1536 under
// D-FX-TRADE-DATE-FVTPL-OBS (the OBS/FVTPL trade-date treatment stands; only the
// realised/unrealised boundary + revaluation scope change).
//
// Idempotent — skips if already approved.

import "../platform/event-store/resolve-event-db-boot";
import { eventStore } from "../platform/composition";
import { recordDecision } from "../runtime/decisions/record";

const APP_AT = "2026-06-25T00:00:00.000Z";
const D = "D-FX-PNL-FCY-EXPOSURE-REVALUATION";

function alreadyApproved(decisionId: string): boolean {
  return [...eventStore.replay({ type: "Decision" })].some((e) => {
    const p = e.payload as { decisionId?: string; phase?: string };
    return p.decisionId === decisionId && p.phase === "approved";
  });
}

if (alreadyApproved(D)) {
  console.log(`[record] ${D} already approved — skipping.`);
} else {
  const r = recordDecision(
    {
      decisionId: D,
      phase: "approved",
      authority: "CEO",
      authorityRef: "marc@tgv.co.za",
      category: "engineering",
      title:
        "FX trading-book P&L = revaluation of the FCY exposure to ZAR; settlement is not realisation; realised only on FCY→ZAR conversion; settled FCY cash revalued like an open contract",
      recommendation:
        "Approved. (1) FX P&L is measured as the change in functional-currency (ZAR) value of the foreign-currency exposure, carried at a ZAR cost basis (the ZAR given up / received to acquire the FCY). (2) The P&L is UNREALISED for as long as the exposure is open, and the exposure remains open ACROSS settlement — a forward/spot receivable becoming cash is a change of FORM (same currency, same amount, same ZAR cost basis), NOT a change of exposure. Settlement is therefore P&L-neutral: it recognises the received FCY as cash carried at its ZAR cost basis, pays the ZAR, and releases the OBS commitment — it must NOT post realised P&L (remove the settlement realised-P&L legs introduced in #1536). (3) Realised FX P&L arises ONLY when the FCY is converted back to ZAR (the position is squared): realised = ZAR conversion proceeds − ZAR cost basis of the FCY sold; the cumulative unrealised is reclassified into realised on conversion (total P&L unchanged), and the position reduces. (4) Revaluation: each reporting date, EVERY open FCY monetary position — open FX contracts AND settled FCY cash balances (Nostro) — is marked to ZAR at closing spot; the change is unrealised FX P&L (IAS 21 §28; IFRS 9 FVTPL for the derivative phase). Settled FCY cash is revalued identically to an unsettled FX contract — the revaluation/P&L engine must NOT drop a position when its originating trade settles. (5) The OBS notional disclosure + nil-at-inception trade-date treatment from D-FX-TRADE-DATE-FVTPL-OBS stand; only the realised/unrealised boundary and the revaluation scope change. (6) Apply across both posting-rule copies (v2-core fold + gl-posting-engine-v2) keeping recon:gl-v2-fold-equivalence-fx byte-equivalent; add a FCY→ZAR conversion (realisation) event; widen the cohort revaluation/daily-P&L engine to FCY cash; add a recon asserting settlement is P&L-neutral and that settled FCY cash is revalued.",
      rationale:
        "Decided interactively 2026-06-25. The CEO observed that #1536's settlement realised-P&L is conceptually wrong: a settled FX trade is not a realisation. The correct trading-book model (IAS 21 monetary-item retranslation; IFRS 9 FVTPL) measures P&L as the change in ZAR value of the FCY exposure, continuously and unrealised, regardless of whether the exposure is held as an unsettled forward or as settled cash — they are the same exposure in different forms. Realisation occurs only on conversion back to functional currency. The prior implementation (a) treated settlement as realisation, (b) measured 'realised P&L' as the net of two gross FCY legs (a P&L account left holding a foreign-currency balance that re-floats with spot), and (c) stopped revaluing a position once its trade settled (the settled FCY cash's ongoing FX exposure was lost). This decision corrects all three. It refines, and does not undo, the OBS/FVTPL trade-date treatment of D-FX-TRADE-DATE-FVTPL-OBS.",
      citations: [],
      sourceDocHashes: [],
      recordedVia: "scrooge:session-delegation",
    },
    APP_AT,
  );
  console.log(`[record] ${D} approved — ${r.eventId}`);
}

const stillOpen = [...eventStore.replay({ type: "Decision" })].some((e) => {
  const p = e.payload as { decisionId?: string; phase?: string };
  return p.decisionId === D && p.phase === "requested";
});
console.log(`[verify] ${D} open(requested) present: ${stillOpen}`);
