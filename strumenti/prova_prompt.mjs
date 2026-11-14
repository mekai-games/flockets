// Prove concrete sul prompt: annunci quasi uguali → lettura vera di Claude Haiku (funzione /api/leggi del sito online)
// → stessi passaggi del sito (leggiPrompt in web/js/analisi.js) → dati della campagna per il motore, in un file JSON.
// Uso:  node strumenti/prova_prompt.mjs web/js/analisi.js /tmp/prove_prompt.json
//       python3 strumenti/simula_prove.py /tmp/prove_prompt.json
// Ogni lettura costa circa 0,0005 $ di crediti Claude; la funzione accetta 30 letture ogni 10 minuti per indirizzo.
import fs from 'node:fs';
const [, , fileAnalisi, uscita] = process.argv;
globalThis.window = {}; globalThis.document = { readyState: 'complete', addEventListener() {} };
const codice = fs.readFileSync(fileAnalisi, 'utf8').replace("if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inizia); else inizia();", '');
new Function(codice)();
const leggiPrompt = window.Analisi.leggiPrompt;
const FEAT = ['ugc', 'hook', 'ritmo', 'testo_pesante', 'brand_lento', 'timer', 'prezzo_barrato'];

const base = 'Video su TikTok: una ragazza prova la crema viso alla vitamina C. -20% solo fino a domenica. 50 euro al giorno per 2 settimane.';
const prove = [
  ['base', base],
  ['sconto 30% invece di 20%', base.replace('-20%', '-30%')],
  ['senza sconto', 'Video su TikTok: una ragazza prova la crema viso alla vitamina C. 50 euro al giorno per 2 settimane.'],
  ['Instagram invece di TikTok', base.replace('Video su TikTok', 'Video su Instagram')],
  ['budget 100 invece di 50', base.replace('50 euro', '100 euro')],
  ['+ per donne 25-44', base.replace('Video su TikTok:', 'Video su TikTok per donne 25-44:')],
  ['+ spedizione gratuita', base.replace('solo fino a domenica.', 'solo fino a domenica, spedizione gratuita.')],
  ['+ 5.000 recensioni a 5 stelle', base.replace('vitamina C.', 'vitamina C, oltre 5.000 recensioni a 5 stelle.')],
  ['messaggio debole', 'Crema viso. Su TikTok, 50 euro al giorno per 2 settimane.'],
  ['marchio appena nato', base.replace('Video su TikTok:', 'Il nostro marchio è appena nato. Video su TikTok:')],
  ['prezzo 89 €', base.replace('crema viso alla vitamina C', 'crema viso alla vitamina C da 89 euro')],
  ['da dicembre, per Natale', base + ' Parte a dicembre, per Natale.'],
  ['per uomini over 55', base.replace('Video su TikTok:', 'Video su TikTok per uomini over 55:')],
  ['base (ripetuta)', base],
  ['+ invito: Compra ora!', base + ' Compra ora!'],
  ['annuncio su Google', 'Annuncio su Google per chi cerca crema viso alla vitamina C. -20% solo fino a domenica. 50 euro al giorno per 2 settimane.'],
];
// RIUSA=file.json: rilegge le risposte di Claude salvate in una prova precedente invece di chiamare la funzione
const salvate = process.env.RIUSA ? Object.fromEntries(JSON.parse(fs.readFileSync(process.env.RIUSA, 'utf8')).map(x => [x.testo, x.grezzo])) : null;
const out = [];
for (const [nome, testo] of prove) {
  let r = null;
  if (salvate && salvate[testo]) r = { ok: true, status: 200, json: async () => salvate[testo] };
  for (let k = 0; k < 4 && !r; k++) {   // limite di letture per indirizzo: si aspetta e si riprova
    r = await fetch('https://flockets.vercel.app/api/leggi', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testo, formati: ['video', 'immagine', 'carosello'], leve: ['scarcity', 'urgency', 'black_friday'] }) });
    if (r.status !== 429) break;
    r = null;
    await new Promise(ok => setTimeout(ok, 60000));
  }
  const j = r.ok ? await r.json() : null;
  const brief = j ? { f: Object.fromEntries(FEAT.map(k => [k, j.caratteristiche && j.caratteristiche[k] ? 1 : 0])), campagna: j.campagna,
    messaggio: j.messaggio, suggerimenti: j.suggerimenti || [], fonte: 'ia' } : null;
  const L = leggiPrompt(testo, brief), R = leggiPrompt(testo, null);
  out.push({ nome, testo, grezzo: j, spec: L.spec, regole: R.spec, messaggio: L.messaggio, suggerimenti: L.suggerimenti, unita: L.unita, ia: !!j });
  process.stdout.write(`${nome}: ${j ? 'letto da Claude' : 'ERRORE ' + r.status}\n`);
}
fs.writeFileSync(uscita, JSON.stringify(out, null, 1));
