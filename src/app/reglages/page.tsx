"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, KeyRound, Save, ShieldAlert, XCircle } from "lucide-react";
import PageHeader from "@/components/PageHeader";

export default function ReglagesPage() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = () => {
    fetch("/api/settings")
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (!r.ok || !data) throw new Error(data?.error || `Erreur serveur (${r.status}).`);
        return data;
      })
      .then((d) => setConfigured(d.configured))
      .catch((err) => {
        setConfigured(false);
        setError(
          `Impossible de charger l'état de configuration : ${err instanceof Error ? err.message : String(err)}`
        );
      });
  };

  useEffect(loadStatus, []);

  async function handleSave() {
    setError(null);
    if (!apiKey.trim()) {
      setError("Merci de coller une clé API avant d'enregistrer.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) throw new Error(data?.error || `Erreur serveur (${res.status}).`);
      setConfigured(true);
      setApiKey("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Réglages"
        subtitle="Configuration de l'API Gemini pour la génération de résumés."
      />

      <section className="rounded-xl border border-neutral-200 bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-ol-blue" aria-hidden />
          <h2 className="text-lg font-semibold">Clé API Gemini</h2>
        </div>

        <div className="mb-5 flex items-center gap-2 text-sm">
          {configured === null ? (
            <span className="text-neutral-500">Chargement…</span>
          ) : configured ? (
            <>
              <CheckCircle2 className="h-4.5 w-4.5 text-green-600" aria-hidden />
              <span className="font-medium text-green-700">Clé configurée</span>
            </>
          ) : (
            <>
              <XCircle className="h-4.5 w-4.5 text-ol-red" aria-hidden />
              <span className="font-medium text-ol-red">Aucune clé configurée</span>
            </>
          )}
        </div>

        <label className="mb-1.5 block text-sm font-medium" htmlFor="apiKey">
          Coller votre clé API Gemini
        </label>
        <input
          id="apiKey"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="AIza…"
          className="mb-4 w-full rounded-lg border border-neutral-200 px-3.5 py-2.5 text-sm outline-none focus:border-ol-blue"
        />

        {error && (
          <p className="mb-4 rounded-lg border border-ol-red/30 bg-ol-red/5 p-3 text-sm text-ol-red">
            {error}
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-ol-blue px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          <Save className="h-4 w-4" aria-hidden />
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>

        <a
          href="https://aistudio.google.com"
          target="_blank"
          rel="noreferrer"
          className="mt-5 flex items-center gap-2 border-t border-neutral-100 pt-4 text-sm text-ol-blue hover:underline"
        >
          <ExternalLink className="h-4 w-4" aria-hidden />
          Obtenir une clé API gratuite sur aistudio.google.com
        </a>
      </section>

      <section className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-5">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
        <div>
          <h2 className="font-semibold text-amber-900">Note de sécurité</h2>
          <p className="mt-1 text-sm text-amber-800">
            La clé est stockée côté serveur et n&apos;est jamais renvoyée au frontend après
            enregistrement. Le stockage n&apos;est pas chiffré au repos (prototype de formation) —
            ne pas réutiliser tel quel en production.
          </p>
        </div>
      </section>
    </div>
  );
}
