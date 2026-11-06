"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createMeasurementOverlay, type AtomMeasurement, type MeasurementMode } from "@/lib/structure/measurements";
import type { InferredBond, SharePayloadV1 } from "@/lib/structure/types";
import { toMatterVizStructure } from "@/lib/structure/matterviz-adapter";
import { VIEWER_RENDER_DEFAULTS } from "../../web-components/viewer-config";

interface MatterVizSceneProps {
  payload: SharePayloadV1;
  bonds: InferredBond[];
  showAtoms: boolean;
  showBonds: boolean;
  showCell: boolean;
  measurementMode: MeasurementMode | null;
  measurementSites: number[];
  measurement: AtomMeasurement | null;
  onMeasurementSelection: (indices: number[]) => void;
  resetToken: number;
  atomRadius: number;
  bondThickness: number;
}

export function MatterVizScene(props: MatterVizSceneProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [element, setElement] = useState<(HTMLElement & Record<string, unknown>) | null>(null);
  const latestProps = useRef(props);
  useEffect(() => { latestProps.current = props; }, [props]);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [error, setError] = useState<string | null>(null);
  const structure = useMemo(() => toMatterVizStructure(props.payload, props.bonds), [props.payload, props.bonds]);
  const measurementOverlay = useMemo(() => props.measurement
    ? createMeasurementOverlay(props.payload.structure, props.measurement) : null, [props.payload.structure, props.measurement]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.max(320, Math.floor(entry.contentRect.width));
      const height = Math.max(320, Math.floor(entry.contentRect.height));
      setSize((old) => old.width === width && old.height === height ? old : { width, height });
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let mountedElement: HTMLElement | null = null;
    const onSelection = (event: Event) => {
      const detail = (event as CustomEvent<{ mode: MeasurementMode; indices: number[] }>).detail;
      if (detail?.mode === latestProps.current.measurementMode && Array.isArray(detail.indices)) {
        latestProps.current.onMeasurementSelection(detail.indices);
      }
    };
    host.replaceChildren();
    setError(null);
    (async () => {
      try {
        if (!customElements.get("mv-structure")) {
          await new Promise<void>((resolve, reject) => {
            const existing = document.querySelector<HTMLScriptElement>('script[data-matterviz-element]');
            if (existing) {
              existing.addEventListener("load", () => resolve(), { once: true });
              existing.addEventListener("error", () => reject(new Error("Could not load the 3D viewer. Reload the page.")), { once: true });
              return;
            }
            const script = document.createElement("script");
            script.type = "module";
            script.src = `/matterviz/mv-structure.js?v=${VIEWER_RENDER_DEFAULTS.componentAssetVersion}`;
            script.dataset.mattervizElement = "true";
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Could not load the 3D viewer. Reload the page."));
            document.head.appendChild(script);
          });
        }
        if (disposed) return;
        await customElements.whenDefined("mv-structure");
        if (disposed) return;
        const element = document.createElement("mv-structure") as HTMLElement & Record<string, unknown>;
        element.style.display = "block";
        element.style.width = "100%";
        element.style.height = "100%";
        host.appendChild(element);
        mountedElement = element;
        element.addEventListener("measurement-selection", onSelection);
        // Svelte creates the wrapped component on the microtask after connectedCallback.
        // Assigning object-valued props after that tick avoids losing them before upgrade.
        await Promise.resolve();
        if (disposed) return;
        setElement(element);
      } catch (reason) {
        if (!disposed) setError(reason instanceof Error ? reason.message : String(reason));
      }
    })();
    return () => {
      disposed = true;
      mountedElement?.removeEventListener("measurement-selection", onSelection);
      host.replaceChildren();
    };
  }, []);

  useEffect(() => {
    if (!element) return;
    // Update controlled selection in place: picking must never recreate the canvas or reset the camera.
    Object.assign(element, {
      structure,
      bonds: structure.properties.bonds,
      width: size.width,
      height: size.height,
      showAtoms: props.showAtoms,
      showBonds: props.showBonds,
      showCell: props.showCell,
      measurementMode: props.measurementMode ?? "off",
      measurementSites: props.measurementSites,
      measurementOverlay,
      resetToken: props.resetToken,
      atomRadius: props.atomRadius,
      bondThickness: props.bondThickness,
    });
  }, [element, structure, size, props.showAtoms, props.showBonds, props.showCell, props.measurementMode,
    props.measurementSites, measurementOverlay, props.resetToken, props.atomRadius, props.bondThickness]);

  return <div className="scene-host" ref={hostRef} aria-label="Interactive atomic structure">
    {error && <div className="scene-error"><strong>3D viewer unavailable</strong><span>{error}</span></div>}
  </div>;
}
