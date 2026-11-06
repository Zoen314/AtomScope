import { describe, expect, it } from "vitest";

import approvedViewerStyle from "../web-components/approved-viewer-style.json";
import { APPROVED_ELEMENT_COLORS, APPROVED_MOLECULAR_STYLE, MATTERVIZ_SPHERE_RADIUS, VIEWER_RENDER_DEFAULTS } from "../web-components/viewer-config";

describe("user-approved web appearance lock", () => {
  it("locks all non-derived render defaults without freezing the cache key", () => {
    const { componentAssetVersion, cameraLights, elementDisplayRadii, ...defaults } = VIEWER_RENDER_DEFAULTS;
    expect(defaults).toEqual(approvedViewerStyle.renderDefaults);
    // Non-visual fixes may bump the asset version; they must not alter the look.
    expect(componentAssetVersion).toMatch(/^\d{8}-[a-z-]+$/);
    expect(cameraLights).toHaveLength(approvedViewerStyle.cameraLights.length);
    expect(Object.keys(elementDisplayRadii).sort()).toEqual(Object.keys(approvedViewerStyle.displayRadiiAngstrom).sort());
  });

  it("locks the approved palette and actual displayed radii independently of the source profile", () => {
    expect(APPROVED_ELEMENT_COLORS).toEqual(approvedViewerStyle.elementColors);
    for (const [element, radius] of Object.entries(approvedViewerStyle.displayRadiiAngstrom)) {
      const displayedRadius = MATTERVIZ_SPHERE_RADIUS * VIEWER_RENDER_DEFAULTS.atomRadius * VIEWER_RENDER_DEFAULTS.elementDisplayRadii[element];
      expect(displayedRadius).toBeCloseTo(radius, 12);
    }
  });

  it("locks the calibrated camera lights, allowing only floating-point roundoff", () => {
    approvedViewerStyle.cameraLights.forEach((light, index) => {
      expect(VIEWER_RENDER_DEFAULTS.cameraLights[index].direction).toEqual(light.direction);
      expect(VIEWER_RENDER_DEFAULTS.cameraLights[index].intensity).toBeCloseTo(light.intensity, 12);
    });
  });
});

describe("viewer render defaults", () => {
  it("keeps the primary cell uncluttered by default", () => {
    expect(VIEWER_RENDER_DEFAULTS.showImageAtoms).toBe(false);
  });

  it("uses the approved 0.10 Angstrom displayed stick radius", () => {
    expect(VIEWER_RENDER_DEFAULTS.bondThickness).toBe(0.1);
  });

  it("uses VESTA-style display sizing without changing physical cutoffs", () => {
    expect(VIEWER_RENDER_DEFAULTS.atomRadius).toBe(0.8);
    for (const [element, { radius_A }] of Object.entries(APPROVED_MOLECULAR_STYLE.elements)) {
      expect(VIEWER_RENDER_DEFAULTS.elementDisplayRadii[element] * VIEWER_RENDER_DEFAULTS.atomRadius * MATTERVIZ_SPHERE_RADIUS).toBeCloseTo(radius_A, 12);
    }
  });

  it("retains the approved key/fill/rim directions and relative strengths", () => {
    expect(VIEWER_RENDER_DEFAULTS.cameraLights).toHaveLength(3);
    APPROVED_MOLECULAR_STYLE.lights.forEach((light, index) => {
      expect(VIEWER_RENDER_DEFAULTS.cameraLights[index].direction).toEqual(light.direction);
      expect(VIEWER_RENDER_DEFAULTS.cameraLights[index].intensity / VIEWER_RENDER_DEFAULTS.keyLight).toBeCloseTo(light.strength, 12);
    });
    expect(VIEWER_RENDER_DEFAULTS.diffuse).toBe(0.78);
    expect(VIEWER_RENDER_DEFAULTS.shininess).toBe(65);
    expect(VIEWER_RENDER_DEFAULTS.specularLinear).toBeGreaterThanOrEqual(0.025);
    expect(VIEWER_RENDER_DEFAULTS.specularLinear).toBeLessThan(0.08);
    expect(VIEWER_RENDER_DEFAULTS.ambientLight / VIEWER_RENDER_DEFAULTS.keyLight).toBeLessThan(0.4);
  });

  it("limits occlusion to short-range, moderate shading instead of black outlines", () => {
    expect(VIEWER_RENDER_DEFAULTS.occlusion.radius).toBe(0.45);
    expect(VIEWER_RENDER_DEFAULTS.occlusion.thickness).toBeLessThan(0.5);
    expect(VIEWER_RENDER_DEFAULTS.occlusion.strength).toBeLessThan(0.5);
    expect(VIEWER_RENDER_DEFAULTS.occlusion.samples).toBeGreaterThanOrEqual(16);
  });

  it("provides modest bond-only fill without changing the accepted scene lighting", () => {
    expect(VIEWER_RENDER_DEFAULTS.bondAmbientFill).toBe(0.42);
    expect(VIEWER_RENDER_DEFAULTS.bondDiffuse).toBe(0.68);
    expect(VIEWER_RENDER_DEFAULTS.bondOcclusionWeight).toBe(0.25);
    expect(VIEWER_RENDER_DEFAULTS.ambientLight).toBe(0.72);
    expect(VIEWER_RENDER_DEFAULTS.keyLight).toBe(2.4);
    expect(VIEWER_RENDER_DEFAULTS.specularLinear).toBe(0.035);
    expect(VIEWER_RENDER_DEFAULTS.occlusion.strength).toBe(0.42);
  });

  it("uses a white orthographic scene, thin neutral edges, and smooth glossy spheres", () => {
    expect(VIEWER_RENDER_DEFAULTS.background).toBe("#ffffff");
    expect(VIEWER_RENDER_DEFAULTS.projection).toBe("orthographic");
    expect(VIEWER_RENDER_DEFAULTS.cellWidth).toBe(1);
    expect(VIEWER_RENDER_DEFAULTS.sphereSegments).toBeGreaterThanOrEqual(32);
    expect(VIEWER_RENDER_DEFAULTS.shininess).toBeGreaterThan(0);
  });

  it("cache-busts the deployed web component after renderer changes", () => {
    expect(VIEWER_RENDER_DEFAULTS.componentAssetVersion).toMatch(/^\d{8}-[a-z-]+$/);
  });
});
