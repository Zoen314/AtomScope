import { describe, expect, it } from "vitest";
import { parseLammpsData, parsePoscar } from "../lib/structure/parser";
import { StructureParseError } from "../lib/structure/types";

describe("POSCAR parser", () => {
  it("supports Direct coordinates and a skewed cell", () => {
    const result = parsePoscar(`skewed\n2.0\n1 0 0\n0.5 1 0\n0 0 1\nO H\n1 1\nDirect\n0.5 0.5 0.5\n0 0 0\n`);
    expect(result.payload.structure.cell).toEqual([2, 0, 0, 1, 2, 0, 0, 0, 2]);
    expect(result.payload.structure.positions.slice(0, 3)).toEqual([1.5, 1, 1]);
  });

  it("supports Cartesian and Selective dynamics", () => {
    const result = parsePoscar(`selective\n1.5\n1 0 0\n0 1 0\n0 0 1\nH\n1\nSelective dynamics\nCartesian\n0.5 0.25 0.75 T F T\n`);
    expect(result.payload.structure.positions).toEqual([0.75, 0.375, 1.125]);
  });

  it.each([
    ["negative", `x\n-10\n1 0 0\n0 1 0\n0 0 1\nH\n1\nDirect\n0 0 0`, "POSCAR_UNSUPPORTED_SCALE"],
    ["three scales", `x\n1 1 1\n1 0 0\n0 1 0\n0 0 1\nH\n1\nDirect\n0 0 0`, "POSCAR_UNSUPPORTED_SCALE"],
    ["VASP4", `x\n1\n1 0 0\n0 1 0\n0 0 1\n1\nDirect\n0 0 0`, "POSCAR_VASP4_UNSUPPORTED"],
  ])("rejects %s explicitly", (_label, input, code) => {
    try { parsePoscar(input); throw new Error("expected parser failure"); }
    catch (error) { expect(error).toBeInstanceOf(StructureParseError); expect((error as StructureParseError).code).toBe(code); }
  });
});

describe("LAMMPS data parser", () => {
  it("supports non-zero origin, restricted triclinic, Masses mapping and image flags", () => {
    const result = parseLammpsData(`example\n\n2 atoms\n2 atom types\n\n1 12 xlo xhi\n2 13 ylo yhi\n3 14 zlo zhi\n1 2 3 xy xz yz\n\nMasses\n\n1 1.008 # H\n2 15.999 # O\n\nAtoms # atomic\n\n2 2 4 5 6 0 0 0\n1 1 3 4 5 -1 0 1\n`);
    expect(result.payload.structure.elements).toEqual(["H", "O"]);
    expect(result.payload.structure.origin).toEqual([1, 2, 3]);
    expect(result.payload.structure.cell).toEqual([8, 0, 0, 1, 8, 0, 2, 3, 11]);
    expect(result.warnings).toHaveLength(2);
  });

  it("renders unmapped types but disables inferred bonds", () => {
    const result = parseLammpsData(`x\n1 atoms\n1 atom types\n0 5 xlo xhi\n0 5 ylo yhi\n0 5 zlo zhi\nAtoms # atomic\n1 1 1 1 1\n`);
    expect(result.payload.structure.elements).toEqual(["Type 1"]);
    expect(result.bondsEnabled).toBe(false);
    expect(result.warnings.join(" ")).toContain("--type-map");
  });

  it("rejects unsupported atom styles with a line number", () => {
    try {
      parseLammpsData(`x\n1 atoms\n1 atom types\n0 5 xlo xhi\n0 5 ylo yhi\n0 5 zlo zhi\nAtoms # full\n1 1 1 0 1 1 1\n`);
      throw new Error("expected parser failure");
    } catch (error) {
      expect(error).toBeInstanceOf(StructureParseError);
      expect((error as StructureParseError).code).toBe("LMP_UNSUPPORTED_ATOM_STYLE");
      expect((error as StructureParseError).line).toBe(7);
    }
  });
});
