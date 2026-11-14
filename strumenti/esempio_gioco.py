"""Crea il file di esempio del sito: lo storico di una campagna per un gioco per telefono, INVENTATO.

    python3 strumenti/esempio_gioco.py            # scrive web/data/esempio_gioco.csv

Il file ha la forma di un export di Meta Ads Manager in italiano (una riga per annuncio e giorno), così chi
prova il sito vede che Flockets non è legato ai dati della sfida. I numeri sono generati con una regola
semplice e un seme fisso: non sono dati di nessuna campagna vera.
"""
import csv
import math
import random
from datetime import date, timedelta
from pathlib import Path

USCITA = Path(__file__).resolve().parent.parent / "web" / "data" / "esempio_gioco.csv"
CAMPAGNA = "Torre di Carta - gioco per telefono (esempio inventato)"
INIZIO, GIORNI = date(2026, 10, 5), 42

# gruppo di inserzioni: costo di base ogni 1.000 visualizzazioni, click ogni 100, budget, cambio di budget,
# frequenza di base e grandezza del pubblico (la frequenza sale con le visualizzazioni: +1 ogni 2 x grandezza)
GRUPPI = {
    "Pubblico ampio 18-44, Italia": dict(cpm=4.2, ctr=0.85, budget=120, cambio=(date(2026, 10, 26), 180), freq=1.02, gente=12e6),
    "Interessi: giochi per telefono": dict(cpm=5.8, ctr=1.15, budget=80, cambio=(date(2026, 11, 2), 55), freq=1.03, gente=3e6),
    "Retargeting: visitatori del sito, 30 giorni": dict(cpm=9.5, ctr=2.10, budget=40, cambio=(date(2026, 10, 19), 55), freq=1.15, gente=45e3),
}
# annuncio: qualità della creatività, giorno di lancio, gruppi in cui gira
ANNUNCI = {
    "Trailer di gioco, 15 secondi": (1.00, INIZIO, ["Pubblico ampio 18-44, Italia", "Interessi: giochi per telefono"]),
    "Creator prova il gioco e parla in camera": (1.30, INIZIO, list(GRUPPI)),
    "Immagine: i personaggi e «Scarica gratis»": (0.80, INIZIO, ["Pubblico ampio 18-44, Italia", "Retargeting: visitatori del sito, 30 giorni"]),
    "Carosello: cinque livelli del gioco": (0.90, date(2026, 10, 19), ["Interessi: giochi per telefono"]),
    "Video: sfida a tempo, 30 secondi": (1.15, date(2026, 11, 2), ["Pubblico ampio 18-44, Italia", "Retargeting: visitatori del sito, 30 giorni"]),
}
GIORNO_CPM = [0.97, 0.99, 1.00, 1.00, 1.02, 1.05, 1.04]   # da lunedì a domenica
GIORNO_CTR = [0.98, 1.00, 1.00, 0.99, 1.00, 1.06, 1.07]


def fatica(eta):
    return 0.6 + 0.4 * math.exp(-eta / 20.0)


def poisson(rng, lam):
    if lam > 60:   # approssimazione normale, più che sufficiente qui
        return max(0, int(round(rng.gauss(lam, math.sqrt(lam)))))
    soglia, k, p = math.exp(-lam), 0, 1.0
    while True:
        p *= rng.random()
        if p <= soglia:
            return k
        k += 1


def main():
    rng = random.Random(2026)
    righe = []
    for i in range(GIORNI):
        g = INIZIO + timedelta(days=i)
        dw = g.weekday()
        mercato = 1.0 + 0.004 * i   # il mercato si scalda avvicinandosi a novembre
        for gruppo, P in GRUPPI.items():
            budget = P["budget"]
            dal_cambio = None
            if P["cambio"] and g >= P["cambio"][0]:
                budget, dal_cambio = P["cambio"][1], (g - P["cambio"][0]).days
            attivi = [(nome, q, (g - lancio).days) for nome, (q, lancio, dove) in ANNUNCI.items() if gruppo in dove and g >= lancio]
            pesi = [q ** 1.4 * (1.6 if eta < 4 else 1.0) * fatica(eta) for _, q, eta in attivi]
            freq = P["freq"] + budget / P["cpm"] * 1000 / (2 * P["gente"])   # frequenza del giorno per tutto il gruppo
            for (nome, q, eta), w in zip(attivi, pesi):
                spesa = budget * 0.97 * w / sum(pesi) * rng.lognormvariate(0, 0.04)
                cpm = (P["cpm"] * GIORNO_CPM[dw] * mercato * (budget / P["budget"]) ** 0.25 * q ** -0.3 * fatica(eta) ** -0.4
                       * (1.13 if eta < 3 else 1.0) * (1.06 if dal_cambio is not None and dal_cambio < 3 else 1.0)
                       * rng.lognormvariate(0, 0.07))
                impression = int(round(spesa / cpm * 1000))
                ctr = P["ctr"] / 100 * q * fatica(eta) * GIORNO_CTR[dw] * rng.lognormvariate(0, 0.06)
                click = poisson(rng, impression * ctr)
                copertura = int(round(impression / (freq * rng.lognormvariate(0, 0.0003))))
                righe.append([g.isoformat(), CAMPAGNA, gruppo, nome, budget, "%.2f" % spesa, impression, copertura, click])
    USCITA.parent.mkdir(parents=True, exist_ok=True)
    with USCITA.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["Giorno", "Nome della campagna", "Nome del gruppo di inserzioni", "Nome dell'inserzione",
                    "Budget del gruppo di inserzioni", "Importo speso (EUR)", "Impression", "Copertura", "Clic sul link"])
        w.writerows(righe)
    print("scritto %s: %d righe, dal %s al %s" % (USCITA, len(righe), INIZIO, INIZIO + timedelta(days=GIORNI - 1)))


if __name__ == "__main__":
    main()
