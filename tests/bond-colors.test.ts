import { describe, expect, it } from "vitest";

import { bondColorForElements, bondPairKey } from "../lib/structure/bond-colors";
import { injectMatterVizPairBondColors } from "../web-components/matterviz-pair-colors";

describe("bond pair colors", () => {
  it("uses order-independent element pair keys", () => {
    expect(bondPairKey("P", "O")).toBe("O-P");
    expect(bondPairKey("O", "P")).toBe("O-P");
  });

  it("gives the P-O-H bond pairs distinct colors", () => {
    const colors = [
      bondColorForElements("O", "H"),
      bondColorForElements("P", "O"),
      bondColorForElements("H", "H"),
      bondColorForElements("P", "H"),
      bondColorForElements("O", "O"),
      bondColorForElements("P", "P"),
    ];
    expect(new Set(colors).size).toBe(colors.length);
    expect(colors.every((color) => /^#[0-9a-f]{6}$/i.test(color))).toBe(true);
  });

  it("falls back deterministically for other element pairs", () => {
    expect(bondColorForElements("Si", "O")).toBe(bondColorForElements("O", "Si"));
    expect(bondColorForElements("Si", "O")).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe("MatterViz pair-color transform", () => {
  it("uses endpoint bicolors and keeps opposite-face periodic geometry", () => {
    const source = `
    for (const bond_data of bonds_to_render) {
      const color_start = get_majority_color(bond_data.site_idx_1)
      const color_end = get_majority_color(bond_data.site_idx_2)
      for (const matrix of get_bond_render_matrices(bond_data, bond_thickness)) {
        group.instances.push({ matrix, color_start, color_end })
      }
    }`;
    const transformed = injectMatterVizPairBondColors(
      source,
      "/node_modules/matterviz/dist/structure/StructureScene.svelte",
    );
    expect(transformed).toContain("const color_start = get_majority_color(bond_data.site_idx_1)");
    expect(transformed).toContain("color_start: mirrored ? color_end : color_start");
    expect(transformed).toContain("color_end: mirrored ? color_start : color_end");
    expect(transformed).toContain("periodic_render_copies");
    expect(transformed).toContain("compute_bond_transform");
  });
});
