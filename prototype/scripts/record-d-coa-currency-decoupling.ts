import { recordDecision } from "../runtime/decisions/record.ts";

const result = recordDecision(
  {
    decisionId: "D-COA-CURRENCY-DECOUPLING",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title:
      "COA currency-decoupling; central-bank reserve account + ZAR nostro; USD/EUR 1100→1200 merge",
    category: "engineering",
    recommendation:
      "Decouple currency from Chart-of-Accounts account names and make currency a first-class dimension. Add a `currency` field to CoaAccountEntry, the Zod schema, and chart-of-accounts.json; set it on every single-currency account and OMIT it on the genuinely multi-currency FCY pool accounts (ACC-2100-002 FX Trading Receivable FCY, ACC-2100-004 FX Trading Payable FCY). Strip every currency token and wrong descriptor from account names (e.g. 'Nostro — USD (correspondent)' → 'Nostro'; 'FX Trading Receivable — ZAR' → 'FX Trading Receivable'; 'Bank — ZAR' → 'Bank'); keep non-currency parentheticals such as '(Amortised Cost)'. Repurpose ACC-1100-001 as the Central Bank Reserve Account (a reserve/settlement balance held AT the SARB; NOT a nostro) retaining custodianPartyId urn:party:legal-entity:sarb so the BA 110 cash-HQLA fold derives Level-1; the SARB identity lives in the custodian field, never the name. ACC-1200-001 becomes the everyday ZAR correspondent nostro and the FX settlement target for ZAR. Merge the duplicate USD/EUR 1100 nostros (ACC-1100-002/003) into ACC-1200-002/003: repoint FX_ACCOUNTS and every non-historical reference; keep the 1100 ids resolvable (clean 'Nostro' name + currency field + deprecation note) so historical ledger entries still render; new postings target the 1200 ids. Add a recon:coa-name-no-currency gate (wired into ci:recon:domain) asserting COA names contain no currency token and no '(SARB' so the rule is non-regressable.",
    rationale:
      "Marc raised four COA defects: (1) 'Nostro — ZAR (SARB operational)' is mis-named — a nostro is not a SARB account and the '(SARB operational)' descriptor is wrong on a nostro; (2) the bank is multi-currency/multi-entity/multi-jurisdiction, so ZAR is not permanently the base currency — from a COA perspective ZAR is just another currency account, and ZAR's operational role as reporting/base currency is presentation, not data (Principle 5); (3) account names must not embed currency (currency is a separate field); (4) the same applies to FX Trading Receivable/Payable, Customer Payables, Payment Suspense, Settlement Receivable, Settlement-Failed Receivable, FX Settlement Suspense, and Bank. Marc then refined the SARB/nostro treatment: keep BOTH a SARB central-bank reserve account AND a normal ZAR correspondent nostro — they are different account TYPES, not duplicates. Therefore ACC-1100-001 is repurposed as the Central Bank Reserve Account (Level-1 cash HQLA PRESERVED via the central-bank custodian; Reg 26(7)(a)(i); BCBS D295 §50(a)) and ACC-1200-001 is the ZAR correspondent nostro / FX settlement target; only the USD/EUR 1100 nostros are genuine duplicates and are merged into the 1200 range. Consequence verified: BA 110 cash-HQLA fold still derives Level-1 for the reserve account (custodian-derived) and NOT for the correspondent nostros. Events are immutable — the USD/EUR 1100 ids stay resolvable for historical entries; history is never rewritten. Marc approved this design and the refinement in session on 2026-05-30.",
    sourceDocHashes: [],
    citations: [],
    recordedVia: "scrooge:session-delegation",
  },
  new Date().toISOString(),
);

console.log(JSON.stringify(result, null, 2));
