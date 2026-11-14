/* Risultati di Flockets: due viste sullo stesso progetto.
   «Persone»: solo omini, ognuno una persona simulata. Toccandolo si apre la sua scheda sopra la testa.
   «Analisi»: soldi e numeri, giorno per giorno, il pubblico migliore e tutti gli altri, cosa fare adesso.
   Il pubblico migliore non si sceglie prima: è un risultato dell'analisi. */
window.Analisi = (function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf = (v, d = 2) => Number(v || 0).toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d });
  const ni = v => Math.round(v || 0).toLocaleString('it-IT');
  const n1 = v => (v >= 100 ? ni(v) : v >= 10 ? nf(v, 0) : nf(v, 1));
  const eur = v => (v >= 1000 ? ni(v) : nf(v, v >= 100 ? 0 : 2)) + '\u00a0€';
  const gm = d => d.slice(8, 10) + '/' + d.slice(5, 7);
  const mesi = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  const giornoLungo = d => +d.slice(8, 10) + ' ' + mesi[+d.slice(5, 7) - 1];
  const piu = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  const VERDE = '#15803D', ARANCIO = '#F2551D', BLU = '#3B4BE0';
  const NOMI_PUBBLICO = { ampio: 'Pubblico ampio', interessi: 'Interessi', sosia: 'Sosia dei clienti', caldo: 'Già vicini al marchio', retargeting: 'Già vicini al marchio', unico: 'Tutto il pubblico' };
  const FRASI_PUBBLICO = { ampio: 'Tutti, decide la piattaforma', interessi: 'Chi segue la categoria', sosia: 'Simili a chi compra', caldo: 'Chi conosce già il marchio', retargeting: 'Chi ha già visitato il sito', unico: 'L’unico pubblico della campagna' };

  let M = null, sorgente = null, nuovaDati = null, filtro = 'tutto', modo = 'persone', scena = null, scelto = null, filtroPub = 'tutti', segui = null;

  /* ------------------------------------------------------------------ modelli */
  // dati della sfida o file caricato: previsioni del modello + persone simulate e tarate su di esse
  function daStorico(fc) {
    const D = window.Flk.D, P = D.persone || {}, giorni = D.meta.giorni;
    const campagne = fc === 'tutto' ? D.campagne : D.campagne.filter(c => c.id === fc);
    const tutto = fc === 'tutto' && D.campagne.length > 1;
    const pub = [];
    campagne.forEach(c => c.adset.forEach(k => {
      const a = D.adset[k], x = P[k], z = D.zona[k] || {};
      let spesa = 0, imp = 0, clk = 0;
      giorni.forEach(d => { if (z[d]) { spesa += z[d].spesa; imp += z[d].imp; clk += z[d].clk; } });
      const acq = x ? x.totali.acquisti : null, ric = x ? x.totali.ricavi : null;
      pub.push({ id: k, tipo: a.tipo, nome: NOMI_PUBBLICO[a.tipo] || 'Pubblico', marca: c.nome, frase: FRASI_PUBBLICO[a.tipo] || '',
        spesa, imp, clk, acq, ricavi: ric, forchetta: x ? x.forchetta : null, segmenti: x ? x.segmenti : null, persone: x ? x.persone : [],
        giorni: x ? x.giorni : [], grandezza: a.grandezza, budget: a.budget_test, budget_proposto: a.budget_proposto });
    }));
    // due gruppi dello stesso tipo nella stessa campagna: «Interessi 1», «Interessi 2»
    const conta = {};
    pub.forEach(p => { const c = p.marca + '|' + p.tipo; conta[c] = (conta[c] || 0) + 1; p.n = conta[c]; });
    pub.forEach(p => { if (conta[p.marca + '|' + p.tipo] > 1) p.nome += ' ' + p.n; });
    const conAcquisti = pub.every(p => p.acq != null);
    const tot = somma(pub, conAcquisti);
    const perGiorno = giorni.map(d => {
      let spesa = 0, imp = 0, clk = 0, acq = 0, ric = 0;
      pub.forEach(p => { const z = (D.zona[p.id] || {})[d]; if (z) { spesa += z.spesa; imp += z.imp; clk += z.clk; }
        const g = p.giorni.find(x => x.data === d); if (g) { acq += g.acquisti; ric += g.ricavi; } });
      return { d, spesa, imp, clk, acq, ric };
    });
    const eventi = {};
    Object.entries(D.meta.eventi || {}).forEach(([d, n]) => { if (giorni.includes(d) && /Black Friday|Cyber/.test(n)) eventi[d] = n.replace(/\s*\(.*\)/, ''); });
    const titolo = tutto ? 'Tutto il progetto' : campagne.map(c => c.nome).join(', ');
    return completa({ sorgente: 'storico', titolo, campagne: D.campagne.map(c => ({ id: c.id, nome: c.nome })), filtro: fc,
      dal: giorni[0], al: giorni[giorni.length - 1], ngiorni: giorni.length, tot, perGiorno, eventi, pubblici: pub, conAcquisti,
      etichettaPubblico: p => (tutto ? p.nome + ' · ' + p.marca : p.nome), datiSfida: window.Flk.kit() });
  }
  // campagna nuova: la stessa campagna simulata su ogni tipo di pubblico
  function daNuova(d) {
    const C = d.campagna, cat = C.categoria === 'generica' ? 'il tuo prodotto' : (C.descrizione_prodotto || C.categoria.replace(/_/g, ' '));
    const pub = d.pubblici.map(p => ({ id: p.tipo, tipo: p.tipo, nome: NOMI_PUBBLICO[p.tipo], frase: p.descrizione.replace(/\.$/, ''), marca: '',
      spesa: p.totali.spesa, imp: p.totali.impressioni, clk: p.totali.click, acq: p.totali.acquisti, ricavi: p.totali.ricavi,
      raggiunte: p.totali.persone_raggiunte, forchetta: p.forchetta, segmenti: p.segmenti, persone: p.persone, giorni: p.giorni,
      grandezza: p.pubblico.persone_raggiungibili, migliori: p.migliori }));
    const best = pub.find(p => p.id === d.migliore) || pub[0];
    const perGiorno = best.giorni.map(g => ({ d: g.data, spesa: g.spesa, imp: g.impressioni, clk: g.click, acq: g.acquisti, ric: g.ricavi }));
    const tot = somma([best], true);
    tot.raggiunte = best.raggiunte;
    return completa({ sorgente: 'nuova', titolo: cat.charAt(0).toUpperCase() + cat.slice(1), campagne: [], filtro: 'tutto',
      dal: C.inizio, al: piu(C.inizio, C.giorni - 1), ngiorni: C.giorni, tot, perGiorno, eventi: {}, pubblici: pub, conAcquisti: true,
      etichettaPubblico: p => p.nome, principale: best, nuova: d });
  }
  function somma(pub, conAcquisti) {
    const t = { spesa: 0, imp: 0, clk: 0, acq: 0, ricavi: 0, acqBasso: 0, acqAlto: 0, ricBasso: 0, ricAlto: 0 };
    pub.forEach(p => {
      t.spesa += p.spesa; t.imp += p.imp; t.clk += p.clk;
      if (conAcquisti) { t.acq += p.acq; t.ricavi += p.ricavi;
        if (p.forchetta) { t.acqBasso += p.forchetta.acquisti[0]; t.acqAlto += p.forchetta.acquisti[1]; t.ricBasso += p.forchetta.ricavi[0]; t.ricAlto += p.forchetta.ricavi[1]; } }
    });
    return t;
  }
  // resa per euro, pubblico migliore, gruppi di persone che rispondono meglio, cosa fare
  function completa(m) {
    const per = m.conAcquisti ? (p => p.acq / Math.max(p.spesa, 1e-9)) : (p => p.clk / Math.max(p.spesa, 1e-9));
    // campagna nuova: ogni pubblico è una prova alternativa con lo stesso budget, la media è su tutte le prove
    const base = m.sorgente === 'nuova' ? somma(m.pubblici, m.conAcquisti) : m.tot;
    const media = m.conAcquisti ? base.acq / Math.max(base.spesa, 1e-9) : base.clk / Math.max(base.spesa, 1e-9);
    m.pubblici.forEach(p => { p.resa = media > 0 ? per(p) / media : 0; });
    m.pubblici.sort((a, b) => b.resa - a.resa);
    m.migliore = m.principale || m.pubblici[0];
    m.gruppi = gruppi(m);
    m.azioni = azioni(m);
    return m;
  }
  function gruppi(m) {
    const fonti = m.principale ? [m.principale] : m.pubblici.filter(p => p.segmenti);
    if (!fonti.length) return null;
    const out = {};
    ['eta', 'genere', 'area', 'reddito', 'famiglia'].forEach(tag => {
      const livelli = {};
      fonti.forEach(p => (p.segmenti[tag] || []).forEach(r => {
        const x = (livelli[r.livello] = livelli[r.livello] || { etichetta: r.etichetta, spesa: 0, acq: 0, clk: 0 });
        x.spesa += r.quota_impressioni * p.spesa; x.acq += r.quota_acquisti * (p.acq || 0); x.clk += r.quota_click * p.clk;
      }));
      const S = Object.values(livelli).reduce((s, x) => s + x.spesa, 0), A = Object.values(livelli).reduce((s, x) => s + x.acq, 0);
      out[tag] = Object.entries(livelli).map(([k, x]) => ({ livello: k, etichetta: x.etichetta, quota_spesa: x.spesa / S, quota_acq: A ? x.acq / A : 0,
        resa: A && x.spesa ? (x.acq / x.spesa) / (A / S) : 0 }));
    });
    return out;
  }
  function azioni(m) {
    const a = [], best = m.migliore, peggio = m.pubblici[m.pubblici.length - 1], unita = m.conAcquisti ? 'acquisti' : 'click';
    if (m.sorgente === 'storico' && m.pubblici.length > 1 && peggio.resa < 0.75) {
      const sposta = Math.max(5, Math.round(peggio.budget * 0.3 / 5) * 5);
      const valB = (m.conAcquisti ? best.acq : best.clk) / best.spesa, valP = (m.conAcquisti ? peggio.acq : peggio.clk) / peggio.spesa;
      const guadagno = sposta * m.ngiorni * (valB - valP) * 0.8;   // 0,8: spingere un pubblico lo fa costare un po' di più
      a.push(`Sposta ${ni(sposta)} € al giorno da «${m.etichettaPubblico(peggio)}» a «${m.etichettaPubblico(best)}»: circa ${n1(guadagno)} ${unita} in più nello stesso periodo.`);
    }
    if (m.sorgente === 'nuova') {
      const ampio = m.pubblici.find(p => p.id === 'ampio');
      if (ampio && best.id !== 'ampio') a.push(`Usa il pubblico «${best.nome}»: ${n1(best.acq)} acquisti contro ${n1(ampio.acq)} con il pubblico ampio, a parità di budget.`);
      else a.push(`Il pubblico ampio è già la scelta migliore: la piattaforma trova da sola chi compra.`);
      const c = m.nuova.consigli && m.nuova.consigli.classifica[0];
      const CANALI = { social: 'social (Facebook, Instagram)', video_brevi: 'video brevi (TikTok, Reels)', ricerca: 'ricerca Google', shopping: 'annunci prodotto su Google', display: 'banner', video: 'YouTube', email: 'email' };
      if (c && c.rispetto_alla_partenza > 1.1) a.push(`Prova anche ${CANALI[c.canale] || c.canale}, formato ${c.formato.replace('_', ' ')}: circa ×${nf(c.rispetto_alla_partenza, 1)} ${m.conAcquisti ? 'acquisti' : 'risultati'}.`);
    }
    if (m.gruppi && m.gruppi.eta) {
      const top = t => m.gruppi[t].slice().sort((x, y) => y.resa - x.resa)[0];
      const e = top('eta'), g = top('genere');
      if (e && e.resa > 1.15) a.push(`Chi risponde meglio: ${g.etichetta === 'donna' ? 'donne' : 'uomini'} di ${e.etichetta.replace(' anni', '')} anni. Parla a loro nelle prossime creatività.`);
    }
    if (m.sorgente === 'storico') {
      const D = window.Flk.D, ids = new Set(m.pubblici.map(p => p.id));
      const stanche = Object.entries(D.perAd || {}).filter(([ad, r]) => ids.has(D.ads[ad].adset) && r[r.length - 1].fat <= 0.65)
        .map(([ad, r]) => ({ t: D.ads[ad].titolo, f: r[r.length - 1].fat })).sort((x, y) => x.f - y.f);
      if (stanche.length) a.push(`Cambia «${stanche[0].t}»${stanche.length > 1 ? ` e altre ${stanche.length - 1} creatività` : ''}: a fine periodo avrà perso il ${ni((1 - stanche[0].f) * 100)}% della forza.`);
      if (Object.keys(m.eventi).length) a.push(`Lancia le creatività nuove almeno 3 giorni prima del Black Friday: nei primi giorni un annuncio costa di più.`);
    }
    return a.slice(0, 4);
  }

  /* --------------------------------------------------------- personaggi e persone */
  const FEMMINILI = /vestito|chignon|Studentessa|Maestra|Nonna|capelli lunghi/i, MASCHILI = /Impiegato|Muratore|Giardiniere|Idraulico|Nonno|pelato|casco|bandana|cresta|Punk/i, ANZIANI = /Nonn|grigi/i;
  function personaggi(persone) {
    const nomi = window.Flock.nomiPersonaggi(), usati = new Set();
    return persone.map(p => {
      let cand = nomi.map((n, i) => i).filter(i => !usati.has(i) && (p.genere === 'donna' ? FEMMINILI.test(nomi[i]) || !MASCHILI.test(nomi[i]) : MASCHILI.test(nomi[i]) || !FEMMINILI.test(nomi[i])));
      const vecchi = cand.filter(i => ANZIANI.test(nomi[i]));
      if (p.eta >= 62 && vecchi.length) cand = vecchi; else if (p.eta < 50) cand = cand.filter(i => !ANZIANI.test(nomi[i])).concat(cand.length ? [] : vecchi);
      if (!cand.length) cand = nomi.map((n, i) => i).filter(i => !usati.has(i));
      const id = cand[Math.floor(Math.random() * cand.length)] || 0;
      usati.add(id);
      return id;
    });
  }
  function personeDaMostrare(m) {
    const quante = window.innerWidth < 600 ? 14 : 30, per = Math.max(2, Math.ceil(quante / m.pubblici.length));
    const out = [];
    // per ogni pubblico alterna chi compra, chi clicca e chi passa oltre (le persone arrivano raggruppate per esito)
    const misto = lista => { const g = ['compra', 'clicca', 'passa'].map(e => lista.filter(x => x.esito === e)), r = [];
      for (let i = 0; r.length < lista.length; i++) g.forEach(x => { if (x[i]) r.push(x[i]); }); return r; };
    m.pubblici.forEach(p => misto(p.persone || []).slice(0, per).forEach(x => out.push(Object.assign({ pubblico: p }, x))));
    return out.slice(0, quante + m.pubblici.length);
  }

  /* -------------------------------------------------------------- vista Persone */
  function rPersone() {
    chiudiScheda();
    const st = $('#a-persone'), persone = personeDaMostrare(M);
    // un filtro per tipo di pubblico (non per ogni gruppo di inserzioni): pochi bottoni anche con tante campagne
    const tipi = [...new Set(M.pubblici.map(p => p.tipo))];
    if (filtroPub !== 'tutti' && !tipi.includes(filtroPub)) filtroPub = 'tutti';
    $('#a-legenda').innerHTML = `<div class="a-filtro-pub">${['tutti', ...tipi].map(t => `<button data-p="${esc(t)}" class="${filtroPub === t ? 'si' : ''}">${
        t === 'tutti' ? 'Tutti' : esc(NOMI_PUBBLICO[t] || 'Pubblico')}${t === M.migliore.tipo ? ' ★' : ''}</button>`).join('')}</div>
      <p class="a-segni"><i style="background:${VERDE}"></i>ha comprato <i style="background:${ARANCIO}"></i>ha cliccato <span>gli altri sono passati oltre</span></p>`;
    $$('#a-legenda [data-p]').forEach(b => b.addEventListener('click', () => { filtroPub = b.dataset.p; rPersone(); }));
    if (!persone.length) { $('#a-aiuto').textContent = 'Nessuna persona simulata per questi dati.'; return; }
    $('#a-aiuto').textContent = 'Tocca una persona per vedere chi è e cosa ha fatto.';
    window.Flock.carica().then(() => {
      const vecchio = $('#a-folla'), nuovo = vecchio.cloneNode(false); vecchio.replaceWith(nuovo);   // la scena vecchia si ferma da sola
      const h = st.clientHeight, stretto = window.innerWidth < 600;
      const ids = personaggi(persone);
      scena = window.Flock.campo($('#a-prato'), nuovo, { altezza: h, altezzaPrato: h, ids, scale: stretto ? [2, 3] : [3, 4], fondo: 0.55, suolo: stretto ? 18 : 26 });
      scena.omini.forEach(o => {
        const p = persone[ids.indexOf(o.id)];
        o.persona = p;
        o.segno = p.esito === 'compra' ? VERDE : p.esito === 'clicca' ? ARANCIO : null;
        o.a = filtroPub === 'tutti' || p.pubblico.tipo === filtroPub ? 1 : 0.22;
        if (p.esito === 'compra' && Math.random() < 0.5) o.pausa = 1 + Math.random() * 4;
      });
      nuovo.addEventListener('pointerdown', e => {
        const r = nuovo.getBoundingClientRect(), o = scena.trova(e.clientX - r.left, e.clientY - r.top);
        if (o) apriScheda(o); else chiudiScheda();
      });
      nuovo.addEventListener('pointermove', e => {
        const r = nuovo.getBoundingClientRect();
        nuovo.style.cursor = scena.trova(e.clientX - r.left, e.clientY - r.top) ? 'pointer' : 'default';
      });
    });
  }
  function apriScheda(o) {
    chiudiScheda(true);
    scelto = o; o.bloccato = true; o.scelto = true; o.imposta('fermo');
    const p = o.persona, sch = $('#a-scheda'), donna = p.genere === 'donna';
    const esito = { compra: ['Ha comprato', 'compra'], clicca: ['Ha cliccato', 'clicca'], passa: [donna ? 'È passata oltre' : 'È passato oltre', 'passa'] }[p.esito];
    sch.innerHTML = `<button type="button" class="chiudi" aria-label="Chiudi">✕</button>
      <header><b>${esc(p.nome)}, ${p.eta} anni</b><span>${esc(p.regione)} · ${esc(p.comune)}</span></header>
      <p class="chi">${esc(p.lavoro)} · ${esc(p.reddito)} · ${esc(p.famiglia)}</p>
      <p class="esito"><span class="bollino ${esito[1]}">${esito[0]}</span>ha visto l’annuncio ${p.visto} ${p.visto === 1 ? 'volta' : 'volte'}</p>
      <dl class="tre-n"><div><dd>${nf(100 * p.prob_click, 1)}%</dd><dt>clicca</dt></div><div><dd>${p.esito === 'passa' ? '–' : nf(100 * p.prob_acquisto, 1) + '%'}</dd><dt>compra dopo il click</dt></div><div><dd>${p.resa ? '×' + nf(p.resa, 1) : '–'}</dd><dt>resa per euro</dt></div></dl>
      ${p.perche && p.perche.length ? `<p class="perche">${p.perche.map(esc).join(' · ')}</p>` : ''}
      <p class="gruppo">${esc(M.etichettaPubblico(p.pubblico))}${p.persone_simili ? ` · ${ni(p.persone_simili)} persone come ${donna ? 'lei' : 'lui'} in Italia` : ''}</p>`;
    sch.hidden = false;
    $('.chiudi', sch).addEventListener('click', () => chiudiScheda());
    const muovi = () => {
      if (!scelto || !scena) return;
      const c = $('#a-folla'), st = $('#a-persone'), t = scena.testa(scelto), w = st.clientWidth, sw = sch.offsetWidth, sh = sch.offsetHeight;
      const x = Math.min(Math.max(t.x, sw / 2 + 12), w - sw / 2 - 12), y = c.offsetTop + t.y;
      const sopra = y - sh - 14 > 8;
      sch.style.left = x + 'px';
      sch.style.setProperty('--freccia', Math.min(Math.max(t.x - x + sw / 2, 22), sw - 22) + 'px');   // la punta indica la testa
      sch.style.top = (sopra ? y - sh - 14 : y + 18 + (scelto.s || 3) * 30) + 'px';
      sch.classList.toggle('sotto', !sopra);
      segui = requestAnimationFrame(muovi);
    };
    cancelAnimationFrame(segui); muovi();
    $('#a-aiuto').hidden = true;
  }
  function chiudiScheda(silenzioso) {
    cancelAnimationFrame(segui);
    if (scelto) { scelto.bloccato = false; scelto.scelto = false; scelto.imposta('camminata'); scelto = null; }
    const sch = $('#a-scheda'); if (sch) sch.hidden = true;
    if (!silenzioso && $('#a-aiuto')) $('#a-aiuto').hidden = false;
  }

  /* -------------------------------------------------------------- vista Analisi */
  function rAnalisi() {
    const m = M, T = m.tot, best = m.migliore, el = $('#a-contenuto');
    const roas = T.ricavi / Math.max(T.spesa, 1e-9);
    const tra = (a, b, f) => (a && b ? `<small>tra ${f(a)} e ${f(b)}</small>` : '');
    const scheda = (titolo, corpo, cls = '') => `<section class="a-card ${cls}"><h3>${titolo}</h3>${corpo}</section>`;
    const val = p => (m.conAcquisti ? p.acq : p.clk);
    const frase = m.sorgente === 'nuova'
      ? `Con ${eur(T.spesa / m.ngiorni)} al giorno per ${m.ngiorni} giorni e il pubblico migliore: circa <b>${ni(T.raggiunte)} persone</b> raggiunte, <b>${ni(T.clk)} click</b> e <b>${n1(T.acq)} acquisti</b>, per ${eur(T.ricavi)} di ricavi.`
      : `Dal ${giornoLungo(m.dal)} al ${giornoLungo(m.al)}, con ${eur(T.spesa)} di budget: circa <b>${ni(T.imp)} visualizzazioni</b>, <b>${ni(T.clk)} click</b>${m.conAcquisti ? ` e <b>${n1(T.acq)} acquisti</b>, per ${eur(T.ricavi)} di ricavi` : ''}.`;
    const maxResa = Math.max(...m.pubblici.map(p => p.resa), 0.01);
    const righePub = m.pubblici.map((p, i) => {
      const cpa = val(p) ? p.spesa / val(p) : 0, poco = p.resa < 0.75;
      const dentro = p.segmenti ? (() => {
        const piu = tag => p.segmenti[tag].slice().sort((a, b) => b.quota_click - a.quota_click)[0];
        const d = p.segmenti.genere.find(x => x.livello === 'donna');
        return `${ni(d.quota_click * 100)}% donne · soprattutto ${esc(piu('eta').etichetta)} · ${esc(piu('area').etichetta)} · ${esc(piu('reddito').etichetta)}`;
      })() : '';
      const budget = p.budget_proposto && p.budget && Math.abs(p.budget_proposto - p.budget) >= 5
        ? `Budget consigliato: ${ni(p.budget_proposto)} € al giorno invece di ${ni(p.budget)} €.` : '';
      return `<details class="a-pub ${p === best ? 'top' : ''}">
        <summary>
          <div class="a-pub-nome"><b>${esc(m.etichettaPubblico(p))}</b><span>${esc(p.frase)}</span></div>
          <div class="a-pub-barra"><i style="width:${(p.resa / maxResa * 100).toFixed(1)}%"></i></div>
          <div class="a-pub-num"><b>${m.conAcquisti ? n1(p.acq) + ' acquisti' : ni(p.clk) + ' click'}</b><span>${cpa ? eur(cpa) + (m.conAcquisti ? ' ad acquisto' : ' a click') : ''}</span></div>
          <span class="a-badge ${p === best ? 'verde' : poco ? 'arancio' : ''}">${p === best ? 'il migliore' : poco ? 'rende poco' : p.resa >= 1.15 ? 'sopra la media' : p.resa <= 0.9 ? 'sotto la media' : 'nella media'}</span>
        </summary>
        <div class="a-pub-det">
          <p>${ni(p.imp)} visualizzazioni · ${ni(p.clk)} click · ${eur(p.spesa)} spesi${p.ricavi != null ? ' · ' + eur(p.ricavi) + ' di ricavi' : ''}</p>
          ${dentro ? `<p><b>Chi c’è dentro:</b> ${dentro}</p>` : ''}
          ${budget ? `<p><b>${budget}</b></p>` : ''}
        </div></details>`;
    }).join('');
    const barre = tag => {
      const r = (m.gruppi[tag] || []).slice().sort((a, b) => b.resa - a.resa), mx = Math.max(...r.map(x => x.resa), 0.01);
      return `<div class="a-gr"><b>${{ eta: 'Età', genere: 'Genere', area: 'Area', reddito: 'Reddito', famiglia: 'Famiglia' }[tag]}</b>${r.map(x =>
        `<div class="a-gr-riga"><span>${esc(x.etichetta)}</span><div><i style="width:${(x.resa / mx * 100).toFixed(1)}%" class="${x.resa >= 1.15 ? 'su' : x.resa <= 0.85 ? 'giu' : ''}"></i></div><em>×${nf(x.resa, 1)}</em></div>`).join('')}</div>`;
    };
    const annuncio = annuncioProvato();
    el.innerHTML = `
      <div class="a-testa">
        <p class="a-frase">${frase}</p>
        <dl class="a-kpi">
          <div><dt>Spesa</dt><dd>${eur(T.spesa)}</dd></div>
          <div><dt>${m.sorgente === 'nuova' ? 'Persone raggiunte' : 'Visualizzazioni'}</dt><dd>${ni(m.sorgente === 'nuova' ? T.raggiunte : T.imp)}</dd></div>
          <div><dt>Click</dt><dd>${ni(T.clk)}</dd><small>${nf(100 * T.clk / Math.max(T.imp, 1))} ogni 100 viste</small></div>
          ${m.conAcquisti ? `<div><dt>Acquisti</dt><dd>${n1(T.acq)}</dd>${tra(T.acqBasso, T.acqAlto, n1)}</div>
          <div><dt>Ricavi</dt><dd>${eur(T.ricavi)}</dd>${tra(T.ricBasso, T.ricAlto, eur)}</div>
          <div><dt>Ogni euro speso</dt><dd>${nf(roas)} €</dd><small>${roas >= 1 ? 'torna con un guadagno' : 'non si ripaga ancora'}</small></div>` : ''}
        </dl>
        ${m.conAcquisti && m.sorgente === 'storico' && m.datiSfida ? '<p class="a-nota">Acquisti e ricavi sono stimati dalle persone simulate: nei dati della sfida non ci sono.</p>' : ''}
      </div>
      <div class="a-griglia">
        ${scheda('Il pubblico migliore', `
          <p class="a-best"><b>${esc(m.etichettaPubblico(best))}</b> <span>${esc(best.frase)}</span></p>
          <p>${m.pubblici.length > 1 ? `Ogni euro speso qui rende <b>${nf(best.resa, 1)} volte</b> ${m.sorgente === 'nuova' ? 'la media dei pubblici provati' : 'la media'}.` : ''} ${m.conAcquisti ? `${n1(best.acq)} acquisti a ${eur(best.spesa / Math.max(best.acq, 1e-9))} l’uno.` : `${ni(best.clk)} click a ${eur(best.spesa / Math.max(best.clk, 1))} l’uno.`}</p>
          ${m.sorgente === 'nuova' ? '<p class="a-nota">Scelto dall’analisi: la stessa campagna provata su ogni tipo di pubblico, con lo stesso budget.</p>' : ''}`, 'evidenza')}
        ${scheda('Cosa fare adesso', `<ol class="a-azioni">${m.azioni.map(x => `<li>${esc(x)}</li>`).join('')}</ol>`)}
      </div>
      ${scheda('Giorno per giorno', `<div class="a-grafici"><figure><figcaption>Click</figcaption><div id="ag-click"></div></figure>${m.conAcquisti ? '<figure><figcaption>Acquisti</figcaption><div id="ag-acq"></div></figure>' : ''}</div>`)}
      ${scheda('Tutti i pubblici', `<p class="a-sotto">Dal migliore al meno conveniente. Tocca per vedere chi c’è dentro.</p>${righePub}`)}
      ${m.gruppi ? scheda('Chi risponde di più', `<p class="a-sotto">Quanto rende ogni euro speso su ogni gruppo, rispetto alla media.</p><div class="a-gruppi">${['eta', 'genere', 'reddito', 'area'].map(barre).join('')}</div>`) : ''}
      ${annuncio}
      <p class="a-piede">${m.sorgente === 'storico' ? `<a href="#/sim/dati">Dettagli tecnici e consegne</a> · <a href="${window.Flk.scarico()}" download="${esc(window.Flk.D.meta.file_previsioni)}">Scarica le previsioni</a>` : '<a href="#/nuova">Modifica la campagna</a>'} · <a href="#/come">Come funziona</a></p>`;
    const giorni = m.perGiorno.map(g => g.d);
    window.Grafici.linee($('#ag-click'), { titolo: 'Click al giorno', giorni, oggi: 0, unita: '', decimali: 0, eventi: m.eventi, altezza: 180,
      serie: [{ nome: 'click', colore: BLU, valori: m.perGiorno.map(g => g.clk), spessore: 2.2 }] });
    if (m.conAcquisti) window.Grafici.linee($('#ag-acq'), { titolo: 'Acquisti al giorno', giorni, oggi: 0, unita: '', decimali: 1, eventi: m.eventi, altezza: 180,
      serie: [{ nome: 'acquisti', colore: VERDE, valori: m.perGiorno.map(g => g.acq), spessore: 2.2 }] });
  }
  // l'annuncio scritto nella pagina di partenza, provato sui pubblici (dati della sfida o file)
  function annuncioProvato() {
    const F = window.Flk, L = F.S.lab;
    if (M.sorgente !== 'storico' || !L) return '';
    const D = F.D, campagne = M.filtro === 'tutto' ? D.campagne : D.campagne.filter(c => c.id === M.filtro);
    const righe = campagne.map(c => { const r = F.stima(c, L), top = r.righe.slice().sort((a, b) => b.per100 - a.per100)[0];
      return `<li><b>${esc(c.nome)}</b>: rende di più su «${esc(NOMI_PUBBLICO[D.adset[top.k].tipo])}», circa ${ni(top.per100)} click ogni 100 €. Meglio di ${r.sotto} creatività su ${r.tot} già usate.</li>`; }).join('');
    return `<section class="a-card"><h3>Il tuo annuncio</h3><p class="a-sotto">«${esc(L.testo)}»</p><ul class="a-azioni">${righe}</ul></section>`;
  }

  /* ---------------------------------------------------------------- transizione */
  function transizione(lavoro) {
    const ov = $('#transizione'), testo = $('#tr-testo');
    const frasi = ['Mostro la campagna a migliaia di persone virtuali', 'Chi la vede, chi clicca, chi compra', 'Calcolo i giorni che verranno'];
    let i = 0, sc = null, giro = null, cambio = null;
    ov.hidden = false;
    requestAnimationFrame(() => ov.classList.add('dentro'));
    testo.textContent = frasi[0];
    giro = setInterval(() => { i = (i + 1) % frasi.length; testo.textContent = frasi[i]; }, 1700);
    window.Flock.carica().then(() => {
      const vecchio = $('#tr-folla'), nuovo = vecchio.cloneNode(false); vecchio.replaceWith(nuovo);
      const h = window.innerHeight;
      sc = window.Flock.campo($('#tr-prato'), nuovo, { altezza: Math.round(h * 0.62), altezzaPrato: Math.round(h * 0.7), ricambio: true, testo: 'click',
        n: Math.round(window.innerWidth / (window.innerWidth < 600 ? 26 : 44)) });
      sc.ritmo = 3;
      cambio = setInterval(() => { sc.testo = Math.random() < 0.3 ? 'compra' : 'click'; }, 450);
    });
    const attesa = new Promise(r => setTimeout(r, 2600));
    const fine = () => { clearInterval(giro); clearInterval(cambio); ov.classList.remove('dentro'); setTimeout(() => { ov.hidden = true; }, 450); };
    return Promise.all([lavoro, attesa]).then(([r]) => {
      testo.textContent = 'Ecco chi ha risposto';
      if (sc) { sc.ritmo = 10; sc.testo = 'compra'; }
      return new Promise(ok => setTimeout(() => { fine(); ok(r); }, 900));
    }, err => { fine(); throw err; });
  }
  function avvisa(m) { const t = $('#tr-testo'); if (t && !$('#transizione').hidden) t.textContent = m; }

  /* ---------------------------------------------------------------------- API */
  function costruisci() {
    M = sorgente === 'nuova' ? daNuova(nuovaDati) : daStorico(filtro);
    $('#a-titolo').textContent = M.titolo;
    $('#a-periodo').textContent = `${giornoLungo(M.dal)} – ${giornoLungo(M.al)}`;
    $('#a-filtro').innerHTML = M.campagne.length > 1 ? ['tutto', ...M.campagne.map(c => c.id)].map(id => {
      const c = M.campagne.find(x => x.id === id);
      return `<button data-c="${esc(id)}" class="${filtro === id ? 'si' : ''}">${id === 'tutto' ? 'Tutto il progetto' : esc(c.nome)}</button>`;
    }).join('') : '';
    $$('#a-filtro [data-c]').forEach(b => b.addEventListener('click', () => { filtro = b.dataset.c; filtroPub = 'tutti'; costruisci(); mostra(modo); }));
  }
  function apri(tipo, dati) {
    sorgente = tipo; nuovaDati = dati || null; filtro = 'tutto'; filtroPub = 'tutti'; M = null;
    if (location.hash === '#/analisi') mostra('persone'); else location.hash = '#/analisi';
  }
  function mostra(quale) {
    modo = quale === 'analisi' ? 'analisi' : 'persone';
    if (!sorgente) sorgente = 'storico';
    if (!M) costruisci();
    $$('#v-analisi .interruttore button').forEach(b => b.setAttribute('aria-selected', b.dataset.modo === modo));
    $('#a-persone').hidden = modo !== 'persone';
    $('#a-analisi').hidden = modo !== 'analisi';
    if (modo === 'persone') rPersone(); else { chiudiScheda(); rAnalisi(); $('#a-analisi').scrollTop = 0; }
  }
  function inizia() {
    $$('#v-analisi .interruttore button').forEach(b => b.addEventListener('click', () => { location.hash = b.dataset.modo === 'analisi' ? '#/analisi/numeri' : '#/analisi'; }));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') chiudiScheda(); });
    let rt = null;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (document.body.dataset.vista === 'analisi' && M) mostra(modo); }, 300); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inizia); else inizia();
  return { apri, mostra, transizione, avvisa, haDati: () => !!sorgente };
})();
