# Gestione Tavoli

Web app (PWA) per gestire i tavoli di un ristorante: sale, tavoli con posti,
menu con allergeni e varianti, comande **per posto, condivise o per il tavolo**,
conto diviso per persona. Gira su **un solo dispositivo** (smartphone o tablet)
e salva i dati **in locale** nel browser: non c'è backend.

- **HTML + CSS + JavaScript vanilla** con ES Modules: nessun framework, nessuna
  dipendenza runtime, nessun build step.
- Interfaccia in italiano, design di Claude Design (`css/tokens.css`, tema chiaro e scuro).
- Installabile e utilizzabile **offline** dopo il primo caricamento.
- Hash routing (`#/sala/...`, `#/admin/...`) compatibile con GitHub Pages.

## Avvio in locale

Serve un server statico (i moduli ES non funzionano da `file://`):

```bash
npm start
```

Poi apri <http://localhost:8080/>. Al primo avvio la procedura guidata chiede il
nome del locale e il PIN dell'area Amministrazione. Per provare subito l'app:
**Amministrazione → Dati → Dati di esempio**.

> Il service worker usa una strategia cache-first: durante lo sviluppo, dopo aver
> modificato i file, aggiorna `CACHE_VERSION` in `service-worker.js` (o disattiva
> la cache dagli strumenti per sviluppatori).

## Test

```bash
npm test
```

`node --test`, nessuna libreria esterna. Coprono il conto (`billing.js`, con
l'invariante "somma quote = totale"), migrazioni, allergeni, azioni di admin e
sala, report, export/import, precache del service worker, manifest e contrasto
WCAG dei design tokens.

## Come si usa

**Amministrazione** (protetta da PIN, 4–6 cifre)
- *Impostazioni*: nome, coperto, portate (ordine di uscita), camerieri, tema, cambio PIN.
- *Aree* e *Tavoli*: creazione anche **in blocco** (es. 10 tavoli da 4 posti con prefisso
  e numerazione), posti rinominabili e riordinabili.
- *Piantina*: tavoli trascinabili, ridimensionabili e ruotabili (15°), aggancio a griglia.
- *Menu* e *Varianti*: piatti con i 14 allergeni UE, destinazione Cucina/Bar, esaurito.
- *Dati*: backup JSON, importazione, archivio dello storico, reset. *Report*: incasso,
  coperti, scontrino medio, piatti più venduti.

**Sala** (senza PIN; se ci sono camerieri si sceglie “Chi sei?”)
1. Tocca un tavolo libero → coperti e cameriere → *Apri tavolo*.
2. Tocca un **posto** → categoria → **+** sul piatto. *Tavolo* al centro per i piatti
   comuni, **Più posti** per i piatti condivisi. Tocco lungo su un posto: nome e allergie.
3. Se un allergene del piatto è dichiarato da un ospite compare un **avviso bloccante**.
4. *Invia comanda* (riepilogo Cucina/Bar; le portate successive possono restare
   “in attesa”) → *Marcia* quando il cliente è pronto.
5. *Conto*: Totale / Per posto / Alla romana, pagamenti parziali, preconto 80 mm
   (“Documento non fiscale”), *Chiudi tavolo* a residuo zero.

Le bozze si modificano con un tocco e si eliminano scorrendo a sinistra (con *Annulla*);
le righe inviate si segnano come servite, si spostano o si **stornano** con motivo.
Dal menu ⋯ del tavolo: aggiungi posto, sposta tavolo, unisci tavoli.

## Struttura

```
index.html                 entry point (SPA)
manifest.webmanifest       PWA
service-worker.js          precache + cache-first (CACHE_VERSION)
assets/icons/              icone PWA 192/512 + maskable
css/tokens.css             design tokens (tema chiaro e [data-theme="dark"])
css/base.css               reset, tipografia, layout
css/components.css         componenti UI
css/print.css              preconto 80 mm
js/main.js                 bootstrap, router, service worker
js/router.js               hash router
js/routes.js               tabella delle route
js/state/                  store (pub/sub), azioni nominate, repository, localStorage,
                           migrazioni, preferenze del dispositivo, PIN
js/domain/                 modelli, conto (billing), allergeni, sessioni, tavoli, report, id
js/views/admin/            schermate di amministrazione
js/views/sala/             schermate del cameriere
js/components/             componenti riutilizzabili (dialog, toast, Tavolo con posti, …)
scripts/icons.mjs          sottoinsieme del font icone (npm run icons)
tests/                     test con node --test
```

### Architettura in breve

- **Store** (`js/state/store.js`): unica fonte di verità. Le view si sottoscrivono e
  ogni mutazione passa da un'**azione nominata** (`js/state/actions.js`, es.
  `addOrderLine`, `sendOrder`) che lavora su una copia: se lancia un errore lo stato
  non cambia. Salvataggio con debounce di 300 ms.
- **Repository** (`js/state/repository.js`): interfaccia asincrona `load`, `save`,
  `exportJSON`, `importJSON`; `localRepository.js` la implementa su `localStorage`
  (chiave `gestione-tavoli:v1`). Per aggiungere un backend basta un'altra implementazione.
- **Migrazioni** (`js/state/migrations.js`): array di funzioni indicizzate per
  `schemaVersion`, eseguite all'avvio e all'importazione.
- **Importi in centesimi interi**; lo stato del tavolo è **derivato**
  (`getTableStatus(table, session)` in `js/domain/session.js`).
- Le icone usano un sottoinsieme di Material Symbols: se aggiungi un'icona nel codice
  esegui `npm run icons` (un test lo verifica).

## Deploy su GitHub Pages

Il workflow `.github/workflows/deploy.yml` esegue `npm test` e, solo se i test
passano, pubblica il sito a ogni push su `main`. Tutti i percorsi sono relativi,
quindi l'app funziona sotto `https://<utente>.github.io/<nome-repo>/`.

Per abilitarlo la prima volta: **Settings → Pages → Build and deployment →
Source: GitHub Actions**.

## Fuori ambito (fase 2)

Sincronizzazione multi-dispositivo e backend, display cucina, prenotazioni, ordini
via QR, stampa diretta ESC/POS, menu multilingua. L'app **non** emette scontrini fiscali.
