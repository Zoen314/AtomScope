import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import { matterVizPairBondColorsPlugin } from "./web-components/matterviz-pair-colors";
import { matterVizVestaStylePlugin } from "./web-components/matterviz-vesta-style";
import { matterVizMeasurementsPlugin } from "./web-components/matterviz-measurements";

export default defineConfig({
  plugins: [matterVizPairBondColorsPlugin(), matterVizVestaStylePlugin(), matterVizMeasurementsPlugin(), svelte({ compilerOptions: { customElement: true } })],
  build: {
    lib: {
      entry: "web-components/entry.ts",
      formats: ["es"],
      fileName: () => "mv-structure.js",
      cssFileName: "mv-structure",
    },
    outDir: "public/matterviz",
    emptyOutDir: true,
    cssCodeSplit: false,
    sourcemap: false,
  },
});
