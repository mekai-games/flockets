"""Simula con il motore le campagne lette da strumenti/prova_prompt.mjs e stampa il confronto con la prima (la base)."""
import json
import sys

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parents[1]))
from flockets import simulazione as s  # noqa: E402

prove = json.load(open(sys.argv[1]))
chiave = sys.argv[2] if len(sys.argv) > 2 else "spec"
righe = []
for p in prove:
    spec = dict(p[chiave])
    spec["inizio"] = spec.get("inizio") or "2026-11-16"
    r = s.analizza_campagna(spec, consigli=False)
    b = next(x for x in r["pubblici"] if x["tipo"] == r["migliore"])
    T = b["totali"]
    c = r["campagna"]
    righe.append({"nome": p["nome"], "best": r["migliore"], "ragg": T["persone_raggiunte"], "clk": T["click"], "ctr": T["ctr"], "cpm": T["cpm"],
                  "acq": T["acquisti"], "cpa": T["cpa"], "ric": T["ricavi"], "spesa": T["spesa"],
                  "letto": "%s %s %s€/g %dg sc%d%% p%d %s %s %s %s forza=%s" % (
                      c["canale"], c["categoria"], int(c["budget_giorno"]), c["giorni"], round(100 * c["sconto"]), c["prezzo"],
                      c["marchio"][:4], "+".join(c["leve"]), ",".join("%s:%s" % (k, "/".join(v)) for k, v in c["filtri"].items()) or "-",
                      "+".join(c["extra"]) or "-", c.get("forza"))})
b0 = righe[0]
d = lambda a, b: ("%+5.0f%%" % (100 * (a / b - 1))) if b else "  -  "
print("%-30s %-11s %9s %6s %6s %6s %7s %7s %7s  %s" % ("prova", "migliore", "raggiunte", "click", "CTR%", "CPM€", "acquisti", "Δacq", "CPA€", "letto dal prompt"))
for r in righe:
    print("%-30s %-11s %9.0f %6.0f %6.2f %6.2f %7.1f %7s %7.1f  %s" % (r["nome"][:30], r["best"], r["ragg"], r["clk"], r["ctr"], r["cpm"], r["acq"],
                                                                         d(r["acq"], b0["acq"]) if r is not b0 else "", r["cpa"], r["letto"]))
json.dump(righe, open(sys.argv[1].replace(".json", "_%s_risultati.json" % chiave), "w"), indent=1)
