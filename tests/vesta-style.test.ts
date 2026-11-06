import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { transpileModule, ModuleKind } from "typescript";
import { Color } from "three";
import { bondLegendBackground, displayColorForElement } from "../lib/structure/display-colors";
import { injectMatterVizVestaStyle } from "../web-components/matterviz-vesta-style";
import { injectMatterVizPairBondColors } from "../web-components/matterviz-pair-colors";
import { APPROVED_ELEMENT_COLORS, APPROVED_MOLECULAR_STYLE, MATTERVIZ_SPHERE_RADIUS } from "../web-components/viewer-config";

const modulePath = (name: string) => `/matterviz/dist/${name}`;
const installed = (name: string) => readFileSync(`node_modules${modulePath(name)}`, "utf8");
const styled = (name: string) => injectMatterVizVestaStyle(installed(name), modulePath(name));

describe("VESTA appearance adapters against the actual pinned dependency", () => {
  it("uses the same approved element colors in the renderer and bicolor legend", () => {
    expect(displayColorForElement("O")).toBe("#ff0300");
    expect(displayColorForElement("H")).toBe("#ffcccc");
    expect(displayColorForElement("P")).toBe("#c19cc3");
    expect(bondLegendBackground("O", "H")).toBe(bondLegendBackground("H", "O"));
    expect(bondLegendBackground("O", "H")).toContain("#ffcccc 0% 50%, #ff0300 50% 100%");
  });

  it("keeps the skill's source RGB, parses every display color, and pins the geometry scale", () => {
    expect(APPROVED_MOLECULAR_STYLE.profile).toBe("atomscope-vesta-semi-gloss-v1");
    expect(APPROVED_MOLECULAR_STYLE.elements.P).toEqual({ radius_A: 0.44, rgb: [0.75557, 0.61256, 0.76425] });
    expect(APPROVED_ELEMENT_COLORS.P).toBe("#c19cc3");
    for (const value of Object.values(APPROVED_ELEMENT_COLORS)) {
      expect(`#${new Color(value).getHexString()}`).toBe(value);
    }
    expect(styled("structure/Structure.svelte")).toContain(JSON.stringify(APPROVED_ELEMENT_COLORS));
    expect(installed("structure/InstancedAtoms.svelte")).toContain(`new SphereGeometry(${MATTERVIZ_SPHERE_RADIUS}, sphere_segments, sphere_segments)`);
  });

  it("changes only material for instanced atoms, retaining every matrix and pointer handler", () => {
    const original = installed("structure/InstancedAtoms.svelte");
    const result = styled("structure/InstancedAtoms.svelte");
    expect(result).toContain("new MeshPhongNodeMaterial(");
    expect(result.slice(result.indexOf("  $effect(() => () => material.dispose())")))
      .toBe(original.slice(original.indexOf("  $effect(() => () => material.dispose())")));
  });

  it("uses a crisp midpoint and a single sRGB conversion without changing bond transforms", () => {
    const original = installed("structure/Bond.svelte");
    const result = styled("structure/Bond.svelte");
    expect(result).toContain("step(0.5, cylinder_t)");
    expect(result).toContain("new MeshPhongNodeMaterial(");
    expect(result).toContain("bond_material.colorNode = tinted.mul(0.68)");
    expect(result).toContain("bond_material.emissiveNode = tinted.mul(0.42)");
    expect(result).toContain("bond_material.specular.setRGB(0.035, 0.035, 0.035)");
    expect(result).not.toContain("convertSRGBToLinear()");
    const matrices = (s: string) => s.slice(s.indexOf("    // Update instance matrices"), s.indexOf("  // Colors are uploaded"));
    expect(matrices(result)).toBe(matrices(original));
  });

  it("adds colored fill to bonds only, retaining the accepted atom material", () => {
    const atoms = styled("structure/InstancedAtoms.svelte");
    expect(atoms).toContain('new MeshPhongNodeMaterial({"shininess":65})');
    expect(atoms).toContain("material.color.setRGB(0.78, 0.78, 0.78)");
    expect(atoms).toContain("material.specular.setRGB(0.035, 0.035, 0.035)");
    expect(atoms).not.toContain("emissiveNode");
    const bonds = styled("structure/Bond.svelte");
    expect(bonds).toContain("bond_material.emissiveNode = tinted.mul(0.42)");
    expect(bonds).not.toContain("emissiveNode = vec3(1");
  });

  it("softens occlusion on sticks only without changing RGB normals or alpha opacity", () => {
    expect(styled("structure/Bond.svelte")).toContain("bond_material.mrtNode = mrt({ normal: vec4(normalView, 0.25) })");
    expect(styled("structure/InstancedAtoms.svelte")).not.toContain("mrtNode");
    expect(styled("structure/Bond.svelte")).not.toContain("opacityNode");
  });

  it("uses camera-attached lighting and preserves orbit, picking and auto-fit code", () => {
    expect(styled("scene/SceneCamera.svelte")).toContain("target={vesta_light_target}");
    expect(styled("scene/SceneCamera.svelte").match(/<T.DirectionalLight/g)).toHaveLength(3);
    expect(styled("scene/SceneCamera.svelte")).toContain("<extras.OrbitControls bind:ref={orbit_controls} {...orbit_props}>");
    expect(styled("structure/Structure.svelte")).toContain("view.direction ?? scene_props.camera_direction");
    const original = installed("structure/StructureScene.svelte");
    const result = styled("structure/StructureScene.svelte");
    expect(result.split("</script>")[0]).toBe(original.split("</script>")[0]);
  });

  it("disables filmic desaturation without modifying the viewport's interaction code", () => {
    const original = installed("structure/StructureViewport.svelte");
    const result = styled("structure/StructureViewport.svelte");
    expect(result).toContain("toneMapping={NoToneMapping}");
    expect(result.replace("  import { NoToneMapping } from 'three/webgpu'\n", "")
      .replace("  import MolecularLighting from 'virtual:molecular-lighting'\n", "")
      .replace("\n      <MolecularLighting />", "")
      .replace(" toneMapping={NoToneMapping}", "")).toBe(original);
  });

  it("fails visibly if a material patch no longer matches", () => {
    expect(() => injectMatterVizVestaStyle("changed upstream", modulePath("structure/Bond.svelte"))).toThrow("visual patch was not applied");
  });
});

describe("opposite-face bond rendering remains geometrically invariant", () => {
  it("keeps short nearest-image segments and reverses endpoint colors on the mirror", () => {
    const source = injectMatterVizPairBondColors(installed("structure/StructureScene.svelte"), modulePath("structure/StructureScene.svelte"));
    const start = source.indexOf("    const periodic_render_copies =");
    const end = source.indexOf("    return", source.indexOf("    for (const bond_data of bonds_to_render)", start));
    // Execute the actual injected loop with sentinel transform functions. This tests
    // the code compiled into the viewer, not a duplicate rendering implementation.
    const block = source.slice(start, end > start ? end : undefined);
    const loopEnd = block.indexOf("\n    }", block.indexOf("    for (const bond_data of bonds_to_render)")) + 6;
    const js = transpileModule(block.slice(0, loopEnd), { compilerOptions: { module: ModuleKind.None } }).outputText;
    const render = new Function("structure", "bonds_to_render", "math", "compute_bond_transform", "get_bond_render_matrices", "get_majority_color", "bond_thickness", "group", `${js}; return group.instances;`);
    const subtract = (a: number[], b: number[]) => a.map((x, i) => x - b[i]);
    const transform = (a: number[], b: number[]) => ({ a, b });
    for (const shift of [[1, 0, 0], [1, 1, 0], [1, 1, 1], [0, 0, 0]]) {
      const a = [9.5, 9.5, 9.5];
      const b = shift.map((v, i) => v ? 0.5 : a[i]);
      if (!shift.some(Boolean)) b[0] -= 1;
      const end = b.map((v, i) => v + 10 * shift[i]);
      const bond = { site_idx_1: 0, site_idx_2: 1, pos_1: a, pos_2: end, cell_shift: shift, transform_matrix: transform(a, end) };
      const original = JSON.stringify(bond);
      const instances = render({ sites: [{ xyz: a }, { xyz: b }] }, [bond], { subtract }, transform,
        (x: typeof bond) => [x.transform_matrix], (idx: number) => idx === 0 ? "red" : "pink", 0.06, { instances: [] });
      expect(instances.length).toBe(shift.some(Boolean) ? 2 : 1);
      expect(instances[0]).toEqual({ matrix: transform(a, end), color_start: "red", color_end: "pink" });
      if (instances.length === 2) {
        expect(instances[1]).toEqual({ matrix: transform(b, a.map((v, i) => v - 10 * shift[i])), color_start: "pink", color_end: "red" });
      }
      expect(JSON.stringify(bond)).toBe(original);
    }
  });
});
