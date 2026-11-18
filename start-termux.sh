#!/data/data/com.termux/files/usr/bin/bash
# Demarre l'agent + le runner make.fun dans Termux, puis affiche l'adresse a ouvrir.
set -e
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js n'est pas installe. Lance d'abord :  pkg install nodejs git curl tar"
  exit 1
fi

if [ ! -d workspace ]; then
  mkdir -p workspace
  echo "Dossier de travail cree : $(pwd)/workspace"
fi

echo "──────────────────────────────────────────────"
echo " 1. Ouvre Chrome sur  http://127.0.0.1:${PORT:-8787}"
echo " 2. Onglet « Quete » → Connecter le runner"
echo "──────────────────────────────────────────────"
exec node server.js
