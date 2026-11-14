/* Risultati di Flockets: due viste sullo stesso lavoro, quello che l'utente ha mandato (un annuncio scritto a parole,
   un file di campagne, o i due insieme).
   «Persone»: solo omini su una griglia di pallini, ognuno una persona simulata. Toccandolo si apre la sua scheda.
   «Analisi»: numeri e soldi, giorno per giorno, il pubblico migliore e tutti gli altri, cosa fare adesso, e strumenti
   per studiare i grafici e provare un altro budget.
   Il pubblico migliore non si sceglie prima: è un risultato dell'analisi. */
window.Analisi = (function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf = (v, d = 2) => Number(v || 0).toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d });
  const ni = v => Math.round(v || 0).toLocaleString('it-IT');
  const n1 = v => (v >= 100 ? ni(v) : v >= 10 ? nf(v, 0) : nf(v, 1));
  const eur = v => (v >= 100 || (v >= 10 && Math.abs(v - Math.round(v)) < 0.005) ? ni(v) : nf(v, 2)) + ' €';
  const pc = v => nf(v, v >= 10 ? 0 : 1) + '%';
  const mesi = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  const giornoLungo = d => +d.slice(8, 10) + ' ' + mesi[+d.slice(5, 7) - 1];
  const piu = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  const somma0 = a => a.reduce((s, x) => s + (x || 0), 0);
  const VERDE = 'var(--verde)', ARANCIO = 'var(--arancio)', BLU = 'var(--blu)', VIOLA = '#8B5CF6', INCHIOSTRO = '#111113', GRIGIO = '#9A9A94';
  const BORDO = { compra: '#22A85A', clicca: '#F26A1D', passa: '#A7A7AE' };   // colori del perimetro degli omini
  const COLORE_TIPO = { ampio: BLU, interessi: ARANCIO, sosia: VIOLA, caldo: VERDE, retargeting: VERDE, unico: BLU };
  const NOMI_PUBBLICO = { ampio: 'Pubblico ampio', interessi: 'Interessi', sosia: 'Sosia dei clienti', caldo: 'Già vicini al marchio', retargeting: 'Già vicini al marchio', unico: 'Tutto il pubblico' };
  const FRASI_PUBBLICO = { ampio: 'Tutti, decide la piattaforma', interessi: 'Chi segue la categoria', sosia: 'Simili a chi compra', caldo: 'Chi conosce già il marchio', retargeting: 'Chi ha già visitato il sito', unico: 'L’unico pubblico della campagna' };
  const CANALI = { social: 'Facebook e Instagram', video_brevi: 'TikTok e Reels', ricerca: 'ricerca Google', shopping: 'Google Shopping', display: 'banner su siti e app', video: 'YouTube', email: 'email' };
  const FORMATI = { immagine: 'immagine', carosello: 'carosello', video_breve: 'video breve', video: 'video', testo: 'annuncio di testo' };
  const CATEGORIE = { moda: 'moda', beauty: 'bellezza e cura della pelle', animali: 'animali', videogiochi: 'videogiochi', tecnologia: 'tecnologia', casa_arredo: 'casa e arredo',
    cibo_bevande: 'cibo e bevande', sport_fitness: 'sport e fitness', viaggi: 'viaggi', salute_benessere: 'salute e benessere', bambini_famiglia: 'bambini e famiglia',
    auto_moto: 'auto e moto', finanza: 'finanza', formazione_lavoro: 'corsi e lavoro', intrattenimento: 'cultura e intrattenimento', generica: 'categoria non riconosciuta' };
  const LEVE = { sconto: 'sconto', urgenza: 'urgenza', scarsita: 'pochi pezzi', prova_sociale: 'recensioni', novita: 'novità', esperto: 'parere esperto', valori: 'valori' };
  const FRASE_LEVA = { urgenza: '«solo fino a domenica»', scarsita: '«ultimi pezzi»', prova_sociale: '«migliaia di recensioni a 5 stelle»', novita: '«la novità della stagione»', esperto: '«consigliato da un esperto»', valori: '«prodotto sostenibile»', sconto: 'uno sconto' };
  const ELASTICITA = 0.262;   // dal motore: raddoppiando il budget ogni visualizzazione costa circa il 20% in più
  const UNITA = {
    acquisti: { plur: 'acquisti', sing: 'acquisto', fatto: ['Ha comprato', 'Ha comprato'], costo: 'Costo per acquisto', ogni: 'ad acquisto' },
    download: { plur: 'download', sing: 'download', fatto: ['Ha scaricato', 'Ha scaricato'], costo: 'Costo per download', ogni: 'a download' },
    iscrizioni: { plur: 'iscrizioni', sing: 'iscrizione', fatto: ['Si è iscritta', 'Si è iscritto'], costo: 'Costo per iscrizione', ogni: 'a iscrizione' },
  };

  let M = null, sorgente = null, nuovaDati = null, contesto = {}, modo = 'persone', scena = null, punti = null, scelto = null, filtroPub = 'tutti', segui = null;
  const es = { metrica: 'acq', vista: 'giorno', divisione: 'totale' };

  /* ---------------------------------------------------------- leggere il prompt */
  // dalla frase scritta nella pagina di partenza ai dati di una campagna nuova; il resto lo legge il motore (categoria, leve, creatività)
  function leggiPrompt(testo, brief) {
    const s = ' ' + testo.toLowerCase().replace(/\s+/g, ' ') + ' ';
    const num = x => parseFloat(String(x).replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));
    const spec = { testo_annuncio: testo, descrizione_prodotto: testo };
    const canali = [[/tiktok|\breels?\b|\bshorts?\b/, 'video_brevi'], [/youtube/, 'video'], [/shopping/, 'shopping'], [/google|ricerca|\bsearch\b|parole chiave/, 'ricerca'],
      [/banner|display/, 'display'], [/e-?mail|newsletter/, 'email'], [/instagram|facebook|\bmeta\b|social|stori/, 'social']];
    const c = canali.find(([rx]) => rx.test(s));
    spec.canale = c ? c[1] : 'social';
    let resto = s;
    const g = s.match(/(\d+)\s*(?:giorni|gg)\b/), sett = s.match(/(\d+)\s*settiman/);
    if (g) spec.giorni = +g[1]; else if (sett) spec.giorni = 7 * sett[1]; else if (/un mese|1 mese/.test(s)) spec.giorni = 30;
    const bg = s.match(/(\d[\d.,]*)\s*(?:€|euro)\s*(?:al|a|\/|ogni|per)\s*(?:giorno|gg|day)/) || s.match(/(?:budget|spendo|spesa)\D{0,14}(\d[\d.,]*)\s*(?:€|euro)?\s*(?:al|a|\/)\s*giorno/);
    if (bg) { spec.budget_giorno = num(bg[1]); resto = resto.replace(bg[0], ' '); } else {
      const bt = s.match(/(?:budget|spendo|spesa)\D{0,14}(\d[\d.,]*)\s*(?:€|euro)/) || s.match(/(\d[\d.,]*)\s*(?:€|euro)\s*(?:di budget|in tutto|totali)/);
      if (bt) { spec.budget_giorno = num(bt[1]) / (spec.giorni || 14); resto = resto.replace(bt[0], ' '); }
    }
    const sc = resto.match(/(?:sconto|-|meno)\s*(?:del\s*)?(\d{1,2})\s*%/) || resto.match(/(\d{1,2})\s*%\s*(?:di sconto|in meno|off)/);
    if (sc) { spec.sconto = +sc[1] / 100; resto = resto.replace(sc[0], ' '); }
    const pr = resto.match(/(?:costa|prezzo|a soli|a solo|solo|a)\s*(\d[\d.,]*)\s*(?:€|euro)/) || resto.match(/(\d[\d.,]*)\s*(?:€|euro)/);
    if (pr && num(pr[1]) > 0) spec.prezzo = num(pr[1]);
    if (/nuovo (?:marchio|brand)|appena (?:nat|lanciat)|startup|sconosciut|primo lancio/.test(s)) spec.marchio = 'nuovo';
    else if (/famos|notissim|\bleader\b/.test(s)) spec.marchio = 'famoso';
    if (/notoriet|farsi conoscere|awareness|visibilit/.test(s)) spec.obiettivo = 'notorieta';
    else if (/\bvisite\b|traffico|portare (?:gente|persone) sul sito/.test(s)) spec.obiettivo = 'traffico';
    let unita = /scaric|download|install|\bapp\b|gioco (?:per|sul|da) (?:telefono|cellulare|smartphone)|mobile game/.test(s) ? 'download'
      : /iscri|registra/.test(s) ? 'iscrizioni' : 'acquisti';
    let gratis = /gratis|gratuit|\bfree\b/.test(s), ia = false;
    // quello che ha capito Claude Haiku (funzione /api/leggi) vale più delle regole a parole chiave; 0 o non_indicato = non detto
    const ia2 = brief && brief.fonte === 'ia' ? brief.campagna : null;
    if (brief && brief.fonte === 'ia' && brief.f) spec.creativita = brief.f;
    if (ia2) {
      ia = true;
      if (ia2.canale !== 'non_indicato') spec.canale = ia2.canale;
      if (ia2.categoria && ia2.categoria !== 'generica') spec.categoria = ia2.categoria;
      if (ia2.formato_campagna !== 'non_indicato') spec.formato = ia2.formato_campagna;
      if (ia2.budget_giorno > 0) spec.budget_giorno = ia2.budget_giorno;
      if (ia2.giorni > 0) spec.giorni = ia2.giorni;
      if (ia2.prezzo > 0) spec.prezzo = ia2.prezzo;
      if (ia2.sconto_percento > 0) spec.sconto = ia2.sconto_percento / 100;
      if (ia2.marchio !== 'non_indicato') spec.marchio = ia2.marchio;
      spec.obiettivo = ia2.obiettivo;
      if (ia2.leve && ia2.leve.length) spec.leve = ia2.leve;
      if (ia2.prodotto) spec.descrizione_prodotto = ia2.prodotto + '. ' + testo;
      unita = ia2.risultato; gratis = ia2.gratis;
    }
    return { spec, unita, gratis, ia, prodotto: ia2 && ia2.prodotto ? ia2.prodotto : '' };
  }

  /* ------------------------------------------------------------------ modelli */
  // un file (o i dati della sfida): previsioni del modello + persone simulate e tarate su di esse
  function daStorico() {
    const D = window.Flk.D, P = D.persone || {}, giorni = D.meta.giorni;
    const pub = [];
    D.campagne.forEach(c => c.adset.forEach(k => {
      const a = D.adset[k], x = P[k], z = D.zona[k] || {};
      const gz = giorni.map(d => {
        const q = z[d] || { spesa: 0, imp: 0, clk: 0 }, g = x ? x.giorni.find(y => y.data === d) : null;
        return { spesa: q.spesa, imp: q.imp, clk: q.clk, acq: g ? g.acquisti : null, ric: g ? g.ricavi : null };
      });
      pub.push({ id: k, tipo: a.tipo, nome: NOMI_PUBBLICO[a.tipo] || 'Pubblico', marca: c.nome, frase: FRASI_PUBBLICO[a.tipo] || '',
        spesa: somma0(gz.map(q => q.spesa)), imp: somma0(gz.map(q => q.imp)), clk: somma0(gz.map(q => q.clk)),
        acq: x ? x.totali.acquisti : null, ricavi: x ? x.totali.ricavi : null, visite: x ? x.totali.visite : null,
        forchetta: x ? x.forchetta : null, segmenti: x ? x.segmenti : null, persone: x ? x.persone : [], gz,
        grandezza: a.grandezza, budget: a.budget_test, budget_proposto: a.budget_proposto });
    }));
    // due gruppi dello stesso tipo nella stessa campagna: «Interessi 1», «Interessi 2»
    const conta = {};
    pub.forEach(p => { const c = p.marca + '|' + p.tipo; conta[c] = (conta[c] || 0) + 1; p.n = conta[c]; });
    pub.forEach(p => { if (conta[p.marca + '|' + p.tipo] > 1) p.nome += ' ' + p.n; });
    const piuCampagne = D.campagne.length > 1;
    const conAcquisti = pub.every(p => p.acq != null);
    const eventi = {};
    Object.entries(D.meta.eventi || {}).forEach(([d, n]) => { if (giorni.includes(d) && /Black Friday|Cyber/.test(n)) eventi[d] = n.replace(/\s*\(.*\)/, ''); });
    return completa({ sorgente: 'storico', titolo: contesto.fonte || 'Le tue campagne', giorni, dal: giorni[0], al: giorni[giorni.length - 1], ngiorni: giorni.length,
      ncampagne: D.campagne.length, tot: somma(pub, conAcquisti), eventi, pubblici: pub, conAcquisti, u: UNITA.acquisti, ricavi: conAcquisti,
      etichettaPubblico: p => (piuCampagne ? p.nome + ' · ' + p.marca : p.nome), datiSfida: window.Flk.kit() });
  }
  // campagna nuova (dal prompt o dal modulo): la stessa campagna simulata su ogni tipo di pubblico
  function daNuova(d) {
    const C = d.campagna;
    const pub = d.pubblici.map(p => ({ id: p.tipo, tipo: p.tipo, nome: NOMI_PUBBLICO[p.tipo], frase: p.descrizione.replace(/\.$/, ''), marca: '',
      spesa: p.totali.spesa, imp: p.totali.impressioni, clk: p.totali.click, acq: p.totali.acquisti, ricavi: p.totali.ricavi, visite: p.totali.visite,
      raggiunte: p.totali.persone_raggiunte, forchetta: p.forchetta, segmenti: p.segmenti, persone: p.persone, risultato: p.risultato,
      gz: p.giorni.map(g => ({ spesa: g.spesa, imp: g.impressioni, clk: g.click, acq: g.acquisti, ric: g.ricavi })),
      grandezza: p.pubblico.persone_raggiungibili, migliori: p.migliori }));
    const best = pub.find(p => p.id === d.migliore) || pub[0];
    const tot = somma([best], true);
    tot.raggiunte = best.raggiunte;
    const u = UNITA[contesto.unita] || UNITA.acquisti;
    const titolo = contesto.prompt || C.descrizione_prodotto || CATEGORIE[C.categoria] || 'Campagna nuova';
    return completa({ sorgente: 'nuova', titolo, giorni: d.pubblici[0].giorni.map(g => g.data), dal: C.inizio, al: piu(C.inizio, C.giorni - 1), ngiorni: C.giorni,
      tot, eventi: {}, pubblici: pub, conAcquisti: true, u, ricavi: !contesto.gratis, etichettaPubblico: p => p.nome, principale: best, nuova: d });
  }
  function somma(pub, conAcquisti) {
    const t = { spesa: 0, imp: 0, clk: 0, acq: 0, ricavi: 0, visite: 0, acqBasso: 0, acqAlto: 0, ricBasso: 0, ricAlto: 0, clkBasso: 0, clkAlto: 0, impBasso: 0, impAlto: 0 };
    pub.forEach(p => {
      t.spesa += p.spesa; t.imp += p.imp; t.clk += p.clk; t.visite += p.visite || 0;
      if (p.forchetta) { t.clkBasso += p.forchetta.click[0]; t.clkAlto += p.forchetta.click[1]; t.impBasso += p.forchetta.impressioni[0]; t.impAlto += p.forchetta.impressioni[1]; }
      if (conAcquisti) {
        t.acq += p.acq; t.ricavi += p.ricavi;
        if (p.forchetta) { t.acqBasso += p.forchetta.acquisti[0]; t.acqAlto += p.forchetta.acquisti[1]; t.ricBasso += p.forchetta.ricavi[0]; t.ricAlto += p.forchetta.ricavi[1]; }
      }
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
      const S = somma0(Object.values(livelli).map(x => x.spesa)), A = somma0(Object.values(livelli).map(x => x.acq));
      out[tag] = Object.entries(livelli).map(([k, x]) => ({ livello: k, etichetta: x.etichetta, quota_spesa: x.spesa / S, quota_acq: A ? x.acq / A : 0,
        resa: A && x.spesa ? (x.acq / x.spesa) / (A / S) : 0 }));
    });
    return out;
  }
  function azioni(m) {
    const a = [], best = m.migliore, peggio = m.pubblici[m.pubblici.length - 1], u = m.conAcquisti ? m.u.plur : 'click';
    if (m.sorgente === 'storico' && m.pubblici.length > 1 && peggio.resa < 0.75) {
      const sposta = Math.max(5, Math.round((peggio.budget || peggio.spesa / m.ngiorni) * 0.3 / 5) * 5);
      const valB = (m.conAcquisti ? best.acq : best.clk) / best.spesa, valP = (m.conAcquisti ? peggio.acq : peggio.clk) / peggio.spesa;
      const guadagno = sposta * m.ngiorni * (valB - valP) * 0.8;   // 0,8: spingere un pubblico lo fa costare un po' di più
      a.push(`Sposta ${ni(sposta)} € al giorno da «${m.etichettaPubblico(peggio)}» a «${m.etichettaPubblico(best)}»: circa ${n1(guadagno)} ${u} in più nello stesso periodo.`);
    }
    if (m.sorgente === 'nuova') {
      const C = m.nuova.campagna, ampio = m.pubblici.find(p => p.id === 'ampio');
      if (ampio && best.id !== 'ampio') a.push(`Usa il pubblico «${best.nome}»: ${n1(best.acq)} ${u} contro ${n1(ampio.acq)} con il pubblico ampio, a parità di budget.`);
      else a.push('Il pubblico ampio è già la scelta migliore: la piattaforma trova da sola chi risponde.');
      // dal consiglio: stesso pubblico del migliore, cambia solo canale o leva (confronto alla pari)
      const cl = (m.nuova.consigli && m.nuova.consigli.classifica) || [], rif = best.risultato || 1;
      // Shopping vende prodotti fisici: non si propone per download o iscrizioni
      const canale = cl.filter(x => x.pubblico === best.tipo && x.canale !== C.canale && !(x.canale === 'shopping' && m.u !== UNITA.acquisti))
        .sort((x, y) => y.risultato - x.risultato)[0];
      if (canale && canale.risultato / rif > 1.15) a.push(`Prova anche ${CANALI[canale.canale] || canale.canale} (${FORMATI[canale.formato] || canale.formato}): circa ×${nf(canale.risultato / rif, 1)} ${u} con lo stesso pubblico e lo stesso budget.`);
      const leva = cl.filter(x => x.pubblico === best.tipo && x.canale === C.canale && x.leve.some(l => !C.leve.includes(l))).sort((x, y) => y.risultato - x.risultato)[0];
      if (leva && leva.risultato / rif > 1.08) {
        const nuove = leva.leve.filter(l => !C.leve.includes(l));
        a.push(`Aggiungi all’annuncio ${nuove.map(l => FRASE_LEVA[l] || LEVE[l]).join(' e ')}: circa +${ni((leva.risultato / rif - 1) * 100)}% ${u}.`);
      }
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
      if (Object.keys(m.eventi).length) a.push('Lancia le creatività nuove almeno 3 giorni prima del Black Friday: nei primi giorni un annuncio costa di più.');
    }
    return a.slice(0, 4);
  }

  /* ---------------------------------------------- serie giorno per giorno (grafici) */
  const METRICHE = {
    imp: { nome: 'Visualizzazioni', v: g => g.imp, fmt: ni, asse: v => (v >= 1000 ? nf(v / 1000, v >= 1e4 ? 0 : 1) + 'k' : ni(v)), forchetta: 'imp' },
    clk: { nome: 'Click', v: g => g.clk, fmt: ni, asse: ni, forchetta: 'clk' },
    acq: { nome: 'acquisti', v: g => g.acq, fmt: n1, asse: v => nf(v, v < 10 ? 1 : 0), forchetta: 'acq' },
    ric: { nome: 'Ricavi', v: g => g.ric, fmt: eur, asse: v => ni(v) + ' €', forchetta: 'ric' },
    spesa: { nome: 'Spesa', v: g => g.spesa, fmt: eur, asse: v => ni(v) + ' €' },
    cpa: { nome: 'Costo per acquisto', v: g => (g.acq > 0.01 ? g.spesa / g.acq : null), fmt: eur, asse: v => ni(v) + ' €', rapporto: true },
  };
  function gruppiSerie(m, divisione) {
    const perGiorno = lista => m.giorni.map((d, i) => {
      const g = { spesa: 0, imp: 0, clk: 0, acq: 0, ric: 0 };
      lista.forEach(p => { const q = p.gz[i] || {}; g.spesa += q.spesa || 0; g.imp += q.imp || 0; g.clk += q.clk || 0; g.acq += q.acq || 0; g.ric += q.ric || 0; });
      return g;
    });
    if (divisione !== 'pubblici') {
      const lista = m.principale ? [m.principale] : m.pubblici;
      return [{ id: 'tot', nome: m.principale ? 'Pubblico migliore' : 'Tutto', colore: BLU, giorni: perGiorno(lista), tot: m.tot }];
    }
    const tipi = [...new Set(m.pubblici.map(p => (p.tipo === 'retargeting' ? 'caldo' : p.tipo)))];
    return tipi.map(t => {
      const lista = m.pubblici.filter(p => (p.tipo === 'retargeting' ? 'caldo' : p.tipo) === t);
      return { id: t, nome: NOMI_PUBBLICO[t] || 'Pubblico', colore: COLORE_TIPO[t] || GRIGIO, giorni: perGiorno(lista), tot: null };
    });
  }
  function valoriSerie(gr, met, cumulato) {
    const M0 = METRICHE[met];
    if (!cumulato) return gr.giorni.map(M0.v);
    const acc = { spesa: 0, imp: 0, clk: 0, acq: 0, ric: 0 };
    return gr.giorni.map(g => { Object.keys(acc).forEach(k => { acc[k] += g[k]; }); return M0.v(acc); });
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
  const nuovaTela = sel => { const v = $(sel), n = v.cloneNode(false); v.replaceWith(n); return n; };   // la scena vecchia si ferma da sola

  /* -------------------------------------------------------------- vista Persone */
  function rPersone() {
    chiudiScheda();
    const st = $('#a-persone'), persone = personeDaMostrare(M);
    const tipi = [...new Set(M.pubblici.map(p => p.tipo))];
    if (filtroPub !== 'tutti' && !tipi.includes(filtroPub)) filtroPub = 'tutti';
    $('#a-legenda').innerHTML = `<p class="a-segni"><span><i style="border-color:${BORDO.compra}"></i>${esc(M.u.fatto[1].toLowerCase())}</span><span><i style="border-color:${BORDO.clicca}"></i>ha cliccato</span><span><i style="border-color:${BORDO.passa}"></i>non ha fatto nulla</span></p>
      <div class="a-filtro-pub">${['tutti', ...tipi].map(t => `<button type="button" data-p="${esc(t)}" class="${filtroPub === t ? 'si' : ''}">${
      t === 'tutti' ? 'Tutti' : `<i style="background:${COLORE_TIPO[t] || GRIGIO}"></i>${esc(NOMI_PUBBLICO[t] || 'Pubblico')}`}${t === M.migliore.tipo ? ' <span class="stella">★</span>' : ''}</button>`).join('')}</div>`;
    $$('#a-legenda [data-p]').forEach(b => b.addEventListener('click', () => {
      filtroPub = b.dataset.p;
      $$('#a-legenda [data-p]').forEach(x => x.classList.toggle('si', x === b));
      if (scena) scena.omini.forEach(o => { o.a = filtroPub === 'tutti' || o.persona.pubblico.tipo === filtroPub ? 1 : 0.18; });
      if (punti) punti.onda(st.clientWidth / 2, st.clientHeight * 0.6, 0.6);
      chiudiScheda();
    }));
    if (!persone.length) { $('#a-aiuto').textContent = 'Nessuna persona simulata per questi dati.'; return; }
    $('#a-aiuto').textContent = 'Tocca una persona per vedere chi è e cosa ha fatto.';
    window.Flock.carica().then(() => {
      if (punti) punti.ferma();
      const cp = nuovaTela('#a-prato'), cf = nuovaTela('#a-folla');
      const h = st.clientHeight, stretto = window.innerWidth < 600, giu = stretto ? 96 : 76, ids = personaggi(persone);
      scena = window.Flock.campo(null, cf, { altezza: h, ids, scale: stretto ? [2, 3] : [3, 4], fondo: Math.max(0.3, (h - giu - h * 0.24) / h), suolo: giu });
      punti = window.Flock.puntini(cp, { area: st, sorgenti: () => scena.omini.map(o => ({ x: o.x, y: scena.h - scena.suoloGiu + o.dy })) });
      scena.omini.forEach(o => {
        const p = persone[ids.indexOf(o.id)];
        o.persona = p;
        o.allegro = p.esito === 'compra';   // chi ha comprato ogni tanto fa festa
        o.bordo = BORDO[p.esito];           // perimetro di 1 pixel: cosa ha fatto
        o.a = filtroPub === 'tutti' || p.pubblico.tipo === filtroPub ? 1 : 0.18;
      });
      cf.addEventListener('pointerdown', e => {
        const r = cf.getBoundingClientRect(), o = scena.trova(e.clientX - r.left, e.clientY - r.top);
        if (o) { apriScheda(o); punti.onda(o.x, scena.h - scena.suoloGiu + o.dy, 0.5); } else chiudiScheda();
      });
      cf.addEventListener('pointermove', e => {
        const r = cf.getBoundingClientRect();
        cf.style.cursor = scena.trova(e.clientX - r.left, e.clientY - r.top) ? 'pointer' : 'default';
      });
    });
  }
  function apriScheda(o) {
    chiudiScheda(true);
    scelto = o; o.bloccato = true; o.scelto = true; o.imposta('fermo');
    const p = o.persona, sch = $('#a-scheda'), donna = p.genere === 'donna', u = M.u;
    const esito = { compra: [u.fatto[donna ? 0 : 1], 'compra'], clicca: ['Ha cliccato', 'clicca'], passa: [donna ? 'È passata oltre' : 'È passato oltre', 'passa'] }[p.esito];
    sch.innerHTML = `<button type="button" class="chiudi" aria-label="Chiudi">✕</button><div class="a-scheda-corpo">
      <header><b>${esc(p.nome)}, ${p.eta} anni</b><span>${esc(p.regione)} · ${esc(p.comune)}</span></header>
      <p class="chi">${esc(p.lavoro)} · ${esc(p.reddito)} · ${esc(p.famiglia)}</p>
      <p class="esito"><span class="bollino ${esito[1]}">${esito[0]}</span>ha visto l’annuncio ${p.visto} ${p.visto === 1 ? 'volta' : 'volte'}</p>
      <dl class="tre-n"><div><dd>${nf(100 * p.prob_click, 1)}%</dd><dt>clicca</dt></div><div><dd>${p.esito === 'passa' ? '–' : nf(100 * p.prob_acquisto, 1) + '%'}</dd><dt>${esc(u.plur === 'acquisti' ? 'compra' : u.plur === 'download' ? 'scarica' : 'si iscrive')} dopo il click</dt></div><div><dd>${p.resa ? '×' + nf(p.resa, 1) : '–'}</dd><dt>resa per euro</dt></div></dl>
      ${p.perche && p.perche.length ? `<p class="perche">${p.perche.map(esc).join(' · ')}</p>` : ''}
      <p class="gruppo"><i style="background:${COLORE_TIPO[p.pubblico.tipo] || GRIGIO}"></i>${esc(M.etichettaPubblico(p.pubblico))}${p.persone_simili ? ` · ${ni(p.persone_simili)} persone come ${donna ? 'lei' : 'lui'} in Italia` : ''}</p></div>`;
    sch.hidden = false;
    sch.classList.remove('entra'); void sch.offsetWidth; sch.classList.add('entra');
    $('.chiudi', sch).addEventListener('click', () => chiudiScheda());
    // la scheda resta sempre dentro il riquadro: sopra la testa, se no sotto i piedi, se no di fianco
    const muovi = () => {
      if (!scelto || !scena) return;
      const st = $('#a-persone'), c = $('#a-folla'), W = st.clientWidth, H = st.clientHeight, sw = sch.offsetWidth, sh = sch.offsetHeight;
      const t = scena.testa(scelto), hx = t.x, hy = c.offsetTop + t.y, piedi = c.offsetTop + scena.h - scena.suoloGiu + scelto.dy, mg = 10;
      const clampX = x => Math.min(Math.max(x, sw / 2 + mg), W - sw / 2 - mg);
      let x = clampX(hx), y, verso;
      if (hy - sh - 16 >= mg) { y = hy - sh - 16; verso = 'sopra'; }
      else if (piedi + 14 + sh <= H - mg) { y = piedi + 14; verso = 'sotto'; }
      else {
        y = Math.min(Math.max(hy - sh / 2, mg), H - sh - mg);
        const destra = hx + 40 + sw <= W - mg, sinistra = hx - 40 - sw >= mg;
        if (destra || sinistra) { x = destra ? hx + 40 + sw / 2 : hx - 40 - sw / 2; verso = destra ? 'destra' : 'sinistra'; } else verso = 'libera';
        sch.style.setProperty('--frecciay', Math.min(Math.max(hy + 20 - y, 20), sh - 20) + 'px');
      }
      sch.style.left = x + 'px'; sch.style.top = Math.max(mg, y) + 'px';
      sch.style.setProperty('--freccia', Math.min(Math.max(hx - x + sw / 2, 22), sw - 22) + 'px');
      sch.dataset.verso = verso;
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
  function capito(m) {
    if (m.sorgente !== 'nuova') return '';
    const C = m.nuova.campagna, voci = [
      CATEGORIE[C.categoria] || C.categoria, CANALI[C.canale], FORMATI[C.formato],
      `${eur(C.budget_giorno)} al giorno`, `${C.giorni} giorni dal ${giornoLungo(C.inizio)}`,
      contesto.gratis ? 'gratis' : C.prezzo ? `prezzo ${eur(C.prezzo)}${C.sconto ? ` −${ni(C.sconto * 100)}%` : ''}` : '',
      ...C.leve.map(l => LEVE[l]), C.marchio === 'nuovo' ? 'marchio nuovo' : C.marchio === 'famoso' ? 'marchio famoso' : '',
    ].filter(Boolean);
    return `<div class="a-capito"><span class="a-capito-t">${contesto.ia ? 'Claude ha capito' : 'Ho capito'}</span>${voci.map(v => `<span>${esc(v)}</span>`).join('')}<a href="#/nuova" data-modifica>Modifica</a></div>
      ${m.nuova.ipotesi.length ? `<p class="a-nota">${esc(m.nuova.ipotesi.filter(x => !/^Categoria letta/.test(x) && !(contesto.gratis && /^Prezzo/.test(x))).join(' · '))}</p>` : ''}`;
  }
  function rAnalisi() {
    const m = M, T = m.tot, best = m.migliore, el = $('#a-contenuto'), u = m.u, nuova = m.sorgente === 'nuova';
    const roas = T.ricavi / Math.max(T.spesa, 1e-9), ric = m.conAcquisti && m.ricavi;
    const card = (i, titolo, corpo, cls = '', extra = '') => `<section class="a-card a-entra ${cls}" style="--i:${i}" ${extra}><h3>${titolo}</h3>${corpo}</section>`;
    const conta = (v, f) => `<dd data-conta="${v}" data-f="${f}">${({ eur, ni, n1, nf2: x => nf(x) + ' €' })[f](v)}</dd>`;
    const tra = (a, b, f) => (a && b ? `<small>tra ${f(a)} e ${f(b)}</small>` : '');
    const C = nuova ? m.nuova.campagna : null;
    const frase = nuova
      ? `Con ${eur(C.budget_giorno)} al giorno per ${C.giorni} giorni su ${CANALI[C.canale]}, il pubblico migliore è <b>${esc(best.nome.toLowerCase())}</b>: circa <b>${ni(T.raggiunte)} persone</b> raggiunte, <b>${ni(T.clk)} click</b> e <b>${n1(T.acq)} ${u.plur}</b>${ric ? `, ${eur(T.ricavi)} di ricavi` : ''}.`
      : `Dal ${giornoLungo(m.dal)} al ${giornoLungo(m.al)}, ${m.ncampagne > 1 ? `${m.ncampagne} campagne e ${m.pubblici.length} pubblici` : `${m.pubblici.length} pubblici`} con ${eur(T.spesa)} di budget: circa <b>${ni(T.imp)} visualizzazioni</b>, <b>${ni(T.clk)} click</b>${m.conAcquisti ? ` e <b>${n1(T.acq)} ${u.plur}</b>${ric ? `, ${eur(T.ricavi)} di ricavi` : ''}` : ''}.`;
    const etichetta = nuova ? 'Il tuo annuncio' : (m.datiSfida ? 'Storico analizzato' : 'Il tuo file');
    const titolo = nuova ? `«${esc(m.titolo.length > 220 ? m.titolo.slice(0, 217) + '…' : m.titolo)}»` : esc(m.titolo);
    const maxResa = Math.max(...m.pubblici.map(p => p.resa), 0.01), val = p => (m.conAcquisti ? p.acq : p.clk);
    const righePub = m.pubblici.map(p => {
      const cpa = val(p) ? p.spesa / val(p) : 0, poco = p.resa < 0.75;
      const dentro = p.segmenti ? (() => {
        const piuDi = tag => p.segmenti[tag].slice().sort((a, b) => b.quota_click - a.quota_click)[0];
        const d = p.segmenti.genere.find(x => x.livello === 'donna');
        return `${ni(d.quota_click * 100)}% donne · soprattutto ${esc(piuDi('eta').etichetta)} · ${esc(piuDi('area').etichetta)} · ${esc(piuDi('reddito').etichetta)}`;
      })() : '';
      const budget = p.budget_proposto && p.budget && Math.abs(p.budget_proposto - p.budget) >= 5 ? `Budget consigliato: ${ni(p.budget_proposto)} € al giorno invece di ${ni(p.budget)} €.` : '';
      return `<details class="a-pub ${p === best ? 'top' : ''}">
        <summary>
          <div class="a-pub-nome"><b><i style="background:${COLORE_TIPO[p.tipo] || GRIGIO}"></i>${esc(m.etichettaPubblico(p))}</b><span>${esc(p.frase)}</span></div>
          <div class="a-pub-barra"><i style="width:${(p.resa / maxResa * 100).toFixed(1)}%"></i></div>
          <div class="a-pub-num"><b>${m.conAcquisti ? n1(p.acq) + ' ' + u.plur : ni(p.clk) + ' click'}</b><span>${cpa ? eur(cpa) + ' ' + (m.conAcquisti ? u.ogni : 'a click') : ''}</span></div>
          <span class="a-badge ${p === best ? 'verde' : poco ? 'arancio' : ''}">${p === best ? 'il migliore' : poco ? 'rende poco' : p.resa >= 1.15 ? 'sopra la media' : p.resa <= 0.9 ? 'sotto la media' : 'nella media'}</span>
        </summary>
        <div class="a-pub-det">
          <p>${ni(p.imp)} visualizzazioni · ${ni(p.clk)} click · ${eur(p.spesa)} spesi${ric && p.ricavi != null ? ' · ' + eur(p.ricavi) + ' di ricavi' : ''}</p>
          ${dentro ? `<p><b>Chi c’è dentro:</b> ${dentro}</p>` : ''}${budget ? `<p><b>${budget}</b></p>` : ''}
        </div></details>`;
    }).join('');
    const barre = tag => {
      const r = (m.gruppi[tag] || []).slice().sort((a, b) => b.resa - a.resa), mx = Math.max(...r.map(x => x.resa), 0.01);
      return `<div class="a-gr"><b>${{ eta: 'Età', genere: 'Genere', area: 'Area', reddito: 'Reddito', famiglia: 'Famiglia' }[tag]}</b>${r.map(x =>
        `<div class="a-gr-riga"><span>${esc(x.etichetta)}</span><div><i style="width:${(x.resa / mx * 100).toFixed(1)}%" class="${x.resa >= 1.15 ? 'su' : x.resa <= 0.85 ? 'giu' : ''}"></i></div><em>×${nf(x.resa, 1)}</em></div>`).join('')}</div>`;
    };
    const metriche = ['imp', 'clk', ...(m.conAcquisti ? ['acq'] : []), ...(ric ? ['ric'] : []), 'spesa', ...(m.conAcquisti ? ['cpa'] : [])];
    if (!metriche.includes(es.metrica)) es.metrica = m.conAcquisti ? 'acq' : 'clk';
    const nomeMet = k => (k === 'acq' ? u.plur.charAt(0).toUpperCase() + u.plur.slice(1) : k === 'cpa' ? u.costo : METRICHE[k].nome);
    const seg = (k, voci) => `<div class="a-seg" role="group" data-k="${k}">${voci.map(([v, t]) => `<button type="button" data-v="${v}" aria-pressed="${es[k] === v}">${t}</button>`).join('')}</div>`;
    let i = 0;
    el.innerHTML = `
      <div class="a-testa a-entra" style="--i:${i++}">
        <p class="a-etichetta">${etichetta}</p>
        <h2 class="a-titolo2">${titolo}</h2>
        ${capito(m)}
        ${!nuova && contesto.prompt ? `<p class="a-nota">Il tuo annuncio: «${esc(contesto.prompt)}» · come andrebbe su queste campagne è più sotto.</p>` : ''}
        <p class="a-frase">${frase}</p>
        <dl class="a-kpi">
          <div><dt>Spesa</dt>${conta(T.spesa, 'eur')}<small>${eur(T.spesa / m.ngiorni)} al giorno</small></div>
          <div><dt>${nuova ? 'Persone raggiunte' : 'Visualizzazioni'}</dt>${conta(nuova ? T.raggiunte : T.imp, 'ni')}${nuova ? `<small>${ni(T.imp)} visualizzazioni</small>` : tra(T.impBasso, T.impAlto, ni)}</div>
          <div><dt>Click</dt>${conta(T.clk, 'ni')}<small>${nf(100 * T.clk / Math.max(T.imp, 1))} ogni 100 viste</small></div>
          ${m.conAcquisti ? `<div><dt>${esc(nomeMet('acq'))}</dt>${conta(T.acq, 'n1')}${tra(T.acqBasso, T.acqAlto, n1)}</div>` : ''}
          ${ric ? `<div><dt>Ricavi</dt>${conta(T.ricavi, 'eur')}${tra(T.ricBasso, T.ricAlto, eur)}</div>
          <div><dt>Ogni euro speso</dt>${conta(roas, 'nf2')}<small>${roas >= 1 ? 'torna con un guadagno' : 'non si ripaga ancora'}</small></div>` : m.conAcquisti ? `<div><dt>${esc(u.costo)}</dt>${conta(T.spesa / Math.max(T.acq, 1e-9), 'eur')}</div>` : ''}
        </dl>
        ${!nuova && m.conAcquisti ? `<p class="a-nota">${u.plur.charAt(0).toUpperCase() + u.plur.slice(1)} e ricavi stimati dalle persone simulate, tarate sui click previsti.</p>` : ''}
      </div>
      <div class="a-griglia">
        ${card(i++, 'Il pubblico migliore', `
          <p class="a-best"><b><i style="background:${COLORE_TIPO[best.tipo] || GRIGIO}"></i>${esc(m.etichettaPubblico(best))}</b> <span>${esc(best.frase)}</span></p>
          <p>${m.pubblici.length > 1 ? `Ogni euro speso qui rende <b>${nf(best.resa, 1)} volte</b> ${nuova ? 'la media dei pubblici provati' : 'la media'}.` : ''} ${m.conAcquisti ? `${n1(best.acq)} ${u.plur} a ${eur(best.spesa / Math.max(best.acq, 1e-9))} l’uno.` : `${ni(best.clk)} click a ${eur(best.spesa / Math.max(best.clk, 1))} l’uno.`}</p>
          <div class="a-mini">${m.pubblici.slice(0, 5).map(p => `<div><span>${esc(m.etichettaPubblico(p))}</span><i style="width:${(p.resa / maxResa * 100).toFixed(1)}%;background:${COLORE_TIPO[p.tipo] || GRIGIO}"></i></div>`).join('')}</div>
          ${nuova ? '<p class="a-nota">Scelto dall’analisi: la stessa campagna provata su ogni tipo di pubblico, con lo stesso budget.</p>' : ''}`, 'evidenza a-luce')}
        ${card(i++, 'Cosa fare adesso', `<ol class="a-azioni">${m.azioni.map(x => `<li>${esc(x)}</li>`).join('')}</ol>`, 'a-luce')}
      </div>
      ${annuncioProvato(i++)}
      <section class="a-card a-entra a-esplora" style="--i:${i++}">
        <div class="a-es-testa"><h3>Studia i numeri</h3>
          <div class="a-tab" role="tablist">${metriche.map(k => `<button type="button" role="tab" data-met="${k}" aria-selected="${es.metrica === k}">${esc(nomeMet(k))}</button>`).join('')}</div></div>
        <div class="a-es-opz">${seg('vista', [['giorno', 'Giorno per giorno'], ['cumulato', 'Totale che cresce']])}${seg('divisione', [['totale', nuova ? 'Pubblico migliore' : 'Tutto insieme'], ['pubblici', nuova ? 'Confronta i pubblici' : 'Per tipo di pubblico']])}</div>
        <div id="a-es-grafico" class="a-es-grafico"></div>
        <p class="a-es-nota" id="a-es-nota"></p>
      </section>
      <div class="a-griglia">
        ${card(i++, 'E se cambi budget?', `<p class="a-sotto">Sposta il cursore. Più budget porta più risultati, ma ogni visualizzazione costa un po’ di più.</p>
          <div class="a-bud"><input type="range" id="a-budget" min="0.25" max="3" step="0.05" value="1" aria-label="Budget al giorno"><output id="a-bud-val"></output></div>
          <div class="a-bud-num" id="a-bud-num"></div><div id="a-bud-curva" class="a-bud-curva"></div>`, 'a-luce')}
        ${card(i++, 'Dal vedere al ' + (u.plur === 'acquisti' ? 'comprare' : u.plur === 'download' ? 'scaricare' : 'iscriversi'), imbuto(m), 'a-luce')}
      </div>
      ${ric ? card(i++, 'Quando si ripaga', `<div id="a-pareggio"></div><p class="a-es-nota" id="a-pareggio-nota"></p>`, 'a-luce') : ''}
      ${card(i++, 'Tutti i pubblici', `<p class="a-sotto">Dal migliore al meno conveniente. Tocca per vedere chi c’è dentro.</p>${righePub}`)}
      ${m.gruppi ? card(i++, 'Chi risponde di più', `<p class="a-sotto">Quanto rende ogni euro speso su ogni gruppo, rispetto alla media.</p><div class="a-gruppi">${['eta', 'genere', 'reddito', 'area'].map(barre).join('')}</div>`) : ''}
      <p class="a-piede">${m.sorgente === 'storico' ? `<a href="#/sim/dati">Dettagli tecnici e consegne</a> · <a href="${window.Flk.scarico()}" download="${esc(window.Flk.D.meta.file_previsioni)}">Scarica le previsioni</a>` : '<a href="#/nuova" data-modifica>Modifica la campagna</a>'} · <a href="#/come">Come funziona</a></p>`;
    // controlli
    $$('.a-tab [data-met]', el).forEach(b => b.addEventListener('click', () => { es.metrica = b.dataset.met; $$('.a-tab [data-met]', el).forEach(x => x.setAttribute('aria-selected', x === b)); rEsplora(); }));
    $$('.a-seg', el).forEach(g => $$('button', g).forEach(b => b.addEventListener('click', () => {
      es[g.dataset.k] = b.dataset.v; $$('button', g).forEach(x => x.setAttribute('aria-pressed', x === b)); rEsplora();
    })));
    $$('[data-modifica]', el).forEach(a => a.addEventListener('click', () => { if (nuova && window.Nuova && window.Nuova.riempi) window.Nuova.riempi(m.nuova.campagna); }));
    const rb = $('#a-budget', el);
    rb.addEventListener('input', () => rBudget(+rb.value));
    rEsplora(); rBudget(1); rPareggio();
    contaSu(el); luce(el);
  }
  // l'annuncio scritto nella pagina di partenza, provato sui pubblici del file
  function annuncioProvato(i) {
    const F = window.Flk, L = F.S && F.S.lab;
    if (M.sorgente !== 'storico' || !L) return '';
    const D = F.D;
    const righe = D.campagne.map(c => {
      const r = F.stima(c, L), top = r.righe.slice().sort((a, b) => b.per100 - a.per100)[0];
      return `<li><b>${esc(c.nome)}</b>: rende di più su «${esc(NOMI_PUBBLICO[D.adset[top.k].tipo])}», circa ${ni(top.per100)} click ogni 100 €. Meglio di ${r.sotto} creatività su ${r.tot} già usate.</li>`;
    }).join('');
    return `<section class="a-card a-entra a-luce evidenza-blu" style="--i:${i}"><h3>Il tuo annuncio su queste campagne</h3><p class="a-sotto">«${esc(L.testo)}»</p><ul class="a-azioni">${righe}</ul></section>`;
  }
  function imbuto(m) {
    const T = m.tot, u = m.u, passi = [['Visualizzazioni', T.imp], ['Click', T.clk]];
    if (T.visite) passi.push(['Visite al sito', T.visite]);
    if (m.conAcquisti) passi.push([u.plur.charAt(0).toUpperCase() + u.plur.slice(1), T.acq]);
    const w = v => Math.max(4, Math.pow(v / Math.max(T.imp, 1), 0.22) * 100);   // scala compressa: anche i numeri piccoli si vedono
    return `<div class="a-imbuto">${passi.map(([n, v], k) => `<div class="a-imb-riga" style="--k:${k}">
        <div class="a-imb-barra"><i style="width:${w(v).toFixed(1)}%"></i></div>
        <div class="a-imb-t"><b>${v >= 100 ? ni(v) : n1(v)}</b><span>${n}</span>${k ? `<em>${pc(100 * v / Math.max(passi[k - 1][1], 1e-9))} di chi ${['vede', 'clicca', 'arriva sul sito'][k - 1]}</em>` : ''}</div></div>`).join('')}</div>`;
  }
  function rEsplora() {
    const m = M, met = METRICHE[es.metrica], cum = es.vista === 'cumulato', gr = gruppiSerie(m, es.divisione);
    const nome = es.metrica === 'acq' ? m.u.plur : es.metrica === 'cpa' ? m.u.costo.toLowerCase() : met.nome.toLowerCase();
    const serie = gr.map(g => {
      const valori = valoriSerie(g, es.metrica, cum), s = { nome: g.nome, colore: g.colore, valori };
      // forchetta (8 volte su 10) per il totale: stessa proporzione della forchetta del periodo
      const T = g.tot, chiave = met.forchetta, tot = T && chiave ? { imp: T.imp, clk: T.clk, acq: T.acq, ric: T.ricavi }[chiave] : 0;
      const lo = T && chiave ? { imp: T.impBasso, clk: T.clkBasso, acq: T.acqBasso, ric: T.ricBasso }[chiave] : 0, hi = T && chiave ? { imp: T.impAlto, clk: T.clkAlto, acq: T.acqAlto, ric: T.ricAlto }[chiave] : 0;
      if (es.divisione === 'totale' && tot > 0 && lo > 0 && hi > 0) { s.basso = valori.map(v => v * lo / tot); s.alto = valori.map(v => v * hi / tot); }
      return s;
    });
    window.Esplora.disegna($('#a-es-grafico'), { giorni: m.giorni, serie, eventi: m.eventi, altezza: window.innerWidth < 600 ? 240 : 300,
      fmt: met.fmt, fmtAsse: met.asse, giorno: giornoLungo, titolo: nome });
    // due righe di lettura
    const s0 = serie[0], v = s0.valori.filter(x => x != null && isFinite(x)), nota = $('#a-es-nota');
    if (!v.length) { nota.textContent = ''; return; }
    if (es.divisione === 'pubblici' && !met.rapporto) {
      const tot = serie.map(s => ({ n: s.nome, t: cum ? s.valori[s.valori.length - 1] : somma0(s.valori) })).sort((a, b) => b.t - a.t), T = somma0(tot.map(x => x.t));
      nota.innerHTML = m.sorgente === 'nuova'
        ? `Ogni linea è la stessa campagna su un pubblico diverso. Con «${esc(tot[0].n)}» arrivano ${met.fmt(tot[0].t)} ${esc(nome)}${tot[1] ? `, con «${esc(tot[tot.length - 1].n)}» ${met.fmt(tot[tot.length - 1].t)}` : ''}.`
        : `«${esc(tot[0].n)}» porta il ${pc(100 * tot[0].t / Math.max(T, 1e-9))} di ${esc(nome)}${tot[1] ? `, «${esc(tot[1].n)}» il ${pc(100 * tot[1].t / Math.max(T, 1e-9))}` : ''}.`;
      return;
    }
    if (cum || met.rapporto) {
      nota.innerHTML = met.rapporto
        ? `${esc(m.u.costo)}: si muove tra ${eur(Math.min(...v))} e ${eur(Math.max(...v))}${cum ? ` e a fine periodo vale ${eur(v[v.length - 1])}` : ''}.`
        : `A fine periodo: <b>${met.fmt(v[v.length - 1])}</b> ${esc(nome)}${s0.basso ? `, tra ${met.fmt(s0.basso[s0.basso.length - 1])} e ${met.fmt(s0.alto[s0.alto.length - 1])} (8 volte su 10)` : ''}.`;
      return;
    }
    const iMax = s0.valori.indexOf(Math.max(...v)), meta = Math.floor(v.length / 2);
    const prima = somma0(v.slice(0, meta)) / Math.max(meta, 1), dopo = somma0(v.slice(meta)) / Math.max(v.length - meta, 1), delta = prima ? (dopo / prima - 1) * 100 : 0;
    nota.innerHTML = `In tutto <b>${met.fmt(somma0(v))}</b> ${esc(nome)}, in media ${met.fmt(somma0(v) / v.length)} al giorno. Il giorno più alto è il ${giornoLungo(m.giorni[iMax])} (${met.fmt(v[iMax])}). Nella seconda metà del periodo ${Math.abs(delta) < 3 ? 'resta stabile' : (delta > 0 ? 'sale' : 'scende') + ' del ' + pc(Math.abs(delta))}.`;
  }
  // budget diverso: stessa campagna, i risultati crescono meno del budget (il costo di ogni visualizzazione sale)
  function rBudget(f) {
    const m = M, T = m.tot, u = m.u, b0 = T.spesa / m.ngiorni, k = Math.pow(f, 1 - ELASTICITA), ric = m.conAcquisti && m.ricavi;
    const val = m.conAcquisti ? T.acq : T.clk, nomeV = m.conAcquisti ? u.plur : 'click';
    $('#a-bud-val').textContent = `${eur(b0 * f)} al giorno`;
    const d = x => (Math.abs(x - 1) < 0.005 ? '' : `<small class="${x > 1 ? 'su' : 'giu'}">${x > 1 ? '+' : '−'}${pc(Math.abs(x - 1) * 100)}</small>`);
    $('#a-bud-num').innerHTML = `<div><dt>${nomeV.charAt(0).toUpperCase() + nomeV.slice(1)}</dt><dd>${n1(val * k)}</dd>${d(k)}</div>
      <div><dt>${m.conAcquisti ? esc(u.costo) : 'Costo per click'}</dt><dd>${eur(T.spesa * f / Math.max(val * k, 1e-9))}</dd>${d(f / k)}</div>
      ${ric ? `<div><dt>Ricavi</dt><dd>${eur(T.ricavi * k)}</dd>${d(k)}</div><div><dt>Ogni euro speso</dt><dd>${nf(T.ricavi * k / Math.max(T.spesa * f, 1e-9))} €</dd>${d(k / f)}</div>` : `<div><dt>Spesa totale</dt><dd>${eur(T.spesa * f)}</dd>${d(f)}</div>`}`;
    // curva risultati / budget con il punto scelto
    const W = Math.max($('#a-bud-curva').clientWidth, 240), H = 86, xs = [];
    for (let x = 0.25; x <= 3.001; x += 0.05) xs.push(x);
    const X = x => 8 + (W - 16) * (x - 0.25) / 2.75, Y = x => H - 10 - (H - 22) * Math.pow(x, 1 - ELASTICITA) / Math.pow(3, 1 - ELASTICITA);
    $('#a-bud-curva').innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><path d="${xs.map((x, j) => (j ? 'L' : 'M') + X(x).toFixed(1) + ',' + Y(x).toFixed(1)).join('')}" fill="none" stroke="${GRIGIO}" stroke-width="2" stroke-dasharray="4 4"/>
      <line x1="${X(1)}" x2="${X(1)}" y1="8" y2="${H - 6}" style="stroke:var(--riga)"/><text x="${X(1) + 4}" y="16" class="es-ev">oggi</text>
      <circle cx="${X(f)}" cy="${Y(f)}" r="6" style="fill:${BLU}"/></svg>`;
  }
  function rPareggio() {
    const el = $('#a-pareggio');
    if (!el) return;
    const m = M, g = gruppiSerie(m, 'totale')[0];
    let sp = 0, rc = 0, giorno = null;
    const spese = [], ricavi = [];
    g.giorni.forEach((x, i) => { sp += x.spesa; rc += x.ric; spese.push(sp); ricavi.push(rc); if (giorno == null && rc >= sp && sp > 0) giorno = i; });
    window.Esplora.disegna(el, { giorni: m.giorni, altezza: 200, fmt: eur, fmtAsse: v => ni(v) + ' €', giorno: giornoLungo, titolo: 'Spesa e ricavi',
      serie: [{ nome: 'Speso', colore: GRIGIO, valori: spese, tratto: 2 }, { nome: 'Ricavi', colore: VERDE, valori: ricavi }] });
    const u = m.u, perUno = m.tot.ricavi / Math.max(m.tot.acq, 1e-9), manca = Math.max(0, (sp - rc) / Math.max(perUno, 1e-9));
    $('#a-pareggio-nota').innerHTML = giorno != null
      ? `Si ripaga dal <b>${giornoLungo(m.giorni[giorno])}</b>: da lì ogni euro speso torna indietro con un guadagno. A fine periodo ${eur(rc - sp)} in più di quanto speso.`
      : `In ${m.ngiorni} giorni torna il <b>${pc(100 * rc / Math.max(sp, 1e-9))}</b> di quanto speso. Per ripagarsi servirebbero circa ${n1(manca)} ${u.plur} in più, o un costo per ${u.sing} più basso.`;
  }
  // numeri che salgono da zero (come «Count Up» di React Bits)
  function contaSu(root) {
    const fmt = { eur, ni, n1, nf2: x => nf(x) + ' €' };
    $$('[data-conta]', root).forEach(el => {
      const fin = +el.dataset.conta, f = fmt[el.dataset.f], t0 = performance.now(), dur = 900;
      const passo = now => {
        const t = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - t, 3);
        el.textContent = f(fin * e);
        if (t < 1 && el.isConnected) requestAnimationFrame(passo); else el.textContent = f(fin);
      };
      requestAnimationFrame(passo);
    });
  }
  // luce che segue il puntatore sulle schede (come «Spotlight Card» di React Bits)
  function luce(root) {
    $$('.a-luce', root).forEach(c => c.addEventListener('pointermove', e => {
      const r = c.getBoundingClientRect();
      c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }));
  }

  /* ---------------------------------------------------------------- transizione */
  // nessuna scritta: un cerchio si apre dal punto in cui hai inviato, gli omini corrono sulla griglia mentre il motore
  // calcola (ne arrivano sempre di più), alla fine fanno festa insieme e la scena si dissolve nella vista Persone
  function transizione(lavoro, da) {
    const ov = $('#transizione');
    const cx = da ? da.x : window.innerWidth / 2, cy = da ? da.y : window.innerHeight / 2;
    ov.style.setProperty('--cx', cx + 'px'); ov.style.setProperty('--cy', cy + 'px');
    ov.classList.remove('dentro', 'esce'); ov.hidden = false; void ov.offsetWidth; ov.classList.add('dentro');
    let sc = null, pt = null, arrivi = null;
    window.Flock.carica().then(() => {
      if (ov.hidden) return;
      const cp = nuovaTela('#tr-prato'), cf = nuovaTela('#tr-folla');
      const h = window.innerHeight, w = window.innerWidth, stretto = w < 600;
      const max = Math.round(w / (stretto ? 30 : 46));
      sc = window.Flock.campo(null, cf, { altezza: h, n: Math.max(4, Math.round(max / 4)), ricambio: true, scale: stretto ? [2, 3] : [3, 4], fondo: 0.42, suolo: Math.round(h * 0.26) });
      sc.testo = '';
      const corri = o => { o.imposta('corsa'); o.pausa = 6 + Math.random() * 6; };
      sc.omini.forEach(corri);
      pt = window.Flock.puntini(cp, { area: ov, sorgenti: () => sc.omini.map(o => ({ x: o.x, y: sc.h - sc.suoloGiu + o.dy })) });
      pt.onda(cx, cy, 1.4);
      arrivi = setInterval(() => {   // nuove persone entrano di corsa dai bordi
        if (sc.omini.length >= max) return;
        const o = new window.Flock.Omino(Math.floor(Math.random() * (window.Flock.nomiPersonaggi().length || 100)), 0, {});
        sc.profondita(o); o.dir = Math.random() < 0.5 ? 1 : -1; o.x = o.dir > 0 ? -60 : w + 60; corri(o);
        sc.omini.push(o); sc.omini.sort((p, q) => p.dy - q.dy);
        if (Math.random() < 0.5) sc.esulta();
      }, 260);
      sc.ritmo = 1.2;
    });
    const minimo = new Promise(r => setTimeout(r, 1900));
    const fine = () => { clearInterval(arrivi); ov.classList.add('esce'); setTimeout(() => { ov.hidden = true; ov.classList.remove('dentro', 'esce'); if (pt) pt.ferma(); }, 650); };
    return Promise.all([lavoro, minimo]).then(([r]) => {
      clearInterval(arrivi);
      if (sc) { sc.ritmo = 0; sc.omini.forEach(o => o.imposta('festa', 1.2)); }
      if (pt) pt.onda(window.innerWidth / 2, window.innerHeight * 0.6, 1.6);
      return new Promise(ok => setTimeout(() => { ok(r); setTimeout(fine, 80); }, 700));
    }, err => { fine(); throw err; });
  }
  function avvisa() {}   // la transizione non mostra testo

  /* ---------------------------------------------------------------------- API */
  function costruisci() {
    M = sorgente === 'nuova' ? daNuova(nuovaDati) : daStorico();
    $('#a-titolo').textContent = sorgente === 'nuova' ? `«${M.titolo.length > 70 ? M.titolo.slice(0, 67) + '…' : M.titolo}»` : M.titolo;
    $('#a-periodo').textContent = `${giornoLungo(M.dal)} – ${giornoLungo(M.al)}`;
  }
  function apri(tipo, dati, ctx) {
    sorgente = tipo; nuovaDati = dati || null; contesto = ctx || {}; filtroPub = 'tutti'; M = null;
    if (location.hash === '#/analisi') mostra('persone'); else location.hash = '#/analisi';
  }
  function mostra(quale) {
    const prima = modo;
    modo = quale === 'analisi' ? 'analisi' : 'persone';
    if (!sorgente) { sorgente = 'storico'; contesto = { fonte: 'Dati della sfida Wevion' }; }
    if (!M) costruisci();
    const sw = $('#v-analisi .interruttore');
    sw.dataset.modo = modo;
    $$('button', sw).forEach(b => b.setAttribute('aria-selected', b.dataset.modo === modo));
    const vista = modo === 'persone' ? $('#a-persone') : $('#a-analisi');
    $('#a-persone').hidden = modo !== 'persone';
    $('#a-analisi').hidden = modo !== 'analisi';
    vista.classList.remove('entra', 'da-destra', 'da-sinistra', 'da-sotto'); void vista.offsetWidth;
    vista.classList.add('entra', prima === modo ? 'da-sotto' : modo === 'analisi' ? 'da-destra' : 'da-sinistra');
    if (modo === 'persone') rPersone(); else { chiudiScheda(); if (punti) { punti.ferma(); punti = null; } rAnalisi(); $('#a-analisi').scrollTop = 0; }
  }
  function inizia() {
    $$('#v-analisi .interruttore button').forEach(b => b.addEventListener('click', () => { location.hash = b.dataset.modo === 'analisi' ? '#/analisi/numeri' : '#/analisi'; }));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') chiudiScheda(); });
    let rt = null, w0 = window.innerWidth;
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        if (document.body.dataset.vista !== 'analisi' || !M) return;
        if (modo === 'persone') rPersone(); else if (Math.abs(window.innerWidth - w0) > 40) { rEsplora(); rBudget(+$('#a-budget').value); rPareggio(); }
        w0 = window.innerWidth;
      }, 300);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inizia); else inizia();
  return { apri, mostra, transizione, avvisa, leggiPrompt, haDati: () => !!sorgente };
})();
