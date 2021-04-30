#!/usr/bin/env python3
import os
from pathlib import Path

from app import process_playlist, model
from model import STORAGE_FOLDER, load_json


DB_FOLDER = "db"
PLAYLIST_DIR = Path(STORAGE_FOLDER) / DB_FOLDER / "playlist"


print("Loading indexes...", end="", flush=True)
model.load()
print("OK")
model.reset()
for filename in os.listdir(PLAYLIST_DIR):
    if filename[-5:] == ".json":
        print("Loading", filename)
        playlist = load_json(PLAYLIST_DIR / filename)
        try:
            print(process_playlist(playlist, recommend=False))
        except Exception as e:
            print("Error:", str(e))
model.save()
