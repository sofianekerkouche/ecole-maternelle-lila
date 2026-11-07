/**
 * ==========================================================================
 * ÉCOLE MATERNELLE LILA — LOGIQUE INTERACTIVE OFFICIELLE
 * Navigation mobile, Défilement fluide, Galerie photos & Formulaire
 * ==========================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- 1. Gestion du Header Sticky & Scroll ---
  const header = document.getElementById('site-header');
  const backToTopBtn = document.getElementById('back-to-top');

  window.addEventListener('scroll', () => {
    const scrollPos = window.scrollY;

    // Ombre du header
    if (scrollPos > 30) {
      header?.classList.add('scrolled');
    } else {
      header?.classList.remove('scrolled');
    }

    // Bouton retour en haut
    if (scrollPos > 400) {
      backToTopBtn?.classList.add('visible');
    } else {
      backToTopBtn?.classList.remove('visible');
    }
  }, { passive: true });

  // Clic bouton retour en haut
  backToTopBtn?.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });

  // Masquer le bouton d'appel flottant lorsque le footer entre dans l'écran.
  const floatingCallBtn = document.getElementById('floating-call');
  const siteFooter = document.querySelector('.site-footer');

  if (floatingCallBtn && siteFooter && 'IntersectionObserver' in window) {
    const footerObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        floatingCallBtn.classList.toggle('hidden-in-footer', entry.isIntersecting);
      });
    }, {
      root: null,
      threshold: 0,
      rootMargin: '0px 0px 0px 0px'
    });

    footerObserver.observe(siteFooter);
  }

  // --- 2. Menu Navigation Mobile (Tiroir) ---
  const burgerBtn = document.getElementById('burger-btn');
  const mobileDrawer = document.getElementById('mobile-drawer');
  const mobileBackdrop = document.getElementById('mobile-backdrop');
  const mobileCloseBtn = document.getElementById('mobile-close-btn');
  const mobileNavLinks = document.querySelectorAll('.mobile-links a');

  function openMobileMenu() {
    mobileDrawer?.classList.add('open');
    mobileBackdrop?.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeMobileMenu() {
    mobileDrawer?.classList.remove('open');
    mobileBackdrop?.classList.remove('open');
    document.body.style.overflow = '';
  }

  burgerBtn?.setAttribute('aria-expanded', 'false');
  burgerBtn?.addEventListener('click', () => {
    openMobileMenu();
    burgerBtn.setAttribute('aria-expanded', 'true');
  });
  mobileCloseBtn?.addEventListener('click', () => {
    closeMobileMenu();
    burgerBtn?.setAttribute('aria-expanded', 'false');
  });
  mobileBackdrop?.addEventListener('click', () => {
    closeMobileMenu();
    burgerBtn?.setAttribute('aria-expanded', 'false');
  });

  mobileNavLinks.forEach(link => {
    link.addEventListener('click', () => {
      closeMobileMenu();
      burgerBtn?.setAttribute('aria-expanded', 'false');
    });
  });

  // Fermer le tiroir avec la touche Echap
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMobileMenu();
      burgerBtn?.setAttribute('aria-expanded', 'false');
    }
  });

  // --- 3. Défilement fluide avec compensation de l'en-tête fixe ---
  const anchorLinks = document.querySelectorAll('a[href^="#"]');

  anchorLinks.forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#' || !targetId) return;

      const targetEl = document.querySelector(targetId);
      if (targetEl) {
        e.preventDefault();
        const headerHeight = header ? header.offsetHeight : 80;
        const targetPos = targetEl.getBoundingClientRect().top + window.pageYOffset - headerHeight + 5;

        window.scrollTo({
          top: targetPos,
          behavior: 'smooth'
        });
      }
    });
  });

  // --- 4. Mise en évidence du lien actif lors du défilement ---
  const sections = document.querySelectorAll('section[id]');
  const desktopNavLinks = document.querySelectorAll('.nav-desktop a[href^="#"]');

  function highlightNavOnScroll() {
    const scrollY = window.pageYOffset;
    const headerHeight = header ? header.offsetHeight : 80;

    sections.forEach(current => {
      const sectionHeight = current.offsetHeight;
      const sectionTop = current.offsetTop - headerHeight - 50;
      const sectionId = current.getAttribute('id');

      if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
        desktopNavLinks.forEach(link => {
          if (link.getAttribute('href') === `#${sectionId}`) {
            link.classList.add('active');
          } else {
            link.classList.remove('active');
          }
        });
      }
    });
  }

  window.addEventListener('scroll', highlightNavOnScroll, { passive: true });

  // --- 6. Formulaire de contact via Web3Forms ---
  const contactForm = document.getElementById('contact-form');
  const formFeedback = document.getElementById('form-feedback');

  contactForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nameInput = document.getElementById('form-name');
    const phoneInput = document.getElementById('form-phone');
    const sectionInput = document.getElementById('form-section');
const emailSubject = document.getElementById('form-email-subject');

const subjectLabels = {
  autre: 'Renseignement général / Visite',
  partenariat: 'Proposition de partenariat',
  creche: 'Inscription — Section d’Éveil',
  tps: 'Inscription — TPS',
  ps: 'Inscription — PS',
  ms: 'Inscription — MS',
  gs: 'Inscription — GS'
};

if (emailSubject && sectionInput) {
  emailSubject.value =
    `Demande — ${subjectLabels[sectionInput.value] || 'Renseignement général'}`;
}	
    const submitButton = contactForm.querySelector('button[type="submit"]');
    const submitText = submitButton?.querySelector('span');

    if (!nameInput?.value.trim() || !phoneInput?.value.trim()) {
      if (formFeedback) {
        formFeedback.textContent =
          'Veuillez renseigner votre nom et votre numéro de téléphone.';
        formFeedback.className = 'form-feedback error';
      }
      return;
    }

    if (formFeedback) {
      formFeedback.textContent = '';
      formFeedback.className = 'form-feedback';
    }

    if (submitButton) submitButton.disabled = true;
    if (submitText) submitText.textContent = 'Envoi en cours…';

    try {
      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        body: new FormData(contactForm)
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Échec de l’envoi.');
      }

      if (formFeedback) {
  formFeedback.textContent =
    'Merci pour votre message ! ' +
    'Votre demande a bien été transmise à l’administration de l’École Maternelle Lila.';
  formFeedback.className = 'form-feedback success';
  formFeedback.scrollIntoView({
    behavior: 'smooth',
    block: 'nearest'
  });
}

      contactForm.reset();

    } catch (error) {
      console.error('Erreur formulaire Web3Forms :', error);

      if (formFeedback) {
  formFeedback.textContent =
    'Oups, votre message n’a pas pu être envoyé. ' +
    'Une erreur est survenue lors de l’envoi de votre demande. ' +
    'Veuillez réessayer dans quelques instants ou nous contacter directement par téléphone au +213 556 06 77 79.';
  formFeedback.className = 'form-feedback error';
  formFeedback.scrollIntoView({
    behavior: 'smooth',
    block: 'nearest'
  });
}

    } finally {
      if (submitButton) submitButton.disabled = false;
      if (submitText) submitText.textContent = 'Envoyer ma demande';
    }
  });


  // --- Carrousel des avis Google : deux témoignages affichés, défilement d’un avis toutes les 6 secondes ---
  const reviewCarousel = document.querySelector('.parents-reviews-carousel');
  if (reviewCarousel) {
    const reviewCards = Array.from(reviewCarousel.querySelectorAll('.parent-review-card'));
    const prevReviewButton = reviewCarousel.querySelector('.review-prev');
    const nextReviewButton = reviewCarousel.querySelector('.review-next');
    const reviewDots = Array.from(reviewCarousel.querySelectorAll('.review-page-dot'));
    let reviewIndex = 0;
    let reviewTimer;

    const isMobileReviewView = () => window.matchMedia('(max-width: 600px)').matches;

    const renderReview = () => {
      const visibleCount = isMobileReviewView() ? 1 : 2;
      reviewCards.forEach((card, index) => {
        const distance = (index - reviewIndex + reviewCards.length) % reviewCards.length;
        const visible = distance < visibleCount;
        card.classList.toggle('is-visible', visible);
        card.setAttribute('aria-hidden', visible ? 'false' : 'true');
      });
      reviewDots.forEach((dot, index) => {
        const active = index === reviewIndex;
        dot.classList.toggle('is-active', active);
        if (active) dot.setAttribute('aria-current', 'true');
        else dot.removeAttribute('aria-current');
        dot.hidden = index >= reviewCards.length;
      });
    };

    const goToReview = (index) => {
      if (!reviewCards.length) return;
      reviewIndex = (index + reviewCards.length) % reviewCards.length;
      renderReview();
      startReviewTimer();
    };

    const startReviewTimer = () => {
      if (reviewTimer) window.clearInterval(reviewTimer);
      reviewTimer = window.setInterval(() => {
        reviewIndex = (reviewIndex + 1) % reviewCards.length;
        renderReview();
      }, 6000);
    };

    prevReviewButton?.addEventListener('click', () => goToReview(reviewIndex - 1));
    nextReviewButton?.addEventListener('click', () => goToReview(reviewIndex + 1));
    reviewDots.forEach((dot, index) => dot.addEventListener('click', () => goToReview(index)));
    renderReview();
    startReviewTimer();
    window.addEventListener('resize', renderReview);
  }

});
