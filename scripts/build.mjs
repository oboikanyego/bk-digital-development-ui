import { access } from "node:fs/promises";
const required = [
  "public/index.html",
  "public/services/index.html",
  "public/portfolio/index.html",
  "public/pricing/index.html",
  "public/process/index.html",
  "public/contact/index.html",
  "public/admin/login/index.html",
  "public/admin/dashboard/index.html",
  "public/admin/content/index.html",
  "public/admin/email-templates/index.html",
  "public/email-template-editor.js",
  "public/email-template-editor.css",
  "public/admin/content.js",
  "public/site-view.js",
  "public/site-view.css",
  "public/styles.css",
  "public/app.js",
  "public/admin.js",
  "public/admin-login.js",
  "netlify.toml"
];
for (const file of required) await access(file);
console.log("BK Digital Development multi-page frontend ready for Netlify.");
