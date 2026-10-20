#!/usr/bin/env python3
"""Ergänzt die geprüften neueren Meme-Vorlagen, ohne den alten Katalog zu ersetzen.

    python3 scripts/memes/import_recent.py
    python3 scripts/memes/import_recent.py --cache /tmp/pegel-recent-memes

Die Quellen sind in recent.json auf feste GitHub-Commits und SHA-256-Prüfsummen
festgelegt. Benötigt Pillow (wie import_memegen.py). Der Cache enthält die
Originaldateien; die App erhält lokale WebPs mit höchstens 720 px langer Kante.
Nach einer vollständigen Neuerzeugung mit import_memegen.py erneut ausführen.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import tempfile
import urllib.request
from pathlib import Path

from PIL import Image

from import_memegen import MAX_EDGE, OUT_IMG, OUT_JSON, QUALITY, REMOVED, pick_frame

MANIFEST = Path(__file__).with_name("recent.json")


def import_recent(cache: Path) -> None:
    manifest = json.loads(MANIFEST.read_text())
    catalog = json.loads(OUT_JSON.read_text())
    by_id = {entry["id"]: entry for entry in catalog}
    cache.mkdir(parents=True, exist_ok=True)
    OUT_IMG.mkdir(parents=True, exist_ok=True)
    prepared: list[tuple[dict, Image.Image]] = []

    # Erst alle Quellen prüfen; ein fehlender Download ändert den Katalog nicht.
    for source in manifest["templates"]:
        tid = source["id"]
        if tid in REMOVED:
            continue
        if not tid or any(ch not in "abcdefghijklmnopqrstuvwxyz0123456789-" for ch in tid):
            raise ValueError(f"Ungültige Vorlagen-ID: {tid}")
        url = source["image"]
        original = cache / f"{tid}{Path(url).suffix}"
        if not original.exists():
            with urllib.request.urlopen(url, timeout=30) as response:
                original.write_bytes(response.read())
        digest = hashlib.sha256(original.read_bytes()).hexdigest()
        if digest != source["sha256"]:
            raise ValueError(f"Prüfsumme stimmt nicht: {tid}")
        with Image.open(original) as raw:
            if "frame" in source:
                raw.seek(source["frame"])
                img = raw.convert("RGB")
            else:
                img = pick_frame(raw).convert("RGB")
        scale = min(1.0, MAX_EDGE / max(img.size))
        if scale < 1.0:
            img = img.resize((round(img.width * scale), round(img.height * scale)), Image.Resampling.LANCZOS)
        entry = {
            "id": tid,
            "name": source["name"],
            "w": img.width,
            "h": img.height,
            "boxes": source["boxes"],
            "src": source["source"],
        }
        if tid in by_id and by_id[tid] != entry:
            raise ValueError(f"ID ist schon anders belegt; nicht überschrieben: {tid}")
        if tid not in by_id and (OUT_IMG / f"{tid}.webp").exists():
            raise ValueError(f"Bilddatei existiert schon ohne Katalogeintrag: {tid}")
        prepared.append((entry, img))

    for entry, img in prepared:
        target = OUT_IMG / f"{entry['id']}.webp"
        if not target.exists():
            img.save(target, "WEBP", quality=QUALITY, method=6)
        else:
            with Image.open(target) as existing:
                if existing.size != (entry["w"], entry["h"]):
                    raise ValueError(f"Vorhandenes Bild hat falsche Maße: {entry['id']}")
        by_id[entry["id"]] = entry
    entries = sorted(by_id.values(), key=lambda e: e["id"])
    OUT_JSON.write_text(json.dumps(entries, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"{len(prepared)} geprüfte Ergänzungen; {len(entries)} Vorlagen insgesamt")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, help="Ordner für die Originaldateien")
    args = parser.parse_args()
    if args.cache:
        import_recent(args.cache)
    else:
        with tempfile.TemporaryDirectory(prefix="pegel-memes-") as cache:
            import_recent(Path(cache))


if __name__ == "__main__":
    main()
