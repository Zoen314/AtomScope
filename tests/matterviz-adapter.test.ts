import { describe, expect, it } from "vitest";
import { toMatterVizStructure } from "../lib/structure/matterviz-adapter";
import type { InferredBond, SharePayloadV1 } from "../lib/structure/types";

function payload(positions: number[]): SharePayloadV1 {
  return {
    v: 1,
    name: "unwrapped.POSCAR",
    format: "poscar",
    structure: {
      elements: ["O", "H"],
      positions,
      cell: [10, 0, 0, 0, 10, 0, 0, 0, 10],
      origin: [0, 0, 0],
      pbc: [true, true, true],
    },
    metadata: { units: "angstrom", assumptions: [] },
    bonds: { dataset: "bodr", factor: 1.15, minDistance: 0.4, pairOverrides: {} },
  };
}

function renderedFractionalDelta(
  structure: ReturnType<typeof toMatterVizStructure>,
  bond: ReturnType<typeof toMatterVizStructure>["properties"]["bonds"][number],
) {
  const from = structure.sites[bond.site_idx_1].abc;
  const to = structure.sites[bond.site_idx_2].abc;
  return to.map((value, axis) => value + bond.cell_shift[axis] - from[axis]);
}

describe("MatterViz structure adapter", () => {
  it("rebases a zero shift when an endpoint starts outside the primary cell", () => {
    const bond: InferredBond = {
      atomA: 0,
      atomB: 1,
      distance: 1.5,
      imageShift: [0, 0, 0],
    };
    const structure = toMatterVizStructure(payload([-1, 1, 1, 0.5, 1, 1]), [bond]);

    expect(structure.sites.map((site) => site.abc)).toEqual([
      [0.9, 0.1, 0.1],
      [0.05, 0.1, 0.1],
    ]);
    expect(structure.properties.bonds[0].cell_shift).toEqual([1, 0, 0]);
    const delta = renderedFractionalDelta(structure, structure.properties.bonds[0]);
    expect(delta[0]).toBeCloseTo(0.15, 12);
    expect(delta.slice(1)).toEqual([0, 0]);
  });

  it("removes a stale image shift when both endpoints are wrapped first", () => {
    const bond: InferredBond = {
      atomA: 0,
      atomB: 1,
      distance: 1,
      imageShift: [1, 0, 0],
    };
    const structure = toMatterVizStructure(payload([12, 1, 1, 1, 1, 1]), [bond]);

    expect(structure.sites.map((site) => site.abc)).toEqual([
      [0.2, 0.1, 0.1],
      [0.1, 0.1, 0.1],
    ]);
    expect(structure.properties.bonds[0].cell_shift).toEqual([0, 0, 0]);
    const delta = renderedFractionalDelta(structure, structure.properties.bonds[0]);
    expect(delta[0]).toBeCloseTo(-0.1, 12);
    expect(delta.slice(1)).toEqual([0, 0]);
  });
});
