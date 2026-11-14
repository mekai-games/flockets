"""Flockets - motore di previsione di CTR e CPM (solo numpy + pandas).

Idea: i risultati di una campagna seguono una struttura a fattori che si moltiplicano.

  CTR = qualita della creativita x pubblico dell'ad set x fatica(eta, leva) x stagione x giorno
  CPM = livello dell'ad set x stagione x giorno x (budget / budget iniziale)^e
        x fase di apprendimento x qualita dell'annuncio

Ogni fattore e stimato dallo storico che riceve (GLM di Poisson per i click, minimi quadrati sul
log del CPM). I fattori comuni a tutti (fatica, giorno della settimana, effetto del budget,
peso delle caratteristiche creative) possono anche arrivare da fuori come "valori di base":
servono quando lo storico e troppo corto per stimarli, e sono il modello globale. I livelli di
ogni ad set e di ogni creativita sono l'adattamento locale.

Il motore lavora su tabelle con nomi di colonna fissi: le prepara `contratto.py`.
"""
import itertools
import math

import numpy as np
import pandas as pd

FATICA_BASE = (0.55, 22.0)                                  # pavimento, tau in giorni
DEFAULT_FATIGUE = {"scarcity": (0.6, 35.0), "urgency": (0.5, 16.0)}
ELASTICITY_PRIOR = 0.30                                     # se lo storico non ha variazioni di budget
INCERTEZZA_INDICE = 0.13   # peso dell'indice di mercato sul CPM: 1 nel modello; 0,87 stimato libero e 0,86-0,88 tra un anno e l'altro nei CPM mensili
GRIGLIA_ADATTA = (0.0, 0.25, 0.5, 0.75, 1.0)                # quanto del livello dell'ultima settimana portare nella previsione
SOGLIA_ADATTA = 0.01                                        # si adatta solo se, su giorni nascosti, l'errore scende di almeno l'1%
PESO_LIVELLO = 20.0                                         # click fittizi: un annuncio con pochi click recenti si sposta poco
SOGLIA_SALTO = 5.0                                          # ultima settimana oltre 5 volte il suo rumore: il livello e cambiato, si segue quello nuovo

# ---------------------------------------------------------------- creativita -> caratteristiche
FEATURE_RULES = {
    "ugc": r"parla|creator|outfit check|try-on|talks? to camera|ugc|testimonial",
    "hook": r"primi 2 secondi|apre su|apre con|first 2 seconds|first two seconds|hook",
    "ritmo": r"ritmo veloce|dinamic|transizioni|veloce|fast[- ]paced|quick cuts",
    "testo_pesante": r"molto testo|infografica|punti elenco|righe di condizioni|date e condizioni|text[- ]heavy|lots of text|infographic|bullet",
    "brand_lento": r"logo|ritmo lento|musica lenta|inquadratura fissa|alla fine|slow[- ]paced|static shot",
    "timer": r"timer|countdown",
    "prezzo_barrato": r"prezzo barrato|strikethrough|crossed[- ]out price",
}

CONFIG_BASE = {
    "eventi_stagionali": "Black|Cyber",   # eventi del calendario in cui la stagione del CTR va presa per intero
    "soglia_stagione": 0.07,              # sotto questa soglia uno scostamento dell'indice CTR e rumore
    "rif_formato": "immagine", "rif_leva": "scarcity",
    "giorni_min_fatica": 28,              # storia minima di un annuncio per stimare la fatica della sua leva
    "anomalia_impression": 5000, "anomalia_spesa": 1.15,
    "regole_creativita": FEATURE_RULES,
}


def cfg_di(R):
    c = dict(CONFIG_BASE)
    c.update(R.get("cfg") or {})
    return c


def monday(dates):
    return dates - pd.to_timedelta(dates.dt.dayofweek, unit="D")


# ------------------------------------------------------------------------------ stagione
def seasonal_tables(R):
    """Stagione ricavata da un indice settimanale di mercato (se c'e), spostato sull'anno dei dati.

    CPM: media geometrica dei settori (le oscillazioni di un singolo settore non si ripetono,
         la curva comune si).
    CTR: per settore. Fuori dalle settimane degli eventi teniamo solo gli scostamenti grandi dal
         livello normale (regimi veri); quelli piccoli sono rumore e non si ritrovano.
    Senza indice la stagione e piatta.
    """
    cfg = cfg_di(R)
    bm, cal = R.get("bm"), R.get("cal")
    ev_weeks = set()
    if cal is not None and len(cal) and "evento" in cal:
        ev = cal[cal.evento.fillna("").astype(str).str.contains(cfg["eventi_stagionali"])]
        ev_weeks = set(monday(ev.data))
    if bm is None or len(bm) == 0:
        wk = pd.Series([], dtype="datetime64[ns]")
        v, f = pd.Series([], dtype=object), pd.Series([], dtype=float)
        return (pd.DataFrame({"wk": wk, "s_cpm": f}), pd.DataFrame({"wk": wk, "vertical": v, "s_cpm_own": f}),
                pd.DataFrame({"wk": wk, "vertical": v, "s_ctr": f}), ev_weeks)
    b = bm.copy()
    b["wk"] = b.settimana_dal + pd.Timedelta(days=int(R.get("sposta_indice", 364)))
    cpm = np.log(b.pivot(index="wk", columns="vertical", values="indice_cpm") / 100.0)
    ctr = np.log(b.pivot(index="wk", columns="vertical", values="indice_ctr") / 100.0)
    is_ev = ctr.index.isin(ev_weeks)
    base = ctr[~is_ev].median()
    dev = ctr - base
    dev_thr = dev.where(dev.abs() >= cfg["soglia_stagione"], 0.0)
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
    for c in ("s_cpm", "s_ctr", "s_cpm_own"):
        p[c] = p[c].fillna(0.0)
    p = p.merge(R["adset"][["adset_id", "budget_giornaliero_iniziale"]], on="adset_id", how="left")
    if R.get("budget_noto", True):
        p["lb"] = np.log(p.budget_giornaliero_adset / p.budget_giornaliero_iniziale).replace([np.inf, -np.inf], 0.0).fillna(0.0)
        bud = R["bud"].sort_values(["adset_id", "data"]).copy()
        chg = bud.groupby("adset_id").budget_giornaliero_eur.diff().fillna(0) != 0
        bud["last_chg"] = bud.data.where(chg)
        bud["last_chg"] = bud.groupby("adset_id").last_chg.ffill()
        bud["dsc"] = (bud.data - bud.last_chg).dt.days
        p = p.merge(bud[["adset_id", "data", "dsc"]], on=["adset_id", "data"], how="left")
        p["bud_learn"] = (p.dsc < 3).astype(float)
    else:  # budget sconosciuto: nessun effetto del budget, si assume costante
        p["lb"], p["dsc"], p["bud_learn"] = 0.0, np.nan, 0.0
    p["new3"] = (p.age < 3).astype(float)
    p["new4"] = (p.age < 4).astype(float)
    p["ev_week"] = p.wk.isin(ev_weeks)
    cal = R.get("cal")
    if cal is not None and len(cal) and "evento" in cal:
        p = p.merge(cal[["data", "evento"]], on="data", how="left")
        p["evento"] = p.evento.fillna("").astype(str)
    else:
        p["evento"] = ""
    return p


def flag_anomalies(h, cfg=None):
    """Anomalie nei dati: giorni senza click su un intero settore (tracciamento rotto)
    e giorni con spesa molto sopra il budget."""
    cfg = cfg or CONFIG_BASE
    h = h.copy()
    vd = h.groupby(["vertical", "data"]).agg(c=("click", "sum"), i=("impression", "sum")).reset_index()
    out = vd[(vd.c == 0) & (vd.i > cfg["anomalia_impression"])][["vertical", "data"]].assign(anom_click=True)
    h = h.merge(out, on=["vertical", "data"], how="left")
    h["anom_click"] = h.anom_click.fillna(False).astype(bool)
    sp = h.groupby(["adset_id", "data"]).spesa.transform("sum")
    h["anom_spesa"] = sp > cfg["anomalia_spesa"] * h.budget_giornaliero_adset
    return h


def asset_features(assets, cfg=None):
    """Caratteristiche di ogni creativita: parole chiave nella descrizione, formato e leva."""
    cfg = cfg or CONFIG_BASE
    a = assets.copy()
    txt = (a["descrizione_visual"] if "descrizione_visual" in a else pd.Series("", index=a.index)).fillna("").astype(str).str.lower()
    f = pd.DataFrame(index=a.asset_id)
    for k, rx in cfg["regole_creativita"].items():
        f[k] = txt.str.contains(rx).astype(float).values
    for col, rif in (("formato", cfg["rif_formato"]), ("leva", cfg["rif_leva"])):
        vals = a[col].astype(str)
        livelli = list(pd.unique(vals))   # nell'ordine in cui compaiono
        if rif not in livelli:
            rif = vals.value_counts().idxmax()
        for v in livelli:
            if v != rif and v not in f:
                f[v] = (vals == v).astype(float).values
    return f[~f.index.duplicated()]


# ------------------------------------------------------------------------- stimatori
def dummies(series, levels):
    return (series.values[:, None] == np.array(levels)[None, :]).astype(float)


def poisson_ridge(X, y, off, pen, prior=None, iters=100):
    b = np.zeros(X.shape[1]) if prior is None else np.array(prior, dtype=float)
    b0 = b.copy()
    P = np.diag(pen)
    for _ in range(iters):
        eta = np.clip(X @ b + off, -30, 30)
        mu = np.exp(eta)
        g = X.T @ (y - mu) - P @ (b - b0)
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
    Ogni leva ha la sua curva. Una leva senza curva propria (storia troppo corta) usa la media
    geometrica delle curve stimate."""
    age = np.asarray(age, dtype=float)
    leva = np.asarray(leva)
    if not params:
        return np.zeros(len(age))
    curve = {k: np.log(fl + (1 - fl) * np.exp(-age / tau)) for k, (fl, tau) in params.items()}
    out = np.mean(list(curve.values()), axis=0)
    for k, c in curve.items():
        out = np.where(leva == k, c, out)
    return out


def _effetti_adset(fx, vert, adset_ids, verticals):
    """Livello di ogni ad set; per un ad set mai visto usa la media del suo settore (o di tutti)."""
    tutti = float(np.mean(list(fx.values())))
    per_v = {}
    for a, v in vert.items():
        per_v.setdefault(v, []).append(fx[a])
    return np.array([fx[a] if a in fx else float(np.mean(per_v[v])) if v in per_v else tutti
                     for a, v in zip(adset_ids, verticals)])


# ----------------------------------------------------------------------------- CTR
class CTRModel:
    def __init__(self, lam_asset=0.5, lam_inter=20.0, search_fatigue=True, base=None, forza=0.0, cfg=None):
        self.lam_asset, self.lam_inter, self.search_fatigue = lam_asset, lam_inter, search_fatigue
        self.base, self.forza, self.cfg = base, forza, cfg or CONFIG_BASE

    def _design(self, p):
        cols = [dummies(p.adset_id, self.adsets), dummies(p.dow, list(range(1, 7))), p.new3.values[:, None],
                dummies(p.asset_id, self.assets_),
                dummies(p.adset_id + "|" + p.leva, self.inter)]
        return np.column_stack(cols)

    def fit(self, tr, feats):
        tr = tr[~tr.anom_click].copy()
        base = (self.base or {}).get("ctr")
        fisso = base is not None and self.forza >= 1e3
        pochi_giorni = tr.data.nunique() < 21
        self.adsets = sorted(tr.adset_id.unique())
        self.adset_vert = tr.groupby("adset_id").vertical.first().to_dict()
        self.assets_ = sorted(tr.asset_id.unique())
        self.asset_vert = tr.groupby("asset_id").vertical.first().reindex(self.assets_).values
        self.inter = sorted((tr.adset_id + "|" + tr.leva).unique())
        k0 = len(self.adsets)
        n_free = k0 + 6 + 1
        pen = np.r_[np.full(n_free, 1e-8), np.full(len(self.assets_), self.lam_asset),
                    np.full(len(self.inter), self.lam_inter)]
        prior = np.zeros(len(pen))
        if base is not None and (fisso or pochi_giorni):   # giorno della settimana e rodaggio dai valori di base
            pen[k0:k0 + 7] = max(self.forza, 1e6) if fisso else 1e6
            prior[k0:k0 + 6] = base["dow"][1:]
            prior[k0 + 6] = base["new3"]
        X = self._design(tr)
        y = tr.click.values.astype(float)
        base_off = np.log(tr.impression.values) + tr.s_ctr.values

        def run(params):
            off = base_off + log_fatigue(tr.age, tr.leva, params)
            b, cov = poisson_ridge(X, y, off, pen, prior)
            return deviance(y, np.exp(X @ b + off)), b, cov

        giorni = tr.groupby(["leva", "ad_id"]).size().groupby(level=0).max()
        leve_fit = sorted(l for l in giorni.index if giorni[l] >= self.cfg["giorni_min_fatica"])
        # la curva di una leva si cerca nei dati solo se almeno due suoi annunci sono stati seguiti da giovani
        # (prima settimana) fino a oltre quattro settimane: senza annunci giovani la curva non si vede
        eta_ad = tr.groupby(["leva", "ad_id"]).age.agg(["min", "max"])
        seguiti = ((eta_ad["min"] <= 7) & (eta_ad["max"] >= 28)).groupby(level=0).sum()
        leve_cerca = [l for l in leve_fit if seguiti.get(l, 0) >= 2]
        if fisso:
            params = {k: tuple(v) for k, v in base["fatica"].items()}
        else:
            params = {l: DEFAULT_FATIGUE.get(l, FATICA_BASE) for l in leve_fit}
            enough = bool(leve_fit) and tr.groupby("ad_id").size().max() >= 35 and tr.data.nunique() >= 49
            if not params:
                params = {k: tuple(v) for k, v in base["fatica"].items()} if base is not None else {"_base": FATICA_BASE}
            elif self.search_fatigue and enough and leve_cerca:
                grid_fl = [0.3, 0.4, 0.5, 0.6, 0.7, 0.85, 1.0]   # 1.0 = nessuna fatica
                grid_tau = [8, 12, 16, 20, 25, 30, 35, 45, 60, 80]
                for _ in range(2):
                    for k in leve_cerca:
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
        self.adset_fx = dict(zip(self.adsets, b[:k0]))
        self.dow_fx = np.r_[0.0, b[k0:k0 + 6]]
        self.new3_fx = b[k0 + 6]
        ka = k0 + 7
        self.asset_fx = dict(zip(self.assets_, b[ka:ka + len(self.assets_)]))
        self.asset_se = dict(zip(self.assets_, np.sqrt(np.diag(cov)[ka:ka + len(self.assets_)] * max(self.dispersion, 1.0))))
        ki = ka + len(self.assets_)
        self.inter_fx = dict(zip(self.inter, b[ki:]))
        self._fit_features(feats, base if (fisso or len(self.assets_) < 8) else None)
        return self

    def _fit_features(self, feats, base=None):
        """Qualita dell'asset spiegata dalle caratteristiche della creativita (ridge, scelta con leave-one-out).
        Con poche creativita i pesi arrivano dai valori di base."""
        ids = self.assets_
        F = feats.loc[ids]
        yv = np.array([self.asset_fx[i] for i in ids])
        self.feat_sd_naive = float(np.std(yv))
        if base is not None:
            self.feat_cols = [c for c in base["feat_cols"] if c in feats.columns]
            pesi = dict(zip(base["feat_cols"], base["feat_w"][1:]))
            self.feat_w = np.r_[base["feat_w"][0], [pesi[c] for c in self.feat_cols]]
            self.feat_loo_rmse, self.feat_lam = float(base["cold_sd"]), None
            return
        keep = [c for c in F.columns if 0 < F[c].sum() < len(F)]
        if not keep and self.base is not None:   # creativita senza descrizione: valgono i pesi di base
            return self._fit_features(feats, self.base["ctr"])
        self.feat_cols = keep
        A = np.column_stack([np.ones(len(ids)), F[keep].values])

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

    def asset_effect(self, asset_ids, feats):
        eff, se = [], []
        for a in asset_ids:
            if a in self.asset_fx:
                eff.append(self.asset_fx[a]); se.append(self.asset_se[a])
            else:
                x = np.r_[1.0, feats.loc[a, self.feat_cols].values.astype(float)] if a in feats.index else np.r_[1.0, np.zeros(len(self.feat_cols))]
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
        e = _effetti_adset(self.adset_fx, self.adset_vert, p.adset_id.values, p.vertical.values) + ae + inter
        e = e + log_fatigue(p.age, p.leva, self.fatigue) + self.new3_fx * p.new3.values
        if with_time:
            e = e + self.dow_fx[p.dow.values] + p.s_ctr.values
        return e, ase


# ----------------------------------------------------------------------------- CPM
class CPMModel:
    def __init__(self, lam_asset=3.0, idx_col="s_cpm", idx_pen=1e6, idx_coef=1.0, base=None, forza=0.0):
        # idx_pen alto = coefficiente dell'indice di mercato fissato a idx_coef (1: verificato sullo storico)
        self.lam_asset, self.idx_col, self.idx_pen, self.idx_coef0 = lam_asset, idx_col, idx_pen, idx_coef
        self.base, self.forza = base, forza

    def _design(self, p):
        lfat = log_fatigue(p.age, p.leva, self.fatigue)  # annuncio stanco = qualita piu bassa = CPM piu alto
        return np.column_stack([dummies(p.adset_id, self.adsets), dummies(p.dow, list(range(1, 7))),
                                p[self.idx_col].values, p.lb.values, p.new3.values, p.bud_learn.values, lfat,
                                dummies(p.asset_id, self.assets_)])

    def fit(self, tr, ctr_model, feats):
        tr = tr.copy()
        base = (self.base or {}).get("cpm")
        fisso = base is not None and self.forza >= 1e3
        pochi_giorni = tr.data.nunique() < 21
        self.adsets = sorted(tr.adset_id.unique())
        self.adset_vert = tr.groupby("adset_id").vertical.first().to_dict()
        self.assets_ = sorted(tr.asset_id.unique())
        self.asset_vert = tr.groupby("asset_id").vertical.first().reindex(self.assets_).values
        self.fatigue = ctr_model.fatigue
        X = self._design(tr)
        y = np.log(tr.cpm.values)
        k0 = len(self.adsets)
        pen = np.r_[np.full(k0 + 6, 1e-8), self.idx_pen, 1.0, 1e-8, 1.0, 1.0, np.full(len(self.assets_), self.lam_asset)]
        prior = np.zeros(X.shape[1])
        prior[k0 + 6] = self.idx_coef0
        prior[k0 + 7] = ELASTICITY_PRIOR
        if base is not None:
            prior[k0 + 7] = base["elasticita"]            # dove lo storico non dice nulla vale il valore di base
            if fisso or pochi_giorni:
                f = max(self.forza, 1e6) if fisso else 1e6
                pen[k0:k0 + 6] = f
                prior[k0:k0 + 6] = base["dow"][1:]
                pen[k0 + 8:k0 + 11] = f
                prior[k0 + 8:k0 + 11] = [base["new3"], base["budlearn"], base["fat"]]
            if fisso:
                pen[k0 + 7] = max(self.forza, 1e6)
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
        self.sigma_week = float(wk.std()) if len(wk) > 1 else 0.03
        # effetto asset sul CPM spiegato dalla qualita (CTR) dell'asset: asset migliori costano meno
        z = np.array([ctr_model.asset_fx.get(a, 0.0) for a in self.assets_])
        yv = np.array([self.asset_fx[a] for a in self.assets_])
        A = np.column_stack([np.ones(len(z)), z])
        if base is not None and (fisso or len(z) < 8):
            self.q_w, self.q_sd = np.array(base["q_w"], dtype=float), float(base["q_sd"])
        else:
            self.q_w = np.linalg.lstsq(A, yv, rcond=None)[0] if len(z) > 3 else np.array([0.0, 0.0])
            self.q_sd = float(np.std(yv - A @ self.q_w)) if len(z) > 3 else 0.05
        return self

    def mu(self, p, ctr_model, feats):
        ae = []
        z, _ = ctr_model.asset_effect(p.asset_id.values, feats)
        for a, zi in zip(p.asset_id.values, z):
            ae.append(self.asset_fx[a] if a in self.asset_fx else self.q_w[0] + self.q_w[1] * zi)
        m = _effetti_adset(self.adset_fx, self.adset_vert, p.adset_id.values, p.vertical.values) + self.dow_fx[p.dow.values]
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
    """Come la piattaforma divide il budget dell'ad set tra gli annunci attivi, e la frequenza."""

    def fit(self, tr, q_log, base=None):
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
        elif base is not None:
            self.a, self.boost = base["a"], base["boost"]
        else:
            self.a, self.boost = 1.2, 0.45
        # frequenza = c0 + c1 * impression dell'ad set (1/c1 e una misura della grandezza del pubblico)
        a = t[ok].groupby(["adset_id", "data"]).agg(imp=("impression", "sum"), cop=("copertura", "sum")).reset_index()
        a["f"] = (a.imp / a.cop.where(a.cop > 0)).fillna(1.0)
        self.freq = {}
        for k, g in a.groupby("adset_id"):
            A = np.column_stack([np.ones(len(g)), g.imp.values])
            c = np.linalg.lstsq(A, g.f.values, rcond=None)[0]
            self.freq[k] = (float(c[0]), float(max(c[1], 0.0)), float(g.f.mean()))
        self.freq_media = (float(np.mean([v[2] for v in self.freq.values()])), 0.0, float(np.mean([v[2] for v in self.freq.values()])))
        return self

    def shares(self, p, q_log):
        w = np.exp(self.a * q_log + self.boost * p.new4.values)
        tot = pd.Series(w).groupby([p.adset_id.values, p.data.values]).transform("sum").values
        return w / tot


# ------------------------------------------------------------------------- pipeline
class Forecaster:
    """Stima sullo storico e prevede righe future.

    base:  valori di base dei fattori comuni (da `valori_base()` di un'altra stima, o da file).
    forza: 0 = i valori di base entrano solo dove lo storico non basta (default);
           >= 1000 = i fattori comuni restano fissi ai valori di base e lo storico stima solo i livelli.
    """

    def __init__(self, R, ctr_kw=None, cpm_kw=None, base=None, forza=0.0, adatta=True):
        self.R = R
        self.cfg = cfg_di(R)
        self.feats = asset_features(R["assets"], self.cfg)
        self.ctr_kw, self.cpm_kw = ctr_kw or {}, cpm_kw or {}
        self.base, self.forza, self.adatta = base, forza, adatta

    def fit(self, hist_rows):
        tr = flag_anomalies(make_panel(self.R, hist_rows), self.cfg)
        self.train = tr
        self.ctr = CTRModel(base=self.base, forza=self.forza, cfg=self.cfg, **self.ctr_kw).fit(tr, self.feats)
        self.cpm = CPMModel(base=self.base, forza=self.forza, **self.cpm_kw).fit(tr, self.ctr, self.feats)
        q, _ = self.ctr.eta(tr, self.feats, with_time=False)
        self.deliv = DeliveryModel().fit(tr, q, (self.base or {}).get("quote"))
        self.obs_age = tr.groupby("asset_id").age.agg(["min", "max"])
        # livello recente: nei dati veri il livello di un annuncio si sposta nel tempo. Quanto fidarsi
        # dell'ultima settimana lo decide una prova interna su giorni nascosti (vedi _scegli_adattamento).
        self.rho = {"ctr": 0.0, "cpm": 0.0}
        self.deriva = {"ctr": 0.0, "cpm": 0.0}
        self.prova_adatta = None
        self.liv = self._livello_recente(tr)
        if self.adatta:
            self._scegli_adattamento(hist_rows)
        return self

    def _livello_recente(self, tr, giorni=7):
        """Di quanto l'ultima settimana si scosta dal livello stimato su tutto lo storico (in logaritmo), per
        annuncio e per ad set, e quanto quello scostamento e grande rispetto al rumore (z). Chi ha pochi dati
        recenti viene tirato verso zero."""
        t = tr.copy()
        eta, _ = self.ctr.eta(t, self.feats)
        t["lam"] = t.impression.values * np.exp(eta)
        t["e_cpm"] = np.log(t.cpm.values) - self.cpm.mu(t, self.ctr, self.feats)
        t["pearson"] = (t.click.values - t.lam.values) ** 2 / np.maximum(t.lam.values, 1e-9)
        recente = t.data > t.data.max() - pd.Timedelta(days=giorni)
        out = {}
        for chiave in ("ad_id", "adset_id"):
            buoni = t[~t.anom_click]
            disp = buoni.groupby(chiave).pearson.mean().clip(lower=1.0)
            g = buoni[recente[~t.anom_click]].groupby(chiave).agg(c=("click", "sum"), l=("lam", "sum"))
            ctr = np.log((g.c + PESO_LIVELLO) / (g.l + PESO_LIVELLO))
            z_ctr = np.log((g.c + 0.5) / (g.l + 0.5)) / np.sqrt(disp.reindex(g.index).fillna(1.0) / np.maximum(g.l, 1.0))
            sd = t.groupby(chiave).e_cpm.std().fillna(self.cpm.sigma).clip(lower=0.5 * self.cpm.sigma)
            h = t[recente].groupby(chiave).e_cpm.agg(["mean", "size"])
            cpm = h["mean"] * h["size"] / (h["size"] + 2.0)
            z_cpm = h["mean"] * np.sqrt(h["size"]) / sd.reindex(h.index)
            out[chiave] = (ctr.to_dict(), cpm.to_dict(), z_ctr.abs().to_dict(), z_cpm.abs().to_dict())
        return out

    def _scostamento(self, p, rho_ctr=None, rho_cpm=None):
        """Correzione di ogni riga verso il livello dell'ultima settimana: quella del suo annuncio, o del suo
        ad set se l'annuncio e nuovo. Pesa `rho`; pesa 1 se l'ultima settimana e un salto netto (z oltre soglia)."""
        rho_ctr = self.rho["ctr"] if rho_ctr is None else rho_ctr
        rho_cpm = self.rho["cpm"] if rho_cpm is None else rho_cpm
        ad, as_ = self.liv["ad_id"], self.liv["adset_id"]
        out = []
        for k, rho in ((0, rho_ctr), (1, rho_cpm)):
            c = np.zeros(len(p))
            for i, (a, s) in enumerate(zip(p.ad_id.values, p.adset_id.values)):
                liv = ad if a in ad[k] else as_
                chi = a if a in ad[k] else s
                if chi in liv[k]:
                    peso = 1.0 if liv[k + 2].get(chi, 0.0) > SOGLIA_SALTO else rho
                    c[i] = peso * liv[k][chi]
            out.append(c)
        return out[0], out[1]

    def _scegli_adattamento(self, hist_rows):
        """Prova interna: toglie gli ultimi giorni dello storico, li prevede con piu o meno peso al livello
        dell'ultima settimana e tiene il peso che sbaglia meno. Ripetuta su fino a tre finestre.
        Se il livello recente non aiuta in modo netto resta fuori."""
        giorni = hist_rows.data.nunique()
        H = min(14, giorni // 4)
        if H < 5:
            return
        somma = {r: np.zeros(2) for r in GRIGLIA_ADATTA}
        peso = np.zeros(2)
        ultima = None
        for k in (1, 2, 3):
            taglio = hist_rows.data.max() - pd.Timedelta(days=k * H)
            prima = hist_rows[hist_rows.data <= taglio]
            if prima.data.nunique() < 28:
                break
            try:
                f0 = Forecaster(self.R, self.ctr_kw, self.cpm_kw, base=self.base, forza=self.forza, adatta=False).fit(prima)
            except Exception:   # storico troppo povero per questa finestra
                break
            dopo = self.train[(self.train.data > taglio) & (self.train.data <= taglio + pd.Timedelta(days=H))]
            if len(dopo) < 10:
                continue
            eta, _ = f0.ctr.eta(dopo, f0.feats)
            lcpm = f0.cpm.mu(dopo, f0.ctr, f0.feats)
            ok = ~dopo.anom_click.values
            imp, clk, cpm = dopo.impression.values, dopo.click.values.astype(float), dopo.cpm.values
            for rho in GRIGLIA_ADATTA:
                c_ctr, c_cpm = f0._scostamento(dopo, rho, rho)
                somma[rho] += [np.abs(imp * np.exp(eta + c_ctr) - clk)[ok].sum(), np.abs(np.exp(lcpm + c_cpm) - cpm).__truediv__(cpm).sum()]
            peso += [max(clk[ok].sum(), 1.0), len(dopo)]
            if ultima is None:
                ultima = (f0, dopo, eta, lcpm, ok, imp, clk, cpm)
        if ultima is None:
            return
        err = {r: somma[r] / peso for r in GRIGLIA_ADATTA}
        self.prova_adatta = {"giorni": int(H), "errore": {str(r): [float(v[0]), float(v[1])] for r, v in err.items()}}
        for i, k in enumerate(("ctr", "cpm")):
            migliore = min(GRIGLIA_ADATTA, key=lambda r: err[r][i])
            if err[migliore][i] < (1.0 - SOGLIA_ADATTA) * err[0.0][i]:
                self.rho[k] = float(migliore)
        # quanto il livello di un annuncio si e spostato nei giorni nascosti, oltre il rumore: entra nella forchetta
        f0, dopo, eta, lcpm, ok, imp, clk, cpm = ultima
        c_ctr, c_cpm = f0._scostamento(dopo, self.rho["ctr"], self.rho["cpm"])
        d = dopo.assign(lam=imp * np.exp(eta + c_ctr), e=np.log(cpm) - (lcpm + c_cpm))
        if self.rho["ctr"] > 0:
            g = d[ok].groupby("ad_id").agg(c=("click", "sum"), l=("lam", "sum"))
            g = g[g.l > 5]
            if len(g) > 1:
                v = np.log((g.c + 0.5) / (g.l + 0.5)).var() - (max(f0.ctr.dispersion, 1.0) / g.l).mean()
                self.deriva["ctr"] = float(np.sqrt(max(v, 0.0)))
        if self.rho["cpm"] > 0:
            g = d.groupby("ad_id").e.agg(["mean", "size"])
            if len(g) > 1:
                v = g["mean"].var() - (f0.cpm.sigma ** 2 / g["size"]).mean()
                self.deriva["cpm"] = float(np.sqrt(max(v, 0.0)))

    def valori_base(self):
        """I fattori comuni stimati qui, da usare come punto di partenza su un altro storico."""
        c, m, d = self.ctr, self.cpm, self.deliv
        return {
            "ctr": {"dow": [float(x) for x in c.dow_fx], "new3": float(c.new3_fx),
                    "fatica": {k: [float(v[0]), float(v[1])] for k, v in c.fatigue.items()},
                    "feat_cols": list(c.feat_cols), "feat_w": [float(x) for x in c.feat_w], "cold_sd": float(c.feat_loo_rmse)},
            "cpm": {"dow": [float(x) for x in m.dow_fx], "elasticita": float(m.elasticity), "new3": float(m.new3_fx),
                    "budlearn": float(m.budlearn_fx), "fat": float(m.fat_fx), "q_w": [float(x) for x in m.q_w], "q_sd": float(m.q_sd)},
            "quote": {"a": float(d.a), "boost": float(d.boost)},
        }

    def _gap_fatica(self, ages):
        """Meta della distanza tra la curva di fatica piu lenta e la piu veloce: l'incertezza di una leva senza curva."""
        curve = [np.log(fl + (1 - fl) * np.exp(-np.asarray(ages, dtype=float) / tau)) for fl, tau in self.ctr.fatigue.values()]
        if len(curve) < 2:
            return np.zeros(len(ages))
        return 0.5 * (np.max(curve, axis=0) - np.min(curve, axis=0))

    def predict(self, future_rows, n_sim=2000, seed=7):
        p = make_panel(self.R, future_rows)
        rng = np.random.default_rng(seed)
        n = len(p)
        eta, _ = self.ctr.eta(p, self.feats)
        ase = self.ctr.param_sd(p, self.feats)
        q, _ = self.ctr.eta(p, self.feats, with_time=False)
        lcpm = self.cpm.mu(p, self.ctr, self.feats)
        c_ctr, c_cpm = self._scostamento(p)   # livello recente: zero se la prova interna non lo ha scelto e non ci sono salti
        eta, lcpm = eta + c_ctr, lcpm + c_cpm
        self.salti = int(sum(z > SOGLIA_SALTO for k in (2, 3) for z in self.liv["ad_id"][k].values()))
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
        fq = [self.deliv.freq.get(a, self.deliv.freq_media) for a in p.adset_id]
        fr = np.array([f[0] + f[1] * i for f, i in zip(fq, imp_as)])
        out["frequenza_prev"] = fr
        out["copertura_prev"] = imp / fr

        # ---- incertezza (Monte Carlo): rumore giornaliero + incertezza dei parametri strutturali
        seen = p.asset_id.isin(self.ctr.asset_fx).values
        adset_noto = p.adset_id.isin(self.ctr.adset_fx).values
        grp_w = pd.factorize(p.vertical + "|" + p.wk.astype(str))[0]
        grp_a = pd.factorize(p.asset_id)[0]
        grp_s = pd.factorize(p.adset_id)[0]
        senza_curva = ~p.leva.isin(list(self.ctr.fatigue.keys())).values
        gap = self._gap_fatica(p.age.values)
        ref = np.zeros(n)
        for i, a in enumerate(p.asset_id.values):
            if a in self.obs_age.index:
                ages = np.arange(self.obs_age.loc[a, "min"], self.obs_age.loc[a, "max"] + 1)
                ref[i] = np.mean(self._gap_fatica(ages))
        sd_fat = np.where(senza_curva, np.abs(gap - ref), 0.0)
        ev_day = p.evento.str.contains("Black Friday|Cyber").values
        piatta = 0.0 if self.R.get("stagione_nota", True) else 0.05   # senza indice di mercato la forchetta si allarga
        sd_seas_ctr = 0.03 + 0.25 * np.abs(p.s_ctr.values) + np.where(ev_day, 0.05, 0.0) + piatta
        sd_seas_cpm = max(self.cpm.sigma_week, 0.03) + np.where(ev_day, 0.05, 0.0) + piatta
        # indice di mercato oltre i valori visti nello storico (es. settimana del Black Friday): quanto pesa li
        # l'indice non e verificabile, e le due stime indipendenti del suo peso (0,87 e 1) danno lo scarto
        s_tr = self.train[self.cpm.idx_col].values
        fuori = np.maximum(p[self.cpm.idx_col].values - s_tr.max(), 0.0) + np.maximum(s_tr.min() - p[self.cpm.idx_col].values, 0.0)
        sd_seas_cpm = np.hypot(sd_seas_cpm, INCERTEZZA_INDICE * fuori)
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
        if self.deriva["ctr"] or self.deriva["cpm"]:   # il livello di ogni annuncio puo spostarsi ancora
            rng3 = np.random.default_rng(seed + 2)
            grp_ad = pd.factorize(p.ad_id)[0]
            eta_s = eta_s + rng3.standard_normal((n_sim, grp_ad.max() + 1))[:, grp_ad] * self.deriva["ctr"]
            lcpm_s = lcpm_s + rng3.standard_normal((n_sim, grp_ad.max() + 1))[:, grp_ad] * self.deriva["cpm"]
        if not adset_noto.all():   # ad set mai visto: non conosciamo il suo livello
            rng2 = np.random.default_rng(seed + 1)
            z1 = rng2.standard_normal((n_sim, grp_s.max() + 1))[:, grp_s]
            z2 = rng2.standard_normal((n_sim, grp_s.max() + 1))[:, grp_s]
            eta_s = eta_s + z1 * np.where(adset_noto, 0.0, np.std(list(self.ctr.adset_fx.values())) or 0.3)
            lcpm_s = lcpm_s + z2 * np.where(adset_noto, 0.0, np.std(list(self.cpm.adset_fx.values())) or 0.3)
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

        # ---- stadio della previsione e affidabilita
        tr = self.train
        clk_a = p.asset_id.map(tr.groupby("asset_id").click.sum()).fillna(0).values
        gg_a = p.asset_id.map(tr.groupby("asset_id").data.nunique()).fillna(0).values
        lb_ult = p.adset_id.map(tr.sort_values("data").groupby("adset_id").lb.last()).fillna(0).values
        modifica = (p.bud_learn.values > 0) | (np.abs(p.lb.values - lb_ult) > np.log(1.2))
        stadio = np.where(~adset_noto, "fuori dominio",
                          np.where(~seen, "mai vista",
                                   np.where(modifica, "dopo modifica",
                                            np.where((clk_a < 300) | (gg_a < 7), "primi dati", "storico"))))
        w_ctr = (out.ctr_atteso_p90.values - out.ctr_atteso_p10.values) / ctr
        w_cpm = (out.cpm_p90.values - out.cpm_p10.values) / cpm
        aff = np.where((w_ctr > 0.7) | (w_cpm > 0.5) | ~adset_noto, "bassa",
                       np.where((w_ctr < 0.35) & (w_cpm < 0.3) & (stadio == "storico"), "alta", "media"))
        out["stadio"], out["affidabilita"] = stadio, aff
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
    f = f.merge(ad, left_on="ad_id", right_index=True, how="left").merge(as_, left_on="adset_id", right_index=True, how="left", suffixes=("", "_as"))
    use_ad = f.i.notna()
    f["ctr_prev"] = np.where(use_ad, f.c / f.i, f.c_as / f.i_as) * 100
    f["cpm_prev"] = np.where(use_ad, f.s / f.i, f.s_as / f.i_as) * 1000
    return f[["data", "ad_id", "ctr_prev", "cpm_prev"]].dropna()


def scarto_poisson(lam):
    """E|X - lam| per X ~ Poisson(lam): l'errore assoluto atteso sui click anche conoscendo il tasso vero."""
    lam = np.maximum(np.asarray(lam, dtype=float), 1e-9)
    k = np.floor(lam)
    lg = np.array([math.lgamma(x + 1.0) for x in k])
    return 2.0 * lam * np.exp(k * np.log(lam) - lam - lg)


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
    # minimo possibile: l'errore che resterebbe conoscendo il CTR vero, per il solo caso dei click di un giorno
    r["CTR_minimo_%"] = 100 * scarto_poisson(mc.impression * mc.ctr_prev / 100.0).sum() / max(mc.click.sum(), 1)
    if "ctr_p10" in m:
        r["CTR_cop80_%"] = 100 * np.mean((mc.ctr >= mc.ctr_p10) & (mc.ctr <= mc.ctr_p90))
        r["CPM_cop80_%"] = 100 * np.mean((m.cpm >= m.cpm_p10) & (m.cpm <= m.cpm_p90))
    return r


def backtest(R, cutoff, horizon=14, ctr_kw=None, cpm_kw=None, base=None, forza=0.0, n_sim=2000):
    """Nasconde al modello i giorni dopo `cutoff`, li fa prevedere e confronta con i valori veri."""
    h = R["hist"]
    cutoff = pd.Timestamp(cutoff)
    tr = h[h.data <= cutoff]
    te = h[(h.data > cutoff) & (h.data <= cutoff + pd.Timedelta(days=horizon))]
    if tr.empty or te.empty:
        raise ValueError("Nessuna riga %s il %s: prova non eseguibile su questa data." % ("prima del" if tr.empty else "nei giorni nascosti dopo", cutoff.date()))
    fc = Forecaster(R, ctr_kw, cpm_kw, base=base, forza=forza).fit(tr)
    pred = fc.predict(te[R["fut"].columns], n_sim=n_sim)
    riferimento = baseline_last7(R, tr, te)
    new_ads = ~te.ad_id.isin(tr.ad_id.unique())
    rows = []
    for nm, pr in [("strutturale", pred), ("ultimi 7 giorni", riferimento)]:
        rows.append(dict(score(pr, te, nm), taglio=str(cutoff.date()), gruppo="tutti"))
        if new_ads.any():
            rows.append(dict(score(pr, te[new_ads], nm), taglio=str(cutoff.date()), gruppo="annunci nuovi"))
            rows.append(dict(score(pr, te[~new_ads], nm), taglio=str(cutoff.date()), gruppo="annunci gia visti"))
    out = pd.DataFrame(rows)
    # minimo possibile sul CPM: l'oscillazione da un giorno all'altro che nessun modello puo prevedere
    out["CPM_minimo_%"] = 100 * fc.cpm.sigma * math.sqrt(2.0 / math.pi)
    out.loc[out.modello != "strutturale", ["CPM_minimo_%", "CTR_minimo_%"]] = np.nan
    return out, fc, pred
