"use client";

// Échéancier global du Labo : ce qu'il faut écraser, sur toutes les gâchées
// (copies de conflit exclues), exportable en calendrier .ics.

import type { Gachee } from "@/lib/gachee";
import { classeEcheance, construireIcs, dateEcheance, type Eprouvette, type EvenementIcs } from "@/lib/eprouvette";
import { badgeEcheance } from "@/lib/echeance-affichage";
import { Carte } from "@/components/ui/Carte";
import { Icone } from "@/components/ui/Icones";
import { dateCourteFr, telecharger } from "./outils";

function LigneEcheancier({ x, maintenant, onOuvrir }: {
  x: { e: Eprouvette; g: Gachee };
  maintenant: Date;
  onOuvrir: (gacheeId: string) => void;
}) {
  const b = badgeEcheance(x.e, maintenant);
  return (
    <button type="button" className="ui-ligne ui-ligne-lien labo-ligne-bouton" onClick={() => onOuvrir(x.g.id)}>
      <span className="ui-ligne-gauche">
        <span className="ui-point" style={{ background: b.couleur }} aria-hidden="true" />
        <span className="ui-ligne-textes">
          <span className="ui-ligne-libelle">{x.e.code}</span>
          <span className="ui-ligne-detail">{x.g.formulationLabel} · échéance {dateCourteFr(dateEcheance(x.e))}</span>
        </span>
      </span>
      <span className="ui-ligne-droite">
        <span style={{ color: b.couleur, fontWeight: 600, fontSize: 14 }}>{b.texte}</span>
        <span className="ui-ligne-chevron"><Icone nom="chevron" taille={14} epaisseur={2.2} /></span>
      </span>
    </button>
  );
}

export default function Echeancier({ gachees, maintenant, onOuvrir }: {
  gachees: Gachee[];
  maintenant: Date;
  onOuvrir: (gacheeId: string) => void;
}) {
  // Copies de conflit exclues : elles gardent les éprouvettes de l'original
  // (mêmes ids) — chaque éprouvette serait sinon listée deux fois.
  const toutes = gachees.filter((g) => !g.conflit).flatMap((g) => g.eprouvettes.map((e) => ({ e, g })));
  if (toutes.length === 0) return null;
  const enCure = toutes.filter((x) => x.e.statut !== "ecrase");
  const parEcheance = (a: { e: Eprouvette }, b: { e: Eprouvette }) => dateEcheance(a.e).getTime() - dateEcheance(b.e).getTime();
  const aEcraser = enCure.filter((x) => ["retard", "aujourdhui"].includes(classeEcheance(x.e, maintenant))).sort(parEcheance);
  const aVenir = enCure.filter((x) => ["proche", "planifie"].includes(classeEcheance(x.e, maintenant))).sort(parEcheance);

  const exporterIcs = () => {
    const evenements: EvenementIcs[] = enCure.map((x) => ({
      uid: `${x.e.id}@minebackfill`,
      date: dateEcheance(x.e),
      titre: `Écraser ${x.e.code}`,
      description: `Gâchée ${x.g.code} · ${x.g.formulationLabel} · ${x.e.ageJours} j de cure`,
    }));
    if (evenements.length === 0) return;
    // Horodatage réel de l'export (dans un handler : pas de gel par le compilateur).
    telecharger("echeances-labo.ics", "text/calendar", construireIcs(evenements, new Date()));
  };

  return (
    <Carte titre="À écraser" aria-label="Échéancier"
      aside={aEcraser.length > 0 ? `${aEcraser.length} éprouvette${aEcraser.length > 1 ? "s" : ""} maintenant` : "rien aujourd'hui"}
      actions={<button type="button" onClick={exporterIcs} className="btn-discret" disabled={enCure.length === 0}>Exporter le calendrier (.ics)</button>}>
      {aEcraser.length === 0 ? (
        <p className="labo-vide">Rien à écraser aujourd&apos;hui. Bon travail.</p>
      ) : (
        <div className="ui-liste">
          {aEcraser.map((x) => <LigneEcheancier key={x.e.id} x={x} maintenant={maintenant} onOuvrir={onOuvrir} />)}
        </div>
      )}
      {aVenir.length > 0 && (
        <div className="ui-liste-bloc">
          <div className="ui-liste-titre">Prochaines échéances</div>
          <div className="ui-liste">
            {aVenir.slice(0, 8).map((x) => <LigneEcheancier key={x.e.id} x={x} maintenant={maintenant} onOuvrir={onOuvrir} />)}
          </div>
          {aVenir.length > 8 && <p className="ui-liste-pied">+ {aVenir.length - 8} autre{aVenir.length - 8 > 1 ? "s" : ""}…</p>}
        </div>
      )}
    </Carte>
  );
}
