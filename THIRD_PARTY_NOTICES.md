# Third-party notices

This project uses the following open-source projects and data.

- **MatterViz 0.4.4** — interactive structure rendering. MIT License.  
  Source: <https://github.com/janosh/matterviz>
  The display uses this package's existing `vesta-colors.json` palette as a
  fallback. P/O/H display colors and radii use the project's fixed style profile in
  `web-components/approved-molecular-style.json`. Local build-time adapters
  adjust materials, lighting, and endpoint bond colors;
  their source is retained in `web-components/`.
- **Blue Obelisk Data Repository (BODR)** — covalent radii from
  `bodr/elements/elements.xml`. The XML metadata declares the MIT License.  
  Source: <https://github.com/BlueObelisk/bodr>
- **Svelte**, **Three.js**, **Threlte**, **fflate**, React, and the other
  transitive packages are distributed under their respective licenses. Their
  license files are retained in the installed package metadata and lockfile.
- **Three.js 0.185.1 GTAONode / DenoiseNode** — screen-space ambient occlusion
  and denoising, from the already installed MIT-licensed Three.js addons.
  Sources: [GTAONode](https://github.com/mrdoob/three.js/blob/r185/examples/jsm/tsl/display/GTAONode.js),
  [DenoiseNode](https://github.com/mrdoob/three.js/blob/r185/examples/jsm/tsl/display/DenoiseNode.js).

No VESTA program files, tables, or configuration files are included.

Visual references only: [VESTA official gallery](https://jp-minerals.org/vesta/en/gallery.html)
and [object properties manual](https://jp-minerals.org/vesta/en/doc/VESTAch12.html).

Current visual target: the fixed `atomscope-vesta-semi-gloss-v1` profile. The browser uses a
real-time approximation of its lighting with short-range screen-space occlusion,
not Tachyon or ray-traced ambient occlusion. No reference raster is bundled into
the viewer.
