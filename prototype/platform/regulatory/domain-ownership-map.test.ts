// platform/regulatory/domain-ownership-map.test.ts
import { describe, expect, test } from "bun:test";

import {
  DOMAIN_OWNERSHIP,
  GOVERNANCE_SEATS,
  SEAT_AGENT,
  type Seat,
  classifyObligationDomain,
  domainsForSeat,
  obligationPrefix,
  ownershipForObligation,
  seatForObligation,
  subDomain,
  topLevelDomains,
} from "./domain-ownership-map";

describe("taxonomy integrity", () => {
  test("every sub-domain has a known governance seat", () => {
    for (const d of DOMAIN_OWNERSHIP) {
      expect(GOVERNANCE_SEATS.has(d.accountableSeat)).toBe(true);
      for (const s of d.coAccountableSeats ?? []) expect(GOVERNANCE_SEATS.has(s)).toBe(true);
    }
  });

  test("sub-domain keys are unique", () => {
    const keys = DOMAIN_OWNERSHIP.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test("every governance seat resolves to a named agent", () => {
    for (const s of GOVERNANCE_SEATS) {
      expect(SEAT_AGENT[s]?.name).toBeTruthy();
      expect(SEAT_AGENT[s]?.position).toBeTruthy();
    }
  });

  test("10 top-level domains, each with ≥1 accountable seat", () => {
    const tops = topLevelDomains();
    expect(tops.length).toBe(10);
    for (const t of tops) expect(t.seats.length).toBeGreaterThan(0);
  });
});

describe("obligationPrefix", () => {
  test.each([
    ["ORG-FC-02", "ORG-FC"],
    ["BCBS-CRE20", "BCBS-CRE"],
    ["ORG-PA-001", "ORG-PA"],
    ["ORG-PR-15", "ORG-PR"],
  ])("%s → %s", (id, want) => {
    expect(obligationPrefix(id)).toBe(want);
  });
});

describe("classifier — direct prefixes", () => {
  test.each<[string, string, Seat]>([
    ["ORG-FC-01", "aml-cft", "cco"],
    ["BCBS-CRE20", "credit-risk", "cro"],
    ["BCBS-MAR10", "market-risk", "cro"],
    ["BCBS-LEV10", "leverage-ratio", "cfo"],
    ["BCBS-LCR10", "liquidity-funding", "treasurer"],
    ["ORG-AC-01", "accounting", "cfo"],
    ["ORG-TX-01", "tax", "cfo"],
    ["ORG-CY-01", "cyber-infosec", "ciso"],
    ["ORG-ODP-01", "odp", "cco"],
    ["ORG-MK-01", "markets-trading", "head-of-global-markets"],
    ["ORG-EA-01", "external-audit", "cae"],
    ["ORG-FIT-01", "fit-proper", "company-secretary"],
    ["ORG-FX-01", "exchange-control", "treasurer"],
    ["ORG-HR-01", "labour-hr", "coo"],
  ])("%s → %s (%s)", (id, key, seat) => {
    expect(classifyObligationDomain({ id })).toBe(key);
    expect(seatForObligation({ id })).toBe(seat);
  });
});

describe("classifier — umbrella prefixes decompose by topic", () => {
  test("ORG-PA liquidity directive → liquidity-funding (treasurer)", () => {
    const o = {
      id: "ORG-PA-200",
      requirement: "Banks must comply with the liquidity coverage ratio.",
    };
    expect(classifyObligationDomain(o)).toBe("liquidity-funding");
    expect(seatForObligation(o)).toBe("treasurer");
  });
  test("ORG-PA credit-risk directive → credit-risk (cro)", () => {
    const o = {
      id: "ORG-PA-201",
      requirement: "Prudential treatment of distressed restructured credit exposures.",
    };
    expect(classifyObligationDomain(o)).toBe("credit-risk");
    expect(seatForObligation(o)).toBe("cro");
  });
  test("ORG-PA generic capital directive → capital-adequacy (cfo)", () => {
    const o = {
      id: "ORG-PA-202",
      requirement: "Capital framework based on Basel III; output floor and buffers.",
    };
    expect(classifyObligationDomain(o)).toBe("capital-adequacy");
    expect(seatForObligation(o)).toBe("cfo");
  });
  test("ORG-PR market-risk row → market-risk (cro)", () => {
    const o = { id: "ORG-PR-90", requirement: "Reporting value-at-risk amounts for market risk." };
    expect(classifyObligationDomain(o)).toBe("market-risk");
  });
  test("ORG-PR(IV) privacy family → privacy (information-officer), not prudential", () => {
    expect(obligationPrefix("ORG-PR(IV)-01")).toBe("ORG-PR(IV)");
    expect(classifyObligationDomain({ id: "ORG-PR(IV)-01" })).toBe("privacy");
    expect(seatForObligation({ id: "ORG-PR(IV)-01" })).toBe("information-officer");
  });
});

describe("resolvers", () => {
  test("ICAAP is co-owned by cfo", () => {
    const d = subDomain("icaap-ilaap");
    expect(d?.accountableSeat).toBe("cro");
    expect(d?.coAccountableSeats).toContain("cfo");
    expect(domainsForSeat("cfo").some((x) => x.key === "icaap-ilaap")).toBe(true);
  });
  test("unknown prefix → null (a finding, not a guess)", () => {
    expect(classifyObligationDomain({ id: "ORG-ZZZ-01" })).toBeNull();
    expect(ownershipForObligation({ id: "ORG-ZZZ-01" })).toBeNull();
  });
});
