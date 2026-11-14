"""Popolazione sintetica: tutti i tipi di persona possibili e la conversione dei loro tag in numeri.

Una persona e descritta da 8 tag (eta, genere, area, tipo di comune, istruzione, lavoro, reddito, famiglia).
Ogni combinazione di tag e un «tipo di persona»: 6 x 2 x 5 x 3 x 3 x 4 x 3 x 4 = 25.920 combinazioni.
Quelle impossibili (uno studente di 70 anni, un pensionato di 30) pesano zero e vengono tolte.

Per ogni tipo di persona il modulo calcola:
- il PESO: quante persone adulte in Italia gli somigliano. Le quote per eta, genere, area, istruzione, lavoro,
  famiglia e reddito sono approssimazioni ragionate degli ordini di grandezza ISTAT ed Eurostat, non tabelle
  ufficiali: stanno tutte in questo file e si possono sostituire con quelle vere;
- circa 45 PARAMETRI NUMERICI che il simulatore usa: quanto usa ogni canale, quanto e interessato a ogni
  categoria di prodotto, quanto reagisce a ogni leva, quale formato preferisce, quanto compra online, quanto
  puo spendere, quanto costa raggiungerlo.

La regola di conversione e sempre la stessa, ed e leggibile: si parte da un valore di base e ogni tag lo sposta
di una quantita fissa (somma sulla scala logistica per le probabilita, prodotto per i moltiplicatori).
"""
import itertools

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------------------------- i tag
DIMENSIONI = {
    "eta": ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"],
    "genere": ["donna", "uomo"],
    "area": ["nord_ovest", "nord_est", "centro", "sud", "isole"],
    "comune": ["grande_citta", "citta_media", "piccolo_comune"],
    "istruzione": ["bassa", "media", "alta"],
    "lavoro": ["studente", "occupato", "pensionato", "non_occupato"],
    "reddito": ["basso", "medio", "alto"],
    "famiglia": ["single", "coppia", "figli_piccoli", "figli_grandi"],
}
ETICHETTE = {
    "18-24": "18-24 anni", "25-34": "25-34 anni", "35-44": "35-44 anni", "45-54": "45-54 anni", "55-64": "55-64 anni", "65+": "65 anni e più",
    "donna": "donna", "uomo": "uomo",
    "nord_ovest": "Nord-Ovest", "nord_est": "Nord-Est", "centro": "Centro", "sud": "Sud", "isole": "Isole",
    "grande_citta": "grande città", "citta_media": "città media", "piccolo_comune": "piccolo comune",
    "bassa": "istruzione di base", "media": "diploma", "alta": "laurea",
    "studente": "studente", "occupato": "lavora", "pensionato": "pensionato", "non_occupato": "non lavora",
    "basso": "reddito basso", "medio": "reddito medio", "alto": "reddito alto",
    "single": "senza partner né figli", "coppia": "in coppia senza figli", "figli_piccoli": "con figli piccoli", "figli_grandi": "con figli grandi",
}
REGIONI = {   # per dare un nome concreto all'area nelle schede delle persone (peso = popolazione approssimata)
    "nord_ovest": {"Lombardia": 10.0, "Piemonte": 4.2, "Liguria": 1.5, "Valle d'Aosta": 0.1},
    "nord_est": {"Veneto": 4.8, "Emilia-Romagna": 4.4, "Friuli-Venezia Giulia": 1.2, "Trentino-Alto Adige": 1.1},
    "centro": {"Lazio": 5.7, "Toscana": 3.7, "Marche": 1.5, "Umbria": 0.9},
    "sud": {"Campania": 5.6, "Puglia": 3.9, "Calabria": 1.8, "Abruzzo": 1.3, "Basilicata": 0.5, "Molise": 0.3},
    "isole": {"Sicilia": 4.8, "Sardegna": 1.6},
}

# ------------------------------------------------------------------------------- quanti sono (pesi)
ADULTI_ITALIA = 50.1e6
P_ETA = [0.082, 0.126, 0.145, 0.185, 0.177, 0.285]
P_DONNA = [0.48, 0.49, 0.50, 0.505, 0.515, 0.56]                   # per fascia di eta
P_AREA = [0.268, 0.194, 0.198, 0.229, 0.111]
P_COMUNE = {"nord_ovest": [0.24, 0.30, 0.46], "nord_est": [0.17, 0.30, 0.53], "centro": [0.30, 0.28, 0.42],
            "sud": [0.20, 0.33, 0.47], "isole": [0.22, 0.32, 0.46]}
P_ISTRUZIONE = [[0.25, 0.65, 0.10], [0.22, 0.48, 0.30], [0.30, 0.45, 0.25],      # bassa, media, alta per eta
                [0.40, 0.42, 0.18], [0.50, 0.36, 0.14], [0.70, 0.22, 0.08]]
P_LAVORO = [[0.55, 0.30, 0.00, 0.15], [0.08, 0.70, 0.00, 0.22], [0.00, 0.75, 0.00, 0.25],   # studente, occupato, pensionato, non occupato
            [0.00, 0.73, 0.00, 0.27], [0.00, 0.55, 0.20, 0.25], [0.00, 0.06, 0.88, 0.06]]
P_FAMIGLIA = [[0.88, 0.08, 0.04, 0.00], [0.45, 0.25, 0.30, 0.00], [0.22, 0.15, 0.53, 0.10],  # single, coppia, figli piccoli, figli grandi
              [0.18, 0.15, 0.25, 0.42], [0.22, 0.40, 0.05, 0.33], [0.40, 0.48, 0.00, 0.12]]
# reddito familiare in terzi nazionali: modello ordinato su istruzione, lavoro, area ed eta
REDDITO_PUNTI = {"istruzione": [-0.6, 0.0, 0.8], "lavoro": [-0.2, 0.4, 0.0, -0.9],
                 "area": [0.35, 0.35, 0.15, -0.45, -0.5], "eta": [0.0, -0.2, 0.0, 0.2, 0.2, 0.0]}

# ---------------------------------------------------------------------------------------------- canali
CANALI = ["social", "video_brevi", "ricerca", "shopping", "display", "video", "email"]
NOMI_CANALI = {"social": "Social (Facebook, Instagram)", "video_brevi": "Video brevi (TikTok, Reels, Shorts)",
               "ricerca": "Ricerca (Google)", "shopping": "Annunci prodotto (Google Shopping)",
               "display": "Banner su siti e app", "video": "Video (YouTube)", "email": "Email e newsletter"}
USO = {   # probabilita di usare il canale in un giorno qualsiasi, per fascia di eta
    "social": [0.85, 0.85, 0.80, 0.72, 0.58, 0.32],
    "video_brevi": [0.85, 0.65, 0.45, 0.32, 0.20, 0.08],
    "ricerca": [0.90, 0.90, 0.88, 0.82, 0.72, 0.45],
    "display": [0.85, 0.85, 0.82, 0.78, 0.68, 0.42],
    "video": [0.80, 0.72, 0.62, 0.55, 0.45, 0.28],
    "email": [0.40, 0.60, 0.66, 0.64, 0.56, 0.36],
}
USO_MOD = {   # spostamenti moltiplicativi per tag
    "istruzione": {"bassa": 0.88, "alta": 1.08}, "comune": {"piccolo_comune": 0.95, "grande_citta": 1.03},
    "genere": {"donna": {"social": 1.05, "video": 0.94}, "uomo": {"social": 0.95, "video": 1.06}},
}
ANNUNCI_AL_GIORNO = [190, 170, 140, 115, 90, 55]                    # saturazione pubblicitaria, per eta

# ------------------------------------------------------------------------------ categorie di prodotto
CATEGORIE = ["moda", "beauty", "animali", "videogiochi", "tecnologia", "casa_arredo", "cibo_bevande", "sport_fitness",
             "viaggi", "salute_benessere", "bambini_famiglia", "auto_moto", "finanza", "formazione_lavoro", "intrattenimento"]
NOMI_CATEGORIE = {"moda": "moda e abbigliamento", "beauty": "bellezza e cura della pelle", "animali": "animali domestici",
                  "videogiochi": "videogiochi", "tecnologia": "tecnologia ed elettronica", "casa_arredo": "casa e arredo",
                  "cibo_bevande": "cibo e bevande", "sport_fitness": "sport e fitness", "viaggi": "viaggi", "salute_benessere": "salute e benessere",
                  "bambini_famiglia": "bambini e famiglia", "auto_moto": "auto e moto", "finanza": "finanza e assicurazioni",
                  "formazione_lavoro": "corsi e lavoro", "intrattenimento": "cultura e intrattenimento"}
# interesse: valore di base (scala logistica) e spostamenti per tag. Probabilita = 1 / (1 + exp(-somma))
INTERESSE = {
    "moda": {"base": -0.6, "eta": [0.5, 0.4, 0.1, -0.1, -0.4, -0.8], "genere": {"donna": 0.6}, "reddito": {"basso": -0.3, "alto": 0.3}, "comune": {"grande_citta": 0.2}},
    "beauty": {"base": -1.1, "eta": [0.5, 0.4, 0.2, 0.0, -0.3, -0.7], "genere": {"donna": 1.4}, "reddito": {"alto": 0.2}},
    "animali": {"base": -0.5, "eta": [0.1, 0.1, 0.1, 0.1, 0.0, -0.3], "famiglia": {"figli_piccoli": 0.2, "figli_grandi": 0.3, "single": -0.1}, "comune": {"piccolo_comune": 0.2, "grande_citta": -0.15}},
    "videogiochi": {"base": -1.1, "eta": [1.3, 0.9, 0.4, -0.2, -0.8, -1.5], "genere": {"uomo": 0.7}, "famiglia": {"figli_grandi": 0.3}, "lavoro": {"studente": 0.5}},
    "tecnologia": {"base": -0.7, "eta": [0.4, 0.4, 0.2, 0.0, -0.3, -0.7], "genere": {"uomo": 0.6}, "istruzione": {"alta": 0.4, "bassa": -0.3}, "reddito": {"alto": 0.3, "basso": -0.2}},
    "casa_arredo": {"base": -0.7, "eta": [-0.6, 0.1, 0.3, 0.3, 0.2, -0.2], "genere": {"donna": 0.2}, "famiglia": {"coppia": 0.3, "figli_piccoli": 0.3, "figli_grandi": 0.2}, "reddito": {"alto": 0.3, "basso": -0.2}},
    "cibo_bevande": {"base": 0.0, "eta": [0.1, 0.1, 0.1, 0.1, 0.0, -0.2], "genere": {"donna": 0.2}, "famiglia": {"figli_piccoli": 0.2}},
    "sport_fitness": {"base": -0.6, "eta": [0.4, 0.4, 0.2, 0.0, -0.3, -0.7], "genere": {"uomo": 0.2}, "istruzione": {"alta": 0.2}},
    "viaggi": {"base": -0.6, "eta": [0.1, 0.3, 0.1, 0.1, 0.1, -0.1], "reddito": {"alto": 0.6, "basso": -0.5}, "istruzione": {"alta": 0.4}, "famiglia": {"coppia": 0.2}},
    "salute_benessere": {"base": -0.5, "eta": [-0.3, -0.1, 0.0, 0.2, 0.4, 0.4], "genere": {"donna": 0.4}},
    "bambini_famiglia": {"base": -2.2, "eta": [-0.3, 0.3, 0.4, 0.1, -0.2, 0.0], "famiglia": {"figli_piccoli": 3.0, "figli_grandi": 0.6}},
    "auto_moto": {"base": -1.0, "eta": [0.1, 0.2, 0.2, 0.2, 0.0, -0.4], "genere": {"uomo": 0.8}, "comune": {"piccolo_comune": 0.2, "grande_citta": -0.2}},
    "finanza": {"base": -1.1, "eta": [-0.5, 0.1, 0.4, 0.4, 0.3, 0.0], "genere": {"uomo": 0.3}, "reddito": {"alto": 0.5, "basso": -0.4}, "istruzione": {"alta": 0.3}},
    "formazione_lavoro": {"base": -1.1, "eta": [0.6, 0.5, 0.2, 0.0, -0.4, -1.2], "lavoro": {"studente": 1.2, "non_occupato": 0.8}, "istruzione": {"alta": 0.3}},
    "intrattenimento": {"base": -0.3, "eta": [0.4, 0.3, 0.1, 0.0, -0.1, -0.3], "comune": {"grande_citta": 0.2}, "istruzione": {"alta": 0.2}},
}
# quota di interessati che in un mese qualsiasi sta comprando o cercando qualcosa della categoria
IN_CERCA_AL_MESE = {"moda": 0.30, "beauty": 0.35, "animali": 0.55, "videogiochi": 0.25, "tecnologia": 0.10, "casa_arredo": 0.12,
                    "cibo_bevande": 0.60, "sport_fitness": 0.18, "viaggi": 0.10, "salute_benessere": 0.25, "bambini_famiglia": 0.40,
                    "auto_moto": 0.04, "finanza": 0.04, "formazione_lavoro": 0.06, "intrattenimento": 0.30}

# --------------------------------------------------------------------------------------------- leve
LEVE = ["sconto", "urgenza", "scarsita", "prova_sociale", "novita", "esperto", "valori"]
NOMI_LEVE = {"sconto": "sconto o prezzo basso", "urgenza": "urgenza (solo oggi, scade)", "scarsita": "scarsità (ultimi pezzi)",
             "prova_sociale": "prova sociale (recensioni, «lo usano tutti»)", "novita": "novità e tendenza",
             "esperto": "parere di un esperto", "valori": "valori (sostenibile, made in Italy)"}

# -------------------------------------------------------------------------------------------- formati
FORMATI = ["immagine", "carosello", "video_breve", "video", "testo"]
PREFERENZA_FORMATO = {   # spostamento sulla scala logistica del click, per eta
    "immagine": [-0.10, -0.05, 0.0, 0.05, 0.10, 0.15], "carosello": [0.0, 0.05, 0.05, 0.05, 0.0, -0.10],
    "video_breve": [0.35, 0.20, 0.05, -0.05, -0.20, -0.35], "video": [0.10, 0.05, 0.0, 0.0, 0.0, -0.05], "testo": [0.0] * 6,
}


def _sig(x):
    return 1.0 / (1.0 + np.exp(-x))


def _logit(p):
    p = np.clip(p, 1e-6, 1 - 1e-6)
    return np.log(p / (1 - p))


_CACHE = {}


def popolazione():
    """Tutti i tipi di persona possibili, con il loro peso e i parametri numerici. Una riga per tipo."""
    if "pop" in _CACHE:
        return _CACHE["pop"].copy()
    nomi = list(DIMENSIONI)
    idx = np.array(list(itertools.product(*[range(len(DIMENSIONI[n])) for n in nomi])))
    I = {n: idx[:, j] for j, n in enumerate(nomi)}
    e, g, ar, co, ist, la, re, fa = (I[n] for n in nomi)

    # ---- peso: catena di quote condizionate
    p_istr = np.array(P_ISTRUZIONE)[e, ist].copy()
    p_istr *= np.where((g == 0) & (e < 4), np.array([1.0, 1.0, 1.25])[ist], np.where(g == 1, np.array([1.0, 1.0, 0.8])[ist], 1.0))
    p_istr *= np.where(ar >= 3, np.array([1.15, 1.0, 0.85])[ist], np.where(ar == 1, np.array([0.95, 1.0, 1.05])[ist], 1.0))
    p_lav = np.array(P_LAVORO)[e, la].copy()
    p_lav *= np.where(g == 0, np.array([1.0, 0.85, 1.0, 1.5])[la], 1.0)
    p_lav *= np.where(ar >= 3, np.array([1.0, 0.85, 1.0, 1.55])[la], 1.0)
    w0 = (ADULTI_ITALIA * np.array(P_ETA)[e] * np.where(g == 0, np.array(P_DONNA)[e], 1 - np.array(P_DONNA)[e])
          * np.array(P_AREA)[ar] * np.array([P_COMUNE[a] for a in DIMENSIONI["area"]])[ar, co] * np.array(P_FAMIGLIA)[e, fa])
    # le quote di istruzione e lavoro vanno rinormalizzate dentro (eta, genere, area)
    chiave = e * 100 + g * 10 + ar
    somma_i = pd.Series(p_istr).groupby([chiave, la, re, co, fa]).transform("sum").values
    somma_l = pd.Series(p_lav).groupby([chiave, ist, re, co, fa]).transform("sum").values
    w0 = w0 * p_istr / np.where(somma_i > 0, somma_i, 1) * p_lav / np.where(somma_l > 0, somma_l, 1)
    # reddito: modello ordinato, soglie scelte perche ogni terzo pesi un terzo
    punti = (np.array(REDDITO_PUNTI["istruzione"])[ist] + np.array(REDDITO_PUNTI["lavoro"])[la]
             + np.array(REDDITO_PUNTI["area"])[ar] + np.array(REDDITO_PUNTI["eta"])[e])

    def quote(c1, c2):
        pb = _sig(c1 - punti)
        pa = _sig(punti - c2)
        return pb, np.clip(1 - pb - pa, 0, 1), pa
    base = w0 / 3.0   # ogni riga di reddito porta un terzo del peso senza reddito
    c1, c2 = -0.3, 0.3
    for _ in range(60):   # aggiusta le soglie
        pb, pm, pa = quote(c1, c2)
        tb = np.sum(base[re == 0] * pb[re == 0]) / np.sum(base[re == 0])
        ta = np.sum(base[re == 2] * pa[re == 2]) / np.sum(base[re == 2])
        c1 += 0.8 * (1 / 3 - tb)
        c2 -= 0.8 * (1 / 3 - ta)
    pb, pm, pa = quote(c1, c2)
    peso = w0 * np.choose(re, [pb, pm, pa])

    P = pd.DataFrame({n: np.array(DIMENSIONI[n])[I[n]] for n in nomi})
    P["peso"] = peso
    tieni = peso > 50   # meno di 50 persone in tutta Italia: combinazione impossibile o trascurabile
    P, I = P[tieni].reset_index(drop=True), {n: v[tieni] for n, v in I.items()}
    e, g, ar, co, ist, la, re, fa = (I[n] for n in nomi)
    P["peso"] *= ADULTI_ITALIA / P.peso.sum()

    # ---- canali
    for c, per_eta in USO.items():
        u = np.array(per_eta)[e] * np.where(ist == 0, USO_MOD["istruzione"]["bassa"], np.where(ist == 2, USO_MOD["istruzione"]["alta"], 1.0))
        u = u * np.where(co == 2, USO_MOD["comune"]["piccolo_comune"], np.where(co == 0, USO_MOD["comune"]["grande_citta"], 1.0))
        u = u * np.where(g == 0, USO_MOD["genere"]["donna"].get(c, 1.0), USO_MOD["genere"]["uomo"].get(c, 1.0))
        P["uso_" + c] = np.clip(u, 0.01, 0.97)
    acquisto_online = np.array([0.70, 0.78, 0.74, 0.65, 0.52, 0.28])[e] + np.array([-0.10, 0.0, 0.08])[ist] \
        + np.array([0.03, 0.03, 0.0, -0.05, -0.05])[ar] + np.array([-0.05, 0.0, 0.05])[re]
    P["acquisto_online"] = np.clip(acquisto_online, 0.05, 0.95)
    P["uso_shopping"] = np.clip(P.uso_ricerca * P.acquisto_online, 0.01, 0.95)   # cerca prodotti su Google
    P["saturazione"] = np.array(ANNUNCI_AL_GIORNO)[e] / max(ANNUNCI_AL_GIORNO)

    # ---- interesse per categoria
    for cat, r in INTERESSE.items():
        x = np.full(len(P), r["base"]) + np.array(r["eta"])[e]
        for tag, livelli in (("genere", g), ("famiglia", fa), ("reddito", re), ("istruzione", ist), ("comune", co), ("lavoro", la)):
            if tag in r:
                x = x + np.array([r[tag].get(v, 0.0) for v in DIMENSIONI[tag]])[livelli]
        P["int_" + cat] = _sig(x)

    # ---- sensibilita alle leve (0 = indifferente, 1 = molto sensibile)
    giov = np.array([0.15, 0.10, 0.05, 0.0, -0.05, -0.12])[e]
    P["sens_sconto"] = np.clip(np.array([0.80, 0.55, 0.30])[re] + np.where(la == 0, 0.10, 0.0) + np.where(fa >= 2, 0.08, 0.0) + np.where(e == 5, 0.05, 0.0), 0.05, 0.98)
    P["sens_urgenza"] = np.clip(0.5 + giov, 0.05, 0.95)
    P["sens_scarsita"] = np.clip(0.5 + 0.6 * giov + np.where(g == 0, 0.04, 0.0), 0.05, 0.95)
    P["sens_prova_sociale"] = np.clip(0.55 + np.where((e >= 1) & (e <= 2), 0.10, 0.0) + np.where(ist == 2, 0.05, 0.0), 0.05, 0.95)
    P["sens_novita"] = np.clip(np.array([0.75, 0.65, 0.50, 0.40, 0.30, 0.20])[e] + np.where(ist == 2, 0.05, 0.0)
                               + np.where(co == 0, 0.08, 0.0) + np.where(re == 2, 0.05, 0.0), 0.05, 0.95)
    P["sens_esperto"] = np.clip(0.5 + np.where(e >= 3, 0.10, 0.0) + np.where(ist == 2, 0.05, 0.0), 0.05, 0.95)
    P["sens_valori"] = np.clip(0.45 + np.where(ist == 2, 0.10, 0.0) + np.where(g == 0, 0.05, 0.0) + np.where(e <= 1, 0.05, 0.0), 0.05, 0.95)

    # ---- formati
    for f, per_eta in PREFERENZA_FORMATO.items():
        P["pref_" + f] = np.array(per_eta)[e]

    # ---- acquisto
    P["mobile"] = np.clip(np.array([0.90, 0.85, 0.78, 0.70, 0.62, 0.55])[e], 0, 1)
    P["fiducia_nuovi_marchi"] = np.clip(np.array([0.60, 0.55, 0.50, 0.45, 0.38, 0.30])[e] + np.where(ist == 2, 0.05, 0.0), 0.05, 0.95)
    potere = np.array([0.6, 1.0, 1.7])[re] * np.array([1.0, 1.1, 0.9, 0.9])[fa] * np.where(la == 0, 0.7, 1.0)
    P["potere_acquisto"] = potere
    # quanto costa raggiungerla: piu inserzionisti cercano le stesse persone, piu il CPM sale
    costo = (np.array([0.80, 1.20, 1.20, 1.05, 0.90, 0.75])[e] * np.array([0.90, 1.0, 1.15])[re]
             * np.where(g == 0, 1.08, 0.95) * np.array([1.10, 1.0, 0.92])[co])
    P["costo_relativo"] = costo / np.average(costo, weights=P.peso)
    P.insert(0, "id", np.arange(len(P)))
    _CACHE["pop"] = P
    return P.copy()


def parametri():
    """Elenco leggibile dei parametri numerici di ogni persona: nome, significato, intervallo, da quali tag dipende."""
    righe = [("peso", "quante persone adulte in Italia somigliano a questo tipo", "persone", "tutti i tag")]
    for c in CANALI:
        righe.append(("uso_" + c, "probabilità di usare in un giorno: " + NOMI_CANALI[c], "0-1", "età, istruzione, comune, genere"
                      + (", acquisti online" if c == "shopping" else "")))
    righe.append(("saturazione", "quanti annunci vede al giorno, rispetto al massimo", "0-1", "età"))
    for cat in CATEGORIE:
        righe.append(("int_" + cat, "probabilità di essere interessato a " + NOMI_CATEGORIE[cat], "0-1",
                      ", ".join(["età"] + [t for t in ("genere", "famiglia", "reddito", "istruzione", "comune", "lavoro") if t in INTERESSE[cat]])))
    for lv in LEVE:
        righe.append(("sens_" + lv, "quanto reagisce a: " + NOMI_LEVE[lv], "0-1", "età, reddito, istruzione, genere, famiglia"))
    for f in FORMATI:
        righe.append(("pref_" + f, "preferenza per il formato " + f.replace("_", " "), "spostamento", "età"))
    righe += [("acquisto_online", "probabilità di comprare online almeno una volta al mese", "0-1", "età, istruzione, area, reddito"),
              ("mobile", "quota di navigazione da telefono", "0-1", "età"),
              ("fiducia_nuovi_marchi", "disponibilità a comprare da un marchio che non conosce", "0-1", "età, istruzione"),
              ("potere_acquisto", "quanto può spendere rispetto alla media", "moltiplicatore", "reddito, famiglia, lavoro"),
              ("costo_relativo", "quanto costa raggiungerla rispetto alla media (concorrenza tra inserzionisti)", "moltiplicatore", "età, reddito, genere, comune")]
    return pd.DataFrame(righe, columns=["parametro", "significato", "valori", "dipende_da"])


def descrivi(riga):
    """Frase breve per un tipo di persona."""
    return "%s, %s, %s (%s), %s, %s, %s, %s" % (
        ETICHETTE[riga["genere"]].capitalize(), ETICHETTE[riga["eta"]], ETICHETTE[riga["area"]], ETICHETTE[riga["comune"]],
        ETICHETTE[riga["istruzione"]], ETICHETTE[riga["lavoro"]], ETICHETTE[riga["reddito"]], ETICHETTE[riga["famiglia"]])
