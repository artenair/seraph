#!/bin/bash
set -e
cd "$(dirname "$0")"

if [ ! -d venv ]; then
  echo "Creating venv..."
  python3.11 -m venv venv
  source venv/bin/activate
  pip install -r requirements.txt
else
  source venv/bin/activate
fi

python embed_songs.py "$@"
