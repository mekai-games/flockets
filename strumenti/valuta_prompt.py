"""Confronta la lettura del prompt con i valori attesi (strumenti/banco_prompt.json), dopo il motore.

Legge l'uscita di strumenti/valuta_prompt.mjs, passa ogni campagna al motore (analizza_campagna, come il sito) e
controlla campo per campo quello che il motore usa davvero: categoria, canale, budget al giorno, giorni, prezzo,
sconto, risultato, obiettivo, marchio, zona, nicchia, pubblico. Poi controlla che i numeri siano credibili.

Uso: python3 strumenti/valuta_prompt.py /tmp/banco_risultati.json [spec|regole] [--dettagli]
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from flockets import simulazione as s  # noqa: E402

CAMPI = ["categoria", "canale", "budget_giorno", "giorni", "prezzo", "sconto", "conversione", "obiettivo", "marchio", "zona", "nicchia",
         "filtri"]


def uguale(campo, atteso, letto):
    if campo in ("budget_giorno", "prezzo"):
        return letto is not None and abs(float(letto) - atteso) <= max(0.03 * atteso, 0.5)
    if campo == "sconto":
        return abs(float(letto or 0) - atteso) < 0.006
    if campo in ("zona", "nicchia"):
        return bool(letto) == atteso
    return letto == atteso


def letto_dal_motore(c, campo):
    if campo in ("zona", "nicchia"):
        return bool(c.get(campo))
    return c.get(campo)


def main():
    prove = json.load(open(sys.argv[1]))
    chiave = sys.argv[2] if len(sys.argv) > 2 and not sys.argv[2].startswith("--") else "spec"
    dettagli = "--dettagli" in sys.argv
    giusti, totali, errori, strani = {}, {}, [], []
    for p in prove:
        spec = dict(p[chiave])
        spec["inizio"] = spec.get("inizio") or "2026-11-16"
        try:
            r = s.analizza_campagna(spec, consigli=False)
        except Exception as e:   # noqa: BLE001
            errori.append((p["id"], "MOTORE", repr(e)[:120], ""))
            continue
        c = r["campagna"]
        for campo, atteso in p["atteso"].items():
            if campo == "gratis":
                continue
            if campo == "filtri":
                for k, v in atteso.items():
                    nome = "filtri." + k
                    letto = sorted((c.get("filtri") or {}).get(k) or [])
                    ok = letto == sorted(v)
                    totali[nome] = totali.get(nome, 0) + 1
                    giusti[nome] = giusti.get(nome, 0) + ok
                    if not ok:
                        errori.append((p["id"], nome, v, letto))
                continue
            letto = letto_dal_motore(c, campo)
            ok = uguale(campo, atteso, letto)
            totali[campo] = totali.get(campo, 0) + 1
            giusti[campo] = giusti.get(campo, 0) + ok
            if not ok:
                errori.append((p["id"], campo, atteso, letto))
        # numeri credibili: il migliore pubblico, CTR, CPM, costo per risultato rispetto al prezzo
        b = next(x for x in r["pubblici"] if x["tipo"] == r["migliore"])
        T = b["totali"]
        cpa = T["spesa"] / max(T["acquisti"], 1e-9)
        if T["ctr"] > 6 or T["ctr"] < 0.05 or T["cpm"] > 80 or T["cpm"] < 0.5:
            strani.append((p["id"], "CTR %.2f%% CPM %.2f€" % (T["ctr"], T["cpm"])))
        if c["conversione"] == "acquisto" and c.get("prezzo") and T["acquisti"] > 0 and cpa > 6 * c["prezzo"]:
            strani.append((p["id"], "costo per acquisto %.0f€ con prezzo %.0f€" % (cpa, c["prezzo"])))
        if dettagli:
            print("%-22s %-10s %-16s %6.0f€/g %3dg p%-6s sc%-4s %-10s %-9s %-10s ctr %.2f cpm %.1f risultati %.0f  filtri %s" % (
                p["id"], c["canale"], c["categoria"], c["budget_giorno"], c["giorni"], c.get("prezzo"), round(100 * c["sconto"]),
                c["conversione"], c["obiettivo"], c["marchio"], T["ctr"], T["cpm"], T["acquisti"],
                {k: v for k, v in (c.get("filtri") or {}).items() if v}))
    print("\n=== %s: campi giusti ===" % chiave)
    tot_g = tot_t = 0
    for campo in CAMPI + sorted(k for k in totali if k.startswith("filtri.")):
        if campo in totali:
            print("  %-18s %2d/%-2d" % (campo, giusti[campo], totali[campo]))
            tot_g += giusti[campo]
            tot_t += totali[campo]
    print("  %-18s %d/%d (%.0f%%)" % ("TOTALE", tot_g, tot_t, 100 * tot_g / max(tot_t, 1)))
    print("\n=== errori ===")
    for e in errori:
        print("  %-22s %-16s atteso %-28s letto %s" % (e[0], e[1], json.dumps(e[2], ensure_ascii=False), json.dumps(e[3], ensure_ascii=False)))
    if strani:
        print("\n=== numeri poco credibili ===")
        for x in strani:
            print("  %-22s %s" % x)


if __name__ == "__main__":
    main()
