"""Esegue tutto: validazione sullo storico, previsioni 16-30 novembre, pubblici, scenario budget.

    python3 modello/run.py            (dalla cartella del progetto)

Scrive i risultati in output/.
"""
import json
import sys
import warnings
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import wevion_model as wm  # noqa: E402

warnings.filterwarnings("ignore")
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "output"
CUTS = ["2026-11-01", "2026-10-25", "2026-10-18", "2026-10-04"]


def validazione(R):
    tabs = [wm.backtest(R, c)[0] for c in CUTS]
    T = pd.concat(tabs, ignore_index=True)
    cols = ["taglio", "gruppo", "modello", "righe", "CPM_MAPE_%", "CPM_bias_%", "CTR_WAPE_%", "CTR_MAPE_%",
            "CTR_MAE_pp", "CTR_bias_%", "CTR_cop80_%", "CPM_cop80_%"]
    T = T[cols].round(2)
    T.to_csv(OUT / "validazione_backtest.csv", index=False)
    return T


def pubblici(fc, R):
    """Dai numeri al pubblico: grandezza (dalla frequenza), temperatura (CTR e CPM relativi), leva preferita."""
    c, m, d = fc.ctr, fc.cpm, fc.deliv
    ads = R["adset"].merge(R["hist"][["adset_id", "vertical"]].drop_duplicates(), on="adset_id")
    rows = []
    for _, a in ads.iterrows():
        k = a.adset_id
        same = ads[ads.vertical == a.vertical].adset_id
        ctr_rel = np.exp(c.adset_fx[k] - np.mean([c.adset_fx[x] for x in same]))
        cpm_rel = np.exp(m.adset_fx[k] - np.mean([m.adset_fx[x] for x in same]))
        c0, c1, fmean = d.freq[k]
        size = 1.0 / (2.0 * c1) if c1 > 0 else np.inf
        lev = {l: c.inter_fx.get(k + "|" + l, 0.0) for l in ["scarcity", "urgency"]}
        best = max(lev, key=lev.get)
        gap = 100 * (np.exp(lev[best] - min(lev.values())) - 1)
        if gap < 3:
            best = "nessuna differenza netta"
        if fmean > 1.1:
            tipo = "Retargeting caldo: visitatori del sito, carrelli abbandonati e clienti (ultimi 30 giorni)"
            perche = ("frequenza %.2f (gli stessi utenti rivedono l'annuncio), CTR %.1fx la media della campagna, "
                      "CPM %.1fx: pubblico piccolo, gia interessato e conteso" % (fmean, ctr_rel, cpm_rel))
        elif size > 8e6:
            tipo = "Prospecting ampio: Italia 18-65, targeting aperto (Advantage+)"
            perche = ("CPM piu basso della campagna (%.2fx) e CTR piu basso (%.2fx), frequenza ferma a %.2f anche con il "
                      "budget maggiore: pubblico freddo di milioni di persone" % (cpm_rel, ctr_rel, fmean))
        elif size > 2e6:
            tipo = "Interessi di categoria: pubblico freddo ma in tema"
            perche = ("CPM e CTR vicini alla media (%.2fx, %.2fx), pubblico di qualche milione: persone selezionate "
                      "per interesse, non ancora in contatto col marchio" % (cpm_rel, ctr_rel))
        else:
            tipo = "Lookalike 1-3% degli acquirenti"
            perche = ("pubblico sotto il milione, CPM alto (%.2fx) ma CTR sopra i pubblici freddi (%.2fx): "
                      "sosia dei clienti, piu costosi da raggiungere e piu reattivi" % (cpm_rel, ctr_rel))
        rows.append({"adset_id": k, "vertical": a.vertical, "budget_iniziale": a.budget_giornaliero_iniziale,
                     "pubblico_proposto": tipo, "motivazione": perche,
                     "ctr_vs_campagna": round(ctr_rel, 2), "cpm_vs_campagna": round(cpm_rel, 2),
                     "frequenza_media": round(fmean, 3),
                     "grandezza_stimata": int(round(min(size, 2e7), -3)),  # ordine di grandezza; oltre 20 milioni non si distingue
                     "leva_che_rende_di_piu": best, "vantaggio_leva_%": round(gap, 1)})
    P = pd.DataFrame(rows)
    P.to_csv(OUT / "pubblici_adset.csv", index=False)
    return P


def scenario_budget(fc, pred, lo=0.6, hi=1.6):
    """Dove spostare il budget dentro ogni campagna, a spesa totale invariata, per avere piu click.
    Rendimenti decrescenti: il CPM sale con il budget (elasticita stimata), quindi click ~ budget^(1-e)."""
    e = fc.cpm.elasticity
    g = pred.groupby(["vertical", "adset_id"]).agg(budget=("budget_giornaliero_adset", "mean"),
                                                   spesa=("spesa_prev", "sum"), click=("click_prev", "sum"),
                                                   giorni=("data", "nunique")).reset_index()
    g["cpc_prev"] = g.spesa / g.click
    out = []
    for v, q in g.groupby("vertical"):
        B0, c = q.budget.values, q.click.values
        tot = B0.sum()

        def alloc(lmb):
            return np.clip(B0 * (c * (1 - e) / (lmb * B0)) ** (1 / e), lo * B0, hi * B0)

        a, b = 1e-9, 1e9
        for _ in range(200):
            mid = np.sqrt(a * b)
            if alloc(mid).sum() > tot:
                a = mid
            else:
                b = mid
        B1 = alloc(np.sqrt(a * b))
        q = q.assign(budget_proposto=np.round(B1, 0), click_proposti=c * (B1 / B0) ** (1 - e))
        q["cpc_marginale"] = q.spesa / q.giorni / (q.click / q.giorni * (1 - e))
        out.append(q)
    S = pd.concat(out, ignore_index=True)
    S["variazione_budget_%"] = (100 * (S.budget_proposto / S.budget - 1)).round(0)
    S["click_guadagnati_%"] = (100 * (S.click_proposti / S.click - 1)).round(1)
    S = S[["vertical", "adset_id", "budget", "budget_proposto", "variazione_budget_%", "cpc_prev", "cpc_marginale",
           "click", "click_proposti", "click_guadagnati_%"]].round(3)
    S.to_csv(OUT / "scenario_budget.csv", index=False)
    return S


def main():
    OUT.mkdir(exist_ok=True)
    R = wm.load(ROOT / "dati")
    pd.set_option("display.width", 220, "display.max_columns", 30, "display.max_colwidth", 60)

    print("== 1. Validazione (previsione di 14 giorni mai visti, 4 tagli dello storico) ==")
    T = validazione(R)
    c = ["CPM_MAPE_%", "CPM_bias_%", "CTR_WAPE_%", "CTR_MAE_pp", "CTR_bias_%"]
    print(T.groupby(["gruppo", "modello"])[c].mean().round(2).to_string())

    print("\n== 2. Modello finale su tutto lo storico ==")
    fc = wm.Forecaster(R).fit(R["hist"])
    an = fc.train
    print("anomalie escluse: %d righe senza click (tracciamento), %d righe con spesa fuori budget"
          % (an.anom_click.sum(), an.anom_spesa.sum()))
    par = {
        "fatica_ctr": {k: {"pavimento": v[0], "tau_giorni": v[1]} for k, v in fc.ctr.fatigue.items()},
        "ctr_giorno_settimana_%": [round(100 * (np.exp(x) - 1), 1) for x in fc.ctr.dow_fx],
        "ctr_primi_3_giorni_%": round(100 * (np.exp(fc.ctr.new3_fx) - 1), 1),
        "ctr_rumore_extra_poisson": round(fc.ctr.sigma_od, 3),
        "peso_caratteristiche_creativita": dict(zip(["costante"] + fc.ctr.feat_cols, np.round(fc.ctr.feat_w, 3).tolist())),
        "errore_cold_start_log": round(fc.ctr.feat_loo_rmse, 3),
        "cpm_elasticita_budget": round(float(fc.cpm.elasticity), 3),
        "cpm_elasticita_errore_std": round(fc.cpm.elasticity_se, 3),
        "cpm_primi_3_giorni_annuncio_%": round(100 * (np.exp(fc.cpm.new3_fx) - 1), 1),
        "cpm_3_giorni_dopo_cambio_budget_%": round(100 * (np.exp(fc.cpm.budlearn_fx) - 1), 1),
        "cpm_giorno_settimana_%": [round(100 * (np.exp(x) - 1), 1) for x in fc.cpm.dow_fx],
        "cpm_sensibilita_alla_fatica": round(float(fc.cpm.fat_fx), 3),
        "cpm_rumore_giornaliero_log": round(fc.cpm.sigma, 3),
        "quota_spesa_esponente_qualita": round(float(fc.deliv.a), 2),
        "quota_spesa_spinta_primi_4_giorni": round(float(np.exp(fc.deliv.boost)), 2),
        "spesa_su_budget": round(fc.deliv.spend_ratio, 3),
    }
    (OUT / "parametri_modello.json").write_text(json.dumps(par, indent=2, ensure_ascii=False))
    print(json.dumps(par, indent=1, ensure_ascii=False))

    print("\n== 3. Previsioni 16-30 novembre ==")
    pred = fc.predict(R["fut"])
    cols = ["data", "ad_id", "adset_id", "asset_id", "leva", "formato", "budget_giornaliero_adset",
            "ctr_prev", "ctr_p10", "ctr_p90", "ctr_atteso_p10", "ctr_atteso_p90", "cpm_prev", "cpm_p10", "cpm_p90",
            "cpc_prev", "quota_spesa_prev", "spesa_prev", "impression_prev", "click_prev", "frequenza_prev",
            "copertura_prev", "cold_start"]
    P = pred[cols].copy()
    for k in ["ctr_prev", "ctr_p10", "ctr_p90", "ctr_atteso_p10", "ctr_atteso_p90", "cpm_prev", "cpm_p10", "cpm_p90",
              "cpc_prev", "quota_spesa_prev", "frequenza_prev"]:
        P[k] = P[k].round(4)
    for k in ["spesa_prev"]:
        P[k] = P[k].round(2)
    for k in ["impression_prev", "click_prev", "copertura_prev"]:
        P[k] = P[k].round(0).astype(int)
    P["data"] = P.data.dt.strftime("%Y-%m-%d")
    P.to_csv(OUT / "previsioni_16-30_nov.csv", index=False)
    assert len(P) == len(R["fut"]) and P[["ctr_prev", "cpm_prev"]].notna().all().all()
    print("righe:", len(P), "| annunci:", P.ad_id.nunique(), "| righe cold start:", int(P.cold_start.sum()))

    print("\n== 4. Pubblici ==")
    print(pubblici(fc, R)[["adset_id", "pubblico_proposto", "ctr_vs_campagna", "cpm_vs_campagna",
                           "frequenza_media", "grandezza_stimata", "leva_che_rende_di_piu"]].to_string(index=False))

    print("\n== 5. Scenario budget (a spesa invariata per campagna) ==")
    print(scenario_budget(fc, pred).to_string(index=False))
    print("\nFile scritti in", OUT)


if __name__ == "__main__":
    main()
