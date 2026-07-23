// Route serveur de l'assistant IA (réservé au compte enseignant).
// POST { message, issue? }  -> crée une issue @claude (ou commente l'existante)
// GET  ?issue=N             -> renvoie la conversation (issue + commentaires)
//
// Gardes, dans l'ordre : fonctionnalité configurée (503), jeton Supabase
// présent (401), rôle enseignant vérifié CÔTÉ SERVEUR (403). Le jeton GitHub
// ne quitte jamais le serveur.
//
// MODE TEST SANS COMPTE (mode-test.ts, temporaire) : les comptes étant
// désactivés, la vérification du rôle est SAUTÉE dans ce mode uniquement —
// l'accès est ouvert le temps de la phase d'évaluation. Remettre le drapeau à
// false referme tout (docs/MAINTENANCE.md, recette 9).

import { NextRequest, NextResponse } from "next/server";
import {
  lireConfigAssistant, verifierProf,
  creerIssue, commenterIssue, lireConversation,
} from "@/lib/assistant";
import { MODE_TEST_SANS_COMPTE } from "@/lib/mode-test";

function jetonDepuis(req: NextRequest): string {
  const h = req.headers.get("authorization") ?? "";
  return h.startsWith("Bearer ") ? h.slice("Bearer ".length) : "";
}

/**
 * Identité de l'appelant : { email } si autorisé, null sinon.
 * Mode test : autorisé sans compte (email null — la provenance dans l'issue
 * l'indiquera comme demande anonyme du site).
 */
async function identiteAutorisee(
  cfg: NonNullable<ReturnType<typeof lireConfigAssistant>>,
  req: NextRequest,
): Promise<{ email: string | null } | null> {
  if (MODE_TEST_SANS_COMPTE) return { email: null };
  return verifierProf(cfg, jetonDepuis(req));
}

export async function POST(req: NextRequest) {
  const cfg = lireConfigAssistant();
  if (!cfg) {
    return NextResponse.json(
      { erreur: "Assistant non configuré sur cette instance (ASSISTANT_GITHUB_TOKEN / ASSISTANT_GITHUB_REPO absents côté serveur)." },
      { status: 503 },
    );
  }
  const prof = await identiteAutorisee(cfg, req);
  if (!prof) {
    return NextResponse.json(
      { erreur: "Accès réservé au compte enseignant." },
      { status: 403 },
    );
  }

  const corps = (await req.json().catch(() => null)) as { message?: string; issue?: number } | null;
  const message = corps?.message?.trim();
  if (!message) {
    return NextResponse.json({ erreur: "Message vide." }, { status: 400 });
  }

  if (corps?.issue) {
    const r = await commenterIssue(cfg, corps.issue, message, prof.email);
    if ("erreur" in r) return NextResponse.json(r, { status: 502 });
    return NextResponse.json({ issue: corps.issue });
  }
  const r = await creerIssue(cfg, message, prof.email);
  if ("erreur" in r) return NextResponse.json(r, { status: 502 });
  return NextResponse.json({ issue: r.numero, url: r.url });
}

export async function GET(req: NextRequest) {
  const cfg = lireConfigAssistant();
  if (!cfg) {
    return NextResponse.json({ erreur: "Assistant non configuré." }, { status: 503 });
  }
  const prof = await identiteAutorisee(cfg, req);
  if (!prof) {
    return NextResponse.json({ erreur: "Accès réservé au compte enseignant." }, { status: 403 });
  }
  const numero = Number(req.nextUrl.searchParams.get("issue"));
  if (!Number.isInteger(numero) || numero <= 0) {
    return NextResponse.json({ erreur: "Numéro de conversation invalide." }, { status: 400 });
  }
  const r = await lireConversation(cfg, numero);
  if ("erreur" in r) return NextResponse.json(r, { status: 502 });
  return NextResponse.json(r);
}
