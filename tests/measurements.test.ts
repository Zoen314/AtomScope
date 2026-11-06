import { describe, expect, it } from "vitest";
import { createMeasurementOverlay, limitMeasurementPicks, measureAtoms, parseMeasurementInputs, splitMeasurementSegment } from "../lib/structure/measurements";
import { cartToFrac, norm3 } from "../lib/structure/math";
import type { NormalizedStructure, Vec3 } from "../lib/structure/types";

const structure = (positions: number[], pbc: [boolean, boolean, boolean] = [true, true, true]): NormalizedStructure => ({
  elements: positions.filter((_, i) => i % 3 === 0).map(() => "H"), positions,
  cell: [10, 0, 0, 0, 10, 0, 0, 0, 10], origin: [0, 0, 0], pbc,
});

describe("distance and B-centered angle measurements", () => {
  it("measures any two atoms, even without an inferred bond", () => {
    const result = measureAtoms(structure([0, 0, 0, 3, 4, 0]), "distance", [0, 1]);
    expect(result.kind === "distance" && result.distance).toBe(5);
  });

  it("uses periodic minimum images rather than a line across the entire box", () => {
    const result = measureAtoms(structure([9.5, 5, 5, 0.5, 5, 5]), "distance", [0, 1]);
    expect(result).toMatchObject({ distance: 1, arm: { delta: [1, 0, 0], shift: [1, 0, 0] } });
    const open = measureAtoms(structure([9.5, 5, 5, 0.5, 5, 5], [false, true, true]), "distance", [0, 1]);
    expect(open).toMatchObject({ distance: 9, arm: { shift: [0, 0, 0] } });
  });

  it.each([0, 60, 90, 120, 180])("measures %s degrees at the SECOND selected atom", degrees => {
    const radians = degrees * Math.PI / 180;
    const box = structure([6, 5, 5, 5, 5, 5, 5 + 2 * Math.cos(radians), 5 + 2 * Math.sin(radians), 5]);
    const result = measureAtoms(box, "angle", [0, 1, 2]);
    expect(result.kind).toBe("angle");
    if (result.kind === "angle") expect(result.angle).toBeCloseTo(degrees, 10);
  });

  it("uses B->A and B->C independently under partial PBC", () => {
    const positions = [9.5, 5, 5, 0.5, 5, 5, 1.5, 6, 5];
    expect(measureAtoms(structure(positions), "angle", [0, 1, 2])).toMatchObject({ angle: 135 });
    const result = measureAtoms(structure(positions, [false, true, true]), "angle", [0, 1, 2]);
    expect(result.kind === "angle" && result.angle).toBeCloseTo(45, 10);
  });

  it("handles skew cells, nonzero origins and unwrapped input without changing the structure", () => {
    const box = structure([11.8, 3.8, 9, 2.8, 3.8, 9, 2.8, 4.8, 9]);
    box.cell = [10, 0, 0, 3, 8, 0, 0, 0, 10]; box.origin = [2, 3, 4];
    const snapshot = structuredClone(box);
    const result = measureAtoms(box, "angle", [0, 1, 2]);
    expect(result.kind === "angle" && result.angle).toBeCloseTo(90, 10);
    expect(result.kind === "angle" && result.arms[0].distance).toBeCloseTo(1, 10);
    const overlay = createMeasurementOverlay(box, result);
    expect(overlay.segments.length).toBeGreaterThan(2);
    for (const point of overlay.segments.flat()) {
      for (const fraction of cartToFrac(point, box.cell)) {
        expect(fraction).toBeGreaterThanOrEqual(-1e-10);
        expect(fraction).toBeLessThanOrEqual(1 + 1e-10);
      }
    }
    expect(box).toEqual(snapshot);
  });

  it("reports undefined angles at coincident periodic images, not a misleading zero", () => {
    const box = structure([0, 0, 0, 10, 0, 0, 1, 1, 0]);
    expect(() => measureAtoms(box, "angle", [0, 1, 2])).toThrow("夹角未定义");
    expect(measureAtoms(box, "distance", [0, 1])).toMatchObject({ distance: 0 });
  });

  it("rejects duplicate, missing, fractional and out-of-range atom IDs", () => {
    const box = structure([1, 1, 1, 2, 2, 2, 3, 3, 3]);
    for (const ids of [[0, 0], [0], [-1, 1], [0, 3], [0, 1.5]]) {
      expect(() => measureAtoms(box, "distance", ids)).toThrow();
    }
  });

  it("splits a crossing guide into matching short opposite-face segments", () => {
    const box = structure([9.5, 5, 5, 0.5, 5, 5]);
    const overlay = createMeasurementOverlay(box, measureAtoms(box, "distance", [0, 1]));
    expect(overlay.label).toBe("1.0000 Å");
    const expected = [[[9.5, 5, 5], [10, 5, 5]], [[0, 5, 5], [0.5, 5, 5]]];
    expect(overlay.segments).toHaveLength(2);
    overlay.segments.flat(2).forEach((value, index) => expect(value).toBeCloseTo(expected.flat(2)[index], 12));
  });

  it("splits edge/corner crossings without duplicate zero-length segments", () => {
    const box = structure([]);
    const start: Vec3 = [9.5, 9.5, 9.5], delta: Vec3 = [1, 1, 1];
    const segments = splitMeasurementSegment(start, delta, box.cell, box.pbc);
    expect(segments).toHaveLength(2);
    const lengths = segments.map(([a, b]) => norm3(b.map((v, i) => v - a[i]) as Vec3));
    expect(lengths.every(length => length > 0)).toBe(true);
    expect(lengths.reduce((a, b) => a + b)).toBeCloseTo(Math.sqrt(3), 10);
  });
});

describe("shared click / source-index selection", () => {
  it("has no preselected measurements and keeps inputs strictly one-based", () => {
    expect(parseMeasurementInputs("angle", ["", "", ""], 3)).toMatchObject({ indices: [], complete: false, error: null });
    expect(parseMeasurementInputs("angle", ["3", "1", "2"], 3)).toEqual({ indices: [2, 0, 1], complete: true, error: null });
    for (const input of ["0", "4", "1.2", "NaN"]) expect(parseMeasurementInputs("distance", ["1", input, ""], 3).error).toBeTruthy();
    expect(parseMeasurementInputs("distance", ["1", "1", ""], 3).error).toBeTruthy();
  });

  it("starts a new selection after a complete pair or triple, and permits deselection", () => {
    expect(limitMeasurementPicks([0, 1, 2], "distance", 4)).toEqual([2]);
    expect(limitMeasurementPicks([0, 1, 2], "angle", 4)).toEqual([0, 1, 2]);
    expect(limitMeasurementPicks([0, 1, 2, 3], "angle", 4)).toEqual([3]);
    expect(limitMeasurementPicks([0], "distance", 4)).toEqual([0]);
    expect(limitMeasurementPicks([0, 0, -1, 5], "distance", 4)).toEqual([0]);
  });
});
