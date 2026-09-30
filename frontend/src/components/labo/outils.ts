// Utilitaires du Labo (déplacés de app/labo/page.tsx, inchangés) : identifiants,
// dates des champs <input type="date">, téléchargement et impression sans
// dépendance.

import { fmtDate } from "@/lib/echeance-affichage";

export function nouvelId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return "g_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

/** ISO -> valeur d'un <input type="date"> (AAAA-MM-JJ, date LOCALE). */
export function isoVersDateInput(iso: string): string {
  return fmtDate(new Date(iso));
}

/** ISO au midi LOCAL d'un jour (évite tout décalage de date fuseau/heure d'été). */
export function isoJourMidi(d: Date): string {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).toISOString();
}

/** Déclenche le téléchargement d'un fichier texte (sans dépendance). */
export function telecharger(nom: string, type: string, contenu: string): void {
  const blob = new Blob([contenu], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Imprime un document HTML autonome via une iframe hors-écran (isole les styles). */
export function imprimerHtml(html: string): void {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  // Hors-écran mais de taille NON nulle : certains moteurs ignorent l'impression
  // d'une iframe 0 × 0 (format ~A4 à 96 dpi).
  iframe.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0;";
  document.body.appendChild(iframe);
  const w = iframe.contentWindow;
  const doc = w?.document;
  if (!w || !doc) { iframe.remove(); return; }
  let retire = false;
  const nettoyer = () => {
    if (retire) return;
    retire = true;
    setTimeout(() => iframe.remove(), 300);
  };
  w.onafterprint = nettoyer;
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    try { w.focus(); w.print(); } catch { nettoyer(); }
    // Filet de sécurité : retire l'iframe même si onafterprint ne se déclenche
    // pas (Safari iOS, certains webviews) — sinon fuite DOM à chaque impression.
    setTimeout(nettoyer, 60_000);
  }, 200);
}

/** Date lisible « 29 sept. 2026 ». */
export function dateLongue(d: Date): string {
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });
}

/** Date courte « 6 oct. ». */
export function dateCourteFr(d: Date): string {
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "short" });
}
