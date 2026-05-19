// tests/payments/iso20022.test.ts
//
// Unit tests for ISO 20022 message generators.
// Covers pacs.008, pacs.009, and camt.053.
//
// Authority:
//   D-FX-CLS-MEMBERSHIP — ISO 20022 settlement path
//   D-MARKETS-SCHEMA-FOUNDATION — CDM event families
//   PROC-PAY-RBH-01 — reconciliation procedure

import { describe, expect, test } from "bun:test";

import type { PaymentInitiatedPayload } from "@platform/event-store/event-types/payments";
import type { FxTradeExecutedPayload } from "@platform/markets/cdm/fx";
import type { Camt053Entry } from "@platform/payments/iso20022/camt053";
import { generateCamt053 } from "@platform/payments/iso20022/camt053";
import { generatePacs008 } from "@platform/payments/iso20022/pacs008";
import { generatePacs009 } from "@platform/payments/iso20022/pacs009";
import type { FIIdentification } from "@platform/payments/iso20022/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TRADE_FIXTURE: FxTradeExecutedPayload = {
  tradeId: { scheme: "INTERNAL", value: "TRD-TEST-ISO-001" },
  productTaxonomy: "FX-spot",
  currencyPair: { base: "USD", quote: "ZAR" },
  side: "buy",
  legs: [
    {
      legKind: "near",
      payCurrency: "ZAR",
      receiveCurrency: "USD",
      notional: { currency: "ZAR", amountMinor: 9_250_000_000_00 },
      counterNotional: { currency: "USD", amountMinor: 5_000_000_00 },
      rate: { currency: "ZAR", amount: 18.5 },
      settlementDate: { iso: "2026-05-14", calendar: "JIHCAL" },
    },
  ],
  tradeDate: { iso: "2026-05-12", calendar: "JIHCAL" },
  counterparty: {
    partyId: "CP-TEST-001",
    name: "Test Counterparty",
    role: "counterparty",
    jurisdiction: "ZA",
  },
  venue: "OTC",
  trader: "trader@bank.local",
  bookId: "BOOK-FX-001",
  bookType: "trading",
  settlementForm: "physical",
  settlementPath: "correspondent",
  finsurvCategory: "TEST",
};

const PAYMENT_FIXTURE: PaymentInitiatedPayload = {
  tradeId: "TRD-TEST-ISO-001",
  legKind: "deliver",
  paymentRef: "PAY-ISO-001",
  currency: "ZAR",
  netCash: 9_250_000_000_00,
  initiatedAt: "2026-05-14T08:00:00.000Z",
  citations: ["D-FX-CLS-MEMBERSHIP"],
};

const SENDER_FI: FIIdentification = {
  bic: "BANKZAJJXXX",
  name: "THE BANK ZA",
  country: "ZA",
};

const RECEIVER_FI: FIIdentification = {
  bic: "SBZAZAJJXXX",
  name: "Standard Bank ZA",
  country: "ZA",
};

// ---------------------------------------------------------------------------
// pacs.008
// ---------------------------------------------------------------------------

describe("pacs.008 generator", () => {
  test("GrpHdr.NbOfTxs is 1", () => {
    const doc = generatePacs008(PAYMENT_FIXTURE, SENDER_FI, RECEIVER_FI);
    expect(doc.GrpHdr.NbOfTxs).toBe("1");
  });

  test("IntrBkSttlmAmt.Ccy matches payment currency", () => {
    const doc = generatePacs008(PAYMENT_FIXTURE, SENDER_FI, RECEIVER_FI);
    expect(doc.CdtTrfTxInf).toHaveLength(1);
    const [txInfo] = doc.CdtTrfTxInf;
    expect(txInfo?.IntrBkSttlmAmt.Ccy).toBe("ZAR");
  });

  test("IntrBkSttlmAmt.value is formatted with period separator", () => {
    const doc = generatePacs008(PAYMENT_FIXTURE, SENDER_FI, RECEIVER_FI);
    const [txInfo] = doc.CdtTrfTxInf;
    const amount = txInfo?.IntrBkSttlmAmt.value ?? "";
    expect(amount).toContain(".");
    expect(amount).not.toContain(",");
  });

  test("SttlmInf.SttlmMtd is CLRG", () => {
    const doc = generatePacs008(PAYMENT_FIXTURE, SENDER_FI, RECEIVER_FI);
    expect(doc.GrpHdr.SttlmInf.SttlmMtd).toBe("CLRG");
  });

  test("Dbtr is sender FI", () => {
    const doc = generatePacs008(PAYMENT_FIXTURE, SENDER_FI, RECEIVER_FI);
    const [txInfo] = doc.CdtTrfTxInf;
    expect(txInfo?.Dbtr.Nm).toBe("THE BANK ZA");
  });

  test("serialisedXml contains Document element", () => {
    const doc = generatePacs008(PAYMENT_FIXTURE, SENDER_FI, RECEIVER_FI);
    expect(doc.serialisedXml).toContain("<Document");
    expect(doc.serialisedXml).toContain("pacs.008");
  });

  test("MsgId is set", () => {
    const doc = generatePacs008(PAYMENT_FIXTURE, SENDER_FI, RECEIVER_FI);
    expect(doc.GrpHdr.MsgId.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// pacs.009
// ---------------------------------------------------------------------------

describe("pacs.009 generator", () => {
  test("deliver leg currency matches trade pay currency (ZAR)", () => {
    const doc = generatePacs009(TRADE_FIXTURE, "deliver", SENDER_FI, RECEIVER_FI);
    const [txInfo] = doc.CdtTrfTxInf;
    expect(txInfo?.IntrBkSttlmAmt.Ccy).toBe("ZAR");
  });

  test("receive leg currency matches trade receive currency (USD)", () => {
    const doc = generatePacs009(TRADE_FIXTURE, "receive", SENDER_FI, RECEIVER_FI);
    const [txInfo] = doc.CdtTrfTxInf;
    expect(txInfo?.IntrBkSttlmAmt.Ccy).toBe("USD");
  });

  test("deliver leg amount matches trade notional", () => {
    const doc = generatePacs009(TRADE_FIXTURE, "deliver", SENDER_FI, RECEIVER_FI);
    const [txInfo] = doc.CdtTrfTxInf;
    const amount = txInfo?.IntrBkSttlmAmt.value ?? "0";
    // notional.amountMinor = 9_250_000_000_00 = 925000000000 minor units
    // ISO 20022 decimal: 9250000000.00
    expect(Number.parseFloat(amount)).toBeCloseTo(9_250_000_000, 0);
  });

  test("receive leg amount matches trade counter-notional", () => {
    const doc = generatePacs009(TRADE_FIXTURE, "receive", SENDER_FI, RECEIVER_FI);
    const [txInfo] = doc.CdtTrfTxInf;
    const amount = txInfo?.IntrBkSttlmAmt.value ?? "0";
    // counterNotional.amountMinor = 5_000_000_00 = 500000000 minor units
    // ISO 20022 decimal: 5000000.00
    expect(Number.parseFloat(amount)).toBeCloseTo(5_000_000, 0);
  });

  test("GrpHdr.NbOfTxs is 1", () => {
    const doc = generatePacs009(TRADE_FIXTURE, "deliver", SENDER_FI, RECEIVER_FI);
    expect(doc.GrpHdr.NbOfTxs).toBe("1");
  });

  test("Purp.Cd is FXNT (FX net transfer)", () => {
    const doc = generatePacs009(TRADE_FIXTURE, "deliver", SENDER_FI, RECEIVER_FI);
    const [txInfo] = doc.CdtTrfTxInf;
    expect(txInfo?.Purp?.Cd).toBe("FXNT");
  });

  test("serialisedXml contains pacs.009 namespace", () => {
    const doc = generatePacs009(TRADE_FIXTURE, "deliver", SENDER_FI, RECEIVER_FI);
    expect(doc.serialisedXml).toContain("pacs.009");
  });
});

// ---------------------------------------------------------------------------
// camt.053
// ---------------------------------------------------------------------------

describe("camt.053 generator", () => {
  const USD_ENTRY: Camt053Entry = {
    amountMinor: 500_000_000n, // USD 5,000,000
    currency: "USD",
    CdtDbtInd: "CRDT",
    BookgDt: new Date("2026-05-14T00:00:00.000Z"),
    ValDt: new Date("2026-05-14T00:00:00.000Z"),
    BkTxCd: {
      Prtry: { Cd: "FXCF", Issr: "SBZAZAJJXXX" },
    },
    NtryDtls: {
      TxDtls: [
        {
          Refs: { EndToEndId: "TRD-TEST-ISO-001" },
          RmtInf: { Ustrd: "FX SPOT RECEIVE LEG" },
        },
      ],
    },
  };

  const BASE_PARAMS = {
    accountIban: "ZA00BANK00000000000001",
    correspondentBic: "SBZAZAJJXXX",
    statementDate: new Date("2026-05-14T00:00:00.000Z"),
    currency: "USD",
  };

  test("Ntry count matches input entries", () => {
    const doc = generateCamt053({
      ...BASE_PARAMS,
      openingBalance: 1_000_000_000n,
      entries: [USD_ENTRY],
    });
    const [stmt] = doc.Stmt;
    expect(stmt?.Ntry).toHaveLength(1);
  });

  test("CdtDbtInd is CRDT for credit entry", () => {
    const doc = generateCamt053({
      ...BASE_PARAMS,
      openingBalance: 1_000_000_000n,
      entries: [USD_ENTRY],
    });
    const [stmt] = doc.Stmt;
    const [ntry] = stmt?.Ntry ?? [];
    expect(ntry?.CdtDbtInd).toBe("CRDT");
  });

  test("opening balance (OPBD) is present", () => {
    const doc = generateCamt053({
      ...BASE_PARAMS,
      openingBalance: 1_000_000_000n,
      entries: [USD_ENTRY],
    });
    const [stmt] = doc.Stmt;
    const opBal = stmt?.Bal.find((b) => b.Tp.CdOrPrtry.Cd === "OPBD");
    expect(opBal).toBeDefined();
    expect(opBal?.CdtDbtInd).toBe("CRDT");
  });

  test("closing balance (CLBD) = opening + credit entry", () => {
    const doc = generateCamt053({
      ...BASE_PARAMS,
      openingBalance: 1_000_000_000n,
      entries: [USD_ENTRY],
    });
    const [stmt] = doc.Stmt;
    const clBal = stmt?.Bal.find((b) => b.Tp.CdOrPrtry.Cd === "CLBD");
    expect(clBal).toBeDefined();
    // Opening: 1_000_000_000 minor = 10,000,000 USD
    // Entry: 500_000_000 minor = 5,000,000 USD
    // Closing: 1_500_000_000 minor → "15000000.00"
    expect(Number.parseFloat(clBal?.Amt.value ?? "0")).toBeCloseTo(15_000_000, 0);
  });

  test("DBIT entry reduces closing balance", () => {
    const debitEntry: Camt053Entry = {
      ...USD_ENTRY,
      CdtDbtInd: "DBIT",
      amountMinor: 100_000_000n, // USD 1,000,000
    };

    const doc = generateCamt053({
      ...BASE_PARAMS,
      openingBalance: 1_000_000_000n,
      entries: [debitEntry],
    });
    const [stmt] = doc.Stmt;
    const clBal = stmt?.Bal.find((b) => b.Tp.CdOrPrtry.Cd === "CLBD");
    // 9,000,000 USD
    expect(Number.parseFloat(clBal?.Amt.value ?? "0")).toBeCloseTo(9_000_000, 0);
  });

  test("serialisedXml contains camt.053 namespace", () => {
    const doc = generateCamt053({
      ...BASE_PARAMS,
      openingBalance: 1_000_000_000n,
      entries: [USD_ENTRY],
    });
    expect(doc.serialisedXml).toContain("camt.053");
  });

  test("empty entries: closing = opening", () => {
    const doc = generateCamt053({ ...BASE_PARAMS, openingBalance: 1_000_000_000n, entries: [] });
    const [stmt] = doc.Stmt;
    const clBal = stmt?.Bal.find((b) => b.Tp.CdOrPrtry.Cd === "CLBD");
    const opBal = stmt?.Bal.find((b) => b.Tp.CdOrPrtry.Cd === "OPBD");
    expect(clBal?.Amt.value).toBe(opBal?.Amt.value);
  });
});
