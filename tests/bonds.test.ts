import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { inferBonds } from "../lib/structure/bonds";
import { parsePoscar } from "../lib/structure/parser";
import type { SharePayloadV1 } from "../lib/structure/types";

function structure(elements: string[], positions: number[], cell = [10,0,0,0,10,0,0,0,10], pbc: [boolean,boolean,boolean] = [true,true,true]): SharePayloadV1["structure"] {
  return { elements, positions, cell, origin: [0,0,0], pbc };
}
const defaults = { factor: 1.15, minDistance: 0.4, pairOverrides: {} };

describe("bond inference", () => {
  it("connects an O-H covalent neighbor", () => {
    const result = inferBonds(structure(["O", "H"], [0,0,0,0.96,0,0]), defaults);
    expect(result.bonds).toHaveLength(1);
    expect(result.bonds[0].distance).toBeCloseTo(0.96, 12);
  });

  it("uses PBC minimum image and retains the image shift", () => {
    const result = inferBonds(structure(["O", "H"], [0.1,0,0,9.7,0,0]), defaults);
    expect(result.bonds).toHaveLength(1);
    expect(result.bonds[0].distance).toBeCloseTo(0.4, 12);
    expect(result.bonds[0].imageShift).toEqual([-1,0,0]);
    expect(inferBonds(structure(["O", "H"], [0.1,0,0,9.7,0,0], undefined, [false,false,false]), defaults).bonds).toHaveLength(0);
  });

  it("keeps the visual boundary fixture as one periodic O-H bond", () => {
    const content = readFileSync(new URL("./fixtures/periodic-oh.POSCAR", import.meta.url), "utf8");
    const parsed = parsePoscar(content, "periodic-oh.POSCAR");
    const result = inferBonds(parsed.payload.structure, defaults);
    expect(result.bonds).toHaveLength(1);
    expect(result.bonds[0].distance).toBeCloseTo(1, 12);
    expect(result.bonds[0].imageShift).toEqual([1, 0, 0]);
  });

  it("uses a full skewed 3x3 cell", () => {
    const cell = [5,0,0,2,5,0,0,0,5];
    const result = inferBonds(structure(["O", "H"], [0.1,0.1,0,2.5,4.9,0], cell), defaults);
    expect(result.bonds).toHaveLength(1);
    expect(result.bonds[0].distance).toBeCloseTo(Math.hypot(0.4, -0.2), 12);
    expect(result.bonds[0].imageShift).toEqual([0,-1,0]);
  });

  it("uses strict upper cutoff and honors pair overrides", () => {
    const exact = inferBonds(structure(["H", "H"], [0,0,0,1,0,0]), { ...defaults, pairOverrides: { "H-H": { min: 0.4, max: 1, enabled: true } } });
    expect(exact.bonds).toHaveLength(0);
    const below = inferBonds(structure(["H", "H"], [0,0,0,0.999999,0,0]), { ...defaults, pairOverrides: { "H-H": { min: 0.4, max: 1, enabled: true } } });
    expect(below.bonds).toHaveLength(1);
  });
});
