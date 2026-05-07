---
title: Substrate exception register — Owen
author: Owen
date: 2026-05-07
summary: Canonical register of substrate components running under named exceptions. Each entry records the threat-model gate, conditions for exit, expiry, and approver. Vera consumes this register as continuous-controls evidence.
decision-required: false
---

# Substrate exception register

**Author:** Owen (Company Secretary; governance-framework custodian)
**For:** Marc (CEO), Rashida (CISO when appointed substantively), Vera (third-line consumer), engineering leads.
**Date opened:** 2026-05-07
**Authority:** Principle 4 (Security designed in from the start) — the threat-model gate. Principle 6 (single-graph discipline) — register as canonical source for "substrate-component running under exception" fact-type. Principle 7 (Autonomous by default) — Vera's continuous-controls programme tests this register on its overnight cadence.
**Status:** Open. Two entries below; one approved, none expired.

> *Derivation note (Principle 6 — downward).* This register is the canonical authoring location for substrate exceptions. The threat-model gate (Senna) and any future security-engineer gate authors *into* it; presentations (board packs, weekly state-of-platform notes, Vera audit findings) *derive from* it. No exception lives anywhere else as authoritative state.

## How this register is used

1. **Senna (or future gate-owner)** files a threat-model note in `/Owner Inbox/` for any new substrate component crossing a gate (new credential surface, new external dependency, new data-handling capability, new public attack surface).
2. **Approver** (CISO on the steady-state org chart; CEO-acting-as-interim-CISO during build phase) records the decision *in this register*, citing the threat-model note.
3. **Conditions** are the hardening items the approver requires before the exception expires or before sensitive data may flow.
4. **Auto-expiry** is a hard date or named milestone (e.g. "licence-grant"); on expiry the entry must be re-gated, not silently extended.
5. **Vera** asserts that every IN-USE-UNDER-SUBSTRATE-EXCEPTION component in the substrate-gap inventory has a live entry here, and that no entry is past its expiry without re-gating.

## Register

### TM-NEON-EVENT-STORE-001 — Cloud event store on Neon Postgres

| Field | Value |
|---|---|
| **Subject** | Shared event store on hosted Neon Postgres (`neondb` on `ep-floral-smoke-aq0hgdum.c-8.us-east-1.aws.neon.tech`); reconciles bidirectionally to host-local sqlite via `bun run event-store:sync`. |
| **Threat-model note** | `Owner Inbox/2026-05-07_senna_neon-event-store-threat-model.md` |
| **Status** | APPROVED FOR BUILD-PHASE USE |
| **Approver** | Marc (CEO acting as interim CISO; substantive CISO appointment pending pre-licence-day per the Top-of-House structure) |
| **Approved on** | 2026-05-07 |
| **Conditions for exit** | Senna §5.1 (role downgrade to SELECT + INSERT), §5.2 (IP allowlist on Marc's home IP and GitHub Actions IP ranges), §5.3 (quarterly password rotation + ad-hoc on suspected exposure). Required **before** any sensitive-data event (PII, financial, customer-identifiable) flows through the store. |
| **Conditions deferred** | Marc deferred §5.1, §5.2, and the immediate Neon-password rotation on 2026-05-07. Acceptable while events remain non-sensitive (substrate snapshots, recon results, agent autonomous-run records, decision events, workstream lifecycle). Not acceptable beyond licence-day. |
| **Auto-expiry** | At licence-grant (real customer onboarding begins under Niko's lifecycle). New gate cycle required for live operation. |
| **Surfacing cadence** | Senna lists this entry on every weekly state-of-platform note to Rashida (substantively, when CISO is appointed; to Marc until then). Atlas surfaces it as substrate-gap #1 with status "exception-in-force" on his weekly substrate-state run. |
| **Vera consumption** | The continuous-controls programme reads this register on every overnight run; raises a finding if (a) the IN-USE-UNDER-SUBSTRATE-EXCEPTION substrate-gap entry has no matching register entry, (b) the entry is past its expiry, or (c) sensitive-data event types have flowed through Neon while §5.1/§5.2/§5.3 remain open. |

## Procedural posture

This register is itself a substrate fragment of the broader **governance-framework** Owen owns — it makes concrete a piece of the exception-management process the framework prescribes at a high level. As more threat-model gates land (HSM key custody, customer-data event types, third-party integrations), entries are added here following the same shape. No prose copies of an entry exist anywhere else; cross-references use the entry ID (`TM-NEON-EVENT-STORE-001`).

—Owen
