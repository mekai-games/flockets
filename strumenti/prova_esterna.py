"""Prova il motore su uno storico che non è del kit: nasconde gli ultimi giorni, li prevede e confronta.

    python3 strumenti/prova_esterna.py percorso/file.csv
    python3 strumenti/prova_esterna.py file.csv --mappa data=Date ad_id=Campaign spesa=Cost --giorni 14

Serve un CSV con una riga per annuncio (o campagna) e per giorno: data, identificativo, spesa, impression, click.
I nomi delle colonne più comuni sono riconosciuti da soli (vedi `flockets/contratto.py`); `--mappa` serve per gli altri.
Confronta quattro modi di prevedere gli stessi giorni nascosti:

  solo i suoi dati       tutto stimato sullo storico caricato
  con valori di base     i fattori comuni (fatica, giorno della settimana, effetto del budget) partono da quelli
                         del kit della sfida e lo storico li corregge dove ha abbastanza dati
  fattori comuni fissi   i fattori comuni restano quelli del kit, lo storico stima solo i livelli
  ultimi 7 giorni        riferimento ingenuo: ogni annuncio resta dov'era nell'ultima settimana
"""
import argparse
import sys
import warnings
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import flockets  # noqa: E402
from flockets import motore  # noqa: E402

warnings.filterwarnings("ignore")
COLONNE = ["CPM_MAPE_%", "CPM_minimo_%", "CPM_bias_%", "CTR_WAPE_%", "CTR_minimo_%", "CTR_bias_%", "CTR_cop80_%", "CPM_cop80_%"]


def prepara(df, mappa, min_impression, tieni):
    df = df.rename(columns={v: k for k, v in mappa.items()})
    if tieni:
        col, val = tieni.split("=", 1)
        df = df[df[col].astype(str) == val]
    return df, min_impression


def prova(R, giorni, indietro, simulazioni):
    h = R["hist"]
    primo, ultimo = h.data.min(), h.data.max()
    base = flockets.valori_base()
    modi = [("solo i suoi dati", dict(base=None, forza=0.0)), ("con valori di base", dict(base=base, forza=0.0)),
            ("fattori comuni fissi", dict(base=base, forza=1e3))]
    righe = []
    for g in indietro:
        taglio = ultimo - pd.Timedelta(days=g)
        if (taglio - primo).days < 21:
            continue
        for nome, kw in modi:
            try:
                T, _, _ = motore.backtest(R, taglio, horizon=giorni, n_sim=simulazioni, **kw)
            except Exception as err:   # un modo che non regge su questi dati va detto, non nascosto
                righe.append({"taglio": str(taglio.date()), "modello": nome, "errore": "%s: %s" % (type(err).__name__, str(err)[:80])})
                continue
            t = T[T.gruppo == "tutti"]
            for _, x in t.iterrows():
                if x.modello == "strutturale" or nome == modi[0][0]:
                    righe.append(dict({c: x.get(c, np.nan) for c in COLONNE}, taglio=x.taglio, righe=x.righe,
                                      modello=nome if x.modello == "strutturale" else "ultimi 7 giorni"))
    return pd.DataFrame(righe)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("file", nargs="+", help="uno o più CSV (storico, e se ci sono budget, annunci, creatività)")
    ap.add_argument("--mappa", nargs="*", default=[], help="nome_del_motore=NomeNelFile, es. ad_id=Campaign")
    ap.add_argument("--giorni", type=int, default=14, help="giorni nascosti a ogni prova")
    ap.add_argument("--indietro", type=int, nargs="*", default=[14, 21, 28, 35], help="quanti giorni prima della fine si taglia")
    ap.add_argument("--min-impression", type=int, default=0, help="scarta le righe con meno impression")
    ap.add_argument("--tieni", default="", help="filtro colonna=valore sullo storico, es. Platform=Facebook")
    ap.add_argument("--separatore", default=None)
    ap.add_argument("--simulazioni", type=int, default=400)
    a = ap.parse_args()

    mappa = dict(x.split("=", 1) for x in a.mappa)
    tabelle = {}
    for i, f in enumerate(a.file):
        df = pd.read_csv(f, sep=a.separatore, engine="python", encoding="utf-8-sig")
        if i == 0:
            df, _ = prepara(df, mappa, a.min_impression, a.tieni)
            nome = "storico.csv"
        else:
            nome = Path(f).name
        tabelle[nome] = df
    R = flockets.costruisci(tabelle, a.giorni)
    if a.min_impression:
        R["hist"] = R["hist"][R["hist"].impression >= a.min_impression]
    h = R["hist"]
    print("== Dati ==")
    print("%d righe, %d annunci, %d ad set, dal %s al %s (%d giorni)" % (len(h), h.ad_id.nunique(), h.adset_id.nunique(), h.data.min().date(), h.data.max().date(), h.data.nunique()))
    print("al giorno per annuncio (mediana): %d impression, %d click, %.2f di spesa | CTR medio %.2f%%, CPM medio %.2f" % (
        h.impression.median(), h.click.median(), h.spesa.median(), 100 * h.click.sum() / h.impression.sum(), 1000 * h.spesa.sum() / h.impression.sum()))
    for n in R["note"]:
        print(" -", n)
    perche = flockets.serve_base(R)
    print("valori di base:", "servono (" + "; ".join(perche) + ")" if perche else "non servono, lo storico basta")

    T = prova(R, a.giorni, a.indietro, a.simulazioni)
    if not len(T):
        print("\nStorico troppo corto per nascondere %d giorni." % a.giorni)
        return
    if "errore" in T:
        for _, x in T[T.errore.notna()].iterrows():
            print("non riuscito: taglio %s, %s -> %s" % (x.taglio, x.modello, x.errore))
        T = T[T.errore.isna()] if "CPM_MAPE_%" in T else T.iloc[0:0]
    if not len(T):
        return
    print("\n== Prova sul passato (%d giorni nascosti, %d date) ==" % (a.giorni, T.taglio.nunique()))
    ordine = ["solo i suoi dati", "con valori di base", "fattori comuni fissi", "ultimi 7 giorni"]
    M = T.groupby("modello")[[c for c in COLONNE if c in T]].mean().reindex(ordine).dropna(how="all")
    print(M.round(2).to_string())
    print("\nper data:")
    print(T.pivot_table(index="taglio", columns="modello", values=["CPM_MAPE_%", "CTR_WAPE_%"]).round(1).to_string())


if __name__ == "__main__":
    main()
