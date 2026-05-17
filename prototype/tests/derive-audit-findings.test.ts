// tests/derive-audit-findings.test.ts
//
// Regression test for dashboard/derive.ts auditFindings() projection.
//
// Background: 2026-05-17 Vera (Internal audit engineer, third-line
// independence) overnight recon emitted two `high`-severity AuditFinding
// events (F-VERA-20260517-R4R3 + F-VERA-20260517-DHG0). The dashboard
// surfaced them with `description: "(no description)"` because the
// projection only mapped legacy `description`/`message` fields and the
// canonical AuditFinding schema (platform/event-store/event-types/audit.ts)
// requires `summary` instead.
//
// This test reconstructs the exact production payload from the
// 2026-05-17 incident and asserts auditFindings() carries a substantive
// description. Principle 1 — events are the only source of truth;
// projections must read what the canonical schema actually writes.
//
// Brief: brief:vera:triage-2-high-overnight-findings-f-vera-20260517:2026-05-17
//
// Author: Vera (Internal audit engineer, third-line —
//         functionally to Thandiwe (Chief Audit Executive, governance);
//         administratively through the CEO).

import { describe, expect, it } from "bun:test";

import { eventSourceFromStore } from "../dashboard/derive";
import { BANK_ZA_001 } from "../platform/core/types";
import { makeAuditFinding } from "../platform/event-store/event-types/audit";
import { EventStore } from "../platform/event-store/store";

describe("dashboard/derive auditFindings()", () => {
  it("projects canonical AuditFinding.summary into description (regression on 2026-05-17 incident)", () => {
    const store = new EventStore();
    const event = makeAuditFinding({
      asOf: "2026-05-17T02:13:44.649Z",
      entity: BANK_ZA_001,
      actor: { type: "service", id: "agent:vera:overnight-recon" },
      citations: ["IIA-IPPF", "BCBS-223", "GOV-FRAMEWORK-CEO-RESERVED"],
      payload: {
        findingId: "F-VERA-20260517-TEST",
        severity: "high",
        category: "process",
        addressedTo: "agent:vera",
        agentId: "vera",
        raisedBy: "agent:vera:overnight-recon",
        summary:
          "decision-required-event-pairing: D-FOO — actioned without terminal CeoDecision event. Authority: D-PROVENANCE-FILTER-ENFORCEMENT; Finding: F-033.",
        detail: "Pipeline: decision-required-event-pairing; Subject: D-FOO; Message: ...",
        sourceRef: "decision-required-event-pairing",
        citations: ["IIA-IPPF", "BCBS-223"],
      },
    });
    store.append(event);

    const findings = eventSourceFromStore(store).auditFindings();
    expect(findings).toHaveLength(1);
    const f = findings[0];
    if (!f) throw new Error("expected one finding");

    expect(f.findingId).toBe("F-VERA-20260517-TEST");
    expect(f.severity).toBe("high");
    // The critical regression assertion: a canonical AuditFinding must
    // project a substantive description, NOT the "(no description)"
    // fallback that the 2026-05-17 incident surfaced.
    expect(f.description).not.toBe("(no description)");
    expect(f.description).toContain("decision-required-event-pairing");
    expect(f.description.length).toBeGreaterThan(0);
    // `raisedBy` should populate `source` when no legacy `source` field
    // is present (otherwise the audit tile loses provenance of who
    // raised the finding).
    expect(f.source).toBe("agent:vera:overnight-recon");
    // `sourceRef` should populate `principle` for the audit tile.
    expect(f.principle).toBe("decision-required-event-pairing");
  });

  it("guarantees every projected canonical finding carries a non-empty description", () => {
    const store = new EventStore();
    // Multiple canonical findings — all must project substantive
    // descriptions, never "(no description)".
    for (let i = 0; i < 3; i++) {
      store.append(
        makeAuditFinding({
          asOf: `2026-05-17T02:13:${20 + i}.000Z`,
          entity: BANK_ZA_001,
          actor: { type: "service", id: "agent:vera:overnight-recon" },
          citations: ["IIA-IPPF"],
          payload: {
            findingId: `F-VERA-TEST-${i}`,
            severity: "high",
            category: "process",
            addressedTo: "agent:vera",
            agentId: "vera",
            raisedBy: "agent:vera:overnight-recon",
            summary: `substantive finding ${i}`,
            citations: ["IIA-IPPF"],
          },
        }),
      );
    }

    const findings = eventSourceFromStore(store).auditFindings();
    expect(findings).toHaveLength(3);
    for (const f of findings) {
      expect(f.description).not.toBe("(no description)");
      expect(f.description.length).toBeGreaterThan(0);
    }
  });
});
