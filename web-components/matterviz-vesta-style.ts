import type { Plugin } from "vite";
import { fileURLToPath } from "node:url";
import { APPROVED_ELEMENT_COLORS, VIEWER_RENDER_DEFAULTS as STYLE } from "./viewer-config";

// Appearance-only adapters for the pinned MatterViz 0.4.4 build. Fail loudly on
// upstream drift; no edits to node_modules, coordinate math, picking, or bonds.
function replaceOnce(source: string, from: string, to: string, label: string): string {
  if (!source.includes(from) || source.indexOf(from) !== source.lastIndexOf(from)) {
    throw new Error(`matterviz@0.4.4 ${label} changed; visual patch was not applied`);
  }
  return source.replace(from, to);
}

const phongOptions = JSON.stringify({ shininess: STYLE.shininess });
const setSpecular = (name: string) => `${name}.specular.setRGB(${STYLE.specularLinear}, ${STYLE.specularLinear}, ${STYLE.specularLinear})`;
const cameraLights = STYLE.cameraLights.map(light =>
  `  <T.DirectionalLight position={${JSON.stringify(light.direction)}} target={vesta_light_target} intensity={${light.intensity}} />`).join("\n");

export function injectMatterVizVestaStyle(source: string, moduleId: string): string {
  const id = moduleId.replaceAll("\\", "/");
  if (id.endsWith("/matterviz/dist/structure/StructureViewport.svelte")) {
    // Threlte defaults to filmic AgX, which desaturates red oxygen into brown.
    // Match VESTA's direct material colors instead, retaining sRGB output.
    source = replaceOnce(source, "  import { Canvas } from '@threlte/core'",
      "  import { Canvas } from '@threlte/core'\n  import { NoToneMapping } from 'three/webgpu'\n  import MolecularLighting from 'virtual:molecular-lighting'", "viewport color import");
    return replaceOnce(source, "<Canvas createRenderer={create_viewport_renderer}>",
      "<Canvas createRenderer={create_viewport_renderer} toneMapping={NoToneMapping}>\n      <MolecularLighting />", "direct element colors");
  }
  if (id.endsWith("/matterviz/dist/structure/InstancedAtoms.svelte")) {
    source = replaceOnce(source, "    MeshStandardMaterial,", "    MeshPhongNodeMaterial,", "atom material import");
    return replaceOnce(source, "const material = new MeshStandardMaterial()",
      `const material = new MeshPhongNodeMaterial(${phongOptions})\n  material.color.setRGB(${STYLE.diffuse}, ${STYLE.diffuse}, ${STYLE.diffuse})\n  ${setSpecular("material")}`, "atom material");
  }
  if (id.endsWith("/matterviz/dist/structure/Bond.svelte")) {
    source = replaceOnce(source, "attribute, dot, mix, normalView, positionGeometry, uniform, vec3",
      "attribute, dot, mix, mrt, normalView, positionGeometry, step, uniform, vec3, vec4", "bond midpoint import");
    source = replaceOnce(source, "    MeshBasicNodeMaterial,", "    MeshPhongNodeMaterial,", "bond material import");
    source = replaceOnce(source, "saturation = 0.5", "saturation = 1", "bond saturation");
    source = replaceOnce(source, "brightness = 0.7", "brightness = 1", "bond brightness");
    source = replaceOnce(source, "mix(color_start, color_end, cylinder_t)",
      "mix(color_start, color_end, step(0.5, cylinder_t))", "bicolor midpoint");
    source = replaceOnce(source, "temp_color.set(color).convertSRGBToLinear()",
      "temp_color.set(color)", "bond sRGB conversion");
    source = replaceOnce(source, "const bond_material = new MeshBasicNodeMaterial()",
      `const bond_material = new MeshPhongNodeMaterial(${phongOptions})\n  ${setSpecular("bond_material")}`, "bond material");
    source = replaceOnce(source, "bond_material.colorNode = bond_color",
      `bond_material.colorNode = tinted.mul(${STYLE.bondDiffuse}) // softer stick contrast; atom material is unchanged\n  // Colored material-local fill, not a scene light or a white/gray color blend.\n  bond_material.emissiveNode = tinted.mul(${STYLE.bondAmbientFill})\n  // Keep XYZ normals intact; the otherwise unused alpha carries only AO weight.\n  bond_material.mrtNode = mrt({ normal: vec4(normalView, ${STYLE.bondOcclusionWeight}) })`, "bond lighting");
    // Remove the upstream fixed-direction shading now that bonds and atoms use
    // the same camera-attached Phong light. Keep saturation/brightness reactive.
    for (const line of [
      "  const ambient_intensity = uniform(0.7)",
      "  const directional_intensity = uniform(0.3)",
      "  const diffuse = dot(normalView, vec3(1, 1, 1).normalize()).max(0)",
      "  const bond_color = tinted.mul(ambient_intensity.add(directional_intensity.mul(diffuse)))",
      "    ambient_intensity.value = group.ambient_light ?? 0.7",
      "    directional_intensity.value = group.directional_light ?? 0.3",
    ]) source = replaceOnce(source, line, "", "legacy bond lighting");
    return replaceOnce(source, "group.thickness, group.thickness, 1, 8",
      `group.thickness, group.thickness, 1, ${STYLE.cylinderSegments}`, "cylinder resolution");
  }
  if (id.endsWith("/matterviz/dist/structure/StructureScene.svelte")) {
    // A camera-attached key light replaces the fixed world-space light. Otherwise
    // large/nonzero-origin cells get a very different highlight from small cells.
    return replaceOnce(source,
      "<T.DirectionalLight position={[3, 10, 10]} intensity={directional_light} />",
      "<!-- Key light lives on SceneCamera for a stable VESTA-style headlight. -->", "world light");
  }
  if (id.endsWith("/matterviz/dist/scene/SceneCamera.svelte")) {
    source = replaceOnce(source, "  import { T } from '@threlte/core'",
      "  import { T } from '@threlte/core'\n  import { Object3D } from 'three/webgpu'", "camera light import");
    source = replaceOnce(source, "  const gizmo_props = $derived(build_gizmo_props(gizmo))",
      "  const vesta_light_target = new Object3D()\n  const gizmo_props = $derived(build_gizmo_props(gizmo))", "camera light target");
    return replaceOnce(source, "{#snippet camera_contents()}",
      `{#snippet camera_contents()}\n  <T is={vesta_light_target} position={[0, 0, 0]} />\n${cameraLights}`, "approved camera lights");
  }
  if (id.endsWith("/matterviz/dist/structure/Structure.svelte")) {
    source = replaceOnce(source, "colors.element = ELEMENT_COLOR_SCHEMES[color_scheme as ColorSchemeName]",
      `colors.element = { ...ELEMENT_COLOR_SCHEMES[color_scheme as ColorSchemeName], ...(color_scheme === \`Vesta\` ? ${JSON.stringify(APPROVED_ELEMENT_COLORS)} : {}) }`, "approved element palette");
    const from = "camera_direction={view.direction}";
    if (source.split(from).length !== 3) throw new Error("MatterViz camera direction adapter changed");
    return source.replaceAll(from, "camera_direction={view.direction ?? scene_props.camera_direction}");
  }
  return source;
}

export function matterVizVestaStylePlugin(): Plugin {
  return {
    name: "matterviz-vesta-appearance",
    enforce: "pre",
    resolveId(id) {
      if (id === "virtual:molecular-lighting") return fileURLToPath(new URL("./MolecularLighting.svelte", import.meta.url));
    },
    transform(source, moduleId) {
      if (!moduleId.replaceAll("\\", "/").includes("/matterviz/dist/")) return null;
      const code = injectMatterVizVestaStyle(source, moduleId);
      return code === source ? null : { code, map: null };
    },
  };
}
