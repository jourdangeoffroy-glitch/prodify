import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);

  const rows = db
    .prepare(
      "SELECT id, source, external_id, content, author_email, created_at_source, ingested_at, tags FROM feedbacks ORDER BY ingested_at DESC LIMIT 500"
    )
    .all() as Array<{
    id: string;
    source: string;
    external_id: string | null;
    content: string;
    author_email: string | null;
    created_at_source: string;
    ingested_at: string;
    tags: string;
  }>;

  // Filtre par tags combinés : ?tag_channel_type=support&tag_segment=enterprise
  const tagFilters: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    if (key.startsWith("tag_")) tagFilters[key.slice(4)] = value;
  }

  const parsed = rows.map((r) => ({ ...r, tags: JSON.parse(r.tags || "{}") }));
  const filtered =
    Object.keys(tagFilters).length === 0
      ? parsed
      : parsed.filter((r) =>
          Object.entries(tagFilters).every(([k, v]) => r.tags[k] === v)
        );

  return NextResponse.json({ feedbacks: filtered });
}
