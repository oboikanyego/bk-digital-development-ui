# BK Digital Development UI

Responsive multi-page website for BK Digital Development.

## Website routes

- `/` — Home
- `/services/` — Websites, online stores, mobile apps and business systems
- `/portfolio/` — Selected projects
- `/pricing/` — Pricing packages
- `/process/` — Process and FAQs
- `/contact/` — Client enquiries and meeting requests

Each page has its own URL, accessible navigation, page title, canonical URL and a sitemap entry. The contact form still calls `/api/contact`.

## Admin routes

- `/admin/login/` — Admin sign-in (email/password)
- `/admin/dashboard/` — Protected enquiry management
- `/admin/` and `/admin.html` redirect to the new login screen

Admin pages are separate from public marketing navigation and excluded from search indexes. The dashboard HTML may be loaded publicly, but no customer data is returned without an authenticated backend session.

## Backend proxy

`/api/*` calls a Netlify Function that forwards requests to Render using the site-scoped `BACKEND_URL` environment variable. It also forwards `Set-Cookie` for signed HttpOnly admin sessions.

Do not put database credentials, admin password hashes or session secrets into the Netlify site. Configure them only in the Render backend (see backend README).

## Install and test

```bash
npm install
npm test
npm run build
```

For end-to-end local API proxy testing, run `netlify dev` instead of the plain static file server.

## Netlify settings

- Build command: `npm run build`
- Publish directory: `public`
- Functions directory: `netlify/functions`
- Environment: `BACKEND_URL=https://bk-digital-development-api.onrender.com`
