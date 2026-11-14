"""Dai numeri del motore a cio che si legge: pubblici, scenario di budget, prove, dati per il sito."""
import numpy as np
import pandas as pd

from . import motore as wm
from .contratto import sottoinsieme

COLONNE_PROVA = ["taglio", "gruppo", "modello", "righe", "CPM_MAPE_%", "CPM_minimo_%", "CPM_bias_%", "CTR_WAPE_%", "CTR_minimo_%",
                 "CTR_MAPE_%", "CTR_MAE_pp", "CTR_bias_%", "CTR_cop80_%", "CPM_cop80_%"]


def r(x, n=4):
    return None if x is None or (isinstance(x, float) and not np.isfinite(x)) else round(float(x), n)


# ------------------------------------------------------------------------------ pubblici
def pubblici(fc, R):
    """Dai numeri al pubblico: grandezza (dalla frequenza), temperatura (CTR e CPM relativi), leva preferita."""
    c, m, d = fc.ctr, fc.cpm, fc.deliv
    h = R["hist"]
    ads = R["adset"].merge(h[["adset_id", "vertical"]].drop_duplicates("adset_id"), on="adset_id")
    leve = [l for l in c.fatigue if not l.startswith("_")]
    rows = []
    for _, a in ads.iterrows():
        k = a.adset_id
        same = ads[ads.vertical == a.vertical].adset_id
        ctr_rel = np.exp(c.adset_fx[k] - np.mean([c.adset_fx[x] for x in same]))
        cpm_rel = np.exp(m.adset_fx[k] - np.mean([m.adset_fx[x] for x in same]))
        c0, c1, fmean = d.freq[k]
        size = 1.0 / (2.0 * c1) if c1 > 0 else np.inf
        lev = {l: c.inter_fx.get(k + "|" + l, 0.0) for l in leve}
        best, gap = "nessuna differenza netta", 0.0
        if len(lev) >= 2:
            best = max(lev, key=lev.get)
            gap = 100 * (np.exp(lev[best] - min(lev.values())) - 1)
            if gap < 3:
                best = "nessuna differenza netta"
        if len(same) == 1:
            tipo, nome = "unico", "Pubblico unico"
            perche = "e il solo ad set della campagna: non ci sono altri pubblici con cui confrontarlo"
        elif R.get("copertura_nota", True) and fmean > 1.1:
            tipo, nome = "caldo", "Retargeting caldo: visitatori del sito, carrelli abbandonati e clienti (ultimi 30 giorni)"
            perche = ("frequenza %.2f (gli stessi utenti rivedono l'annuncio), CTR %.1fx la media della campagna, "
                      "CPM %.1fx: pubblico piccolo, gia interessato e conteso" % (fmean, ctr_rel, cpm_rel))
        elif R.get("copertura_nota", True) and size > 8e6:
            tipo, nome = "ampio", "Prospecting ampio: Italia 18-65, targeting aperto (Advantage+)"
            perche = ("CPM piu basso della campagna (%.2fx) e CTR piu basso (%.2fx), frequenza ferma a %.2f anche con il "
                      "budget maggiore: pubblico freddo di milioni di persone" % (cpm_rel, ctr_rel, fmean))
        elif R.get("copertura_nota", True) and size > 2e6:
            tipo, nome = "interessi", "Interessi di categoria: pubblico freddo ma in tema"
            perche = ("CPM e CTR vicini alla media (%.2fx, %.2fx), pubblico di qualche milione: persone selezionate "
                      "per interesse, non ancora in contatto col marchio" % (cpm_rel, ctr_rel))
        elif R.get("copertura_nota", True):
            tipo, nome = "sosia", "Lookalike 1-3% degli acquirenti"
            perche = ("pubblico sotto il milione, CPM alto (%.2fx) ma CTR sopra i pubblici freddi (%.2fx): "
                      "sosia dei clienti, piu costosi da raggiungere e piu reattivi" % (cpm_rel, ctr_rel))
        elif ctr_rel > 1.35 and cpm_rel > 1.1:   # senza copertura si ragiona solo su costo e reazione
            tipo, nome = "caldo", "Pubblico caldo: persone gia vicine al marchio"
            perche = "CTR %.1fx la media della campagna e CPM %.1fx: reagisce molto e costa di piu raggiungerlo" % (ctr_rel, cpm_rel)
        elif ctr_rel < 0.9 and cpm_rel < 0.9:
            tipo, nome = "ampio", "Pubblico ampio e freddo"
            perche = "CPM piu basso della campagna (%.2fx) e CTR piu basso (%.2fx): tante persone, poco coinvolte" % (cpm_rel, ctr_rel)
        else:
            tipo, nome = "interessi", "Pubblico intermedio, scelto per interesse"
            perche = "CPM e CTR vicini alla media della campagna (%.2fx, %.2fx)" % (cpm_rel, ctr_rel)
        nota_size = np.isfinite(size) and R.get("copertura_nota", True)
        rows.append({"adset_id": k, "vertical": a.vertical, "budget_iniziale": a.budget_giornaliero_iniziale, "tipo": tipo,
                     "pubblico_proposto": nome, "motivazione": perche,
                     "ctr_vs_campagna": round(ctr_rel, 2), "cpm_vs_campagna": round(cpm_rel, 2),
                     "frequenza_media": round(fmean, 3),
                     # ordine di grandezza; oltre 20 milioni non si distingue
                     "grandezza_stimata": int(round(min(size, 2e7), -3)) if (nota_size or R.get("copertura_nota", True)) else None,
                     "leva_che_rende_di_piu": best, "vantaggio_leva_%": round(gap, 1)})
    return pd.DataFrame(rows)


# ------------------------------------------------------------------------- scenario budget
def scenario_budget(fc, pred, lo=0.6, hi=1.6):
    """Dove spostare il budget dentro ogni campagna, a spesa totale invariata, per avere piu click.
    Rendimenti decrescenti: il CPM sale con il budget (elasticita stimata), quindi click ~ budget^(1-e)."""
    e = float(fc.cpm.elasticity)
    g = pred.groupby(["vertical", "adset_id"]).agg(budget=("budget_giornaliero_adset", "mean"),
                                                   spesa=("spesa_prev", "sum"), click=("click_prev", "sum"),
                                                   giorni=("data", "nunique")).reset_index()
    g["cpc_prev"] = g.spesa / g.click
    out = []
    for v, q in g.groupby("vertical"):
        B0, c = q.budget.values, q.click.values
        tot = B0.sum()

        def alloc(lmb):
            return np.clip(B0 * (c * (1 - e) / (lmb * B0)) ** (1 / max(e, 0.05)), lo * B0, hi * B0)

        a, b = 1e-9, 1e9
        for _ in range(200):
            mid = np.sqrt(a * b)
            if alloc(mid).sum() > tot:
                a = mid
            else:
                b = mid
        B1 = alloc(np.sqrt(a * b)) if len(q) > 1 else B0
        q = q.assign(budget_proposto=np.round(B1, 0), click_proposti=c * (B1 / B0) ** (1 - e))
        q["cpc_marginale"] = q.spesa / q.giorni / (q.click / q.giorni * (1 - e))
        out.append(q)
    S = pd.concat(out, ignore_index=True)
    S["variazione_budget_%"] = (100 * (S.budget_proposto / S.budget - 1)).round(0)
    S["click_guadagnati_%"] = (100 * (S.click_proposti / S.click - 1)).round(1)
    return S[["vertical", "adset_id", "budget", "budget_proposto", "variazione_budget_%", "cpc_prev", "cpc_marginale",
              "click", "click_proposti", "click_guadagnati_%"]].round(3)


# ---------------------------------------------------------------------------------- prove
def validazione(R, giorni_indietro=(14, 21, 28, 35, 42, 49, 56), n_sim=2000):
    """Prova sul passato: nasconde 14 giorni, li prevede, confronta. Ripetuta su piu date."""
    h = R["hist"]
    primo, ultimo = h.data.min(), h.data.max()
    tabelle = []
    for g in giorni_indietro:
        taglio = ultimo - pd.Timedelta(days=g)
        if (taglio - primo).days < 28:
            continue
        try:
            tabelle.append(wm.backtest(R, taglio, n_sim=n_sim)[0])
        except Exception:   # un taglio che non regge non deve fermare gli altri
            continue
    if not tabelle:
        return pd.DataFrame(columns=COLONNE_PROVA)
    T = pd.concat(tabelle, ignore_index=True)
    return T[[c for c in COLONNE_PROVA if c in T.columns]].round(2)


def prova_generalizzazione(R, colonna="inserzionista_id", n_sim=600):
    """Quanto valgono i fattori comuni su un inserzionista mai visto.

    Per ogni inserzionista: i fattori comuni (fatica, giorno della settimana, effetto del budget,
    peso delle caratteristiche creative) vengono stimati SOLO sugli altri e tenuti fissi; di lui
    si stimano soltanto i livelli. Poi si prevedono i suoi ultimi 14 giorni.
    Seconda prova: come se avesse appena iniziato, con sole 3 settimane di storico.
    """
    h = R["hist"]
    valori = sorted(h[colonna].unique())
    if len(valori) < 2:
        return pd.DataFrame()
    righe = []
    for v in valori:
        altri = sottoinsieme(R, colonna, [x for x in valori if x != v])
        base = wm.Forecaster(altri).fit(altri["hist"]).valori_base()
        solo = sottoinsieme(R, colonna, [v])
        taglio = solo["hist"].data.max() - pd.Timedelta(days=14)
        corto = dict(solo)
        corto["hist"] = solo["hist"][solo["hist"].data > taglio - pd.Timedelta(days=21)].reset_index(drop=True)
        casi = [("storico intero", "fattori comuni dagli altri", solo, base, 1e6), ("storico intero", "tutto dai suoi dati", solo, None, 0.0),
                ("3 settimane di storico", "fattori comuni dagli altri", corto, base, 1e6), ("3 settimane di storico", "tutto dai suoi dati", corto, None, 0.0)]
        for storia, come, S, b, forza in casi:
            try:
                t = wm.backtest(S, taglio, base=b, forza=forza, n_sim=n_sim)[0]
            except Exception:
                continue
            for _, x in t[t.gruppo == "tutti"].iterrows():
                nome = come if x.modello == "strutturale" else "ultimi 7 giorni"
                if x.modello != "strutturale" and come != "tutto dai suoi dati":
                    continue
                righe.append({"escluso": v, "storia": storia, "modello": nome, "righe": int(x.righe),
                              "CPM_MAPE_%": round(x["CPM_MAPE_%"], 2), "CTR_WAPE_%": round(x["CTR_WAPE_%"], 2)})
    return pd.DataFrame(righe)


# ---------------------------------------------------------------------- dati per il sito
def _nome_campagna(R, vertical):
    ins = R.get("ins")
    if ins is not None and "vertical" in ins and "nome" in ins and (ins.vertical.astype(str) == vertical).any():
        x = ins[ins.vertical.astype(str) == vertical].iloc[0]
        return str(x.nome), str(x.get("descrizione", "") or ""), str(x.get("inserzionista_id", vertical))
    h = R["hist"][R["hist"].vertical == vertical]
    nome = str(h.campaign_name.iloc[0]) if len(h) and "campaign_name" in h else vertical
    return nome, "", vertical


def dati_sito(R, fc, pred, P, S, V=None, G=None, origine="caricato", file_previsioni="previsioni.csv"):
    """Tutto cio che il sito mostra, in un solo dizionario pronto per diventare JSON."""
    panel, hist = fc.last_panel, fc.train
    pred = pred.copy()
    pred["fat"] = np.exp(wm.log_fatigue(panel.age, panel.leva, fc.ctr.fatigue))
    pred["bud_learn"] = panel.bud_learn.values
    campagne, ordine = [], list(pd.unique(P.vertical))
    ins = R.get("ins")
    if ins is not None and "vertical" in ins:   # stesso ordine della tabella degli inserzionisti
        ordine = [v for v in ins.vertical.astype(str) if v in ordine] + [v for v in ordine if v not in set(ins.vertical.astype(str))]
    for v in ordine:
        nome, desc, ident = _nome_campagna(R, v)
        campagne.append({"id": ident, "nome": nome, "vertical": v, "descrizione": desc, "adset": sorted(P[P.vertical == v].adset_id.tolist())})
    adsets = {}
    for _, a in P.iterrows():
        k = a.adset_id
        bud = pred[pred.adset_id == k].groupby("data").budget_giornaliero_adset.first()
        sc = S[S.adset_id == k]
        c0, c1, fm = fc.deliv.freq.get(k, fc.deliv.freq_media)
        adsets[k] = {
            "vertical": a.vertical, "tipo": a.tipo, "pubblico": a.pubblico_proposto, "motivazione": a.motivazione,
            "ctr_rel": r(a.ctr_vs_campagna, 2), "cpm_rel": r(a.cpm_vs_campagna, 2), "frequenza": r(a.frequenza_media, 3),
            "grandezza": None if pd.isna(a.grandezza_stimata) else int(a.grandezza_stimata), "leva": a.leva_che_rende_di_piu,
            "budget_iniziale": float(a.budget_iniziale), "budget_test": float(bud.mean()) if len(bud) else float(a.budget_iniziale),
            "budget_proposto": float(sc.budget_proposto.iloc[0]) if len(sc) else float(a.budget_iniziale),
            "freq_c0": r(c0, 5), "freq_c1": float(c1),
            "ctr_fx": r(fc.ctr.adset_fx[k], 5), "cpm_fx": r(fc.cpm.adset_fx[k], 5),
            "inter": {k2.split("|", 1)[1]: r(v, 5) for k2, v in fc.ctr.inter_fx.items() if k2.split("|", 1)[0] == k},
            "bud_learn": {d.strftime("%Y-%m-%d"): float(v) for d, v in pred[pred.adset_id == k].groupby("data").bud_learn.first().items()},
        }
    assets = R["assets"].drop_duplicates("asset_id").set_index("asset_id")
    in_test, ads = set(pred.ad_id), {}
    for _, a in R["ann"].iterrows():
        if a.adset_id not in adsets or a.asset_id not in assets.index:
            continue
        s = assets.loc[a.asset_id]
        titolo = str(s.get("headline", "") or "") or str(a.get("ad_name", a.ad_id))
        ads[a.ad_id] = {"adset": a.adset_id, "asset": a.asset_id, "leva": str(s.leva), "formato": str(s.formato),
                        "titolo": titolo, "testo": str(s.get("testo_principale", "") or ""), "visual": str(s.get("descrizione_visual", "") or ""),
                        "lancio": a.data_lancio.strftime("%Y-%m-%d") if pd.notna(a.data_lancio) else None,
                        "cold": bool(a.asset_id not in fc.ctr.asset_fx), "in_test": bool(a.ad_id in in_test)}
    pred = pred[pred.ad_id.isin(ads) & pred.adset_id.isin(adsets)]
    pr = [[x.data.strftime("%Y-%m-%d"), x.ad_id, r(x.ctr_prev), r(x.ctr_p10), r(x.ctr_p90), r(x.ctr_atteso_p10), r(x.ctr_atteso_p90),
           r(x.cpm_prev, 3), r(x.cpm_p10, 3), r(x.cpm_p90, 3), r(x.cpc_prev), r(x.quota_spesa_prev, 3), r(x.spesa_prev, 2),
           int(round(x.impression_prev)), r(x.click_prev, 1), r(x.fat, 3), int(x.age), x.stadio, x.affidabilita] for x in pred.itertuples()]
    pred_cols = ["d", "ad", "ctr", "c10", "c90", "a10", "a90", "cpm", "m10", "m90", "cpc", "quota", "spesa", "imp", "clk", "fat", "eta", "stadio", "aff"]
    last = R["hist"].data.max()
    h = hist[(hist.data > last - pd.Timedelta(days=28)) & hist.ad_id.isin(pred.ad_id.unique())]
    hs = [[x.data.strftime("%Y-%m-%d"), x.ad_id, r(x.ctr), r(x.cpm, 3), int(x.impression), int(x.click), r(x.spesa, 2), bool(x.anom_click)]
          for x in h.itertuples()]
    anomalie = []
    for (v, d), g in hist[hist.anom_click].groupby(["vertical", "data"]):
        anomalie.append({"data": d.strftime("%Y-%m-%d"), "dove": v,
                         "cosa": "zero click su tutti gli annunci (%d): tracciamento rotto, giorno escluso dalla stima" % len(g)})
    if R.get("budget_noto", True):
        for (k, d), g in hist[hist.anom_spesa].groupby(["adset_id", "data"]):
            anomalie.append({"data": d.strftime("%Y-%m-%d"), "dove": k,
                             "cosa": "spesa %.0f euro con budget %.0f: giorno escluso dalla stima delle quote" % (g.spesa.sum(), g.budget_giornaliero_adset.iloc[0])})
    val = []
    if V is not None and len(V):
        for c in ("CPM_minimo_%", "CTR_minimo_%"):
            if c not in V:
                V = V.assign(**{c: np.nan})
        g = V.groupby(["gruppo", "modello"])[["CPM_MAPE_%", "CTR_WAPE_%", "CTR_cop80_%", "CPM_cop80_%", "CPM_minimo_%", "CTR_minimo_%"]].mean().reset_index()
        tagli = int(V.taglio.nunique())
        val = [{"gruppo": x.gruppo, "modello": x.modello, "cpm": r(x["CPM_MAPE_%"], 1), "ctr": r(x["CTR_WAPE_%"], 1),
                "cop_ctr": r(x["CTR_cop80_%"], 0), "cop_cpm": r(x["CPM_cop80_%"], 0),
                "min_cpm": r(x["CPM_minimo_%"], 1), "min_ctr": r(x["CTR_minimo_%"], 1), "tagli": tagli} for _, x in g.iterrows()]
    gen = []
    if G is not None and len(G):
        g = G.groupby(["storia", "modello"])[["CPM_MAPE_%", "CTR_WAPE_%"]].mean().reset_index()
        gen = [{"storia": x.storia, "modello": x.modello, "cpm": r(x["CPM_MAPE_%"], 1), "ctr": r(x["CTR_WAPE_%"], 1)} for _, x in g.iterrows()]
    sett = sorted(set(panel.wk))
    stag = {"cpm": {w.strftime("%Y-%m-%d"): r(panel[panel.wk == w].s_cpm.iloc[0], 5) for w in sett}, "ctr": {}}
    for v, g in panel.groupby("vertical"):
        stag["ctr"][v] = {w.strftime("%Y-%m-%d"): (r(g[g.wk == w].s_ctr.iloc[0], 5) if (g.wk == w).any() else 0.0) for w in sett}
    c, m, d = fc.ctr, fc.cpm, fc.deliv
    qual = {}
    for a, v in zip(c.assets_, c.asset_vert):
        qual.setdefault(v, []).append(r(c.asset_fx[a], 4))
    par = {
        "fatica": {k: list(v) for k, v in c.fatigue.items()},
        "ctr_dow": [r(x, 5) for x in c.dow_fx], "ctr_new3": r(c.new3_fx, 5),
        "feat_cols": list(c.feat_cols), "feat_w": [r(x, 5) for x in c.feat_w], "cold_sd": r(c.feat_loo_rmse, 4),
        "feat_regole": fc.cfg["regole_creativita"],
        "cpm_dow": [r(x, 5) for x in m.dow_fx], "cpm_idx": r(m.idx_coef, 5), "elasticita": r(m.elasticity, 4),
        "cpm_new3": r(m.new3_fx, 5), "cpm_budlearn": r(m.budlearn_fx, 5), "cpm_fat": r(m.fat_fx, 5),
        "cpm_q": [r(x, 5) for x in m.q_w], "cpm_sigma": r(m.sigma, 4),
        "spesa_su_budget": r(d.spend_ratio, 4), "qualita_asset": qual,
        "leve": sorted(R["assets"].leva.astype(str).unique()), "formati": sorted(R["assets"].formato.astype(str).unique()),
    }
    # se i pesi delle caratteristiche arrivano dai valori di base, nel laboratorio si possono scegliere anche quei formati e quelle leve
    for nome, noti in (("formati", ["immagine", "video", "carosello"]), ("leve", ["scarcity", "urgency", "black_friday"])):
        if any(x in c.feat_cols for x in noti):
            par[nome] = sorted(set(par[nome]) | set(noti))
    cal = R.get("cal")
    eventi = {x.data.strftime("%Y-%m-%d"): str(x.evento) for x in cal.dropna(subset=["evento"]).itertuples()} if cal is not None and len(cal) else {}
    return {
        "meta": {"origine": origine, "storico_dal": R["hist"].data.min().strftime("%Y-%m-%d"), "storico_al": last.strftime("%Y-%m-%d"),
                 "giorni": sorted(pred.data.dt.strftime("%Y-%m-%d").unique().tolist()),
                 "righe_storico": int(len(R["hist"])), "righe_previste": int(len(pred)),
                 "annunci_previsti": int(pred.ad_id.nunique()), "annunci_storico": int(R["hist"].ad_id.nunique()),
                 "creativita": int(R["assets"].asset_id.nunique()), "righe_cold": int(pred.cold_start.sum()),
                 "stadi": {str(k): int(v) for k, v in pred.stadio.value_counts().items()},
                 "affidabilita": {str(k): int(v) for k, v in pred.affidabilita.value_counts().items()},
                 "eventi": eventi, "note": list(R.get("note", [])), "file_letti": list(R.get("file_letti", [])),
                 "stagione": R.get("stagione"), "budget_noto": bool(R.get("budget_noto", True)),
                 "copertura_nota": bool(R.get("copertura_nota", True)), "file_previsioni": file_previsioni},
        "campagne": campagne, "adset": adsets, "ads": ads, "ads_storico": sorted(R["hist"].ad_id.unique().tolist()),
        "pred_cols": pred_cols, "pred": pr, "hist_cols": ["d", "ad", "ctr", "cpm", "imp", "clk", "spesa", "anom"], "hist": hs,
        "anomalie": anomalie, "validazione": val, "generalizzazione": gen, "stagione": stag, "par": par,
    }


COLONNE_CSV = ["data", "ad_id", "adset_id", "asset_id", "leva", "formato", "budget_giornaliero_adset",
               "ctr_prev", "ctr_p10", "ctr_p90", "ctr_atteso_p10", "ctr_atteso_p90", "cpm_prev", "cpm_p10", "cpm_p90",
               "cpc_prev", "quota_spesa_prev", "spesa_prev", "impression_prev", "click_prev", "frequenza_prev",
               "copertura_prev", "cold_start", "stadio", "affidabilita"]


def tabella_previsioni(pred):
    """Le previsioni nel formato del file da consegnare."""
    P = pred[COLONNE_CSV].copy()
    for k in ["ctr_prev", "ctr_p10", "ctr_p90", "ctr_atteso_p10", "ctr_atteso_p90", "cpm_prev", "cpm_p10", "cpm_p90",
              "cpc_prev", "quota_spesa_prev", "frequenza_prev"]:
        P[k] = P[k].round(4)
    P["spesa_prev"] = P.spesa_prev.round(2)
    for k in ["impression_prev", "click_prev", "copertura_prev"]:
        P[k] = P[k].round(0).astype(int)
    P["data"] = P.data.dt.strftime("%Y-%m-%d")
    return P
