/**
 * api/billing/session/[session_id].js
 * Vercel Serverless Function — Stripe Checkout Success Handler
 *
 * GET /api/billing/session/{session_id}
 *
 * Stripe redirects the user here after a successful payment.
 * This function:
 *  1. Calls GET {RECEIPT_PARSER_API_URL}/api/billing/session/{session_id}
 *  2. Reads { session_id, status, payment_status, email, plan, api_key_created }
 *  3. Redirects to /?success=1&email={email}&plan={plan}
 *  4. On any error: redirects to /?payment_error=1
 */

const fetch = require('node-fetch');

module.exports = async function handler(req, res) {
  // Only GET is valid — Stripe sends a GET redirect
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  // Extract the dynamic segment from the URL path
  // Vercel populates req.query with the dynamic segment name
  const { session_id } = req.query;

  if (!session_id || typeof session_id !== 'string' || !session_id.trim()) {
    return res.redirect(302, '/?payment_error=1');
  }

  const backendUrl = process.env.RECEIPT_PARSER_API_URL;

  if (!backendUrl) {
    console.error('[billing/session] RECEIPT_PARSER_API_URL is not set.');
    return res.redirect(302, '/?payment_error=1');
  }

  try {
    const backendRes = await fetch(
      `${backendUrl}/api/billing/session/${encodeURIComponent(session_id.trim())}`,
      {
        method:  'GET',
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000,
      }
    );

    const contentType = backendRes.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await backendRes.json()
      : null;

    if (!backendRes.ok || !data) {
      console.warn('[billing/session] Backend returned error for session:', session_id, backendRes.status);
      return res.redirect(302, '/?payment_error=1');
    }

    const { email, plan, payment_status, status } = data;

    // Verify payment was actually successful before redirecting to success page
    if (payment_status !== 'paid' && status !== 'complete') {
      console.warn('[billing/session] Payment not completed for session:', session_id, { payment_status, status });
      return res.redirect(302, '/?payment_error=1');
    }

    if (!email || !plan) {
      console.error('[billing/session] Missing email or plan in session data:', data);
      return res.redirect(302, '/?payment_error=1');
    }

    console.log(JSON.stringify({
      event:      'payment_success',
      plan:       plan,
      session_id: session_id.slice(0, 12) + '...', // partial for logs
      timestamp:  new Date().toISOString(),
    }));

    // Redirect to the marketing page with success params
    // app.js reads these params and shows the success modal
    const successUrl = `/?success=1&email=${encodeURIComponent(email)}&plan=${encodeURIComponent(plan)}`;
    return res.redirect(302, successUrl);

  } catch (err) {
    console.error('[billing/session] Error verifying session:', err.message);
    return res.redirect(302, '/?payment_error=1');
  }
};
