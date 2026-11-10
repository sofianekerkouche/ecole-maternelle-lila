/**
 * ==========================================================================
 * ÉCOLE MATERNELLE LILA — LA MÉDIATHÈQUE ÉDUCATIVE
 * Recherche et filtres du catalogue (aucune bibliothèque) :
 *  - recherche par mots-clés, sans tenir compte des accents ni des majuscules ;
 *  - filtres par âge de l'enfant, par catégorie et par type d'accès (listes déroulantes natives) ;
 *  - état conservé dans l'adresse (?q=…&age=…&categorie=…&acces=…), pour partager un lien filtré.
 * Tout le contenu reste présent et lisible sans JavaScript : les cartes ne sont
 * jamais créées ni supprimées, seulement masquées (attribut hidden).
 * ==========================================================================
 */
(function () {
  'use strict';

  var tools = document.getElementById('mdt-tools');
  var grid = document.getElementById('mdt-cards');
  if (!tools || !grid) return;

  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var cards = $$('.mdt-card', grid);
  var input = document.getElementById('mdt-q');
  var status = document.getElementById('mdt-results-status');
  var reset = document.getElementById('mdt-reset');
  var empty = document.getElementById('mdt-empty');
  var bar = document.getElementById('mdt-results-bar');
  var moreWrap = document.getElementById('mdt-more-wrap');
  var more = document.getElementById('mdt-more');
  var PAGE = 9;          // 3 lignes de 3 cartes
  var shown = PAGE;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var PARAMS = { q: 'q', age: 'age', categorie: 'categorie', acces: 'acces' };
  var state = { q: '', age: 'tous', categorie: 'tous', acces: 'tous' };

  var normaliser = function (s) {
    return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[’']/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  };
  var pluriel = function (n, un, plusieurs) { return n + ' ' + (n > 1 ? plusieurs : un); };

  /* ---------- État initial depuis l'adresse ---------- */
  var url = new URL(window.location.href);
  Object.keys(PARAMS).forEach(function (k) {
    var v = url.searchParams.get(PARAMS[k]);
    if (v === null) return;
    if (k === 'q') { state.q = v; return; }
    var select = tools.querySelector('select[data-mdt-filtre="' + k + '"]');
    if (select && Array.prototype.some.call(select.options, function (o) { return o.value === v; })) state[k] = v;
  });
  input.value = state.q;
  tools.hidden = false;

  /* ---------- Interactions ---------- */
  var selects = $$('select[data-mdt-filtre]', tools);
  selects.forEach(function (select) {
    select.addEventListener('change', function () {
      state[select.getAttribute('data-mdt-filtre')] = select.value;
      shown = PAGE;
      apply(true);
    });
  });

  var timer;
  input.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(function () { state.q = input.value; shown = PAGE; apply(true); }, 160);
  });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && input.value) { e.preventDefault(); input.value = ''; state.q = ''; shown = PAGE; apply(true); }
  });

  more.addEventListener('click', function () {
    var premiere = shown;
    shown += PAGE;
    apply(true);
    // Le focus va sur la première carte ajoutée, pour poursuivre la lecture au clavier.
    var visibles = cards.filter(function (c) { return !c.hidden; });
    var cible = visibles[premiere] && visibles[premiere].querySelector('h3 a');
    if (cible) cible.focus({ preventScroll: true });
  });

  function toutEffacer() {
    state = { q: '', age: 'tous', categorie: 'tous', acces: 'tous' };
    input.value = '';
    shown = PAGE;
    apply(true);
    input.focus();
  }
  reset.addEventListener('click', toutEffacer);
  $$('[data-mdt-reset]').forEach(function (b) { b.addEventListener('click', toutEffacer); });

  /* ---------- Filtrage ---------- */
  function correspond(card, mots) {
    if (state.categorie !== 'tous' && card.getAttribute('data-categorie') !== state.categorie) return false;
    if (state.acces !== 'tous' && card.getAttribute('data-acces') !== state.acces) return false;
    if (state.age !== 'tous') {
      var a = Number(state.age);
      if (a < Number(card.getAttribute('data-age-min')) || a > Number(card.getAttribute('data-age-max'))) return false;
    }
    if (mots.length) {
      var texte = ' ' + card.getAttribute('data-recherche') + ' ';
      // Chaque mot doit apparaître (début de mot) : « anim fran » trouve « Les animaux en français… »
      for (var i = 0; i < mots.length; i++) if (texte.indexOf(' ' + mots[i]) === -1) return false;
    }
    return true;
  }

  function apply(interaction) {
    var mots = normaliser(state.q).split(' ').filter(Boolean);
    var visibles = 0;   // cartes correspondant à la sélection
    var affichees = 0;  // cartes réellement affichées (limite « Afficher plus »)
    cards.forEach(function (card) {
      var ok = correspond(card, mots);
      if (ok) visibles++;
      var montrer = ok && visibles <= shown;
      var etaitCachee = card.hidden;
      card.hidden = !montrer;
      card.classList.remove('is-entering');
      if (montrer) {
        if (interaction && etaitCachee && !reduceMotion.matches) {
          card.style.setProperty('--i', String(Math.min(affichees % PAGE, 8)));
          void card.offsetWidth;
          card.classList.add('is-entering');
        }
        affichees++;
      }
    });
    moreWrap.hidden = visibles <= shown;

    selects.forEach(function (select) {
      select.value = state[select.getAttribute('data-mdt-filtre')];
      select.classList.toggle('is-active', select.value !== 'tous');
    });

    var filtre = state.q.trim() || state.age !== 'tous' || state.categorie !== 'tous' || state.acces !== 'tous';
    empty.hidden = visibles > 0;
    reset.hidden = !filtre;
    // La phrase de résultat n'apparaît que lorsqu'une recherche ou un filtre est actif.
    bar.hidden = !filtre;
    status.innerHTML = filtre
      ? '<strong>' + pluriel(visibles, 'ressource', 'ressources') + '</strong> ' + (visibles > 1 ? 'correspondent' : 'correspond') + ' à votre sélection'
      : '';

    // Adresse : conserve la sélection sans créer d'entrée d'historique.
    var u = new URL(window.location.href);
    Object.keys(PARAMS).forEach(function (k) {
      var v = k === 'q' ? state.q.trim() : state[k];
      if (v && v !== 'tous') u.searchParams.set(PARAMS[k], v); else u.searchParams.delete(PARAMS[k]);
    });
    if (u.href !== window.location.href) history.replaceState(null, '', u.href);
  }

  apply(false);
})();

/**
 * Galerie d'aperçus des fiches ressources : une page à la fois, défilement automatique toutes les 4 secondes.
 * Pause : au survol, au clavier (focus), après un glissement au doigt, hors de l'écran, onglet masqué,
 * ou avec le bouton pause. Aucun défilement automatique si l'utilisateur limite les animations.
 * Sans JavaScript, la piste reste défilable au doigt ou à la souris (défilement accroché page par page).
 */
(function () {
  'use strict';
  var galeries = document.querySelectorAll('[data-mdt-galerie]');
  if (!galeries.length) return;
  var DELAI = 4000;
  var reduit = window.matchMedia('(prefers-reduced-motion: reduce)');

  Array.prototype.forEach.call(galeries, function (g) {
    var piste = g.querySelector('.mdt-galerie-piste');
    var diapos = piste.querySelectorAll('.mdt-galerie-diapo');
    var n = diapos.length;
    var ctrl = g.querySelector('.mdt-galerie-ctrl');
    if (n < 2 || !ctrl) return;
    ctrl.hidden = false;
    var points = g.querySelectorAll('.mdt-galerie-point');
    var btnPause = g.querySelector('[data-galerie="pause"]');
    var courant = 0, enPause = reduit.matches, survol = false, visible = true, repriseApres = 0;

    function majPoints() {
      Array.prototype.forEach.call(points, function (p, k) {
        if (k === courant) p.setAttribute('aria-current', 'true'); else p.removeAttribute('aria-current');
      });
    }
    function majPause() {
      btnPause.setAttribute('aria-pressed', enPause ? 'true' : 'false');
      btnPause.setAttribute('aria-label', enPause ? 'Reprendre le défilement des pages' : 'Mettre en pause le défilement des pages');
    }
    function aller(k) {
      courant = (k + n) % n;
      piste.scrollTo({ left: courant * piste.clientWidth, behavior: reduit.matches ? 'auto' : 'smooth' });
      majPoints();
    }

    g.querySelector('[data-galerie="prec"]').addEventListener('click', function () { aller(courant - 1); repriseApres = Date.now() + 8000; });
    g.querySelector('[data-galerie="suiv"]').addEventListener('click', function () { aller(courant + 1); repriseApres = Date.now() + 8000; });
    Array.prototype.forEach.call(points, function (p) {
      p.addEventListener('click', function () { aller(+p.getAttribute('data-galerie-page')); repriseApres = Date.now() + 8000; });
    });
    btnPause.addEventListener('click', function () { enPause = !enPause; majPause(); });

    // Page affichée après un glissement manuel
    var attente;
    piste.addEventListener('scroll', function () {
      clearTimeout(attente);
      attente = setTimeout(function () {
        var k = Math.round(piste.scrollLeft / piste.clientWidth);
        if (k !== courant) { courant = Math.max(0, Math.min(n - 1, k)); majPoints(); }
      }, 120);
    }, { passive: true });
    piste.addEventListener('touchstart', function () { repriseApres = Date.now() + 8000; }, { passive: true });
    g.addEventListener('mouseenter', function () { survol = true; });
    g.addEventListener('mouseleave', function () { survol = false; });
    g.addEventListener('focusin', function () { survol = true; });
    g.addEventListener('focusout', function () { survol = false; });
    piste.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); aller(courant + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); aller(courant - 1); }
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }, { threshold: 0.4 }).observe(g);
    }
    window.addEventListener('resize', function () { piste.scrollTo({ left: courant * piste.clientWidth }); });

    majPause();
    setInterval(function () {
      if (enPause || survol || !visible || document.hidden || Date.now() < repriseApres) return;
      aller(courant + 1);
    }, DELAI);
  });
})();
