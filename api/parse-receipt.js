/**
 * api/parse-receipt.js
 * Vercel Serverless Function — Receipt Parser Demo Proxy
 *
 * Responsibilities:
 *  1. Parse multipart form data (file upload or sample URL)
 *  2. Apply IP-based rate limiting (in-memory store; resets on cold start)
 *  3. Forward image to the Python/FastAPI backend via POST /api/parse
 *  4. Return the parsed receipt data to the frontend
 *
 * NOTE: Vercel's default body parser is disabled for this function
 * so busboy can consume the raw multipart stream.
 */

const Busboy   = require('busboy');
const FormData = require('form-data');
const fetch    = require('node-fetch');

// ── Disable Vercel's default body parser ──────────────────────────────────────
module.exports.config = {
  api: {
    bodyParser: false,
  },
};

// ── Rate Limit Store (in-memory per instance) ─────────────────────────────────
// Resets on cold start. For persistent rate limiting use Upstash Redis or similar.
const rateLimitStore = new Map();

const RATE_LIMIT = {
  MAX_REQUESTS: 15,                        // free demo parses per window
  WINDOW_MS: 24 * 60 * 60 * 1000,        // 24-hour rolling window
};

function isRateLimited(ip) {
  const now    = Date.now();
  const record = rateLimitStore.get(ip);

  if (!record) {
    rateLimitStore.set(ip, { count: 1, windowStart: now });
    return false;
  }

  // Reset if the window has expired
  if (now - record.windowStart > RATE_LIMIT.WINDOW_MS) {
    rateLimitStore.set(ip, { count: 1, windowStart: now });
    return false;
  }

  if (record.count >= RATE_LIMIT.MAX_REQUESTS) return true;

  record.count += 1;
  return false;
}

// ── CORS Headers ──────────────────────────────────────────────────────────────
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ── Multipart Parser (busboy piped from req stream) ───────────────────────────
function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const fields   = {};
    let fileBuffer = null;
    let fileMime   = null;
    let fileName   = null;

    const bb = Busboy({ headers: req.headers });

    bb.on('file', (fieldname, stream, info) => {
      fileName = info.filename;
      fileMime = info.mimeType;
      const chunks = [];
      stream.on('data',  (chunk) => chunks.push(chunk));
      stream.on('end',   ()      => { fileBuffer = Buffer.concat(chunks); });
      stream.on('error', reject);
    });

    bb.on('field', (name, value) => {
      fields[name] = value;
    });

    bb.on('close', () => resolve({ fields, fileBuffer, fileMime, fileName }));
    bb.on('error', reject);

    // Pipe the Vercel request stream directly into busboy
    req.pipe(bb);
  });
}

// ── Fetch a Sample Image by URL ───────────────────────────────────────────────
async function fetchSampleImage(url) {
  const res = await fetch(url, { timeout: 10000 });
  if (!res.ok) throw new Error(`Failed to fetch sample image: ${res.status}`);
  const buffer   = await res.buffer();
  const mimeType = res.headers.get('content-type') || 'image/jpeg';
  return { buffer, mimeType };
}

// ── Main Handler ──────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  // Set CORS headers on every response
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  // ── 1. Get client IP ──────────────────────────────────────────────────────
  const clientIp =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown';

  // ── 2. Rate limit check ───────────────────────────────────────────────────
  if (isRateLimited(clientIp)) {
    return res.status(429).json({
      error: `You've used all ${RATE_LIMIT.MAX_REQUESTS} free demo parses in the last 24 hours. Get an API key below for unlimited access!`,
    });
  }

  // ── 3. Parse multipart form data ──────────────────────────────────────────
  let fields, fileBuffer, fileMime;

  try {
    const parsed = await parseMultipart(req);
    fields     = parsed.fields;
    fileBuffer = parsed.fileBuffer;
    fileMime   = parsed.fileMime;
  } catch (err) {
    console.error('[parse-receipt] Form parse error:', err.message);
    return res.status(400).json({ error: 'Failed to read uploaded file.' });
  }

  // ── 4. Resolve image (uploaded file or sample URL) ─────────────────────────
  try {
    if (fileBuffer && fileBuffer.length > 0) {
      // Validate file size: 5 MB max
      if (fileBuffer.length > 5 * 1024 * 1024) {
        return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
      }
    } else if (fields.sampleUrl) {
      const sample = await fetchSampleImage(fields.sampleUrl);
      fileBuffer = sample.buffer;
      fileMime   = sample.mimeType;
    } else {
      return res.status(400).json({ error: 'No receipt image provided.' });
    }
  } catch (err) {
    console.error('[parse-receipt] Image fetch error:', err.message);
    return res.status(400).json({ error: 'Could not load the receipt image.' });
  }

  // ── 5. Log request (no PII — prefix IP only) ──────────────────────────────
  const ipPrefix = clientIp !== 'unknown'
    ? clientIp.split('.').slice(0, 2).join('.') + '.x.x'
    : 'unknown';

  console.log(JSON.stringify({
    event:      'demo_parse_request',
    ref_source: fields.ref_source || 'direct',
    ip_prefix:  ipPrefix,
    timestamp:  new Date().toISOString(),
  }));

  // ── 6. Forward to Python/FastAPI backend ──────────────────────────────────
  const backendUrl = process.env.RECEIPT_PARSER_API_URL;
  const demoApiKey = process.env.DEMO_API_KEY;

  if (!backendUrl) {
    console.error('[parse-receipt] RECEIPT_PARSER_API_URL is not set.');
    return res.status(500).json({ error: 'Service configuration error.' });
  }

  try {
    const form = new FormData();
    form.append('file', fileBuffer, {
      filename:    'receipt.jpg',
      contentType: fileMime || 'image/jpeg',
    });

    const backendRes = await fetch(`${backendUrl}/api/parse`, {
      method:  'POST',
      headers: {
        ...form.getHeaders(),
        ...(demoApiKey ? { 'Authorization': `Bearer ${demoApiKey}` } : {}),
      },
      body:    form,
      timeout: 28000, // 28s — under Vercel's 30s max
    });

    const backendContentType = backendRes.headers.get('content-type') || '';

    if (!backendContentType.includes('application/json')) {
      throw new Error('Backend returned a non-JSON response.');
    }

    const backendData = await backendRes.json();

    if (!backendRes.ok) {
      const errMsg = backendData?.detail || backendData?.error || `Backend error ${backendRes.status}`;
      throw new Error(errMsg);
    }

    // Backend returns { success, data: {...receiptFields}, pages_processed, response_time_ms }
    // We forward the full response; the frontend extracts `.data`
    return res.status(200).json(backendData);

  } catch (err) {
    console.error('[parse-receipt] Backend error:', err.message);

    if (err.message && err.message.includes('429')) {
      return res.status(429).json({ error: 'API rate limit reached. Please try again shortly.' });
    }

    return res.status(502).json({ error: 'Receipt parsing failed. Please try a clearer image.' });
  }
};
