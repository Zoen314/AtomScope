import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { englishMessage } from "../lib/ui-text";
import { VIEWER_TITLE } from "../scripts/local-viewer";

describe("English UI", () => {
  it("keeps launcher health detection aligned with the page title", () => {
    expect(readFileSync("app/layout.tsx", "utf8")).toContain(`title: "${VIEWER_TITLE}`);
  });
  it("keeps interface copy and accessibility labels English", () => {
    for (const path of ["app/layout.tsx", "app/components/AtomViewerApp.tsx", "app/components/MeasurementPanel.tsx", "app/components/MatterVizScene.tsx"]) {
      expect(readFileSync(path, "utf8")).not.toMatch(/\p{Script=Han}/u);
    }
  });
  it.each([
    ["原子编号须为 1–124 的整数", "Atom IDs must be integers in 1–124"],
    ["请选择不同的原子", "Select distinct atoms"],
    ["声明 124 个原子，但坐标行不足", "124 atoms declared, but coordinate rows are missing"],
    ["分享链接损坏或版本不受支持：format 无效", "Invalid or unsupported structure link: Invalid format"],
    ["LAMMPS data 不记录 boundary；按 ppp 解释", "Boundary: ppp (not stored in LAMMPS data)"],
  ])("translates legacy diagnostics: %s", (source, expected) => {
    expect(englishMessage(source)).toBe(expected);
  });
  it("preserves already-English messages", () => {
    expect(englishMessage("Invalid range. Use max > min ≥ 0.")).toBe("Invalid range. Use max > min ≥ 0.");
  });
});
