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

## Primary website address

Primary site: https://mzansi-digital-ventures.netlify.app
Netlify project: https://app.netlify.com/projects/mzansi-digital-ventures
The GitHub repository name and Render API URL remain unchanged.

The new Netlify project has a successful production build on main. The previous Netlify project (formerly at https://bk-digital-development.netlify.app) is no longer listed in the connected account, so legacy URL redirects are **not configured** by this repository. Netlify redirects require the original hostname to remain attached to an active site. A rule on the new site cannot redirect requests that never reach it.

If legacy URL redirects are required later, restore/create a Netlify project that owns the old hostname, and publish a minimal redirect-only configuration there, rather than renaming or changing this branded site. Old links are not guaranteed to work unless that old hostname is recovered and a redirect deployment is confirmed.

The website's canonical links, robots.txt and sitemap now reference the branded address. The API proxy uses BACKEND_URL if configured and otherwise falls back to the existing public Render API URL.

## Portfolio project images

The public `/portfolio/` page includes three real optimised WebP application screenshots transferred from the developer's original portfolio repository (`oboikanyego/my-portfolio`): MzansiRent, DentaCare and Freelance Services Platform. Source project details are taken from `src/config/default-site-config.js` in the portfolio API and authored project case studies in `my-portfolio`. These images are stored locally under `/public/images/projects/` for reliability and do not require a third-party screenshot service. The existing newer projects remain in the portfolio with clearly illustrative preview graphics. Real-time chat and authentication are labelled technical demonstrations, not marketed as deployed products.

## Verified live website screenshots

Desktop and mobile screenshots for KasiDrop, Mzansi Rent Lite and Genesis Kiddies Corner are captured from each site's public homepage with Playwright Chromium in GitHub Actions and stored in `public/images/projects/`. `public/images/projects/live-capture-manifest.json` contains source URLs, HTTP statuses, titles, visible text lengths, sizes and capture date. No private accounts are used. Mobile variants are served using `<picture>` sources. Note that free backend sleep can leave loading placeholders visible during screenshot capture. The screenshots represent actual page states, not fabricated mockups.

## Royal Treats

Royal Treats is included in the project showcase with desktop and mobile screenshot assets captured from its public Netlify storefront. The source project's Angular frontend and Node.js/MongoDB API support dessert ordering, local delivery, and separate admin/courier operations. Source capture metadata is stored in `public/images/projects/royal-treats-capture.json`.

## Email template management
Use `/admin/email-templates/` (admin sign-in required) to choose a MongoDB email template, edit its subject, HTML design, plain-text fallback and Cloudinary PNG/JPG logo, then preview the Handlebars rendering with example customer data. Publish increments its revision. All live email sends and admin email retries read the published record; there is no frontend template file or hardcoded template used at runtime.
