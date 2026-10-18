// Parcours d'un calcul (lib/parcours.ts) : les cinq étapes du Guide, l'étape
// en cours marquée. Les étapes passées et à venir restent des liens.

import Link from "next/link";
import { PARCOURS } from "@/lib/parcours";

export default function Parcours({ courante }: { courante: number }) {
  return (
    <nav aria-label="Étapes d'un calcul" className="parcours">
      <ol>
        {PARCOURS.map((e) => {
          const etat = e.n === courante ? "parcours-actuelle" : e.n < courante ? "parcours-faite" : "parcours-a-venir";
          return (
            <li key={e.n} className={etat}>
              <Link href={e.href} title={e.detail} aria-current={e.n === courante ? "step" : undefined}>
                <span className="parcours-n" aria-hidden="true">{e.n}</span>
                {e.libelle}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
