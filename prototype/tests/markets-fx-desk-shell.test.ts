// tests/markets-fx-desk-shell.test.ts
//
// Slice-1 smoke test for the FX sales & trading front-end (Slice 1 of
// D-FX-SALES-TRADING-FRONTEND, CEO-approved 2026-05-10).
//
// Scope:
//   - The eligibility-fold (`buildCounterpartiesView`) returns only
//     counterparties whose latest screening result is
//     `institutional-eligible` AND whose latest event is not a
//     `CounterpartyEligibilityBreached`.
//   - A `CounterpartyEligibilityRevalidated` after a `Breached` clears
//     the breach (per pack §3 G1 read-side semantics).
//   - The static page surface (HTML / CSS / JS) exists at the
//     documented paths and the substrate-mode banner string is present.
//   - The launcher tile is registered on `home.html`'s tile catalogue
//     and links to `/markets/fx/desk.html`.
//
// Author: Kai (Trading systems engineer, engineering — reports to
//         Saskia, Head of Global Markets) · Atlas (Core banking
//         platform architect, engineering — UI shell) · Anya (Data /
//         analytics engineer, engineering — projection pattern).

import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import { buildCounterpartiesView } from "../dashboard/markets-fx-counterparties";
import {
  makeCounterpartyEligibilityBreached,
  makeCounterpartyEligibilityRevalidated,
  makeCounterpartyEligibilityScreened,
} from "../platform/event-store/event-types";
import { EventStore } from "../platform/event-store/store";
import type { Actor } from "../platform/event-store/types";

const PROTOTYPE_ROOT = resolve(import.meta.dir, "..");
const PUBLIC_DIR = resolve(PROTOTYPE_ROOT, "dashboard", "public");

const ENTITY = "BANK-ZA-001";
const NIKO_ACTOR: Actor = { type: "service", id: "agent:niko:eligibility-screening" };
const CITATIONS = [
  "FAIS-ACT-37-2002",
  "urn:obligation:bank:fais:general-code-of-conduct:v1",
  "[citation: TBC pending counsel — FAIS s.45 sub-section refs]",
];

const T_2026 = "2026-05-09T08:00:00.000Z";
const T_2027 = "2027-05-09T08:00:00.000Z";
const T_2027_BREACH = "2027-08-15T10:30:00.000Z";
const T_2028 = "2028-02-01T09:00:00.000Z";

let tmpDir: string;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "fx-desk-shell-test-"));
});

afterAll(() => {
  if (tmpDir && existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

function freshStore(): EventStore {
  // Fresh sqlite per test for hermetic isolation.
  const path = join(tmpDir, `event-${Math.random().toString(36).slice(2)}.db`);
  return new EventStore(path);
}

describe("FX desk Slice 1 — counterparty eligibility fold", () => {
  it("returns only counterparties whose latest screening is institutional-eligible", () => {
    const store = freshStore();

    // cp:standard-bank-za — passes
    store.append(
      makeCounterpartyEligibilityScreened({
        asOf: T_2026,
        entity: ENTITY,
        actor: NIKO_ACTOR,
        citations: CITATIONS,
        payload: {
          counterpartyId: "cp:standard-bank-za",
          screeningId: "cp-eligibility:cp:standard-bank-za:2026-05-09",
          criteria: ["SARB-licensed bank (Banks Act 94/1990)"],
          outcome: "institutional-eligible",
          evidenceRefs: ["SARB-licence-number-12345"],
          asOf: T_2026,
        },
      }),
    );

    // cp:retail-customer — ineligible (must be filtered out)
    store.append(
      makeCounterpartyEligibilityScreened({
        asOf: T_2026,
        entity: ENTITY,
        actor: NIKO_ACTOR,
        citations: CITATIONS,
        payload: {
          counterpartyId: "cp:retail-customer",
          screeningId: "cp-eligibility:cp:retail-customer:2026-05-09",
          criteria: ["Not on s.45 list"],
          outcome: "ineligible",
          evidenceRefs: ["onboarding-questionnaire-response"],
          asOf: T_2026,
        },
      }),
    );

    // cp:firstrand-rmb — passes
    store.append(
      makeCounterpartyEligibilityScreened({
        asOf: T_2026,
        entity: ENTITY,
        actor: NIKO_ACTOR,
        citations: CITATIONS,
        payload: {
          counterpartyId: "cp:firstrand-rmb",
          screeningId: "cp-eligibility:cp:firstrand-rmb:2026-05-09",
          criteria: ["SARB-licensed bank"],
          outcome: "institutional-eligible",
          evidenceRefs: ["SARB-licence-number-67890"],
          asOf: T_2026,
        },
      }),
    );

    // cp:indeterminate — must be filtered out
    store.append(
      makeCounterpartyEligibilityScreened({
        asOf: T_2026,
        entity: ENTITY,
        actor: NIKO_ACTOR,
        citations: CITATIONS,
        payload: {
          counterpartyId: "cp:indeterminate-co",
          screeningId: "cp-eligibility:cp:indeterminate-co:2026-05-09",
          criteria: ["Awaiting evidence"],
          outcome: "indeterminate",
          evidenceRefs: ["pending-regulator-confirmation"],
          asOf: T_2026,
        },
      }),
    );

    const view = buildCounterpartiesView(store);

    // 4 events seen, only 2 pass.
    expect(view.totalSeen).toBe(4);
    expect(view.counterparties.map((c) => c.counterpartyId)).toEqual([
      "cp:firstrand-rmb",
      "cp:standard-bank-za",
    ]);
    for (const c of view.counterparties) {
      expect(c.outcome).toBe("institutional-eligible");
      expect(c.isBreached).toBe(false);
    }

    store.close();
  });

  it("excludes a counterparty whose latest event is a CounterpartyEligibilityBreached", () => {
    const store = freshStore();

    store.append(
      makeCounterpartyEligibilityScreened({
        asOf: T_2026,
        entity: ENTITY,
        actor: NIKO_ACTOR,
        citations: CITATIONS,
        payload: {
          counterpartyId: "cp:standard-bank-za",
          screeningId: "cp-eligibility:cp:standard-bank-za:2026-05-09",
          criteria: ["SARB-licensed bank"],
          outcome: "institutional-eligible",
          evidenceRefs: ["SARB-licence-number-12345"],
          asOf: T_2026,
        },
      }),
    );
    store.append(
      makeCounterpartyEligibilityBreached({
        asOf: T_2027_BREACH,
        entity: ENTITY,
        actor: NIKO_ACTOR,
        citations: CITATIONS,
        payload: {
          counterpartyId: "cp:standard-bank-za",
          priorScreeningId: "cp-eligibility:cp:standard-bank-za:2026-05-09",
          breachReason: "FSP licence withdrawn (test fixture)",
          recommendedAction: "suspend-trading-and-rescreen",
          asOf: T_2027_BREACH,
        },
      }),
    );

    const view = buildCounterpartiesView(store);
    expect(view.counterparties).toHaveLength(0);

    store.close();
  });

  it("re-includes a counterparty when a Revalidation lands strictly after a Breach", () => {
    const store = freshStore();

    store.append(
      makeCounterpartyEligibilityScreened({
        asOf: T_2026,
        entity: ENTITY,
        actor: NIKO_ACTOR,
        citations: CITATIONS,
        payload: {
          counterpartyId: "cp:standard-bank-za",
          screeningId: "cp-eligibility:cp:standard-bank-za:2026-05-09",
          criteria: ["SARB-licensed bank"],
          outcome: "institutional-eligible",
          evidenceRefs: ["SARB-licence-number-12345"],
          asOf: T_2026,
        },
      }),
    );
    store.append(
      makeCounterpartyEligibilityBreached({
        asOf: T_2027_BREACH,
        entity: ENTITY,
        actor: NIKO_ACTOR,
        citations: CITATIONS,
        payload: {
          counterpartyId: "cp:standard-bank-za",
          priorScreeningId: "cp-eligibility:cp:standard-bank-za:2026-05-09",
          breachReason: "Transient compliance hold",
          recommendedAction: "run-fresh-screening",
          asOf: T_2027_BREACH,
        },
      }),
    );
    store.append(
      makeCounterpartyEligibilityRevalidated({
        asOf: T_2028,
        entity: ENTITY,
        actor: NIKO_ACTOR,
        citations: CITATIONS,
        payload: {
          counterpartyId: "cp:standard-bank-za",
          screeningId: "cp-eligibility:cp:standard-bank-za:2028-02-01",
          priorScreeningId: "cp-eligibility:cp:standard-bank-za:2026-05-09",
          criteria: ["SARB-licensed bank"],
          outcome: "institutional-eligible",
          evidenceRefs: ["SARB-licence-confirmation-2028"],
          asOf: T_2028,
        },
      }),
    );

    const view = buildCounterpartiesView(store);
    expect(view.counterparties).toHaveLength(1);
    const row = view.counterparties[0];
    if (!row) throw new Error("expected at least one counterparty row");
    expect(row.counterpartyId).toBe("cp:standard-bank-za");
    expect(row.isBreached).toBe(false);
    // Revalidation is the latest screening — its `screeningId` and `asOf`
    // must surface (not the original screening's).
    expect(row.screeningId).toBe("cp-eligibility:cp:standard-bank-za:2028-02-01");
    expect(row.asOf).toBe(T_2028);

    store.close();
  });

  it("returns an empty list (not undefined) for a fresh event store", () => {
    const store = freshStore();
    const view = buildCounterpartiesView(store);
    expect(view.counterparties).toEqual([]);
    expect(view.totalSeen).toBe(0);
    expect(typeof view.asOf).toBe("string");
    store.close();
  });

  it("uses the latest revalidation as the surfaced screening when no breach intervenes", () => {
    const store = freshStore();

    store.append(
      makeCounterpartyEligibilityScreened({
        asOf: T_2026,
        entity: ENTITY,
        actor: NIKO_ACTOR,
        citations: CITATIONS,
        payload: {
          counterpartyId: "cp:firstrand-rmb",
          screeningId: "cp-eligibility:cp:firstrand-rmb:2026-05-09",
          criteria: ["SARB-licensed bank"],
          outcome: "institutional-eligible",
          evidenceRefs: ["initial-evidence"],
          asOf: T_2026,
        },
      }),
    );
    store.append(
      makeCounterpartyEligibilityRevalidated({
        asOf: T_2027,
        entity: ENTITY,
        actor: NIKO_ACTOR,
        citations: CITATIONS,
        payload: {
          counterpartyId: "cp:firstrand-rmb",
          screeningId: "cp-eligibility:cp:firstrand-rmb:2027-05-09",
          priorScreeningId: "cp-eligibility:cp:firstrand-rmb:2026-05-09",
          criteria: ["SARB-licensed bank"],
          outcome: "institutional-eligible",
          evidenceRefs: ["revalidation-2027"],
          asOf: T_2027,
        },
      }),
    );

    const view = buildCounterpartiesView(store);
    expect(view.counterparties).toHaveLength(1);
    const row = view.counterparties[0];
    if (!row) throw new Error("expected at least one counterparty row");
    expect(row.screeningId).toBe("cp-eligibility:cp:firstrand-rmb:2027-05-09");
    expect(row.evidenceRefs).toEqual(["revalidation-2027"]);

    store.close();
  });
});

describe("FX desk Slice 1 — page surface", () => {
  it("renders the desk.html shell with substrate-mode banner + counterparty picker", () => {
    const deskHtmlPath = join(PUBLIC_DIR, "markets", "fx", "desk.html");
    expect(existsSync(deskHtmlPath)).toBe(true);
    const html = readFileSync(deskHtmlPath, "utf8");

    // Substrate-mode banner copy (J7 — pack §3) must be present verbatim.
    expect(html).toContain("BUILD MODE — SYNTHETIC DATA — NO REAL COUNTERPARTIES");
    // Picker structure
    expect(html).toContain("data-fx-cp-table");
    expect(html).toContain("data-fx-cp-tbody");
    // Page-specific assets are referenced
    expect(html).toContain("/markets/fx/desk.css");
    expect(html).toContain("/markets/fx/desk.js");
    // Shell chrome reused
    expect(html).toContain("/_shell.css");
    expect(html).toContain("/_shell.js");
  });

  it("renders the Slice-2 RFQ form + confirmation panel surface", () => {
    const deskHtmlPath = join(PUBLIC_DIR, "markets", "fx", "desk.html");
    const html = readFileSync(deskHtmlPath, "utf8");
    // RFQ form fields
    expect(html).toContain("data-fx-rfq-form");
    expect(html).toContain("data-fx-rfq-counterparty");
    expect(html).toContain("data-fx-rfq-pair");
    expect(html).toContain("data-fx-rfq-side");
    expect(html).toContain("data-fx-rfq-notional");
    expect(html).toContain("data-fx-rfq-value-date");
    expect(html).toContain("data-fx-rfq-submit");
    // Quote panel
    expect(html).toContain("data-fx-rfq-bid");
    expect(html).toContain("data-fx-rfq-mid");
    expect(html).toContain("data-fx-rfq-offer");
    // Confirmation panel
    expect(html).toContain("data-fx-rfq-confirmation");
    expect(html).toContain("data-fx-conf-trade-id");
    expect(html).toContain("data-fx-conf-event-id");
    expect(html).toContain("data-fx-conf-provenance");
    // First-dry-run constraint copy
    expect(html).toContain("USD/ZAR");
  });

  it("ships the desk.css and desk.js assets", () => {
    expect(existsSync(join(PUBLIC_DIR, "markets", "fx", "desk.css"))).toBe(true);
    expect(existsSync(join(PUBLIC_DIR, "markets", "fx", "desk.js"))).toBe(true);
  });

  it("registers the FX-desk launcher tile on home.js linking to /markets/fx/desk.html", () => {
    const homeJsPath = join(PUBLIC_DIR, "home.js");
    expect(existsSync(homeJsPath)).toBe(true);
    const homeJs = readFileSync(homeJsPath, "utf8");
    expect(homeJs).toContain('id: "mkts-fx-desk"');
    expect(homeJs).toContain('href: "/markets/fx/desk.html"');
    expect(homeJs).toContain('category: "markets"');
  });
});
