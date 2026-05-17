---
title: "FSCA reg-to-policy recon v1 — initial run results"
author: Vera (Internal audit engineer)
date: 2026-05-12
summary: "New recon pipeline asserting every obligation in the register has a named fulfilment policy with a matching file in Policies/. Initial run findings."
riskTaxonomy: RT-LR.RC
---

# FSCA reg-to-policy recon v1 — initial run results

**Author:** Vera (Internal audit engineer, engineering — functionally to Thandiwe (Chief Audit Executive, governance); administratively through the CEO)  
**Co-author:** Atlas (Core banking platform architect, engineering — reports to Devon COO interim)  
**Date:** 2026-05-12  
**Pipeline:** `platform/recon/fsca-reg-to-policy` (advisory mode)  
**Risk taxonomy:** RT-LR.RC (Legal & Regulatory — Regulatory compliance)

---

## 1. Pipeline description

`platform/recon/fsca-reg-to-policy.ts` is a build-time continuous-controls pipeline that walks every obligation row in `Regulations/_obligations-register.md` and asserts each one has a named fulfilment policy that either:

- **(a)** exists as a file in `Policies/` (pass), or
- **(b)** is explicitly marked as planned/deferred with a named owner (warn), or
- **(c)** is absent or unresolvable (fail for FSCA-sourced rows; warn for non-FSCA rows).

**Scope:** all 259 obligation rows across all domains — not just FSCA. FSCA-sourced rows (Citation column contains "FAIS", "FSCA", "Conduct Standard", "FMA", "CS 1/2/3", "GCC", "General Code") are reported at `fail` severity once the pipeline is promoted to enforcing mode.

**Mode:** advisory (v1). All severities are recorded; `ok: true` is returned so CI passes regardless. Flip `MODE` to `"enforcing"` in the source file once the conduct-bundle and markets-bundle policies are authored in `Policies/`.

**CI entry point:** `bun run recon:fsca-reg-to-policy` (registered in `prototype/package.json`; appended to the `ci` script chain after `recon:wall-clock-callsite-coverage`).

---

## 2. Total obligations asserted

| Metric | Count |
|---|---|
| Total obligation rows asserted | 259 |
| Pass (policy file resolved in `Policies/`) | 10 |
| Warn (policy named but not yet in `Policies/`, or non-FSCA missing) | 201 |
| Fail (FSCA-sourced rows with missing or unresolvable policy) | 48 |
| Info (obligation not yet active — status N/A-yet / conditional-bind / pre-licence) | 10 |

**Overall result:** `ok: true` (advisory mode)

The 10 obligations that pass resolve to one of the 10 existing policy files in `Policies/`:
`aml-cft-policy-v1.md`, `capital-management-policy-v1.md`, `fit-and-proper-policy-v1.md`,
`internal-audit-charter-v1.md`, `liquidity-risk-management-policy-v1.md`,
`popia-privacy-policy-v1.md`, `recovery-resolution-planning-policy-v1.md`,
`remuneration-policy-v1.md`, `risk-management-and-compliance-policy-v1.md`,
`trading-mandate-v1.md`.

---

## 3. Top gaps by domain (policies most frequently referenced but missing)

These are the policies cited most often as fulfilment for active obligations that do not yet have a corresponding file in `Policies/`:

| Rank | Missing policy | Obligations referencing it | Severity |
|---|---|---|---|
| 1 | Excon Compliance Policy | 15 | warn (non-FSCA) |
| 2 | Accounting Policies (IFRS) | 13 | warn (non-FSCA) |
| 3 | Tax Policy | 12 | warn (non-FSCA) |
| 4 | Governance Framework | 9 | warn (non-FSCA) |
| 5 | Operational Resilience Policy | 8 | warn (non-FSCA) |
| 6 | Information Security Policy | 7 | warn (non-FSCA) |
| 7 | Cyber Resilience Policy | 7 | warn (non-FSCA) |
| 8 | Conflicts of Interest Policy | 6 | warn (non-FSCA) |
| 9 | Collateral Management Policy | 5 | warn (non-FSCA) |
| 10 | Incident Response Policy | 5 | warn (non-FSCA) |

**FSCA-sourced fail distribution by domain:**

| Domain | Fail count | Key missing policies |
|---|---|---|
| FAIS (General Code / advice-records) | 11 | FAIS Policy (planned, conduct bundle) |
| CS3 (Conduct Standard 3/2018) | 9 | OTC Trading Policy, Counterparty Onboarding Policy, Client Categorisation Policy |
| MK (Markets / FMA) | 8 | ODP Authorisation Policy, Issuer Compliance Policy, Trading Membership Compliance Policy |
| CD (Conduct — FSCA dual-peak) | 4 | Pricing Policy, Customer Treatment Policy, Complaints Handling Policy |
| CY (Cybersecurity — Joint Standard 2) | 4 | Information Security Policy, Cyber Resilience Policy |
| BNK (FSCA conduct-side obligations) | 4 | TCF Policy |
| FMA (Financial Markets Act) | 3 | Market Abuse Policy, OTC Derivative Policy |
| CS1 / CS2 (Conduct Standards 1 + 2) | 4 | Conduct Standards compliance policy (planned) |
| FX (Excon) | 1 | Excon Compliance Policy |

---

## 4. Recommended priority order for policy authoring

Priority ordering is by (a) FSCA-source severity (enforcing once promoted), then (b) obligation count, then (c) estimated authoring complexity.

### Priority 1 — FSCA-sourced; blocks enforcing-mode promotion

These must exist in `Policies/` before `MODE` is flipped to `"enforcing"`. All are cited by active FSCA-regulated obligations that would `fail` CI in enforcing mode.

1. **FAIS Policy** — cited by 11+ FAIS-domain obligations (advice records, suitability, fee disclosure, complaint handling, General Code umbrella). Owner: Zara (CCO, governance). Needed before FAIS FSP-licence application.
2. **TCF Policy** — cited by 6+ conduct-domain obligations (TCF outcomes 1–6). Owner: Zara + Niko. Block: FSCA COFI Act licensing.
3. **OTC Trading Policy** — cited by Conduct Standard 3/2018 §§3–9 rows. Owner: Saskia + Zara. Block: ODP authorisation.
4. **Counterparty Onboarding Policy** — CS3 §3 (client categorisation + onboarding). Owner: Zara + Saskia.
5. **Client Categorisation Policy** — CS3 §5 (institutional/retail). Owner: Zara.
6. **Complaints Handling Policy** — cited by ORG-CD-07 (FSCA complaints standard) and FAIS rows. Owner: Zara + Niko.
7. **Pricing Policy** — cited by ORG-CD-06 (fee disclosure under FSCA). Owner: Zara + Niko.
8. **Customer Treatment Policy** — TCF / FSCA conduct side. Owner: Niko + Zara.

### Priority 2 — high obligation-count; non-FSCA; needed for register completeness

9. **Excon Compliance Policy** — 15 obligations in the Excon domain. Owner: Yael (Tax / treasury legal engineer). Block: cross-border payment flows.
10. **Accounting Policies (IFRS)** — 13 obligations (IFRS 9 ECL, IAS 39 hedge accounting, IFRS 13 FV, IFRS 16 leases). Owner: Bea (Accounting & financial reporting engineer).
11. **Tax Policy** — 12 obligations (SA income tax, VAT, STT, FATCA, CRS). Owner: Yael.
12. **Governance Framework** — 9 obligations (Companies Act, FSR Act, board committee structures). Owner: Owen (Company Secretary, governance).
13. **Operational Resilience Policy** — 8 obligations (BCBS operational-resilience principles, Reg 39). Owner: Devon + Helena.
14. **Information Security Policy** — 7 obligations (Joint Standard 2 of 2024, POPIA ss.19–22). Owner: Senna (CISO, governance).
15. **Cyber Resilience Policy** — 7 obligations (PA/FSCA Joint Standard 2, BCM). Owner: Rashida + Senna.
16. **Conflicts of Interest Policy** — 6 obligations (FAIS, Companies Act, twin-peaks conduct). Owner: Owen + Zara.

### Priority 3 — markets bundle; post-ODP-authorisation binding

17. **ODP Authorisation Policy** — pre-licence FSCA obligation for OTC derivatives. Owner: Camille + Saskia + Owen.
18. **Market Abuse Policy** — FMA Chapter X surveillance obligations. Owner: Zara + Saskia.
19. **Collateral Management Policy** — 5 obligations (counterparty credit exposure). Owner: Helena + Eitan.
20. **Incident Response Policy** — 5 obligations (PA/FSCA incident reporting timelines). Owner: Senna + Rashida.

---

## 5. Substrate gaps surfaced

1. **Advisory → enforcing promotion trigger** — the `MODE` constant in `platform/recon/fsca-reg-to-policy.ts` must be flipped to `"enforcing"` once Priority 1 + Priority 2 policies land in `Policies/`. Vera to raise as a Vera-finding when the policy-authoring sprint closes.
2. **Alias table completeness** — several policy references use creative variations (e.g., "Governance Framework — Significant-Owner Notification") that the current alias table does not resolve. As new policy files are authored, extend `POLICY_NAME_ALIASES` in the pipeline source to cover the new stems.
3. **Procedure-only rows** — some obligation rows cite only procedures (`Procedures/by-policy/...`) without a named policy. These rows currently emit no violation (procedures are stripped before classification), but they represent a structural gap: every procedure should trace to a named policy. A follow-on pipeline (`procedure-to-policy-traceability`) should assert this link. Queued as Vera Wave-6 backlog.
