import { recordDecision } from "../runtime/decisions/record.ts";

const result = recordDecision(
  {
    decisionId: "D-BALANCE-SHEET-SUBSTANTIATION-POLICY-V1",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: "Approve Balance Sheet Substantiation Policy v1.0 (FIN-BSS-01)",
    category: "finance",
    recommendation:
      "Approve FIN-BSS-01 v1.0 as the Bank's standalone Balance Sheet Substantiation Policy, promoting it from DRAFT to approved status. The policy establishes nine policy statements covering: completeness (every non-zero GL account must be substantiated before BA-return submission or financial-statement finalisation), source-event traceability (every SubLedgerPostingEmitted must carry a non-null sourceEventId to a recognised primary event), double-entry integrity (debit total = credit total per currency; halt on imbalance), IFRS classification currency (in-force classification required at period-end), suspense zero-balance assertion (ACC-1100-004/005 must be zero at period-end), materiality and exception classification (ZAR 50,000 threshold; three exception kinds: timing-difference / substrate-gap / unexplained), CFO sign-off (auto for clean runs; human-in-loop for exceptions above materiality), documented exceptions (Camille-granted with 5-business-day staleness watchdog), and evidence retention (RETENTION_BANKS_ACT_S90_5Y). Five Vera recon assertions defined: bss-completeness, bss-exception-free-close, bss-cfo-sign-off-attribution, bss-substrate-gap-trend, bss-documented-exception-staleness. BA-return submission gate blocked without BalanceSheetSubstantiationCompleted. Policy parent: FIN-ACCT-01. Implementing procedure: PROC-FIN-BSS-01.",
    rationale:
      "PROC-FIN-BSS-01 (balance sheet substantiation procedure) has been live since 2026-05-12 but has referenced only an Accounting Policies v0.1 stub as its policy parent. ORG-AC-13 (Banks Act Regulations — BA returns) requires that period-end balances underpinning BA 100/300/325/326 submissions are substantiated; this obligation needs a standalone approved policy as its governance anchor, not a stub. The parent FIN-ACCT-01 (Accounting Policies — IFRS v1) covers IFRS measurement and classification but has no substantiation section; a dedicated policy is the correct structural fix. Drafting authority: Bea (Accounting & financial reporting engineer, engineering) on behalf of Camille (CFO, governance). Marc approved in session on 2026-05-30.",
    sourceDocHashes: [],
    citations: ["ORG-AC-13", "FIN-ACCT-01", "PROC-FIN-BSS-01", "D-RMS-PHASE-1"],
    recordedVia: "scrooge:session-delegation",
  },
  new Date().toISOString(),
);

console.log(JSON.stringify(result, null, 2));
