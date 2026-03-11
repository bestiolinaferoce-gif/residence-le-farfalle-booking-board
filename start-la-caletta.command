#!/bin/bash
# Residence La Caletta — Booking Board Quick Launcher
DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=3031

# Termina eventuale istanza precedente sulla stessa porta
lsof -ti:$PORT | xargs kill -9 2>/dev/null || true

echo "🌊 Avvio Residence La Caletta Booking Board..."
cd "$DIR"

# Usa build produzione se disponibile, altrimenti dev
if [ -d ".next/static" ]; then
  npm run start -- -p $PORT &
else
  npm run dev -- -p $PORT &
fi

SERVER_PID=$!
echo "PID server: $SERVER_PID"

# Attendi che il server sia pronto
sleep 4

# Apri nel browser di default
open "http://localhost:$PORT"

echo "✅ App aperta su http://localhost:$PORT"
echo "   Chiudi questo terminale per fermare il server."
wait $SERVER_PID
