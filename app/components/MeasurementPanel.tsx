"use client";

import type { AtomMeasurement, MeasurementInputs, MeasurementMode } from "@/lib/structure/measurements";
import type { NormalizedStructure } from "@/lib/structure/types";

interface Props {
  mode: MeasurementMode;
  inputs: MeasurementInputs;
  structure: NormalizedStructure;
  result: AtomMeasurement | null;
  error: string | null;
  onInput: (index: number, value: string) => void;
  onClear: () => void;
}

export function MeasurementPanel({ mode, inputs, structure, result, error, onInput, onClear }: Props) {
  const labels = mode === "angle" ? ["A", "B", "C"] : ["A", "B"];
  const atomName = (id: number) => `${structure.elements[id]}${id + 1}`;
  const images = result?.kind === "distance" ? [result.arm.shift] : result?.arms.map(arm => arm.shift);
  const periodic = images?.some(shift => shift.some(Boolean));
  return <section className="measure-panel" aria-label="Atom measurement">
    <div className="measure-heading"><strong>{mode === "distance" ? "Distance · A—B" : "Angle · A—B—C"}</strong><button onClick={onClear}>Clear</button></div>
    <p className="measure-instruction">{mode === "distance" ? "Pick two atoms, or enter their IDs below." : "Pick A, B, then C. The angle is centered on B."}</p>
    <div className="measure-inputs">
      {labels.map((label, index) => {
        const id = Number(inputs[index]);
        const name = Number.isInteger(id) && id > 0 && id <= structure.elements.length ? atomName(id - 1) : "Not selected";
        return <label key={label}>
          <span>{label}{mode === "angle" && index === 1 && <small>vertex</small>}</span>
          <input aria-label={`Atom ${label}`} type="number" min="1" max={structure.elements.length} step="1" placeholder="ID" value={inputs[index]} onChange={event => onInput(index, event.target.value)} />
          <small>{name}</small>
        </label>;
      })}
    </div>
    <output aria-live="polite" aria-atomic="true" className={error ? "measurement-error" : ""}>
      {error ? error : result ? <>
        <strong>{result.kind === "distance" ? `${result.distance.toFixed(6)} Å` : `${result.angle.toFixed(4)}°`}</strong>
        <span>{result.indices.map(atomName).join(result.kind === "distance" ? " ↔ " : " – ")}{result.kind === "angle" ? " · B is the vertex" : ""}</span>
        <small>{periodic ? `Periodic · ${result.kind === "distance" ? "B relative to A" : "A/C relative to B"} image ${images!.map(shift => `[${shift.join(",")}]`).join(" / ")}` : "No periodic shift needed"}</small>
      </> : `Select ${labels.length} distinct atoms (IDs 1–${structure.elements.length} )`}
    </output>
    <p className="measure-note">Minimum-image geometry. Blue guides are measurements, not bonds. Pick a new atom after completion to start again.</p>
  </section>;
}
