// dashboard/instruments-view.ts
//
// Financial-instrument register API — the read + write surface over the
// security master (Principle 1: the master lives in the event log, this is a
// derived view).
//
//   GET  /api/instruments            — type summary + all instruments
//   GET  /api/instruments?type=<id>  — instruments of one tradeable type
//   GET  /api/instruments/:id        — single instrument detail
//   POST /api/instruments            — define a new instrument (emits
//                                      FinancialInstrumentDefined [+ Classified])
//
// The page lists the tradeable product menu (FX, Bond, Equity, IRS, Repo, MMD,
// IB Placement) plus Cash — the settled-cash instrument those FX trades
// decompose into. The security master keys rows by ACTUS contract type, but
// Bond/Repo/MMD/IB are all PAM, so `deriveInstrumentCategory` disambiguates by
// the `fi:<assetClass>:` prefix and the REPO/MMD/IBL token in the instrumentId.
//
// FX outrights are not pre-defined security-master instruments — their rate +
// settlement are per-trade (fxoutContractTermsSchema). What an FX trade *is*, in
// instrument terms, is a pair of cash legs: an FX outright DECOMPOSES into the
// per-currency CSH cash instruments `fi:csh:<CCY>:<bookId>`. That settled cash
// inventory is a first-class financial instrument and is THE instrument product
// control marks to ZAR to value FX positions (IAS 21 §28; CEO instruction
// 2026-05-31). So the Cash type is sourced live from the product-control
// desk-cash layer (computeDeskCashPositions), and FX is shown as the tradeable
// currency pairs that settle into it. Neither FX pairs nor cash are addable.
//
// Authority: D-FINANCIAL-INSTRUMENT-ENTITY (CEO-approved 2026-05-22);
//   CEO instruction 2026-05-31 (FX cash as a financial instrument).

import { nowUtc } from "../platform/core/types";
import { buildPhaseFixtureTag, productionTag } from "../platform/event-store/provenance";
import type { ProvenanceTag } from "../platform/event-store/provenance";
import type { EventStore } from "../platform/event-store/store";
import {
  type FinancialInstrumentClassifiedPayload,
  type FinancialInstrumentDefinedPayload,
  makeFinancialInstrumentClassified,
  makeFinancialInstrumentDefined,
} from "../platform/markets/cdm/instrument";
import { computeDeskCashPositions } from "../platform/product-control/desk-cash-positions";
import {
  type SecurityMasterRow,
  type SecurityMasterState,
  securityMasterInitial,
  securityMasterProjection,
} from "../platform/projections/markets/security-master";

// ---------------------------------------------------------------------------
// Tradeable instrument-type catalogue
// ---------------------------------------------------------------------------

export interface InstrumentCategory {
  /** Stable category id (used in ?type= and trade-book wiring). */
  readonly id: string;
  /** Friendly display label. */
  readonly label: string;
  /** Default ACTUS contract type for instruments added under this category. */
  readonly actus: string;
  /** trade-book.html product-type <select> value this category maps to. */
  readonly productType: string;
  /** Whether instruments of this type can be added via /api/instruments POST. */
  readonly addable: boolean;
}

export const INSTRUMENT_CATEGORIES: readonly InstrumentCategory[] = [
  { id: "fx", label: "FX Outright", actus: "FXOUT", productType: "fx", addable: false },
  // Cash — CSH. The per-currency settled-cash instrument FX decomposes into and
  // that product control marks to value FX positions. Sourced live from the
  // desk-cash layer; not booked directly, hence not addable.
  { id: "cash", label: "Cash", actus: "CSH", productType: "", addable: false },
  { id: "bond", label: "Bond", actus: "PAM", productType: "bond", addable: true },
  { id: "equity", label: "Equity", actus: "STK", productType: "equity", addable: true },
  { id: "irs", label: "Interest Rate Swap", actus: "IRS", productType: "irs", addable: true },
  { id: "repo", label: "Repo", actus: "PAM", productType: "repo", addable: true },
  {
    id: "mmd",
    label: "Money Market Deposit",
    actus: "PAM",
    productType: "mmd",
    addable: true,
  },
  {
    id: "ib-placement",
    label: "IB Placement",
    actus: "PAM",
    productType: "ib-placement",
    addable: true,
  },
];

const CATEGORY_BY_ID = new Map(INSTRUMENT_CATEGORIES.map((c) => [c.id, c]));

function categoryLabel(id: string): string {
  return CATEGORY_BY_ID.get(id)?.label ?? id;
}

/** Currency pairs the bank transacts in (FX reference data). */
export const FX_PAIRS: ReadonlyArray<{ base: string; quote: string }> = [
  { base: "USD", quote: "ZAR" },
  { base: "EUR", quote: "ZAR" },
  { base: "GBP", quote: "ZAR" },
  { base: "JPY", quote: "ZAR" },
  { base: "EUR", quote: "USD" },
  { base: "GBP", quote: "USD" },
];

// ---------------------------------------------------------------------------
// Category derivation
// ---------------------------------------------------------------------------

/**
 * Map a security-master row to one of the tradeable categories. Returns null
 * for instruments outside the listed subset (e.g. ZCB strips, CMP composites).
 */
export function deriveInstrumentCategory(row: SecurityMasterRow): string | null {
  switch (row.actusContractType) {
    case "STK":
      return "equity";
    case "IRS":
      return "irs";
    case "FXOUT":
      return "fx";
    case "CSH":
      return "cash"; // settled-cash instrument FX decomposes into
  }
  const id = row.instrumentId.toUpperCase();
  if (id.includes("REPO")) return "repo";
  if (id.includes("MMD")) return "mmd";
  if (id.includes("IBL")) return "ib-placement";
  if (row.actusContractType === "CLM") return "ib-placement"; // call money
  // Remaining PAM / ZCB / CMP with a debt shape → Bond.
  if (id.startsWith("FI:BOND:") || id.includes("BOND") || row.isin) return "bond";
  return "bond";
}

// ---------------------------------------------------------------------------
// View shapes
// ---------------------------------------------------------------------------

export interface InstrumentClassificationView {
  readonly hqlaLevel: string;
  readonly baselRiskWeight: string;
  readonly ifrs9Category: string;
  readonly saCcrAssetClass: string;
  readonly effectiveDate: string | undefined;
}

export interface InstrumentView {
  readonly instrumentId: string;
  readonly category: string;
  readonly categoryLabel: string;
  readonly name: string;
  readonly actusContractType: string | undefined;
  readonly instrumentSubtype: string | undefined;
  readonly isin: string | undefined;
  readonly cfiCode: string | undefined;
  readonly currency: string;
  readonly jurisdiction: string | undefined;
  readonly legalEntityId: string | undefined;
  readonly maturityDate: string | undefined;
  readonly productRef: string | undefined;
  readonly contractTerms: Record<string, unknown>;
  readonly classification: InstrumentClassificationView | null;
  readonly reference: boolean;
  /** Product-control valuation — present only for Cash instruments. */
  readonly valuation: InstrumentValuationView | null;
  readonly eventCount: number;
}

/**
 * Product-control valuation of a Cash instrument (IAS 21 §28). Present only for
 * the Cash category — the settled-cash inventory FX decomposes into, marked to
 * the reporting currency to value FX positions.
 */
export interface InstrumentValuationView {
  readonly bookId: string;
  readonly fcyQuantityMinor: number;
  readonly markRate: number | null;
  readonly zarValueMinor: number | null;
  /** false when there is no production CCY/ZAR mark (no-silent-zero). */
  readonly markable: boolean;
  readonly unrealisedPnlZarMinor: number | null;
  readonly realisedZarMinorCumulative: number;
}

export interface InstrumentTypeSummary {
  readonly id: string;
  readonly label: string;
  readonly count: number;
  readonly addable: boolean;
}

export interface InstrumentsView {
  readonly types: readonly InstrumentTypeSummary[];
  readonly instruments: readonly InstrumentView[];
}

// ---------------------------------------------------------------------------
// Projection fold
// ---------------------------------------------------------------------------

function buildSecurityMaster(store: EventStore): SecurityMasterState {
  let state = securityMasterInitial;
  for (const event of store.replay()) {
    if (securityMasterProjection.accepts(event)) {
      state = securityMasterProjection.reduce(state, event);
    }
  }
  return state;
}

/** Short display name from the instrumentId natural key. */
function shortName(instrumentId: string, isin: string | undefined): string {
  const segs = instrumentId.split(":");
  // fi:<assetClass>:<naturalKey...> → join everything after the asset class.
  const tail = segs.length > 2 ? segs.slice(2).join(":") : segs[segs.length - 1];
  return tail || isin || instrumentId;
}

function rowToView(row: SecurityMasterRow, category: string): InstrumentView {
  const classification: InstrumentClassificationView | null =
    row.hqlaLevel !== undefined
      ? {
          hqlaLevel: row.hqlaLevel,
          baselRiskWeight: row.baselRiskWeight ?? "—",
          ifrs9Category: row.ifrs9Category ?? "—",
          saCcrAssetClass: row.saCcrAssetClass ?? "—",
          effectiveDate: row.classificationEffectiveDate,
        }
      : null;
  return {
    instrumentId: row.instrumentId,
    category,
    categoryLabel: categoryLabel(category),
    name: shortName(row.instrumentId, row.isin),
    actusContractType: row.actusContractType,
    instrumentSubtype: row.instrumentSubtype,
    isin: row.isin,
    cfiCode: row.cfiCode,
    currency: row.currency,
    jurisdiction: row.jurisdiction,
    legalEntityId: row.legalEntityId,
    maturityDate: row.maturityDate,
    productRef: row.productRef,
    contractTerms: row.contractTerms,
    classification,
    reference: false,
    valuation: null,
    eventCount: row.eventCount,
  };
}

function fxPairViews(): InstrumentView[] {
  return FX_PAIRS.map(({ base, quote }) => ({
    instrumentId: `fx:${base}${quote}`,
    category: "fx",
    categoryLabel: categoryLabel("fx"),
    name: `${base}/${quote}`,
    actusContractType: "FXOUT",
    instrumentSubtype: "atomic",
    isin: undefined,
    cfiCode: undefined,
    currency: quote,
    jurisdiction: undefined,
    legalEntityId: "LE-ZA-HOZ-BANK",
    maturityDate: undefined,
    productRef: undefined,
    contractTerms: { baseCurrency: base, quoteCurrency: quote },
    classification: null,
    reference: true,
    valuation: null,
    eventCount: 0,
  }));
}

/**
 * Cash instruments — the per-currency settled-cash inventory FX decomposes into,
 * sourced live from the product-control desk-cash layer and carrying the ZAR
 * valuation (IAS 21 §28) PC uses to value FX positions.
 */
function cashInstrumentViews(store: EventStore): InstrumentView[] {
  const set = computeDeskCashPositions(store);
  return set.positions.map((p) => ({
    instrumentId: p.instrumentId,
    category: "cash",
    categoryLabel: categoryLabel("cash"),
    name: `${p.currency} cash · ${p.bookId}`,
    actusContractType: "CSH",
    instrumentSubtype: "atomic",
    isin: undefined,
    cfiCode: undefined,
    currency: p.currency,
    jurisdiction: undefined,
    legalEntityId: p.entity,
    maturityDate: undefined,
    productRef: undefined,
    contractTerms: { bookId: p.bookId, avgCostZarRate: p.avgCostZarRate },
    classification: null,
    reference: true,
    valuation: {
      bookId: p.bookId,
      fcyQuantityMinor: p.fcyQuantityMinor,
      markRate: p.markRate,
      zarValueMinor: p.zarValueMinor,
      markable: p.unrealisedPnlZarMinor.present,
      unrealisedPnlZarMinor: p.unrealisedPnlZarMinor.present ? p.unrealisedPnlZarMinor.value : null,
      realisedZarMinorCumulative: p.realisedZarMinorCumulative,
    },
    eventCount: 0,
  }));
}

/** Build the full instruments view (type summary + instruments). */
export function buildInstrumentsView(store: EventStore, type?: string): InstrumentsView {
  const master = buildSecurityMaster(store);
  const instruments: InstrumentView[] = [];
  const seen = new Set<string>();

  for (const row of master.instruments.values()) {
    const category = deriveInstrumentCategory(row);
    if (category === null) continue; // outside the listed subset
    instruments.push(rowToView(row, category));
    seen.add(row.instrumentId);
  }
  instruments.push(...fxPairViews());
  // Cash instruments come from the live desk-cash layer; skip any already
  // defined as a security-master CSH row (master definition wins).
  for (const cash of cashInstrumentViews(store)) {
    if (!seen.has(cash.instrumentId)) instruments.push(cash);
  }

  instruments.sort((a, b) =>
    a.category === b.category
      ? a.instrumentId.localeCompare(b.instrumentId)
      : a.category.localeCompare(b.category),
  );

  const types: InstrumentTypeSummary[] = INSTRUMENT_CATEGORIES.map((c) => ({
    id: c.id,
    label: c.label,
    count: instruments.filter((i) => i.category === c.id).length,
    addable: c.addable,
  }));

  const filtered = type ? instruments.filter((i) => i.category === type) : instruments;
  return { types, instruments: filtered };
}

// ---------------------------------------------------------------------------
// POST — define a new instrument
// ---------------------------------------------------------------------------

interface DefineInstrumentBody {
  category?: string;
  provenanceMode?: string;
  instrumentId?: string;
  instrumentSubtype?: string;
  actusContractType?: string;
  currency?: string;
  jurisdiction?: string;
  legalEntityId?: string;
  isin?: string;
  cfiCode?: string;
  issuerLei?: string;
  productRef?: string;
  maturityDate?: string;
  contractTerms?: Record<string, unknown>;
  classification?: {
    hqlaLevel?: string;
    baselRiskWeight?: string;
    ifrs9Category?: string;
    saCcrAssetClass?: string;
    rationale?: string;
  };
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function resolveProvenance(mode: unknown): ProvenanceTag {
  if (mode === "production") {
    return productionTag({
      sourceLineage: "operator:instrument-master",
      tags: ["instrument-define", "manual"],
    });
  }
  return buildPhaseFixtureTag({
    sourceLineage: "operator:instrument-master",
    tags: ["instrument-define", "manual", "reference-data"],
  });
}

async function handleDefineInstrument(req: Request, store: EventStore): Promise<Response> {
  let body: DefineInstrumentBody;
  try {
    body = (await req.json()) as DefineInstrumentBody;
  } catch {
    return jsonResponse({ ok: false, error: "invalid JSON body" }, 400);
  }

  const category = body.category;
  const cat = category ? CATEGORY_BY_ID.get(category) : undefined;
  if (!cat || !cat.addable) {
    return jsonResponse(
      { ok: false, error: `category must be one of the addable types: ${ADDABLE_IDS}` },
      400,
    );
  }
  if (!body.instrumentId || !body.currency || !body.jurisdiction || !body.legalEntityId) {
    return jsonResponse(
      {
        ok: false,
        error: "instrumentId, currency, jurisdiction and legalEntityId are required",
      },
      400,
    );
  }

  // Duplicate guard — refuse to redefine an existing instrumentId.
  for (const e of store.replay({ type: "FinancialInstrumentDefined" })) {
    if ((e.payload as { instrumentId?: string }).instrumentId === body.instrumentId) {
      return jsonResponse(
        { ok: false, error: `instrument "${body.instrumentId}" is already defined` },
        409,
      );
    }
  }

  const definedPayload: FinancialInstrumentDefinedPayload = {
    instrumentId: body.instrumentId,
    instrumentSubtype: (body.instrumentSubtype ?? "atomic") as never,
    actusContractType: (body.actusContractType ?? cat.actus) as never,
    currency: body.currency,
    jurisdiction: body.jurisdiction,
    legalEntityId: body.legalEntityId,
    contractTerms: body.contractTerms ?? {},
    ...(body.isin ? { isin: body.isin } : {}),
    ...(body.cfiCode ? { cfiCode: body.cfiCode } : {}),
    ...(body.issuerLei ? { issuerLei: body.issuerLei } : {}),
    ...(body.productRef ? { productRef: body.productRef } : {}),
    ...(body.maturityDate ? { maturityDate: body.maturityDate } : {}),
  };

  const provenance = resolveProvenance(body.provenanceMode);
  const asOf = nowUtc();
  const actor = { type: "human" as const, id: "operator:instrument-master" };
  const citations = ["D-FINANCIAL-INSTRUMENT-ENTITY", "ACTUS-FRF-V1.1"];

  let definedEventId: string;
  try {
    const event = makeFinancialInstrumentDefined({
      asOf,
      entity: body.legalEntityId,
      actor,
      citations,
      payload: definedPayload,
    });
    store.append({ ...event, provenance });
    definedEventId = event.event_id;
  } catch (e) {
    return jsonResponse({ ok: false, error: (e as Error).message }, 400);
  }

  // Optional classification overlay.
  const c = body.classification;
  if (c?.hqlaLevel && c.baselRiskWeight && c.ifrs9Category && c.saCcrAssetClass) {
    try {
      const classifiedPayload: FinancialInstrumentClassifiedPayload = {
        instrumentId: body.instrumentId,
        hqlaLevel: c.hqlaLevel as never,
        baselRiskWeight: c.baselRiskWeight as never,
        ifrs9Category: c.ifrs9Category as never,
        saCcrAssetClass: c.saCcrAssetClass as never,
        classifiedBy: "operator:instrument-master",
        effectiveDate: asOf.slice(0, 10),
        rationale: c.rationale || "Operator-entered classification via the instruments page.",
      };
      const event = makeFinancialInstrumentClassified({
        asOf,
        entity: body.legalEntityId,
        actor,
        citations,
        payload: classifiedPayload,
      });
      store.append({ ...event, provenance });
    } catch (e) {
      // Definition already landed; report the classification failure non-fatally.
      return jsonResponse({
        ok: true,
        instrumentId: body.instrumentId,
        eventId: definedEventId,
        classificationError: (e as Error).message,
      });
    }
  }

  return jsonResponse({ ok: true, instrumentId: body.instrumentId, eventId: definedEventId }, 201);
}

const ADDABLE_IDS = INSTRUMENT_CATEGORIES.filter((c) => c.addable)
  .map((c) => c.id)
  .join(", ");

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

/**
 * Register financial-instrument API routes. Returns a Response if the URL is
 * handled, null otherwise. Mirrors registerTradeBookRoutes.
 */
export async function registerInstrumentRoutes(
  pathname: string,
  method: string,
  req: Request,
  store: EventStore,
  searchParams: URLSearchParams,
): Promise<Response | null> {
  if (pathname === "/api/instruments" && method === "GET") {
    const type = searchParams.get("type") ?? undefined;
    return jsonResponse(buildInstrumentsView(store, type));
  }
  if (pathname === "/api/instruments" && method === "POST") {
    return handleDefineInstrument(req, store);
  }
  if (pathname.startsWith("/api/instruments/") && method === "GET") {
    const id = decodeURIComponent(pathname.replace("/api/instruments/", ""));
    if (!id) return jsonResponse({ error: "missing instrument id" }, 400);
    const view = buildInstrumentsView(store);
    const instrument = view.instruments.find((i) => i.instrumentId === id);
    if (!instrument) return jsonResponse({ error: `instrument "${id}" not found` }, 404);
    return jsonResponse({ instrument });
  }
  return null;
}
