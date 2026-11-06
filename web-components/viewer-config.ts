import approvedStyle from "./approved-molecular-style.json";

// Snapshot of molecular-render-tachyon/assets/approved_style.json. Keep this
// display profile separate from BODR, structure data and bond inference.
export const APPROVED_MOLECULAR_STYLE = approvedStyle;
export const MATTERVIZ_SPHERE_RADIUS = 0.5;
const atomScale = 0.8;
const keyIntensity = 2.4;

export const APPROVED_ELEMENT_COLORS = Object.fromEntries(
  Object.entries(approvedStyle.elements).map(([element, { rgb }]) => [
    // Three's CSS parser rejects fractional percentage rgb(); use canonical
    // 8-bit sRGB for both the renderer and legend. Original floats stay above.
    element, `#${rgb.map(value => Math.round(value * 255).toString(16).padStart(2, "0")).join("")}`,
  ]),
);

export const VIEWER_RENDER_DEFAULTS = {
  componentAssetVersion: "20261106-distance-angle-measurements-picking",
  // MatterViz enables boundary image atoms by default. Keep the primary cell
  // uncluttered; periodic bond metadata still retains its cell_shift.
  showImageAtoms: false,
  atomRadius: atomScale,
  bondThickness: approvedStyle.bond_radius_A,
  background: "#ffffff",
  cellColor: "#222222",
  cellWidth: 1,
  projection: "orthographic",
  // A shallow oblique view exposes cell depth without foreshortening the atoms.
  cameraDirection: [0.55, 0.3, 1] as [number, number, number],
  // Calibrated for Three's normalized Phong model, not a numerical copy of
  // Tachyon. Keep a clear key-to-fill contrast instead of flattening every face.
  ambientLight: 0.72,
  keyLight: keyIntensity,
  cameraLights: approvedStyle.lights.map(light => ({
    direction: light.direction as [number, number, number],
    intensity: keyIntensity * light.strength,
  })),
  diffuse: approvedStyle.material.diffuse,
  // Visible soft highlights, still well below a metallic/mirror response.
  specularLinear: 0.035,
  shininess: approvedStyle.material.phong_size,
  // Thin cylinders need their own colored fill: retain dark-side readability
  // without increasing the scene lights or changing the approved atom shading.
  bondAmbientFill: 0.42,
  bondDiffuse: 0.68,
  // Soften the collar on thin sticks without reducing occlusion on atoms.
  bondOcclusionWeight: 0.25,
  // Short-range screen-space occlusion: only shading, never bond/atom geometry.
  occlusion: {
    radius: 0.45,
    thickness: 0.4,
    strength: 0.42,
    samples: 16,
    resolutionScale: 0.75,
    denoiseRadius: 2,
  },
  sphereSegments: 40,
  cylinderSegments: 24,
  // MatterViz instantiates SphereGeometry(0.5), then scales by atom_radius and
  // element radius. Preserve the existing slider semantics while making actual
  // rendered P/O/H radii exactly 0.440/0.296/0.184 Angstrom at the default.
  elementDisplayRadii: Object.fromEntries(Object.entries(approvedStyle.elements)
    .map(([element, value]) => [element, value.radius_A / (MATTERVIZ_SPHERE_RADIUS * atomScale)])),
} as const;
