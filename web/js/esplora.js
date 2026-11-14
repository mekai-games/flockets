/* Grafico da esplorare: più linee, forchetta (8 volte su 10), eventi del calendario, e passando il dito o il mouse
   un cursore con i valori di quel giorno. Le linee si disegnano con un'animazione breve. */
window.Esplora = (function () {
  'use strict';
  const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const passo = x => { const p = Math.pow(10, Math.floor(Math.log10(x || 1))), r = x / p; return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 2.5 ? 2.5 : r <= 5 ? 5 : 10) * p; };
  const ok = v => v != null && isFinite(v);

  /* cfg: { giorni: ['2026-11-16', …], serie: [{ nome, colore, valori, basso?, alto?, tratto? }], eventi: { giorno: nome },
          fmt: v => testo (cursore), fmtAsse: v => testo (asse), giorno: d => testo, altezza } */
  function disegna(el, cfg) {
    const W = Math.max(el.clientWidth, 280), H = cfg.altezza || 280, stretto = W < 520;
    const m = { l: stretto ? 44 : 58, r: 14, t: 20, b: 30 };
    const n = cfg.giorni.length, X = i => m.l + (W - m.l - m.r) * (n > 1 ? i / (n - 1) : 0.5);
    let hi = 0;
    cfg.serie.forEach(s => { s.valori.forEach(v => { if (ok(v)) hi = Math.max(hi, v); }); (s.alto || []).forEach(v => { if (ok(v)) hi = Math.max(hi, v); }); });
    if (!hi) hi = 1;
    const st = passo(hi / 4); hi = Math.ceil((hi * 1.04) / st) * st;
    const Y = v => m.t + (H - m.t - m.b) * (1 - v / hi);
    let s = `<svg class="es-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(cfg.titolo || 'Grafico')}">`;
    for (let v = 0; v <= hi + st / 2; v += st) {
      s += `<line class="es-griglia" x1="${m.l}" x2="${W - m.r}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/>`;
      s += `<text class="es-y" x="${m.l - 8}" y="${(Y(v) + 4).toFixed(1)}">${esc(cfg.fmtAsse(v))}</text>`;
    }
    const ogni = Math.max(1, Math.ceil(n / (stretto ? 4 : 8)));
    cfg.giorni.forEach((d, i) => {
      if (i % ogni === 0 || i === n - 1) s += `<text class="es-x" x="${X(i).toFixed(1)}" y="${H - 9}">${d.slice(8, 10)}/${d.slice(5, 7)}</text>`;
    });
    Object.entries(cfg.eventi || {}).forEach(([d, nome]) => {
      const i = cfg.giorni.indexOf(d);
      if (i < 0) return;
      s += `<line class="es-evento" x1="${X(i).toFixed(1)}" x2="${X(i).toFixed(1)}" y1="${m.t}" y2="${H - m.b}"/>`;
      s += `<text class="es-ev" x="${(X(i) + (i > n * 0.75 ? -5 : 5)).toFixed(1)}" y="${m.t + 10}" text-anchor="${i > n * 0.75 ? 'end' : 'start'}">${esc(nome)}</text>`;
    });
    cfg.serie.forEach(se => {
      if (!se.basso || !se.alto) return;
      const su = se.alto.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`), giu = se.basso.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).reverse();
      s += `<polygon class="es-fascia" points="${su.concat(giu).join(' ')}" style="fill:${se.colore}"/>`;
    });
    cfg.serie.forEach((se, j) => {
      const d = se.valori.map((v, i) => (ok(v) ? `${i && ok(se.valori[i - 1]) ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}` : '')).join('');
      s += `<path class="es-linea" d="${d}" pathLength="1" fill="none" style="--j:${j};stroke:${se.colore}" stroke-width="${se.tratto || 2.4}" stroke-linejoin="round" stroke-linecap="round"/>`;
    });
    s += `<line class="es-cursore" x1="0" x2="0" y1="${m.t}" y2="${H - m.b}" visibility="hidden"/>`;
    cfg.serie.forEach((se, j) => { s += `<circle class="es-punto" data-j="${j}" r="4.5" style="fill:${se.colore}" visibility="hidden"/>`; });
    s += `<rect class="es-area" x="${m.l}" y="${m.t}" width="${W - m.l - m.r}" height="${H - m.t - m.b}" fill="transparent"/></svg>`;
    el.innerHTML = `<div class="es-box">${s}<div class="es-tip" hidden></div></div>`;

    const box = el.firstElementChild, svg = box.firstElementChild, tip = box.lastElementChild;
    const cur = svg.querySelector('.es-cursore'), punti = Array.from(svg.querySelectorAll('.es-punto'));
    function mostra(px) {
      const i = Math.min(n - 1, Math.max(0, Math.round(((px - m.l) / (W - m.l - m.r)) * (n - 1))));
      const x = X(i);
      cur.setAttribute('x1', x); cur.setAttribute('x2', x); cur.setAttribute('visibility', 'visible');
      punti.forEach((p, j) => {
        const v = cfg.serie[j].valori[i];
        if (!ok(v)) { p.setAttribute('visibility', 'hidden'); return; }
        p.setAttribute('cx', x); p.setAttribute('cy', Y(v)); p.setAttribute('visibility', 'visible');
      });
      const ev = cfg.eventi && cfg.eventi[cfg.giorni[i]];
      tip.innerHTML = `<b>${esc(cfg.giorno(cfg.giorni[i]))}${ev ? ' · ' + esc(ev) : ''}</b>` + cfg.serie.map(se => `<div><i style="background:${se.colore}"></i><span>${esc(se.nome)}</span><em>${ok(se.valori[i]) ? esc(cfg.fmt(se.valori[i])) : '–'}${
        se.basso && ok(se.basso[i]) ? `<small>tra ${esc(cfg.fmt(se.basso[i]))} e ${esc(cfg.fmt(se.alto[i]))}</small>` : ''}</em></div>`).join('');
      tip.hidden = false;
      const bw = box.clientWidth, tw = tip.offsetWidth, sx = (x / W) * bw;
      tip.style.left = (sx + 16 + tw > bw ? Math.max(4, sx - tw - 16) : sx + 16) + 'px';
    }
    const pos = e => { const r = svg.getBoundingClientRect(); return ((e.clientX - r.left) / r.width) * W; };
    const area = svg.querySelector('.es-area');
    area.addEventListener('pointermove', e => mostra(pos(e)));
    area.addEventListener('pointerdown', e => mostra(pos(e)));
    box.addEventListener('pointerleave', () => {
      tip.hidden = true; cur.setAttribute('visibility', 'hidden'); punti.forEach(p => p.setAttribute('visibility', 'hidden'));
    });
  }
  return { disegna };
})();
