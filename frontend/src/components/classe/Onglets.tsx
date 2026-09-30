// Onglets du tableau de bord de l'enseignant : contrôle segmenté (rôle
// tablist), avec un petit compteur à droite du libellé.

import Segmente from "@/components/ui/Segmente";

export interface Onglet<K extends string> {
  cle: K;
  label: string;
  /** Petit compteur à droite du libellé (alertes, éprouvettes à écraser…). */
  compte?: number | null;
}

export default function Onglets<K extends string>({ onglets, actif, onChoisir }: {
  onglets: Onglet<K>[];
  actif: K;
  onChoisir: (k: K) => void;
}) {
  return (
    <Segmente
      ariaLabel="Vues de la classe"
      role="tablist"
      taille="compact"
      valeur={actif}
      onChange={onChoisir}
      options={onglets.map((o) => ({
        valeur: o.cle,
        libelle: o.label,
        badge: o.compte ? <span className="classe-compteur">{o.compte}</span> : undefined,
      }))}
    />
  );
}
