/* Account Flockets: registrazione, accesso (email o Google, Apple, GitHub, Microsoft), profilo e progetti salvati.
   Il sito funziona tutto senza account. L’account serve solo a ritrovare le proprie analisi, anche su altri dispositivi:
   da collegati ogni analisi aperta viene salvata da sola nei «Tuoi progetti».
   Dati in Supabase (tabelle profili e progetti, ognuno vede solo le sue righe). */
window.Account = (function () {
  'use strict';
  const URL_SB = 'https://zfjofmbyzxulejornexe.supabase.co';
  const CHIAVE = 'sb_publishable_PzKDIh5Mv67mXQtUiXxKog_c4ZrgzdY';   // chiave pubblica: protetta dalle regole RLS
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const memoria = {
    leggi(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    scrivi(k, v) { try { sessionStorage.setItem(k, v); return true; } catch (e) { return false; } },
    togli(k) { try { sessionStorage.removeItem(k); } catch (e) { /* niente */ } },
  };
  const DA_SALVARE = 'flockets-da-salvare', RITORNO = 'flockets-ritorno';

  const PROVIDER = [
    ['google', 'Google', '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2-1.9 3.2-4.7 3.2-8z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8l3.7-2.8z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z"/></svg>'],
    ['apple', 'Apple', '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M16.4 12.7c0-2.6 2.1-3.8 2.2-3.9a4.8 4.8 0 0 0-3.8-2c-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9a5 5 0 0 0-4.2 2.6c-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8s2 .8 3.4.8c1.4 0 2.3-1.3 3.1-2.5a11 11 0 0 0 1.4-2.9 4.5 4.5 0 0 1-2.6-4.1zM13.9 5.1A4.5 4.5 0 0 0 15 1.8a4.6 4.6 0 0 0-3 1.5 4.3 4.3 0 0 0-1.1 3.2c1.1.1 2.3-.6 3-1.4z"/></svg>'],
    ['github', 'GitHub', '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 1.5a10.5 10.5 0 0 0-3.3 20.5c.5.1.7-.2.7-.5v-1.8c-2.9.6-3.5-1.4-3.5-1.4-.5-1.2-1.2-1.5-1.2-1.5-1-.7.1-.7.1-.7 1 .1 1.6 1.1 1.6 1.1.9 1.6 2.5 1.2 3.1.9.1-.7.4-1.2.7-1.4-2.3-.3-4.8-1.2-4.8-5.2 0-1.1.4-2.1 1.1-2.8-.1-.3-.5-1.4.1-2.8 0 0 .9-.3 2.9 1.1a10 10 0 0 1 5.2 0c2-1.4 2.9-1.1 2.9-1.1.6 1.4.2 2.5.1 2.8.7.7 1.1 1.7 1.1 2.8 0 4-2.5 4.9-4.8 5.2.4.3.7 1 .7 2v2.9c0 .3.2.6.7.5A10.5 10.5 0 0 0 12 1.5z"/></svg>'],
    ['azure', 'Microsoft', '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#F25022" d="M2 2h9.5v9.5H2z"/><path fill="#7FBA00" d="M12.5 2H22v9.5h-9.5z"/><path fill="#00A4EF" d="M2 12.5h9.5V22H2z"/><path fill="#FFB900" d="M12.5 12.5H22V22h-9.5z"/></svg>'],
  ];
  const TIPI = { annuncio: 'Annuncio', storico: 'Campagne', nuova: 'Campagna nuova' };

  let sb = null, utente = null, profilo = null, attivi = [], corrente = null, salvaDopo = false;
  // le pagine aperte direttamente (#/profilo, #/q/…) aspettano che client e sessione siano pronti
  let segnalaPronto;
  const pronto = new Promise(r => { segnalaPronto = r; });

  /* ------------------------------------------------------------ errori leggibili */
  function messaggio(err) {
    const m = String((err && (err.message || err.error_description)) || err || '');
    if (/invalid login credentials/i.test(m)) return 'Email o password sbagliate.';
    if (/already registered|already been registered|user_already_exists/i.test(m)) return 'Esiste già un account con questa email: accedi.';
    if (/password.*(at least|should|weak)|weak_password/i.test(m)) return 'La password deve avere almeno 8 caratteri, con lettere e numeri.';
    if (/email not confirmed/i.test(m)) return 'Conferma prima l’email: ti abbiamo mandato un link.';
    if (/not authorized|email address.*invalid|invalid.*email/i.test(m)) return 'Non riesco a mandare email a questo indirizzo. Controlla che sia scritto bene.';
    if (/rate limit|too many|seconds/i.test(m)) return 'Troppi tentativi ravvicinati: riprova tra un minuto.';
    if (/fetch|network/i.test(m)) return 'Non riesco a collegarmi. Controlla la connessione.';
    return m || 'Qualcosa è andato storto. Riprova.';
  }
  const nomeDi = () => (profilo && profilo.nome) || (utente && (utente.user_metadata.full_name || utente.user_metadata.name)) || (utente ? utente.email.split('@')[0] : '');
  const iniziali = () => nomeDi().split(/[\s._-]+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('') || '?';

  /* ------------------------------------------------------------ bottoni in alto */
  function posti() {
    // in ogni intestazione: prima del bottone del tema, o in fondo
    $$('header.nav, .barra-dx, header.barra').forEach(h => {
      if ($('.account-posto', h)) return;
      const s = document.createElement('span');
      s.className = 'account-posto';
      const dove = h.matches('header.nav:not(.chiara)') ? $('.pulsante.bianco', h) : null;
      const nav = $('.nav-link', h);
      if (dove) {   // home: «Accedi» accanto a GitHub, in un gruppo solo, così il menu resta al centro
        const g = document.createElement('div'); g.className = 'nav-dx';
        h.insertBefore(g, dove); g.append(s, dove);
      }
      else if (nav) nav.appendChild(s);
      else h.appendChild(s);
    });
    aggiornaBottoni();
  }
  function aggiornaBottoni() {
    const avatar = utente && (utente.user_metadata.avatar_url || utente.user_metadata.picture);
    $$('.account-posto').forEach(s => {
      s.innerHTML = utente
        ? `<a class="account-io" href="#/profilo" title="Il tuo profilo e i tuoi progetti" aria-label="Profilo di ${esc(nomeDi())}">${
          avatar ? `<img src="${esc(avatar)}" alt="" referrerpolicy="no-referrer">` : esc(iniziali())}</a>`
        : '<button type="button" class="account-accedi">Accedi</button>';
    });
  }

  /* ------------------------------------------------------------ finestra di accesso */
  function finestra() {
    let d = $('#d-account');
    if (d) return d;
    d = document.createElement('dialog');
    d.id = 'd-account'; d.className = 'finestra'; d.setAttribute('aria-labelledby', 'dc-titolo');
    document.body.appendChild(d);
    d.addEventListener('click', e => { if (e.target === d) d.close(); });   // clic fuori dal riquadro
    d.addEventListener('close', () => { salvaDopo = false; });
    return d;
  }
  function apriAccesso(modo = 'accedi', o = {}) {
    if (!sb) return;
    salvaDopo = !!o.salva;
    const d = finestra();
    disegnaAccesso(modo, o.email || '');
    if (!d.open) d.showModal();
    const primo = $('input', d); if (primo) primo.focus();
  }
  function disegnaAccesso(modo, email) {
    const d = finestra();
    const testi = {
      accedi: ['Accedi', 'Ritrovi i tuoi progetti su ogni dispositivo. Il resto del sito funziona anche senza account.', 'Accedi'],
      registrati: ['Crea un account', 'Serve solo a ritrovare le tue analisi, anche su altri dispositivi. Tutto il resto funziona anche senza.', 'Crea l’account'],
      recupero: ['Password dimenticata', 'Scrivi la tua email: ti mandiamo un link per sceglierne una nuova.', 'Mandami il link'],
      nuova: ['Nuova password', 'Scegli la nuova password: almeno 8 caratteri, con lettere e numeri.', 'Salva la password'],
    }[modo];
    const social = (modo === 'accedi' || modo === 'registrati') && attivi.length;
    d.innerHTML = `
      <button type="button" class="chiudi" aria-label="Chiudi">✕</button>
      <svg class="dc-marchio" width="30" height="30" aria-hidden="true"><use href="#marchio"/></svg>
      <h2 id="dc-titolo">${testi[0]}</h2>
      <p class="tenue">${testi[1]}</p>
      ${salvaDopo && (modo === 'accedi' || modo === 'registrati') ? '<p class="dc-nota">L’analisi che hai aperto viene salvata appena entri.</p>' : ''}
      ${social ? `<div class="dc-social">${PROVIDER.filter(p => attivi.includes(p[0])).map(([id, nome, icona]) =>
        `<button type="button" class="pulsante bordo" data-provider="${id}">${icona}<span>Continua con ${nome}</span></button>`).join('')}</div>
        <p class="dc-oppure mono"><span>oppure con l’email</span></p>` : ''}
      <form class="dc-form" novalidate>
        ${modo === 'registrati' ? '<label>Nome <input name="nome" autocomplete="name" maxlength="80" placeholder="Come ti chiami"></label>' : ''}
        ${modo !== 'nuova' ? `<label>Email <input name="email" type="email" autocomplete="email" required value="${esc(email)}" placeholder="nome@esempio.it"></label>` : ''}
        ${modo !== 'recupero' ? `<label>Password <input name="password" type="password" required minlength="8" autocomplete="${modo === 'accedi' ? 'current-password' : 'new-password'}" placeholder="${modo === 'accedi' ? '' : 'Almeno 8 caratteri, lettere e numeri'}"></label>` : ''}
        <p class="dc-errore" role="alert" aria-live="assertive"></p>
        <button type="submit" class="pulsante nero">${testi[2]}</button>
      </form>
      <p class="dc-link">${{
        accedi: '<button type="button" class="testo-link" data-modo="recupero">Password dimenticata?</button><span>Non hai un account? <button type="button" class="testo-link" data-modo="registrati">Registrati</button></span>',
        registrati: '<span>Hai già un account? <button type="button" class="testo-link" data-modo="accedi">Accedi</button></span>',
        recupero: '<button type="button" class="testo-link" data-modo="accedi">← Torna all’accesso</button>',
        nuova: '',
      }[modo]}</p>
      ${modo === 'registrati' || modo === 'accedi' ? '<p class="dc-legale">Continuando accetti i <a href="termini.html" target="_blank" rel="noopener">termini di servizio</a> e l’<a href="privacy.html" target="_blank" rel="noopener">informativa sulla privacy</a>.</p>' : ''}`;
    $('.chiudi', d).addEventListener('click', () => d.close());
    $$('[data-modo]', d).forEach(b => b.addEventListener('click', () => {
      const em = $('input[name=email]', d);
      disegnaAccesso(b.dataset.modo, em ? em.value : '');
      const primo = $('input', d); if (primo) primo.focus();
    }));
    $$('[data-provider]', d).forEach(b => b.addEventListener('click', () => conProvider(b.dataset.provider, b)));
    $('form', d).addEventListener('submit', e => { e.preventDefault(); invia(modo, e.target); });
  }
  function errore(form, testo) { $('.dc-errore', form).textContent = testo || ''; }
  function occupato(form, si) { const b = $('button[type=submit]', form); b.disabled = si; b.classList.toggle('attesa', si); }

  async function invia(modo, form) {
    const v = n => (form.elements[n] ? form.elements[n].value.trim() : '');
    const email = v('email'), password = form.elements.password ? form.elements.password.value : '';
    if (modo !== 'nuova' && !/^\S+@\S+\.\S+$/.test(email)) return errore(form, 'Scrivi un indirizzo email valido.');
    if (modo !== 'recupero' && password.length < 8 && modo !== 'accedi') return errore(form, 'La password deve avere almeno 8 caratteri, con lettere e numeri.');
    if (modo === 'accedi' && !password) return errore(form, 'Scrivi la password.');
    errore(form, ''); occupato(form, true);
    try {
      if (modo === 'accedi') {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        finestra().close();
      } else if (modo === 'registrati') {
        const nome = v('nome');
        const { data, error } = await sb.auth.signUp({ email, password, options: { data: nome ? { full_name: nome } : {}, emailRedirectTo: indirizzo() } });
        if (error) throw error;
        if (data.session) finestra().close();
        else fatto('Controlla l’email', `Ti abbiamo mandato un link a <b>${esc(email)}</b>: aprilo per attivare l’account.`);
      } else if (modo === 'recupero') {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: indirizzo() });
        if (error) throw error;
        fatto('Controlla l’email', `Se esiste un account con <b>${esc(email)}</b>, ti arriva un link per scegliere una nuova password.`);
      } else if (modo === 'nuova') {
        const { error } = await sb.auth.updateUser({ password });
        if (error) throw error;
        fatto('Password cambiata', 'Da adesso entri con la nuova password.');
      }
    } catch (err) {
      errore(form, messaggio(err));
    } finally {
      if (form.isConnected) occupato(form, false);
    }
  }
  function fatto(titolo, testo) {
    const d = finestra();
    d.innerHTML = `<button type="button" class="chiudi" aria-label="Chiudi">✕</button>
      <svg class="dc-marchio" width="30" height="30" aria-hidden="true"><use href="#marchio"/></svg>
      <h2 id="dc-titolo">${titolo}</h2><p class="tenue">${testo}</p>
      <button type="button" class="pulsante nero dc-ok">Ok</button>`;
    $('.chiudi', d).addEventListener('click', () => d.close());
    $('.dc-ok', d).addEventListener('click', () => d.close());
    $('.dc-ok', d).focus();
  }
  // dove tornare dopo il link nell'email o il giro dal provider: la pagina, senza #, il resto lo rimette ritorno()
  const indirizzo = () => location.origin + location.pathname;
  async function conProvider(id, bottone) {
    // dopo il giro dal provider la pagina si ricarica: l'analisi aperta non c'è più, ma resta da salvare (sessionStorage)
    memoria.scrivi(RITORNO, /^#\/analisi/.test(location.hash) || salvaDopo ? '#/profilo' : location.hash || '#/');
    bottone.disabled = true;
    const { error } = await sb.auth.signInWithOAuth({ provider: id, options: { redirectTo: indirizzo() } });
    if (error) { bottone.disabled = false; errore($('.dc-form', finestra()), messaggio(error)); }
  }

  /* ------------------------------------------------------------ salvataggio dei progetti */
  // ogni analisi aperta diventa un progetto: da collegati si salva subito, se no resta pronta per quando si entra
  function dopoApertura(tipo, risultato, ctx) {
    corrente = null;
    setTimeout(async () => {   // titolo e periodo li scrive analisi.js quando disegna la vista
      // il titolo è il testo scritto (intero), se no quello che mostra la vista
      const titolo = (ctx.prompt || $('#a-titolo').textContent || ctx.fonte || 'Analisi').replace(/^«|»$/g, '').trim().slice(0, 200) || 'Analisi';
      const periodo = $('#a-periodo').textContent || '';
      const ist = window.Flk ? window.Flk.istantanea() : {};
      if (!(tipo === 'storico' || ctx.storico)) ist.storico = null;
      const riga = {
        tipo, titolo, fonte: (ctx.fonte || '').slice(0, 300) || null,
        riassunto: { periodo },
        dati: { versione: 1, tipo, risultato: risultato || null, ctx, ist },
      };
      corrente = { riga, id: null };
      if (utente) await salva(corrente);
      else { memoria.scrivi(DA_SALVARE, JSON.stringify(riga)); spia(); }
    }, 350);
  }
  async function salva(c) {
    spia('salvo');
    const { data, error } = await sb.from('progetti').insert(c.riga).select('id').single();
    if (error) { console.warn('Flockets: progetto non salvato', error); spia('errore'); return; }
    c.id = data.id;
    memoria.togli(DA_SALVARE);
    spia();
  }
  // la spia nella barra dell'analisi: salvato, o «accedi per salvare»
  function spia(stato) {
    const barra = $('#v-analisi .barra-dx');
    if (!barra) return;
    let s = $('.salvataggio', barra);
    if (!s) { s = document.createElement('span'); s.className = 'salvataggio mono'; barra.insertBefore(s, barra.firstChild); }
    if (!corrente) { s.hidden = true; return; }
    s.hidden = false;
    if (stato === 'salvo') s.innerHTML = 'Salvo…';
    else if (stato === 'errore') s.innerHTML = '<button type="button" class="testo-link">Non salvato · riprova</button>';
    else if (corrente.condiviso) s.innerHTML = `Dal portachiavi ${esc(corrente.condiviso)}`;
    else if (corrente.id) s.innerHTML = '<a href="#/profilo">✓ Nei tuoi progetti</a>';
    else s.innerHTML = '<button type="button" class="testo-link">Accedi per salvarla</button>';
    const b = $('button', s);
    if (b) b.addEventListener('click', () => (utente ? salva(corrente) : apriAccesso('accedi', { salva: true })));
  }

  // riapre un progetto salvato così com'era, senza ricalcolare e senza salvarne una copia
  async function apriDati(riga, condiviso) {
    const p = riga.dati;
    await window.Flk.ripristina(p.ist || {});
    corrente = { id: riga.id, riga: null, condiviso: condiviso || null };
    window.Analisi.apri(p.tipo || riga.tipo, p.risultato, Object.assign({}, p.ctx, { progetto: riga.id }));
    setTimeout(() => spia(), 400);
  }
  async function apriProgetto(id, bottone) {
    if (bottone) { bottone.disabled = true; bottone.textContent = 'Apro…'; }
    try {
      const { data, error } = await sb.from('progetti').select('id, tipo, titolo, dati').eq('id', id).single();
      if (error) throw error;
      await apriDati(data);
    } catch (err) {
      if (bottone) { bottone.disabled = false; bottone.textContent = 'Apri'; }
      alert('Non riesco ad aprire il progetto. ' + messaggio(err));
    }
  }

  /* ------------------------------------------------------------ portachiavi (QR) */
  // #/q/CODICE: se il codice è collegato apre il progetto a chiunque; se è libero, chi ha un account lo collega
  let qrInCorso = null;
  async function mostraQr(codice) {
    const el = $('#qr-corpo');
    if (!el) return;
    await pronto;
    codice = String(codice || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
    qrInCorso = codice;
    if (!sb) { el.innerHTML = '<p class="tenue">Il servizio non è disponibile in questo momento. Riprova tra poco.</p>'; return; }
    el.innerHTML = '<p class="tenue qr-attesa">Apro il portachiavi…</p>';
    const { data, error } = await sb.rpc('apri_qr', { p_codice: codice });
    if (qrInCorso !== codice) return;   // nel frattempo è stato inquadrato un altro codice
    if (error) { el.innerHTML = `<p class="errore">${esc(messaggio(error))}</p>`; return; }
    if (data.stato === 'collegato') {
      // la pagina del codice non resta nella cronologia: «indietro» non lo riapre all'infinito
      history.replaceState(null, '', location.pathname + '#/');
      try { await apriDati(data.progetto, data.mio ? null : codice); }
      catch (err) { el.innerHTML = `<p class="errore">Non riesco ad aprire il progetto. ${esc(messaggio(err))}</p>`; history.replaceState(null, '', location.pathname + '#/q/' + codice); }
      return;
    }
    if (data.stato !== 'libero') {
      el.innerHTML = `<p class="mono etichetta-m">■ Portachiavi</p><h2>Codice non trovato</h2>
        <p class="intro">Il codice <b class="mono">${esc(codice || '—')}</b> non corrisponde a nessun portachiavi Flockets. Controlla di aver inquadrato bene il QR.</p>
        <p><a class="pulsante bordo" href="#/">Vai a Flockets</a></p>`;
      return;
    }
    const testa = `<p class="mono etichetta-m">■ Portachiavi ${esc(codice)}</p><h2>Collega questo portachiavi a un progetto</h2>
      <p class="intro">Questo portachiavi non è ancora collegato. Scegli uno dei tuoi progetti: da quel momento chiunque inquadri il QR vedrà quel progetto, anche senza account.</p>`;
    if (!utente) {
      el.innerHTML = testa + `<div class="azioni-sx"><button type="button" class="pulsante nero" data-modo="accedi">Accedi per collegarlo</button><button type="button" class="pulsante bordo" data-modo="registrati">Crea un account</button></div>`;
      $$('[data-modo]', el).forEach(b => b.addEventListener('click', () => apriAccesso(b.dataset.modo)));
      return;
    }
    const { data: lista, error: e2 } = await sb.from('progetti').select('id, tipo, titolo, fonte, riassunto, creato').order('creato', { ascending: false }).limit(200);
    if (qrInCorso !== codice) return;
    if (e2) { el.innerHTML = testa + `<p class="errore">${esc(messaggio(e2))}</p>`; return; }
    if (!lista.length) {
      el.innerHTML = testa + `<p class="tenue pr-nessuno">Non hai ancora progetti. Fai un’analisi da collegato: si salva da sola. Poi inquadra di nuovo il portachiavi.</p>
        <p><a class="pulsante nero" href="#/console">Fai un’analisi</a></p>`;
      return;
    }
    const quando = t => new Date(t).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
    el.innerHTML = testa + `<ul class="pr-lista">${lista.map(p => `
      <li data-id="${p.id}">
        <div class="pr-info">
          <span class="pr-tipo mono">${esc(TIPI[p.tipo] || p.tipo)}</span>
          <b class="pr-titolo">${esc(p.titolo)}</b>
          <span class="tenue pr-meta">${[p.fonte, p.riassunto && p.riassunto.periodo, quando(p.creato)].filter(Boolean).map(esc).join(' · ')}</span>
        </div>
        <div class="pr-bottoni"><button type="button" class="pulsante nero">Collega qui</button></div>
      </li>`).join('')}</ul>`;
    $$('.pr-lista button', el).forEach(b => b.addEventListener('click', async () => {
      const li = b.closest('li'), titolo = $('.pr-titolo', li).textContent;
      if (!confirm(`Collegare il portachiavi ${codice} a «${titolo}»? Chiunque lo inquadri vedrà questo progetto. Potrai scollegarlo dal tuo profilo.`)) return;
      b.disabled = true; b.textContent = 'Collego…';
      const { error: e3 } = await sb.rpc('collega_qr', { p_codice: codice, p_progetto: li.dataset.id });
      if (e3) { b.disabled = false; b.textContent = 'Collega qui'; alert('Non sono riuscito a collegarlo. ' + messaggio(e3)); return; }
      mostraQr(codice);   // adesso è collegato: si apre il progetto
    }));
  }

  /* ------------------------------------------------------------ profilo */
  async function mostraProfilo() {
    const el = $('#profilo-corpo');
    if (!el) return;
    await pronto;
    if (!sb) { el.innerHTML = '<p class="tenue">L’account non è disponibile in questo momento.</p>'; return; }
    if (!utente) {
      el.innerHTML = `<div class="pr-vuoto">
        <p class="mono etichetta-m">■ Il tuo account</p>
        <h2>I tuoi progetti, su ogni dispositivo</h2>
        <p class="intro">Con un account ogni analisi che apri resta salvata: la ritrovi qui, dal computer o dal telefono. Tutto il resto del sito funziona anche senza.</p>
        <div class="azioni-sx"><button type="button" class="pulsante nero" data-modo="registrati">Crea un account</button><button type="button" class="pulsante bordo" data-modo="accedi">Accedi</button></div>
      </div>`;
      $$('[data-modo]', el).forEach(b => b.addEventListener('click', () => apriAccesso(b.dataset.modo)));
      return;
    }
    const provider = (utente.app_metadata.providers || [utente.app_metadata.provider]).filter(Boolean);
    const conEmail = provider.includes('email');
    const nomeP = { email: 'email e password', google: 'Google', apple: 'Apple', github: 'GitHub', azure: 'Microsoft' };
    el.innerHTML = `
      <p class="mono etichetta-m">■ Il tuo account</p>
      <h2>Ciao${nomeDi() ? ', ' + esc(nomeDi()) : ''}</h2>
      <p class="tenue">${esc(utente.email)} · entri con ${provider.map(p => nomeP[p] || p).join(', ')}</p>

      <section class="pr-blocco" aria-labelledby="pr-prog-t">
        <div class="pr-testa"><h3 id="pr-prog-t">I tuoi progetti</h3><a class="pulsante bordo" href="#/console">Nuova analisi</a></div>
        <div id="pr-progetti" aria-live="polite"><p class="tenue">Carico i progetti…</p></div>
      </section>

      <section class="pr-blocco" aria-labelledby="pr-dati-t">
        <h3 id="pr-dati-t">Profilo</h3>
        <form class="pr-form" id="pr-dati">
          <label>Nome <input name="nome" maxlength="80" autocomplete="name" value="${esc((profilo && profilo.nome) || '')}"></label>
          <label>Azienda <input name="azienda" maxlength="120" autocomplete="organization" value="${esc((profilo && profilo.azienda) || '')}" placeholder="facoltativa"></label>
          <div class="pr-azioni"><button type="submit" class="pulsante nero">Salva</button><span class="pr-esito mono" role="status"></span></div>
        </form>
        ${conEmail ? `<form class="pr-form" id="pr-password">
          <label>Nuova password <input name="password" type="password" minlength="8" autocomplete="new-password" placeholder="Almeno 8 caratteri, lettere e numeri"></label>
          <div class="pr-azioni"><button type="submit" class="pulsante bordo">Cambia password</button><span class="pr-esito mono" role="status"></span></div>
        </form>` : ''}
      </section>

      <section class="pr-blocco pr-fondo">
        <button type="button" class="pulsante bordo" id="pr-esci">Esci</button>
        <button type="button" class="testo-link pr-elimina" id="pr-elimina">Elimina l’account e tutti i progetti</button>
      </section>
      <p class="tenue pr-legale"><a href="privacy.html">Privacy</a> · <a href="termini.html">Termini di servizio</a></p>`;
    $('#pr-dati').addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.target, esito = $('.pr-esito', f);
      const nuovo = { nome: f.elements.nome.value.trim() || null, azienda: f.elements.azienda.value.trim() || null };
      esito.textContent = 'Salvo…';
      const { data, error } = await sb.from('profili').update(nuovo).eq('id', utente.id).select().single();
      if (error) { esito.textContent = messaggio(error); return; }
      profilo = data; esito.textContent = 'Salvato ✓'; aggiornaBottoni();
      $('#profilo-corpo h2').textContent = 'Ciao' + (nomeDi() ? ', ' + nomeDi() : '');
    });
    if (conEmail) $('#pr-password').addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.target, esito = $('.pr-esito', f), pw = f.elements.password.value;
      if (pw.length < 8) { esito.textContent = 'Almeno 8 caratteri, con lettere e numeri.'; return; }
      esito.textContent = 'Salvo…';
      const { error } = await sb.auth.updateUser({ password: pw });
      esito.textContent = error ? messaggio(error) : 'Password cambiata ✓';
      if (!error) f.reset();
    });
    $('#pr-esci').addEventListener('click', () => esci());
    $('#pr-elimina').addEventListener('click', async () => {
      if (!confirm('Eliminare l’account? Si cancellano il profilo e tutti i progetti salvati, e non si può tornare indietro.')) return;
      const { error } = await sb.rpc('elimina_account');
      if (error) { alert('Non sono riuscito a eliminare l’account. ' + messaggio(error)); return; }
      await sb.auth.signOut({ scope: 'local' });
      location.hash = '#/';
    });
    elencoProgetti();
  }
  async function elencoProgetti() {
    const box = $('#pr-progetti');
    if (!box) return;
    const [{ data, error }, { data: codici }] = await Promise.all([
      sb.from('progetti').select('id, tipo, titolo, fonte, riassunto, creato').order('creato', { ascending: false }).limit(200),
      sb.from('qr').select('codice, progetto'),
    ]);
    if (error) { box.innerHTML = `<p class="errore">${esc(messaggio(error))}</p>`; return; }
    const qrDi = id => (codici || []).filter(q => q.progetto === id).map(q => q.codice);
    if (!data.length) {
      box.innerHTML = '<p class="tenue pr-nessuno">Ancora nessun progetto. Ogni analisi che apri da collegato finisce qui da sola.</p>';
      return;
    }
    const quando = t => new Date(t).toLocaleString('it-IT', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    box.innerHTML = `<ul class="pr-lista">${data.map(p => `
      <li data-id="${p.id}">
        <div class="pr-info">
          <span class="pr-tipo mono">${esc(TIPI[p.tipo] || p.tipo)}</span>
          <b class="pr-titolo">${esc(p.titolo)}</b>
          <span class="tenue pr-meta">${[p.fonte, p.riassunto && p.riassunto.periodo, quando(p.creato)].filter(Boolean).map(esc).join(' · ')}</span>
          ${qrDi(p.id).map(c => `<span class="pr-qr mono">Portachiavi ${esc(c)} <button type="button" class="testo-link" data-fai="scollega" data-codice="${esc(c)}">scollega</button></span>`).join('')}
        </div>
        <div class="pr-bottoni">
          <button type="button" class="pulsante nero" data-fai="apri">Apri</button>
          <button type="button" class="testo-link" data-fai="rinomina">Rinomina</button>
          <button type="button" class="testo-link" data-fai="elimina">Elimina</button>
        </div>
      </li>`).join('')}</ul>`;
    $$('[data-fai]', box).forEach(b => b.addEventListener('click', async () => {
      const li = b.closest('li'), id = li.dataset.id;
      if (b.dataset.fai === 'apri') return apriProgetto(id, b);
      if (b.dataset.fai === 'rinomina') {
        const t = prompt('Nuovo nome del progetto', $('.pr-titolo', li).textContent);
        if (!t || !t.trim()) return;
        const { error } = await sb.from('progetti').update({ titolo: t.trim().slice(0, 200) }).eq('id', id);
        if (error) alert(messaggio(error)); else $('.pr-titolo', li).textContent = t.trim().slice(0, 200);
        return;
      }
      if (b.dataset.fai === 'scollega') {
        if (!confirm(`Scollegare il portachiavi ${b.dataset.codice}? Chi lo inquadra non vedrà più questo progetto, e il portachiavi si potrà collegare a un altro.`)) return;
        const { error } = await sb.rpc('scollega_qr', { p_codice: b.dataset.codice });
        if (error) alert(messaggio(error)); else elencoProgetti();
        return;
      }
      const legati = qrDi(id);
      if (!confirm(legati.length ? `Eliminare questo progetto? È collegato al portachiavi ${legati.join(', ')}: chi lo inquadra non vedrà più niente.` : 'Eliminare questo progetto?')) return;
      const { error } = await sb.from('progetti').delete().eq('id', id);
      if (error) alert(messaggio(error)); else { li.remove(); if (!$('.pr-lista li', box)) elencoProgetti(); }
    }));
  }
  async function esci() {
    await sb.auth.signOut({ scope: 'local' });
    if (location.hash === '#/profilo') mostraProfilo();
  }

  /* ------------------------------------------------------------ sessione */
  async function caricaProfilo() {
    if (!utente) { profilo = null; return; }
    const { data } = await sb.from('profili').select('nome, azienda').eq('id', utente.id).maybeSingle();
    profilo = data || null;
  }
  async function cambioSessione(evento, sessione) {
    const prima = utente && utente.id;
    utente = sessione ? sessione.user : null;
    if ((utente && utente.id) !== prima || evento === 'USER_UPDATED') await caricaProfilo();
    aggiornaBottoni();
    if (evento === 'PASSWORD_RECOVERY') { apriAccesso('nuova'); }
    if (utente && evento === 'SIGNED_IN') {
      // un'analisi aperta prima di entrare (anche prima del giro dal provider): adesso si salva
      const pronta = corrente && !corrente.id && corrente.riga ? corrente : (memoria.leggi(DA_SALVARE) ? { riga: JSON.parse(memoria.leggi(DA_SALVARE)), id: null } : null);
      if (pronta) { corrente = corrente || pronta; await salva(pronta); }
      if (salvaDopo) finestra().close();
    }
    if (document.body.dataset.vista === 'profilo') mostraProfilo();
    if (document.body.dataset.vista === 'qr' && utente && evento === 'SIGNED_IN') mostraQr(qrInCorso);
    spia();
  }
  function ritorno() {
    // dopo il link dell'email o il provider l'indirizzo ha ?code=…: si pulisce e si torna dove si era
    const u = new URL(location.href);
    const errore = u.searchParams.get('error_description');
    if (u.searchParams.has('code') || errore) {
      const dove = memoria.leggi(RITORNO) || '#/profilo';
      memoria.togli(RITORNO);
      history.replaceState(null, '', u.pathname + dove);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      if (errore) setTimeout(() => { apriAccesso('accedi'); $('.dc-errore', finestra()).textContent = messaggio(errore); }, 300);
    }
  }

  async function inizia() {
    if (!window.supabase || !window.supabase.createClient) { posti(); segnalaPronto(); return; }   // senza la libreria il sito va lo stesso
    sb = window.supabase.createClient(URL_SB, CHIAVE, { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    posti();
    document.addEventListener('click', e => { if (e.target.closest('.account-accedi')) apriAccesso('accedi'); });
    // quali provider sono attivi nel progetto: si mostrano solo quelli
    fetch(URL_SB + '/auth/v1/settings', { headers: { apikey: CHIAVE } }).then(r => r.json())
      .then(s => { attivi = PROVIDER.map(p => p[0]).filter(id => s.external && s.external[id]); })
      .catch(() => { attivi = []; });
    // ogni analisi aperta (annuncio, file, campagna nuova) passa da Analisi.apri: lì nasce il progetto
    const apri0 = window.Analisi.apri;
    window.Analisi.apri = function (tipo, dati, ctx) {
      const r = apri0.apply(this, arguments);
      if (!(ctx && ctx.progetto)) dopoApertura(tipo, dati, ctx || {});
      return r;
    };
    sb.auth.onAuthStateChange((evento, sessione) => { setTimeout(() => cambioSessione(evento, sessione), 0); });
    const { data: inizio } = await sb.auth.getSession();
    utente = inizio && inizio.session ? inizio.session.user : utente;
    segnalaPronto();
    ritorno();
    window.addEventListener('hashchange', () => { if (!/^#\/analisi/.test(location.hash)) return; setTimeout(() => spia(), 50); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inizia); else inizia();
  return { apriAccesso, mostraProfilo, mostraQr, apriProgetto, esci, get utente() { return utente; } };
})();
