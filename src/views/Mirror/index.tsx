/// <reference lib="dom" />

import { useRef, useEffect, useCallback } from "react";
import { usePortalRegistryContext } from "../../contexts/PortalRegistry";
import type { MirrorProps } from "../../types";

function captureToCanvas(
  sourceEl: HTMLElement,
  canvas: HTMLCanvasElement,
): boolean {
  if (sourceEl.offsetWidth === 0 || sourceEl.offsetHeight === 0) return false;

  const ctx = canvas.getContext("2d");
  if (!ctx) return false;

  const dpr = window.devicePixelRatio || 1;
  const w = sourceEl.offsetWidth;
  const h = sourceEl.offsetHeight;

  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;

  const clone = sourceEl.cloneNode(true) as HTMLElement;
  const svgData = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml">
          ${clone.outerHTML}
        </div>
      </foreignObject>
    </svg>`;

  const img = new Image();
  const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  img.onload = () => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
  };
  img.src = url;
  return true;
}

export default function Mirror({ name, mode = "layer", style }: MirrorProps) {
  const { getPortal, registerPendingMirror, unregisterPendingMirror } =
    usePortalRegistryContext();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafIdRef = useRef<number>(0);
  const hasCapturedRef = useRef(false);

  const stopCapturing = useCallback(() => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = 0;
    }
  }, []);

  const startCapturing = useCallback(() => {
    stopCapturing();
    hasCapturedRef.current = false;

    const tick = () => {
      const canvas = canvasRef.current;
      const sourceEl = getPortal(name);

      if (canvas && sourceEl) {
        const success = captureToCanvas(sourceEl, canvas);

        if (mode === "live") {
          // Keep capturing continuously
          rafIdRef.current = requestAnimationFrame(tick);
        } else if (!success) {
          // One-shot modes: retry until successful
          rafIdRef.current = requestAnimationFrame(tick);
        } else {
          hasCapturedRef.current = true;
        }
      } else {
        // Source not available yet, retry
        rafIdRef.current = requestAnimationFrame(tick);
      }
    };

    rafIdRef.current = requestAnimationFrame(tick);
  }, [name, mode, getPortal, stopCapturing]);

  useEffect(() => {
    const sourceEl = getPortal(name);

    if (sourceEl) {
      startCapturing();
    } else {
      const onAvailable = () => startCapturing();
      registerPendingMirror(name, onAvailable);

      return () => {
        stopCapturing();
        unregisterPendingMirror(name, onAvailable);
      };
    }

    return () => {
      stopCapturing();
    };
  }, [
    name,
    mode,
    getPortal,
    registerPendingMirror,
    unregisterPendingMirror,
    startCapturing,
    stopCapturing,
  ]);

  return <canvas ref={canvasRef} style={style as React.CSSProperties} />;
}
