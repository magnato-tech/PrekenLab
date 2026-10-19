#!/usr/bin/env bash
set -e

echo "=== TaleLab Åpen AI-backend: Chatterbox Multilingual ==="
echo "Undersøker Python og maskinvare..."

python3 --version

if ! command -v ffmpeg &> /dev/null; then
    echo "[Advarsel] ffmpeg ble ikke funnet. Vennligst installer ffmpeg for MP3-støtte."
fi

echo "Installerer avhengigheter fra requirements.txt..."
pip install -r requirements.txt

echo "Starter FastAPI Chatterbox backend på http://0.0.0.0:8000..."
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
