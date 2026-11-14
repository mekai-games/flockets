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
  let atlante = null, sagome = null, meta = null, pronto = null;
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
      c.drawImage(im, 0, 0); c.globalCompositeOperation = 'source-in'; c.fillStyle = '#fff'; c.fillRect(0, 0, im.width, im.height);
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
          if (this.x < -40) this.x = sc.w + 40;
          if (this.x > sc.w + 40) this.x = -40;
        } else {
          if (this.x < sc.margine) { this.x = sc.margine; this.dir = 1; }
          if (this.x > sc.w - sc.margine) { this.x = sc.w - sc.margine; this.dir = -1; }
        }
        this.pausa -= dt;
        if (this.pausa <= 0) {
          this.pausa = 4 + Math.random() * 10;
          const r = Math.random();
          if (r < 0.4) this.imposta('fermo', 1 + Math.random() * 1.6);
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
      this.suClick = o.suClick || null; this.testo = o.testo || 'click';
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

  window.Flock = { carica, Scena, Omino, ANIM };
})();
