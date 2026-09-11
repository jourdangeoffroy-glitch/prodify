"use client";

import { useEffect, useState } from "react";

export default function ReglagesPage() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = () => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setConfigured(d.configured))
      .catch(() => setError("Impossible de charger l'état de configuration."));
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec de l'enregistrement.");
      setConfigured(true);
      setApiKey("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-md">
      <h1 className="text-xl font-bold mb-4">Réglages</h1>

      <div className="mb-4">
        <span
          className={`inline-block text-sm px-2 py-1 rounded ${
            configured
              ? "bg-green-100 text-green-800"
              : "bg-ol-red/10 text-ol-red"
          }`}
        >
          {configured === null
            ? "Chargement…"
            : configured
              ? "Clé configurée"
              : "Aucune clé configurée"}
        </span>
      </div>

      <label className="block text-sm font-medium mb-1" htmlFor="apiKey">
        Clé API Gemini
      </label>
      <input
        id="apiKey"
        type="password"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder="Coller votre clé API Gemini (aistudio.google.com)"
        className="w-full border border-neutral-300 rounded px-3 py-2 mb-3 text-sm"
      />

      {error && <p className="text-ol-red text-sm mb-3">{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-ol-blue text-white text-sm font-medium px-4 py-2 rounded hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Enregistrement…" : "Enregistrer"}
      </button>

      <p className="text-xs text-neutral-500 mt-4">
        La clé est envoyée au serveur et stockée côté backend. Elle n&apos;est jamais renvoyée en
        clair au frontend après enregistrement — seul l&apos;état (configurée / non configurée)
        est exposé ici. Limite MVP : le stockage n&apos;est pas chiffré au repos (prototype de
        formation, ne pas réutiliser tel quel en production).
      </p>
    </div>
  );
}
