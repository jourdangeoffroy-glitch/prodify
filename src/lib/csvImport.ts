import { parse } from "csv-parse/sync";
import { v4 as uuid } from "uuid";
import { getDb } from "./db";
import { tagFeedback } from "./tagging";

export const VALID_SOURCES = ["zendesk", "nps", "g2", "slack", "interview", "autre"] as const;
export type Source = (typeof VALID_SOURCES)[number];

const REQUIRED_COLUMNS = ["source", "content", "created_at_source"] as const;
const OPTIONAL_COLUMNS = ["external_id", "author_email", "segment"] as const;
const ALL_COLUMNS = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS];

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 Mo
export const MAX_ROWS = 5000;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ImportRowError {
  line: number; // ligne fichier (1 = premier data row après header)
  reason: string;
}

export interface ImportReport {
  inserted: number;
  duplicates: number;
  errors: ImportRowError[];
  totalRows: number;
}

export class CsvRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvRejectedError";
  }
}

function isValidUtf8(buffer: Buffer): boolean {
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    return true;
  } catch {
    return false;
  }
}

function isValidDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(value + "T00:00:00Z");
  return !Number.isNaN(d.getTime());
}

export async function importCsv(buffer: Buffer): Promise<ImportReport> {
  if (buffer.length === 0) {
    throw new CsvRejectedError("Le fichier est vide.");
  }
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new CsvRejectedError(
      `Fichier trop volumineux (${(buffer.length / 1024 / 1024).toFixed(2)} Mo). Limite : 5 Mo.`
    );
  }
  if (!isValidUtf8(buffer)) {
    throw new CsvRejectedError("Encodage invalide : le fichier doit être en UTF-8.");
  }

  let records: Record<string, string>[];
  try {
    records = parse(buffer, {
      columns: (header: string[]) => header.map((h) => h.trim()),
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });
  } catch (err) {
    throw new CsvRejectedError(
      `CSV illisible : ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (records.length === 0) {
    throw new CsvRejectedError("Le fichier ne contient aucune ligne de données.");
  }
  if (records.length > MAX_ROWS) {
    throw new CsvRejectedError(
      `Trop de lignes (${records.length}). Limite : ${MAX_ROWS} lignes par import.`
    );
  }

  const header = Object.keys(records[0]);
  const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length > 0) {
    throw new CsvRejectedError(
      `Colonne(s) obligatoire(s) manquante(s) dans le header : ${missing.join(", ")}.`
    );
  }
  const unknown = header.filter((h) => !ALL_COLUMNS.includes(h as (typeof ALL_COLUMNS)[number]));
  if (unknown.length > 0) {
    throw new CsvRejectedError(`Colonne(s) inconnue(s) dans le header : ${unknown.join(", ")}.`);
  }

  const db = await getDb();
  const errors: ImportRowError[] = [];
  let inserted = 0;
  let duplicates = 0;
  const insertedIds: string[] = [];

  const tx = await db.transaction();
  try {
    for (let idx = 0; idx < records.length; idx++) {
      const row = records[idx];
      const line = idx + 1;
      const source = row.source?.trim();
      const content = row.content?.trim();
      const createdAtSource = row.created_at_source?.trim();
      const externalId = row.external_id?.trim() || null;
      const authorEmail = row.author_email?.trim() || null;
      const segment = row.segment?.trim() || null;

      if (!source || !VALID_SOURCES.includes(source as Source)) {
        errors.push({
          line,
          reason: `source invalide ou manquante ("${source ?? ""}"). Attendu : ${VALID_SOURCES.join(", ")}.`,
        });
        continue;
      }
      if (!content) {
        errors.push({ line, reason: "content manquant." });
        continue;
      }
      if (!createdAtSource || !isValidDate(createdAtSource)) {
        errors.push({
          line,
          reason: `created_at_source invalide ("${createdAtSource ?? ""}"). Format attendu : YYYY-MM-DD.`,
        });
        continue;
      }
      if (authorEmail && !EMAIL_RE.test(authorEmail)) {
        errors.push({ line, reason: `author_email invalide ("${authorEmail}").` });
        continue;
      }

      const existing = externalId
        ? await tx.execute({
            sql: "SELECT id FROM feedbacks WHERE source = ? AND external_id = ?",
            args: [source, externalId],
          })
        : await tx.execute({
            sql: "SELECT id FROM feedbacks WHERE source = ? AND content = ? AND created_at_source = ?",
            args: [source, content, createdAtSource],
          });
      if (existing.rows.length > 0) {
        duplicates += 1;
        continue;
      }

      const id = uuid();
      const ingestedAt = new Date().toISOString();
      const tags = segment ? { segment } : {};

      await tx.execute({
        sql: `INSERT INTO feedbacks (id, source, external_id, content, author_email, created_at_source, ingested_at, raw_row, tags)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          id,
          source,
          externalId,
          content,
          authorEmail,
          createdAtSource,
          ingestedAt,
          JSON.stringify(row),
          JSON.stringify(tags),
        ],
      });
      insertedIds.push(id);
      inserted += 1;
    }
    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }

  // Tagging automatique (fonctionnalité 3), après commit : ne doit jamais faire
  // échouer l'import lui-même — les erreurs de tagging sont isolées par feedback.
  for (const id of insertedIds) {
    await tagFeedback(id);
  }

  return { inserted, duplicates, errors, totalRows: records.length };
}
