import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCAL_VIEWER_PORT,
  getLocalViewerBaseUrl,
  parseViewerPort,
  resolveViewerBaseUrl,
} from "../scripts/local-viewer";

describe("local viewer configuration", () => {
  it("uses a loopback-only default URL", () => {
    expect(DEFAULT_LOCAL_VIEWER_PORT).toBe(43117);
    expect(getLocalViewerBaseUrl({})).toBe("http://127.0.0.1:43117/");
  });

  it("accepts a safe port override", () => {
    expect(parseViewerPort("44000")).toBe(44000);
    expect(getLocalViewerBaseUrl({ ATOM_VIEWER_PORT: "44000" })).toBe(
      "http://127.0.0.1:44000/",
    );
  });

  it("rejects privileged, non-integer, and non-numeric ports", () => {
    expect(() => parseViewerPort("80")).toThrow(/1024/);
    expect(() => parseViewerPort("44000.5")).toThrow(/integer/);
    expect(() => parseViewerPort("abc")).toThrow(/integer/);
  });

  it("keeps an explicit online base URL without starting the local server", async () => {
    let starts = 0;
    const result = await resolveViewerBaseUrl(
      "https://viewer.example/",
      {},
      async () => {
        starts += 1;
        return "http://127.0.0.1:43117/";
      },
    );
    expect(result).toBe("https://viewer.example/");
    expect(starts).toBe(0);
  });

  it("starts the loopback viewer when no override is supplied", async () => {
    const result = await resolveViewerBaseUrl(undefined, {}, async () =>
      "http://127.0.0.1:43117/"
    );
    expect(result).toBe("http://127.0.0.1:43117/");
  });
});
