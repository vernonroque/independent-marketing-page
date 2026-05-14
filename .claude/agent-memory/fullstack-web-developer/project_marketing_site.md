---
name: marketing-site-context
description: Context for the ReceiptParserAPI standalone marketing site built for Vercel
metadata:
  type: project
---

The independent marketing site for ReceiptParser API lives at `/Users/vernon/CodeProjects/api-projects/receipt-parser/independent-marketing-page/`.

**Why:** This is a standalone Vercel-hosted marketing page (separate from the existing Netlify demo). The Python/FastAPI backend is deployed independently (URL in `RECEIPT_PARSER_API_URL` env var). All browser→backend calls go through Vercel serverless functions for security and CORS.

**How to apply:** When making changes to this site, remember:
- The demo JS (`js/demo.js`) expects the backend response at `response.data` (nested) — the Vercel function returns the full `{ success, data: {...}, pages_processed, response_time_ms }` envelope and the frontend extracts `.data`.
- No reCAPTCHA on this site (removed from the Netlify demo's dependency).
- `api/parse-receipt.js` uses `busboy` piped from the Vercel request stream (`req.pipe(bb)`) — NOT from a base64-encoded body like the Netlify function.
- The `[session_id].js` Stripe handler uses `req.query.session_id` (Vercel dynamic route).
- Design tokens: gradient `linear-gradient(135deg, #6366f1, #8b5cf6, #d946ef)`, bg `#0a0a0f`, cards `#12121f`, fonts Syne/DM Sans/DM Mono.
- Existing demo site lives at `/Users/vernon/CodeProjects/api-projects/receipt-parser/marketing-receipt-parser/receipt-parser-demo/` (Netlify, separate product).
