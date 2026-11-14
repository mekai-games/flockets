# Flockets

**Prevedi le campagne di marketing prima di lanciarle: CTR, CPM e budget, simulati su un pubblico virtuale.**

Flockets immagina il pubblico di ogni ad set, prevede CTR e CPM di ogni annuncio giorno per giorno e aiuta a
decidere dove mettere il budget. Prima di spendere un euro.

Sotto le previsioni c'è una **popolazione virtuale**: tutti i 14.434 tipi di persona adulta in Italia, ognuno
convertito in 41 numeri. Su questa popolazione Flockets simula anche una **campagna nuova, senza nessun dato**:
chi la vede, chi clicca, chi visita il sito, chi compra, e quale pubblico, canale e formato rendono di più.

Sito: **https://flockets.vercel.app**

Progetto per The Big Hack 2026 (Napoli, 14-15 novembre), sfida Wevion «Clienti che non esistono».
Questa pagina segue le tre consegne chieste dalla sfida.

| Consegna | Dove sta |
|---|---|
| 1. Lo strumento | il [sito](https://flockets.vercel.app) (cartella [`web/`](web/)) e il motore di previsione ([`flockets/`](flockets/)) |
| 2. Le previsioni | [`output/previsioni_16-30_nov.csv`](output/previsioni_16-30_nov.csv): 699 righe, 51 annunci |
| 3. Il ragionamento | questa pagina, la scheda Consegne del sito e il video di 3 minuti |

---

## 1. Lo strumento

### Il sito

Il percorso è in cinque schermate.

1. **Home**: nome, frase e la folla del pubblico simulato.
2. **Come funziona**: il modello in otto passaggi, un esempio di calcolo, le colonne che servono, quanto ci
   fidiamo.
3. **Partenza**: una frase, un riquadro in stile chat dove descrivere l'annuncio e sotto la zona per allegare il
   CSV, con il tasto ⓘ che spiega che file serve. Con un file si analizza il file, senza i dati della sfida; due link
   aprono l'esempio inventato di un gioco per telefono e la campagna nuova senza dati. Invio per analizzare. Tutto
   dentro lo schermo, senza scorrere; in basso un prato in pixel art sale fino a poco sotto il prompt; gli omini ci camminano sparsi a distanze diverse (più piccoli e lenti quelli lontani), escono dai bordi e ne arrivano di nuovi.
4. **Campagna nuova**: nessun dato; si descrivono prodotto, annuncio, budget e pubblico, e Flockets la simula
   su tutti i tipi di persona: risultati con la forchetta, chi risponde, i tipi di persona migliori, alcune persone
   simulate con il loro motivo, e il consiglio su canale, formato, pubblico e leva.
5. **Risultati**: in alto i passi e il riquadro **Dati in uso** (quali dati, quale periodo, cosa mancava,
   cosa vogliono dire CTR e CPM); a sinistra il pubblico simulato, a destra l'analisi passo per passo.

| Passo | Cosa mostra |
|---|---|
| 1 Dati | cosa sto analizzando, quali dati uso e per cosa, cosa mancava e cosa ho assunto, i giorni esclusi, l'andamento del mercato |
| 2 Pubblici | chi c'è dietro ogni ad set, detto in parole: quanti sono, quanto cliccano e costano rispetto alla media |
| 3 Previsioni | i giorni scorrono: gli omini che esultano sono i click, quelli che dormono hanno visto l'annuncio troppe volte. Per ogni annuncio CTR e CPM con la forchetta di errore, e una frase che li spiega |
| 4 Decisioni | cursori del budget con ricalcolo immediato (anche sul pubblico simulato), proposta di riallocazione, creatività da sostituire |
| 5 Prova un annuncio | descrivi un annuncio nuovo e vedi come reagisce ogni pubblico, prima del lancio |
| Consegne | le tre consegne della sfida |

Il file d'esempio del gioco si rigenera con `python3 strumenti/esempio_gioco.py`: i numeri sono inventati
con una regola semplice e un seme fisso.

**Come il sito capisce il testo.** La descrizione dell'annuncio viene letta due volte. Subito, nel browser, con
regole a parole chiave. Poco dopo da Claude Haiku, tramite la funzione [`web/api/leggi.js`](web/api/leggi.js):
restituisce formato, leva e caratteristiche creative in forma strutturata, cioè gli stessi campi che il modello
usa per stimare una creatività mai vista, più una frase che dice da quali parole le ha dedotte. La zona
«Ho capito» mostra il risultato e lascia correggere ogni voce a mano. La chiave dell'API sta solo nella
variabile d'ambiente `ANTHROPIC_API_KEY` del progetto Vercel, mai nel codice; senza chiave il sito continua
con le regole.

A parte quella funzione il sito è statico: legge un solo file di dati preparato dal motore. Per vederlo in locale:

```bash
python3 -m http.server 4173 --directory web
```

Il logo è in [`design/logo.svg`](design/logo.svg); le proposte scartate sono nelle altre pagine di `design/`.

### Il motore

Il motore è il pacchetto Python [`flockets/`](flockets/) e usa solo `numpy` e `pandas`.

```bash
python3 esegui.py dati --sito --nome previsioni_16-30_nov
```

Il kit dei dati della sfida va messo nella cartella `dati/` (non è incluso in questo repository).
Il comando rifà tutto da zero in pochi secondi e scrive in `output/`:

| File | Cosa contiene |
|---|---|
| `previsioni_16-30_nov.csv` | le previsioni, una riga per annuncio e giorno |
| `pubblici_adset.csv` | il pubblico proposto per ogni ad set, con i numeri che lo motivano |
| `scenario_budget.csv` | dove spostare il budget dentro ogni campagna, a spesa invariata |
| `validazione_backtest.csv` | la prova sul passato: errore del modello contro un riferimento ingenuo |
| `prova_generalizzazione.csv` | la prova su un inserzionista mai visto |
| `parametri_modello.json` | i parametri stimati (fatica, elasticità al budget, giorno della settimana...) |

### Non solo il kit: qualsiasi storico

Il motore non è legato ai file della sfida. Gli basta **un CSV con data, annuncio, spesa, impression e click**;
i nomi delle colonne possono essere in italiano, inglese, spagnolo, francese o tedesco (per esempio
l'esportazione di Meta Ads Manager), le date all'italiana, i decimali con la virgola. Se lo stesso annuncio
compare in più ad set, o lo stesso giorno è diviso in più righe, il motore lo sistema e lo dice.

```bash
python3 esegui.py cartella_con_il_mio_storico
```

Tutto il resto è facoltativo e migliora la previsione: ad set e campagna, copertura, budget, date di lancio,
creatività con leva e descrizione, calendario, andamento del mercato. Ogni cosa che manca viene sostituita
con una scelta prudente e **dichiarata**: il motore scrive cosa mancava e cosa ha fatto.

Sul sito si può caricare lo stesso file: il motore gira **dentro il browser**, i dati non vengono inviati a
nessun server.

Come è costruito:

- **Fattori comuni e livelli propri.** Fatica della creatività, giorno della settimana, effetto del budget e
  peso delle caratteristiche creative sono comuni a tutti. Il livello di ogni ad set e di ogni creatività è
  proprio di quello storico. Se lo storico è troppo corto per stimare i fattori comuni, entrano i *valori di
  base* ([`flockets/valori_base.json`](flockets/valori_base.json)).
- **Stadio e affidabilità** su ogni riga: `storico`, `primi dati`, `mai vista`, `dopo modifica`,
  `fuori dominio`; affidabilità alta, media o bassa secondo la larghezza della forchetta.
- **Stagione a scelta**: indice settimanale di mercato se c'è, altrimenti CPM mensile, altrimenti piatta con
  forchetta più larga.
- **Livello recente.** Nei dati veri il livello di un annuncio si sposta nel tempo. Il motore fa una prova
  interna: nasconde gli ultimi giorni dello storico (fino a tre volte), li prevede dando più o meno peso al
  livello dell'ultima settimana e tiene il peso che sbaglia meno. Se l'ultima settimana è un salto netto
  (oltre 5 volte il suo rumore) la segue comunque. Sul kit la prova sceglie peso zero.
- **Fatica solo dove si vede.** Un annuncio già attivo il primo giorno dello storico è partito prima, non si
  sa quando: la sua fatica è considerata già assestata. La curva si cerca nei dati solo se almeno due
  annunci sono stati seguiti dalla prima settimana fino a oltre la quarta; altrimenti valgono i valori di base.

Quanto perde quando i dati sono poveri (stessa prova: 14 giorni nascosti dal 2 al 15 novembre):

| Dati a disposizione | Errore CPM | Errore CTR |
|---|---|---|
| Kit completo | 6,1% | 14,9% |
| Senza indice settimanale, con il CPM mensile | 8,2% | 14,8% |
| Senza alcun dato di mercato | 9,8% | 14,8% |
| Solo lo storico, colonne in inglese, niente budget né creatività | 8,1% | 16,7% |

L'ultima riga riguarda solo gli annunci già attivi: senza la tabella degli annunci futuri quelli nuovi non
si possono prevedere.

### Prova su dati veri

Il kit è simulato, quindi abbiamo cercato dati veri e pubblici. Un export di Meta a livello annuncio,
giornaliero e con licenza aperta non l'abbiamo trovato. Il migliore con licenza è il
[dataset di Conjura](https://figshare.com/articles/dataset/25314841) (CC BY 4.0): 79 marche di e-commerce
attive su Meta o TikTok, con spesa, impression e click al giorno per canale, dal 2019 al 2024. Lì ogni canale
vale come un annuncio: non ci sono creatività né ad set, quindi si misura solo la parte del motore che segue
i livelli nel tempo.

Per ogni marca e per otto date: 91 giorni di storico, 14 nascosti. In tutto 377 prove.

| Errore medio (tra parentesi la mediana) | CPM | CTR |
|---|---|---|
| Il motore com'era prima di questa prova | 22,6% (16,1%) | 30,3% (19,9%) |
| Il motore di oggi, senza dati di mercato | 19,0% (14,2%) | 23,1% (16,8%) |
| Il motore di oggi, con l'indice dell'anno prima ricavato dalle altre marche | 18,6% (13,2%) | 23,1% (16,5%) |
| «Resta come gli ultimi 7 giorni» | 18,6% (13,7%) | 22,1% (15,6%) |

Cosa abbiamo imparato:

- **Il motore perdeva contro il riferimento ingenuo.** Nel kit il livello di un annuncio è stabile, nei dati
  veri no. Da qui il *livello recente* e la *fatica solo dove si vede* descritti sopra. Sul kit non cambia
  nulla: le 699 previsioni e la validazione sono identiche, cifra per cifra.
- **Oggi è alla pari del riferimento, non meglio.** A livello di canale non c'è struttura da sfruttare:
  niente creatività, pubblici o budget. Il vantaggio compare dove c'è un segnale. Nella settimana del Black
  Friday 2023 l'indice dell'anno prima porta l'errore sul CPM dal 24,9% al 20,2%; nelle due settimane dopo
  il motore sbaglia il 21,4% contro il 28,7% del riferimento.
- **Il Black Friday dell'anno prima anticipa quello dopo, in rapporto 1 a 1.** Su 62 serie Meta il CPM nella
  settimana del Black Friday sale, rispetto a ottobre, di +0,40 (in logaritmo) nel 2022 e di +0,39 nel 2023.
  Usare l'aumento dell'anno prima con peso 1 porta l'errore da 0,47 a 0,26; con peso 0,87 è appena peggio.
  È la conferma su dati veri della scelta più delicata delle nostre previsioni. Sul CTR invece l'indice
  dell'anno prima non aiuta: nei dati veri il CTR di mercato in quella settimana si muove poco.
- Le forchette all'80% contengono il valore vero l'87% delle volte sul CPM e l'80% sul CTR.

Secondo controllo: un export vero di Meta Ads Manager a livello annuncio, in spagnolo (un'attività locale,
37 giorni, 24 annunci in 5 ad set, pochi click al giorno), trovato in un repository pubblico senza licenza:
usato solo in locale, non incluso qui. Il file viene letto così com'è, anche dal sito nel browser. Con 7
giorni nascosti su tre date: CPM 28,4% contro 30,9% del riferimento, CTR 23,4% contro 28,4%.

Per rifare le prove: [`strumenti/prova_conjura.py`](strumenti/prova_conjura.py) e
[`strumenti/prova_esterna.py`](strumenti/prova_esterna.py) (quest'ultimo su qualsiasi CSV).

### Le persone simulate

Il modello di previsione dice *quanto*; la popolazione sintetica dice *chi*, e funziona anche senza dati.
Codice: [`flockets/persone.py`](flockets/persone.py) e [`flockets/simulazione.py`](flockets/simulazione.py).

**1. Tutti i tipi di persona.** Otto tag: età (6 fasce), genere (2), area (5), tipo di comune (3), istruzione (3),
lavoro (4), reddito (3), famiglia (4). Sono 25.920 combinazioni; tolte quelle impossibili (uno studente di 70 anni,
un pensionato di 30) restano **14.434 tipi di persona**, ognuno con il suo peso: quanti adulti in Italia gli
somigliano, 50,1 milioni in tutto. Le quote sono approssimazioni ragionate degli ordini di grandezza ISTAT ed
Eurostat, non tabelle ufficiali: stanno tutte in `persone.py` e si possono sostituire.

**2. Dai tag ai numeri.** Ogni tipo diventa 41 parametri (elenco completo in
[`output/persone_parametri.csv`](output/persone_parametri.csv), database in `output/persone.csv.gz`):

| Gruppo | Parametri | Da quali tag |
|---|---|---|
| Canali | uso giornaliero di social, video brevi, ricerca, annunci prodotto, banner, video, email; saturazione pubblicitaria | età, istruzione, comune, genere |
| Interessi | probabilità di interesse per 15 categorie (moda, beauty, animali, videogiochi, tecnologia, casa, cibo, sport, viaggi, salute, bambini, auto, finanza, corsi, intrattenimento) | età, genere, famiglia, reddito, istruzione, comune, lavoro |
| Leve | sensibilità a sconto, urgenza, scarsità, prova sociale, novità e tendenze, parere di un esperto, valori | età, reddito, istruzione, genere, famiglia |
| Formati | preferenza per immagine, carosello, video breve, video, testo | età |
| Acquisto | acquisti online, navigazione da telefono, fiducia in un marchio nuovo, potere d'acquisto | età, istruzione, area, reddito, famiglia, lavoro |
| Costo | quanto costa raggiungerla rispetto alla media (concorrenza tra inserzionisti) | età, reddito, genere, comune |

La regola è sempre leggibile: un valore di base, e ogni tag lo sposta di una quantità fissa (somma sulla scala
logistica per le probabilità, prodotto per i moltiplicatori).

**3. La campagna, persona per persona.** Per ogni tipo di persona e ogni giorno: quante persone il canale può
raggiungere dentro il pubblico scelto (ampio, interessi, sosia, retargeting, filtri per età, genere, area); come
la piattaforma divide il budget (preferisce chi risponde meglio all'obiettivo e costa meno, con un tetto di
frequenza; i pubblici stretti costano di più); probabilità di click (interesse, momento d'acquisto, formato, leve,
creatività, marchio, tendenza, stanchezza); probabilità di arrivare sul sito; probabilità di comprare (intenzione,
prezzo rispetto a quanto può spendere, acquisti online, sconto, fiducia nel marchio, telefono o computer).

**4. Tarata su dati veri.** Le costanti di ogni canale e settore sono scelte perché una campagna normale dia i
valori tipici di 79 marche vere ([`flockets/benchmark.json`](flockets/benchmark.json), ricavato con
[`strumenti/benchmark_conjura.py`](strumenti/benchmark_conjura.py) dal dataset Conjura, CC BY 4.0): CTR e CPM per
canale, acquisti ogni 100 visite e valore dell'ordine per settore, andamento nei mesi. Stanchezza delle creatività,
giorno della settimana, effetto del budget e peso delle caratteristiche creative vengono dal modello di previsione.
Due ipotesi dichiarate: sui social il dataset conta tutti i click, gli annunci quelli verso il sito (circa 0,55);
l'email non è nel dataset, i suoi valori sono ipotesi.

**5. Con lo storico, si allinea.** Dove ci sono dati, le persone di ogni pubblico vengono tarate finché click e costi
tornano con le previsioni del modello strutturale. Le 699 previsioni non cambiano; le persone aggiungono chi
clicca, chi compra e una stima degli acquisti (nel kit non ci sono acquisti: è una stima).

**6. Il consiglio.** Con lo stesso budget prova 20-30 combinazioni di canale, formato, pubblico e leva e le ordina
per acquisti, click o persone raggiunte, secondo l'obiettivo. Il retargeting non viene proposto a un marchio nuovo.

**Prova a freddo.** Sui dati della sfida abbiamo previsto i 12 pubblici **senza usare lo storico**: solo categoria,
tipo di pubblico, budget, creatività e date ([`output/prova_a_freddo.csv`](output/prova_a_freddo.csv)).

| Ultimi 28 giorni | Simulazione delle persone | Valore tipico fisso |
|---|---|---|
| Errore sul CTR | 25,1% | 22,7% |
| Errore sul CPM | 17,2% | 22,3% |
| Ordine dei pubblici, correlazione CTR / CPM | 0,94 / 0,97 | non lo distingue |

A freddo il livello del CTR non è migliore di un valore fisso; il costo sì, e soprattutto l'**ordine** dei pubblici
(chi clicca di più, chi costa di più) è giusto. Onestà: la correzione sui click social e la regola sui pubblici
stretti le abbiamo aggiunte dopo aver visto un primo risultato peggiore (CTR 144%, ordine del CPM 0,56), quindi
la prova non è del tutto cieca. Sono regole generali, non numeri presi dal kit.

Sul sito: pagina **Campagna nuova**, e nel passo Pubblici le persone dentro ogni ad set. Da riga di comando:

```python
from flockets import simulazione
r = simulazione.simula({"descrizione_prodotto": "Siero viso alla vitamina C", "prezzo": 29, "sconto": 0.2,
                        "marchio": "nuovo", "canale": "social", "budget_giorno": 100, "giorni": 14,
                        "testo_annuncio": "Video: una ragazza parla in camera, -20% solo oggi"})
r["totali"], r["segmenti"], r["persone"]
simulazione.consiglia({...})   # le combinazioni migliori con lo stesso budget
```

### Come è diviso il codice

| File | Cosa fa |
|---|---|
| [`flockets/contratto.py`](flockets/contratto.py) | il contratto dei dati: riconosce le colonne, controlla, riempie ciò che manca |
| [`flockets/motore.py`](flockets/motore.py) | il modello: stagione, CTR, CPM, quote di spesa, incertezza, stadio, prova sul passato |
| [`flockets/persone.py`](flockets/persone.py) | tutti i tipi di persona, il loro peso e la conversione dei tag in 41 numeri |
| [`flockets/simulazione.py`](flockets/simulazione.py) | campagna simulata persona per persona, consigli, integrazione con le previsioni, prova a freddo |
| [`flockets/rapporto.py`](flockets/rapporto.py) | pubblici, scenario di budget, prova di generalizzazione, dati per il sito |
| [`esegui.py`](esegui.py) | esegue tutto da riga di comando |
| [`web/`](web/) | il sito: `js/scena.js` (omini), `js/grafici.js` (grafici), `js/motore.js` (il motore nel browser), `js/app.js` |
| [`web/api/leggi.js`](web/api/leggi.js) | la funzione che legge la descrizione di un annuncio con Claude Haiku |
| [`strumenti/prova_esterna.py`](strumenti/prova_esterna.py) | prova il motore su uno storico qualsiasi: nasconde gli ultimi giorni e confronta |
| [`strumenti/benchmark_conjura.py`](strumenti/benchmark_conjura.py) | ricava dal dataset Conjura i valori reali di partenza del simulatore |
| [`strumenti/prova_conjura.py`](strumenti/prova_conjura.py) | la prova sulle 79 marche vere del dataset Conjura |
| [`strumenti/esempio_gioco.py`](strumenti/esempio_gioco.py) | crea il file d'esempio del sito (campagna inventata per un gioco per telefono) |
| [`strumenti/atlante.py`](strumenti/atlante.py) | unisce i fogli di animazione dei personaggi in una sola immagine |
| [`design/`](design/) | logo e proposte di logo |

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
Ripetuto su sette date diverse, una a settimana.

| Errore medio | Il nostro modello | "Resta come gli ultimi 7 giorni" | Minimo possibile |
|---|---|---|---|
| CPM, tutti gli annunci | 6,1% | 8,1% | 5,8% |
| CPM, annunci nuovi | 6,2% | 11,3% | 5,8% |
| CTR, pesato per impression | 13,7% | 18,0% | 11,0% |
| CTR, annunci nuovi | 16,7% | 23,1% | 10,6% |

**Minimo possibile** è l'errore che resterebbe anche a un modello perfetto. Il CPM oscilla da solo di circa il
7% da un giorno all'altro, senza memoria: l'errore di oggi non dice nulla su quello di domani. Sul CTR un
annuncio raccoglie in media una quarantina di click al giorno, quindi il CTR di un singolo giorno balla per
puro caso anche quando il tasso vero è noto. Il modello è a 0,3 punti dal minimo sul CPM e a 2,7 sul CTR; lo
scarto sul CTR viene per metà dalle creatività mai viste, che sono un quinto delle righe: lì l'errore è
quello della stima a freddo (circa 14%), e 30 esempi di creatività non bastano a fare meglio.

**Si può abbassare ancora?** Abbiamo provato a spostare uno alla volta tutti i parametri (forza dei vincoli
su asset e pubblici, soglia della stagione, curva di fatica su una griglia più fitta, peso dell'indice di
mercato, effetto del budget) sulle stesse sette date: nessuna variazione migliora l'errore di più di 0,03
punti, cioè meno del rumore tra una data e l'altra. I valori sono rimasti quelli. Le forchette all'80%
contengono il valore vero l'81-89% delle volte.

**Il punto più delicato: la settimana del Black Friday.** Lì l'indice di mercato del CPM vale +0,46 (in
logaritmo), mentre nello storico non supera +0,18: il modello lo usa in rapporto 1 a 1 oltre ciò che ha visto.
Due stime indipendenti di quel rapporto danno 0,87 (lasciato libero sullo storico) e 0,86-0,88 (stagione 2025
contro 2026 nei CPM mensili del kit); in novembre 2025 però i CPM mensili salgono più dell'indice. Nelle prove
sul passato i valori tra 0,87 e 1,07 danno lo stesso errore. Abbiamo tenuto 1 e allargato la forchetta del CPM
dove l'indice esce dallo storico.

**Vale anche su un inserzionista mai visto?** Abbiamo tolto un inserzionista alla volta: i fattori comuni
sono stati stimati solo sugli altri due, di lui soltanto i livelli.

| Errore medio | CPM | CTR |
|---|---|---|
| Storico intero, fattori comuni dagli altri | 6,1% | 15,6% |
| Storico intero, tutto dai suoi dati | 6,1% | 14,9% |
| 3 settimane di storico, fattori comuni dagli altri | 6,2% | 16,2% |
| 3 settimane di storico, tutto dai suoi dati | 6,4% | 17,2% |
| «Resta come gli ultimi 7 giorni» | 8,8% | 23,6% |

I fattori imparati dagli altri valgono quasi quanto quelli imparati sui suoi dati, e aiutano quando lo
storico è corto. È una prova dentro il kit, che è fatto di dati simulati: quella su dati veri è più sopra, in «Prova su dati veri».

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

Dentro il prodotto: Claude Haiku 5.5 (API di Anthropic) legge la descrizione dell'annuncio sul sito; Pyodide fa
girare il motore nel browser; numpy e pandas per i calcoli. Dati esterni: dataset Conjura (CC BY 4.0), usato per
la prova su dati veri e per i valori di partenza del simulatore delle persone (`flockets/benchmark.json`).

Gli strumenti usati per sviluppare sono da completare dal team prima della consegna (la sfida chiede di dichiararli).

## Nota sui dati e sui personaggi

I dati della sfida sono simulati e sono di Wevion: il kit non è incluso in questo repository. Il sito mostra
solo ciò che serve ai grafici (previsioni, titoli degli annunci, ultimi 28 giorni di storico).

Gli omini sono i Pinglets, personaggi di Mekai Games. Non sono riutilizzabili senza permesso.
