# Ultima — website

Statische website (HTML/CSS/JS, geen framework, geen backend). 19 pagina's, zie hieronder.

## Live zetten via GitHub + Vercel

1. **GitHub**
   - Maak een nieuwe (lege) repository aan op GitHub.
   - Pak deze map uit en push de inhoud naar die repository (bijvoorbeeld met GitHub Desktop, of via de terminal: `git init`, `git add .`, `git commit -m "Eerste versie Ultima-site"`, `git remote add origin <repo-url>`, `git push -u origin main`).

2. **Vercel**
   - Log in op [vercel.com](https://vercel.com) en klik op "Add New… → Project".
   - Selecteer de zojuist gepushte GitHub-repository.
   - Framework preset: kies **"Other"** (geen build-stap nodig voor de site zelf; de `/api/contact.js` serverless function wordt automatisch door Vercel herkend en gedeployed).
   - Build command: laat leeg. Output directory: laat leeg / `.` (root).
   - Klik op **Deploy**. Na een paar seconden staat de site live op een `*.vercel.app`-domein.
   - Wil je een eigen domein? Voeg 'm toe onder Project → Settings → Domains.

Elke volgende `git push` naar de hoofdbranch zet automatisch een nieuwe versie live.

## Contactformulier laten werken (Resend)

Het contactformulier op `contact.html` verstuurt berichten via een Vercel serverless function (`api/contact.js`) die e-mail verzendt met [Resend](https://resend.com). Om dit werkend te krijgen:

1. **Resend-account aanmaken**: ga naar [resend.com](https://resend.com), maak een gratis account (100 e-mails/dag, 3.000/maand gratis) en ga naar **API Keys** → maak een nieuwe key aan.
2. **Domein verifiëren** (aanbevolen): voeg onder **Domains** het domein `ultimabedden.nl` toe en zet de gevraagde DNS-records (SPF/DKIM) bij je domeinregistrar. Zonder geverifieerd domein kun je met Resend alleen testmails sturen naar het e-mailadres waarmee je bent ingelogd — niet naar `verkoop@ultimabedden.nl`.
3. **Omgevingsvariabelen instellen in Vercel**: ga naar je project → **Settings → Environment Variables** en voeg toe:
   - `RESEND_API_KEY` — de API-key uit stap 1 (verplicht)
   - `CONTACT_TO_EMAIL` — optioneel, standaard `verkoop@ultimabedden.nl`
   - `CONTACT_FROM_EMAIL` — optioneel, bijvoorbeeld `Ultima website <website@ultimabedden.nl>`. Dit adres moet op het geverifieerde domein uit stap 2 staan; laat je dit leeg, dan wordt Resend's test-adres gebruikt, wat alleen werkt tijdens het testen.
   - Redeploy het project na het toevoegen van de variabelen (Vercel doet dit niet automatisch met terugwerkende kracht).
4. **Testen**: vul het formulier in op de live site. Bij succes verschijnt de bevestigingsmelding en komt het bericht binnen op het opgegeven e-mailadres (reply-to staat automatisch op het e-mailadres van de afzender, dus je kunt direct antwoorden).

Lokaal (bijvoorbeeld met `vercel dev`) werkt de function ook, mits dezelfde omgevingsvariabelen lokaal beschikbaar zijn (via een `.env` bestand, zie de Vercel CLI-documentatie). Open je de HTML-bestanden rechtstreeks in de browser (zonder server), dan werkt het formulier niet — de serverless function heeft een draaiende Vercel-omgeving nodig.

## Structuur

- `index.html`, `over-ons.html`, `producten.html`, `dealers.html`, `contact.html`
- Categoriepagina's: `boxsprings.html`, `matrassen.html`, `topmatrassen.html`, `ledikanten.html`, `kussens.html`
- Subpagina's (één niveau dieper, niet in hoofdnav): `matrassen-initio.html`, `matrassen-cumlaude.html`, `topmatrassen-initio.html`, `topmatrassen-cumlaude.html`, `kussens-aw.html`, `kussens-discus.html`, `kussens-atlas.html`, `kussens-balans.html`, `hoofdborden.html` (subpagina van Boxsprings)
- `assets/` — logo, favicons, productfoto's
- `css/style.css` — alle styling
- `js/main.js` — mobiele navigatie, lichtbox voor productfoto's, dealerzoeker + kaart, contactformulier (verstuurt naar `/api/contact`)
- `api/contact.js` — Vercel serverless function die het contactformulier verwerkt en e-mail verstuurt via Resend
- `vendor/leaflet/` — kaartbibliotheek voor de dealerspagina (lokaal gehost, geen build-stap nodig)

## Bekende openstaande punten

- Contactformulier vereist nog een eenmalige Resend-configuratie (zie hierboven) voordat berichten daadwerkelijk aankomen.
- Sommige dealers missen nog een e-mailadres (niet in brondata).
- Overige productdata kussens (afmetingen/hoogtes) nog aan te vullen.
- De dealerzoeker gebruikt Nominatim (OpenStreetMap) voor het omzetten van een getypte plaatsnaam naar coördinaten wanneer er geen directe naam-/plaatsmatch is — een gratis publieke API, prima voor dit volume maar bij hoge bezoekersaantallen kan een eigen geocoding-dienst nodig zijn.
