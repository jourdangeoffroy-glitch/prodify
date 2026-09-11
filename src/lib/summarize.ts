import { v4 as uuid } from "uuid";
import { getDb } from "./db";
import { callGemini } from "./gemini";

const BATCH_THRESHOLD = 150;
const BATCH_SIZE = 100;

export interface FeedbackRow {
  id: string;
  source: string;
  content: string;
  created_at_source: string;
}

export interface GenerateSummaryInput {
  periodStart: string;
  periodEnd: string;
  sources: string[] | null;
}

export class NoFeedbackInPeriodError extends Error {
  constructor() {
    super("Aucun feedback dans la période sélectionnée.");
    this.name = "NoFeedbackInPeriodError";
  }
}

function fetchFeedbacks(input: GenerateSummaryInput): FeedbackRow[] {
  const db = getDb();
  if (input.sources && input.sources.length > 0) {
    const placeholders = input.sources.map(() => "?").join(",");
    return db
      .prepare(
        `SELECT id, source, content, created_at_source FROM feedbacks
         WHERE created_at_source BETWEEN ? AND ? AND source IN (${placeholders})
         ORDER BY created_at_source ASC`
      )
      .all(input.periodStart, input.periodEnd, ...input.sources) as FeedbackRow[];
  }
  return getDb()
    .prepare(
      `SELECT id, source, content, created_at_source FROM feedbacks
       WHERE created_at_source BETWEEN ? AND ?
       ORDER BY created_at_source ASC`
    )
    .all(input.periodStart, input.periodEnd) as FeedbackRow[];
}

// Anonymisation : author_email n'est jamais inclus dans le payload envoyé au LLM.
function formatFeedbacksForPrompt(rows: FeedbackRow[]): string {
  return rows
    .map((r) => `- [${r.source} | ${r.created_at_source}] ${r.content.replace(/\n/g, " ")}`)
    .join("\n");
}

function buildPrompt(rows: FeedbackRow[], multiSource: boolean): string {
  return `Tu analyses des feedbacks utilisateurs pour une équipe produit SaaS B2B.
Voici ${rows.length} feedbacks (format : [source | date] contenu) :

${formatFeedbacksForPrompt(rows)}

Réponds en français, de façon structurée, avec :
1. Les thèmes principaux qui reviennent (3 à 6 thèmes), chacun avec un volume approximatif
   (nombre de feedbacks concernés).
${multiSource ? "2. Une répartition du volume par source (zendesk, nps, g2, slack, interview, autre).\n" : ""}
Base-toi uniquement sur le contenu fourni ci-dessus, n'invente aucun chiffre qui n'en découle pas.`;
}

function buildHierarchicalPrompt(batchSummaries: string[]): string {
  return `Voici ${batchSummaries.length} résumés partiels de feedbacks utilisateurs, chacun généré
sur un sous-ensemble des mêmes feedbacks pour une même période. Fusionne-les en un seul résumé
cohérent et non redondant, en conservant les thèmes principaux, en additionnant les volumes
par thème quand ils se recoupent, et en gardant la répartition par source si présente.

${batchSummaries.map((s, i) => `--- Résumé partiel ${i + 1} ---\n${s}`).join("\n\n")}

Réponds en français, structuré comme un résumé unique (thèmes + volumes, répartition par source
si pertinente).`;
}

export async function generateSummary(input: GenerateSummaryInput) {
  const rows = fetchFeedbacks(input);
  if (rows.length === 0) throw new NoFeedbackInPeriodError();

  const multiSource = !input.sources || input.sources.length > 1;
  let summaryText: string;

  if (rows.length <= BATCH_THRESHOLD) {
    summaryText = await callGemini(buildPrompt(rows, multiSource));
  } else {
    const batches: FeedbackRow[][] = [];
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      batches.push(rows.slice(i, i + BATCH_SIZE));
    }
    const batchSummaries: string[] = [];
    for (const batch of batches) {
      batchSummaries.push(await callGemini(buildPrompt(batch, multiSource)));
    }
    summaryText = await callGemini(buildHierarchicalPrompt(batchSummaries));
  }

  const db = getDb();
  const id = uuid();
  const generatedAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO summaries (id, period_start, period_end, source_filter, summary_text, feedback_count, generated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.periodStart,
    input.periodEnd,
    input.sources ? JSON.stringify(input.sources) : null,
    summaryText,
    rows.length,
    generatedAt
  );

  return {
    id,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    sourceFilter: input.sources,
    summaryText,
    feedbackCount: rows.length,
    generatedAt,
  };
}
