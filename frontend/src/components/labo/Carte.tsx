// Cartes de présentation du Labo, partagées avec la vue enseignant (/classe).

import type React from "react";
import type { ProtocoleFige } from "@/lib/protocole";
import { Carte as CarteUi } from "@/components/ui/Carte";

/** Carte du kit, avec l'ancienne signature (titre + zone « extra » à droite). */
export function Carte({ titre, extra, children }: { titre: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return <CarteUi titre={titre} actions={extra}>{children}</CarteUi>;
}

/** Protocole FIGÉ d'une gâchée (lecture seule) : la procédure réellement suivie. */
export function CarteProtocolesFiges({ snapshot }: { snapshot: ProtocoleFige[] | undefined }) {
  if (!snapshot || snapshot.length === 0) return null;
  return (
    <Carte titre="Protocole suivi (figé à la création)">
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {snapshot.map((p, i) => (
          <div key={i}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--texte)", marginBottom: 4 }}>{p.titre}</div>
            <div style={{ fontSize: 13.5, color: "var(--texte-2)", whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{p.contenu}</div>
          </div>
        ))}
      </div>
    </Carte>
  );
}
