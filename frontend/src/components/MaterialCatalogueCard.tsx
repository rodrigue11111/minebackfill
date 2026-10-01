"use client";

import { Fragment, useRef } from "react";
import { Carte } from "@/components/ui/Carte";
import { Champ } from "@/components/ui/Champ";
import ChampNombre from "@/components/ui/ChampNombre";
import { Pastille } from "@/components/ui/Pastille";
import { Icone } from "@/components/ui/Icones";
import Menu from "@/components/ui/Menu";
import { useStore } from "@/lib/store";
import { completudeCaracterisation, estOfficiel, type ChampCaracterisation, type MaterialKind, type MaterialItem } from "@/lib/materials";
import { materialsVersJson, materialsVersCsv, materialsDepuisFichier } from "@/lib/materials-io";

export interface MaterialColumn {
  key: string;
  label: string;
  type: "text" | "number";
  flex?: number;
}

const SLICE = {
  residus: "catalogue_residus",
  granulats: "catalogue_granulats",
  retardateurs: "catalogue_retardateurs",
} as const;

/**
 * Carte de gestion d'une bibliothèque de matériaux (résidus, granulats,
 * retardateurs). Pilotée par une liste de colonnes pour ne pas dupliquer le
 * rendu. Les entrées « officiel » sont en lecture seule (badge, champs
 * désactivés) ; l'utilisateur ajoute des entrées « perso » modifiables.
 */
export default function MaterialCatalogueCard({ kind, title, sub, columns, caracterisation, adminMode, onPublish }: {
  kind: MaterialKind;
  title: string;
  sub?: string;
  columns: MaterialColumn[];
  /** Champs facultatifs, repliés sous chaque entrée (« Caractérisation : 4/10 »). */
  caracterisation?: ChampCaracterisation[];
  /** Mode enseignant : déverrouille les entrées officielles + bouton Publier. */
  adminMode?: boolean;
  onPublish?: () => void;
}) {
  const store = useStore();
  const items = store[SLICE[kind]] as MaterialItem[];
  const fileRef = useRef<HTMLInputElement>(null);
  const gridCols = columns.map((c) => `${c.flex ?? 1}fr`).join(" ") + " auto";

  const onImport = async (f: File | undefined) => {
    if (!f) return;
    try {
      const imported = await materialsDepuisFichier(kind, f);
      store.importMaterials(kind, imported);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Import impossible.");
    }
  };

  return (
    <Carte titre={title} actions={
      <span className="regl-actions">
        <Menu
          className="btn-discret"
          declencheur={<>Importer, exporter <span className="ui-chevron-bas"><Icone nom="chevron" taille={11} epaisseur={2.4} /></span></>}
          elements={[
            { libelle: "Export CSV", onSelect: () => materialsVersCsv(kind, items) },
            { libelle: "Export JSON", onSelect: () => materialsVersJson(kind, items) },
            { libelle: "Importer…", detail: "Fichier CSV ou JSON", onSelect: () => fileRef.current?.click() },
            "separateur",
            { libelle: "Restaurer valeurs officielles", onSelect: () => store.restoreOfficialMaterials(kind) },
          ]}
        />
        <button type="button" className="btn-secondary" onClick={() => store.addMaterial(kind, adminMode)}>
          Ajouter
        </button>
        {adminMode && onPublish && (
          <button type="button" className="btn-primary" onClick={onPublish}>
            Publier en ligne
          </button>
        )}
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.json,application/json,text/csv"
            style={{ display: "none" }}
            onChange={(e) => { onImport(e.target.files?.[0]); e.target.value = ""; }}
          />
      </span>
    }>
      {sub && <p className="classe-intro">{sub}</p>}

      {/* Défilement horizontal sur écran étroit : les colonnes gardent une
          largeur lisible au lieu d'écraser les champs. */}
      <div className="regl-lignes" style={{ overflowX: "auto" }}>
        {items.map((item, index) => {
          // En mode enseignant, les entrées officielles sont éditables.
          const verrou = estOfficiel(item) && !adminMode;
          const rec = item as unknown as Record<string, unknown>;
          const maj = (patch: Record<string, unknown>) => store.updateMaterial(kind, index, patch as Partial<MaterialItem>, adminMode);
          const fiche = caracterisation ? completudeCaracterisation(item, caracterisation) : null;
          return (
            <Fragment key={item.id}>
            <div
              className="regl-ligne"
              style={{ gridTemplateColumns: gridCols, minWidth: 120 * columns.length + 90 }}
            >
              {columns.map((col) => (
                <Champ key={col.key} libelle={col.label}>
                  <input
                    className="field-input"
                    type={col.type === "number" ? "number" : "text"}
                    step={col.type === "number" ? "any" : undefined}
                    disabled={verrou}
                    value={(rec[col.key] as string | number) ?? ""}
                    onChange={(e) =>
                      store.updateMaterial(kind, index, {
                        [col.key]: col.type === "number" ? Number(e.target.value || 0) : e.target.value,
                      } as Partial<MaterialItem>, adminMode)
                    }
                  />
                </Champ>
              ))}
              <div className="regl-ligne-fin">
                {estOfficiel(item) && <Pastille ton="accent">officiel</Pastille>}
                {!verrou && (
                  <button type="button" className="btn-discret btn-danger" onClick={() => store.deleteMaterial(kind, index, adminMode)}>
                    Supprimer
                  </button>
                )}
              </div>
            </div>
            {caracterisation && fiche && (
              // Facultatif : une case vide reste vide (jamais 0, qui serait une
              // mesure fausse dans le jeu d'essais).
              <details className="regl-caracterisation">
                <summary>
                  Caractérisation <Pastille ton="neutre" title="Champs de caractérisation renseignés (facultatifs)">{fiche.renseignes}/{fiche.total}</Pastille>
                </summary>
                <div className="regl-caracterisation-grille">
                  {caracterisation.map((ch) => (
                    <Champ key={ch.cle} libelle={ch.libelle} unite={ch.unite}>
                      {ch.type === "nombre" ? (
                        <ChampNombre value={rec[ch.cle] as number | undefined} disabled={verrou} ariaLabel={`${ch.libelle} : ${item.nom}`}
                          onChange={(n) => maj({ [ch.cle]: n })} />
                      ) : (
                        <input className="field-input" type={ch.type === "date" ? "date" : "text"} disabled={verrou}
                          value={(rec[ch.cle] as string | undefined) ?? ""}
                          onChange={(e) => maj({ [ch.cle]: e.target.value.trim() === "" ? undefined : e.target.value })} />
                      )}
                    </Champ>
                  ))}
                </div>
              </details>
            )}
            </Fragment>
          );
        })}
        {items.length === 0 && <p className="classe-rien">Aucune entrée.</p>}
      </div>
    </Carte>
  );
}
