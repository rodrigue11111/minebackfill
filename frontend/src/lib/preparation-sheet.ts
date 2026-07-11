// Feuille de préparation laboratoire — PDF portrait A4, une page par recette.
// Équivalent de la feuille « feuille préparation mélanges » du classeur
// Intra 2017 : les masses à peser dans l'ordre, des cases pour cocher,
// et des champs vides pour noter les mesures après la gâchée.

import type { UnitPreferences } from "@/lib/units";
import { fromStoreMass, MASS_LABELS } from "@/lib/units";
import type { Recipe, RecipeComponents } from "@/lib/types";
import type { Category, GeneralInfo } from "@/lib/store";
import { lireBinders } from "@/lib/store";
import { methodLabel } from "@/lib/method-registry";

// Masse du composant n (1-indexé) : liste N-aire, repli legacy c1/2/3.
const masseComposantN = (c: RecipeComponents | null | undefined, i: number): number | null | undefined => {
  const liste = c?.binder_masses_kg;
  if (liste && liste.length > i) return liste[i];
  return [c?.binder_c1_mass_kg, c?.binder_c2_mass_kg, c?.binder_c3_mass_kg][i];
};
const masseAjoutComposantN = (c: RecipeComponents | null | undefined, i: number): number | null | undefined => {
  const liste = c?.binder_to_add_masses_kg;
  if (liste && liste.length > i) return liste[i];
  return [c?.binder_c1_to_add_mass_kg, c?.binder_c2_to_add_mass_kg, c?.binder_c3_to_add_mass_kg][i];
};
import { fmt as fmtNum } from "@/lib/format";
import { APP_NAME } from "@/lib/branding";

const NAVY: [number, number, number] = [12, 30, 66];
const WHITE: [number, number, number] = [255, 255, 255];
const TEXT_DARK: [number, number, number] = [15, 23, 42];
const TEXT_MUTED: [number, number, number] = [100, 116, 139];
const LINE: [number, number, number] = [203, 213, 225];
const BG_ROW: [number, number, number] = [248, 250, 252];

const val = (x: number | null | undefined) =>
  x === undefined || x === null || Number.isNaN(x) ? 0 : x;

const CONTENANT_LABELS: Record<string, string> = {
  section_hauteur: "Section + hauteur",
  rayon_hauteur: "Rayon + hauteur",
  longueur_largeur_hauteur: "Longueur x largeur x hauteur",
  volume: "Volume direct",
};

export async function exportPreparationPdf(
  recipes: Recipe[],
  general: GeneralInfo,
  binderName: (n: number) => string,
  category: string,
  method: string,
  units: UnitPreferences,
) {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const mL = 14;
  const mR = 14;
  const contentW = pageW - mL - mR;

  const bcount = lireBinders(general).length;
  const isEssai = method === "essai";
  const isRpg = category === "RPG";
  const massLabel = MASS_LABELS[units.mass] ?? "kg";
  const libelleMethode = methodLabel(category as Category, method);

  const masse = (kg: number | null | undefined) => fmtNum(fromStoreMass(val(kg), units.mass));

  const contenant = () => {
    const t = general.container_type as string | null;
    if (!t) return "—";
    const label = CONTENANT_LABELS[t] ?? t;
    if (t === "section_hauteur")
      return `${label} — ${fmtNum(general.container_section, 1)} cm² x ${fmtNum(general.container_height, 1)} cm`;
    if (t === "rayon_hauteur")
      return `${label} — r ${fmtNum(general.container_radius, 2)} cm x h ${fmtNum(general.container_height, 1)} cm`;
    if (t === "volume")
      return `${label} — ${fmtNum(general.container_volume_m3, 4)} m³`;
    return `${label} — ${fmtNum(general.container_length, 1)} x ${fmtNum(general.container_width, 1)} x ${fmtNum(general.container_height, 1)} cm`;
  };

  recipes.forEach((r, idx) => {
    if (idx > 0) doc.addPage();
    let y = 0;

    // ── Bandeau titre ──
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, pageW, 18, "F");
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...WHITE);
    doc.text("FEUILLE DE PRÉPARATION — LABORATOIRE", mL, 11.5);
    doc.setFillColor(26, 58, 138);
    doc.rect(0, 18, pageW, 8, "F");
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(200, 210, 240);
    doc.text(
      `${category} — ${libelleMethode}  |  Recette ${idx + 1} / ${recipes.length}  |  Bw = ${fmtNum(r.bw_mass_pct, 2)} %`,
      mL, 23.5,
    );
    y = 33;

    // ── Informations projet ──
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT_DARK);
    const info: [string, string][] = [
      ["Projet", general.project_name || "________________________"],
      ["Opérateur", general.operator_name || "________________________"],
      ["Date de mélange", general.mix_date || "____________"],
      ["Résidu", general.residue_id || "____________"],
      ["Contenant", contenant()],
      ["Volume du moule", `${fmtNum(val(r.container_volume_m3) * 1000, 3)} L`],
    ];
    info.forEach(([k, v]) => {
      doc.setFont("helvetica", "bold");
      doc.text(`${k} :`, mL, y);
      doc.setFont("helvetica", "normal");
      doc.text(String(v), mL + 38, y);
      y += 5.6;
    });
    y += 3;

    // ── Tableau des masses à peser ──
    const rows: [string, string][] = [];
    rows.push([`Résidu humide Mr-hum (${massLabel})`, masse(r.components?.residue_wet_mass_kg)]);
    if (isRpg || val(r.components?.aggregate_dry_mass_kg) > 0)
      rows.push([`Granulat sec Ma (${massLabel})`, masse(r.components?.aggregate_dry_mass_kg)]);
    for (let i = 0; i < bcount; i++)
      rows.push([`${binderName(i + 1)} (${massLabel})`, masse(masseComposantN(r.components, i))]);
    rows.push([`Eau à ajouter/retirer Mw-aj (${massLabel})`, masse(r.components?.water_to_add_mass_kg)]);

    const drawTable = (title: string, tableRows: [string, string][]) => {
      doc.setFillColor(...NAVY);
      doc.rect(mL, y, contentW, 7, "F");
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...WHITE);
      doc.text(title, mL + 2, y + 4.8);
      y += 7;
      // header row
      doc.setFontSize(8.5);
      doc.setTextColor(...TEXT_MUTED);
      doc.setFont("helvetica", "bold");
      doc.text("Fait", mL + 2, y + 4.5);
      doc.text("Composant", mL + 14, y + 4.5);
      doc.text("Masse calculée", mL + contentW - 62, y + 4.5);
      doc.text("Masse pesée (réelle)", mL + contentW - 32, y + 4.5);
      y += 6.5;
      tableRows.forEach(([label, value], i) => {
        const h = 9;
        if (i % 2 === 0) {
          doc.setFillColor(...BG_ROW);
          doc.rect(mL, y, contentW, h, "F");
        }
        // case à cocher
        doc.setDrawColor(...TEXT_MUTED);
        doc.rect(mL + 2.5, y + 2.2, 4.6, 4.6);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(...TEXT_DARK);
        doc.text(label, mL + 14, y + 5.8);
        doc.setFont("helvetica", "bold");
        doc.text(value, mL + contentW - 62, y + 5.8);
        // ligne pour la valeur réelle
        doc.setDrawColor(...LINE);
        doc.line(mL + contentW - 32, y + 6.6, mL + contentW - 4, y + 6.6);
        y += h;
      });
      doc.setDrawColor(...LINE);
      doc.line(mL, y, mL + contentW, y);
      y += 5;
    };

    drawTable("MASSES À PESER", rows);

    // ── Ajustements (essai-erreur) ──
    if (isEssai) {
      const adj: [string, string][] = [];
      adj.push([`Liant à ajouter/retirer Mb-ad (${massLabel})`, masse(r.components?.binder_to_add_mass_kg)]);
      for (let i = 0; i < bcount; i++)
        adj.push([`${binderName(i + 1)} à ajouter/retirer (${massLabel})`, masse(masseAjoutComposantN(r.components, i))]);
      drawTable("AJUSTEMENTS EN COURS DE MÉLANGE (valeur négative = à retirer)", adj);
    }

    // ── Mesures après la gâchée ──
    doc.setFillColor(...NAVY);
    doc.rect(mL, y, contentW, 7, "F");
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...WHITE);
    doc.text("MESURES APRÈS LA GÂCHÉE", mL + 2, y + 4.8);
    y += 11;

    doc.setFontSize(9.5);
    doc.setTextColor(...TEXT_DARK);
    const mesures = [
      "Slump mesuré (mm)", "Tare (g)", "Tare + pâte humide m_h (g)",
      "Tare + pâte sèche m_s (g)", "w mesuré (%)", "Cw mesuré (%)",
    ];
    const colW = contentW / 2;
    mesures.forEach((label, i) => {
      const cx = mL + (i % 2) * colW;
      const cy = y + Math.floor(i / 2) * 9;
      doc.setFont("helvetica", "normal");
      doc.text(`${label} :`, cx, cy + 5);
      doc.setDrawColor(...LINE);
      doc.line(cx + 52, cy + 5.8, cx + colW - 10, cy + 5.8);
    });
    y += Math.ceil(mesures.length / 2) * 9 + 4;

    doc.setFontSize(8);
    doc.setTextColor(...TEXT_MUTED);
    doc.text("w mesuré = (m_h − m_s) / (m_s − tare)     Cw mesuré = (m_s − tare) / (m_h − tare)", mL, y);
    y += 10;

    // ── Signature ──
    doc.setFontSize(9.5);
    doc.setTextColor(...TEXT_DARK);
    doc.setFont("helvetica", "normal");
    doc.text("Préparé par : ______________________", mL, y + 6);
    doc.text("Signature : ______________________", mL + contentW / 2, y + 6);

    // ── Pied de page ──
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(`${APP_NAME} — feuille de préparation  |  ${new Date().toLocaleDateString("fr-CA")}`, mL, pageH - 8);
    doc.text(`Recette ${idx + 1}/${recipes.length}`, pageW - mR, pageH - 8, { align: "right" });
  });

  const filename = `MineBackfill_preparation_${category}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
