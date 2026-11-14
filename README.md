# Flockets

**Prevedi le campagne di marketing prima di lanciarle: CTR, CPM e budget, simulati su un pubblico virtuale.**

Flockets immagina il pubblico di ogni ad set, prevede CTR e CPM di ogni annuncio giorno per giorno e aiuta a
decidere dove mettere il budget. Prima di spendere un euro.

Sotto le previsioni c'è una **popolazione virtuale**: tutti i 14.434 tipi di persona adulta in Italia, ognuno
convertito in 41 numeri. Su questa popolazione Flockets simula anche una **campagna nuova, senza nessun dato**:
chi la vede, chi clicca, chi visita il sito, chi compra, e quale pubblico, canale e formato rendono di più.

Sito: **https://www.flockets.site**

Progetto per The Big Hack 2026 (Napoli, 14-15 novembre), sfida Wevion «Clienti che non esistono».
Questa pagina segue le tre consegne chieste dalla sfida.

| Consegna | Dove sta |
|---|---|
| 1. Lo strumento | il [sito](https://www.flockets.site) (cartella [`web/`](web/)) e il motore di previsione ([`flockets/`](flockets/)) |
| 2. Le previsioni | [`output/previsioni_16-30_nov.csv`](output/previsioni_16-30_nov.csv): 699 righe, 51 annunci |
| 3. Il ragionamento | questa pagina, la pagina «Come funziona» del sito e il video di 3 minuti |

---

## 1. Lo strumento

### Il sito

Il percorso è in cinque schermate, in tema chiaro o scuro (bottone sole / luna in alto; la prima volta segue il
sistema, poi la scelta resta nel browser). Bottoni e riquadri sono di vetro (stile «liquid glass»: traslucidi, sfocano lo
sfondo, riflesso in alto), su macchie di colore leggere; nel tema scuro anche il prato sfuma verso lo scuro.

1. **Home**: nome, frase e la folla del pubblico simulato.
2. **Come funziona**: a riquadri e frecce, poco testo: il percorso in cinque passi (dall'annuncio al consiglio),
   i due modelli che lavorano insieme (quello di intelligenza artificiale che legge e traduce, quello di previsione
   con le persone simulate che calcola), cosa decide ogni persona, l'accuratezza in quattro numeri, cosa è stimato
   e cosa è un'ipotesi, le colonne del file.
3. **Partenza**: una frase, un riquadro in stile chat dove descrivere l'annuncio e sotto la zona per allegare il
   CSV, con il tasto ⓘ che spiega che file serve. Tutto dentro lo schermo, senza scorrere; in basso un prato in
   pixel art con gli omini che camminano.
   - **Solo il testo**: l'annuncio diventa una campagna nuova. Dal testo si leggono canale (TikTok, Instagram,
     Google…), budget al giorno o totale, durata, prezzo, sconto, marchio nuovo o famoso, obiettivo, e se il
     risultato sono acquisti, download o iscrizioni; categoria, formato, leve e creatività li legge il motore (e
     Claude, se la chiave è attiva). Quello che manca prende un valore prudente e viene detto.
   - **Con un file**: si analizza il file; l'annuncio scritto, se c'è, viene provato sulle sue campagne.
   - Tre link aprono i dati della sfida, l'esempio inventato di un gioco per telefono e il modulo completo.
4. **Campagna nuova** (modulo completo): prodotto, annuncio, budget, canale e obiettivo. Il pubblico non si
   sceglie: Flockets prova la stessa campagna, con lo stesso budget, su ogni tipo di pubblico (ampio, interessi,
   sosia dei clienti e, se il marchio è già noto, chi ha visitato il sito) e il migliore è un risultato dell'analisi.
5. **Analisi**: mentre il motore calcola, una transizione senza scritte (ispirata a «Pixel Transition» di React Bits):
   lo schermo si copre di quadrati che partono dal punto di invio, gli omini arrivano dai bordi e si raccolgono in uno
   stormo al centro, sempre più grande; alla fine fanno festa e i quadrati si dissolvono scoprendo la vista Persone. Poi due viste, con un interruttore in alto:
   - **Persone**: solo omini su una griglia di pallini, come una dashboard. Ognuno è una persona simulata di uno
     dei pubblici; un perimetro di 1 pixel dice cosa ha fatto (verde ha comprato, arancio ha cliccato,
     grigio niente) e chi ha comprato ogni tanto fa festa. I pallini si spostano e si colorano vicino al puntatore e
     si accendono sotto i piedi degli omini. Toccando un omino si apre la sua scheda, sempre dentro lo schermo
     (sopra la testa, se non c'è posto sotto i piedi o di fianco): chi è, dove vive, cosa ha fatto, probabilità di
     click e di acquisto, quanto rende ogni euro speso su di lei, perché, e quante persone come lei ci sono in
     Italia. I bottoni in basso evidenziano un tipo di pubblico. Con la rotella, il pizzico o i tasti +/− si zooma: allontanandosi si vedono il
     doppio degli omini; trascinando ci si sposta.
   - **Analisi**: parte da quello che hai mandato (l'annuncio tra virgolette con la riga «Dal tuo testo» e il link per
     correggere, oppure il nome del file). Poi una frase con il risultato e i numeri principali che salgono da
     zero; il pubblico migliore con il confronto con gli altri; cosa fare adesso (pubblico, canale e leve
     provati alla pari, chi risponde meglio, creatività stanche); **Studia i numeri**, un grafico da esplorare
     (visualizzazioni, click, acquisti, ricavi, spesa, costo per acquisto; giorno per giorno o totale che cresce;
     tutto insieme o pubblico per pubblico; forchetta 8 volte su 10; passando il dito si leggono i valori del
     giorno); **E se cambi budget?**, un cursore che ricalcola risultati, costo e ritorno (con l'elasticità del
     motore: raddoppiando il budget ogni visualizzazione costa circa il 20% in più); **Dal vedere al comprare**,
     l'imbuto da visualizzazioni a click, visite e acquisti; **Quando si ripaga**, spesa e ricavi cumulati;
     tutti i pubblici dal migliore al meno conveniente; i gruppi di persone che rispondono di più.

Le animazioni (griglia di pallini, numeri che salgono, luce che segue il puntatore sulle schede) sono scritte da
zero in JavaScript, ispirate ai componenti Dot Grid, Count Up e Spotlight Card di
[React Bits](https://reactbits.dev): il sito resta senza React e senza librerie.

La vecchia interfaccia a passi (Dati, Pubblici, Previsioni, Decisioni, Prova un annuncio, Consegne) è stata tolta il
14/11: le previsioni si scaricano dal fondo dell'analisi, il resto delle consegne sta in questo README e in `output/`.

Il file d'esempio del gioco si rigenera con `python3 strumenti/esempio_gioco.py`: i numeri sono inventati
con una regola semplice e un seme fisso.

**Come il sito capisce il testo.** La descrizione dell'annuncio viene letta due volte. Subito, nel browser, con
regole a parole chiave. Poco dopo da Claude Haiku 5.5, tramite la funzione [`web/api/leggi.js`](web/api/leggi.js),
con uscita strutturata (JSON con schema fisso): formato, leva e caratteristiche creative, cioè gli stessi campi che
il modello usa per stimare una creatività mai vista, più la campagna (prodotto, categoria, canale, budget al giorno,
durata, prezzo, sconto, marchio nuovo o noto, obiettivo, tipo di risultato, gratis o no, leve dell'offerta) che il
simulatore usa quando l'annuncio arriva senza file. Quello che Claude legge vale più delle regole; un valore non
detto resta alle regole o a un valore prudente. Nell'analisi la riga «Dal tuo testo» mostra cosa è stato letto, con il
link per correggerlo; mentre si scrive il prompt non compare niente. Sul sito non si nomina Claude. La chiave dell'API sta solo nella
variabile d'ambiente `ANTHROPIC_API_KEY` del progetto Vercel, mai nel codice; senza chiave il sito continua
con le regole.

**Foto e video dell'annuncio.** Nella zona degli allegati si può mettere anche la creatività: una foto o un video
(MP4, MOV). Dal video il browser prende fino a sei fotogrammi, fitti nei primi secondi; foto e fotogrammi partono
rimpiccioliti (al massimo 1024 o 768 pixel), mai il file intero. La stessa funzione `/api/leggi` li guarda insieme al
testo: descrive cosa si vede, trascrive le scritte, riconosce aggancio, ritmo, persona in camera, prezzo barrato, e
compila la stessa campagna del prompt. Il testo per il motore diventa: quello scritto, più la descrizione e le scritte
della creatività; il formato viene dal file se il testo non lo dice. Funziona anche con il solo video o la sola foto.
Nell'analisi la creatività compare accanto al titolo, con quello che si vede e le scritte lette. Le foto e i video allegati
compaiono nella zona dei file, ognuno con la sua anteprima e la sua ✕; più foto insieme diventano un carosello. Prove in
[`strumenti/prove_media/`](strumenti/prove_media/): dal video di prova legge l'aggancio «Pelle spenta?», il prodotto e
«-30% solo oggi · Compra ora» (voto del messaggio 7/10); dalla foto anche «Spedizione gratuita».

**Come è fatta la creatività.** Oltre a cosa dice, il modello usa come è fatto l'annuncio:

- **misure dei pixel**, calcolate nel browser su foto e fotogrammi ridotti a 48 × 48: luce, contrasto, vivacità dei colori
  (indice di Hasler e Süsstrunk), colore dominante e tavolozza, quota di colori caldi, formato (verticale, quadrato,
  orizzontale), e per i video durata e quanto cambia la scena tra un fotogramma e l'altro. Sono stabili: due foto che
  differiscono solo per un colore danno misure diverse;
- **presentazione**, dalla lettura: volto in primo piano, sguardo in camera, prodotto in primo piano o in uso, prezzo e logo
  visibili, sottotitoli, prima e dopo, quanto testo e se si legge, come si apre il video, stile (giovane e dinamico,
  elegante, informativo, emozionale, divertente).

Nel simulatore ognuna sposta un po' la probabilità di click o di acquisto (per esempio formato verticale su TikTok +8%
di click, orizzontale −11%; sottotitoli +5%; prezzo visibile +5% di acquisti); lo stile cambia l'effetto secondo il tipo di
persona (uno stile giovane piace di più ai 18-34 e meno agli over 55). Gli effetti si sommano con un tetto morbido. Sono
**ipotesi** da regole generali sulla pubblicità, non stime sui dati della sfida; l'analisi le mostra una per una nella
scheda «La tua creatività».

Prova ([`strumenti/prova_creativita.py`](strumenti/prova_creativita.py), foto in [`strumenti/prove_media/`](strumenti/prove_media/)):
la stessa foto con piccole differenze, testo «Su Instagram, 50 euro al giorno per 2 settimane». «Solo pixel» usa la stessa
lettura per tutte, così cambiano solo le misure; «completa» rilegge ogni foto, come sul sito.

| Variante | Misure | Click, solo pixel | Click, completa | Acquisti, completa |
|---|---|---|---|---|
| sfondo beige, scritta rossa (base) | arancio, contrasto 0,11, luce 0,87 |  |  |  |
| sfondo blu acceso, scritta gialla | blu, contrasto 0,13, luce 0,42 | +0% | +6% | +6% |
| sfondo quasi nero, scritta rossa | arancio, contrasto 0,21, luce 0,18 | +7% | +13% | +13% |
| sfondo grigio, scritta grigia | arancio, contrasto 0,07, luce 0,77 | −1% | −1% | −3% |
| come la base, ma «Nuovo siero» al posto di «-30% SOLO OGGI» | arancio, contrasto 0,11, luce 0,88 | −0% | +3% | −23% |

Le differenze dei soli pixel sono piccole (fino a +7% per lo sfondo scuro, più contrasto). Nella lettura completa si aggiunge
la variabilità della lettura, circa ±5% sul voto e sulla presentazione: differenze sotto il 5% non sono significative.

**Prompt e storico: due ingressi facoltativi e complementari.** Serve almeno uno dei due (il prompt, una foto o un video, o un CSV).

| Cosa mandi | Cosa succede |
|---|---|
| Solo il prompt | campagna nuova: tutto quello che il testo dice diventa un ingresso del simulatore; il resto prende valori prudenti, scritti nell'analisi |
| Solo il file | previsioni del modello sulle tue campagne, con le persone tarate sopra |
| Prompt e file | l'annuncio scritto viene simulato con i livelli veri della tua marca presi dal file (taratura: di quanto i tuoi click e i tuoi costi si discostano dal tipico del settore, media pesata sulla spesa; se il testo nomina una delle campagne del file si usa solo quella). Budget, durata, partenza e categoria vengono dal file quando il testo non li dice. Un interruttore passa da «Il tuo annuncio» a «Le tue campagne», dove c'è anche come andrebbe l'annuncio su ognuna |

**Cosa pesa del prompt.** Oltre a canale, budget, durata, prezzo, sconto, categoria, marchio, obiettivo e leve:

- **a chi è rivolto** («per donne 25-44 a Milano», «per mamme», «over 55»): diventa un filtro su tutti i tipi di
  pubblico provati (età, genere, area, comune, reddito, famiglia);
- **quando parte** («a dicembre», «per Natale», «per il Black Friday»): cambia stagione, costi e propensione all'acquisto;
- **vantaggi dell'offerta** (spedizione o reso gratuiti, garanzia, rate, regalo, prova gratuita): circa +8% di acquisti
  dopo il click ciascuno, al massimo +27% (ipotesi);
- **forza del messaggio**, da 0 a 10, su cinque criteri da 0 a 2: offerta concreta, credibilità e invito all'azione
  contati sul testo (così prompt quasi uguali hanno lo stesso voto), adatto al canale dal formato, beneficio giudicato
  da Claude. Nel simulatore sposta la probabilità di click di circa il 6% a punto (da −26% a +35% rispetto a 5/10).
  Claude propone anche fino a tre modifiche al testo, mostrate nella scheda «Il tuo messaggio».

Senza Claude le stesse cose vengono lette con regole a parole chiave (pubblico, vantaggi, periodo), tranne la forza del
messaggio. Con Claude, dove Claude non dice niente restano le regole; la categoria scelta da Claude viene controllata
con le parole del testo (in una prova aveva preso una crema viso per «bambini e famiglia»).

**Prove sul prompt** ([`strumenti/prova_prompt.mjs`](strumenti/prova_prompt.mjs), [`strumenti/simula_prove.py`](strumenti/simula_prove.py),
risultati in [`output/prova_prompt.csv`](output/prova_prompt.csv)). Sedici annunci quasi uguali, letti dal vero
Claude Haiku e simulati dal motore. Base: «Video su TikTok: una ragazza prova la crema viso alla vitamina C. -20% solo
fino a domenica. 50 euro al giorno per 2 settimane.»

| Una sola differenza rispetto alla base | Voto | Acquisti | Perché |
|---|---|---|---|
| la stessa base, letta una seconda volta dal vivo | 5 | +3% | rumore della lettura: le caratteristiche creative lette da Claude |
| sconto 30% invece di 20% | 5 | +22% | più persone sensibili allo sconto cliccano e comprano |
| senza sconto | 3 | −45% | niente leva sul prezzo, offerta meno concreta |
| Instagram invece di TikTok | 5 | +109% | costo per 1.000 visualizzazioni più basso e più acquisti dopo il click (dati di settore) |
| 100 € al giorno invece di 50 | 5 | +67% | più persone, ma ogni visualizzazione costa circa il 20% in più |
| + per donne 25-44 | 5 | −13% | pubblico più stretto: clicca un po' di più ma costa il 27% in più |
| + spedizione gratuita | 5 | +8% | più acquisti dopo il click |
| + 5.000 recensioni a 5 stelle | 7 | +19% | credibilità e leva della prova sociale |
| + «Compra ora!» | 7 | +9% | invito all'azione |
| messaggio debole («Crema viso. Su TikTok…») | 1 | −51% | niente beneficio, niente offerta |
| marchio appena nato | 5 | −56% | meno fiducia e niente pubblico di chi conosce già il marchio: vince «sosia dei clienti» |
| prezzo 89 € invece del tipico 35 € | 5 | −40% | il prezzo pesa sul portafoglio di molte persone |
| a dicembre, per Natale | 5 | +11% | dicembre costa meno di novembre e si compra di più |
| per uomini over 55 | 5 | −99% | pubblico minuscolo e poco interessato: l'analisi avvisa che il budget è troppo per loro |
| annuncio su Google | 5 | +565% | chi cerca è già pronto a comprare; il numero è gonfiato dall'ipotesi che il marchio abbia visitatori da raggiungere di nuovo (con il pubblico ampio: +134%) |

Le direzioni sono quelle attese e le differenze piccole danno cambi piccoli. Le differenze sotto il 5% stanno nel
rumore della lettura. Quando il testo non dice se il marchio è nuovo, il modello assume che sia conosciuto e che ci
siano visitatori del sito da raggiungere: per questo «Già vicini al marchio» vince spesso, e l'analisi lo scrive.

A parte quella funzione il sito è statico: legge un solo file di dati preparato dal motore. Per vederlo in locale:

```bash
python3 -m http.server 4173 --directory web
```

Il logo è in [`design/logo.svg`](design/logo.svg); le proposte scartate sono nelle altre pagine di `design/`.

### Account e progetti salvati

Il sito funziona tutto senza account. Con un account (bottone **Accedi** in alto) ogni analisi aperta viene
salvata da sola e si ritrova in **Profilo → I tuoi progetti**, da qualsiasi dispositivo; si può riaprire identica,
rinominare o cancellare. Se si apre un'analisi prima di entrare, viene salvata appena si accede.

- Database: Supabase, progetto `flockets` (Francoforte). Tabelle `profili` e `progetti` con RLS: ognuno legge e
  modifica solo le sue righe. Lo schema sta in [`supabase/migrations/`](supabase/migrations/).
- Accesso con email e password già attivo. Google, Apple, GitHub e Microsoft compaiono da soli nella finestra di
  accesso appena vengono attivati in Supabase (Authentication → Sign In / Providers), con le credenziali create
  sul sito di ogni provider. L'indirizzo di ritorno da dare al provider è
  `https://zfjofmbyzxulejornexe.supabase.co/auth/v1/callback`.
- Apple: su Apple Developer un Services ID (`site.flockets.web`, è il Client ID) con «Sign in with Apple», dominio
  `zfjofmbyzxulejornexe.supabase.co` e l'indirizzo di ritorno qui sopra, più una chiave «Sign in with Apple» (.p8).
  Il segreto per Supabase si genera in locale con [`strumenti/apple_segreto.mjs`](strumenti/apple_segreto.mjs) e
  dura 6 mesi. I file `.p8` sono esclusi dal repository.
- Le email (conferma, password dimenticata) per ora passano dal server di prova di Supabase, che scrive solo ai
  membri del team: per il pubblico serve un SMTP vero (Authentication → Emails → SMTP). Finché non c'è, la
  conferma dell'email alla registrazione è spenta.
- In locale il sito va servito su `localhost:3000` (è tra gli indirizzi di ritorno ammessi):
  `python3 -m http.server 3000 --directory web`.

### Portachiavi con QR

Ogni portachiavi stampato ([`stampa3d/`](stampa3d/)) ha un codice; il QR apre `#/q/CODICE`. Se il codice è libero,
chi ha un account lo collega a uno dei suoi progetti; dopo, il QR apre quel progetto a chiunque, anche senza
account. I codici stanno nella tabella `qr`; chi non è il proprietario passa solo dalla funzione `apri_qr`, che
restituisce il progetto di quel codice e nient'altro. I lotti si creano con `stampa3d/lotto.py`.

### App per iPhone

[`ios/`](ios/) è un'app nativa (UIKit e WKWebView, iOS 17 o più, solo iPhone, bundle `site.flockets.app`) che porta
il sito dentro di sé.

- **Il sito è incluso.** Una fase della build copia `web/` (senza `api/` e `node_modules/`) nel pacchetto; l'app lo
  serve da un indirizzo suo, `flockets://localhost/`, così localStorage e sessione restano tra un'apertura e
  l'altra. Le chiamate a `/api/…` le inoltra al sito online. Il motore Python e la libreria di Supabase arrivano
  dalla rete come nel sito: per analizzare serve la connessione.
- **Parti native.** Accedi con Apple dal foglio di sistema (il token va a Supabase con `signInWithIdToken`);
  Google in una finestra di Safari che torna a `site.flockets.app://login-callback`; foto, video e fotocamera dal
  campo degli allegati; il bottone **Condividi** nell'analisi (istantanea dello schermo più un riassunto); i file
  scaricati si aprono nel foglio Condividi; le fasce dell'ora e della barra home prendono il colore della pagina.
- **Il sito sa di essere nell'app** da `window.FlocketsNativo` e dalla classe `in-app` su `<html>`
  ([`web/js/nativo.js`](web/js/nativo.js), un ramo in `account.js`, poche regole in fondo a `style.css`).
- **Supabase** deve ammettere l'app: provider Apple → Client IDs `site.flockets.web,site.flockets.app`;
  URL Configuration → Redirect URLs `site.flockets.app://login-callback`.
- Icona e schermata di avvio: `python3 strumenti/risorse_ios.py` (dal logo).
- Build per il simulatore:
  `xcodebuild -project ios/Flockets.xcodeproj -scheme Flockets -destination 'platform=iOS Simulator,name=iPhone 17' build`.

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

**6. Il pubblico migliore è un risultato.** In una campagna nuova il pubblico non si sceglie prima: la stessa campagna,
con lo stesso budget, viene simulata su ogni tipo di pubblico che il canale permette (`analizza_campagna`), e il
migliore è quello con più acquisti, click o persone raggiunte, secondo l'obiettivo. Per ognuno restano numeri,
giorni, gruppi che rispondono e alcune persone. Il retargeting non viene proposto a un marchio nuovo.

**7. Il consiglio.** Con lo stesso budget prova 20-30 combinazioni di canale, formato, pubblico e leva e le ordina
nello stesso modo.

**Prova a freddo.** Sui dati della sfida abbiamo previsto i 12 pubblici **senza usare lo storico**: solo categoria,
tipo di pubblico, budget, creatività e date ([`output/prova_a_freddo.csv`](output/prova_a_freddo.csv)).

| Ultimi 28 giorni | Simulazione delle persone | Valore tipico fisso |
|---|---|---|
| Errore sul CTR | 25,1% | 22,7% |
| Errore sul CPM | 13,3% | 22,3% |
| Ordine dei pubblici, correlazione CTR / CPM | 0,94 / 0,81 | non lo distingue |

A freddo il livello del CTR non è migliore di un valore fisso; il costo sì, e soprattutto l'**ordine** dei pubblici
(chi clicca di più, chi costa di più) è giusto. Onestà: la correzione sui click social e la regola sui pubblici
stretti le abbiamo aggiunte dopo aver visto un primo risultato peggiore (CTR 144%, ordine del CPM 0,56), quindi
la prova non è del tutto cieca. Sono regole generali, non numeri presi dal kit.

Il 14/11 il simulatore ha preso anche l'elasticità del costo al budget stimata dal modello di previsione (0,26: con il
doppio del budget ogni visualizzazione costa circa il 20% in più). Prima un budget doppio dava esattamente il doppio
degli acquisti. Sulla prova a freddo l'errore sul CPM è sceso da 17,2% a 13,3%, ma l'ordine dei pubblici per costo è
sceso da 0,97 a 0,81: nei dati della sfida i pubblici di chi conosce già il marchio hanno budget piccoli e costi alti,
e l'elasticità, che vale per lo stesso pubblico nel tempo, li avvicina agli altri. Lo teniamo perché le prove sul
budget di una campagna nuova devono avere rendimenti decrescenti.

Sul sito: pagina **Campagna nuova** e vista **Persone** dell'analisi. Da riga di comando:

```python
from flockets import simulazione
r = simulazione.simula({"descrizione_prodotto": "Siero viso alla vitamina C", "prezzo": 29, "sconto": 0.2,
                        "marchio": "nuovo", "canale": "social", "budget_giorno": 100, "giorni": 14,
                        "testo_annuncio": "Video: una ragazza parla in camera, -20% solo oggi"})
r["totali"], r["segmenti"], r["persone"]
simulazione.analizza_campagna({...})   # la stessa campagna su ogni tipo di pubblico, e il migliore
simulazione.consiglia({...})           # le combinazioni migliori con lo stesso budget
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
| [`web/js/account.js`](web/js/account.js) | account (email o Google, Apple, GitHub, Microsoft), profilo e progetti salvati, su Supabase |
| [`supabase/`](supabase/) | configurazione e migrazioni del database (profili e progetti, ognuno vede solo i suoi) |
| [`ios/`](ios/) | l'app per iPhone: il sito incluso, accesso con Apple e Google, Condividi (`Sito.swift`, `Ponte.swift`) |
| [`web/js/nativo.js`](web/js/nativo.js) | solo nell'app: il riassunto dell'analisi per il bottone Condividi |
| [`strumenti/risorse_ios.py`](strumenti/risorse_ios.py) | icona e schermata di avvio dell'app dal logo |
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
