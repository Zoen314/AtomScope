import { writeFile } from "node:fs/promises";

const source = "https://raw.githubusercontent.com/BlueObelisk/bodr/master/bodr/elements/elements.xml";
const response = await fetch(source);
if (!response.ok) throw new Error(`BODR download failed: ${response.status}`);
const xml = await response.text();
const radii = {};
for (const block of xml.matchAll(/<atom id="([A-Z][a-z]?)">([\s\S]*?)<\/atom>/g)) {
  const radius = block[2].match(/dictRef="bo:radiusCovalent"[^>]*>([0-9.]+)<\/scalar>/);
  if (radius) radii[block[1]] = Number(radius[1]);
}
if (Object.keys(radii).length < 100) throw new Error(`Only parsed ${Object.keys(radii).length} radii`);
const body = `// Generated from Blue Obelisk Data Repository elements.xml.\n// MIT license metadata is present in the source XML. Do not edit manually.\nexport const BODR_COVALENT_RADII: Readonly<Record<string, number>> = ${JSON.stringify(radii, null, 2)};\n`;
await writeFile(new URL("../lib/structure/bodr-radii.generated.ts", import.meta.url), body, "utf8");
console.log(`Wrote ${Object.keys(radii).length} BODR covalent radii from ${source}`);
