import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  LinearSRGBColorSpace, Mesh, MeshPhongNodeMaterial, NoToneMapping,
  OrthographicCamera, ReinhardToneMapping, RenderPipeline, RenderTarget,
  Scene, SphereGeometry, SRGBColorSpace, Texture, type WebGPURenderer,
} from "three/webgpu";
import { createMolecularLightingPipeline } from "../web-components/molecular-lighting";

function rendererStub() {
  const target = new RenderTarget();
  const renderer = {
    toneMapping: NoToneMapping,
    outputColorSpace: SRGBColorSpace,
    xr: { enabled: false },
    getRenderTarget: () => target,
    setRenderTarget: vi.fn(),
  };
  return { renderer, target, gpu: renderer as unknown as WebGPURenderer };
}

afterEach(() => vi.restoreAllMocks());

describe("image-space molecular lighting", () => {
  it("does not alter any geometry, object transform, camera or scene child", () => {
    const { gpu } = rendererStub();
    const scene = new Scene();
    const atom = new Mesh(new SphereGeometry(0.44), new MeshPhongNodeMaterial());
    atom.position.set(1, 2, 3);
    atom.updateMatrixWorld();
    scene.add(atom);
    const camera = new OrthographicCamera(-5, 5, 5, -5, -100, 1000);
    const matrix = atom.matrixWorld.toArray();
    const positions = Array.from(atom.geometry.attributes.position.array);
    const projection = camera.projectionMatrix.toArray();
    const lighting = createMolecularLightingPipeline(gpu, scene, camera);
    lighting.dispose();
    expect(scene.children).toEqual([atom]);
    expect(atom.matrixWorld.toArray()).toEqual(matrix);
    expect(Array.from(atom.geometry.attributes.position.array)).toEqual(positions);
    expect(camera.projectionMatrix.toArray()).toEqual(projection);
    expect(atom.castShadow).toBe(false);
    expect(atom.receiveShadow).toBe(false);
  });

  it("restores renderer state even when the post-processing render throws", () => {
    const { gpu, renderer, target } = rendererStub();
    vi.spyOn(RenderPipeline.prototype, "render").mockImplementation(function (this: RenderPipeline) {
      this.renderer.toneMapping = ReinhardToneMapping;
      this.renderer.outputColorSpace = LinearSRGBColorSpace;
      this.renderer.xr.enabled = true;
      throw new Error("test GPU failure");
    });
    const lighting = createMolecularLightingPipeline(gpu, new Scene(), new OrthographicCamera());
    expect(() => lighting.render()).toThrow("test GPU failure");
    expect(renderer.toneMapping).toBe(NoToneMapping);
    expect(renderer.outputColorSpace).toBe(SRGBColorSpace);
    expect(renderer.xr.enabled).toBe(false);
    expect(renderer.setRenderTarget).toHaveBeenCalledWith(target);
    const dispose = vi.spyOn(RenderPipeline.prototype, "dispose");
    const disposeTexture = vi.spyOn(Texture.prototype, "dispose");
    lighting.dispose();
    const textureCalls = disposeTexture.mock.calls.length;
    expect(textureCalls).toBeGreaterThanOrEqual(2);
    lighting.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(disposeTexture).toHaveBeenCalledTimes(textureCalls);
    expect(() => lighting.render()).not.toThrow();
  });

  it("uses an explicit MSAA-compatible normal attachment and on-demand scheduling", () => {
    const source = readFileSync("web-components/molecular-lighting.ts", "utf8");
    expect(source).toContain("scenePass.setMRT(mrt({ output, normal: vec4(normalView, 1) }))");
    expect(source).toContain("ao(depth, normals, camera)");
    expect(source).toContain("depth, normals, camera)");
    const component = readFileSync("web-components/MolecularLighting.svelte", "utf8");
    expect(component).toContain("stage: renderStage, autoInvalidate: false");
    expect(component).toContain("pipeline?.dispose()");
    expect(component).not.toMatch(/requestAnimationFrame|setInterval/);
  });

  it("applies material AO weight only at compositing, preserving the atom occlusion field", () => {
    const source = readFileSync("web-components/molecular-lighting.ts", "utf8");
    expect(source).toContain("normals.a.clamp(0, 1).mul(config.strength)");
    expect(source).toContain("mix(1, softAO.r, occlusionWeight)");
    for (const addon of ["GTAONode", "DenoiseNode"]) {
      const upstream = readFileSync(`node_modules/three/examples/jsm/tsl/display/${addon}.js`, "utf8");
      expect(upstream).toContain("this.normalNode.sample( uv ).rgb.normalize()");
    }
  });
});
