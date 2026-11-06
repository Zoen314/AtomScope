import { RenderPipeline, type Camera, type Scene, type TempNode, type TextureNode, type WebGPURenderer } from "three/webgpu";
import { mix, mrt, nodeObject, normalView, output, pass, vec3, vec4 } from "three/tsl";
import { ao } from "three/addons/tsl/display/GTAONode.js";
import { denoise } from "three/addons/tsl/display/DenoiseNode.js";
import { VIEWER_RENDER_DEFAULTS } from "./viewer-config";

/** Image-space shading only; this module never accesses structure/bond data. */
export function createMolecularLightingPipeline(renderer: WebGPURenderer, scene: Scene, camera: Camera) {
  const config = VIEWER_RENDER_DEFAULTS.occlusion;
  const scenePass = pass(scene, camera);
  // Explicit normals retain the renderer's MSAA. r185 cannot reconstruct normals
  // from a multisampled depth texture (upstream #34598 also documents this limit).
  // Alpha is a shading-only AO weight. Atoms retain 1; the bond material
  // overrides only alpha. GTAO/denoise read RGB, so normals/depth stay intact.
  scenePass.setMRT(mrt({ output, normal: vec4(normalView, 1) }));
  const color = scenePass.getTextureNode("output");
  const depth = scenePass.getTextureNode("depth");
  const normals = scenePass.getTextureNode("normal");
  const occlusion = ao(depth, normals, camera);
  occlusion.radius.value = config.radius;
  occlusion.thickness.value = config.thickness;
  occlusion.samples.value = config.samples;
  occlusion.resolutionScale = config.resolutionScale;
  const softened = denoise(occlusion.getTextureNode(), depth, normals, camera);
  softened.radius.value = config.denoiseRadius;
  // r185 constructs TempNode('vec4'); @types still loses that vector signature.
  const softAO = nodeObject(softened as unknown as TempNode<"vec4">);
  const pipeline = new RenderPipeline(renderer);
  const occlusionWeight = normals.a.clamp(0, 1).mul(config.strength);
  pipeline.outputNode = color.mul(vec4(vec3(mix(1, softAO.r, occlusionWeight)), 1));
  let disposed = false;

  return {
    render() {
      if (disposed) return;
      // Preserve renderer state even if a device cannot compile the AO shader.
      const target = renderer.getRenderTarget();
      const toneMapping = renderer.toneMapping;
      const colorSpace = renderer.outputColorSpace;
      const xrEnabled = renderer.xr.enabled;
      try {
        pipeline.render();
      } finally {
        renderer.setRenderTarget(target);
        renderer.toneMapping = toneMapping;
        renderer.outputColorSpace = colorSpace;
        renderer.xr.enabled = xrEnabled;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      pipeline.dispose();
      scenePass.dispose();
      occlusion.dispose();
      // r185 dispose() releases GTAO's target/material but not its noise texture.
      (occlusion as unknown as { _noiseNode: TextureNode })._noiseNode.value.dispose();
      (softened.noiseNode as TextureNode).value.dispose();
    },
  };
}
