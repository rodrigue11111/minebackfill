"use client";

// Carte « Calcul analysé » de la page Analyse (2026-10-25) : la source de
// l'analyse est un calcul SAUVEGARDÉ, choisi ici, plus le formulaire en cours
// de Calculs. Purement présentationnel (données en props) : testable par
// rendu serveur.

import Link from "next/link";
import { Carte } from "@/components/ui/Carte";
import { Champ } from "@/components/ui/Champ";
import { Bandeau } from "@/components/ui/Bandeau";
import { libelleCalcul, texteVolume, type LectureSource, type Note } from "@/lib/analyse-source";
import { fmt } from "@/lib/format";
import type { SavedResult } from "@/lib/store";

export default function CarteCalculAnalyse({
  analysables, calcul, introuvable, indexRecette, lecture, notes, exclues, onChoisir, onRecette, onRecharger,
}: {
  analysables: SavedResult[];
  calcul: SavedResult | null;
  /** Un calcul était demandé (lien de Mes calculs) mais n'existe plus ou n'est pas analysable. */
  introuvable: boolean;
  indexRecette: number;
  lecture: LectureSource | null;
  notes: Note[];
  /** Recettes du calcul écartées de la comparaison, avec leur raison. */
  exclues?: { recette: number; raison: string }[];
  onChoisir: (id: string) => void;
  onRecette: (index: number) => void;
  onRecharger: () => void;
}) {
  const labo = (
    <p className="ui-liste-pied" style={{ margin: 0 }}>
      Cette page trace uniquement des valeurs <strong>calculées</strong> par les solveurs.
      Pour vos <strong>mesures</strong> de laboratoire (gâchées réelles, éprouvettes et
      essais UCS), voir{" "}
      <Link href="/labo" style={{ fontWeight: 500 }}>Labo → Résultats UCS</Link>.
    </p>
  );

  if (!calcul) {
    return (
      <Carte titre="Calcul analysé">
        <Bandeau ton="info" titre="Aucun calcul sauvegardé à analyser.">
          L&apos;Analyse part d&apos;un calcul sauvegardé. Calculez une recette RPC ou RPG dans{" "}
          <Link href="/mix" style={{ fontWeight: 500 }}>Calculs</Link>, puis cliquez sur « Sauvegarder » :
          elle apparaîtra ici. Les calculs RRC ne sont pas analysables.
        </Bandeau>
        {labo}
      </Carte>
    );
  }

  const nb = calcul.recipes.length;
  const base = lecture?.ok ? lecture.base : null;
  const source = lecture?.ok ? lecture.source : null;

  return (
    <Carte titre="Calcul analysé">
      {introuvable && (
        <Bandeau ton="alerte" role="status">
          Le calcul demandé n&apos;existe plus ou n&apos;est pas analysable : le plus récent est affiché.
        </Bandeau>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 320px", minWidth: 0 }}>
          <Champ libelle="Calcul sauvegardé">
            <select className="field-input" value={calcul.id} onChange={(e) => onChoisir(e.target.value)}>
              {analysables.map((s) => <option key={s.id} value={s.id}>{libelleCalcul(s)}</option>)}
            </select>
          </Champ>
        </div>
        {nb > 1 && (
          <div style={{ flex: "0 1 160px" }}>
            <Champ libelle="Recette">
              <select className="field-input" value={indexRecette} onChange={(e) => onRecette(Number(e.target.value))}>
                {calcul.recipes.map((_, i) => <option key={i} value={i}>Recette {i + 1}</option>)}
              </select>
            </Champ>
          </div>
        )}
      </div>

      {base && source ? (
        <>
          <p style={{ margin: "4px 0 0", fontSize: 14, color: "var(--texte)" }}>
            Calcul d&apos;origine : <strong>{source.methode}</strong>
            {nb > 1 ? `, recette ${source.recette} sur ${nb}` : ""}. Analyse : <strong>balayage selon la méthode Cw</strong>.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 18, fontSize: 14, color: "var(--texte)" }}>
            <span>Gs résidu : <strong>{fmt(base.materiaux.gsResidu, 3)}</strong></span>
            <span>w₀ : <strong>{fmt(base.materiaux.w0Pct, 1)} %</strong></span>
            <span>Cw : <strong>{fmt(base.recette.cwPct, 2)} %</strong></span>
            <span>Sr : <strong>{fmt(base.recette.srPct, 1)} %</strong></span>
            <span>Bw : <strong>{fmt(base.recette.bwPct, 2)} %</strong></span>
            {base.categorie === "RPG" && <span>Am : <strong>{fmt(base.recette.amPct, 1)} %</strong></span>}
            {base.categorie === "RPG" && <span>Gs granulat : <strong>{fmt(base.materiaux.gsGranulat, 3)}</strong></span>}
            <span>Liant : <strong>{base.liants.map((l) => `${l.nom} ${fmt(l.fraction * 100, 0)} %`).join(" · ")}</strong></span>
            <span>Volume analysé : <strong>{texteVolume(base.recette.volumeM3)}</strong> (volume total de la recette sauvegardée)</span>
          </div>
          {notes.filter((n) => n.ton === "info").map((n) => (
            <p key={n.texte} className="ui-liste-pied" style={{ margin: 0 }}>{n.texte}</p>
          ))}
          {notes.filter((n) => n.ton === "alerte").map((n) => (
            <Bandeau key={n.texte} ton="alerte">{n.texte}</Bandeau>
          ))}
        </>
      ) : lecture && !lecture.ok ? (
        <Bandeau ton="alerte" titre="Calcul non analysable.">{lecture.raison}</Bandeau>
      ) : null}

      {exclues && exclues.length > 0 && (
        <p className="ui-liste-pied" style={{ margin: 0 }}>
          {exclues.map((x) => `Recette ${x.recette} écartée de la comparaison : ${x.raison}`).join(" ")}
        </p>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", fontSize: 14 }}>
        <Link href="/historique" style={{ fontWeight: 500 }}>Voir Mes calculs</Link>
        <button type="button" className="btn-discret" onClick={onRecharger}
          title="Remet ce calcul dans la page Calculs pour le modifier ; sauvegardez-le ensuite pour l'analyser.">
          Recharger dans Calculs
        </button>
      </div>
      {labo}
    </Carte>
  );
}
