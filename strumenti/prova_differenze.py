"""Banco delle piccole differenze: una campagna di base e tante varianti, ognuna con un solo dettaglio cambiato.

Per ogni variante controlla che l'effetto vada nel verso atteso e abbia una grandezza credibile (né zero, né enorme).
Gli intervalli sono ordini di grandezza da regole generali della pubblicità, non misure.

Uso: python3 strumenti/prova_differenze.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from flockets import simulazione as s  # noqa: E402

BASE = {"categoria": "beauty", "canale": "social", "formato": "immagine", "prezzo": 35, "marchio": "conosciuto", "budget_giorno": 100,
        "giorni": 14, "inizio": "2026-10-05", "pubblico": {"tipo": "ampio"}}
VIDEO = {**BASE, "formato": "video_breve"}

# (nome, variante, base, metrica, verso, minimo e massimo della variazione relativa in valore assoluto)
VARIANTI = [
    ("sconto 20%", {"sconto": 0.2, "leve": ["sconto"]}, BASE, "acquisti", +1, 0.10, 0.80),
    ("prezzo doppio", {"prezzo": 70}, BASE, "acquisti", -1, 0.15, 0.70),
    ("prezzo metà", {"prezzo": 17.5}, BASE, "acquisti", +1, 0.05, 0.60),
    ("urgenza", {"leve": ["urgenza"]}, BASE, "ctr", +1, 0.01, 0.25),
    ("prova sociale", {"leve": ["prova_sociale"]}, BASE, "ctr", +1, 0.01, 0.25),
    ("volto in primo piano", {"presentazione": {"volto": True}}, BASE, "ctr", +1, 0.02, 0.15),
    ("sottotitoli nel video", {"presentazione": {"sottotitoli": True}}, VIDEO, "ctr", +1, 0.02, 0.15),
    ("messaggio forte (8 vs 5)", {"forza": 8}, {**BASE, "forza": 5}, "ctr", +1, 0.05, 0.40),
    ("messaggio debole (2 vs 5)", {"forza": 2}, {**BASE, "forza": 5}, "ctr", -1, 0.05, 0.40),
    ("aggancio nei primi 2 secondi", {"creativita": {"hook": 1}}, VIDEO, "ctr", +1, 0.02, 0.40),
    ("persona che parla in camera", {"creativita": {"ugc": 1}}, VIDEO, "ctr", +1, 0.02, 0.40),
    ("video di marca lento", {"creativita": {"brand_lento": 1}}, VIDEO, "ctr", -1, 0.02, 0.40),
    ("spedizione gratuita", {"extra": ["spedizione_gratuita"]}, BASE, "acquisti", +1, 0.03, 0.20),
    ("tre vantaggi", {"extra": ["spedizione_gratuita", "reso_gratuito", "garanzia"]}, BASE, "acquisti", +1, 0.10, 0.40),
    ("marchio nuovo", {"marchio": "nuovo"}, BASE, "acquisti", -1, 0.10, 0.60),
    ("marchio famoso", {"marchio": "famoso"}, BASE, "acquisti", +1, 0.10, 0.80),
    ("budget doppio: costo", {"budget_giorno": 200}, BASE, "cpm", +1, 0.05, 0.40),
    ("budget doppio: risultati", {"budget_giorno": 200}, BASE, "acquisti", +1, 0.50, 0.99),
    ("campagna lunga: stanchezza", {"giorni": 42}, BASE, "ctr", -1, 0.03, 0.40),
    ("sito lento (qualità 0,5)", {"qualita_sito": 0.5}, BASE, "acquisti", -1, 0.15, 0.60),
    ("categoria di moda", {"trend": 1.6}, BASE, "acquisti", +1, 0.05, 0.80),
    ("settimana del Black Friday: costo", {"inizio": "2026-11-20", "giorni": 7}, {**BASE, "inizio": "2026-10-09", "giorni": 7}, "cpm", +1, 0.05, 0.60),
    ("settimana del Black Friday: acquisti per click", {"inizio": "2026-11-20", "giorni": 7}, {**BASE, "inizio": "2026-10-09", "giorni": 7}, "conversione", +1, 0.05, 0.60),
    ("video breve invece di immagine", {"formato": "video_breve"}, BASE, "ctr", +1, 0.01, 0.40),
    ("solo donne (crema viso)", {"filtri": {"genere": ["donna"]}}, BASE, "ctr", +1, 0.03, 0.60),
    ("solo uomini (crema viso)", {"filtri": {"genere": ["uomo"]}}, BASE, "ctr", -1, 0.10, 0.80),
    ("retargeting invece di ampio", {"pubblico": {"tipo": "retargeting"}}, BASE, "conversione", +1, 0.10, 1.50),
    ("contatto invece di acquisto", {"conversione": "contatto"}, BASE, "acquisti", +1, 0.30, 5.0),
    ("pubblico tipico giovane (profilo)", {"profilo": {"pubblico_tipico": {"eta": ["18-24", "25-34"]}}, "filtri": {"eta": ["18-24", "25-34"]}},
     {**BASE, "filtri": {"eta": ["18-24", "25-34"]}}, "ctr", +1, 0.02, 0.60),
    ("prodotto caro per la categoria (profilo)", {"profilo": {"prezzo_tipico": 300}, "prezzo": 300}, BASE, "conversione", -1, 0.30, 0.95),
    ("zona locale: più vicinanza", {"zona": {"descrizione": "Bologna", "persone": 400000}, "filtri": {"area": ["nord_est"]}},
     {**BASE, "filtri": {"area": ["nord_est"]}}, "conversione", +1, 0.05, 0.60),
]


def main():
    cache, male = {}, 0
    for nome, cambio, base, metrica, verso, lo, hi in VARIANTI:
        kb = repr(sorted(base.items()))
        if kb not in cache:
            cache[kb] = s.simula(base, dettaglio=False)["totali"]
        a = cache[kb][metrica]
        b = s.simula({**base, **cambio}, dettaglio=False)["totali"][metrica]
        d = b / a - 1 if a else 0.0
        ok = (d * verso > 0) and lo <= abs(d) <= hi
        male += not ok
        print("%-48s %-11s %+7.1f%%   %s" % (nome, metrica, 100 * d, "ok" if ok else "DA RIVEDERE (atteso %s%d-%d%%)" % ("+" if verso > 0 else "-", 100 * lo, 100 * hi)))
    print("\nvarianti da rivedere: %d su %d" % (male, len(VARIANTI)))


if __name__ == "__main__":
    main()
