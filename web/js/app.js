/* Flockets: home, console, area di lavoro (pubblico simulato a sinistra, parte tecnica a destra). */
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
    { id: 'dati', nome: 'Dati' }, { id: 'pubblici', nome: 'Pubblici' }, { id: 'simulazione', nome: 'Simulazione' },
    { id: 'decisioni', nome: 'Decisioni' }, { id: 'laboratorio', nome: 'Laboratorio' },
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
  const LEVE = { scarcity: 'scarsità', urgency: 'urgenza', black_friday: 'black friday' };
  const leva = k => LEVE[k] || String(k).replace(/_/g, ' ');
  const STADI = { storico: 'storico sufficiente', 'primi dati': 'primi dati', 'mai vista': 'creatività mai vista', 'dopo modifica': 'dopo un cambio di budget', 'fuori dominio': 'fuori da ciò che conosce' };
  const CARATT = {
    ugc: 'una persona parla in camera', hook: 'aggancio nei primi 2 secondi', ritmo: 'ritmo veloce',
    testo_pesante: 'grafica piena di testo', brand_lento: 'video di marca lento', timer: 'timer o conto alla rovescia',
  };
  const ESEMPIO = 'Video di 15 secondi: una ragazza parla in camera, nei primi 2 secondi appare la scritta -30% SOLO OGGI';
  const REPO = 'https://github.com/mekai-games/flockets';
  const BLU = '#3B4BE0', GRIGIO = '#A3A3A3';
  const FATTO = ['Completato', 'ok'];

  const S = { campagna: null, passo: 'dati', giorno: 0, play: false, adset: null, ad: null, budget: {}, lab: null, visti: {}, testoConsole: '', file: null, fileKit: true, brief: null };
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
    $('#reg-id').textContent = 'flockets · ' + (kit() ? 'kit sfida' : 'file caricati');
  }
  const kit = () => D.meta.origine === 'kit';
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
  const breve = k => { const p = String(k).split('-'), u = p[p.length - 1]; return p.length > 1 && u.length <= 6 ? u : String(k).slice(0, 16); };
  const gente = g => (g == null ? 'grandezza non nota' : g >= 1e7 ? 'oltre 10 mln' : g >= 1e6 ? nf(g / 1e6, 1) + ' mln' : ni(g / 1000) + ' mila');
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
  function stato(testo, corso) { $('#st-testo').textContent = testo; $('#st-spia').classList.toggle('corso', !!corso); }

  /* ------------------------------------------------------------------ viste */
  function mostra(v) {
    if (document.body.dataset.vista === v) return;
    document.body.dataset.vista = v;
    $$('.vista').forEach(s => { s.hidden = s.id !== 'v-' + v; });
    window.scrollTo(0, 0);
  }
  function instrada() {
    const p = location.hash.replace(/^#\/?/, '').split('/');
    if (p[0] === 'console') { play(false); mostra('console'); (D ? Promise.resolve() : dati()).then(() => rCapito(false)); return; }
    if (p[0] !== 'sim') { play(false); mostra('benvenuto'); return; }
    (D ? Promise.resolve() : dati()).then(() => {
      mostra('sim');
      S.passo = ((p[1] === 'consegne' && kit()) || PASSI.some(x => x.id === p[1])) ? p[1] : 'dati';
      if (!palco) rCampagne();
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
    $('#pz-legenda').innerHTML = `<b class="mono">Come si legge</b>${D.par.leve.slice(0, 4).map(l => `<span><i class="punto leva-${l}"></i>${leva(l)}</span>`).join('')}
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
        cum.innerHTML = `<div><dt>Spesa fin qui</dt><dd>${ni(sp)} €</dd></div><div><dt>Impression</dt><dd>${ni(im)}</dd></div><div><dt>Click</dt><dd>${ni(ck)}</dd></div>`;
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
        $('.cart-tag', z).innerHTML = `${leva(a.leva)} · ${a.formato}${g.top.eta < 4 ? ' <em>nuovo</em>' : ''}${a.cold ? ' <em>mai vista</em>' : ''}`;
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
        $('.cart-tag', z).innerHTML = `${leva(L.leva)} · ${L.formato} <em>in prova</em>`;
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
    $('#passi-nav').innerHTML = PASSI.map((x, j) => `<a href="#/sim/${x.id}" class="${x.id === S.passo ? 'attivo' : ''}"><span class="mono">0${j + 1}</span>${x.nome}</a>`).join('')
      + (kit() ? `<a href="#/sim/consegne" class="fine ${consegne ? 'attivo' : ''}">Consegne</a>` : '');
    $('#st-passo').textContent = consegne ? 'Consegne' : `Passo ${i + 1}/5`;
    $('#st-nome').textContent = consegne ? '' : PASSI[i].nome;
    stato('Pronto', false);
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

  /* ---- 01 dati */
  function rDati(el) {
    const M = D.meta, st = D.stagione.cpm, sett = Object.keys(st).sort();
    const giorniSto = giorniTra(M.storico_al, M.storico_dal) + 1;
    const nomeFile = f => String(f).split('/').pop().replace(/\.csv$/i, '');
    el.innerHTML = scheda('01', 'Lettura dei dati', FATTO, `
        <p>Flockets legge lo storico giornaliero di ogni annuncio e, quando ci sono, il budget di ogni ad set, le creatività e il calendario.</p>
        <dl class="tessere tre"><div><dd>${ni(M.righe_storico)}</dd><dt>Righe di storico</dt></div><div><dd>${giorniSto}</dd><dt>Giorni</dt></div><div><dd>${ni(M.annunci_storico)}</dd><dt>Annunci</dt></div></dl>
        <p class="sopra-chip mono">File letti</p>
        <p class="chips mono">${M.file_letti.map(f => `<span>${esc(nomeFile(f))}</span>`).join('')}</p>
        ${M.note.length ? `<p class="sopra-chip mono">Cosa mancava, e cosa ho fatto</p><ul class="avvisi">${M.note.map(n => `<li class="giallo">${esc(accenti(n))}</li>`).join('')}</ul>` : ''}
        <details><summary>Cosa serve al modello</summary><ul class="punti">
          <li><b>Obbligatorio: lo storico giornaliero per annuncio</b>, con data, annuncio, spesa, impression e click. I nomi delle colonne possono essere in italiano o in inglese.</li>
          <li><b>Ad set, campagna e copertura</b>: per riconoscere i pubblici e stimarne la grandezza.</li>
          <li><b>Budget di ogni ad set</b>, giorno per giorno, compresi i giorni da prevedere.</li>
          <li><b>Creatività</b>: leva, formato e una descrizione di cosa si vede. Serve per stimare gli annunci senza storico.</li>
          <li><b>Andamento del mercato e calendario</b>: per la stagione.</li></ul></details>`, M.file_letti.slice(0, 3).map(nomeFile).join(' · '))
      + scheda('02', 'Controllo delle anomalie', D.anomalie.length ? [`${D.anomalie.length} trovate`, 'corso'] : ['Nessuna', 'ok'], D.anomalie.length ? `
        <p>Giorni che romperebbero la stima se presi per buoni. Vengono esclusi.</p>
        <ul class="avvisi">${D.anomalie.map(a => `<li class="giallo"><b>${gm(a.data)} · ${esc(a.dove.replace('_', ' '))}.</b> ${esc(a.cosa.charAt(0).toUpperCase() + a.cosa.slice(1))}.</li>`).join('')}</ul>` : '<p>Nessun giorno senza click e nessuna spesa fuori budget.</p>')
      + (M.stagione ? scheda('03', 'Andamento del mercato', FATTO, `
        <p>Il costo del mercato cambia durante l’anno, e il CPM lo segue. Ecco quanto costerà nelle settimane da prevedere, rispetto al livello normale.</p>
        <dl class="tessere tre">${sett.slice(0, 3).map(w => `<div><dd>${st[w] >= 0 ? '+' : ''}${ni((Math.exp(st[w]) - 1) * 100)}%</dd><dt>Settimana del ${gm(w)}</dt></div>`).join('')}</dl>`, M.stagione)
        : scheda('03', 'Andamento del mercato', ['Non disponibile', 'neutro'], '<p>Nessun dato di mercato: la stagione è considerata piatta e la forchetta delle previsioni è più larga.</p>'))
      + scheda('04', 'Dati pronti', null, `<p>Il pubblico di ogni ad set non è nei dati: va immaginato.</p>${avanti('pubblici', 'Vai ai pubblici')}`);
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
            <p class="chips mono"><span>${gente(a.grandezza)}</span><span>CTR ${nf(a.ctr_rel)}×</span><span>CPM ${nf(a.cpm_rel)}×</span><span>frequenza ${nf(a.frequenza)}</span>${a.leva && a.leva !== 'nessuna differenza netta' ? `<span>rende di più: ${leva(a.leva)}</span>` : ''}</p>
            <p>${CHI[a.tipo](a.vertical)}</p><p class="nota">${esc(accenti(a.motivazione.charAt(0).toUpperCase() + a.motivazione.slice(1)))}.</p></div>`;
        }).join('')}</div>
        <p class="nota">La grandezza è un ordine di grandezza. L’età non è nei dati: resta un’ipotesi.</p>`, 'CPM · CTR · frequenza → pubblico')
      + scheda('02', 'Pubblici pronti', null, `<p>Ora gli annunci vanno davanti ai pubblici, un giorno alla volta, dal ${gm(D.meta.giorni[0])} al ${gm(D.meta.giorni[D.meta.giorni.length - 1])}.</p>${avanti('simulazione', 'Avvia la simulazione')}`);
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
    el.innerHTML = scheda('01', 'Simulazione dei 15 giorni', ['', 'ok', 'sim-stato'], `
        <p>Ogni giorno il modello prevede spesa, impression e click di ogni annuncio. A sinistra il pubblico reagisce.</p>
        <dl class="tessere tre" id="sim-cum"></dl>
        <div class="avanzamento"><i id="sim-barra"></i></div>`, 'CTR = asset × pubblico × fatica × stagione × giorno')
      + scheda('02', 'Previsioni per annuncio', FATTO, `
        <div class="gruppo" role="tablist" aria-label="Pubblico">${c.adset.map(k => `<button data-as="${k}" aria-selected="${k === S.adset}">${TIPI[D.adset[k].tipo]}</button>`).join('')}</div>
        <div class="gruppo annunci" role="tablist" aria-label="Annuncio">${annunci.map(a => `<button data-ad="${a}" aria-selected="${a === S.ad}"><i class="punto leva-${D.ads[a].leva}"></i>${esc(D.ads[a].titolo)}</button>`).join('')}</div>
        <div class="annuncio">
          <p class="chips mono"><span><i class="punto leva-${ad.leva}"></i>${leva(ad.leva)}</span><span>${ad.formato}</span><span class="aff-${P[0].aff}">affidabilità ${P[0].aff}</span><span>${STADI[P[0].stadio] || P[0].stadio}</span></p>
          <h4>${esc(ad.titolo)}</h4><p class="tenue">${esc(ad.visual)}</p>
          ${ad.cold ? '<p class="nota">Questa creatività non ha storico: la stima viene dalle sue caratteristiche, quindi la forchetta è larga.</p>' : ''}
        </div>
        <dl class="tessere quattro"><div><dd>${nf(ck / im * 100)}%</dd><dt>CTR previsto</dt></div><div><dd>${nf(sp / im * 1000)} €</dd><dt>CPM previsto</dt></div><div><dd>${nf(sp / ck)} €</dd><dt>Costo per click</dt></div><div><dd>${ni(ck)}</dd><dt>Click in ${P.length} giorni</dt></div></dl>
        <figure><figcaption>CTR <span class="mono">percentuale</span></figcaption><div id="g-ctr"></div></figure>
        <figure><figcaption>CPM <span class="mono">euro per mille impression</span></figcaption><div id="g-cpm"></div></figure>
        <p class="nota"><b>Come si legge.</b> La linea blu è la previsione. La fascia scura dice dove sta il valore di fondo; la fascia chiara dove cadrà il numero di quel giorno, 8 volte su 10. Più la fascia è larga, meno ci fidiamo.</p>
        <details><summary>Tabella giorno per giorno</summary>
          <div class="scorri"><table><thead><tr><th>Giorno</th><th>CTR</th><th>tra</th><th>CPM</th><th>tra</th><th>Click</th></tr></thead>
          <tbody>${P.map(p => `<tr><td>${NOMI_G[dow(p.d)].slice(0, 3)} ${gm(p.d)}</td><td>${nf(p.ctr)}%</td><td>${nf(p.c10)} – ${nf(p.c90)}</td><td>${nf(p.cpm)} €</td><td>${nf(p.m10)} – ${nf(p.m90)}</td><td>${ni(p.clk)}</td></tr>`).join('')}</tbody></table></div>
        </details>
        <p><a class="pulsante bordo" href="${scarico()}" download="${D.meta.file_previsioni}">Scarica tutte le previsioni (CSV)</a></p>`, `${ni(D.meta.righe_previste)} righe · affidabilità: ${['alta', 'media', 'bassa'].map(a => (D.meta.affidabilita[a] || 0) + ' ' + a).join(', ')}`)
      + scheda('03', 'Simulazione pronta', null, `<p>Con le previsioni in mano si decide: quanto budget, dove, e quale creatività.</p>${avanti('decisioni', 'Vai alle decisioni')}`);
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
    const [fl, tau] = D.par.fatica[leva];
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
        <p>Sposta i cursori: costi e click si ricalcolano subito, anche nel pubblico simulato a sinistra.</p>
        <div id="dec-righe">${c.adset.map(k => `
          <div class="dec-riga" data-as="${k}">
            <label for="b-${k}"><b>${TIPI[D.adset[k].tipo]}</b><span class="sigla mono">${breve(k)}</span></label>
            <output class="dec-b"></output>
            <input type="range" id="b-${k}" min="${Math.round(D.adset[k].budget_test * 0.5)}" max="${Math.round(D.adset[k].budget_test * 2)}" step="1" value="${S.budget[k]}">
            <p class="dec-d mono"></p>
          </div>`).join('')}</div>
        <div class="azioni"><button class="pulsante nero" id="dec-proposta">Proposta di Flockets</button><button class="pulsante bordo" id="dec-piano">Piano attuale</button></div>
        <dl class="tessere tre" id="dec-totale"></dl>
        <p class="nota">Il CPM sale quando si spinge su un pubblico: con il doppio del budget arriva circa il ${ni((Math.pow(2, 1 - e) - 1) * 100)}% di click in più, non il 100%. Click non vuol dire vendite: il pubblico ampio alimenta quelli caldi.</p>`, `CPM × (budget ÷ budget previsto)^${nf(e)}`)
      + scheda('02', 'Quale creatività, e quando cambiarla', FATTO, `
        <ul class="avvisi">
          ${stanche.map(x => `<li class="rosso"><b>Da sostituire.</b> «${esc(x.ad.titolo)}» (${breve(x.ad.adset)}) al ${gm(D.meta.giorni[D.meta.giorni.length - 1])} avrà perso il ${ni((1 - x.fat) * 100)}% della forza iniziale.</li>`).join('')}
          ${migliori.map(x => `<li class="verde"><b>Rende di più in ${breve(x.ad.adset)}.</b> «${esc(x.ad.titolo)}»: ${nf(x.cpc)} € a click.</li>`).join('')}
          ${nuove.map(x => `<li class="giallo"><b>Mai vista.</b> «${esc(x.ad.titolo)}» (${breve(x.ad.adset)}) parte il ${gm(x.primo.d)}: CTR stimato ${nf(x.primo.ctr)}%, ma può stare tra ${nf(x.primo.a10)} e ${nf(x.primo.a90)}. Da controllare dopo tre giorni.</li>`).join('')}
        </ul>
        <p class="nota"><b>Quando.</b> Un annuncio di urgenza perde un quarto della forza in ${tempoPerdita('urgency', 0.75)} giorni, uno di scarsità in ${tempoPerdita('scarcity', 0.75)}. Un annuncio nuovo paga il CPM più caro per i primi tre giorni: meglio lanciarlo prima del giorno che conta, non il giorno stesso.</p>`)
      + scheda('03', 'Decisioni prese', null, `<p>Manca un’idea nuova? Provala sul pubblico prima di produrla.</p>${avanti('laboratorio', 'Vai al laboratorio')}`);
    const agg = () => {
      let tot = 0, ck = 0, ck0 = 0, sp = 0;
      c.adset.forEach(k => {
        const B = S.budget[k], x = conBudget(k, B), x0 = conBudget(k, D.adset[k].budget_test), riga = $(`.dec-riga[data-as="${k}"]`, el);
        tot += B; ck += x.clk; ck0 += x0.clk; sp += x.spesa;
        const d = (B / D.adset[k].budget_test - 1) * 100;
        $('.dec-b', riga).innerHTML = `${ni(B)} € <i class="${d > 0.5 ? 'su' : d < -0.5 ? 'giu' : ''}">${d > 0 ? '+' : ''}${ni(d)}%</i>`;
        $('.dec-d', riga).textContent = `CPM ${nf(x.cpm)} € · ${nf(x.cpc)} € a click · ${ni(x.clk)} click al giorno · frequenza ${nf(x.freq)}`;
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
    return { f, formato, leva: lv };
  }
  function logFatica(eta, leva) {
    const lf = k => { const [fl, tau] = D.par.fatica[k]; return Math.log(fl + (1 - fl) * Math.exp(-eta / tau)); };
    return leva === 'scarcity' ? lf('scarcity') : leva === 'urgency' ? lf('urgency') : 0.5 * (lf('scarcity') + lf('urgency'));
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
        <p><button class="pulsante nero" id="lab-leggi">Leggi la descrizione</button></p>
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
    };
    $('#lab-leggi').addEventListener('click', () => { L.testo = $('#lab-testo').value; Object.assign(L, leggiTesto(L.testo)); campi(); esito(true); });
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
    const riga = (n, g, f) => `<tr><td>${n}</td><td><b>${nf(v(g, 'strutturale')[f], 1)}%</b></td><td>${nf(v(g, 'ultimi 7 giorni')[f], 1)}%</td></tr>`;
    const P = D.par, peso = k => (Math.exp(P.feat_w[P.feat_cols.indexOf(k) + 1]) - 1) * 100;
    el.innerHTML = scheda('01', 'Lo strumento', FATTO, `
        <p>È questo sito, più il motore di previsione che gli sta dietro. Il motore è scritto in Python e si rilancia con un comando: rifà da zero stima, validazione e previsioni in pochi secondi.</p>
        <p><a class="pulsante nero" href="${REPO}" target="_blank" rel="noopener">Apri il codice ↗</a></p>`, 'python3 modello/run.py')
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
        <p>Abbiamo nascosto al modello 14 giorni di storico, li abbiamo fatti prevedere e confrontato con i valori veri. Quattro volte, su date diverse.</p>
        <div class="scorri"><table><thead><tr><th>Errore medio</th><th>Flockets</th><th>«Come gli ultimi 7 giorni»</th></tr></thead><tbody>
          ${riga('CPM, tutti gli annunci', 'tutti', 'cpm')}${riga('CPM, annunci nuovi', 'annunci nuovi', 'cpm')}${riga('CTR, tutti gli annunci', 'tutti', 'ctr')}${riga('CTR, annunci nuovi', 'annunci nuovi', 'ctr')}
        </tbody></table></div>
        ${D.generalizzazione && D.generalizzazione.length ? `<h4>Vale anche su un inserzionista mai visto?</h4>
        <p>Abbiamo tolto un inserzionista alla volta. I fattori comuni (fatica, giorno della settimana, effetto del budget, peso delle caratteristiche creative) li abbiamo stimati solo sugli altri due; di lui abbiamo stimato soltanto i livelli.</p>
        <div class="scorri"><table><thead><tr><th>Errore medio</th><th>CPM</th><th>CTR</th></tr></thead><tbody>
          ${D.generalizzazione.map(x => `<tr><td>${x.storia}, ${x.modello}</td><td>${nf(x.cpm, 1)}%</td><td>${nf(x.ctr, 1)}%</td></tr>`).join('')}
        </tbody></table></div>
        <p class="nota">I fattori imparati dagli altri valgono quanto quelli imparati sui suoi dati, e aiutano quando lo storico è corto. È una prova dentro il kit, che è fatto di dati simulati.</p>` : ''}
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
  function suFile(files) {
    const out = $('#esito-file');
    const lista = Array.from(files).filter(f => /\.csv$/i.test(f.name) || f.type === 'text/csv');
    if (!lista.length) { out.innerHTML = '<p class="errore mono">Serve un file CSV.</p>'; return; }
    out.innerHTML = '<p class="tenue mono">Leggo…</p>';
    Promise.all([dati(), ...lista.map(f => f.text().then(t => ({ nome: f.webkitRelativePath || f.name, testo: t })))]).then(([, ...letti]) => {
      const st = letti.map(x => Object.assign({ nome: x.nome }, controllaStorico(leggiCSV(x.testo)))).filter(x => x.ok).sort((a, b) => b.n - a.n)[0];
      S.file = letti;
      S.fileKit = !!st && st.lista.filter(a => D.ads_storico.includes(a)).length / st.lista.length > 0.9 && st.n > 1000 && kit();
      $('#file-nome').textContent = letti.length === 1 ? letti[0].nome : letti.length + ' file caricati';
      out.innerHTML = `<ul class="controlli mono">
          ${st ? `<li class="si">${ni(st.n)} righe · ${st.ads} annunci · dal ${gm(st.min)} al ${gm(st.max)}</li>` : '<li class="attento">Colonne con nomi diversi dal solito: provo a riconoscerle al calcolo</li>'}
          ${st ? (st.note.map(x => `<li class="attento">${esc(x)}</li>`).join('') || '<li class="si">Nessuna anomalia evidente</li>') : ''}
          <li class="si">${S.fileKit ? 'È il kit della sfida: uso le previsioni già calcolate' : 'Flockets calcolerà le previsioni su questi dati, qui nel browser: i file non lasciano il tuo computer'}</li>
        </ul><p><button class="testo-link mono" id="togli-file">Torna ai dati della sfida</button></p>`;
      $('#togli-file').addEventListener('click', () => { S.file = null; S.fileKit = true; out.innerHTML = ''; $('#file-ingresso').value = ''; $('#file-nome').textContent = 'kit della sfida · storico_giornaliero.csv'; $('.avviso-barra').textContent = 'Demo sui dati della sfida: le previsioni sono già state calcolate dal motore.'; });
      $('.avviso-barra').textContent = S.fileKit ? 'Demo sui dati della sfida: le previsioni sono già state calcolate dal motore.' : 'Il calcolo avviene nel tuo browser. La prima volta scarica il motore: può volerci mezzo minuto.';
    });
  }
  // Zona «Ho capito»: mostra cosa il sito legge dal testo (formato, leva, caratteristiche) e lascia correggere
  function rCapito(rileggi) {
    if (!D) return;
    const testo = $('#richiesta').value.trim(), box = $('#capito');
    if (!$('#br-lancio').options.length) $('#br-lancio').innerHTML = D.meta.giorni.slice(0, 12).map(d => `<option value="${d}">${NOMI_G[dow(d)].slice(0, 3)} ${gm(d)}</option>`).join('');
    box.hidden = !testo;
    if (!testo) { S.brief = null; return; }
    if (rileggi || !S.brief) S.brief = leggiTesto(testo);
    const B = S.brief;
    $('#capito-chips').innerHTML =
      D.par.formati.map(v => `<span data-k="formato" data-v="${v}" class="${v === B.formato ? 'si' : ''}">${v}</span>`).join('')
      + D.par.leve.map(v => `<span data-k="leva" data-v="${v}" class="${v === B.leva ? 'si' : ''}">${leva(v)}</span>`).join('')
      + Object.entries(CARATT).map(([k, n]) => `<span data-k="f" data-v="${k}" class="${B.f[k] ? 'si' : ''}">${n}</span>`).join('');
    $$('#capito-chips span').forEach(s => s.addEventListener('click', () => {
      if (s.dataset.k === 'f') B.f[s.dataset.v] = B.f[s.dataset.v] ? 0 : 1; else B[s.dataset.k] = s.dataset.v;
      rCapito(false);
    }));
  }
  // «Avvia la simulazione»: il kit è già calcolato; per altri file il motore gira nel browser
  function avvia() {
    const b = $('#avvia'), out = $('#esito-file');
    S.testoConsole = $('#richiesta').value.trim();
    const brief = S.brief, budget = +$('#br-budget').value || null, lancio = $('#br-lancio').value;
    const parti = () => {
      $('#registro').innerHTML = ''; S.visti = {};
      S.lab = S.testoConsole ? Object.assign({ testo: S.testoConsole, lancio: D.meta.giorni.includes(lancio) ? lancio : D.meta.giorni[0], budget },
        brief && D.par.formati.includes(brief.formato) && D.par.leve.includes(brief.leva) ? brief : leggiTesto(S.testoConsole)) : null;
      location.hash = '#/sim/dati';
    };
    if (!S.file || S.fileKit) {
      if (D && !kit()) { datiP = null; D = null; }   // si torna ai dati della sfida
      dati().then(parti);
      return;
    }
    b.disabled = true;
    const stato = m => { b.firstElementChild.textContent = m; };
    MotoreFlockets.analizza(S.file, stato).then(d => {
      usa(d);
      registra('Motore eseguito nel browser su ' + S.file.length + ' file');
      parti();
    }).catch(err => {
      out.insertAdjacentHTML('beforeend', `<p class="errore mono">${esc(String(err.message || err).split('\n').pop())}</p>`);
    }).finally(() => { b.disabled = false; b.firstElementChild.textContent = 'Avvia la simulazione'; });
  }

  /* ------------------------------------------------------------------ avvio */
  function inizio() {
    Flock.carica().then(() => { new Flock.Scena($('#folla'), { scala: 4, altezza: 390, contorno: true, ombra: false, linea: false, suolo: 0 }).folla(); });
    $('#avvia').addEventListener('click', avvia);
    $('#richiesta').addEventListener('input', () => (D ? rCapito(true) : dati().then(() => rCapito(true))));
    $('#file-ingresso').addEventListener('change', e => suFile(e.target.files));
    const z = $('#zona-file');
    ['dragenter', 'dragover'].forEach(n => z.addEventListener(n, e => { e.preventDefault(); z.classList.add('sopra'); }));
    ['dragleave', 'drop'].forEach(n => z.addEventListener(n, e => { e.preventDefault(); z.classList.remove('sopra'); }));
    z.addEventListener('drop', e => suFile(e.dataTransfer.files));
    $('#pz-play').addEventListener('click', () => play(!S.play));
    $('#pz-slider').addEventListener('input', e => { if (S.play) play(false); S.giorno = +e.target.value; if (palco) palco.aggiorna(1); });
    $$('.viste button').forEach(b => b.addEventListener('click', () => {
      $('.lavoro').dataset.disp = b.dataset.v;
      $$('.viste button').forEach(x => x.setAttribute('aria-selected', x === b));
      setTimeout(() => { if (D && S.passo === 'simulazione' && b.dataset.v !== 'pubblico') { const y = $('#pannello').scrollTop; rSimulazione($('#pannello')); $('#pannello').scrollTop = y; palco.numeri(S.play ? 0 : 1); } }, 60);
    }));
    window.addEventListener('hashchange', instrada);
    let rt = null;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (document.body.dataset.vista === 'sim' && S.passo === 'simulazione' && D) { rSimulazione($('#pannello')); palco.numeri(S.play ? 0 : 1); } }, 250); });
    instrada();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inizio); else inizio();
})();
