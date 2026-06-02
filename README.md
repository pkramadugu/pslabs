# PSLabs Website

Static prototype for `https://pslabs.in/` with service pages.

## Pages

- `/`: PSLabs homepage covering software consulting, digital products, diagnostics at home, and skincare consultation.
- `/diagnostics/`: Diagnostics at-home booking page with a Thyrocare staging API integration scaffold.
- `/skincare/`: Priyanka's Skin Care landing page and consultation flow.

## Thyrocare Integration

The browser must not call Thyrocare directly because partner credentials and bearer tokens need to stay server-side.

The scaffolded proxy lives at:

```text
api/thyrocare.js
```

It targets staging by default:

```text
https://api-sandbox.thyrocare.com
```

Required environment variables are listed in `.env.example`.
For local testing, `server.js` also loads `.env.local` automatically if present. `.env.local` is ignored by git.

Supported proxy actions:

- `catalog`
- `pincodes`
- `priceBreakup`
- `slots`
- `createOrder`
- `orderDetails`
- `report`

For local API-backed testing, run:

```text
node server.js
```

The diagnostics page no longer uses dummy package, slot, or order data. If credentials are missing, the UI will show the backend configuration/API error instead of fake results.

## Skincare Appointment Alerts

The skincare appointment form posts to:

```text
/api/skincare-appointment
```

The endpoint can append appointment rows to Google Sheets and send a WhatsApp alert through Meta WhatsApp Cloud API. Secrets stay server-side in environment variables or `.env.local`.

Required Google Sheets variables:

```text
GOOGLE_SHEETS_SPREADSHEET_ID=
GOOGLE_SHEETS_RANGE=Appointments!A:J
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
```

Instead of `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_PRIVATE_KEY`, you can provide `GOOGLE_SERVICE_ACCOUNT_KEY_JSON` or `GOOGLE_PRIVATE_KEY_BASE64`. Share the target Sheet with the service account email before testing.

Required WhatsApp variables:

```text
WHATSAPP_GRAPH_VERSION=v23.0
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ALERT_TO=
```

If neither integration is configured, the form shows a backend configuration error rather than faking a booking.

## Security

- Secrets belong in `.env.local` or host environment variables. `.env.local` is gitignored and is not served by the static file handler.
- Dotfiles, `api/`, and `lib/` are blocked from static downloads.
- `/api/*` routes are rate-limited per client IP. Tune limits with `API_RATE_LIMIT_*` variables in `.env.example`.
- Set `PSLABS_API_KEY` only when callers are non-browser services that can send `X-PSLabs-Api-Key`. Leave it unset for the public diagnostics and skincare pages.
- Thyrocare error `details` are omitted unless `PSLABS_DEBUG_ERRORS=true`.

Initialize git inside this project directory before pushing to GitHub:

```text
cd /path/to/pslabs
git init
git add .
git commit -m "Initial PSLabs website"
```

Do not run `git init` from your home directory if a parent folder is already a git repository.
