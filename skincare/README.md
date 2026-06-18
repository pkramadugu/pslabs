# Dr. Priyanka's Skin Clinic Website

Static website for `https://pslabs.in/skincare/`.

## Stack

- HTML5
- CSS3
- Vanilla JavaScript
- Generated raster hero image stored at `assets/clinic-hero.png`

## Files

- `index.html`: page content, SEO metadata, schema markup
- `styles.css`: responsive layout and visual design
- `script.js`: mobile nav, FAQ toggle, appointment form submission
- `assets/clinic-hero.png`: hero image
- `assets/skincare-logo.jpg`: clinic logo used in the header and favicon

## Appointment Alerts

Appointment requests are submitted to `/api/skincare-appointment`. Configure Google Sheets and WhatsApp environment variables in the project `.env.local` file; see the root `README.md` and `.env.example`.

### Google Sheet setup (2 minutes)

1. Open your [appointment spreadsheet](https://docs.google.com/spreadsheets/d/1OkL7JXwzkd-zBxWs2Mm-yFefez_nZj3xF4xSXxQppFo/edit).
2. **Extensions → Apps Script** and paste `google-sheet-webhook.gs` from this folder.
3. **Deploy → New deployment → Web app** (Execute as **Me**, access **Anyone**).
4. Copy the web app URL into `.env.local` as `GOOGLE_APPS_SCRIPT_URL`.
5. Restart `node server.js` from the project root.

WhatsApp variables in `.env.local` are optional until Meta Cloud API credentials are ready.

## Deployment

Upload the `skincare` folder to the web root so the path resolves as:

```text
https://pslabs.in/skincare/
```

Before production, replace the placeholder phone number, email, and address in `index.html`.
