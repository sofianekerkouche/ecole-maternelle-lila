/**
 * ==========================================================================
 * ÉCOLE MATERNELLE LILA — MENU « RESSOURCES »
 * Ouverture du sous-menu au clic, au survol et au clavier.
 * Sans JavaScript, le lien « Le Coin des parents » reste accessible dans le
 * tiroir mobile et dans le pied de page.
 * ==========================================================================
 */
(function () {
  'use strict';

  var menus = document.querySelectorAll('.nav-ressources');
  if (!menus.length) return;

  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)');

  Array.prototype.forEach.call(menus, function (wrap) {
    var btn = wrap.querySelector('.nav-ressources-btn');
    var menu = wrap.querySelector('.nav-ressources-menu');
    if (!btn || !menu) return;

    var openedByHover = false;
    var hoverTimer;

    function setOpen(open, focusFirst) {
      wrap.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open && focusFirst) {
        var first = menu.querySelector('a');
        if (first) first.focus();
      }
    }

    btn.addEventListener('click', function () {
      // Un clic juste après une ouverture au survol garde le menu ouvert.
      if (openedByHover) { openedByHover = false; setOpen(true); return; }
      setOpen(!wrap.classList.contains('open'));
    });

    btn.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true, true); }
    });

    wrap.addEventListener('mouseenter', function () {
      if (!canHover.matches) return;
      clearTimeout(hoverTimer);
      if (!wrap.classList.contains('open')) { openedByHover = true; setOpen(true); }
    });

    wrap.addEventListener('mouseleave', function () {
      if (!canHover.matches) return;
      hoverTimer = setTimeout(function () { openedByHover = false; setOpen(false); }, 220);
    });

    wrap.addEventListener('focusout', function (e) {
      if (!wrap.contains(e.relatedTarget)) setOpen(false);
    });

    document.addEventListener('click', function (e) {
      if (!wrap.contains(e.target)) setOpen(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && wrap.classList.contains('open')) {
        setOpen(false);
        btn.focus();
      }
    });
  });
})();
