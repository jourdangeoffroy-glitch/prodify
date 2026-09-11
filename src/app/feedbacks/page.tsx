"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Filter, RefreshCw, Search } from "lucide-react";
import PageHeader from "@/components/PageHeader";

interface Feedback {
  id: string;
  source: string;
  external_id: string | null;
  content: string;
  author_email: string | null;
  created_at_source: string;
  ingested_at: string;
  tags: Record<string, string>;
}

const SOURCES = ["zendesk", "nps", "g2", "slack", "interview", "autre"];
const CHANNEL_TYPES = ["support", "declaratif", "qualitatif", "non_classe"];

const LABELS: Record<string, string> = {
  zendesk: "Zendesk",
  nps: "NPS",
  g2: "G2",
  slack: "Slack",
  interview: "Interview",
  autre: "Autre",
  support: "Support",
  declaratif: "Déclaratif",
  qualitatif: "Qualitatif",
  non_classe: "Non classé",
};

const label = (value: string) => LABELS[value] ?? value;

export default function FeedbacksPage() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [segmentFilter, setSegmentFilter] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadFeedbacks = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (sourceFilter) params.set("tag_source", sourceFilter);
    if (channelFilter) params.set("tag_channel_type", channelFilter);
    if (segmentFilter.trim()) params.set("tag_segment", segmentFilter.trim());

    fetch(`/api/feedbacks?${params.toString()}`)
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (!r.ok || !data) throw new Error(data?.error || `Erreur serveur (${r.status}).`);
        return data;
      })
      .then((d) => setFeedbacks(d.feedbacks))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Impossible de charger les feedbacks.")
      )
      .finally(() => setLoading(false));
  }, [sourceFilter, channelFilter, segmentFilter]);

  useEffect(loadFeedbacks, [loadFeedbacks]);

  const query = search.trim().toLowerCase();
  const visible = query
    ? feedbacks.filter((f) => f.content.toLowerCase().includes(query))
    : feedbacks;

  const activeFilters = [channelFilter, segmentFilter.trim()].filter(Boolean).length;

  return (
    <div>
      <PageHeader
        title="Feedbacks"
        subtitle={loading ? "Chargement…" : `${visible.length} feedbacks au total`}
      />

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-64">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400"
            aria-hidden
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher dans le contenu…"
            aria-label="Rechercher dans le contenu"
            className="w-full rounded-xl border border-neutral-200 bg-white pl-11 pr-4 py-2.5 text-sm outline-none focus:border-ol-blue"
          />
        </div>

        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          aria-label="Filtrer par source"
          className="rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-ol-blue"
        >
          <option value="">Toutes les sources</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
        </select>

        <div className="relative">
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
            className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm hover:border-neutral-300"
          >
            <Filter className="h-4 w-4 text-neutral-500" aria-hidden />
            Filtrer par tag
            {activeFilters > 0 && (
              <span className="rounded-full bg-ol-blue px-1.5 text-xs text-white">
                {activeFilters}
              </span>
            )}
            <ChevronDown className="h-4 w-4 text-neutral-400" aria-hidden />
          </button>

          {filtersOpen && (
            <div className="absolute right-0 z-10 mt-2 w-64 rounded-xl border border-neutral-200 bg-white p-4 shadow-lg">
              <label className="block text-xs font-medium text-neutral-600 mb-1">
                channel_type
              </label>
              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
                className="mb-3 w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
              >
                <option value="">Tous</option>
                {CHANNEL_TYPES.map((c) => (
                  <option key={c} value={c}>
                    {label(c)}
                  </option>
                ))}
              </select>

              <label className="block text-xs font-medium text-neutral-600 mb-1">segment</label>
              <input
                value={segmentFilter}
                onChange={(e) => setSegmentFilter(e.target.value)}
                placeholder="ex : enterprise"
                className="w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
              />

              <button
                onClick={() => {
                  setChannelFilter("");
                  setSegmentFilter("");
                }}
                className="mt-3 text-xs text-neutral-500 hover:text-ol-blue"
              >
                Réinitialiser
              </button>
            </div>
          )}
        </div>

        <button
          onClick={loadFeedbacks}
          aria-label="Rafraîchir la liste"
          className="rounded-xl border border-neutral-200 bg-white p-2.5 hover:border-neutral-300"
        >
          <RefreshCw
            className={`h-4 w-4 text-neutral-500 ${loading ? "animate-spin" : ""}`}
            aria-hidden
          />
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-ol-red/30 bg-ol-red/5 p-3 text-sm text-ol-red">
          {error}
        </p>
      )}

      <div className="space-y-3">
        {visible.map((f) => {
          const isOpen = expanded === f.id;
          return (
            <article
              key={f.id}
              className="rounded-xl border border-neutral-200 bg-white px-5 py-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-ol-blue px-2.5 py-0.5 text-xs font-medium text-white">
                    {label(f.tags.source ?? f.source)}
                  </span>
                  {f.tags.channel_type && (
                    <span className="rounded-full bg-ol-blue px-2.5 py-0.5 text-xs font-medium text-white">
                      {label(f.tags.channel_type)}
                    </span>
                  )}
                  {f.tags.segment && (
                    <span className="rounded-full border border-ol-red px-2.5 py-0.5 text-xs font-medium text-ol-red">
                      Segment: {f.tags.segment}
                    </span>
                  )}
                  {f.tags.ingestion_date && (
                    <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs text-neutral-600">
                      Importé le {f.tags.ingestion_date}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => setExpanded(isOpen ? null : f.id)}
                  aria-expanded={isOpen}
                  aria-label={isOpen ? "Masquer le détail" : "Afficher le détail"}
                  className="shrink-0 rounded-lg p-1 hover:bg-neutral-100"
                >
                  <ChevronDown
                    className={`h-4 w-4 text-neutral-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </button>
              </div>

              <p className="mt-3 text-[15px]">{f.content}</p>

              <p className="mt-2 text-xs text-neutral-400">
                {f.created_at_source}
                {f.author_email && <span className="ml-4">{f.author_email}</span>}
              </p>

              {isOpen && (
                <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 border-t border-neutral-100 pt-3 text-xs text-neutral-500 sm:grid-cols-3">
                  <div>
                    <dt className="text-neutral-400">external_id</dt>
                    <dd>{f.external_id ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-neutral-400">source</dt>
                    <dd>{f.source}</dd>
                  </div>
                  <div>
                    <dt className="text-neutral-400">ingested_at</dt>
                    <dd>{new Date(f.ingested_at).toLocaleString("fr-FR")}</dd>
                  </div>
                </dl>
              )}
            </article>
          );
        })}

        {!loading && visible.length === 0 && !error && (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-white py-12 text-center">
            <p className="text-sm text-neutral-500">
              Aucun feedback à afficher. Importez un CSV depuis la page « Importer ».
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
