"""Simulazione di una campagna su tutti i tipi di persona: chi la vede, chi clicca, chi visita il sito, chi compra.

Funziona anche su una campagna del tutto nuova, senza nessun dato passato. Gli ingredienti sono tre:
1. la popolazione sintetica (`persone.py`): ogni tipo di persona con il suo peso e i suoi parametri numerici;
2. valori reali di partenza (`benchmark.json`, dal dataset pubblico Conjura): CTR e CPM tipici di ogni canale,
   acquisti ogni 100 visite e valore dell'ordine per settore, andamento nei mesi dell'anno;
3. i fattori comuni stimati dal modello di previsione (`valori_base.json`): giorno della settimana, stanchezza
   delle creatività, effetto del budget sul costo, fase di avvio, peso delle caratteristiche creative.

Per ogni tipo di persona e per ogni giorno:
    persone raggiungibili = peso x quota nel pubblico scelto x uso del canale
    visualizzazioni       = il budget del giorno, diviso dalla piattaforma tra le persone (preferisce quelle che
                            rispondono meglio all'obiettivo e costano meno), con un tetto di frequenza
    costo                 = CPM del canale x costo relativo della persona x stagione x giorno x pressione sul pubblico
    click                 = visualizzazioni x probabilità di click (interesse, momento d'acquisto, formato, leve,
                            creatività, marchio, tendenza, stanchezza)
    visite                = click x probabilità che il sito si apra
    acquisti              = visite x probabilità di comprare (intenzione, prezzo rispetto a quanto può spendere,
                            abitudine all'acquisto online, sconto, fiducia nel marchio, telefono o computer)
Le costanti di ogni canale e settore sono tarate perché la campagna di riferimento (pubblico ampio, creatività
normale, nessuna leva) dia esattamente i valori tipici reali. Tutto il resto sono differenze tra persone.

La forchetta di una campagna nuova è larga di proposito: è quanto differiscono tra loro le marche vere.
"""
import json
import math
import re
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

from . import persone as pe

_QUI = Path(__file__).resolve().parent
BENCH = json.loads((_QUI / "benchmark.json").read_text())
BASE = json.loads((_QUI / "valori_base.json").read_text()) if (_QUI / "valori_base.json").exists() else None

CANALI = {   # formati possibili, frequenza massima al giorno, acquisti per click rispetto alla media del sito (ipotesi)
    # click_link: sui social il dataset reale conta tutti i click (anche su «mi piace», commenti, profilo); il CTR degli
    # annunci si misura sui click verso il sito, circa la metà (ipotesi dichiarata: 0,55)
    "social": {"formati": ["immagine", "carosello", "video_breve", "video"], "freq_max": 3.0, "conv": 0.6, "click_link": 0.55},
    "video_brevi": {"formati": ["video_breve"], "freq_max": 4.0, "conv": 0.5},
    "ricerca": {"formati": ["testo"], "freq_max": 2.0, "conv": 1.4},
    "shopping": {"formati": ["immagine"], "freq_max": 2.0, "conv": 1.3},
    "display": {"formati": ["immagine", "video"], "freq_max": 5.0, "conv": 0.4},
    "video": {"formati": ["video"], "freq_max": 3.0, "conv": 0.4},
    "email": {"formati": ["immagine", "testo"], "freq_max": 1.0, "conv": 1.5},
}
# l'email non è nel dataset Conjura: valori dichiarati come ipotesi (click per 100 email aperte, costo per 1.000 invii)
EMAIL = {"ctr": [1.0, 2.0, 3.5], "cpm_eur": [0.5, 1.0, 2.0], "sd_log_ctr": 0.5, "sd_log_cpm": 0.5}
PREZZO_TIPICO = {"moda": 60, "beauty": 35, "animali": 45, "videogiochi": 30, "tecnologia": 250, "casa_arredo": 120,
                 "cibo_bevande": 35, "sport_fitness": 60, "viaggi": 600, "salute_benessere": 35, "bambini_famiglia": 45,
                 "auto_moto": 150, "finanza": 120, "formazione_lavoro": 250, "intrattenimento": 25, "generica": 50}
OBIETTIVI = {"vendite": 0.5, "traffico": 0.5, "notorieta": 0.15}   # quanto la piattaforma insegue chi risponde
MARCHIO = {   # quota di persone che conoscono già il marchio, pubblico di chi ha visitato il sito (ultimi 30 giorni), iscritti email
    "nuovo": {"noto": 0.03, "visitatori": 0.0005, "iscritti": 0.001},
    "conosciuto": {"noto": 0.25, "visitatori": 0.004, "iscritti": 0.01},
    "famoso": {"noto": 0.70, "visitatori": 0.015, "iscritti": 0.04},
}
STRETTEZZA = 0.08   # regola generale: più il pubblico è stretto rispetto a tutto il canale, più è conteso e più costa
PUBBLICI = {"ampio": "Pubblico ampio: tutti, decide la piattaforma", "interessi": "Interessi: chi segue la categoria",
            "sosia": "Sosia dei clienti: persone simili a chi compra", "retargeting": "Retargeting: chi ha già visitato il sito"}
LEVE_TESTO = {"sconto": r"sconto|-\d+ ?%|\d+ ?% di sconto|prezzo barrato|offerta|saldi|promo",
              "urgenza": r"solo oggi|scade|entro|ultime ore|mezzanotte|24 ore|48 ore|countdown|timer|stanotte|fino a",
              "scarsita": r"ultimi pezzi|ultime scorte|ultimi \d+|esaurimento|quasi finit|edizione limitata|pochi pezzi",
              "prova_sociale": r"recension|stelle|clienti soddisfatti|lo usano|più venduto|best seller|testimonian",
              "novita": r"nuov|novità|appena uscit|in anteprima|lancio|tendenza",
              "esperto": r"dermatolog|esperto|medico|veterinari|nutrizionist|professionist|chef",
              "valori": r"sostenibil|riciclat|made in italy|artigian|biologic|\beco\b|\becolog"}
CATEGORIE_TESTO = {"moda": r"moda|abbigliament|vestit|maglion|cappotto|scarpe|jeans|outfit|look",
                   "beauty": r"siero|crema|skincare|trucco|makeup|beauty|cosmetic|profumo|viso",
                   "animali": r"cane|gatto|animal|crocchette|snack per|cuccia|pet",
                   "videogiochi": r"gioco|giochi|videogioc|gamer|gaming|livell|console|app di gioco",
                   "tecnologia": r"smartphone|telefono|computer|cuffie|tablet|tecnolog|elettronic|smartwatch",
                   "casa_arredo": r"casa|arred|divano|cucina|lampad|tavolo|letto",
                   "cibo_bevande": r"cibo|pasta|vino|caffè|snack|ricett|bevand|birra|cioccolat",
                   "sport_fitness": r"sport|palestra|fitness|corsa|running|yoga|bici",
                   "viaggi": r"viaggi|vacanz|hotel|volo|voli|crociera",
                   "salute_benessere": r"salute|integrator|benessere|vitamin|farmac",
                   "bambini_famiglia": r"bambin|neonat|giocattol|scuola|pannolin",
                   "auto_moto": r"auto|moto|pneumatic|ricambi",
                   "finanza": r"conto|banca|assicuraz|prestito|mutuo|carta di credito|investiment",
                   "formazione_lavoro": r"corso|master|formazione|lavoro|certificazion|lezion",
                   "intrattenimento": r"concerto|film|libro|teatro|museo|biglietti|streaming|musica"}
CARATTERISTICHE = ["ugc", "hook", "ritmo", "testo_pesante", "brand_lento", "timer", "prezzo_barrato"]
VERTICALI = {"beauty_skincare": "beauty", "pet_ecommerce": "animali", "abbigliamento": "moda"}


def _sig(x):
    return 1.0 / (1.0 + np.exp(-np.clip(x, -30, 30)))


def _logit(p):
    p = np.clip(p, 1e-9, 1 - 1e-9)
    return np.log(p / (1 - p))


def _media(x, w):
    return float(np.sum(x * w) / max(np.sum(w), 1e-12))


# ------------------------------------------------------------------------------------- valori reali
def _bench_canale(canale):
    if canale == "email":
        return EMAIL
    b = dict(BENCH["canali"][canale])
    f = CANALI[canale].get("click_link", 1.0)
    b["ctr"] = [x * f for x in b["ctr"]]
    return b


def _acquisti_per_visita(categoria):
    """Acquisti ogni visita al sito per la categoria: dato del settore, tirato verso la media se le marche sono poche."""
    tutti = BENCH["settori"]["_tutti"]["acquisti_su_100_visite"][1] / 100
    for s in BENCH["settori"].values():
        if categoria in s.get("categorie", []):
            n, v = s["marche"], s["acquisti_su_100_visite"][1] / 100
            return float(np.exp((n * np.log(v) + 3 * np.log(tutti)) / (n + 3)))
    return tutti


def _stagione(giorno):
    m = giorno.month - 1
    st = {k: BENCH["mesi"][k][m] for k in ("cpm", "ctr", "cvr")}
    bf = _black_friday(giorno.year)
    if bf - timedelta(days=7) <= giorno <= bf + timedelta(days=3):   # settimana del Black Friday e Cyber Monday
        st["cpm"] += 0.15
        st["cvr"] += 0.25
        st["ctr"] += 0.05
    return st


def _black_friday(anno):
    d = date(anno, 11, 1)
    primo_venerdi = d + timedelta(days=(4 - d.weekday()) % 7)
    return primo_venerdi + timedelta(days=21)


def _fatica_log(eta):
    """Stanchezza della creatività per età dell'annuncio, dal modello di previsione (media delle curve stimate)."""
    curve = (BASE or {}).get("ctr", {}).get("fatica") or {"_": [0.55, 22.0]}
    v = [np.log(fl + (1 - fl) * np.exp(-np.asarray(eta, dtype=float) / tau)) for fl, tau in curve.values()]
    return np.mean(v, axis=0)


def _qualita_creativa(car):
    """Peso delle caratteristiche creative stimato dal modello di previsione (scala logaritmica del CTR)."""
    if not BASE:
        return 0.0
    w = dict(zip(BASE["ctr"]["feat_cols"], BASE["ctr"]["feat_w"][1:]))
    return float(sum(w.get(k, 0.0) * float(bool(car.get(k))) for k in CARATTERISTICHE))


# ------------------------------------------------------------------------------------ la campagna
CAMPAGNA_BASE = {
    "nome": "Campagna nuova", "descrizione_prodotto": "", "categoria": None, "prezzo": None, "sconto": 0.0, "marchio": "conosciuto",
    "obiettivo": "vendite", "canale": "social", "formato": None, "leve": [], "testo_annuncio": "", "creativita": {},
    "pubblico": {"tipo": "ampio"}, "budget_giorno": 100.0, "giorni": 14, "inizio": None, "trend": 1.0, "qualita_sito": 0.8,
    "filtri": {}, "extra": [], "forza": None, "visivo": None, "presentazione": None,
}
# vantaggi dell'offerta che il testo può nominare: ognuno alza un po' la probabilità di comprare dopo il click (ipotesi)
EXTRA = {"spedizione_gratuita": "spedizione gratuita", "reso_gratuito": "reso gratuito", "garanzia": "garanzia",
         "rate": "pagamento a rate", "regalo": "regalo con l'acquisto", "prova_gratuita": "prova gratuita"}
PESO_EXTRA, TETTO_EXTRA = 0.08, 0.24   # +8% circa di acquisti per vantaggio, al massimo +27%
BUDGET_RIF = 100.0                     # budget al giorno a cui si riferiscono i costi tipici del settore
# ---------------------------------------------------------------------------- la creatività
# Come è fatto l'annuncio: misure dei pixel (dal browser, su foto o fotogrammi) e presentazione (lettura del contenuto).
# Pesi in scala logistica, da regole generali sulla pubblicità sui social e su pochi studi di attenzione: sono IPOTESI,
# non stimate dai dati della sfida. Piccole e con un tetto, così una creatività diversa sposta i numeri ma non li stravolge.
STILI = {"giovane_dinamico": "giovane e dinamico", "elegante_premium": "elegante, di fascia alta", "informativo_semplice": "informativo e semplice",
         "emozionale": "emozionale", "divertente": "divertente", "neutro": "neutro"}
APERTURE = {"domanda": 0.03, "persona": 0.03, "offerta": 0.02, "prodotto": 0.01, "logo": -0.04, "scena": 0.0, "nessuna": 0.0}
ORIENTAMENTO = {"video_brevi": {"verticale": 0.08, "quadrato": -0.02, "orizzontale": -0.12},
                "social": {"verticale": 0.04, "quadrato": 0.02, "orizzontale": -0.04},
                "video": {"orizzontale": 0.05, "quadrato": -0.01, "verticale": -0.03},
                "display": {"orizzontale": 0.02, "quadrato": 0.01, "verticale": -0.02}}
# tetto morbido (tangente iperbolica): gli effetti si sommano con rendimenti decrescenti, ma ogni differenza conta sempre
TETTO_VISIVO_CLICK, TETTO_VISIVO_ACQUISTI = 0.8, 0.3


def _limita(x, a=-1.0, b=1.0):
    return float(min(b, max(a, x)))


def effetti_creativi(c):
    """Pezzi dell'effetto della creatività: [(chiave, descrizione, delta click, delta acquisti)] in scala logistica."""
    v, pr, k = c.get("visivo") or {}, c.get("presentazione") or {}, c["canale"]
    video = v.get("tipo") == "video" or c["formato"] in ("video", "video_breve")
    out = []
    if v:
        cont = _limita((v.get("contrasto", 0.2) - 0.20) / 0.10)
        out.append(("contrasto", "contrasto %s (%s)" % ("alto" if cont > 0.3 else "basso" if cont < -0.3 else "nella media", ("%.2f" % v.get("contrasto", 0.2)).replace(".", ",")), 0.07 * cont, 0.0))
        viv = _limita((v.get("vivacita", 45) - 45) / 35)
        out.append(("vivacita", "colori %s" % ("vivaci" if viv > 0.3 else "spenti" if viv < -0.3 else "nella media"), 0.05 * viv, 0.0))
        lum = v.get("luminosita", 0.55)
        estremo = _limita((abs(lum - 0.55) - 0.37) / 0.08, 0, 1)   # solo immagini quasi nere o quasi bianche
        if estremo > 0:
            out.append(("luce", "immagine troppo %s" % ("scura" if lum < 0.55 else "chiara"), -0.06 * estremo, 0.0))
        if v.get("colorati", 0) > 0.08 and v.get("calda", 0) > 0.6:
            out.append(("caldi", "colori caldi (%s)" % v.get("tinta", ""), 0.02 + (0.02 if set(c["leve"]) & {"sconto", "urgenza"} else 0.0), 0.0))
        fo = v.get("formato")
        if fo and k in ORIENTAMENTO:
            out.append(("orientamento", "formato %s su %s" % (fo, {"video_brevi": "TikTok e Reels", "social": "Facebook e Instagram", "video": "YouTube", "display": "banner"}[k]),
                        ORIENTAMENTO[k].get(fo, 0.0), 0.0))
        d = v.get("durata")
        if video and d:
            if k in ("video_brevi", "social"):
                e = 0.04 if d <= 15 else 0.0 if d <= 30 else -0.05 if d <= 60 else -0.12
            else:
                e = 0.02 if 15 <= d <= 60 else -0.05 if d > 180 else 0.0
            out.append(("durata", "durata %d secondi" % round(d), e, 0.0))
        if video and v.get("cambio") is not None and k in ("video_brevi", "social"):
            r = _limita((v["cambio"] - 0.12) / 0.10)
            out.append(("ritmo_visivo", "scene che cambiano %s" % ("spesso" if r > 0.3 else "poco" if r < -0.3 else "a ritmo medio"), 0.04 * r, 0.0))
    if pr:
        if pr.get("volto"):
            out.append(("volto", "un volto in primo piano", 0.06, 0.0))
        if pr.get("sguardo_in_camera"):
            out.append(("sguardo", "sguardo in camera", 0.03, 0.0))
        if pr.get("prodotto_in_primo_piano"):
            out.append(("prodotto", "prodotto in primo piano", 0.03, 0.04))
        if pr.get("prodotto_in_uso"):
            out.append(("uso", "prodotto mostrato mentre si usa", 0.02, 0.05))
        if pr.get("prezzo_visibile"):
            out.append(("prezzo", "prezzo visibile", 0.02, 0.05))
        if pr.get("logo_visibile"):
            out.append(("logo", "logo visibile", 0.0, 0.04 if c["marchio"] == "nuovo" else 0.02))
        if pr.get("sottotitoli") and video:
            out.append(("sottotitoli", "sottotitoli (si capisce anche senza audio)", 0.05, 0.0))
        if pr.get("prima_dopo"):
            out.append(("prima_dopo", "confronto prima e dopo", 0.03, 0.04))
        ts = pr.get("testo_sovrapposto")
        if ts in ("poco", "molto") and pr.get("testo_leggibile") is not None:
            out.append(("leggibilita", "scritte leggibili" if pr["testo_leggibile"] else "scritte poco leggibili (poco contrasto con lo sfondo)",
                        0.02 if pr["testo_leggibile"] else -0.06, 0.0))
        if ts == "molto" and not c["creativita"].get("testo_pesante"):
            out.append(("testo", "molto testo sopra l'immagine", -0.06, 0.0))
        elif ts == "poco":
            out.append(("testo", "poco testo, leggibile", 0.02, 0.0))
        ap = pr.get("apertura")
        if video and ap in APERTURE and APERTURE[ap]:
            out.append(("apertura", "il video si apre con %s" % {"domanda": "una domanda", "persona": "una persona", "offerta": "l'offerta",
                                                                  "prodotto": "il prodotto", "logo": "il logo"}[ap], APERTURE[ap], 0.0))
    return [x for x in out if abs(x[2]) > 1e-9 or abs(x[3]) > 1e-9]


def _stile(P, c):
    """Lo stile piace di più ad alcuni tipi di persona: effetto sul click, persona per persona (ipotesi)."""
    s = (c.get("presentazione") or {}).get("stile")
    e = np.zeros(len(P))
    giovani, maturi = P.eta.isin(["18-24", "25-34"]).values, P.eta.isin(["55-64", "65+"]).values
    if s == "giovane_dinamico":
        e = 0.12 * giovani - 0.08 * maturi
    elif s == "elegante_premium":
        e = 0.08 * (P.reddito.values == "alto") - 0.04 * (P.reddito.values == "basso")
    elif s == "informativo_semplice":
        e = 0.06 * P.eta.isin(["45-54", "55-64", "65+"]).values
    elif s == "divertente":
        e = 0.08 * P.eta.isin(["18-24", "25-34", "35-44"]).values
    elif s == "emozionale":
        e = 0.05 * P.famiglia.isin(["figli_piccoli", "figli_grandi"]).values
    return e.astype(float)


PESO_FORZA = 0.06                      # forza del messaggio 0-10: da circa -26% a +35% di click rispetto a un messaggio medio (5)


def leggi_testo(testo):
    """Caratteristiche creative, leve e categoria riconosciute in un testo libero (le stesse regole del modello)."""
    from .motore import FEATURE_RULES
    s = (testo or "").lower()
    car = {k: int(bool(re.search(rx, s))) for k, rx in FEATURE_RULES.items()}
    leve = [k for k, rx in LEVE_TESTO.items() if re.search(rx, s)]
    cat = max(CATEGORIE_TESTO, key=lambda c: len(re.findall(CATEGORIE_TESTO[c], s)))
    if not re.search(CATEGORIE_TESTO[cat], s):
        cat = None
    formato = "video_breve" if re.search(r"video|reel|secondi|tiktok", s) else "carosello" if re.search(r"carosello|schede|slide", s) else None
    return {"creativita": car, "leve": leve, "categoria": cat, "formato": formato}


def normalizza(c):
    """Completa la campagna con valori prudenti e dice cosa ha assunto."""
    marchio_detto = bool((c or {}).get("marchio"))
    c = {**CAMPAGNA_BASE, **(c or {})}
    c["pubblico"] = {**CAMPAGNA_BASE["pubblico"], **(c.get("pubblico") or {})}
    ipotesi = []
    if not marchio_detto:
        ipotesi.append("Marchio non indicato: conosciuto da una parte del pubblico, con visitatori del sito da raggiungere di nuovo")
    letto = leggi_testo(" ".join([c.get("testo_annuncio") or "", c.get("descrizione_prodotto") or ""]))
    ia = c.get("categoria_ia")
    if not c.get("categoria") and ia in pe.CATEGORIE:
        testo = " ".join([c.get("testo_annuncio") or "", c.get("descrizione_prodotto") or ""]).lower()
        if letto["categoria"] and letto["categoria"] != ia and not re.search(CATEGORIE_TESTO[ia], testo):
            ipotesi.append("Categoria: il testo parla di %s, non di %s" % (letto["categoria"], ia))
        else:
            c["categoria"] = ia
    if not c.get("categoria"):
        riserva = c.get("categoria_riserva") if c.get("categoria_riserva") in pe.CATEGORIE else None   # dallo storico
        c["categoria"] = letto["categoria"] or riserva or "generica"
        ipotesi.append("Categoria " + ("letta dalla descrizione: " + c["categoria"] if letto["categoria"] else
                                       "presa dallo storico: " + riserva if riserva else "non indicata: media di tutte le categorie"))
    if c["categoria"] not in pe.CATEGORIE and c["categoria"] != "generica":
        raise ValueError("Categoria sconosciuta: %s" % c["categoria"])
    if c["canale"] not in CANALI:
        raise ValueError("Canale sconosciuto: %s" % c["canale"])
    if c["obiettivo"] not in OBIETTIVI:
        raise ValueError("Obiettivo sconosciuto: %s" % c["obiettivo"])
    if c["marchio"] not in MARCHIO:
        raise ValueError("Marchio: usa nuovo, conosciuto o famoso")
    ammessi = CANALI[c["canale"]]["formati"]
    if c.get("formato") not in ammessi:
        f = letto["formato"] if letto["formato"] in ammessi else ammessi[0]
        if c.get("formato"):
            ipotesi.append("Il formato %s non esiste su questo canale: uso %s" % (c["formato"], f))
        c["formato"] = f
    car = {k: int(bool(v)) for k, v in {**letto["creativita"], **(c.get("creativita") or {})}.items() if k in CARATTERISTICHE}
    c["creativita"] = car
    c["leve"] = sorted(set(c.get("leve") or []) | set(letto["leve"]))
    c["leve"] = [lv for lv in c["leve"] if lv in pe.LEVE]
    c["sconto"] = float(min(max(c.get("sconto") or 0.0, 0.0), 0.9))
    if c["sconto"] > 0 and "sconto" not in c["leve"]:
        c["leve"].append("sconto")
    if not c.get("prezzo"):
        c["prezzo"] = PREZZO_TIPICO[c["categoria"]]
        ipotesi.append("Prezzo non indicato: prezzo tipico della categoria, %d euro" % c["prezzo"])
    c["prezzo"] = float(c["prezzo"])
    c["budget_giorno"] = float(max(c["budget_giorno"], 1.0))
    c["giorni"] = int(min(max(int(c["giorni"]), 1), 90))
    if not c.get("inizio"):
        c["inizio"] = (date.today() + timedelta(days=1)).isoformat()
    c["trend"] = float(min(max(c.get("trend") or 1.0, 0.3), 3.0))
    # pubblico indicato nel testo («per donne 25-44 al Nord»): vale per tutti i tipi di pubblico provati
    filtri = {k: [v for v in (vals or []) if v in pe.DIMENSIONI[k]] for k, vals in (c.get("filtri") or {}).items() if k in pe.DIMENSIONI}
    filtri = {k: v for k, v in filtri.items() if v and len(v) < len(pe.DIMENSIONI[k])}
    c["filtri"] = filtri
    c["pubblico"] = {**c["pubblico"], **filtri}
    if filtri:
        ipotesi.append("Pubblico indicato: " + ", ".join(" o ".join(str(pe.ETICHETTE.get(v, v)) for v in vals) for vals in filtri.values()))
    c["extra"] = sorted({e for e in (c.get("extra") or []) if e in EXTRA})
    f = c.get("forza")
    c["forza"] = None if f is None else float(min(max(f, 0.0), 10.0))
    v = c.get("visivo") or None
    if v:
        num = lambda x, a, b, d: float(min(b, max(a, x))) if isinstance(x, (int, float)) and math.isfinite(x) else d
        c["visivo"] = {"luminosita": num(v.get("luminosita"), 0, 1, 0.55), "contrasto": num(v.get("contrasto"), 0, 0.5, 0.2),
                       "saturazione": num(v.get("saturazione"), 0, 1, 0.3), "vivacita": num(v.get("vivacita"), 0, 200, 45),
                       "calda": num(v.get("calda"), 0, 1, 0.5), "colorati": num(v.get("colorati"), 0, 1, 0.3),
                       "tinta": str(v.get("tinta") or "")[:20], "formato": v.get("formato") if v.get("formato") in ("verticale", "quadrato", "orizzontale") else None,
                       "durata": num(v.get("durata"), 0, 3600, None) if v.get("durata") else None,
                       "cambio": num(v.get("cambio"), 0, 1, None) if v.get("cambio") is not None else None,
                       "tipo": v.get("tipo") if v.get("tipo") in ("foto", "video", "carosello") else None,
                       "palette": [str(x)[:7] for x in (v.get("palette") or [])][:4]}
    pr = c.get("presentazione") or None
    if pr:
        c["presentazione"] = {k: bool(pr.get(k)) for k in ("volto", "sguardo_in_camera", "prodotto_in_primo_piano", "prodotto_in_uso",
                                                          "prezzo_visibile", "logo_visibile", "sottotitoli", "prima_dopo")}
        c["presentazione"]["testo_leggibile"] = None if pr.get("testo_leggibile") is None else bool(pr.get("testo_leggibile"))
        c["presentazione"]["testo_sovrapposto"] = pr.get("testo_sovrapposto") if pr.get("testo_sovrapposto") in ("nessuno", "poco", "molto") else None
        c["presentazione"]["apertura"] = pr.get("apertura") if pr.get("apertura") in APERTURE else None
        c["presentazione"]["stile"] = pr.get("stile") if pr.get("stile") in STILI else None
    c["qualita_sito"] = float(min(max(c.get("qualita_sito") or 0.8, 0.2), 1.0))
    if c["canale"] == "email" and c["pubblico"].get("tipo") != "retargeting":
        c["pubblico"]["tipo"] = "retargeting"
        ipotesi.append("L'email raggiunge solo chi è già iscritto: pubblico = iscritti del marchio")
    if c["canale"] == "email":
        ipotesi.append("Email: CTR e costo per invio sono ipotesi (non ci sono nel dataset reale)")
    if c["canale"] in ("ricerca", "shopping") and c["pubblico"].get("tipo") in ("interessi", "sosia"):
        c["pubblico"]["tipo"] = "ampio"
        ipotesi.append("Sulla ricerca il pubblico lo decidono le parole cercate: interessi e sosia non si applicano")
    c["_ipotesi"] = ipotesi
    return c


# --------------------------------------------------------------------- dalla persona ai numeri
def _interesse(P, cat):
    if cat == "generica":
        return P[["int_" + k for k in pe.CATEGORIE]].mean(axis=1).values
    return P["int_" + cat].values


def _in_cerca(P, cat, giorno, trend):
    """Probabilità che la persona stia cercando o comprando ora qualcosa della categoria."""
    base = np.mean(list(pe.IN_CERCA_AL_MESE.values())) if cat == "generica" else pe.IN_CERCA_AL_MESE[cat]
    st = math.exp(_stagione(giorno)["cvr"])
    return np.clip(_interesse(P, cat) * base * st * trend ** (0.5 + P.sens_novita.values), 1e-4, 0.95)


def _raggiungibili(P, c, cat, giorno):
    """Persone di ogni tipo che il canale può raggiungere in un giorno, dentro il pubblico scelto."""
    k = c["canale"]
    uso = P["uso_" + k].values
    if k in ("ricerca", "shopping"):   # gli annunci di ricerca compaiono solo a chi sta cercando
        uso = uso * np.clip(3.0 * _in_cerca(P, cat, giorno, c["trend"]), 0, 1)
    pub = c["pubblico"]
    filtro = np.ones(len(P))
    for tag in pe.DIMENSIONI:
        scelti = pub.get(tag)
        if scelti:
            filtro = filtro * P[tag].isin(scelti).values
    tipo = pub.get("tipo", "ampio")
    aff = _interesse(P, cat)
    w = P.peso.values
    if tipo == "interessi":
        q80 = np.quantile(aff, 0.8, method="inverted_cdf") if False else _quantile(aff, w, 0.8)
        quota = np.clip((aff / q80) ** 2, 0, 1)
    elif tipo == "sosia":
        punteggio = aff * P.acquisto_online.values * np.minimum(1.0, P.potere_acquisto.values * PREZZO_TIPICO.get(cat, 50) / c["prezzo"])
        quota = np.clip((punteggio / _quantile(punteggio, w, 0.95)) ** 3, 0, 1)
    elif tipo == "retargeting":
        m = MARCHIO[c["marchio"]]
        chiave = "iscritti" if k == "email" else "visitatori"
        comp = aff * P.acquisto_online.values
        quota = m[chiave] * comp / _media(comp, w)
    else:
        quota = np.ones(len(P))
    return w * filtro * np.clip(quota, 0, 1) * uso, tipo


def _quantile(x, w, q):
    o = np.argsort(x)
    cw = np.cumsum(w[o]) / np.sum(w)
    return float(x[o][min(np.searchsorted(cw, q), len(x) - 1)])


def _contributi(P, c, cat, giorno, rif):
    """Pezzi della probabilità di click e di acquisto per ogni tipo di persona (scala logistica)."""
    aff = _interesse(P, cat)
    inc = _in_cerca(P, cat, giorno, c["trend"])
    fmt = P["pref_" + c["formato"]].values
    w = rif["pesi"]
    la, li, lf = _logit(aff), np.log(inc), fmt
    click = {"interesse": 0.8 * (la - _media(la, w)), "momento": 0.3 * (li - _media(li, w)), "formato": lf - _media(lf, w),
             "saturazione": -0.3 * (P.saturazione.values - _media(P.saturazione.values, w))}
    leve = np.zeros(len(P))
    BASE_LEVA = {"sconto": 0.05, "urgenza": 0.05, "scarsita": 0.04, "prova_sociale": 0.05, "novita": 0.03, "esperto": 0.03, "valori": 0.02}
    for lv in c["leve"]:
        s = P["sens_" + lv].values
        leve = leve + BASE_LEVA[lv] + 0.8 * (s - _media(s, w))
    if c["sconto"] > 0:
        leve = leve + 0.5 * c["sconto"] * P.sens_sconto.values
    click["leve"] = leve
    click["creativita"] = np.full(len(P), _qualita_creativa(c["creativita"]))
    click["messaggio"] = np.full(len(P), 0.0 if c.get("forza") is None else PESO_FORZA * (c["forza"] - 5.0))
    ec = effetti_creativi(c)
    click["visivo"] = TETTO_VISIVO_CLICK * np.tanh((sum(x[2] for x in ec) + _stile(P, c)) / TETTO_VISIVO_CLICK)
    m = MARCHIO[c["marchio"]]
    marchio = np.full(len(P), 0.35 * (m["noto"] - MARCHIO["conosciuto"]["noto"]))
    if c["pubblico"].get("tipo") == "retargeting":
        marchio = marchio + 0.6
    click["marchio"] = marchio
    tn = 0.4 * math.log(c["trend"]) * (0.5 + P.sens_novita.values)
    click["tendenza"] = tn

    netto = c["prezzo"] * (1 - c["sconto"])
    tip = PREZZO_TIPICO[cat] * P.potere_acquisto.values
    sopra = np.maximum(0, np.log(netto / tip))
    sopra_rif = np.maximum(0, np.log(PREZZO_TIPICO[cat] / tip))
    sens = 0.5 + P.sens_sconto.values
    compra = {"intenzione": 0.8 * (li - _media(li, w)), "interesse": 0.4 * (la - _media(la, w)),
              "prezzo": -1.0 * sens * sopra + _media(1.0 * sens * sopra_rif, w),
              "online": 1.2 * (P.acquisto_online.values - _media(P.acquisto_online.values, w)),
              "sconto": 2.0 * c["sconto"] * P.sens_sconto.values,
              "telefono": -0.4 * (P.mobile.values - _media(P.mobile.values, w)),
              "sito": np.full(len(P), math.log(c["qualita_sito"] / 0.8))}
    fiducia = P.fiducia_nuovi_marchi.values
    compra["marchio"] = (-0.4 * (1 - fiducia) if c["marchio"] == "nuovo" else np.full(len(P), 0.2 if c["marchio"] == "famoso" else 0.0))
    if c["pubblico"].get("tipo") == "retargeting":
        compra["marchio"] = compra["marchio"] + 0.4
    urg = np.zeros(len(P))
    for lv in ("urgenza", "scarsita"):
        if lv in c["leve"]:
            urg = urg + 0.15 * P["sens_" + lv].values
    compra["leve"] = urg
    compra["offerta"] = np.full(len(P), min(TETTO_EXTRA, PESO_EXTRA * len(c.get("extra") or [])))
    compra["visivo"] = np.full(len(P), float(TETTO_VISIVO_ACQUISTI * math.tanh(sum(x[3] for x in ec) / TETTO_VISIVO_ACQUISTI)))
    return click, compra


_TARATURE = {}


def _taratura(P, canale, cat):
    """Costanti di canale e settore: la campagna di riferimento deve dare i valori tipici reali."""
    chiave = (canale, cat)
    if chiave in _TARATURE:
        return _TARATURE[chiave]
    rif = normalizza({"canale": canale, "categoria": cat, "obiettivo": "vendite", "marchio": "conosciuto",
                      "pubblico": {"tipo": "retargeting" if canale == "email" else "ampio"}, "inizio": "2026-06-15"})
    g = date(2026, 6, 15)
    w = P.peso.values * P["uso_" + canale].values
    R, _ = _raggiungibili(P, rif, cat, g)
    click, compra = _contributi(P, rif, cat, g, {"pesi": w})
    lc = sum(click.values()) + float(np.mean(_fatica_log(np.arange(14))))
    lb = sum(compra.values())
    costo = P.costo_relativo.values
    b = _bench_canale(canale)
    ctr_obj, gamma = b["ctr"][1] / 100, OBIETTIVI["vendite"]
    cvr_obj = _acquisti_per_visita(cat) * CANALI[canale]["conv"]
    p_sito = 0.8 * (0.95 - 0.10 * P.mobile.values)

    def consegna(a, be):
        p = _sig(a + lc)
        q = _sig(be + lb)
        u = R * (p * p_sito * q / costo) ** gamma
        return p, q, u / costo   # impression a parità di spesa

    def cerca(f, obj, lo, hi):
        for _ in range(45):
            mid = (lo + hi) / 2
            if f(mid) < obj:
                lo = mid
            else:
                hi = mid
        return (lo + hi) / 2
    alfa, beta = -4.0, -4.0
    for _ in range(3):   # click e acquisti si influenzano a vicenda attraverso la consegna: due o tre giri bastano
        alfa = cerca(lambda a: (lambda p, q, imp: float(np.sum(imp * p) / np.sum(imp)))(*consegna(a, beta)), ctr_obj, -12.0, 4.0)
        beta = cerca(lambda be: (lambda p, q, imp: float(np.sum(imp * p * q) / np.sum(imp * p)))(*consegna(alfa, be)), cvr_obj, -15.0, 4.0)
    p, q, imp = consegna(alfa, beta)
    costo_medio = float(np.sum(imp * costo) / np.sum(imp))
    _TARATURE[chiave] = {"alfa": alfa, "beta": beta, "pesi": w, "costo_medio": costo_medio}
    return _TARATURE[chiave]


# ------------------------------------------------------------------------------------ simulazione
def simula(campagna, n_sim=400, seed=7, dettaglio=True, scarto_ctr=0.0, scarto_cpm=0.0, sd=None, n_persone=8):
    """Simula la campagna giorno per giorno su tutti i tipi di persona. Restituisce KPI, forchetta, segmenti, persone."""
    c = normalizza(campagna)
    P = pe.popolazione()
    cat, k = c["categoria"], c["canale"]
    tar = _taratura(P, k, cat)
    b = _bench_canale(k)
    el_b = (BASE or {}).get("cpm", {}).get("elasticita", 0.26)
    # più budget al giorno, ogni visualizzazione costa di più (elasticità stimata dal modello di previsione; 100 €/giorno = valore tipico)
    cpm_base = b["cpm_eur"][1] * math.exp(scarto_cpm) * (c["budget_giorno"] / BUDGET_RIF) ** el_b
    gamma = OBIETTIVI[c["obiettivo"]]
    costo_rel = P.costo_relativo.values / tar["costo_medio"]
    el = (BASE or {}).get("cpm", {}).get("elasticita", 0.26)
    dow_ctr = np.array((BASE or {}).get("ctr", {}).get("dow", [0.0] * 7))
    dow_cpm = np.array((BASE or {}).get("cpm", {}).get("dow", [0.0] * 7))
    dow_ctr, dow_cpm = dow_ctr - dow_ctr.mean(), dow_cpm - dow_cpm.mean()
    new3_ctr = (BASE or {}).get("ctr", {}).get("new3", 0.0)
    new3_cpm = (BASE or {}).get("cpm", {}).get("new3", 0.0)
    fmax = CANALI[k]["freq_max"]
    p_sito = c["qualita_sito"] * (0.95 - 0.10 * P.mobile.values)
    valore = c["prezzo"] * (1 - c["sconto"]) * (1 + 0.1 * (P.potere_acquisto.values - 1))
    inizio = date.fromisoformat(c["inizio"])
    n = len(P)
    T = {x: np.zeros(n) for x in ("imp", "spesa", "click", "visite", "acq", "ricavi", "esposizioni")}
    giorni, raggiunte_tot, chiave_st = [], None, None
    for t in range(c["giorni"]):
        g = inizio + timedelta(days=t)
        st = _stagione(g)
        if chiave_st != tuple(st.values()):   # nuova stagione (nuovo mese o settimana del Black Friday): si ricalcola
            chiave_st = tuple(st.values())
            R, tipo = _raggiungibili(P, c, cat, g)
            tutti = float(np.sum(P.peso.values * P["uso_" + k].values))
            stretto = (max(float(R.sum()), 1.0) / tutti) ** (-STRETTEZZA) if k not in ("ricerca", "shopping", "email") else 1.0
            click, compra = _contributi(P, c, cat, g, tar)
            somma_click, somma_compra = sum(click.values()), sum(compra.values())
        lc = tar["alfa"] + somma_click + st["ctr"] + dow_ctr[g.weekday()] + float(_fatica_log(t)) + (new3_ctr if t < 3 else 0.0) + scarto_ctr
        p_click = _sig(lc)
        p_acq = _sig(tar["beta"] + somma_compra)
        costo = cpm_base * costo_rel * stretto * math.exp(st["cpm"] + dow_cpm[g.weekday()] + (new3_cpm if t < 3 else 0.0))
        risposta = p_click * (p_sito * p_acq if c["obiettivo"] == "vendite" else 1.0)
        u = R * (risposta / costo) ** gamma
        imp = np.zeros(n)
        cpm_p = costo.copy()
        for _ in range(4):   # la piattaforma divide il budget; tetto di frequenza; pressione sul pubblico
            libero = imp < fmax * R - 1e-9
            if not libero.any():
                break
            resto = c["budget_giorno"] - float(np.sum(imp * cpm_p) / 1000)
            if resto <= 1e-6:
                break
            uu = np.where(libero, u, 0.0)
            lam = 1000 * resto / max(float(np.sum(uu * cpm_p)), 1e-12)
            imp = np.minimum(imp + lam * uu, fmax * R)
            freq = np.divide(imp, R, out=np.zeros(n), where=R > 0)
            cpm_p = costo * np.maximum(freq / 1.0, 0.5) ** el
        spesa = imp * cpm_p / 1000
        clk = imp * p_click
        vis = clk * p_sito
        acq = vis * p_acq
        T["imp"] += imp
        T["spesa"] += spesa
        T["click"] += clk
        T["visite"] += vis
        T["acq"] += acq
        T["ricavi"] += acq * valore
        T["esposizioni"] += np.divide(imp, R, out=np.zeros(n), where=R > 0)
        giorni.append({"data": g.isoformat(), "spesa": float(spesa.sum()), "impressioni": float(imp.sum()), "click": float(clk.sum()),
                       "visite": float(vis.sum()), "acquisti": float(acq.sum()), "ricavi": float((acq * valore).sum())})
        if raggiunte_tot is None:
            raggiunte_tot = R.copy()
        raggiunte_tot = np.maximum(raggiunte_tot, R)
    # persone raggiunte almeno una volta (esposizioni distribuite a caso tra le persone raggiungibili)
    copertura = raggiunte_tot * (1 - np.exp(-T["esposizioni"]))
    tot = _totali(T, copertura)
    sd = sd or {"ctr": b.get("sd_log_ctr_settore", b["sd_log_ctr"]), "cpm": b.get("sd_log_cpm_paese", b["sd_log_cpm"]),
                "cvr": BENCH["settori"]["_tutti"].get("sd_log_cvr_settore", BENCH["settori"]["_tutti"]["sd_log_cvr"])}
    out = {"campagna": {k_: v for k_, v in c.items() if not k_.startswith("_")}, "ipotesi": c["_ipotesi"],
           "totali": tot, "forchetta": _forchetta(tot, sd, n_sim, seed), "giorni": giorni,
           "pubblico": {"tipo": c["pubblico"].get("tipo", "ampio"), "nome": PUBBLICI.get(c["pubblico"].get("tipo", "ampio"), ""),
                        "persone_raggiungibili": float(raggiunte_tot.sum()), "persone_raggiunte": float(copertura.sum())},
           "valori_reali": {"ctr_tipico": b["ctr"], "cpm_tipico": b["cpm_eur"], "acquisti_su_100_visite": round(100 * _acquisti_per_visita(cat), 3),
                            "fonte": "email: ipotesi" if k == "email" else BENCH["fonte"]}}
    if dettaglio:
        out["segmenti"] = _segmenti(P, T, copertura)
        out["migliori"] = _migliori(P, T, c)
        out["persone"] = _storie(P, T, c, cat, inizio, tar, seed, n=n_persone)
    out["_T"] = T
    return out


def _totali(T, copertura):
    imp, sp, ck, vi, ac, ri = (float(T[x].sum()) for x in ("imp", "spesa", "click", "visite", "acq", "ricavi"))
    cop = float(copertura.sum())
    return {"spesa": sp, "impressioni": imp, "persone_raggiunte": cop, "frequenza": imp / cop if cop else 0.0,
            "click": ck, "ctr": 100 * ck / imp if imp else 0.0, "cpm": 1000 * sp / imp if imp else 0.0, "cpc": sp / ck if ck else 0.0,
            "visite": vi, "acquisti": ac, "conversione": 100 * ac / ck if ck else 0.0, "cpa": sp / ac if ac else 0.0,
            "ricavi": ri, "roas": ri / sp if sp else 0.0}


def _forchetta(tot, sd, n_sim, seed):
    """Incertezza di una campagna nuova: quanto CTR, CPM e acquisti per click cambiano tra marche vere."""
    rng = np.random.default_rng(seed)
    a, b_, c = (np.exp(rng.standard_normal(n_sim) * sd[x]) for x in ("ctr", "cpm", "cvr"))
    imp = tot["impressioni"] / b_
    ck = tot["click"] / b_ * a
    ac = tot["acquisti"] / b_ * a * c
    ri = tot["ricavi"] / b_ * a * c
    sp = tot["spesa"]
    serie = {"impressioni": imp, "click": ck, "ctr": tot["ctr"] * a, "cpm": tot["cpm"] * b_, "cpc": sp / np.maximum(ck, 1e-9),
             "acquisti": ac, "cpa": sp / np.maximum(ac, 1e-9), "ricavi": ri, "roas": ri / sp if sp else ri * 0,
             "persone_raggiunte": tot["persone_raggiunte"] / b_ ** 0.7}
    return {k: [float(np.percentile(v, 10)), float(np.percentile(v, 90))] for k, v in serie.items()}


def _segmenti(P, T, copertura):
    """Per ogni tag: quota di visualizzazioni, click e acquisti, e resa per euro rispetto alla media."""
    out = {}
    tot_sp, tot_ac, tot_ck = T["spesa"].sum(), T["acq"].sum(), T["click"].sum()
    for tag, livelli in pe.DIMENSIONI.items():
        righe = []
        for v in livelli:
            m = (P[tag] == v).values
            sp, ac, ck, im = T["spesa"][m].sum(), T["acq"][m].sum(), T["click"][m].sum(), T["imp"][m].sum()
            resa = (ac / sp) / (tot_ac / tot_sp) if sp > 0 and tot_ac > 0 else 0.0
            righe.append({"livello": v, "etichetta": pe.ETICHETTE[v], "quota_impressioni": float(im / max(T["imp"].sum(), 1e-9)),
                          "quota_click": float(ck / max(tot_ck, 1e-9)), "quota_acquisti": float(ac / max(tot_ac, 1e-9)),
                          "ctr": float(100 * ck / im) if im else 0.0, "resa": float(resa)})
        out[tag] = righe
    return out


def _migliori(P, T, c, n=8):
    """I tipi di persona che rendono di più per euro, tra quelli abbastanza numerosi da contare."""
    sp = T["spesa"]
    val = T["acq"] if c["obiettivo"] == "vendite" else T["click"]
    ok = (sp > np.percentile(sp[sp > 0], 50)) if (sp > 0).sum() > 10 else sp > 0
    resa = np.where(ok, val / np.maximum(sp, 1e-12), 0)
    media = val.sum() / max(sp.sum(), 1e-12)
    tag = P[list(pe.DIMENSIONI)].values
    ordine = []
    for i in np.argsort(-resa):
        if resa[i] <= 0 or len(ordine) >= n:
            break
        if all((tag[i] != tag[j]).sum() >= 3 for j in ordine):   # niente doppioni quasi uguali
            ordine.append(i)
    righe = []
    for i in ordine:
        r = P.iloc[i]
        righe.append({"descrizione": pe.descrivi(r), "persone": float(r.peso), "ctr": float(100 * T["click"][i] / max(T["imp"][i], 1e-9)),
                      "conversione": float(100 * T["acq"][i] / max(T["click"][i], 1e-9)), "resa": float(resa[i] / media) if media else 0.0,
                      **{t: r[t] for t in pe.DIMENSIONI}})
    return righe


NOMI = {"donna": {"giovane": ["Giulia", "Sofia", "Aurora", "Martina", "Chiara", "Sara", "Alice", "Giorgia"],
                  "adulta": ["Francesca", "Valentina", "Elena", "Silvia", "Laura", "Federica", "Paola", "Simona"],
                  "anziana": ["Maria", "Anna", "Giuseppina", "Rosa", "Carla", "Franca", "Lucia", "Teresa"]},
        "uomo": {"giovane": ["Lorenzo", "Matteo", "Leonardo", "Alessandro", "Riccardo", "Tommaso", "Davide", "Luca"],
                 "adulta": ["Marco", "Andrea", "Stefano", "Paolo", "Roberto", "Massimo", "Fabrizio", "Davide"],
                 "anziana": ["Giuseppe", "Giovanni", "Antonio", "Franco", "Mario", "Luigi", "Bruno", "Sergio"]}}
SPIEGAZIONI = {"interesse": ("molto interessata alla categoria", "poco interessata alla categoria"),
               "momento": ("sta cercando proprio adesso", "non sta cercando adesso"),
               "formato": ("il formato le piace", "il formato non fa per lei"),
               "saturazione": ("vede pochi annunci, nota di più", "vede troppi annunci"),
               "leve": ("la leva usata funziona su di lei", "la leva usata la lascia fredda"),
               "creativita": ("creatività forte", "creatività debole"),
               "marchio": ("conosce già il marchio", "non conosce il marchio"),
               "tendenza": ("la categoria va di moda e lei la segue", "la tendenza non la tocca"),
               "intenzione": ("ha bisogno del prodotto adesso", "non ne ha bisogno adesso"),
               "prezzo": ("il prezzo è alla sua portata", "il prezzo è alto per lei"),
               "online": ("compra spesso online", "compra poco online"),
               "sconto": ("lo sconto la convince", "lo sconto non basta"),
               "telefono": ("naviga dal computer", "naviga quasi solo dal telefono")}


def _al_maschile(frase):
    for a, b in (("interessata", "interessato"), ("le piace", "gli piace"), ("la convince", "lo convince"), ("la lascia", "lo lascia"),
                 ("su di lei", "su di lui"), ("per lei", "per lui"), ("lei la segue", "lui la segue"), ("la tocca", "lo tocca")):
        frase = frase.replace(a, b)
    return frase


def _storie(P, T, c, cat, inizio, tar, seed, n=8):
    quote = {"compra": max(1, round(n * 0.35)), "clicca": max(1, round(n * 0.35))}
    quote["passa"] = max(1, n - quote["compra"] - quote["clicca"])
    """Persone singole estratte tra quelle simulate: alcune comprano, alcune cliccano e basta, altre passano oltre.
    Ognuna con il motivo, cioè i tre pezzi che pesano di più sulla sua probabilità di click o di acquisto."""
    rng = np.random.default_rng(seed + 11)
    if T["imp"].sum() <= 0:
        return []
    g = inizio + timedelta(days=min(3, c["giorni"] - 1))
    click, compra = _contributi(P, c, cat, g, tar)
    gruppi = [("compra", T["acq"], quote["compra"]), ("clicca", np.maximum(T["click"] - T["acq"], 0), quote["clicca"]),
              ("passa", np.maximum(T["imp"] - T["click"], 0), quote["passa"])]
    media = T["acq"].sum() / max(T["spesa"].sum(), 1e-12)
    usati, out, nomi_usati = set(), [], set()
    for esito, peso, quanti in gruppi:
        peso = np.where(np.isin(np.arange(len(P)), list(usati)), 0, peso)
        if peso.sum() <= 0:
            continue
        for i in rng.choice(len(P), size=min(quanti, int((peso > 0).sum())), replace=False, p=peso / peso.sum()):
            usati.add(int(i))
            r = P.iloc[i]
            nums = [int(x) for x in re.findall(r"\d+", r.eta)]
            eta = int(rng.integers(nums[0], (nums[1] if len(nums) > 1 else 80) + 1))
            fascia = "giovane" if eta < 35 else "adulta" if eta < 60 else "anziana"
            regioni = pe.REGIONI[r.area]
            regione = str(rng.choice(list(regioni), p=np.array(list(regioni.values())) / sum(regioni.values())))
            volte = max(1, int(rng.poisson(max(T["esposizioni"][i], 0.3))))
            pc = float(T["click"][i] / max(T["imp"][i], 1e-12))
            pa = float(T["acq"][i] / max(T["click"][i], 1e-12))
            fonti = {**click} if esito == "passa" else {**click, **compra}
            fattori = sorted(((k_, float(v[i])) for k_, v in fonti.items() if k_ in SPIEGAZIONI and abs(float(v[i])) > 0.05),
                             key=lambda x: -abs(x[1]))[:3]
            perche = [SPIEGAZIONI[k_][0 if v > 0 else 1] for k_, v in fattori]
            if r.genere == "uomo":
                perche = [_al_maschile(x) for x in perche]
            liberi = [x for x in NOMI[r.genere][fascia] if x not in nomi_usati] or NOMI[r.genere][fascia]
            nome = str(rng.choice(liberi))
            nomi_usati.add(nome)
            out.append({"nome": nome, "eta": eta, "genere": r.genere, "regione": regione,
                        "comune": pe.ETICHETTE[r.comune], "lavoro": pe.ETICHETTE[r.lavoro], "reddito": pe.ETICHETTE[r.reddito],
                        "famiglia": pe.ETICHETTE[r.famiglia], "istruzione": pe.ETICHETTE[r.istruzione], "visto": volte,
                        "prob_click": pc, "prob_acquisto": pa, "esito": esito, "clicca": esito != "passa", "compra": esito == "compra",
                        "perche": perche, "tipo": pe.descrivi(r), "persone_simili": float(r.peso),
                        "resa": float((T["acq"][i] / max(T["spesa"][i], 1e-12)) / media) if media > 0 else 0.0})
    return out


# ---------------------------------------------------------------------------------------- consigli
def _risultato(tot, obiettivo):
    """Quanto si ottiene con tutto il budget: acquisti, click o persone raggiunte."""
    return tot["acquisti"] if obiettivo == "vendite" else tot["click"] if obiettivo == "traffico" else tot["persone_raggiunte"]


def consiglia(campagna, canali=None, n=6):
    """Prova molte combinazioni di canale, formato, pubblico e leva sulla stessa popolazione, con lo stesso budget,
    e le ordina per risultato totale (acquisti, click o persone raggiunte secondo l'obiettivo)."""
    c0 = normalizza(campagna)
    canali = canali or [k for k in CANALI if k != "email" and not (c0["obiettivo"] == "notorieta" and k in ("ricerca", "shopping"))]
    rt = [] if c0["marchio"] == "nuovo" else ["retargeting"]   # un marchio nuovo non ha visitatori da ri-raggiungere
    budget = c0["budget_giorno"] * c0["giorni"]
    prove = []

    def prova(**cambi):
        c = {k_: v for k_, v in c0.items() if not k_.startswith("_")}
        c.update(cambi)
        c["pubblico"] = {**c0["pubblico"], **cambi.get("pubblico", {})}
        r = simula(c, dettaglio=False)
        tot = r["totali"]
        prove.append({"canale": c["canale"], "formato": c["formato"], "pubblico": c["pubblico"]["tipo"], "leve": list(c.get("leve") or []),
                      "risultato": _risultato(tot, c0["obiettivo"]), "totali": tot, "budget_speso": tot["spesa"] / budget if budget else 0.0})
        return prove[-1]
    for k in canali:   # 1) canale e formato, pubblico ampio
        for f in CANALI[k]["formati"]:
            prova(canale=k, formato=f, pubblico={"tipo": "ampio"})
    for m in sorted(prove, key=lambda x: -x["risultato"])[:3]:   # 2) pubblico, sui tre migliori
        for tipo in (rt if m["canale"] in ("ricerca", "shopping") else ["interessi", "sosia"] + rt):   # sulla ricerca decidono le parole cercate
            prova(canale=m["canale"], formato=m["formato"], pubblico={"tipo": tipo})
    for m in sorted(prove, key=lambda x: -x["risultato"])[:2]:   # 3) una leva in più, sui due migliori
        for lv in ("urgenza", "scarsita", "prova_sociale", "novita", "esperto"):
            if lv not in m["leve"]:
                prova(canale=m["canale"], formato=m["formato"], pubblico={"tipo": m["pubblico"]}, leve=sorted(set(m["leve"]) | {lv}))
    vista, unici = set(), []
    for x in sorted(prove, key=lambda x: -x["risultato"]):
        chiave = (x["canale"], x["formato"], x["pubblico"], tuple(x["leve"]))
        if chiave not in vista:
            vista.add(chiave)
            unici.append(x)
    rif = next((x for x in prove if x["canale"] == c0["canale"] and x["formato"] == c0["formato"] and x["pubblico"] == "ampio"), unici[-1])
    for x in unici:
        x["rispetto_alla_partenza"] = x["risultato"] / rif["risultato"] if rif["risultato"] else 0.0
        x["nota"] = ("riesce a spendere solo il %d%% del budget: il pubblico è troppo piccolo" % round(100 * x["budget_speso"])
                     if x["budget_speso"] < 0.9 else "")
    return {"obiettivo": c0["obiettivo"], "combinazioni_provate": len(prove), "classifica": unici[:n], "partenza": rif}


# -------------------------------------------------------------------- integrazione con lo storico
def categoria_da_nome(*testi):
    s = " ".join(str(t) for t in testi if t).lower()
    for k, v in VERTICALI.items():
        if k in s:
            return v
    conti = {c: len(re.findall(rx, s)) for c, rx in CATEGORIE_TESTO.items()}
    best = max(conti, key=conti.get)
    return best if conti[best] else "generica"


def integra(R, pred, pubblici_df, assets=None, n_sim=200):
    """Dove c'è uno storico: per ogni ad set simula le persone e le tara sulle previsioni del modello strutturale.
    Il risultato aggiunge chi c'è dentro ogni pubblico e cosa fa dopo il click (visite e acquisti stimati)."""
    out, prova = {}, []
    tipi = {"ampio": "ampio", "interessi": "interessi", "sosia": "sosia", "caldo": "retargeting", "unico": "ampio"}
    feats = None
    if assets is not None and len(assets):
        from .motore import asset_features
        feats = asset_features(assets)
    for n_, (_, a) in enumerate(pubblici_df.iterrows()):
        k = a.adset_id
        p = pred[pred.adset_id == k]
        if not len(p):
            continue
        cat = categoria_da_nome(a.vertical, k)
        car = {}
        leve = []
        if feats is not None:
            ids = [x for x in p.asset_id.unique() if x in feats.index]
            if ids:
                f = feats.loc[ids].mean()
                car = {c_: float(f.get(c_, 0)) >= 0.5 for c_ in CARATTERISTICHE}
            lv = p.leva.astype(str).value_counts()
            mappa = {"urgency": "urgenza", "scarcity": "scarsita", "black_friday": "sconto"}
            leve = sorted({mappa[x] for x in lv.index if x in mappa})
        camp = {"categoria": cat, "canale": "social", "obiettivo": "vendite", "pubblico": {"tipo": tipos(a.tipo, tipi)},
                "budget_giorno": float(p.groupby("data").spesa_prev.sum().mean() / 0.971 if "spesa_prev" in p else 100),
                "giorni": int(p.data.nunique()), "inizio": p.data.min().strftime("%Y-%m-%d"), "creativita": car, "leve": leve,
                "sconto": 0.3 if "sconto" in leve else 0.0}
        freddo = simula(camp, dettaglio=False)
        ctr_pred = float((p.click_prev.sum() / p.impression_prev.sum()) * 100)
        cpm_pred = float(p.spesa_prev.sum() / p.impression_prev.sum() * 1000)
        s_ctr = math.log(ctr_pred / freddo["totali"]["ctr"]) if freddo["totali"]["ctr"] > 0 else 0.0
        s_cpm = math.log(cpm_pred / freddo["totali"]["cpm"]) if freddo["totali"]["cpm"] > 0 else 0.0
        tarata = simula(camp, n_sim=n_sim, scarto_ctr=s_ctr, scarto_cpm=s_cpm, seed=7 + 13 * n_,
                        sd={"ctr": 0.15, "cpm": 0.10, "cvr": BENCH["settori"]["_tutti"].get("sd_log_cvr_settore", 0.7)})
        tarata.pop("_T", None)
        out[k] = {"giorni": [{"data": g["data"], "acquisti": g["acquisti"], "ricavi": g["ricavi"]} for g in tarata["giorni"]],
                  "categoria": cat, "pubblico": camp["pubblico"]["tipo"], "a_freddo": {"ctr": freddo["totali"]["ctr"], "cpm": freddo["totali"]["cpm"]},
                  "previsto": {"ctr": ctr_pred, "cpm": cpm_pred}, "totali": tarata["totali"], "forchetta": tarata["forchetta"],
                  "segmenti": tarata["segmenti"], "migliori": tarata["migliori"][:5], "persone": tarata["persone"][:8]}
    return out


def tipos(tipo, tipi):
    return tipi.get(str(tipo), "ampio")


def prova_a_freddo(R, pubblici_df, giorni=28):
    """Prova onesta: per ogni ad set dello storico, prevede CTR e CPM degli ultimi `giorni` SENZA usare lo storico
    (solo categoria, tipo di pubblico, budget, creatività e date) e confronta con i valori veri."""
    h = R["hist"]
    fine = h.data.max()
    finestra = h[h.data > fine - pd.Timedelta(days=giorni)]
    from .motore import asset_features
    feats = asset_features(R["assets"])
    tipi = {"ampio": "ampio", "interessi": "interessi", "sosia": "sosia", "caldo": "retargeting", "unico": "ampio"}
    righe = []
    for _, a in pubblici_df.iterrows():
        k = a.adset_id
        w = finestra[finestra.adset_id == k]
        if not len(w):
            continue
        ids = [x for x in w.asset_id.unique() if x in feats.index]
        car = {c_: float(feats.loc[ids].mean().get(c_, 0)) >= 0.5 for c_ in CARATTERISTICHE} if ids else {}
        mappa = {"urgency": "urgenza", "scarcity": "scarsita", "black_friday": "sconto"}
        leve = sorted({mappa[x] for x in w.leva.astype(str).unique() if x in mappa})
        camp = {"categoria": categoria_da_nome(a.vertical, k), "canale": "social", "obiettivo": "vendite",
                "pubblico": {"tipo": tipi.get(str(a.tipo), "ampio")}, "budget_giorno": float(w.groupby("data").spesa.sum().mean()),
                "giorni": int(w.data.nunique()), "inizio": w.data.min().strftime("%Y-%m-%d"), "creativita": car, "leve": leve,
                "sconto": 0.3 if "sconto" in leve else 0.0}
        s = simula(camp, dettaglio=False)["totali"]
        righe.append({"adset_id": k, "campagna": a.vertical, "pubblico": camp["pubblico"]["tipo"],
                      "ctr_vero": float(100 * w.click.sum() / w.impression.sum()), "ctr_simulato": s["ctr"],
                      "cpm_vero": float(1000 * w.spesa.sum() / w.impression.sum()), "cpm_simulato": s["cpm"]})
    T = pd.DataFrame(righe)
    if not len(T):
        return T, {}
    b = _bench_canale("social")   # valore tipico reale, CTR sui click verso il sito
    T["ctr_riferimento"], T["cpm_riferimento"] = b["ctr"][1], b["cpm_eur"][1]
    err = lambda a_, b_: float(100 * np.mean(np.abs(a_ - b_) / b_))
    # ordine dei pubblici dentro ogni campagna (il livello assoluto dipende dalla marca, l'ordine dal pubblico)
    T["ctr_vero_rel"] = T.ctr_vero / T.groupby("campagna").ctr_vero.transform("mean")
    T["ctr_sim_rel"] = T.ctr_simulato / T.groupby("campagna").ctr_simulato.transform("mean")
    T["cpm_vero_rel"] = T.cpm_vero / T.groupby("campagna").cpm_vero.transform("mean")
    T["cpm_sim_rel"] = T.cpm_simulato / T.groupby("campagna").cpm_simulato.transform("mean")
    sintesi = {"ad_set": int(len(T)),
               "errore_ctr_%": err(T.ctr_simulato, T.ctr_vero), "errore_ctr_riferimento_%": err(T.ctr_riferimento, T.ctr_vero),
               "errore_cpm_%": err(T.cpm_simulato, T.cpm_vero), "errore_cpm_riferimento_%": err(T.cpm_riferimento, T.cpm_vero),
               "errore_ctr_relativo_%": err(T.ctr_sim_rel, T.ctr_vero_rel), "errore_cpm_relativo_%": err(T.cpm_sim_rel, T.cpm_vero_rel),
               "correlazione_ctr_relativo": float(np.corrcoef(T.ctr_sim_rel, T.ctr_vero_rel)[0, 1]),
               "correlazione_cpm_relativo": float(np.corrcoef(T.cpm_sim_rel, T.cpm_vero_rel)[0, 1])}
    return T, sintesi


DESCRIZIONI = {"ampio": "Tutti, senza filtri: decide la piattaforma a chi mostrarlo.",
               "interessi": "Chi segue la categoria del prodotto.",
               "sosia": "Persone simili a chi compra di solito questo tipo di prodotto.",
               "retargeting": "Chi ha già visitato il sito negli ultimi 30 giorni."}


def analizza_campagna(spec, consigli=True, n_persone=12):
    """Campagna nuova: la stessa campagna simulata su ogni tipo di pubblico, con lo stesso budget.
    Il pubblico migliore e una conseguenza dell'analisi (piu acquisti, click o persone raggiunte, secondo l'obiettivo).
    spec["taratura"] = {"ctr": x, "cpm": y}: scarti in scala logaritmica misurati su uno storico (stessa marca),
    per portare i livelli di partenza del settore a quelli veri della marca."""
    spec = dict(spec or {})
    tar = spec.pop("taratura", None) or {}
    s_ctr, s_cpm = float(tar.get("ctr") or 0.0), float(tar.get("cpm") or 0.0)
    c0 = normalizza({k: v for k, v in spec.items() if k != "pubblico"})
    tipi = ["ampio", "interessi", "sosia"] + ([] if c0["marchio"] == "nuovo" else ["retargeting"])
    if c0["canale"] in ("ricerca", "shopping"):
        tipi = ["ampio"] + ([] if c0["marchio"] == "nuovo" else ["retargeting"])
    if c0["canale"] == "email":
        tipi = ["retargeting"]
    base = {k: v for k, v in c0.items() if not k.startswith("_")}
    pubblici = []
    for i, tipo in enumerate(tipi):
        r = simula({**base, "pubblico": {"tipo": tipo}}, seed=7 + 11 * i, n_persone=n_persone, scarto_ctr=s_ctr, scarto_cpm=s_cpm)
        r.pop("_T", None)
        descr = DESCRIZIONI[tipo] if not (c0["filtri"] and tipo == "ampio") else "Tutte le persone del pubblico che hai indicato: decide la piattaforma."
        pubblici.append({"tipo": tipo, "nome": PUBBLICI[tipo].split(":")[0], "descrizione": descr,
                         "totali": r["totali"], "forchetta": r["forchetta"], "giorni": r["giorni"], "segmenti": r["segmenti"],
                         "migliori": r["migliori"][:5], "persone": r["persone"], "pubblico": r["pubblico"],
                         "risultato": _risultato(r["totali"], c0["obiettivo"])})
    migliore = max(pubblici, key=lambda x: x["risultato"])
    out = {"campagna": base, "ipotesi": c0["_ipotesi"] + ([] if "retargeting" in tipi else
                                                          ["Il pubblico di chi ha già visitato il sito non c'è: il marchio è nuovo"]),
           "valori_reali": simula({**base, "pubblico": {"tipo": migliore["tipo"]}}, dettaglio=False)["valori_reali"],
           "pubblici": pubblici, "migliore": migliore["tipo"], "taratura": {"ctr": s_ctr, "cpm": s_cpm} if tar else None,
           "creativita": {"effetti": [{"chiave": k_, "testo": d_, "click_%": round(100 * (math.exp(a_) - 1), 1), "acquisti_%": round(100 * (math.exp(b_) - 1), 1)}
                                      for k_, d_, a_, b_ in effetti_creativi(c0)],
                          "stile": STILI.get((c0.get("presentazione") or {}).get("stile")), "visivo": c0.get("visivo"), "presentazione": c0.get("presentazione")}}
    if consigli:
        out["consigli"] = consiglia(base)
    return out


def json_campagna(spec, consigli=True):
    """Per il sito: riceve la campagna (dizionario), restituisce simulazione e consigli in JSON."""
    try:
        return json.dumps(analizza_campagna(spec, consigli=consigli), ensure_ascii=False, default=float)
    except ValueError as err:
        return json.dumps({"errore": str(err)})
