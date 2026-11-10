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
