#!/usr/bin/env bash
# Met à jour l'application déployée (VPS). À lancer depuis la racine du projet.
set -euo pipefail

echo "==> git pull"
git pull --ff-only || echo "(pas de dépôt git — ré-uploadez les fichiers manuellement)"

echo "==> npm install"
npm install

echo "==> build du front"
npm run build

echo "==> redémarrage PM2"
pm2 restart app-comptable --update-env

pm2 status app-comptable
echo "✅ Mise à jour terminée."
