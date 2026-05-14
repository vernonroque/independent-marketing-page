/* =============================================
   app.js — Navigation, modals, URL param handling
   ============================================= */

// ── URL Parameter Tracking ───────────────────────
(function captureUtm() {
  const params = new URLSearchParams(window.location.search);
  const utm_source   = params.get('utm_source');
  const utm_medium   = params.get('utm_medium');
  const utm_campaign = params.get('utm_campaign');
  const ref          = params.get('ref');

  // Persist UTM data in sessionStorage for attribution across page interactions
  if (utm_source)   sessionStorage.setItem('utm_source', utm_source);
  if (utm_medium)   sessionStorage.setItem('utm_medium', utm_medium);
  if (utm_campaign) sessionStorage.setItem('utm_campaign', utm_campaign);
  if (ref)          sessionStorage.setItem('ref_source', ref);

  // Fire GA4 referral event if a ref param is present
  if (ref && typeof gtag !== 'undefined') {
    gtag('event', 'referral_source', { source: ref });
  }
})();

// ── DOM Ready ────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initMobileMenu();
  checkSuccessParams();
  initModalClose();
});

// ── Navigation: scroll effects ───────────────────
function initNavigation() {
  const header = document.getElementById('header');
  if (!header) return;

  // Add 'scrolled' class when page is scrolled past hero
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }, { passive: true });

  // Close mobile menu when a nav link is clicked
  document.querySelectorAll('.mobile-nav-link, .mobile-cta').forEach(link => {
    link.addEventListener('click', closeMobileMenu);
  });
}

// ── Mobile Menu Toggle ───────────────────────────
function initMobileMenu() {
  const hamburger  = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobile-menu');
  if (!hamburger || !mobileMenu) return;

  hamburger.addEventListener('click', () => {
    const isOpen = hamburger.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', String(isOpen));
    mobileMenu.classList.toggle('open', isOpen);
    mobileMenu.setAttribute('aria-hidden', String(!isOpen));
  });
}

function closeMobileMenu() {
  const hamburger  = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobile-menu');
  if (!hamburger || !mobileMenu) return;
  hamburger.classList.remove('open');
  hamburger.setAttribute('aria-expanded', 'false');
  mobileMenu.classList.remove('open');
  mobileMenu.setAttribute('aria-hidden', 'true');
}

// ── Success Params (Stripe redirect) ────────────
// Called on DOMContentLoaded; reads ?success=1&email=...&plan=...
function checkSuccessParams() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('success') !== '1') return;

  const email = params.get('email') || '';
  const plan  = params.get('plan')  || 'Pro';

  showSuccessModal(email, plan);

  // Clean URL without a full reload
  const cleanUrl = window.location.pathname;
  window.history.replaceState({}, '', cleanUrl);

  // GA4 conversion event
  if (typeof gtag !== 'undefined') {
    gtag('event', 'purchase_complete', {
      plan,
      email,
      utm_source:   sessionStorage.getItem('utm_source')   || 'direct',
      utm_medium:   sessionStorage.getItem('utm_medium')   || '(none)',
      utm_campaign: sessionStorage.getItem('utm_campaign') || '(none)',
    });
  }
}

// ── Show Success Modal ───────────────────────────
function showSuccessModal(email, plan) {
  const modal     = document.getElementById('modal-success');
  const planEl    = document.getElementById('success-plan-name');
  const emailEl   = document.getElementById('success-email');
  if (!modal) return;

  if (planEl)  planEl.textContent  = capitalize(plan);
  if (emailEl) emailEl.textContent = email;

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

// ── Generic Modal Close ──────────────────────────
function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.style.display = 'none';
  document.body.style.overflow = '';
}

// ── Modal Close Bindings ─────────────────────────
function initModalClose() {
  // Email modal close button
  const emailClose = document.getElementById('modal-email-close');
  if (emailClose) {
    emailClose.addEventListener('click', () => closeModal('modal-email'));
  }

  // Email modal success "Close" button
  const emailSuccessClose = document.getElementById('modal-close-success');
  if (emailSuccessClose) {
    emailSuccessClose.addEventListener('click', () => closeModal('modal-email'));
  }

  // Success (Stripe) modal close button
  const successClose = document.getElementById('modal-success-close');
  if (successClose) {
    successClose.addEventListener('click', () => closeModal('modal-success'));
  }

  // Stripe success modal dismiss button
  const successDismiss = document.getElementById('success-modal-dismiss');
  if (successDismiss) {
    successDismiss.addEventListener('click', () => closeModal('modal-success'));
  }

  // Click outside modal overlay to close
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal(overlay.id);
      }
    });
  });

  // Escape key to close any open modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay').forEach(overlay => {
        if (overlay.style.display !== 'none') {
          closeModal(overlay.id);
        }
      });
    }
  });
}

// ── Hero JSON Typewriter Animation ──────────────
// Animates the JSON output card in the hero visual
document.addEventListener('DOMContentLoaded', () => {
  const heroJson = document.getElementById('hero-json-output');
  if (!heroJson) return;

  const jsonText = `{
  "merchant_name": "The Golden Fork",
  "date": "2025-04-18",
  "total": 106.21,
  "line_items": [
    { "desc": "Ribeye Steak", "price": 42.00 },
    { "desc": "Caesar Salad", "price": 14.50 }
  ],
  "payment_method": "Visa",
  "currency": "USD"
}`;

  let i = 0;
  const speed = 18; // ms per character

  // Delay start so it's noticeable after page load
  setTimeout(() => {
    const interval = setInterval(() => {
      heroJson.textContent = jsonText.slice(0, i + 1);
      i++;
      if (i >= jsonText.length) clearInterval(interval);
    }, speed);
  }, 700);
});

// ── Utility ──────────────────────────────────────
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// Expose for use in pricing.js and demo.js
window.closeModal = closeModal;
window.showSuccessModal = showSuccessModal;
