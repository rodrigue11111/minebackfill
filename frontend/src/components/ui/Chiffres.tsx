// Chiffres clés : bande à filets (résumé d'une page) et tuiles (résultats).
// Sans hook.

export type TonChiffre = "normal" | "accent" | "succes" | "alerte" | "danger";

export interface Chiffre {
  libelle: React.ReactNode;
  valeur: React.ReactNode;
  unite?: React.ReactNode;
  /** Précision sous la valeur. */
  detail?: React.ReactNode;
  ton?: TonChiffre;
}

/** Bande horizontale de chiffres séparés par des filets (2 colonnes sur téléphone). */
export function BandeChiffres({ chiffres, ariaLabel }: { chiffres: Chiffre[]; ariaLabel?: string }) {
  return (
    <dl className="ui-bande" aria-label={ariaLabel}>
      {chiffres.map((c, i) => (
        <div key={i} className="ui-bande-case">
          <dt className="ui-bande-libelle">{c.libelle}</dt>
          <dd className={`ui-bande-valeur ui-ton-${c.ton ?? "normal"}`}>
            {c.valeur}
            {c.unite && <span className="ui-unite"> {c.unite}</span>}
          </dd>
          {c.detail && <dd className="ui-bande-detail">{c.detail}</dd>}
        </div>
      ))}
    </dl>
  );
}

/** Tuiles grises arrondies (4 chiffres clés d'un résultat). */
export function TuilesChiffres({ chiffres, ariaLabel }: { chiffres: Chiffre[]; ariaLabel?: string }) {
  return (
    <dl className="ui-tuiles" aria-label={ariaLabel}>
      {chiffres.map((c, i) => (
        <div key={i} className="ui-tuile">
          <dt className="ui-tuile-libelle">{c.libelle}</dt>
          <dd className={`ui-tuile-valeur ui-ton-${c.ton ?? "normal"}`}>
            {c.valeur}
            {c.unite && <span className="ui-unite"> {c.unite}</span>}
          </dd>
          {c.detail && <dd className="ui-tuile-detail">{c.detail}</dd>}
        </div>
      ))}
    </dl>
  );
}
