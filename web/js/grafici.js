/* Grafico a linee con forchette, disegnato in SVG senza librerie. */
(function () {
  'use strict';
  const it = (v, d) => Number(v).toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d });

  function passo(intervallo) {
    const p = Math.pow(10, Math.floor(Math.log10(intervallo)));
    const f = intervallo / p;
    return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
  }

  /* cfg: { giorni:[AAAA-MM-GG], oggi:indice primo giorno previsto, unita, decimali, altezza,
            serie:[{nome, colore, valori:[numero|null], punti:bool, spessore}],
            fasce:[{nome, colore, opacita, basso:[..], alto:[..]}], eventi:{data:etichetta} } */
  function linee(el, cfg) {
    const W = Math.max(el.clientWidth, 280), H = cfg.altezza || 230;
    const m = { l: 46, r: 14, t: 22, b: 28 };
    const n = cfg.giorni.length;
    const X = i => m.l + (W - m.l - m.r) * (n > 1 ? i / (n - 1) : 0.5);
    let lo = Infinity, hi = -Infinity;
    const vedi = v => { if (v != null && isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } };
    cfg.serie.forEach(s => s.valori.forEach(vedi));
    (cfg.fasce || []).forEach(f => { f.basso.forEach(vedi); f.alto.forEach(vedi); });
    if (!isFinite(lo)) { lo = 0; hi = 1; }
    const amp = (hi - lo) || 1;
    lo = Math.max(0, lo - amp * 0.08); hi = hi + amp * 0.08;
    const st = passo((hi - lo) / 4);
    lo = Math.floor(lo / st) * st; hi = Math.ceil(hi / st) * st;
    const Y = v => m.t + (H - m.t - m.b) * (1 - (v - lo) / (hi - lo));
    const dec = cfg.decimali == null ? 2 : cfg.decimali;
    const giorno = d => d.slice(8, 10) + '/' + d.slice(5, 7);
    let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${cfg.titolo || 'grafico'}">`;
    if (cfg.oggi != null && cfg.oggi > 0) {
      const x0 = (X(cfg.oggi - 1) + X(cfg.oggi)) / 2;
      s += `<rect x="${x0}" y="${m.t}" width="${W - m.r - x0}" height="${H - m.t - m.b}" class="g-futuro"/>`;
      s += `<text x="${x0 + 6}" y="${m.t - 7}" class="g-nota">previsto</text><text x="${x0 - 6}" y="${m.t - 7}" class="g-nota" text-anchor="end">storico</text>`;
    }
    for (let v = lo; v <= hi + st / 2; v += st) {
      s += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}" class="g-griglia"/>`;
      s += `<text x="${m.l - 6}" y="${Y(v) + 4}" class="g-asse" text-anchor="end">${it(v, st < 0.1 ? 2 : st < 1 ? 1 : 0)}</text>`;
    }
    const ogni = n > 30 ? 7 : n > 16 ? 5 : 3;
    for (let i = 0; i < n; i += ogni) s += `<text x="${X(i)}" y="${H - 8}" class="g-asse" text-anchor="middle">${giorno(cfg.giorni[i])}</text>`;
    Object.entries(cfg.eventi || {}).forEach(([d, nome], j) => {
      const i = cfg.giorni.indexOf(d);
      if (i < 0) return;
      s += `<line x1="${X(i)}" x2="${X(i)}" y1="${m.t}" y2="${H - m.b}" class="g-evento"/>`;
      s += `<text x="${X(i) - 4}" y="${H - m.b - 6 - (j % 2) * 13}" class="g-evento-t" text-anchor="end">${nome}</text>`;
    });
    (cfg.fasce || []).forEach(f => {
      const idx = [];
      f.basso.forEach((v, i) => { if (v != null) idx.push(i); });
      if (idx.length < 2) return;
      const su = idx.map(i => `${X(i)},${Y(f.alto[i])}`).join(' L');
      const giu = idx.slice().reverse().map(i => `${X(i)},${Y(f.basso[i])}`).join(' L');
      s += `<path d="M${su} L${giu} Z" fill="${f.colore}" opacity="${f.opacita}"/>`;
    });
    cfg.serie.forEach(se => {
      let d = '', penna = false;
      se.valori.forEach((v, i) => {
        if (v == null) { penna = false; return; }
        d += (penna ? 'L' : 'M') + X(i) + ',' + Y(v) + ' '; penna = true;
      });
      s += `<path d="${d}" fill="none" stroke="${se.colore}" stroke-width="${se.spessore || 2}" stroke-linejoin="round" stroke-linecap="round"/>`;
      if (se.punti) se.valori.forEach((v, i) => { if (v != null) s += `<rect x="${X(i) - 2}" y="${Y(v) - 2}" width="4" height="4" fill="${se.colore}"/>`; });
    });
    s += `<line class="g-cursore" x1="0" x2="0" y1="${m.t}" y2="${H - m.b}" visibility="hidden"/>`;
    s += `<rect class="g-tocco" x="${m.l}" y="${m.t}" width="${W - m.l - m.r}" height="${H - m.t - m.b}" fill="transparent"/></svg>`;
    s += '<div class="g-fumetto" hidden></div>';
    el.innerHTML = s;
    el.classList.add('grafico');
    const svg = el.querySelector('svg'), cur = el.querySelector('.g-cursore'), fum = el.querySelector('.g-fumetto');
    const muovi = ev => {
      const r = svg.getBoundingClientRect();
      const px = (ev.clientX - r.left) * (W / r.width);
      const i = Math.max(0, Math.min(n - 1, Math.round((px - m.l) / (W - m.l - m.r) * (n - 1))));
      cur.setAttribute('x1', X(i)); cur.setAttribute('x2', X(i)); cur.setAttribute('visibility', 'visible');
      let h = `<b>${giorno(cfg.giorni[i])}</b>`;
      cfg.serie.forEach(se => { if (se.valori[i] != null) h += `<div><i style="background:${se.colore}"></i>${se.nome}: ${it(se.valori[i], dec)}${cfg.unita || ''}</div>`; });
      (cfg.fasce || []).forEach(f => { if (f.basso[i] != null) h += `<div class="g-f">${f.nome}: ${it(f.basso[i], dec)} – ${it(f.alto[i], dec)}${cfg.unita || ''}</div>`; });
      fum.innerHTML = h; fum.hidden = false;
      const fx = X(i) * (r.width / W);
      fum.style.left = Math.min(Math.max(fx + 10, 4), r.width - fum.offsetWidth - 4) + 'px';
      fum.style.top = '26px';
    };
    const via = () => { cur.setAttribute('visibility', 'hidden'); fum.hidden = true; };
    svg.addEventListener('pointermove', muovi); svg.addEventListener('pointerdown', muovi); svg.addEventListener('pointerleave', via);
  }

  window.Grafici = { linee };
})();
