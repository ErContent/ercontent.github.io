# Sito personale: OSINT dossier

Sito statico per GitHub Pages. Nessun build step per il sito, nessuna dipendenza esterna a runtime: font e Leaflet sono self-hosted.

## Struttura

| Percorso | Contenuto |
|---|---|
| `index.html` | Pagina unica: hero, casi, board, matchday, case log, contatti |
| `assets/css/style.css` | Stile e token colore |
| `assets/js/main.js` | Globo, feed live, reticolo, board animata, partita napwnli |
| `assets/js/fx.js` | Effetti testo: scramble e macchina da scrivere |
| `assets/js/stadium.js` | Campo 3D notturno (Three.js): lente per gli indizi, rigori contro ErContent |
| `assets/js/terminal.js` | Terminale interattivo: comandi, indizi, toolkit OSINT, mappe |
| `assets/js/cases.js` | Lista casi, stanza del caso, verifica risposte, sblocco |
| `assets/js/normalize.js` | Normalizzazione risposte (condivisa con lo script di build) |
| `assets/js/vault.js` | PBKDF2-SHA256 + AES-256-GCM (WebCrypto) |
| `assets/js/geohash.js` | Verifica GEOINT su mappa |
| `cases/` | **Generata**: casi cifrati e allegati del primo caso |
| `tools/build-cases.mjs` | Cifra la catena dei casi dalla cartella privata |
| `robots.txt`, `evidence/` | Easter egg: sorgente HTML → console → robots.txt → stanza nascosta |

## 1. Personalizzazione

Sostituisci i placeholder in `index.html`:

```bash
sed -i \
  -e 's/Alessio Foggia/NOME_PUBBLICO/g' \
  -e 's/%%EMAIL%%/EMAIL_PUBBLICA/g' -e 's#%%LINKEDIN_URL%%#URL_LINKEDIN#g' \
  -e 's/%%GITHUB_USER%%/UTENTE_GITHUB/g' -e 's#%%SITE_URL%%#URL_SITO#g' index.html
```

Da verificare prima della pubblicazione: i numeri del tabellone napwnli (fondazione, CyberCup.IT, ranking CTFtime) e i link del team.

## 2. Casi

Le sorgenti stanno nella cartella **privata** `osint-cases-private/`, fuori dal repo. Contiene risposte e salt: non va mai committata né caricata.

```bash
# dalla root del repo, con la cartella privata accanto
node tools/build-cases.mjs ../osint-cases-private
```

Requisiti: Node.js 20+. Lo script rifiuta di girare se la cartella privata è dentro il repo.

**Come funziona lo sblocco**

- La risposta del caso N, normalizzata, passa per PBKDF2 (600.000 iterazioni) e diventa una chiave AES-256.
- Con quella chiave sono cifrati il "sigillo" del caso N (verifica) e l'intero caso N+1, allegati compresi.
- Nel repo finiscono solo salt e ciphertext. Le risposte non compaiono in nessuna forma.
- GEOINT: il punto sulla mappa diventa un geohash a precisione 7 (~150 m); sono accettate anche le 8 celle adiacenti.
- `salts.json` nella cartella privata mantiene le chiavi stabili: rifare la build o aggiungere casi non azzera i progressi dei visitatori.

**Indizi**: tre per caso, nel campo `hints` di `cases.config.mjs`. Nessun timer e nessuno sblocco per errori: ogni indizio si trova **facendo qualcosa sul sito** (campo `on`, o `globeArea` per una zona del globo). I trigger vengono salvati solo come hash SHA-256, quindi non si leggono nei file pubblicati. L'elenco dei trigger disponibili è in testa a `cases.config.mjs`.

**Più risposte valide**: `answers` accetta più varianti della stessa risposta (es. una con la Þ trascritta come `p` e una come `th`). Ogni caso ha una chiave casuale; ciascuna risposta la apre. Chiavi e salt stanno in `salts.json` nella cartella privata: non cancellarlo.

**Immagini delle challenge**: mettile nella cartella privata con il nome indicato in `files` (`case-002/I98E.png`, `hidden/temple.png`) e rilancia la build. Se un file manca, la build avvisa e prosegue.

**Caso nascosto**: `hidden` in `cases.config.mjs`, pubblicato in `/evidence/`. Ci si arriva dalla pista nel sorgente o dai frammenti del campo 3D; trovati i 5 indizi del campo, il terminale sblocca anche `fieldguide`.

**Terminale**: si apre con il tasto `\` (o `` ` ``) o dal pulsante in basso a destra. `help` elenca i comandi.

**Aggiungere un caso**: crea `case-003/` con `README.md` e allegati, aggiungi una voce in fondo a `cases.config.mjs`, rilancia la build. Tipi di risposta: `phrase+phone`, `date`, `text`.

**Limite noto**: una risposta a bassa entropia (un nome, una data) è indovinabile con un dizionario. PBKDF2 rende ogni tentativo lento; senza classifica non c'è incentivo a farlo.

## 3. Pubblicazione su GitHub Pages

1. Crea il repo `<utente>.github.io`.
2. Carica il **contenuto di questa cartella** (non la cartella privata).
3. Settings → Pages → Source: *Deploy from a branch*, branch `main`, cartella `/ (root)`.
4. Verifica con *Enforce HTTPS* attivo.

Se carichi i file dal browser invece che con `git`, il `.gitignore` non viene applicato: controlla di non trascinare la cartella privata.

## Privacy

- Nessun cookie, nessun analytics. I progressi stanno in `localStorage` del visitatore.
- Font e Leaflet serviti dallo stesso dominio.
- Unica richiesta a terzi: le tile di OpenStreetMap, solo quando si apre una mappa. Sono scurite via CSS, nessuna API key.
- `silence.pdf` è stato ripulito dai metadati autore.
- CSP restrittiva in `index.html`.

## Licenze

Font in `assets/fonts/licenses/` (SIL OFL). Leaflet in `assets/vendor/leaflet/LICENSE` (BSD-2). Three.js in `assets/vendor/three/LICENSE` (MIT). Coste del globo: Natural Earth (pubblico dominio) tramite world-atlas, `assets/data/LICENSE-world-atlas.txt`.

## Globo dei trofei

I luoghi sono nell'array `TROPHIES` di `assets/js/main.js`: solo competizioni nazionali e internazionali del palmarès, ciascuna nello stadio in cui il trofeo è stato vinto (finale, gara decisiva o, per i campionati di B e C1, lo stadio di casa di quella stagione). Per aggiungere un trofeo basta una voce con nome, città, coordinate e partita.

## Night match

Indizi e punteggi sono in `assets/js/stadium.js` (array `CLUES`, funzione `shoot`). Gli indizi del campo sono pubblici nel codice: servono per il gioco, non per i casi.

| Zona della porta | Punti |
|---|---|
| Sotto la traversa, centrale | 5 |
| Incrocio dei pali | 3 |
| Rasoterra all'angolino | 2 |
| Altro gol | 1 |

ErContent non si tuffa mai in alto a sinistra: lo rivela l'indizio C1.
