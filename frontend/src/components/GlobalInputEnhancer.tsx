"use client";

import { useEffect } from "react";

/**
 * Mounts a single document-level focusin listener that auto-selects the
 * full content of every <input type="number"> when the user clicks into it.
 *
 * This prevents the "078" leading-zero artefact: the existing digits are
 * pre-selected, so the first keystroke replaces them entirely.
 *
 * Renders nothing — pure side-effect component.
 */
export default function GlobalInputEnhancer() {
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target as HTMLInputElement;
      if (el.tagName === "INPUT" && el.type === "number") {
        // Defer until after the browser finishes placing the cursor —
        // calling select() synchronously inside focusin is unreliable on
        // number inputs and can leave the cursor at the end, causing "078".
        requestAnimationFrame(() => el.select());
      }
    };
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, []);

  return null;
}
