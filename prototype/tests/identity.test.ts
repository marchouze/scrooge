// tests/identity.test.ts
//
// Unit tests for the local Authenticator. Asserts:
//   - Round-trip: issued tokens verify back to the same Principal.
//   - Tampered tokens are rejected.
//   - Expired tokens are rejected.
//   - Token alg is HS256; environment label is LOCAL_ONLY.
//
// Author: Atlas · Senna

import { describe, expect, it } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { LocalAuthenticator, TokenExpiredError, TokenInvalidError } from "../platform/identity";
import type { Principal } from "../platform/identity";

function freshKeyPath(): string {
  return join(mkdtempSync(join(tmpdir(), "bank-idp-")), "idp.key");
}

const alice: Principal = {
  type: "human",
  id: "alice@bank.local",
  attributes: { dept: "trading", mandate: "MKT-001" },
};

describe("LocalAuthenticator", () => {
  it("round-trips a Principal", async () => {
    const auth = new LocalAuthenticator({ keyPath: freshKeyPath() });
    const token = await auth.issue(alice);
    const verified = await auth.verify(token);
    expect(verified.id).toBe(alice.id);
    expect(verified.type).toBe(alice.type);
    expect(verified.attributes?.dept).toBe("trading");
    expect(verified.attributes?.mandate).toBe("MKT-001");
  });

  it("emits HS256 with LOCAL_ONLY environment label", async () => {
    const auth = new LocalAuthenticator({ keyPath: freshKeyPath() });
    const token = await auth.issue({ type: "system", id: "recon-harness" });
    const segments = token.split(".");
    expect(segments).toHaveLength(3);
    const [headerSeg] = segments;
    if (headerSeg === undefined) throw new Error("missing header segment");
    const header = JSON.parse(Buffer.from(headerSeg, "base64url").toString());
    expect(header.alg).toBe("HS256");
    expect(header.typ).toBe("JWT");
    expect(header.env).toBe("LOCAL_ONLY");
  });

  it("rejects a tampered signature", async () => {
    const auth = new LocalAuthenticator({ keyPath: freshKeyPath() });
    const token = await auth.issue(alice);
    const tampered = `${token.slice(0, -4)}AAAA`;
    await expect(auth.verify(tampered)).rejects.toBeInstanceOf(TokenInvalidError);
  });

  it("rejects a tampered payload", async () => {
    const auth = new LocalAuthenticator({ keyPath: freshKeyPath() });
    const token = await auth.issue(alice);
    const [h, , s] = token.split(".") as [string, string, string];
    const replacementPayload = Buffer.from(
      JSON.stringify({ iat: 0, exp: 9_999_999_999, sub: "mallory", typ: "human" }),
    ).toString("base64url");
    await expect(auth.verify(`${h}.${replacementPayload}.${s}`)).rejects.toBeInstanceOf(
      TokenInvalidError,
    );
  });

  it("rejects expired tokens", async () => {
    let now = 1_700_000_000;
    const auth = new LocalAuthenticator({
      keyPath: freshKeyPath(),
      now: () => now,
    });
    const token = await auth.issue(alice, { ttlSeconds: 60 });
    now += 120;
    await expect(auth.verify(token)).rejects.toBeInstanceOf(TokenExpiredError);
  });

  it("rejects malformed tokens", async () => {
    const auth = new LocalAuthenticator({ keyPath: freshKeyPath() });
    await expect(auth.verify("not.a.token.at.all")).rejects.toBeInstanceOf(TokenInvalidError);
    await expect(auth.verify("only.two")).rejects.toBeInstanceOf(TokenInvalidError);
  });
});
