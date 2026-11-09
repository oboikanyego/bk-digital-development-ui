# BK Digital Development UI

Responsive marketing website for BK Digital Development.

## Local

```bash
npm install
npm test
npm run build
npm start
```

## Netlify

- Build command: `npm run build`
- Publish directory: `public`
- Functions directory: `netlify/functions`
- Environment variable: `BACKEND_URL=https://<render-service>.onrender.com`

The browser calls `/api/contact`. Netlify proxies this request to the Render API so the backend URL is not hard-coded into the static frontend.

Production URL: https://bk-digital-development.netlify.app
