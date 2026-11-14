"""Prepara i dati che il sito legge: un solo file web/data/analisi.json.

    python3 modello/export_web.py        (dalla cartella del progetto)

Contiene previsioni, storico recente per i grafici, pubblici, scenario di budget, validazione e i
parametri del modello che servono al sito per ricalcolare al volo (cursori del budget, laboratorio).
"""
import json
import shutil
import sys
import warnings
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import wevion_model as wm  # noqa: E402
from run import pubblici, scenario_budget  # noqa: E402

warnings.filterwarnings("ignore")
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "output"
WEB = ROOT / "web" / "data"
TIPI = {"Prospecting": "ampio", "Interessi": "interessi", "Lookalike": "sosia", "Retargeting": "caldo"}


def r(x, n=4):
    return None if x is None or (isinstance(x, float) and not np.isfinite(x)) else round(float(x), n)


def main():
    WEB.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(exist_ok=True)
    R = wm.load(ROOT / "dati")
    fc = wm.Forecaster(R).fit(R["hist"])
    pred = fc.predict(R["fut"])
    panel = fc.last_panel
    hist = fc.train
    pred["fat"] = np.exp(wm.log_fatigue(panel.age, panel.leva, fc.ctr.fatigue))
    pred["bud_learn"] = panel.bud_learn.values

    ins = pd.read_csv(ROOT / "dati" / "inserzionisti.csv")
    camp = R["hist"][["inserzionista_id", "vertical", "campaign_id"]].drop_duplicates()
    P = pubblici(fc, R)
    S = scenario_budget(fc, pred)

    campagne = []
    for _, c in ins.iterrows():
        v = c.vertical
        campagne.append({"id": c.inserzionista_id, "nome": c.nome, "vertical": v, "descrizione": c.descrizione,
                         "adset": sorted(P[P.vertical == v].adset_id.tolist())})

    adsets = {}
    for _, a in P.iterrows():
        k = a.adset_id
        tipo = next(t for p, t in TIPI.items() if a.pubblico_proposto.startswith(p))
        bud = pred[pred.adset_id == k].groupby("data").budget_giornaliero_adset.first()
        sc = S[S.adset_id == k].iloc[0]
        c0, c1, fm = fc.deliv.freq[k]
        adsets[k] = {
            "vertical": a.vertical, "tipo": tipo, "pubblico": a.pubblico_proposto, "motivazione": a.motivazione,
            "ctr_rel": r(a.ctr_vs_campagna, 2), "cpm_rel": r(a.cpm_vs_campagna, 2), "frequenza": r(a.frequenza_media, 3),
            "grandezza": int(a.grandezza_stimata), "leva": a.leva_che_rende_di_piu,
            "budget_iniziale": float(a.budget_iniziale), "budget_test": float(bud.mean()),
            "budget_proposto": float(sc.budget_proposto),
            "freq_c0": r(c0, 5), "freq_c1": float(c1),
            "ctr_fx": r(fc.ctr.adset_fx[k], 5), "cpm_fx": r(fc.cpm.adset_fx[k], 5),
            "inter": {l: r(fc.ctr.inter_fx.get(k + "|" + l, 0.0), 5) for l in wm.LEVE},
            "bud_learn": {d.strftime("%Y-%m-%d"): float(v) for d, v in
                          pred[pred.adset_id == k].groupby("data").bud_learn.first().items()},
        }

    assets = R["assets"].set_index("asset_id")
    ads = {}
    for _, a in R["ann"].iterrows():
        s = assets.loc[a.asset_id]
        ads[a.ad_id] = {"adset": a.adset_id, "asset": a.asset_id, "leva": s.leva, "formato": s.formato,
                        "titolo": s.headline, "testo": s.testo_principale, "visual": s.descrizione_visual,
                        "lancio": a.data_lancio.strftime("%Y-%m-%d"),
                        "cold": bool(a.asset_id not in fc.ctr.asset_fx),
                        "in_test": bool(a.ad_id in set(pred.ad_id))}

    pr = []
    for _, x in pred.iterrows():
        pr.append([x.data.strftime("%Y-%m-%d"), x.ad_id, r(x.ctr_prev), r(x.ctr_p10), r(x.ctr_p90), r(x.ctr_atteso_p10),
                   r(x.ctr_atteso_p90), r(x.cpm_prev, 3), r(x.cpm_p10, 3), r(x.cpm_p90, 3), r(x.cpc_prev), r(x.quota_spesa_prev, 3),
                   r(x.spesa_prev, 2), int(round(x.impression_prev)), r(x.click_prev, 1), r(x.fat, 3), int(x.age)])
    pred_cols = ["d", "ad", "ctr", "c10", "c90", "a10", "a90", "cpm", "m10", "m90", "cpc", "quota", "spesa", "imp", "clk", "fat", "eta"]

    last = R["hist"].data.max()
    h = hist[(hist.data > last - pd.Timedelta(days=28)) & hist.ad_id.isin(pred.ad_id.unique())]
    hs = [[x.data.strftime("%Y-%m-%d"), x.ad_id, r(x.ctr), r(x.cpm, 3), int(x.impression), int(x.click), r(x.spesa, 2),
           bool(x.anom_click)] for _, x in h.iterrows()]

    anomalie = []
    for (v, d), g in hist[hist.anom_click].groupby(["vertical", "data"]):
        anomalie.append({"data": d.strftime("%Y-%m-%d"), "dove": v,
                         "cosa": "zero click su tutti gli annunci (%d): tracciamento rotto, giorno escluso dalla stima" % len(g)})
    for (k, d), g in hist[hist.anom_spesa].groupby(["adset_id", "data"]):
        anomalie.append({"data": d.strftime("%Y-%m-%d"), "dove": k,
                         "cosa": "spesa %.0f euro con budget %.0f: giorno escluso dalla stima delle quote"
                                 % (g.spesa.sum(), g.budget_giornaliero_adset.iloc[0])})

    V = pd.read_csv(OUT / "validazione_backtest.csv") if (OUT / "validazione_backtest.csv").exists() else None
    val = []
    if V is not None:
        g = V.groupby(["gruppo", "modello"])[["CPM_MAPE_%", "CTR_WAPE_%", "CTR_cop80_%", "CPM_cop80_%"]].mean().reset_index()
        val = [{"gruppo": x.gruppo, "modello": x.modello, "cpm": r(x["CPM_MAPE_%"], 1), "ctr": r(x["CTR_WAPE_%"], 1),
                "cop_ctr": r(x["CTR_cop80_%"], 0), "cop_cpm": r(x["CPM_cop80_%"], 0)} for _, x in g.iterrows()]

    s_cpm, s_cpm_own, s_ctr, ev_weeks = wm.seasonal_tables(R)
    weeks = sorted(set(panel.wk))
    stag = {"cpm": {w.strftime("%Y-%m-%d"): r(s_cpm.set_index("wk").s_cpm[w], 5) for w in weeks}, "ctr": {}}
    for v, g in s_ctr.groupby("vertical"):
        g = g.set_index("wk")
        stag["ctr"][v] = {w.strftime("%Y-%m-%d"): r(g.s_ctr[w], 5) for w in weeks}

    c, m, d = fc.ctr, fc.cpm, fc.deliv
    qual = {}
    for a, v in zip(c.assets_, c.asset_vert):
        qual.setdefault(v, []).append(r(c.asset_fx[a], 4))
    par = {
        "fatica": {k: list(v) for k, v in c.fatigue.items()},
        "ctr_dow": [r(x, 5) for x in c.dow_fx], "ctr_new3": r(c.new3_fx, 5),
        "feat_cols": c.feat_cols, "feat_w": [r(x, 5) for x in c.feat_w], "cold_sd": r(c.feat_loo_rmse, 4),
        "feat_regole": wm.FEATURE_RULES,
        "cpm_dow": [r(x, 5) for x in m.dow_fx], "cpm_idx": r(m.idx_coef, 5), "elasticita": r(m.elasticity, 4),
        "cpm_new3": r(m.new3_fx, 5), "cpm_budlearn": r(m.budlearn_fx, 5), "cpm_fat": r(m.fat_fx, 5),
        "cpm_q": [r(x, 5) for x in m.q_w], "cpm_sigma": r(m.sigma, 4),
        "spesa_su_budget": r(d.spend_ratio, 4), "qualita_asset": qual,
    }

    data = {
        "meta": {"storico_dal": R["hist"].data.min().strftime("%Y-%m-%d"), "storico_al": last.strftime("%Y-%m-%d"),
                 "giorni": sorted(pred.data.dt.strftime("%Y-%m-%d").unique().tolist()),
                 "righe_storico": int(len(R["hist"])), "righe_previste": int(len(pred)),
                 "annunci_previsti": int(pred.ad_id.nunique()), "righe_cold": int(pred.cold_start.sum()),
                 "eventi": {x.data.strftime("%Y-%m-%d"): x.evento for _, x in R["cal"].dropna(subset=["evento"]).iterrows()}},
        "campagne": campagne, "adset": adsets, "ads": ads, "ads_storico": sorted(R["hist"].ad_id.unique().tolist()),
        "pred_cols": pred_cols, "pred": pr, "hist_cols": ["d", "ad", "ctr", "cpm", "imp", "clk", "spesa", "anom"], "hist": hs,
        "anomalie": anomalie, "validazione": val, "stagione": stag, "par": par,
    }
    (WEB / "analisi.json").write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
    shutil.copy(OUT / "previsioni_16-30_nov.csv", WEB / "previsioni_16-30_nov.csv")
    print("scritto", WEB / "analisi.json", "%.0f KB" % ((WEB / "analisi.json").stat().st_size / 1024))


if __name__ == "__main__":
    main()
