// scripts/launchd/env-extract.test.ts
//
// Unit tests for the launchd `.env.local` → plist EnvironmentVariables
// extraction pipeline. Covers parse, whitelist, XML escape, and full
// end-to-end render.
//
// Authority: D-AGENT-AUTONOMY-OPERATIONAL Slice 1, D-MARKETS-SCHEMA-FOUNDATION.
//
// Author: Devon (Chief Operating Officer, governance).

import { describe, expect, test } from "bun:test";

import {
  DEFAULT_PATH_VALUE,
  escapeXml,
  parseDotEnv,
  renderEnvironmentDictBody,
  renderFromDotEnv,
  whitelistBankKeys,
} from "./env-extract";

describe("parseDotEnv", () => {
  test("parses a simple key=value", () => {
    expect(parseDotEnv("BANK_FOO=bar")).toEqual({ BANK_FOO: "bar" });
  });

  test("ignores blank lines and comments", () => {
    const body = `
# this is a comment
BANK_FOO=bar

# another comment
BANK_BAZ=qux
`;
    expect(parseDotEnv(body)).toEqual({ BANK_FOO: "bar", BANK_BAZ: "qux" });
  });

  test("strips inline ` #` comment from unquoted values", () => {
    expect(parseDotEnv("BANK_FOO=bar # trailing comment")).toEqual({
      BANK_FOO: "bar",
    });
  });

  test("preserves `#` inside double-quoted values", () => {
    expect(parseDotEnv('BANK_FOO="bar # not a comment"')).toEqual({
      BANK_FOO: "bar # not a comment",
    });
  });

  test("strips matching single quotes and double quotes", () => {
    expect(parseDotEnv("BANK_FOO='bar'")).toEqual({ BANK_FOO: "bar" });
    expect(parseDotEnv('BANK_FOO="bar"')).toEqual({ BANK_FOO: "bar" });
  });

  test("honours escapes in double-quoted values", () => {
    expect(parseDotEnv('BANK_FOO="a\\"b\\nc"')).toEqual({
      BANK_FOO: 'a"b\nc',
    });
  });

  test("single-quoted values are literal except \\'", () => {
    expect(parseDotEnv("BANK_FOO='a\\'b'")).toEqual({ BANK_FOO: "a'b" });
    expect(parseDotEnv("BANK_FOO='a\\nb'")).toEqual({ BANK_FOO: "a\\nb" });
  });

  test("rejects invalid key names", () => {
    expect(parseDotEnv("123_BAD=x")).toEqual({});
    expect(parseDotEnv("=x")).toEqual({});
    expect(parseDotEnv("BAD-KEY=x")).toEqual({});
  });

  test("skips malformed lines without throwing", () => {
    const body = `
BANK_OK=ok
this is not a real line
BANK_OK2=ok2
`;
    expect(parseDotEnv(body)).toEqual({ BANK_OK: "ok", BANK_OK2: "ok2" });
  });

  test("handles CRLF line endings", () => {
    expect(parseDotEnv("BANK_A=1\r\nBANK_B=2\r\n")).toEqual({
      BANK_A: "1",
      BANK_B: "2",
    });
  });
});

describe("whitelistBankKeys", () => {
  test("keeps BANK_* keys", () => {
    expect(whitelistBankKeys({ BANK_FOO: "1", BANK_TWELVEDATA_API_KEY: "k" })).toEqual({
      BANK_FOO: "1",
      BANK_TWELVEDATA_API_KEY: "k",
    });
  });

  test("drops non-BANK keys", () => {
    expect(
      whitelistBankKeys({
        OPENAI_API_KEY: "secret",
        PATH: "/usr/bin",
        BANK_OK: "ok",
      }),
    ).toEqual({ BANK_OK: "ok" });
  });

  test("drops the vacuous `BANK_` key", () => {
    expect(whitelistBankKeys({ BANK_: "vacuous" })).toEqual({});
  });

  test("drops lowercase `bank_*` keys", () => {
    expect(whitelistBankKeys({ bank_foo: "1" })).toEqual({});
  });
});

describe("escapeXml", () => {
  test("escapes the five XML entities", () => {
    expect(escapeXml("a&b<c>d\"e'f")).toBe("a&amp;b&lt;c&gt;d&quot;e&apos;f");
  });

  test("preserves printable ASCII and Unicode", () => {
    expect(escapeXml("hello world 123 αβγ")).toBe("hello world 123 αβγ");
  });

  test("strips XML-illegal control chars but keeps \\t \\n \\r", () => {
    const input = "a\x00b\x01c\td\ne\rf";
    expect(escapeXml(input)).toBe("abc\td\ne\rf");
  });

  test("escapes ampersand once (not double-escape)", () => {
    expect(escapeXml("&amp;")).toBe("&amp;amp;");
  });
});

describe("renderEnvironmentDictBody", () => {
  test("always emits PATH first", () => {
    const out = renderEnvironmentDictBody({ bankKeys: {} });
    expect(out).toContain("<key>PATH</key>");
    expect(out).toContain(`<string>${DEFAULT_PATH_VALUE}</string>`);
  });

  test("appends BANK_* keys in sorted order", () => {
    const out = renderEnvironmentDictBody({
      bankKeys: { BANK_Z: "zz", BANK_A: "aa" },
    });
    const aIdx = out.indexOf("<key>BANK_A</key>");
    const zIdx = out.indexOf("<key>BANK_Z</key>");
    expect(aIdx).toBeGreaterThan(0);
    expect(zIdx).toBeGreaterThan(aIdx);
  });

  test("escapes XML in keys and values", () => {
    const out = renderEnvironmentDictBody({
      bankKeys: { BANK_FUNKY: "a&b<c>" },
    });
    expect(out).toContain("<string>a&amp;b&lt;c&gt;</string>");
  });

  test("respects custom indent", () => {
    const out = renderEnvironmentDictBody({ bankKeys: {}, indent: "" });
    expect(out.split("\n")[0]).toBe("<key>PATH</key>");
  });

  test("output uses LF (not CRLF) line endings", () => {
    const out = renderEnvironmentDictBody({
      bankKeys: { BANK_A: "1" },
    });
    expect(out.includes("\r")).toBe(false);
  });
});

describe("renderFromDotEnv (end-to-end)", () => {
  test("absent .env.local — emits PATH only, zero BANK_* keys", () => {
    const { xml, bankKeyCount, bankKeyNames } = renderFromDotEnv({
      envLocalText: undefined,
    });
    expect(bankKeyCount).toBe(0);
    expect(bankKeyNames).toEqual([]);
    expect(xml).toContain("<key>PATH</key>");
    expect(xml).not.toContain("BANK_");
  });

  test("fixture .env.local — extracts BANK_*, drops others", () => {
    // Synthetic fixture — NEVER reads Marc's real .env.local.
    const fixture = `
# bank prototype env.local — test fixture
BANK_TWELVEDATA_API_KEY=test-key-xyz
BANK_MARKET_DATA_DB=.local/market-data.db
OPENAI_API_KEY=should-be-dropped
ANTHROPIC_API_KEY="should-also-be-dropped"
BANK_PERMISSION_GATE_ENABLED=true
`;
    const { xml, bankKeyCount, bankKeyNames } = renderFromDotEnv({
      envLocalText: fixture,
    });
    expect(bankKeyCount).toBe(3);
    expect(bankKeyNames).toEqual([
      "BANK_MARKET_DATA_DB",
      "BANK_PERMISSION_GATE_ENABLED",
      "BANK_TWELVEDATA_API_KEY",
    ]);
    expect(xml).toContain("<key>BANK_TWELVEDATA_API_KEY</key>");
    expect(xml).toContain("<string>test-key-xyz</string>");
    expect(xml).not.toContain("OPENAI");
    expect(xml).not.toContain("ANTHROPIC");
  });

  test("acceptance — exact-string match for the brief criterion", () => {
    // The brief acceptance criterion: rendered plist must contain
    // <key>BANK_TWELVEDATA_API_KEY</key><string>test-key-xyz</string>.
    const fixture = "BANK_TWELVEDATA_API_KEY=test-key-xyz\n";
    const { xml } = renderFromDotEnv({ envLocalText: fixture, indent: "" });
    expect(xml).toContain("<key>BANK_TWELVEDATA_API_KEY</key>\n<string>test-key-xyz</string>");
  });

  test("XML-special chars in a value are escaped, never reach raw output", () => {
    const fixture = 'BANK_PATHY="a<b>&c"\n';
    const { xml } = renderFromDotEnv({ envLocalText: fixture });
    expect(xml).toContain("<string>a&lt;b&gt;&amp;c</string>");
    // The literal would have broken plutil -lint.
    expect(xml).not.toContain("<string>a<b>&c</string>");
  });

  test("empty .env.local body renders PATH only", () => {
    const { xml, bankKeyCount } = renderFromDotEnv({ envLocalText: "" });
    expect(bankKeyCount).toBe(0);
    expect(xml).toContain("<key>PATH</key>");
  });

  test("commented-out BANK_* line is NOT extracted", () => {
    const fixture = "# BANK_OFF=value\nBANK_ON=on\n";
    const { bankKeyNames } = renderFromDotEnv({ envLocalText: fixture });
    expect(bankKeyNames).toEqual(["BANK_ON"]);
  });
});
