"""Contratto dei dati: accetta tabelle con nomi diversi e riempie cio che manca.

Serve una sola tabella obbligatoria, lo storico giornaliero per annuncio, con almeno:
data, annuncio, spesa, impression, click. Tutto il resto e facoltativo e migliora la previsione:

  ad set, campagna, settore, inserzionista   per raggruppare
  copertura                                   per stimare la grandezza del pubblico
  budget dell'ad set, per giorno              per l'effetto del budget (anche futuro)
  annunci con data di lancio                  per la fatica della creativita
  creativita con leva, formato, descrizione   per stimare gli annunci mai visti
  righe da prevedere                          altrimenti: gli annunci attivi, per `orizzonte` giorni
  calendario con eventi, indice di mercato    per la stagione

Ogni cosa che manca viene sostituita con una scelta prudente e annotata in `R["note"]`.
"""
import io
import re
import unicodedata
from pathlib import Path

import numpy as np
import pandas as pd

ALIAS = {
    "data": ["date", "day", "giorno", "dia", "fecha", "jour", "tag", "ad date", "date day", "reporting starts", "date start", "inizio report", "data report", "inizio del report", "inicio del informe"],
    "ad_id": ["ad id", "id annuncio", "id inserzione", "ad name", "nome inserzione", "nome dell inserzione", "annuncio", "inserzione", "ad",
              "nombre del anuncio", "identificador del anuncio", "anuncio", "nom de la publicite", "anzeigenname"],
    "adset_id": ["ad set id", "adset id", "ad set name", "adset name", "nome del gruppo di inserzioni", "gruppo di inserzioni", "ad set", "adset",
                 "nombre del conjunto de anuncios", "conjunto de anuncios", "nom de l ensemble de publicites", "name der anzeigengruppe"],
    "campaign_id": ["campaign id", "campaign name", "nome della campagna", "campagna", "campaign", "nombre de la campana", "campana", "nom de la campagne", "kampagnenname"],
    "inserzionista_id": ["inserzionista", "advertiser", "account name", "nome account", "account"],
    "vertical": ["settore", "industry", "categoria", "verticale"],
    "asset_id": ["asset id", "creative id", "id creativita", "creativita", "creative"],
    "leva": ["angle", "hook type", "leva creativa", "messaggio"],
    "formato": ["format", "creative type", "tipo di creativita", "media type"],
    "spesa": ["spend", "amount spent", "amount spent (eur)", "amount spent (usd)", "importo speso", "importo speso (eur)", "cost", "costo",
              "importe gastado", "gasto", "montant depense", "ausgegebener betrag"],
    "impression": ["impressions", "impr", "impr.", "impresiones", "impressionen"],
    "click": ["clicks", "link clicks", "clic sul link", "click sul link", "clic", "inline link clicks",
              "clics en el enlace", "clics sur un lien", "link klicks", "clics", "klicks"],
    "copertura": ["reach", "alcance", "couverture", "reichweite"],
    "budget_giornaliero_adset": ["daily budget", "budget giornaliero", "ad set budget", "budget del gruppo di inserzioni", "budget"],
    "budget_giornaliero_eur": ["budget giornaliero", "daily budget", "budget", "budget giornaliero adset"],
    "budget_giornaliero_iniziale": ["budget iniziale", "initial budget", "budget giornaliero", "daily budget", "budget"],
    "data_lancio": ["launch date", "start date", "data inizio", "data di lancio", "inizio"],
    "data_fine": ["end date", "data di fine", "fine"],
    "descrizione_visual": ["visual description", "descrizione", "description", "descrizione visual", "visual"],
    "headline": ["titolo", "title"],
    "evento": ["event", "festivita", "holiday"],
    "settimana_dal": ["week", "settimana", "week start", "settimana dal"],
    "indice_cpm": ["cpm index", "indice cpm"],
    "indice_ctr": ["ctr index", "indice ctr"],
    "nome": ["name"],
}
RUOLI = [  # (parola nel nome del file, ruolo). L'ordine conta.
    ("cpm_storici", "mercato_mensile"), ("prevedere", "futuro"), ("futur", "futuro"), ("budget", "budget"),
    ("inserzionisti", "inserzionisti"), ("advertiser", "inserzionisti"), ("annunci", "annunci"),
    ("adset", "adset"), ("ad_set", "adset"), ("calendar", "calendario"), ("benchmark", "indice"), ("indice", "indice"),
    ("asset", "creativita"), ("creativ", "creativita"), ("campagne", "campagne"), ("campaign", "campagne"),
    ("storico", "storico"), ("history", "storico"), ("insight", "storico"), ("report", "storico"),
]
COLONNE_FUTURO = ["data", "vertical", "campaign_id", "adset_id", "ad_id", "asset_id", "leva", "formato", "budget_giornaliero_adset"]


class DatiNonValidi(ValueError):
    """Lo storico non ha il minimo indispensabile. Il messaggio dice cosa manca."""


def _chiave(s):
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", s.lower().replace("_", " ").replace("'", " ")).strip()


def rinomina(df, campi):
    """Porta le colonne ai nomi che usa il motore. Un nome gia giusto non viene toccato."""
    df = df.copy()
    df.columns = [str(c).replace("\ufeff", "").strip().strip('"') for c in df.columns]
    presenti = {_chiave(c): c for c in df.columns}
    # secondo tentativo senza la parentesi finale: "Importe gastado (CLP)" vale come "importe gastado"
    senza_parentesi = {}
    for c in df.columns:
        senza_parentesi.setdefault(re.sub(r"\s*\([^)]*\)\s*$", "", _chiave(c)), c)
    usate = set()
    for campo in campi:
        if campo in df.columns:
            usate.add(campo)
            continue
        for mappa in (presenti, senza_parentesi):
            for alias in [campo] + ALIAS.get(campo, []):
                orig = mappa.get(_chiave(alias))
                if orig is not None and orig in df.columns and orig not in usate and orig not in campi:
                    df = df.rename(columns={orig: campo})
                    usate.add(campo)
                    break
            if campo in usate:
                break
    return df


def _numero(s):
    if s.dtype != object:
        return pd.to_numeric(s, errors="coerce")
    t = s.astype(str).str.replace(r"[^\d,.\-]", "", regex=True)
    virgola = t.str.contains(",", regex=False)
    t = t.where(~virgola, t.str.replace(".", "", regex=False).str.replace(",", ".", regex=False))
    return pd.to_numeric(t, errors="coerce")


def _data(s):
    if np.issubdtype(s.dtype, np.datetime64):
        return s
    t = s.astype(str).str.strip()
    out = pd.to_datetime(t, format="%Y-%m-%d", errors="coerce")
    if out.isna().mean() > 0.2:
        out = pd.to_datetime(t, dayfirst=True, errors="coerce")
    return out


def leggi(sorgente):
    """Legge un CSV da percorso o da testo, qualunque sia il separatore."""
    if isinstance(sorgente, pd.DataFrame):
        return sorgente.copy()
    testo = sorgente if isinstance(sorgente, str) and "\n" in sorgente else Path(sorgente).read_text(encoding="utf-8-sig")
    testo = testo.lstrip("﻿")
    prima = testo.split("\n", 1)[0]
    sep = max([",", ";", "\t", "|"], key=prima.count)
    return pd.read_csv(io.StringIO(testo), sep=sep)


def ruolo(nome):
    n = _chiave(Path(str(nome)).stem).replace(" ", "_")
    for parola, r in RUOLI:
        if parola in n:
            return r
    return None


def tabelle_da_cartella(cartella):
    """Tutti i CSV di una cartella (anche nelle sottocartelle), come {nome file: tabella}."""
    return {str(f.relative_to(cartella)): leggi(f) for f in sorted(Path(cartella).rglob("*.csv"))}


def _mercato_mensile(mm, hist, fine, verticali, cfg):
    """Senza indice settimanale: costruisce la stagione del CPM dal CPM mensile di mercato
    (piattaforma, paese, obiettivo). I mesi futuri usano lo stesso mese dell'anno prima,
    corretto per la crescita da un anno all'altro."""
    mm = rinomina(mm, ["piattaforma", "paese", "mese", "obiettivo", "cpm_mediano"])
    if not {"mese", "cpm_mediano"} <= set(mm.columns):
        return None
    for col, val in (("piattaforma", cfg.get("piattaforma", "meta")), ("paese", cfg.get("paese", "IT")), ("obiettivo", cfg.get("obiettivo", "vendite"))):
        if col in mm and (mm[col].astype(str).str.lower() == str(val).lower()).any():
            mm = mm[mm[col].astype(str).str.lower() == str(val).lower()]
    s = mm.groupby(mm.mese.astype(str).str[:7]).cpm_mediano.mean()
    if len(s) < 6:
        return None
    anno = lambda m, k: "%04d-%s" % (int(m[:4]) + k, m[5:7])
    rapporti = [s[m] / s[anno(m, -1)] for m in s.index[-6:] if anno(m, -1) in s.index]
    crescita = float(np.median(rapporti)) if rapporti else 1.0
    valore = lambda m: s[m] if m in s.index else (s[anno(m, -1)] * crescita if anno(m, -1) in s.index else np.nan)
    inizio = hist.data.min() - pd.Timedelta(days=int(hist.data.min().dayofweek))
    settimane = pd.date_range(inizio, fine, freq="7D")
    # il valore di un mese vale a meta mese; in mezzo si passa dall'uno all'altro in modo graduale
    mesi = pd.period_range((inizio - pd.Timedelta(days=31)).strftime("%Y-%m"), (fine + pd.Timedelta(days=31)).strftime("%Y-%m"), freq="M")
    punti = pd.Series({m.start_time + pd.Timedelta(days=14): valore(str(m)) for m in mesi}, dtype=float).dropna()
    if len(punti) < 2:
        return None
    giorni = settimane + pd.Timedelta(days=3)
    v = np.exp(np.interp(giorni.astype("int64"), punti.index.astype("int64"), np.log(punti.values)))
    rif = np.exp(np.mean(np.log(v[settimane <= hist.data.max()]))) if (settimane <= hist.data.max()).any() else v.mean()
    righe = [{"settimana_dal": w, "vertical": ve, "indice_cpm": 100.0 * x / rif, "indice_ctr": 100.0}
             for w, x in zip(settimane, v) for ve in verticali]
    return pd.DataFrame(righe)


def _lancio_ignoto(primo, primo_giorno, note):
    """Un annuncio gia attivo il primo giorno dello storico e partito prima, non si sa quando: la sua fatica
    si considera gia assestata (eta di un anno), cosi non viene scambiata per un calo appena iniziato."""
    primo = primo.copy()
    vecchi = primo.data_lancio <= primo_giorno
    if vecchi.any():
        primo.loc[vecchi, "data_lancio"] = primo_giorno - pd.Timedelta(days=365)
        note.append("%d annunci erano gia attivi il primo giorno dello storico: data di lancio ignota, fatica considerata gia assestata." % int(vecchi.sum()))
    return primo


def costruisci(tabelle, orizzonte=14, cfg=None):
    """Da un insieme di tabelle {nome: DataFrame o testo CSV} al dizionario che usa il motore."""
    cfg = dict(cfg or {})
    note, per_ruolo = [], {}
    tab = {k: leggi(v) for k, v in tabelle.items()}
    for nome, df in tab.items():
        r = ruolo(nome)
        if r is None and len(tab) == 1:
            r = "storico"
        if r is not None:
            per_ruolo.setdefault(r, []).append(df)
    if "storico" not in per_ruolo:   # nessun nome riconosciuto: lo storico e la tabella piu lunga con le colonne giuste
        candidati = [d for d in tab.values() if {"data", "spesa", "impression"} <= set(rinomina(d, ["data", "spesa", "impression"]).columns)]
        if not candidati:
            raise DatiNonValidi("Non trovo lo storico giornaliero. Serve una tabella con: data, annuncio, spesa, impression, click.")
        per_ruolo["storico"] = [max(candidati, key=len)]
    una = lambda r: pd.concat(per_ruolo[r], ignore_index=True) if r in per_ruolo else None

    # ---- storico
    campi = ["data", "ad_id", "adset_id", "campaign_id", "inserzionista_id", "vertical", "asset_id", "leva", "formato",
             "spesa", "impression", "click", "copertura", "budget_giornaliero_adset"]
    h = rinomina(una("storico"), campi)
    manca = [c for c in ["data", "ad_id", "spesa", "impression", "click"] if c not in h.columns]
    if manca:
        raise DatiNonValidi("Nello storico mancano le colonne: " + ", ".join(manca) + ".")
    h["data"] = _data(h["data"])
    for c in ["spesa", "impression", "click", "copertura", "budget_giornaliero_adset"]:
        if c in h:
            h[c] = _numero(h[c])
    n0 = len(h)
    h = h[h.data.notna() & (h.impression > 0) & (h.spesa > 0)].copy()
    h["click"] = h.click.fillna(0)
    if len(h) < n0:
        note.append("%d righe scartate: data illeggibile oppure spesa o impression a zero." % (n0 - len(h)))
    if len(h) < 30:
        raise DatiNonValidi("Lo storico ha solo %d righe utili: ne servono almeno 30." % len(h))
    h["ad_id"] = h.ad_id.astype(str)
    # una riga per annuncio e giorno: prima si sommano le righe divise (per zona, eta, posizionamento),
    # poi lo stesso annuncio usato in piu ad set o campagne diventa un annuncio per ciascuno, con la creativita in comune
    if h.duplicated(["data", "ad_id"]).any():
        gruppi = [c for c in ["campaign_id", "adset_id"] if c in h]
        for c in gruppi:
            h[c] = h[c].astype(str)
        chiavi = ["data", "ad_id"] + gruppi
        if h.duplicated(chiavi).any():
            come = {c: "sum" for c in ["spesa", "impression", "click", "copertura"] if c in h}
            come.update({c: "first" for c in ["inserzionista_id", "vertical", "asset_id", "leva", "formato", "budget_giornaliero_adset"] if c in h})
            n1 = len(h)
            h = h.groupby(chiavi, as_index=False).agg(come)
            note.append("%d righe dello stesso annuncio e giorno (es. divise per zona o eta) sommate in %d." % (n1, len(h)))
        if h.duplicated(["data", "ad_id"]).any():
            for combo in ([["adset_id"]] if "adset_id" in h else []) + [gruppi]:
                if combo and not h.duplicated(["data", "ad_id"] + combo).any():
                    if "asset_id" not in h:
                        h["asset_id"] = h.ad_id   # stessa creativita usata in piu ad set
                    h["ad_id"] = h[combo].agg(" | ".join, axis=1) + " | " + h.ad_id
                    note.append("Lo stesso annuncio compare in piu ad set: ogni coppia ad set e annuncio e trattata come un annuncio, con la creativita in comune.")
                    break
    if "inserzionista_id" not in h:
        h["inserzionista_id"] = "account"
    if "campaign_id" not in h:
        h["campaign_id"] = h.inserzionista_id
        note.append("Campagna non indicata: tutto lo storico e trattato come una campagna.")
    if "adset_id" not in h:
        h["adset_id"] = h.campaign_id
        note.append("Ad set non indicato: un ad set per campagna.")
    if "vertical" not in h:
        h["vertical"] = h.campaign_id
    for c in ["inserzionista_id", "campaign_id", "adset_id", "vertical"]:
        h[c] = h[c].astype(str)
    if "campaign_name" not in h:
        h["campaign_name"] = h.campaign_id
    if "asset_id" not in h:
        h["asset_id"] = h.ad_id
    senza_leva, senza_formato = "leva" not in h, "formato" not in h
    copertura_nota = "copertura" in h and h.copertura.notna().any()
    if not copertura_nota:
        h["copertura"] = h.impression
        note.append("Copertura non presente: la grandezza del pubblico non si puo stimare.")
    budget_noto = "budget_giornaliero_adset" in h and h.budget_giornaliero_adset.notna().any()

    # ---- creativita
    a = una("creativita")
    if a is not None:
        a = rinomina(a, ["asset_id", "vertical", "leva", "formato", "descrizione_visual", "headline", "data_lancio", "data_fine"])
        if "asset_id" not in a:
            a = None
    if a is not None:
        a["asset_id"] = a.asset_id.astype(str)
        for c, v in (("leva", "generica"), ("formato", "non indicato")):
            if c not in a:
                a[c] = v
        for c in ["leva", "formato"]:
            if c not in h:   # leva e formato arrivano dalla tabella delle creativita
                h = h.merge(a[["asset_id", c]].drop_duplicates("asset_id"), on="asset_id", how="left")
    for c, v in (("leva", "generica"), ("formato", "non indicato")):
        if c not in h:
            h[c] = v
        h[c] = h[c].fillna(v).astype(str)
    if senza_leva and (a is None):
        note.append("Leva creativa non indicata: una sola curva di fatica per tutti gli annunci.")
    assets_h = h.groupby("asset_id").agg(vertical=("vertical", "first"), leva=("leva", "first"), formato=("formato", "first")).reset_index()
    if a is None:
        a = assets_h.assign(descrizione_visual="", headline=assets_h.asset_id)
        note.append("Descrizione delle creativita non presente: un annuncio nuovo viene stimato solo da leva e formato.")
    else:
        if "vertical" not in a:
            a = a.merge(assets_h[["asset_id", "vertical"]], on="asset_id", how="left")
        mancanti = assets_h[~assets_h.asset_id.isin(a.asset_id)]
        a = pd.concat([a, mancanti], ignore_index=True)
        for c in ["descrizione_visual", "headline"]:
            if c not in a:
                a[c] = ""
        a["headline"] = a.headline.fillna("").astype(str).where(a.headline.fillna("").astype(str) != "", a.asset_id)
    a = a.drop_duplicates("asset_id").reset_index(drop=True)

    # ---- KPI derivati
    calcolati = {"ctr": 100.0 * h.click / h.impression, "cpm": 1000.0 * h.spesa / h.impression,
                 "cpc": (h.spesa / h.click).where(h.click > 0), "frequenza": h.impression / h.copertura.where(h.copertura > 0)}
    for c, v in calcolati.items():   # se il file li porta gia li tengo, altrimenti li calcolo
        h[c] = _numero(h[c]).fillna(v) if c in h else v

    # ---- annunci (date di lancio)
    primo = h.groupby("ad_id").agg(adset_id=("adset_id", "first"), asset_id=("asset_id", "first"), campaign_id=("campaign_id", "first"),
                                   data_lancio=("data", "min"), ultimo=("data", "max")).reset_index()
    ann = una("annunci")
    if ann is not None:
        ann = rinomina(ann, ["ad_id", "campaign_id", "adset_id", "asset_id", "data_lancio", "data_fine"])
    if ann is not None and {"ad_id", "data_lancio"} <= set(ann.columns):
        ann["ad_id"] = ann.ad_id.astype(str)
        ann["data_lancio"] = _data(ann["data_lancio"])
        ann["data_fine"] = _data(ann["data_fine"]) if "data_fine" in ann else pd.NaT
        for c in ["adset_id", "asset_id", "campaign_id"]:
            if c not in ann:
                ann = ann.merge(primo[["ad_id", c]], on="ad_id", how="left")
            ann[c] = ann[c].astype(str)
        fuori = _lancio_ignoto(primo[~primo.ad_id.isin(ann.ad_id)], h.data.min(), note)
        ann = pd.concat([ann, fuori.assign(data_fine=pd.NaT)[["ad_id", "campaign_id", "adset_id", "asset_id", "data_lancio", "data_fine"]]], ignore_index=True)
    else:
        primo = _lancio_ignoto(primo, h.data.min(), note)
        ann = primo.assign(data_fine=pd.NaT)[["ad_id", "campaign_id", "adset_id", "asset_id", "data_lancio", "data_fine"]]
        note.append("Date di lancio non presenti: per ogni annuncio vale il primo giorno in cui compare nello storico.")
    if "ad_name" not in ann:
        ann["ad_name"] = ann.ad_id

    # ---- budget
    ultimo_giorno = h.data.max()
    b = una("budget")
    if b is not None:
        b = rinomina(b, ["data", "adset_id", "budget_giornaliero_eur"])
        if {"data", "adset_id", "budget_giornaliero_eur"} <= set(b.columns):
            b["data"], b["adset_id"], b["budget_giornaliero_eur"] = _data(b["data"]), b.adset_id.astype(str), _numero(b["budget_giornaliero_eur"])
            b = b.dropna(subset=["data", "budget_giornaliero_eur"])
        else:
            b = None
    if not budget_noto and b is not None:
        h = h.merge(b.rename(columns={"budget_giornaliero_eur": "budget_giornaliero_adset"})[["data", "adset_id", "budget_giornaliero_adset"]], on=["data", "adset_id"], how="left")
        budget_noto = h.budget_giornaliero_adset.notna().mean() > 0.9
    if not budget_noto:
        h["budget_giornaliero_adset"] = h.groupby(["adset_id", "data"]).spesa.transform("sum")
        b = None
        note.append("Budget non presente: per i giorni futuri vale la spesa media degli ultimi 7 giorni, e l'effetto di un cambio di budget arriva dai valori di base.")
    else:
        h["budget_giornaliero_adset"] = h.groupby("adset_id").budget_giornaliero_adset.transform(lambda s: s.ffill().bfill())

    # ---- righe da prevedere
    f = una("futuro")
    if f is not None:
        f = rinomina(f, COLONNE_FUTURO)
        if not {"data", "ad_id"} <= set(f.columns):
            f = None
    info_ad = ann[["ad_id", "adset_id", "asset_id", "campaign_id"]].drop_duplicates("ad_id")
    info_as = h.groupby("adset_id").agg(vertical=("vertical", "first"), campaign_id=("campaign_id", "first")).reset_index()
    if f is not None:
        f["data"], f["ad_id"] = _data(f["data"]), f.ad_id.astype(str)
        for c in ["adset_id", "asset_id"]:
            if c not in f:
                f = f.merge(info_ad[["ad_id", c]], on="ad_id", how="left")
            f[c] = f[c].astype(str)
        for c in ["vertical", "campaign_id"]:
            if c not in f:
                f = f.merge(info_as[["adset_id", c]], on="adset_id", how="left")
        for c in ["leva", "formato"]:
            if c not in f:
                f = f.merge(a[["asset_id", c]], on="asset_id", how="left")
        if "budget_giornaliero_adset" in f:
            f["budget_giornaliero_adset"] = _numero(f["budget_giornaliero_adset"])
    else:
        attivi = primo[primo.ultimo >= ultimo_giorno - pd.Timedelta(days=2)].ad_id
        if not len(attivi):
            raise DatiNonValidi("Nessun annuncio attivo negli ultimi 3 giorni dello storico: non so cosa prevedere.")
        giorni = pd.date_range(ultimo_giorno + pd.Timedelta(days=1), periods=int(orizzonte), freq="D")
        f = pd.MultiIndex.from_product([giorni, attivi], names=["data", "ad_id"]).to_frame(index=False)
        f = f.merge(info_ad, on="ad_id", how="left").merge(info_as[["adset_id", "vertical"]], on="adset_id", how="left")
        f = f.merge(a[["asset_id", "leva", "formato"]], on="asset_id", how="left")
        note.append("Righe da prevedere non indicate: prevedo i %d annunci attivi per i prossimi %d giorni." % (len(attivi), orizzonte))
    if "budget_giornaliero_adset" not in f or f.budget_giornaliero_adset.isna().any():
        if b is not None:
            fb = b.rename(columns={"budget_giornaliero_eur": "_b"})[["data", "adset_id", "_b"]]
            f = f.merge(fb, on=["data", "adset_id"], how="left")
        else:
            f["_b"] = np.nan
        if budget_noto:
            ult = h.sort_values("data").groupby("adset_id").budget_giornaliero_adset.last()
        else:
            rec = h[h.data > ultimo_giorno - pd.Timedelta(days=7)]
            ult = rec.groupby(["adset_id", "data"]).spesa.sum().groupby(level=0).mean()
        f["_b"] = f["_b"].fillna(f.adset_id.map(ult))
        f["budget_giornaliero_adset"] = f["budget_giornaliero_adset"].fillna(f["_b"]) if "budget_giornaliero_adset" in f else f["_b"]
        f = f.drop(columns=["_b"])
    for c, v in (("leva", "generica"), ("formato", "non indicato")):
        f[c] = f[c].fillna(v).astype(str)
    f = f.dropna(subset=["data", "budget_giornaliero_adset", "adset_id"]).reset_index(drop=True)
    f["vertical"] = f.vertical.fillna(f.campaign_id).astype(str)

    # ---- tabella del budget per giorno (storico + futuro) e ad set
    bud_h = h.groupby(["data", "adset_id"]).budget_giornaliero_adset.first().reset_index()
    bud_f = f.groupby(["data", "adset_id"]).budget_giornaliero_adset.first().reset_index()
    bud = pd.concat([bud_h, bud_f], ignore_index=True).rename(columns={"budget_giornaliero_adset": "budget_giornaliero_eur"})
    if b is not None:
        bud = pd.concat([b[["data", "adset_id", "budget_giornaliero_eur"]], bud], ignore_index=True)
    bud = bud.drop_duplicates(["data", "adset_id"]).sort_values(["adset_id", "data"]).reset_index(drop=True)
    ads = una("adset")
    if ads is not None:
        ads = rinomina(ads, ["adset_id", "campaign_id", "budget_giornaliero_iniziale"])
    if ads is None or not {"adset_id", "budget_giornaliero_iniziale"} <= set(ads.columns):
        ads = bud.groupby("adset_id").budget_giornaliero_eur.first().rename("budget_giornaliero_iniziale").reset_index()
    ads["adset_id"] = ads.adset_id.astype(str)
    ads["budget_giornaliero_iniziale"] = _numero(ads["budget_giornaliero_iniziale"])
    nuovi = bud[~bud.adset_id.isin(ads.adset_id)].groupby("adset_id").budget_giornaliero_eur.first().rename("budget_giornaliero_iniziale").reset_index()
    ads = pd.concat([ads, nuovi], ignore_index=True)

    # ---- calendario e stagione
    cal = una("calendario")
    if cal is not None:
        cal = rinomina(cal, ["data", "evento"])
        if {"data", "evento"} <= set(cal.columns):
            cal["data"] = _data(cal["data"])
            cal = cal.dropna(subset=["data"])
        else:
            cal = None
    verticali = sorted(set(h.vertical) | set(f.vertical))
    bm, sposta = una("indice"), 0
    if bm is not None:
        bm = rinomina(bm, ["settimana_dal", "vertical", "indice_cpm", "indice_ctr"])
        if {"settimana_dal", "indice_cpm"} <= set(bm.columns):
            bm["settimana_dal"] = _data(bm["settimana_dal"])
            bm["indice_cpm"] = _numero(bm["indice_cpm"])
            bm["indice_ctr"] = _numero(bm["indice_ctr"]) if "indice_ctr" in bm else 100.0
            if "vertical" in bm:
                bm["vertical"] = bm.vertical.astype(str)
                if not set(bm.vertical) & set(verticali):   # settori con altri nomi: vale la media per tutti
                    bm = bm.groupby("settimana_dal")[["indice_cpm", "indice_ctr"]].mean().reset_index()
            if "vertical" not in bm:
                bm = pd.concat([bm.assign(vertical=v) for v in verticali], ignore_index=True)
            # l'indice puo essere dell'anno prima: lo sposto di 52 settimane finche copre i giorni da prevedere
            sposta = 364 * max(0, int(np.ceil((f.data.max() - (bm.settimana_dal.max() + pd.Timedelta(days=6))).days / 364.0)))
        else:
            bm = None
    stagione = "indice settimanale" if bm is not None else None
    if bm is None and "mercato_mensile" in per_ruolo:
        bm = _mercato_mensile(una("mercato_mensile"), h, f.data.max(), verticali, cfg)
        if bm is not None:
            stagione = "CPM mensile di mercato"
            note.append("Indice settimanale non presente: la stagione del CPM viene dal CPM mensile di mercato; quella del CTR resta piatta.")
    if bm is None:
        note.append("Nessun dato di mercato: stagione piatta, forchetta piu larga.")

    ins = una("inserzionisti")
    if ins is not None:
        ins = rinomina(ins, ["inserzionista_id", "nome", "vertical", "descrizione"])
    return {
        "hist": h.sort_values(["data", "adset_id", "ad_id"]).reset_index(drop=True), "fut": f, "ann": ann, "adset": ads, "bud": bud,
        "cal": cal, "bm": bm, "assets": a, "ins": ins, "cfg": cfg, "note": note,
        "budget_noto": bool(budget_noto), "copertura_nota": bool(copertura_nota), "stagione_nota": bm is not None,
        "stagione": stagione, "sposta_indice": sposta, "file_letti": sorted(tab.keys()), "orizzonte": int(f.data.nunique()),
    }


def carica(cartella, orizzonte=14, cfg=None):
    """Da una cartella di CSV al dizionario che usa il motore."""
    tab = tabelle_da_cartella(cartella)
    if not tab:
        raise DatiNonValidi("Nella cartella %s non ci sono file CSV." % cartella)
    return costruisci(tab, orizzonte=orizzonte, cfg=cfg)


def sottoinsieme(R, colonna, valori):
    """Lo stesso insieme di dati, limitato ad alcuni inserzionisti (o settori, o campagne)."""
    valori = set(valori)
    S = dict(R)
    S["hist"] = R["hist"][R["hist"][colonna].isin(valori)].reset_index(drop=True)
    adset = set(S["hist"].adset_id)
    S["fut"] = R["fut"][R["fut"].adset_id.isin(adset)].reset_index(drop=True)
    S["ann"] = R["ann"][R["ann"].adset_id.isin(adset)].reset_index(drop=True)
    S["adset"] = R["adset"][R["adset"].adset_id.isin(adset)].reset_index(drop=True)
    S["bud"] = R["bud"][R["bud"].adset_id.isin(adset)].reset_index(drop=True)
    assets = set(S["ann"].asset_id) | set(S["hist"].asset_id) | set(S["fut"].asset_id)
    S["assets"] = R["assets"][R["assets"].asset_id.isin(assets)].reset_index(drop=True)
    return S
