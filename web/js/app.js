/* Flockets: home, «Come funziona», scelta dei dati, risultati (pubblico simulato a sinistra, analisi a destra). */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf = (v, d = 2) => Number(v).toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d });
  const ni = v => Math.round(v).toLocaleString('it-IT');
  const gm = d => d.slice(8, 10) + '/' + d.slice(5, 7);
  const dt = d => new Date(d + 'T12:00:00');
  const iso = x => x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
  const piu = (d, n) => { const x = dt(d); x.setDate(x.getDate() + n); return iso(x); };
  const giorniTra = (a, b) => Math.round((dt(a) - dt(b)) / 864e5);
  const dow = d => (dt(d).getDay() + 6) % 7; // lunedi = 0
  const lunedi = d => piu(d, -dow(d));
  const NOMI_G = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];
  const stringe = (v, a, b) => Math.max(a, Math.min(b, v));
  const accenti = t => t.replace(/\bpiu\b/g, 'più').replace(/\bgia\b/g, 'già').replace(/(\d)\.(\d)/g, '$1,$2');

  const PASSI = [
    { id: 'dati', nome: 'Dati' }, { id: 'pubblici', nome: 'Pubblici' }, { id: 'simulazione', nome: 'Previsioni' },
    { id: 'decisioni', nome: 'Decisioni' }, { id: 'laboratorio', nome: 'Prova un annuncio' },
  ];
  const TIPI = { ampio: 'Pubblico ampio', interessi: 'Interessi', sosia: 'Sosia dei clienti', caldo: 'Già vicini al marchio', unico: 'Pubblico unico' };
  const CHI = {
    ampio: () => 'Chiunque in Italia tra 18 e 65 anni. Nessun interesse scelto: decide la piattaforma a chi mostrare l’annuncio.',
    interessi: v => ({
      beauty_skincare: 'Persone che seguono skincare, cosmetica e cura del viso.',
      pet_ecommerce: 'Persone che hanno un cane o un gatto e seguono pagine a tema.',
      abbigliamento: 'Persone che seguono moda, marchi di abbigliamento e acquisti online.',
    }[v] || 'Persone scelte per interesse verso la categoria.'),
    sosia: () => 'Persone che somigliano a chi ha già comprato: stesse abitudini, ma non conoscono ancora il marchio.',
    caldo: () => 'Chi ha visitato il sito, lasciato il carrello a metà o già comprato negli ultimi 30 giorni.',
    unico: () => 'È il solo ad set della campagna: tutto il pubblico passa da qui.',
  };
  const LEVE = { scarcity: 'scarsità', urgency: 'urgenza', black_friday: 'black friday', generica: 'annuncio' };
  const leva = k => LEVE[k] || String(k).replace(/_/g, ' ');
  // leva e formato, senza i valori che il motore mette quando il dato manca
  const ignoto = v => !v || v === 'generica' || v === 'non indicato';
  const tipoAnnuncio = (lv, fo) => [ignoto(lv) ? '' : leva(lv), ignoto(fo) ? '' : fo].filter(Boolean).join(' · ');
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
  const AFF = {
    alta: 'storico lungo e forchetta stretta',
    media: 'qualche incertezza: annuncio recente, budget appena cambiato o giorni particolari',
    bassa: 'creatività o pubblico senza storico: la forchetta è larga',
  };
  const STADI = { storico: 'storico sufficiente', 'primi dati': 'primi dati', 'mai vista': 'creatività mai vista', 'dopo modifica': 'dopo un cambio di budget', 'fuori dominio': 'fuori da ciò che conosce' };
  const CARATT = {
    ugc: 'una persona parla in camera', hook: 'aggancio nei primi 2 secondi', ritmo: 'ritmo veloce',
    testo_pesante: 'grafica piena di testo', brand_lento: 'video di marca lento', timer: 'timer o conto alla rovescia',
  };
  const ESEMPIO = 'Video di 15 secondi: una ragazza parla in camera, nei primi 2 secondi appare la scritta -30% SOLO OGGI';
  const REPO = 'https://github.com/mekai-games/flockets';
  const BLU = '#3B4BE0', GRIGIO = '#A3A3A3';
  const FATTO = ['Completato', 'ok'];

  const S = { campagna: null, passo: 'dati', giorno: 0, play: false, adset: null, ad: null, budget: {}, lab: null, visti: {}, testoConsole: '', file: null, fileKit: true, brief: null, sorgente: 'kit', etichetta: 'Dati della sfida Wevion (simulati)' };
  let D = null, datiP = null, orologio = null, palco = null;

  /* ------------------------------------------------------------------ dati */
  function dati() {
    if (!datiP) {
      datiP = Promise.all([fetch('data/analisi.json').then(r => r.json()), Flock.carica()]).then(([d]) => { usa(d); return D; });
    }
    return datiP;
  }
  // cambia l'insieme di dati su cui lavora il sito (il kit, oppure un'analisi calcolata sui file caricati)
  function usa(d) {
    play(false);
    D = d; palco = null;
    Object.assign(S, { giorno: 0, adset: null, ad: null, budget: {}, lab: null, visti: {} });
    prepara();
  }
  const kit = () => D.meta.origine === 'kit';
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
    Object.keys(D.adset).forEach(k => { S.budget[k] = D.adset[k].budget_test; });
    S.campagna = D.campagne[0].id;
  }
  const camp = () => D.campagne.find(c => c.id === S.campagna);
  const nOmini = k => (D.adset[k].grandezza ? stringe(Math.round(3 * Math.log10(D.adset[k].grandezza) - 10.5), 3, 12) : 7);
  // sigla di un ad set: dei codici tipo «NDL-AS1» resta «AS1»; un nome vero resta intero (lo accorcia il CSS)
  const breve = k => { const s = String(k), p = s.split('-'); return /^[A-Z0-9]+(-[A-Z0-9]+)+$/i.test(s) && s.length <= 14 ? p[p.length - 1] : s; };
  const gente = g => (g == null ? 'grandezza non nota' : g >= 1e7 ? 'oltre 10 mln' : g >= 1e6 ? nf(g / 1e6, 1) + ' mln' : ni(g / 1000) + ' mila');
  // «il 28% in meno della media della campagna»
  const rel = x => (Math.abs(x - 1) < 0.03 ? 'come la media della campagna' : `il ${ni(Math.abs(x - 1) * 100)}% ${x > 1 ? 'in più' : 'in meno'} della media della campagna`);
  // effetto del budget scelto con i cursori sui numeri di un pubblico
  function conFattore(k, g) {
    const r = S.budget[k] / D.adset[k].budget_test, e = D.par.elasticita;
    return { spesa: g.spesa * r, imp: g.imp * Math.pow(r, 1 - e), clk: g.clk * Math.pow(r, 1 - e), cpm: g.cpm * Math.pow(r, e), ctr: g.ctr };
  }

  /* ---------------------------------------------------------------- registro */
  function registra(msg) {
    const el = $('#registro'); if (!el) return;
    const t = new Date(), ora = t.toTimeString().slice(0, 8) + '.' + String(t.getMilliseconds()).padStart(3, '0');
    el.insertAdjacentHTML('beforeend', `<div><span>${ora}</span>${esc(msg)}</div>`);
    while (el.children.length > 90) el.firstChild.remove();
    el.scrollTop = el.scrollHeight;
  }
  function registraLista(righe) { righe.forEach((r, i) => setTimeout(() => registra(r), i * 140)); }
  function stato() {}   // lo stato del motore si legge nei passi: niente spie separate

  /* ------------------------------------------------------------------ viste */
  function mostra(v) {
    if (document.body.dataset.vista === v) return;
    document.body.dataset.vista = v;
    $$('.vista').forEach(s => { s.hidden = s.id !== 'v-' + v; });
    window.scrollTo(0, 0);
  }
  function instrada() {
    const p = location.hash.replace(/^#\/?/, '').split('/');
    if (p[0] === 'console') { play(false); mostra('console'); follaAvvio(); (D ? Promise.resolve() : dati()).then(() => rCapito(false)); return; }
    if (p[0] === 'come') { play(false); mostra('come'); return; }
    if (p[0] === 'analisi') {
      play(false);
      (D || window.Analisi.haDati() ? Promise.resolve() : dati()).then(() => { mostra('analisi'); window.Analisi.mostra(p[1] === 'numeri' ? 'analisi' : 'persone'); });
      return;
    }
    if (p[0] === 'nuova') { play(false); mostra('nuova'); window.Nuova.apri(S.testoConsole); return; }
    if (p[0] !== 'sim') { play(false); mostra('benvenuto'); return; }
    (D ? Promise.resolve() : dati()).then(() => {
      mostra('sim');
      S.passo = ((p[1] === 'consegne' && kit()) || PASSI.some(x => x.id === p[1])) ? p[1] : 'dati';
      if (!palco) rCampagne();
      rInUso();
      rPasso();
    });
  }
  function rCampagne() {
    $('#campagne').innerHTML = D.campagne.map(x => `<button role="tab" aria-selected="${x.id === S.campagna}" data-c="${x.id}">${esc(x.nome)}</button>`).join('');
    $$('#campagne button').forEach(b => b.addEventListener('click', () => {
      play(false); S.campagna = b.dataset.c; S.adset = null; S.ad = null; S.giorno = 0; palco = null; rCampagne(); rPasso();
      registra('Campagna: ' + camp().nome);
    }));
  }

  /* ------------------------------------------------------------------ palco */
  const DUR = 4.5, RITMO = 1.3; // secondi per giorno simulato, reazioni al secondo nel pubblico piu attivo
  function rPalco(noto) {
    const c = camp(), giorni = D.meta.giorni, el = $('#zone');
    const maxClk = Math.max(...c.adset.flatMap(k => giorni.map(d => D.zona[k][d].clk)));
    el.innerHTML = c.adset.map((k, i) => {
      const a = D.adset[k];
      return `<article class="zona" data-as="${k}" tabindex="0" role="button" aria-label="${noto ? TIPI[a.tipo] : 'Ad set ' + (i + 1)}">
        <header><div><b>${noto ? TIPI[a.tipo] : 'Ad set ' + (i + 1)}</b><span class="sigla mono">${breve(k)}</span></div><span class="gente mono">${noto ? gente(a.grandezza) : 'pubblico da definire'}</span></header>
        <div class="vivo"><i class="punto"></i><div><span class="cart-tag mono"></span><p class="cart-titolo"></p></div></div>
        <canvas></canvas>
        <dl class="kpi"><div><dt>Budget</dt><dd data-n="bud"></dd></div><div><dt>CPM</dt><dd data-n="cpm"></dd></div><div><dt>CTR</dt><dd data-n="ctr"></dd></div><div><dt>Click</dt><dd data-n="clk"></dd></div></dl>
      </article>`;
    }).join('');
    const scene = {};
    c.adset.forEach(k => {
      const sc = new Flock.Scena($(`.zona[data-as="${k}"] canvas`, el), { scala: 2, altezza: 118, suolo: 14 }).popola(noto ? nOmini(k) : 6);
      if (!noto) sc.omini.forEach(o => { o.a = 0.45; });
      scene[k] = sc;
    });
    $$('.zona', el).forEach(z => {
      const vai = () => { S.adset = z.dataset.as; S.ad = null; location.hash = '#/sim/simulazione'; if (S.passo === 'simulazione') rPasso(); };
      z.addEventListener('click', vai);
      z.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); vai(); } });
    });
    $('#pz-legenda').innerHTML = `<b class="mono">Come si legge</b><span>Ogni riquadro è un pubblico (ad set)${D.par.leve.some(l => !ignoto(l)) ? '. Il pallino è la leva dell’annuncio:' : ''}</span>${D.par.leve.filter(l => !ignoto(l)).slice(0, 4).map(l => `<span><i class="punto leva-${l}"></i>${leva(l)}</span>`).join('')}
      <p>Più omini, pubblico più grande. Chi <b>esulta</b> vale circa ${ni(maxClk / (RITMO * DUR))} click. Chi <b>dorme</b> ha visto l’annuncio troppe volte.</p>`;
    const totali = d => {
      let sp = 0, im = 0, ck = 0;
      c.adset.forEach(k => { const x = conFattore(k, D.zona[k][d]); sp += x.spesa; im += x.imp; ck += x.clk; });
      return { sp, im, ck };
    };
    const numeri = p => {
      const d = giorni[S.giorno];
      c.adset.forEach(k => { $(`.zona[data-as="${k}"] [data-n="clk"]`, el).textContent = ni(conFattore(k, D.zona[k][d]).clk * p); });
      const cum = $('#sim-cum');
      if (cum) {
        let sp = 0, im = 0, ck = 0;
        giorni.forEach((g, i) => { if (i > S.giorno) return; const t = totali(g), f = i === S.giorno ? p : 1; sp += t.sp * f; im += t.im * f; ck += t.ck * f; });
        cum.innerHTML = `<div><dt>Spesa fin qui</dt><dd>${ni(sp)} €</dd></div><div><dt>Visualizzazioni</dt><dd>${ni(im)}</dd></div><div><dt>Click</dt><dd>${ni(ck)}</dd></div>`;
        $('#sim-barra').style.width = ((S.giorno + p) / giorni.length * 100).toFixed(1) + '%';
        $('#sim-stato').textContent = S.play ? `Giorno ${S.giorno + 1} di ${giorni.length}` : (S.giorno >= giorni.length - 1 ? 'Completata' : `Giorno ${S.giorno + 1} di ${giorni.length}`);
        $('#sim-stato').className = 'stato-b ' + (S.play ? 'corso' : 'ok');
      }
    };
    const aggiorna = p => {
      const d = giorni[S.giorno];
      $('#pz-data').textContent = NOMI_G[dow(d)].slice(0, 3) + ' ' + gm(d);
      const ev = D.meta.eventi[d];
      $('#pz-evento').hidden = !ev; $('#pz-evento').textContent = ev || '';
      $('#pz-slider').value = S.giorno;
      c.adset.forEach(k => {
        const g = D.zona[k][d], x = conFattore(k, g), a = D.ads[g.top.ad], z = $(`.zona[data-as="${k}"]`, el);
        $('.vivo', z).classList.remove('prova');
        $('.punto', z).className = 'punto leva-' + a.leva;
        $('.cart-tag', z).innerHTML = `${tipoAnnuncio(a.leva, a.formato) || 'annuncio in onda'}${g.top.eta < 4 ? ' <em>nuovo</em>' : ''}${a.cold ? ' <em>mai vista</em>' : ''}`;
        $('.cart-titolo', z).textContent = a.titolo;
        $('[data-n="bud"]', z).textContent = ni(S.budget[k]) + ' €';
        $('[data-n="cpm"]', z).textContent = nf(x.cpm) + ' €';
        $('[data-n="ctr"]', z).textContent = nf(x.ctr) + '%';
        scene[k].ritmo = noto ? Math.min(x.clk / maxClk * RITMO, 2.4) : 0;
        scene[k].dormienti(noto ? (1 - g.fat) * 0.9 : 0);
      });
      numeri(p);
    };
    // passo 5: sui cartelloni va l'annuncio in prova
    const prova = (r, L) => {
      const mx = Math.max(...r.righe.map(x => S.budget[x.k] / x.cpm * x.ctr));
      r.righe.forEach(x => {
        const z = $(`.zona[data-as="${x.k}"]`, el), clk = S.budget[x.k] * D.par.spesa_su_budget / x.cpm * 10 * x.ctr;
        $('.vivo', z).classList.add('prova');
        $('.punto', z).className = 'punto leva-' + L.leva;
        $('.cart-tag', z).innerHTML = `${tipoAnnuncio(L.leva, L.formato) || 'annuncio'} <em>in prova</em>`;
        $('.cart-titolo', z).textContent = L.testo || ESEMPIO;
        $('[data-n="bud"]', z).textContent = ni(S.budget[x.k]) + ' €';
        $('[data-n="cpm"]', z).textContent = nf(x.cpm) + ' €';
        $('[data-n="ctr"]', z).textContent = nf(x.ctr) + '%';
        $('[data-n="clk"]', z).textContent = ni(clk);
        scene[x.k].ritmo = S.budget[x.k] / x.cpm * x.ctr / mx * RITMO; scene[x.k].dormienti(0);
      });
    };
    palco = { aggiorna, numeri, prova, totali, giorni, noto, campagna: c.id };
    aggiorna(1);
  }
  function play(on) {
    clearInterval(orologio); orologio = null; S.play = on;
    const ic = $('#pz-icona'); if (ic) ic.setAttribute('d', on ? 'M3 1.5h3v11H3zM8 1.5h3v11H8z' : 'M3 1.5v11l9-5.5z');
    const b = $('#pz-play'); if (b) b.setAttribute('aria-label', on ? 'Pausa' : 'Avvia i 15 giorni');
    if (!palco || !D) return;
    if (S.passo === 'simulazione') stato(on ? 'In corso' : 'Pronto', on);
    if (!on) { palco.numeri(1); return; }
    const ultimo = palco.giorni.length - 1;
    if (S.giorno >= ultimo) S.giorno = 0;
    const riga = () => { const d = palco.giorni[S.giorno], t = palco.totali(d); registra(`${gm(d)} · ${ni(t.ck)} click · CPM ${nf(t.sp / t.im * 1000)} € · CTR ${nf(t.ck / t.im * 100)}%`); };
    let t0 = performance.now();
    palco.aggiorna(0); riga();
    orologio = setInterval(() => {
      const p = (performance.now() - t0) / (DUR * 1000);
      if (p < 1) { palco.numeri(p); return; }
      if (S.giorno >= ultimo) { play(false); registra(`✓ Simulazione completata: ${palco.giorni.length} giorni, ${ni(D.meta.righe_previste)} previsioni`); return; }
      S.giorno++; t0 = performance.now(); palco.aggiorna(0); riga();
    }, 100);
  }

  /* ------------------------------------------------------------------ passi */
  const scarico = () => (D.csv ? URL.createObjectURL(new Blob([D.csv], { type: 'text/csv' })) : 'data/' + D.meta.file_previsioni);
  const scheda = (n, titolo, st, corpo, mono) => `<article class="scheda"><header><span class="num mono">${n}</span><h3>${titolo}</h3>${st ? `<span class="stato-b ${st[1]}"${st[2] ? ` id="${st[2]}"` : ''}>${st[0]}</span>` : ''}</header>${mono ? `<p class="mono riga-m">${mono}</p>` : ''}${corpo}</article>`;
  const avanti = (hash, testo) => `<a class="vai" href="#/sim/${hash}"><span>${testo}</span><span aria-hidden="true">→</span></a>`;

  function rPasso() {
    const i = PASSI.findIndex(x => x.id === S.passo), consegne = S.passo === 'consegne';
    if (S.passo !== 'simulazione' && S.play) play(false);
    $('#passi-nav').innerHTML = PASSI.map((x, j) => `<a href="#/sim/${x.id}" class="${x.id === S.passo ? 'attivo' : j < i ? 'fatto' : ''}"${x.id === S.passo ? ' aria-current="step"' : ''}><span class="mono">${j + 1}</span>${x.nome}</a>`).join('<i aria-hidden="true">›</i>')
      + (kit() ? `<a href="#/sim/consegne" class="fine ${consegne ? 'attivo' : ''}">Consegne</a>` : '');
    const att = $('#passi-nav a.attivo'); if (att) att.scrollIntoView({ block: 'nearest', inline: 'center' });
    const noto = consegne || i >= 1;
    if (!palco || palco.noto !== noto || palco.campagna !== S.campagna) rPalco(noto);
    $('.palco').dataset.passo = consegne ? 6 : i + 1;
    const el = $('#pannello');
    el.scrollTop = 0;
    ({ dati: rDati, pubblici: rPubblici, simulazione: rSimulazione, decisioni: rDecisioni, laboratorio: rLaboratorio, consegne: rConsegne })[S.passo](el);
    if (S.passo !== 'laboratorio') palco.aggiorna(1);
    $$('#zone .zona').forEach(z => z.classList.toggle('scelta', S.passo === 'simulazione' && z.dataset.as === S.adset));
    const chiave = S.passo + '|' + S.campagna;
    if (!S.visti[chiave]) { S.visti[chiave] = true; primaVolta(); }
  }
  function primaVolta() {
    const c = camp();
    if (S.passo === 'dati') {
      registraLista([`Storico letto: ${ni(D.meta.righe_storico)} righe, dal ${gm(D.meta.storico_dal)} al ${gm(D.meta.storico_al)}`,
        `${Object.keys(D.adset).length} ad set, ${D.meta.giorni.length} giorni da prevedere`,
        `Creatività: ${D.meta.creativita}`, ...D.meta.note.slice(0, 4).map(n => 'Nota: ' + accenti(n).split(':')[0]),
        ...D.anomalie.map(a => `Anomalia ${gm(a.data)} · ${a.dove.replace('_', ' ')}`), '✓ Dati pronti']);
    } else if (S.passo === 'pubblici') {
      registraLista([...c.adset.map(k => `${k} → ${TIPI[D.adset[k].tipo]} (${gente(D.adset[k].grandezza)})`), `✓ ${c.adset.length} pubblici immaginati per ${c.nome}`]);
    } else if (S.passo === 'simulazione') {
      registra('Avvio simulazione: ' + c.nome);
      S.giorno = 0; play(true);
    }
  }

  /* ---- riquadro «Dati in uso», sempre visibile sopra i risultati */
  function rInUso() {
    const M = D.meta, nAs = Object.keys(D.adset).length, gSto = giorniTra(M.storico_al, M.storico_dal) + 1;
    const g = M.giorni, ipotesi = M.note.length;
    $('#in-uso').innerHTML = `<div class="in-uso-dati">
        <b class="mono">Dati in uso</b>
        <span class="fonte">${esc(S.etichetta)}</span>
        <span>${D.campagne.length} ${D.campagne.length === 1 ? 'campagna' : 'campagne'} · ${nAs} pubblici · ${ni(M.annunci_storico)} annunci</span>
        <span>storico ${gm(M.storico_dal)} → ${gm(M.storico_al)} (${gSto} giorni)</span>
        <span>previsioni ${gm(g[0])} → ${gm(g[g.length - 1])}</span>
        ${ipotesi ? `<a href="#/sim/dati" class="ipotesi">${ipotesi} ${ipotesi === 1 ? 'nota' : 'note'} su cosa mancava</a>` : '<span class="ok">tutti i dati che servono</span>'}
      </div>
      <div class="glossario mono"><span><b>CTR</b> click ogni 100 visualizzazioni</span><span><b>CPM</b> € ogni 1.000 visualizzazioni</span></div>`;
  }

  /* ---- 1 dati */
  function rDati(el) {
    const M = D.meta, st = D.stagione.cpm, sett = Object.keys(st).sort();
    const gSto = giorniTra(M.storico_al, M.storico_dal) + 1, g = M.giorni, nAs = Object.keys(D.adset).length;
    const elenco = D.campagne.map(c => `<li><b>${esc(c.nome)}</b>${c.descrizione ? ': ' + esc(c.descrizione.replace(/\.$/, '')) : ''} (${c.adset.length} pubblici)</li>`).join('');
    const fonti = M.fonti || M.file_letti.map(f => ({ dato: String(f).split('/').pop(), file: [String(f).split('/').pop()], serve: '', presente: true, senza: '' }));
    el.innerHTML = scheda('01', 'Cosa sto analizzando', FATTO, `
        <p>${D.campagne.length === 1 ? 'Una campagna' : D.campagne.length + ' campagne'}, con ${nAs} pubblici (ad set) e ${ni(M.annunci_storico)} annunci:</p>
        <ul class="punti">${elenco}</ul>
        <p>Lo storico va dal ${gm(M.storico_dal)} al ${gm(M.storico_al)}: ${gSto} giorni, ${ni(M.righe_storico)} righe, una per annuncio e giorno. Da qui Flockets prevede <b>${M.annunci_previsti} annunci dal ${gm(g[0])} al ${gm(g[g.length - 1])}</b>: ${ni(M.righe_previste)} previsioni di CTR e CPM.</p>
        <dl class="tessere quattro"><div><dd>${gSto}</dd><dt>Giorni di storico</dt></div><div><dd>${nAs}</dd><dt>Pubblici</dt></div><div><dd>${ni(M.annunci_storico)}</dd><dt>Annunci</dt></div><div><dd>${g.length}</dd><dt>Giorni da prevedere</dt></div></dl>`)
      + scheda('02', 'Quali dati uso, e per cosa', null, `
        <div class="scorri"><table class="fonti"><thead><tr><th>Dato</th><th>Da dove</th><th>A cosa serve</th></tr></thead><tbody>
          ${fonti.map(f => `<tr class="${f.presente ? '' : 'manca'}"><td><span class="spunta">${f.presente ? '✓' : '–'}</span>${esc(f.dato)}</td>
            <td class="mono">${f.presente ? esc(f.file.length ? f.file.join(', ') : f.dove) : 'non presente'}</td>
            <td>${esc(f.serve)}${!f.presente && f.senza ? `<br><small>Senza: ${esc(f.senza)}.</small>` : ''}</td></tr>`).join('')}
        </tbody></table></div>
        ${M.note.length ? `<p class="sopra-chip mono">Cosa mancava, e cosa ho assunto</p><ul class="avvisi">${M.note.map(n => `<li class="giallo">${esc(accenti(n))}</li>`).join('')}</ul>` : '<p class="nota">Ci sono tutti i dati che servono: nessuna ipotesi aggiuntiva.</p>'}`)
      + scheda('03', 'Giorni esclusi', D.anomalie.length ? [`${D.anomalie.length}`, 'corso'] : ['Nessuno', 'ok'], D.anomalie.length ? `
        <p>Giorni che falserebbero la stima se presi per buoni: non vengono usati per imparare.</p>
        <ul class="avvisi">${D.anomalie.map(a => `<li class="giallo"><b>${gm(a.data)} · ${esc(a.dove.replace('_', ' '))}.</b> ${esc(a.cosa.charAt(0).toUpperCase() + a.cosa.slice(1))}.</li>`).join('')}</ul>` : '<p>Nessun giorno senza click e nessuna spesa fuori budget.</p>')
      + (M.stagione ? scheda('04', 'Andamento del mercato', FATTO, `
        <p>Il costo della pubblicità cambia durante l’anno. Nelle settimane da prevedere, rispetto al solito:</p>
        <dl class="tessere tre">${sett.slice(0, 3).map(w => `<div><dd>${st[w] >= 0 ? '+' : ''}${ni((Math.exp(st[w]) - 1) * 100)}%</dd><dt>Settimana del ${gm(w)}</dt></div>`).join('')}</dl>`)
        : scheda('04', 'Andamento del mercato', ['Non disponibile', 'neutro'], '<p>Nessun dato di mercato: la stagione è considerata piatta e la forchetta delle previsioni è più larga.</p>'))
      + scheda('→', 'Avanti', null, `<p>Il pubblico di ogni ad set non è scritto nei dati: lo ricavo dai numeri.</p>${avanti('pubblici', 'Vai ai pubblici')}`);
  }

  /* ---- persone simulate dentro un pubblico (tarate sulle previsioni del modello) */
  function dentro(k) {
    const x = D.persone && D.persone[k];
    if (!x) return '';
    const piu = tag => { const r = x.segmenti[tag].slice().sort((a, b) => b.quota_click - a.quota_click)[0]; return `${esc(r.etichetta)} (${ni(r.quota_click * 100)}%)`; };
    const donne = x.segmenti.genere.find(r => r.livello === 'donna');
    const T = x.totali, F = x.forchetta;
    return `<p class="dentro"><b>Chi clicca, tra le persone simulate:</b> ${ni(donne.quota_click * 100)}% donne · età più presente ${piu('eta')} · ${piu('area')} · ${piu('reddito')}.
      <br><b>Acquisti stimati:</b> circa ${ni(T.acquisti)} in ${D.meta.giorni.length} giorni (tra ${ni(F.acquisti[0])} e ${ni(F.acquisti[1])}), ${ni(T.cpa)} € l’uno. <span class="tenue">Nel kit non ci sono acquisti: è una stima dalle persone.</span></p>`;
  }

  /* ---- 02 pubblici */
  function rPubblici(el) {
    const c = camp(), gr = c.adset.map(k => D.adset[k].grandezza);
    el.innerHTML = scheda('01', 'Pubblici immaginati', FATTO, `
        <p>Flockets ricava il pubblico da tre segnali: quanto costa raggiungerlo (CPM), quanto reagisce (CTR) e quanto spesso le stesse persone rivedono l’annuncio (frequenza).</p>
        <dl class="tessere tre"><div><dd>${c.adset.length}</dd><dt>Pubblici</dt></div><div><dd>${gente(Math.min(...gr))}</dd><dt>Il più piccolo</dt></div><div><dd>${gente(Math.max(...gr))}</dd><dt>Il più grande</dt></div></dl>
        <p class="sopra-chip mono">Profili generati</p>
        <div class="profili">${c.adset.map(k => {
          const a = D.adset[k];
          return `<div class="profilo"><header><b>${TIPI[a.tipo]}</b><span class="mono">@${k}</span></header>
            <ul class="numeri-p">
              <li><b>Quanti sono:</b> ${a.grandezza == null ? 'non si può stimare' : (a.grandezza >= 1e7 ? 'oltre 10 milioni' : 'circa ' + gente(a.grandezza)) + ' di persone'}</li>
              <li><b>Quanto cliccano:</b> ${rel(a.ctr_rel)}</li>
              <li><b>Quanto costano:</b> ${rel(a.cpm_rel)}</li>
              <li><b>Quante volte lo vedono:</b> ${nf(a.frequenza)} al giorno, a persona</li>
              ${a.leva && a.leva !== 'nessuna differenza netta' && !ignoto(a.leva) ? `<li><b>Rende di più con:</b> ${leva(a.leva)}</li>` : ''}
            </ul>
            <p>${CHI[a.tipo](a.vertical)}</p>${dentro(k)}<p class="nota">${esc(accenti(a.motivazione.charAt(0).toUpperCase() + a.motivazione.slice(1)))}.</p></div>`;
        }).join('')}</div>
        <p class="nota">La grandezza è un ordine di grandezza: viene da quanto sale la frequenza quando sale il budget. L’età non è nei dati: resta un’ipotesi.</p>`)
      + (D.persone && Object.keys(D.persone).length ? scheda('02', 'Alcune persone dentro questi pubblici', ['Simulate', 'neutro'], `
        <div class="persone">${c.adset.filter(k => D.persone[k]).map(k => D.persone[k].persone.slice(0, 1).map(p => `<div class="persona ${p.esito === 'compra' ? 'compra' : p.esito === 'clicca' ? 'clicca' : 'passa'}">
            <header><span class="avatar">${esc(p.nome[0])}</span><div><b>${esc(p.nome)}, ${p.eta} anni</b><small>${esc(p.regione)} · ${TIPI[D.adset[k].tipo]}</small></div></header>
            <p class="chi">${esc(p.lavoro)} · ${esc(p.reddito)} · ${esc(p.famiglia)}</p>
            <p class="cosa"><span class="bollino">${p.esito === 'compra' ? 'ha comprato' : p.esito === 'clicca' ? 'ha cliccato' : (p.genere === 'uomo' ? 'è passato oltre' : 'è passata oltre')}</span> visto ${p.visto} ${p.visto === 1 ? 'volta' : 'volte'}</p>
            <ul>${p.perche.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('')).join('')}</div>
        <p class="nota">Ogni pubblico è fatto di persone virtuali (età, genere, area, reddito, famiglia…), tarate perché i loro click e costi tornino con le previsioni. Per una campagna senza dati: <a href="#/nuova">Campagna nuova</a>.</p>`) : '')
      + scheda('03', 'Pubblici pronti', null, `<p>Ora gli annunci vanno davanti ai pubblici, un giorno alla volta, dal ${gm(D.meta.giorni[0])} al ${gm(D.meta.giorni[D.meta.giorni.length - 1])}.</p>${avanti('simulazione', 'Vai alle previsioni')}`);
  }

  /* ---- 03 simulazione */
  function rSimulazione(el) {
    const c = camp();
    if (!S.adset || !c.adset.includes(S.adset)) S.adset = c.adset[0];
    const annunci = Object.keys(D.perAd).filter(a => D.ads[a].adset === S.adset);
    if (!S.ad || !annunci.includes(S.ad)) S.ad = annunci[0];
    const ad = D.ads[S.ad], P = D.perAd[S.ad];
    const inizio = piu(D.meta.storico_al, -20), fine = D.meta.giorni[D.meta.giorni.length - 1];
    const giorni = []; for (let d = inizio; d <= fine; d = piu(d, 1)) giorni.push(d);
    const perD = Object.fromEntries(P.map(p => [p.d, p])), H = D.histAd[S.ad] || {};
    const col = f => giorni.map(d => (perD[d] ? perD[d][f] : null));
    const sto = f => giorni.map(d => (H[d] && !H[d].anom ? H[d][f] : null));
    const sp = P.reduce((s, p) => s + p.spesa, 0), im = P.reduce((s, p) => s + p.imp, 0), ck = P.reduce((s, p) => s + p.clk, 0);
    const ev = {}; Object.entries(D.meta.eventi).forEach(([d, n]) => { if (/Black Friday|Cyber/.test(n)) ev[d] = n; });
    if (!Object.keys(ev).length) Object.entries(D.meta.eventi).filter(([d]) => d >= D.meta.giorni[0] && d <= fine).slice(0, 2).forEach(([d, n]) => { ev[d] = n; });
    el.innerHTML = scheda('01', `I ${D.meta.giorni.length} giorni, uno alla volta`, ['', 'ok', 'sim-stato'], `
        <p>Nel pubblico simulato ogni riquadro è un pubblico: gli omini che esultano sono i click, quelli che dormono hanno visto l’annuncio troppe volte. Qui sotto, i totali della campagna fino al giorno mostrato.</p>
        <dl class="tessere tre" id="sim-cum"></dl>
        <div class="avanzamento"><i id="sim-barra"></i></div>`, null)
      + scheda('02', 'Previsioni per annuncio', FATTO, `
        <div class="gruppo" role="tablist" aria-label="Pubblico">${c.adset.map(k => `<button data-as="${k}" aria-selected="${k === S.adset}">${TIPI[D.adset[k].tipo]}</button>`).join('')}</div>
        <div class="gruppo annunci" role="tablist" aria-label="Annuncio">${annunci.map(a => `<button data-ad="${a}" aria-selected="${a === S.ad}"><i class="punto leva-${D.ads[a].leva}"></i>${esc(D.ads[a].titolo)}</button>`).join('')}</div>
        <div class="annuncio">
          <p class="chips mono">${tipoAnnuncio(ad.leva, ad.formato) ? `<span><i class="punto leva-${ad.leva}"></i>${tipoAnnuncio(ad.leva, ad.formato)}</span>` : ''}<span class="aff-${P[0].aff}">affidabilità ${P[0].aff}</span><span>${STADI[P[0].stadio] || P[0].stadio}</span></p>
          <h4>${esc(ad.titolo)}</h4><p class="tenue">${esc(ad.visual)}</p>
          ${ad.cold ? '<p class="nota">Questa creatività non ha storico: la stima viene dalle sue caratteristiche, quindi la forchetta è larga.</p>' : ''}
        </div>
        <dl class="tessere quattro"><div><dd>${nf(ck / im * 100)}%</dd><dt>CTR previsto</dt></div><div><dd>${nf(sp / im * 1000)} €</dd><dt>CPM previsto</dt></div><div><dd>${nf(sp / ck)} €</dd><dt>Costo per click</dt></div><div><dd>${ni(ck)}</dd><dt>Click in ${P.length} giorni</dt></div></dl>
        <p class="frase">Dal ${gm(P[0].d)} al ${gm(P[P.length - 1].d)} questo annuncio dovrebbe essere visto circa <b>${ni(im)} volte</b> e ricevere <b>${ni(ck)} click</b>: ${nf(ck / im * 100)} ogni 100 visualizzazioni. Mille visualizzazioni costano in media ${nf(sp / im * 1000)} €, un click ${nf(sp / ck)} €.
          Affidabilità ${P[0].aff}: ${AFF[P[0].aff] || ''}.</p>
        <figure><figcaption>CTR <span class="mono">click ogni 100 visualizzazioni</span></figcaption><div id="g-ctr"></div></figure>
        <figure><figcaption>CPM <span class="mono">euro ogni 1.000 visualizzazioni</span></figcaption><div id="g-cpm"></div></figure>
        <p class="nota"><b>Come si legge.</b> I punti grigi sono i giorni già avvenuti, la linea blu è la previsione. La fascia scura dice dove sta il valore di fondo; la fascia chiara dove cadrà il numero di quel giorno, 8 volte su 10. Più la fascia è larga, meno ci fidiamo.</p>
        <details><summary>Tabella giorno per giorno</summary>
          <div class="scorri"><table><thead><tr><th>Giorno</th><th>CTR previsto</th><th>8 volte su 10 tra</th><th>CPM previsto</th><th>8 volte su 10 tra</th><th>Click</th></tr></thead>
          <tbody>${P.map(p => `<tr><td>${NOMI_G[dow(p.d)].slice(0, 3)} ${gm(p.d)}</td><td>${nf(p.ctr)}%</td><td>${nf(p.c10)} – ${nf(p.c90)}</td><td>${nf(p.cpm)} €</td><td>${nf(p.m10)} – ${nf(p.m90)}</td><td>${ni(p.clk)}</td></tr>`).join('')}</tbody></table></div>
        </details>
        <p><a class="pulsante bordo" href="${scarico()}" download="${D.meta.file_previsioni}">Scarica tutte le previsioni (CSV)</a></p>`, `${ni(D.meta.righe_previste)} righe · affidabilità: ${['alta', 'media', 'bassa'].map(a => (D.meta.affidabilita[a] || 0) + ' ' + a).join(', ')}`)
      + scheda('03', 'Previsioni pronte', null, `<p>Con le previsioni in mano si decide: quanto budget, dove, e quale creatività.</p>${avanti('decisioni', 'Vai alle decisioni')}`);
    const oggi = giorni.indexOf(D.meta.giorni[0]);
    Grafici.linee($('#g-ctr'), {
      titolo: 'CTR', giorni, oggi, unita: '%', eventi: ev, altezza: 200,
      serie: [{ nome: 'storico', colore: GRIGIO, valori: sto('ctr'), punti: true, spessore: 1.3 }, { nome: 'previsto', colore: BLU, valori: col('ctr'), spessore: 2.2 }],
      fasce: [{ nome: 'quel giorno', colore: BLU, opacita: 0.12, basso: col('c10'), alto: col('c90') }, { nome: 'valore di fondo', colore: BLU, opacita: 0.24, basso: col('a10'), alto: col('a90') }],
    });
    Grafici.linee($('#g-cpm'), {
      titolo: 'CPM', giorni, oggi, unita: ' €', eventi: ev, altezza: 200,
      serie: [{ nome: 'storico', colore: GRIGIO, valori: sto('cpm'), punti: true, spessore: 1.3 }, { nome: 'previsto', colore: BLU, valori: col('cpm'), spessore: 2.2 }],
      fasce: [{ nome: 'quel giorno', colore: BLU, opacita: 0.18, basso: col('m10'), alto: col('m90') }],
    });
    const ridisegna = () => { const y = el.scrollTop; rSimulazione(el); el.scrollTop = y; palco.numeri(S.play ? 0 : 1); $$('#zone .zona').forEach(z => z.classList.toggle('scelta', z.dataset.as === S.adset)); };
    $$('[data-as]', el).forEach(b => b.addEventListener('click', () => { S.adset = b.dataset.as; S.ad = null; ridisegna(); }));
    $$('[data-ad]', el).forEach(b => b.addEventListener('click', () => { S.ad = b.dataset.ad; ridisegna(); }));
  }

  /* ---- 04 decisioni */
  function baseAdset(k) {
    let sp = 0, im = 0, ck = 0;
    D.meta.giorni.forEach(d => { const g = D.zona[k][d]; sp += g.spesa; im += g.imp; ck += g.clk; });
    return { sp, im, ck, B0: D.adset[k].budget_test, n: D.meta.giorni.length };
  }
  function conBudget(k, B) {
    const b = baseAdset(k), e = D.par.elasticita, r = B / b.B0, A = D.adset[k];
    const clk = b.ck * Math.pow(r, 1 - e), spesa = b.sp * r;
    return { spesa: spesa / b.n, clk: clk / b.n, cpm: b.sp / b.im * 1000 * Math.pow(r, e), cpc: spesa / clk, freq: A.freq_c0 + A.freq_c1 * (b.im / b.n) * Math.pow(r, 1 - e) };
  }
  function tempoPerdita(leva, quota) {
    const c = D.par.fatica[leva] || Object.values(D.par.fatica)[0];
    if (!c || c[0] >= quota) return null;   // la curva non scende mai fino a quella quota
    const [fl, tau] = c;
    return Math.round(-tau * Math.log((quota - fl) / (1 - fl)));
  }
  function rDecisioni(el) {
    const c = camp(), e = D.par.elasticita;
    const piano = c.adset.reduce((s, k) => s + D.adset[k].budget_test, 0);
    const annunci = Object.keys(D.perAd).filter(a => c.adset.includes(D.ads[a].adset));
    const riass = annunci.map(a => {
      const P = D.perAd[a], sp = P.reduce((s, p) => s + p.spesa, 0), ck = P.reduce((s, p) => s + p.clk, 0);
      return { a, ad: D.ads[a], cpc: sp / ck, fat: P[P.length - 1].fat, primo: P[0] };
    });
    const stanche = riass.filter(x => x.fat <= 0.7).sort((x, y) => x.fat - y.fat).slice(0, 3);
    const migliori = c.adset.map(k => riass.filter(x => x.ad.adset === k).sort((x, y) => x.cpc - y.cpc)[0]);
    const nuove = riass.filter(x => x.ad.cold);
    el.innerHTML = scheda('01', 'Dove mettere il budget', ['Interattivo', 'neutro'], `
        <p>Un cursore per pubblico: è il budget al giorno. Spostalo e costi e click si ricalcolano subito, anche nel pubblico simulato a sinistra.</p>
        <div id="dec-righe">${c.adset.map(k => `
          <div class="dec-riga" data-as="${k}">
            <label for="b-${k}"><b>${TIPI[D.adset[k].tipo]}</b><span class="sigla mono">${breve(k)}</span></label>
            <output class="dec-b"></output>
            <input type="range" id="b-${k}" min="${Math.round(D.adset[k].budget_test * 0.5)}" max="${Math.round(D.adset[k].budget_test * 2)}" step="1" value="${S.budget[k]}">
            <p class="dec-d mono"></p>
          </div>`).join('')}</div>
        <div class="azioni"><button class="pulsante nero" id="dec-proposta">Proposta di Flockets</button><button class="pulsante bordo" id="dec-piano">Piano attuale</button></div>
        <dl class="tessere tre" id="dec-totale"></dl>
        <p class="nota">Il CPM sale quando si spinge su un pubblico: con il doppio del budget arriva circa il ${ni((Math.pow(2, 1 - e) - 1) * 100)}% di click in più, non il 100%. Click non vuol dire vendite: il pubblico ampio alimenta quelli caldi.</p>`, null)
      + scheda('02', 'Quale creatività, e quando cambiarla', FATTO, `
        <ul class="avvisi">
          ${stanche.map(x => `<li class="rosso"><b>Da sostituire.</b> «${esc(x.ad.titolo)}» (${breve(x.ad.adset)}) al ${gm(D.meta.giorni[D.meta.giorni.length - 1])} avrà perso il ${ni((1 - x.fat) * 100)}% della forza iniziale.</li>`).join('')}
          ${migliori.map(x => `<li class="verde"><b>Rende di più in ${breve(x.ad.adset)}.</b> «${esc(x.ad.titolo)}»: ${nf(x.cpc)} € a click.</li>`).join('')}
          ${nuove.map(x => `<li class="giallo"><b>Mai vista.</b> «${esc(x.ad.titolo)}» (${breve(x.ad.adset)}) parte il ${gm(x.primo.d)}: CTR stimato ${nf(x.primo.ctr)}%, ma può stare tra ${nf(x.primo.a10)} e ${nf(x.primo.a90)}. Da controllare dopo tre giorni.</li>`).join('')}
        </ul>
        <p class="nota"><b>Quando.</b> ${D.par.fatica.urgency && D.par.fatica.scarcity
          ? `Un annuncio di urgenza perde un quarto della forza in ${tempoPerdita('urgency', 0.75)} giorni, uno di scarsità in ${tempoPerdita('scarcity', 0.75)}.`
          : tempoPerdita('', 0.75) ? `Un annuncio perde un quarto della forza in circa ${tempoPerdita('', 0.75)} giorni.` : ''} Un annuncio nuovo paga il CPM più caro per i primi tre giorni: meglio lanciarlo prima del giorno che conta, non il giorno stesso.</p>`)
      + scheda('03', 'Decisioni prese', null, `<p>Manca un’idea nuova? Provala sul pubblico prima di produrla.</p>${avanti('laboratorio', 'Prova un annuncio nuovo')}`);
    const agg = () => {
      let tot = 0, ck = 0, ck0 = 0, sp = 0;
      c.adset.forEach(k => {
        const B = S.budget[k], x = conBudget(k, B), x0 = conBudget(k, D.adset[k].budget_test), riga = $(`.dec-riga[data-as="${k}"]`, el);
        tot += B; ck += x.clk; ck0 += x0.clk; sp += x.spesa;
        const d = (B / D.adset[k].budget_test - 1) * 100;
        $('.dec-b', riga).innerHTML = `${ni(B)} € <i class="${d > 0.5 ? 'su' : d < -0.5 ? 'giu' : ''}">${d > 0 ? '+' : ''}${ni(d)}%</i>`;
        $('.dec-d', riga).textContent = `Al giorno: ${ni(x.clk)} click a ${nf(x.cpc)} € l’uno; 1.000 visualizzazioni costano ${nf(x.cpm)} €; ogni persona lo vede ${nf(x.freq)} volte`;
      });
      const dc = (ck / ck0 - 1) * 100, db = tot - piano;
      $('#dec-totale').innerHTML = `<div><dd>${ni(tot)} €</dd><dt>Budget al giorno</dt><small class="${Math.abs(db) < 1 ? '' : db > 0 ? 'su' : 'giu'}">${Math.abs(db) < 1 ? 'come il piano' : (db > 0 ? '+' : '') + ni(db) + ' € sul piano'}</small></div>
        <div><dd>${ni(ck)}</dd><dt>Click al giorno</dt><small class="${dc > 0.05 ? 'su' : dc < -0.05 ? 'giu' : ''}">${dc >= 0 ? '+' : ''}${nf(dc, 1)}% sul piano</small></div>
        <div><dd>${nf(sp / ck)} €</dd><dt>Costo per click</dt></div>`;
      if (palco) palco.aggiorna(1);
      return dc;
    };
    $$('.dec-riga input', el).forEach(i => i.addEventListener('input', () => { S.budget[i.closest('.dec-riga').dataset.as] = +i.value; agg(); }));
    const metti = (f, nome) => { c.adset.forEach(k => { S.budget[k] = f(k); $('#b-' + k).value = S.budget[k]; }); const dc = agg(); registra(`${nome}: ${dc >= 0 ? '+' : ''}${nf(dc, 1)}% click sul piano`); };
    $('#dec-piano').addEventListener('click', () => metti(k => D.adset[k].budget_test, 'Piano attuale'));
    $('#dec-proposta').addEventListener('click', () => metti(k => D.adset[k].budget_proposto, 'Proposta applicata'));
    agg();
  }

  /* ---- 05 laboratorio */
  function leggiTesto(t) {
    const s = t.toLowerCase(), f = {};
    Object.entries(D.par.feat_regole).forEach(([k, rx]) => { f[k] = new RegExp(rx).test(s) ? 1 : 0; });
    const c = (x, lista) => (lista.includes(x) ? x : lista[0]);
    const formato = c(/video|reel|secondi|filmato/.test(s) ? 'video' : /carosello|schede|slide/.test(s) ? 'carosello' : 'immagine', D.par.formati);
    const lv = c(/black/.test(s) ? 'black_friday' : /solo oggi|scade|mezzanotte|24 ore|48 ore|countdown|timer|fino a domenica|stanotte/.test(s) ? 'urgency' : 'scarcity', D.par.leve);
    return { f, formato, leva: lv, fonte: 'regole' };
  }
  /* Lettura con Claude (funzione /api/leggi). Se manca la chiave o la rete, restano le regole qui sopra. */
  const IA = { attiva: null, t: null, ultimo: null };
  function iaPronta() {
    if (IA.attiva !== null) return Promise.resolve(IA.attiva);
    return fetch('api/leggi').then(r => (r.ok ? r.json() : { attiva: false })).then(j => (IA.attiva = !!j.attiva)).catch(() => (IA.attiva = false));
  }
  function chiediIA(testo) {
    if (IA.ultimo && IA.ultimo.testo === testo) return IA.ultimo.p;
    const p = iaPronta().then(ok => {
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
    IA.ultimo = { testo, p };
    return p;
  }
  const fonteTesto = B => (B.fonte === 'ia' ? 'letto da Claude Haiku' : B.attesa && IA.attiva !== false ? 'lettura in corso…' : 'letto con parole chiave');
  function logFatica(eta, leva) {
    // come nel motore: la curva della sua leva; senza curva propria, la media delle curve stimate
    const F = D.par.fatica, lf = k => { const [fl, tau] = F[k]; return Math.log(fl + (1 - fl) * Math.exp(-eta / tau)); };
    if (F[leva]) return lf(leva);
    const k = Object.keys(F);
    return k.length ? k.reduce((s, x) => s + lf(x), 0) / k.length : 0;
  }
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
  function rLaboratorio(el) {
    const c = camp();
    if (!S.lab) { const t = S.testoConsole || ESEMPIO; S.lab = Object.assign({ testo: t, lancio: D.meta.giorni[0], budget: null }, leggiTesto(t)); }
    const L = S.lab;
    el.innerHTML = scheda('01', 'Descrivi l’annuncio', ['Interattivo', 'neutro'], `
        <label class="nascosta" for="lab-testo">Descrizione dell’annuncio</label>
        <textarea id="lab-testo" class="mono" rows="3">${esc(L.testo)}</textarea>
        <p><button class="pulsante nero" id="lab-leggi">Leggi la descrizione</button> <span class="mono tenue" id="lab-fonte"></span></p>
        <p class="nota" id="lab-motivo" hidden></p>
        <p class="nota">Flockets riconosce le caratteristiche che nello storico spostano il CTR. Puoi correggerle a mano.</p>
        <div class="campi">
          <label>Formato <select id="lab-formato">${D.par.formati.map(v => `<option${v === L.formato ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
          <label>Leva <select id="lab-leva">${D.par.leve.map(v => `<option value="${v}"${v === L.leva ? ' selected' : ''}>${leva(v)}</option>`).join('')}</select></label>
          <label>Lancio <select id="lab-lancio">${D.meta.giorni.slice(0, 12).map(d => `<option value="${d}"${d === L.lancio ? ' selected' : ''}>${NOMI_G[dow(d)].slice(0, 3)} ${gm(d)}</option>`).join('')}</select></label>
          <label>Budget al giorno, € <input type="number" id="lab-budget" min="1" step="1" inputmode="numeric" placeholder="facoltativo" value="${L.budget || ''}"></label>
        </div>
        <div class="spunte">${Object.entries(CARATT).map(([k, n]) => `<label><input type="checkbox" data-f="${k}"${L.f[k] ? ' checked' : ''}> ${n}</label>`).join('')}</div>`, 'descrizione → caratteristiche → qualità stimata')
      + `<div id="lab-esito"></div>`
      + scheda('03', 'Tutto pronto', null, `<p>Strumento, previsioni e ragionamento: le tre consegne della sfida.</p>${avanti('consegne', 'Vedi le consegne')}`);
    const esito = (scrivi) => {
      const r = stima(c, L), su = Math.exp(1.28 * D.par.cold_sd), max = Math.max(...r.righe.map(x => x.per100));
      const top = r.righe.slice().sort((a, b) => b.per100 - a.per100)[0];
      $('#lab-esito').innerHTML = scheda('02', `Come reagisce il pubblico di ${esc(c.nome)}`, ['Stima a freddo', 'corso'], `
        <p class="verdetto">Meglio di <b>${r.sotto} creatività su ${r.tot}</b> già viste in questa campagna.</p>
        ${r.righe.map(x => `
          <div class="lab-riga${x.k === top.k ? ' top' : ''}">
            <div class="lab-nome"><b>${TIPI[D.adset[x.k].tipo]}</b><span class="sigla mono">${breve(x.k)}</span></div>
            <div class="lab-num">${L.budget ? `<b>${ni(L.budget * D.par.spesa_su_budget * x.per100 / 100)}</b> click al giorno con ${ni(L.budget)} €` : `<b>${ni(x.per100)}</b> click ogni 100 €`}</div>
            <div class="barra-o"><i style="width:${(x.per100 / max * 100).toFixed(1)}%"></i></div>
            <div class="lab-det mono">CTR ${nf(x.ctr)}% (tra ${nf(x.ctr / su)} e ${nf(x.ctr * su)}) · CPM ${nf(x.cpm)} € · ${nf(x.cpc)} € a click</div>
          </div>`).join('')}
        <p class="nota">Media dei primi ${r.giorni} giorni dal lancio. L’annuncio non ha storico, quindi la forchetta è larga. Rende di più su <b>${TIPI[D.adset[top.k].tipo]}</b>.</p>`);
      palco.prova(r, L);
      if (scrivi) registra(`Annuncio provato (${leva(L.leva)}, ${L.formato}): rende di più su ${TIPI[D.adset[top.k].tipo]}, ${ni(top.per100)} click ogni 100 €`);
    };
    const campi = () => {
      $('#lab-formato').value = L.formato; $('#lab-leva').value = L.leva;
      $$('.spunte input', el).forEach(i => { i.checked = !!L.f[i.dataset.f]; });
      $('#lab-fonte').textContent = fonteTesto(L);
      $('#lab-motivo').hidden = !(L.fonte === 'ia' && L.motivo);
      $('#lab-motivo').textContent = L.fonte === 'ia' && L.motivo ? 'Perché: ' + L.motivo : '';
    };
    $('#lab-leggi').addEventListener('click', () => {
      const t = $('#lab-testo').value;
      L.testo = t; Object.assign(L, leggiTesto(t), { motivo: '', attesa: true }); campi(); esito(true);
      chiediIA(t.trim()).then(b => {
        if ($('#lab-testo').value !== t || S.lab !== L) return;
        L.attesa = false;
        if (b) { Object.assign(L, b); registra(`Descrizione letta da Claude Haiku: ${L.formato}, ${leva(L.leva)}`); }
        if ($('#lab-fonte')) { campi(); if (b) esito(false); }
      });
    });
    campi();
    $('#lab-formato').addEventListener('change', e => { L.formato = e.target.value; esito(true); });
    $('#lab-leva').addEventListener('change', e => { L.leva = e.target.value; esito(true); });
    $('#lab-lancio').addEventListener('change', e => { L.lancio = e.target.value; esito(true); });
    $('#lab-budget').addEventListener('input', e => { L.budget = +e.target.value || null; esito(false); });
    $$('.spunte input', el).forEach(i => i.addEventListener('change', () => { L.f[i.dataset.f] = i.checked ? 1 : 0; esito(true); }));
    esito(true);
  }

  /* ---- consegne */
  function rConsegne(el) {
    const v = (g, m) => D.validazione.find(x => x.gruppo === g && x.modello === m) || {};
    const conMinimo = v('tutti', 'strutturale').min_ctr != null;
    const NUMERI = ['Una volta', 'Due volte', 'Tre volte', 'Quattro volte', 'Cinque volte', 'Sei volte', 'Sette volte'];
    const volte = NUMERI[(v('tutti', 'strutturale').tagli || 4) - 1] || (v('tutti', 'strutturale').tagli + ' volte');
    const riga = (n, g, f) => `<tr><td>${n}</td><td><b>${nf(v(g, 'strutturale')[f], 1)}%</b></td><td>${nf(v(g, 'ultimi 7 giorni')[f], 1)}%</td>${conMinimo ? `<td>${nf(v(g, 'strutturale')['min_' + f], 1)}%</td>` : ''}</tr>`;
    const P = D.par, peso = k => (Math.exp(P.feat_w[P.feat_cols.indexOf(k) + 1]) - 1) * 100;
    el.innerHTML = scheda('01', 'Lo strumento', FATTO, `
        <p>È questo sito, più il motore di previsione che gli sta dietro. Il motore è scritto in Python e si rilancia con un comando: rifà da zero stima, validazione e previsioni in pochi secondi.</p>
        <p><a class="pulsante nero" href="${REPO}" target="_blank" rel="noopener">Apri il codice ↗</a></p>`, 'python3 esegui.py dati')
      + scheda('02', 'Le previsioni', FATTO, `
        <p><b>${ni(D.meta.righe_previste)} righe</b>: ${D.meta.annunci_previsti} annunci, ogni giorno dal ${gm(D.meta.giorni[0])} al ${gm(D.meta.giorni[D.meta.giorni.length - 1])}. Per ogni riga CTR e CPM con la loro forchetta, più costo per click, spesa, impression e click.</p>
        <p>${D.meta.righe_cold} righe riguardano creatività mai viste nello storico: sono stimate dalle caratteristiche dell’annuncio.</p>
        <p><a class="pulsante nero" href="${scarico()}" download="${D.meta.file_previsioni}">Scarica il file (CSV)</a></p>`, D.meta.file_previsioni)
      + scheda('03', 'Il ragionamento', FATTO, `
        <p>Lo storico segue una struttura a fattori che si moltiplicano. Ogni fattore è stimato dai dati.</p>
        <pre class="formula">CTR = qualità dell’asset × pubblico × fatica × stagione × giorno
CPM = livello del pubblico × stagione × giorno
      × (budget ÷ budget iniziale)^${nf(P.elasticita)} × apprendimento × qualità</pre>
        <ol class="scoperte">
          <li><b>Il mercato 2025 anticipa il 2026.</b> Il CPM segue l’indice dell’anno prima spostato di 52 settimane, in rapporto 1 a 1.</li>
          <li><b>La creatività si stanca.</b> L’urgenza perde un quarto della forza in ${tempoPerdita('urgency', 0.75)} giorni, la scarsità in ${tempoPerdita('scarcity', 0.75)}.</li>
          <li><b>Più budget, CPM più alto.</b> Un solo ad set ha avuto il budget raddoppiato per una settimana: da lì si legge quanto sale il CPM.</li>
          <li><b>Fase di apprendimento.</b> Un annuncio nuovo paga il CPM il ${ni((Math.exp(P.cpm_new3) - 1) * 100)}% in più per tre giorni.</li>
          <li><b>Cosa rende forte una creatività.</b> Un aggancio nei primi due secondi vale circa +${ni(peso('hook'))}% di CTR, una grafica piena di testo circa ${ni(peso('testo_pesante'))}%.</li>
          <li><b>Annunci migliori costano meno.</b> Il CPM scende quando la qualità sale e risale quando l’annuncio si stanca.</li>
        </ol>
        <h4>Quanto ci fidiamo</h4>
        <p>Abbiamo nascosto al modello 14 giorni di storico, li abbiamo fatti prevedere e confrontato con i valori veri. ${volte}, su date diverse.</p>
        <div class="scorri"><table><thead><tr><th>Errore medio</th><th>Flockets</th><th>«Come gli ultimi 7 giorni»</th>${conMinimo ? '<th>Minimo possibile</th>' : ''}</tr></thead><tbody>
          ${riga('CPM, tutti gli annunci', 'tutti', 'cpm')}${riga('CPM, annunci nuovi', 'annunci nuovi', 'cpm')}${riga('CTR, tutti gli annunci', 'tutti', 'ctr')}${riga('CTR, annunci nuovi', 'annunci nuovi', 'ctr')}
        </tbody></table></div>
        ${conMinimo ? '<p class="nota">Minimo possibile: l’errore che resterebbe anche a un modello perfetto. Il CPM oscilla da solo da un giorno all’altro; sul CTR, con poche decine di click al giorno per annuncio, conta il caso. Abbiamo provato a spostare ogni parametro del modello: nessuna variazione avvicina di più l’errore a quel minimo.</p>' : ''}
        ${D.generalizzazione && D.generalizzazione.length ? `<h4>Vale anche su un inserzionista mai visto?</h4>
        <p>Abbiamo tolto un inserzionista alla volta. I fattori comuni (fatica, giorno della settimana, effetto del budget, peso delle caratteristiche creative) li abbiamo stimati solo sugli altri due; di lui abbiamo stimato soltanto i livelli.</p>
        <div class="scorri"><table><thead><tr><th>Errore medio</th><th>CPM</th><th>CTR</th></tr></thead><tbody>
          ${D.generalizzazione.map(x => `<tr><td>${x.storia}, ${x.modello}</td><td>${nf(x.cpm, 1)}%</td><td>${nf(x.ctr, 1)}%</td></tr>`).join('')}
        </tbody></table></div>
        <p class="nota">I fattori imparati dagli altri valgono quasi quanto quelli imparati sui suoi dati, e aiutano quando lo storico è corto. È una prova dentro il kit, che è fatto di dati simulati.</p>` : ''}
        ${kit() ? `<h4>E su dati veri?</h4>
        <p>Il kit è simulato. Abbiamo provato il motore su 79 marche vere (dataset pubblico Conjura, 377 prove con 14 giorni nascosti). All’inizio perdeva contro «come gli ultimi 7 giorni»: 22,6% di errore sul CPM contro 18,6%. Ora, quando una prova interna lo consiglia, parte dal livello dell’ultima settimana, ed è alla pari: 18,6%. Sul kit non cambia nulla.</p>
        <p>Nella settimana del Black Friday 2023 l’aumento del CPM dell’anno prima ha anticipato quello vero in rapporto 1 a 1: è la scelta su cui poggiano le nostre previsioni dal 23 al 29 novembre.</p>` : ''}
        <h4>Dove siamo più incerti</h4>
        <ul class="punti"><li>Nello storico non c’è un Black Friday, né un aumento di budget su più ad set insieme.</li><li>L’effetto del budget sul CPM viene da un solo ad set.</li><li>Le creatività mai viste hanno una forchetta larga.</li></ul>
        <p>I pubblici immaginati, con i numeri che li motivano, sono al <a href="#/sim/pubblici">passo 2</a>.</p>`, 'README · video di 3 minuti');
  }

  /* ---------------------------------------------------------------- console */
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
  // scelta dei dati da analizzare: dati della sfida, esempio inventato, oppure un file
  const AVVISI = {
    kit: 'Dati della sfida: 3 marchi, 57 annunci, previsioni dal 16 al 30 novembre. Si aprono subito.',
    esempio: 'Campagna inventata per un gioco per telefono. Il calcolo avviene nel browser: la prima volta circa mezzo minuto.',
    file: 'Il file resta sul tuo computer: il calcolo avviene nel browser. La prima volta circa mezzo minuto.',
    nuova: 'Nessun dato: la campagna viene simulata su 50 milioni di persone virtuali.',
  };
  const SEGNAPOSTO = {
    nuova: 'Descrivi prodotto e annuncio: «Siero viso alla vitamina C, video di 15 secondi, -20% solo oggi»',
    altro: 'Descrivi l’annuncio: «Video su TikTok, una ragazza parla in camera, -30% sulla crema viso, 50 € al giorno per 2 settimane»',
  };
  // niente menu: con un file allegato si analizza il file (e l'annuncio scritto si prova sulle sue campagne);
  // senza file l'annuncio scritto diventa una campagna nuova, simulata sulle persone. I dati della sfida,
  // l'esempio del gioco e il modulo completo si aprono dai link della riga sotto.
  function sorgente(v) {
    S.scelta = v;
    $('#file-chip').hidden = !(v === 'file' && S.file);
    if (v !== 'file') $('#esito-file').innerHTML = '';
    $('#richiesta').placeholder = SEGNAPOSTO.altro;
    const av = $('#avviso');
    if (v === 'file' && S.file) { av.textContent = S.fileKit ? AVVISI.kit : AVVISI.file; return; }
    av.innerHTML = 'Senza file provo l’annuncio su migliaia di persone simulate. Oppure apri <button type="button" class="testo-link" data-vai="kit">i dati della sfida</button>, <button type="button" class="testo-link" data-vai="esempio">l’esempio di un gioco</button> o <button type="button" class="testo-link" data-vai="nuova">il modulo completo</button>.';
    $$('[data-vai]', av).forEach(b => b.addEventListener('click', () => {
      if (b.dataset.vai === 'nuova') { S.testoConsole = $('#richiesta').value.trim(); location.hash = '#/nuova'; return; }
      avvia(b.dataset.vai, b);
    }));
  }
  // omini in fondo alla pagina di partenza: camminano sul prato, escono dai bordi e ne entrano di nuovi;
  // reagiscono solo quando succede qualcosa
  let avvio = null, ultimaReazione = 0;
  // altezza del prato: dal fondo fino a poco sotto la riga di testo sotto l'allegato (mai sopra il prompt)
  function misuraPrato() {
    const sez = $('#v-console'), av = $('#avviso');
    if (!sez || sez.hidden) return 0;
    const fondo = sez.getBoundingClientRect().bottom, sotto = av.getBoundingClientRect().bottom + 22;
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
  function suFile(files) {
    const out = $('#esito-file');
    sorgente('file');
    const lista = Array.from(files).filter(f => /\.csv$/i.test(f.name) || f.type === 'text/csv');
    if (!lista.length) { out.innerHTML = '<p class="errore mono">Serve un file CSV.</p>'; return; }
    out.innerHTML = '<p class="tenue mono">Leggo…</p>';
    Promise.all([dati(), ...lista.map(f => f.text().then(t => ({ nome: f.webkitRelativePath || f.name, testo: t })))]).then(([, ...letti]) => {
      const st = letti.map(x => Object.assign({ nome: x.nome }, controllaStorico(leggiCSV(x.testo)))).filter(x => x.ok).sort((a, b) => b.n - a.n)[0];
      S.file = letti;
      S.fileKit = !!st && st.lista.filter(a => D.ads_storico.includes(a)).length / st.lista.length > 0.9 && st.n > 1000 && kit();
      $('#file-nome').textContent = letti.length === 1 ? letti[0].nome : letti.length + ' file';
      sorgente('file');
      reazione(3, 'csv');
      out.innerHTML = `<ul class="controlli mono">
          ${st ? `<li class="si">${ni(st.n)} righe · ${st.ads} annunci · dal ${gm(st.min)} al ${gm(st.max)}</li>` : '<li class="si">Colonne con nomi diversi da quelli del motore: le riconosco al calcolo</li>'}
          ${st ? st.note.map(x => `<li class="attento">${esc(x)}</li>`).join('') : ''}
          ${S.fileKit ? '<li class="si">Sono i dati della sfida: uso le previsioni già calcolate</li>' : ''}
        </ul>`;
      $('#avviso').textContent = S.fileKit ? AVVISI.kit : AVVISI.file;
    });
  }
  // Zona «Ho capito»: mostra cosa il sito legge dal testo (formato, leva, caratteristiche) e lascia correggere
  function rCapito(rileggi) {
    if (!D) return;
    const testo = $('#richiesta').value.trim(), box = $('#capito');
    if ($('#br-lancio') && !$('#br-lancio').options.length) $('#br-lancio').innerHTML = D.meta.giorni.slice(0, 12).map(d => `<option value="${d}">${NOMI_G[dow(d)].slice(0, 3)} ${gm(d)}</option>`).join('');
    box.hidden = !testo;
    if (!testo) { S.brief = null; clearTimeout(IA.t); return; }
    if (rileggi || !S.brief) {
      // subito le regole a parole chiave; poco dopo, se c'è, la lettura di Claude le sostituisce
      S.brief = Object.assign(leggiTesto(testo), { attesa: true });
      clearTimeout(IA.t);
      IA.t = setTimeout(() => chiediIA(testo).then(b => {
        if (!S.brief || $('#richiesta').value.trim() !== testo) return;
        if (b && !S.brief.manuale) S.brief = b; else S.brief.attesa = false;
        rCapito(false);
      }), 700);
    }
    const B = S.brief;
    $('#capito-fonte').textContent = '· ' + fonteTesto(B);
    $('#capito-motivo').hidden = !(B.fonte === 'ia' && B.motivo);
    $('#capito-motivo').textContent = B.fonte === 'ia' && B.motivo ? 'Perché: ' + B.motivo : '';
    $('#capito-chips').innerHTML =
      D.par.formati.map(v => `<span data-k="formato" data-v="${v}" class="${v === B.formato ? 'si' : ''}">${v}</span>`).join('')
      + D.par.leve.map(v => `<span data-k="leva" data-v="${v}" class="${v === B.leva ? 'si' : ''}">${leva(v)}</span>`).join('')
      + Object.entries(CARATT).map(([k, n]) => `<span data-k="f" data-v="${k}" class="${B.f[k] ? 'si' : ''}">${n}</span>`).join('');
    if (!$('#capito-chips span.si')) $('#capito-chips').insertAdjacentHTML('afterbegin', '<em class="nessuna">nessuna caratteristica riconosciuta</em>');
    $$('#capito-chips span').forEach(s => s.addEventListener('click', () => {
      if (s.dataset.k === 'f') B.f[s.dataset.v] = B.f[s.dataset.v] ? 0 : 1; else B[s.dataset.k] = s.dataset.v;
      B.manuale = true;   // una correzione fatta a mano non viene più sovrascritta
      rCapito(false);
    }));
  }
  // «Analizza»: i dati della sfida sono già calcolati; per l'esempio e per i file il motore gira nel browser
  function avvia(forzata, origine) {
    const b = $('#avvia'), out = $('#esito-file'), scelta = typeof forzata === 'string' ? forzata : S.file ? 'file' : 'annuncio';
    S.testoConsole = $('#richiesta').value.trim();
    const budget = $('#br-budget') ? +$('#br-budget').value || null : null, lancio = $('#br-lancio') ? $('#br-lancio').value : null;
    if (scelta === 'nuova') { location.hash = '#/nuova'; return; }
    if (scelta === 'annuncio' && !S.testoConsole) {   // niente da analizzare: il riquadro si scuote e aspetta il testo
      const c = $('.composer'); c.classList.remove('scuoti'); void c.offsetWidth; c.classList.add('scuoti'); $('#richiesta').focus(); return;
    }
    if (document.body.dataset.vista === 'console') reazione(6, '');
    const r = (origine || b).getBoundingClientRect(), da = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    // se la lettura di Claude è ancora in corso la si aspetta, al massimo cinque secondi (intanto parte la transizione)
    const b0 = S.brief;
    const lettura = b0 && b0.attesa && IA.attiva !== false
      ? (clearTimeout(IA.t), Promise.race([chiediIA(S.testoConsole), new Promise(r => setTimeout(() => r(null), 5000))])
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
      ? (() => { S.sorgente = 'kit'; S.etichetta = 'Dati della sfida Wevion (simulati)'; fonte = 'Dati della sfida Wevion'; if (D && !kit()) { datiP = null; D = null; palco = null; } return dati().then(() => lettura); })()
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
    $('#richiesta').addEventListener('input', () => { const t = Date.now(); if (t - ultimaReazione > 1600) { ultimaReazione = t; reazione(1); } });
    $('#richiesta').addEventListener('input', e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 180) + 'px'; });
    const info = $('#info-file'), box = $('#info-box');
    const apriInfo = on => { box.hidden = !on; info.setAttribute('aria-expanded', on); };
    info.addEventListener('click', e => { e.stopPropagation(); apriInfo(box.hidden); });
    $('#info-chiudi').addEventListener('click', () => apriInfo(false));
    // «Ho capito»: si vedono solo le voci riconosciute; «modifica» mostra tutte quelle che si possono scegliere
    $('#capito-tutti').addEventListener('click', e => {
      const on = $('#capito').classList.toggle('tutti');
      e.target.textContent = on ? 'chiudi' : 'modifica'; e.target.setAttribute('aria-expanded', on);
    });
    document.addEventListener('click', e => { if (!box.hidden && !box.contains(e.target) && e.target !== info) apriInfo(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !box.hidden) apriInfo(false); });
    $('#richiesta').addEventListener('input', () => (D ? rCapito(true) : dati().then(() => rCapito(true))));
    $('#file-ingresso').addEventListener('change', e => suFile(e.target.files));
    const z = $('#v-console');   // si può trascinare il file in qualsiasi punto della pagina
    ['dragenter', 'dragover'].forEach(n => z.addEventListener(n, e => { e.preventDefault(); $('#zona-file').classList.add('sopra'); }));
    ['dragleave', 'drop'].forEach(n => z.addEventListener(n, e => { e.preventDefault(); if (n === 'drop' || !z.contains(e.relatedTarget)) $('#zona-file').classList.remove('sopra'); }));
    z.addEventListener('drop', e => { if (e.dataTransfer.files.length) suFile(e.dataTransfer.files); });
    $('#pz-play').addEventListener('click', () => play(!S.play));
    $('#pz-slider').addEventListener('input', e => { if (S.play) play(false); S.giorno = +e.target.value; if (palco) palco.aggiorna(1); });
    window.addEventListener('hashchange', instrada);
    let rt = null;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (document.body.dataset.vista === 'console') disegnaPrato(); if (document.body.dataset.vista === 'sim' && S.passo === 'simulazione' && D) { rSimulazione($('#pannello')); palco.numeri(S.play ? 0 : 1); } }, 250); });
    instrada();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inizio); else inizio();
})();
