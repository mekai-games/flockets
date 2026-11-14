/* Flockets: home, «Come funziona», pagina di partenza (annuncio scritto e/o storico), invio verso l'analisi (analisi.js). */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ni = v => Math.round(v).toLocaleString('it-IT');
  const gm = d => d.slice(8, 10) + '/' + d.slice(5, 7);
  const dt = d => new Date(d + 'T12:00:00');
  const iso = x => x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
  const piu = (d, n) => { const x = dt(d); x.setDate(x.getDate() + n); return iso(x); };
  const giorniTra = (a, b) => Math.round((dt(a) - dt(b)) / 864e5);
  const dow = d => (dt(d).getDay() + 6) % 7; // lunedi = 0
  const lunedi = d => piu(d, -dow(d));

  // colonne dello storico: nome, nomi riconosciuti, esempio, obbligatoria, a cosa serve
  const COLONNE = [
    ['Data', 'Giorno · Date · Día', '2026-11-02', true, ''],
    ['Annuncio', 'Nome dell’inserzione · Ad name', 'Video creator -30%', true, ''],
    ['Spesa', 'Importo speso · Amount spent', '42,50', true, ''],
    ['Visualizzazioni', 'Impression · Impressions', '5.120', true, ''],
    ['Click', 'Clic sul link · Link clicks', '61', true, ''],
    ['Ad set', 'Nome del gruppo di inserzioni · Ad set name', 'Retargeting 30 giorni', false, 'riconoscere i pubblici'],
    ['Campagna', 'Nome della campagna · Campaign name', 'Black Friday', false, 'raggruppare gli ad set'],
    ['Copertura', 'Copertura · Reach', '4.300', false, 'stimare quanto è grande il pubblico'],
    ['Budget giornaliero', 'Budget del gruppo di inserzioni · Daily budget', '150', false, 'misurare l’effetto del budget sul costo'],
  ];
  const tabellaColonne = () => `<table class="semplice"><thead><tr><th>Colonna</th><th>Nomi riconosciuti</th><th>Esempio</th><th>Serve</th></tr></thead><tbody>${
    COLONNE.map(([n, alias, es, obbl, serve]) => `<tr><td><b>${n}</b></td><td>${alias}</td><td class="mono">${es}</td><td>${obbl ? '<span class="obbl">obbligatoria</span>' : 'facoltativa: ' + serve}</td></tr>`).join('')}</tbody></table>`;

  const S = { lab: null, visti: {}, testoConsole: '', file: null, fileKit: true, brief: null, sorgente: 'kit', etichetta: 'Dati della sfida Wevion (simulati)' };
  let D = null, datiP = null;

  /* ------------------------------------------------------------------ dati */
  function dati() {
    if (!datiP) {
      datiP = Promise.all([fetch('data/analisi.json').then(r => r.json()), Flock.carica()]).then(([d]) => { usa(d); return D; });
    }
    return datiP;
  }
  // cambia l'insieme di dati su cui lavora il sito (il kit, oppure un'analisi calcolata sui file caricati)
  function usa(d) {
    D = d;
    Object.assign(S, { lab: null, visti: {} });
    prepara();
  }
  const kit = () => D.meta.origine === 'kit';
  const scarico = () => (D.csv ? URL.createObjectURL(new Blob([D.csv], { type: 'text/csv' })) : 'data/' + D.meta.file_previsioni);
  // ponte per analisi.js: i dati correnti e qualche funzione del sito
  window.Flk = {
    get D() { return D; }, get S() { return S; }, kit: () => !!D && kit(), dati: () => dati(),
    stima: (c, L) => stima(c, L), scarico: () => scarico(),
  };
  function prepara() {
    const ogg = (cols, r) => Object.fromEntries(cols.map((k, i) => [k, r[i]]));
    D.P = D.pred.map(r => ogg(D.pred_cols, r));
    D.H = D.hist.map(r => ogg(D.hist_cols, r));
    D.perAd = {}; D.histAd = {}; D.zona = {};
    D.P.forEach(p => {
      (D.perAd[p.ad] = D.perAd[p.ad] || []).push(p);
      const k = D.ads[p.ad].adset;
      const z = (D.zona[k] = D.zona[k] || {});
      const g = (z[p.d] = z[p.d] || { spesa: 0, imp: 0, clk: 0, fat: 0, top: null, ads: [] });
      g.spesa += p.spesa; g.imp += p.imp; g.clk += p.clk; g.fat += p.fat * p.quota; g.ads.push(p);
      if (!g.top || p.quota > g.top.quota) g.top = p;
    });
    Object.values(D.zona).forEach(z => Object.values(z).forEach(g => { g.cpm = g.spesa / g.imp * 1000; g.ctr = g.clk / g.imp * 100; }));
    D.H.forEach(h => { (D.histAd[h.ad] = D.histAd[h.ad] || {})[h.d] = h; });
  }

  /* ---------------------------------------------------- lettura del testo dell'annuncio */
  // subito con le regole a parole chiave; poco dopo con la funzione /api/leggi, se è attiva
  function leggiTesto(t) {
    const s = t.toLowerCase(), f = {};
    Object.entries(D.par.feat_regole).forEach(([k, rx]) => { f[k] = new RegExp(rx).test(s) ? 1 : 0; });
    const c = (x, lista) => (lista.includes(x) ? x : lista[0]);
    const formato = c(/video|reel|secondi|filmato/.test(s) ? 'video' : /carosello|schede|slide/.test(s) ? 'carosello' : 'immagine', D.par.formati);
    const lv = c(/black/.test(s) ? 'black_friday' : /solo oggi|scade|mezzanotte|24 ore|48 ore|countdown|timer|fino a domenica|stanotte/.test(s) ? 'urgency' : 'scarcity', D.par.leve);
    return { f, formato, leva: lv, fonte: 'regole' };
  }
  const LETTURA = { attiva: null, t: null, ultimo: null };
  function letturaPronta() {
    if (LETTURA.attiva !== null) return Promise.resolve(LETTURA.attiva);
    return fetch('api/leggi').then(r => (r.ok ? r.json() : { attiva: false })).then(j => (LETTURA.attiva = !!j.attiva)).catch(() => (LETTURA.attiva = false));
  }
  function chiediLettura(testo) {
    if (LETTURA.ultimo && LETTURA.ultimo.testo === testo) return LETTURA.ultimo.p;
    const p = letturaPronta().then(ok => {
      if (!ok || testo.length < 8) return null;
      return fetch('api/leggi', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testo: testo.slice(0, 800), formati: D.par.formati, leve: D.par.leve }) })
        .then(r => (r.ok ? r.json() : null))
        .then(j => {
          if (!j) return null;
          // la campagna (canale, budget, durata…) serve anche senza file; formato e leva solo se il modello li conosce
          const extra = { campagna: j.campagna || null, messaggio: j.messaggio || null, suggerimenti: j.suggerimenti || [], motivo: j.motivo || '', fonte: 'ia' };
          if (!D.par.formati.includes(j.formato) || !D.par.leve.includes(j.leva)) return Object.assign(leggiTesto(testo), extra);
          const f = {};
          Object.keys(D.par.feat_regole).forEach(k => { f[k] = j.caratteristiche && j.caratteristiche[k] ? 1 : 0; });
          return Object.assign({ f, formato: j.formato, leva: j.leva }, extra);
        });
    }).catch(() => null);
    LETTURA.ultimo = { testo, p };
    return p;
  }
  function logFatica(eta, leva) {
    // come nel motore: la curva della sua leva; senza curva propria, la media delle curve stimate
    const F = D.par.fatica, lf = k => { const [fl, tau] = F[k]; return Math.log(fl + (1 - fl) * Math.exp(-eta / tau)); };
    if (F[leva]) return lf(leva);
    const k = Object.keys(F);
    return k.length ? k.reduce((s, x) => s + lf(x), 0) / k.length : 0;
  }
  // l'annuncio scritto, provato sulle campagne dello storico con il modello di previsione
  function stima(c, L) {
    const P = D.par, x = Object.assign({}, L.f);
    P.feat_cols.forEach(k => { if (k === L.formato || k === L.leva) x[k] = 1; });
    let beta = P.feat_w[0];
    P.feat_cols.forEach((k, i) => { beta += P.feat_w[i + 1] * (x[k] || 0); });
    const giorni = D.meta.giorni.filter(d => d >= L.lancio).slice(0, 7);
    const righe = c.adset.map(k => {
      const A = D.adset[k];
      const v = giorni.map(d => {
        const eta = giorniTra(d, L.lancio), lf = logFatica(eta, L.leva), w = lunedi(d);
        const ctr = 100 * Math.exp(A.ctr_fx + beta + (A.inter[L.leva] || 0) + lf + (eta < 3 ? P.ctr_new3 : 0) + P.ctr_dow[dow(d)] + D.stagione.ctr[A.vertical][w]);
        const cpm = Math.exp(A.cpm_fx + P.cpm_dow[dow(d)] + P.cpm_idx * D.stagione.cpm[w] + P.elasticita * Math.log(A.budget_test / A.budget_iniziale)
          + (eta < 3 ? P.cpm_new3 : 0) + P.cpm_budlearn * (A.bud_learn[d] || 0) + P.cpm_q[0] + P.cpm_q[1] * beta + P.cpm_fat * lf);
        return { ctr, cpm };
      });
      const m = f => v.reduce((s, y) => s + y[f], 0) / v.length;
      const ctr = m('ctr'), cpm = m('cpm');
      return { k, ctr, cpm, cpc: cpm / (10 * ctr), per100: 100 / (cpm / (10 * ctr)) };
    });
    const q = P.qualita_asset[c.vertical] || [];
    return { beta, righe, sotto: q.filter(b => b < beta).length, tot: q.length, giorni: giorni.length };
  }

  /* ------------------------------------------------------------- pagina di partenza */
  function leggiCSV(t) {
    const righe = []; let r = [], c = '', q = false;
    for (let i = 0; i < t.length; i++) {
      const ch = t[i];
      if (q) { if (ch === '"') { if (t[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; }
      else if (ch === '"') q = true;
      else if (ch === ',') { r.push(c); c = ''; }
      else if (ch === '\n') { r.push(c); righe.push(r); r = []; c = ''; }
      else if (ch !== '\r') c += ch;
    }
    if (c.length || r.length) { r.push(c); righe.push(r); }
    return righe;
  }
  function controllaStorico(righe) {
    const h = righe[0].map(x => x.trim()), ix = n => h.indexOf(n);
    const manca = ['data', 'ad_id', 'adset_id', 'spesa', 'impression', 'click'].filter(n => ix(n) < 0);
    if (manca.length) return { ok: false, manca };
    const iv = ix('vertical'), ib = ix('budget_giornaliero_adset');
    const ads = new Set(), vd = {}, sd = {}; let min = '9', max = '0', n = 0;
    for (let i = 1; i < righe.length; i++) {
      const r = righe[i]; if (r.length < h.length) continue; n++;
      const d = r[ix('data')]; if (d < min) min = d; if (d > max) max = d;
      ads.add(r[ix('ad_id')]);
      const kv = (iv >= 0 ? r[iv] : 'tutti') + '|' + d; const a = (vd[kv] = vd[kv] || { c: 0, i: 0, n: 0 });
      a.c += +r[ix('click')]; a.i += +r[ix('impression')]; a.n++;
      if (ib >= 0) { const ks = r[ix('adset_id')] + '|' + d; const b = (sd[ks] = sd[ks] || { s: 0, b: +r[ib] }); b.s += +r[ix('spesa')]; }
    }
    const note = [];
    Object.entries(vd).forEach(([k, a]) => { if (a.c === 0 && a.i > 5000) note.push(`${gm(k.split('|')[1])}: zero click su ${a.n} annunci (${k.split('|')[0].replace('_', ' ')}).`); });
    Object.entries(sd).forEach(([k, b]) => { if (b.s > 1.15 * b.b) note.push(`${gm(k.split('|')[1])}, ${k.split('|')[0]}: spesa ${ni(b.s)} € con budget ${ni(b.b)} €.`); });
    return { ok: true, n, ads: ads.size, min, max, note, lista: Array.from(ads) };
  }
  const SEGNAPOSTO = 'Descrivi l’annuncio: «Video su TikTok, una ragazza parla in camera, -30% sulla crema viso, 50 € al giorno per 2 settimane»';
  // con un file allegato si analizza il file (e l'annuncio scritto si prova sulle sue campagne);
  // senza file l'annuncio scritto diventa una campagna nuova, simulata sulle persone
  function sorgente(v) {
    S.scelta = v;
    $('#file-chip').hidden = !(v === 'file' && S.file);
    if (v !== 'file') $('#esito-file').innerHTML = '';
    $('#richiesta').placeholder = SEGNAPOSTO;
  }
  let avvio = null, ultimaReazione = 0;
  // altezza del prato: dal fondo fino a poco sotto la riga dell'allegato (mai sopra il prompt)
  function misuraPrato() {
    const sez = $('#v-console'), al = $('.allega');
    if (!sez || sez.hidden) return 0;
    const fondo = sez.getBoundingClientRect().bottom, sotto = al.getBoundingClientRect().bottom + 28;
    return Math.max(110, Math.min(fondo - sotto, window.innerHeight * (window.innerWidth < 600 ? 0.36 : 0.5)));
  }
  function disegnaPrato() {
    const h = misuraPrato();
    if (h && window.Flock && Flock.prato) Flock.prato($('#prato'), h, { pixel: window.innerWidth < 600 ? 2 : 3 });
    return h;
  }
  function follaAvvio() {
    if (avvio || !window.Flock) return;
    Flock.carica().then(() => {
      if (avvio) return;
      const h = disegnaPrato(), c = $('#folla-avvio'), stretto = window.innerWidth < 600;
      // due file: in fondo piccoli, davanti grandi. Escono dai bordi e ne entrano sempre di nuovi
      const alto = Math.round(Math.min(h, stretto ? 230 : 230));
      avvio = new Flock.Scena(c, { scala: stretto ? 2 : 3, altezza: alto, suolo: stretto ? 12 : 16, linea: false, testo: '', avvolgi: true, ricambio: true });
      const w = c.clientWidth, tot = 100, usati = new Set(), nuovo = () => { let id; do { id = Math.floor(Math.random() * tot); } while (usati.has(id) && usati.size < tot); usati.add(id); return id; };
      // profondità continua: ognuno a una distanza sua sul prato. Lontano = più in alto, più piccolo, più lento.
      // Le scale restano intere (pixel netti): piccola oltre metà prato, grande davanti, con una zona in cui si mescolano.
      const fondo = Math.round(alto * (stretto ? 0.6 : 0.58)), [piccola, grande] = stretto ? [1, 2] : [2, 3];
      avvio.profondita = o => {
        const t = Math.pow(Math.random(), 0.85);   // 0 davanti, 1 in fondo
        o.dy = -Math.round(t * fondo);
        o.s = t > 0.62 || (t > 0.42 && Math.random() < (t - 0.42) / 0.2) ? piccola : grande;
        o.vel = (14 + Math.random() * 20) * (1 - 0.45 * t);
      };
      const n = Math.max(6, Math.min(26, Math.round(w / (stretto ? 34 : 62))));
      avvio.omini = [];
      for (let k = 0; k < n; k++) {
        const o = new Flock.Omino(nuovo(), Math.random() * (w + 80) - 40, {});
        avvio.profondita(o);
        avvio.omini.push(o);
      }
      avvio.omini.sort((p, q) => p.dy - q.dy);
    });
  }
  function reazione(quanti, testo) {
    if (!avvio) return;
    avvio.testo = testo || '';
    for (let i = 0; i < quanti; i++) setTimeout(() => avvio.esulta(), i * 140);
  }
  function togliFile() {
    S.file = null; S.fileKit = true; $('#file-ingresso').value = '';
    sorgente('kit');
  }
  // file allegato: resta solo il suo nome nel riquadro; sotto compare qualcosa solo se il file non va bene
  function suFile(files) {
    const out = $('#esito-file');
    const lista = Array.from(files).filter(f => /\.csv$/i.test(f.name) || f.type === 'text/csv');
    if (!lista.length) { out.innerHTML = '<p class="errore mono">Serve un file CSV.</p>'; return; }
    out.innerHTML = '';
    Promise.all([dati(), ...lista.map(f => f.text().then(t => ({ nome: f.webkitRelativePath || f.name, testo: t })))]).then(([, ...letti]) => {
      const st = letti.map(x => Object.assign({ nome: x.nome }, controllaStorico(leggiCSV(x.testo)))).filter(x => x.ok).sort((a, b) => b.n - a.n)[0];
      S.file = letti;
      S.fileKit = !!st && st.lista.filter(a => D.ads_storico.includes(a)).length / st.lista.length > 0.9 && st.n > 1000 && kit();
      $('#file-nome').textContent = letti.length === 1 ? letti[0].nome : letti.length + ' file';
      sorgente('file');
      reazione(3, '');
    });
  }
  // mentre si scrive: il testo viene letto in sottofondo, senza mostrare niente
  function leggiInSottofondo() {
    if (!D) return;
    const testo = $('#richiesta').value.trim();
    if (!testo) { S.brief = null; clearTimeout(LETTURA.t); return; }
    S.brief = Object.assign(leggiTesto(testo), { attesa: true });
    clearTimeout(LETTURA.t);
    LETTURA.t = setTimeout(() => chiediLettura(testo).then(b => {
      if (!S.brief || $('#richiesta').value.trim() !== testo) return;
      if (b) S.brief = b; else S.brief.attesa = false;
    }), 700);
  }
  function avvia(forzata, origine) {
    const b = $('#avvia'), out = $('#esito-file'), scelta = typeof forzata === 'string' ? forzata : S.file ? 'file' : 'annuncio';
    S.testoConsole = $('#richiesta').value.trim();
    const budget = null, lancio = null;
    if (scelta === 'nuova') { location.hash = '#/nuova'; return; }
    if (scelta === 'annuncio' && !S.testoConsole) {   // niente da analizzare: il riquadro si scuote e aspetta il testo
      const c = $('.composer'); c.classList.remove('scuoti'); void c.offsetWidth; c.classList.add('scuoti'); $('#richiesta').focus(); return;
    }
    if (document.body.dataset.vista === 'console') reazione(6, '');
    const r = (origine || b).getBoundingClientRect(), da = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    // se la lettura del testo è ancora in corso la si aspetta, al massimo cinque secondi (intanto parte la transizione)
    const b0 = S.brief;
    const lettura = b0 && b0.attesa && LETTURA.attiva !== false
      ? (clearTimeout(LETTURA.t), Promise.race([chiediLettura(S.testoConsole), new Promise(r => setTimeout(() => r(null), 5000))])
        .then(b => { if (S.brief === b0) { if (b && !b0.manuale) S.brief = b; else b0.attesa = false; } }))
      : Promise.resolve();
    b.disabled = true;
    const errore = err => { out.insertAdjacentHTML('beforeend', `<p class="errore mono">${esc(String(err.message || err).split('\n').pop())}</p>`); };
    const libera = () => { b.disabled = false; sorgente(S.file ? 'file' : 'kit'); };
    // solo il testo: l'annuncio diventa una campagna nuova, provata su ogni tipo di pubblico
    if (scelta === 'annuncio') {
      let L = null;
      const lavoro = lettura.then(() => { L = window.Analisi.leggiPrompt(S.testoConsole, S.brief); return MotoreFlockets.campagna(L.spec, () => {}); });
      window.Analisi.transizione(lavoro, da)
        .then(d => window.Analisi.apri('nuova', d, { prompt: S.testoConsole, unita: L.unita, gratis: L.gratis, ia: L.ia, messaggio: L.messaggio, suggerimenti: L.suggerimenti }))
        .catch(errore).finally(libera);
      return;
    }
    let fonte = '', L = null;
    const parti = d => {
      const brief = S.brief;
      S.visti = {};
      S.lab = S.testoConsole ? Object.assign({ testo: S.testoConsole, lancio: D.meta.giorni.includes(lancio) ? lancio : D.meta.giorni[0], budget },
        brief && D.par.formati.includes(brief.formato) && D.par.leve.includes(brief.leva) ? brief : leggiTesto(S.testoConsole)) : null;
      if (d && L) window.Analisi.apri('nuova', d, { prompt: S.testoConsole, unita: L.unita, gratis: L.gratis, ia: L.ia, messaggio: L.messaggio,
        suggerimenti: L.suggerimenti, storico: true, fonte, marca: L.marca });
      else window.Analisi.apri('storico', null, { prompt: S.testoConsole, fonte });
    };
    // con un annuncio scritto: la stessa campagna simulata sulle persone, con i livelli veri della marca presi dallo storico
    const provaAnnuncio = () => {
      if (!S.testoConsole) return null;
      const L0 = window.Analisi.leggiPrompt(S.testoConsole, S.brief), r = riservaDaStorico(S.testoConsole, L0.spec.categoria_ia);
      L = window.Analisi.leggiPrompt(S.testoConsole, S.brief, r);
      L.marca = r ? r.marca : '';
      return MotoreFlockets.campagna(L.spec, () => {});
    };
    const sfida = scelta === 'kit' || (scelta === 'file' && S.fileKit);
    // mentre il motore calcola, gli omini corrono a schermo intero
    const lavoro = sfida
      ? (() => { S.sorgente = 'kit'; S.etichetta = 'Dati della sfida Wevion (simulati)'; fonte = 'Dati della sfida Wevion'; if (D && !kit()) { datiP = null; D = null; } return dati().then(() => lettura); })()
      : (scelta === 'esempio'
        ? fetch('data/esempio_gioco.csv').then(r => r.text()).then(testo => [{ nome: 'esempio_gioco.csv', testo }])
        : Promise.resolve(S.file)).then(f => MotoreFlockets.analizza(f, () => {}).then(d => {
          S.sorgente = scelta;
          S.etichetta = scelta === 'esempio' ? 'Esempio inventato: gioco per telefono' : 'Il tuo file: ' + (f.length === 1 ? f[0].nome : f.length + ' file');
          fonte = scelta === 'esempio' ? 'Esempio: gioco per telefono' : (f.length === 1 ? f[0].nome : f.map(x => x.nome).join(', '));
          usa(d);
          return lettura;
        }));
    window.Analisi.transizione(lavoro.then(provaAnnuncio), da).then(parti).catch(errore).finally(libera);
  }

  /* Dallo storico all'annuncio scritto: budget, durata, partenza e categoria quando il testo non li dice, e la taratura:
     di quanto i click e i costi veri della marca si discostano dal simulatore a freddo (media pesata sulla spesa, scala log).
     Se il testo nomina una delle campagne del file, si usa solo quella; se no le campagne della stessa categoria. */
  function riservaDaStorico(testo, categoria) {
    const P = D.persone || {}, giorni = D.meta.giorni, s = testo.toLowerCase();
    const camp = D.campagne.find(c => c.nome && s.includes(c.nome.toLowerCase()));
    let ks = Object.keys(P).filter(k => P[k].a_freddo && P[k].previsto);
    if (camp) ks = ks.filter(k => camp.adset.includes(k));
    else if (categoria && ks.some(k => P[k].categoria === categoria)) ks = ks.filter(k => P[k].categoria === categoria);
    if (!ks.length) return null;
    const spesa = k => giorni.reduce((a, d) => a + (((D.zona[k] || {})[d] || {}).spesa || 0), 0);
    let w = 0, sc = 0, sp = 0;
    const cat = {};
    ks.forEach(k => {
      const a = P[k].a_freddo, b = P[k].previsto, x = spesa(k) || 1;
      cat[P[k].categoria] = (cat[P[k].categoria] || 0) + x;
      if (a.ctr > 0 && b.ctr > 0 && a.cpm > 0 && b.cpm > 0) { w += x; sc += x * Math.log(b.ctr / a.ctr); sp += x * Math.log(b.cpm / a.cpm); }
    });
    const campagne = camp ? 1 : D.campagne.filter(c => c.adset.some(k => ks.includes(k))).length;
    const totale = ks.reduce((a, k) => a + spesa(k), 0);
    return { budget_giorno: Math.round(totale / giorni.length / Math.max(campagne, 1)), giorni: giorni.length, inizio: giorni[0],
      categoria: Object.entries(cat).sort((x, y) => y[1] - x[1])[0][0], marca: camp ? camp.nome : '',
      taratura: w ? { ctr: sc / w, cpm: sp / w } : null };
  }

  /* ------------------------------------------------------------------ viste */
  function mostra(v) {
    if (document.body.dataset.vista === v) return;
    document.body.dataset.vista = v;
    $$('.vista').forEach(s => { s.hidden = s.id !== 'v-' + v; });
    window.scrollTo(0, 0);
  }
  function instrada() {
    const p = location.hash.replace(/^#\/?/, '').split('/');
    if (p[0] === 'console') { mostra('console'); follaAvvio(); if (!D) dati(); return; }
    if (p[0] === 'come') { mostra('come'); return; }
    if (p[0] === 'sim') { location.replace('#/analisi'); return; }   // indirizzi della vecchia interfaccia
    if (p[0] === 'analisi') {
      (D || window.Analisi.haDati() ? Promise.resolve() : dati()).then(() => { mostra('analisi'); window.Analisi.mostra(p[1] === 'numeri' ? 'analisi' : 'persone'); });
      return;
    }
    if (p[0] === 'nuova') { mostra('nuova'); window.Nuova.apri(S.testoConsole); return; }
    mostra('benvenuto');
  }

  /* ------------------------------------------------------------------ avvio */
  // tema chiaro o scuro: bottone sole / luna nelle intestazioni, scelta ricordata nel browser
  function bottoniTema() {
    const scuro = () => document.documentElement.dataset.tema === 'scuro';
    const icona = '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path class="luna" d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z"/>'
      + '<g class="sole"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></g></svg>';
    $$('header.nav.chiara .nav-link, .barra-dx').forEach(n => { const b = document.createElement('button'); b.type = 'button'; b.className = 'tema'; b.innerHTML = icona; n.appendChild(b); });
    const etichette = () => $$('.tema').forEach(b => { const t = scuro() ? 'Passa al tema chiaro' : 'Passa al tema scuro'; b.setAttribute('aria-label', t); b.title = t; });
    document.addEventListener('click', e => {
      if (!e.target.closest('.tema')) return;
      const r = document.documentElement, nuovo = scuro() ? 'chiaro' : 'scuro';
      r.classList.add('cambio-tema'); r.dataset.tema = nuovo;
      setTimeout(() => r.classList.remove('cambio-tema'), 400);
      try { localStorage.setItem('flockets-tema', nuovo); } catch (x) { /* senza memoria vale fino alla chiusura */ }
      etichette();
    });
    etichette();
  }
  function inizio() {
    bottoniTema();
    Flock.carica().then(() => { new Flock.Scena($('#folla'), { scala: 4, altezza: 390, contorno: true, ombra: false, linea: false, suolo: 0 }).folla(); });
    $('#avvia').addEventListener('click', () => avvia());
    $('#colonne-console').innerHTML = tabellaColonne();
    $('#colonne-come').innerHTML = tabellaColonne();
    sorgente('kit');
    $('#togli-file').addEventListener('click', togliFile);
    // invio = analizza, maiuscolo + invio = a capo (come nelle chat)
    $('#richiesta').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); avvia(); } });
    $('#richiesta').addEventListener('input', () => { const t = Date.now(); if (t - ultimaReazione > 1600) { ultimaReazione = t; reazione(1, ''); } });
    $('#richiesta').addEventListener('input', e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 180) + 'px'; });
    $('#richiesta').addEventListener('input', () => (D ? leggiInSottofondo() : dati().then(leggiInSottofondo)));
    const info = $('#info-file'), box = $('#info-box');
    const apriInfo = on => { box.hidden = !on; info.setAttribute('aria-expanded', on); };
    info.addEventListener('click', e => { e.stopPropagation(); apriInfo(box.hidden); });
    $('#info-chiudi').addEventListener('click', () => apriInfo(false));
    document.addEventListener('click', e => { if (!box.hidden && !box.contains(e.target) && e.target !== info) apriInfo(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !box.hidden) apriInfo(false); });
    $('#file-ingresso').addEventListener('change', e => suFile(e.target.files));
    const z = $('#v-console');   // si può trascinare il file in qualsiasi punto della pagina
    ['dragenter', 'dragover'].forEach(n => z.addEventListener(n, e => { e.preventDefault(); $('#zona-file').classList.add('sopra'); }));
    ['dragleave', 'drop'].forEach(n => z.addEventListener(n, e => { e.preventDefault(); if (n === 'drop' || !z.contains(e.relatedTarget)) $('#zona-file').classList.remove('sopra'); }));
    z.addEventListener('drop', e => { if (e.dataTransfer.files.length) suFile(e.dataTransfer.files); });
    window.addEventListener('hashchange', instrada);
    let rt = null;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (document.body.dataset.vista === 'console') disegnaPrato(); }, 250); });
    instrada();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inizio); else inizio();
})();
