# Priyanka's Skin Care Website

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

## Deployment

Upload the `skincare` folder to the web root so the path resolves as:

```text
https://pslabs.in/skincare/
```

Before production, replace the placeholder phone number, email, and address in `index.html`.
