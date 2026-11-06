import type { Plugin } from "vite";

const MATTERVIZ_SCENE_SUFFIX = "/matterviz/dist/structure/StructureScene.svelte";

const ORIGINAL_BOND_IMPORT_BLOCK = `    get_bond_key,
    get_bond_render_matrices,`;

const PERIODIC_BOND_IMPORT_BLOCK = `    get_bond_key,
    compute_bond_transform,
    get_bond_render_matrices,`;

const ORIGINAL_BOND_COLOR_BLOCK = `    for (const bond_data of bonds_to_render) {
      const color_start = get_majority_color(bond_data.site_idx_1)
      const color_end = get_majority_color(bond_data.site_idx_2)
      for (const matrix of get_bond_render_matrices(bond_data, bond_thickness)) {
        group.instances.push({ matrix, color_start, color_end })
      }
    }`;

const PAIR_BOND_COLOR_BLOCK = `    const periodic_render_copies = (bond_data: BondPair): BondPair[] => {
      if (!bond_data.cell_shift?.some(Boolean)) return [bond_data]
      const base_start = structure?.sites[bond_data.site_idx_1]?.xyz
      const base_end = structure?.sites[bond_data.site_idx_2]?.xyz
      if (!base_start || !base_end) return [bond_data]
      const lattice_translation = math.subtract(bond_data.pos_2, base_end) as Vec3
      const mirrored_end = math.subtract(base_start, lattice_translation) as Vec3
      return [
        bond_data,
        {
          ...bond_data,
          pos_1: base_end,
          pos_2: mirrored_end,
          cell_shift: bond_data.cell_shift.map((shift) => shift === 0 ? 0 : -shift) as Vec3,
          transform_matrix: compute_bond_transform(base_end, mirrored_end),
        },
      ]
    }

    for (const bond_data of bonds_to_render) {
      // VESTA-style bicolor cylinders: each half inherits its endpoint atom color.
      const color_start = get_majority_color(bond_data.site_idx_1)
      const color_end = get_majority_color(bond_data.site_idx_2)
      for (const rendered_bond of periodic_render_copies(bond_data)) {
        // The opposite-face copy runs B -> A; reverse colors, never its geometry.
        const mirrored = rendered_bond !== bond_data
        for (const matrix of get_bond_render_matrices(rendered_bond, bond_thickness)) {
          group.instances.push({
            matrix,
            color_start: mirrored ? color_end : color_start,
            color_end: mirrored ? color_start : color_end,
          })
        }
      }
    }`;

export function injectMatterVizPairBondColors(source: string, moduleId: string): string {
  const normalizedId = moduleId.replaceAll("\\", "/");
  if (!normalizedId.endsWith(MATTERVIZ_SCENE_SUFFIX)) return source;
  if (source.includes("const periodic_render_copies =")) return source;
  if (!source.includes(ORIGINAL_BOND_COLOR_BLOCK)) {
    throw new Error("matterviz@0.4.4 bond renderer changed; pair-color patch was not applied");
  }
  const withPairColors = source.replace(ORIGINAL_BOND_COLOR_BLOCK, PAIR_BOND_COLOR_BLOCK);
  return withPairColors.replace(ORIGINAL_BOND_IMPORT_BLOCK, PERIODIC_BOND_IMPORT_BLOCK);
}

export function matterVizPairBondColorsPlugin(): Plugin {
  return {
    name: "matterviz-pair-bond-colors",
    enforce: "pre",
    transform(source, moduleId) {
      const normalizedId = moduleId.replaceAll("\\", "/");
      if (!normalizedId.endsWith(MATTERVIZ_SCENE_SUFFIX)) return null;
      return { code: injectMatterVizPairBondColors(source, moduleId), map: null };
    },
  };
}
