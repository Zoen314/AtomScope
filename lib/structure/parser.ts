import { normalizeElementSymbol } from "./elements";
import { determinant3, fracToCart } from "./math";
import type {
  NormalizedStructure,
  ParseOptions,
  ParseResult,
  SharePayloadV1,
  StructureFormat,
  Vec3,
} from "./types";
import { StructureParseError } from "./types";

const DEFAULT_BONDS: SharePayloadV1["bonds"] = {
  dataset: "bodr",
  factor: 1.15,
  minDistance: 0.4,
  pairOverrides: {},
};

function finiteNumber(value: string, code: string, line: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new StructureParseError(code, `无法读取数值“${value}”`, line);
  }
  return parsed;
}

function requireValidCell(cell: number[], line?: number) {
  const det = determinant3(cell);
  if (!Number.isFinite(det) || Math.abs(det) < 1e-10) {
    throw new StructureParseError("CELL_SINGULAR", "晶胞体积为零或矩阵奇异", line);
  }
}

function makePayload(
  name: string,
  format: StructureFormat,
  structure: NormalizedStructure,
  assumptions: string[],
  typeMap?: Record<string, string>,
): SharePayloadV1 {
  return {
    v: 1,
    name,
    format,
    structure,
    metadata: {
      units: "angstrom",
      ...(typeMap && Object.keys(typeMap).length ? { typeMap } : {}),
      assumptions,
    },
    bonds: { ...DEFAULT_BONDS, pairOverrides: {} },
  };
}

export function detectFormat(name: string, content: string): StructureFormat {
  const lower = name.toLowerCase();
  if (/(^|[._-])(poscar|contcar)([._-]|$)/i.test(name) || lower.endsWith(".vasp")) return "poscar";
  if (/\.(lmp|data|lammps)$/i.test(lower) || /\bAtoms\s*#/m.test(content)) return "lammps-data";
  const lines = content.replace(/\r/g, "").split("\n");
  if (lines.length >= 8 && lines[1]?.trim().split(/\s+/).length <= 3) return "poscar";
  throw new StructureParseError("FORMAT_UNKNOWN", "无法判断文件是 POSCAR 还是 LAMMPS data");
}

export function parseStructure(content: string, options: ParseOptions = {}): ParseResult {
  const name = options.name || "structure";
  const format = options.format || detectFormat(name, content);
  return format === "poscar"
    ? parsePoscar(content, name, options)
    : parseLammpsData(content, name, options);
}

export function parsePoscar(content: string, name = "POSCAR", options: ParseOptions = {}): ParseResult {
  const lines = content.replace(/^\uFEFF/, "").replace(/\r/g, "").split("\n");
  if (lines.length < 8) {
    throw new StructureParseError("POSCAR_TOO_SHORT", "POSCAR 至少需要 8 行");
  }
  const scaleTokens = lines[1].trim().split(/\s+/).filter(Boolean);
  if (scaleTokens.length !== 1) {
    throw new StructureParseError(
      "POSCAR_UNSUPPORTED_SCALE",
      "v1 只支持单个正比例因子，不支持三分量 scale",
      2,
    );
  }
  const scale = finiteNumber(scaleTokens[0], "POSCAR_UNSUPPORTED_SCALE", 2);
  if (scale <= 0) {
    throw new StructureParseError(
      "POSCAR_UNSUPPORTED_SCALE",
      "v1 不支持负比例因子（目标体积），请先转换为正比例因子",
      2,
    );
  }

  const cell: number[] = [];
  for (let row = 0; row < 3; row += 1) {
    const tokens = lines[2 + row].trim().split(/\s+/).filter(Boolean);
    if (tokens.length < 3) {
      throw new StructureParseError("POSCAR_INVALID_CELL", "晶胞向量必须包含 3 个数", 3 + row);
    }
    cell.push(
      finiteNumber(tokens[0], "POSCAR_INVALID_CELL", 3 + row) * scale,
      finiteNumber(tokens[1], "POSCAR_INVALID_CELL", 3 + row) * scale,
      finiteNumber(tokens[2], "POSCAR_INVALID_CELL", 3 + row) * scale,
    );
  }
  requireValidCell(cell, 3);

  const speciesTokens = lines[5].trim().split(/\s+/).filter(Boolean);
  if (speciesTokens.length === 0 || speciesTokens.every((token) => /^\d+$/.test(token))) {
    throw new StructureParseError(
      "POSCAR_VASP4_UNSUPPORTED",
      "v1 需要 VASP5/6 元素行；VASP4 请提供元素映射或先转换文件",
      6,
    );
  }
  const species = speciesTokens.map((token) => {
    const symbol = normalizeElementSymbol(token);
    if (!symbol) {
      throw new StructureParseError("POSCAR_INVALID_ELEMENT", `未知元素符号“${token}”`, 6);
    }
    return symbol;
  });
  const countTokens = lines[6].trim().split(/\s+/).filter(Boolean);
  if (countTokens.length !== species.length || countTokens.some((token) => !/^\d+$/.test(token))) {
    throw new StructureParseError(
      "POSCAR_COUNT_MISMATCH",
      "元素数量列必须与元素行一一对应，且均为非负整数",
      7,
    );
  }
  const counts = countTokens.map(Number);
  const atomCount = counts.reduce((sum, count) => sum + count, 0);
  let cursor = 7;
  if (/^s/i.test(lines[cursor]?.trim() || "")) cursor += 1;
  const modeLine = cursor + 1;
  const mode = lines[cursor]?.trim().toLowerCase() || "";
  const direct = mode.startsWith("d");
  const cartesian = mode.startsWith("c") || mode.startsWith("k");
  if (!direct && !cartesian) {
    throw new StructureParseError(
      "POSCAR_INVALID_COORD_MODE",
      "坐标模式必须是 Direct 或 Cartesian",
      modeLine,
    );
  }
  cursor += 1;
  if (lines.length < cursor + atomCount) {
    throw new StructureParseError(
      "POSCAR_COUNT_MISMATCH",
      `声明 ${atomCount} 个原子，但坐标行不足`,
      lines.length,
    );
  }
  const elements: string[] = [];
  species.forEach((symbol, idx) => {
    for (let n = 0; n < counts[idx]; n += 1) elements.push(symbol);
  });
  const positions: number[] = [];
  for (let idx = 0; idx < atomCount; idx += 1) {
    const lineNumber = cursor + idx + 1;
    const tokens = lines[cursor + idx].trim().split(/\s+/).filter(Boolean);
    if (tokens.length < 3) {
      throw new StructureParseError("POSCAR_COUNT_MISMATCH", "坐标行少于 3 列", lineNumber);
    }
    const input: Vec3 = [
      finiteNumber(tokens[0], "POSCAR_INVALID_COORD", lineNumber),
      finiteNumber(tokens[1], "POSCAR_INVALID_COORD", lineNumber),
      finiteNumber(tokens[2], "POSCAR_INVALID_COORD", lineNumber),
    ];
    const xyz = direct ? fracToCart(input, cell) : input.map((value) => value * scale) as Vec3;
    positions.push(...xyz);
  }
  return {
    payload: makePayload(name, "poscar", {
      elements,
      positions,
      cell,
      origin: [0, 0, 0],
      pbc: options.pbc || [true, true, true],
    }, [], undefined),
    warnings: [],
    bondsEnabled: true,
  };
}

type LammpsSection = { name: string; headerLine: number; start: number; end: number };

function collectLammpsSections(lines: string[]): LammpsSection[] {
  const sectionHeader = /^\s*(Masses|Atoms|Atom Type Labels|Bonds|Velocities|Angles|Dihedrals|Impropers)\b/i;
  const found: Array<{ name: string; headerLine: number; start: number }> = [];
  lines.forEach((line, idx) => {
    const match = line.match(sectionHeader);
    if (match) found.push({ name: match[1].toLowerCase(), headerLine: idx, start: idx + 1 });
  });
  return found.map((section, idx) => ({
    ...section,
    end: idx + 1 < found.length ? found[idx + 1].headerLine : lines.length,
  }));
}

function sectionData(lines: string[], section: LammpsSection | undefined) {
  if (!section) return [] as Array<{ line: string; lineNumber: number }>;
  return lines.slice(section.start, section.end)
    .map((line, idx) => ({ line, lineNumber: section.start + idx + 1 }))
    .filter(({ line }) => line.trim() && !line.trim().startsWith("#"));
}

export function parseLammpsData(content: string, name = "structure.lmp", options: ParseOptions = {}): ParseResult {
  const lines = content.replace(/^\uFEFF/, "").replace(/\r/g, "").split("\n");
  if (lines.some((line) => /^\s*(avec|bvec|cvec|abc\s+origin)\b/i.test(line))) {
    const idx = lines.findIndex((line) => /^\s*(avec|bvec|cvec|abc\s+origin)\b/i.test(line));
    throw new StructureParseError(
      "LMP_GENERAL_TRICLINIC_UNSUPPORTED",
      "v1 只支持 restricted triclinic（xy xz yz），不支持 general triclinic",
      idx + 1,
    );
  }
  const sections = collectLammpsSections(lines);
  const atomsSection = sections.find((section) => section.name === "atoms");
  if (!atomsSection) {
    throw new StructureParseError("LMP_MISSING_ATOMS", "未找到 Atoms # atomic 段");
  }
  const atomsHeader = lines[atomsSection.headerLine];
  const styleMatch = atomsHeader.match(/^\s*Atoms\s*#\s*(\w+)/i);
  if (!styleMatch || styleMatch[1].toLowerCase() !== "atomic") {
    throw new StructureParseError(
      "LMP_UNSUPPORTED_ATOM_STYLE",
      "v1 仅支持带明确注释的 Atoms # atomic；full/charge/molecular 暂不支持",
      atomsSection.headerLine + 1,
    );
  }
  const declaredMatch = lines
    .slice(0, atomsSection.headerLine)
    .map((line, idx) => ({ match: line.match(/^\s*(\d+)\s+atoms\s*(?:#.*)?$/i), idx }))
    .find(({ match }) => match);
  if (!declaredMatch?.match) {
    throw new StructureParseError("LMP_MISSING_ATOM_COUNT", "文件头缺少“<N> atoms”");
  }
  const declaredAtoms = Number(declaredMatch.match[1]);

  const findBox = (suffix: string) => lines
    .map((line, idx) => ({ match: line.match(new RegExp(`^\\s*(${NUMBER})\\s+(${NUMBER})\\s+${suffix}\\s*(?:#.*)?$`, "i")), idx }))
    .find(({ match }) => match);
  const x = findBox("xlo\\s+xhi");
  const y = findBox("ylo\\s+yhi");
  const z = findBox("zlo\\s+zhi");
  if (!x?.match || !y?.match || !z?.match) {
    throw new StructureParseError("LMP_MISSING_BOX", "缺少 x/y/z 盒子边界");
  }
  const xloBound = Number(x.match[1]); const xhiBound = Number(x.match[2]);
  const yloBound = Number(y.match[1]); const yhiBound = Number(y.match[2]);
  const zlo = Number(z.match[1]); const zhi = Number(z.match[2]);
  const tiltRow = lines
    .map((line, idx) => ({ match: line.match(new RegExp(`^\\s*(${NUMBER})\\s+(${NUMBER})\\s+(${NUMBER})\\s+xy\\s+xz\\s+yz\\s*(?:#.*)?$`, "i")), idx }))
    .find(({ match }) => match);
  const xy = tiltRow?.match ? Number(tiltRow.match[1]) : 0;
  const xz = tiltRow?.match ? Number(tiltRow.match[2]) : 0;
  const yz = tiltRow?.match ? Number(tiltRow.match[3]) : 0;
  const xlo = xloBound - Math.min(0, xy, xz, xy + xz);
  const xhi = xhiBound - Math.max(0, xy, xz, xy + xz);
  const ylo = yloBound - Math.min(0, yz);
  const yhi = yhiBound - Math.max(0, yz);
  const origin: Vec3 = [xlo, ylo, zlo];
  const cell = [xhi - xlo, 0, 0, xy, yhi - ylo, 0, xz, yz, zhi - zlo];
  requireValidCell(cell);

  const discoveredMap: Record<string, string> = {};
  const labelSection = sections.find((section) => section.name === "atom type labels");
  for (const { line } of sectionData(lines, labelSection)) {
    const parts = line.split("#")[0].trim().split(/\s+/);
    const symbol = parts.length >= 2 ? normalizeElementSymbol(parts[1]) : null;
    if (/^\d+$/.test(parts[0] || "") && symbol) discoveredMap[parts[0]] = symbol;
  }
  const massesSection = sections.find((section) => section.name === "masses");
  for (const { line } of sectionData(lines, massesSection)) {
    const comment = line.match(/#\s*([A-Za-z]{1,3})\b/);
    const type = line.trim().split(/\s+/)[0];
    const symbol = comment ? normalizeElementSymbol(comment[1]) : null;
    if (/^\d+$/.test(type || "") && symbol && !discoveredMap[type]) discoveredMap[type] = symbol;
  }
  const typeMap: Record<string, string> = { ...discoveredMap };
  for (const [type, raw] of Object.entries(options.typeMap || {})) {
    const symbol = normalizeElementSymbol(raw);
    if (!symbol) {
      throw new StructureParseError("LMP_INVALID_TYPE_MAP", `类型 ${type} 的元素“${raw}”无效`);
    }
    typeMap[type] = symbol;
  }

  const atomRows = sectionData(lines, atomsSection);
  if (atomRows.length !== declaredAtoms) {
    throw new StructureParseError(
      "LMP_COUNT_MISMATCH",
      `文件头声明 ${declaredAtoms} 个原子，但 Atoms 段读取到 ${atomRows.length} 行`,
      atomsSection.headerLine + 1,
    );
  }
  const atoms = atomRows.map(({ line, lineNumber }) => {
    const clean = line.split("#")[0].trim();
    const parts = clean.split(/\s+/);
    if (parts.length !== 5 && parts.length !== 8) {
      throw new StructureParseError(
        "LMP_INVALID_ATOM_ROW",
        "atomic 行必须是 id type x y z，或额外包含 ix iy iz",
        lineNumber,
      );
    }
    const id = finiteNumber(parts[0], "LMP_INVALID_ATOM_ROW", lineNumber);
    const type = parts[1];
    if (!Number.isInteger(id) || !/^\d+$/.test(type)) {
      throw new StructureParseError("LMP_INVALID_ATOM_ROW", "id 和 type 必须是整数", lineNumber);
    }
    const xyz: Vec3 = [
      finiteNumber(parts[2], "LMP_INVALID_ATOM_ROW", lineNumber),
      finiteNumber(parts[3], "LMP_INVALID_ATOM_ROW", lineNumber),
      finiteNumber(parts[4], "LMP_INVALID_ATOM_ROW", lineNumber),
    ];
    if (parts.length === 8 && parts.slice(5).some((value) => !/^-?\d+$/.test(value))) {
      throw new StructureParseError("LMP_INVALID_IMAGE_FLAGS", "ix iy iz 必须是整数", lineNumber);
    }
    return { id, type, xyz };
  }).sort((a, b) => a.id - b.id);
  const usedTypes = [...new Set(atoms.map((atom) => atom.type))];
  const missingTypes = usedTypes.filter((type) => !typeMap[type]);
  const elements = atoms.map((atom) => typeMap[atom.type] || `Type ${atom.type}`);
  const positions = atoms.flatMap((atom) => atom.xyz);
  const assumptions = ["LAMMPS data 不记录 units；按 Å 解释", "LAMMPS data 不记录 boundary；按 ppp 解释"];
  const warnings = [...assumptions];
  if (missingTypes.length) {
    warnings.push(`类型 ${missingTypes.join(", ")} 缺少元素映射；已关闭自动键。可提供 --type-map 1:P,2:O,3:H`);
  }
  return {
    payload: makePayload(name, "lammps-data", {
      elements,
      positions,
      cell,
      origin,
      pbc: options.pbc || [true, true, true],
    }, assumptions, Object.keys(typeMap).length ? typeMap : undefined),
    warnings,
    bondsEnabled: missingTypes.length === 0,
  };
}

const NUMBER = "[-+]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][-+]?\\d+)?";
