"""Ricava dal dataset pubblico di Conjura i valori di partenza del simulatore: click, costi e acquisti veri.

    curl -L -o conjura_mmm.csv https://ndownloader.figshare.com/files/46779652      # 36,7 MB
    python3 strumenti/benchmark_conjura.py conjura_mmm.csv                          # scrive flockets/benchmark.json

Fonte: Conjura, «Multi-Region Marketing Mix Modeling (MMM) Dataset for Several eCommerce Brands»,
figshare 25314841, licenza CC BY 4.0. Il file non è nel repository; nel repository c'è solo la tabella riassuntiva.

Cosa ricava:
- per canale (social, video brevi, ricerca, shopping, display, video): CTR e CPM di ogni marca, poi
  10°, 50° e 90° percentile tra le marche. Il CPM solo da marche in euro, sterline e dollari, convertiti in euro;
- per settore: acquisti ogni 100 visite al sito (tutte le fonti di traffico) e valore medio dell'ordine;
- per mese: quanto CPM, CTR e acquisti per visita si scostano dalla media dell'anno della stessa marca.
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

USCITA = Path(__file__).resolve().parent.parent / "flockets" / "benchmark.json"
CAMBI = {"EUR": 1.0, "GBP": 1.16, "USD": 0.92}   # ordine di grandezza, basta per un CPM di riferimento
CANALI = {"social": ["META_FACEBOOK", "META_INSTAGRAM"], "video_brevi": ["TIKTOK"], "ricerca": ["GOOGLE_PAID_SEARCH"],
          "shopping": ["GOOGLE_SHOPPING"], "display": ["GOOGLE_DISPLAY"], "video": ["GOOGLE_VIDEO"]}
SETTORI = {   # settore Conjura -> categorie di prodotto del simulatore
    "Apparel": ["moda"], "Beauty & Fitness": ["beauty"], "Home & Garden": ["casa_arredo"], "Food & Drink": ["cibo_bevande"],
    "Health": ["salute_benessere"], "Sports": ["sport_fitness"], "Consumer Electronics": ["tecnologia"],
    "Pets & Animals": ["animali"], "Toys & Hobbies": ["videogiochi", "bambini_famiglia"], "Travel": ["viaggi"],
    "Arts & Entertainment": ["intrattenimento"], "Autos & Vehicles": ["auto_moto"], "Business & Industrial": ["formazione_lavoro"],
}
PERC = (10, 50, 90)


def percentili(v):
    v = np.asarray(v, dtype=float)
    v = v[np.isfinite(v)]
    return [round(float(np.percentile(v, p)), 4) for p in PERC] if len(v) else None


def main(percorso):
    d = pd.read_csv(percorso, parse_dates=["DATE_DAY"])
    a = d[d.TERRITORY_NAME == "All Territories"].copy()
    out = {"fonte": "Conjura, Multi-Region Marketing Mix Modeling (MMM) Dataset for Several eCommerce Brands, "
                    "figshare 25314841, licenza CC BY 4.0. Elaborazione: strumenti/benchmark_conjura.py",
           "marche": int(a.ORGANISATION_ID.nunique()), "dal": str(a.DATE_DAY.min().date()), "al": str(a.DATE_DAY.max().date()),
           "canali": {}, "settori": {}, "mesi": {}}

    for nome, colonne in CANALI.items():
        s = sum(a[c + "_SPEND"].fillna(0) for c in colonne)
        i = sum(a[c + "_IMPRESSIONS"].fillna(0) for c in colonne)
        k = sum(a[c + "_CLICKS"].fillna(0) for c in colonne)
        x = pd.DataFrame({"marca": a.ORGANISATION_ID, "valuta": a.CURRENCY_CODE, "settore": a.ORGANISATION_VERTICAL, "s": s, "i": i, "k": k})
        x = x[(x.i > 0) & (x.s > 0)]
        m = x.groupby(["marca", "valuta", "settore"]).agg(s=("s", "sum"), i=("i", "sum"), k=("k", "sum"), giorni=("s", "size")).reset_index()
        m = m[(m.i > 50000) & (m.giorni > 60) & (m.k > 0)]
        m["ctr"] = 100 * m.k / m.i
        e = m[m.valuta.isin(CAMBI)].copy()
        e["cpm"] = 1000 * e.s / e.i * e.valuta.map(CAMBI)
        # quanto differiscono tra loro marche dello stesso settore (CTR) e dello stesso paese (CPM, solo sterline: il gruppo piu grande)
        lc = np.log(m.ctr)
        entro = (lc - lc.groupby(m.settore).transform("median"))[m.groupby("settore").ctr.transform("size") >= 3]
        gb = m[m.valuta == "GBP"]
        out["canali"][nome] = {"marche": int(len(m)), "ctr": percentili(m.ctr), "cpm_eur": percentili(e.cpm),
                               "sd_log_ctr": round(float(lc.std()), 3), "sd_log_cpm": round(float(np.log(e.cpm).std()), 3),
                               "sd_log_ctr_settore": round(float(entro.std()), 3) if len(entro) > 4 else round(float(lc.std()), 3),
                               "sd_log_cpm_paese": round(float(np.log(1000 * gb.s / gb.i).std()), 3) if len(gb) > 4 else round(float(np.log(e.cpm).std()), 3)}

    pagati = [c for c in a.columns if c.endswith("_CLICKS") and c.startswith(("GOOGLE", "META", "TIKTOK"))]
    altre = ["DIRECT_CLICKS", "BRANDED_SEARCH_CLICKS", "ORGANIC_SEARCH_CLICKS", "EMAIL_CLICKS", "REFERRAL_CLICKS", "ALL_OTHER_CLICKS"]
    a["visite"] = a[pagati + altre].fillna(0).sum(axis=1)
    g = a.groupby(["ORGANISATION_VERTICAL", "ORGANISATION_ID", "CURRENCY_CODE"]).agg(
        acq=("ALL_PURCHASES", "sum"), vis=("visite", "sum"), val=("ALL_PURCHASES_ORIGINAL_PRICE", "sum")).reset_index()
    g = g[(g.vis > 10000) & (g.acq > 100)]
    g["cvr"] = 100 * g.acq / g.vis
    g["aov"] = g.val / g.acq * g.CURRENCY_CODE.map(CAMBI)
    for settore, gg in g.groupby("ORGANISATION_VERTICAL"):
        out["settori"][settore] = {"marche": int(len(gg)), "acquisti_su_100_visite": percentili(gg.cvr),
                                   "valore_ordine_eur": percentili(gg.aov.dropna()), "categorie": SETTORI.get(settore, [])}
    lv = np.log(g.cvr)
    entro = (lv - lv.groupby(g.ORGANISATION_VERTICAL).transform("median"))[g.groupby("ORGANISATION_VERTICAL").cvr.transform("size") >= 3]
    out["settori"]["_tutti"] = {"marche": int(len(g)), "acquisti_su_100_visite": percentili(g.cvr),
                                "valore_ordine_eur": percentili(g.aov.dropna()), "sd_log_cvr": round(float(lv.std()), 3),
                                "sd_log_cvr_settore": round(float(entro.std()), 3)}

    a["anno"], a["m"] = a.DATE_DAY.dt.year, a.DATE_DAY.dt.month
    s = a.META_FACEBOOK_SPEND.fillna(0) + a.META_INSTAGRAM_SPEND.fillna(0)
    i = a.META_FACEBOOK_IMPRESSIONS.fillna(0) + a.META_INSTAGRAM_IMPRESSIONS.fillna(0)
    k = a.META_FACEBOOK_CLICKS.fillna(0) + a.META_INSTAGRAM_CLICKS.fillna(0)
    m = pd.DataFrame({"b": a.ORGANISATION_ID, "anno": a.anno, "m": a.m, "s": s, "i": i, "k": k,
                      "acq": a.ALL_PURCHASES.fillna(0), "vis": a.visite}).groupby(["b", "anno", "m"]).sum().reset_index()
    m = m[(m.i > 20000) & (m.vis > 1000)]
    m["cpm"], m["ctr"], m["cvr"] = np.log(m.s / m.i), np.log((m.k + 1) / m.i), np.log((m.acq + 1) / m.vis)
    for c in ("cpm", "ctr", "cvr"):
        m[c] = m[c] - m.groupby(["b", "anno"])[c].transform("mean")
    pieni = m.groupby(["b", "anno"]).m.transform("size") >= 10
    st = m[pieni].groupby("m")[["cpm", "ctr", "cvr"]].median()
    out["mesi"] = {c: [round(float(st.loc[x, c]), 4) for x in range(1, 13)] for c in ("cpm", "ctr", "cvr")}
    out["mesi"]["nota"] = "logaritmo dello scostamento dalla media dell'anno, gennaio..dicembre, mediana tra marche (Meta per CPM e CTR)"

    USCITA.write_text(json.dumps(out, ensure_ascii=False, indent=1))
    print("scritto", USCITA)
    for k_, v in out["canali"].items():
        print("  %-12s CTR %s  CPM %s" % (k_, v["ctr"], v["cpm_eur"]))


if __name__ == "__main__":
    main(sys.argv[1])
