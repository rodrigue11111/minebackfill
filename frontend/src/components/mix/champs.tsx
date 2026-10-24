"use client";

// Éléments partagés des formulaires de calcul (les 8 méthodes). Avant, chaque
// formulaire recopiait son `inputStyle`, son `Field` et sa `CardSection`.
// Présentation seulement : la logique de calcul reste dans chaque formulaire.

import { Champ } from "@/components/ui/Champ";
import { avisHorsPlage, messageHorsBornes, rappelPlage, type ClePlage } from "@/lib/plages";
import Segmente from "@/components/ui/Segmente";
import { RECIPE_COLORS } from "@/lib/recipe-theme";

/** Champ à libellé au-dessus ; `unit` s'affiche à droite dans la saisie. */
export function Field({ label, hint, unit, children, plage, valeur, erreur }: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  unit?: React.ReactNode;
  children: React.ReactNode;
  /** Plage usuelle (Guide) : rappelée sous le champ, avis doux hors plage. */
  plage?: ClePlage;
  /** Valeur saisie, pour l'avis hors plage. */
  valeur?: number | null;
  /** Erreur propre au champ (saisie refusée) ; prime sur les bornes de la plage. */
  erreur?: string | null;
}) {
  const aide = plage ? <>{hint}{hint ? " " : null}{rappelPlage(plage)}</> : hint;
  // Une valeur impossible (le calcul la refusera) remplace l'avis de plage
  // usuelle : Champ n'affiche pas l'avis quand une erreur est posée.
  return (
    <Champ libelle={label} aide={aide} unite={unit}
      erreur={erreur ?? (plage ? messageHorsBornes(plage, valeur) : null) ?? undefined}
      avis={plage ? avisHorsPlage(plage, valeur) : undefined}>
      {children}
    </Champ>
  );
}

/** Sous-partie du formulaire (dans la carte « Paramètres »), séparée par un filet. */
// Essai-erreur : ce que chaque ajout de résidu apporte au mélange (RPC et RPG).
// Le résidu sec est SÉCHÉ (sans eau) depuis le 2026-10-23 ; le résidu humide
// apporte ses grains et son eau w₀, comme la ligne D59 des feuilles.
export const AIDE_RESIDU_SEC = "Séché à l'étuve : grains seuls, sans eau.";
export const AIDE_RESIDU_HUMIDE = "Tel que stocké : grains et leur eau (teneur en eau w₀ du résidu).";

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
        <span className="mix-pied-note">{note ?? "Les valeurs restent sur cet appareil ; sauvegardez un résultat pour le retrouver dans Mes calculs."}</span>
        <button type="button" className="btn-discret" onClick={onReinitialiser}>Réinitialiser</button>
      </div>
    </div>
  );
}
