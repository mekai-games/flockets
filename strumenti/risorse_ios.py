"""Risorse dell'app per iPhone dal logo del sito (design/logo.svg): icona 1024 × 1024 senza trasparenza, logo della
schermata di avvio (SVG chiaro e scuro) e colore di sfondo, in ios/Flockets/Assets.xcassets.

Uso: python3 strumenti/risorse_ios.py   (serve macOS: l'SVG lo disegna AppKit con strumenti/svg_png.swift)
"""
import json
import pathlib
import re
import subprocess
import tempfile

from PIL import Image

QUI = pathlib.Path(__file__).resolve().parent
P = QUI.parent
A = P / "ios" / "Flockets" / "Assets.xcassets"

logo = (P / "design" / "logo.svg").read_text()
interno = re.search(r"<svg[^>]*>(.*)</svg>", logo, re.S).group(1)


def colore(c):
    return interno.replace("currentColor", c)


def scrivi(percorso, dati):
    percorso.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(dati, (dict, list)):
        dati = json.dumps(dati, indent=2) + "\n"
    percorso.write_text(dati)


INFO = {"author": "xcode", "version": 1}
scrivi(A / "Contents.json", {"info": INFO})

# icona: fondo pieno come assets/icona.svg (iOS arrotonda da solo), stormo bianco un po' più piccolo per i margini
s = 0.66
lato = 48 * s
icona = (f'<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 48 48">'
         f'<rect width="48" height="48" fill="#0E0F12"/>'
         f'<g fill="#FFFFFF" transform="translate({(48 - lato) / 2 - 0.7:.2f} {(48 - lato) / 2:.2f}) scale({s})">{colore("#FFFFFF")}</g></svg>')
svg = pathlib.Path(tempfile.mkdtemp()) / "icona.svg"
svg.write_text(icona)
png = A / "AppIcon.appiconset" / "icona.png"
png.parent.mkdir(parents=True, exist_ok=True)
subprocess.run(["swift", str(QUI / "svg_png.swift"), str(svg), str(png), "1024"], check=True)
Image.open(png).convert("RGB").save(png)   # App Store non vuole il canale alfa nelle icone
scrivi(A / "AppIcon.appiconset" / "Contents.json",
       {"images": [{"filename": "icona.png", "idiom": "universal", "platform": "ios", "size": "1024x1024"}], "info": INFO})

# avvio: lo stormo al centro, nero sul chiaro e chiaro sullo scuro
for nome, c in (("avvio.svg", "#0A0A0B"), ("avvio-scuro.svg", "#F2F2F0")):
    scrivi(A / "Avvio.imageset" / nome,
           f'<svg xmlns="http://www.w3.org/2000/svg" width="88" height="88" viewBox="0 0 48 48" fill="{c}">{colore(c)}</svg>\n')
scrivi(A / "Avvio.imageset" / "Contents.json", {
    "images": [
        {"filename": "avvio.svg", "idiom": "universal"},
        {"appearances": [{"appearance": "luminosity", "value": "dark"}], "filename": "avvio-scuro.svg", "idiom": "universal"},
    ],
    "info": INFO,
    "properties": {"preserves-vector-representation": True},
})


def rgb(h):
    return {"red": f"0x{h[1:3]}", "green": f"0x{h[3:5]}", "blue": f"0x{h[5:7]}", "alpha": "1.000"}


# lo stesso --fondo del sito (style.css)
scrivi(A / "Sfondo.colorset" / "Contents.json", {
    "colors": [
        {"color": {"color-space": "srgb", "components": rgb("#FAFAF8")}, "idiom": "universal"},
        {"appearances": [{"appearance": "luminosity", "value": "dark"}],
         "color": {"color-space": "srgb", "components": rgb("#0E0E10")}, "idiom": "universal"},
    ],
    "info": INFO,
})
print("ok")
