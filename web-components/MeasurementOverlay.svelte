<script lang="ts">
  import { T } from "@threlte/core";
  import { HTML } from "@threlte/extras";
  import { BufferGeometry, Vector3 } from "three/webgpu";
  import type { MeasurementOverlay } from "../lib/structure/measurements";

  let { measurement }: { measurement?: MeasurementOverlay | null } = $props();
  const geometry = $derived(new BufferGeometry().setFromPoints(
    (measurement?.segments ?? []).flatMap(segment => segment.map(point => new Vector3(...point))),
  ));
  $effect(() => { const current = geometry; return () => current.dispose(); });
</script>

{#if measurement}
  <T.LineSegments {geometry} raycast={() => {}}>
    <T.LineBasicMaterial color="#2762a5" />
  </T.LineSegments>
  <HTML center position={measurement.labelPosition} wrapperClass="viewer-passive-overlay">
    <span class="measurement-label">{measurement.label}</span>
  </HTML>
{/if}

<style>
  .measurement-label {
    padding: 3px 6px;
    border: 1px solid #bfd0e6;
    border-radius: 4px;
    color: #20538d;
    background: #fffffff2;
    font: 12px Consolas, "Cascadia Mono", monospace;
    white-space: nowrap;
    pointer-events: none;
  }
</style>
