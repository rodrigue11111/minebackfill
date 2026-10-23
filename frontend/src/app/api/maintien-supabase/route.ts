// Tâche planifiée de Vercel (frontend/vercel.json) : une lecture par jour en
// base pour que Supabase ne mette pas le projet en pause. Voir
// lib/maintien-supabase.ts et docs/OPERATIONS.md, « Anti-pause Supabase ».
// Un échec répond 502 ou 503 : il apparaît en rouge dans Vercel (Logs, Crons).

import { NextRequest, NextResponse } from "next/server";
import { nettoyerValeurEnv } from "@/lib/supabase";
import { appelAutorise, maintenirSupabase } from "@/lib/maintien-supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!appelAutorise(process.env.CRON_SECRET?.trim() || undefined, req.headers.get("authorization"))) {
    return NextResponse.json({ ok: false, message: "Non autorisé." }, { status: 401 });
  }
  const r = await maintenirSupabase(
    nettoyerValeurEnv(process.env.NEXT_PUBLIC_SUPABASE_URL),
    nettoyerValeurEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
  if (!r.ok) console.error(`[maintien-supabase] ${r.message}`);
  return NextResponse.json(r, { status: r.ok ? 200 : r.statut === null ? 503 : 502 });
}
