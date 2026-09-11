"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

interface ImportReport {
  inserted: number;
  duplicates: number;
  errors: { line: number; reason: string }[];
  totalRows: number;
}

export default function FeedbacksPage() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [filterKey, setFilterKey] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const [filterKey2, setFilterKey2] = useState("");
  const [filterValue2, setFilterValue2] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const loadFeedbacks = useCallback(() => {
    const params = new URLSearchParams();
    if (filterKey && filterValue) params.set(`tag_${filterKey}`, filterValue);
    if (filterKey2 && filterValue2) params.set(`tag_${filterKey2}`, filterValue2);
    fetch(`/api/feedbacks?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setFeedbacks(d.feedbacks))
      .catch(() => setImportError("Impossible de charger les feedbacks."));
  }, [filterKey, filterValue, filterKey2, filterValue2]);

  useEffect(loadFeedbacks, [loadFeedbacks]);

  async function handleFile(file: File) {
    setImportError(null);
    setReport(null);
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/feedbacks/import", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec de l'import.");
      setReport(data);
      loadFeedbacks();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Importer des feedbacks</h1>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer mb-4 ${
          dragOver ? "border-ol-blue bg-ol-blue/5" : "border-neutral-300"
        }`}
      >
        <p className="text-sm text-neutral-600">
          Glissez-déposez un fichier .csv ici, ou cliquez pour le sélectionner.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
      </div>

      <button
        onClick={() => inputRef.current?.click()}
        disabled={importing}
        className="bg-ol-blue text-white text-sm font-medium px-4 py-2 rounded hover:opacity-90 disabled:opacity-50 mb-4"
      >
        {importing ? "Import en cours…" : "Importer"}
      </button>

      {importError && (
        <p className="text-ol-red text-sm mb-4 border border-ol-red/30 bg-ol-red/5 rounded p-2">
          {importError}
        </p>
      )}

      {report && (
        <div className="mb-6 border border-neutral-200 rounded-lg p-4">
          <p className="text-sm mb-2">
            <strong>{report.inserted}</strong> insérée(s) /{" "}
            <strong>{report.errors.length}</strong> en erreur / <strong>{report.duplicates}</strong>{" "}
            doublon(s) ignoré(s) — sur {report.totalRows} ligne(s).
          </p>
          {report.errors.length > 0 && (
            <ul className="text-sm space-y-1 mt-2">
              {report.errors.map((e, i) => (
                <li key={i} className="flex gap-2 items-start">
                  <span className="shrink-0 bg-ol-red text-white text-xs px-1.5 py-0.5 rounded">
                    ligne {e.line}
                  </span>
                  <span className="text-neutral-700">{e.reason}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <h2 className="text-lg font-bold mb-2">Feedbacks ({feedbacks.length})</h2>

      <div className="flex flex-wrap gap-2 mb-3 text-sm">
        <select
          value={filterKey}
          onChange={(e) => setFilterKey(e.target.value)}
          className="border border-neutral-300 rounded px-2 py-1"
        >
          <option value="">Filtre tag 1…</option>
          <option value="source">source</option>
          <option value="channel_type">channel_type</option>
          <option value="segment">segment</option>
        </select>
        <input
          placeholder="valeur"
          value={filterValue}
          onChange={(e) => setFilterValue(e.target.value)}
          className="border border-neutral-300 rounded px-2 py-1 w-28"
        />
        <select
          value={filterKey2}
          onChange={(e) => setFilterKey2(e.target.value)}
          className="border border-neutral-300 rounded px-2 py-1"
        >
          <option value="">Filtre tag 2…</option>
          <option value="source">source</option>
          <option value="channel_type">channel_type</option>
          <option value="segment">segment</option>
        </select>
        <input
          placeholder="valeur"
          value={filterValue2}
          onChange={(e) => setFilterValue2(e.target.value)}
          className="border border-neutral-300 rounded px-2 py-1 w-28"
        />
      </div>

      <div className="space-y-2">
        {feedbacks.map((f) => (
          <div key={f.id} className="border border-neutral-200 rounded-lg p-3">
            <p className="text-sm mb-2">{f.content}</p>
            <div className="flex flex-wrap gap-1.5 text-xs">
              {Object.entries(f.tags).map(([k, v]) =>
                k === "segment" ? (
                  <span
                    key={k}
                    className="border border-ol-red text-ol-red rounded-full px-2 py-0.5"
                  >
                    {k}: {v}
                  </span>
                ) : (
                  <span key={k} className="bg-ol-blue text-white rounded-full px-2 py-0.5">
                    {k}: {v}
                  </span>
                )
              )}
            </div>
          </div>
        ))}
        {feedbacks.length === 0 && (
          <p className="text-sm text-neutral-500">Aucun feedback pour l&apos;instant.</p>
        )}
      </div>
    </div>
  );
}
