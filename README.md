# PRODIFY — prototype

Prototype MVP (Next.js + SQLite/libSQL) des 3 fonctionnalités décrites dans le prompt PRODIFY :
1. Import CSV de feedbacks (`/importer`)
2. Résumé automatique par LLM Gemini (`/resumes`) — nécessite une clé API
3. Tagging automatique par source (appliqué à l'import, visible sur `/feedbacks`)

## Lancer en local

```bash
npm install
npm run dev
```

Ouvrir http://localhost:3000. En local, la base est un fichier SQLite (`data/prodify.db`,
créé automatiquement, non versionné) — aucun compte externe requis.

## Déployer sur le web (sans rien installer en local)

Ce prototype tourne sur Vercel (hébergement serverless du code Next.js) + Turso (base
SQLite hébergée, car le stockage fichier local ne survit pas sur une plateforme
serverless). Les deux ont un tier gratuit suffisant pour ce prototype.

1. **Turso** : créer un compte sur https://turso.tech, créer une base (`turso db create
   prodify` via leur CLI, ou depuis leur dashboard web), récupérer :
   - l'URL de connexion (`turso db show prodify --url`) → variable `TURSO_DATABASE_URL`
   - un token (`turso db tokens create prodify`) → variable `TURSO_AUTH_TOKEN`
2. **Vercel** : créer un compte sur https://vercel.com, "Add New Project", importer ce
   dépôt GitHub (`jourdangeoffroy-glitch/prodify`, branche
   `claude/gemini-prototype-page-i0405n` ou celle mergée sur `main`).
3. Dans les "Environment Variables" du projet Vercel, ajouter `TURSO_DATABASE_URL` et
   `TURSO_AUTH_TOKEN` (valeurs de l'étape 1). Déployer.
4. Une fois déployé, ouvrir l'URL fournie par Vercel : le schéma est créé automatiquement
   au premier appel (aucune migration manuelle). Aller sur `/reglages` pour coller la
   clé Gemini — elle est alors stockée dans Turso, pas dans le code ni dans les variables
   d'environnement Vercel.

Sans `TURSO_DATABASE_URL` défini, l'app retombe sur un fichier SQLite local — c'est ce qui
se passe automatiquement en dev, mais **ne pas déployer ainsi sur Vercel** : chaque
invocation serverless repartirait d'une base vide.

## Tester l'appel réseau vers Gemini (fonctionnalité 2)

1. Récupérer une clé API gratuite sur https://aistudio.google.com
2. Aller sur `/reglages`, coller la clé, cliquer "Enregistrer"
3. Aller sur `/importer`, importer un CSV (voir format ci-dessous)
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

- Clé API Gemini stockée en clair côté serveur (SQLite/Turso), non chiffrée — ne pas
  réutiliser tel quel en production.
- Déploiement public sans authentification : si tu déploies sur Vercel, l'URL est
  accessible à quiconque la connaît (pas de login). Adapté à un test entre toi et ton
  équipe, pas à une mise en production réelle.
- Import CSV traité de façon synchrone (pas de file d'attente asynchrone).
- Règles de tagging (mapping source → channel_type) dans `src/lib/config/tagMapping.ts`,
  modifiables uniquement en éditant ce fichier (pas d'UI d'édition, hors périmètre MVP).
- Free tier Gemini Flash : ~5-15 requêtes/minute, ~1000/jour.
