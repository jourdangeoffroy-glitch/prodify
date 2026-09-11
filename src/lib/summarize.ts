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

async function fetchFeedbacks(input: GenerateSummaryInput): Promise<FeedbackRow[]> {
  const db = await getDb();
  if (input.sources && input.sources.length > 0) {
    const placeholders = input.sources.map(() => "?").join(",");
    const result = await db.execute({
      sql: `SELECT id, source, content, created_at_source FROM feedbacks
            WHERE created_at_source BETWEEN ? AND ? AND source IN (${placeholders})
            ORDER BY created_at_source ASC`,
      args: [input.periodStart, input.periodEnd, ...input.sources],
    });
    return result.rows as unknown as FeedbackRow[];
  }
  const result = await db.execute({
    sql: `SELECT id, source, content, created_at_source FROM feedbacks
          WHERE created_at_source BETWEEN ? AND ?
          ORDER BY created_at_source ASC`,
    args: [input.periodStart, input.periodEnd],
  });
  return result.rows as unknown as FeedbackRow[];
}

interface SummaryFacts {
  periodStart: string;
  periodEnd: string;
  total: number;
  perSource: Record<string, number>;
}

/**
 * Chiffres calculés en base, pas par le LLM : la période et les volumes sont
 * injectés comme faits dans le prompt et doivent être repris tels quels, pour
 * éviter que le modèle n'invente des comptages (critère de succès 6 du cadrage).
 */
function computeFacts(input: GenerateSummaryInput, rows: FeedbackRow[]): SummaryFacts {
  const perSource: Record<string, number> = {};
  for (const row of rows) {
    perSource[row.source] = (perSource[row.source] ?? 0) + 1;
  }
  return {
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    total: rows.length,
    perSource,
  };
}

function formatFacts(facts: SummaryFacts): string {
  const perSource = Object.entries(facts.perSource)
    .sort((a, b) => b[1] - a[1])
    .map(([source, count]) => `  - ${source} : ${count}`)
    .join("\n");
  return `- Période analysée : du ${facts.periodStart} au ${facts.periodEnd}
- Nombre de feedbacks analysés : ${facts.total}
- Répartition par source :
${perSource}`;
}

// Anonymisation : author_email n'est jamais inclus dans le payload envoyé au LLM.
function formatFeedbacksForPrompt(rows: FeedbackRow[]): string {
  return rows
    .map((r) => `- [${r.source} | ${r.created_at_source}] ${r.content.replace(/\n/g, " ")}`)
    .join("\n");
}

const OUTPUT_STRUCTURE = `PÉRIODE ANALYSÉE
(reprends exactement les dates fournies dans les faits vérifiés)

NOMBRE DE FEEDBACKS ANALYSÉS
(reprends exactement le total fourni dans les faits vérifiés, puis la répartition par source)

FONCTIONNALITÉS PRINCIPALES CONCERNÉES
Liste les fonctionnalités ou zones du produit visées par les remontées (ex : export de données,
tableau de bord, intégrations, facturation, authentification, performance…). Pour chacune :
son nom, le nombre de feedbacks qui la concernent, et une phrase sur la nature du problème
ou de la demande. Classe-les de la plus citée à la moins citée.

THÈMES RÉCURRENTS
3 à 6 thèmes transverses, chacun avec le nombre de feedbacks concernés.

POINTS SAILLANTS
2 à 4 phrases sur ce qu'une équipe produit devrait retenir en priorité.`;

function buildSinglePrompt(
  facts: SummaryFacts,
  rows: FeedbackRow[]
): string {
  return `Tu analyses des feedbacks utilisateurs pour une équipe produit SaaS B2B.

FAITS VÉRIFIÉS (calculés en base de données, à reprendre tels quels, ne jamais les recalculer) :
${formatFacts(facts)}

FEEDBACKS (format : [source | date] contenu) :
${formatFeedbacksForPrompt(rows)}

Réponds en français, en texte brut (pas de markdown, pas de ## ni de **), en suivant
exactement cette structure de sections :

${OUTPUT_STRUCTURE}

Règles : les seuls chiffres de période et de volume total autorisés sont ceux des faits vérifiés.
Pour les volumes par fonctionnalité et par thème, compte réellement les feedbacks concernés
ci-dessus ; n'invente aucun chiffre et ne cite aucune fonctionnalité absente des feedbacks.`;
}

function buildBatchPrompt(rows: FeedbackRow[]): string {
  return `Tu analyses un sous-ensemble de feedbacks utilisateurs d'une équipe produit SaaS B2B.

FEEDBACKS (${rows.length} au total dans ce lot, format : [source | date] contenu) :
${formatFeedbacksForPrompt(rows)}

Réponds en français de façon factuelle et compacte, avec :
1. Les fonctionnalités ou zones produit concernées, chacune avec le nombre de feedbacks du lot
   qui la mentionnent.
2. Les thèmes récurrents, chacun avec le nombre de feedbacks du lot concernés.
3. La répartition du lot par source.

Ne compte que les feedbacks de ce lot, n'invente aucun chiffre.`;
}

function buildHierarchicalPrompt(facts: SummaryFacts, batchSummaries: string[]): string {
  return `Voici ${batchSummaries.length} analyses partielles portant chacune sur un lot distinct
d'un même ensemble de feedbacks utilisateurs. Fusionne-les en une analyse unique et non
redondante, en additionnant les volumes quand une fonctionnalité ou un thème apparaît dans
plusieurs lots.

FAITS VÉRIFIÉS pour l'ensemble (calculés en base de données, à reprendre tels quels) :
${formatFacts(facts)}

${batchSummaries.map((s, i) => `--- Analyse partielle ${i + 1} ---\n${s}`).join("\n\n")}

Réponds en français, en texte brut (pas de markdown, pas de ## ni de **), en suivant
exactement cette structure de sections :

${OUTPUT_STRUCTURE}

Règles : la période et le nombre total de feedbacks sont ceux des faits vérifiés. La somme des
volumes par fonctionnalité ne doit jamais dépasser ce total. N'invente aucun chiffre.`;
}

export async function generateSummary(input: GenerateSummaryInput) {
  const rows = await fetchFeedbacks(input);
  if (rows.length === 0) throw new NoFeedbackInPeriodError();

  const facts = computeFacts(input, rows);
  let summaryText: string;

  if (rows.length <= BATCH_THRESHOLD) {
    summaryText = await callGemini(buildSinglePrompt(facts, rows));
  } else {
    const batches: FeedbackRow[][] = [];
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      batches.push(rows.slice(i, i + BATCH_SIZE));
    }
    const batchSummaries: string[] = [];
    for (const batch of batches) {
      batchSummaries.push(await callGemini(buildBatchPrompt(batch)));
    }
    summaryText = await callGemini(buildHierarchicalPrompt(facts, batchSummaries));
  }

  const db = await getDb();
  const id = uuid();
  const generatedAt = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO summaries (id, period_start, period_end, source_filter, summary_text, feedback_count, generated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      input.periodStart,
      input.periodEnd,
      input.sources ? JSON.stringify(input.sources) : null,
      summaryText,
      rows.length,
      generatedAt,
    ],
  });

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
