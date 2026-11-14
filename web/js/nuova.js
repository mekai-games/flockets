/* «Campagna nuova»: nessun dato. La campagna descritta a parole viene simulata su tutti i tipi di persona
   e su ogni tipo di pubblico (motore Python nel browser, flockets/simulazione.py); il risultato va in analisi.js. */
window.Nuova = (function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

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
  let pronto = false;

  function formati() {
    const k = $('#nc-canale').value, prima = $('#nc-formato').value;
    const lista = CANALI[k][1];
    $('#nc-formato').innerHTML = (lista.length > 1 ? '<option value="">come dice l’annuncio</option>' : '')
      + lista.map(f => `<option value="${f}"${f === prima ? ' selected' : ''}>${FORMATI[f]}</option>`).join('');
  }
  function prepara() {
    if (pronto) return;
    pronto = true;
    $('#nc-categoria').innerHTML = '<option value="">riconosci dalla descrizione</option>' + Object.entries(CATEGORIE).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
    $('#nc-canale').innerHTML = Object.entries(CANALI).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('');
    formati();
    const domani = new Date(Date.now() + 864e5);
    $('#nc-inizio').value = domani.toISOString().slice(0, 10);
    $('#nc-canale').addEventListener('change', formati);
    $('#nc-form').addEventListener('submit', e => { e.preventDefault(); simula(); });
    if (window.Flock) Flock.carica().then(() => { new Flock.Scena($('#nc-folla'), { scala: 3, altezza: 150, suolo: 10 }).popola(9); });
  }
  function apri(testoAnnuncio) {
    prepara();
    if (testoAnnuncio && !$('#nc-annuncio').value) $('#nc-annuncio').value = testoAnnuncio;
    if (window.MotoreFlockets && MotoreFlockets.prepara) MotoreFlockets.prepara().catch(() => {});   // scarica il motore mentre si compila
  }
  function spec() {
    const num = (id, d) => { const v = parseFloat($(id).value); return Number.isFinite(v) ? v : d; };
    return {
      descrizione_prodotto: $('#nc-prodotto').value.trim(), categoria: $('#nc-categoria').value || null,
      prezzo: num('#nc-prezzo', null), sconto: num('#nc-sconto', 0) / 100, marchio: $('#nc-marchio').value, trend: num('#nc-trend', 1),
      obiettivo: $('#nc-obiettivo').value, canale: $('#nc-canale').value, formato: $('#nc-formato').value || null,
      testo_annuncio: $('#nc-annuncio').value.trim(), budget_giorno: num('#nc-budget', 100), giorni: Math.round(num('#nc-giorni', 14)),
      inizio: $('#nc-inizio').value || null,
    };
  }
  function simula() {
    const b = $('#nc-avvia'), testo = b.firstElementChild;
    b.disabled = true;
    // il pubblico non si sceglie: l'analisi prova ogni tipo di pubblico e dice qual è il migliore
    window.Analisi.transizione(MotoreFlockets.campagna(spec(), m => window.Analisi.avvisa(m))).then(d => window.Analisi.apri('nuova', d))
      .catch(err => { $('#nc-esito').innerHTML = `<p class="errore mono">${esc(String(err.message || err).split('\n').pop())}</p>`; })
      .finally(() => { b.disabled = false; testo.textContent = 'Simula e trova il pubblico migliore'; });
  }
  return { apri };
})();
