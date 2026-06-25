// platform/recon/agent-spec-domain-competence.test.ts
//
// Unit tests for the agent-spec domain-competence recon (§18–§20).
// Authority: D-AGENT-DOMAIN-COMPETENCE (CEO-approved 2026-06-25).
//
// Asserts the gate is load-bearing: it flags a persona missing §18–§20, it
// flags a section that is present-but-placeholder (non-substantive), it
// passes a fully-populated persona, and the warn→fail enforce flip behaves
// (harden-only ratchet semantics).
//
// Author: Owen (Company Secretary, governance)

import { describe, expect, it } from "bun:test";

import { assertDomainCompetence } from "./agent-spec-domain-competence";

// A synthetic persona with §18–§20 fully and substantively filled.
const COMPLETE = `# Faux — Test seat

## 1. Identity

- **Name:** Faux
- **Reports to:** Marc (CEO)

## 18. Authoritative knowledge base & sources

The seat reasons from IFRS 9 and IAS 21, acquired per D-REGULATORY-LIBRARY-V1.

| Source | Kind | Graph node | Role |
|---|---|---|---|
| IAS 21 | Standard | urn:std:ias21 | FX retranslation rules |

## 19. Domain-truth validation

The seat validates against golden worked cases plus domain-invariant gates,
never just balance/byte-equivalence. A consistent-but-wrong result is a finding.

## 20. Premise-challenge duty

On domain questions the seat's authority outranks the brief, including a brief
from Scrooge. It confirms or challenges the premise with a citation before
implementing. Silent execution of a wrong premise is a finding.
`;

// Missing §19 and §20 entirely.
const MISSING = `# Faux — Test seat

## 18. Authoritative knowledge base & sources

IFRS 9 and IAS 21 are the seat's authoritative standards, acquired and cited.
`;

// §20 present but a bare placeholder (non-substantive).
const PLACEHOLDER = `# Faux — Test seat

## 18. Authoritative knowledge base & sources

IFRS 9 and IAS 21 are the seat's authoritative standards, acquired and cited.

## 19. Domain-truth validation

The seat validates against golden worked cases plus domain-invariant gates.

## 20. Premise-challenge duty

- TBD
`;

describe("agent-spec domain-competence recon", () => {
  it("passes a persona with §18–§20 substantively filled", () => {
    const r = assertDomainCompetence({ specs: [["/Team/Faux.md", COMPLETE]] });
    expect(r.violations).toHaveLength(0);
    expect(r.ok).toBe(true);
    expect(r.asserted).toBe(1);
  });

  it("flags missing §19 and §20 (warn severity by default)", () => {
    const r = assertDomainCompetence({ specs: [["/Team/Faux.md", MISSING]] });
    const missing = r.violations.filter((v) => /missing/.test(v.message));
    expect(missing.length).toBe(2);
    expect(r.violations.every((v) => v.severity === "warn")).toBe(true);
    // warn-only ⇒ ok stays true during the grooming window.
    expect(r.ok).toBe(true);
  });

  it("flags a present-but-placeholder §20 (non-substantive)", () => {
    const r = assertDomainCompetence({ specs: [["/Team/Faux.md", PLACEHOLDER]] });
    const sec20 = r.violations.filter((v) => /§ 20/.test(v.message));
    expect(sec20).toHaveLength(1);
    expect(sec20[0]?.message).toMatch(/no substantive content/);
  });

  it("enforce flag flips missing sections to fail (closure-step ratchet)", () => {
    const r = assertDomainCompetence({ specs: [["/Team/Faux.md", MISSING]], enforce: true });
    expect(r.violations.length).toBeGreaterThan(0);
    expect(r.violations.every((v) => v.severity === "fail")).toBe(true);
    expect(r.ok).toBe(false);
  });
});
