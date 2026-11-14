"""Prova il motore su marche vere: il dataset pubblico di Conjura (79 marche di e-commerce con Meta o TikTok,
spesa, impression e click al giorno per canale, 2019-2024, licenza CC BY 4.0).

    curl -L -o conjura_mmm.csv https://ndownloader.figshare.com/files/46779652      # 36,7 MB
    python3 strumenti/prova_conjura.py conjura_mmm.csv risultati.csv

Pagina del dataset: https://figshare.com/articles/dataset/25314841
Il file non e incluso nel repository. Per ogni marca e per otto date: 91 giorni di storico, 14 giorni nascosti,
previsti in tre modi (motore senza stagione, motore con l'indice di mercato dell'anno prima ricavato dalle ALTRE
marche, riferimento "resta come gli ultimi 7 giorni"). Ogni canale (Facebook, Instagram, TikTok) vale come un
annuncio: qui non ci sono creativita ne ad set, quindi si misura solo la parte del motore che segue i livelli
nel tempo. In fondo: quanto l'aumento del Black Friday di un anno anticipa quello dell'anno dopo.
"""
import sys
import time
import warnings
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import flockets  # noqa: E402
from flockets import motore as M  # noqa: E402

warnings.filterwarnings("ignore")

f, out = sys.argv[1], sys.argv[2]
CANALI = sys.argv[3].split(",") if len(sys.argv) > 3 else ["META_FACEBOOK", "META_INSTAGRAM", "TIKTOK"]
d = pd.read_csv(f, parse_dates=["DATE_DAY"])
a = d[d.TERRITORY_NAME == "All Territories"]
L = pd.concat([pd.DataFrame({"data": a.DATE_DAY, "marca": a.ORGANISATION_ID.str[:8], "vertical": a.ORGANISATION_VERTICAL, "canale": ch.lower(),
                             "spesa": a[ch + "_SPEND"], "impression": a[ch + "_IMPRESSIONS"], "click": a[ch + "_CLICKS"].fillna(0)}) for ch in CANALI])
L = L[(L.impression.fillna(0) > 0) & (L.spesa.fillna(0) > 0)].copy()
L["serie"] = L.marca + "|" + L.canale
L["wk"] = L.data - pd.to_timedelta(L.data.dt.dayofweek, unit="D")
print("righe attive", len(L), "| marche", L.marca.nunique(), "| serie", L.serie.nunique())

def indice(escludi, da, fino):
    """Indice settimanale di mercato dalle ALTRE marche, sulle date dell'anno prima."""
    x = L[(L.marca != escludi) & (L.wk >= da) & (L.wk <= fino)]
    w = x.groupby(["serie", "wk"]).agg(s=("spesa", "sum"), i=("impression", "sum"), c=("click", "sum"), n=("data", "size")).reset_index()
    w = w[(w.n >= 5) & (w.c > 0)]
    w["lcpm"], w["lctr"] = np.log(w.s / w.i), np.log(w.c / w.i)
    piene = w.groupby("serie").wk.transform("size") >= 0.8 * w.wk.nunique()
    w = w[piene]
    for c in ("lcpm", "lctr"):
        w[c] = w[c] - w.groupby("serie")[c].transform("median")
    g = w.groupby("wk").agg(cpm=("lcpm", "median"), ctr=("lctr", "median"), n=("serie", "size"))
    return g[g.n >= 8]

EVENTI = pd.DataFrame({"data": pd.to_datetime(["2022-11-25", "2022-11-28", "2023-11-24", "2023-11-27"]), "evento": ["Black Friday", "Cyber Monday", "Black Friday", "Cyber Monday"]})
FINI = ["2023-03-26", "2023-05-28", "2023-07-30", "2023-09-24", "2023-11-26", "2023-12-10", "2024-02-25", "2024-04-28"]
righe, falliti = [], []
t0 = time.time()
for fine in FINI:
    T = pd.Timestamp(fine); taglio = T - pd.Timedelta(days=14); inizio = taglio - pd.Timedelta(days=91)
    W = L[(L.data > inizio) & (L.data <= T)]
    for marca, g in W.groupby("marca"):
        tr, te = g[g.data <= taglio], g[g.data > taglio]
        ok = [s for s, x in tr.groupby("serie") if len(x) >= 70 and x.impression.median() >= 2000 and (te.serie == s).sum() >= 10]
        if not ok:
            continue
        g = g[g.serie.isin(ok)]
        sto = pd.DataFrame({"data": g.data.dt.strftime("%Y-%m-%d"), "ad_id": g.serie, "adset_id": g.serie, "campaign_id": g.marca, "inserzionista_id": g.marca,
                            "vertical": g.vertical, "spesa": g.spesa, "impression": g.impression.astype(int), "click": g.click.astype(int)})
        ix = indice(marca, inizio - pd.Timedelta(days=364 + 7), T - pd.Timedelta(days=364) + pd.Timedelta(days=28))
        bm = pd.DataFrame({"settimana_dal": ix.index.strftime("%Y-%m-%d"), "vertical": g.vertical.iloc[0], "indice_cpm": 100 * np.exp(ix.cpm.values), "indice_ctr": 100 * np.exp(ix.ctr.values)})
        for modo, tab in [("senza stagione", {"storico.csv": sto}), ("con indice anno prima", {"storico.csv": sto, "benchmark_mercato.csv": bm, "calendario.csv": EVENTI.assign(data=EVENTI.data.dt.strftime("%Y-%m-%d"))})]:
            if modo != "senza stagione" and len(bm) < 12:
                continue
            try:
                R = flockets.costruisci(dict(tab), 14)
                base = flockets.valori_base() if flockets.serve_base(R) else None
                Tb, fc, pred = M.backtest(R, taglio, horizon=14, base=base, n_sim=200)
            except Exception as err:
                falliti.append((fine, marca, modo, type(err).__name__ + ": " + str(err)[:90]))
                continue
            for _, x in Tb[Tb.gruppo == "tutti"].iterrows():
                if x.modello == "strutturale" or modo == "senza stagione":
                    righe.append(dict(fine=fine, marca=marca, vertical=g.vertical.iloc[0], serie=len(ok), righe=x.righe, modello=modo if x.modello == "strutturale" else "ultimi 7 giorni",
                                      cpm=x["CPM_MAPE_%"], ctr=x["CTR_WAPE_%"], cpm_min=x.get("CPM_minimo_%"), ctr_min=x.get("CTR_minimo_%"), cpm_bias=x["CPM_bias_%"], ctr_bias=x["CTR_bias_%"],
                                      cop_cpm=x.get("CPM_cop80_%"), cop_ctr=x.get("CTR_cop80_%"), fatica=str(fc.ctr.fatigue) if x.modello == "strutturale" else "", rho_ctr=fc.rho["ctr"] if x.modello == "strutturale" else np.nan, rho_cpm=fc.rho["cpm"] if x.modello == "strutturale" else np.nan))
    print("fine", fine, "fatto, righe finora", len(righe), "falliti", len(falliti), "%.0fs" % (time.time() - t0), flush=True)
Rz = pd.DataFrame(righe); Rz.to_csv(out, index=False)
print("\nprove riuscite:", Rz.groupby("modello").size().to_dict(), "| fallite:", len(falliti))
for x in falliti[:8]: print("  fallita:", x)
ordine = ["senza stagione", "con indice anno prima", "ultimi 7 giorni"]
print("\nMEDIA su tutte le prove (marca x data):"); print(Rz.groupby("modello")[["cpm", "ctr", "cpm_min", "ctr_min", "cpm_bias", "ctr_bias", "cop_cpm", "cop_ctr"]].mean().reindex(ordine).round(2).to_string())
print("\nMEDIANA:"); print(Rz.groupby("modello")[["cpm", "ctr", "cpm_bias", "ctr_bias"]].median().reindex(ordine).round(2).to_string())
P = Rz.pivot_table(index=["fine", "marca"], columns="modello", values=["cpm", "ctr"])
for m in ["senza stagione", "con indice anno prima"]:
    if ("cpm", m) in P:
        q = P.dropna(subset=[("cpm", m), ("cpm", "ultimi 7 giorni")])
        print("%-22s batte il riferimento: CPM in %.0f%% delle prove, CTR in %.0f%% (n=%d)" % (m, 100 * (q[("cpm", m)] < q[("cpm", "ultimi 7 giorni")]).mean(), 100 * (q[("ctr", m)] < q[("ctr", "ultimi 7 giorni")]).mean(), len(q)))
print("\nper data di fine (media CPM | CTR):"); print(Rz.pivot_table(index="fine", columns="modello", values=["cpm", "ctr"], aggfunc="mean")[[("cpm", o) for o in ordine] + [("ctr", o) for o in ordine]].round(1).to_string())
print("\nrho scelto (senza stagione): CTR", Rz[Rz.modello == "senza stagione"].rho_ctr.value_counts().sort_index().to_dict(), "| CPM", Rz[Rz.modello == "senza stagione"].rho_cpm.value_counts().sort_index().to_dict())
print("\nfatica stimata (senza stagione), le piu frequenti:", Rz[Rz.modello == "senza stagione"].fatica.value_counts().head(6).to_dict())

# ---- Black Friday: l'aumento di un anno anticipa quello dell'anno dopo?
L = L[L.canale.isin(['meta_facebook', 'meta_instagram'])].rename(columns={'impression': 'imp', 'click': 'clk'})
W = L.groupby(["serie", "marca", "wk"]).agg(s=("spesa", "sum"), i=("imp", "sum"), c=("clk", "sum"), n=("data", "size")).reset_index()
W = W[(W.n >= 6) & (W.c > 0)]
W["lcpm"], W["lctr"] = np.log(W.s / W.i), np.log(W.c / W.i)
def scarto(anno, col):
    """Per serie: log della settimana meno la media delle 4 settimane di ottobre (dal primo lunedi di ottobre)."""
    base = W[(W.wk >= pd.Timestamp("%d-10-01" % anno)) & (W.wk < pd.Timestamp("%d-10-29" % anno))].groupby("serie")[col].agg(["mean", "size"])
    base = base[base["size"] >= 3]["mean"]
    x = W[(W.wk >= pd.Timestamp("%d-10-30" % anno)) & (W.wk <= pd.Timestamp("%d-12-11" % anno))].copy()
    x = x[x.serie.isin(base.index)]
    x["d"] = x[col] - x.serie.map(base)
    x["k"] = ((x.wk - pd.Timestamp("%d-11-24" % anno if anno == 2023 else "%d-11-25" % anno)).dt.days // 7 + 1) * 7   # settimane rispetto a quella del Black Friday
    x["sett"] = (x.wk - (pd.Timestamp("2023-11-20") if anno == 2023 else pd.Timestamp("2022-11-21"))).dt.days // 7
    return x
for col, nome in [("lcpm", "CPM"), ("lctr", "CTR")]:
    a22, a23 = scarto(2022, col), scarto(2023, col)
    m22 = a22.groupby("sett").d.median()          # il "mercato" dell'anno prima (tutte le serie)
    print("\n%s: scarto dal livello di ottobre (log), per settimana rispetto a quella del Black Friday (0)" % nome)
    righe = []
    for k in range(-3, 4):
        x = a23[a23.sett == k]
        if not len(x) or k not in m22.index: continue
        # indice dell'anno prima SENZA la marca stessa
        idx = np.array([a22[(a22.sett == k) & (a22.marca != m)].d.median() for m in x.marca])
        righe.append(dict(sett=k, serie_2023=len(x), mercato_2022=m22[k], mediana_2023=x.d.median(), errore_senza_indice=np.abs(x.d).mean(), errore_con_indice=np.abs(x.d - idx).mean(), errore_con_087=np.abs(x.d - 0.87 * idx).mean()))
    T = pd.DataFrame(righe).set_index("sett"); print(T.round(3).to_string())
    z = a23[a23.sett.between(-1, 2)].copy()
    z["idx"] = [a22[(a22.sett == k) & (a22.marca != m)].d.median() for k, m in zip(z.sett, z.marca)]
    b = np.polyfit(z.idx, z.d, 1)
    med = z.groupby("sett").agg(d=("d", "median"), i=("idx", "median"))
    print("  settimane -1..+2: pendenza per serie (minimi quadrati) %.2f | rapporto tra mediane 2023/2022: %s | n=%d" % (b[0], (med.d / med.i).round(2).to_dict(), len(z)))
    for coef in [0.0, 0.5, 0.87, 1.0, 1.15]:
        print("    peso %.2f: errore assoluto medio %.3f, mediano %.3f" % (coef, np.abs(z.d - coef * z.idx).mean(), np.abs(z.d - coef * z.idx).median()))
