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

  /* Dealerzoeker + dealerlocator-kaart (alleen aanwezig op dealers.html) */
  const dealerList = document.querySelector('[data-dealer-list]');
  if (dealerList) {
    const searchInput = document.querySelector('[data-dealer-search]');
    const countrySelect = document.querySelector('[data-dealer-country]');
    const cards = Array.from(dealerList.querySelectorAll('.dealer-card'));
    const searchStatus = document.querySelector('[data-dealer-search-status]');
    const locateBtn = document.querySelector('[data-dealer-locate]');
    const locateStatus = document.querySelector('[data-dealer-locate-status]');
    const mapEl = document.querySelector('[data-dealer-map]');

    function haversineKm(lat1, lon1, lat2, lon2) {
      const toRad = (d) => (d * Math.PI) / 180;
      const R = 6371;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function makePin(color) {
      return L.divIcon({
        className: 'dealer-pin',
        html: '<svg width="26" height="34" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg"><path d="M13 0C5.8 0 0 5.8 0 13c0 9.3 13 21 13 21s13-11.7 13-21C26 5.8 20.2 0 13 0z" fill="' + color + '"/><circle cx="13" cy="13" r="5.2" fill="#fff"/></svg>',
        iconSize: [26, 34],
        iconAnchor: [13, 34],
        popupAnchor: [0, -30],
      });
    }

    function highlightCard(card) {
      cards.forEach((c) => c.classList.remove('is-highlighted'));
      card.classList.add('is-highlighted');
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    let map = null;
    const markers = [];
    let userMarker = null;

    if (mapEl && typeof L !== 'undefined') {
      map = L.map(mapEl, { scrollWheelZoom: false }).setView([50.9, 4.9], 7);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-bijdragers',
      }).addTo(map);

      const dealerIcon = makePin('#FD740A');
      const bounds = [];

      cards.forEach((card) => {
        const lat = parseFloat(card.dataset.lat);
        const lng = parseFloat(card.dataset.lng);
        if (Number.isNaN(lat) || Number.isNaN(lng)) return;
        const name = card.dataset.name || '';
        const address = card.querySelector('.dealer-address')?.textContent || '';
        const marker = L.marker([lat, lng], { icon: dealerIcon });
        marker.addTo(map);
        marker.bindPopup('<h4>' + name + '</h4><p>' + address + '</p>');
        marker.on('click', () => highlightCard(card));
        markers.push({ card, marker });
        bounds.push([lat, lng]);

        card.style.cursor = 'pointer';
        card.addEventListener('click', () => {
          map.setView([lat, lng], 12, { animate: true });
          marker.openPopup();
          highlightCard(card);
        });
      });

      /* Kaart automatisch laten meeschalen met alle dealerlocaties, i.p.v. een vast middelpunt/zoomniveau. */
      if (bounds.length) map.fitBounds(bounds, { padding: [24, 24] });

      /* Wordt door build_preview.py aangeroepen zodra deze sectie zichtbaar wordt, zodat Leaflet de
         kaart herberekent + opnieuw fit na initialisatie in een verborgen (0×0) container. */
      window.__ultimaInvalidateDealerMap = () => {
        map.invalidateSize();
        if (bounds.length) map.fitBounds(bounds, { padding: [24, 24] });
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

    function setDistanceLabel(card, km) {
      card.dataset.distance = km.toFixed(1);
      let distanceEl = card.querySelector('.dealer-distance');
      if (!distanceEl) {
        distanceEl = document.createElement('span');
        distanceEl.className = 'dealer-distance';
        card.insertBefore(distanceEl, card.firstChild);
      }
      distanceEl.textContent = '≈ ' + km.toFixed(1).replace('.', ',') + ' km bij jou vandaan';
    }

    function clearDistanceLabels() {
      cards.forEach((card) => {
        delete card.dataset.distance;
        const distanceEl = card.querySelector('.dealer-distance');
        if (distanceEl) distanceEl.remove();
      });
    }

    function setSearchStatus(text) {
      if (!searchStatus) return;
      if (text) {
        searchStatus.textContent = text;
        searchStatus.classList.add('is-visible');
      } else {
        searchStatus.textContent = '';
        searchStatus.classList.remove('is-visible');
      }
    }

    function showCardsForCountry(country) {
      cards.forEach((card) => {
        const cardCountry = card.dataset.country || 'all';
        card.style.display = (country === 'all' || cardCountry === country) ? '' : 'none';
      });
      syncMapVisibility();
    }

    function sortVisibleCardsByDistance(lat, lng) {
      cards.forEach((card) => {
        const cardLat = parseFloat(card.dataset.lat);
        const cardLng = parseFloat(card.dataset.lng);
        if (Number.isNaN(cardLat) || Number.isNaN(cardLng)) return;
        setDistanceLabel(card, haversineKm(lat, lng, cardLat, cardLng));
      });
      const sorted = [...cards].sort(
        (a, b) => parseFloat(a.dataset.distance ?? 'Infinity') - parseFloat(b.dataset.distance ?? 'Infinity')
      );
      sorted.forEach((card) => dealerList.appendChild(card));
    }

    let searchRequestId = 0;
    let searchDebounce = null;

    /* Geocodeert een vrije zoekterm via Nominatim (OpenStreetMap) — dezelfde bron als de kaart —
       zodat we ook zonder exacte naam-/plaatsmatch de dichtstbijzijnde dealers kunnen tonen. */
    async function geocodeQuery(query, country) {
      const countryCodes = country === 'all' ? 'nl,be,de' : country;
      const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes='
        + encodeURIComponent(countryCodes) + '&q=' + encodeURIComponent(query);
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('Geocoding mislukt');
      const results = await response.json();
      if (!results.length) return null;
      return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
    }

    /* Zorgt dat er na een zoekactie altijd dealers getoond worden: eerst een directe naam-/plaatsmatch,
       en anders — in plaats van een lege lijst — de dichtstbijzijnde dealers op basis van de zoekterm. */
    async function runSearch() {
      const query = (searchInput?.value || '').trim();
      const queryLower = query.toLowerCase();
      const country = countrySelect?.value || 'all';
      const requestId = ++searchRequestId;

      if (!query) {
        clearDistanceLabels();
        setSearchStatus('');
        showCardsForCountry(country);
        return;
      }

      const directMatches = cards.filter((card) => {
        const city = (card.dataset.city || '').toLowerCase();
        const name = (card.dataset.name || '').toLowerCase();
        const cardCountry = card.dataset.country || 'all';
        const matchesCountry = country === 'all' || cardCountry === country;
        return matchesCountry && (city.includes(queryLower) || name.includes(queryLower));
      });

      if (directMatches.length) {
        clearDistanceLabels();
        cards.forEach((card) => { card.style.display = directMatches.includes(card) ? '' : 'none'; });
        syncMapVisibility();
        setSearchStatus('');
        return;
      }

      // Geen directe match — toon vast alvast alle dealers (binnen het landfilter) i.p.v. een lege lijst,
      // terwijl op de achtergrond de dichtstbijzijnde dealers worden opgezocht.
      showCardsForCountry(country);
      setSearchStatus('Bezig met zoeken naar de dichtstbijzijnde dealers voor "' + query + '"…');

      try {
        const location = await geocodeQuery(query, country);
        if (requestId !== searchRequestId) return; // zoekterm is intussen gewijzigd

        if (location) {
          sortVisibleCardsByDistance(location.lat, location.lng);
          showCardsForCountry(country);
          setSearchStatus('Geen dealer met een naam of plaats die overeenkomt met "' + query + '" — hieronder de dichtstbijzijnde dealers, gesorteerd op afstand.');
        } else {
          clearDistanceLabels();
          showCardsForCountry(country);
          setSearchStatus('Geen dealers gevonden voor "' + query + '" — hier is het volledige overzicht.');
        }
      } catch (err) {
        if (requestId !== searchRequestId) return;
        clearDistanceLabels();
        showCardsForCountry(country);
        setSearchStatus('Geen dealers gevonden voor "' + query + '" — hier is het volledige overzicht.');
      }
    }

    function applyFilters() {
      window.clearTimeout(searchDebounce);
      searchDebounce = window.setTimeout(runSearch, 400);
    }

    searchInput?.addEventListener('input', applyFilters);
    countrySelect?.addEventListener('change', () => {
      window.clearTimeout(searchDebounce);
      runSearch();
    });
    runSearch();

    /* "Dealer bij mij in de buurt" — sorteert de lijst op afstand via geolocatie */
    if (locateBtn) {
      locateBtn.addEventListener('click', () => {
        if (!('geolocation' in navigator)) {
          if (locateStatus) locateStatus.textContent = 'Locatiebepaling wordt niet ondersteund door je browser.';
          return;
        }
        if (locateStatus) locateStatus.textContent = 'Bezig met het bepalen van je locatie…';

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude } = pos.coords;

            cards.forEach((card) => {
              const lat = parseFloat(card.dataset.lat);
              const lng = parseFloat(card.dataset.lng);
              if (Number.isNaN(lat) || Number.isNaN(lng)) return;
              const km = haversineKm(latitude, longitude, lat, lng);
              card.dataset.distance = km.toFixed(1);

              let distanceEl = card.querySelector('.dealer-distance');
              if (!distanceEl) {
                distanceEl = document.createElement('span');
                distanceEl.className = 'dealer-distance';
                card.insertBefore(distanceEl, card.firstChild);
              }
              distanceEl.textContent = '≈ ' + km.toFixed(1).replace('.', ',') + ' km bij jou vandaan';
            });

            const sorted = [...cards].sort(
              (a, b) => parseFloat(a.dataset.distance ?? 'Infinity') - parseFloat(b.dataset.distance ?? 'Infinity')
            );
            sorted.forEach((card) => dealerList.appendChild(card));

            if (map) {
              if (userMarker) map.removeLayer(userMarker);
              userMarker = L.marker([latitude, longitude], { icon: makePin('#4C6E7A') }).addTo(map);
              userMarker.bindPopup('<h4>Jouw locatie</h4>').openPopup();
              map.setView([latitude, longitude], 10, { animate: true });
            }

            const nearest = sorted.find((c) => c.style.display !== 'none');
            if (locateStatus) {
              locateStatus.textContent = nearest
                ? 'Dealers gesorteerd op afstand. Dichtstbijzijnde: ' + (nearest.dataset.name || '') + ' (≈ ' + String(nearest.dataset.distance).replace('.', ',') + ' km).'
                : 'Dealers gesorteerd op afstand tot jouw locatie.';
            }
          },
          (err) => {
            if (locateStatus) {
              locateStatus.textContent = err.code === err.PERMISSION_DENIED
                ? 'Locatietoegang geweigerd. Sta locatiebepaling toe, of zoek handmatig op plaatsnaam.'
                : 'Locatie kon niet worden bepaald. Zoek handmatig op plaatsnaam.';
            }
          }
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
