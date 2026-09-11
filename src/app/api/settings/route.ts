import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isGeminiConfigured } from "@/lib/gemini";

export async function GET() {
  return NextResponse.json({ configured: await isGeminiConfigured() });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
  if (!apiKey) {
    return NextResponse.json({ error: "Clé API vide." }, { status: 400 });
  }

  const db = await getDb();
  await db.execute({
    sql: `INSERT INTO app_settings (key, value) VALUES ('gemini_api_key', ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    args: [apiKey],
  });

  // La valeur n'est jamais renvoyée au frontend, uniquement l'état booléen.
  return NextResponse.json({ configured: true });
}
