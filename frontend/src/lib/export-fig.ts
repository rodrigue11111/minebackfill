// frontend/src/lib/export-fig.ts
// Export de figures et de données : téléchargement de fichiers, CSV (format
// tableur français : séparateur « ; » et décimale « , »), et conversion d'un
// SVG en PNG côté navigateur. Aucune dépendance.

/** Déclenche le téléchargement d'un Blob. */
export function telechargerBlob(blob: Blob, nom: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Télécharge du texte (UTF-8 avec BOM pour que Excel garde les accents). */
export function telechargerTexte(contenu: string, nom: string, mime = "text/plain;charset=utf-8"): void {
  telechargerBlob(new Blob(["﻿" + contenu], { type: mime }), nom);
}

/** Une cellule CSV : décimale « , », échappement des « ; » « " » et sauts de
 *  ligne. Les nombres sont écrits SANS notation scientifique et sans séparateur
 *  de milliers (une valeur minuscule comme 1e-8 -> « 0,00000001 » lisible par
 *  Excel FR, pas « 1e-8 » interprété comme du texte). */
export function celluleCsv(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") {
    return Number.isFinite(v) ? v.toLocaleString("fr-CA", { useGrouping: false, maximumFractionDigits: 15 }) : "";
  }
  const s = String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Assemble des lignes en CSV (séparateur « ; », fins de ligne CRLF). */
export function versCsv(lignes: (string | number | null | undefined)[][]): string {
  return lignes.map((l) => l.map(celluleCsv).join(";")).join("\r\n");
}

/** Nom de fichier « sûr » (sans caractères interdits), horodaté à la journée. */
export function nomFichier(base: string, ext: string, date = new Date()): string {
  const jour = date.toISOString().slice(0, 10);
  const propre = base.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return `${propre}_${jour}.${ext}`;
}

/**
 * Convertit un <svg> autonome (styles en ligne, aucune ressource externe) en
 * PNG et déclenche son téléchargement. `echelle` augmente la résolution (défaut
 * 2× pour une figure nette dans un rapport). Fond blanc.
 */
export function svgVersPng(svg: SVGSVGElement, nom: string, echelle = 2, onErreur?: () => void): void {
  const xml = new XMLSerializer().serializeToString(svg);
  const vb = svg.viewBox?.baseVal;
  const largeur = (vb && vb.width) || svg.clientWidth || 760;
  const hauteur = (vb && vb.height) || svg.clientHeight || 430;

  const img = new Image();
  img.onload = () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(largeur * echelle);
      canvas.height = Math.round(hauteur * echelle);
      const ctx = canvas.getContext("2d");
      if (!ctx) { onErreur?.(); return; }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => (blob ? telechargerBlob(blob, nom) : onErreur?.()), "image/png");
    } catch {
      onErreur?.();
    }
  };
  img.onerror = () => onErreur?.();
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
}
