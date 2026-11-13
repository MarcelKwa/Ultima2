// Ultima — gedeelde front-end interactie

document.addEventListener('DOMContentLoaded', () => {
  /* Mobiele navigatie */
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  }

  /* Horizontaal scrollbare kaartenrij: verticaal scrollen over de rij scrollt eerst
     de rij zelf horizontaal door, en laat pas daarna de pagina verder naar beneden/boven gaan. */
  document.querySelectorAll('.card-scroll-row').forEach((row) => {
    row.addEventListener('wheel', (e) => {
      // Alleen ingrijpen bij overwegend verticaal scrollen (muiswiel/trackpad);
      // een bewuste horizontale sleepbeweging laten we ongemoeid.
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;

      const maxScrollLeft = row.scrollWidth - row.clientWidth;
      if (maxScrollLeft <= 0) return; // niets te scrollen (bv. op mobiel/smal scherm)

      const atStart = row.scrollLeft <= 0;
      const atEnd = row.scrollLeft >= maxScrollLeft - 1;

      if ((e.deltaY > 0 && !atEnd) || (e.deltaY < 0 && !atStart)) {
        e.preventDefault();
        row.scrollLeft += e.deltaY;
      }
      // Aan het begin/eind: preventDefault niet aanroepen, zodat de pagina gewoon verder scrollt.
    }, { passive: false });
  });

  /* Lichtbox: klik op een productfoto voor een grote weergave */
  const lightboxImages = document.querySelectorAll('.swatch--photo img, .swatch--cover img');
  if (lightboxImages.length) {
    const lightbox = document.createElement('div');
    lightbox.className = 'lightbox-overlay';
    lightbox.setAttribute('role', 'dialog');
    lightbox.setAttribute('aria-modal', 'true');
    lightbox.innerHTML = '<button type="button" class="lightbox-close" aria-label="Sluiten">&times;</button><img alt="">';
    document.body.appendChild(lightbox);
    const lightboxImg = lightbox.querySelector('img');
    const lightboxClose = lightbox.querySelector('.lightbox-close');

    function openLightbox(src, alt) {
      if (!src) return;
      lightboxImg.src = src;
      lightboxImg.alt = alt || '';
      lightbox.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    }
    function closeLightbox() {
      lightbox.classList.remove('is-open');
      lightboxImg.src = '';
      document.body.style.overflow = '';
    }

    lightboxImages.forEach((img) => {
      img.addEventListener('click', () => openLightbox(img.currentSrc || img.src, img.alt));
    });
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) closeLightbox();
    });
    lightboxClose.addEventListener('click', closeLightbox);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeLightbox();
    });
  }

  /* Dealerzoeker + dealerlocator-kaart (alleen aanwezig op dealers.html)
     Uitgangspunt: er staat altijd een lijst met dealers. Zodra er een vertrekpunt bekend is
     (plaats, postcode, dealernaam of de locatie van de bezoeker) staat die lijst op afstand,
     de dichtstbijzijnde eerst. */
  const dealerList = document.querySelector('[data-dealer-list]');
  if (dealerList) {
    const searchInput = document.querySelector('[data-dealer-search]');
    const searchBtn = document.querySelector('[data-dealer-search-btn]');
    const countrySelect = document.querySelector('[data-dealer-country]');
    const cards = Array.from(dealerList.querySelectorAll('.dealer-card'));
    const originalOrder = cards.slice();
    const searchStatus = document.querySelector('[data-dealer-search-status]');
    const locateBtn = document.querySelector('[data-dealer-locate]');
    const locateStatus = document.querySelector('[data-dealer-locate-status]');
    const mapEl = document.querySelector('[data-dealer-map]');

    const COUNTRY_NAMES = { nl: 'Nederland', be: 'België', de: 'Duitsland' };

    function haversineKm(lat1, lon1, lat2, lon2) {
      const toRad = (d) => (d * Math.PI) / 180;
      const R = 6371;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function normalize(text) {
      return (text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, ' ').trim();
    }

    /* ---- Lokale locatiegegevens, zodat de meeste zoekopdrachten zonder externe dienst werken ---- */

    // Nederlandse postcodegebieden: eerste twee cijfers → middelpunt van het gebied (benadering, ±10 km).
    const NL_PC2 = {
      10:[52.37,4.89],11:[52.31,4.90],12:[52.22,5.17],13:[52.37,5.21],14:[52.45,4.93],15:[52.47,4.78],16:[52.65,5.05],17:[52.78,4.82],18:[52.62,4.72],19:[52.48,4.63],
      20:[52.38,4.63],21:[52.32,4.62],22:[52.22,4.48],23:[52.16,4.49],24:[52.13,4.66],25:[52.07,4.30],26:[52.02,4.37],27:[52.06,4.49],28:[52.01,4.71],29:[51.93,4.60],
      30:[51.92,4.48],31:[51.91,4.36],32:[51.80,4.35],33:[51.81,4.67],34:[52.05,5.00],35:[52.09,5.12],36:[52.15,5.03],37:[52.10,5.25],38:[52.16,5.39],39:[52.03,5.55],
      40:[51.89,5.40],41:[51.93,5.10],42:[51.83,4.98],43:[51.65,3.92],44:[51.50,3.85],45:[51.30,3.80],46:[51.49,4.29],47:[51.53,4.46],48:[51.59,4.78],49:[51.64,4.86],
      50:[51.56,5.08],51:[51.66,5.00],52:[51.69,5.30],53:[51.81,5.25],54:[51.66,5.58],55:[51.40,5.40],56:[51.44,5.48],57:[51.48,5.66],58:[51.53,5.97],59:[51.37,6.17],
      60:[51.25,5.72],61:[51.00,5.87],62:[50.85,5.69],63:[50.86,5.85],64:[50.88,6.00],65:[51.84,5.86],66:[51.82,5.70],67:[52.03,5.67],68:[51.98,5.91],69:[51.93,6.07],
      70:[51.96,6.30],71:[51.97,6.65],72:[52.14,6.20],73:[52.21,5.97],74:[52.25,6.16],75:[52.22,6.89],76:[52.34,6.68],77:[52.55,6.55],78:[52.78,6.90],79:[52.72,6.40],
      80:[52.51,6.09],81:[52.40,6.27],82:[52.52,5.70],83:[52.72,5.85],84:[52.96,6.00],85:[52.93,5.75],86:[53.03,5.62],87:[53.05,5.45],88:[53.17,5.48],89:[53.20,5.79],
      90:[53.20,5.95],91:[53.32,6.00],92:[53.11,6.10],93:[53.12,6.45],94:[52.99,6.56],95:[52.99,6.95],96:[53.15,6.80],97:[53.22,6.57],98:[53.30,6.40],99:[53.33,6.88],
    };

    // Veelgezochte plaatsen in NL, BE en DE (grensstreek). Dealerplaatsen worden hier automatisch aan toegevoegd.
    const PLACES = {
      'amsterdam':[52.370,4.895],'rotterdam':[51.922,4.479],'den haag':[52.078,4.300],'s gravenhage':[52.078,4.300],'utrecht':[52.091,5.122],
      'eindhoven':[51.441,5.470],'groningen':[53.219,6.566],'tilburg':[51.556,5.091],'almere':[52.371,5.222],'breda':[51.589,4.776],
      'nijmegen':[51.842,5.853],'apeldoorn':[52.211,5.969],'haarlem':[52.387,4.646],'arnhem':[51.985,5.899],'enschede':[52.221,6.894],
      'amersfoort':[52.156,5.388],'zaandam':[52.439,4.826],'den bosch':[51.697,5.304],'s hertogenbosch':[51.697,5.304],'hoofddorp':[52.303,4.689],
      'zwolle':[52.517,6.083],'zoetermeer':[52.057,4.493],'leiden':[52.160,4.497],'leeuwarden':[53.201,5.799],'maastricht':[50.851,5.691],
      'dordrecht':[51.813,4.690],'ede':[52.040,5.665],'alphen aan den rijn':[52.129,4.656],'alkmaar':[52.632,4.753],'naaldwijk':[51.994,4.209],
      'emmen':[52.779,6.906],'delft':[52.012,4.357],'venlo':[51.370,6.172],'deventer':[52.255,6.164],'sittard':[50.998,5.869],
      'helmond':[51.479,5.657],'oss':[51.765,5.518],'amstelveen':[52.301,4.864],'hilversum':[52.223,5.176],'heerlen':[50.888,5.980],
      'hengelo':[52.266,6.793],'purmerend':[52.505,4.959],'roosendaal':[51.531,4.466],'schiedam':[51.919,4.400],'lelystad':[52.518,5.471],
      'vlaardingen':[51.912,4.341],'almelo':[52.357,6.663],'gouda':[52.017,4.708],'spijkenisse':[51.845,4.329],'hoorn':[52.643,5.059],
      'assen':[52.993,6.564],'veenendaal':[52.028,5.558],'zeist':[52.090,5.233],'katwijk':[52.200,4.415],'nieuwegein':[52.029,5.081],
      'capelle aan den ijssel':[51.929,4.578],'bergen op zoom':[51.495,4.291],'den helder':[52.957,4.760],'middelburg':[51.499,3.611],
      'vlissingen':[51.442,3.573],'goes':[51.504,3.889],'terneuzen':[51.335,3.828],'gorinchem':[51.831,4.975],'woerden':[52.085,4.883],
      'waalwijk':[51.683,5.070],'doetinchem':[51.965,6.289],'kampen':[52.555,5.911],'meppel':[52.696,6.194],'hoogeveen':[52.723,6.476],
      'heerenveen':[52.959,5.919],'drachten':[53.107,6.099],'sneek':[53.032,5.661],'roermond':[51.194,5.987],'weert':[51.252,5.707],
      'venray':[51.526,5.975],'wageningen':[51.969,5.665],'tiel':[51.886,5.430],'culemborg':[51.955,5.227],'barneveld':[52.140,5.585],
      'strijen':[51.745,4.551],'oud beijerland':[51.824,4.413],'hellevoetsluis':[51.822,4.135],'zwijndrecht':[51.815,4.640],
      'uden':[51.661,5.619],'veghel':[51.617,5.549],'valkenswaard':[51.351,5.459],'boxtel':[51.591,5.329],'hardenberg':[52.575,6.619],
      'steenwijk':[52.787,6.120],'borne':[52.300,6.753],'wassenaar':[52.143,4.401],'lisse':[52.258,4.557],'heemstede':[52.351,4.607],
      'beverwijk':[52.485,4.657],'heerhugowaard':[52.668,4.832],'schagen':[52.787,4.799],'enkhuizen':[52.703,5.291],'kerkrade':[50.866,6.063],
      'dokkum':[53.326,5.998],'harlingen':[53.175,5.422],'stadskanaal':[52.990,6.950],'veendam':[53.106,6.875],'delfzijl':[53.330,6.919],
      'raalte':[52.388,6.275],'oldenzaal':[52.313,6.929],'houten':[52.033,5.168],'zaltbommel':[51.811,5.249],'rosmalen':[51.716,5.365],
      'etten leur':[51.570,4.637],'best':[51.507,5.390],'cuijk':[51.728,5.879],'zevenaar':[51.928,6.071],'rijssen':[52.307,6.518],
      'antwerpen':[51.219,4.402],'gent':[51.054,3.717],'brussel':[50.847,4.357],'brugge':[51.209,3.225],'leuven':[50.879,4.701],
      'mechelen':[51.026,4.478],'kortrijk':[50.828,3.265],'genk':[50.965,5.500],'turnhout':[51.322,4.944],'aalst':[50.938,4.040],
      'oostende':[51.216,2.927],'sint niklaas':[51.165,4.143],'roeselare':[50.946,3.123],'lier':[51.131,4.570],'tongeren':[50.781,5.464],
      'munster':[51.960,7.626],'gronau':[52.212,7.025],'bocholt':[51.838,6.615],'nordhorn':[52.432,7.069],'borken':[51.844,6.858],
      'stadtlohn':[51.994,6.917],'vreden':[52.034,6.828],'coesfeld':[51.946,7.168],'kleve':[51.789,6.139],'emmerich':[51.833,6.247],
      'aachen':[50.776,6.084],'monchengladbach':[51.192,6.441],'dusseldorf':[51.227,6.773],'koln':[50.937,6.960],'osnabruck':[52.279,8.047],
    };
    cards.forEach((card) => {
      const lat = parseFloat(card.dataset.lat);
      const lng = parseFloat(card.dataset.lng);
      if (Number.isNaN(lat) || Number.isNaN(lng)) return;
      // "Alkmaar-Overstad" → ook "alkmaar"; "Oosterhout NB" → ook "oosterhout"
      const full = normalize(card.dataset.city);
      [full, full.split(' ')[0]].forEach((key) => { if (key && !PLACES[key]) PLACES[key] = [lat, lng]; });
    });

    function placeLabel(key) {
      const special = { 's gravenhage': "'s-Gravenhage", 's hertogenbosch': "'s-Hertogenbosch", 'den bosch': 'Den Bosch' };
      if (special[key]) return special[key];
      return key.split(' ').map((w) => (['aan', 'den', 'op', 'de'].includes(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
    }

    /* Probeert een zoekterm lokaal om te zetten in een vertrekpunt. Geeft null terug als dat niet lukt. */
    function resolveLocally(query, country) {
      const q = normalize(query);
      if (!q) return null;

      // Nederlandse postcode (1234 of 1234 AB). Bij filter "België" zijn 4 cijfers een Belgische postcode.
      const nlPostcode = q.match(/^([1-9]\d)\d{2}(?: ?[a-z]{2})?$/);
      if (nlPostcode && country !== 'be' && country !== 'de' && NL_PC2[+nlPostcode[1]]) {
        const [lat, lng] = NL_PC2[+nlPostcode[1]];
        return { lat, lng, label: 'postcode ' + query.trim().toUpperCase(), approx: true };
      }

      // Plaatsnaam, exact
      if (PLACES[q]) return { lat: PLACES[q][0], lng: PLACES[q][1], label: placeLabel(q) };

      // Dealernaam: vertrekpunt is die dealer zelf
      if (q.length >= 3) {
        const byName = cards.find((card) => normalize(card.dataset.name).includes(q));
        if (byName && !Number.isNaN(parseFloat(byName.dataset.lat))) {
          return { lat: parseFloat(byName.dataset.lat), lng: parseFloat(byName.dataset.lng), label: byName.dataset.name, dealer: byName };
        }
      }

      // Begin van een plaatsnaam (minimaal 3 tekens)
      if (q.length >= 3) {
        const hit = Object.keys(PLACES).filter((k) => k.startsWith(q)).sort((a, b) => a.length - b.length)[0];
        if (hit) return { lat: PLACES[hit][0], lng: PLACES[hit][1], label: placeLabel(hit) };
      }
      return null;
    }

    /* Valt terug op Nominatim (OpenStreetMap). Alleen na Enter of de zoekknop, nooit tijdens het typen,
       conform de gebruiksvoorwaarden van Nominatim. Resultaten worden per sessie onthouden. */
    const geocodeCache = new Map();
    async function geocodeRemote(query, country) {
      const countryCodes = country === 'all' ? 'nl,be,de' : country;
      const key = countryCodes + '|' + normalize(query);
      if (geocodeCache.has(key)) return geocodeCache.get(key);
      const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=nl&countrycodes='
        + encodeURIComponent(countryCodes) + '&q=' + encodeURIComponent(query);
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('Geocoding mislukt');
      const results = await response.json();
      const result = results.length
        ? { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon), label: query.trim() }
        : null;
      geocodeCache.set(key, result);
      return result;
    }

    /* ---- Kaart ---- */
    function makePin(color) {
      return L.divIcon({
        className: 'dealer-pin',
        html: '<svg width="26" height="34" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg"><path d="M13 0C5.8 0 0 5.8 0 13c0 9.3 13 21 13 21s13-11.7 13-21C26 5.8 20.2 0 13 0z" fill="' + color + '"/><circle cx="13" cy="13" r="5.2" fill="#fff"/></svg>',
        iconSize: [26, 34],
        iconAnchor: [13, 34],
        popupAnchor: [0, -30],
      });
    }

    function highlightCard(card, scroll = true) {
      cards.forEach((c) => c.classList.remove('is-highlighted'));
      if (!card) return;
      card.classList.add('is-highlighted');
      if (scroll) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    let map = null;
    const markers = [];
    let originMarker = null;
    let allBounds = [];

    if (mapEl && typeof L !== 'undefined') {
      map = L.map(mapEl, { scrollWheelZoom: false }).setView([50.9, 4.9], 7);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-bijdragers',
      }).addTo(map);

      const dealerIcon = makePin('#FD740A');

      cards.forEach((card) => {
        const lat = parseFloat(card.dataset.lat);
        const lng = parseFloat(card.dataset.lng);
        if (Number.isNaN(lat) || Number.isNaN(lng)) return;
        const name = card.dataset.name || '';
        const address = card.querySelector('.dealer-address')?.textContent || '';
        const marker = L.marker([lat, lng], { icon: dealerIcon, title: name });
        marker.addTo(map);
        marker.bindPopup('<h4>' + name + '</h4><p>' + address + '</p>');
        marker.on('click', () => highlightCard(card));
        markers.push({ card, marker });
        allBounds.push([lat, lng]);

        card.style.cursor = 'pointer';
        card.addEventListener('click', () => {
          map.setView([lat, lng], 12, { animate: true });
          marker.openPopup();
          highlightCard(card, false);
        });
      });

      if (allBounds.length) map.fitBounds(allBounds, { padding: [24, 24] });

      /* Wordt door build_preview.py aangeroepen zodra deze sectie zichtbaar wordt, zodat Leaflet de
         kaart herberekent + opnieuw fit na initialisatie in een verborgen (0×0) container. */
      window.__ultimaInvalidateDealerMap = () => {
        map.invalidateSize();
        fitMap();
      };
    }

    function syncMapVisibility() {
      if (!map) return;
      markers.forEach(({ card, marker }) => {
        const shouldShow = card.style.display !== 'none';
        if (shouldShow && !map.hasLayer(marker)) marker.addTo(map);
        if (!shouldShow && map.hasLayer(marker)) map.removeLayer(marker);
      });
    }

    /* Zoomt in op het vertrekpunt en de drie dichtstbijzijnde dealers, of toont alles zonder vertrekpunt. */
    function fitMap() {
      if (!map) return;
      if (originMarker) map.removeLayer(originMarker);
      originMarker = null;
      const visible = cards.filter((c) => c.style.display !== 'none' && !Number.isNaN(parseFloat(c.dataset.lat)));
      if (currentOrigin) {
        visible.sort((a, b) => parseFloat(a.dataset.distance ?? 'Infinity') - parseFloat(b.dataset.distance ?? 'Infinity'));
        originMarker = L.marker([currentOrigin.lat, currentOrigin.lng], { icon: makePin('#7C7265'), title: currentOrigin.label, zIndexOffset: 1000 }).addTo(map);
        originMarker.bindPopup('<h4>' + escapeHtml(capitalize(currentOrigin.label)) + '</h4>');
        const pts = [[currentOrigin.lat, currentOrigin.lng]].concat(
          visible.slice(0, 3).map((c) => [parseFloat(c.dataset.lat), parseFloat(c.dataset.lng)])
        );
        map.fitBounds(pts, { padding: [40, 40], maxZoom: 11 });
      } else {
        const pts = visible.map((c) => [parseFloat(c.dataset.lat), parseFloat(c.dataset.lng)]);
        if (pts.length) map.fitBounds(pts, { padding: [24, 24] });
      }
    }

    /* ---- Lijst ---- */
    let currentOrigin = null;

    function escapeHtml(text) {
      return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
    function capitalize(text) { return text.charAt(0).toUpperCase() + text.slice(1); }

    function formatKm(km) {
      if (km < 1) return '< 1 km';
      return '≈ ' + (km < 10 ? km.toFixed(1).replace('.', ',') : Math.round(km)) + ' km';
    }

    function setStatus(html) {
      if (!searchStatus) return;
      searchStatus.innerHTML = html || '';
      searchStatus.classList.toggle('is-visible', !!html);
    }

    function render() {
      const country = countrySelect?.value || 'all';

      cards.forEach((card) => {
        const cardCountry = card.dataset.country || 'all';
        card.style.display = (country === 'all' || cardCountry === country) ? '' : 'none';
        card.querySelector('.dealer-distance')?.remove();
        delete card.dataset.distance;
      });

      if (currentOrigin) {
        cards.forEach((card) => {
          const lat = parseFloat(card.dataset.lat);
          const lng = parseFloat(card.dataset.lng);
          if (Number.isNaN(lat) || Number.isNaN(lng)) return;
          const km = haversineKm(currentOrigin.lat, currentOrigin.lng, lat, lng);
          card.dataset.distance = km.toFixed(2);
          const el = document.createElement('span');
          el.className = 'dealer-distance';
          el.textContent = formatKm(km);
          card.insertBefore(el, card.firstChild);
        });
        [...cards]
          .sort((a, b) => parseFloat(a.dataset.distance ?? 'Infinity') - parseFloat(b.dataset.distance ?? 'Infinity'))
          .forEach((card) => dealerList.appendChild(card));
      } else {
        originalOrder.forEach((card) => dealerList.appendChild(card));
      }

      syncMapVisibility();
      fitMap();

      const visible = cards.filter((c) => c.style.display !== 'none');
      if (currentOrigin) {
        const ordered = [...dealerList.querySelectorAll('.dealer-card')].filter((c) => c.style.display !== 'none');
        const nearest = currentOrigin.dealer && currentOrigin.dealer.style.display !== 'none' ? currentOrigin.dealer : ordered[0];
        highlightCard(nearest, false);
        const scope = country === 'all' ? '' : ' in ' + COUNTRY_NAMES[country];
        setStatus(
          'Dealers' + scope + ' op afstand vanaf <strong>' + escapeHtml(currentOrigin.label) + '</strong>, hemelsbreed gemeten'
          + (currentOrigin.approx ? ' vanaf het midden van het postcodegebied' : '') + '.'
          + (nearest ? ' Dichtstbij: <strong>' + escapeHtml(nearest.dataset.name) + '</strong>.' : '')
        );
      } else {
        highlightCard(null);
      }
      return visible.length;
    }

    let searchRequestId = 0;

    /* fromSubmit: alleen dan mag er een externe locatiedienst worden gevraagd */
    async function runSearch(fromSubmit) {
      const query = (searchInput?.value || '').trim();
      const country = countrySelect?.value || 'all';
      const requestId = ++searchRequestId;

      if (!query) {
        currentOrigin = null;
        render();
        setStatus('');
        return;
      }

      const local = resolveLocally(query, country);
      if (local) {
        currentOrigin = local;
        render();
        return;
      }

      if (!fromSubmit) {
        // Tijdens het typen: lijst blijft staan, nog niet extern zoeken
        setStatus('Druk op Enter of <strong>Zoeken</strong> om dealers bij „' + escapeHtml(query) + '” te vinden.');
        return;
      }

      setStatus('Bezig met zoeken naar „' + escapeHtml(query) + '”…');
      try {
        const remote = await geocodeRemote(query, country);
        if (requestId !== searchRequestId) return;
        if (remote) {
          currentOrigin = remote;
          render();
          return;
        }
      } catch (err) {
        if (requestId !== searchRequestId) return;
      }
      currentOrigin = null;
      render();
      setStatus('We konden „' + escapeHtml(query) + '” niet vinden. Probeer een plaatsnaam of postcode. Hieronder alle dealers'
        + (country === 'all' ? '' : ' in ' + COUNTRY_NAMES[country]) + '.');
    }

    let searchDebounce = null;
    searchInput?.addEventListener('input', () => {
      window.clearTimeout(searchDebounce);
      searchDebounce = window.setTimeout(() => runSearch(false), 300);
    });
    searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        window.clearTimeout(searchDebounce);
        runSearch(true);
      }
    });
    searchBtn?.addEventListener('click', () => {
      window.clearTimeout(searchDebounce);
      runSearch(true);
    });
    countrySelect?.addEventListener('change', () => {
      window.clearTimeout(searchDebounce);
      if (currentOrigin && !(searchInput?.value || '').trim()) {
        render(); // vertrekpunt via "bij mij in de buurt" behouden
      } else {
        runSearch(true);
      }
    });
    render();

    /* "Dealer bij mij in de buurt" — vertrekpunt is de locatie van de bezoeker */
    if (locateBtn) {
      locateBtn.addEventListener('click', () => {
        if (!('geolocation' in navigator)) {
          if (locateStatus) locateStatus.textContent = 'Locatiebepaling wordt niet ondersteund door je browser. Zoek op plaats of postcode.';
          return;
        }
        if (locateStatus) locateStatus.textContent = 'Bezig met het bepalen van je locatie…';

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (locateStatus) locateStatus.textContent = '';
            if (searchInput) searchInput.value = '';
            searchRequestId++;
            currentOrigin = { lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'jouw locatie' };
            render();
          },
          (err) => {
            if (locateStatus) {
              locateStatus.textContent = err.code === err.PERMISSION_DENIED
                ? 'Locatietoegang geweigerd. Sta locatiebepaling toe, of zoek op plaats of postcode.'
                : 'Locatie kon niet worden bepaald. Zoek op plaats of postcode.';
            }
          },
          { timeout: 10000, maximumAge: 600000 }
        );
      });
    }
  }

  /* Contactformulier: verstuurt naar /api/contact (Vercel serverless function + Resend) */
  const contactForm = document.querySelector('[data-contact-form]');
  if (contactForm) {
    const submitBtn = contactForm.querySelector('[data-submit-btn]');
    const confirmation = document.querySelector('[data-form-confirmation]');
    const errorBox = document.querySelector('[data-form-error]');
    const submitBtnDefaultText = submitBtn ? submitBtn.textContent : '';

    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (errorBox) { errorBox.style.display = 'none'; errorBox.textContent = ''; }
      if (confirmation) confirmation.style.display = 'none';

      const formData = new FormData(contactForm);
      const payload = Object.fromEntries(formData.entries());

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Bezig met versturen…';
      }

      try {
        const response = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.error || 'Het bericht kon niet worden verzonden. Probeer het later opnieuw.');
        }

        contactForm.reset();
        contactForm.style.display = 'none';
        if (confirmation) confirmation.style.display = 'block';
      } catch (err) {
        if (errorBox) {
          errorBox.textContent = err.message || 'Er ging iets mis. Probeer het later opnieuw.';
          errorBox.style.display = 'block';
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = submitBtnDefaultText;
        }
      }
    });
  }

  /* Actieve nav-link markeren */
  const current = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav__list a').forEach((link) => {
    const href = link.getAttribute('href');
    if (href === current) link.setAttribute('aria-current', 'page');
  });
});
