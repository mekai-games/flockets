/* Fa girare il motore Flockets (Python) dentro il browser, sui file caricati.
   I dati non vengono inviati a nessun server: il calcolo avviene sul computer di chi usa il sito. */
window.MotoreFlockets = (function () {
  'use strict';
  const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';
  const FILE = ['__init__.py', 'contratto.py', 'motore.py', 'rapporto.py', 'persone.py', 'simulazione.py', 'valori_base.json', 'benchmark.json'];
  let py = null;

  function script(src) {
    return new Promise((ok, ko) => {
      const s = document.createElement('script');
      s.src = src; s.onload = ok; s.onerror = () => ko(new Error('Non riesco a scaricare il motore di calcolo. Controlla la connessione.'));
      document.head.appendChild(s);
    });
  }
  // il motore si scarica una volta sola; i messaggi vanno a chi lo sta aspettando adesso
  let attesa = null, avvisa = () => {};
  function pronto(stato) {
    if (stato) avvisa = stato;
    if (py) return Promise.resolve(py);
    if (!attesa) attesa = carica(m => avvisa(m)).catch(e => { attesa = null; throw e; });
    return attesa;
  }
  async function carica(stato) {
    stato('Scarico il motore di calcolo (solo la prima volta)…');
    if (!window.loadPyodide) await script(PYODIDE + 'pyodide.js');
    const p = await window.loadPyodide({ indexURL: PYODIDE });
    stato('Preparo i calcoli…');
    await p.loadPackage(['numpy', 'pandas']);
    p.FS.mkdirTree('/flockets');
    for (const f of FILE) {
      const r = await fetch('motore/flockets/' + f, { cache: 'no-cache' });
      if (!r.ok) throw new Error('Manca un pezzo del motore: ' + f);
      p.FS.writeFile('/flockets/' + f, await r.text());
    }
    py = p;
    return p;
  }
  /* file: [{nome, testo}]. Restituisce l'analisi nello stesso formato di data/analisi.json. */
  async function analizza(file, stato) {
    const p = await pronto(stato);
    stato('Leggo i dati e calcolo le previsioni…');
    await new Promise(r => setTimeout(r, 60));   // lascia disegnare il messaggio prima del calcolo
    p.globals.set('tabelle_js', p.toPy(Object.fromEntries(file.map(f => [f.nome, f.testo]))));
    const testo = await p.runPythonAsync(`
import sys, warnings
warnings.filterwarnings("ignore")
if "/" not in sys.path:
    sys.path.insert(0, "/")
import flockets
flockets.analisi_json(tabelle_js, simulazioni=500)
`);
    const d = JSON.parse(testo);
    if (d.errore) throw new Error(d.errore);
    return d;
  }
  /* Campagna nuova, senza dati: simulazione su tutti i tipi di persona e consigli. */
  async function campagna(spec, stato) {
    const p = await pronto(stato);
    stato('Simulo la campagna sulle persone…');
    await new Promise(r => setTimeout(r, 60));
    p.globals.set('spec_js', JSON.stringify(spec));
    const testo = await p.runPythonAsync(`
import sys, warnings
warnings.filterwarnings("ignore")
if "/" not in sys.path:
    sys.path.insert(0, "/")
import flockets
flockets.campagna_json(spec_js)
`);
    const d = JSON.parse(testo);
    if (d.errore) throw new Error(d.errore);
    return d;
  }
  return { analizza, campagna, prepara: () => pronto(null) };
})();
