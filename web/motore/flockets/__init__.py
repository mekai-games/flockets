"""Flockets: prevede CTR e CPM di una campagna a partire dal suo storico.

    import flockets
    esito = flockets.analizza("cartella/con/i/csv")       # oppure un dizionario {nome: tabella}
    esito["previsioni"]                                   # una riga per annuncio e giorno

Basta lo storico giornaliero per annuncio (data, annuncio, spesa, impression, click).
Tutto il resto e facoltativo: vedi `contratto.py`.
"""
import json
from pathlib import Path

from . import motore, persone, rapporto, simulazione
from .contratto import DatiNonValidi, carica, costruisci, sottoinsieme
from .motore import Forecaster

__all__ = ["analizza", "analisi_json", "campagna_json", "carica", "costruisci", "Forecaster", "DatiNonValidi", "valori_base",
           "persone", "simulazione"]
_BASE = Path(__file__).with_name("valori_base.json")


def valori_base():
    """I fattori comuni di partenza (fatica, giorno della settimana, effetto del budget, peso delle
    caratteristiche creative). Sono stati stimati sul kit della sfida, che e fatto di dati simulati."""
    return json.loads(_BASE.read_text()) if _BASE.exists() else None


def serve_base(R):
    """Lo storico basta a stimare da solo i fattori comuni? Se no, servono i valori di base."""
    h, cfg, perche = R["hist"], motore.cfg_di(R), []
    if h.data.nunique() < 21:
        perche.append("meno di 21 giorni di storico")
    if not R.get("budget_noto", True) or h.groupby("adset_id").budget_giornaliero_adset.nunique().max() < 2:
        perche.append("nessun cambio di budget nello storico")
    if h.asset_id.nunique() < 8:
        perche.append("meno di 8 creativita")
    if "descrizione_visual" not in R["assets"] or not R["assets"].descrizione_visual.fillna("").astype(str).str.strip().any():
        perche.append("creativita senza descrizione")
    if h.groupby(["leva", "ad_id"]).size().max() < cfg["giorni_min_fatica"]:
        perche.append("nessun annuncio attivo da almeno %d giorni" % cfg["giorni_min_fatica"])
    return perche


def analizza(sorgente, orizzonte=14, simulazioni=2000, prove=True, cfg=None, origine="caricato", file_previsioni="previsioni.csv"):
    """Legge i dati, stima, prevede. Restituisce previsioni, pubblici, scenario di budget, prove e dati per il sito."""
    R = sorgente if isinstance(sorgente, dict) and "hist" in sorgente else (
        costruisci(sorgente, orizzonte, cfg) if isinstance(sorgente, dict) else carica(sorgente, orizzonte, cfg))
    perche = serve_base(R)
    base = valori_base() if perche else None
    if base is not None:
        R["note"].append("Valori di base usati perche: " + "; ".join(perche) + ". Vengono dal kit della sfida (dati simulati).")
    fc = Forecaster(R, base=base).fit(R["hist"])
    pred = fc.predict(R["fut"], n_sim=simulazioni)
    if fc.rho["ctr"] or fc.rho["cpm"] or fc.salti:
        R["note"].append("Lo storico cambia livello nel tempo: la previsione parte dal livello dell'ultima settimana "
                         "(peso %.2f sul CTR, %.2f sul CPM%s). Lo ha deciso una prova interna su giorni nascosti."
                         % (fc.rho["ctr"], fc.rho["cpm"], "; %d salti netti seguiti per intero" % fc.salti if fc.salti else ""))
    P = rapporto.pubblici(fc, R)
    S = rapporto.scenario_budget(fc, pred)
    V = rapporto.validazione(R, n_sim=simulazioni) if prove else None
    G = rapporto.prova_generalizzazione(R) if prove else None
    # persone simulate dentro ogni pubblico, tarate sulle previsioni; e la prova a freddo (senza usare lo storico)
    try:
        persone_adset = simulazione.integra(R, pred, P, R.get("assets"))
        freddo, freddo_sintesi = simulazione.prova_a_freddo(R, P)
    except Exception as err:   # la parte sulle persone non deve mai fermare le previsioni
        R["note"].append("Simulazione delle persone non riuscita su questi dati: %s" % err)
        persone_adset, freddo, freddo_sintesi = {}, None, {}
    sito = rapporto.dati_sito(R, fc, pred, P, S, V, G, origine=origine, file_previsioni=file_previsioni,
                              persone_adset=persone_adset, freddo=freddo_sintesi)
    return {"dati": R, "modello": fc, "previsioni": rapporto.tabella_previsioni(pred), "pubblici": P, "scenario": S,
            "validazione": V, "generalizzazione": G, "persone_adset": persone_adset, "prova_a_freddo": freddo,
            "prova_a_freddo_sintesi": freddo_sintesi, "sito": sito}


def analisi_json(tabelle, orizzonte=14, simulazioni=600, prove=False):
    """Per il sito: riceve {nome file: testo CSV}, restituisce il JSON dell'analisi e il CSV delle previsioni."""
    try:
        e = analizza(dict(tabelle), orizzonte=orizzonte, simulazioni=simulazioni, prove=prove)
    except DatiNonValidi as err:
        return json.dumps({"errore": str(err)})
    e["sito"]["csv"] = e["previsioni"].to_csv(index=False)
    return json.dumps(e["sito"], ensure_ascii=False, separators=(",", ":"), default=float)


def campagna_json(spec_json, consigli=True):
    """Per il sito: simula una campagna nuova (anche senza alcun dato) su tutta la popolazione sintetica."""
    spec = json.loads(spec_json) if isinstance(spec_json, str) else spec_json
    return simulazione.json_campagna(spec, consigli=consigli)
