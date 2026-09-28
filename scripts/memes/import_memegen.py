#!/usr/bin/env python3
"""
Holt die Meme-Vorlagen fürs Meme-Duell und legt sie der App bei.

Quelle ist das Vorlagen-Verzeichnis von memegen (github.com/jacebrowning/memegen,
Code unter MIT). Dort liegt zu jedem Meme das Bild UND eine config.yml mit den
Textfeldern – Position, Größe, Drehung, Farbe. Genau das braucht ein Spiel wie
dieses: nicht nur das Bild, sondern wo auf dem Bild geschrieben wird.

Was das Skript tut:
  1. Liest jede Vorlage, lässt die Ausschlussliste unten weg.
  2. Verkleinert das Bild auf höchstens 720 px (lange Kante) und schreibt WebP
     nach public/memes/<id>.webp. Animierte GIFs werden zu einem Standbild.
  3. Schreibt den Katalog nach src/games/meme-battle/templates.json.

Die Bilder landen bewusst NICHT in der Datenbank: über die Leitung gehen
nur die ID einer Vorlage und die getippten Texte.

Aufruf (braucht Pillow und PyYAML: `pip install pillow pyyaml`):

    git clone --depth 1 https://github.com/jacebrowning/memegen /tmp/memegen
    python3 scripts/memes/import_memegen.py /tmp/memegen/templates

Eigene Vorlagen: einen Ordner im selben Aufbau anlegen (default.jpg +
config.yml) und das Skript zusätzlich darauf zeigen lassen – siehe
docs/MEME-DUELL.md.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import yaml
from PIL import Image, ImageSequence

ROOT = Path(__file__).resolve().parents[2]
OUT_IMG = ROOT / "public" / "memes"
OUT_JSON = ROOT / "src" / "games" / "meme-battle" / "templates.json"

# Lange Kante in Pixeln. Auf dem Handy ist der Abzug gut 340 CSS-Pixel breit;
# mehr als ~2x lohnt sich bei Memes nicht, die Vorlagen sind selbst selten schärfer.
MAX_EDGE = 720
QUALITY = 74

# Mehr Textfelder als das tippt auf dem Handy niemand in 90 Sekunden.
MAX_BOXES = 5

# Bewusst weggelassen – mit Grund, damit niemand sie aus Versehen zurückholt.
EXCLUDE: dict[str, str] = {
    "_error": "technisch",
    "_test": "technisch",
    # Reale Politiker*innen: Persönlichkeitsrecht und Wahlkampf-Memes gehören
    # nicht in ein Partyspiel.
    "sad-biden": "Politiker",
    "sad-boehner": "Politiker",
    "sad-bush": "Politiker",
    "sad-clinton": "Politiker",
    "sad-obama": "Politiker",
    "trump": "Politiker",
    "happening": "Politiker",
    "toohigh": "Politiker (Kandidat einer Partei)",
    # Inhaltlich problematisch
    "ugandanknuck": "gilt als rassistisch",
    "sk": "stereotyp (Third World Kid)",
    "apcr": "stereotyp (Redneck)",
    "dsm": "Mord-Anspielung auf eine Privatperson",
    "elmo": "Drogen",
    "yallgot": "Drogen",
    "bd": "verspottet das Aussehen einer Privatperson",
    "drunk": "Kind + Alkohol passt nicht in eine Trink-App",
    "fmr": "Titel ist vulgär",
    "slap": "echte Gewaltszene",
}

FONTS = {"thick": "thick", "thin": "thin", "comic": "comic"}


def pick_frame(img: Image.Image) -> Image.Image:
    """Ein GIF wird zum Standbild – das Bild aus dem ersten Drittel.

    Das allererste Bild ist bei vielen GIFs schwarz oder ein Übergang; ein
    Drittel hinein zeigt fast immer die Szene, die das Meme ausmacht.
    """
    frames = getattr(img, "n_frames", 1)
    if frames <= 1:
        return img
    target = frames // 3
    for i, frame in enumerate(ImageSequence.Iterator(img)):
        if i == target:
            return frame.copy()
    return img


def color_of(raw: str | None) -> str:
    if not raw:
        return "white"
    return str(raw)


def box_of(t: dict) -> dict:
    """Ein Textfeld: Ecke oben links und Größe als Anteil des Bildes."""
    w = min(1.0, float(t.get("scale_x", 1.0)))
    h = min(1.0, float(t.get("scale_y", 0.2)))
    # Ein paar Felder ragen in memegen über den Rand (dort wird einfach
    # abgeschnitten). Hier rücken sie ins Bild, statt Text zu verlieren.
    x = min(max(float(t.get("anchor_x", 0.0)), 0.0), 1.0 - w)
    y = min(max(float(t.get("anchor_y", 0.0)), 0.0), 1.0 - h)
    box = {"x": round(x, 4), "y": round(y, 4), "w": round(w, 4), "h": round(h, 4)}
    angle = float(t.get("angle", 0.0) or 0.0)
    if angle:
        box["r"] = round(angle, 2)
    color = color_of(t.get("color"))
    if color != "white":
        box["c"] = color
    font = FONTS.get(str(t.get("font", "thick")), "thick")
    if font != "thick":
        box["f"] = font
    style = str(t.get("style", "upper"))
    # upper = Großbuchstaben (klassisches Meme), alles andere bleibt, wie getippt.
    if style != "upper":
        box["s"] = "none"
    align = str(t.get("align", "center"))
    if align != "center":
        box["a"] = align
    return box


def main(sources: list[str]) -> None:
    OUT_IMG.mkdir(parents=True, exist_ok=True)
    catalog = []
    skipped: list[str] = []
    for src in sources:
        base = Path(src)
        for d in sorted(p for p in base.iterdir() if p.is_dir()):
            tid = d.name
            if tid in EXCLUDE:
                skipped.append(f"{tid}: {EXCLUDE[tid]}")
                continue
            cfg_path = d / "config.yml"
            if not cfg_path.exists():
                continue
            cfg = yaml.safe_load(cfg_path.read_text()) or {}
            texts = cfg.get("text") or [{"anchor_y": 0.0}, {"anchor_y": 0.8}]
            if len(texts) > MAX_BOXES:
                skipped.append(f"{tid}: {len(texts)} Textfelder")
                continue
            image = next((d / f for f in sorted(os.listdir(d)) if f.startswith("default.")), None)
            if image is None:
                continue

            img = pick_frame(Image.open(image)).convert("RGB")
            scale = min(1.0, MAX_EDGE / max(img.size))
            if scale < 1.0:
                img = img.resize(
                    (round(img.width * scale), round(img.height * scale)), Image.LANCZOS
                )
            img.save(OUT_IMG / f"{tid}.webp", "WEBP", quality=QUALITY, method=6)

            entry = {
                "id": tid,
                "name": str(cfg.get("name") or tid),
                "w": img.width,
                "h": img.height,
                "boxes": [box_of(t) for t in texts],
            }
            if cfg.get("source"):
                entry["src"] = str(cfg["source"])
            catalog.append(entry)

    catalog.sort(key=lambda e: e["id"])
    OUT_JSON.write_text(json.dumps(catalog, ensure_ascii=False, separators=(",", ":")) + "\n")
    total = sum((OUT_IMG / f"{e['id']}.webp").stat().st_size for e in catalog)
    print(f"{len(catalog)} Vorlagen, {total / 1024 / 1024:.1f} MB Bilder")
    print("Ausgelassen:")
    for s in skipped:
        print("  -", s)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1:])
