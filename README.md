# Mzansi Digital Ventures (Pty) Ltd UI

Responsive multi-page website for Mzansi Digital Ventures (Pty) Ltd.

## Website routes

- `/` — Home
- `/services/` — Websites, online stores, mobile apps and business systems
- `/portfolio/` — Selected projects
- `/about/` — Company purpose, location and values
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

Brand assets: `/brand-mark.svg` and `/brand-hero.svg` are lightweight vector adaptations of the supplied navy/cyan branding reference. Existing Netlify and GitHub repository identifiers are deliberately unchanged to avoid breaking deployments.

## Branded domain migration (hold until new Netlify site is deployed)

New primary hostname: https://mzansi-digital-ventures.netlify.app. Old hostname: https://bk-digital-development.netlify.app.

The old Netlify site must remain active to redirect its original .netlify.app URL. Do NOT rename or delete it.

Migration sequence:
1. In the [new Netlify project](https://app.netlify.com/projects/mzansi-digital-ventures), link Git repository `oboikanyego/bk-digital-development-ui` branch `main`.
2. Build command: `npm run build`, publish directory: `public`, functions: `netlify/functions`.
3. Set Netlify environment `BACKEND_URL=https://bk-digital-development-api.onrender.com` scoped to Functions, then deploy the branded site.
4. Verify the new homepage, services, contact form proxy (/api/health), and /admin/login/.
5. ONLY THEN merge this cutover PR. It switches canonical URLs, sitemap and robots.txt and enables a host-specific 301 redirect from the old .netlify.app hostname to the new one.
6. Keep the original Netlify site intact permanently (or until old links no longer matter), so the old hostname continues resolving to the redirect.

Netlify requires no separately purchased domain for this .netlify.app branded subdomain, but custom domains require separate DNS and domain ownership.
