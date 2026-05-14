# ReceiptParser API — Marketing Site

Marketing website for the Receipt Parser API, hosted on Vercel. Includes an interactive demo, pricing tiers, and Stripe checkout integration.

## Project Structure

```
├── index.html                       # Main marketing page (6 sections)
├── css/
│   └── styles.css                   # Dark theme, indigo → violet → fuchsia gradient system
├── js/
│   ├── app.js                       # Navigation, mobile menu, hero animation, modals
│   ├── demo.js                      # Interactive receipt parsing demo
│   └── pricing.js                   # Email modal, free key flow, Stripe checkout
├── sample-receipts/                 # Sample receipt images for the demo
├── api/
│   ├── parse-receipt.js             # Demo proxy → Python backend (with rate limiting)
│   ├── keys.js                      # Free tier proxy → POST /api/keys
│   ├── checkout.js                  # Paid checkout proxy → POST /api/billing/checkout
│   └── billing/session/
│       └── [session_id].js          # Stripe success redirect handler
├── vercel.json                      # Vercel config (512MB memory, 30s timeout)
├── package.json
└── .env.example
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

| Variable | Description |
|---|---|
| `RECEIPT_PARSER_API_URL` | Your deployed backend URL (e.g. `https://your-app.up.railway.app`) |
| `DEMO_API_KEY` | A valid API key used by the demo to call the parse endpoint |

### 3. Deploy to Vercel

```bash
npx vercel
```

Set the same environment variables in your Vercel project dashboard under **Settings → Environment Variables**.

## Checkout Flow

1. User selects a paid plan → enters email in modal → `POST /api/checkout`
2. Frontend receives `{ checkout_url }` and redirects to Stripe
3. After payment, Stripe redirects to `GET /api/billing/session/{session_id}` on this site
4. Vercel function verifies the session with the backend
5. Redirects to `/?success=1&email=...&plan=...` — frontend shows the success modal

## Pricing Tiers

| Plan | Price | Requests | Rate Limit | Support |
|---|---|---|---|---|
| Free | $0/mo | 500/month | 100/hr | Community |
| Starter | $12/mo | 5,000/month | 500/hr | Email |
| Pro | $35/mo | 25,000/month | 2,000/hr | Priority email |
| Business | $109/mo | 150,000/month | Unlimited | Dedicated |
