"use client";

import { useStore } from "@/lib/store";
import { annotationsDe } from "@/lib/annotations";
import { chargerEtatSync } from "@/lib/sync-etat";
import { cleDoc } from "@/lib/sync-moteur";

/**
 * Commentaires de l'enseignant sur un document de l'étudiant (lecture seule).
 * Signale un commentaire écrit sur une version ANTÉRIEURE : l'étudiant a
 * modifié le document depuis, le commentaire vise peut-être ce qui a changé.
 */
export default function AnnotationsDoc({ kind, id }: { kind: "resultat" | "gachee"; id: string }) {
  const toutes = useStore((s) => s.annotations);
  const liste = annotationsDe(toutes, kind, id);
  if (liste.length === 0) return null;
  const revActuelle = chargerEtatSync().docs[cleDoc(kind, id)]?.rev ?? null;

  return (
    <div style={{ marginTop: 12, border: "1px solid #c7d2fe", background: "#eef2ff", borderRadius: 8, padding: "10px 12px" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#3730a3", marginBottom: 6 }}>
        Commentaire{liste.length > 1 ? "s" : ""} de l&apos;enseignant
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {liste.map((a) => (
          <div key={a.id} style={{ fontSize: 13, color: "#1e1b4b", lineHeight: 1.5 }}>
            {a.ancre && <span style={{ fontWeight: 700 }}>{a.ancre} — </span>}
            <span style={{ whiteSpace: "pre-wrap" }}>{a.texte}</span>
            <div style={{ fontSize: 11.5, color: "#6366f1", marginTop: 2 }}>
              {new Date(a.maj).toLocaleString("fr-CA", { dateStyle: "medium", timeStyle: "short" })}
              {a.cibleRev !== null && revActuelle !== null && revActuelle > a.cibleRev
                ? " · écrit sur une version antérieure, modifiée depuis" : ""}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
