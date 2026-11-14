/* Solo nell'app per iPhone (window.FlocketsNativo lo mette l'app): il bottone Condividi dell'analisi aperta.
   L'app aggiunge l'istantanea dello schermo; qui si scrive il riassunto: titolo, frase, numeri e pubblico migliore. */
(function () {
  const N = window.FlocketsNativo;
  if (!N) return;
  const testo = el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
  document.addEventListener('click', e => {
    if (!e.target.closest('#a-condividi')) return;
    const v = document.getElementById('v-analisi');
    const righe = ['Flockets · ' + testo(document.getElementById('a-titolo'))];
    const frase = testo(v.querySelector('.a-frase'));
    if (frase) righe.push(frase);
    v.querySelectorAll('.a-kpi > div').forEach(d => {
      const dt = testo(d.querySelector('dt')), dd = testo(d.querySelector('dd'));
      if (dt && dd) righe.push(dt + ': ' + dd);
    });
    const migliore = testo(v.querySelector('.a-best b'));
    if (migliore) righe.push('Pubblico migliore: ' + migliore);
    righe.push(N.sito);
    N.chiedi('condividi', { testo: righe.join('\n') }).catch(() => {});
  });
})();
