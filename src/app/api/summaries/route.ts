import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { generateSummary, NoFeedbackInPeriodError } from "@/lib/summarize";
import { GeminiApiError, GeminiNotConfiguredError } from "@/lib/gemini";

export async function GET() {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT id, period_start, period_end, source_filter, summary_text, feedback_count, generated_at FROM summaries ORDER BY generated_at DESC"
    )
    .all();
  return NextResponse.json({ summaries: rows });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const periodStart = body?.periodStart;
  const periodEnd = body?.periodEnd;
  const sources: string[] | null = Array.isArray(body?.sources) && body.sources.length > 0 ? body.sources : null;

  if (!periodStart || !periodEnd) {
    return NextResponse.json({ error: "Période (début et fin) requise." }, { status: 400 });
  }
  if (periodStart > periodEnd) {
    return NextResponse.json({ error: "La date de début doit précéder la date de fin." }, { status: 400 });
  }

  try {
    const summary = await generateSummary({ periodStart, periodEnd, sources });
    return NextResponse.json({ summary });
  } catch (err) {
    if (err instanceof NoFeedbackInPeriodError) {
      return NextResponse.json({ error: err.message, code: "NO_FEEDBACK" }, { status: 422 });
    }
    if (err instanceof GeminiNotConfiguredError) {
      return NextResponse.json(
        { error: "Aucune clé API Gemini configurée.", code: "NOT_CONFIGURED" },
        { status: 412 }
      );
    }
    if (err instanceof GeminiApiError) {
      return NextResponse.json({ error: err.message, code: "GEMINI_ERROR" }, { status: 502 });
    }
    return NextResponse.json(
      { error: `Erreur inattendue : ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
