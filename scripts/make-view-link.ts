import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { parseStructure } from "../lib/structure/parser";
import { makeShareUrl } from "../lib/structure/share";
import { resolveViewerBaseUrl } from "./local-viewer";

function usage(): never {
  console.error("用法: make-view-link <file> [--type-map 1:P,2:O,3:H] [--pbc ppp] [--base-url https://viewer.example/]");
  process.exit(2);
}
const args = process.argv.slice(2);
const fileArg = args.find((arg) => !arg.startsWith("--"));
if (!fileArg) usage();
const option = (name: string) => { const idx = args.indexOf(name); return idx >= 0 ? args[idx + 1] : undefined; };
function parseTypeMap(value?: string): Record<string, string> | undefined {
  if (!value) return undefined;
  return Object.fromEntries(value.split(",").map((entry) => { const [type, element] = entry.split(":"); if (!type || !element) throw new Error(`无效 type map: ${entry}`); return [type.trim(), element.trim()]; }));
}
function parsePbc(value?: string): [boolean, boolean, boolean] | undefined {
  if (!value) return undefined;
  if (!/^[pf]{3}$/i.test(value)) throw new Error("--pbc 必须是三个 p/f 字符，例如 ppp 或 ppf");
  return [...value.toLowerCase()].map((char) => char === "p") as [boolean, boolean, boolean];
}
try {
  const file = resolve(fileArg);
  const result = parseStructure(await readFile(file, "utf8"), { name: basename(file), typeMap: parseTypeMap(option("--type-map")), pbc: parsePbc(option("--pbc")) });
  const baseUrl = await resolveViewerBaseUrl(option("--base-url"));
  console.log(makeShareUrl(result.payload, baseUrl));
  for (const warning of result.warnings) console.error(`提示: ${warning}`);
} catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exit(1); }
