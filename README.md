# Flockets

**Prevedi le campagne di marketing prima di lanciarle: CTR, CPM e budget, simulati su un pubblico virtuale.**

Flockets immagina il pubblico di ogni ad set, prevede CTR e CPM di ogni annuncio giorno per giorno e aiuta a
decidere dove mettere il budget. Prima di spendere un euro.

Sito: **https://flockets.vercel.app**

Progetto per The Big Hack 2026 (Napoli, 14-15 novembre), sfida Wevion «Clienti che non esistono».
Questa pagina segue le tre consegne chieste dalla sfida.

| Consegna | Dove sta |
|---|---|
| 1. Lo strumento | il [sito](https://flockets.vercel.app) (cartella [`web/`](web/)) e il motore di previsione ([`modello/`](modello/)) |
| 2. Le previsioni | [`output/previsioni_16-30_nov.csv`](output/previsioni_16-30_nov.csv): 699 righe, 51 annunci |
| 3. Il ragionamento | questa pagina, la scheda Consegne del sito e il video di 3 minuti |

---

## 1. Lo strumento

### Il sito

Il percorso è in tre schermate.

1. **Home**: nome, frase e la folla del pubblico simulato.
2. **Console**: i dati di partenza e, se vuoi, la descrizione di un annuncio da provare. Poi «Avvia la simulazione».
3. **Area di lavoro**: a sinistra il pubblico simulato, a destra la parte tecnica in cinque passi, con il registro di ciò che il motore ha fatto.

| Passo | Cosa mostra |
|---|---|
| 01 Dati | cosa è stato letto, le anomalie trovate, l'andamento del mercato nelle settimane da prevedere |
| 02 Pubblici | chi c'è dietro ogni ad set e i numeri che lo motivano |
| 03 Simulazione | i 15 giorni scorrono: gli omini che esultano sono i click, quelli che dormono hanno visto l'annuncio troppe volte. Per ogni annuncio CTR e CPM con la forchetta di errore |
| 04 Decisioni | cursori del budget con ricalcolo immediato (anche sul pubblico simulato), proposta di riallocazione, creatività da sostituire |
| 05 Laboratorio | descrivi un annuncio nuovo e vedi come reagisce ogni pubblico, prima del lancio |
| Consegne | le tre consegne della sfida |

Il sito è statico: legge un solo file di dati preparato dal motore. Per vederlo in locale:

```bash
python3 -m http.server 4173 --directory web
```

Le proposte di logo sono in [`design/loghi.html`](design/loghi.html).

### Il motore

Il motore è in Python e usa solo `numpy` e `pandas`.

```bash
python3 modello/run.py
```

Il kit dei dati della sfida va messo nella cartella `dati/` (non è incluso in questo repository).
Il comando rifà tutto da zero in pochi secondi e scrive in `output/`:

| File | Cosa contiene |
|---|---|
| `previsioni_16-30_nov.csv` | le previsioni, una riga per annuncio e giorno |
| `pubblici_adset.csv` | il pubblico proposto per ogni ad set, con i numeri che lo motivano |
| `scenario_budget.csv` | dove spostare il budget dentro ogni campagna, a spesa invariata |
| `validazione_backtest.csv` | la prova sullo storico: errore del modello contro un riferimento ingenuo |
| `parametri_modello.json` | i parametri stimati (fatica, elasticità al budget, giorno della settimana...) |

Per aggiornare i dati che il sito legge:

```bash
python3 modello/export_web.py
```

### Come è diviso il codice

| Cartella | Cosa c'è |
|---|---|
| [`modello/wevion_model.py`](modello/wevion_model.py) | il motore: lettura dati, stagionalità, modello CTR, modello CPM, quote di spesa, incertezza, validazione |
| [`modello/run.py`](modello/run.py) | esegue stima, validazione e previsioni, scrive `output/` |
| [`modello/export_web.py`](modello/export_web.py) | prepara `web/data/analisi.json` per il sito |
| [`web/`](web/) | il sito: `index.html`, `style.css`, `js/scena.js` (omini), `js/grafici.js` (grafici), `js/app.js` (schede) |
| [`strumenti/atlante.py`](strumenti/atlante.py) | unisce i fogli di animazione dei personaggi in una sola immagine |
| [`output/`](output/) | i risultati del motore |

---

## 2. Le previsioni

File: [`output/previsioni_16-30_nov.csv`](output/previsioni_16-30_nov.csv). Una riga per ogni riga di
`dati/da_prevedere.csv` (699 righe, dal 16 al 30 novembre 2026).

KPI previsti e perché:

| Colonna | Significato |
|---|---|
| `ctr_prev` | CTR previsto, in percentuale |
| `ctr_p10`, `ctr_p90` | forchetta del CTR di quel giorno: il valore vero ci cade 8 volte su 10 |
| `ctr_atteso_p10`, `ctr_atteso_p90` | forchetta del CTR "di fondo", senza il caso dei click di un singolo giorno |
| `cpm_prev`, `cpm_p10`, `cpm_p90` | CPM previsto in euro, con la sua forchetta |
| `cpc_prev` | costo per click: lega CPM e CTR, è il numero che serve per decidere il budget |
| `quota_spesa_prev`, `spesa_prev` | quanta parte del budget dell'ad set va a quell'annuncio |
| `impression_prev`, `click_prev` | volumi attesi |
| `frequenza_prev`, `copertura_prev` | quante persone diverse e quante volte |
| `cold_start` | `True` se l'annuncio usa una creatività mai vista nello storico |

CTR e CPM sono il cuore della sfida. Abbiamo aggiunto il CPC e i volumi perché una decisione di budget si
prende su click e costo per click, non su CTR e CPM presi da soli.

---

## 3. Il ragionamento

### I pubblici che abbiamo immaginato

Il pubblico non è nei dati. Lo abbiamo ricavato da tre segnali: quanto costa raggiungerlo (CPM), quanto
reagisce (CTR) e quanto spesso le stesse persone rivedono l'annuncio (frequenza). Dalla frequenza si stima
anche la grandezza del pubblico, come ordine di grandezza.

| Ad set | Pubblico proposto | CTR sulla media della campagna | CPM sulla media | Frequenza | Grandezza stimata |
|---|---|---|---|---|---|
| NDL-AS1 | Prospecting ampio: Italia 18-65, targeting aperto | 0,72x | 0,79x | 1,03 | oltre 10 milioni |
| NDL-AS2 | Interessi di categoria (skincare), pubblico freddo ma in tema | 0,87x | 0,91x | 1,03 | circa 5 milioni |
| NDL-AS3 | Lookalike 1-3% degli acquirenti | 0,96x | 1,05x | 1,04 | circa 640 mila |
| NDL-AS4 | Retargeting caldo: visitatori, carrelli abbandonati, clienti | 1,66x | 1,34x | 1,24 | circa 35 mila |
| CDF-AS1 | Prospecting ampio: Italia 18-65, targeting aperto | 0,73x | 0,79x | 1,03 | oltre 10 milioni |
| CDF-AS2 | Interessi di categoria (proprietari di cani e gatti) | 0,89x | 0,93x | 1,03 | circa 3 milioni |
| CDF-AS3 | Secondo pubblico per interessi, simile ad AS2 | 0,87x | 0,93x | 1,03 | circa 3,6 milioni |
| CDF-AS4 | Retargeting caldo: visitatori, carrelli abbandonati, clienti | 1,75x | 1,47x | 1,17 | circa 74 mila |
| FGR-AS1 | Prospecting ampio: Italia 18-65, targeting aperto | 0,75x | 0,69x | 1,03 | oltre 10 milioni |
| FGR-AS2 | Interessi di categoria (moda), pubblico freddo ma in tema | 0,86x | 0,90x | 1,03 | circa 3,5 milioni |
| FGR-AS3 | Lookalike 1-3% degli acquirenti | 0,88x | 1,25x | 1,04 | circa 730 mila |
| FGR-AS4 | Retargeting caldo: visitatori, carrelli abbandonati, clienti | 1,76x | 1,29x | 1,22 | circa 49 mila |

Come si legge:

- **AS1** ha il budget più alto, il CPM più basso e il CTR più basso, e la frequenza non si muove: è un
  pubblico enorme e freddo.
- **AS4** è l'opposto: budget piccolo, CPM alto, CTR quasi doppio e frequenza sopra 1,15. Le stesse poche
  persone rivedono l'annuncio: è chi conosce già il marchio.
- **AS3** di beauty e abbigliamento costa più di AS2 ma è piccolo e reagisce meglio dei pubblici freddi:
  sosia dei clienti.
- **AS2** sta in mezzo su tutto: persone scelte per interesse.

### Come ci siamo arrivati

Lo storico segue una struttura a fattori che si moltiplicano. Ogni fattore è stimato dai dati.

```
CTR = qualità dell'asset × pubblico dell'ad set × fatica della creatività × stagione × giorno della settimana
CPM = livello dell'ad set × stagione × giorno della settimana × (budget / budget iniziale)^0,26
      × fase di apprendimento × qualità dell'annuncio
```

Cosa abbiamo trovato nei dati:

1. **Il mercato 2025 anticipa il 2026.** Il CPM segue l'indice settimanale del 2025 spostato di 52 settimane,
   con rapporto 1 a 1. Le oscillazioni di un singolo settore non si ripetono, la curva comune sì: usiamo la
   media dei tre settori. Per il CTR si trasferisce il livello (agosto basso per l'abbigliamento, picco del
   Black Friday), non il rumore settimanale.
2. **La creatività si stanca.** Il CTR cala con l'età dell'annuncio fino a un pavimento. L'urgenza scende
   verso metà del valore iniziale in circa 16 giorni, la scarsità verso il 60% in circa 30.
3. **Più budget, CPM più alto.** Un solo ad set (NDL-AS4) ha avuto il budget raddoppiato per una settimana:
   da lì si legge che il CPM cresce con il budget elevato a 0,26. Nelle due settimane da prevedere sette ad
   set alzano il budget, fino a 2,5 volte.
4. **Fase di apprendimento.** Un annuncio nuovo paga il CPM circa il 13% in più per tre giorni e riceve una
   quota di spesa 1,6 volte più alta per quattro. Dopo un cambio di budget il CPM sale di circa il 6% per tre
   giorni.
5. **Cosa rende forte una creatività.** Un aggancio nei primi due secondi vale circa +18% di CTR, una grafica
   piena di testo circa -20%, un video di marca lento circa -10%. Con queste caratteristiche stimiamo le
   creatività mai viste (le sei del Black Friday che partono il 20 e il 23 novembre).
6. **Annunci migliori costano meno.** Il CPM scende quando la qualità dell'annuncio sale, e risale quando
   l'annuncio si stanca.
7. **Anomalie nei dati.** Il 14 ottobre tutti gli annunci pet hanno zero click (tracciamento rotto): escluso
   dalla stima. Il 21 ottobre un annuncio abbigliamento spende quattro volte il budget: escluso dalla stima
   delle quote di spesa.
8. **Gli eventi del calendario fuori dal Black Friday** (rientro, Halloween, Ognissanti, Singles Day) non
   lasciano tracce misurabili.

### Quanto ci fidiamo

Abbiamo nascosto al modello 14 giorni di storico, li abbiamo fatti prevedere e confrontato con i valori veri.
Ripetuto su quattro date diverse.

| Errore medio | Il nostro modello | "Resta come gli ultimi 7 giorni" |
|---|---|---|
| CPM, tutti gli annunci | 6,0% | 8,5% |
| CPM, annunci nuovi | 6,1% | 10,9% |
| CTR, pesato per impression | 15,0% | 19,6% |
| CTR, annunci nuovi | 16,7% | 24,1% |

Il CPM oscilla da solo di circa il 7% al giorno, quindi il 6% è vicino al minimo possibile. Le forchette
all'80% contengono il valore vero l'82-88% delle volte.

Cosa questa prova non copre, e quindi dove la previsione è più incerta:

- nello storico non ci sono né un Black Friday né aumenti di budget su più ad set insieme;
- l'effetto del budget sul CPM viene da un solo ad set;
- per il 30 novembre (Cyber Monday) seguiamo l'indice della settimana dopo il Black Friday, quindi il CTR
  previsto scende;
- le creatività mai viste hanno una forchetta larga, circa più o meno 35%.

### Cosa suggerisce lo strumento

- **Budget.** A spesa invariata, spostare budget dai pubblici ampi verso interessi e retargeting dà dal 3 al
  5% di click in più per campagna. Il guadagno è piccolo perché il CPM sale quando si spinge su un pubblico.
  Click non vuol dire vendite: il pubblico ampio alimenta il retargeting.
- **Creatività.** Video con una persona che parla e un aggancio nei primi due secondi. Evitare grafiche
  piene di testo e video di marca lenti.
- **Quando.** Le creatività di urgenza vanno cambiate ogni due o tre settimane, quelle di scarsità durano di più.

---

## Strumenti usati

Da completare dal team prima della consegna (la sfida chiede di dichiarare gli strumenti usati).

## Nota sui dati e sui personaggi

I dati della sfida sono simulati e sono di Wevion: il kit non è incluso in questo repository. Il sito mostra
solo ciò che serve ai grafici (previsioni, titoli degli annunci, ultimi 28 giorni di storico).

Gli omini sono i Pinglets, personaggi di Mekai Games. Non sono riutilizzabili senza permesso.
