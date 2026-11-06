import { readdir, readFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { performance } from "node:perf_hooks";
import { inferBonds } from "../lib/structure/bonds";
import { parseLammpsData, parsePoscar } from "../lib/structure/parser";
import { makeShareUrl } from "../lib/structure/share";

const root = process.argv[2];
if (!root) {
  console.error("Usage: npm run audit:local -- <directory-with-POSCAR-conf.lmp-pairs>");
  process.exit(2);
}

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]));
  return nested.flat();
}

const files = await walk(root);
const poscars = files.filter((file) => basename(file) === "POSCAR").sort();
const lmps = new Map(files.filter((file) => basename(file) === "conf.lmp").map((file) => [dirname(file), file]));
const failures: string[] = [];
let audited = 0;
let representative: ReturnType<typeof parsePoscar> | undefined;
const started = performance.now();
for (const poscarPath of poscars) {
  const lmpPath = lmps.get(dirname(poscarPath));
  if (!lmpPath) { failures.push(`缺少配对 conf.lmp: ${poscarPath}`); continue; }
  try {
    const [poscarText, lmpText] = await Promise.all([readFile(poscarPath, "utf8"), readFile(lmpPath, "utf8")]);
    const poscar = parsePoscar(poscarText, basename(dirname(poscarPath)));
    const lmp = parseLammpsData(lmpText, basename(dirname(lmpPath)));
    const a = poscar.payload.structure, b = lmp.payload.structure;
    if (a.elements.length !== b.elements.length) throw new Error(`原子数不一致 ${a.elements.length}/${b.elements.length}`);
    if (a.elements.join() !== b.elements.join()) throw new Error("元素顺序或组成不一致");
    const maxCellError = Math.max(...a.cell.map((value, idx) => Math.abs(value - b.cell[idx])));
    if (maxCellError > 1e-8) throw new Error(`晶胞误差 ${maxCellError}`);
    const maxPositionError = Math.max(...a.positions.map((value, idx) => Math.abs(value - b.positions[idx])));
    if (maxPositionError > 1e-8) throw new Error(`坐标误差 ${maxPositionError}`);
    if (!representative) representative = poscar;
    audited += 1;
  } catch (error) { failures.push(`${dirname(poscarPath)}: ${error instanceof Error ? error.message : String(error)}`); }
}
if (poscars.length !== lmps.size) failures.push(`Unpaired files: POSCAR=${poscars.length}, LMP=${lmps.size}`);
if (!representative) failures.push("No matching POSCAR/conf.lmp pairs found");

let representativeSummary = null;
if (representative) {
  const bondStart = performance.now();
  const bonds = inferBonds(representative.payload.structure, representative.payload.bonds);
  const bondMs = performance.now() - bondStart;
  const shareUrl = makeShareUrl(representative.payload, "https://viewer.example/");
  const counts = Object.fromEntries([...new Set(representative.payload.structure.elements)].map((element) => [element, representative!.payload.structure.elements.filter((value) => value === element).length]));
  representativeSummary = { atoms: representative.payload.structure.elements.length, counts, cell: representative.payload.structure.cell, inferredBonds: bonds.bonds.length, periodicBonds: bonds.bonds.filter((bond) => bond.imageShift.some(Boolean)).length, bondMs: Number(bondMs.toFixed(1)), shareUrlLength: shareUrl.length };
}
console.log(JSON.stringify({ root, pairsFound: { poscar: poscars.length, lmp: lmps.size }, pairsPassed: audited, elapsedMs: Number((performance.now() - started).toFixed(1)), representative: representativeSummary, failures }, null, 2));
if (failures.length) process.exit(1);
