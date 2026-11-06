<svelte:options customElement="mv-structure" />

<script lang="ts">
  import { Structure } from "matterviz/structure";
  import { VIEWER_RENDER_DEFAULTS } from "./viewer-config";
  import { limitMeasurementPicks, type MeasurementMode, type MeasurementOverlay } from "../lib/structure/measurements";

  let {
    structure = undefined,
    bonds = [],
    width = 800,
    height = 600,
    showAtoms = true,
    showBonds = true,
    showCell = true,
    measurementMode = "off",
    measurementSites = [],
    measurementOverlay = null,
    resetToken = 0,
    atomRadius = VIEWER_RENDER_DEFAULTS.atomRadius,
    bondThickness = VIEWER_RENDER_DEFAULTS.bondThickness,
  }: {
    structure?: unknown;
    bonds?: unknown[];
    width?: number;
    height?: number;
    showAtoms?: boolean;
    showBonds?: boolean;
    showCell?: boolean;
    measurementMode?: MeasurementMode | "off";
    measurementSites?: number[];
    measurementOverlay?: MeasurementOverlay | null;
    resetToken?: number;
    atomRadius?: number;
    bondThickness?: number;
  } = $props();

  function pickSites(next: number[]) {
    if (measurementMode === "off") return;
    const count = (structure as { sites?: unknown[] } | undefined)?.sites?.length ?? 0;
    const indices = limitMeasurementPicks(next, measurementMode, count);
    // Do not echo an unchanged controlled selection back into React.
    if (indices.length === measurementSites.length && indices.every((id, i) => id === measurementSites[i])) return;
    $host().dispatchEvent(new CustomEvent("measurement-selection", {
      detail: { mode: measurementMode, indices }, bubbles: true, composed: true,
    }));
  }
</script>

{#key resetToken}
  <div
    class="structure-host"
    style:--struct-height={`${height}px`}
    style:--struct-width={`${width}px`}
  >
  <Structure
    {structure}
    {bonds}
    {width}
    {height}
    show_controls={false}
    enable_info_pane={false}
    allow_file_drop={false}
    enable_measure_mode={true}
    show_image_atoms={VIEWER_RENDER_DEFAULTS.showImageAtoms}
    color_scheme="Vesta"
    measure_mode={measurementMode === "angle" ? "angle" : "distance"}
    bind:measured_sites={() => measurementMode === "off" ? [] : measurementSites, pickSites}
    bind:selected_sites={() => measurementMode === "off" ? [] : measurementSites, () => {}}
    performance_mode={(structure as { sites?: unknown[] } | undefined)?.sites?.length > 2500 ? "speed" : "quality"}
    background_color={VIEWER_RENDER_DEFAULTS.background}
    background_opacity={1}
    scene_props={{
      interactive: true,
      viewer_measurement: measurementOverlay,
      show_atoms: showAtoms,
      show_bonds: showBonds ? "always" : "never",
      bonding_strategy: "explicit_only",
      auto_bond_order: false,
      show_polyhedra: "never",
      show_site_labels: false,
      atom_radius: atomRadius,
      sphere_segments: (structure as { sites?: unknown[] } | undefined)?.sites?.length > 1500 ? 24 : VIEWER_RENDER_DEFAULTS.sphereSegments,
      bond_thickness: bondThickness,
      camera_projection: VIEWER_RENDER_DEFAULTS.projection,
      camera_direction: [...VIEWER_RENDER_DEFAULTS.cameraDirection],
      ambient_light: VIEWER_RENDER_DEFAULTS.ambientLight,
      directional_light: VIEWER_RENDER_DEFAULTS.keyLight,
      lattice_props: {
        cell_edge_opacity: showCell ? 1 : 0,
        cell_surface_opacity: 0,
        cell_edge_color: VIEWER_RENDER_DEFAULTS.cellColor,
        cell_edge_width: VIEWER_RENDER_DEFAULTS.cellWidth,
        show_cell_vectors: false,
      },
    }}
    element_radius_overrides={{ ...VIEWER_RENDER_DEFAULTS.elementDisplayRadii }}
    lattice_props={{
      cell_edge_opacity: showCell ? 1 : 0,
      cell_surface_opacity: 0,
      cell_edge_color: VIEWER_RENDER_DEFAULTS.cellColor,
      cell_edge_width: VIEWER_RENDER_DEFAULTS.cellWidth,
      show_cell_vectors: false,
    }}
  />
  </div>
{/key}

<style>
  :global(.viewer-passive-overlay),
  :global(.viewer-passive-overlay *) {
    pointer-events: none !important;
  }

  :host,
  .structure-host {
    display: block;
    width: 100%;
    height: 100%;
    color-scheme: light;
    color: #22262b;
    --page-bg: #fff;
    --text-color: #22262b;
    --text-color-muted: #64707d;
    --border-color: #cdd1d6;
    --accent-color: #2762a5;
    --struct-legend-bg: #ffffffee;
    --struct-tooltip-bg: #ffffff;
  }
</style>
