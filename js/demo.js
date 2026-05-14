/* =============================================
   demo.js — Interactive demo logic
   Adapted from the existing demo frontend app.js.
   No reCAPTCHA dependency — this is the marketing site.
   ============================================= */

// ── Config ───────────────────────────────────────
const API_ENDPOINT = '/api/parse-receipt';

// ── Sample receipt images ────────────────────────
const SAMPLES = {
  restaurant: {
    url: 'sample-receipts/restaurant-receipt.jpg',
    label: '🍕 Restaurant'
  },
  grocery: {
    url: 'sample-receipts/Carulla.jpg',
    label: '🛒 Grocery'
  },
  gym: {
    url: 'sample-receipts/gym-invoice.jpg',
    label: '🏋️ Gym Invoice'
  }
};

// ── Static preview data shown on page load ───────
const PREVIEW_SAMPLE = {
  merchant_name: "The Golden Fork",
  date: "2025-04-18",
  time: "19:42",
  address: "120 Main St, Austin, TX 78701",
  line_items: [
    { description: "Ribeye Steak", price: 42.00 },
    { description: "Caesar Salad", price: 14.50 },
    { description: "Craft IPA (2x)", price: 18.00 },
    { description: "Crème Brûlée", price: 9.75 }
  ],
  subtotal: 84.25,
  tax: 6.96,
  tip: 15.00,
  total: 106.21,
  payment_method: "Visa",
  currency: "USD",
  receipt_number: "RCP-20250418-0047"
};

// ── State ─────────────────────────────────────────
let currentFile   = null;
let currentSample = null;

// ── DOM References ────────────────────────────────
const dropzone      = document.getElementById('dropzone');
const fileInput     = document.getElementById('file-input');
const previewArea   = document.getElementById('preview-area');
const previewImg    = document.getElementById('preview-img');
const btnClear      = document.getElementById('btn-clear');
const btnParse      = document.getElementById('btn-parse');
const errorMsg      = document.getElementById('error-msg');
const outputIdle    = document.getElementById('output-idle');
const outputLoading = document.getElementById('output-loading');
const outputResult  = document.getElementById('output-result');
const resultCards   = document.getElementById('result-cards');
const resultTime    = document.getElementById('result-time');
const jsonOutput    = document.getElementById('json-output');
const jsonBlock     = document.getElementById('json-block');
const btnCopyJson   = document.getElementById('btn-copy-json');
const resultCta     = document.getElementById('result-cta');
const sampleBtns    = document.querySelectorAll('.sample-btn');

// Guard: if the demo section isn't on the page, exit early
if (!dropzone) {
  // Not a fatal error — demo section may not be present
  console.info('Demo section not found on this page.');
}

// ── Drag & Drop ───────────────────────────────────
if (dropzone) {
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  });

  // Click on dropzone opens file picker (skip if user clicked the label)
  dropzone.addEventListener('click', (e) => {
    if (e.target.closest('label') || e.target === fileInput) return;
    fileInput.click();
  });

  // Keyboard accessibility for the dropzone
  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });
}

if (fileInput) {
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleFileSelect(fileInput.files[0]);
  });
}

// ── File Selection ────────────────────────────────
function handleFileSelect(file) {
  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
  const maxSize = 5 * 1024 * 1024; // 5 MB

  if (!allowedTypes.includes(file.type)) {
    showError('Please upload a JPG, PNG, or PDF file.');
    return;
  }

  if (file.size > maxSize) {
    showError('File is too large. Maximum size is 5MB.');
    return;
  }

  clearSampleSelection();
  currentFile   = file;
  currentSample = null;

  hideError();
  showPreview(file);
  enableParseButton();
}

function showPreview(file) {
  if (file.type === 'application/pdf') {
    // PDF placeholder SVG
    previewImg.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiMxMTExMTgiLz48dGV4dCB4PSI1MCIgeT0iNTUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM4YThhOWEiIGZvbnQtc2l6ZT0iMTQiIGZvbnQtZmFtaWx5PSJtb25vc3BhY2UiPlBERjwvdGV4dD48L3N2Zz4=';
  } else {
    const reader = new FileReader();
    reader.onload = (e) => { previewImg.src = e.target.result; };
    reader.readAsDataURL(file);
  }

  if (dropzone)   dropzone.style.display = 'none';
  if (previewArea) previewArea.style.display = 'block';
}

// ── Sample Buttons ────────────────────────────────
sampleBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    const sampleKey = btn.dataset.sample;
    const sample    = SAMPLES[sampleKey];
    if (!sample) return;

    clearSampleSelection();
    btn.classList.add('active');
    currentSample = sampleKey;
    currentFile   = null;

    previewImg.src = sample.url;
    if (dropzone)    dropzone.style.display    = 'none';
    if (previewArea) previewArea.style.display = 'block';

    hideError();
    enableParseButton();
  });
});

function clearSampleSelection() {
  sampleBtns.forEach((b) => b.classList.remove('active'));
}

// ── Clear Button ──────────────────────────────────
if (btnClear) {
  btnClear.addEventListener('click', resetUpload);
}

function resetUpload() {
  currentFile   = null;
  currentSample = null;
  if (fileInput)   fileInput.value = '';
  if (previewImg)  previewImg.src  = '';
  if (previewArea) previewArea.style.display = 'none';
  if (dropzone)    dropzone.style.display    = 'block';
  clearSampleSelection();
  disableParseButton();
  hideError();
  resetOutput();
}

// ── Parse Button ──────────────────────────────────
function enableParseButton()  { if (btnParse) btnParse.disabled = false; }
function disableParseButton() { if (btnParse) btnParse.disabled = true; }

if (btnParse) {
  btnParse.addEventListener('click', handleParse);
}

// ── Copy JSON Button ──────────────────────────────
if (btnCopyJson) {
  btnCopyJson.addEventListener('click', () => {
    const text = jsonOutput ? jsonOutput.textContent : '';
    if (!text) return;

    const onCopied = () => {
      btnCopyJson.textContent = 'Copied!';
      btnCopyJson.classList.add('copied');
      setTimeout(() => {
        btnCopyJson.textContent = 'Copy JSON';
        btnCopyJson.classList.remove('copied');
      }, 2000);
    };

    navigator.clipboard.writeText(text)
      .then(onCopied)
      .catch(() => {
        // Fallback for older browsers
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;opacity:0;';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        onCopied();
      });
  });
}

// ── Parse Handler ─────────────────────────────────
async function handleParse() {
  hideError();
  setLoading(true);

  try {
    const formData = new FormData();

    // Append ref/UTM attribution data
    formData.append('ref_source', sessionStorage.getItem('ref_source') || 'direct');

    if (currentFile) {
      formData.append('receipt', currentFile);
    } else if (currentSample) {
      // Build absolute URL so the serverless function can fetch the sample
      const sampleUrl = new URL(SAMPLES[currentSample].url, window.location.href).href;
      formData.append('sampleKey', currentSample);
      formData.append('sampleUrl', sampleUrl);
    } else {
      throw new Error('No receipt selected.');
    }

    const startTime = Date.now();
    const response  = await fetch(API_ENDPOINT, {
      method: 'POST',
      body: formData,
    });

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Request timed out. Try a smaller or single-page receipt.');
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    const json    = await response.json();

    if (!response.ok) {
      throw new Error(json.error || 'Something went wrong. Please try again.');
    }

    // Backend returns { success, data: { ...receiptFields }, pages_processed, response_time_ms }
    // Extract the nested `data` object for display
    const receiptData = json.data || json;

    displayResult(receiptData, elapsed, false);

    // GA4 demo_parsed event
    if (typeof gtag !== 'undefined') {
      gtag('event', 'demo_parsed', {
        sample_type: currentSample || 'uploaded',
        elapsed_s: elapsed,
      });
    }

  } catch (err) {
    showError(err.message || 'An unexpected error occurred.');
    setLoading(false);
    showIdle();
  }
}

// ── Display Result ────────────────────────────────
/**
 * @param {Object}  data      - Parsed receipt data object
 * @param {string|null} elapsed - Elapsed time in seconds (null for preview)
 * @param {boolean} isPreview - If true, show preview styling (no header chrome)
 */
function displayResult(data, elapsed, isPreview = false) {
  setLoading(false);

  if (!outputResult) return;

  outputIdle.style.display    = 'none';
  outputLoading.style.display = 'none';
  outputResult.style.display  = 'block';

  const resultHeader = outputResult.querySelector('.result-header');

  if (isPreview) {
    // Preview: hide the "Parsed Successfully" header, show plain JSON
    if (resultHeader) resultHeader.style.display = 'none';
    resultCards.innerHTML = '';
    jsonOutput.textContent = JSON.stringify(data, null, 2);
    if (jsonBlock) jsonBlock.style.display = 'block';
    if (resultCta) resultCta.style.display = 'none';
  } else {
    // Live parse: full chrome + cards + CTA
    if (resultHeader) resultHeader.style.display = '';
    if (jsonBlock)    jsonBlock.style.display     = 'block';

    const badge = outputResult.querySelector('.result-badge');
    if (badge) {
      badge.textContent = '✓ Parsed Successfully';
      badge.className   = 'result-badge';
    }

    if (resultTime) {
      resultTime.textContent = elapsed ? `Parsed in ${elapsed}s` : '';
    }

    // Build field cards
    resultCards.innerHTML = '';
    const fields = buildDisplayFields(data);
    fields.forEach((field, i) => {
      const card = document.createElement('div');
      card.className = 'result-card';
      card.style.animationDelay = `${i * 0.05}s`;
      card.innerHTML = `
        <span class="card-key">${escapeHtml(field.key)}</span>
        <span class="card-value ${field.highlight ? 'highlight' : ''}">${field.value}</span>
      `;
      resultCards.appendChild(card);
    });

    if (jsonOutput) {
      jsonOutput.textContent = JSON.stringify(data, null, 2);
    }

    // Show post-parse CTA
    if (resultCta) resultCta.style.display = 'block';
  }
}

function buildDisplayFields(data) {
  const fields = [];

  if (data.merchant_name) fields.push({ key: 'Merchant',  value: escapeHtml(data.merchant_name) });
  if (data.date)          fields.push({ key: 'Date',      value: escapeHtml(data.date) });
  if (data.time)          fields.push({ key: 'Time',      value: escapeHtml(data.time) });
  if (data.address)       fields.push({ key: 'Address',   value: escapeHtml(data.address) });

  if (data.line_items && data.line_items.length > 0) {
    const shown = data.line_items.slice(0, 5);
    const more  = data.line_items.length - 5;
    const itemsHtml = `<ul class="line-items-list">
      ${shown.map(item => `
        <li>${escapeHtml(item.description || item.name || 'Item')}${item.price != null ? ' — ' + formatCurrency(item.price, data.currency) : ''}</li>
      `).join('')}
      ${more > 0 ? `<li style="color:var(--text-muted)">+ ${more} more</li>` : ''}
    </ul>`;
    fields.push({ key: 'Line Items', value: itemsHtml });
  }

  if (data.subtotal != null) fields.push({ key: 'Subtotal', value: formatCurrency(data.subtotal, data.currency) });
  if (data.tax      != null) fields.push({ key: 'Tax',      value: formatCurrency(data.tax, data.currency) });
  if (data.tip      != null) fields.push({ key: 'Tip',      value: formatCurrency(data.tip, data.currency) });
  if (data.total    != null) fields.push({ key: 'Total',    value: formatCurrency(data.total, data.currency), highlight: true });
  if (data.payment_method)   fields.push({ key: 'Payment',  value: escapeHtml(data.payment_method) });
  if (data.currency)         fields.push({ key: 'Currency', value: escapeHtml(data.currency) });
  if (data.receipt_number)   fields.push({ key: 'Receipt #', value: escapeHtml(data.receipt_number) });

  return fields;
}

function formatCurrency(amount, currency) {
  if (amount == null) return '—';
  const num = parseFloat(amount);
  if (isNaN(num)) return String(amount);
  const symbol = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';
  return `${symbol}${num.toFixed(2)}`;
}

function escapeHtml(str) {
  if (typeof str !== 'string') return String(str ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── UI State Helpers ──────────────────────────────
function setLoading(isLoading) {
  if (isLoading) {
    if (outputIdle)    outputIdle.style.display    = 'none';
    if (outputResult)  outputResult.style.display  = 'none';
    if (outputLoading) outputLoading.style.display = 'flex';
    disableParseButton();
    if (btnParse) {
      btnParse.classList.add('loading');
      const txt = btnParse.querySelector('.btn-parse-text');
      if (txt) txt.textContent = 'Parsing...';
    }
  } else {
    if (outputLoading) outputLoading.style.display = 'none';
    enableParseButton();
    if (btnParse) {
      btnParse.classList.remove('loading');
      const txt = btnParse.querySelector('.btn-parse-text');
      if (txt) txt.textContent = 'Parse Receipt';
    }
  }
}

function showIdle() {
  if (outputIdle)    outputIdle.style.display    = 'flex';
  if (outputLoading) outputLoading.style.display = 'none';
  if (outputResult)  outputResult.style.display  = 'none';
}

function resetOutput() {
  showIdle();
  if (jsonBlock) jsonBlock.style.display = 'none';
  if (resultCta) resultCta.style.display = 'none';
}

function showError(message) {
  if (!errorMsg) return;
  errorMsg.textContent   = message;
  errorMsg.style.display = 'block';
}

function hideError() {
  if (!errorMsg) return;
  errorMsg.style.display = 'none';
  errorMsg.textContent   = '';
}

// ── Page Load: show static preview ───────────────
document.addEventListener('DOMContentLoaded', () => {
  if (outputResult) {
    displayResult(PREVIEW_SAMPLE, null, true);
  }
});
