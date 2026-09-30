// frontend/src/lib/rapport-classe-pdf.ts
// Dessin du rapport de session (modèle : rapport-classe.ts) avec jsPDF,
// chargé à la demande. A4 paysage comme pdf-report.ts. Tableaux dessinés à la
// main : cellules à retour à la ligne, en-tête répété à chaque page.
// Tout texte passe par pourPdf (police intégrée WinAnsi).

import type { jsPDF as JsPdf } from "jspdf";
import type { BlocRapport, DocumentRapport } from "./rapport-classe";
import { pourPdf } from "./texte-pdf";

const MARGE = 12;
const NAVY: [number, number, number] = [12, 30, 66];
const GRIS: [number, number, number] = [100, 116, 139];
const TEXTE: [number, number, number] = [15, 23, 42];
const FOND_TETE: [number, number, number] = [226, 232, 240];
const FOND_PAIR: [number, number, number] = [248, 250, 252];
const INTERLIGNE = 3.6;
const BAS = 12; // réserve du pied de page

/** Construit le PDF (sans l'enregistrer) : testable sous Node. */
export async function construirePdf(d: DocumentRapport): Promise<JsPdf> {
  const mod = await import("jspdf");
  const JsPDF = (mod as unknown as { jsPDF?: typeof JsPdf; default?: typeof JsPdf }).jsPDF
    ?? (mod as unknown as { default: typeof JsPdf }).default;
  const doc = new JsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const largeurPage = doc.internal.pageSize.getWidth();
  const hauteurPage = doc.internal.pageSize.getHeight();
  const utile = largeurPage - 2 * MARGE;
  let y = MARGE;

  const nouvellePage = () => { doc.addPage(); y = MARGE; };
  const place = (h: number) => { if (y + h > hauteurPage - BAS) nouvellePage(); };
  const ecrire = (texte: string, taille: number, style: "normal" | "bold", couleur: [number, number, number], largeur = utile): number => {
    doc.setFont("helvetica", style);
    doc.setFontSize(taille);
    doc.setTextColor(...couleur);
    const lignes = doc.splitTextToSize(pourPdf(texte), largeur) as string[];
    const h = lignes.length * taille * 0.42;
    place(h);
    doc.text(lignes, MARGE, y + taille * 0.33);
    y += h + 1.2;
    return h;
  };

  // En-tête du document.
  ecrire(d.titre, 16, "bold", NAVY);
  ecrire(d.sousTitre, 8.5, "normal", GRIS);
  y += 2;

  const tableau = (b: Extract<BlocRapport, { type: "tableau" }>) => {
    const total = b.colonnes.reduce((n, c) => n + c.largeur, 0);
    const larg = b.colonnes.map((c) => (c.largeur / total) * utile);
    const PAD = 1.4;
    const decouper = (cells: string[], style: "normal" | "bold", taille: number) => {
      doc.setFont("helvetica", style);
      doc.setFontSize(taille);
      return cells.map((c, i) => doc.splitTextToSize(pourPdf(c || ""), larg[i] - 2 * PAD) as string[]);
    };
    const dessinerLigne = (morceaux: string[][], style: "normal" | "bold", taille: number, fond: [number, number, number] | null) => {
      const h = Math.max(1, ...morceaux.map((m) => m.length)) * INTERLIGNE + 2 * PAD;
      if (fond) { doc.setFillColor(...fond); doc.rect(MARGE, y, utile, h, "F"); }
      doc.setFont("helvetica", style);
      doc.setFontSize(taille);
      doc.setTextColor(...TEXTE);
      let x = MARGE;
      morceaux.forEach((m, i) => {
        const droite = b.colonnes[i].alignement === "d";
        doc.text(m, droite ? x + larg[i] - PAD : x + PAD, y + PAD + 2.4, droite ? { align: "right" } : undefined);
        x += larg[i];
      });
      doc.setDrawColor(226, 232, 240);
      doc.line(MARGE, y + h, MARGE + utile, y + h);
      y += h;
      return h;
    };
    const tete = decouper(b.colonnes.map((c) => c.titre), "bold", 7.5);
    const hTete = Math.max(...tete.map((m) => m.length)) * INTERLIGNE + 2 * PAD;
    const enTete = () => dessinerLigne(tete, "bold", 7.5, FOND_TETE);
    place(hTete + 8);
    enTete();
    b.lignes.forEach((l, i) => {
      const m = decouper(l, "normal", 8);
      const h = Math.max(1, ...m.map((x) => x.length)) * INTERLIGNE + 2 * PAD;
      if (y + h > hauteurPage - BAS) { nouvellePage(); enTete(); }
      dessinerLigne(m, "normal", 8, i % 2 === 1 ? FOND_PAIR : null);
    });
    y += 3;
  };

  let premier = true;
  for (const b of d.blocs) {
    if (b.type === "saut") { nouvellePage(); premier = true; continue; }
    if (b.type === "titre") {
      if (!premier) y += b.niveau === 1 ? 3 : 1.5;
      place(b.niveau === 1 ? 20 : 14); // pas de titre seul en bas de page
      ecrire(b.texte, b.niveau === 1 ? 13 : 10.5, "bold", NAVY);
    } else if (b.type === "texte") {
      ecrire(b.texte, b.discret ? 7.5 : 9, "normal", b.discret ? GRIS : TEXTE);
    } else {
      tableau(b);
    }
    premier = false;
  }

  // Pied de page, une fois le nombre de pages connu.
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...GRIS);
    doc.text(pourPdf(`MineBackfill — ${d.titre}`), MARGE, hauteurPage - 6);
    doc.text(pourPdf(`page ${i}/${n}`), largeurPage - MARGE, hauteurPage - 6, { align: "right" });
  }
  return doc;
}

export async function telechargerRapportPdf(d: DocumentRapport, nom: string): Promise<void> {
  (await construirePdf(d)).save(nom);
}
