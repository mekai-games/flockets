/* Flockets: viste, piazza animata, pubblici, previsioni, decisioni, laboratorio, consegne. */
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

  const SCHEDE = { piazza: 'Piazza', pubblici: 'Pubblici', previsioni: 'Previsioni', decisioni: 'Decisioni', laboratorio: 'Laboratorio', consegne: 'Consegne' };
  const TIPI = { ampio: 'Pubblico ampio', interessi: 'Interessi', sosia: 'Sosia dei clienti', caldo: 'Già vicini al marchio' };
  const CHI = {
    ampio: () => 'Chiunque in Italia tra 18 e 65 anni. Nessun interesse scelto: decide la piattaforma a chi mostrare l’annuncio.',
    interessi: v => ({
      beauty_skincare: 'Persone che seguono skincare, cosmetica e cura del viso.',
      pet_ecommerce: 'Persone che hanno un cane o un gatto e seguono pagine a tema.',
      abbigliamento: 'Persone che seguono moda, marchi di abbigliamento e acquisti online.',
    }[v] || 'Persone scelte per interesse verso la categoria.'),
    sosia: () => 'Persone che somigliano a chi ha già comprato: stesse abitudini, ma non conoscono ancora il marchio.',
    caldo: () => 'Chi ha visitato il sito, lasciato il carrello a metà o già comprato negli ultimi 30 giorni.',
  };
  const LEVE = { scarcity: 'scarsità', urgency: 'urgenza', black_friday: 'black friday' };
  const CARATT = {
    ugc: 'una persona parla in camera', hook: 'aggancio nei primi 2 secondi', ritmo: 'ritmo veloce',
    testo_pesante: 'grafica piena di testo', brand_lento: 'video di marca lento', timer: 'timer o conto alla rovescia',
  };
  const REPO = 'https://github.com/mekai-games/flockets';

  const S = { campagna: null, tab: 'piazza', giorno: 0, play: false, adset: null, ad: null, budget: {}, lab: null };
  let D = null, datiP = null, orologio = null;

  /* ------------------------------------------------------------------ dati */
  function dati() {
    if (!datiP) {
      datiP = Promise.all([fetch('data/analisi.json').then(r => r.json()), Flock.carica()]).then(([d]) => { D = d; prepara(); return D; });
    }
    return datiP;
  }
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
  const nOmini = k => stringe(Math.round(3 * Math.log10(D.adset[k].grandezza) - 10.5), 3, 12);
  const breve = k => k.split('-')[1];

  /* ------------------------------------------------------------------ viste */
  function mostra(v) {
    document.body.dataset.vista = v;
    $$('.vista').forEach(s => { s.hidden = s.id !== 'v-' + v; });
    window.scrollTo(0, 0);
  }
  function instrada() {
    const p = location.hash.replace(/^#\/?/, '').split('/');
    ferma();
    if (p[0] === 'analisi') {
      mostra('analisi');
      if (p[1] && SCHEDE[p[1]]) S.tab = p[1];
      dati().then(rAnalisi);
    } else {
      $('#schede').innerHTML = '';
      mostra(p[0] === 'avvio' ? 'avvio' : 'benvenuto');
    }
  }
  function ferma() { S.play = false; clearInterval(orologio); orologio = null; }

  function rAnalisi() {
    ferma();
    $('#schede').innerHTML = Object.entries(SCHEDE).map(([k, n]) => `<a href="#/analisi/${k}" class="${k === S.tab ? 'attiva' : ''}">${n}</a>`).join('');
    const c = camp();
    $('#campagne').innerHTML = D.campagne.map(x => `<button role="tab" aria-selected="${x.id === c.id}" data-c="${x.id}">${esc(x.nome)}</button>`).join('');
    $('#campagna-desc').textContent = c.descrizione;
    $$('#campagne button').forEach(b => b.addEventListener('click', () => { S.campagna = b.dataset.c; S.adset = null; S.ad = null; rAnalisi(); }));
    $('.testa-analisi').hidden = S.tab === 'consegne';
    const el = $('#pannello');
    el.className = 'pannello p-' + S.tab;
    ({ piazza: rPiazza, pubblici: rPubblici, previsioni: rPrevisioni, decisioni: rDecisioni, laboratorio: rLaboratorio, consegne: rConsegne })[S.tab](el);
  }

  /* ----------------------------------------------------------------- piazza */
  const DUR = 7, RITMO = 1.3; // secondi per giorno simulato, salti al secondo nella zona piu attiva
  function rPiazza(el) {
    const c = camp(), giorni = D.meta.giorni;
    const maxClk = Math.max(...c.adset.flatMap(k => giorni.map(d => D.zona[k][d].clk)));
    const perSalto = maxClk / (RITMO * DUR);
    el.innerHTML = `
      <div class="comandi">
        <button class="bottone piccolo" id="pz-play">Avvia i 15 giorni</button>
        <div class="pz-giorno"><b id="pz-data"></b> <span id="pz-evento" class="evento" hidden></span></div>
        <input type="range" id="pz-slider" min="0" max="${giorni.length - 1}" value="${S.giorno}" aria-label="Giorno della previsione">
      </div>
      <div class="zone">${c.adset.map(k => `
        <article class="zona" data-as="${k}">
          <header><b>${TIPI[D.adset[k].tipo]}</b><span>${breve(k)}</span></header>
          <div class="cartellone"><div class="cart-tag"></div><div class="cart-titolo"></div></div>
          <canvas></canvas>
          <dl class="numeri">
            <div><dt>Budget</dt><dd data-n="bud"></dd></div><div><dt>CPM</dt><dd data-n="cpm"></dd></div>
            <div><dt>CTR</dt><dd data-n="ctr"></dd></div><div><dt>Click</dt><dd data-n="clk"></dd></div>
          </dl>
        </article>`).join('')}
      </div>
      <div class="totale" id="pz-totale"></div>
      <p class="legenda"><b>Come si legge.</b> Ogni gruppo è un pubblico: più omini, pubblico più grande. Un omino che <b>esulta</b> vale circa ${ni(perSalto)} click. Chi <b>dorme</b> ha visto l’annuncio troppe volte: la creatività è stanca. I numeri sono le previsioni del modello per quel giorno.</p>`;
    const scene = {};
    c.adset.forEach(k => {
      scene[k] = new Flock.Scena($(`.zona[data-as="${k}"] canvas`, el), { scala: 2, altezza: 112 }).popola(nOmini(k));
    });
    const numeri = p => {
      const d = giorni[S.giorno];
      let sp = 0, im = 0, ck = 0;
      c.adset.forEach(k => {
        const g = D.zona[k][d], z = $(`.zona[data-as="${k}"]`, el);
        $('[data-n="clk"]', z).textContent = ni(g.clk * p);
        sp += g.spesa; im += g.imp; ck += g.clk;
      });
      $('#pz-totale').innerHTML = `<span>Campagna, ${gm(d)}</span><b>${ni(sp)} €</b> spesi <b>${ni(im * p)}</b> impression <b>${ni(ck * p)}</b> click <b>${nf(sp / ck)} €</b> a click`;
    };
    const giorno = p => {
      const d = giorni[S.giorno];
      $('#pz-data').textContent = NOMI_G[dow(d)] + ' ' + gm(d);
      const ev = D.meta.eventi[d];
      $('#pz-evento').hidden = !ev; $('#pz-evento').textContent = ev || '';
      c.adset.forEach(k => {
        const g = D.zona[k][d], a = D.ads[g.top.ad], z = $(`.zona[data-as="${k}"]`, el);
        const cart = $('.cartellone', z);
        cart.className = 'cartellone leva-' + a.leva;
        $('.cart-tag', cart).innerHTML = `${LEVE[a.leva]} · ${a.formato}${g.top.eta < 4 ? ' <em>nuovo</em>' : ''}${a.cold ? ' <em>mai vista</em>' : ''}`;
        $('.cart-titolo', cart).textContent = a.titolo;
        $('[data-n="bud"]', z).textContent = ni(g.ads[0] ? S_bud(k) : 0) + ' €';
        $('[data-n="cpm"]', z).textContent = nf(g.cpm) + ' €';
        $('[data-n="ctr"]', z).textContent = nf(g.ctr) + '%';
        scene[k].ritmo = g.clk / maxClk * RITMO;
        scene[k].dormienti((1 - g.fat) * 0.9);
      });
      numeri(p);
    };
    const S_bud = k => D.adset[k].budget_test;
    const play = on => {
      ferma(); S.play = on;
      $('#pz-play').textContent = on ? 'Pausa' : 'Avvia i 15 giorni';
      if (!on) { numeri(1); return; }
      if (S.giorno >= giorni.length - 1) { S.giorno = 0; $('#pz-slider').value = 0; }
      let t0 = performance.now();
      giorno(0);
      orologio = setInterval(() => {
        const p = (performance.now() - t0) / (DUR * 1000);
        if (p < 1) { numeri(p); return; }
        if (S.giorno >= giorni.length - 1) { play(false); return; }
        S.giorno++; t0 = performance.now(); $('#pz-slider').value = S.giorno; giorno(0);
      }, 100);
    };
    $('#pz-play').addEventListener('click', () => play(!S.play));
    $('#pz-slider').addEventListener('input', e => { if (S.play) play(false); S.giorno = +e.target.value; giorno(1); });
    giorno(1);
  }

  /* --------------------------------------------------------------- pubblici */
  function rPubblici(el) {
    const c = camp();
    el.innerHTML = `
      <p class="intro">Il pubblico non è nei dati. Flockets lo ricava da tre segnali: quanto costa raggiungerlo (CPM), quanto reagisce (CTR) e quanto spesso le stesse persone rivedono l’annuncio (frequenza).</p>
      <div class="carte">${c.adset.map(k => {
        const a = D.adset[k];
        const gr = a.grandezza >= 1e7 ? 'oltre 10 milioni' : a.grandezza >= 1e6 ? 'circa ' + nf(a.grandezza / 1e6, 1) + ' milioni' : 'circa ' + ni(a.grandezza / 1000) + ' mila';
        return `<article class="carta tipo-${a.tipo}" data-as="${k}">
          <header><b>${TIPI[a.tipo]}</b><span>${breve(k)}</span></header>
          <canvas></canvas>
          <p class="chi">${CHI[a.tipo](a.vertical)}</p>
          <dl class="numeri">
            <div><dt>CTR sulla media</dt><dd>${nf(a.ctr_rel)}×</dd></div><div><dt>CPM sulla media</dt><dd>${nf(a.cpm_rel)}×</dd></div>
            <div><dt>Frequenza</dt><dd>${nf(a.frequenza)}</dd></div><div><dt>Persone</dt><dd class="piccolo">${gr}</dd></div>
          </dl>
          <p class="perche"><b>Perché.</b> ${esc(accenti(a.motivazione))}.</p>
          ${LEVE[a.leva] ? `<p class="perche"><b>Leva che qui rende di più:</b> ${LEVE[a.leva]}.</p>` : ''}
        </article>`;
      }).join('')}</div>
      <p class="legenda">La grandezza è un ordine di grandezza, ricavato da come cresce la frequenza quando crescono le impression. L’età non è nei dati: resta un’ipotesi.</p>`;
    c.adset.forEach(k => new Flock.Scena($(`.carta[data-as="${k}"] canvas`, el), { scala: 2, altezza: 96 }).popola(nOmini(k)));
  }

  /* ------------------------------------------------------------- previsioni */
  function rPrevisioni(el) {
    const c = camp();
    if (!S.adset || !c.adset.includes(S.adset)) S.adset = c.adset[0];
    const annunci = Object.keys(D.perAd).filter(a => D.ads[a].adset === S.adset);
    if (!S.ad || !annunci.includes(S.ad)) S.ad = annunci[0];
    const ad = D.ads[S.ad], P = D.perAd[S.ad];
    const inizio = piu(D.meta.storico_al, -20), fine = D.meta.giorni[D.meta.giorni.length - 1];
    const giorni = []; for (let d = inizio; d <= fine; d = piu(d, 1)) giorni.push(d);
    const perD = Object.fromEntries(P.map(p => [p.d, p])), H = D.histAd[S.ad] || {};
    const col = (f) => giorni.map(d => (perD[d] ? perD[d][f] : null));
    const sto = (f) => giorni.map(d => (H[d] && !H[d].anom ? H[d][f] : null));
    const sp = P.reduce((s, p) => s + p.spesa, 0), im = P.reduce((s, p) => s + p.imp, 0), ck = P.reduce((s, p) => s + p.clk, 0);
    const ev = {}; Object.entries(D.meta.eventi).forEach(([d, n]) => { if (/Black Friday|Cyber/.test(n)) ev[d] = n; });
    el.innerHTML = `
      <div class="scelte">
        <div class="gruppo" role="tablist" aria-label="Ad set">${c.adset.map(k => `<button data-as="${k}" aria-selected="${k === S.adset}">${breve(k)} · ${TIPI[D.adset[k].tipo]}</button>`).join('')}</div>
        <div class="gruppo annunci" role="tablist" aria-label="Annuncio">${annunci.map(a => `<button data-ad="${a}" aria-selected="${a === S.ad}" class="leva-${D.ads[a].leva}">${esc(D.ads[a].titolo)}</button>`).join('')}</div>
      </div>
      <div class="annuncio">
        <div><span class="etichetta leva-${ad.leva}">${LEVE[ad.leva]}</span> <span class="etichetta">${ad.formato}</span> ${ad.cold ? '<span class="etichetta avviso">mai vista</span>' : ''}
          <h3>${esc(ad.titolo)}</h3><p>${esc(ad.visual)}</p>
          ${ad.cold ? '<p class="nota">Questa creatività non ha storico: la stima viene dalle sue caratteristiche, quindi la forchetta è larga.</p>' : ''}</div>
        <dl class="tessere">
          <div><dt>CTR previsto</dt><dd>${nf(ck / im * 100)}%</dd></div><div><dt>CPM previsto</dt><dd>${nf(sp / im * 1000)} €</dd></div>
          <div><dt>Costo per click</dt><dd>${nf(sp / ck)} €</dd></div><div><dt>Click in ${P.length} giorni</dt><dd>${ni(ck)}</dd></div>
        </dl>
      </div>
      <div class="griglia due">
        <figure><figcaption>CTR, in percentuale</figcaption><div id="g-ctr"></div></figure>
        <figure><figcaption>CPM, in euro</figcaption><div id="g-cpm"></div></figure>
      </div>
      <p class="legenda"><b>Come si legge.</b> La linea blu è la previsione. La fascia scura dice dove sta il valore di fondo; la fascia chiara dove cadrà il numero di quel giorno, 8 volte su 10. Più la fascia è larga, meno ci fidiamo.</p>
      <details><summary>Tabella giorno per giorno</summary>
        <div class="scorri"><table><thead><tr><th>Giorno</th><th>CTR</th><th>tra</th><th>CPM</th><th>tra</th><th>Costo per click</th><th>Spesa</th><th>Impression</th><th>Click</th></tr></thead>
        <tbody>${P.map(p => `<tr><td>${NOMI_G[dow(p.d)].slice(0, 3)} ${gm(p.d)}</td><td>${nf(p.ctr)}%</td><td>${nf(p.c10)} – ${nf(p.c90)}</td><td>${nf(p.cpm)} €</td><td>${nf(p.m10)} – ${nf(p.m90)}</td><td>${nf(p.cpc)} €</td><td>${nf(p.spesa)} €</td><td>${ni(p.imp)}</td><td>${ni(p.clk)}</td></tr>`).join('')}</tbody></table></div>
      </details>
      <p><a class="bottone chiaro" href="data/previsioni_16-30_nov.csv" download>Scarica tutte le previsioni (CSV)</a></p>`;
    const oggi = giorni.indexOf(D.meta.giorni[0]);
    Grafici.linee($('#g-ctr'), {
      titolo: 'CTR', giorni, oggi, unita: '%', eventi: ev,
      serie: [{ nome: 'storico', colore: '#8E95B3', valori: sto('ctr'), punti: true, spessore: 1.5 }, { nome: 'previsto', colore: '#3247C9', valori: col('ctr'), spessore: 2.5 }],
      fasce: [{ nome: 'quel giorno', colore: '#3247C9', opacita: 0.13, basso: col('c10'), alto: col('c90') }, { nome: 'valore di fondo', colore: '#3247C9', opacita: 0.26, basso: col('a10'), alto: col('a90') }],
    });
    Grafici.linee($('#g-cpm'), {
      titolo: 'CPM', giorni, oggi, unita: ' €', eventi: ev,
      serie: [{ nome: 'storico', colore: '#8E95B3', valori: sto('cpm'), punti: true, spessore: 1.5 }, { nome: 'previsto', colore: '#3247C9', valori: col('cpm'), spessore: 2.5 }],
      fasce: [{ nome: 'quel giorno', colore: '#3247C9', opacita: 0.2, basso: col('m10'), alto: col('m90') }],
    });
    $$('[data-as]', $('.scelte', el)).forEach(b => b.addEventListener('click', () => { S.adset = b.dataset.as; S.ad = null; rAnalisi(); }));
    $$('[data-ad]', el).forEach(b => b.addEventListener('click', () => { S.ad = b.dataset.ad; rAnalisi(); }));
  }

  /* -------------------------------------------------------------- decisioni */
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
    // avvisi sulle creativita
    const annunci = Object.keys(D.perAd).filter(a => c.adset.includes(D.ads[a].adset));
    const riass = annunci.map(a => {
      const P = D.perAd[a], sp = P.reduce((s, p) => s + p.spesa, 0), ck = P.reduce((s, p) => s + p.clk, 0);
      return { a, ad: D.ads[a], cpc: sp / ck, fat: P[P.length - 1].fat, primo: P[0], P };
    });
    const stanche = riass.filter(x => x.fat <= 0.7).sort((x, y) => x.fat - y.fat).slice(0, 3);
    const migliori = c.adset.map(k => riass.filter(x => x.ad.adset === k).sort((x, y) => x.cpc - y.cpc)[0]);
    const nuove = riass.filter(x => x.ad.cold);
    el.innerHTML = `
      <div class="griglia due larga">
        <section class="blocco">
          <h3>Dove mettere il budget</h3>
          <p class="nota">Sposta i cursori: il budget giornaliero di ogni pubblico cambia, costi e click si ricalcolano subito.</p>
          <div id="dec-righe">${c.adset.map(k => {
            const a = D.adset[k];
            return `<div class="dec-riga" data-as="${k}">
              <label for="b-${k}"><b>${TIPI[a.tipo]}</b> <span>${breve(k)}</span></label>
              <input type="range" id="b-${k}" min="${Math.round(a.budget_test * 0.5)}" max="${Math.round(a.budget_test * 2)}" step="1" value="${S.budget[k]}">
              <output></output>
            </div>`;
          }).join('')}</div>
          <div class="dec-bottoni"><button class="bottone piccolo chiaro" id="dec-piano">Piano attuale</button><button class="bottone piccolo" id="dec-proposta">Proposta di Flockets</button></div>
          <div id="dec-totale" class="totale colonna"></div>
          <p class="nota">Il CPM sale quando si spinge su un pubblico: con il doppio del budget arrivano circa il ${ni((Math.pow(2, 1 - e) - 1) * 100)}% di click in più, non il 100%. Click non vuol dire vendite: il pubblico ampio alimenta quelli caldi.</p>
        </section>
        <section class="blocco">
          <h3>Quale creatività, e quando cambiarla</h3>
          <ul class="avvisi">
            ${stanche.map(x => `<li class="rosso"><b>Da sostituire.</b> «${esc(x.ad.titolo)}» (${breve(x.ad.adset)}) al 30/11 avrà perso il ${ni((1 - x.fat) * 100)}% della forza iniziale.</li>`).join('')}
            ${migliori.map(x => `<li class="verde"><b>Rende di più in ${breve(x.ad.adset)}.</b> «${esc(x.ad.titolo)}»: ${nf(x.cpc)} € a click.</li>`).join('')}
            ${nuove.map(x => `<li class="giallo"><b>Mai vista.</b> «${esc(x.ad.titolo)}» (${breve(x.ad.adset)}) parte il ${gm(x.primo.d)}: CTR stimato ${nf(x.primo.ctr)}%, ma può stare tra ${nf(x.primo.a10)} e ${nf(x.primo.a90)}. Da controllare dopo tre giorni.</li>`).join('')}
          </ul>
          <p class="nota"><b>Quando.</b> Un annuncio di urgenza perde un quarto della forza in ${tempoPerdita('urgency', 0.75)} giorni, uno di scarsità in ${tempoPerdita('scarcity', 0.75)}. Un annuncio nuovo paga il CPM più caro per i primi tre giorni: meglio lanciarlo prima del giorno che conta, non il giorno stesso.</p>
        </section>
      </div>`;
    const agg = () => {
      let tot = 0, ck = 0, ck0 = 0, sp = 0;
      c.adset.forEach(k => {
        const B = S.budget[k], x = conBudget(k, B), x0 = conBudget(k, D.adset[k].budget_test);
        tot += B; ck += x.clk; ck0 += x0.clk; sp += x.spesa;
        const d = (B / D.adset[k].budget_test - 1) * 100;
        $(`.dec-riga[data-as="${k}"] output`, el).innerHTML = `<b>${ni(B)} €</b> <i class="${d > 0.5 ? 'su' : d < -0.5 ? 'giu' : ''}">${d > 0 ? '+' : ''}${ni(d)}%</i>
          <span>CPM ${nf(x.cpm)} € · click ${nf(x.cpc)} € · ${ni(x.clk)} click al giorno · frequenza ${nf(x.freq)}</span>`;
      });
      const dc = (ck / ck0 - 1) * 100, db = tot - piano;
      $('#dec-totale').innerHTML = `<div><span>Budget al giorno</span><b>${ni(tot)} €</b> <i class="${Math.abs(db) < 1 ? '' : db > 0 ? 'su' : 'giu'}">${Math.abs(db) < 1 ? 'come il piano' : (db > 0 ? '+' : '') + ni(db) + ' € sul piano'}</i></div>
        <div><span>Click al giorno</span><b>${ni(ck)}</b> <i class="${dc > 0.05 ? 'su' : dc < -0.05 ? 'giu' : ''}">${dc >= 0 ? '+' : ''}${nf(dc, 1)}% sul piano</i></div>
        <div><span>Costo per click</span><b>${nf(sp / ck)} €</b></div>`;
    };
    $$('.dec-riga input', el).forEach(i => i.addEventListener('input', () => { S.budget[i.closest('.dec-riga').dataset.as] = +i.value; agg(); }));
    const metti = f => { c.adset.forEach(k => { S.budget[k] = f(k); $('#b-' + k).value = S.budget[k]; }); agg(); };
    $('#dec-piano').addEventListener('click', () => metti(k => D.adset[k].budget_test));
    $('#dec-proposta').addEventListener('click', () => metti(k => D.adset[k].budget_proposto));
    agg();
  }

  /* ------------------------------------------------------------ laboratorio */
  function leggiTesto(t) {
    const s = t.toLowerCase(), f = {};
    Object.entries(D.par.feat_regole).forEach(([k, rx]) => { f[k] = new RegExp(rx).test(s) ? 1 : 0; });
    const formato = /video|reel|secondi|filmato/.test(s) ? 'video' : /carosello|schede|slide/.test(s) ? 'carosello' : 'immagine';
    const leva = /black/.test(s) ? 'black_friday' : /solo oggi|scade|mezzanotte|24 ore|48 ore|countdown|timer|fino a domenica|stanotte/.test(s) ? 'urgency' : 'scarcity';
    return { f, formato, leva };
  }
  function logFatica(eta, leva) {
    const lf = k => { const [fl, tau] = D.par.fatica[k]; return Math.log(fl + (1 - fl) * Math.exp(-eta / tau)); };
    return leva === 'scarcity' ? lf('scarcity') : leva === 'urgency' ? lf('urgency') : 0.5 * (lf('scarcity') + lf('urgency'));
  }
  function stima(c, L) {
    const P = D.par, x = Object.assign({}, L.f, { video: L.formato === 'video' ? 1 : 0, carosello: L.formato === 'carosello' ? 1 : 0, urgency: L.leva === 'urgency' ? 1 : 0, black_friday: L.leva === 'black_friday' ? 1 : 0 });
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
    if (!S.lab) S.lab = Object.assign({ testo: '', lancio: D.meta.giorni[0] }, leggiTesto(''));
    const L = S.lab;
    el.innerHTML = `
      <div class="griglia due larga">
        <section class="blocco">
          <h3>Descrivi l’annuncio</h3>
          <label class="nascosta" for="lab-testo">Descrizione dell’annuncio</label>
          <textarea id="lab-testo" rows="4" placeholder="Video di 15 secondi: una ragazza parla in camera, nei primi 2 secondi appare la scritta -30% SOLO OGGI">${esc(L.testo)}</textarea>
          <button class="bottone piccolo" id="lab-leggi">Leggi la descrizione</button>
          <p class="nota">Flockets riconosce le caratteristiche che nello storico spostano il CTR. Puoi correggerle a mano.</p>
          <div class="campi">
            <label>Formato <select id="lab-formato">${['immagine', 'video', 'carosello'].map(v => `<option${v === L.formato ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
            <label>Leva <select id="lab-leva">${Object.entries(LEVE).map(([v, n]) => `<option value="${v}"${v === L.leva ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
            <label>Lancio <select id="lab-lancio">${D.meta.giorni.slice(0, 12).map(d => `<option value="${d}"${d === L.lancio ? ' selected' : ''}>${NOMI_G[dow(d)].slice(0, 3)} ${gm(d)}</option>`).join('')}</select></label>
          </div>
          <div class="spunte">${Object.entries(CARATT).map(([k, n]) => `<label><input type="checkbox" data-f="${k}"${L.f[k] ? ' checked' : ''}> ${n}</label>`).join('')}</div>
        </section>
        <section class="blocco" id="lab-esito"></section>
      </div>`;
    const esito = () => {
      const r = stima(c, L), sd = D.par.cold_sd, su = Math.exp(1.28 * sd), max = Math.max(...r.righe.map(x => x.per100));
      const top = r.righe.slice().sort((a, b) => b.per100 - a.per100)[0];
      $('#lab-esito').innerHTML = `
        <h3>Come reagisce il pubblico di ${esc(c.nome)}</h3>
        <p class="verdetto">Qualità stimata: meglio di <b>${r.sotto} creatività su ${r.tot}</b> già viste in questa campagna.</p>
        <div class="lab-righe">${r.righe.map(x => `
          <div class="lab-riga${x.k === top.k ? ' top' : ''}">
            <div class="lab-nome"><b>${TIPI[D.adset[x.k].tipo]}</b> <span>${breve(x.k)}</span></div>
            <div class="barra-o"><i style="width:${(x.per100 / max * 100).toFixed(1)}%"></i></div>
            <div class="lab-num"><b>${ni(x.per100)}</b> click ogni 100 €</div>
            <div class="lab-det">CTR ${nf(x.ctr)}% <span>(tra ${nf(x.ctr / su)} e ${nf(x.ctr * su)})</span> · CPM ${nf(x.cpm)} € · ${nf(x.cpc)} € a click</div>
          </div>`).join('')}</div>
        <p class="nota">Media dei primi ${r.giorni} giorni dal lancio, con il budget previsto per quei giorni. È una stima a freddo: l’annuncio non ha storico, quindi la forchetta è larga. Rende di più su <b>${TIPI[D.adset[top.k].tipo]}</b>.</p>`;
    };
    const campi = () => {
      $('#lab-formato').value = L.formato; $('#lab-leva').value = L.leva;
      $$('.spunte input', el).forEach(i => { i.checked = !!L.f[i.dataset.f]; });
    };
    $('#lab-leggi').addEventListener('click', () => { L.testo = $('#lab-testo').value; Object.assign(L, leggiTesto(L.testo)); campi(); esito(); });
    $('#lab-formato').addEventListener('change', e => { L.formato = e.target.value; esito(); });
    $('#lab-leva').addEventListener('change', e => { L.leva = e.target.value; esito(); });
    $('#lab-lancio').addEventListener('change', e => { L.lancio = e.target.value; esito(); });
    $$('.spunte input', el).forEach(i => i.addEventListener('change', () => { L.f[i.dataset.f] = i.checked ? 1 : 0; esito(); }));
    esito();
  }

  /* --------------------------------------------------------------- consegne */
  function rConsegne(el) {
    const v = (g, m) => D.validazione.find(x => x.gruppo === g && x.modello === m) || {};
    const riga = (n, g, f) => `<tr><td>${n}</td><td><b>${nf(v(g, 'strutturale')[f], 1)}%</b></td><td>${nf(v(g, 'ultimi 7 giorni')[f], 1)}%</td></tr>`;
    const P = D.par;
    el.innerHTML = `
      <p class="intro">La sfida chiede tre cose. Eccole.</p>
      <div class="consegne">
        <section class="blocco">
          <span class="numero">1</span><h3>Lo strumento</h3>
          <p>È questo sito, più il motore di previsione che gli sta dietro. Il motore è scritto in Python e si rilancia con un comando: rifà da zero stima, validazione e previsioni in pochi secondi.</p>
          <p><a class="bottone piccolo" href="${REPO}" target="_blank" rel="noopener">Apri il codice</a></p>
          <ul class="punti"><li><b>Piazza</b>: i pubblici e come reagiscono, giorno per giorno.</li><li><b>Previsioni</b>: CTR e CPM di ogni annuncio con il margine di errore.</li><li><b>Decisioni</b>: dove spostare il budget e quale creatività cambiare.</li><li><b>Laboratorio</b>: un annuncio nuovo provato sul pubblico prima del lancio.</li></ul>
        </section>
        <section class="blocco">
          <span class="numero">2</span><h3>Le previsioni</h3>
          <p><b>${ni(D.meta.righe_previste)} righe</b>: ${D.meta.annunci_previsti} annunci, ogni giorno dal ${gm(D.meta.giorni[0])} al ${gm(D.meta.giorni[D.meta.giorni.length - 1])}. Per ogni riga CTR e CPM con la loro forchetta, più costo per click, spesa, impression e click.</p>
          <p>${D.meta.righe_cold} righe riguardano creatività mai viste nello storico: sono stimate dalle caratteristiche dell’annuncio.</p>
          <p><a class="bottone piccolo" href="data/previsioni_16-30_nov.csv" download>Scarica il file (CSV)</a></p>
        </section>
        <section class="blocco largo">
          <span class="numero">3</span><h3>Il ragionamento</h3>
          <p>Lo storico segue una struttura a fattori che si moltiplicano. Ogni fattore è stimato dai dati.</p>
          <pre class="formula">CTR = qualità dell’asset × pubblico × fatica della creatività × stagione × giorno della settimana
CPM = livello del pubblico × stagione × giorno × (budget ÷ budget iniziale)<sup>${nf(P.elasticita)}</sup> × apprendimento × qualità</pre>
          <div class="griglia due larga">
            <ol class="scoperte">
              <li><b>Il mercato 2025 anticipa il 2026.</b> Il CPM segue l’indice dell’anno prima spostato di 52 settimane, in rapporto 1 a 1.</li>
              <li><b>La creatività si stanca.</b> L’urgenza perde un quarto della forza in ${tempoPerdita('urgency', 0.75)} giorni, la scarsità in ${tempoPerdita('scarcity', 0.75)}.</li>
              <li><b>Più budget, CPM più alto.</b> Un solo ad set ha avuto il budget raddoppiato per una settimana: da lì si legge quanto sale il CPM.</li>
              <li><b>Fase di apprendimento.</b> Un annuncio nuovo paga il CPM il ${ni((Math.exp(P.cpm_new3) - 1) * 100)}% in più per tre giorni.</li>
              <li><b>Cosa rende forte una creatività.</b> Un aggancio nei primi due secondi vale circa +${ni((Math.exp(P.feat_w[P.feat_cols.indexOf('hook') + 1]) - 1) * 100)}% di CTR, una grafica piena di testo circa ${ni((Math.exp(P.feat_w[P.feat_cols.indexOf('testo_pesante') + 1]) - 1) * 100)}%.</li>
              <li><b>Annunci migliori costano meno.</b> Il CPM scende quando la qualità sale e risale quando l’annuncio si stanca.</li>
            </ol>
            <div>
              <h4>Quanto ci fidiamo</h4>
              <p>Abbiamo nascosto al modello 14 giorni di storico, li abbiamo fatti prevedere e confrontato con i valori veri. Quattro volte, su date diverse.</p>
              <table class="stretta"><thead><tr><th>Errore medio</th><th>Flockets</th><th>«Resta come gli ultimi 7 giorni»</th></tr></thead><tbody>
                ${riga('CPM, tutti gli annunci', 'tutti', 'cpm')}${riga('CPM, annunci nuovi', 'annunci nuovi', 'cpm')}${riga('CTR, tutti gli annunci', 'tutti', 'ctr')}${riga('CTR, annunci nuovi', 'annunci nuovi', 'ctr')}
              </tbody></table>
              <h4>Anomalie trovate nei dati</h4>
              <ul class="punti">${D.anomalie.map(a => `<li><b>${gm(a.data)}</b>, ${esc(a.dove.replace('_', ' '))}: ${esc(a.cosa)}.</li>`).join('')}</ul>
              <h4>Dove siamo più incerti</h4>
              <ul class="punti"><li>Nello storico non c’è un Black Friday, né un aumento di budget su più ad set insieme.</li><li>L’effetto del budget sul CPM viene da un solo ad set.</li><li>Le creatività mai viste hanno una forchetta larga.</li></ul>
            </div>
          </div>
          <p>I pubblici immaginati, con i numeri che li motivano, sono nella scheda <a href="#/analisi/pubblici">Pubblici</a>.</p>
        </section>
      </div>`;
  }

  /* ------------------------------------------------------------------ avvio */
  function velo(poi) {
    const passi = ['Leggo i dati', 'Cerco le anomalie', 'Immagino i pubblici', 'Leggo le creatività', 'Calcolo le previsioni'];
    const v = $('#velo'), ol = $('#velo-passi');
    ol.innerHTML = passi.map(p => `<li>${p}</li>`).join('');
    v.hidden = false;
    Flock.carica().then(() => {
      const sc = new Flock.Scena($('#velo-omino'), { scala: 2, altezza: 96, suolo: 4 }).popola(1);
      const o = sc.omini[0]; o.vel = 0; o.x = 48; o.dir = 1; o.dy = 0; o.pausa = 1e9; o.imposta('corsa');
    });
    let i = 0;
    const t = setInterval(() => {
      if (i < passi.length) ol.children[i].classList.add('fatto');
      i++;
      if (i > passi.length) { clearInterval(t); dati().then(() => { v.hidden = true; poi(); }); }
    }, 330);
  }
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
    const serve = ['data', 'ad_id', 'adset_id', 'spesa', 'impression', 'click'], manca = serve.filter(n => ix(n) < 0);
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
    Object.entries(vd).forEach(([k, a]) => { if (a.c === 0 && a.i > 5000) note.push(`${gm(k.split('|')[1])}: zero click su ${a.n} annunci (${k.split('|')[0].replace('_', ' ')}). Sembra un problema di tracciamento.`); });
    Object.entries(sd).forEach(([k, b]) => { if (b.s > 1.15 * b.b) note.push(`${gm(k.split('|')[1])}, ${k.split('|')[0]}: spesa ${ni(b.s)} € con budget ${ni(b.b)} €.`); });
    return { ok: true, n, ads: ads.size, min, max, note, lista: Array.from(ads) };
  }
  function suFile(files) {
    const out = $('#esito-file');
    const lista = Array.from(files).filter(f => /\.csv$/i.test(f.name) || f.type === 'text/csv');
    if (!lista.length) { out.innerHTML = '<p class="errore">Serve un file CSV.</p>'; return; }
    out.innerHTML = '<p>Leggo…</p>';
    Promise.all(lista.map(f => f.text().then(t => ({ nome: f.name, righe: leggiCSV(t) })))).then(letti => {
      const st = letti.map(x => Object.assign({ nome: x.nome }, controllaStorico(x.righe))).filter(x => x.ok).sort((a, b) => b.n - a.n)[0];
      if (!st) { out.innerHTML = '<p class="errore">Non trovo lo storico giornaliero. Servono le colonne: data, ad_id, adset_id, spesa, impression, click.</p>'; return; }
      dati().then(() => {
        const noti = st.lista.filter(a => D.ads_storico.includes(a)).length / st.lista.length;
        const kit = noti > 0.9 && st.n > 1000;
        out.innerHTML = `<ul class="controlli">
            <li class="si">${esc(st.nome)}: ${ni(st.n)} righe, ${st.ads} annunci, dal ${gm(st.min)} al ${gm(st.max)}.</li>
            ${st.note.map(x => `<li class="attento">${esc(x)}</li>`).join('') || '<li class="si">Nessuna anomalia evidente.</li>'}
            <li class="${kit ? 'si' : 'attento'}">${kit ? 'È il kit della sfida: apro l’analisi già calcolata dal motore.' : 'Non è il kit della sfida. Il file è leggibile, ma per calcolare previsioni su dati nuovi va lanciato il motore dal codice.'}</li>
          </ul>${kit ? '<button class="bottone" id="apri-da-file">Apri l’analisi</button>' : `<a class="bottone chiaro" href="${REPO}" target="_blank" rel="noopener">Vedi il motore</a>`}`;
        const b = $('#apri-da-file'); if (b) b.addEventListener('click', () => velo(() => { location.hash = '#/analisi/piazza'; }));
      });
    });
  }

  /* ------------------------------------------------------------------ avvio pagina */
  function inizio() {
    Flock.carica().then(() => {
      const cv = $('#striscia');
      const n = stringe(Math.round((cv.clientWidth || window.innerWidth) / 52), 8, 40);
      new Flock.Scena(cv, { scala: 3, altezza: 200, avvolgi: true, suolo: 26 }).popola(n, { profondita: 16 });
    });
    $('#avvio-kit').addEventListener('click', () => velo(() => { location.hash = '#/analisi/piazza'; }));
    $('#avvio-prompt').addEventListener('click', () => {
      const t = $('#avvio-testo').value.trim() || $('#avvio-testo').placeholder;
      velo(() => { S.lab = Object.assign({ testo: t, lancio: D.meta.giorni[0] }, leggiTesto(t)); location.hash = '#/analisi/laboratorio'; });
    });
    $('#file-ingresso').addEventListener('change', e => suFile(e.target.files));
    const z = $('#zona-file');
    ['dragenter', 'dragover'].forEach(n => z.addEventListener(n, e => { e.preventDefault(); z.classList.add('sopra'); }));
    ['dragleave', 'drop'].forEach(n => z.addEventListener(n, e => { e.preventDefault(); z.classList.remove('sopra'); }));
    z.addEventListener('drop', e => suFile(e.dataTransfer.files));
    window.addEventListener('hashchange', instrada);
    let rt = null;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (document.body.dataset.vista === 'analisi' && S.tab === 'previsioni' && D) rAnalisi(); }, 250); });
    instrada();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inizio); else inizio();
})();
