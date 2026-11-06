export type StructureFormat = "poscar" | "lammps-data";

export type Vec3 = [number, number, number];

export interface NormalizedStructure {
  elements: string[];
  positions: number[];
  cell: number[];
  origin: Vec3;
  pbc: [boolean, boolean, boolean];
}

export interface PairOverride {
  min: number;
  max: number;
  enabled: boolean;
}

export interface SharePayloadV1 {
  v: 1;
  name: string;
  format: StructureFormat;
  structure: NormalizedStructure;
  metadata: {
    units: "angstrom";
    typeMap?: Record<string, string>;
    assumptions: string[];
  };
  bonds: {
    dataset: "bodr";
    factor: number;
    minDistance: number;
    pairOverrides: Record<string, PairOverride>;
  };
}

export interface ParseOptions {
  name?: string;
  format?: StructureFormat;
  typeMap?: Record<string, string>;
  pbc?: [boolean, boolean, boolean];
}

export interface ParseResult {
  payload: SharePayloadV1;
  warnings: string[];
  bondsEnabled: boolean;
}

export interface InferredBond {
  atomA: number;
  atomB: number;
  distance: number;
  imageShift: Vec3;
}

export interface BondInferenceResult {
  bonds: InferredBond[];
  skippedPairs: number;
  warning?: string;
}

export class StructureParseError extends Error {
  readonly code: string;
  readonly line?: number;

  constructor(code: string, message: string, line?: number) {
    super(message);
    this.name = "StructureParseError";
    this.code = code;
    this.line = line;
  }

  toString() {
    return `${this.code}${this.line ? `（第 ${this.line} 行）` : ""}: ${this.message}`;
  }
}
