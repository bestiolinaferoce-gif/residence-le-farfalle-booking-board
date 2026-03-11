#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=3030
lsof -ti:$PORT | xargs kill -9 2>/dev/null || true
cd "$DIR"
[ -d ".next/static" ] && npm run start -- -p $PORT & || npm run dev -- -p $PORT &
sleep 5 && open "http://localhost:$PORT"
echo "Villa Olimpia su http://localhost:$PORT — chiudi per fermare."
wait
