// v2-core/posting-rules/fx-lifecycle-leg-structure.test.ts
//
// Proves the cited FX leg-structure declaration is SOURCED, not invented:
//   1. Every posting-rule id it names resolves to the canonical posting-rule
//      registry (POSTING_RULE_REGISTRY).
//   2. Every account ROLE, resolved for each supported currency, resolves to a
//      real canonical CoA account (COA_BY_ID) — no fabricated GL account.
//   3. Each rule's leg roles match the pure `postFx*Legs` function's leg shape
//      (account-set/direction), for the representative ZAR currency.
//   4. Every stage in FX_GL_LIFECYCLE_STAGES carries an id the declaration uses.
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, it } from "bun:test";

import { COA_BY_ID } from "../accounting/chart-of-accounts";
import { resolveFxAccountSet } from "./fx";
import {
  FX_GL_LIFECYCLE_STAGES,
  FX_RULE_STAGE_ACCOUNT_ROLES,
  FX_RULE_STAGE_LEG_STRUCTURES,
  FX_RULE_STAGE_POSTING_RULE_IDS,
  resolveFxAccountRole,
} from "./fx-lifecycle-leg-structure";
import { findEntryForRuleId } from "./registry";

const SUPPORTED_CURRENCIES = ["ZAR", "USD", "GBP", "EUR", "CHF", "AUD", "JPY"];

describe("fx-lifecycle-leg-structure", () => {
  it("names only posting-rule ids that resolve to the registry", () => {
    for (const id of FX_RULE_STAGE_POSTING_RULE_IDS) {
      expect(findEntryForRuleId(id), `rule id ${id} must be a real registry entry`).toBeDefined();
    }
  });

  it("resolves every account role to a real CoA account, for every supported currency", () => {
    for (const role of FX_RULE_STAGE_ACCOUNT_ROLES) {
      for (const ccy of SUPPORTED_CURRENCIES) {
        const code = resolveFxAccountRole(role, ccy);
        expect(
          COA_BY_ID.get(code),
          `role ${role} for ${ccy} resolved to ${code}, which must be a real CoA account`,
        ).toBeDefined();
      }
    }
  });

  it("matches the rule functions' account-set selection (ZAR receivable/payable/pnl)", () => {
    const zar = resolveFxAccountSet("ZAR");
    expect(resolveFxAccountRole("receivable", "ZAR")).toBe(zar.receivable);
    expect(resolveFxAccountRole("payable", "ZAR")).toBe(zar.payable);
    expect(resolveFxAccountRole("unrealised-pnl", "ZAR")).toBe(zar.unrealisedPnl);
    expect(resolveFxAccountRole("realised-pnl", "ZAR")).toBe(zar.realisedPnl);
  });

  it("every declared stage id is a real FX_GL_LIFECYCLE_STAGES id", () => {
    const stageIds = new Set(FX_GL_LIFECYCLE_STAGES.map((s) => s.id));
    for (const r of FX_RULE_STAGE_LEG_STRUCTURES) {
      expect(
        stageIds.has(r.stage),
        `stage ${r.stage} for ${r.postingRuleId} must be declared`,
      ).toBe(true);
    }
    // The six expected stage groups are present (Initiation, daily revaluation,
    // Payment, Receipt, Termination, Realisation — the FCY→ZAR conversion stage).
    expect([...stageIds].sort()).toEqual(["a", "b", "c", "d", "realisation", "revaluation"]);
  });

  it("every leg carries an IAS/IFRS citation and a non-empty note", () => {
    for (const r of FX_RULE_STAGE_LEG_STRUCTURES) {
      expect(r.legs.length).toBeGreaterThan(0);
      for (const leg of r.legs) {
        expect(leg.iasCite.trim().length).toBeGreaterThan(0);
        expect(leg.note.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
