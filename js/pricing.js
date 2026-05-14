/* =============================================
   pricing.js — Pricing / checkout logic
   Manages the email modal, free key requests,
   and paid Stripe checkout redirects.
   ============================================= */

// ── Plan Definitions ──────────────────────────────
const PLAN_DETAILS = {
  free: {
    name: 'Free',
    icon: '🚀',
    price: '$0/month',
    features: [
      '500 requests/month',
      '100 requests/hour',
      'All receipt types',
      'JSON output',
      'Community support',
    ],
    submitLabel: 'Get Free Key',
  },
  starter: {
    name: 'Starter',
    icon: '⚡',
    price: '$12/month',
    features: [
      '5,000 requests/month',
      '500 requests/hour',
      'All receipt types',
      'JSON output',
      'Email support',
    ],
    submitLabel: 'Continue to Payment →',
  },
  pro: {
    name: 'Pro',
    icon: '⭐',
    price: '$35/month',
    features: [
      '25,000 requests/month',
      '2,000 requests/hour',
      'All receipt types',
      'JSON output',
      'Priority email support',
    ],
    submitLabel: 'Continue to Payment →',
  },
  business: {
    name: 'Business',
    icon: '🏢',
    price: '$109/month',
    features: [
      '150,000 requests/month',
      'Unlimited rate limit',
      'All receipt types',
      'JSON output',
      'Dedicated support',
    ],
    submitLabel: 'Continue to Payment →',
  },
};

// ── State ─────────────────────────────────────────
let activePlan = null;

// ── DOM References ────────────────────────────────
const modalEmail    = document.getElementById('modal-email');
const modalContent  = document.getElementById('modal-email-content');
const modalSuccess  = document.getElementById('modal-email-success');
const modalForm     = document.getElementById('modal-email-form');
const modalInput    = document.getElementById('modal-email-input');
const modalError    = document.getElementById('modal-form-error');
const modalSubmit   = document.getElementById('modal-submit-btn');
const modalSubmitTxt = document.getElementById('modal-submit-text');

const modalPlanIcon  = document.getElementById('modal-plan-icon');
const modalPlanName  = document.getElementById('modal-plan-name');
const modalPlanPrice = document.getElementById('modal-plan-price');
const modalFeatures  = document.getElementById('modal-features');
const modalSuccessEmail = document.getElementById('modal-success-email');

// ── Bind Pricing CTA Buttons ───────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.btn-pricing').forEach(btn => {
    btn.addEventListener('click', () => {
      const plan  = btn.dataset.plan;
      const price = btn.dataset.price;
      if (plan) openEmailModal(plan, price);
    });
  });
});

// ── Open Email Modal ──────────────────────────────
function openEmailModal(planKey, price) {
  const plan = PLAN_DETAILS[planKey];
  if (!plan || !modalEmail) return;

  activePlan = planKey;

  // Populate modal content
  if (modalPlanIcon)  modalPlanIcon.textContent  = plan.icon;
  if (modalPlanName)  modalPlanName.textContent   = plan.name;
  if (modalPlanPrice) modalPlanPrice.textContent  = plan.price || price;
  if (modalSubmitTxt) modalSubmitTxt.textContent  = plan.submitLabel;

  if (modalFeatures) {
    modalFeatures.innerHTML = plan.features
      .map(f => `<li>${escapeHtml(f)}</li>`)
      .join('');
  }

  // Reset form state
  if (modalInput)    modalInput.value = '';
  if (modalError)    hideModalError();
  if (modalContent)  modalContent.style.display = 'block';
  if (modalSuccess)  modalSuccess.style.display = 'none';
  if (modalSubmit)   setModalSubmitLoading(false);

  // Show modal
  modalEmail.style.display  = 'flex';
  document.body.style.overflow = 'hidden';

  // Focus email input for accessibility
  setTimeout(() => {
    if (modalInput) modalInput.focus();
  }, 100);

  // GA4 modal open event
  if (typeof gtag !== 'undefined') {
    gtag('event', 'modal_open', {
      plan: planKey,
      utm_source:   sessionStorage.getItem('utm_source')   || 'direct',
      utm_medium:   sessionStorage.getItem('utm_medium')   || '(none)',
      utm_campaign: sessionStorage.getItem('utm_campaign') || '(none)',
    });
  }
}

// ── Modal Form Submission ─────────────────────────
if (modalForm) {
  modalForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideModalError();

    const email = modalInput ? modalInput.value.trim() : '';

    // Client-side validation
    if (!email || !isValidEmail(email)) {
      showModalError('Please enter a valid email address.');
      return;
    }

    setModalSubmitLoading(true);

    try {
      if (activePlan === 'free') {
        await handleFreeKey(email);
      } else {
        await handlePaidCheckout(email, activePlan);
      }
    } catch (err) {
      showModalError(err.message || 'Something went wrong. Please try again.');
      setModalSubmitLoading(false);
    }
  });
}

// ── Free Tier Key Request ─────────────────────────
async function handleFreeKey(email) {
  const response = await fetch('/api/keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  const contentType = response.headers.get('content-type');
  const data = contentType && contentType.includes('application/json')
    ? await response.json()
    : null;

  if (!response.ok) {
    const msg = data?.error || `Request failed (${response.status}). Please try again.`;
    throw new Error(msg);
  }

  // Show inline success within the modal
  if (modalContent) modalContent.style.display = 'none';
  if (modalSuccess) {
    modalSuccess.style.display = 'block';
    if (modalSuccessEmail) modalSuccessEmail.textContent = email;
  }

  setModalSubmitLoading(false);

  // GA4 conversion event
  if (typeof gtag !== 'undefined') {
    gtag('event', 'free_key_signup', {
      email,
      utm_source:   sessionStorage.getItem('utm_source')   || 'direct',
      utm_medium:   sessionStorage.getItem('utm_medium')   || '(none)',
      utm_campaign: sessionStorage.getItem('utm_campaign') || '(none)',
    });
  }
}

// ── Paid Checkout ─────────────────────────────────
async function handlePaidCheckout(email, plan) {
  const response = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, plan }),
  });

  const contentType = response.headers.get('content-type');
  const data = contentType && contentType.includes('application/json')
    ? await response.json()
    : null;

  if (!response.ok) {
    const msg = data?.error || `Request failed (${response.status}). Please try again.`;
    throw new Error(msg);
  }

  if (!data?.checkout_url) {
    throw new Error('No checkout URL returned. Please try again.');
  }

  // GA4 begin_checkout event before redirect
  if (typeof gtag !== 'undefined') {
    gtag('event', 'begin_checkout', {
      plan,
      email,
      utm_source:   sessionStorage.getItem('utm_source')   || 'direct',
      utm_medium:   sessionStorage.getItem('utm_medium')   || '(none)',
      utm_campaign: sessionStorage.getItem('utm_campaign') || '(none)',
    });
  }

  // Redirect to Stripe-hosted checkout
  window.location.href = data.checkout_url;
}

// ── Form Helpers ──────────────────────────────────
function showModalError(message) {
  if (!modalError) return;
  modalError.textContent   = message;
  modalError.style.display = 'block';
}

function hideModalError() {
  if (!modalError) return;
  modalError.style.display = 'none';
  modalError.textContent   = '';
}

function setModalSubmitLoading(isLoading) {
  if (!modalSubmit || !modalSubmitTxt) return;
  modalSubmit.disabled = isLoading;
  if (isLoading) {
    modalSubmitTxt.textContent = 'Please wait...';
  } else {
    // Restore label from plan definition
    const plan = PLAN_DETAILS[activePlan];
    modalSubmitTxt.textContent = plan ? plan.submitLabel : 'Submit';
  }
}

function isValidEmail(email) {
  // Simple RFC 5322 subset — catches most typos
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(str) {
  if (typeof str !== 'string') return String(str ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
