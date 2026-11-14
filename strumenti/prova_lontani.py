"""Banco di prova del simulatore su prodotti lontani dalle categorie della sfida (bellezza, animali, abbigliamento).

Ogni caso è la campagna come la passa il sito al motore dopo la lettura del testo, con gli intervalli che ci
aspettiamo nel mercato italiano (ordini di grandezza da esperienza di settore, non misure). Per ogni caso stampa
il pubblico scelto, i numeri chiave, il consiglio migliore e cosa esce dagli intervalli.

Uso: python3 strumenti/prova_lontani.py [--consigli]
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from flockets import simulazione as s  # noqa: E402

CASI = [
    {"nome": "Siero viso (riferimento)", "spec": {"categoria": "beauty", "canale": "video_brevi", "formato": "video_breve", "prezzo": 29, "sconto": 0.2,
     "marchio": "nuovo", "leve": ["sconto", "urgenza"], "budget_giorno": 50, "giorni": 14},
     "atteso": {"ctr": (0.5, 1.5), "cpm": (3, 10), "cpa": (15, 80)}},
    {"nome": "Gestionale dentisti (LinkedIn)", "spec": {"profilo": {"prezzo_tipico": 60, "frequenza": "raro", "cpc_ricerca": 3.5}, "categoria": "tecnologia", "canale": "linkedin", "formato": "immagine", "prezzo": 49,
     "conversione": "contatto", "nicchia": {"descrizione": "dentisti titolari di studio", "persone": 60000, "b2b": True}, "fisico": False,
     "budget_giorno": 40, "giorni": 30, "extra": ["prova_gratuita"]},
     "atteso": {"ctr": (0.3, 1.0), "cpm": (20, 70), "cpc": (3, 12), "cpa": (40, 300)}},
    {"nome": "Gestionale dentisti (Google)", "spec": {"profilo": {"prezzo_tipico": 60, "frequenza": "raro", "cpc_ricerca": 3.5}, "categoria": "tecnologia", "canale": "ricerca", "formato": "testo", "prezzo": 49,
     "conversione": "contatto", "nicchia": {"descrizione": "dentisti titolari di studio", "persone": 60000, "b2b": True}, "fisico": False,
     "budget_giorno": 40, "giorni": 30, "extra": ["prova_gratuita"]},
     "atteso": {"ctr": (2, 10), "cpc": (1.5, 7), "cpa": (25, 250)}},
    {"nome": "Apparecchio acustico", "spec": {"profilo": {"pubblico_tipico": {"eta": ["55-64", "65+"]}, "prezzo_tipico": 1500, "frequenza": "raro", "cpc_ricerca": 1.5}, "categoria": "salute_benessere", "canale": "social", "formato": "immagine", "prezzo": 1490,
     "conversione": "contatto", "filtri": {"eta": ["55-64", "65+"]}, "fisico": True, "budget_giorno": 60, "giorni": 21, "extra": ["prova_gratuita"]},
     "atteso": {"ctr": (0.6, 2.0), "cpm": (5, 14), "cpa": (12, 60)}},
    {"nome": "Serata techno Milano", "spec": {"profilo": {"pubblico_tipico": {"eta": ["18-24", "25-34"], "comune": ["grande_citta"]}, "prezzo_tipico": 25, "frequenza": "frequente"}, "zona": {"descrizione": "Milano e hinterland", "persone": 2800000}, "categoria": "intrattenimento", "canale": "video_brevi", "formato": "video_breve", "prezzo": 35,
     "leve": ["scarsita"], "filtri": {"eta": ["18-24", "25-34"], "area": ["nord_ovest"], "comune": ["grande_citta"]}, "fisico": False,
     "budget_giorno": 80, "giorni": 10},
     "atteso": {"ctr": (0.6, 2.5), "cpm": (3, 13), "roas": (0.5, 6)}},
    {"nome": "Corso programmazione", "spec": {"profilo": {"pubblico_tipico": {"eta": ["25-34", "35-44"], "lavoro": ["occupato", "non_occupato"]}, "prezzo_tipico": 2500, "frequenza": "raro", "cpc_ricerca": 2.5}, "categoria": "formazione_lavoro", "canale": "video", "formato": "video", "prezzo": 2400,
     "conversione": "contatto", "fisico": False, "extra": ["rate"], "budget_giorno": 100, "giorni": 30},
     "atteso": {"ctr": (0.2, 0.8), "cpm": (3, 12), "cpa": (20, 150)}},
    {"nome": "Polizza auto (Google)", "spec": {"profilo": {"prezzo_tipico": 450, "frequenza": "occasionale", "cpc_ricerca": 4.0}, "categoria": "finanza", "canale": "ricerca", "formato": "testo", "prezzo": 400,
     "conversione": "contatto", "fisico": False, "budget_giorno": 150, "giorni": 30},
     "atteso": {"ctr": (3, 12), "cpc": (1.5, 8), "cpa": (10, 120)}},
    {"nome": "Bici elettrica (Shopping)", "spec": {"profilo": {"pubblico_tipico": {"eta": ["35-44", "45-54", "55-64"], "reddito": ["medio", "alto"]}, "prezzo_tipico": 2000, "frequenza": "raro"}, "categoria": "sport_fitness", "canale": "shopping", "formato": "immagine", "prezzo": 1990,
     "fisico": True, "budget_giorno": 70, "giorni": 30},
     "atteso": {"ctr": (0.4, 1.5), "cpc": (0.3, 1.5), "roas": (1, 8)}},
    {"nome": "Sushi a domicilio Bari", "spec": {"profilo": {"pubblico_tipico": {"eta": ["18-24", "25-34", "35-44"]}, "prezzo_tipico": 25, "frequenza": "frequente"}, "zona": {"descrizione": "Bari", "persone": 270000}, "categoria": "cibo_bevande", "canale": "social", "formato": "immagine", "prezzo": 25,
     "filtri": {"area": ["sud"], "comune": ["grande_citta"]}, "fisico": True, "budget_giorno": 20, "giorni": 14, "leve": ["sconto"], "sconto": 0.15},
     "atteso": {"ctr": (0.6, 2.0), "cpm": (3, 12), "roas": (0.6, 6)}},
    {"nome": "Crociera di lusso", "spec": {"categoria": "viaggi", "canale": "social", "formato": "video", "prezzo": 4200, "fisico": False,
     "profilo": {"pubblico_tipico": {"eta": ["45-54", "55-64", "65+"], "reddito": ["alto"]}, "prezzo_tipico": 3500, "frequenza": "raro", "cpc_ricerca": 1.2},
     "conversione": "contatto", "budget_giorno": 120, "giorni": 30},
     "atteso": {"ctr": (0.4, 1.5), "cpm": (5, 15), "cpa": (25, 150)}},
    {"nome": "Gioco gratis da scaricare", "spec": {"categoria": "videogiochi", "canale": "video_brevi", "formato": "video_breve", "prezzo": 0.01, "fisico": False,
     "profilo": {"pubblico_tipico": {"eta": ["18-24", "25-34"]}, "frequenza": "frequente"}, "conversione": "download", "budget_giorno": 200, "giorni": 14},
     "atteso": {"ctr": (0.5, 2.0), "cpm": (2, 10), "cpa": (0.5, 6)}},
    {"nome": "Studio dentistico Torino", "spec": {"categoria": "salute_benessere", "canale": "social", "formato": "immagine", "prezzo": 1200, "fisico": False,
     "profilo": {"pubblico_tipico": {"eta": ["35-44", "45-54", "55-64"]}, "prezzo_tipico": 1500, "frequenza": "raro", "cpc_ricerca": 2.5},
     "zona": {"descrizione": "Torino", "persone": 750000}, "filtri": {"area": ["nord_ovest"], "comune": ["grande_citta"]}, "conversione": "contatto", "budget_giorno": 25, "giorni": 30, "extra": ["prova_gratuita"]},
     "atteso": {"ctr": (0.5, 1.8), "cpm": (4, 14), "cpa": (15, 90)}},
    {"nome": "Palestra Roma", "spec": {"categoria": "sport_fitness", "canale": "social", "formato": "video_breve", "prezzo": 45, "fisico": False,
     "profilo": {"pubblico_tipico": {"eta": ["18-24", "25-34", "35-44"]}, "prezzo_tipico": 45, "frequenza": "occasionale"},
     "zona": {"descrizione": "Roma nord", "persone": 400000}, "filtri": {"area": ["centro"], "comune": ["grande_citta"]}, "conversione": "contatto", "budget_giorno": 15, "giorni": 21, "leve": ["sconto"], "sconto": 0.3},
     "atteso": {"ctr": (0.6, 2.0), "cpm": (4, 14), "cpa": (4, 40)}},
]


def fuori(T, atteso):
    out = []
    for k, (a, b) in atteso.items():
        v = T[k]
        if not a <= v <= b:
            out.append("%s %.2f fuori da %g-%g" % (k, v, a, b))
    if T["persone_raggiunte"] > T["impressioni"] + 1:
        out.append("raggiunte > impressioni")
    return out


def main():
    consigli = "--consigli" in sys.argv
    problemi = 0
    for caso in CASI:
        spec = {"inizio": "2026-11-16", **caso["spec"]}
        try:
            r = s.analizza_campagna(spec, consigli=consigli)
        except ValueError as e:
            print("\n## %s: ERRORE %s" % (caso["nome"], e))
            problemi += 1
            continue
        print("\n## %s  →  migliore: %s" % (caso["nome"], r["migliore"]))
        print("   ipotesi: " + " | ".join(r["ipotesi"]))
        for p in r["pubblici"]:
            T = p["totali"]
            print("   %-11s ragg.bili %9.0f  ragg %8.0f imp %8.0f  CTR %5.2f%%  CPM %6.2f  CPC %5.2f  conv %5.2f%%  risult %6.1f  CPA %7.1f  ROAS %5.2f  spesa %4.0f%%" % (
                p["tipo"], p["pubblico"]["persone_raggiungibili"], T["persone_raggiunte"], T["impressioni"], T["ctr"], T["cpm"], T["cpc"],
                T["conversione"], T["acquisti"], T["cpa"], T["roas"], 100 * T["spesa"] / (spec["budget_giorno"] * spec["giorni"])))
        # gli intervalli valgono per il pubblico di base (ampio), il più confrontabile con i valori di mercato
        best = next(p for p in r["pubblici"] if p["tipo"] == r["migliore"])
        base = next(p for p in r["pubblici"] if p["tipo"] == "ampio")
        f = fuori(base["totali"], caso["atteso"]) + (["migliore: raggiunte > impressioni"] if best["totali"]["persone_raggiunte"] > best["totali"]["impressioni"] + 1 else [])
        problemi += len(f)
        print("   " + ("OK" if not f else "DA RIVEDERE: " + "; ".join(f)))
        if consigli:
            for k in r["consigli"]["classifica"][:3]:
                T = k["totali"]
                print("   consiglio x%5.2f  %-11s %-11s %-11s %-25s CTR %5.2f CPC %5.2f CPA %7.1f ROAS %5.2f %s" % (
                    k["rispetto_alla_partenza"], k["canale"], k["formato"], k["pubblico"], "+".join(k["leve"]), T["ctr"], T["cpc"], T["cpa"], T["roas"], k["nota"]))
    print("\nvalori fuori intervallo: %d" % problemi)


if __name__ == "__main__":
    main()
