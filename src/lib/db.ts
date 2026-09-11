import { createClient, type Client } from "@libsql/client";
import path from "path";
import fs from "fs";
import { TAG_MAPPING, DEFAULT_CHANNEL_TYPE } from "./config/tagMapping";

declare global {
  // eslint-disable-next-line no-var
  var __prodifyDb: Client | undefined;
  // eslint-disable-next-line no-var
  var __prodifyDbReady: Promise<void> | undefined;
}

function buildClient(): Client {
  const url = process.env.TURSO_DATABASE_URL;
  if (url) {
    return createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  }
  // Pas de Turso configuré : fichier SQLite local (dev uniquement, non persistant sur serverless).
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  return createClient({ url: `file:${path.join(dataDir, "prodify.db")}` });
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS feedbacks (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    external_id TEXT,
    content TEXT NOT NULL,
    author_email TEXT,
    created_at_source TEXT NOT NULL,
    ingested_at TEXT NOT NULL,
    raw_row TEXT,
    tags TEXT NOT NULL DEFAULT '{}'
  );

  CREATE INDEX IF NOT EXISTS idx_feedbacks_source_external
    ON feedbacks(source, external_id);
  CREATE INDEX IF NOT EXISTS idx_feedbacks_dedup
    ON feedbacks(source, content, created_at_source);
  CREATE INDEX IF NOT EXISTS idx_feedbacks_created_at_source
    ON feedbacks(created_at_source);

  CREATE TABLE IF NOT EXISTS summaries (
    id TEXT PRIMARY KEY,
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    source_filter TEXT,
    summary_text TEXT NOT NULL,
    feedback_count INTEGER NOT NULL,
    generated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tag_rules (
    id TEXT PRIMARY KEY,
    tag_key TEXT NOT NULL,
    tag_value TEXT NOT NULL,
    condition TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tagging_errors (
    id TEXT PRIMARY KEY,
    feedback_id TEXT NOT NULL,
    error TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`;

async function init(db: Client) {
  await db.executeMultiple(SCHEMA);

  // Seed tag_rules depuis le fichier de config, pour traçabilité (source de vérité = le fichier).
  const existing = await db.execute("SELECT COUNT(*) as c FROM tag_rules");
  const count = Number(existing.rows[0]?.c ?? 0);
  if (count === 0) {
    const tx = await db.transaction();
    try {
      for (const [source, channelType] of Object.entries(TAG_MAPPING)) {
        await tx.execute({
          sql: "INSERT INTO tag_rules (id, tag_key, tag_value, condition) VALUES (?, ?, ?, ?)",
          args: [`rule-${source}`, "channel_type", channelType, JSON.stringify({ source })],
        });
      }
      await tx.execute({
        sql: "INSERT INTO tag_rules (id, tag_key, tag_value, condition) VALUES (?, ?, ?, ?)",
        args: ["rule-default", "channel_type", DEFAULT_CHANNEL_TYPE, JSON.stringify({ source: "*" })],
      });
      await tx.commit();
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  }
}

export async function getDb(): Promise<Client> {
  if (!global.__prodifyDb) {
    global.__prodifyDb = buildClient();
    global.__prodifyDbReady = init(global.__prodifyDb);
  }
  await global.__prodifyDbReady;
  return global.__prodifyDb;
}
