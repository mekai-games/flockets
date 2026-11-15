// Banco di prova della lettura del prompt: per ogni annuncio di strumenti/banco_prompt.json
//   1) la lettura vera di Claude Haiku (funzione /api/leggi del sito pubblicato), salvata in un file per non ripagarla;
//   2) gli stessi passaggi del sito (leggiPrompt di web/js/analisi.js): con la lettura e con le sole regole a parole chiave.
// Poi strumenti/valuta_prompt.py passa le campagne al motore e confronta tutto con i valori attesi.
// Uso:  node strumenti/valuta_prompt.mjs [letture.json] [uscita.json]
// Ogni lettura costa circa 0,0005 $ di crediti Claude; la funzione accetta 30 letture ogni 10 minuti per indirizzo.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const LETTURE = process.argv[2] || path.join(QUI, 'banco_letture.json');
const USCITA = process.argv[3] || '/tmp/banco_risultati.json';
const URL_LEGGI = process.env.URL_LEGGI || 'https://flockets.vercel.app/api/leggi';

globalThis.window = {}; globalThis.document = { readyState: 'complete', addEventListener() {} };
const codice = fs.readFileSync(path.join(QUI, '../web/js/analisi.js'), 'utf8')
  .replace("if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inizia); else inizia();", '');
new Function(codice)();
const leggiPrompt = window.Analisi.leggiPrompt;
const FEAT = ['ugc', 'hook', 'ritmo', 'testo_pesante', 'brand_lento', 'timer', 'prezzo_barrato'];

// BANCO=banco_prompt_verifica.json: il secondo banco, scritto dopo le correzioni, per controllare che valgano anche su frasi nuove
const banco = JSON.parse(fs.readFileSync(path.join(QUI, process.env.BANCO || 'banco_prompt.json'), 'utf8'));
const salvate = fs.existsSync(LETTURE) ? JSON.parse(fs.readFileSync(LETTURE, 'utf8')) : {};
const out = [];
for (const prova of banco) {
  let j = salvate[prova.testo] || null;
  if (!j && !process.env.SOLO_SALVATE) {
    for (let k = 0; k < 4 && !j; k++) {   // limite di letture per indirizzo: si aspetta e si riprova
      const r = await fetch(URL_LEGGI, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testo: prova.testo, formati: ['video', 'immagine', 'carosello'], leve: ['scarcity', 'urgency', 'black_friday'] }) });
      if (r.status === 429) { process.stdout.write('  (limite: aspetto un minuto)\n'); await new Promise(ok => setTimeout(ok, 60000)); continue; }
      j = r.ok ? await r.json() : { errore: r.status };
    }
    salvate[prova.testo] = j;
    fs.writeFileSync(LETTURE, JSON.stringify(salvate, null, 1));
  }
  const ok = !!(j && !j.errore);
  const brief = ok ? { f: Object.fromEntries(FEAT.map(k => [k, j.caratteristiche && j.caratteristiche[k] ? 1 : 0])), campagna: j.campagna,
    messaggio: j.messaggio, suggerimenti: j.suggerimenti || [], presentazione: j.presentazione, fonte: 'ia' } : null;
  const L = leggiPrompt(prova.testo, brief), R = leggiPrompt(prova.testo, null);
  out.push({ ...prova, ia: ok, grezzo: j, spec: L.spec, regole: R.spec, unita: L.unita });
  process.stdout.write(`${prova.id}: ${ok ? 'letto' : 'senza lettura ' + JSON.stringify(j)}\n`);
}
fs.writeFileSync(USCITA, JSON.stringify(out, null, 1));
console.log('scritto', USCITA);
