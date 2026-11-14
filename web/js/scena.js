/* Scena con gli omini: legge l'atlante dei personaggi e li fa camminare, esultare, dormire. */
(function () {
  'use strict';
  const F = 48; // lato del fotogramma
  const ANIM = {
    fermo: { r: 0, ms: [360, 160, 360, 160] },
    camminata: { r: 1, ms: [130, 130, 130, 130] },
    corsa: { r: 2, ms: [85, 85, 85, 85, 85, 85] },
    salto: { r: 3, ms: [100, 140, 160, 140, 100] },
    chiacchiere: { r: 4, ms: [120, 120, 120, 120] },
    festa: { r: 5, ms: [90, 120, 120, 100, 160] },
    paura: { r: 6, ms: [70, 70, 70, 70] },
    sonno: { r: 7, ms: [650, 750] },
  };
  let atlante = null, sagome = null, meta = null, pronto = null, cima = [];
  // sagome dei personaggi tinte di un colore, una volta sola per colore: servono per il perimetro degli omini
  const tinte = new Map();
  function tinta(colore) {
    if (!tinte.has(colore)) {
      const c = document.createElement('canvas'); c.width = atlante.width; c.height = atlante.height;
      const g = c.getContext('2d');
      g.drawImage(atlante, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = colore; g.fillRect(0, 0, c.width, c.height);
      tinte.set(colore, c);
    }
    return tinte.get(colore);
  }
  const fermaTutto = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function carica() {
    if (pronto) return pronto;
    pronto = Promise.all([
      new Promise((ok, ko) => { const im = new Image(); im.onload = () => ok(im); im.onerror = ko; im.src = 'assets/personaggi.png'; }),
      fetch('assets/personaggi.json').then(r => r.json()),
    ]).then(([im, m]) => {
      atlante = im; meta = m;
      // sagome bianche dei personaggi: servono per il contorno chiaro sugli sfondi scuri
      sagome = document.createElement('canvas'); sagome.width = im.width; sagome.height = im.height;
      const c = sagome.getContext('2d');
      c.drawImage(im, 0, 0);
      // dove comincia la testa di ogni personaggio (prima riga piena del primo fotogramma): il segnalino ci va sopra
      try {
        const px = c.getImageData(0, 0, im.width, im.height).data;
        cima = m.nomi.map((n, id) => {
          const sx = (id % m.colonne) * m.foglio[0], sy = Math.floor(id / m.colonne) * m.foglio[1];
          for (let y = 0; y < F; y++) for (let x = 0; x < F; x++) if (px[((sy + y) * im.width + sx + x) * 4 + 3] > 40) return y;
          return 19;
        });
      } catch (e) { cima = []; }
      c.globalCompositeOperation = 'source-in'; c.fillStyle = '#fff'; c.fillRect(0, 0, im.width, im.height);
      return m;
    });
    return pronto;
  }

  class Omino {
    constructor(id, x, o = {}) {
      this.id = id; this.x = x; this.dy = o.dy || 0;
      this.dir = Math.random() < 0.5 ? -1 : 1;
      this.vel = o.vel || 16 + Math.random() * 22;
      this.anim = 'camminata'; this.f = Math.floor(Math.random() * 4); this.t = Math.random() * 120;
      this.timer = 0; this.dorme = false; this.pausa = 2 + Math.random() * 8;
      this.s = o.scala || 0; this.a = o.alfa == null ? 1 : o.alfa; this.fisso = !!o.fisso;
      if (this.fisso) { this.anim = 'fermo'; this.timer = 1 + Math.random() * 6; }
    }
    imposta(anim, durata) {
      if (this.anim !== anim) { this.anim = anim; this.f = 0; this.t = 0; }
      this.timer = durata || 0;
    }
    aggiorna(dt, sc) {
      const a = ANIM[this.anim];
      this.t += dt * 1000;
      while (this.t >= a.ms[this.f]) { this.t -= a.ms[this.f]; this.f = (this.f + 1) % a.ms.length; }
      if (this.bloccato) return;
      if (this.fisso) {
        this.timer -= dt;
        if (this.timer <= 0) {
          const r = Math.random();
          if (this.anim !== 'fermo') this.imposta('fermo', 2 + Math.random() * 7);
          else if (r < 0.55) this.imposta('chiacchiere', 1.2 + Math.random() * 2);
          else if (r < 0.75) this.imposta('festa', 1.1);
          else { this.dir *= -1; this.imposta('fermo', 2 + Math.random() * 5); this.timer = 2 + Math.random() * 5; }
        }
        return;
      }
      if (this.anim === 'camminata' || this.anim === 'corsa') {
        this.x += this.dir * (this.anim === 'corsa' ? this.vel * 2.4 : this.vel) * dt;
        if (sc.avvolgi) {
          const m = 24 * (this.s || sc.S) + 8;   // mezzo personaggio oltre il bordo: è uscito del tutto
          if (this.x < -m || this.x > sc.w + m) {
            if (sc.ricambio) sc.ricambia(this, m);
            else this.x = this.x < -m ? sc.w + m : -m;
          }
        } else {
          if (this.x < sc.margine) { this.x = sc.margine; this.dir = 1; }
          if (this.x > sc.w - sc.margine) { this.x = sc.w - sc.margine; this.dir = -1; }
        }
        this.pausa -= dt;
        if (this.pausa <= 0) {
          this.pausa = 4 + Math.random() * 10;
          const r = Math.random();
          if (this.allegro && r < 0.45) this.imposta('festa', 1.15);
          else if (r < 0.4) this.imposta('fermo', 1 + Math.random() * 1.6);
          else if (r < 0.7) this.imposta('chiacchiere', 1.2 + Math.random() * 1.5);
          else if (!sc.avvolgi) this.dir *= -1;
        }
      } else if (this.timer > 0) {
        this.timer -= dt;
        if (this.timer <= 0) this.imposta(this.dorme ? 'sonno' : 'camminata');
      }
    }
    disegna(ctx, S0, suolo, sc) {
      const a = ANIM[this.anim], S = this.s || S0;
      const sx = (this.id % meta.colonne) * meta.foglio[0] + this.f * F;
      const sy = Math.floor(this.id / meta.colonne) * meta.foglio[1] + a.r * F;
      const x = Math.round(this.x), y = Math.round(suolo + this.dy - 46 * S);
      ctx.globalAlpha = this.a;
      if (sc.ombra) { ctx.fillStyle = 'rgba(14,15,18,.10)'; ctx.fillRect(x - 5 * S, Math.round(suolo + this.dy - S), 10 * S, 2 * S); }
      const giro = this.dir < 0;
      if (giro) { ctx.save(); ctx.translate(x, 0); ctx.scale(-1, 1); }
      const x0 = giro ? -24 * S : x - 24 * S;
      if (sc.contorno) {
        const o = Math.max(1, Math.round(S * 0.67));
        [[o, 0], [-o, 0], [0, o], [0, -o]].forEach(([dx, dy]) => ctx.drawImage(sagome, sx, sy, F, F, x0 + dx, y + dy, F * S, F * S));
      }
      if (this.bordo) {   // perimetro colorato di 1 pixel del disegno (verde ha comprato, arancio ha cliccato, grigio niente)
        const t = tinta(this.bordo);
        [[S, 0], [-S, 0], [0, S], [0, -S]].forEach(([dx, dy]) => ctx.drawImage(t, sx, sy, F, F, x0 + dx, y + dy, F * S, F * S));
      }
      ctx.drawImage(atlante, sx, sy, F, F, x0, y, F * S, F * S);
      if (giro) ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  class Scena {
    constructor(canvas, o = {}) {
      this.c = canvas; this.ctx = canvas.getContext('2d');
      this.S = o.scala || 2; this.h = o.altezza || 120;
      this.avvolgi = !!o.avvolgi; this.margine = o.margine || 26; this.suoloGiu = o.suolo || 12;
      this.omini = []; this.scritte = []; this.ritmo = 0; this.acc = 0; this.w = 0;
      this.suClick = o.suClick || null; this.testo = o.testo == null ? 'click' : o.testo; this.ricambio = !!o.ricambio;
      this.contorno = !!o.contorno; this.ombra = o.ombra !== false; this.linea = o.linea !== false; this.colore = o.colore || '#F2551D';
      this.ridimensiona();
      scene.add(this); avvia();
    }
    ridimensiona() {
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const w = this.c.clientWidth || 300;
      const k = this.w ? w / this.w : 1;
      this.w = w;
      this.c.width = Math.round(w * dpr); this.c.height = Math.round(this.h * dpr);
      this.c.style.height = this.h + 'px';
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.ctx.imageSmoothingEnabled = false;
      if (k !== 1) { if (this.eFolla) this.folla(); else this.omini.forEach(o => { o.x *= k; }); }
    }
    popola(n, o = {}) {
      const tot = meta ? meta.nomi.length : 100;
      const usati = new Set();
      this.omini = [];
      for (let i = 0; i < n; i++) {
        let id;
        do { id = Math.floor(Math.random() * tot); } while (usati.has(id) && usati.size < tot);
        usati.add(id);
        const x = this.avvolgi ? (i + Math.random() * 0.8) * (this.w + 80) / n - 40 : this.margine + Math.random() * Math.max(this.w - 2 * this.margine, 10);
        this.omini.push(new Omino(id, x, { dy: Math.round(Math.random() * (o.profondita == null ? 8 : o.profondita)) - 4, vel: o.vel }));
      }
      this.omini.sort((a, b) => a.dy - b.dy);
      return this;
    }
    folla() {
      const tot = meta ? meta.nomi.length : 100;
      // file dal fondo al primo piano: scala, trasparenza, altezza dal bordo, distanza tra omini
      const file = [[2, 0.14, 172, 30], [3, 0.26, 128, 44], [4, 0.46, 86, 60], [5, 0.76, 40, 84], [7, 1, -78, 124]];
      this.omini = []; this.eFolla = true;
      file.forEach(([scala, alfa, su, passo]) => {
        for (let x = -passo * Math.random(); x < this.w + passo; x += passo * (0.75 + Math.random() * 0.5)) {
          const o = new Omino(Math.floor(Math.random() * tot), x, { scala, alfa, fisso: true, dy: -su });
          this.omini.push(o);
        }
      });
      return this;
    }
    // l'omino sotto un punto della scena (il personaggio occupa 24 x 28 pixel del fotogramma, centrato in basso)
    trova(px, py) {
      const suolo = this.h - this.suoloGiu;
      for (let i = this.omini.length - 1; i >= 0; i--) {
        const o = this.omini[i], S = o.s || this.S, piedi = suolo + o.dy;
        if (o.a > 0.5 && Math.abs(px - o.x) <= 12 * S && py >= piedi - 28 * S && py <= piedi + 2 * S) return o;
      }
      return null;
    }
    testa(o) { const S = o.s || this.S; return { x: o.x, y: this.h - this.suoloGiu + o.dy - 46 * S + ((cima[o.id] || 19) - 7) * S }; }
    // un omino uscito dallo schermo viene sostituito da un personaggio che non è già in scena, che entra camminando
    ricambia(o, m) {
      const tot = meta ? meta.nomi.length : 100, usati = new Set(this.omini.map(x => x.id));
      let id, giri = 0;
      do { id = Math.floor(Math.random() * tot); giri++; } while (usati.has(id) && giri < 50);
      o.id = id;
      o.dir = Math.random() < 0.5 ? -1 : 1;
      o.x = o.dir > 0 ? -m : this.w + m;
      o.vel = 16 + Math.random() * 22;
      o.pausa = 3 + Math.random() * 8;
      o.imposta('camminata');
      // chi entra prende una profondità nuova: la folla si rimescola e non si formano file
      if (this.profondita) { this.profondita(o); o.x = o.dir > 0 ? -(24 * (o.s || this.S) + 8) : this.w + 24 * (o.s || this.S) + 8; this.omini.sort((p, q) => p.dy - q.dy); }
    }
    dormienti(frazione) {
      const n = Math.min(Math.round(this.omini.length * frazione), this.omini.length - 1);
      this.omini.forEach((o, i) => {
        const d = i < n;
        if (d && !o.dorme) { o.dorme = true; o.imposta('sonno'); }
        if (!d && o.dorme) { o.dorme = false; o.imposta('camminata'); }
      });
    }
    esulta() {
      const liberi = this.omini.filter(o => !o.dorme && o.anim !== 'festa');
      if (!liberi.length) return;
      const o = liberi[Math.floor(Math.random() * liberi.length)];
      o.imposta('festa', 1.15);
      this.scritte.push({ x: o.x, y: this.h - this.suoloGiu + o.dy - 30 * this.S, t: 0 });
    }
    aggiorna(dt) {
      this.omini.forEach(o => o.aggiorna(dt, this));
      if (this.ritmo > 0) {
        this.acc += dt * this.ritmo;
        while (this.acc >= 1) { this.acc -= 1; this.esulta(); if (this.suClick) this.suClick(); }
      }
      this.scritte.forEach(p => { p.t += dt; });
      this.scritte = this.scritte.filter(p => p.t < 0.9);
    }
    disegna() {
      const ctx = this.ctx, suolo = this.h - this.suoloGiu;
      ctx.clearRect(0, 0, this.w, this.h);
      if (this.linea) { ctx.fillStyle = 'rgba(14,15,18,.08)'; ctx.fillRect(0, suolo + 4, this.w, 1); }
      this.omini.forEach(o => o.disegna(ctx, this.S, suolo, this));
      ctx.font = '600 11px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
      this.scritte.forEach(p => {
        ctx.globalAlpha = 1 - p.t / 0.9; ctx.fillStyle = this.colore;
        ctx.fillText(this.testo, Math.round(p.x), Math.round(p.y - p.t * 26));
      });
      ctx.globalAlpha = 1;
    }
  }

  const scene = new Set();
  let partito = false, ultimo = 0;
  function giro(ts) {
    const dt = fermaTutto ? 0 : Math.min((ts - ultimo) / 1000, 0.05);
    ultimo = ts;
    scene.forEach(s => {
      if (!s.c.isConnected) { scene.delete(s); return; }
      if (s.c.offsetParent === null || !atlante) return;
      if (Math.abs(s.c.clientWidth - s.w) > 1) s.ridimensiona();
      s.aggiorna(dt); s.disegna();
    });
    requestAnimationFrame(giro);
  }
  function avvia() { if (!partito) { partito = true; requestAnimationFrame(ts => { ultimo = ts; giro(ts); }); } }

  /* Prato in pixel art: verde a più toni che schiarisce e sfuma verso l'alto (lontano), fili d'erba più fitti
     e alti davanti, qualche fiore. Disegnato a bassa risoluzione e ingrandito senza sfocare. */
  function prato(c, altezza, o = {}) {
    const P = o.pixel || 3, dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = c.clientWidth || (c.parentNode && c.parentNode.clientWidth) || 800;
    c.style.height = altezza + 'px';
    const lw = Math.max(1, Math.ceil(w / P)), lh = Math.max(1, Math.ceil(altezza / P));
    const off = document.createElement('canvas'); off.width = lw; off.height = lh;
    const g = off.getContext('2d'), img = g.createImageData(lw, lh), d = img.data;
    let seme = o.seme || 20261114;
    const rnd = () => (seme = (seme * 16807) % 2147483647) / 2147483647;
    const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
    const LONTANO = [236, 247, 228], MEZZO = [196, 230, 168], VICINO = [138, 199, 104];
    const passo = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    const alfa = new Float32Array(lh);
    for (let y = 0; y < lh; y++) {
      const t = y / Math.max(lh - 1, 1);                 // 0 in alto (lontano), 1 in basso (vicino)
      const base = t < 0.55 ? mix(LONTANO, MEZZO, t / 0.55) : mix(MEZZO, VICINO, (t - 0.55) / 0.45);
      alfa[y] = passo(0, 0.42, t);                       // sfuma verso l'alto
      for (let x = 0; x < lw; x++) {
        const i = (y * lw + x) * 4, n = (rnd() - 0.5) * (3 + 5 * t);   // grana leggera, più forte davanti
        d[i] = base[0] + n; d[i + 1] = base[1] + n; d[i + 2] = base[2] + n * 0.6; d[i + 3] = 255 * alfa[y];
      }
    }
    const punto = (x, y, col, a = 1) => {
      if (x < 0 || y < 0 || x >= lw || y >= lh) return;
      const i = (y * lw + x) * 4, k = a * alfa[y];
      d[i] += (col[0] - d[i]) * k; d[i + 1] += (col[1] - d[i + 1]) * k; d[i + 2] += (col[2] - d[i + 2]) * k;
    };
    const SCURO = [104, 168, 76], MEDIO = [124, 186, 92], CHIARO = [200, 234, 178];
    const fili = Math.round(lw * lh * 0.075);
    for (let k = 0; k < fili; k++) {
      const t = Math.pow(rnd(), 0.55), y = Math.floor(t * (lh - 1)), x = Math.floor(rnd() * lw);
      if (t < 0.12) continue;
      const alto = 1 + Math.round(t * 2.2 + rnd() * (1 + t * 2)), col = rnd() < 0.8 ? (rnd() < 0.5 ? SCURO : MEDIO) : CHIARO;
      const pend = rnd() < 0.3 ? (rnd() < 0.5 ? -1 : 1) : 0;
      for (let j = 0; j < alto; j++) punto(x + (j === alto - 1 ? pend : 0), y - j, col, 0.35 + 0.55 * t);
    }
    const FIORI = [[255, 255, 255], [255, 226, 122], [247, 168, 196], [196, 186, 255]];
    const fiori = Math.round(lw * lh / 520);
    for (let k = 0; k < fiori; k++) {
      const t = 0.3 + rnd() * 0.62, y = Math.floor(t * (lh - 1)), x = Math.floor(rnd() * lw), col = FIORI[Math.floor(rnd() * FIORI.length)];
      punto(x, y, col, 0.95); if (t > 0.7 && rnd() < 0.6) { punto(x - 1, y, col, 0.8); punto(x + 1, y, col, 0.8); punto(x, y - 1, col, 0.8); punto(x, y + 1, [120, 170, 80], 0.7); }
    }
    g.putImageData(img, 0, 0);
    c.width = Math.round(w * dpr); c.height = Math.round(altezza * dpr);
    const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(off, 0, 0, lw * P * dpr, lh * P * dpr);
  }

  /* Campo: prato e folla sparsa in profondità. o.ids = personaggi da usare (uno per persona);
     o.ricambio = chi esce dal bordo viene sostituito da un personaggio nuovo. Restituisce la scena. */
  function campo(cPrato, cFolla, o = {}) {
    const stretto = window.innerWidth < 600, alto = Math.round(o.altezza || 200);
    if (cPrato) prato(cPrato, o.altezzaPrato || alto, { pixel: stretto ? 2 : 3 });
    const sc = new Scena(cFolla, { scala: stretto ? 2 : 3, altezza: alto, suolo: o.suolo || (stretto ? 12 : 16), linea: false,
      testo: o.testo == null ? '' : o.testo, avvolgi: true, ricambio: !!o.ricambio });
    const [piccola, grande] = o.scale || (stretto ? [1, 2] : [2, 3]), fondo = Math.round(alto * (o.fondo || 0.58));
    sc.profondita = om => {
      const t = Math.pow(Math.random(), 0.85);   // 0 davanti, 1 in fondo
      om.dy = -Math.round(t * fondo);
      om.s = t > 0.62 || (t > 0.42 && Math.random() < (t - 0.42) / 0.2) ? piccola : grande;
      om.vel = (14 + Math.random() * 20) * (1 - 0.45 * t);
    };
    const tot = meta ? meta.nomi.length : 100, usati = new Set(), w = cFolla.clientWidth || 800;
    const nuovo = () => { let id; do { id = Math.floor(Math.random() * tot); } while (usati.has(id) && usati.size < tot); usati.add(id); return id; };
    const n = o.ids ? o.ids.length : (o.n || Math.max(6, Math.min(26, Math.round(w / (stretto ? 34 : 62)))));
    sc.omini = [];
    for (let k = 0; k < n; k++) {
      const om = new Omino(o.ids ? o.ids[k] : nuovo(), Math.random() * (w + 80) - 40, {});
      sc.profondita(om);
      sc.omini.push(om);
    }
    sc.omini.sort((p, q) => p.dy - q.dy);
    return sc;
  }
  function nomiPersonaggi() { return meta ? meta.nomi : []; }

  /* Griglia di pallini (ispirata a «Dot Grid» di React Bits, riscritta in canvas 2D):
     i pallini vicini al puntatore si spostano e si colorano, quelli sotto i piedi degli omini si accendono appena,
     un'onda li spinge via dal punto indicato. o.sorgenti() = [{x, y}] dei piedi degli omini. */
  function puntini(c, o = {}) {
    const passo = o.passo || 22, r0 = o.raggio || 1.5, base0 = o.base || [205, 205, 198], acc0 = o.accento || [59, 75, 224];
    const vicino = o.vicino || 120, ctx = c.getContext('2d'), area = o.area || c.parentNode;
    let W = 0, H = 0, nx = 0, ny = 0, ox = 0, oy = 0, P = [], mx = -1e4, my = -1e4, onde = [], fermo = false;
    function misura() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = c.clientWidth; H = c.clientHeight;
      c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      nx = Math.max(1, Math.floor(W / passo)); ny = Math.max(1, Math.floor(H / passo));
      ox = (W - (nx - 1) * passo) / 2; oy = (H - (ny - 1) * passo) / 2;
      P = new Float32Array(nx * ny * 4);   // spostamento x, y e velocità x, y di ogni pallino
    }
    const muovi = e => { const b = c.getBoundingClientRect(); mx = e.clientX - b.left; my = e.clientY - b.top; };
    const via = () => { mx = my = -1e4; };
    area.addEventListener('pointermove', muovi); area.addEventListener('pointerleave', via);
    function onda(x, y, forza = 1) { onde.push({ x, y, t: performance.now(), f: forza }); }
    function giro(now) {
      if (fermo || !c.isConnected) { area.removeEventListener('pointermove', muovi); area.removeEventListener('pointerleave', via); return; }
      if (c.clientWidth !== W || c.clientHeight !== H) misura();
      const n = nx * ny, k = new Float32Array(n);
      const tx = new Float32Array(n), ty = new Float32Array(n);
      // vicino al puntatore: spinta verso l'esterno e colore pieno
      const spingi = (x, y, rag, forza, colore) => {
        const i0 = Math.max(0, Math.floor((x - rag - ox) / passo)), i1 = Math.min(nx - 1, Math.ceil((x + rag - ox) / passo));
        const j0 = Math.max(0, Math.floor((y - rag - oy) / passo)), j1 = Math.min(ny - 1, Math.ceil((y + rag - oy) / passo));
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const px = ox + i * passo, py = oy + j * passo, dx = px - x, dy = py - y, d = Math.hypot(dx, dy);
          if (d >= rag) continue;
          const q = (1 - d / rag) * (1 - d / rag), id = j * nx + i;
          if (forza && d > 0.01) { tx[id] += dx / d * q * forza; ty[id] += dy / d * q * forza; }
          k[id] = Math.max(k[id], q * colore);
        }
      };
      if (mx > -1e3) spingi(mx, my, vicino, 9, 1);
      if (o.sorgenti) o.sorgenti().forEach(s => spingi(s.x, s.y, 44, 0, 0.45));
      // onde: un anello che si allarga e spinge i pallini
      onde = onde.filter(w => (now - w.t) < 1400);
      onde.forEach(w => {
        const fronte = (now - w.t) / 1000 * 620, largo = 70, amp = 10 * w.f * Math.max(0, 1 - fronte / Math.max(W, H));
        for (let id = 0; id < n; id++) {
          const px = ox + (id % nx) * passo, py = oy + Math.floor(id / nx) * passo, dx = px - w.x, dy = py - w.y, d = Math.hypot(dx, dy) || 1;
          const u = (d - fronte) / largo;
          if (u < -1 || u > 1) continue;
          const q = Math.cos(u * Math.PI / 2) * amp;
          tx[id] += dx / d * q; ty[id] += dy / d * q; k[id] = Math.max(k[id], 0.6 * Math.abs(q) / (10 * w.f));
        }
      });
      // molla: ogni pallino torna al suo posto
      ctx.clearRect(0, 0, W, H);
      // colori secondo il tema della pagina (si aggiornano da soli se cambia)
      const scuro = document.documentElement.dataset.tema === 'scuro';
      const base = scuro ? [58, 58, 66] : base0, acc = scuro ? [125, 139, 255] : acc0;
      ctx.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`;
      ctx.beginPath();
      const accesi = [];
      for (let id = 0; id < n; id++) {
        const b = id * 4;
        P[b + 2] = (P[b + 2] + (tx[id] - P[b]) * 0.16) * 0.72; P[b + 3] = (P[b + 3] + (ty[id] - P[b + 1]) * 0.16) * 0.72;
        P[b] += P[b + 2]; P[b + 1] += P[b + 3];
        const x = ox + (id % nx) * passo + P[b], y = oy + Math.floor(id / nx) * passo + P[b + 1];
        if (k[id] > 0.04) accesi.push([x, y, k[id]]); else ctx.rect(x - r0, y - r0, 2 * r0, 2 * r0);
      }
      ctx.fill();
      accesi.forEach(([x, y, q]) => {
        const r = r0 * (1 + q * 0.9);
        ctx.fillStyle = `rgb(${Math.round(base[0] + (acc[0] - base[0]) * q)},${Math.round(base[1] + (acc[1] - base[1]) * q)},${Math.round(base[2] + (acc[2] - base[2]) * q)})`;
        ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
      });
      requestAnimationFrame(giro);
    }
    misura(); requestAnimationFrame(giro);
    return { onda, ferma: () => { fermo = true; } };
  }

  window.Flock = { carica, Scena, Omino, ANIM, prato, campo, nomiPersonaggi, puntini };
})();
