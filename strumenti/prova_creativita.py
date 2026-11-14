"""Prova sulla creatività: la stessa foto con piccole differenze (colore di sfondo, colore del testo, scritta)
letta dalla funzione /api/leggi del sito online e simulata dal motore.

Due giri:
- «lettura propria»: ogni variante con la sua lettura (come sul sito);
- «stessa lettura»: la lettura della prima variante per tutte, così cambiano solo le misure dei pixel
  e si vede quanto pesa da solo un colore diverso.

Le misure dei pixel ripetono quelle del sito (web/js/app.js, misurePixel) su un'immagine 48 × 48.
Uso: python3 strumenti/prova_creativita.py   (circa 0,003 $ di lettura per variante)
"""
import base64
import io
import json
import math
import sys
import urllib.request
from pathlib import Path

from PIL import Image

QUI = Path(__file__).resolve().parent
sys.path.insert(0, str(QUI.parent))
from flockets import simulazione as s  # noqa: E402

TESTO = "Su Instagram, 50 euro al giorno per 2 settimane"
VARIANTI = ["foto_beige", "foto_blu", "foto_scura", "foto_grigia", "foto_senza_offerta"]
TINTE = ["rosso", "arancio", "giallo", "verde", "verde", "verde acqua", "azzurro", "blu", "blu", "viola", "rosa", "rosso"]


def misure(im):
    w0, h0 = im.size
    px = list(im.convert("RGB").resize((48, 48), Image.BILINEAR).getdata())
    n = len(px)
    sl = sl2 = ss = srg = srg2 = syb = syb2 = 0.0
    calde = colorati = 0
    tinte = [0] * 12
    for r, v, b in px:
        lum = (0.2126 * r + 0.7152 * v + 0.0722 * b) / 255
        sl += lum; sl2 += lum * lum
        mx, mn = max(r, v, b), min(r, v, b)
        sat = (mx - mn) / mx if mx else 0
        ss += sat
        rg, yb = r - v, 0.5 * (r + v) - b
        srg += rg; srg2 += rg * rg; syb += yb; syb2 += yb * yb
        if sat > 0.25 and mx > 50:
            dd = mx - mn
            h = ((v - b) / dd) % 6 if mx == r else (b - r) / dd + 2 if mx == v else (r - v) / dd + 4
            h = (h * 60 + 360) % 360
            tinte[int(h // 30)] += 1
            colorati += 1
            calde += h < 70 or h >= 330
    ml, mrg, myb = sl / n, srg / n, syb / n
    ordine = sorted([(q, k) for k, q in enumerate(tinte) if q > n * 0.02], reverse=True)
    rapp = w0 / max(h0, 1)
    return {"luminosita": ml, "contrasto": math.sqrt(max(0, sl2 / n - ml * ml)), "saturazione": ss / n,
            "vivacita": math.sqrt(max(0, srg2 / n - mrg * mrg) + max(0, syb2 / n - myb * myb)) + 0.3 * math.sqrt(mrg * mrg + myb * myb),
            "tinta": "neutro" if colorati / n < 0.08 or not ordine else TINTE[ordine[0][1]], "calda": calde / colorati if colorati else 0,
            "colorati": colorati / n, "formato": "orizzontale" if rapp > 1.15 else "verticale" if rapp < 0.87 else "quadrato", "tipo": "foto"}


def leggi(im):
    im = im.convert("RGB"); im.thumbnail((1024, 1024))
    buf = io.BytesIO(); im.save(buf, "JPEG", quality=82)
    corpo = {"testo": TESTO, "formati": ["video", "immagine", "carosello"], "leve": ["scarcity", "urgency", "black_friday"],
             "immagini": [{"tipo": "image/jpeg", "dati": base64.b64encode(buf.getvalue()).decode()}]}
    req = urllib.request.Request("https://flockets.vercel.app/api/leggi", data=json.dumps(corpo).encode(), headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=90))


def voto(j, testo, canale, formato):
    """Come sul sito (web/js/analisi.js): concretezza, credibilità e invito contati sul testo, adatto al canale dal formato,
    beneficio dalla lettura."""
    import re
    s = testo.lower()
    s = re.sub(r"(\d[\d.,]*)\s*(?:€|euro)\s*(?:al|a|/|ogni|per)\s*(?:giorno|gg|day)", " ", s)
    s = re.sub(r"\b(?:per\s*)?\d+\s*(?:giorni|gg|settiman\w*|mesi?)\b", " ", s)
    conc = min(2, sum(bool(re.search(rx, s)) for rx in (r"\d{1,2}\s*%", r"\d[\d.,]*\s*(?:€|euro)", r"solo (?:oggi|fino|per)|entro |scade|fino a \w+|ultimi \d|\d+\s*(?:ml|pezzi|ore)\b")))
    prova = 2 if re.search(r"\d[\d.]*\s*(?:recensioni|clienti|persone|utenti|giocatori|download|ordini|venduti)|\d(?:[.,]\d)?\s*stelle", s) else 1 if re.search(r"recension|testimonian|consigliat|dermatolog|esperti|premiat|best ?seller|più vendut", s) else 0
    invito = 2 if re.search(r"\b(?:compra|acquista|ordina|scopri|scarica|iscriviti|clicca|prenota|approfitta|non perdere|corri|link in bio|prova ora)\b", s) else 0
    pref = {"social": {"video_breve": 2, "carosello": 2, "immagine": 1, "video": 2}, "video_brevi": {"video_breve": 2, "video": 2}}
    return (j.get("messaggio") or {}).get("beneficio", 1) + conc + prova + invito + pref.get(canale, {}).get(formato, 0)


def campagna(j, vis):
    c = j["campagna"]
    sp = {"testo_annuncio": TESTO + ". " + (j.get("creativita_vista") or {}).get("descrizione", "") + ". Scritte: " + (j.get("creativita_vista") or {}).get("testo_visibile", ""),
          "canale": c["canale"] if c["canale"] != "non_indicato" else "social", "formato": "immagine", "inizio": "2026-11-16",
          "budget_giorno": c["budget_giorno"] or 100, "giorni": c["giorni"] or 14, "obiettivo": c["obiettivo"], "leve": c["leve"], "extra": c["extra"],
          "presentazione": j.get("presentazione"), "visivo": vis}
    sp["forza"] = voto(j, sp["testo_annuncio"], sp["canale"], "immagine")
    if c["categoria"] != "generica":
        sp["categoria_ia"] = c["categoria"]
    if c["sconto_percento"]:
        sp["sconto"] = c["sconto_percento"] / 100
    if c["prezzo"]:
        sp["prezzo"] = c["prezzo"]
    return sp


def risultato(sp):
    r = s.analizza_campagna(sp, consigli=False)
    t = next(p for p in r["pubblici"] if p["tipo"] == r["migliore"])["totali"]
    return t["click"], t["acquisti"]


letture, righe = {}, []
for nome in VARIANTI:
    im = Image.open(QUI / "prove_media" / (nome + ".jpg"))
    letture[nome] = (leggi(im), misure(im))
prima = letture[VARIANTI[0]][0]
base = None
print("%-20s %-8s %6s %6s %6s %5s | %-22s | %-22s" % ("variante", "tinta", "contr.", "vivac.", "luce", "voto", "lettura propria: click / acq", "stessa lettura: click / acq"))
for nome in VARIANTI:
    j, m = letture[nome]
    c1, a1 = risultato(campagna(j, m))
    c2, a2 = risultato(campagna(prima, m))
    base = base or (c1, a1, c2, a2)
    d = lambda x, y: "%+.0f%%" % (100 * (x / y - 1)) if y else "-"
    print("%-20s %-8s %6.2f %6.0f %6.2f %5s | %5.0f %5s  %5.1f %5s | %5.0f %5s  %5.1f %5s" % (
        nome, m["tinta"], m["contrasto"], m["vivacita"], m["luminosita"], (j.get("messaggio") or {}).get("forza"),
        c1, d(c1, base[0]), a1, d(a1, base[1]), c2, d(c2, base[2]), a2, d(a2, base[3])))
    righe.append({"variante": nome, **{k: m[k] for k in ("tinta", "contrasto", "vivacita", "luminosita")}, "voto": campagna(j, m)["forza"],
                  "presentazione": j.get("presentazione"), "click": c1, "acquisti": a1, "click_stessa_lettura": c2, "acquisti_stessa_lettura": a2})
(QUI.parent / "output" / "prova_creativita.json").write_text(json.dumps(righe, ensure_ascii=False, indent=1))
