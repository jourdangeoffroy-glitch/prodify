"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const ALL_SOURCES = ["zendesk", "nps", "g2", "slack", "interview", "autre"];

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

  function loadHistory() {
    fetch("/api/summaries")
      .then((r) => r.json())
      .then((d) => setHistory(d.summaries))
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
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Échec de la génération du résumé.");
        setErrorCode(data.code || null);
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
      <h1 className="text-xl font-bold mb-4">Résumé automatique par LLM (Gemini)</h1>

      <div className="border border-neutral-200 rounded-lg p-4 mb-6 max-w-lg">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-sm font-medium mb-1">Début</label>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="w-full border border-neutral-300 rounded px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Fin</label>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="w-full border border-neutral-300 rounded px-2 py-1 text-sm"
            />
          </div>
        </div>

        <label className="block text-sm font-medium mb-1">
          Sources (aucune coché = toutes)
        </label>
        <div className="flex flex-wrap gap-3 mb-4 text-sm">
          {ALL_SOURCES.map((s) => (
            <label key={s} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={sources.includes(s)}
                onChange={() => toggleSource(s)}
              />
              {s}
            </label>
          ))}
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="bg-ol-blue text-white text-sm font-medium px-4 py-2 rounded hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Génération en cours… (jusqu'à 30s)" : "Générer le résumé"}
        </button>

        {error && (
          <div className="mt-3 text-sm text-ol-red border border-ol-red/30 bg-ol-red/5 rounded p-2">
            {error}
            {errorCode === "NOT_CONFIGURED" && (
              <>
                {" "}
                <Link href="/reglages" className="underline font-medium">
                  Aller aux Réglages
                </Link>
                .
              </>
            )}
          </div>
        )}
      </div>

      {result && (
        <div className="border border-neutral-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-ol-red text-white text-xs px-2 py-0.5 rounded-full">
              {result.feedback_count} feedbacks analysés
            </span>
            <span className="text-xs text-neutral-500">
              {result.period_start} → {result.period_end}
            </span>
          </div>
          <pre className="whitespace-pre-wrap text-sm font-sans">{result.summary_text}</pre>
        </div>
      )}

      <h2 className="text-lg font-bold mb-2">Historique</h2>
      <div className="space-y-2">
        {history.map((s) => (
          <details key={s.id} className="border border-neutral-200 rounded-lg p-3">
            <summary className="cursor-pointer text-sm">
              {s.period_start} → {s.period_end} —{" "}
              <span className="text-ol-red font-medium">{s.feedback_count} feedbacks</span> —{" "}
              {new Date(s.generated_at).toLocaleString("fr-FR")}
            </summary>
            <pre className="whitespace-pre-wrap text-sm font-sans mt-2">{s.summary_text}</pre>
          </details>
        ))}
        {history.length === 0 && (
          <p className="text-sm text-neutral-500">Aucun résumé généré pour l&apos;instant.</p>
        )}
      </div>
    </div>
  );
}
