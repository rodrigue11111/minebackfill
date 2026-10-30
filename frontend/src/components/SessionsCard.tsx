"use client";

import { useState } from "react";
import { Carte } from "@/components/ui/Carte";
import { ListeGroupee, LigneListe } from "@/components/ui/Liste";
import { useStore } from "@/lib/store";
import { erreursSession, sessionActive, type Session } from "@/lib/sessions";
import { Bandeau } from "@/components/ui/Bandeau";

/** « 1er septembre 2026 » : date d'une session, lisible (2026-10-29). */
export function dateSession(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const mois = d.toLocaleDateString("fr-CA", { month: "long" });
  return `${d.getDate() === 1 ? "1er" : d.getDate()} ${mois} ${d.getFullYear()}`;
}

/**
 * Carte « Sessions de cours » des Réglages. L'enseignant définit les sessions
 * (Automne 2026, Hiver 2027…) et les publie : chaque résultat et chaque gâchée
 * créés pendant une session la portent, ce qui range le travail d'une année
 * à l'autre. Les étudiants voient la liste publiée, sans la modifier.
 *
 * L'édition se fait sur un BROUILLON : une session à moitié saisie (id vide,
 * date incomplète) ne doit pas disparaître pendant qu'on tape.
 */
export default function SessionsCard({ vueAdmin, peutPublier, onPublier }: {
  vueAdmin: boolean;
  peutPublier: boolean;
  onPublier: (sessions: Session[]) => void;
}) {
  const sessions = useStore((s) => s.sessions);
  const definirSessions = useStore((s) => s.definirSessions);
  const [brouillon, setBrouillon] = useState<Session[] | null>(null);
  const liste = brouillon ?? sessions;
  // 2026-10-29 : la session active suit la liste AFFICHÉE ; pendant l'édition,
  // c'est celle qui le sera après l'enregistrement (la carte montrait la
  // session enregistrée à côté d'une liste vidée, sans le dire).
  const enEdition = brouillon !== null;
  const active = sessionActive(liste.filter((x) => erreursSession(x).length === 0), new Date());

  if (!vueAdmin && sessions.length === 0) return null;

  const modifier = (i: number, patch: Partial<Session>) =>
    setBrouillon(liste.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const ajouter = () => {
    const an = new Date().getFullYear();
    const jour = new Date().toISOString().slice(0, 10);
    setBrouillon([...liste, { id: `S${an}-${liste.length + 1}`, nom: `Session ${an}`, debut: jour, fin: jour }]);
  };
  const erreurs = liste.map(erreursSession);
  const valide = erreurs.every((e) => e.length === 0) && new Set(liste.map((s) => s.id)).size === liste.length;

  const champ: React.CSSProperties = { minHeight: 38, padding: "6px 12px", fontSize: 14, width: "auto" };

  return (
    <Carte titre="Sessions de cours" actions={vueAdmin && peutPublier && brouillon === null && sessions.length > 0 ? (
      <button type="button" className="btn-secondary" onClick={() => onPublier(sessions)}>
        Publier en ligne
      </button>
    ) : undefined}>
      <p className="classe-intro">
        Chaque résultat et chaque gâchée créés pendant une session la portent : Mes calculs,
        le Labo et le tableau de bord de la classe se filtrent par session, d&apos;une année à
        l&apos;autre. Le travail antérieur est rangé d&apos;après sa date ; hors de toute session, il
        apparaît « Sans session ».
        {active
          ? <> Session active aujourd&apos;hui{enEdition ? " après l'enregistrement" : ""} : <strong>{active.nom}</strong>.</>
          : enEdition ? " Aucune session active aujourd'hui après l'enregistrement." : " Aucune session active aujourd'hui."}
        {vueAdmin && " « Publier en ligne » envoie la liste aux étudiants : leurs nouveaux calculs et gâchées portent alors la session active."}
      </p>
      {enEdition && (
        <Bandeau ton="alerte" role="status" titre="Modifications non enregistrées.">
          Cliquez sur « Enregistrer » pour les garder, ou sur « Annuler » pour revenir à la liste enregistrée.
        </Bandeau>
      )}

      {liste.length === 0 ? (
        <p className="classe-rien">Aucune session définie.</p>
      ) : !vueAdmin ? (
        <ListeGroupee encadree>
          {liste.map((s, i) => (
            <LigneListe key={i} libelle={s.nom} valeur={`du ${dateSession(s.debut)} au ${dateSession(s.fin)}`} />
          ))}
        </ListeGroupee>
      ) : (
        <div className="regl-lignes">
          {liste.map((s, i) => (
            <div key={i} className="regl-session">
              {vueAdmin && (
                <div className="regl-session-champs">
                  <input className="field-input" style={{ ...champ, width: 120 }} value={s.id} aria-label="Identifiant"
                    onChange={(e) => modifier(i, { id: e.target.value.trim() })} />
                  <input className="field-input" style={{ ...champ, flex: "1 1 160px" }} value={s.nom} aria-label="Nom"
                    onChange={(e) => modifier(i, { nom: e.target.value })} />
                  <label className="ui-filtre">du{" "}
                    <input type="date" className="field-input" style={champ} value={s.debut} onChange={(e) => modifier(i, { debut: e.target.value })} />
                  </label>
                  <label className="ui-filtre">au{" "}
                    <input type="date" className="field-input" style={champ} value={s.fin} onChange={(e) => modifier(i, { fin: e.target.value })} />
                  </label>
                  <button type="button" className="btn-discret btn-danger"
                    onClick={() => setBrouillon(liste.filter((_, j) => j !== i))}>
                    Retirer
                  </button>
                </div>
              )}
              {erreurs[i].length > 0 && (
                <div className="ui-champ-erreur">{erreurs[i].join(" ")}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {vueAdmin && (
        <div className="regl-actions">
          <button type="button" className="btn-secondary" onClick={ajouter}>Ajouter une session</button>
          {brouillon !== null && (
            <>
              <button type="button" className="btn-primary" disabled={!valide}
                onClick={() => { definirSessions(brouillon); setBrouillon(null); }}>
                Enregistrer
              </button>
              <button type="button" className="btn-secondary" onClick={() => setBrouillon(null)}>
                Annuler
              </button>
              {!valide && <span className="ui-champ-erreur">Corrigez les erreurs (identifiants uniques).</span>}
            </>
          )}
        </div>
      )}
    </Carte>
  );
}
