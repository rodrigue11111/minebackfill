"use client";

// Éléments partagés des formulaires de calcul (les 8 méthodes). Avant, chaque
// formulaire recopiait son `inputStyle`, son `Field` et sa `CardSection`.
// Présentation seulement : la logique de calcul reste dans chaque formulaire.

import { Champ } from "@/components/ui/Champ";
import Segmente from "@/components/ui/Segmente";
import { RECIPE_COLORS } from "@/lib/recipe-theme";

/** Champ à libellé au-dessus ; `unit` s'affiche à droite dans la saisie. */
export function Field({ label, hint, unit, children }: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  unit?: React.ReactNode;
  children: React.ReactNode;
}) {
  return <Champ libelle={label} aide={hint} unite={unit}>{children}</Champ>;
}

/** Sous-partie du formulaire (dans la carte « Paramètres »), séparée par un filet. */
export function CardSection({ title, subtitle, children }: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mix-section">
      <div className="mix-section-tete">
        <h3 className="mix-section-titre">{title}</h3>
        {subtitle && <p className="mix-section-sous-titre">{subtitle}</p>}
      </div>
      <div className="mix-section-corps">{children}</div>
    </section>
  );
}

/** Grille de champs : deux colonnes, une seule sur téléphone. */
export function GrilleChamps({ children, une = false }: { children: React.ReactNode; une?: boolean }) {
  return <div className={une ? "mix-grille-une" : "grille-2"}>{children}</div>;
}

/** Pastille de couleur d'une recette (même couleur que les courbes). */
export function PointRecette({ i }: { i: number }) {
  return <span className="mix-point-recette" style={{ background: RECIPE_COLORS[i] }} aria-hidden="true" />;
}

/** Choix du nombre de recettes (1 à 4). */
export function ChoixNombreRecettes({ valeur, onChange }: {
  valeur: number;
  onChange: (n: 1 | 2 | 3 | 4) => void;
}) {
  return (
    <div className="ui-champ">
      <span className="ui-champ-libelle" style={{ marginBottom: 6 }}>Nombre de recettes</span>
      <Segmente
        ariaLabel="Nombre de recettes"
        valeur={String(valeur) as "1" | "2" | "3" | "4"}
        onChange={(v) => onChange(Number(v) as 1 | 2 | 3 | 4)}
        options={(["1", "2", "3", "4"] as const).map((n) => ({ valeur: n, libelle: n }))}
      />
    </div>
  );
}

/** Choix entre quelques options (méthode de base, type de cône, mode de quantité). */
export function ChoixOptions<V extends string>({ libelle, valeur, onChange, options }: {
  libelle: string;
  valeur: V;
  onChange: (v: V) => void;
  options: { valeur: V; libelle: React.ReactNode; detail?: React.ReactNode }[];
}) {
  const choisie = options.find((o) => o.valeur === valeur);
  return (
    <div className="ui-champ">
      <span className="ui-champ-libelle" style={{ marginBottom: 6 }}>{libelle}</span>
      <Segmente
        ariaLabel={libelle}
        valeur={valeur}
        onChange={onChange}
        pleineLargeur
        options={options.map((o) => ({ valeur: o.valeur, libelle: o.libelle }))}
      />
      {choisie?.detail && <span className="ui-champ-aide" style={{ marginTop: 6 }}>{choisie.detail}</span>}
    </div>
  );
}

/** Pied du formulaire : « Calculer » pleine largeur, note, « Réinitialiser » discret. */
export function PiedFormulaire({ loading, onCalculer, onReinitialiser, note }: {
  loading: boolean;
  onCalculer: () => void;
  onReinitialiser: () => void;
  note?: React.ReactNode;
}) {
  return (
    <div className="mix-pied">
      <button type="button" className="mix-calculer" onClick={onCalculer} disabled={loading} aria-busy={loading}>
        {loading ? (<><span className="mix-roue" aria-hidden="true" />Calcul en cours…</>) : "Calculer"}
      </button>
      <div className="mix-pied-ligne">
        <span className="mix-pied-note">{note ?? "Les valeurs restent sur cet appareil ; sauvegardez un résultat pour le retrouver dans l'Historique."}</span>
        <button type="button" className="btn-discret" onClick={onReinitialiser}>Réinitialiser</button>
      </div>
    </div>
  );
}
