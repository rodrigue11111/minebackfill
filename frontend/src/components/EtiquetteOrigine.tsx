// Origine d'une entrée de bibliothèque (liants, résidus, granulats,
// retardateurs). « officiel » seul laissait deviner un autre type sans le
// nommer (2026-10-30) : l'entrée personnelle a maintenant son étiquette.

import { Pastille } from "@/components/ui/Pastille";

export default function EtiquetteOrigine({ officiel }: { officiel: boolean }) {
  return officiel
    ? <Pastille ton="accent" title="Fournie par l'enseignant à la classe : verrouillée chez les étudiants.">officiel</Pastille>
    : <Pastille ton="neutre" title="Ajoutée sur cet appareil : modifiable, elle n'est pas publiée à la classe.">personnel</Pastille>;
}
