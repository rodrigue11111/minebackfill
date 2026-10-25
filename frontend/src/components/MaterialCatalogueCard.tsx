"use client";

import { Fragment, useRef, useState } from "react";
import { Carte } from "@/components/ui/Carte";
import { Champ } from "@/components/ui/Champ";
import ChampNombre from "@/components/ui/ChampNombre";
import { Pastille } from "@/components/ui/Pastille";
import { Icone } from "@/components/ui/Icones";
import Menu from "@/components/ui/Menu";
import { useStore } from "@/lib/store";
import { completudeCaracterisation, estOfficiel, type ChampCaracterisation, type MaterialKind, type MaterialItem } from "@/lib/materials";
import { materialsVersJson, materialsVersCsv, materialsDepuisFichier } from "@/lib/materials-io";

/** Bornes physiques d'une valeur saisie : hors bornes, rien n'est écrit (ChampNombre). */
export interface BorneSaisie {
  min: number;
  minExclusif?: boolean;
  max?: number;
  message: string;
}

export interface MaterialColumn {
  key: string;
  label: string;
  type: "text" | "number";
  flex?: number;
  /** Colonne numérique : bornes physiques (audit des valeurs impossibles, 2026-10-25). */
  borne?: BorneSaisie;
}

/** Caractérisation : un pourcentage est entre 0 et 100, une taille de grain est positive. */
export function borneCaracterisation(ch: ChampCaracterisation): BorneSaisie | undefined {
  if (ch.unite === "%") return { min: 0, max: 100, message: "Un pourcentage est compris entre 0 et 100 %." };
  if (ch.unite === "µm" || ch.unite === "mm") return { min: 0, minExclusif: true, message: "Une taille de grain est strictement positive." };
  return undefined;
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
  // Saisie refusée en cours (valeur impossible), par « id:champ ».
  const [refus, setRefus] = useState<Record<string, string | null>>({});
  const surRefus = (cle: string) => (m: string | null) => setRefus((r) => ({ ...r, [cle]: m }));
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
                <Champ key={col.key} libelle={col.label} erreur={refus[`${item.id}:${col.key}`] ?? undefined}>
                  {col.type === "number" ? (
                    // Virgule ou point acceptés ; une valeur hors bornes n'est pas écrite.
                    <ChampNombre value={rec[col.key] as number | undefined} disabled={verrou} ariaLabel={`${col.label} : ${item.nom}`}
                      min={col.borne?.min} minExclusif={col.borne?.minExclusif} max={col.borne?.max} messageRefus={col.borne?.message}
                      onRefus={surRefus(`${item.id}:${col.key}`)}
                      onChange={(n) => { if (n !== undefined) maj({ [col.key]: n }); }} />
                  ) : (
                    <input
                      className="field-input"
                      type="text"
                      disabled={verrou}
                      value={(rec[col.key] as string | number) ?? ""}
                      onChange={(e) => maj({ [col.key]: e.target.value })}
                    />
                  )}
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
                  {caracterisation.map((ch) => {
                    const borne = borneCaracterisation(ch);
                    return (
                    <Champ key={ch.cle} libelle={ch.libelle} unite={ch.unite} erreur={refus[`${item.id}:${ch.cle}`] ?? undefined}>
                      {ch.type === "nombre" ? (
                        <ChampNombre value={rec[ch.cle] as number | undefined} disabled={verrou} ariaLabel={`${ch.libelle} : ${item.nom}`}
                          min={borne?.min} minExclusif={borne?.minExclusif} max={borne?.max} messageRefus={borne?.message}
                          onRefus={surRefus(`${item.id}:${ch.cle}`)}
                          onChange={(n) => maj({ [ch.cle]: n })} />
                      ) : (
                        <input className="field-input" type={ch.type === "date" ? "date" : "text"} disabled={verrou}
                          value={(rec[ch.cle] as string | undefined) ?? ""}
                          onChange={(e) => maj({ [ch.cle]: e.target.value.trim() === "" ? undefined : e.target.value })} />
                      )}
                    </Champ>
                    );
                  })}
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
