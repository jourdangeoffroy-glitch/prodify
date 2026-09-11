"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Download, UploadCloud } from "lucide-react";
import PageHeader from "@/components/PageHeader";

interface ImportReport {
  inserted: number;
  duplicates: number;
  errors: { line: number; reason: string }[];
  totalRows: number;
}

const TEMPLATE_CSV = `source,content,created_at_source,external_id,author_email,segment
zendesk,"Le dashboard est trop lent au chargement",2026-01-10,tick-1,user@example.com,enterprise
nps,"J'adore la nouvelle fonctionnalité d'export",2026-01-11,,,
`;

export default function ImporterPage() {
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [dbOnline, setDbOnline] = useState<boolean | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/feedbacks")
      .then((r) => setDbOnline(r.ok))
      .catch(() => setDbOnline(false));
  }, []);

  async function handleFile(file: File) {
    setError(null);
    setReport(null);
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/feedbacks/import", { method: "POST", body: formData });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) throw new Error(data?.error || `Erreur serveur (${res.status}).`);
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([TEMPLATE_CSV], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "modele-feedbacks.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      {dbOnline !== null && (
        <span
          className={`mb-4 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${
            dbOnline ? "bg-neutral-900 text-white" : "bg-ol-red text-white"
          }`}
        >
          {dbOnline ? "Base de données — connectée" : "Base de données — injoignable"}
        </span>
      )}

      <PageHeader
        title="Importer des feedbacks"
        subtitle="Importez un fichier CSV de feedbacks. La validation se fait ligne par ligne."
      />

      <div className="mb-5 rounded-xl border border-ol-blue/20 bg-ol-blue/5 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-ol-blue">Format CSV attendu</h2>
            <p className="mt-2 text-sm text-neutral-700">
              En-tête obligatoire :{" "}
              <code className="rounded bg-white px-1.5 py-0.5 text-[13px]">
                source, content, created_at_source
              </code>{" "}
              + optionnel :{" "}
              <code className="rounded bg-white px-1.5 py-0.5 text-[13px]">
                external_id, author_email, segment
              </code>
            </p>
            <p className="mt-2 text-sm text-neutral-500">
              Sources : zendesk, nps, g2, slack, interview, autre · Date : YYYY-MM-DD · Max :
              5 Mo / 5000 lignes
            </p>
          </div>
          <button
            onClick={downloadTemplate}
            className="flex shrink-0 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm hover:border-ol-blue"
          >
            <Download className="h-4 w-4" aria-hidden />
            Modèle
          </button>
        </div>
      </div>

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
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        className={`cursor-pointer rounded-xl border-2 border-dashed bg-white py-16 text-center transition-colors ${
          dragOver ? "border-ol-blue bg-ol-blue/5" : "border-neutral-300 hover:border-ol-blue"
        }`}
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100">
          <UploadCloud className="h-6 w-6 text-neutral-500" aria-hidden />
        </div>
        <p className="text-[15px] font-medium">
          {importing ? "Import en cours…" : "Glissez un fichier CSV ici ou cliquez pour parcourir"}
        </p>
        <p className="mt-1 text-sm text-neutral-400">5 Mo max · Format UTF-8</p>
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

      {error && (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-ol-red/30 bg-ol-red/5 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-ol-red" aria-hidden />
          <div>
            <p className="font-medium text-ol-red">Import refusé</p>
            <p className="mt-1 text-sm text-neutral-700">{error}</p>
          </div>
        </div>
      )}

      {report && (
        <div className="mt-5 rounded-xl border border-neutral-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" aria-hidden />
            <h2 className="font-semibold">Import terminé</h2>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-neutral-50 px-4 py-3">
              <p className="text-2xl font-bold text-ol-blue">{report.inserted}</p>
              <p className="text-xs text-neutral-500">insérés</p>
            </div>
            <div className="rounded-lg bg-neutral-50 px-4 py-3">
              <p className="text-2xl font-bold text-ol-red">{report.errors.length}</p>
              <p className="text-xs text-neutral-500">en erreur</p>
            </div>
            <div className="rounded-lg bg-neutral-50 px-4 py-3">
              <p className="text-2xl font-bold text-neutral-700">{report.duplicates}</p>
              <p className="text-xs text-neutral-500">doublons ignorés</p>
            </div>
          </div>

          <p className="mt-3 text-xs text-neutral-500">{report.totalRows} ligne(s) lue(s)</p>

          {report.errors.length > 0 && (
            <ul className="mt-4 space-y-2 border-t border-neutral-100 pt-4">
              {report.errors.map((e, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="shrink-0 rounded-full bg-ol-red px-2 py-0.5 text-xs font-medium text-white">
                    ligne {e.line}
                  </span>
                  <span className="text-neutral-700">{e.reason}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
