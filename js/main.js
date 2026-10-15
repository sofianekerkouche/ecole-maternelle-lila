/**
 * ==========================================================================
 * ÉCOLE MATERNELLE LILA — LOGIQUE INTERACTIVE OFFICIELLE
 * Navigation mobile, Défilement fluide, Galerie Lightbox & Formulaire
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

  burgerBtn?.addEventListener('click', openMobileMenu);
  mobileCloseBtn?.addEventListener('click', closeMobileMenu);
  mobileBackdrop?.addEventListener('click', closeMobileMenu);

  mobileNavLinks.forEach(link => {
    link.addEventListener('click', () => {
      closeMobileMenu();
    });
  });

  // Fermer le tiroir avec la touche Echap
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMobileMenu();
      closeLightbox();
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

  // --- 5. Galerie Photos Interactive & Modal Lightbox ---
  const lightboxModal = document.getElementById('lightbox-modal');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxCaption = document.getElementById('lightbox-caption');
  const lightboxClose = document.getElementById('lightbox-close');
  const galleryItems = document.querySelectorAll('.gallery-item');

  function openLightbox(src, caption) {
    if (!lightboxModal || !lightboxImg) return;
    lightboxImg.src = src;
    lightboxImg.alt = caption || 'Photo École Maternelle Lila';
    if (lightboxCaption) {
      lightboxCaption.textContent = caption || '';
    }
    lightboxModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    if (!lightboxModal) return;
    lightboxModal.classList.remove('active');
    document.body.style.overflow = '';
  }

  galleryItems.forEach(item => {
    item.addEventListener('click', () => {
      const img = item.querySelector('img');
      const captionEl = item.querySelector('.gallery-overlay h5');
      const caption = captionEl ? captionEl.textContent : (img ? img.alt : '');
      if (img) {
        openLightbox(img.src, caption);
      }
    });
  });

  lightboxClose?.addEventListener('click', closeLightbox);
  lightboxModal?.addEventListener('click', (e) => {
    if (e.target === lightboxModal) {
      closeLightbox();
    }
  });

  // --- 6. Formulaire de contact interactif ---
  const contactForm = document.getElementById('contact-form');
  const formFeedback = document.getElementById('form-feedback');

  contactForm?.addEventListener('submit', (e) => {
    e.preventDefault();

    const nameInput = document.getElementById('form-name');
    const phoneInput = document.getElementById('form-phone');

    if (!nameInput?.value.trim() || !phoneInput?.value.trim()) {
      alert('Veuillez renseigner votre nom et votre numéro de téléphone.');
      return;
    }

    // Simulation de succès côté client
    if (formFeedback) {
      formFeedback.innerHTML = `
        <strong>Merci beaucoup ${nameInput.value} ! 🌸</strong><br>
        Votre message a bien été pris en compte. L'équipe de l'École Lila vous recontactera au <strong>${phoneInput.value}</strong> très prochainement.
      `;
      formFeedback.className = 'form-feedback success';
      formFeedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    contactForm.reset();
  });

  // --- Carrousel des avis Google (8 avis, 2 par vue sur ordinateur) ---
  const reviewCarousel = document.querySelector('.parents-reviews-carousel');
  if (reviewCarousel) {
    const reviewCards = Array.from(reviewCarousel.querySelectorAll('.parent-review-card'));
    const prevReviewButton = reviewCarousel.querySelector('.review-prev');
    const nextReviewButton = reviewCarousel.querySelector('.review-next');
    const reviewDots = Array.from(reviewCarousel.querySelectorAll('.review-page-dot'));
    let reviewPage = 0;

    const reviewsPerView = () => 2;
    const renderReviewPage = () => {
      const perView = reviewsPerView();
      const maxPage = Math.ceil(reviewCards.length / perView) - 1;
      reviewPage = Math.min(reviewPage, maxPage);
      const start = reviewPage * perView;
      reviewCards.forEach((card, index) => {
        const visible = index >= start && index < start + perView;
        card.classList.toggle('is-visible', visible);
        card.setAttribute('aria-hidden', visible ? 'false' : 'true');
      });
      if (prevReviewButton) prevReviewButton.disabled = reviewPage === 0;
      if (nextReviewButton) nextReviewButton.disabled = reviewPage >= maxPage;
      reviewDots.forEach((dot, index) => {
        const active = index === reviewPage;
        dot.classList.toggle('is-active', active);
        if (active) dot.setAttribute('aria-current', 'true');
        else dot.removeAttribute('aria-current');
        dot.hidden = index > maxPage;
      });
    };

    prevReviewButton?.addEventListener('click', () => {
      if (reviewPage > 0) { reviewPage--; renderReviewPage(); }
    });
    nextReviewButton?.addEventListener('click', () => {
      const maxPage = Math.ceil(reviewCards.length / reviewsPerView()) - 1;
      if (reviewPage < maxPage) { reviewPage++; renderReviewPage(); }
    });
    reviewDots.forEach((dot, index) => dot.addEventListener('click', () => {
      reviewPage = index;
      renderReviewPage();
    }));
    window.addEventListener('resize', renderReviewPage);
    renderReviewPage();
  }

});
