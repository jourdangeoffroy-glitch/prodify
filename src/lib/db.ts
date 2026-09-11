import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { TAG_MAPPING, DEFAULT_CHANNEL_TYPE } from "./config/tagMapping";

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, "prodify.db");

declare global {
  // eslint-disable-next-line no-var
  var __prodifyDb: Database.Database | undefined;
}

function init(db: Database.Database) {
  db.pragma("journal_mode = WAL");
  db.exec(`
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
  `);

  // Seed tag_rules from the config file for traceability (source of truth stays the config file).
  const existing = db.prepare("SELECT COUNT(*) as c FROM tag_rules").get() as { c: number };
  if (existing.c === 0) {
    const insert = db.prepare(
      "INSERT INTO tag_rules (id, tag_key, tag_value, condition) VALUES (?, ?, ?, ?)"
    );
    const tx = db.transaction(() => {
      for (const [source, channelType] of Object.entries(TAG_MAPPING)) {
        insert.run(
          `rule-${source}`,
          "channel_type",
          channelType,
          JSON.stringify({ source })
        );
      }
      insert.run(
        "rule-default",
        "channel_type",
        DEFAULT_CHANNEL_TYPE,
        JSON.stringify({ source: "*" })
      );
    });
    tx();
  }
}

export function getDb(): Database.Database {
  if (!global.__prodifyDb) {
    const db = new Database(DB_PATH);
    init(db);
    global.__prodifyDb = db;
  }
  return global.__prodifyDb;
}
