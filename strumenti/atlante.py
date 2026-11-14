"""Unisce i fogli di animazione dei personaggi in un'unica immagine per il sito.

    python3 strumenti/atlante.py "<cartella dei personaggi>"

Ogni personaggio ha un foglio 288x384: 6 colonne x 8 righe di fotogrammi 48x48
(fermo, camminata, corsa, salto, chiacchiere, festa, paura, sonno).
L'atlante li mette in una griglia di 10 colonne. Scrive web/assets/personaggi.png e personaggi.json.
"""
import json
import re
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "web" / "assets"
W, H, COLS = 288, 384, 10


def main(src):
    src = Path(src)
    dirs = sorted(d for d in src.iterdir() if d.is_dir() and re.match(r"^\d{3} ", d.name))
    rows = (len(dirs) + COLS - 1) // COLS
    atlas = Image.new("RGBA", (W * COLS, H * rows), (0, 0, 0, 0))
    nomi = []
    for i, d in enumerate(dirs):
        im = Image.open(d / "sheet.png").convert("RGBA")
        assert im.size == (W, H), (d.name, im.size)
        atlas.paste(im, ((i % COLS) * W, (i // COLS) * H))
        nomi.append(d.name[4:])
    OUT.mkdir(parents=True, exist_ok=True)
    atlas.save(OUT / "personaggi.png", optimize=True)
    (OUT / "personaggi.json").write_text(json.dumps({"colonne": COLS, "foglio": [W, H], "fotogramma": 48, "nomi": nomi},
                                                    ensure_ascii=False))
    print(len(dirs), "personaggi ->", OUT / "personaggi.png", "%.0f KB" % ((OUT / "personaggi.png").stat().st_size / 1024))


if __name__ == "__main__":
    main(sys.argv[1])
