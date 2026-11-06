import { readFileSync } from "node:fs";
import { compile } from "svelte/compiler";
import { describe, expect, it } from "vitest";
import { injectMatterVizMeasurements } from "../web-components/matterviz-measurements";
import { injectMatterVizPairBondColors } from "../web-components/matterviz-pair-colors";
import { injectMatterVizVestaStyle } from "../web-components/matterviz-vesta-style";

const id = "/matterviz/dist/structure/StructureScene.svelte";
const source = readFileSync(`node_modules${id}`, "utf8");

describe("pinned MatterViz measurement integration", () => {
  it("replaces only the native measurement helpers, retaining picking and bond rendering", () => {
    const result = injectMatterVizMeasurements(source, id);
    const section = (s: string, from: string, to: string) => {
      const start = s.indexOf(from), end = s.indexOf(to, start);
      expect(start).toBeGreaterThanOrEqual(0);
      expect(end).toBeGreaterThan(start);
      return s.slice(start, end);
    };
    expect(section(result, "  const handle_atom_pointerdown", "  $effect(() => {")).toBe(section(source, "  const handle_atom_pointerdown", "  $effect(() => {"));
    expect(section(result, "    for (const bond_data of bonds_to_render)", "    return group.instances")).toBe(section(source, "    for (const bond_data of bonds_to_render)", "    return group.instances"));
    expect(result).toContain('<ViewerMeasurementOverlay measurement={viewer_measurement} />');
    expect(result).not.toContain("Direct: {format_num(direct");
    expect(result).not.toContain("{#each measured_sites as idx_center");
    expect(result).toContain('position={pos} wrapperClass="viewer-passive-overlay"');
  });

  it("makes tooltip and measurement label wrappers transparent to atom picking", () => {
    const tooltipId = "/matterviz/dist/structure/CanvasTooltip.svelte";
    const tooltip = injectMatterVizMeasurements(readFileSync(`node_modules${tooltipId}`, "utf8"), tooltipId);
    expect(tooltip).toContain('wrapperClass="viewer-passive-overlay"');
    expect(() => compile(tooltip, { filename: "CanvasTooltip.svelte", generate: "client" })).not.toThrow();
    expect(readFileSync("web-components/MeasurementOverlay.svelte", "utf8")).toContain('wrapperClass="viewer-passive-overlay"');
    expect(readFileSync("web-components/MvStructure.svelte", "utf8")).toContain(":global(.viewer-passive-overlay *)");
  });

  it("compiles together with the unchanged approved materials and PBC bond adapter", () => {
    const result = injectMatterVizMeasurements(injectMatterVizVestaStyle(injectMatterVizPairBondColors(source, id), id), id);
    expect(() => compile(result, { filename: "StructureScene.svelte", generate: "client" })).not.toThrow();
    expect(result).toContain("periodic_render_copies");
    expect(result.includes("Key light lives on SceneCamera")).toBe(true);
  });

  it("fails loudly on upstream layout changes and ignores unrelated files", () => {
    expect(() => injectMatterVizMeasurements(source.replace("<!-- Measurement overlays for measured sites -->", "<!-- changed -->"), id)).toThrow();
    expect(injectMatterVizMeasurements(source, "another.svelte")).toBe(source);
  });
});
