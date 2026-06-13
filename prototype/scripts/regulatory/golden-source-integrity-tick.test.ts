// scripts/regulatory/golden-source-integrity-tick.test.ts
//
// Unit coverage for the dangling-golden-source alertId builder: it must
// produce a stable, idempotent id matching the SubstrateAlert alertId regex
// (/^alert:[a-z]+:[a-z0-9-]+$/) for any gate-violation subject. A drift in
// the slug rule that broke the regex would make the scheduled tick throw on
// append (schema validation) instead of escalating — this test catches that.
//
// Author: Mira (Chief Obligations & Regulatory Officer, compliance).

import { describe, expect, it } from "bun:test";

import { danglingAlertId } from "./golden-source-integrity-tick";

const ALERT_ID_RE = /^alert:[a-z]+:[a-z0-9-]+$/;

describe("golden-source-integrity-tick danglingAlertId", () => {
  it("produces a schema-valid, stable alertId for a typical gate subject", () => {
    // The gate's violation `subject` is `<nodeId> → <hash>`.
    const subject = "DOC-FAIS-ACT → blake3:abc123def456";
    const id = danglingAlertId(subject);
    expect(id).toMatch(ALERT_ID_RE);
    // Idempotent — same subject → same id (no daily re-spam).
    expect(danglingAlertId(subject)).toBe(id);
  });

  it("distinct subjects yield distinct alertIds", () => {
    const a = danglingAlertId("DOC-A → blake3:111");
    const b = danglingAlertId("DOC-B → blake3:222");
    expect(a).not.toBe(b);
    expect(a).toMatch(ALERT_ID_RE);
    expect(b).toMatch(ALERT_ID_RE);
  });

  it("survives subjects with punctuation, arrows, and uppercase", () => {
    const id = danglingAlertId("DOC FAIS/Act (v2) → BLAKE3:ZZZ___!!!");
    expect(id).toMatch(ALERT_ID_RE);
  });

  it("never emits an empty trailing slug", () => {
    const id = danglingAlertId("→→→ !!! ___");
    expect(id).toMatch(ALERT_ID_RE);
    expect(id.endsWith(":")).toBe(false);
  });
});
