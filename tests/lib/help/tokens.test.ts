import { describe, expect, it } from "vitest";
import { tokenDigest } from "@/lib/admin/identity";
import {
  isHelpTokenShape,
  newTrackingToken,
  parseHelpAccess,
  signedHelpToken,
  verifySignedHelpToken,
} from "@/lib/help/tokens";

const secret = "test-secret";
const id = "66e6a1b2c3d4e5f60718293a";

describe("help tracking tokens", () => {
  it("creates 32-byte url-safe tokens and stores only their digest", () => {
    const token = newTrackingToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(parseHelpAccess(token, secret)).toEqual({
      kind: "tracking",
      digest: tokenDigest(token),
    });
  });

  it("signs a request id and verifies it", () => {
    const signed = signedHelpToken(id, secret);
    expect(signed).toMatch(/^r\.[0-9a-f]{24}\.[A-Za-z0-9_-]{43}$/);
    expect(verifySignedHelpToken(signed ?? "", secret)).toBe(id);
    expect(parseHelpAccess(signed ?? "", secret)).toEqual({ kind: "signed", id });
    expect(isHelpTokenShape(signed ?? "")).toBe(true);
  });

  it("rejects tampered ids, signatures and other secrets", () => {
    const signed = signedHelpToken(id, secret) ?? "";
    const otherId = signed.replace(id, "66e6a1b2c3d4e5f60718293b");
    expect(verifySignedHelpToken(otherId, secret)).toBeNull();
    expect(verifySignedHelpToken(signed, "another-secret")).toBeNull();
    const flipped = `${signed.slice(0, -1)}${signed.endsWith("A") ? "B" : "A"}`;
    expect(verifySignedHelpToken(flipped, secret)).toBeNull();
    expect(parseHelpAccess("r.bad", secret)).toBeNull();
  });

  it("cannot sign without a secret", () => {
    expect(signedHelpToken(id, null)).toBeNull();
    expect(verifySignedHelpToken(signedHelpToken(id, secret) ?? "", null)).toBeNull();
  });
});
