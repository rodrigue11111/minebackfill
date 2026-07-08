"use client";

import { useEffect, useRef } from "react";
import katex from "katex";

interface Props {
  tex: string;
  displayMode?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function KaTeX({ tex, displayMode = false, className, style }: Props) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    try {
      katex.render(tex, ref.current, {
        displayMode,
        throwOnError: false,
        trust: false,
        strict: false,
      });
    } catch {
      // graceful fallback: show plain text
      if (ref.current) ref.current.textContent = tex;
    }
  }, [tex, displayMode]);

  // En mode « display », KaTeX produit un bloc (.katex-display) : le
  // conteneur doit être block pour en mesurer toute la hauteur, sinon un
  // span en ligne rogne les formules hautes (fractions).
  return (
    <span
      ref={ref}
      className={className}
      style={{ display: displayMode ? "block" : undefined, ...style }}
      suppressHydrationWarning
    >
      {tex}
    </span>
  );
}

export default KaTeX;
