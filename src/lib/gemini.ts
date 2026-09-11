import { getDb } from "./db";

// Google retire régulièrement ses anciens modèles : surchargeable par la variable
// d'environnement GEMINI_MODEL, sans changement de code.
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export async function getGeminiApiKey(): Promise<string | null> {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const db = await getDb();
  const result = await db.execute("SELECT value FROM app_settings WHERE key = 'gemini_api_key'");
  const row = result.rows[0] as unknown as { value: string } | undefined;
  return row?.value ?? null;
}

export async function isGeminiConfigured(): Promise<boolean> {
  return !!(await getGeminiApiKey());
}

export class GeminiNotConfiguredError extends Error {
  constructor() {
    super("Aucune clé API Gemini configurée.");
    this.name = "GeminiNotConfiguredError";
  }
}

export class GeminiApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "GeminiApiError";
    this.status = status;
  }
}

/**
 * Appelle l'API Gemini (generateContent) avec un prompt texte et renvoie le texte généré.
 * C'est l'appel réseau réel décrit dans la fonctionnalité 2 du prompt PRODIFY.
 */
export async function callGemini(prompt: string): Promise<string> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) throw new GeminiNotConfiguredError();

  let response: Response;
  try {
    response = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
      signal: AbortSignal.timeout(45000),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new GeminiApiError(
        "Délai dépassé en attendant la réponse de Gemini (timeout 45s). Réessayez."
      );
    }
    throw new GeminiApiError(
      `Impossible de joindre l'API Gemini : ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (response.status === 429) {
    throw new GeminiApiError(
      "Limite de requêtes Gemini atteinte (free tier). Réessayez dans quelques minutes.",
      429
    );
  }
  if (response.status === 400) {
    const body = await response.text();
    throw new GeminiApiError(
      `Clé API Gemini invalide ou requête rejetée (400) : ${body.slice(0, 200)}`,
      400
    );
  }
  if (response.status === 404) {
    const body = await response.text();
    throw new GeminiApiError(
      `Le modèle "${GEMINI_MODEL}" n'est pas disponible sur cette clé API. Définissez la variable d'environnement GEMINI_MODEL avec un modèle valide. Réponse de Google : ${body.slice(0, 300)}`,
      404
    );
  }
  if (!response.ok) {
    const body = await response.text();
    throw new GeminiApiError(
      `Erreur API Gemini (${response.status}) : ${body.slice(0, 200)}`,
      response.status
    );
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new GeminiApiError("Réponse Gemini vide ou dans un format inattendu.");
  }
  return text as string;
}
