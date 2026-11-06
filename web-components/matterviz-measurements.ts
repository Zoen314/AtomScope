import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

const SCENE = "/matterviz/dist/structure/StructureScene.svelte";
const TOOLTIP = "/matterviz/dist/structure/CanvasTooltip.svelte";
const START = "      <!-- Measurement overlays for measured sites -->";
const END = "    </T.Group>\n  </T.Group>\n</T.Group>";

function replaceOnce(source: string, from: string, to: string) {
  if (!source.includes(from) || source.indexOf(from) !== source.lastIndexOf(from)) {
    throw new Error("matterviz@0.4.4 measurement integration changed; patch was not applied");
  }
  return source.replace(from, to);
}

export function injectMatterVizMeasurements(source: string, id: string) {
  if (id.replaceAll("\\", "/").endsWith(TOOLTIP)) {
    // Threlte's non-transform HTML wrapper ignores pointerEvents. Its otherwise
    // invisible div can cover an atom after hover and swallow the next click.
    return replaceOnce(source, '<HTML {position} pointerEvents="none"', '<HTML {position} wrapperClass="viewer-passive-overlay" pointerEvents="none"');
  }
  if (!id.replaceAll("\\", "/").endsWith(SCENE)) return source;
  const start = source.indexOf(START), end = source.indexOf(END, start);
  if (start < 0 || end < start || start !== source.lastIndexOf(START)) {
    throw new Error("matterviz@0.4.4 measurement overlay boundary changed");
  }
  // Replace only measurement helpers. Atoms, bonds, periodic copies, lights and picking stay upstream.
  source = source.slice(0, start) + "      <ViewerMeasurementOverlay measurement={viewer_measurement} />\n" + source.slice(end);
  source = replaceOnce(source, '<script lang="ts">', '<script lang="ts">\n  import ViewerMeasurementOverlay from "virtual:viewer-measurement-overlay"');
  source = replaceOnce(source, "    measured_sites = $bindable([]),", "    measured_sites = $bindable([]),\n    viewer_measurement = undefined,");
  source = replaceOnce(source, "    measured_sites?: number[]", "    measured_sites?: number[]\n    viewer_measurement?: ComponentProps<typeof ViewerMeasurementOverlay>['measurement']");
  source = replaceOnce(source, '<extras.HTML center position={pos}>\n              <span class="selection-label">', '<extras.HTML center position={pos} wrapperClass="viewer-passive-overlay">\n              <span class="selection-label">');
  return replaceOnce(source, '<span class="selection-label">{loop_idx + 1}</span>', '<span class="selection-label">{["A", "B", "C"][loop_idx] ?? loop_idx + 1}</span>');
}

export function matterVizMeasurementsPlugin(): Plugin {
  return {
    name: "matterviz-local-measurements",
    enforce: "pre",
    resolveId(id) {
      if (id === "virtual:viewer-measurement-overlay") return fileURLToPath(new URL("./MeasurementOverlay.svelte", import.meta.url));
    },
    transform(source, id) {
      const code = injectMatterVizMeasurements(source, id);
      return code === source ? null : { code, map: null };
    },
  };
}
