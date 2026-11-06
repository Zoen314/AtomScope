// Use approved P/O/H display colors, with the installed MIT MatterViz fallback.
// This import is intentionally pinned to the same 0.4.4 package as the renderer.
import palette from "../../node_modules/matterviz/dist/colors/vesta-colors.json";
import { APPROVED_ELEMENT_COLORS } from "../../web-components/viewer-config";

export function displayColorForElement(element: string): string {
  if (APPROVED_ELEMENT_COLORS[element]) return APPROVED_ELEMENT_COLORS[element];
  const rgb = (palette as Record<string, number[]>)[element] ?? palette.C;
  return `#${rgb.slice(0, 3).map(value => value.toString(16).padStart(2, "0")).join("")}`;
}

export function bondLegendBackground(elementA: string, elementB: string): string {
  const [a, b] = [elementA, elementB].sort((left, right) => left.localeCompare(right));
  return `linear-gradient(90deg, ${displayColorForElement(a)} 0% 50%, ${displayColorForElement(b)} 50% 100%)`;
}
