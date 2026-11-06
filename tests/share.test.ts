import { describe, expect, it } from "vitest";
import { decodePayload, encodePayload, makeShareUrl, payloadFromHash } from "../lib/structure/share";
import type { SharePayloadV1 } from "../lib/structure/types";

const payload: SharePayloadV1 = {
  v: 1,
  name: "water POSCAR",
  format: "poscar",
  structure: { elements: ["O","H","H"], positions: [0,0,0,.96,0,0,-.24,.93,0], cell: [10,0,0,0,10,0,0,0,10], origin: [0,0,0], pbc: [true,true,true] },
  metadata: { units: "angstrom", assumptions: [] },
  bonds: { dataset: "bodr", factor: 1.15, minDistance: .4, pairOverrides: {} },
};

describe("share links", () => {
  it("round-trips gzip base64url payloads", () => expect(decodePayload(encodePayload(payload))).toEqual(payload));
  it("uses stored gzip blocks for Node-generated browser links", () => {
    const encoded = encodePayload(payload).replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Buffer.from(encoded, "base64");
    expect((bytes[10] >> 1) & 0b11).toBe(0);
  });
  it("reads the fragment without needing a server", () => {
    const url = makeShareUrl(payload, "https://viewer.example/path#old=1");
    expect(url).toMatch(/^https:\/\/viewer\.example\/path#s=/);
    expect(payloadFromHash(new URL(url).hash)).toEqual(payload);
  });
  it("reports corrupt payloads", () => expect(() => decodePayload("not-valid")).toThrow(/损坏/));
});
