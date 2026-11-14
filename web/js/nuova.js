/* «Campagna nuova»: nessun dato. La campagna descritta a parole viene simulata su tutti i tipi di persona
   (motore Python nel browser, flockets/simulazione.py) e confrontata con altre combinazioni per il consiglio. */
window.Nuova = (function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf = (v, d = 2) => Number(v).toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d });
  const ni = v => Math.round(v).toLocaleString('it-IT');
  const n1 = v => (v >= 100 ? ni(v) : v >= 10 ? nf(v, 0) : nf(v, 1));
  const gm = d => d.slice(8, 10) + '/' + d.slice(5, 7);

  const CATEGORIE = {
    moda: 'moda e abbigliamento', beauty: 'bellezza e cura della pelle', animali: 'animali domestici', videogiochi: 'videogiochi',
    tecnologia: 'tecnologia ed elettronica', casa_arredo: 'casa e arredo', cibo_bevande: 'cibo e bevande', sport_fitness: 'sport e fitness',
    viaggi: 'viaggi', salute_benessere: 'salute e benessere', bambini_famiglia: 'bambini e famiglia', auto_moto: 'auto e moto',
    finanza: 'finanza e assicurazioni', formazione_lavoro: 'corsi e lavoro', intrattenimento: 'cultura e intrattenimento',
  };
  const CANALI = {
    social: ['Social (Facebook, Instagram)', ['immagine', 'carosello', 'video_breve', 'video']],
    video_brevi: ['Video brevi (TikTok, Reels, Shorts)', ['video_breve']],
    ricerca: ['Ricerca (Google)', ['testo']], shopping: ['Annunci prodotto (Google Shopping)', ['immagine']],
    display: ['Banner su siti e app', ['immagine', 'video']], video: ['Video (YouTube)', ['video']], email: ['Email e newsletter', ['immagine', 'testo']],
  };
  const FORMATI = { immagine: 'immagine', carosello: 'carosello', video_breve: 'video breve', video: 'video', testo: 'testo (annuncio di ricerca)' };
  const PUBBLICI = { ampio: 'pubblico ampio', interessi: 'interessi', sosia: 'sosia dei clienti', retargeting: 'retargeting' };
  const LEVE = { sconto: 'sconto', urgenza: 'urgenza', scarsita: 'scarsità', prova_sociale: 'prova sociale', novita: 'novità', esperto: 'esperto', valori: 'valori' };
  const CARATT = { ugc: 'persona che parla in camera', hook: 'aggancio nei primi 2 secondi', ritmo: 'ritmo veloce', testo_pesante: 'tanto testo',
    brand_lento: 'video di marca lento', timer: 'timer', prezzo_barrato: 'prezzo barrato' };
  const FILTRI = {
    eta: ['Età', { '18-24': '18-24', '25-34': '25-34', '35-44': '35-44', '45-54': '45-54', '55-64': '55-64', '65+': '65+' }],
    genere: ['Genere', { donna: 'donne', uomo: 'uomini' }],
    area: ['Area', { nord_ovest: 'Nord-Ovest', nord_est: 'Nord-Est', centro: 'Centro', sud: 'Sud', isole: 'Isole' }],
  };
  const TAG = { eta: 'Età', genere: 'Genere', area: 'Area', comune: 'Comune', reddito: 'Reddito', famiglia: 'Famiglia', istruzione: 'Istruzione', lavoro: 'Lavoro' };
  const scelti = { eta: new Set(), genere: new Set(), area: new Set() };
  let pronto = false, folla = null, ultimo = null;

  const scheda = (n, titolo, corpo, sotto) => `<article class="scheda"><header><span class="num mono">${n}</span><h3>${titolo}</h3></header>${sotto ? `<p class="mono riga-m">${sotto}</p>` : ''}${corpo}</article>`;
  const tra = (f, k, fmt) => (f && f[k] ? `<small>tra ${fmt(f[k][0])} e ${fmt(f[k][1])}</small>` : '');

  function formati() {
    const k = $('#nc-canale').value, prima = $('#nc-formato').value;
    const lista = CANALI[k][1];
    $('#nc-formato').innerHTML = (lista.length > 1 ? '<option value="">come dice l’annuncio</option>' : '')
      + lista.map(f => `<option value="${f}"${f === prima ? ' selected' : ''}>${FORMATI[f]}</option>`).join('');
  }
  function chips() {
    $('#nc-filtri').innerHTML = Object.entries(FILTRI).map(([tag, [nome, val]]) => `<div class="filtro"><span class="mono">${nome}</span>${
      Object.entries(val).map(([v, et]) => `<button type="button" data-t="${tag}" data-v="${v}" class="${scelti[tag].has(v) ? 'si' : ''}" aria-pressed="${scelti[tag].has(v)}">${et}</button>`).join('')}
      <small>${scelti[tag].size ? 'solo i selezionati' : 'tutti'}</small></div>`).join('');
    $$('#nc-filtri button').forEach(b => b.addEventListener('click', () => {
      const s = scelti[b.dataset.t]; s.has(b.dataset.v) ? s.delete(b.dataset.v) : s.add(b.dataset.v); chips();
    }));
  }
  function prepara() {
    if (pronto) return;
    pronto = true;
    $('#nc-categoria').innerHTML = '<option value="">riconosci dalla descrizione</option>' + Object.entries(CATEGORIE).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
    $('#nc-canale').innerHTML = Object.entries(CANALI).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('');
    formati(); chips();
    const domani = new Date(Date.now() + 864e5);
    $('#nc-inizio').value = domani.toISOString().slice(0, 10);
    $('#nc-canale').addEventListener('change', formati);
    $('#nc-form').addEventListener('submit', e => { e.preventDefault(); simula(); });
    if (window.Flock) Flock.carica().then(() => { folla = new Flock.Scena($('#nc-folla'), { scala: 3, altezza: 150, suolo: 10 }).popola(9); });
  }
  function apri(testoAnnuncio) {
    prepara();
    if (testoAnnuncio && !$('#nc-annuncio').value) $('#nc-annuncio').value = testoAnnuncio;
    if (window.MotoreFlockets && MotoreFlockets.prepara) MotoreFlockets.prepara().catch(() => {});   // scarica il motore mentre si compila
  }
  function spec() {
    const pub = { tipo: $('#nc-pubblico').value };
    Object.keys(scelti).forEach(t => { if (scelti[t].size) pub[t] = Array.from(scelti[t]); });
    const num = (id, d) => { const v = parseFloat($(id).value); return Number.isFinite(v) ? v : d; };
    return {
      descrizione_prodotto: $('#nc-prodotto').value.trim(), categoria: $('#nc-categoria').value || null,
      prezzo: num('#nc-prezzo', null), sconto: num('#nc-sconto', 0) / 100, marchio: $('#nc-marchio').value, trend: num('#nc-trend', 1),
      obiettivo: $('#nc-obiettivo').value, canale: $('#nc-canale').value, formato: $('#nc-formato').value || null,
      testo_annuncio: $('#nc-annuncio').value.trim(), budget_giorno: num('#nc-budget', 100), giorni: Math.round(num('#nc-giorni', 14)),
      inizio: $('#nc-inizio').value || null, pubblico: pub,
    };
  }
  function simula() {
    const b = $('#nc-avvia'), testo = b.firstElementChild;
    b.disabled = true;
    const stato = m => { testo.textContent = m; };
    MotoreFlockets.campagna(spec(), stato).then(d => { ultimo = d; mostra(d); $('#nc-esito').scrollIntoView({ behavior: 'smooth', block: 'start' }); })
      .catch(err => { $('#nc-esito').innerHTML = `<p class="errore mono">${esc(String(err.message || err).split('\n').pop())}</p>`; })
      .finally(() => { b.disabled = false; testo.textContent = 'Simula sulle persone'; });
  }
  function usa(x) {
    $('#nc-canale').value = x.canale; formati(); $('#nc-formato').value = x.formato; $('#nc-pubblico').value = x.pubblico;
    const testo = $('#nc-annuncio').value, extra = x.leve.filter(l => !(ultimo && ultimo.campagna.leve.includes(l)));
    const frasi = { urgenza: 'solo fino a domenica', scarsita: 'ultimi pezzi', prova_sociale: 'migliaia di recensioni a 5 stelle', novita: 'la novità della stagione', esperto: 'consigliato da un esperto', valori: 'prodotto sostenibile' };
    if (extra.length) $('#nc-annuncio').value = (testo ? testo + '. ' : '') + extra.map(l => frasi[l] || '').filter(Boolean).join(', ');
    simula();
  }

  function mostra(d) {
    const T = d.totali, F = d.forchetta, C = d.campagna, vendite = C.obiettivo === 'vendite';
    const giorni = C.giorni, budget = C.budget_giorno;
    const barre = tag => {
      const righe = d.segmenti[tag], mx = Math.max(...righe.map(r => Math.max(r.quota_impressioni, vendite ? r.quota_acquisti : r.quota_click)), 0.01);
      return `<div class="seg"><b class="mono">${TAG[tag]}</b>${righe.map(r => {
        const q = vendite ? r.quota_acquisti : r.quota_click;
        return `<div class="seg-riga"><span>${esc(r.etichetta)}</span><div class="seg-b"><i class="vis" style="width:${(r.quota_impressioni / mx * 100).toFixed(1)}%"></i><i class="ris" style="width:${(q / mx * 100).toFixed(1)}%"></i></div><em class="${r.resa >= 1.15 ? 'su' : r.resa <= 0.85 ? 'giu' : ''}">${r.resa ? '×' + nf(r.resa, 1) : '–'}</em></div>`;
      }).join('')}</div>`;
    };
    const esito = { compra: ['ha comprato', 'compra'], clicca: ['ha cliccato, non ha comprato', 'clicca'], passa: ['è passata oltre', 'passa'] };
    const cons = d.consigli;
    const pezzi = x => [CANALI[x.canale][0], FORMATI[x.formato], PUBBLICI[x.pubblico], x.leve.length ? x.leve.map(l => LEVE[l]).join(' + ') : 'nessuna leva'];
    const letti = [CATEGORIE[C.categoria] || 'categoria generica', FORMATI[C.formato], ...C.leve.map(l => 'leva: ' + LEVE[l]), ...Object.entries(C.creativita).filter(([, v]) => v).map(([k]) => CARATT[k])];
    $('#nc-esito').innerHTML = `
      <div class="esito-folla"><canvas id="nc-folla2" aria-hidden="true"></canvas></div>
      ${scheda('01', 'Cosa succede, persona per persona', `
        <dl class="tessere tre">
          <div><dd>${ni(T.persone_raggiunte)}</dd><dt>Persone raggiunte</dt>${tra(F, 'persone_raggiunte', ni)}</div>
          <div><dd>${ni(T.click)}</dd><dt>Click · CTR ${nf(T.ctr)}%</dt>${tra(F, 'click', ni)}</div>
          <div><dd>${nf(T.cpm)} €</dd><dt>CPM</dt>${tra(F, 'cpm', v => nf(v))}</div>
          <div><dd>${n1(T.acquisti)}</dd><dt>Acquisti</dt>${tra(F, 'acquisti', n1)}</div>
          <div><dd>${T.acquisti >= 0.5 ? nf(T.cpa, 0) + ' €' : '–'}</dd><dt>Costo per acquisto</dt>${tra(F, 'cpa', v => nf(v, 0))}</div>
          <div><dd>${nf(T.roas)}</dd><dt>Ricavi per euro (ROAS)</dt>${tra(F, 'roas', v => nf(v))}</div>
        </dl>
        <p class="frase">Con ${ni(budget)} € al giorno per ${giorni} giorni l’annuncio arriva a circa <b>${ni(T.persone_raggiunte)} persone</b>, che lo vedono in media ${nf(T.frequenza, 1)} volte. Circa <b>${ni(T.click)} cliccano</b> (${nf(T.ctr)} ogni 100), ${ni(T.visite)} arrivano sul sito e <b>${n1(T.acquisti)} comprano</b>${T.acquisti >= 0.5 ? `: un acquisto ogni ${nf(T.cpa, 0)} € spesi, ${ni(T.ricavi)} € di ricavi` : ''}.</p>
        <p class="nota">Campagna nuova, senza dati: la forchetta (8 volte su 10) è larga perché marche vere dello stesso settore differiscono molto tra loro. Con i primi giorni di dati si stringe: basta caricarli in «Analizza uno storico».</p>`,
        `${d.pubblico.nome} · ${ni(d.pubblico.persone_raggiungibili)} persone raggiungibili ogni giorno sul canale`)}
      ${cons ? scheda('02', 'Il consiglio', `
        <p>Ho provato <b>${cons.combinazioni_provate} combinazioni</b> di canale, formato, pubblico e leva, sempre con ${ni(budget)} € al giorno, e le ho ordinate per ${vendite ? 'acquisti' : C.obiettivo === 'traffico' ? 'click' : 'persone raggiunte'}.</p>
        <ol class="consigli">${cons.classifica.slice(0, 5).map((x, i) => `<li>
            <div><b>${esc(pezzi(x).join(' · '))}</b><small>${vendite ? `${n1(x.totali.acquisti)} acquisti, ${x.totali.acquisti >= 0.5 ? nf(x.totali.cpa, 0) + ' € l’uno' : ''}` : `${ni(x.totali.click)} click`} · CTR ${nf(x.totali.ctr)}% · CPM ${nf(x.totali.cpm)} €${x.nota ? ' · ' + esc(x.nota) : ''}</small></div>
            <span class="per ${x.rispetto_alla_partenza >= 1.05 ? 'su' : ''}">×${nf(x.rispetto_alla_partenza, 1)}</span>
            <button type="button" class="pulsante bordo" data-i="${i}">Usa</button></li>`).join('')}</ol>
        <p class="nota">×1,0 = la campagna come l’hai descritta, con pubblico ampio. Il retargeting non viene proposto per un marchio nuovo: non ha ancora visitatori da raggiungere di nuovo.</p>`) : ''}
      ${scheda('03', 'Chi risponde', `
        <p>Per ogni gruppo: la barra grigia è la quota di visualizzazioni, quella arancione la quota di ${vendite ? 'acquisti' : 'click'}. Il numero dice quanto rende ogni euro speso su quel gruppo rispetto alla media.</p>
        <div class="segmenti">${['eta', 'genere', 'area', 'reddito', 'famiglia', 'comune'].map(barre).join('')}</div>`)}
      ${scheda('04', 'I tipi di persona che rendono di più', `
        <ol class="migliori">${d.migliori.slice(0, 5).map(m => `<li><div><b>${esc(m.descrizione)}</b><small>${ni(m.persone)} persone in Italia · CTR ${nf(m.ctr)}%${vendite ? ' · ' + nf(m.conversione) + ' acquisti ogni 100 click' : ''}</small></div><span class="per su">×${nf(m.resa, 1)}</span></li>`).join('')}</ol>
        <p class="nota">Rendimento per euro rispetto alla media della campagna, tra i tipi di persona su cui va almeno metà della spesa tipica.</p>`)}
      ${scheda('05', 'Alcune persone simulate', `
        <div class="persone">${d.persone.map(p => `<div class="persona ${esito[p.esito][1]}">
            <header><span class="avatar">${esc(p.nome[0])}</span><div><b>${esc(p.nome)}, ${p.eta} anni</b><small>${esc(p.regione)} · ${esc(p.comune)}</small></div></header>
            <p class="chi">${esc(p.lavoro)} · ${esc(p.istruzione)} · ${esc(p.reddito)} · ${esc(p.famiglia)}</p>
            <p class="cosa"><span class="bollino">${esito[p.esito][0].replace('passata', p.genere === 'uomo' ? 'passato' : 'passata')}</span> visto ${p.visto} ${p.visto === 1 ? 'volta' : 'volte'} · click ${nf(100 * p.prob_click, 1)}% a ogni visualizzazione${p.esito !== 'passa' ? ` · acquisto ${nf(100 * p.prob_acquisto, 1)}% dopo il click` : ''}</p>
            <ul>${p.perche.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('')}</div>
        <p class="nota">Persone estratte a caso tra quelle simulate: alcune che comprano, alcune che cliccano e basta, alcune che passano oltre. I motivi sono i tre pezzi che pesano di più sulle loro probabilità.</p>`)}
      ${scheda('06', 'Cosa ho letto e cosa ho assunto', `
        <p class="chips mono">${letti.map(x => `<span>${esc(x)}</span>`).join('')}</p>
        ${d.ipotesi.length ? `<ul class="avvisi">${d.ipotesi.map(x => `<li class="giallo">${esc(x)}</li>`).join('')}</ul>` : ''}
        <p class="nota">Valori reali di partenza per questo canale: CTR tipico ${nf(d.valori_reali.ctr_tipico[1])}% (tra ${nf(d.valori_reali.ctr_tipico[0])} e ${nf(d.valori_reali.ctr_tipico[2])}), CPM tipico ${nf(d.valori_reali.cpm_tipico[1])} €, ${nf(d.valori_reali.acquisti_su_100_visite)} acquisti ogni 100 visite al sito per la categoria. Fonte: ${esc(d.valori_reali.fonte.split(',')[0])}${d.valori_reali.fonte.includes('Conjura') ? ', 79 marche di e-commerce, licenza CC BY 4.0' : ''}.</p>`)}`;
    $$('.consigli button', $('#nc-esito')).forEach(b => b.addEventListener('click', () => usa(cons.classifica[+b.dataset.i])));
    if (window.Flock) Flock.carica().then(() => {
      const s = new Flock.Scena($('#nc-folla2'), { scala: 3, altezza: 132, suolo: 10, testo: vendite ? 'compra' : 'click' }).popola(12);
      const al_giorno = (vendite ? T.acquisti : T.click) / Math.max(giorni, 1);
      s.ritmo = Math.min(2.2, Math.max(0.25, Math.log10(1 + al_giorno)));
    });
  }
  return { apri };
})();
