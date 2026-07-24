// frontend/src/lib/protocole.ts
// Protocoles de laboratoire : procédures éditables (malaxage, cure, essai…) que
// l'enseignant maintient. Chaque gâchée en FIGE un instantané à sa création,
// pour la traçabilité : modifier un protocole plus tard ne réécrit jamais la
// procédure qu'une gâchée passée a réellement suivie. Types + helpers PURS.

export interface Protocole {
  id: string;
  titre: string;
  contenu: string;
  majLe?: string; // ISO — dernière modification
}

/** Instantané figé d'un protocole, rattaché à une gâchée (lecture seule). */
export interface ProtocoleFige {
  titre: string;
  contenu: string;
}

/**
 * Procédures de départ (l'enseignant les adapte à son cours). Gelées : elles
 * servent à la fois de graine (seed) et d'état initial ; une mutation en place
 * corromprait le module partagé — passer par `protocolesDefaut()` pour une
 * copie fraîche et modifiable.
 */
const DEFAUTS: Protocole[] = [
  {
    id: "malaxage",
    titre: "Malaxage",
    contenu:
      "1. Peser le résidu humide, le granulat sec et le(s) liant(s) selon la recette.\n" +
      "2. Homogénéiser les solides à sec (30 s).\n" +
      "3. Ajouter l'eau de gâchage progressivement en malaxant.\n" +
      "4. Malaxer 5 min jusqu'à consistance homogène.\n" +
      "5. Contrôler l'affaissement (slump) et noter la mesure.",
  },
  {
    id: "coulee-cure",
    titre: "Coulée et cure",
    contenu:
      "1. Remplir les moules en trois couches, piquer chaque couche.\n" +
      "2. Araser, identifier l'éprouvette (code de gâchée + numéro).\n" +
      "3. Conserver en chambre humide (température et humidité contrôlées).\n" +
      "4. Démouler après la prise, remettre en cure jusqu'à l'échéance.",
  },
  {
    id: "essai-ucs",
    titre: "Essai de compression (UCS)",
    contenu:
      "1. Sortir l'éprouvette à l'échéance, mesurer diamètre et hauteur.\n" +
      "2. Surfacer si nécessaire pour des faces planes et parallèles.\n" +
      "3. Charger à vitesse constante jusqu'à la rupture.\n" +
      "4. Noter la charge à la rupture et le mode de rupture.\n" +
      "5. Reporter la contrainte (charge / section) dans la gâchée.",
  },
];

export const PROTOCOLES_DEFAUT: readonly Protocole[] = Object.freeze(DEFAUTS.map((p) => Object.freeze(p)));

/** Copie fraîche et MODIFIABLE des procédures de départ (seed / réinitialisation). */
export function protocolesDefaut(): Protocole[] {
  return PROTOCOLES_DEFAUT.map((p) => ({ ...p }));
}

/** Fige les protocoles courants (titre + contenu) pour rattachement à une gâchée. */
export function snapshotProtocoles(protocoles: Protocole[]): ProtocoleFige[] {
  return protocoles
    .filter((p) => p.titre.trim() !== "" || p.contenu.trim() !== "")
    .map((p) => ({ titre: p.titre, contenu: p.contenu }));
}
