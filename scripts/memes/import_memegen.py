#!/usr/bin/env python3
"""
Holt die Meme-Vorlagen fürs Meme-Duell und legt sie der App bei.

Zwei Arten von Quellen:

1. memegen (github.com/jacebrowning/memegen, Code unter MIT). Dort liegt zu
   jedem Meme das Bild UND eine config.yml mit den Textfeldern – Position,
   Größe, Drehung, Farbe.
2. Weitere Sammlungen ohne Textfeld-Angaben (imgflip-Top-100 aus dem
   ImgFlip575K-Datensatz, memebank, MemeTastic). Für die stehen die Felder
   von Hand gesetzt in scripts/memes/extra.json.

Was das Skript tut:
  1. Liest alle Vorlagen. memegen-Vorlagen, die schon in einer anderen Quelle
     stehen, gewinnen (dort sind die Felder genauer).
  2. Verkleinert jedes Bild auf höchstens 720 px (lange Kante) und schreibt
     WebP nach public/memes/<id>.webp. Animierte GIFs werden zum Standbild.
  3. Schreibt den Katalog nach src/games/meme-battle/templates.json.

Die Bilder landen bewusst NICHT in der Datenbank: über die Leitung gehen nur
die ID einer Vorlage und die getippten Texte.

Aufruf (braucht Pillow und PyYAML: `pip install pillow pyyaml`):

    git clone --depth 1 https://github.com/jacebrowning/memegen /tmp/memegen
    git clone --depth 1 https://github.com/cipherdragon/memebank /tmp/memebank
    git clone --depth 1 https://github.com/gsantner/memetastic /tmp/memetastic
    git clone --depth 1 https://github.com/schesa/ImgFlip575K_Dataset /tmp/imgflip

    python3 scripts/memes/import_memegen.py /tmp/memegen/templates \\
      --src imgflip575k=/tmp/imgflip/dataset/templates/img \\
      --src memebank=/tmp/memebank \\
      --src memetastic=/tmp/memetastic/app/src/main/assets/bundled

Eigene Vorlagen: entweder einen Ordner im memegen-Aufbau (default.jpg +
config.yml) als weiteres Verzeichnis angeben oder einen Eintrag in
extra.json mit eigener Quelle – siehe docs/MEME-DUELL.md.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

import yaml
from PIL import Image, ImageSequence

ROOT = Path(__file__).resolve().parents[2]
OUT_IMG = ROOT / "public" / "memes"
OUT_JSON = ROOT / "src" / "games" / "meme-battle" / "templates.json"
EXTRA = Path(__file__).resolve().parent / "extra.json"

# Lange Kante in Pixeln. Auf dem Handy ist der Abzug gut 340 CSS-Pixel breit;
# mehr als ~2x lohnt sich bei Memes nicht, die Vorlagen sind selbst selten schärfer.
MAX_EDGE = 720
QUALITY = 74

# Technische Ordner von memegen – keine Memes.
SKIP = {"_error", "_test"}

# Inhaltlich wird nichts aussortiert. Diese wenigen kommen aber nur mit dem
# Spicy-Schalter (ab 18) in den Stapel: Die App hat auch Leute unter 18, und
# genau dafür gibt es den Schalter – Drogen, Mord-Witz, vulgärer Titel.
SPICY: dict[str, str] = {
    "elmo": "Kokain",
    "yallgot": "Crack",
    "dsm": "Mord-Witz",
    "fmr": "vulgärer Titel",
}

# Auf Hinweis entfernt (Rechteinhaber, abgebildete Person): ID → Grund.
# Nur die Datei zu löschen reicht nicht – der Katalog zeigte dann ins Leere.
REMOVED: dict[str, str] = {}

FONTS = {"thick": "thick", "thin": "thin", "comic": "comic"}

# Stil-Kürzel aus extra.json
STYLES = {
    "ink": {"c": "black", "f": "thin", "s": "none"},
    "comic": {"c": "black", "f": "comic", "s": "none"},
    "thinw": {"f": "thin", "s": "none"},
}
LAYOUTS = {
    "tb": [[0, 0, 1, 0.2], [0, 0.8, 1, 0.2]],
    "t": [[0, 0, 1, 0.2]],
    "b": [[0, 0.8, 1, 0.2]],
}


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


def clamp_box(x: float, y: float, w: float, h: float) -> dict:
    """Ein paar Felder ragen über den Rand (memegen schneidet dort einfach ab).
    Hier rücken sie ins Bild, statt Text zu verlieren."""
    w = min(1.0, w)
    h = min(1.0, h)
    x = min(max(x, 0.0), 1.0 - w)
    y = min(max(y, 0.0), 1.0 - h)
    return {"x": round(x, 4), "y": round(y, 4), "w": round(w, 4), "h": round(h, 4)}


def box_of(t: dict) -> dict:
    """Ein Textfeld aus memegen: Ecke oben links und Größe als Anteil des Bildes."""
    box = clamp_box(
        float(t.get("anchor_x", 0.0)),
        float(t.get("anchor_y", 0.0)),
        float(t.get("scale_x", 1.0)),
        float(t.get("scale_y", 0.2)),
    )
    angle = float(t.get("angle", 0.0) or 0.0)
    if angle:
        box["r"] = round(angle, 2)
    color = str(t.get("color") or "white")
    if color != "white":
        box["c"] = color
    font = FONTS.get(str(t.get("font", "thick")), "thick")
    if font != "thick":
        box["f"] = font
    # upper = Großbuchstaben (klassisches Meme), alles andere bleibt, wie getippt.
    if str(t.get("style", "upper")) != "upper":
        box["s"] = "none"
    align = str(t.get("align", "center"))
    if align != "center":
        box["a"] = align
    return box


def save_image(src: Path, tid: str) -> tuple[int, int]:
    img = pick_frame(Image.open(src)).convert("RGB")
    scale = min(1.0, MAX_EDGE / max(img.size))
    if scale < 1.0:
        img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    img.save(OUT_IMG / f"{tid}.webp", "WEBP", quality=QUALITY, method=6)
    return img.width, img.height


def from_memegen(base: Path) -> list[dict]:
    out = []
    for d in sorted(p for p in base.iterdir() if p.is_dir()):
        tid = d.name
        if tid in SKIP or tid in REMOVED or not (d / "config.yml").exists():
            continue
        cfg = yaml.safe_load((d / "config.yml").read_text()) or {}
        texts = cfg.get("text") or [{"anchor_y": 0.0}, {"anchor_y": 0.8}]
        image = next((d / f for f in sorted(os.listdir(d)) if f.startswith("default.")), None)
        if image is None:
            continue
        w, h = save_image(image, tid)
        entry = {
            "id": tid,
            "name": str(cfg.get("name") or tid),
            "w": w,
            "h": h,
            "boxes": [box_of(t) for t in texts],
        }
        if cfg.get("source"):
            entry["src"] = str(cfg["source"])
        if tid in SPICY:
            entry["sp"] = 1
        out.append(entry)
    return out


def from_extra(sources: dict[str, Path]) -> list[dict]:
    data = json.loads(EXTRA.read_text())
    out = []
    for t in data["templates"]:
        if t["id"] in REMOVED:
            continue
        folder = sources.get(t["src"])
        if folder is None:
            print(f"  ! {t['id']}: Quelle {t['src']} nicht angegeben (--src {t['src']}=…)")
            continue
        image = folder / t["file"]
        if not image.exists():
            print(f"  ! {t['id']}: {image} fehlt")
            continue
        w, h = save_image(image, t["id"])
        raw = LAYOUTS[t["boxes"]] if isinstance(t["boxes"], str) else t["boxes"]
        boxes = []
        for b in raw:
            box = clamp_box(*[float(v) for v in b[:4]])
            if len(b) > 4:
                box.update(STYLES[b[4]])
            boxes.append(box)
        entry = {"id": t["id"], "name": t["name"], "w": w, "h": h, "boxes": boxes}
        entry["src"] = data["sources"][t["src"]]
        if t.get("spicy"):
            entry["sp"] = 1
        out.append(entry)
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("memegen", nargs="+", type=Path, help="Ordner im memegen-Aufbau")
    ap.add_argument("--src", action="append", default=[], help="name=ordner für extra.json")
    args = ap.parse_args()
    sources = {k: Path(v) for k, v in (s.split("=", 1) for s in args.src)}

    OUT_IMG.mkdir(parents=True, exist_ok=True)
    for old in OUT_IMG.glob("*.webp"):
        old.unlink()

    catalog: dict[str, dict] = {}
    for e in from_extra(sources):
        catalog[e["id"]] = e
    for base in args.memegen:
        for e in from_memegen(base):
            catalog[e["id"]] = e

    entries = sorted(catalog.values(), key=lambda e: e["id"])
    OUT_JSON.write_text(json.dumps(entries, ensure_ascii=False, separators=(",", ":")) + "\n")
    total = sum((OUT_IMG / f"{e['id']}.webp").stat().st_size for e in entries)
    spicy = sum(1 for e in entries if e.get("sp"))
    print(f"{len(entries)} Vorlagen ({spicy} nur mit Spicy), {total / 1024 / 1024:.1f} MB Bilder")


if __name__ == "__main__":
    main()
