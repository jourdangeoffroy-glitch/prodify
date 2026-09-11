import { NextResponse } from "next/server";

/**
 * Garantit qu'une route API renvoie toujours du JSON, même en cas d'erreur
 * inattendue (ex : connexion Turso indisponible) — sans ça, Next.js peut
 * renvoyer une réponse vide/HTML que le frontend ne sait pas parser.
 */
export function toErrorResponse(err: unknown) {
  console.error(err);
  return NextResponse.json(
    { error: `Erreur serveur inattendue : ${err instanceof Error ? err.message : String(err)}` },
    { status: 500 }
  );
}
