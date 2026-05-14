/**
 * api/keys.js
 * Vercel Serverless Function — Free Tier API Key Provisioning
 *
 * POST /api/keys
 * Body: { email }
 *
 * Proxies the request to the Python/FastAPI backend at
 * POST {RECEIPT_PARSER_API_URL}/api/keys with { email, plan: "free" }
 * and returns the backend response directly.
 */

const fetch = require('node-fetch');

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

  // ── Parse request body ─────────────────────────────────────────────────────
  const { email } = req.body || {};

  if (!email || typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  const trimmedEmail = email.trim().toLowerCase();

  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }

  // ── Forward to backend ─────────────────────────────────────────────────────
  const backendUrl = process.env.RECEIPT_PARSER_API_URL;

  if (!backendUrl) {
    console.error('[keys] RECEIPT_PARSER_API_URL is not set.');
    return res.status(500).json({ error: 'Service configuration error.' });
  }

  try {
    const backendRes = await fetch(`${backendUrl}/api/keys`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: trimmedEmail, plan: 'free' }),
      timeout: 15000,
    });

    const contentType = backendRes.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await backendRes.json()
      : { message: 'Request submitted.' };

    // Surface backend errors to the client
    if (!backendRes.ok) {
      const errMsg = data?.detail || data?.error || `Backend error ${backendRes.status}.`;
      return res.status(backendRes.status).json({ error: errMsg });
    }

    console.log(JSON.stringify({
      event:     'free_key_request',
      email_hash: Buffer.from(trimmedEmail).toString('base64').slice(-8), // partial, non-reversible
      timestamp: new Date().toISOString(),
    }));

    return res.status(200).json(data);

  } catch (err) {
    console.error('[keys] Backend error:', err.message);
    return res.status(502).json({ error: 'Could not reach the key provisioning service. Please try again.' });
  }
};
