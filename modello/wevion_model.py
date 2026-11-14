"""Wevion BigHack 2026 - modello strutturale per CTR e CPM (solo numpy + pandas).

Idea: i dati seguono una struttura moltiplicativa che si legge nello storico.

  CTR = qualita_asset x pubblico_adset x fatica(eta, leva) x stagionalita_CTR x giorno_settimana
  CPM = livello_adset x stagionalita_CPM x giorno_settimana x (budget/budget_iniziale)^e
        x fase_apprendimento x effetto_asset

Ogni pezzo e stimato dai dati (GLM di Poisson per i click, minimi quadrati sul log del CPM).
Gli asset mai visti (cold start) ricevono una qualita stimata dalle caratteristiche della creativita.

Uso:  python3 modello/run.py            (dalla cartella del progetto)
"""
import itertools
import re
from pathlib import Path

import numpy as np
import pandas as pd

LEVE = ["scarcity", "urgency", "black_friday"]
DEFAULT_FATIGUE = {"scarcity": (0.6, 35.0), "urgency": (0.5, 16.0)}
ELASTICITY_PRIOR = 0.30  # usato solo se lo storico non contiene variazioni di budget


# --------------------------------------------------------------------------- dati
def load(data_dir):
    d = Path(data_dir)
    assets = pd.concat(
        [pd.read_csv(f) for f in sorted((d / "asset_creativi").glob("asset_*.csv"))],
        ignore_index=True,
    )
    return {
        "hist": pd.read_csv(d / "storico_giornaliero.csv", parse_dates=["data"]),
        "fut": pd.read_csv(d / "da_prevedere.csv", parse_dates=["data"]),
        "ann": pd.read_csv(d / "annunci.csv", parse_dates=["data_lancio", "data_fine"]),
        "adset": pd.read_csv(d / "adset.csv"),
        "bud": pd.read_csv(d / "budget_giornaliero.csv", parse_dates=["data"]),
        "cal": pd.read_csv(d / "calendario.csv", parse_dates=["data"]),
        "bm": pd.read_csv(d / "benchmark_mercato_settimanale_2025.csv", parse_dates=["settimana_dal"]),
        "assets": assets,
    }


def monday(dates):
    return dates - pd.to_timedelta(dates.dt.dayofweek, unit="D")


def seasonal_tables(R, thr=0.07):
    """Stagionalita 2026 ricavata dal benchmark 2025 spostato di 52 settimane.

    CPM: media geometrica dei tre settori (le oscillazioni di un singolo settore nel 2025
         non si ripetono nel 2026, la curva comune si).
    CTR: per settore. Fuori dalle settimane del Black Friday teniamo solo gli scostamenti
         grandi dal livello normale (regimi veri, es. abbigliamento ad agosto); quelli piccoli
         sono rumore del 2025 e nel 2026 non si ritrovano.
    """
    b = R["bm"].copy()
    b["wk"] = b.settimana_dal + pd.Timedelta(days=364)
    cpm = np.log(b.pivot(index="wk", columns="vertical", values="indice_cpm") / 100.0)
    ctr = np.log(b.pivot(index="wk", columns="vertical", values="indice_ctr") / 100.0)
    cal = R["cal"]
    ev = cal[cal.evento.fillna("").str.contains("Black|Cyber")]
    ev_weeks = set(monday(ev.data))
    is_ev = ctr.index.isin(ev_weeks)
    base = ctr[~is_ev].median()
    dev = ctr - base
    dev_thr = dev.where(dev.abs() >= thr, 0.0)
    dev_use = dev_thr.copy()
    dev_use[is_ev] = dev[is_ev]
    s_ctr = dev_use.stack().rename("s_ctr").reset_index()
    s_cpm = cpm.mean(axis=1).rename("s_cpm").reset_index()
    s_cpm_own = cpm.stack().rename("s_cpm_own").reset_index()
    return s_cpm, s_cpm_own, s_ctr, ev_weeks


def make_panel(R, rows):
    """Aggiunge a ogni riga (annuncio, giorno) le variabili del modello."""
    s_cpm, s_cpm_own, s_ctr, ev_weeks = seasonal_tables(R)
    p = rows.copy()
    p = p.merge(R["ann"][["ad_id", "data_lancio"]], on="ad_id", how="left")
    p["age"] = (p.data - p.data_lancio).dt.days
    p["wk"] = monday(p.data)
    p["dow"] = p.data.dt.dayofweek
    p = p.merge(s_cpm, on="wk", how="left").merge(s_ctr, on=["wk", "vertical"], how="left")
    p = p.merge(s_cpm_own, on=["wk", "vertical"], how="left")
    p = p.merge(R["adset"][["adset_id", "budget_giornaliero_iniziale"]], on="adset_id", how="left")
    p["lb"] = np.log(p.budget_giornaliero_adset / p.budget_giornaliero_iniziale)
    bud = R["bud"].sort_values(["adset_id", "data"]).copy()
    chg = bud.groupby("adset_id").budget_giornaliero_eur.diff().fillna(0) != 0
    bud["last_chg"] = bud.data.where(chg)
    bud["last_chg"] = bud.groupby("adset_id").last_chg.ffill()
    bud["dsc"] = (bud.data - bud.last_chg).dt.days
    p = p.merge(bud[["adset_id", "data", "dsc"]], on=["adset_id", "data"], how="left")
    p["bud_learn"] = (p.dsc < 3).astype(float)
    p["new3"] = (p.age < 3).astype(float)
    p["new4"] = (p.age < 4).astype(float)
    p["ev_week"] = p.wk.isin(ev_weeks)
    p = p.merge(R["cal"][["data", "evento"]], on="data", how="left")
    p["evento"] = p.evento.fillna("")
    return p


def flag_anomalies(h):
    """Anomalie nei dati: giorni senza click su un intero settore (tracciamento rotto)
    e giorni con spesa molto sopra il budget."""
    h = h.copy()
    vd = h.groupby(["vertical", "data"]).agg(c=("click", "sum"), i=("impression", "sum")).reset_index()
    out = vd[(vd.c == 0) & (vd.i > 5000)][["vertical", "data"]].assign(anom_click=True)
    h = h.merge(out, on=["vertical", "data"], how="left")
    h["anom_click"] = h.anom_click.fillna(False).astype(bool)
    sp = h.groupby(["adset_id", "data"]).spesa.transform("sum")
    h["anom_spesa"] = sp > 1.15 * h.budget_giornaliero_adset
    return h


# ---------------------------------------------------------------- creativita -> feature
FEATURE_RULES = {
    "ugc": r"parla|creator|outfit check|try-on",
    "hook": r"primi 2 secondi|apre su|apre con",
    "ritmo": r"ritmo veloce|dinamic|transizioni|veloce",
    "testo_pesante": r"molto testo|infografica|punti elenco|righe di condizioni|date e condizioni",
    "brand_lento": r"logo|ritmo lento|musica lenta|inquadratura fissa|alla fine",
    "timer": r"timer|countdown",
    "prezzo_barrato": r"prezzo barrato",
}


def asset_features(assets):
    a = assets.copy()
    txt = a.descrizione_visual.fillna("").str.lower()
    f = pd.DataFrame(index=a.asset_id)
    for k, rx in FEATURE_RULES.items():
        f[k] = txt.str.contains(rx).astype(float).values
    f["video"] = (a.formato == "video").astype(float).values
    f["carosello"] = (a.formato == "carosello").astype(float).values
    f["urgency"] = (a.leva == "urgency").astype(float).values
    f["black_friday"] = (a.leva == "black_friday").astype(float).values
    return f


# ------------------------------------------------------------------------- stimatori
def dummies(series, levels):
    return (series.values[:, None] == np.array(levels)[None, :]).astype(float)


def poisson_ridge(X, y, off, pen, iters=100):
    b = np.zeros(X.shape[1])
    P = np.diag(pen)
    for _ in range(iters):
        eta = np.clip(X @ b + off, -30, 30)
        mu = np.exp(eta)
        g = X.T @ (y - mu) - P @ b
        H = X.T @ (X * mu[:, None]) + P
        step = np.linalg.solve(H, g)
        b = b + step
        if np.abs(step).max() < 1e-9:
            break
    mu = np.exp(np.clip(X @ b + off, -30, 30))
    cov = np.linalg.inv(X.T @ (X * mu[:, None]) + P)
    return b, cov


def deviance(y, mu):
    t = np.where(y > 0, y * np.log(np.maximum(y, 1e-12) / mu), 0.0)
    return 2.0 * (t - (y - mu)).sum()


def log_fatigue(age, leva, params):
    """Fatica della creativita: f(eta) = pavimento + (1 - pavimento) * exp(-eta / tau).
    Per la leva black_friday (storia troppo corta) usiamo la media geometrica delle altre due."""
    age = np.asarray(age, dtype=float)
    leva = np.asarray(leva)

    def lf(k):
        fl, tau = params[k]
        return np.log(fl + (1 - fl) * np.exp(-age / tau))

    ls, lu = lf("scarcity"), lf("urgency")
    return np.where(leva == "scarcity", ls, np.where(leva == "urgency", lu, 0.5 * (ls + lu)))


# ----------------------------------------------------------------------------- CTR
class CTRModel:
    def __init__(self, lam_asset=0.5, lam_inter=20.0, search_fatigue=True):
        self.lam_asset, self.lam_inter, self.search_fatigue = lam_asset, lam_inter, search_fatigue

    def _design(self, p):
        cols = [dummies(p.adset_id, self.adsets), dummies(p.dow, list(range(1, 7))), p.new3.values[:, None],
                dummies(p.asset_id, self.assets_),
                dummies(p.adset_id + "|" + p.leva, self.inter)]
        return np.column_stack(cols)

    def fit(self, tr, feats):
        tr = tr[~tr.anom_click].copy()
        self.adsets = sorted(tr.adset_id.unique())
        self.assets_ = sorted(tr.asset_id.unique())
        self.asset_vert = tr.groupby("asset_id").vertical.first().reindex(self.assets_).values
        self.inter = sorted((tr.adset_id + "|" + tr.leva).unique())
        n_free = len(self.adsets) + 6 + 1
        pen = np.r_[np.full(n_free, 1e-8), np.full(len(self.assets_), self.lam_asset),
                    np.full(len(self.inter), self.lam_inter)]
        X = self._design(tr)
        y = tr.click.values.astype(float)
        base_off = np.log(tr.impression.values) + tr.s_ctr.values

        def run(params):
            off = base_off + log_fatigue(tr.age, tr.leva, params)
            b, cov = poisson_ridge(X, y, off, pen)
            return deviance(y, np.exp(X @ b + off)), b, cov

        params = dict(DEFAULT_FATIGUE)
        enough = tr.groupby("ad_id").size().max() >= 35 and tr.data.nunique() >= 49
        if self.search_fatigue and enough:
            grid_fl = [0.3, 0.4, 0.5, 0.6, 0.7]
            grid_tau = [8, 12, 16, 20, 25, 30, 35, 45, 60, 80]
            for _ in range(2):
                for k in ["scarcity", "urgency"]:
                    best = None
                    for fl, tau in itertools.product(grid_fl, grid_tau):
                        q = dict(params)
                        q[k] = (fl, float(tau))
                        d = run(q)[0]
                        if best is None or d < best[0]:
                            best = (d, (fl, float(tau)))
                    params[k] = best[1]
        self.fatigue = params
        dev, b, cov = run(params)
        self.b, self.cov = b, cov
        mu = np.exp(X @ b + base_off + log_fatigue(tr.age, tr.leva, params))
        dof = max(len(tr) - n_free - len(self.assets_), 1)
        self.dispersion = float(((y - mu) ** 2 / mu).sum() / dof)
        # rumore moltiplicativo oltre Poisson: Var = mu + (sigma*mu)^2
        self.sigma_od = float(np.sqrt(max(((y - mu) ** 2 - mu).sum() / (mu ** 2).sum(), 0.0)))
        k0 = len(self.adsets)
        self.adset_fx = dict(zip(self.adsets, b[:k0]))
        self.dow_fx = np.r_[0.0, b[k0:k0 + 6]]
        self.new3_fx = b[k0 + 6]
        ka = k0 + 7
        self.asset_fx = dict(zip(self.assets_, b[ka:ka + len(self.assets_)]))
        self.asset_se = dict(zip(self.assets_, np.sqrt(np.diag(cov)[ka:ka + len(self.assets_)] * max(self.dispersion, 1.0))))
        ki = ka + len(self.assets_)
        self.inter_fx = dict(zip(self.inter, b[ki:]))
        self._fit_features(feats)
        return self

    def _fit_features(self, feats):
        """Qualita dell'asset spiegata dalle caratteristiche della creativita (ridge, scelta con leave-one-out)."""
        ids = self.assets_
        F = feats.loc[ids]
        keep = [c for c in F.columns if 0 < F[c].sum() < len(F)]
        self.feat_cols = keep
        A = np.column_stack([np.ones(len(ids)), F[keep].values])
        yv = np.array([self.asset_fx[i] for i in ids])

        def solve(A_, y_, lam):
            P = lam * np.eye(A_.shape[1])
            P[0, 0] = 0.0
            return np.linalg.solve(A_.T @ A_ + P, A_.T @ y_)

        best = None
        for lam in [0.1, 0.3, 1.0, 3.0, 10.0]:
            err = []
            for i in range(len(ids)):
                m = np.arange(len(ids)) != i
                w = solve(A[m], yv[m], lam)
                err.append(yv[i] - A[i] @ w)
            rmse = float(np.sqrt(np.mean(np.square(err)))) if len(ids) > 3 else np.nan
            if best is None or rmse < best[0]:
                best = (rmse, lam)
        self.feat_loo_rmse, self.feat_lam = best
        if not np.isfinite(self.feat_loo_rmse):
            self.feat_loo_rmse = 0.3
        self.feat_w = solve(A, yv, self.feat_lam)
        self.feat_sd_naive = float(np.std(yv))

    def asset_effect(self, asset_ids, feats):
        eff, se = [], []
        for a in asset_ids:
            if a in self.asset_fx:
                eff.append(self.asset_fx[a]); se.append(self.asset_se[a])
            else:
                x = np.r_[1.0, feats.loc[a, self.feat_cols].values.astype(float)]
                eff.append(float(x @ self.feat_w)); se.append(self.feat_loo_rmse)
        return np.array(eff), np.array(se)

    def param_sd(self, p, feats):
        X = self._design(p)
        cold = ~p.asset_id.isin(self.asset_fx).values
        # asset mai visto: l'incertezza e quella del livello medio degli asset del settore + errore di cold start
        ka = len(self.adsets) + 7
        for v in np.unique(p.vertical.values[cold]):
            m = self.asset_vert == v
            rows = cold & (p.vertical.values == v)
            X[np.ix_(rows, ka + np.where(m)[0])] = 1.0 / max(m.sum(), 1)
        v = np.einsum("ij,jk,ik->i", X, self.cov, X) * max(self.dispersion, 1.0)
        return np.sqrt(np.maximum(v, 0.0) + np.where(cold, self.feat_loo_rmse ** 2, 0.0))

    def eta(self, p, feats, with_time=True):
        """log del CTR atteso (frazione). with_time=False toglie stagionalita e giorno della settimana."""
        ae, ase = self.asset_effect(p.asset_id.values, feats)
        inter = np.array([self.inter_fx.get(k, 0.0) for k in (p.adset_id + "|" + p.leva)])
        e = np.array([self.adset_fx[a] for a in p.adset_id]) + ae + inter
        e = e + log_fatigue(p.age, p.leva, self.fatigue) + self.new3_fx * p.new3.values
        if with_time:
            e = e + self.dow_fx[p.dow.values] + p.s_ctr.values
        return e, ase


# ----------------------------------------------------------------------------- CPM
class CPMModel:
    def __init__(self, lam_asset=3.0, idx_col="s_cpm", idx_pen=1e6):
        # idx_pen alto = coefficiente dell'indice di mercato fissato a 1 (verificato sullo storico)
        self.lam_asset, self.idx_col, self.idx_pen = lam_asset, idx_col, idx_pen

    def _design(self, p):
        lfat = log_fatigue(p.age, p.leva, self.fatigue)  # annuncio stanco = qualita piu bassa = CPM piu alto
        return np.column_stack([dummies(p.adset_id, self.adsets), dummies(p.dow, list(range(1, 7))),
                                p[self.idx_col].values, p.lb.values, p.new3.values, p.bud_learn.values, lfat,
                                dummies(p.asset_id, self.assets_)])

    def fit(self, tr, ctr_model, feats):
        tr = tr.copy()
        self.adsets = sorted(tr.adset_id.unique())
        self.assets_ = sorted(tr.asset_id.unique())
        self.asset_vert = tr.groupby("asset_id").vertical.first().reindex(self.assets_).values
        self.fatigue = ctr_model.fatigue
        X = self._design(tr)
        y = np.log(tr.cpm.values)
        k0 = len(self.adsets)
        pen = np.r_[np.full(k0 + 6, 1e-8), self.idx_pen, 1.0, 1e-8, 1.0, 1.0, np.full(len(self.assets_), self.lam_asset)]
        prior = np.zeros(X.shape[1])
        prior[k0 + 6] = 1.0
        prior[k0 + 7] = ELASTICITY_PRIOR
        P = np.diag(pen)
        H = X.T @ X + P
        b = np.linalg.solve(H, X.T @ y + P @ prior)
        res = y - X @ b
        self.b = b
        self.sigma = float(res.std())
        self.cov = np.linalg.inv(H) * self.sigma ** 2
        self.adset_fx = dict(zip(self.adsets, b[:k0]))
        self.dow_fx = np.r_[0.0, b[k0:k0 + 6]]
        self.idx_coef, self.elasticity, self.new3_fx, self.budlearn_fx, self.fat_fx = b[k0 + 6:k0 + 11]
        self.elasticity_se = float(np.sqrt(self.cov[k0 + 7, k0 + 7]))
        self.asset_fx = dict(zip(self.assets_, b[k0 + 11:]))
        tr["res"] = res
        wk = tr.groupby(["vertical", "wk"]).res.mean()
        self.sigma_week = float(wk.std())
        # effetto asset sul CPM spiegato dalla qualita (CTR) dell'asset: asset migliori costano meno
        z = np.array([ctr_model.asset_fx.get(a, 0.0) for a in self.assets_])
        yv = np.array([self.asset_fx[a] for a in self.assets_])
        A = np.column_stack([np.ones(len(z)), z])
        self.q_w = np.linalg.lstsq(A, yv, rcond=None)[0] if len(z) > 3 else np.array([0.0, 0.0])
        self.q_sd = float(np.std(yv - A @ self.q_w)) if len(z) > 3 else 0.05
        return self

    def mu(self, p, ctr_model, feats):
        ae = []
        z, _ = ctr_model.asset_effect(p.asset_id.values, feats)
        for a, zi in zip(p.asset_id.values, z):
            ae.append(self.asset_fx[a] if a in self.asset_fx else self.q_w[0] + self.q_w[1] * zi)
        m = np.array([self.adset_fx[a] for a in p.adset_id]) + self.dow_fx[p.dow.values]
        m = m + self.idx_coef * p[self.idx_col].values + self.elasticity * p.lb.values
        m = m + self.new3_fx * p.new3.values + self.budlearn_fx * p.bud_learn.values + np.array(ae)
        m = m + self.fat_fx * log_fatigue(p.age, p.leva, self.fatigue)
        return m

    def param_sd(self, p):
        X = self._design(p)
        cold = ~p.asset_id.isin(self.asset_fx).values
        ka = len(self.adsets) + 11
        for v in np.unique(p.vertical.values[cold]):
            m = self.asset_vert == v
            rows = cold & (p.vertical.values == v)
            X[np.ix_(rows, ka + np.where(m)[0])] = 1.0 / max(m.sum(), 1)
        return np.sqrt(np.maximum(np.einsum("ij,jk,ik->i", X, self.cov, X), 0.0))


# ------------------------------------------------------------------ quota di spesa, frequenza
class DeliveryModel:
    """Come Meta divide il budget dell'ad set tra gli annunci attivi, e la frequenza."""

    def fit(self, tr, q_log):
        t = tr.copy()
        t["q"] = q_log
        t["tot"] = t.groupby(["adset_id", "data"]).spesa.transform("sum")
        t["n"] = t.groupby(["adset_id", "data"]).ad_id.transform("size")
        ok = ~t.anom_spesa
        self.spend_ratio = float((t[ok].groupby(["adset_id", "data"]).tot.first()
                                  / t[ok].groupby(["adset_id", "data"]).budget_giornaliero_adset.first()).mean())
        m = t[(t.n > 1) & ok].copy()
        if len(m) > 20:
            m["ls"] = np.log(m.spesa / m.tot)
            g = m.groupby(["adset_id", "data"])
            Y = m.ls - g.ls.transform("mean")
            X = np.column_stack([m.q - g.q.transform("mean"), m.new4 - g.new4.transform("mean")])
            self.a, self.boost = np.linalg.lstsq(X, Y.values, rcond=None)[0]
        else:
            self.a, self.boost = 1.2, 0.45
        # frequenza = c0 + c1 * impression dell'ad set (1/c1 e una misura della grandezza del pubblico)
        a = t[ok].groupby(["adset_id", "data"]).agg(imp=("impression", "sum"), cop=("copertura", "sum")).reset_index()
        a["f"] = a.imp / a.cop
        self.freq = {}
        for k, g in a.groupby("adset_id"):
            A = np.column_stack([np.ones(len(g)), g.imp.values])
            c = np.linalg.lstsq(A, g.f.values, rcond=None)[0]
            self.freq[k] = (float(c[0]), float(max(c[1], 0.0)), float(g.f.mean()))
        return self

    def shares(self, p, q_log):
        w = np.exp(self.a * q_log + self.boost * p.new4.values)
        tot = pd.Series(w).groupby([p.adset_id.values, p.data.values]).transform("sum").values
        return w / tot


# ------------------------------------------------------------------------- pipeline
class Forecaster:
    def __init__(self, R, ctr_kw=None, cpm_kw=None):
        self.R = R
        self.feats = asset_features(R["assets"])
        self.ctr_kw, self.cpm_kw = ctr_kw or {}, cpm_kw or {}

    def fit(self, hist_rows):
        tr = flag_anomalies(make_panel(self.R, hist_rows))
        self.train = tr
        self.ctr = CTRModel(**self.ctr_kw).fit(tr, self.feats)
        self.cpm = CPMModel(**self.cpm_kw).fit(tr, self.ctr, self.feats)
        q, _ = self.ctr.eta(tr, self.feats, with_time=False)
        self.deliv = DeliveryModel().fit(tr, q)
        self.obs_age = tr.groupby("asset_id").age.agg(["min", "max"])
        return self

    def predict(self, future_rows, n_sim=2000, seed=7):
        p = make_panel(self.R, future_rows)
        rng = np.random.default_rng(seed)
        n = len(p)
        eta, _ = self.ctr.eta(p, self.feats)
        ase = self.ctr.param_sd(p, self.feats)
        q, _ = self.ctr.eta(p, self.feats, with_time=False)
        lcpm = self.cpm.mu(p, self.ctr, self.feats)
        share = self.deliv.shares(p, q)
        spesa = self.deliv.spend_ratio * p.budget_giornaliero_adset.values * share
        cpm = np.exp(lcpm)
        ctr = np.exp(eta) * 100.0
        imp = spesa / cpm * 1000.0
        out = p[["data", "ad_id", "adset_id", "asset_id", "vertical", "leva", "formato",
                 "budget_giornaliero_adset", "age"]].copy()
        out["ctr_prev"], out["cpm_prev"] = ctr, cpm
        out["cpc_prev"] = cpm / (10.0 * ctr)
        out["quota_spesa_prev"], out["spesa_prev"], out["impression_prev"] = share, spesa, imp
        out["click_prev"] = imp * ctr / 100.0
        imp_as = pd.Series(imp).groupby([p.adset_id.values, p.data.values]).transform("sum").values
        fr = np.array([self.deliv.freq[a][0] + self.deliv.freq[a][1] * i for a, i in zip(p.adset_id, imp_as)])
        out["frequenza_prev"] = fr
        out["copertura_prev"] = imp / fr

        # ---- incertezza (Monte Carlo): rumore giornaliero + incertezza dei parametri strutturali
        seen = p.asset_id.isin(self.ctr.asset_fx).values
        grp_w = pd.factorize(p.vertical + "|" + p.wk.astype(str))[0]
        grp_a = pd.factorize(p.asset_id)[0]
        grp_s = pd.factorize(p.adset_id)[0]
        isbf = (p.leva == "black_friday").values
        gap = 0.5 * (log_fatigue(p.age, np.full(n, "scarcity"), self.ctr.fatigue)
                     - log_fatigue(p.age, np.full(n, "urgency"), self.ctr.fatigue))
        ref = np.zeros(n)
        for i, a in enumerate(p.asset_id.values):
            if a in self.obs_age.index:
                ages = np.arange(self.obs_age.loc[a, "min"], self.obs_age.loc[a, "max"] + 1)
                ref[i] = np.mean(0.5 * (log_fatigue(ages, np.full(len(ages), "scarcity"), self.ctr.fatigue)
                                        - log_fatigue(ages, np.full(len(ages), "urgency"), self.ctr.fatigue)))
        sd_fat = np.where(isbf, np.abs(gap - ref), 0.0)
        ev_day = p.evento.str.contains("Black Friday|Cyber").values
        sd_seas_ctr = 0.03 + 0.25 * np.abs(p.s_ctr.values) + np.where(ev_day, 0.05, 0.0)
        sd_seas_cpm = max(self.cpm.sigma_week, 0.03) + np.where(ev_day, 0.05, 0.0)
        sd_el = max(self.cpm.elasticity_se, 0.08) * np.abs(p.lb.values)
        sd_cold_cpm = np.where(seen, 0.0, self.cpm.q_sd)

        z_w_ctr = rng.standard_normal((n_sim, grp_w.max() + 1))[:, grp_w]
        z_w_cpm = rng.standard_normal((n_sim, grp_w.max() + 1))[:, grp_w]
        z_a = rng.standard_normal((n_sim, grp_a.max() + 1))[:, grp_a]
        z_a2 = rng.standard_normal((n_sim, grp_a.max() + 1))[:, grp_a]
        z_f = rng.standard_normal((n_sim, 1))
        z_e = rng.standard_normal((n_sim, 1))
        z_bl = rng.standard_normal((n_sim, grp_s.max() + 1))[:, grp_s]
        eta_s = (eta + z_a * ase + z_w_ctr * sd_seas_ctr + z_f * sd_fat
                 + rng.standard_normal((n_sim, n)) * self.ctr.sigma_od)
        lcpm_s = (lcpm + z_w_cpm * sd_seas_cpm + z_e * sd_el + z_a2 * np.hypot(sd_cold_cpm, self.cpm.param_sd(p))
                  + z_bl * 0.05 * p.bud_learn.values + rng.standard_normal((n_sim, n)) * self.cpm.sigma)
        cpm_s = np.exp(lcpm_s)
        imp_s = np.maximum(spesa / cpm_s * 1000.0, 1.0)
        clk_s = rng.poisson(imp_s * np.exp(eta_s))
        ctr_s = clk_s / imp_s * 100.0
        rate_s = np.exp(eta_s) * 100.0
        for name, arr in [("ctr", ctr_s), ("cpm", cpm_s)]:
            out[name + "_p10"], out[name + "_p90"] = np.percentile(arr, 10, axis=0), np.percentile(arr, 90, axis=0)
        # intervallo sul CTR "vero" (senza il rumore di campionamento dei click di un singolo giorno)
        out["ctr_atteso_p10"], out["ctr_atteso_p90"] = np.percentile(rate_s, 10, axis=0), np.percentile(rate_s, 90, axis=0)
        out["cold_start"] = ~seen
        self.last_panel = p
        return out


# ---------------------------------------------------------------------- valutazione
def baseline_last7(R, hist_rows, future_rows):
    """Riferimento ingenuo: ogni annuncio resta al livello dei suoi ultimi 7 giorni;
    un annuncio nuovo prende il livello dell'ad set."""
    h = hist_rows
    last = h[h.data > h.data.max() - pd.Timedelta(days=7)]
    ad = last.groupby("ad_id").agg(s=("spesa", "sum"), i=("impression", "sum"), c=("click", "sum"))
    as_ = last.groupby("adset_id").agg(s=("spesa", "sum"), i=("impression", "sum"), c=("click", "sum"))
    f = future_rows[["data", "ad_id", "adset_id"]].copy()
    f = f.merge(ad, left_on="ad_id", right_index=True, how="left").merge(as_, left_on="adset_id", right_index=True, suffixes=("", "_as"))
    use_ad = f.i.notna()
    f["ctr_prev"] = np.where(use_ad, f.c / f.i, f.c_as / f.i_as) * 100
    f["cpm_prev"] = np.where(use_ad, f.s / f.i, f.s_as / f.i_as) * 1000
    return f[["data", "ad_id", "ctr_prev", "cpm_prev"]]


def score(pred, actual, label=""):
    m = pred.drop(columns=["vertical"], errors="ignore").merge(
        actual[["data", "ad_id", "ctr", "cpm", "click", "impression", "spesa", "vertical"]], on=["data", "ad_id"])
    vd = m.groupby(["vertical", "data"]).click.transform("sum")
    mc = m[vd > 0]
    r = {
        "modello": label, "righe": len(m),
        "CPM_MAPE_%": 100 * np.mean(np.abs(m.cpm_prev - m.cpm) / m.cpm),
        "CPM_bias_%": 100 * (np.mean(m.cpm_prev) / np.mean(m.cpm) - 1),
        "CTR_MAE_pp": np.mean(np.abs(mc.ctr_prev - mc.ctr)),
        "CTR_WAPE_%": 100 * np.sum(np.abs(mc.ctr_prev - mc.ctr) * mc.impression) / np.sum(mc.ctr * mc.impression),
        "CTR_bias_%": 100 * (np.sum(mc.ctr_prev * mc.impression) / np.sum(mc.ctr * mc.impression) - 1),
    }
    nz = mc[mc.click > 0]
    r["CTR_MAPE_%"] = 100 * np.mean(np.abs(nz.ctr_prev - nz.ctr) / nz.ctr)
    if "ctr_p10" in m:
        r["CTR_cop80_%"] = 100 * np.mean((mc.ctr >= mc.ctr_p10) & (mc.ctr <= mc.ctr_p90))
        r["CPM_cop80_%"] = 100 * np.mean((m.cpm >= m.cpm_p10) & (m.cpm <= m.cpm_p90))
    return r


def backtest(R, cutoff, horizon=14, ctr_kw=None, cpm_kw=None):
    h = R["hist"]
    cutoff = pd.Timestamp(cutoff)
    tr = h[h.data <= cutoff]
    te = h[(h.data > cutoff) & (h.data <= cutoff + pd.Timedelta(days=horizon))]
    fc = Forecaster(R, ctr_kw, cpm_kw).fit(tr)
    pred = fc.predict(te[R["fut"].columns])
    base = baseline_last7(R, tr, te)
    new_ads = ~te.ad_id.isin(tr.ad_id.unique())
    rows = []
    for nm, pr in [("strutturale", pred), ("ultimi 7 giorni", base)]:
        rows.append(dict(score(pr, te, nm), taglio=str(cutoff.date()), gruppo="tutti"))
        if new_ads.any():
            rows.append(dict(score(pr, te[new_ads], nm), taglio=str(cutoff.date()), gruppo="annunci nuovi"))
            rows.append(dict(score(pr, te[~new_ads], nm), taglio=str(cutoff.date()), gruppo="annunci gia visti"))
    return pd.DataFrame(rows), fc, pred
