/**
 * ==========================================================================
 * ÉCOLE MATERNELLE LILA — LE COIN DES PARENTS
 * Compléments de la rubrique (aucune bibliothèque) :
 *  - compteurs des catégories, calculés à partir du manifeste ;
 *  - filtres par thématique, générés à partir du manifeste ;
 *  - « Afficher plus », phrase de résultat, état vide ;
 *  - contrôle de cohérence HTML ↔ manifeste (console).
 * Tout le contenu reste présent et lisible sans JavaScript : les cartes ne sont
 * jamais créées ni supprimées, seulement masquées (attribut hidden).
 * ==========================================================================
 */
(function () {
  'use strict';

  var main = document.querySelector('.cdp-main');
  if (!main) return;

  var PAGE = 6;
  var MANIFEST = main.getAttribute('data-cdp-manifeste') || 'manifest.json';
  var RUBRIQUE = main.getAttribute('data-cdp-rubrique') || './';
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var plural = function (n, one, many) { return n + ' ' + (n > 1 ? many : one); };

  var grid = $('#cdp-posts');
  var cards = grid ? $$('.cdp-post', grid) : [];
  var state = { cat: 'tous', shown: PAGE };
  var data = null;

  fetch(MANIFEST, { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(init)
    .catch(function (err) {
      // La page reste complète : seuls les compléments (filtres, compteurs) sont absents.
      console.warn('[Coin des parents] Manifeste indisponible :', err);
    });

  function init(json) {
    data = json;
    data.index = {};
    data.categories.forEach(function (c) {
      c.total = data.articles.filter(function (a) { return a.category === c.slug; }).length;
      data.index[c.slug] = c;
    });
    renderCounters();
    if (grid) {
      buildFilters();
      applyFilter(false, true);
    }
    checkConsistency();
  }

  /* ---------- Compteurs (jamais saisis à la main) ---------- */
  function renderCounters() {
    $$('[data-cdp-compteur]').forEach(function (el) {
      var c = data.index[el.getAttribute('data-cdp-compteur')];
      el.textContent = !c ? '' : c.total === 0 ? 'Bientôt' : plural(c.total, 'article', 'articles');
    });
  }

  /* ---------- Filtres ---------- */
  function buildFilters() {
    var wrap = $('#cdp-filters');
    var block = $('#cdp-filters-block');
    if (!wrap || !block) return;
    wrap.appendChild(makeFilter('tous', 'Tout afficher', null));
    data.categories.forEach(function (c) { wrap.appendChild(makeFilter(c.slug, c.short_name || c.name, c)); });
    block.hidden = false;
    var more = $('#cdp-more-btn');
    if (more) more.addEventListener('click', function () { state.shown += PAGE; applyFilter(true); });
  }

  function makeFilter(id, label, cat) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'cdp-filter';
    b.setAttribute('aria-pressed', id === state.cat ? 'true' : 'false');
    b.setAttribute('aria-controls', 'cdp-posts');
    b.setAttribute('data-filtre', id);
    if (cat) { b.setAttribute('data-categorie', id); b.title = cat.name; }
    b.innerHTML = '<svg class="cdp-filter-tick" aria-hidden="true"><use href="#cdp-tick"/></svg>' +
      (cat ? '<span class="cdp-filter-dot" aria-hidden="true"></span>' : '') + '<span class="cdp-filter-label"></span>';
    $('.cdp-filter-label', b).textContent = label;
    b.addEventListener('click', function () {
      if (state.cat === id) return;
      state.cat = id;
      state.shown = PAGE;
      $$('.cdp-filter').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      try { b.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduceMotion.matches ? 'auto' : 'smooth' }); } catch (e) {}
      applyFilter(false);
    });
    return b;
  }

  function categoryOf(card) {
    // La catégorie fait foi dans le manifeste ; l'attribut HTML sert de secours.
    var a = findArticle(card.getAttribute('data-cdp-slug'));
    return a ? a.category : card.getAttribute('data-categorie');
  }

  function findArticle(slug) {
    for (var i = 0; i < data.articles.length; i++) if (data.articles[i].slug === slug) return data.articles[i];
    return null;
  }

  /* ---------- Affichage (cartes masquées, jamais supprimées) ---------- */
  // initial : premier affichage après chargement, sans animation ni fondu.
  function applyFilter(append, initial) {
    var matching = cards.filter(function (c) { return state.cat === 'tous' || categoryOf(c) === state.cat; });
    var visibleBefore = cards.filter(function (c) { return !c.hidden; });

    var swap = function () {
      var shownSet = matching.slice(0, state.shown);
      var k = 0;
      cards.forEach(function (c) {
        var show = shownSet.indexOf(c) !== -1;
        var wasHidden = c.hidden;
        c.hidden = !show;
        c.classList.remove('is-entering');
        if (show && !initial && (wasHidden || !append) && !reduceMotion.matches) {
          c.style.setProperty('--i', k++);
          void c.offsetWidth;
          c.classList.add('is-entering');
        }
      });
      grid.classList.remove('is-leaving');
      var empty = $('#cdp-empty');
      if (empty) empty.hidden = matching.length !== 0;
      updateMore(matching.length);
      setStatus(matching.length, Math.min(state.shown, matching.length));
      if (append) {
        var firstNew = shownSet.filter(function (c) { return visibleBefore.indexOf(c) === -1; })[0];
        var link = firstNew && $('h3 a', firstNew);
        if (link) link.focus();
      }
    };

    if (initial || append || reduceMotion.matches || !visibleBefore.length) return swap();
    grid.classList.add('is-leaving');
    setTimeout(swap, 150);
  }

  function updateMore(total) {
    var wrap = $('#cdp-more-wrap');
    var btn = $('#cdp-more-btn');
    if (!wrap || !btn) return;
    var rest = total - state.shown;
    wrap.hidden = rest <= 0;
    if (rest > 0) btn.textContent = 'Afficher ' + plural(Math.min(rest, PAGE), 'article', 'articles') + ' de plus';
  }

  function setStatus(total, shown) {
    var bar = $('#cdp-results-bar');
    var status = $('#cdp-results-status');
    var link = $('#cdp-results-link');
    if (!status) return;
    if (bar) bar.classList.toggle('is-empty', state.cat === 'tous');
    if (link) link.textContent = '';
    if (state.cat === 'tous') {
      status.innerHTML = '<span class="cdp-sr-only"></span>';
      $('span', status).textContent = 'Toutes les thématiques : ' + plural(shown, 'article affiché', 'articles affichés') + ' sur ' + total + '.';
      return;
    }
    var c = data.index[state.cat];
    status.innerHTML = '<strong></strong> en <span></span>';
    $('strong', status).textContent = total === 0 ? 'Aucun article' : shown < total ? shown + ' sur ' + total + ' articles' : plural(total, 'article', 'articles');
    $('span', status).textContent = c.name;
    if (link) {
      link.innerHTML = '<a></a>';
      var a = $('a', link);
      a.href = RUBRIQUE + c.slug + '/index.html';
      a.textContent = 'Voir la page « ' + c.name + ' » →';
    }
  }

  /* ---------- Contrôle de cohérence (console) ---------- */
  function checkConsistency() {
    var warn = function (msg) { console.warn('[Coin des parents] ' + msg); };
    var slugs = data.articles.map(function (a) { return a.slug; });
    slugs.forEach(function (s, i) { if (slugs.indexOf(s) !== i) warn('Slug en double dans le manifeste : ' + s); });
    if (typeof data.total_articles === 'number' && data.total_articles !== data.articles.length) {
      warn('total_articles (' + data.total_articles + ') ≠ nombre réel d\'articles (' + data.articles.length + ')');
    }
    data.categories.forEach(function (c) {
      if (typeof c.count === 'number' && c.count !== c.total) warn('Compte saisi pour « ' + c.name + ' » (' + c.count + ') ≠ compte réel (' + c.total + ')');
    });
    data.articles.forEach(function (a) { if (!data.index[a.category]) warn('Catégorie inconnue pour ' + a.slug + ' : ' + a.category); });
    var featured = data.articles.filter(function (a) { return a.featured; });
    if (featured.length !== 1) warn(featured.length + ' article(s) marqué(s) « featured » au lieu de 1');
    var featuredHtml = $('.cdp-featured');
    if (featuredHtml && featured[0] && featuredHtml.getAttribute('data-cdp-slug') !== featured[0].slug) warn('L\'article à la une du HTML ne correspond pas au manifeste');
    if (grid) {
      var htmlSlugs = cards.map(function (c) { return c.getAttribute('data-cdp-slug'); });
      if (htmlSlugs.join('|') !== slugs.join('|')) warn('Les cartes du HTML ne correspondent pas aux articles du manifeste (ordre ou contenu). Relancer le script de génération.');
      cards.forEach(function (c) {
        var a = findArticle(c.getAttribute('data-cdp-slug'));
        if (a && a.category !== c.getAttribute('data-categorie')) warn('Catégorie différente entre HTML et manifeste : ' + a.slug);
      });
    }
  }
})();
