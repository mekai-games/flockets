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
  const COLORE_TIPO = { ampio: BLU, interessi: ARANCIO, sosia: VIOLA, caldo: VERDE, retargeting: VERDE, unico: BLU, mirato: '#E0457B' };
  const NOMI_PUBBLICO = { ampio: 'Pubblico ampio', interessi: 'Interessi', sosia: 'Sosia dei clienti', caldo: 'Già vicini al marchio', retargeting: 'Già vicini al marchio', unico: 'Tutto il pubblico', mirato: 'Pubblico mirato' };
  const FRASI_PUBBLICO = { ampio: 'Tutti, decide la piattaforma', interessi: 'Chi segue la categoria', sosia: 'Simili a chi compra', caldo: 'Chi conosce già il marchio', retargeting: 'Chi ha già visitato il sito', unico: 'L’unico pubblico della campagna', mirato: 'Chi rende di più, scelto dall’analisi' };
  const CANALI = { social: 'Facebook e Instagram', video_brevi: 'TikTok e Reels', ricerca: 'ricerca Google', shopping: 'Google Shopping', display: 'banner su siti e app', video: 'YouTube', email: 'email', linkedin: 'LinkedIn',
    tv: 'TV', radio: 'radio', affissioni: 'cartelloni', stampa: 'giornali e riviste' };
  const OFFLINE = ['tv', 'radio', 'affissioni', 'stampa'];
  const FORMATI = { immagine: 'immagine', carosello: 'carosello', video_breve: 'video breve', video: 'video', testo: 'annuncio di testo' };
  const CATEGORIE = { moda: 'moda', beauty: 'bellezza e cura della pelle', animali: 'animali', videogiochi: 'videogiochi', tecnologia: 'tecnologia', casa_arredo: 'casa e arredo',
    cibo_bevande: 'cibo e bevande', sport_fitness: 'sport e fitness', viaggi: 'viaggi', salute_benessere: 'salute e benessere', bambini_famiglia: 'bambini e famiglia',
    auto_moto: 'auto e moto', finanza: 'finanza', formazione_lavoro: 'corsi e lavoro', intrattenimento: 'cultura e intrattenimento', generica: 'categoria non riconosciuta' };
  const LEVE = { sconto: 'sconto', urgenza: 'urgenza', scarsita: 'pochi pezzi', prova_sociale: 'recensioni', novita: 'novità', esperto: 'parere esperto', valori: 'valori' };
  const FRASE_LEVA = { urgenza: '«solo fino a domenica»', scarsita: '«ultimi pezzi»', prova_sociale: '«migliaia di recensioni a 5 stelle»', novita: '«la novità della stagione»', esperto: '«consigliato da un esperto»', valori: '«prodotto sostenibile»', sconto: 'uno sconto' };
  const ELASTICITA = 0.262;
  const PESO_FORZA = 0.06;   // come nel simulatore: ogni punto di forza del messaggio sposta la probabilità di click
  const CRITERI = { beneficio: 'Beneficio chiaro', concretezza: 'Offerta concreta', prova: 'Credibilità', invito: 'Invito all’azione', adatto: 'Adatto al canale' };
  const EXTRA = { spedizione_gratuita: 'spedizione gratuita', reso_gratuito: 'reso gratuito', garanzia: 'garanzia', rate: 'pagamento a rate', regalo: 'regalo', prova_gratuita: 'prova gratuita' };
  const VALORI = { donna: 'donne', uomo: 'uomini', nord_ovest: 'Nord-Ovest', nord_est: 'Nord-Est', centro: 'Centro', sud: 'Sud', isole: 'Isole',
    grande_citta: 'grandi città', citta_media: 'città medie', piccolo_comune: 'piccoli comuni', basso: 'reddito basso', medio: 'reddito medio', alto: 'reddito alto',
    single: 'senza partner né figli', coppia: 'in coppia', figli_piccoli: 'con figli piccoli', figli_grandi: 'con figli grandi' };
  const TREND = { 0.8: 'categoria in calo', 1.3: 'categoria in crescita', 1.6: 'categoria di moda' };
  // fasce di età vicine in un'unica etichetta: 25-34 e 35-44 → «25-44 anni»
  function etaInBreve(fasce) {
    const r = fasce.map(f => (f === '65+' ? [65, 120] : f.split('-').map(Number))).sort((a, b) => a[0] - b[0]), out = [];
    r.forEach(x => { const u = out[out.length - 1]; if (u && x[0] === u[1] + 1) u[1] = x[1]; else out.push(x.slice()); });
    return out.map(([a, b]) => (b >= 120 ? `over ${a}` : `${a}-${b} anni`)).join(', ');
  }   // dal motore: raddoppiando il budget ogni visualizzazione costa circa il 20% in più
  const UNITA = {
    acquisti: { plur: 'acquisti', sing: 'acquisto', fatto: ['Ha comprato', 'Ha comprato'], costo: 'Costo per acquisto', ogni: 'ad acquisto' },
    download: { plur: 'download', sing: 'download', fatto: ['Ha scaricato', 'Ha scaricato'], costo: 'Costo per download', ogni: 'a download' },
    iscrizioni: { plur: 'iscrizioni', sing: 'iscrizione', fatto: ['Si è iscritta', 'Si è iscritto'], costo: 'Costo per iscrizione', ogni: 'a iscrizione' },
    contatti: { plur: 'contatti', sing: 'contatto', fatto: ['Ha chiesto un contatto', 'Ha chiesto un contatto'], costo: 'Costo per contatto', ogni: 'a contatto' },
  };
  // dal tipo di risultato del testo al tipo di conversione del motore
  const CONVERSIONE = { acquisti: 'acquisto', contatti: 'contatto', iscrizioni: 'iscrizione', download: 'download' };

  let M = null, sorgente = null, nuovaDati = null, contesto = {}, modo = 'persone', scena = null, punti = null, scelto = null, filtroPub = 'tutti', segui = null;
  const es = { metrica: 'acq', vista: 'giorno', divisione: 'totale' };

  /* ---------------------------------------------------------- leggere il prompt */
  // dalla frase scritta nella pagina di partenza ai dati di una campagna nuova; il resto lo legge il motore (categoria, leve, creatività)
  // riserva: valori presi dallo storico (budget, durata, partenza, categoria) quando il testo non li dice
  function leggiPrompt(testo, brief, riserva) {
    const s = ' ' + testo.toLowerCase().replace(/\s+/g, ' ').replace(/\beuri\b/g, 'euro').replace(/\bset+iman/g, 'settiman')
      .replace(/\bfaceb\w*/g, 'facebook').replace(/\binsta\b|\binstagr\w*/g, 'instagram').replace(/\btik ?to\w*/g, 'tiktok').replace(/\bscnto\b/g, 'sconto')
      .replace(/\bfb\b/g, 'facebook').replace(/\big\b/g, 'instagram').replace(/\btt\b/g, 'tiktok') + ' ';
    const num = x => parseFloat(String(x).replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));
    const spec = { testo_annuncio: testo, descrizione_prodotto: testo };
    const canali = [[/tiktok|\breels?\b|\bshorts?\b/, 'video_brevi'], [/youtube/, 'video'], [/shopping/, 'shopping'], [/google|ricerca|\bsearch\b|parole chiave/, 'ricerca'],
      [/banner|display/, 'display'], [/e-?mail|newsletter/, 'email'], [/linkedin/, 'linkedin'], [/instagram|facebook|\bmeta\b|social|\bstori[ea]s?\b|\bstory\b/, 'social'],
      [/\btv\b|televisi|spot televis/, 'tv'], [/\bradio\b/, 'radio'], [/cartellon|affission|manifest|billboard/, 'affissioni'], [/giornal|rivist|quotidian/, 'stampa']];
    const c = canali.find(([rx]) => rx.test(s));
    spec.canale = c ? c[1] : 'social';
    spec.canale_indicato = !!c;   // se il testo non lo dice, il mezzo lo sceglie la strategia per il target
    let resto = s, totale = 0;
    const PAROLE = { un: 1, una: 1, uno: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10, dodici: 12 };
    const quanti = x => (/^\d+$/.test(x) ? +x : PAROLE[x] || 0);
    const NUM = '(\\d+|un|una|due|tre|quattro|cinque|sei|sette|otto|nove|dieci|dodici)';
    const durata = rx => { for (const m of s.matchAll(new RegExp(rx, 'g'))) {
      const prima = s.slice(Math.max(0, m.index - 16), m.index), dopo = s.slice(m.index + m[0].length, m.index + m[0].length + 4);
      if (!/prova|garanzia|reso|notti|soggiorno|abbonament|lezioni|preavviso|consegna/.test(prima) && !/^\s*di\b/.test(dopo)) return m; } return null; };
    const g = durata(NUM + '\\s*(?:giorni|gg)\\b'), sett = durata(NUM + '\\s*settiman'), mesi = durata(NUM + '\\s*mes[ei]\\b');
    const tuttoMese = /(?:per |durante )?tutto (?:il mese|(?:il mese di )?(?:gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre))\b/.test(s);
    if (g) spec.giorni = quanti(g[1]); else if (sett) spec.giorni = 7 * quanti(sett[1]); else if (mesi) spec.giorni = 30 * quanti(mesi[1]); else if (tuttoMese) spec.giorni = 30;
    const bg = s.match(/(\d[\d.,]*)\s*(?:€|euro)\s*(?:al|a|\/|ogni|per)\s*(?:giorno|gg|day)/) || s.match(/(?:budget|spendo|spesa)\D{0,14}(\d[\d.,]*)\s*(?:€|euro)?\s*(?:al|a|\/)\s*giorno/);
    let bm = !bg && s.match(/(\d[\d.,]*)\s*(?:€|euro)\s*(?:al|a|\/|ogni|per)\s*mese/);
    if (bm && /abbonament|costa|prezzo|canone|tariffa|\bpoi\b|a soli|\brat[ae]\b|per utente/.test(s.slice(Math.max(0, bm.index - 30), bm.index + bm[0].length + 14))) bm = null;
    if (bg) { spec.budget_giorno = num(bg[1]); resto = resto.replace(bg[0], ' '); } else if (bm) { spec.budget_giorno = num(bm[1]) / 30; resto = resto.replace(bm[0], ' '); } else {
      const bt = s.match(/(?:budget|spendo|spesa|spendere|investo|investire)\D{0,14}(\d[\d.,]*)\s*(?:€|euro)/) || s.match(/(\d[\d.,]*)\s*(?:€|euro)\s*(?:di budget|in tutto|totali|da spendere|da investire)/)
        || s.match(/(\d[\d.,]*)\s*(?:€|euro)\s*(?:in|per)\s*(\d+|un|una|due|tre|quattro|sei)\s*(giorni|settiman|mes)/)
        || s.match(/(?:giorni|settiman\w*|mes[ei])\s*,?\s*(?:con\s*|per\s*|budget\s*)?(\d[\d.,]*)\s*(?:€|euro)(?!\s*(?:al|a|\/)\s*(?:giorno|mese))/)
        || s.match(/(\d[\d.,]*)\s*(?:€|euro)\s*(?:per |durante )?tutto (?:il mese|(?:il mese di )?\w+)/);
      if (bt && bt[2]) spec.giorni = quanti(bt[2]) * (bt[3] === 'mes' ? 30 : bt[3] === 'settiman' ? 7 : 1);
      if (bt) { spec.budget_giorno = num(bt[1]) / (spec.giorni || 14); totale = num(bt[1]); resto = resto.replace(bt[0], ' '); }
    }
    const sc = resto.match(/(?:sconto|saldi|-|meno)\s*(?:del\s*|fino al\s*)?(\d{1,2})\s*%/) || resto.match(/(\d{1,2})\s*%\s*(?:di sconto|in meno|off)/);
    if (sc) { spec.sconto = +sc[1] / 100; resto = resto.replace(sc[0], ' '); }
    const pr = resto.match(/(?:costa|prezzo|a soli|a solo|solo|a)\s*(\d[\d.,]*)\s*(?:€|euro)/) || resto.match(/(\d[\d.,]*)\s*(?:€|euro)/);
    if (pr && num(pr[1]) > 0) spec.prezzo = num(pr[1]);
    if (/nuovo (?:marchio|brand)|appena (?:nat|lanciat)|startup|sconosciut|primo lancio|\bprim[oa] (?:gioco|app|prodotto|libro|collezione|negozio)|esordient|lancio (?:delle|del|della|dei|di) (?:nostr|nuov)|\bnuova app\b|\bindie\b|appena aperto|nuova apertura/.test(s)) spec.marchio = 'nuovo';
    else if (/famos|notissim|\bleader\b|\bnot[ae] marc|cantina storica|maison|marca storica/.test(s)) spec.marchio = 'famoso';
    if (/notoriet|farsi conoscere|farci conoscere|farmi conoscere|awareness|visibilit/.test(s)) spec.obiettivo = 'notorieta';
    else if (/\bvisite\b|traffico|portare (?:gente|persone) sul sito/.test(s)) spec.obiettivo = 'traffico';
    // a chi è rivolto, vantaggi dell'offerta, quando parte (regole di riserva, se la lettura del testo non risponde)
    const filtri = {};
    if (/\bdonne\b|ragazze|mamme|femminil/.test(s) && !/uomini/.test(s)) filtri.genere = ['donna'];   // «signore» no: può essere un signore
    else if (/\buomini\b|papà|maschil/.test(s) && !/donne|ragazze/.test(s)) filtri.genere = ['uomo'];
    const FASCE = [['18-24', 18, 24], ['25-34', 25, 34], ['35-44', 35, 44], ['45-54', 45, 54], ['55-64', 55, 64], ['65+', 65, 120]];
    const anni = s.match(/\b(?:da\s*)?(1[89]|[2-9]\d)\s*(?:-|–|a)\s*([2-9]\d)\b(?!\s*(?:%|€|euro))/) || s.match(/(?:over|oltre i?|sopra i|più di)\s*(\d{2})\s*(?:anni)?()(?!\s*(?:%|€|euro))/);
    const sotto = !anni && s.match(/(?:under|sotto i?)\s*(\d{2})\b/);
    const etaInNumeri = !!anni;
    if (anni) { const a = +anni[1], b = anni[2] ? +anni[2] : 120; filtri.eta = FASCE.filter(f => f[2] >= a && f[1] <= b).map(f => f[0]); }
    else if (sotto) filtri.eta = FASCE.filter(f => f[1] < +sotto[1]).map(f => f[0]);
    else if (/superiori|maturand|neodiplomat/.test(s)) filtri.eta = ['18-24'];
    else if (/\bgiovan[ie]\b|ragazz[ie]\b|ventenni|gen z|studenti/.test(s)) filtri.eta = ['18-24', '25-34'];
    else if (/pensionat|anzian|terza età/.test(s)) filtri.eta = ['65+'];
    if (/mamme|neogenitori|genitori|con bambini|figli piccoli/.test(s)) filtri.famiglia = ['figli_piccoli'];
    if (/reddito alto|alto reddito|benestant|facoltos|alto spendente|alto potere d.acquisto/.test(s)) filtri.reddito = ['alto'];
    else if (/reddito basso|basso reddito|budget limitato|famiglie in difficoltà/.test(s)) filtri.reddito = ['basso'];
    const aree = [[/milano|torino|genova|bergamo|brescia|\bmonza\b|varese|\bcomo\b|novara|lombardia|piemonte|liguria|valle d.aosta|nord-?ovest|lombard[oaie]\b|milanes|torines|piemontes|genoves|ligur[ei]\b/, 'nord_ovest'],
      [/venezia|bologna|verona|padova|vicenza|treviso|trieste|trento|bolzano|modena|\bparma\b|rimini|ravenna|veneto|emilia|trentino|friuli|nord-?est|venet[oaie]\b|emilian|bolognes|friulan|veronesi/, 'nord_est'],
      [/\broma\b|firenze|\bpisa\b|siena|livorno|perugia|ancona|latina|toscana|lazio|(?:nelle|regione) marche|umbria|centro italia|toscan[oaie]\b|fiorentin|lazial|\bromani\b|\bromane\b|marchigian|umbr[oaie]\b/, 'centro'],
      [/napoli|\bbari\b|salerno|caserta|lecce|taranto|foggia|pescara|reggio calabria|cosenza|campania|puglia|calabria|abruzzo|molise|basilicata|\bsud\b|mezzogiorno|campan[oaie]\b|napoletan|puglies|calabres|abruzzes|lucan[oaie]\b|salentin/, 'sud'],
      [/sicilia|sardegna|palermo|cagliari|catania|messina|siracusa|sassari|sicilian|\bsard[oaie]\b|palermitan|catanes/, 'isole']];
    const ar = aree.filter(([rx]) => rx.test(s)).map(x => x[1]);
    if (ar.length) filtri.area = ar;
    spec.filtri = filtri;
    const CITTA = { milano: 1370000, roma: 2750000, napoli: 910000, torino: 850000, palermo: 630000, genova: 560000, bologna: 390000, firenze: 360000,
      bari: 315000, catania: 300000, verona: 255000, venezia: 250000, messina: 220000, padova: 210000, trieste: 200000, brescia: 196000, parma: 196000,
      modena: 184000, 'reggio calabria': 170000, perugia: 165000, cagliari: 150000, bergamo: 120000, salerno: 127000, lecce: 95000, pescara: 118000 };
    const citta = Object.keys(CITTA).find(c => new RegExp('\\b(?:a|di|in|zona|centro di)\\s+' + c + '\\b').test(s));
    const locale = /ristorant|pizzeri|trattori|sushi|\bbar\b|pasticceri|gelateri|palestr|negozio|bottega|studio (?:dentistico|medico|legale)|dentist|parrucch|estetist|centro estetico|idraulic|elettricist|agenzia immobiliare|ottica|\bottico\b|lavanderi|officina|autofficina|mobilifici|concessionari|scuola di|studio di yoga|corsi di yoga in studio|fotograf|trasloc|coworking|ditta|impresa di|carrozzer|veterinari|pizzeria|panifici|fiorai|fioreria|libreria|enoteca|asilo|b&b|agriturismo|centro (?:sportivo|medico|commerciale)|salone/.test(s);
    const chiede = /preventiv|sopralluog|prenota|appuntament|chiamaci|contattaci|prima visita|valutazione gratuita/.test(s);
    if (citta && (locale || chiede)) spec.zona = { descrizione: citta.replace(/\b\w/g, x => x.toUpperCase()), persone: Math.round(CITTA[citta] * 0.84 * (/\bzona\b|quartiere|\bentro \d+ ?km/.test(s) ? 0.35 : 1)) };
    const NICCHIE = [[/studi dentistic|\bdentisti\b/, 'titolari di studi dentistici', 42000], [/\bavvocati|studi legali/, 'avvocati', 240000],
      [/commercialist|studi di consulenza fiscale/, 'commercialisti', 118000], [/ristorator|titolari di ristorant/, 'ristoratori', 330000],
      [/\bmedici\b|studi medici/, 'medici', 240000], [/architett/, 'architetti', 150000], [/farmacist|farmacie/, 'farmacisti', 100000],
      [/agricoltor|aziende agricole/, 'agricoltori', 400000], [/parrucchier|centri estetici|estetist/, 'parrucchieri ed estetiste', 150000],
      [/responsabili (?:commerciali|vendite|marketing|acquisti|hr|risorse umane)|direttori commerciali/, 'responsabili commerciali e marketing', 300000],
      [/piccole (?:e medie )?(?:aziende|imprese)|\bpmi\b/, 'titolari di piccole aziende', 900000], [/\bb2b\b|per aziende|alle aziende/, 'aziende', 900000]];
    const nic = NICCHIE.find(([rx]) => rx.test(s));
    if (nic) spec.nicchia = { descrizione: nic[1], persone: nic[2], b2b: true };
    // dove abita il pubblico: una città nominata è spesso dove sta il prodotto (una meta, un hotel), non chi lo compra
    const residenti = /per chi (?:abita|vive)|resident|abitant|a chi vive|in zona|nei dintorni|vicin|entro \d+ ?km|della provincia|del quartiere|pubblico (?:di|a|in)\b/.test(s);
    spec.extra = [[/spedizion\w* gratu/, 'spedizione_gratuita'], [/reso gratu|soddisfatti o rimborsati/, 'reso_gratuito'], [/garanzia/, 'garanzia'],
      [/a rate|rateal|in \d+ rate/, 'rate'], [/in regalo|in omaggio|omaggio/, 'regalo'], [/prova gratu|campione gratu/, 'prova_gratuita']].filter(([rx]) => rx.test(s)).map(x => x[1]);
    const oggi = new Date(), anno = oggi.getFullYear();
    const futura = (m, gg) => { let d = new Date(Date.UTC(anno, m, gg)); if (d < oggi) d = new Date(Date.UTC(anno + 1, m, gg)); return d.toISOString().slice(0, 10); };
    const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
    const mese = MESI.findIndex(x => new RegExp('\\b(?:a|ad|da|di|per|in|dal|dall’|dall\')\\s*' + x).test(s));
    if (/black friday/.test(s)) { const nov = new Date(Date.UTC(anno, 10, 1)), bf = new Date(nov); bf.setUTCDate(1 + ((5 - nov.getUTCDay() + 7) % 7) + 21); bf.setUTCDate(bf.getUTCDate() - 7); if (bf > oggi) spec.inizio = bf.toISOString().slice(0, 10); }
    else if (/natale|natalizi/.test(s)) spec.inizio = futura(11, 1);
    else if (mese >= 0) spec.inizio = futura(mese, 1);
    let unita = /scaric|download|install|gioco (?:per|sul|da) (?:telefono|cellulare|smartphone)|mobile game|\bapp (?:gratuit|gratis)|\bapp di (?:gioc|allenament)|\b(?:nuova|nostra) app\b(?![^.]{0,30}(?:ordin|prenot))/.test(s) ? 'download'
      : /preventiv|prenota|appuntament|\bdemo\b|colloqui|richiest\w* (?:di )?(?:informazioni|contatto)|richiedi|contattaci|chiamaci|visita gratuita|prima visita|consulenza|test drive|prova su strada|valutazione gratuita|lezione di prova|lezione gratuita|sopralluog/.test(s) ? 'contatti'
      : /iscri|registra|apri (?:il|un) conto|aprire (?:il|un) conto|apertura (?:del|di un) conto/.test(s) ? 'iscrizioni' : 'acquisti';
    // gratis vale per il prodotto, non per spedizione, reso o prova
    let gratis = /gratis|gratuit|\bfree\b/.test(s.replace(/(?:spedizion\w*|reso|consegna|prova|campione|resi)\s+(?:è\s+)?gratu\w*|gratis la spedizione/g, ' ')), ia = false, messaggio = null, suggerimenti = [];
    // quello che ha capito la lettura del testo (funzione /api/leggi) vale più delle regole a parole chiave; 0, vuoto o non_indicato = non detto
    const ia2 = brief && brief.fonte === 'ia' ? brief.campagna : null;
    if (brief && brief.fonte === 'ia' && brief.f) spec.creativita = brief.f;
    if (ia2) {
      ia = true;
      // il mezzo detto con il suo nome vince se la lettura del testo non lo conosce (LinkedIn, TV, radio, cartelloni, giornali)
      const nominato = c && ['linkedin', 'tv', 'radio', 'affissioni', 'stampa'].includes(c[1]) ? c[1] : null;
      if (nominato) { spec.canale = nominato; spec.canale_indicato = true; }
      else if (ia2.canale !== 'non_indicato') { spec.canale = ia2.canale; spec.canale_indicato = true; }
      // con la lettura del testo, l'area la decide lei: le regole vedono solo nomi di città
      if (!(ia2.pubblico && ia2.pubblico.area && ia2.pubblico.area.length) && !spec.zona) delete spec.filtri.area;
      if (ia2.categoria && ia2.categoria !== 'generica') spec.categoria_ia = ia2.categoria;   // il motore la controlla con le parole del testo
      if (ia2.formato_campagna !== 'non_indicato') spec.formato = ia2.formato_campagna;
      if (ia2.budget_giorno > 0) spec.budget_giorno = ia2.budget_giorno;
      if (ia2.giorni > 0) spec.giorni = ia2.giorni;
      if (ia2.prezzo > 0) spec.prezzo = ia2.prezzo;
      if (ia2.sconto_percento > 0) spec.sconto = ia2.sconto_percento / 100;
      if (ia2.marchio !== 'non_indicato') spec.marchio = ia2.marchio;
      spec.obiettivo = ia2.obiettivo;
      if (ia2.leve && ia2.leve.length) spec.leve = ia2.leve;
      if (ia2.prodotto) spec.descrizione_prodotto = ia2.prodotto + '. ' + testo;
      const etaRegole = etaInNumeri ? spec.filtri.eta : null;
      if (ia2.pubblico) Object.entries(ia2.pubblico).forEach(([k, v]) => { if (v && v.length) spec.filtri[k] = v; });   // le regole restano dove la lettura del testo tace
      if (etaRegole) spec.filtri.eta = etaRegole;   // «25-44», «over 50»: i numeri scritti si leggono esatti
      // un budget totale scritto: la divisione si fa sui giorni della campagna (la lettura del testo a volte divide per 14)
      if (totale > 0 && spec.giorni > 0 && Math.abs(spec.budget_giorno * spec.giorni / totale - 1) > 0.08) spec.budget_giorno = totale / spec.giorni;
      if (ia2.inizio) spec.inizio = ia2.inizio;
      if (ia2.trend && ia2.trend !== 'non_indicato') spec.trend = { in_calo: 0.8, normale: 1, in_crescita: 1.3, di_moda: 1.6 }[ia2.trend];
      if (ia2.extra) spec.extra = [...new Set([...spec.extra, ...ia2.extra])];
      // contatti: la lettura vecchia del testo non li conosce e li chiama iscrizioni
      // per un'attività locale prenotare o venire a provare è un contatto, non un acquisto online
      unita = unita === 'contatti' && (ia2.risultato === 'iscrizioni' || (ia2.risultato === 'acquisti' && spec.zona)) ? 'contatti' : ia2.risultato; gratis = ia2.gratis;
      if (typeof ia2.fisico === 'boolean') spec.fisico = ia2.fisico;
      else if (/spedizion|spedit|consegna (?:a domicilio|in \d|gratuit)|a casa tua|\bkg\b|confezion|bottigli|google shopping/.test(s)) spec.fisico = true;   // un oggetto che arriva a casa
      if (ia2.nicchia && ia2.nicchia.persone > 0) spec.nicchia = ia2.nicchia;
      if (ia2.zona && ia2.zona.persone > 0) spec.zona = ia2.zona;
      // viaggi, hotel, mete: il luogo è dove si va, non dove abita chi compra (salvo che il testo lo dica)
      if (ia2.categoria === 'viaggi' && !spec.zona && !residenti) { delete spec.filtri.area; delete spec.filtri.comune; }
      if (ia2.profilo) spec.profilo = ia2.profilo;   // chi lo compra di solito, prezzo di prodotti simili, frequenza, costo dei click
    }
    if (spec.fisico == null && /spedizion|spedit|consegna (?:a domicilio|in \d|gratuit)|a casa tua|\bkg\b|confezion|bottigli/.test(s)) spec.fisico = true;
    // cosa conta come risultato: un contatto o un'iscrizione non sono un incasso; un download gratuito nemmeno
    spec.conversione = CONVERSIONE[unita] || 'acquisto';
    if (spec.conversione === 'acquisto' && gratis) spec.conversione = 'iscrizione';
    if (spec.conversione === 'download' && !gratis) spec.conversione = 'acquisto';
    if (brief && brief.fonte === 'ia' && brief.presentazione) spec.presentazione = brief.presentazione;   // come è presentato il prodotto
    if (brief && brief.fonte === 'ia' && brief.messaggio) {
      // voto del messaggio: concretezza, credibilità e invito all'azione contati sul testo (stabili tra prompt simili),
      // beneficio e adatto al canale giudicati dalla lettura del testo
      const ann = s.replace(/(\d[\d.,]*)\s*(?:€|euro)\s*(?:al|a|\/|ogni|per)\s*(?:giorno|gg|day)/g, ' ').replace(/budget[^.;]*/g, ' ')
        .replace(/\b(?:per\s*)?\d+\s*(?:giorni|gg|settiman\w*|mesi?)\b/g, ' ');
      const concretezza = Math.min(2, [/\d{1,2}\s*%/, /\d[\d.,]*\s*(?:€|euro)/, /solo (?:oggi|fino|per)|entro |scade|fino a \w+|ultimi \d|\d+\s*(?:ml|pezzi|ore)\b/]
        .filter(rx => rx.test(ann)).length);
      const prova = /\d[\d.]*\s*(?:recensioni|clienti|persone|utenti|giocatori|download|ordini|venduti|mamme|donne)|\d(?:[.,]\d)?\s*stelle/.test(ann) ? 2
        : /recension|testimonian|consigliat|dermatolog|esperti|premiat|best ?seller|più vendut|amat[oa] da/.test(ann) ? 1 : 0;
      const invito = /\b(?:compra|acquista|ordina|scopri|scarica|iscriviti|clicca|prenota|approfitta|non perdere|corri|vai sul sito|link in bio|prova ora|provala|provalo)\b/.test(ann) ? 2 : 0;
      const g = brief.messaggio;
      // adatto al canale: il formato rispetto a quello che il canale preferisce (se il formato non si capisce, decide la lettura del testo)
      const PREF = { social: { video_breve: 2, carosello: 2, immagine: 1, video: 2 }, video_brevi: { video_breve: 2, video: 2 }, ricerca: { testo: 2 },
        shopping: { immagine: 2 }, display: { immagine: 2, video: 1 }, video: { video: 2, video_breve: 1 }, email: { immagine: 2, testo: 2 },
        linkedin: { immagine: 2, carosello: 2, video: 1 }, tv: { video: 2 }, radio: { testo: 2 }, affissioni: { immagine: 2 }, stampa: { immagine: 2 } };
      const fmt = spec.formato || (/video|reel|secondi|clip/.test(s) ? (spec.canale === 'video' ? 'video' : 'video_breve') : /carosello|slide|schede/.test(s) ? 'carosello'
        : /\bfoto\b|immagine|grafica/.test(s) ? 'immagine' : spec.canale === 'ricerca' ? 'testo' : null);
      const adatto = fmt ? ((PREF[spec.canale] || {})[fmt] || 0) : g.adatto;
      messaggio = { beneficio: g.beneficio, concretezza, prova, invito, adatto };
      messaggio.forza = messaggio.beneficio + concretezza + prova + invito + messaggio.adatto;
      spec.forza = messaggio.forza; suggerimenti = brief.suggerimenti || [];
    }
    // «meglio Instagram o TikTok?»: il mezzo non è deciso, lo sceglie l'analisi tra quelli nominati
    const dom = domanda(testo);
    if (dom && dom.tipo === 'canale') {
      spec.canale_indicato = false;
      if (dom.canali.length >= 2) { spec.canali_candidati = dom.canali; spec.canale = dom.canali[0]; }
    }
    // dallo storico, solo dove il testo tace
    if (riserva) {
      if (!spec.budget_giorno && riserva.budget_giorno) spec.budget_giorno = riserva.budget_giorno;
      if (!spec.giorni && riserva.giorni) spec.giorni = riserva.giorni;
      if (!spec.inizio && riserva.inizio) spec.inizio = riserva.inizio;
      if (!spec.marchio) spec.marchio = 'conosciuto';   // c'è uno storico: la marca ha già clienti e visitatori
      if (!spec.categoria && riserva.categoria) spec.categoria_riserva = riserva.categoria;
      if (riserva.taratura) spec.taratura = riserva.taratura;
    }
    return { spec, unita, gratis, ia, messaggio, suggerimenti, prodotto: ia2 && ia2.prodotto ? ia2.prodotto : '' };
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
      tot, eventi: {}, pubblici: pub, conAcquisti: true, u, ricavi: !contesto.gratis && (C.conversione || 'acquisto') === 'acquisto', etichettaPubblico: p => p.nome, principale: best, nuova: d });
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
    if (m.sorgente === 'nuova' && m.nuova.strategia && m.nuova.target && m.nuova.target.principale) {
      const mix = m.nuova.strategia.mix || [], t = m.nuova.target.principale;
      a.push(`Punta su ${t.descrizione} (rispondono ${nf(t.indice, 1)} volte la media)${mix.length ? `: ${mix.map(x => pc(x.quota * 100) + ' ' + (CANALI[x.canale] || x.nome)).join(', ')}` : ''}.`);
    }
    if (m.sorgente === 'nuova') {
      // pubblico troppo piccolo per il budget: ogni persona vedrebbe l'annuncio troppe volte
      const scelto = m.nuova.pubblici.find(p => p.tipo === m.nuova.migliore), fr = scelto ? scelto.totali.frequenza : 0;
      if (fr > 5) a.push(`Il pubblico è troppo piccolo per questo budget: ogni persona vedrebbe l’annuncio ${n1(fr)} volte. Allarga il pubblico o abbassa il budget.`);
      const C = m.nuova.campagna, ampio = m.pubblici.find(p => p.id === 'ampio');
      if (ampio && best.id !== 'ampio') a.push(`Usa il pubblico «${best.nome}»: ${n1(best.acq)} ${u} contro ${n1(ampio.acq)} con il pubblico ampio, a parità di budget.`);
      else a.push('Il pubblico ampio è già la scelta migliore: la piattaforma trova da sola chi risponde.');
      // dal consiglio, confronti alla pari: per il canale pubblico ampio contro pubblico ampio (chi conosce già il marchio
      // gonfierebbe i canali di ricerca), per le leve stesso pubblico e stesso canale del migliore
      const cl = (m.nuova.consigli && m.nuova.consigli.classifica) || [], rif = best.risultato || 1, rifAmpio = ampio ? ampio.risultato || 1 : 0;
      // Shopping vende prodotti fisici: non si propone per download o iscrizioni
      const canale = rifAmpio ? cl.filter(x => x.pubblico === 'ampio' && x.canale !== C.canale && !(x.canale === 'shopping' && m.u !== UNITA.acquisti))
        .sort((x, y) => y.risultato - x.risultato)[0] : null;
      if (canale && canale.risultato / rifAmpio > 1.15) a.push(`Prova anche ${CANALI[canale.canale] || canale.canale} (${FORMATI[canale.formato] || canale.formato}): con il pubblico ampio circa ×${nf(canale.risultato / rifAmpio, 1)} ${u}, con lo stesso budget.`);
      const leva = cl.filter(x => x.pubblico === best.tipo && x.canale === C.canale && x.leve.some(l => !C.leve.includes(l))).sort((x, y) => y.risultato - x.risultato)[0];
      if (leva && leva.risultato / rif > 1.08) {
        const nuove = leva.leve.filter(l => !C.leve.includes(l));
        a.push(`Aggiungi all’annuncio ${nuove.map(l => FRASE_LEVA[l] || LEVE[l]).join(' e ')}: circa +${ni((leva.risultato / rif - 1) * 100)}% ${u}.`);
      }
    }
    if (m.sorgente === 'nuova' && contesto.messaggio && contesto.messaggio.forza <= 6 && (contesto.suggerimenti || []).length) {
      a.splice(1, 0, `Rafforza il testo (${ni(contesto.messaggio.forza)}/10): ${contesto.suggerimenti[0].replace(/\.$/, '')}.`);
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
    const adatto = (p, i) => (p.genere === 'donna' ? FEMMINILI.test(nomi[i]) || !MASCHILI.test(nomi[i]) : MASCHILI.test(nomi[i]) || !FEMMINILI.test(nomi[i]));
    return persone.map(p => {
      // prima i personaggi chiaramente del suo genere, poi quelli neutri; finiti quelli nuovi, se ne riusa uno del genere giusto
      const suo = i => (p.genere === 'donna' ? FEMMINILI : MASCHILI).test(nomi[i]);
      let cand = nomi.map((n, i) => i).filter(i => !usati.has(i) && suo(i));
      if (!cand.length) cand = nomi.map((n, i) => i).filter(i => !usati.has(i) && adatto(p, i));
      if (!cand.length) cand = nomi.map((n, i) => i).filter(i => suo(i));
      const vecchi = cand.filter(i => ANZIANI.test(nomi[i]));
      if (p.eta >= 62 && vecchi.length) cand = vecchi; else if (p.eta < 50) cand = cand.filter(i => !ANZIANI.test(nomi[i])).concat(cand.length ? [] : vecchi);
      if (!cand.length) cand = nomi.map((n, i) => i).filter(i => !usati.has(i));
      if (!cand.length) { usati.clear(); cand = nomi.map((n, i) => i); }   // più persone che personaggi: si ricomincia
      const id = cand[Math.floor(Math.random() * cand.length)] || 0;
      usati.add(id);
      return id;
    });
  }
  function personeDaMostrare(m) {
    // il piano è tre volte lo schermo in larghezza e in altezza: allontanandosi con lo zoom la folla riempie tutto
    const quante = window.innerWidth < 600 ? 150 : 320, per = Math.max(2, Math.ceil(quante / m.pubblici.length));
    const out = [];
    // per ogni pubblico alterna chi compra, chi clicca e chi passa oltre (le persone arrivano raggruppate per esito)
    const misto = lista => { const g = ['compra', 'clicca', 'passa'].map(e => lista.filter(x => x.esito === e)), r = [];
      for (let i = 0; r.length < lista.length; i++) g.forEach(x => { if (x[i]) r.push(x[i]); }); return r; };
    m.pubblici.forEach(p => misto(p.persone || []).slice(0, per).forEach(x => out.push(Object.assign({ pubblico: p }, x))));
    return out.slice(0, quante + m.pubblici.length);
  }
  const nuovaTela = sel => { const v = $(sel), n = v.cloneNode(false); v.replaceWith(n); return n; };   // la scena vecchia si ferma da sola

  /* -------------------------------------------------------------- vista Persone */
  // gruppi della barra in basso. Campagna nuova: i gruppi scoperti dall'analisi (il target, l'alternativa, i gruppi che rispondono
  // di più); ogni persona simulata ne fa parte o no secondo i suoi tag. Storico: i pubblici veri del file.
  function gruppiPersone(m) {
    const t = m.sorgente === 'nuova' && m.nuova.target;
    if (!t || !t.principale) {
      return [...new Set(m.pubblici.map(p => p.tipo))].map(tipo => ({ id: tipo, nome: NOMI_PUBBLICO[tipo] || 'Pubblico', colore: COLORE_TIPO[tipo] || GRIGIO,
        stella: tipo === m.migliore.tipo, dentro: p => p.pubblico.tipo === tipo }));
    }
    const con = f => p => !!p.tag && Object.entries(f).every(([k, v]) => v.includes(p.tag[k]));
    const maiusc = x => x.charAt(0).toUpperCase() + x.slice(1);
    const g = [{ id: 'target', nome: maiusc(t.principale.descrizione), dettaglio: '×' + nf(t.principale.indice, 1), colore: '#E0457B', stella: true, dentro: con(t.principale.filtri) }];
    if (t.alternativa) g.push({ id: 'alternativa', nome: maiusc(t.alternativa.descrizione), dettaglio: '×' + nf(t.alternativa.indice, 1), colore: VIOLA, dentro: con(t.alternativa.filtri) });
    // i singoli gruppi che rispondono di più, se non sono già nel target
    const singoli = ['eta', 'genere', 'famiglia', 'reddito', 'area'].flatMap(tag => (t.mappa[tag] || []).filter(x => x.quota > 0.03).map(x => Object.assign({ tag }, x)))
      .filter(x => x.indice >= 1.3 && !(t.principale.filtri[x.tag] || []).includes(x.livello) && !(((t.alternativa || {}).filtri || {})[x.tag]))
      .sort((a, b) => b.indice - a.indice).slice(0, 2);
    singoli.forEach((x, i) => g.push({ id: 'g' + i, nome: maiusc(x.etichetta), dettaglio: '×' + nf(x.indice, 1), colore: [BLU, ARANCIO][i], dentro: p => !!p.tag && p.tag[x.tag] === x.livello }));
    return g;
  }
  function rPersone() {
    chiudiScheda();
    const st = $('#a-persone'), persone = personeDaMostrare(M), gruppi = gruppiPersone(M);
    if (filtroPub !== 'tutti' && !gruppi.some(x => x.id === filtroPub)) filtroPub = 'tutti';
    const visibile = p => { const gr = gruppi.find(x => x.id === filtroPub); return !gr || gr.dentro(p); };
    $('#a-legenda').innerHTML = `<p class="a-segni"><span><i style="border-color:${BORDO.compra}"></i>${esc(M.u.fatto[1].toLowerCase())}</span><span><i style="border-color:${BORDO.clicca}"></i>ha cliccato</span><span><i style="border-color:${BORDO.passa}"></i>non ha fatto nulla</span></p>
      <div class="a-filtro-pub">${[{ id: 'tutti', nome: 'Tutti' }, ...gruppi].map(x => `<button type="button" data-p="${esc(x.id)}" class="${filtroPub === x.id ? 'si' : ''}"${x.id === 'target' ? ' title="Il target scoperto dall’analisi"' : ''}>${
      x.id === 'tutti' ? 'Tutti' : `<i style="background:${x.colore}"></i>${x.id === 'target' ? 'Target: ' : ''}${esc(x.nome)}${x.dettaglio ? ` <em>${esc(x.dettaglio)}</em>` : ''}`}${x.stella ? ' <span class="stella">★</span>' : ''}</button>`).join('')}</div>`;
    $$('#a-legenda [data-p]').forEach(b => b.addEventListener('click', () => {
      filtroPub = b.dataset.p;
      $$('#a-legenda [data-p]').forEach(x => x.classList.toggle('si', x === b));
      if (scena) scena.omini.forEach(o => { o.a = visibile(o.persona) ? 1 : 0.18; });
      if (punti) punti.onda(st.clientWidth / 2, st.clientHeight * 0.6, 0.6);
      chiudiScheda();
    }));
    if (!persone.length) { $('#a-aiuto').textContent = 'Nessuna persona simulata per questi dati.'; return; }
    $('#a-aiuto').textContent = 'Tocca una persona per vedere chi è e cosa ha fatto.';
    window.Flock.carica().then(() => {
      if (punti) punti.ferma();
      const cp = nuovaTela('#a-prato'), cf = nuovaTela('#a-folla');
      const h = st.clientHeight, stretto = window.innerWidth < 600, giu = stretto ? 96 : 76, ids = personaggi(persone);
      scena = window.Flock.campo(null, cf, { altezza: h, ids, scale: stretto ? [2, 2] : [3, 3], suolo: giu, mondo: 3, mondoH: 3, piano: true });
      punti = window.Flock.puntini(cp, { area: st, sorgenti: () => scena.omini.map(o => scena.piedi(o)),
        vista: () => ({ z: scena.zoom, ox: scena.ox, oy: scena.oy }) });
      zoomControlli(st, cf);
      scena.omini.forEach(o => {
        const p = persone[o.indice != null ? o.indice : ids.indexOf(o.id)];
        o.persona = p;
        o.allegro = p.esito === 'compra';   // chi ha comprato ogni tanto fa festa
        o.bordo = BORDO[p.esito];           // perimetro di 1 pixel: cosa ha fatto
        o.a = visibile(p) ? 1 : 0.18;
      });
    });
  }
  /* Zoom sulla griglia: rotella o pizzico sul trackpad, due dita sul telefono, tasti + e −; trascinando ci si sposta.
     Un tocco senza spostamento apre la scheda della persona. */
  function zoomControlli(st, cf) {
    const dita = new Map();
    let inizio = null, mosso = false, ultimo = null, distanza = 0;
    const pos = e => { const r = cf.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const livello = () => { const z = $('#a-zoom-val'); if (z) z.textContent = Math.round(scena.zoom * 100) + '%'; };
    const zoomA = (z, fx, fy) => { scena.zoomA(z, fx, fy); livello(); };
    cf.addEventListener('wheel', e => {
      e.preventDefault();
      const p = pos(e);
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && !e.ctrlKey) { scena.sposta(-e.deltaX, 0); return; }
      zoomA(scena.zoom * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)), p.x, p.y);
    }, { passive: false });
    cf.addEventListener('pointerdown', e => {
      cf.setPointerCapture(e.pointerId);
      dita.set(e.pointerId, pos(e));
      if (dita.size === 1) { inizio = ultimo = pos(e); mosso = false; }
      if (dita.size === 2) { const [a, b] = [...dita.values()]; distanza = Math.hypot(a.x - b.x, a.y - b.y); mosso = true; }
    });
    cf.addEventListener('pointermove', e => {
      const p = pos(e);
      if (!dita.has(e.pointerId)) { cf.style.cursor = scena.trova(p.x, p.y) ? 'pointer' : 'grab'; return; }
      dita.set(e.pointerId, p);
      if (dita.size === 2) {   // pizzico
        const [a, b] = [...dita.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (distanza > 0) zoomA(scena.zoom * d / distanza, (a.x + b.x) / 2, (a.y + b.y) / 2);
        distanza = d; return;
      }
      if (!mosso && Math.hypot(p.x - inizio.x, p.y - inizio.y) > 6) mosso = true;
      if (mosso) { scena.sposta(p.x - ultimo.x, p.y - ultimo.y); cf.style.cursor = 'grabbing'; }
      ultimo = p;
    });
    const su = e => {
      const p = pos(e), eraUno = dita.size === 1;
      dita.delete(e.pointerId);
      if (dita.size < 2) distanza = 0;
      if (eraUno && !mosso) {   // tocco: apre la persona
        const o = scena.trova(p.x, p.y);
        if (o) { apriScheda(o); const f = scena.piedi(o); punti.onda(f.x, f.y, 0.5); } else chiudiScheda();
      }
      if (!dita.size) cf.style.cursor = 'grab';
    };
    cf.addEventListener('pointerup', su);
    cf.addEventListener('pointercancel', e => { dita.delete(e.pointerId); distanza = 0; });
    const z = $('#a-zoom');
    z.innerHTML = `<button type="button" data-z="-1" aria-label="Allontana">−</button><span id="a-zoom-val">100%</span><button type="button" data-z="1" aria-label="Avvicina">+</button>`;
    $$('button', z).forEach(b => b.addEventListener('click', () => zoomA(scena.zoom * (b.dataset.z > 0 ? 1.25 : 0.8), st.clientWidth / 2, st.clientHeight / 2)));
    livello();
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
      ${motivi(p, donna, u)}
      <p class="gruppo"><i style="background:${COLORE_TIPO[p.pubblico.tipo] || GRIGIO}"></i>${esc(M.etichettaPubblico(p.pubblico))}${p.persone_simili ? ` · ${ni(p.persone_simili)} persone come ${donna ? 'lei' : 'lui'} in Italia` : ''}</p></div>`;
    sch.hidden = false;
    sch.classList.remove('entra'); void sch.offsetWidth; sch.classList.add('entra');
    $('.chiudi', sch).addEventListener('click', () => chiudiScheda());
    // la scheda resta sempre dentro il riquadro: sopra la testa, se no sotto i piedi, se no di fianco
    const muovi = () => {
      if (!scelto || !scena) return;
      const st = $('#a-persone'), c = $('#a-folla'), W = st.clientWidth, H = st.clientHeight, sw = sch.offsetWidth, sh = sch.offsetHeight;
      const t = scena.testa(scelto), hx = t.x, hy = c.offsetTop + t.y, piedi = c.offsetTop + scena.piedi(scelto).y, mg = 10;
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
  // perché ha fatto quello che ha fatto: i motivi a favore e quelli contro, legati all'annuncio provato
  function motivi(p, donna, u) {
    const si = p.perche_si || (p.esito === 'passa' ? [] : p.perche || []), no = p.perche_no || (p.esito === 'passa' ? p.perche || [] : []);
    const lo = donna ? 'la' : 'lo', fatto = u.fatto[donna ? 0 : 1].replace(/^Ha /, 'ha ').replace(/^Si /, 'si ');
    const titoli = {
      compra: [[`Perché ${fatto}`, si, 'si'], [`Cosa poteva fermar${lo}`, no, 'no']],
      clicca: [['Perché ha cliccato', si, 'si'], [u.plur === 'acquisti' ? 'Perché non ha comprato' : 'Perché si è fermat' + (donna ? 'a' : 'o'), no, 'no']],
      passa: [[`Perché è passat${donna ? 'a' : 'o'} oltre`, no, 'no'], [`Cosa ${donna ? 'le' : 'gli'} piaceva`, si, 'si']],
    }[p.esito] || [];
    const blocchi = titoli.filter(([, lista]) => lista && lista.length).map(([titolo, lista, verso]) =>
      `<div class="motivi ${verso}"><b>${esc(titolo)}</b><ul>${lista.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`);
    return blocchi.length ? `<div class="motivi-tutti">${blocchi.join('')}</div>` : '';
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
      ...C.leve.map(l => LEVE[l]), ...(C.extra || []).map(e => EXTRA[e] || e),
      C.marchio === 'nuovo' ? 'marchio nuovo' : C.marchio === 'famoso' ? 'marchio famoso' : '', TREND[C.trend] || '',
      C.nicchia ? `per ${C.nicchia.descrizione || 'una nicchia'}` : '', C.zona ? `zona: ${C.zona.descrizione || 'locale'}` : '',
      C.conversione === 'contatto' ? 'risultato: contatti' : '',
      ...Object.entries(C.filtri || {}).map(([k, v]) => (k === 'eta' ? 'per ' + etaInBreve(v) : 'per ' + v.map(x => VALORI[x] || x).join(' o '))),
      C.forza != null ? `messaggio ${ni(C.forza)}/10` : '',
    ].filter(Boolean);
    const cr = contesto.creativa, fonte = cr ? (contesto.prompt && contesto.prompt !== (cr.vista && cr.vista.descrizione) ? `Dal testo e ${cr.tipo === 'video' ? 'dal video' : 'dalla foto'}` : cr.tipo === 'video' ? 'Dal video' : cr.tipo === 'carosello' ? 'Dalle foto' : 'Dalla foto') : 'Dal tuo testo';
    return `<div class="a-capito"><span class="a-capito-t">${fonte}</span>${voci.map(v => `<span>${esc(v)}</span>`).join('')}<a href="#/nuova" data-modifica>Modifica</a></div>
      ${m.nuova.ipotesi.length ? `<p class="a-nota">${esc(m.nuova.ipotesi.filter(x => !/^Categoria letta|^Pubblico indicato|^Pubblico di nicchia|^Attività locale/.test(x) && !(contesto.gratis && /^Prezzo/.test(x))).join(' · '))}</p>` : ''}
      ${m.nuova.taratura ? `<p class="a-nota a-tarato">Tarato su ${esc(contesto.fonte || 'il tuo storico')}${contesto.marca ? ' (' + esc(contesto.marca) + ')' : ''}: per questa marca i click partono da ×${nf(Math.exp(m.nuova.taratura.ctr), 2)} e il costo da ×${nf(Math.exp(m.nuova.taratura.cpm), 2)} rispetto al tipico del settore.</p>` : ''}`;
  }
  /* ------------------------------------------------- la domanda scritta nel prompt */
  // Se chi scrive fa una domanda («meglio Instagram o TikTok?», «quanto devo spendere?», «a chi lo mostro?»,
  // «quante vendite faccio?»), la risposta va in cima all'analisi, con i numeri del simulatore.
  const NOMI_CANALE = [[/tiktok|\breels?\b|\bshorts?\b/, 'video_brevi'], [/youtube/, 'video'], [/shopping/, 'shopping'], [/google|ricerca/, 'ricerca'],
    [/banner|display/, 'display'], [/e-?mail|newsletter/, 'email'], [/linkedin/, 'linkedin'], [/instagram|facebook|\bmeta\b/, 'social'],
    [/\btv\b|televisi/, 'tv'], [/\bradio\b/, 'radio'], [/cartellon|affission|manifest/, 'affissioni'], [/giornal|rivist|quotidian/, 'stampa']];
  function domanda(testo) {
    const s = ' ' + String(testo || '').toLowerCase().replace(/\s+/g, ' ') + ' ';
    const chiede = /\?|\bmeglio\b|\bconviene\b|\bvale la pena\b|\bdimmi\b|\bvorrei sapere\b|\bcapire\b/.test(s);
    if (!chiede) return null;
    const canali = [...new Set(NOMI_CANALE.filter(([rx]) => rx.test(s)).map(x => x[1]))];
    if ((canali.length >= 2 && /\bmeglio\b|\bconviene\b|\bo\b.*\?|\boppure\b/.test(s)) || /(?:quale|che|su che|su quale|dove)\s+(?:canale|social|piattaforma|mezzo)|dove (?:conviene|è meglio) (?:pubblicare|investire|fare)/.test(s)) return { tipo: 'canale', canali };
    if (/quanto (?:devo |dovrei |mi conviene |posso )?(?:spendere|investire|mettere)|(?:che|quale|quanto) budget|budget (?:giusto|ideale|minimo|ottimale)/.test(s)) return { tipo: 'budget' };
    if (/a chi (?:lo |la |li |le )?(?:mostr|rivolg|punt|vend|indirizz)|(?:che|quale) (?:pubblico|target)|chi (?:lo |la )?compr/.test(s)) return { tipo: 'pubblico' };
    if (/quant[ie] (?:vendite|clienti|download|iscritti|iscrizioni|contatti|persone|click|ordini|prenotazioni)|quanto (?:vendo|vender|guadagn|incass|rende)|vale la pena|funzioner/.test(s)) return { tipo: 'risultati' };
    return null;
  }
  function risposta(m) {
    if (m.sorgente !== 'nuova' || !contesto.domanda) return '';
    const d = contesto.domanda, C = m.nuova.campagna, u = m.u, T = m.tot, ob = C.obiettivo;
    const ris = t => (ob === 'notorieta' ? t.persone_raggiunte : ob === 'traffico' ? t.click : t.acquisti);
    const quanti = v => (ob === 'notorieta' ? ni(v) + ' persone raggiunte' : ob === 'traffico' ? ni(v) + ' click' : n1(v) + ' ' + u.plur);
    let testo = '';
    if (d.tipo === 'canale') {
      const mezzi = ((m.nuova.strategia || {}).mezzi || []).filter(x => x.fattibile !== false);
      const scelti = d.canali.length >= 2 ? mezzi.filter(x => d.canali.includes(x.canale)) : mezzi;
      const ord = scelti.slice().sort((a, b) => ris(b.totali) - ris(a.totali));
      const nome = x => CANALI[x.canale] || x.nome;
      if (ord.length >= 2) {
        const a = ord[0], b = ord[1], ra = ris(a.totali), rb = ris(b.totali), piu = rb > 0 ? ra / rb - 1 : 0;
        testo = `Meglio <b>${esc(nome(a))}</b>: con lo stesso budget porta circa <b>${quanti(ra)}</b>, contro ${quanti(rb)} su ${esc(nome(b))}${piu > 0.04 ? ` (<b>+${pc(piu * 100)}</b>)` : ', quasi alla pari'}.`;
        if (d.canali.length < 2 && ord[2]) testo += ` Terzo: ${esc(nome(ord[2]))}, ${quanti(ris(ord[2].totali))}.`;
      } else if (ord.length === 1) testo = `Tra i mezzi provati rende di più <b>${esc(nome(ord[0]))}</b>: circa ${quanti(ris(ord[0].totali))} con tutto il budget.`;
    } else if (d.tipo === 'budget') {
      const b0 = C.budget_giorno, S0 = T.spesa, e = ELASTICITA;
      if (m.conAcquisti && m.ricavi && T.ricavi > 0) {
        // il budget che dà il guadagno più alto: ricavi che crescono meno della spesa (rendimenti decrescenti)
        const S = S0 * Math.pow((1 - e) * T.ricavi / S0, 1 / e), b = Math.min(Math.max(S / S0, 0.25), 3) * b0;
        const fuori = S / S0 > 3 ? ' (e anche di più)' : S / S0 < 0.25 ? ' (anche meno)' : '';
        testo = T.ricavi < S0 && S / S0 < 0.25
          ? `Con questi numeri l'annuncio non si ripaga a nessun budget: ogni euro torna ×${nf(T.ricavi / S0, 2)}. Conviene prima cambiare pubblico, canale o messaggio.`
          : `Il guadagno più alto arriva intorno a <b>${eur(b)} al giorno</b>${fuori}: lì ogni euro in più rende ancora quanto costa. Con ${eur(b0)} al giorno ogni euro speso torna ×${nf(T.ricavi / S0, 2)}.`;
      } else {
        const r = k => T.acq * Math.pow(k, 1 - e), cpa = k => (S0 * k) / Math.max(r(k), 1e-9);
        const val = m.conAcquisti ? n1 : ni, uni = m.conAcquisti ? u.plur : 'click', base = m.conAcquisti ? T.acq : T.clk;
        const r2 = base * Math.pow(2, 1 - e), r05 = base * Math.pow(0.5, 1 - e);
        testo = `Con ${eur(b0)} al giorno: circa <b>${val(base)} ${uni}</b> a ${eur(S0 / Math.max(base, 1e-9))} l'uno. Con il doppio: ${val(r2)} a ${eur(2 * S0 / Math.max(r2, 1e-9))} l'uno; con la metà: ${val(r05)} a ${eur(0.5 * S0 / Math.max(r05, 1e-9))}. Più budget porta di più, ma ogni risultato costa un po' di più.`;
        void cpa;
      }
    } else if (d.tipo === 'pubblico') {
      const t = m.nuova.target && m.nuova.target.principale, best = m.migliore;
      testo = t ? `Punta su <b>${esc(t.descrizione)}</b>: rispondono ${nf(t.indice, 1)} volte la media e valgono il ${pc(t.quota_risultati * 100)} dei ${esc(u.plur)} possibili.` : '';
      testo += ` Tra i pubblici delle piattaforme rende di più <b>${esc(m.etichettaPubblico(best).toLowerCase())}</b>.`;
    } else if (d.tipo === 'risultati') {
      const roas = T.ricavi / Math.max(T.spesa, 1e-9);
      testo = `Circa <b>${quanti(ris({ persone_raggiunte: T.raggiunte, click: T.clk, acquisti: T.acq }))}</b> con ${eur(T.spesa)} in tutto${T.acqBasso && T.acqAlto && ob === 'vendite' ? ` (8 volte su 10 tra ${n1(T.acqBasso)} e ${n1(T.acqAlto)})` : ''}.${m.conAcquisti && m.ricavi ? ` Ogni euro speso torna ×${nf(roas, 2)}: ${roas >= 1 ? 'si ripaga' : 'non si ripaga ancora'}.` : ''}`;
    }
    return testo ? `<div class="a-risposta"><span class="a-risposta-t">La tua domanda</span><p>${testo}</p></div>` : '';
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
        <div class="a-intesta${contesto.creativa && nuova ? ' con-anteprima' : ''}">
          ${contesto.creativa && nuova ? `<figure class="a-anteprima${contesto.creativa.verticale ? ' verticale' : ''}"><img src="${contesto.creativa.anteprima}" alt="${contesto.creativa.tipo === 'video' ? 'Primo fotogramma del video' : 'La foto dell’annuncio'}">${contesto.creativa.tipo === 'video' ? `<figcaption>▶ ${ni(contesto.creativa.durata)} s</figcaption>` : ''}</figure>` : ''}
          <div><p class="a-etichetta">${etichetta}</p>
          <h2 class="a-titolo2">${titolo}</h2>
          ${contesto.creativa && nuova && contesto.creativa.vista && contesto.creativa.vista.descrizione && contesto.creativa.vista.descrizione !== contesto.prompt ? `<p class="a-scritte">Si vede: ${esc(contesto.creativa.vista.descrizione)}</p>` : ''}
          ${contesto.creativa && nuova && contesto.creativa.vista && contesto.creativa.vista.testo_visibile ? `<p class="a-scritte">Scritte: «${esc(contesto.creativa.vista.testo_visibile)}»</p>` : ''}</div>
        </div>
        ${capito(m)}
        ${risposta(m)}
        ${!nuova && contesto.prompt ? `<p class="a-nota">Il tuo annuncio: «${esc(contesto.prompt)}» · come andrebbe su queste campagne è più sotto.</p>` : ''}
        <p class="a-frase">${frase}</p>
        <dl class="a-kpi">
          <div><dt>Spesa</dt>${conta(T.spesa, 'eur')}<small>${eur(T.spesa / m.ngiorni)} al giorno</small></div>
          <div><dt>${nuova ? 'Persone raggiunte' : 'Visualizzazioni'}</dt>${conta(nuova ? T.raggiunte : T.imp, 'ni')}${nuova ? `<small>${ni(T.imp)} visualizzazioni</small>` : tra(T.impBasso, T.impAlto, ni)}</div>
          <div><dt>${nuova && OFFLINE.includes(C.canale) ? 'Visite stimate' : 'Click'}</dt>${conta(T.clk, 'ni')}<small>${nf(100 * T.clk / Math.max(T.imp, 1))} ogni 100 ${nuova && OFFLINE.includes(C.canale) ? 'contatti' : 'viste'}</small></div>
          ${m.conAcquisti ? `<div><dt>${esc(nomeMet('acq'))}</dt>${conta(T.acq, 'n1')}${tra(T.acqBasso, T.acqAlto, n1)}</div>` : ''}
          ${ric ? `<div><dt>Ricavi</dt>${conta(T.ricavi, 'eur')}${tra(T.ricBasso, T.ricAlto, eur)}</div>
          <div><dt>Ogni euro speso</dt>${conta(roas, 'nf2')}<small>${roas >= 1 ? 'torna con un guadagno' : 'non si ripaga ancora'}</small></div>` : m.conAcquisti ? `<div><dt>${esc(u.costo)}</dt>${conta(T.spesa / Math.max(T.acq, 1e-9), 'eur')}</div>` : ''}
        </dl>
        ${!nuova && m.conAcquisti ? `<p class="a-nota">${u.plur.charAt(0).toUpperCase() + u.plur.slice(1)} e ricavi stimati dalle persone simulate, tarate sui click previsti.</p>` : ''}
      </div>
      ${nuova ? schedaTarget(i++, card) : ''}
      ${nuova ? schedaStrategia(i++, card) : ''}
      <div class="a-griglia">
        ${card(i++, 'Il pubblico migliore', `
          <p class="a-best"><b><i style="background:${COLORE_TIPO[best.tipo] || GRIGIO}"></i>${esc(m.etichettaPubblico(best))}</b> <span>${esc(best.frase)}</span></p>
          <p>${m.pubblici.length > 1 ? `Ogni euro speso qui rende <b>${nf(best.resa, 1)} volte</b> ${nuova ? 'la media dei pubblici provati' : 'la media'}.` : ''} ${m.conAcquisti ? `${n1(best.acq)} ${u.plur} a ${eur(best.spesa / Math.max(best.acq, 1e-9))} l’uno.` : `${ni(best.clk)} click a ${eur(best.spesa / Math.max(best.clk, 1))} l’uno.`}</p>
          <div class="a-mini">${m.pubblici.slice(0, 5).map(p => `<div><span>${esc(m.etichettaPubblico(p))}</span><i style="width:${(p.resa / maxResa * 100).toFixed(1)}%;background:${COLORE_TIPO[p.tipo] || GRIGIO}"></i></div>`).join('')}</div>
          ${nuova ? '<p class="a-nota">Scelto dall’analisi: la stessa campagna provata su ogni tipo di pubblico, con lo stesso budget.</p>' : ''}`, 'evidenza a-luce')}
        ${card(i++, 'Cosa fare adesso', `<ol class="a-azioni">${m.azioni.map(x => `<li>${esc(x)}</li>`).join('')}</ol>`, 'a-luce')}
      </div>
      ${messaggio(i++)}
      ${creativita(i++)}
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
      <p class="a-piede">${m.sorgente === 'storico' ? `<a href="${window.Flk.scarico()}" download="${esc(window.Flk.D.meta.file_previsioni)}">Scarica le previsioni</a>` : '<a href="#/nuova" data-modifica>Modifica la campagna</a>'} · <a href="#/come">Come funziona</a></p>`;
    // controlli
    $$('.a-tab [data-met]', el).forEach(b => b.addEventListener('click', () => { es.metrica = b.dataset.met; $$('.a-tab [data-met]', el).forEach(x => x.setAttribute('aria-selected', x === b)); rEsplora(); }));
    $$('.a-seg', el).forEach(g => $$('button', g).forEach(b => b.addEventListener('click', () => {
      es[g.dataset.k] = b.dataset.v; $$('button', g).forEach(x => x.setAttribute('aria-pressed', x === b)); rEsplora();
    })));
    $$('[data-modifica]', el).forEach(a => a.addEventListener('click', () => { if (nuova && window.Nuova && window.Nuova.riempi) window.Nuova.riempi(Object.assign({}, m.nuova.campagna, { taratura: m.nuova.taratura })); }));
    const rb = $('#a-budget', el);
    rb.addEventListener('input', () => rBudget(+rb.value));
    rEsplora(); rBudget(1); rPareggio();
    contaSu(el); luce(el);
  }
  // tutte le persone simulate → il target dove ha più senso puntare
  function schedaTarget(i, card) {
    const t = M.nuova.target;
    if (!t || !t.principale) return '';
    const p = t.principale, a = t.alternativa, mappa = t.mappa || {};
    const barre = tag => {
      const r = (mappa[tag] || []).filter(x => x.quota > 0.005), mx = Math.max(...r.map(x => x.indice), 0.01);
      return `<div class="a-gr"><b>${{ eta: 'Età', genere: 'Genere', reddito: 'Reddito', famiglia: 'Famiglia', area: 'Area' }[tag]}</b>${r.map(x =>
        `<div class="a-gr-riga"><span>${esc(x.etichetta)}</span><div><i style="width:${(x.indice / mx * 100).toFixed(1)}%" class="${x.indice >= 1.15 ? 'su' : x.indice <= 0.85 ? 'giu' : ''}"></i></div><em>×${nf(x.indice, 1)}</em></div>`).join('')}</div>`;
    };
    const persone = p.persone >= 1e6 ? nf(p.persone / 1e6, 1) + ' milioni di' : ni(p.persone);
    return card(i, 'Il target', `
      <p class="a-best a-target"><b>${esc(p.descrizione.charAt(0).toUpperCase() + p.descrizione.slice(1))}</b>${p.perimetro ? ` <span>dentro il pubblico che hai indicato (${esc(p.perimetro)})</span>` : ''}</p>
      <p>Circa <b>${persone} persone</b>, il ${pc(p.quota_persone * 100)} di quelle possibili: rispondono <b>${nf(p.indice, 1)} volte</b> la media e valgono il <b>${pc(p.quota_risultati * 100)}</b> dei ${esc(M.u.plur)} possibili.</p>
      ${a ? `<p class="a-sotto">In alternativa: ${esc(a.descrizione)} (×${nf(a.indice, 1)}).</p>` : ''}
      <div class="a-gruppi">${['eta', 'genere', 'reddito', 'famiglia'].map(barre).join('')}</div>
      <p class="a-nota">Valutati tutti i tipi di persona adulta in Italia: per ognuno quanto è probabile che, vedendo l’annuncio, arrivi e ${M.u === UNITA.acquisti ? 'compri' : M.u === UNITA.download ? 'scarichi' : M.u === UNITA.iscrizioni ? 'si iscriva' : 'chieda un contatto'}. Il target è il gruppo più grande che risponde molto più della media.</p>`, 'evidenza a-luce');
  }
  // per quel target: ogni mezzo, online e offline, con lo stesso budget, e come dividere il budget
  function schedaStrategia(i, card) {
    const st = M.nuova.strategia;
    if (!st || !st.mezzi || !st.mezzi.length) return '';
    const u = M.u, mix = st.mix || [];
    const frase = mix.length ? mix.map(x => `<b>${pc(x.quota * 100)}</b> ${esc(CANALI[x.canale] || x.nome)}`).join(', ') : '';
    const righe = st.mezzi.map(x => {
      const T = x.totali, ris = M.nuova.campagna.obiettivo === 'notorieta' ? T.persone_raggiunte : M.nuova.campagna.obiettivo === 'traffico' ? T.click : T.acquisti;
      const costo = ris > 0 ? T.spesa / ris : 0;
      return `<tr class="${x.quota_budget > 0 ? 'scelto' : ''}${x.fattibile ? '' : ' no'}">
        <td><b>${esc((CANALI[x.canale] || x.nome).replace(/^./, c => c.toUpperCase()))}</b><small>${x.tipo === 'offline' ? 'offline' : 'online'}${x.selezione && x.selezione !== 'nessuna' ? ' · ' + esc(x.selezione) : ''}</small></td>
        <td>${x.quota_budget > 0 ? `<b>${pc(x.quota_budget * 100)}</b>` : '–'}</td>
        <td>${M.nuova.campagna.obiettivo === 'notorieta' ? ni(ris) + ' persone' : n1(ris) + ' ' + esc(u.plur)}<small>${costo ? eur(costo) + ' ' + (M.nuova.campagna.obiettivo === 'vendite' ? u.ogni : 'l’una') : ''}</small></td>
        <td>${pc(x.quota_target * 100)}<small>dei contatti sul target</small></td>
        <td>${x.fattibile ? (x.produzione ? `produzione ~${eur(x.produzione)}` : '') : `<span class="a-badge arancio">da ${eur(x.budget_minimo)}</span>`}</td></tr>`;
    }).join('');
    return card(i, 'La strategia per questo target', `
      <p>${frase ? `Con ${eur(st.budget)} in tutto: ${frase}.` : 'Con questo budget nessun mezzo rende abbastanza.'}</p>
      <div class="scorri"><table class="a-strat"><thead><tr><th>Mezzo</th><th>Budget</th><th>Con tutto il budget</th><th>Mira</th><th></th></tr></thead><tbody>${righe}</tbody></table></div>
      <p class="a-nota">Ogni mezzo provato con tutto il budget sulle stesse persone simulate. Online si può scegliere il target (età, genere, zona; su LinkedIn anche lavoro); TV, radio, cartelloni e giornali arrivano a chi li usa, e il risultato conta le visite indirette. La divisione tiene conto dei rendimenti decrescenti e di quanto ogni mezzo riesce a spendere. Costi offline e visite indirette sono ipotesi sul mercato italiano.</p>`, 'a-luce');
  }
  // il testo dell'annuncio giudicato dalla lettura del testo: cinque criteri, il voto entra nel simulatore come forza del messaggio
  function messaggio(i) {
    const g = contesto.messaggio;
    if (!g || M.sorgente !== 'nuova') return '';
    const f = g.forza, u = M.u, verso8 = f < 8 ? Math.exp(PESO_FORZA * (8 - f)) - 1 : 0;
    const sugg = (contesto.suggerimenti || []).slice(0, 3);
    return `<section class="a-card a-entra a-luce a-msg" style="--i:${i}"><h3>Il tuo messaggio</h3>
      <div class="a-msg-corpo">
        <div class="a-msg-voto"><b data-conta="${f}" data-f="ni">${ni(f)}</b><span>/10</span><small>${f >= 8 ? 'forte' : f >= 5 ? 'nella media' : 'debole'}</small></div>
        <div class="a-msg-crit">${Object.entries(CRITERI).map(([k, n]) => `<div><span>${n}</span><em>${[0, 1].map(x => `<i class="${g[k] > x ? 'si' : ''}"></i>`).join('')}</em></div>`).join('')}</div>
        <div class="a-msg-sugg">${verso8 > 0.01 ? `<p>Con un messaggio da 8/10: circa <b>+${pc(verso8 * 100)}</b> di click e di ${esc(u.plur)}, con lo stesso budget.</p>` : '<p>Il messaggio è già forte: il margine è nel pubblico e nel canale.</p>'}
          ${sugg.length ? `<ul class="a-azioni">${sugg.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</div>
      </div>
      <p class="a-nota">Offerta concreta, credibilità e invito all’azione sono contati sul testo; adatto al canale viene dal formato; il beneficio dalla lettura del testo. Nel modello il voto sposta la probabilità di click: da circa −26% (0/10) a +35% (10/10) rispetto a un messaggio medio (5/10).</p></section>`;
  }
  // come è fatta la creatività e quanto pesa ogni cosa su click e acquisti (stessi pesi del simulatore)
  function creativita(i) {
    const cr = M.sorgente === 'nuova' && M.nuova.creativita;
    if (!cr || !cr.effetti || !cr.effetti.length) return '';
    const e = cr.effetti.filter(x => Math.abs(x['click_%']) >= 0.5 || Math.abs(x['acquisti_%']) >= 0.5).sort((a, b) => Math.abs(b['click_%']) + Math.abs(b['acquisti_%']) - Math.abs(a['click_%']) - Math.abs(a['acquisti_%']));
    const chip = (v, n) => (Math.abs(v) < 0.5 ? '' : `<em class="${v > 0 ? 'su' : 'giu'}">${v > 0 ? '+' : '−'}${nf(Math.abs(v), Math.abs(v) < 10 ? 1 : 0)}% ${n}</em>`);
    const v = cr.visivo, tav = v && v.palette && v.palette.length ? `<div class="a-tavolozza">${v.palette.map(c => `<i style="background:${esc(c)}"></i>`).join('')}<span>${esc(v.tinta || '')}</span></div>` : '';
    return `<section class="a-card a-entra a-luce a-crea" style="--i:${i}"><h3>La tua creatività</h3>
      <p class="a-sotto">Come è fatta e quanto pesa ogni cosa su chi la vede${cr.stile ? `. Stile ${esc(cr.stile)}: piace di più ad alcuni gruppi di persone` : ''}.</p>
      ${tav}
      <ul class="a-crea-lista">${e.map(x => `<li><span>${esc(x.testo.charAt(0).toUpperCase() + x.testo.slice(1))}</span><b>${chip(x['click_%'], 'click')}${chip(x['acquisti_%'], 'acquisti')}</b></li>`).join('')}</ul>
      <p class="a-nota">Misure prese dai pixel (luce, contrasto, colori, formato, cambi di scena) e dalla lettura dell’annuncio. I pesi sono ipotesi da regole generali sulla pubblicità, non stimati sui tuoi dati.</p></section>`;
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
  /* Ispirata a «Pixel Transition» di React Bits, riscritta in canvas: lo schermo si copre di quadrati che partono dal
     punto di invio (con un lampo di colore sul fronte); mentre il motore calcola gli omini arrivano dai bordi e si
     raccolgono in uno stormo al centro, sempre più grande; alla fine fanno festa e i quadrati si dissolvono dal centro
     verso fuori, scoprendo la dashboard. Nessuna scritta. */
  function pixel(canvas, origine, verso, durata) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2), W = window.innerWidth, H = window.innerHeight;
    const lato = W < 600 ? 22 : 30, nx = Math.ceil(W / lato), ny = Math.ceil(H / lato);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = false;
    const st = getComputedStyle(document.documentElement), fondo = st.getPropertyValue('--fondo').trim() || '#FAFAF8';
    const accenti = [st.getPropertyValue('--blu').trim(), st.getPropertyValue('--verde').trim(), st.getPropertyValue('--arancio').trim(), '#8B5CF6'];
    const dmax = Math.max(...[[0, 0], [W, 0], [0, H], [W, H]].map(([x, y]) => Math.hypot(x - origine.x, y - origine.y)));
    const celle = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const cx = i * lato + lato / 2, cy = j * lato + lato / 2;
      celle.push({ x: i * lato, y: j * lato, ritardo: 0.68 * Math.hypot(cx - origine.x, cy - origine.y) / dmax + 0.22 * Math.random(),
        colore: accenti[Math.floor(Math.random() * accenti.length)] });
    }
    return new Promise(ok => {
      const t0 = performance.now();
      let fatto = false;
      const fine = () => { if (!fatto) { fatto = true; passo(t0 + durata); ok(); } };
      setTimeout(fine, durata + 120);   // se il browser rallenta i fotogrammi (scheda in secondo piano) si chiude lo stesso
      const passo = now => {
        if (fatto && now < t0 + durata) return;
        const t = Math.min(1, (now - t0) / durata);
        ctx.clearRect(0, 0, W, H);
        celle.forEach(c => {
          const k = Math.min(1, Math.max(0, (t - c.ritardo) / 0.12));   // ogni quadrato cambia in un dodicesimo del tempo
          const pieno = verso === 'copri' ? k : 1 - k;
          if (pieno <= 0) return;
          const s = Math.round(lato * pieno), o = (lato - s) / 2;
          ctx.fillStyle = k > 0 && k < 1 ? c.colore : fondo;   // sul fronte il quadrato lampeggia di colore
          ctx.globalAlpha = k > 0 && k < 1 ? 0.85 : 1;
          ctx.fillRect(c.x + o, c.y + o, s, s);
        });
        ctx.globalAlpha = 1;
        if (fatto) return;
        if (t < 1 && canvas.isConnected) requestAnimationFrame(passo); else fine();
      };
      requestAnimationFrame(passo);
    });
  }
  function transizione(lavoro, da) {
    const ov = $('#transizione'), W = window.innerWidth, H = window.innerHeight;
    const origine = da || { x: W / 2, y: H / 2 }, centro = { x: W / 2, y: H * 0.55 };
    ov.classList.remove('carico', 'rivela'); ov.hidden = false;
    const tela = nuovaTela('#tr-pixel');
    let sc = null, pt = null, regia = null;
    const coperto = pixel(tela, origine, 'copri', 650).then(() => {
      if (ov.hidden) return;
      ov.classList.add('carico');
      return window.Flock.carica().then(() => {
        const cp = nuovaTela('#tr-prato'), cf = nuovaTela('#tr-folla'), stretto = W < 600;
        const max = Math.round(W / (stretto ? 26 : 36));
        sc = window.Flock.campo(null, cf, { altezza: H, n: Math.round(max / 3), scale: stretto ? [2, 3] : [3, 4], fondo: 0.34, suolo: Math.round(H * 0.24) });
        sc.testo = '';
        pt = window.Flock.puntini(cp, { area: ov, sorgenti: () => sc.omini.map(o => sc.piedi(o)) });
        pt.onda(origine.x, origine.y, 1.2);
        const entra = () => {   // un nuovo omino arriva di corsa da un bordo
          const o = new window.Flock.Omino(Math.floor(Math.random() * (window.Flock.nomiPersonaggi().length || 100)), 0, {});
          sc.profondita(o); o.dir = Math.random() < 0.5 ? 1 : -1; o.x = o.dir > 0 ? -30 : sc.w + 30; o.vel = 60 + Math.random() * 40; o.imposta('corsa'); o.pausa = 99;
          sc.omini.push(o); sc.omini.sort((p, q) => p.dy - q.dy);
        };
        // un terzo dello stormo è già in campo, sparso; corre verso il centro mentre gli altri arrivano dai bordi
        sc.omini.forEach(o => { o.x = W * (0.08 + 0.84 * Math.random()); o.dir = o.x < centro.x ? 1 : -1; o.vel = 50 + Math.random() * 40; o.imposta('corsa'); o.pausa = 99; });
        let giro = 0;
        regia = setInterval(() => {   // lo stormo: chi è lontano corre verso il centro, chi è arrivato gira lì intorno
          giro++;
          if (sc.omini.length < max) entra();
          const raggio = Math.min(W * 0.22, 46 + 7 * sc.omini.length);
          sc.omini.forEach(o => {
            const d = o.x - centro.x;
            if (Math.abs(d) > raggio) { o.dir = d > 0 ? -1 : 1; if (o.anim !== 'corsa') { o.imposta('corsa'); o.vel = 50 + Math.random() * 40; } o.pausa = 99; }
            else if (o.anim === 'corsa') { o.imposta('camminata'); o.vel = 10 + Math.random() * 14; o.pausa = 1 + Math.random() * 3; }
            else if (o.anim === 'camminata' && Math.random() < 0.04) o.dir *= -1;
          });
          if (giro % 6 === 0 && sc.omini.length) { const o = sc.omini[Math.floor(Math.random() * sc.omini.length)]; if (o.anim !== 'corsa') o.imposta('festa', 1.1); }
        }, 140);
      });
    });
    const minimo = new Promise(r => setTimeout(r, 2300));
    const chiudi = () => { clearInterval(regia); if (pt) pt.ferma(); ov.hidden = true; ov.classList.remove('carico', 'rivela'); };
    return Promise.all([lavoro, minimo, coperto]).then(([r]) => {
      clearInterval(regia);
      if (sc) sc.omini.forEach(o => { if (o.anim !== 'corsa') o.imposta('festa', 1.3); });
      if (pt) pt.onda(centro.x, centro.y, 1.6);
      return new Promise(ok => setTimeout(() => {
        ok(r);   // la dashboard si disegna sotto, poi i quadrati la scoprono
        setTimeout(() => { ov.classList.add('rivela'); pixel(tela, centro, 'rivela', 700).then(chiudi); }, 60);
      }, 750));
    }, err => { chiudi(); throw err; });
  }
  function avvisa() {}   // la transizione non mostra testo

  /* ---------------------------------------------------------------------- API */
  function costruisci() {
    M = sorgente === 'nuova' ? daNuova(nuovaDati) : daStorico();
    const fonte = $('#a-fonte'), doppio = !!(contesto.storico && nuovaDati);
    fonte.hidden = !doppio;
    if (doppio) {
      fonte.innerHTML = [['nuova', 'Il tuo annuncio'], ['storico', 'Le tue campagne']].map(([v, n]) => `<button type="button" data-s="${v}" aria-pressed="${sorgente === v}">${n}</button>`).join('');
      $$('button', fonte).forEach(b => b.addEventListener('click', () => {
        if (sorgente === b.dataset.s) return;
        sorgente = b.dataset.s; M = null; filtroPub = 'tutti'; mostra(modo);
      }));
    }
    $('#a-titolo').textContent = sorgente === 'nuova' ? `«${M.titolo.length > 70 ? M.titolo.slice(0, 67) + '…' : M.titolo}»` : M.titolo;
    $('#a-periodo').textContent = `${giornoLungo(M.dal)} – ${giornoLungo(M.al)}`;
  }
  function apri(tipo, dati, ctx) {
    sorgente = tipo; nuovaDati = dati || null; contesto = ctx || {}; filtroPub = 'tutti'; M = null;
    contesto.domanda = contesto.domanda || domanda(contesto.prompt);   // una domanda nel prompt: la risposta va in cima
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
