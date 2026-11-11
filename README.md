# Gestione Tavoli

Web app (PWA) per gestire i tavoli di un ristorante: sale, tavoli con posti,
menu con allergeni e varianti, comande per posto / condivise / tavolo, conto
diviso per persona. Gira su **un solo dispositivo** (smartphone o tablet) e
salva i dati **in locale** nel browser.

- **HTML + CSS + JavaScript vanilla** con ES Modules: nessun framework, nessuna
  dipendenza runtime, nessun build step.
- Interfaccia in italiano; design tokens di Claude Design in `css/tokens.css`.
- Hash routing (`#/sala/...`, `#/admin/...`) compatibile con GitHub Pages.

## Avvio in locale

Serve un qualunque server statico (i moduli ES non funzionano da `file://`):

```bash
npm start            # equivale a: python3 -m http.server 8080
```

Poi apri <http://localhost:8080/>.

## Test

```bash
npm test             # node --test, nessuna libreria esterna
```

## Struttura

```
index.html                 entry point (SPA)
css/tokens.css             design tokens (tema chiaro e scuro)
css/base.css               reset, tipografia, layout
css/components.css         componenti UI
js/main.js                 bootstrap, router, service worker
js/router.js               hash router
js/state/                  store (pub/sub), repository, localStorage, migrazioni
js/domain/                 modelli, conto, allergeni, id
js/views/                  schermate (admin/ e sala/)
js/components/             componenti riutilizzabili (dialog, toast, …)
tests/                     test con node --test
```

## Deploy su GitHub Pages

Il workflow `.github/workflows/deploy.yml` esegue `npm test` e, se i test
passano, pubblica il sito a ogni push su `main`.

Per abilitarlo la prima volta: **Settings → Pages → Build and deployment →
Source: GitHub Actions**.
