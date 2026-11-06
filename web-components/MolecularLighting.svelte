<script lang="ts">
  import { useTask, useThrelte } from "@threlte/core";
  import { onDestroy } from "svelte";
  import type { Camera, WebGPURenderer } from "three/webgpu";
  import { createMolecularLightingPipeline } from "./molecular-lighting";

  const { renderer, scene, camera, autoRender, renderStage, invalidate } = useThrelte<WebGPURenderer>();
  let activeCamera: Camera | undefined;
  let pipeline: ReturnType<typeof createMolecularLightingPipeline> | undefined;
  let ready = false;
  let failed = false;
  let destroyed = false;

  // MatterViz already starts init(). The same promise ensures the GPU is ready;
  // the existing renderer remains active until then and on unsupported devices.
  renderer.init().then(() => {
    if (destroyed) return;
    ready = true;
    autoRender.set(false);
    invalidate();
  }).catch(() => { /* MatterViz owns device-init error reporting/recovery. */ });

  useTask(() => {
    if (!ready || failed) return;
    try {
      if (activeCamera !== camera.current) {
        pipeline?.dispose();
        activeCamera = camera.current;
        pipeline = createMolecularLightingPipeline(renderer, scene, activeCamera);
      }
      pipeline?.render();
    } catch (error) {
      failed = true;
      pipeline?.dispose();
      pipeline = undefined;
      autoRender.set(true);
      invalidate();
      console.warn("Molecular contact shading unavailable; retaining lit structure rendering.", error);
    }
  }, { stage: renderStage, autoInvalidate: false });

  onDestroy(() => {
    destroyed = true;
    pipeline?.dispose();
  });
</script>
