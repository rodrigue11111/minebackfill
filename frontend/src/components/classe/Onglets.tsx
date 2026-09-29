// Barre d'onglets du tableau de bord de l'enseignant.

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
    <div role="tablist" style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
      {onglets.map((o) => {
        const choisi = o.cle === actif;
        return (
          <button key={o.cle} type="button" role="tab" aria-selected={choisi} onClick={() => onChoisir(o.cle)}
            style={{
              background: "none", border: "none", cursor: "pointer", padding: "9px 14px", fontSize: 13.5,
              fontWeight: choisi ? 700 : 500, color: choisi ? "var(--primary)" : "#475569",
              borderBottom: `2px solid ${choisi ? "var(--primary)" : "transparent"}`, marginBottom: -1,
            }}>
            {o.label}
            {o.compte ? (
              <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, background: choisi ? "#dbeafe" : "#f1f5f9", color: choisi ? "#1e40af" : "#475569", borderRadius: 999, padding: "1px 7px" }}>{o.compte}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
