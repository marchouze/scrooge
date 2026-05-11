# Regulatory library

**Curator:** Mira (compliance / RegTech engineer; obligations-register curator under Principle 2)
**Governance:** Zara (CCO)
**Created:** 2026-05-06

## Purpose

The regulatory library is the **canonical store** of every regulator instrument, standard, and code that creates an obligation on the bank, together with structured analysis showing where each obligation is fulfilled in the bank's policy stack.

It is the operational expression of **Principle 2** (every action traces to a source) and the substrate for **Principle 2** (where presentations summarise from, going up the layered hierarchy).

## What lives here

```
/Regulations/
  README.md                       — this file
  _index.md                       — master inventory of every instrument
  _obligations-register.md        — the consolidated obligations register
  _obligations-register.html      — polished view of the same register
  SARB-PA/                        — Banks Act, regulations, directives, guidance notes
  FSCA/                           — FAIS, conduct standards, COFI Bill
  FIC/                            — FIC Act, guidance notes
  Information-Regulator/          — POPIA, PAIA
  Joint-Standards/                — PA / FSCA Joint Standards (e.g. JS 1 of 2024 cyber)
  BCBS/                           — Basel framework, principles
  IASB/                           — IFRS standards, IAS standards
  Companies-Act/                  — Companies Act 71 of 2008 + regulations
  SARS/                           — Income Tax, VAT, Tax Admin, FATCA / CRS
  Labour/                         — LRA, BCEA, EE Act, Skills Dev Act
  Other/                          — King IV, IIA IPPF, NIST CSF, ISO standards, FMA, PRECCA, ECTA, PDA
```

Each instrument folder contains a structured analysis file per instrument:

```
SARB-PA/
  banks-act.md                    — citation, scope, key obligations, fulfilment links
  regs-relating-to-banks.md
  directive-3-of-2018.md
  ...
```

The canonical regulatory text itself is referenced by URL — we do not redistribute the regulators' published documents. Where excerpts are useful, they are quoted in the analysis file with attribution.

## Obligations register

`_obligations-register.md` is the heart of the library. It is a tabular consolidation of every obligation identified across all instruments, organised by domain (prudential, conduct, financial crime, privacy, cyber, accounting, governance, tax, labour, markets), with:

- **Citation** — instrument + section / clause.
- **Plain-English requirement** — what the regulator requires.
- **Fulfilment policy** — where in the bank's policy library this obligation is met.
- **Fulfilment owner** — which seat is accountable.
- **Status** — In force / Drafting / Planned / Partial / N/A-yet (e.g. when a licence is not yet held).
- **Notes** — caveats, dependencies, deferrals.

The register is a **projection** over the underlying instrument analyses. As Mira authors or amends an instrument file, register entries update; the register is reproducible from the instrument files and the policy library at any as-of date (Principle 1).

## How to navigate

- **"What does the bank have to do about X?"** → search the obligations register by domain or by citation.
- **"What does instrument Y require us to do?"** → open the instrument file in its regulator subfolder.
- **"Where do we fulfil obligation Z?"** → the register's *Fulfilment policy* column points to the policy in `Owner Inbox/2026-05-06_policy-register.{md,html}` and to the bundle file containing the policy text.
- **"Who watches change to instrument Y?"** → the instrument file lists the curator.

## How the library extends

- New instruments enter via Mira (engineering) under Zara (governance). Each new instrument file is reviewed by the relevant domain owner (Helena for risk; Iris for privacy; Senna for cyber; etc.).
- Amendments to existing instruments are typed events: `RegulatoryInstrumentVersioned`, `ObligationAmended`. The instrument file is versioned; the obligations register updates accordingly.
- New obligations identified during regulatory-change management (per the Compliance Programme) trigger:
  1. Update of the instrument file.
  2. Update of the obligations register entry.
  3. Identification of fulfilment policy (existing or new); if new, a policy drafting brief follows.
  4. Notification to the affected domain owner.
  5. Vera (audit) sees the change as a continuous-controls evidence event.

## Status today

The library is **scaffolded** with the directory structure, the index, and a substantive obligations register covering ~180 obligations across the full breadth of regulation applicable to a SARB-regulated bank.

A handful of **exemplar instrument files** are populated to demonstrate the analysis pattern (Banks Act, FIC Act, POPIA, Joint Standard 2 of 2024). The remaining instruments are listed in `_index.md` with status `STUB` — Mira will populate them as the policy library is built out and as regulatory-change management surfaces concrete amendments to track.

## Co-dependencies

- `Owner Inbox/2026-05-06_policy-register.{md,html}` — the policy library this register fulfils.
- `Owner Inbox/2026-05-06_governance-framework.{md,html}` — the constitutional document that establishes the policy library.
- `Owner Inbox/2026-05-06_core-policies-*.md` — the core policy bundles whose contents discharge the obligations.
- `CLAUDE.md` — the architectural principles (especially P2 traceability) that this library operationalises.
