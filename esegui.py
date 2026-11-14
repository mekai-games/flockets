"""Esegue Flockets su una cartella di dati e scrive i risultati.

    python3 esegui.py                         la cartella dati/ (il kit della sfida)
    python3 esegui.py mia_cartella            un altro storico: basta un CSV con data, annuncio, spesa, impression, click
    python3 esegui.py dati --sito             aggiorna anche i dati che legge il sito
    python3 esegui.py dati --salva-base       salva i fattori comuni come valori di base per altri storici

Opzioni: --orizzonte N (giorni da prevedere se non sono indicati), --uscita CARTELLA, --nome NOME,
         --senza-prove (salta le prove sul passato, molto piu veloce).
"""
import argparse
import json
import shutil
import sys
import warnings
from pathlib import Path

import numpy as np
import pandas as pd

RADICE = Path(__file__).resolve().parent
sys.path.insert(0, str(RADICE))
import flockets  # noqa: E402

warnings.filterwarnings("ignore")


def parametri(fc):
    c, m, d = fc.ctr, fc.cpm, fc.deliv
    pct = lambda x: round(100 * (float(np.exp(x)) - 1), 1)
    return {
        "fatica_ctr": {k: {"pavimento": v[0], "tau_giorni": v[1]} for k, v in c.fatigue.items()},
        "ctr_giorno_settimana_%": [pct(x) for x in c.dow_fx],
        "ctr_primi_3_giorni_%": pct(c.new3_fx),
        "ctr_rumore_extra_poisson": round(c.sigma_od, 3),
        "peso_caratteristiche_creativita": dict(zip(["costante"] + list(c.feat_cols), np.round(c.feat_w, 3).tolist())),
        "errore_cold_start_log": round(c.feat_loo_rmse, 3),
        "cpm_elasticita_budget": round(float(m.elasticity), 3),
        "cpm_elasticita_errore_std": round(m.elasticity_se, 3),
        "cpm_primi_3_giorni_annuncio_%": pct(m.new3_fx),
        "cpm_3_giorni_dopo_cambio_budget_%": pct(m.budlearn_fx),
        "cpm_giorno_settimana_%": [pct(x) for x in m.dow_fx],
        "cpm_sensibilita_alla_fatica": round(float(m.fat_fx), 3),
        "cpm_rumore_giornaliero_log": round(m.sigma, 3),
        "quota_spesa_esponente_qualita": round(float(d.a), 2),
        "quota_spesa_spinta_primi_4_giorni": round(float(np.exp(d.boost)), 2),
        "spesa_su_budget": round(d.spend_ratio, 3),
    }


def main():
    ap = argparse.ArgumentParser(description="Flockets: previsione di CTR e CPM da uno storico di campagna.")
    ap.add_argument("cartella", nargs="?", default=str(RADICE / "dati"))
    ap.add_argument("--orizzonte", type=int, default=14)
    ap.add_argument("--uscita", default=str(RADICE / "output"))
    ap.add_argument("--nome", default="previsioni")
    ap.add_argument("--sito", action="store_true")
    ap.add_argument("--salva-base", action="store_true")
    ap.add_argument("--senza-prove", action="store_true")
    a = ap.parse_args()
    out = Path(a.uscita)
    out.mkdir(parents=True, exist_ok=True)
    pd.set_option("display.width", 220, "display.max_columns", 30, "display.max_colwidth", 60)

    try:
        e = flockets.analizza(a.cartella, orizzonte=a.orizzonte, prove=not a.senza_prove,
                              origine="kit" if a.sito else "caricato", file_previsioni=a.nome + ".csv")
    except flockets.DatiNonValidi as err:
        sys.exit("Dati non validi: %s" % err)
    R, fc, P = e["dati"], e["modello"], e["previsioni"]

    print("== Dati ==")
    print("storico: %d righe, %d annunci, dal %s al %s" % (len(R["hist"]), R["hist"].ad_id.nunique(),
                                                           R["hist"].data.min().date(), R["hist"].data.max().date()))
    for n in R["note"]:
        print(" -", n)
    an = fc.train
    print("anomalie escluse: %d righe senza click, %d righe con spesa fuori budget" % (an.anom_click.sum(), an.anom_spesa.sum() if R["budget_noto"] else 0))

    if e["validazione"] is not None and len(e["validazione"]):
        print("\n== Prova sul passato (14 giorni nascosti, %d date) ==" % e["validazione"].taglio.nunique())
        print(e["validazione"].groupby(["gruppo", "modello"])[["CPM_MAPE_%", "CPM_bias_%", "CTR_WAPE_%", "CTR_MAE_pp", "CTR_bias_%"]].mean().round(2).to_string())
        e["validazione"].to_csv(out / "validazione_backtest.csv", index=False)
    if e["generalizzazione"] is not None and len(e["generalizzazione"]):
        print("\n== Prova di generalizzazione (un inserzionista alla volta tenuto fuori) ==")
        print(e["generalizzazione"].groupby(["storia", "modello"])[["CPM_MAPE_%", "CTR_WAPE_%"]].mean().round(2).to_string())
        e["generalizzazione"].to_csv(out / "prova_generalizzazione.csv", index=False)

    print("\n== Previsioni ==")
    P.to_csv(out / (a.nome + ".csv"), index=False)
    print("righe: %d | annunci: %d | giorni: %d" % (len(P), P.ad_id.nunique(), P.data.nunique()))
    print("stadio:", P.stadio.value_counts().to_dict(), "| affidabilita:", P.affidabilita.value_counts().to_dict())
    e["pubblici"].to_csv(out / "pubblici_adset.csv", index=False)
    e["scenario"].to_csv(out / "scenario_budget.csv", index=False)
    (out / "parametri_modello.json").write_text(json.dumps(parametri(fc), indent=2, ensure_ascii=False))
    print("\n== Pubblici ==")
    print(e["pubblici"][["adset_id", "pubblico_proposto", "ctr_vs_campagna", "cpm_vs_campagna", "frequenza_media", "grandezza_stimata"]].to_string(index=False))

    if a.salva_base:
        (RADICE / "flockets" / "valori_base.json").write_text(json.dumps(fc.valori_base(), indent=1, ensure_ascii=False))
        print("\nvalori di base salvati in flockets/valori_base.json")
    if a.sito:
        web = RADICE / "web"
        (web / "data").mkdir(parents=True, exist_ok=True)
        (web / "data" / "analisi.json").write_text(json.dumps(e["sito"], ensure_ascii=False, separators=(",", ":")))
        shutil.copy(out / (a.nome + ".csv"), web / "data" / (a.nome + ".csv"))
        (web / "motore" / "flockets").mkdir(parents=True, exist_ok=True)   # il sito usa lo stesso motore sui file caricati
        for f in (RADICE / "flockets").glob("*"):
            if f.suffix in (".py", ".json"):
                shutil.copy(f, web / "motore" / "flockets" / f.name)
        print("dati e motore del sito aggiornati in web/")
    print("\nFile scritti in", out)


if __name__ == "__main__":
    main()
