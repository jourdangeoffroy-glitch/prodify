import { getDb } from "./db";
import { resolveChannelType } from "./config/tagMapping";
import { v4 as uuid } from "uuid";

export type Tags = Record<string, string>;

/**
 * Calcule les tags automatiques pour un feedback (fonctionnalité 3).
 * Idempotent : appelée plusieurs fois sur le même feedback, elle produit
 * toujours le même triplet {source, channel_type, ingestion_date} — le
 * merge dans la colonne tags jsonb ne crée donc jamais de doublon.
 */
function computeAutoTags(feedback: {
  source: string;
  ingested_at: string;
}): Tags {
  return {
    source: feedback.source,
    channel_type: resolveChannelType(feedback.source),
    ingestion_date: feedback.ingested_at.slice(0, 10),
  };
}

/**
 * Applique le tagging automatique à un feedback déjà inséré.
 * Ne doit jamais faire échouer l'insertion : toute erreur est loggée dans
 * tagging_errors pour audit, le feedback brut reste en base tel quel.
 */
export async function tagFeedback(feedbackId: string): Promise<void> {
  const db = await getDb();
  try {
    const result = await db.execute({
      sql: "SELECT source, ingested_at, tags FROM feedbacks WHERE id = ?",
      args: [feedbackId],
    });
    const row = result.rows[0] as unknown as
      | { source: string; ingested_at: string; tags: string }
      | undefined;
    if (!row) throw new Error("feedback introuvable");

    const existingTags: Tags = JSON.parse(row.tags || "{}");
    const autoTags = computeAutoTags(row);
    const merged: Tags = { ...existingTags, ...autoTags };

    await db.execute({
      sql: "UPDATE feedbacks SET tags = ? WHERE id = ?",
      args: [JSON.stringify(merged), feedbackId],
    });
  } catch (err) {
    await db.execute({
      sql: "INSERT INTO tagging_errors (id, feedback_id, error, created_at) VALUES (?, ?, ?, ?)",
      args: [uuid(), feedbackId, String(err), new Date().toISOString()],
    });
  }
}
