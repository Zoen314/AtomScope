"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { inferBonds } from "@/lib/structure/bonds";
import { bondPairKey } from "@/lib/structure/bond-colors";
import { bondLegendBackground } from "@/lib/structure/display-colors";
import { isElementSymbol, normalizeElementSymbol, pairKey } from "@/lib/structure/elements";
import { measureAtoms, parseMeasurementInputs, type MeasurementInputs, type MeasurementMode } from "@/lib/structure/measurements";
import { parseStructure } from "@/lib/structure/parser";
import { makeShareUrl, payloadFromHash } from "@/lib/structure/share";
import type { PairOverride, SharePayloadV1 } from "@/lib/structure/types";
import { englishMessage } from "@/lib/ui-text";
import { StructureParseError } from "@/lib/structure/types";
import { VIEWER_RENDER_DEFAULTS } from "../../web-components/viewer-config";
import { MatterVizScene } from "./MatterVizScene";
import { MeasurementPanel } from "./MeasurementPanel";

const formatLabel = { poscar: "POSCAR", "lammps-data": "LAMMPS data" } as const;
const formulaOf = (elements: string[]) => {
  const counts = new Map<string, number>();
  elements.forEach((element) => counts.set(element, (counts.get(element) || 0) + 1));
  return [...counts].map(([element, count]) => `${element}${count > 1 ? count : ""}`).join("");
};
const errorText = (error: unknown) => error instanceof StructureParseError ? `${error.code}${error.line ? ` (line ${error.line})` : ""}: ${englishMessage(error.message)}` : englishMessage(error instanceof Error ? error.message : String(error));

export function AtomViewerApp() {
  const [payload, setPayload] = useState<SharePayloadV1 | null>(null);
  const [showAtoms, setShowAtoms] = useState(true);
  const [showCell, setShowCell] = useState(true);
  const [showBonds, setShowBonds] = useState(true);
  const [measurementMode, setMeasurementMode] = useState<MeasurementMode | null>(null);
  const [measurementInputs, setMeasurementInputs] = useState<MeasurementInputs>(["", "", ""]);
  const [advanced, setAdvanced] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [resetToken, setResetToken] = useState(0);
  const [structureRevision, setStructureRevision] = useState(0);
  const [atomRadius, setAtomRadius] = useState<number>(VIEWER_RENDER_DEFAULTS.atomRadius);
  const [bondThickness, setBondThickness] = useState<number>(VIEWER_RENDER_DEFAULTS.bondThickness);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pairA, setPairA] = useState("P");
  const [pairB, setPairB] = useState("O");
  const [pairMin, setPairMin] = useState("0.40");
  const [pairMax, setPairMax] = useState("2.00");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const readHash = () => {
      try {
        setPayload(payloadFromHash(window.location.hash)); setError(null); setMessage(null);
        setStructureRevision(value => value + 1);
        setMeasurementMode(null); setMeasurementInputs(["", "", ""]); setResetToken(value => value + 1);
      } catch (reason) { setPayload(null); setError(errorText(reason)); }
    };
    queueMicrotask(readHash);
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, []);

  const elementMapComplete = payload?.structure.elements.every(isElementSymbol) ?? false;
  const inferred = useMemo(() => !payload || !elementMapComplete ? { bonds: [], skippedPairs: 0 } : inferBonds(payload.structure, {
    factor: payload.bonds.factor,
    minDistance: payload.bonds.minDistance,
    pairOverrides: payload.bonds.pairOverrides,
  }), [payload, elementMapComplete]);

  const bondColorLegend = useMemo(() => {
    if (!payload) return [];
    const pairs = new Map<string, { color: string; count: number }>();
    for (const bond of inferred.bonds) {
      const elementA = payload.structure.elements[bond.atomA];
      const elementB = payload.structure.elements[bond.atomB];
      const key = bondPairKey(elementA, elementB);
      const existing = pairs.get(key);
      pairs.set(key, {
        color: bondLegendBackground(elementA, elementB),
        count: (existing?.count ?? 0) + 1,
      });
    }
    return [...pairs.entries()].sort((left, right) => right[1].count - left[1].count);
  }, [payload, inferred.bonds]);

  const measurementState = useMemo(() => {
    if (!payload || !measurementMode) return { indices: [], result: null, error: null };
    const parsed = parseMeasurementInputs(measurementMode, measurementInputs, payload.structure.elements.length);
    const selection = { ...parsed, error: parsed.error ? englishMessage(parsed.error) : null };
    try {
      return { ...selection, result: selection.complete ? measureAtoms(payload.structure, measurementMode, selection.indices) : null };
    } catch (reason) {
      return { ...selection, result: null, error: errorText(reason) };
    }
  }, [payload, measurementMode, measurementInputs]);

  const receiveMeasurementSelection = useCallback((indices: number[]) => {
    setMeasurementInputs([0, 1, 2].map(index => indices[index] === undefined ? "" : String(indices[index] + 1)) as MeasurementInputs);
  }, []);

  function toggleMeasurement(mode: MeasurementMode) {
    setMeasurementInputs(["", "", ""]);
    setMeasurementMode(current => current === mode ? null : mode);
    setAdvanced(false);
  }

  async function loadFile(file: File) {
    setError(null); setMessage("Reading structure…");
    try {
      const result = parseStructure(await file.text(), { name: file.name });
      setPayload(result.payload); setShowAtoms(true); setShowCell(true); setShowBonds(result.bondsEnabled);
      setStructureRevision(value => value + 1);
      setMeasurementInputs(["", "", ""]); setMeasurementMode(null); setResetToken(value => value + 1);
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      setMessage(result.warnings.length ? result.warnings.map(englishMessage).join("; ") : `${file.name} loaded`);
    } catch (reason) { setError(errorText(reason)); setMessage(null); }
  }

  async function copyLink() {
    if (!payload) return;
    setError(null);
    try {
      const url = makeShareUrl(payload, window.location.href);
      await navigator.clipboard.writeText(url);
      window.history.replaceState(null, "", url);
      setMessage(`Link copied (${url.length.toLocaleString()} characters). Anyone with the full link can decode the structure. Links are not encrypted.`);
    } catch (reason) { setError(errorText(reason)); }
  }

  const updateBonds = (bonds: SharePayloadV1["bonds"]) => payload && setPayload({ ...payload, bonds });
  function addOverride() {
    if (!payload) return;
    const a = normalizeElementSymbol(pairA), b = normalizeElementSymbol(pairB), min = Number(pairMin), max = Number(pairMax);
    if (!a || !b || !Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max <= min) {
      setError("Invalid element pair or range. Use max > min ≥ 0."); return;
    }
    const key = pairKey(a, b);
    updateBonds({ ...payload.bonds, pairOverrides: { ...payload.bonds.pairOverrides, [key]: { min, max, enabled: true } } });
    setError(null);
  }
  function changeOverride(key: string, change: Partial<PairOverride>) {
    if (!payload) return;
    const next = { ...payload.bonds.pairOverrides[key], ...change };
    if (!Number.isFinite(next.min) || !Number.isFinite(next.max) || next.min < 0 || next.max <= next.min) {
      setError("Invalid range. Use max > min ≥ 0."); return;
    }
    setError(null);
    updateBonds({ ...payload.bonds, pairOverrides: { ...payload.bonds.pairOverrides, [key]: next } });
  }
  function removeOverride(key: string) {
    if (!payload) return;
    const next = { ...payload.bonds.pairOverrides }; delete next[key];
    updateBonds({ ...payload.bonds, pairOverrides: next });
  }

  const assumptions = payload?.metadata.assumptions || [];
  return <main className={`viewer-shell${dragging ? " is-dragging" : ""}`}
    onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()}
    onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }}
    onDrop={(event) => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files[0]; if (file) void loadFile(file); }}>
    <header className="topbar">
      <div className="brand-block"><div className="brand-mark" aria-hidden="true"><span /><span /><span /></div><div><strong>AtomScope</strong><span className="version-tag">v1 · MatterViz</span></div></div>
      {payload && <div className="structure-title" title={payload.name}><strong>{payload.name}</strong><span>{formatLabel[payload.format]} · {payload.structure.elements.length.toLocaleString()} atoms · {formulaOf(payload.structure.elements)}</span></div>}
      <div className="toolbar"><button className="button button-primary" onClick={() => fileInput.current?.click()}><span>＋</span> Open file</button><button className="button" onClick={() => void copyLink()} disabled={!payload}>Copy link</button></div>
      <input ref={fileInput} className="sr-only" aria-label="Open structure file" tabIndex={-1} type="file" accept=".vasp,.poscar,.contcar,.lmp,.data,.lammps" onChange={(event) => { const file = event.target.files?.[0]; if (file) void loadFile(file); event.currentTarget.value = ""; }} />
    </header>
    {payload ? <>
      <section className="viewport-wrap">
        <MatterVizScene key={structureRevision} payload={payload} bonds={inferred.bonds} showAtoms={showAtoms} showBonds={showBonds && elementMapComplete && !inferred.warning} showCell={showCell} measurementMode={measurementMode} measurementSites={measurementState.indices} measurement={measurementState.result} onMeasurementSelection={receiveMeasurementSelection} resetToken={resetToken} atomRadius={atomRadius} bondThickness={bondThickness} />
        <div className="viewport-hint">Drag to rotate · Scroll to zoom · Right-drag to pan</div>
        {showBonds && bondColorLegend.length > 0 && <div className="bond-color-legend" aria-label="Bond color legend">
          <strong>Bond pairs</strong>
          {bondColorLegend.map(([key, item]) => <span key={key} title={`${item.count.toLocaleString()} ${key} Inferred bonds`}><i style={{ background: item.color }} />{key.replace("-", "–")}</span>)}
        </div>}
        <div className="view-controls" role="group" aria-label="View controls">
          <ToggleButton active={showAtoms} onClick={() => setShowAtoms(!showAtoms)} label="Atoms" icon="●" />
          <ToggleButton active={showCell} onClick={() => setShowCell(!showCell)} label="Cell" icon="◇" />
          <ToggleButton active={showBonds && elementMapComplete} disabled={!elementMapComplete || Boolean(inferred.warning)} onClick={() => setShowBonds(!showBonds)} label="Inferred bonds" icon="━" />
          <ToggleButton active={measurementMode === "distance"} onClick={() => toggleMeasurement("distance")} label="Distance" icon="↔" />
          <ToggleButton active={measurementMode === "angle"} onClick={() => toggleMeasurement("angle")} label="Angle" icon="∠" />
          <button className="control-button" onClick={() => setResetToken((value) => value + 1)}><span>↺</span>Reset view</button>
          <button className={`control-button${advanced ? " active" : ""}`} aria-expanded={advanced} aria-controls="display-settings" onClick={() => { setAdvanced(!advanced); setMeasurementMode(null); }}><span>⌁</span>Settings</button>
        </div>
        {measurementMode && <MeasurementPanel mode={measurementMode} inputs={measurementInputs} structure={payload.structure}
          result={measurementState.result} error={measurementState.error}
          onClear={() => setMeasurementInputs(["", "", ""])}
          onInput={(index, value) => setMeasurementInputs(current => current.map((old, i) => i === index ? value : old) as MeasurementInputs)} />}
      </section>
      <aside id="display-settings" className={`advanced-panel${advanced ? " open" : ""}`} aria-hidden={!advanced}>
        <div className="panel-heading"><div><span className="eyebrow">MatterViz · BODR</span><h2>Display & bonds</h2></div><button className="icon-button" onClick={() => setAdvanced(false)} aria-label="Close settings">×</button></div>
        <p className="panel-copy">Bonds are inferred from geometric cutoffs, not chemical bond order. Measurements use periodic minimum images.</p>
        <h3>Display size</h3>
        <div className="display-size-controls">
          <label className="range-label"><span>Atom size <strong>{atomRadius.toFixed(2)}×</strong></span><input aria-label="Atom size" type="range" min="0.1" max="2" step="0.05" value={atomRadius} onChange={(event) => setAtomRadius(Number(event.target.value))} /><small>Scale all element display radii.</small></label>
          <label className="range-label"><span>Bond radius <strong>{bondThickness.toFixed(2)}</strong></span><input aria-label="Bond radius" type="range" min="0.01" max="0.2" step="0.01" value={bondThickness} onChange={(event) => setBondThickness(Number(event.target.value))} /><small>Appearance only; bond detection is unchanged.</small></label>
        </div>
        <h3>Bond inference</h3>
        <label className="range-label"><span>Radius multiplier <strong>{payload.bonds.factor.toFixed(2)}×</strong></span><input type="range" min="0.9" max="1.4" step="0.01" value={payload.bonds.factor} onChange={(event) => updateBonds({ ...payload.bonds, factor: Number(event.target.value) })} /><small>Upper cutoff = factor × (rA + rB); minimum {payload.bonds.minDistance.toFixed(2)} Å</small></label>
        <div className="metric-grid"><div><span>Inferred bonds</span><strong>{inferred.bonds.length.toLocaleString()}</strong></div><div><span>Periodic bonds</span><strong>{inferred.bonds.filter((bond) => bond.imageShift.some(Boolean)).length.toLocaleString()}</strong></div></div>
        <h3>Pair overrides</h3>
        <div className="pair-form"><input aria-label="Element A" value={pairA} onChange={(event) => setPairA(event.target.value)} maxLength={2} /><span>–</span><input aria-label="Element B" value={pairB} onChange={(event) => setPairB(event.target.value)} maxLength={2} /><input aria-label="Minimum distance" type="number" min="0" step="0.01" value={pairMin} onChange={(event) => setPairMin(event.target.value)} /><input aria-label="Maximum distance" type="number" min="0" step="0.01" value={pairMax} onChange={(event) => setPairMax(event.target.value)} /><button onClick={addOverride}>Add pair</button></div>
        <div className="pair-caption"><span>Pair</span><span>min Å</span><span>max Å</span></div>
        <div className="override-list">{Object.entries(payload.bonds.pairOverrides).map(([key, override]) => <div className="override-row" key={key}><label className="switch" aria-label={`Enable ${key} override`}><input aria-label={`Enable ${key} override`} type="checkbox" checked={override.enabled} onChange={(event) => changeOverride(key, { enabled: event.target.checked })} /><span /></label><strong>{key}</strong><input aria-label={`${key} minimum distance`} type="number" min="0" step="0.01" value={override.min} onChange={(event) => changeOverride(key, { min: Number(event.target.value) })} /><input aria-label={`${key} maximum distance`} type="number" min="0" step="0.01" value={override.max} onChange={(event) => changeOverride(key, { max: Number(event.target.value) })} /><button onClick={() => removeOverride(key)} aria-label={`Remove ${key} override`}>×</button></div>)}{!Object.keys(payload.bonds.pairOverrides).length && <p className="empty-overrides">No overrides. All pairs use the global rule.</p>}</div>
      </aside>
      <footer className="statusbar"><div className="status-group"><span className="status-dot" /><span>{formatLabel[payload.format]}</span><span>{payload.structure.elements.length.toLocaleString()} atoms</span><span>{inferred.bonds.length.toLocaleString()} inferred bonds</span><span>PBC {payload.structure.pbc.map((value) => value ? "p" : "f").join("")}</span></div><div className="badge-group">{assumptions.map((assumption) => <span className="assumption-badge" key={assumption}>Assumed · {englishMessage(assumption)}</span>)}{!elementMapComplete && <span className="warning-badge">Type map missing · Bonds disabled</span>}{inferred.warning && <span className="warning-badge">{englishMessage(inferred.warning)}</span>}</div></footer>
    </> : <section className="empty-state"><div className="empty-orbit" aria-hidden="true"><i /><i /><i /><span /></div><span className="eyebrow">POSCAR · LAMMPS DATA</span><h1>Your structure.<br />A clearer perspective.</h1><p>Drop a POSCAR or LAMMPS data file to explore atoms, periodic cells and distances. Files stay on your device.</p><button className="button button-primary button-large" onClick={() => fileInput.current?.click()}>Choose a structure</button><div className="format-pills"><span>VASP 5/6</span><span>Atoms # atomic</span><span>Orthogonal / triclinic</span></div></section>}
    {dragging && <div className="drop-overlay"><div><strong>Drop to open structure</strong><span>POSCAR / LAMMPS data</span></div></div>}
    {(message || error) && <div className={`toast${error ? " error" : ""}`} role={error ? "alert" : "status"}><span>{error ? "!" : "✓"}</span><p>{error || message}</p><button onClick={() => { setError(null); setMessage(null); }} aria-label="Dismiss message">×</button></div>}
  </main>;
}

function ToggleButton({ active, disabled, onClick, label, icon }: { active: boolean; disabled?: boolean; onClick: () => void; label: string; icon: string }) {
  return <button className={`control-button${active ? " active" : ""}`} disabled={disabled} onClick={onClick} aria-pressed={active}><span>{icon}</span>{label}</button>;
}
