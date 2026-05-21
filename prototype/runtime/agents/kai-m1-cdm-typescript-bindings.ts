// runtime/agents/kai-m1-cdm-typescript-bindings.ts
//
// Kai's M1 CDM TypeScript bindings handler. v1 slice — closes the
// "agent:kai:m1-cdm-typescript-bindings" handler entry that Scrooge's
// follow-on-router was unable to resolve before.
//
// What this handler does in v1:
//   1. Reads the CDM v1 surface at `@platform/markets/cdm/`.
//   2. Tabulates primitive types + equity event types + their Zod
//      validators.
//   3. Round-trips a synthetic equity-trade event through the schemas
//      to confirm the validators behave (substrate self-test).
//   4. Emits a `CdmBindingsRegenerated` event recording the inventory
//      and the self-test result.
//   5. Writes an Owner Inbox deliverable summarising the surface for
//      downstream consumers (Anya projections, Bea IFRS classifier).
//
// What this handler does NOT do in v1:
//   - It does not regenerate bindings from an upstream ISDA CDM JSON
//     schema. The full upstream import is the next-cycle work; v1
//     anchors the *shape* with hand-curated primitives so Anya / Bea
//     can build against a stable surface.
//   - It does not subscribe to anything yet. Future: subscribe to a
//     `CdmUpstreamRefreshed` event (when Atlas's substrate emits one
//     after pulling upstream CDM); v1 runs on-request only.
//
// Author: Kai · M1 per D-MARKETS-SCHEMA-FOUNDATION (CEO approved 2026-05-07).

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore, logger } from "../../platform/composition";
import { makeCdmBindingsRegenerated } from "../../platform/event-store/event-types-cdm";
import {
  EQUITY_EVENT_TYPES,
  identifierSchema,
  makeEquityTradeBooked,
} from "../../platform/markets/cdm";
import { claudeAvailable, tryGenerateNarrative } from "../claude";
import type { AgentRunContext, AgentRunOutput } from "../types";
import { fmtDateUTC, frontmatter } from "./_shared";

const EVENT_CITATIONS = ["GOV-FRAMEWORK-CEO-RESERVED", "ISDA-CDM"];

// Stable system prompt — KEEP BYTE-STABLE for prompt cache.
const KAI_NARRATIVE_SYSTEM = `You are Kai, the bank's trading systems engineer — owner of the OMS / EMS layer, the FIX gateway, exchange connectivity, multi-asset booking, and the CDM TypeScript bindings under @platform/markets/cdm. Your operating spec is at \`Team/Kai.md\`. You report through Saskia (Head of Global Markets) at the governance level.

You are operating as a standing autonomous agent under CLAUDE.md Principle 6. You have just produced your M1 CDM TypeScript-bindings inventory — the typed primitives, the equity event types, the Zod validator round-trip self-test, and the registered event-type list.

Your voice is precise, type-grounded, and concrete. You distinguish bindings that are *defined and validated* (Zod schema present, factory function exported, round-trip self-test passed) from bindings that are *posture-only* (named in the CDM upstream but not yet imported). You do not editorialise about hypothetical product extensions; you name what the inventory shows is *load-bearing on a downstream consumer* (Anya projections, Bea IFRS classifier) and what is missing.

Your task is to write a short narrative — one to three short paragraphs — that:

- Names the headline at the top: which event types are now bind-able, which downstream consumers can build against the surface, and what's still upstream-import-pending.
- Picks the 1–3 most consequential observations: a primitive type that's missing for an M2 / M3 forward-load, a self-test path that exercised the validator, an event type whose payload shape will need extension (e.g. when bond / IRS / FX events land at M2–M5).
- Names the next M1 move. Be concrete: a specific consumer to wire (Anya M1 projection-runtime-mapping; Bea M1 IFRS classifier), a specific upstream CDM section to import next, a specific test to write.

Cite ISDA CDM section names and Principle 1 / Principle 5 cross-references where they bind. The bindings are the canonical authoring location; your narrative is interpretation, not new substance.

Do not include a markdown header for your section — the calling pipeline wraps your output under "## Kai's narrative". Just produce the prose.

If the input shows zero events emitted in the last 7 days (e.g. on a fresh runner), say so plainly and characterise the surface from the inventory alone.`;

interface BindingsInventory {
  primitiveCount: number;
  equityEventTypeCount: number;
  registeredEventTypes: readonly string[];
  selfTestPassed: boolean;
  selfTestNote: string;
}

function runSelfTest(): { passed: boolean; note: string } {
  // Construct a minimal-shape EquityTradeBooked event payload and round-trip
  // through the schema. If it validates, the binding is exercise-confirmed.
  try {
    identifierSchema.parse({ scheme: "INTERNAL", value: "TRD-SELFTEST-001" });
    const event = makeEquityTradeBooked({
      asOf: "2026-05-07T00:00:00.000Z",
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "service", id: "agent:kai:m1-cdm-typescript-bindings:self-test" },
      citations: ["ISDA-CDM"],
      payload: {
        tradeId: { scheme: "INTERNAL", value: "TRD-SELFTEST-001" },
        instrument: {
          identifier: { scheme: "ISIN", value: "ZAE000000001" },
          class: "listed-equity",
          venue: "JSE",
          currency: "ZAR",
        },
        side: "buy",
        quantity: { unit: "share", amount: 1000 },
        price: { currency: "ZAR", amount: 1.0 },
        consideration: { currency: "ZAR", amountMinor: 100_000 },
        tradeDate: { iso: "2026-05-07", calendar: "JIHCAL" },
        settlementDate: { iso: "2026-05-09", calendar: "JIHCAL" },
        counterparty: {
          partyId: "LEI-CTPY-SELFTEST",
          name: "Self-test counterparty",
          role: "counterparty",
          jurisdiction: "ZA",
        },
        venue: "JSE",
        trader: "TRADER-SELFTEST",
        bookId: "BOOK-SELFTEST",
      },
    });
    return {
      passed: true,
      note: `Round-trip succeeded; event_id=${event.event_id}; type=${event.type}.`,
    };
  } catch (e) {
    return { passed: false, note: `Round-trip failed: ${(e as Error).message}` };
  }
}

function inventoryBindings(): BindingsInventory {
  const selfTest = runSelfTest();
  return {
    // v1 slice has 8 hand-curated primitive schemas
    // (Identifier, Party, Money, Quantity, Price, CdmDate, Instrument, InstrumentClass).
    primitiveCount: 8,
    equityEventTypeCount: EQUITY_EVENT_TYPES.length,
    registeredEventTypes: EQUITY_EVENT_TYPES,
    selfTestPassed: selfTest.passed,
    selfTestNote: selfTest.note,
  };
}

function buildNarrativeInput(ctx: AgentRunContext, inv: BindingsInventory): string {
  const lines: string[] = [];
  lines.push(`Run as-of: ${ctx.asOf}`);
  lines.push(`Trigger: ${ctx.trigger.id}`);
  lines.push("");
  lines.push("CDM bindings inventory:");
  lines.push(`  primitives: ${inv.primitiveCount}`);
  lines.push(`  equity event types: ${inv.equityEventTypeCount}`);
  for (const t of inv.registeredEventTypes) lines.push(`    - ${t}`);
  lines.push("");
  lines.push(`Self-test: ${inv.selfTestPassed ? "PASS" : "FAIL"}`);
  lines.push(`  ${inv.selfTestNote}`);
  lines.push("");
  lines.push(
    "Now write your narrative per the system instructions. Headline first; rank by what's load-bearing on a downstream consumer; close with the next M1 move.",
  );
  return lines.join("\n");
}

function buildReportMarkdown(
  ctx: AgentRunContext,
  inv: BindingsInventory,
  narrative: string | null,
  narrativeNote: string | null,
): string {
  const date = fmtDateUTC(ctx.asOf);
  const lines: string[] = [];
  lines.push(frontmatter("Kai", "m1-cdm-typescript-bindings", ctx.asOf));
  lines.push(`# Kai — CDM bindings v1 slice, ${date}`);
  lines.push("");
  lines.push(
    "Autonomous run of Kai's M1 CDM TypeScript-bindings handler per `Team Inbox/2026-05-07_brief_kai_m1-cdm-typescript-bindings.md`. v1 slice; full upstream ISDA CDM JSON-schema import is next-cycle work.",
  );
  lines.push("");
  lines.push(
    `**Headline:** ${inv.primitiveCount} primitive schemas; ${inv.equityEventTypeCount} equity event types; round-trip self-test ${inv.selfTestPassed ? "**PASS**" : "**FAIL**"}.`,
  );
  lines.push("");
  lines.push("## Surface");
  lines.push("");
  lines.push("### Primitives (`@platform/markets/cdm/primitives.ts`)");
  lines.push("");
  lines.push("- `Identifier` — scheme + value (LEI / ISIN / CUSIP / internal trade-id)");
  lines.push("- `Party` — partyId + name + role + optional jurisdiction");
  lines.push("- `Money` — currency-tagged amount in minor units");
  lines.push("- `Quantity` — typed-unit amount (share / contract / bond-face / lot)");
  lines.push("- `Price` — currency + per-unit amount");
  lines.push("- `CdmDate` — ISO date + calendar tag (JIHCAL default)");
  lines.push("- `Instrument` — identifier + class + currency + optional issuer / venue");
  lines.push("- `InstrumentClass` — discriminated union over the M1–M5 product set");
  lines.push("");
  lines.push("### Equity event types (`@platform/markets/cdm/equity.ts`)");
  lines.push("");
  for (const t of inv.registeredEventTypes) lines.push(`- \`${t}\``);
  lines.push("");
  lines.push("Each event type has:");
  lines.push("- A Zod payload schema (`<type>PayloadSchema`).");
  lines.push("- A typed factory (`make<Type>`) that validates + envelopes.");
  lines.push("- A TypeScript type export (`<Type>Payload`).");
  lines.push("");

  lines.push("## Self-test");
  lines.push("");
  lines.push(`- Result: ${inv.selfTestPassed ? "**PASS**" : "**FAIL**"}`);
  lines.push(`- ${inv.selfTestNote}`);
  lines.push("");
  lines.push(
    "_Self-test exercises the M1 round-trip: synthetic `EquityTradeBooked` payload → Zod validation → envelope construction. Validates that downstream consumers (Anya projections, Bea IFRS classifier) can build against the surface immediately._",
  );
  lines.push("");

  lines.push("## What's NOT in v1");
  lines.push("");
  lines.push(
    "- **Upstream ISDA CDM JSON-schema import.** v1 hand-curates primitives + equity event types from the canonical CDM section names; full upstream import (CDM JSON → generated TypeScript → diff against hand-curated) is the next-cycle work.",
  );
  lines.push(
    "- **M2 product types (listed bonds, repo, GMRA).** Land at M2 with the same pattern: typed primitive extensions + bond / repo event types + factories.",
  );
  lines.push("- **M3 product types (OTC IRS).** Land at M3, gated on Atlas A0–A2 substrate work.");
  lines.push(
    "- **Event-store registration.** v1 emits `EquityTradeBooked` etc. through the existing `eventSchema.parse` validator; integration into `platform/event-store/registry.ts` (the per-type Zod registry) lands when Anya / Bea wire downstream consumers.",
  );
  lines.push("");

  if (narrative) {
    lines.push("## Kai's narrative");
    lines.push("");
    lines.push(narrative);
    lines.push("");
  } else if (narrativeNote) {
    lines.push("## Kai's narrative");
    lines.push("");
    lines.push(`_${narrativeNote}_`);
    lines.push("");
  }

  lines.push("## Next moves");
  lines.push("");
  lines.push(
    "- **Anya** wires `m1-projection-runtime-mapping` against this surface — trade-record + position + sub-ledger projections from the equity event stream.",
  );
  lines.push(
    "- **Bea** wires `m1-ifrs-classification-rules` against this surface — IFRS 9 dispatch (FVTPL / FVOCI) on `EquityTradeBooked`; sub-ledger postings on `EquitySettlementInstructed`.",
  );
  lines.push(
    "- **Atlas** registers the equity event types in `platform/event-store/registry.ts` once the downstream consumers are live (substrate gate before append-validation goes hard).",
  );
  lines.push(
    "- **Kai (next-cycle)** imports the upstream ISDA CDM JSON schema and diffs against the hand-curated v1 surface; reconciles divergences.",
  );
  lines.push("");

  lines.push("## Provenance");
  lines.push("");
  lines.push(
    "Read `prototype/platform/markets/cdm/primitives.ts` and `prototype/platform/markets/cdm/equity.ts` for the inventory; ran the round-trip self-test against the live `EquityTradeBooked` factory; cross-referenced `Team Inbox/2026-05-07_brief_kai_m1-cdm-typescript-bindings.md` for scope and `Owner Inbox/2026-05-07_saskia-kai_global-markets-trading-system-architecture.md` §6 for the lifecycle event types.",
  );
  lines.push("");
  return lines.join("\n");
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const inv = inventoryBindings();

  let eventsEmitted = 0;
  if (!ctx.dryRun) {
    eventStore.append(
      makeCdmBindingsRegenerated({
        asOf: ctx.asOf,
        entity: "LE-ZA-HOZ-BANK",
        actor: { type: "service", id: "agent:kai:m1-cdm-typescript-bindings" },
        citations: EVENT_CITATIONS,
        payload: {
          primitiveCount: inv.primitiveCount,
          equityEventTypeCount: inv.equityEventTypeCount,
          registeredEventTypes: [...inv.registeredEventTypes],
          selfTestPassed: inv.selfTestPassed,
          runTrigger: ctx.trigger.id,
        },
      }),
    );
    eventsEmitted = 1;
  }

  // Narrative pass (degrades gracefully when ANTHROPIC_API_KEY is unset).
  let narrative: string | null = null;
  let narrativeNote: string | null = null;
  if (!ctx.dryRun) {
    if (!claudeAvailable()) {
      narrativeNote =
        "Narrative skipped: ANTHROPIC_API_KEY not set on this runner. Inventory above stands on its own.";
    } else {
      const r = await tryGenerateNarrative({
        stableSystem: KAI_NARRATIVE_SYSTEM,
        userInput: buildNarrativeInput(ctx, inv),
        maxTokens: 6_000,
        effort: "high",
        meta: { runId: ctx.runId ?? ctx.trigger.id, agent: ctx.agent, dryRun: ctx.dryRun },
      });
      if (r.ok) {
        narrative = r.result.text.trim();
        logger.info(
          {
            inputTokens: r.result.usage.inputTokens,
            cacheReadInputTokens: r.result.usage.cacheReadInputTokens,
            outputTokens: r.result.usage.outputTokens,
            model: r.result.model,
          },
          "kai:m1-cdm-typescript-bindings — narrative generated",
        );
      } else {
        narrativeNote = `Narrative generation failed (${r.error})${r.retryable ? " — retryable" : ""}.`;
        logger.warn({ error: r.error, retryable: r.retryable }, "kai narrative failed");
      }
    }
  }

  let deliverable: string | undefined;
  if (!ctx.dryRun) {
    if (!existsSync(ctx.ownerInboxDir)) mkdirSync(ctx.ownerInboxDir, { recursive: true });
    const filename = `${fmtDateUTC(ctx.asOf)}_kai_m1-cdm-typescript-bindings.md`;
    writeFileSync(
      resolve(ctx.ownerInboxDir, filename),
      buildReportMarkdown(ctx, inv, narrative, narrativeNote),
      "utf8",
    );
    deliverable = `Owner Inbox/${filename}`;
  }

  logger.debug(
    {
      primitiveCount: inv.primitiveCount,
      equityEventTypeCount: inv.equityEventTypeCount,
      selfTestPassed: inv.selfTestPassed,
    },
    "kai:m1-cdm-typescript-bindings — inventory built",
  );

  return {
    eventsEmitted,
    ...(deliverable ? { deliverable } : {}),
    summary: `${inv.primitiveCount} primitives · ${inv.equityEventTypeCount} equity event types · self-test ${inv.selfTestPassed ? "PASS" : "FAIL"}.`,
    ok: inv.selfTestPassed,
  };
};

export default handler;
