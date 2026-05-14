/**
 * api/checkout.js
 * Vercel Serverless Function — Paid Plan Stripe Checkout Proxy
 *
 * POST /api/checkout
 * Body: { email, plan }
 *
 * Forwards to: POST {RECEIPT_PARSER_API_URL}/api/billing/checkout
 * Returns: { checkout_url: "https://checkout.stripe.com/..." }
 */

const fetch = require('node-fetch');

// ── Allowed plan keys ──────────────────────────────────────────────────────────
const VALID_PLANS = new Set(['starter', 'pro', 'business']);

// ── CORS Headers ──────────────────────────────────────────────────────────────
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

module.exports = async function handler(req, res) {
  // Set CORS on every response
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  // ── Parse and validate request body ───────────────────────────────────────
  const { email, plan } = req.body || {};

  if (!email || typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  if (!plan || !VALID_PLANS.has(plan.toLowerCase())) {
    return res.status(400).json({ error: `Invalid plan. Choose one of: ${[...VALID_PLANS].join(', ')}.` });
  }

  const trimmedEmail = email.trim().toLowerCase();
  const normalPlan   = plan.toLowerCase();

  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }

  // ── Forward to backend ─────────────────────────────────────────────────────
  const backendUrl = process.env.RECEIPT_PARSER_API_URL;

  if (!backendUrl) {
    console.error('[checkout] RECEIPT_PARSER_API_URL is not set.');
    return res.status(500).json({ error: 'Service configuration error.' });
  }

  try {
    const backendRes = await fetch(`${backendUrl}/api/billing/checkout`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: trimmedEmail, plan: normalPlan }),
      timeout: 15000,
    });

    const contentType = backendRes.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await backendRes.json()
      : null;

    if (!backendRes.ok) {
      const errMsg = data?.detail || data?.error || `Backend error ${backendRes.status}.`;
      return res.status(backendRes.status).json({ error: errMsg });
    }

    if (!data?.checkout_url) {
      return res.status(502).json({ error: 'No checkout URL returned from payment service.' });
    }

    console.log(JSON.stringify({
      event:      'checkout_initiated',
      plan:       normalPlan,
      email_hash: Buffer.from(trimmedEmail).toString('base64').slice(-8),
      timestamp:  new Date().toISOString(),
    }));

    // Return the Stripe checkout URL to the frontend for redirect
    return res.status(200).json({ checkout_url: data.checkout_url });

  } catch (err) {
    console.error('[checkout] Backend error:', err.message);
    return res.status(502).json({ error: 'Could not reach the checkout service. Please try again.' });
  }
};
