# PRODIFY — prototype

Prototype MVP (Next.js + SQLite) des 3 fonctionnalités décrites dans le prompt PRODIFY :
1. Import CSV de feedbacks (`/feedbacks`)
2. Résumé automatique par LLM Gemini (`/resumes`) — nécessite une clé API
3. Tagging automatique par source (appliqué à l'import, visible sur `/feedbacks`)

## Lancer le prototype

```bash
npm install
npm run dev
```

Ouvrir http://localhost:3000.

## Tester l'appel réseau vers Gemini (fonctionnalité 2)

1. Récupérer une clé API gratuite sur https://aistudio.google.com
2. Aller sur `/reglages`, coller la clé, cliquer "Enregistrer"
3. Aller sur `/feedbacks`, importer un CSV (voir format ci-dessous)
4. Aller sur `/resumes`, choisir une période couvrant les feedbacks importés, cliquer
   "Générer le résumé" → l'appel réseau réel vers l'API Gemini est déclenché ici

Alternative : définir la variable d'environnement `GEMINI_API_KEY` avant `npm run dev`
(prioritaire sur la clé enregistrée via l'UI).

## Format CSV attendu

Header exact, délimiteur virgule, encodage UTF-8 :

```
source,content,created_at_source,external_id,author_email,segment
zendesk,"Le dashboard est trop lent",2026-01-10,tick-1,user@test.com,enterprise
```

`source` obligatoire (`zendesk|nps|g2|slack|interview|autre`), `content` et
`created_at_source` (YYYY-MM-DD) obligatoires. `external_id`, `author_email`, `segment`
optionnels. Limites : 5 Mo / 5000 lignes.

## Limites connues de ce prototype

- Clé API Gemini stockée en clair côté serveur (SQLite), non chiffrée — ne pas réutiliser
  tel quel en production.
- Import CSV traité de façon synchrone (pas de file d'attente asynchrone).
- Règles de tagging (mapping source → channel_type) dans `src/lib/config/tagMapping.ts`,
  modifiables uniquement en éditant ce fichier (pas d'UI d'édition, hors périmètre MVP).
- Free tier Gemini Flash : ~5-15 requêtes/minute, ~1000/jour.
