"use client";

// Courbe d'une éprouvette, ouverte À LA DEMANDE : lue dans le magasin de cet
// appareil, ou en ligne (autre appareil de l'étudiant, enseignant). Rien
// n'est lu tant qu'on ne demande pas la courbe.

import { useState } from "react";
import type { PointCourbe } from "@/lib/presse-urstm";
import { lignesCsvCourbe } from "@/lib/courbes";
import { nomFichier, telechargerTexte, versCsv } from "@/lib/export-fig";
import FigurePng from "@/components/analyse/FigurePng";
import CourbeContrainteDeformation from "./CourbeContrainteDeformation";

type Etat = { quoi: "ferme" } | { quoi: "lecture" } | { quoi: "absente" } | { quoi: "erreur" } | { quoi: "ouverte"; points: PointCourbe[] };

export default function CourbeEprouvette({ code, nbPoints, charger, enLigne = false }: {
  /** Code de l'éprouvette (titre, nom des fichiers). */
  code: string;
  /** Points rangés sur cet appareil (0 : la courbe est à chercher en ligne). */
  nbPoints: number;
  charger: () => Promise<PointCourbe[] | null>;
  /** La courbe est cherchée en ligne (libellés adaptés). */
  enLigne?: boolean;
}) {
  const [etat, setEtat] = useState<Etat>({ quoi: "ferme" });
  const ouvrir = async () => {
    setEtat({ quoi: "lecture" });
    try {
      const points = await charger();
      setEtat(points && points.length > 0 ? { quoi: "ouverte", points } : { quoi: "absente" });
    } catch {
      setEtat({ quoi: "erreur" });
    }
  };
  const note: React.CSSProperties = { fontSize: 13, color: "var(--texte-2)", margin: 0 };

  if (etat.quoi === "ouverte") {
    const nom = `MineBackfill_courbe_${code}`;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <FigurePng nom={nom}>
          <CourbeContrainteDeformation points={etat.points} titre={`Éprouvette ${code}`} />
        </FigurePng>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={note}>{etat.points.length} points mesurés</span>
          <button type="button" className="btn-discret"
            onClick={() => telechargerTexte(versCsv(lignesCsvCourbe(etat.points)), nomFichier(nom, "csv"), "text/csv;charset=utf-8")}>
            Télécharger la courbe (CSV)
          </button>
          <button type="button" className="btn-discret" onClick={() => setEtat({ quoi: "ferme" })}>Masquer la courbe</button>
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
      <button type="button" className="btn-discret" disabled={etat.quoi === "lecture"} onClick={() => void ouvrir()}>
        {etat.quoi === "lecture" ? "Lecture de la courbe…"
          : enLigne ? "Courbe en ligne : afficher" : `Afficher la courbe (${nbPoints} points)`}
      </button>
      {etat.quoi === "absente" && (
        <p style={note}>
          {enLigne
            ? "Aucune courbe en ligne pour cette éprouvette : elle n'a pas encore été envoyée par le site de l'étudiant."
            : "Courbe introuvable sur cet appareil."}
        </p>
      )}
      {etat.quoi === "erreur" && <p role="alert" className="ui-champ-erreur" style={{ margin: 0 }}>Lecture impossible : réessayez.</p>}
    </div>
  );
}
