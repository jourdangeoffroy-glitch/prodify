"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ChevronDown, History, Loader2, Sparkles } from "lucide-react";
import PageHeader from "@/components/PageHeader";

const ALL_SOURCES = ["zendesk", "nps", "g2", "slack", "interview", "autre"];

const LABELS: Record<string, string> = {
  zendesk: "Zendesk",
  nps: "NPS",
  g2: "G2",
  slack: "Slack",
  interview: "Interview",
  autre: "Autre",
};

interface Summary {
  id: string;
  period_start: string;
  period_end: string;
  source_filter: string | null;
  summary_text: string;
  feedback_count: number;
  generated_at: string;
}

export default function ResumesPage() {
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [result, setResult] = useState<Summary | null>(null);
  const [history, setHistory] = useState<Summary[]>([]);
  const [openHistory, setOpenHistory] = useState<string | null>(null);

  function loadHistory() {
    fetch("/api/summaries")
      .then((r) => r.json())
      .then((d) => setHistory(d.summaries ?? []))
      .catch(() => {});
  }

  useEffect(loadHistory, []);

  function toggleSource(s: string) {
    setSources((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  async function handleGenerate() {
    setError(null);
    setErrorCode(null);
    setResult(null);
    if (!periodStart || !periodEnd) {
      setError("Merci de sélectionner une période (début et fin).");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/summaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodStart, periodEnd, sources }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setError(data?.error || `Erreur serveur (${res.status}).`);
        setErrorCode(data?.code ?? null);
        return;
      }
      setResult(data.summary);
      loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Résumés IA"
        subtitle="Générez une synthèse des feedbacks sur une période, via l'API Gemini."
      />

      <section className="mb-6 rounded-xl border border-neutral-200 bg-white p-6">
        <div className="mb-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="start">
              Début de période
            </label>
            <input
              id="start"
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 px-3.5 py-2.5 text-sm outline-none focus:border-ol-blue"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="end">
              Fin de période
            </label>
            <input
              id="end"
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 px-3.5 py-2.5 text-sm outline-none focus:border-ol-blue"
            />
          </div>
        </div>

        <p className="mb-2 text-sm font-medium">Sources</p>
        <p className="mb-3 text-xs text-neutral-500">
          Aucune sélection = toutes les sources sont incluses.
        </p>
        <div className="mb-5 flex flex-wrap gap-2">
          {ALL_SOURCES.map((s) => {
            const active = sources.includes(s);
            return (
              <button
                key={s}
                onClick={() => toggleSource(s)}
                aria-pressed={active}
                className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                  active
                    ? "bg-ol-blue text-white font-medium"
                    : "border border-neutral-200 text-neutral-600 hover:border-neutral-300"
                }`}
              >
                {LABELS[s]}
              </button>
            );
          })}
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-ol-blue px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="h-4 w-4" aria-hidden />
          )}
          {loading ? "Génération en cours… (jusqu'à 30 s)" : "Générer le résumé"}
        </button>

        {error && (
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-ol-red/30 bg-ol-red/5 p-3.5">
            <AlertCircle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-ol-red" aria-hidden />
            <p className="text-sm text-neutral-700">
              {error}
              {errorCode === "NOT_CONFIGURED" && (
                <>
                  {" "}
                  <Link href="/reglages" className="font-medium text-ol-blue underline">
                    Aller aux Réglages
                  </Link>
                  .
                </>
              )}
            </p>
          </div>
        )}
      </section>

      {result && (
        <section className="mb-6 rounded-xl border border-neutral-200 bg-white p-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-ol-red px-3 py-1 text-xs font-medium text-white">
              {result.feedback_count} feedbacks analysés
            </span>
            <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-600">
              {result.period_start} → {result.period_end}
            </span>
            <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-600">
              {new Date(result.generated_at).toLocaleString("fr-FR")}
            </span>
          </div>
          <pre className="whitespace-pre-wrap font-sans text-[15px] leading-relaxed">
            {result.summary_text}
          </pre>
        </section>
      )}

      <div className="mb-3 flex items-center gap-2">
        <History className="h-4.5 w-4.5 text-neutral-500" aria-hidden />
        <h2 className="text-lg font-semibold">Historique</h2>
      </div>

      <div className="space-y-2">
        {history.map((s) => {
          const isOpen = openHistory === s.id;
          return (
            <article key={s.id} className="rounded-xl border border-neutral-200 bg-white">
              <button
                onClick={() => setOpenHistory(isOpen ? null : s.id)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              >
                <span className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">
                    {s.period_start} → {s.period_end}
                  </span>
                  <span className="rounded-full bg-ol-red/10 px-2.5 py-0.5 text-xs font-medium text-ol-red">
                    {s.feedback_count} feedbacks
                  </span>
                  <span className="text-xs text-neutral-400">
                    {new Date(s.generated_at).toLocaleString("fr-FR")}
                  </span>
                </span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-neutral-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </button>
              {isOpen && (
                <pre className="whitespace-pre-wrap border-t border-neutral-100 px-5 py-4 font-sans text-sm leading-relaxed">
                  {s.summary_text}
                </pre>
              )}
            </article>
          );
        })}

        {history.length === 0 && (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-white py-10 text-center">
            <p className="text-sm text-neutral-500">Aucun résumé généré pour l&apos;instant.</p>
          </div>
        )}
      </div>
    </div>
  );
}
